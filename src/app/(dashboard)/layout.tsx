import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar, type SidebarProject } from "@/components/sidebar";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { QuickCaptureDialog } from "@/components/quick-capture-dialog";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/signin");
  }

  // Fetch projects with additional fields
  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      repoOwner: true,
      repoName: true,
      group: true,
      language: true,
      lastSyncedAt: true,
      _count: {
        select: { tasks: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Fetch unique groups
  const groupRecords = await prisma.project.findMany({
    where: { userId: session.user.id, group: { not: null } },
    select: { group: true },
    distinct: ["group"],
    orderBy: { group: "asc" },
  });
  const groups = groupRecords
    .map((p) => p.group)
    .filter((g): g is string => g !== null);

  // Map to SidebarProject shape
  const sidebarProjects: SidebarProject[] = projects.map((p) => ({
    id: p.id,
    repoOwner: p.repoOwner,
    repoName: p.repoName,
    group: p.group,
    language: p.language,
    lastSyncedAt: p.lastSyncedAt?.toISOString() ?? null,
    taskCount: p._count.tasks,
  }));

  // Also provide plain projects for QuickCaptureDialog and MobileSidebar
  const plainProjects = projects.map((p) => ({
    id: p.id,
    repoOwner: p.repoOwner,
    repoName: p.repoName,
  }));

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar projects={sidebarProjects} groups={groups} />
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebar projects={sidebarProjects} groups={groups} />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">{children}</main>

      {/* Global Quick Capture Dialog */}
      <QuickCaptureDialog projects={plainProjects} />
    </div>
  );
}
