import { prisma } from "./prisma";
import { checkStaleProjectsForUser } from "./stale";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface DigestSection {
  title: string;
  items: string[];
}

export async function generateDigestEmail(userId: string): Promise<{
  subject: string;
  html: string;
}> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true, repoOwner: true, repoName: true },
  });

  const sections: DigestSection[] = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 1. Overnight sync results
  const recentLogs = await prisma.syncLog.findMany({
    where: {
      projectId: { in: projects.map((p) => p.id) },
      startedAt: { gte: sevenDaysAgo },
      status: "success",
    },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  const syncItems: string[] = [];
  for (const log of recentLogs) {
    if (!log.summaryJson) continue;
    try {
      const summary = JSON.parse(log.summaryJson);
      const project = projects.find((p) => p.id === log.projectId);
      if (!project) continue;

      const changes: string[] = [];
      if (summary.mdTasksCreated > 0)
        changes.push(`${summary.mdTasksCreated} tasks created`);
      if (summary.mdTasksUpdated > 0)
        changes.push(`${summary.mdTasksUpdated} tasks updated`);
      if (summary.mdTasksDeleted > 0)
        changes.push(`${summary.mdTasksDeleted} tasks removed`);
      if (summary.releasesCreated > 0)
        changes.push(`${summary.releasesCreated} releases added`);
      if (summary.githubReleasesSynced > 0)
        changes.push(`${summary.githubReleasesSynced} GitHub releases synced`);

      if (changes.length > 0) {
        syncItems.push(
          `<strong>${escapeHtml(project.repoOwner)}/${escapeHtml(project.repoName)}</strong>: ${changes.join(", ")}`
        );
      }
    } catch {
      // Skip malformed log entries
    }
  }

  if (syncItems.length > 0) {
    sections.push({ title: "Recent Sync Activity", items: syncItems });
  }

  // 2. Blocked tasks
  const blockedTasks = await prisma.task.findMany({
    where: {
      projectId: { in: projects.map((p) => p.id) },
      status: "blocked",
    },
    include: {
      project: { select: { repoOwner: true, repoName: true } },
    },
    take: 10,
  });

  if (blockedTasks.length > 0) {
    sections.push({
      title: "Blocked Tasks",
      items: blockedTasks.map(
        (t) =>
          `<strong>${escapeHtml(t.project.repoOwner)}/${escapeHtml(t.project.repoName)}</strong>: ${escapeHtml(t.title)}`
      ),
    });
  }

  // 3. Stale projects
  const staleProjects = await checkStaleProjectsForUser(userId);
  if (staleProjects.length > 0) {
    sections.push({
      title: "Stale Projects",
      items: staleProjects.map(
        (p) =>
          `<strong>${escapeHtml(p.repoOwner)}/${escapeHtml(p.repoName)}</strong>: ${p.daysSinceLastCommit ?? "?"} days since last commit`
      ),
    });
  }

  // 4. Due this week
  const dueTasks = await prisma.task.findMany({
    where: {
      projectId: { in: projects.map((p) => p.id) },
      metadata: {
        dueDate: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
    },
    include: {
      project: { select: { repoOwner: true, repoName: true } },
      metadata: { select: { dueDate: true } },
    },
    orderBy: { metadata: { dueDate: "asc" } },
    take: 10,
  });

  if (dueTasks.length > 0) {
    sections.push({
      title: "Due This Week",
      items: dueTasks.map((t) => {
        const dueDate = t.metadata?.dueDate
          ? new Date(t.metadata.dueDate).toLocaleDateString()
          : "";
        return `<strong>${escapeHtml(t.project.repoOwner)}/${escapeHtml(t.project.repoName)}</strong>: ${escapeHtml(t.title)}${dueDate ? ` (due ${dueDate})` : ""}`;
      }),
    });
  }

  // 5. Shipped this week
  const shippedReleases = await prisma.release.findMany({
    where: {
      projectId: { in: projects.map((p) => p.id) },
      releasedAt: {
        gte: sevenDaysAgo,
        lte: now,
      },
    },
    include: {
      project: { select: { repoOwner: true, repoName: true } },
    },
    orderBy: { releasedAt: "desc" },
    take: 10,
  });

  if (shippedReleases.length > 0) {
    sections.push({
      title: "Shipped This Week",
      items: shippedReleases.map(
        (r) =>
          `<strong>${escapeHtml(r.project.repoOwner)}/${escapeHtml(r.project.repoName)}</strong>: ${escapeHtml(r.name)}`
      ),
    });
  }

  // If nothing to report
  if (sections.length === 0) {
    return {
      subject: "Project Tracker Daily Digest — All quiet",
      html: buildEmailHtml(
        user.name ?? "there",
        "All quiet today — no notable changes across your projects."
      ),
    };
  }

  const subject = `Project Tracker Daily Digest — ${sections.length} update${sections.length > 1 ? "s" : ""}`;
  const html = buildEmailHtmlFromSections(user.name ?? "there", sections);

  return { subject, html };
}

function buildEmailHtml(name: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <h1 style="color:#fafafa;font-size:20px;margin:0 0 8px;">Project Tracker</h1>
    <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px;">Daily digest for ${escapeHtml(name)}</p>
    <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:20px;">
      <p style="color:#d4d4d8;font-size:14px;line-height:1.6;">${message}</p>
    </div>
    <p style="color:#52525b;font-size:12px;margin-top:24px;">Sent by Project Tracker</p>
  </div>
</body>
</html>`;
}

function buildEmailHtmlFromSections(
  name: string,
  sections: DigestSection[]
): string {
  const sectionHtml = sections
    .map(
      (s) => `
    <div style="margin-bottom:20px;">
      <h2 style="color:#fafafa;font-size:16px;margin:0 0 12px;">${escapeHtml(s.title)}</h2>
      <ul style="margin:0;padding:0 0 0 20px;list-style:disc;">
        ${s.items.map((item) => `<li style="color:#d4d4d8;font-size:13px;line-height:1.8;">${item}</li>`).join("")}
      </ul>
    </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <h1 style="color:#fafafa;font-size:20px;margin:0 0 8px;">Project Tracker</h1>
    <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px;">Daily digest for ${escapeHtml(name)}</p>
    <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:20px;">
      ${sectionHtml}
    </div>
    <p style="color:#52525b;font-size:12px;margin-top:24px;">Sent by Project Tracker</p>
  </div>
</body>
</html>`;
}
