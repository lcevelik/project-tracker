import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOctokit, listUserRepos } from "@/lib/github";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  try {
    const octokit = getOctokit(account.access_token);

    // Get the authenticated user's login to filter out org repos
    const { data: githubUser } = await octokit.rest.users.getAuthenticated();
    const userLogin = githubUser.login;

    // Fetch all repos
    const allRepos = await listUserRepos(octokit);

    // Filter: only repos where owner matches the user's login (exclude org repos)
    const personalRepos = allRepos.filter((r) => r.owner === userLogin);

    // Get already-tracked projects for this user
    const existingProjects = await prisma.project.findMany({
      where: { userId: session.user.id },
      select: { repoOwner: true, repoName: true },
    });

    const trackedSet = new Set(
      existingProjects.map((p) => `${p.repoOwner}/${p.repoName}`)
    );

    const repos = personalRepos.map((r) => ({
      owner: r.owner,
      name: r.name,
      fullName: r.full_name,
      private: r.private,
      defaultBranch: r.default_branch,
      description: r.description,
      alreadyTracked: trackedSet.has(`${r.owner}/${r.name}`),
    }));

    return NextResponse.json({ repos });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch repositories";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
