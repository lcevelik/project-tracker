"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Plus,
  FolderKanban,
  Inbox,
  Command,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export interface SidebarProject {
  id: string;
  repoOwner: string;
  repoName: string;
  group: string | null;
  language: string | null;
  lastSyncedAt: string | null;
  taskCount: number;
}

type SortMode = "alpha" | "synced" | "tasks";

interface SidebarProps {
  projects: SidebarProject[];
  groups: string[];
}

export function Sidebar({ projects, groups }: SidebarProps) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("alpha");
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(
    null
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

  // Filter by search
  const searched = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        `${p.repoOwner}/${p.repoName}`.toLowerCase().includes(q) ||
        p.group?.toLowerCase().includes(q) ||
        p.language?.toLowerCase().includes(q)
    );
  }, [projects, search]);

  // Filter by group
  const filtered = useMemo(() => {
    if (activeGroupFilter === null) return searched;
    if (activeGroupFilter === "__ungrouped")
      return searched.filter((p) => !p.group);
    return searched.filter((p) => p.group === activeGroupFilter);
  }, [searched, activeGroupFilter]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortMode) {
      case "alpha":
        arr.sort((a, b) =>
          `${a.repoOwner}/${a.repoName}`.localeCompare(
            `${b.repoOwner}/${b.repoName}`
          )
        );
        break;
      case "synced":
        arr.sort((a, b) => {
          const aTime = a.lastSyncedAt
            ? new Date(a.lastSyncedAt).getTime()
            : 0;
          const bTime = b.lastSyncedAt
            ? new Date(b.lastSyncedAt).getTime()
            : 0;
          return bTime - aTime;
        });
        break;
      case "tasks":
        arr.sort((a, b) => b.taskCount - a.taskCount);
        break;
    }
    return arr;
  }, [filtered, sortMode]);

  // Group projects for display (only when not filtering by a specific group)
  const groupedDisplay = useMemo(() => {
    if (activeGroupFilter !== null) {
      return [{ groupName: null as string | null, projects: sorted }];
    }

    const groupMap = new Map<string | null, SidebarProject[]>();
    for (const p of sorted) {
      const key = p.group ?? null;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(p);
    }

    // Sort groups: named groups first (alphabetically), then ungrouped
    const entries: { groupName: string | null; projects: SidebarProject[] }[] =
      [];
    const namedGroups = [...groupMap.entries()]
      .filter(([k]) => k !== null)
      .sort(([a], [b]) => a!.localeCompare(b!));
    const ungrouped = groupMap.get(null);

    for (const [name, projs] of namedGroups) {
      entries.push({ groupName: name, projects: projs });
    }
    if (ungrouped && ungrouped.length > 0) {
      entries.push({ groupName: null, projects: ungrouped });
    }

    return entries;
  }, [sorted, activeGroupFilter]);

  // Count projects per group (from full list, not filtered)
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let ungrouped = 0;
    for (const p of projects) {
      if (p.group) {
        counts.set(p.group, (counts.get(p.group) ?? 0) + 1);
      } else {
        ungrouped++;
      }
    }
    return { counts, ungrouped };
  }, [projects]);

  function toggleGroup(groupName: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }

  const sortLabels: Record<SortMode, string> = {
    alpha: "A-Z",
    synced: "Last Synced",
    tasks: "Most Tasks",
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-zinc-800 px-4">
        <FolderKanban className="h-5 w-5 text-zinc-400" />
        <span className="font-semibold text-zinc-100">Project Tracker</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Global Dashboard */}
        <nav className="space-y-1 px-3">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            Global Dashboard
          </Link>
        </nav>

        <Separator className="my-3 bg-zinc-800" />

        {/* Quick Capture Hint */}
        <div className="px-3 mb-3">
          <div className="flex items-center gap-2 rounded-md border border-dashed border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-500">
            <Inbox className="h-3.5 w-3.5" />
            <span>Quick Capture</span>
            <span className="ml-auto flex items-center gap-0.5 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              <Command className="h-2.5 w-2.5" />K
            </span>
          </div>
        </div>

        <Separator className="my-3 bg-zinc-800" />

        {/* Search */}
        <div className="px-3 mb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="h-8 pl-8 pr-8 text-xs border-zinc-800 bg-zinc-900 text-zinc-200 placeholder:text-zinc-600"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Sort & Filter Row */}
        <div className="px-3 mb-2 flex items-center gap-1.5">
          <ArrowUpDown className="h-3 w-3 text-zinc-600 shrink-0" />
          {(["alpha", "synced", "tasks"] as SortMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                sortMode === mode
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {sortLabels[mode]}
            </button>
          ))}
        </div>

        {/* Group Filter Pills */}
        <div className="px-3 mb-3">
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setActiveGroupFilter(null)}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                activeGroupFilter === null
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              )}
            >
              All
              <span className="ml-1 text-[10px] opacity-60">
                {projects.length}
              </span>
            </button>
            {groups.map((group) => (
              <button
                key={group}
                onClick={() =>
                  setActiveGroupFilter(
                    activeGroupFilter === group ? null : group
                  )
                }
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                  activeGroupFilter === group
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                )}
              >
                {group}
                <span className="ml-1 text-[10px] opacity-60">
                  {groupCounts.counts.get(group) ?? 0}
                </span>
              </button>
            ))}
            {groupCounts.ungrouped > 0 && (
              <button
                onClick={() =>
                  setActiveGroupFilter(
                    activeGroupFilter === "__ungrouped"
                      ? null
                      : "__ungrouped"
                  )
                }
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                  activeGroupFilter === "__ungrouped"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                )}
              >
                Ungrouped
                <span className="ml-1 text-[10px] opacity-60">
                  {groupCounts.ungrouped}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Project List */}
        <div className="px-3">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Projects ({filtered.length})
          </p>
          <nav className="space-y-0.5">
            {groupedDisplay.map(({ groupName, projects: groupProjects }) => {
              const isCollapsed =
                groupName !== null && collapsedGroups.has(groupName);

              return (
                <div key={groupName ?? "__ungrouped"}>
                  {/* Group header (only when showing multiple groups) */}
                  {activeGroupFilter === null && groupName !== null && (
                    <button
                      onClick={() => toggleGroup(groupName)}
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                      {groupName}
                      <span className="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {groupProjects.length}
                      </span>
                    </button>
                  )}

                  {/* "Ungrouped" header */}
                  {activeGroupFilter === null && groupName === null && (
                    <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                      <Layers className="h-3 w-3" />
                      Ungrouped
                      <span className="ml-auto rounded bg-zinc-800/50 px-1.5 py-0.5 text-[10px] text-zinc-500">
                        {groupProjects.length}
                      </span>
                    </div>
                  )}

                  {/* Projects in this group */}
                  {!isCollapsed &&
                    groupProjects.map((project) => {
                      const href = `/project/${project.id}`;
                      const isActive = pathname?.startsWith(href);
                      return (
                        <Link
                          key={project.id}
                          href={href}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-zinc-800 text-zinc-100"
                              : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                          )}
                        >
                          <span className="truncate flex-1">
                            {project.repoOwner}/{project.repoName}
                          </span>
                          {project.taskCount > 0 && (
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                isActive
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-zinc-800 text-zinc-500"
                              )}
                            >
                              {project.taskCount}
                            </span>
                          )}
                          {project.language && (
                            <span className="shrink-0 text-[10px] text-zinc-600">
                              {project.language}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-zinc-600">
                {search ? "No matching projects" : "No projects yet"}
              </p>
            )}
          </nav>
        </div>
      </div>

      {/* Add Project Button */}
      <div className="border-t border-zinc-800 p-3">
        <Link href="/add-project">
          <Button
            variant="outline"
            className="w-full gap-2 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <Plus className="h-4 w-4" />
            Add Project
          </Button>
        </Link>
      </div>
    </aside>
  );
}
