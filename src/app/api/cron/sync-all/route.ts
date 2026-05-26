import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

  // Fetch all projects
  const projects = await prisma.project.findMany({
    select: { id: true, repoOwner: true, repoName: true },
  });

  const results: Array<{
    projectId: string;
    repo: string;
    status: "success" | "failed";
    error?: string;
  }> = [];

  for (const project of projects) {
    try {
      const summary = await syncProject(project.id);
      results.push({
        projectId: project.id,
        repo: `${project.repoOwner}/${project.repoName}`,
        status: summary.errors.length > 0 ? "success" : "success",
      });
    } catch (err) {
      results.push({
        projectId: project.id,
        repo: `${project.repoOwner}/${project.repoName}`,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const synced = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    synced,
    failed,
    total: projects.length,
    results,
  });
}
