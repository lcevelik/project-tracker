import { Octokit } from "octokit";

/**
 * Create an authenticated Octokit instance from a GitHub access token.
 */
export function getOctokit(accessToken: string): Octokit {
  return new Octokit({ auth: accessToken });
}

/**
 * Fetch the content of a file (e.g. PROJECT.md) from a repository.
 * Returns the decoded text content, or null if the file is not found.
 */
export async function fetchFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<string | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      return null;
    }

    // content is base64-encoded
    return Buffer.from(data.content, "base64").toString("utf-8");
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && err.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Fetch open issues for a repository (excludes pull requests).
 */
export async function fetchOpenIssues(
  octokit: Octokit,
  owner: string,
  repo: string
) {
  const issues: Array<{
    number: number;
    title: string;
    labels: string[];
    state: string;
    html_url: string;
    created_at: string;
    updated_at: string;
  }> = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.issues.listForRepo,
    {
      owner,
      repo,
      state: "open",
      per_page: 100,
    }
  )) {
    for (const issue of response.data) {
      // GitHub issues API includes PRs; filter them out
      if ("pull_request" in issue) continue;
      issues.push({
        number: issue.number,
        title: issue.title,
        labels: (issue.labels as Array<{ name?: string }>).map(
          (l) => l.name ?? ""
        ),
        state: issue.state,
        html_url: issue.html_url,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
      });
    }
  }

  return issues;
}

/**
 * Fetch open pull requests for a repository.
 */
export async function fetchOpenPRs(
  octokit: Octokit,
  owner: string,
  repo: string
) {
  const prs: Array<{
    number: number;
    title: string;
    labels: string[];
    state: string;
    html_url: string;
    created_at: string;
    updated_at: string;
  }> = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.pulls.list,
    {
      owner,
      repo,
      state: "open",
      per_page: 100,
    }
  )) {
    for (const pr of response.data) {
      prs.push({
        number: pr.number,
        title: pr.title,
        labels: (pr.labels as Array<{ name?: string }>).map(
          (l) => l.name ?? ""
        ),
        state: pr.state,
        html_url: pr.html_url,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
      });
    }
  }

  return prs;
}

/**
 * Fetch releases for a repository.
 */
export async function fetchReleases(
  octokit: Octokit,
  owner: string,
  repo: string
) {
  const releases: Array<{
    tag_name: string;
    name: string | null;
    body: string | null;
    published_at: string | null;
    html_url: string;
    draft: boolean;
    prerelease: boolean;
  }> = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.repos.listReleases,
    {
      owner,
      repo,
      per_page: 100,
    }
  )) {
    for (const release of response.data) {
      releases.push({
        tag_name: release.tag_name,
        name: release.name ?? null,
        body: release.body ?? null,
        published_at: release.published_at ?? null,
        html_url: release.html_url,
        draft: release.draft,
        prerelease: release.prerelease,
      });
    }
  }

  return releases;
}

/**
 * Fetch commit activity for the last N days.
 * Uses the commit list API for reliable results.
 * Returns an array of { date: string (YYYY-MM-DD), count: number }.
 */
export async function fetchCommitActivity(
  octokit: Octokit,
  owner: string,
  repo: string,
  sinceDays: number = 90
): Promise<Array<{ date: string; count: number }>> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);
  const sinceISO = since.toISOString();

  // Collect all commits since the date
  const commitDates: string[] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.repos.listCommits,
    {
      owner,
      repo,
      since: sinceISO,
      per_page: 100,
    }
  )) {
    for (const commit of response.data) {
      const dateStr = commit.commit.author?.date;
      if (dateStr) {
        // Extract YYYY-MM-DD
        commitDates.push(dateStr.slice(0, 10));
      }
    }
  }

  // Aggregate by day
  const dayCounts = new Map<string, number>();
  for (const d of commitDates) {
    dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
  }

  // Fill in missing days with 0
  const result: Array<{ date: string; count: number }> = [];
  const cursor = new Date(since);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  while (cursor <= today) {
    const key = cursor.toISOString().slice(0, 10);
    result.push({ date: key, count: dayCounts.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

/**
 * List the authenticated user's repositories.
 * Used in the "Add Project" flow.
 */
export async function listUserRepos(octokit: Octokit) {
  const repos: Array<{
    owner: string;
    name: string;
    full_name: string;
    private: boolean;
    default_branch: string;
    description: string | null;
  }> = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.repos.listForAuthenticatedUser,
    {
      per_page: 100,
      sort: "updated",
      direction: "desc",
    }
  )) {
    for (const repo of response.data) {
      repos.push({
        owner: repo.owner.login,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        default_branch: repo.default_branch,
        description: repo.description,
      });
    }
  }

  return repos;
}
