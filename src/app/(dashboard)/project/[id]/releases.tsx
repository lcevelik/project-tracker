"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, Trash2, ExternalLink, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface Release {
  id: string;
  name: string;
  status: "planned" | "in_progress" | "released";
  source: string;
  plannedDate: string | null;
  releasedAt: string | null;
  notes: string | null;
  githubUrl?: string | null;
}

interface ReleasesTabProps {
  releases: Release[];
  projectId: string;
}

const statusColumns = [
  {
    id: "planned" as const,
    label: "Planned",
    color: "border-blue-500/30 bg-blue-500/5",
  },
  {
    id: "in_progress" as const,
    label: "In Progress",
    color: "border-amber-500/30 bg-amber-500/5",
  },
  {
    id: "released" as const,
    label: "Released",
    color: "border-emerald-500/30 bg-emerald-500/5",
  },
];

const sourceBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  github_release: "default",
  md: "secondary",
  manual: "outline",
};

const sourceLabel: Record<string, string> = {
  github_release: "GitHub",
  md: "Markdown",
  manual: "Manual",
};

function ReleaseCard({
  release,
  isDragging,
  onDelete,
}: {
  release: Release;
  isDragging?: boolean;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: release.id,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border border-zinc-800 bg-zinc-900 p-3 shadow-sm transition-shadow hover:shadow-md",
        isDragging && "opacity-50 shadow-lg ring-2 ring-zinc-600"
      )}
    >
      <div className="flex items-start gap-2">
        <div
          {...listeners}
          {...attributes}
          className="cursor-grab mt-0.5 text-zinc-600 hover:text-zinc-400"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-200 truncate">
              {release.name}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <Badge
                variant={sourceBadgeVariant[release.source] ?? "secondary"}
                className="text-[10px]"
              >
                {sourceLabel[release.source] ?? release.source}
              </Badge>
              {release.source === "manual" && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-6 w-6 text-zinc-600 hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(release.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          {release.plannedDate && (
            <p className="mt-1 text-xs text-zinc-500">
              Planned: {new Date(release.plannedDate).toLocaleDateString()}
            </p>
          )}
          {release.releasedAt && (
            <p className="mt-1 text-xs text-zinc-500">
              Released: {new Date(release.releasedAt).toLocaleDateString()}
            </p>
          )}
          {release.notes && (
            <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
              {release.notes}
            </p>
          )}
          {release.githubUrl && (
            <a
              href={release.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View on GitHub
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({
  column,
  releases,
  onDelete,
}: {
  column: (typeof statusColumns)[number];
  releases: Release[];
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[200px] flex-col rounded-lg border p-3 transition-colors",
        column.color,
        isOver && "ring-2 ring-zinc-500/50"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {column.label}
        </h3>
        <span className="text-xs text-zinc-600">{releases.length}</span>
      </div>
      <div className="space-y-2">
        {releases.map((release) => (
          <ReleaseCard
            key={release.id}
            release={release}
            onDelete={onDelete}
          />
        ))}
        {releases.length === 0 && (
          <p className="py-6 text-center text-xs text-zinc-700">
            Drag releases here
          </p>
        )}
      </div>
    </div>
  );
}

function AddReleaseDialog({
  projectId,
  onReleaseAdded,
}: {
  projectId: string;
  onReleaseAdded: (release: Release) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string>("planned");
  const [plannedDate, setPlannedDate] = useState("");
  const [releasedAt, setReleasedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Release name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/releases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          status,
          plannedDate: plannedDate || null,
          releasedAt: releasedAt || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create release");
      }
      const release = await res.json();
      onReleaseAdded(release);
      toast.success("Release created");
      setOpen(false);
      setName("");
      setStatus("planned");
      setPlannedDate("");
      setReleasedAt("");
      setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create release");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Release
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Create Manual Release</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="v1.0.0"
              className="border-zinc-800 bg-zinc-900 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "planned")}>
              <SelectTrigger className="w-full border-zinc-800 bg-zinc-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="released">Released</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Planned Date</Label>
              <Input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="border-zinc-800 bg-zinc-900 text-zinc-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Released At</Label>
              <Input
                type="date"
                value={releasedAt}
                onChange={(e) => setReleasedAt(e.target.value)}
                className="border-zinc-800 bg-zinc-900 text-zinc-200"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Release notes..."
              className="min-h-[80px] resize-y border-zinc-800 bg-zinc-900 text-sm text-zinc-300 placeholder:text-zinc-600"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full gap-2"
          >
            {saving ? "Creating..." : "Create Release"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReleasesTab({ releases: initialReleases, projectId }: ReleasesTabProps) {
  const [localReleases, setLocalReleases] = useState<Release[]>(initialReleases);
  const [activeRelease, setActiveRelease] = useState<Release | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const release = localReleases.find((r) => r.id === event.active.id);
    setActiveRelease(release ?? null);
  }

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveRelease(null);
      const { active, over } = event;
      if (!over) return;

      const releaseId = active.id as string;
      const newStatus = over.id as Release["status"];

      const release = localReleases.find((r) => r.id === releaseId);
      if (!release || release.status === newStatus) return;

      // Optimistic update
      setLocalReleases((prev) =>
        prev.map((r) =>
          r.id === releaseId ? { ...r, status: newStatus } : r
        )
      );

      try {
        const res = await fetch(
          `/api/projects/${projectId}/releases/${releaseId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          }
        );
        if (!res.ok) throw new Error("Failed to update release status");
        toast.success(`Moved to ${newStatus.replace("_", " ")}`);
      } catch {
        // Revert on error
        setLocalReleases((prev) =>
          prev.map((r) =>
            r.id === releaseId ? { ...r, status: release.status } : r
          )
        );
        toast.error("Failed to update release status");
      }
    },
    [localReleases, projectId]
  );

  async function handleDelete(releaseId: string) {
    const release = localReleases.find((r) => r.id === releaseId);
    if (!release) return;

    // Optimistic remove
    setLocalReleases((prev) => prev.filter((r) => r.id !== releaseId));

    try {
      const res = await fetch(
        `/api/projects/${projectId}/releases/${releaseId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete release");
      }
      toast.success("Release deleted");
    } catch (e) {
      // Revert
      setLocalReleases((prev) => [...prev, release]);
      toast.error(e instanceof Error ? e.message : "Failed to delete release");
    }
  }

  function handleReleaseAdded(release: Release) {
    setLocalReleases((prev) => [release, ...prev]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {localReleases.length} release{localReleases.length !== 1 ? "s" : ""}
        </p>
        <AddReleaseDialog
          projectId={projectId}
          onReleaseAdded={handleReleaseAdded}
        />
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {statusColumns.map((column) => (
            <DroppableColumn
              key={column.id}
              column={column}
              releases={localReleases.filter((r) => r.status === column.id)}
              onDelete={handleDelete}
            />
          ))}
        </div>
        <DragOverlay>
          {activeRelease && (
            <ReleaseCard release={activeRelease} isDragging onDelete={() => {}} />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
