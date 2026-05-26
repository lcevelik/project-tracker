import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOctokit } from "@/lib/github";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { repoOwner, repoName } = body;

  if (!repoOwner || !repoName) {
    return NextResponse.json(
      { error: "repoOwner and repoName are required" },
      { status: 400 }
    );
  }

  // Get the user's GitHub access token from Account table
  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "github",
    },
  });

  if (!account?.access_token) {
    return NextResponse.json(
      { error: "No GitHub account connected. Please sign in with GitHub." },
      { status: 400 }
    );
  }

  // Validate that the repo exists and is accessible
  try {
    const octokit = getOctokit(account.access_token);
    const { data: repo } = await octokit.rest.repos.get({
      owner: repoOwner,
      repo: repoName,
    });

    // Use the repo's actual default branch
    const defaultBranch = repo.default_branch;

    try {
      const project = await prisma.project.create({
        data: {
          userId: session.user.id,
          repoOwner,
          repoName,
          defaultBranch,
        },
      });

      return NextResponse.json(project, { status: 201 });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Project already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create project" },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      (err as { status: number }).status === 404
    ) {
      return NextResponse.json(
        {
          error: `Repository ${repoOwner}/${repoName} not found or not accessible`,
        },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : "Failed to validate repository";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
