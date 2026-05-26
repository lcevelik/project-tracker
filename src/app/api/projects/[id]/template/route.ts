import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOctokit, fetchFileContent } from "@/lib/github";

// ---------------------------------------------------------------------------
// POST /api/projects/[id]/template — Drop a PROJECT.md template into the repo
// ---------------------------------------------------------------------------

const PROJECT_MD_TEMPLATE = `# Project Roadmap

## Goals

- Define project scope and milestones (target: 2025-01-01)
- Ship MVP release (target: 2025-03-01)

## In Progress

- [ ] Set up CI/CD pipeline
- [ ] Implement authentication

## To Do

- [ ] Write API documentation
- [ ] Add integration tests
- [ ] Set up monitoring and alerting

## Done

- [x] Initial project setup
- [x] Database schema design

## Blocked

- [ ] Dependency upgrade waiting on upstream fix

## Releases

- v0.1.0 — released 2025-01-15 — Initial setup and scaffolding
- v0.2.0 — planned 2025-03-01 — MVP with core features
- v1.0.0 — planned 2025-06-01 — Production-ready release
`;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Get GitHub token from Account table
  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "github" },
  });

  if (!account?.access_token) {
    return NextResponse.json(
      { error: "No GitHub access token found" },
      { status: 400 }
    );
  }

  const octokit = getOctokit(account.access_token);
  const { repoOwner, repoName, defaultBranch, projectMdPath } = project;

  try {
    // Check if file already exists
    const existing = await fetchFileContent(
      octokit,
      repoOwner,
      repoName,
      projectMdPath,
      defaultBranch
    );

    if (existing) {
      return NextResponse.json(
        { error: `${projectMdPath} already exists in the repository` },
        { status: 409 }
      );
    }

    // Create the file
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: repoOwner,
      repo: repoName,
      path: projectMdPath,
      message: `Add ${projectMdPath} via Project Tracker`,
      content: Buffer.from(PROJECT_MD_TEMPLATE).toString("base64"),
      branch: defaultBranch,
    });

    return NextResponse.json({
      success: true,
      message: `${projectMdPath} created in ${repoOwner}/${repoName}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
