import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  Clock,
  Package,
  CalendarClock,
  ListTodo,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { checkStaleProjectsForUser } from "@/lib/stale";
import { OnboardingEmpty } from "@/components/onboarding";

export const metadata: Metadata = {
  title: "Dashboard — Project Tracker",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const userId = session.user.id;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true, repoOwner: true, repoName: true },
  });

  if (projects.length === 0) {
    return <OnboardingEmpty />;
  }

  const projectIds = projects.map((p) => p.id);
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  // 1. Blocked tasks everywhere
  const blockedTasks = await prisma.task.findMany({
    where: {
      projectId: { in: projectIds },
      status: "blocked",
    },
    include: { project: { select: { repoOwner: true, repoName: true, id: true } } },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  // 2. Stale projects
  const staleProjects = await checkStaleProjectsForUser(userId);

  // 3. Shipped this week (releases with releasedAt in last 7 days)
  const shippedThisWeek = await prisma.release.findMany({
    where: {
      projectId: { in: projectIds },
      releasedAt: { gte: sevenDaysAgo, lte: now },
    },
    include: { project: { select: { repoOwner: true, repoName: true, id: true } } },
    orderBy: { releasedAt: "desc" },
    take: 20,
  });

  // 4. Upcoming releases (planned, next 30 days)
  const upcomingReleases = await prisma.release.findMany({
    where: {
      projectId: { in: projectIds },
      status: "planned",
      plannedDate: { gte: now, lte: thirtyDaysFromNow },
    },
    include: { project: { select: { repoOwner: true, repoName: true, id: true } } },
    orderBy: { plannedDate: "asc" },
    take: 20,
  });

  // 5. Due this week (tasks with dueDate in next 7 days)
  const dueThisWeek = await prisma.task.findMany({
    where: {
      projectId: { in: projectIds },
      metadata: {
        dueDate: { gte: now, lte: sevenDaysFromNow },
      },
    },
    include: {
      project: { select: { repoOwner: true, repoName: true, id: true } },
      metadata: { select: { dueDate: true } },
    },
    orderBy: { metadata: { dueDate: "asc" } },
    take: 20,
  });

  // Stats
  const totalProjects = projects.length;
  const totalOpenTasks = await prisma.task.count({
    where: {
      projectId: { in: projectIds },
      status: { in: ["todo", "in_progress", "blocked"] },
    },
  });

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-zinc-100">Dashboard</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Cross-project overview of all your work
      </p>

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Projects</span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">
              {totalProjects}
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Open Tasks</span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">
              {totalOpenTasks}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main sections */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Blocked everywhere */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <CardTitle className="text-sm font-medium text-zinc-200">
              Blocked everywhere
            </CardTitle>
          </CardHeader>
          <CardContent>
            {blockedTasks.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-zinc-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Nothing blocked — nice!</span>
              </div>
            ) : (
              <ul className="space-y-2">
                {blockedTasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-2">
                    <Link
                      href={`/project/${task.project.id}`}
                      className="text-xs text-zinc-500 hover:text-zinc-300 shrink-0 mt-0.5"
                    >
                      {task.project.repoOwner}/{task.project.repoName}
                    </Link>
                    <span className="text-sm text-zinc-300">{task.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Stale projects */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Clock className="h-5 w-5 text-amber-400" />
            <CardTitle className="text-sm font-medium text-zinc-200">
              Stale projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staleProjects.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-zinc-600">
                <Clock className="h-4 w-4" />
                <span className="text-sm">All projects active</span>
              </div>
            ) : (
              <ul className="space-y-2">
                {staleProjects.map((sp) => (
                  <li key={sp.projectId} className="flex items-start gap-2">
                    <Link
                      href={`/project/${sp.projectId}`}
                      className="text-xs text-zinc-500 hover:text-zinc-300 shrink-0 mt-0.5"
                    >
                      {sp.repoOwner}/{sp.repoName}
                    </Link>
                    <span className="text-sm text-zinc-400">
                      {sp.daysSinceLastCommit !== null
                        ? `${sp.daysSinceLastCommit} days since last commit`
                        : "No commit data"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Shipped this week */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Package className="h-5 w-5 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-zinc-200">
              Shipped this week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {shippedThisWeek.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-zinc-600">
                <Package className="h-4 w-4" />
                <span className="text-sm">Nothing shipped this week</span>
              </div>
            ) : (
              <ul className="space-y-2">
                {shippedThisWeek.map((release) => (
                  <li key={release.id} className="flex items-start gap-2">
                    <Link
                      href={`/project/${release.project.id}`}
                      className="text-xs text-zinc-500 hover:text-zinc-300 shrink-0 mt-0.5"
                    >
                      {release.project.repoOwner}/{release.project.repoName}
                    </Link>
                    <span className="text-sm text-zinc-300">
                      {release.name}
                      {release.releasedAt && (
                        <span className="ml-2 text-xs text-zinc-500">
                          {new Date(release.releasedAt).toLocaleDateString()}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Due this week */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <CalendarClock className="h-5 w-5 text-orange-400" />
            <CardTitle className="text-sm font-medium text-zinc-200">
              Due this week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dueThisWeek.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-zinc-600">
                <CalendarClock className="h-4 w-4" />
                <span className="text-sm">Nothing due this week</span>
              </div>
            ) : (
              <ul className="space-y-2">
                {dueThisWeek.map((task) => (
                  <li key={task.id} className="flex items-start gap-2">
                    <Link
                      href={`/project/${task.project.id}`}
                      className="text-xs text-zinc-500 hover:text-zinc-300 shrink-0 mt-0.5"
                    >
                      {task.project.repoOwner}/{task.project.repoName}
                    </Link>
                    <span className="text-sm text-zinc-300">
                      {task.title}
                      {task.metadata?.dueDate && (
                        <span className="ml-2 text-xs text-zinc-500">
                          due {new Date(task.metadata.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming releases - full width */}
      <div className="mt-4">
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <CalendarClock className="h-5 w-5 text-blue-400" />
            <CardTitle className="text-sm font-medium text-zinc-200">
              Upcoming releases (next 30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingReleases.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-zinc-600">
                <CalendarClock className="h-4 w-4" />
                <span className="text-sm">No upcoming releases</span>
              </div>
            ) : (
              <ul className="space-y-2">
                {upcomingReleases.map((release) => (
                  <li key={release.id} className="flex items-start gap-2">
                    <Link
                      href={`/project/${release.project.id}`}
                      className="text-xs text-zinc-500 hover:text-zinc-300 shrink-0 mt-0.5"
                    >
                      {release.project.repoOwner}/{release.project.repoName}
                    </Link>
                    <span className="text-sm text-zinc-300">
                      {release.name}
                      {release.plannedDate && (
                        <span className="ml-2 text-xs text-zinc-500">
                          {new Date(release.plannedDate).toLocaleDateString()}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
