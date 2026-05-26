"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface SyncButtonProps {
  projectId: string;
}

export function SyncButton({ projectId }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/sync`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sync failed");
      }

      const summary = await res.json();
      const parts: string[] = [];
      if (summary.mdTasksCreated + summary.mdTasksUpdated > 0) {
        parts.push(`${summary.mdTasksCreated + summary.mdTasksUpdated} MD tasks`);
      }
      if (summary.issuesSynced > 0) parts.push(`${summary.issuesSynced} issues`);
      if (summary.prsSynced > 0) parts.push(`${summary.prsSynced} PRs`);
      if (summary.goalsCreated + summary.goalsUpdated > 0) {
        parts.push(`${summary.goalsCreated + summary.goalsUpdated} goals`);
      }
      if (summary.releasesCreated + summary.releasesUpdated + summary.githubReleasesSynced > 0) {
        parts.push(`${summary.releasesCreated + summary.releasesUpdated + summary.githubReleasesSynced} releases`);
      }
      if (summary.commitDaysSynced > 0) {
        parts.push(`${summary.commitDaysSynced} commit days`);
      }

      const detail = parts.length > 0 ? `: ${parts.join(", ")}` : "";
      toast.success(`Sync complete${detail}`);

      if (summary.errors.length > 0) {
        toast.warning(`${summary.errors.length} warning(s) during sync`);
      }

      // Refresh the page to show new data
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Button
      onClick={handleSync}
      disabled={syncing}
      variant="outline"
      size="sm"
      className="gap-2 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
    >
      <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
      {syncing ? "Syncing..." : "Sync Now"}
    </Button>
  );
}
