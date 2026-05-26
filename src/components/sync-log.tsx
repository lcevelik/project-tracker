"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Sync Log Display Component
// ---------------------------------------------------------------------------

interface SyncLogEntry {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "failed";
  summaryJson: string | null;
}

interface SyncLogProps {
  logs: SyncLogEntry[];
}

function StatusIcon({ status }: { status: string }) {
  if (status === "running") {
    return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
  }
  if (status === "success") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  }
  return <XCircle className="h-4 w-4 text-red-400" />;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    running: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    success: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    failed: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium",
        variants[status] ?? variants.running
      )}
    >
      <StatusIcon status={status} />
      {status}
    </span>
  );
}

function SyncLogEntry({ log }: { log: SyncLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (log.summaryJson) {
      try {
        setSummary(JSON.parse(log.summaryJson));
      } catch {
        setSummary(null);
      }
    }
  }, [log.summaryJson]);

  const duration =
    log.finishedAt && log.startedAt
      ? Math.round(
          (new Date(log.finishedAt).getTime() -
            new Date(log.startedAt).getTime()) /
            1000
        )
      : null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge status={log.status} />
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(log.startedAt).toLocaleString()}
          </span>
          {duration !== null && (
            <span className="text-xs text-zinc-600">{duration}s</span>
          )}
        </div>
        {summary && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Details
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {expanded && summary && (
        <div className="mt-3 space-y-1 border-t border-zinc-800 pt-3">
          {typeof summary.projectMdFound === "boolean" && (
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">PROJECT.md found</span>
              <span className={summary.projectMdFound ? "text-emerald-400" : "text-zinc-500"}>
                {summary.projectMdFound ? "Yes" : "No"}
              </span>
            </div>
          )}
          {typeof summary.mdTasksCreated === "number" &&
            (summary.mdTasksCreated as number) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">MD tasks created</span>
                <span className="text-zinc-300">{String(summary.mdTasksCreated)}</span>
              </div>
            )}
          {typeof summary.mdTasksUpdated === "number" &&
            (summary.mdTasksUpdated as number) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">MD tasks updated</span>
                <span className="text-zinc-300">{String(summary.mdTasksUpdated)}</span>
              </div>
            )}
          {typeof summary.issuesSynced === "number" &&
            (summary.issuesSynced as number) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Issues synced</span>
                <span className="text-zinc-300">{String(summary.issuesSynced)}</span>
              </div>
            )}
          {typeof summary.prsSynced === "number" &&
            (summary.prsSynced as number) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">PRs synced</span>
                <span className="text-zinc-300">{String(summary.prsSynced)}</span>
              </div>
            )}
          {typeof summary.githubReleasesSynced === "number" &&
            (summary.githubReleasesSynced as number) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">GitHub releases synced</span>
                <span className="text-zinc-300">{String(summary.githubReleasesSynced)}</span>
              </div>
            )}
          {typeof summary.commitDaysSynced === "number" &&
            (summary.commitDaysSynced as number) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Commit days synced</span>
                <span className="text-zinc-300">{String(summary.commitDaysSynced)}</span>
              </div>
            )}
          {Array.isArray(summary.errors) &&
            (summary.errors as string[]).length > 0 && (
              <div className="mt-2 rounded border border-red-500/20 bg-red-500/5 p-2">
                <p className="text-[11px] font-medium text-red-400 mb-1">Errors:</p>
                {(summary.errors as string[]).map((err, i) => (
                  <p key={i} className="text-[11px] text-red-300/80">
                    {err}
                  </p>
                ))}
              </div>
            )}
          {typeof summary.aiFallbackUsed === "boolean" &&
            summary.aiFallbackUsed && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">AI fallback used</span>
                <Badge variant="secondary" className="text-[10px] bg-violet-500/20 text-violet-400 border-violet-500/30">
                  AI
                </Badge>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

export function SyncLogDisplay({ logs }: SyncLogProps) {
  if (logs.length === 0) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardContent className="py-6">
          <p className="text-center text-sm text-zinc-600">
            No sync history yet. Click "Sync Now" to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Recent Syncs
        </span>
      </div>
      {logs.map((log) => (
        <SyncLogEntry key={log.id} log={log} />
      ))}
    </div>
  );
}
