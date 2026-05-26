import { prisma } from "./prisma";

export interface StaleProject {
  projectId: string;
  repoOwner: string;
  repoName: string;
  daysSinceLastCommit: number | null;
  daysSinceLastSync: number | null;
}

export async function checkStaleProjects(): Promise<StaleProject[]> {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      repoOwner: true,
      repoName: true,
      staleThresholdDays: true,
      lastSyncedAt: true,
      createdAt: true,
    },
  });

  const staleProjects: StaleProject[] = [];
  const now = new Date();

  for (const project of projects) {
    const thresholdMs = project.staleThresholdDays * 24 * 60 * 60 * 1000;

    // Check days since last sync
    const lastSyncDate = project.lastSyncedAt ?? project.createdAt;
    const daysSinceLastSync = Math.floor(
      (now.getTime() - lastSyncDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Check days since last commit
    const latestCommit = await prisma.commitDaily.findFirst({
      where: { projectId: project.id },
      orderBy: { day: "desc" },
      select: { day: true },
    });

    let daysSinceLastCommit: number | null = null;
    if (latestCommit) {
      daysSinceLastCommit = Math.floor(
        (now.getTime() - latestCommit.day.getTime()) / (24 * 60 * 60 * 1000)
      );
    }

    // A project is stale if:
    // 1. lastSyncedAt is older than threshold (or never synced and createdAt is older)
    // 2. AND no commits in the last N days (if we have commit data)
    const syncStale = daysSinceLastSync > project.staleThresholdDays;
    const commitStale =
      daysSinceLastCommit === null ||
      daysSinceLastCommit > project.staleThresholdDays;

    if (syncStale && commitStale) {
      staleProjects.push({
        projectId: project.id,
        repoOwner: project.repoOwner,
        repoName: project.repoName,
        daysSinceLastCommit,
        daysSinceLastSync,
      });
    }
  }

  return staleProjects;
}

export async function checkStaleProjectsForUser(
  userId: string
): Promise<StaleProject[]> {
  const projects = await prisma.project.findMany({
    where: { userId },
    select: {
      id: true,
      repoOwner: true,
      repoName: true,
      staleThresholdDays: true,
      lastSyncedAt: true,
      createdAt: true,
    },
  });

  const staleProjects: StaleProject[] = [];
  const now = new Date();

  for (const project of projects) {
    const thresholdMs = project.staleThresholdDays * 24 * 60 * 60 * 1000;

    const lastSyncDate = project.lastSyncedAt ?? project.createdAt;
    const daysSinceLastSync = Math.floor(
      (now.getTime() - lastSyncDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    const latestCommit = await prisma.commitDaily.findFirst({
      where: { projectId: project.id },
      orderBy: { day: "desc" },
      select: { day: true },
    });

    let daysSinceLastCommit: number | null = null;
    if (latestCommit) {
      daysSinceLastCommit = Math.floor(
        (now.getTime() - latestCommit.day.getTime()) / (24 * 60 * 60 * 1000)
      );
    }

    const syncStale = daysSinceLastSync > project.staleThresholdDays;
    const commitStale =
      daysSinceLastCommit === null ||
      daysSinceLastCommit > project.staleThresholdDays;

    if (syncStale && commitStale) {
      staleProjects.push({
        projectId: project.id,
        repoOwner: project.repoOwner,
        repoName: project.repoName,
        daysSinceLastCommit,
        daysSinceLastSync,
      });
    }
  }

  return staleProjects;
}
