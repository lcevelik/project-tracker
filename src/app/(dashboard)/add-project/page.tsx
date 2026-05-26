"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FolderPlus,
  ArrowLeft,
  RefreshCw,
  GitBranch,
  Lock,
  Globe,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface RepoInfo {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
  alreadyTracked: boolean;
}

export default function AddProjectPage() {
  const router = useRouter();

  // Manual add state
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  // Bulk add state
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetchingRepos, setFetchingRepos] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    added: number;
    skipped: number;
  } | null>(null);

  const fetchRepos = useCallback(async () => {
    setFetchingRepos(true);
    try {
      const res = await fetch("/api/repos");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch repos");
      }
      const data = await res.json();
      setRepos(data.repos);

      // Pre-select repos not already tracked
      const initial = new Set<string>();
      for (const r of data.repos) {
        if (!r.alreadyTracked) {
          initial.add(`${r.owner}/${r.name}`);
        }
      }
      setSelected(initial);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to fetch repositories"
      );
    } finally {
      setFetchingRepos(false);
    }
  }, []);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  const selectableRepos = repos.filter((r) => !r.alreadyTracked);
  const allSelected =
    selectableRepos.length > 0 &&
    selectableRepos.every((r) => selected.has(`${r.owner}/${r.name}`));

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableRepos.map((r) => `${r.owner}/${r.name}`)));
    }
  }

  function toggleRepo(fullName: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) {
        next.delete(fullName);
      } else {
        next.add(fullName);
      }
      return next;
    });
  }

  async function handleBulkAdd() {
    if (selected.size === 0) {
      toast.error("Select at least one repository");
      return;
    }

    setBulkLoading(true);
    setBulkResult(null);

    try {
      const reposToAdd = repos
        .filter((r) => selected.has(`${r.owner}/${r.name}`))
        .map((r) => ({
          owner: r.owner,
          name: r.name,
          defaultBranch: r.defaultBranch,
        }));

      const res = await fetch("/api/projects/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repos: reposToAdd }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add projects");
      }

      const data = await res.json();
      setBulkResult({ added: data.added, skipped: data.skipped });

      // Trigger sync for each newly added project in the background
      for (const project of data.projects) {
        fetch(`/api/projects/${project.id}/sync`, { method: "POST" }).catch(
          () => {}
        );
      }

      toast.success(
        `Added ${data.added} project${data.added !== 1 ? "s" : ""}${
          data.skipped > 0
            ? ` (${data.skipped} skipped)`
            : ""
        }`
      );

      // Refresh the sidebar to show new projects
      router.refresh();

      // Mark added repos as tracked
      setRepos((prev) =>
        prev.map((r) =>
          selected.has(`${r.owner}/${r.name}`)
            ? { ...r, alreadyTracked: true }
            : r
        )
      );
      setSelected(new Set());
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add projects"
      );
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repoOwner.trim() || !repoName.trim()) {
      toast.error("Please fill in both fields");
      return;
    }

    setManualLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoOwner: repoOwner.trim(),
          repoName: repoName.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add project");
      }

      const project = await res.json();
      toast.success("Project added — starting initial sync...");

      fetch(`/api/projects/${project.id}/sync`, { method: "POST" })
        .then(async (syncRes) => {
          if (syncRes.ok) {
            const summary = await syncRes.json();
            const parts: string[] = [];
            if (summary.mdTasksCreated > 0)
              parts.push(`${summary.mdTasksCreated} tasks`);
            if (summary.issuesSynced > 0)
              parts.push(`${summary.issuesSynced} issues`);
            if (summary.prsSynced > 0)
              parts.push(`${summary.prsSynced} PRs`);
            if (summary.goalsCreated > 0)
              parts.push(`${summary.goalsCreated} goals`);
            if (summary.githubReleasesSynced > 0)
              parts.push(`${summary.githubReleasesSynced} releases`);
            if (parts.length > 0) {
              toast.success(`Initial sync: ${parts.join(", ")}`);
            }
          }
        })
        .catch(() => {});

      router.push(`/project/${project.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add project"
      );
    } finally {
      setManualLoading(false);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Dashboard
      </Link>

      {/* Bulk Add Section */}
      <Card className="mx-auto max-w-2xl border-zinc-800 bg-zinc-900/50 mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-zinc-400" />
            <CardTitle className="text-zinc-100">
              Add Projects from Your Repos
            </CardTitle>
          </div>
          <CardDescription className="text-zinc-500">
            Select your personal GitHub repositories to start tracking. Org
            repos are excluded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetchingRepos ? (
            <div className="flex items-center justify-center py-12 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading your repositories...
            </div>
          ) : repos.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <p>No personal repositories found.</p>
              <p className="text-sm mt-1">
                Use the manual form below to add a repo by owner/name.
              </p>
            </div>
          ) : (
            <>
              {/* Controls */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    disabled={selectableRepos.length === 0}
                  />
                  <Label className="text-zinc-400 text-sm cursor-pointer">
                    Select All ({selectableRepos.length} available)
                  </Label>
                </div>
                <span className="text-xs text-zinc-600">
                  {selected.size} selected
                </span>
              </div>

              {/* Repo List */}
              <div className="max-h-96 overflow-y-auto rounded-lg border border-zinc-800 divide-y divide-zinc-800/50">
                {repos.map((repo) => {
                  const fullName = `${repo.owner}/${repo.name}`;
                  const isChecked = selected.has(fullName);
                  return (
                    <label
                      key={fullName}
                      className={`flex items-start gap-3 px-3 py-2.5 hover:bg-zinc-800/30 transition-colors ${
                        repo.alreadyTracked ? "opacity-50" : "cursor-pointer"
                      }`}
                    >
                      <div className="pt-0.5">
                        <Checkbox
                          checked={isChecked}
                          disabled={repo.alreadyTracked}
                          onCheckedChange={() => toggleRepo(fullName)}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-zinc-200">
                            {repo.name}
                          </span>
                          {repo.private ? (
                            <Badge
                              variant="secondary"
                              className="h-4 text-[10px] px-1.5 gap-0.5 bg-zinc-800 text-zinc-400"
                            >
                              <Lock className="h-2.5 w-2.5" />
                              Private
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="h-4 text-[10px] px-1.5 gap-0.5 bg-zinc-800 text-zinc-500"
                            >
                              <Globe className="h-2.5 w-2.5" />
                              Public
                            </Badge>
                          )}
                          {repo.alreadyTracked && (
                            <Badge
                              variant="secondary"
                              className="h-4 text-[10px] px-1.5 gap-0.5 bg-emerald-950 text-emerald-400 border-emerald-800"
                            >
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Already tracked
                            </Badge>
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-xs text-zinc-500 mt-0.5 truncate">
                            {repo.description}
                          </p>
                        )}
                        <p className="text-[10px] text-zinc-600 mt-0.5 flex items-center gap-1">
                          <GitBranch className="h-2.5 w-2.5" />
                          {repo.defaultBranch}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Bulk Add Button */}
              <Button
                className="w-full mt-4"
                onClick={handleBulkAdd}
                disabled={bulkLoading || selected.size === 0}
              >
                {bulkLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Adding {selected.size} project
                    {selected.size !== 1 ? "s" : ""}...
                  </>
                ) : (
                  <>
                    Add {selected.size} Selected Project
                    {selected.size !== 1 ? "s" : ""}
                  </>
                )}
              </Button>

              {/* Bulk Result */}
              {bulkResult && (
                <div className="mt-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-sm text-zinc-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>
                      Added {bulkResult.added} project
                      {bulkResult.added !== 1 ? "s" : ""}
                      {bulkResult.skipped > 0
                        ? `, ${bulkResult.skipped} skipped`
                        : ""}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-zinc-400 hover:text-zinc-200"
                    onClick={() => router.push("/")}
                  >
                    Go to Dashboard
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Manual Add Section */}
      <Card className="mx-auto max-w-2xl border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-100 text-base">
            Add by Repository URL
          </CardTitle>
          <CardDescription className="text-zinc-500">
            Manually enter the owner and name of any accessible GitHub
            repository.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="owner" className="text-zinc-300">
                  Owner
                </Label>
                <Input
                  id="owner"
                  value={repoOwner}
                  onChange={(e) => setRepoOwner(e.target.value)}
                  placeholder="e.g. facebook"
                  className="border-zinc-800 bg-zinc-950 text-zinc-200 placeholder:text-zinc-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-zinc-300">
                  Repository
                </Label>
                <Input
                  id="name"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="e.g. react"
                  className="border-zinc-800 bg-zinc-950 text-zinc-200 placeholder:text-zinc-600"
                />
              </div>
            </div>
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={manualLoading}
            >
              {manualLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Project"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
