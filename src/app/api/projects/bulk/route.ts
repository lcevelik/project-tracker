import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface BulkRepo {
  owner: string;
  name: string;
  defaultBranch: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { repos } = body as { repos: BulkRepo[] };

  if (!repos || !Array.isArray(repos) || repos.length === 0) {
    return NextResponse.json(
      { error: "repos array is required and must not be empty" },
      { status: 400 }
    );
  }

  const added: string[] = [];
  const skipped: string[] = [];

  for (const repo of repos) {
    if (!repo.owner || !repo.name || !repo.defaultBranch) {
      skipped.push(`${repo.owner}/${repo.name} (missing fields)`);
      continue;
    }

    try {
      await prisma.project.create({
        data: {
          userId: session.user.id,
          repoOwner: repo.owner,
          repoName: repo.name,
          defaultBranch: repo.defaultBranch,
        },
      });
      added.push(`${repo.owner}/${repo.name}`);
    } catch (error: unknown) {
      // P2002 = unique constraint violation = already exists
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        skipped.push(`${repo.owner}/${repo.name} (already exists)`);
      } else {
        skipped.push(`${repo.owner}/${repo.name} (error)`);
      }
    }
  }

  // Fetch the created projects to return
  const projects = await prisma.project.findMany({
    where: {
      userId: session.user.id,
      repoOwner: { in: added.map((r) => r.split("/")[0]) },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    added: added.length,
    skipped: skipped.length,
    projects,
  });
}
