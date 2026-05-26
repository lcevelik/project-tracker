import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { createHash } from "crypto";
import { prisma } from "./prisma";
import { getOctokit, fetchFileContent, fetchOpenIssues, fetchOpenPRs, fetchReleases, fetchCommitActivity } from "./github";
import { parseProjectMd } from "./parser";
import type { TaskStatus } from "./parser";
import { parseWithAI } from "./ai-parser";

// ---------------------------------------------------------------------------
// Token encryption helpers (AES-256-GCM)
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("ENCRYPTION_KEY env var must be 64 hex characters (32 bytes)");
  }
  return Buffer.from(keyHex, "hex");
}

export function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, "utf-8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  // Format: iv(hex):authTag(hex):ciphertext(hex)
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptToken(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const ciphertext = parts[2];

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf-8");
  decrypted += decipher.final("utf-8");

  return decrypted;
}

// ---------------------------------------------------------------------------
// Content fingerprinting
// ---------------------------------------------------------------------------

export function computeContentHash(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Sync summary type
// ---------------------------------------------------------------------------

export interface SyncSummary {
  projectId: string;
  startedAt: string;
  finishedAt: string;
  mdTasksCreated: number;
  mdTasksUpdated: number;
  mdTasksDeleted: number;
  issuesSynced: number;
  prsSynced: number;
  goalsCreated: number;
  goalsUpdated: number;
  releasesCreated: number;
  releasesUpdated: number;
  githubReleasesSynced: number;
  commitDaysSynced: number;
  projectMdFound: boolean;
  aiFallbackUsed: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// AI fallback files to check when PROJECT.md is missing
// ---------------------------------------------------------------------------

const AI_FALLBACK_FILES = ["README.md", "TODO.md", "PLAN.md", "CHANGELOG.md"];

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

export async function syncProject(projectId: string): Promise<SyncSummary> {
  const startedAt = new Date();

  const summary: SyncSummary = {
    projectId,
    startedAt: startedAt.toISOString(),
    finishedAt: "",
    mdTasksCreated: 0,
    mdTasksUpdated: 0,
    mdTasksDeleted: 0,
    issuesSynced: 0,
    prsSynced: 0,
    goalsCreated: 0,
    goalsUpdated: 0,
    releasesCreated: 0,
    releasesUpdated: 0,
    githubReleasesSynced: 0,
    commitDaysSynced: 0,
    projectMdFound: false,
    aiFallbackUsed: false,
    errors: [],
  };

  // Create sync log entry
  const syncLog = await prisma.syncLog.create({
    data: {
      projectId,
      status: "running",
    },
  });

  try {
    // 1. Load project
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { user: true },
    });

    // 2. Get access token from Account table
    const account = await prisma.account.findFirst({
      where: {
        userId: project.userId,
        provider: "github",
      },
    });

    if (!account?.access_token) {
      throw new Error("No GitHub access token found for this user");
    }

    const accessToken = account.access_token;
    const octokit = getOctokit(accessToken);

    const { repoOwner, repoName, defaultBranch, projectMdPath } = project;

    // 3. Fetch and parse PROJECT.md
    let parsedResult: { tasks: Array<{ title: string; status: TaskStatus; contentHash: string; rawMarkdown: string; lineRef: number | null }>; goals: Array<{ title: string; description: string | null; targetDate: string | null }>; releases: Array<{ name: string; status: string; date: string | null; notes: string | null }> } | null = null;

    try {
      const mdContent = await fetchFileContent(
        octokit,
        repoOwner,
        repoName,
        projectMdPath,
        defaultBranch
      );

      if (mdContent) {
        summary.projectMdFound = true;
        parsedResult = parseProjectMd(mdContent);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`PROJECT.md sync: ${msg}`);
    }

    // 4. AI fallback: if no PROJECT.md found and AI fallback is enabled
    if (!parsedResult && project.aiFallbackEnabled) {
      try {
        const fallbackContents: string[] = [];
        const fallbackFilenames: string[] = [];

        for (const filename of AI_FALLBACK_FILES) {
          const content = await fetchFileContent(
            octokit,
            repoOwner,
            repoName,
            filename,
            defaultBranch
          );
          if (content) {
            fallbackContents.push(`## File: ${filename}\n\n${content}`);
            fallbackFilenames.push(filename);
          }
        }

        if (fallbackContents.length > 0) {
          const combinedContent = fallbackContents.join("\n\n---\n\n");
          const filenamesStr = fallbackFilenames.join(", ");
          parsedResult = await parseWithAI(combinedContent, filenamesStr);
          summary.aiFallbackUsed = true;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        summary.errors.push(`AI fallback: ${msg}`);
      }
    }

    // 5. Apply parsed results (same logic for both deterministic and AI)
    if (parsedResult) {
      // Sync MD tasks using content fingerprinting
      const existingMdTasks = await prisma.task.findMany({
        where: { projectId, source: "md" },
        include: { metadata: true },
      });

      const existingByHash = new Map(
        existingMdTasks
          .filter((t) => t.contentHash)
          .map((t) => [t.contentHash!, t])
      );

      const seenHashes = new Set<string>();

      for (const task of parsedResult.tasks) {
        const hash = task.contentHash;
        seenHashes.add(hash);

        const existing = existingByHash.get(hash);

        if (existing) {
          const needsUpdate =
            existing.title !== task.title ||
            existing.status !== task.status ||
            existing.rawMarkdown !== task.rawMarkdown ||
            existing.lineRef !== task.lineRef;

          if (needsUpdate) {
            await prisma.task.update({
              where: { id: existing.id },
              data: {
                title: task.title,
                status: task.status,
                rawMarkdown: task.rawMarkdown,
                lineRef: task.lineRef,
                externalId: task.contentHash,
              },
            });
            summary.mdTasksUpdated++;
          }
        } else {
          await prisma.task.create({
            data: {
              projectId,
              source: "md",
              externalId: task.contentHash,
              title: task.title,
              status: task.status,
              rawMarkdown: task.rawMarkdown,
              contentHash: task.contentHash,
              lineRef: task.lineRef,
            },
          });
          summary.mdTasksCreated++;
        }
      }

      // Delete MD tasks whose content hash is no longer in the parsed output
      const tasksToDelete = existingMdTasks.filter(
        (t) => t.contentHash && !seenHashes.has(t.contentHash)
      );

      for (const task of tasksToDelete) {
        await prisma.task.delete({ where: { id: task.id } });
        summary.mdTasksDeleted++;
      }

      // Sync Goals
      for (const goal of parsedResult.goals) {
        const existing = await prisma.goal.findFirst({
          where: {
            projectId,
            title: goal.title,
          },
        });

        if (existing) {
          await prisma.goal.update({
            where: { id: existing.id },
            data: {
              description: goal.description,
              targetDate: goal.targetDate ? new Date(goal.targetDate) : null,
            },
          });
          summary.goalsUpdated++;
        } else {
          await prisma.goal.create({
            data: {
              projectId,
              title: goal.title,
              description: goal.description,
              targetDate: goal.targetDate ? new Date(goal.targetDate) : null,
              status: "active",
            },
          });
          summary.goalsCreated++;
        }
      }

      // Sync Releases from MD
      for (const release of parsedResult.releases) {
        const existing = await prisma.release.findFirst({
          where: {
            projectId,
            source: "md",
            name: release.name,
          },
        });

        if (existing) {
          await prisma.release.update({
            where: { id: existing.id },
            data: {
              status: release.status === "released" ? "released" : "planned",
              plannedDate: release.date ? new Date(release.date) : null,
              releasedAt:
                release.status === "released" && release.date
                  ? new Date(release.date)
                  : null,
              notes: release.notes,
            },
          });
          summary.releasesUpdated++;
        } else {
          await prisma.release.create({
            data: {
              projectId,
              source: "md",
              name: release.name,
              status: release.status === "released" ? "released" : "planned",
              plannedDate: release.date ? new Date(release.date) : null,
              releasedAt:
                release.status === "released" && release.date
                  ? new Date(release.date)
                  : null,
              notes: release.notes,
            },
          });
          summary.releasesCreated++;
        }
      }
    }

    // 7. Sync open issues
    try {
      const issues = await fetchOpenIssues(octokit, repoOwner, repoName);

      for (const issue of issues) {
        await prisma.task.upsert({
          where: {
            projectId_source_externalId: {
              projectId,
              source: "issue",
              externalId: issue.number.toString(),
            },
          },
          create: {
            projectId,
            source: "issue",
            externalId: issue.number.toString(),
            title: issue.title,
            status: "todo",
            rawMarkdown: null,
            contentHash: null,
            lineRef: null,
          },
          update: {
            title: issue.title,
          },
        });
        summary.issuesSynced++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`Issues sync: ${msg}`);
    }

    // 8. Sync open PRs
    try {
      const prs = await fetchOpenPRs(octokit, repoOwner, repoName);

      for (const pr of prs) {
        await prisma.task.upsert({
          where: {
            projectId_source_externalId: {
              projectId,
              source: "pr",
              externalId: pr.number.toString(),
            },
          },
          create: {
            projectId,
            source: "pr",
            externalId: pr.number.toString(),
            title: pr.title,
            status: "in_progress",
            rawMarkdown: null,
            contentHash: null,
            lineRef: null,
          },
          update: {
            title: pr.title,
          },
        });
        summary.prsSynced++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`PRs sync: ${msg}`);
    }

    // 9. Sync GitHub releases
    try {
      const ghReleases = await fetchReleases(octokit, repoOwner, repoName);

      for (const release of ghReleases) {
        if (release.draft) continue;

        const publishedAt = release.published_at
          ? new Date(release.published_at)
          : null;

        const existingGhRelease = await prisma.release.findFirst({
          where: {
            projectId,
            source: "github_release",
            name: release.tag_name,
          },
        });

        if (existingGhRelease) {
          await prisma.release.update({
            where: { id: existingGhRelease.id },
            data: {
              releasedAt: publishedAt,
              notes: release.body?.slice(0, 2000) ?? null,
              githubUrl: release.html_url,
              status: "released",
            },
          });
        } else {
          await prisma.release.create({
            data: {
              projectId,
              source: "github_release",
              name: release.tag_name,
              status: "released",
              releasedAt: publishedAt,
              notes: release.body?.slice(0, 2000) ?? null,
              githubUrl: release.html_url,
            },
          });
        }
        summary.githubReleasesSynced++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`GitHub releases sync: ${msg}`);
    }

    // 10. Sync commit activity (90 days)
    try {
      const commitDays = await fetchCommitActivity(octokit, repoOwner, repoName, 90);

      for (const day of commitDays) {
        if (day.count === 0) continue;

        await prisma.commitDaily.upsert({
          where: {
            projectId_day: {
              projectId,
              day: new Date(day.date + "T00:00:00.000Z"),
            },
          },
          create: {
            projectId,
            day: new Date(day.date + "T00:00:00.000Z"),
            count: day.count,
          },
          update: {
            count: day.count,
          },
        });
        summary.commitDaysSynced++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`Commit activity sync: ${msg}`);
    }

    // 11. Update project lastSyncedAt
    await prisma.project.update({
      where: { id: projectId },
      data: { lastSyncedAt: new Date() },
    });

    summary.finishedAt = new Date().toISOString();

    // 12. Update sync log with success
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        finishedAt: new Date(),
        status: summary.errors.length > 0 ? "success" : "success",
        summaryJson: JSON.stringify(summary),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    summary.errors.push(msg);
    summary.finishedAt = new Date().toISOString();

    // Update sync log with failure
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        finishedAt: new Date(),
        status: "failed",
        summaryJson: JSON.stringify(summary),
      },
    });
  }

  return summary;
}
