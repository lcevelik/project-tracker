import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard } from "./kanban";
import { ReleasesTab } from "./releases";
import { ActivityTab } from "./activity";
import { NotesTab } from "./notes";
import { SettingsTab } from "./settings";
import { AiExecutionsTab } from "./ai-executions";
import { SyncButton } from "./sync-button";
import { SyncLogDisplay } from "@/components/sync-log";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id },
    select: { repoOwner: true, repoName: true },
  });
  return {
    title: project
      ? `${project.repoOwner}/${project.repoName} — Project Tracker`
      : "Project — Project Tracker",
  };
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    include: {
      tasks: {
        include: { metadata: true },
        orderBy: { updatedAt: "desc" },
      },
      releases: { orderBy: { createdAt: "desc" } },
      goals: { orderBy: { createdAt: "desc" } },
      commitDailies: {
        orderBy: { day: "desc" },
        take: 90,
      },
      syncLogs: {
        orderBy: { startedAt: "desc" },
        take: 3,
      },
      privateNote: true,
    },
  });

  if (!project) notFound();

  // Fetch user's groups for autocomplete
  const groupRecords = await prisma.project.findMany({
    where: { userId: session.user.id, group: { not: null } },
    select: { group: true },
    distinct: ["group"],
    orderBy: { group: "asc" },
  });
  const groups = groupRecords
    .map((p) => p.group)
    .filter((g): g is string => g !== null);

  // Serialize tasks for client component (Date -> string)
  const serializedTasks = project.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    source: t.source,
    externalId: t.externalId,
    rawMarkdown: t.rawMarkdown ?? null,
    createdAt: t.createdAt.toISOString(),
    metadata: t.metadata
      ? {
          id: t.metadata.id,
          priority: t.metadata.priority,
          tags: t.metadata.tags,
          dueDate: t.metadata.dueDate?.toISOString() ?? null,
          notes: t.metadata.notes,
        }
      : null,
  }));

  // Serialize releases for client component
  const serializedReleases = project.releases.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    source: r.source,
    plannedDate: r.plannedDate?.toISOString() ?? null,
    releasedAt: r.releasedAt?.toISOString() ?? null,
    notes: r.notes,
    githubUrl: r.githubUrl,
  }));

  // Serialize goals for activity tab
  const serializedGoals = project.goals.map((g) => ({
    id: g.id,
    title: g.title,
    status: g.status,
    targetDate: g.targetDate?.toISOString() ?? null,
  }));

  // Serialize commit dailies
  const serializedCommitDailies = project.commitDailies.map((cd) => ({
    day: cd.day.toISOString(),
    count: cd.count,
  }));

  // Simplified tasks for activity tab
  const activityTasks = serializedTasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    source: t.source,
    externalId: t.externalId,
    createdAt: t.createdAt,
  }));

  // Serialize sync logs
  const serializedSyncLogs = project.syncLogs.map((log) => ({
    id: log.id,
    startedAt: log.startedAt.toISOString(),
    finishedAt: log.finishedAt?.toISOString() ?? null,
    status: log.status,
    summaryJson: log.summaryJson,
  }));

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">
            {project.repoOwner}/{project.repoName}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Branch: {project.defaultBranch} · Last synced:{" "}
            {project.lastSyncedAt
              ? new Date(project.lastSyncedAt).toLocaleString()
              : "Never"}
          </p>
        </div>
        <SyncButton projectId={project.id} />
      </div>

      <Tabs defaultValue="kanban" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="releases">Releases</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="new">New</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <KanbanBoard tasks={serializedTasks} />
        </TabsContent>
        <TabsContent value="releases" className="mt-4">
          <ReleasesTab
            releases={serializedReleases}
            projectId={project.id}
          />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab
            commitDailies={serializedCommitDailies}
            tasks={activityTasks}
            goals={serializedGoals}
          />
        </TabsContent>
        <TabsContent value="new" className="mt-4">
          <AiExecutionsTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <NotesTab
            projectId={project.id}
            initialContent={project.privateNote?.markdown ?? ""}
          />
        </TabsContent>
        <TabsContent value="settings" className="mt-4 space-y-6">
          <SettingsTab
            projectId={project.id}
            staleThresholdDays={project.staleThresholdDays}
            projectMdPath={project.projectMdPath}
            aiFallbackEnabled={project.aiFallbackEnabled}
            group={project.group}
            groups={groups}
          />
          <SyncLogDisplay logs={serializedSyncLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
