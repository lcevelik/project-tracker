import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOctokit, listUserRepos } from "@/lib/github";
import { syncProject } from "@/lib/sync";

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all users with GitHub accounts
  const accounts = await prisma.account.findMany({
    where: { provider: "github" },
    select: { userId: true, access_token: true },
  });

  const results = {
    discovered: 0,
    synced: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const account of accounts) {
    if (!account.access_token) continue;

    try {
      const octokit = getOctokit(account.access_token);

      // Get all repos from GitHub
      const allRepos = await listUserRepos(octokit);

      // Get already-tracked projects
      const existing = await prisma.project.findMany({
        where: { userId: account.userId },
        select: { repoOwner: true, repoName: true },
      });
      const tracked = new Set(
        existing.map((p) => `${p.repoOwner}/${p.repoName}`)
      );

      // Find new repos (only personal repos, not org repos)
      const { data: githubUser } =
        await octokit.rest.users.getAuthenticated();
      const userLogin = githubUser.login;

      const newRepos = allRepos.filter(
        (r) => r.owner === userLogin && !tracked.has(`${r.owner}/${r.name}`)
      );

      // Add new repos
      for (const repo of newRepos) {
        try {
          await prisma.project.create({
            data: {
              userId: account.userId,
              repoOwner: repo.owner,
              repoName: repo.name,
              defaultBranch: repo.default_branch,
            },
          });
          results.discovered++;
        } catch (err) {
          results.errors.push(
            `Failed to add ${repo.full_name}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // Now sync ALL projects for this user
      const projects = await prisma.project.findMany({
        where: { userId: account.userId },
        select: { id: true, repoOwner: true, repoName: true },
      });

      for (const project of projects) {
        try {
          await syncProject(project.id);
          results.synced++;
        } catch (err) {
          results.failed++;
          results.errors.push(
            `Sync failed ${project.repoOwner}/${project.repoName}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } catch (err) {
      results.errors.push(
        `User ${account.userId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return NextResponse.json({
    discovered: results.discovered,
    synced: results.synced,
    failed: results.failed,
    errors: results.errors,
  });
}
