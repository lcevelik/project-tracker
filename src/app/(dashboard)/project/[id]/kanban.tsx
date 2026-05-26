"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Save, Calendar, Tag } from "lucide-react";
import { toast } from "sonner";

interface TaskMetadata {
  id: string;
  priority: "P0" | "P1" | "P2" | "P3";
  tags: string[];
  dueDate: string | null;
  notes: string | null;
}

interface Task {
  id: string;
  title: string;
  status: "goal" | "todo" | "in_progress" | "blocked" | "done";
  source: "md" | "issue" | "pr";
  externalId: string | null;
  rawMarkdown?: string | null;
  metadata: TaskMetadata | null;
}

interface KanbanBoardProps {
  tasks: Task[];
}

const columns: { id: Task["status"]; label: string; color: string }[] = [
  { id: "goal", label: "Goals", color: "border-violet-500/30 bg-violet-500/5" },
  { id: "todo", label: "To Do", color: "border-zinc-500/30 bg-zinc-500/5" },
  { id: "in_progress", label: "In Progress", color: "border-blue-500/30 bg-blue-500/5" },
  { id: "blocked", label: "Blocked", color: "border-red-500/30 bg-red-500/5" },
  { id: "done", label: "Done", color: "border-emerald-500/30 bg-emerald-500/5" },
];

const sourceBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  md: "secondary",
  issue: "default",
  pr: "outline",
};

const priorityColors: Record<string, string> = {
  P0: "bg-red-500/20 text-red-400 border-red-500/30",
  P1: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  P2: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  P3: "bg-zinc-600/20 text-zinc-500 border-zinc-600/30",
};

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `Overdue ${Math.abs(diffDays)}d`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `${diffDays}d left`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TaskCard({
  task,
  onOpenDetail,
}: {
  task: Task;
  onOpenDetail: (task: Task) => void;
}) {
  const dueDate = task.metadata?.dueDate;
  const isOverdue = dueDate ? new Date(dueDate) < new Date() : false;

  return (
    <div
      className={cn(
        "rounded-md border border-zinc-800 bg-zinc-900 p-3 shadow-sm transition-shadow hover:shadow-md"
      )}
    >
      <div onClick={() => onOpenDetail(task)} className="cursor-pointer">
        <p className="text-sm font-medium text-zinc-200">{task.title}</p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Badge variant={sourceBadgeVariant[task.source] ?? "secondary"} className="text-[10px]">
            {task.source}
            {task.externalId && task.source !== "md" && ` #${task.externalId}`}
          </Badge>
          {task.metadata?.priority && task.metadata.priority !== "P2" && (
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 text-[10px] font-medium",
                priorityColors[task.metadata.priority]
              )}
            >
              {task.metadata.priority}
            </span>
          )}
          {dueDate && (
            <span
              className={cn(
                "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
                isOverdue
                  ? "border-red-500/30 bg-red-500/20 text-red-400"
                  : "border-zinc-600/30 bg-zinc-600/20 text-zinc-400"
              )}
            >
              <Calendar className="h-3 w-3" />
              {formatDueDate(dueDate)}
            </span>
          )}
          {task.metadata?.tags && task.metadata.tags.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Tag className="h-3 w-3" />
              {task.metadata.tags.length}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onOpenDetail(task);
        }}
        className="mt-2 w-full text-right text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
      >
        Expand details →
      </button>
    </div>
  );
}

function KanbanColumn({
  column,
  tasks,
  onOpenDetail,
}: {
  column: (typeof columns)[number];
  tasks: Task[];
  onOpenDetail: (task: Task) => void;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[300px] flex-col rounded-lg border p-3 transition-colors",
        column.color
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {column.label}
        </h3>
        <span className="text-xs text-zinc-600">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onOpenDetail={onOpenDetail} />
        ))}
        {tasks.length === 0 && (
          <div className="py-8 text-center">
            <div className="rounded-lg border border-dashed border-zinc-700/50 bg-zinc-900/20 py-6 px-4">
              <p className="text-xs text-zinc-600">No tasks</p>
              <p className="mt-1 text-[10px] text-zinc-700">
                Add tasks in PROJECT.md and sync
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  onMetadataSaved,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMetadataSaved: (taskId: string, metadata: TaskMetadata) => void;
}) {
  const [priority, setPriority] = useState<string>("P2");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setPriority(task.metadata?.priority ?? "P2");
      setDueDate(
        task.metadata?.dueDate
          ? new Date(task.metadata.dueDate).toISOString().split("T")[0]
          : ""
      );
      setTags(task.metadata?.tags?.join(", ") ?? "");
      setNotes(task.metadata?.notes ?? "");
    }
  }, [task]);

  async function handleSave() {
    if (!task) return;
    setSaving(true);
    try {
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const res = await fetch(`/api/tasks/${task.id}/metadata`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priority,
          dueDate: dueDate || null,
          tags: parsedTags,
          notes: notes || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to save metadata");

      const saved = await res.json();
      onMetadataSaved(task.id, saved);
      toast.success("Metadata saved");
    } catch {
      toast.error("Failed to save metadata");
    } finally {
      setSaving(false);
    }
  }

  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-zinc-100">{task.title}</SheetTitle>
          <SheetDescription>
            <span className="flex items-center gap-2">
              <Badge variant={sourceBadgeVariant[task.source] ?? "secondary"} className="text-[10px]">
                {task.source}
                {task.externalId && task.source !== "md" && ` #${task.externalId}`}
              </Badge>
              <span className="text-xs text-zinc-500 capitalize">
                {task.status.replace("_", " ")}
              </span>
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-4">
          {/* Raw Markdown Content */}
          {task.rawMarkdown && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Content
              </p>
              <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-300">
                {task.rawMarkdown}
              </pre>
            </div>
          )}

          {/* Metadata Editor */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Metadata
            </p>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v ?? "P2")}>
                <SelectTrigger className="w-full border-zinc-800 bg-zinc-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="P0">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      P0 — Critical
                    </span>
                  </SelectItem>
                  <SelectItem value="P1">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      P1 — High
                    </span>
                  </SelectItem>
                  <SelectItem value="P2">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-zinc-400" />
                      P2 — Normal
                    </span>
                  </SelectItem>
                  <SelectItem value="P3">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-zinc-600" />
                      P3 — Low
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border-zinc-800 bg-zinc-900 text-zinc-200"
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">
                Tags <span className="text-zinc-600">(comma-separated)</span>
              </Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="bug, frontend, urgent"
                className="border-zinc-800 bg-zinc-900 text-zinc-200 placeholder:text-zinc-600"
              />
              {tags.split(",").filter((t) => t.trim()).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags
                    .split(",")
                    .filter((t) => t.trim())
                    .map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {tag.trim()}
                      </Badge>
                    ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Private notes about this task..."
                className="min-h-[100px] resize-y border-zinc-800 bg-zinc-900 text-sm text-zinc-300 placeholder:text-zinc-600"
              />
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full gap-2"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save Metadata"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function KanbanBoard({ tasks }: KanbanBoardProps) {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function handleOpenDetail(task: Task) {
    setSelectedTask(task);
    setSheetOpen(true);
  }

  function handleMetadataSaved(taskId: string, metadata: TaskMetadata) {
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, metadata } : t))
    );
    setSelectedTask((prev) =>
      prev && prev.id === taskId ? { ...prev, metadata } : prev
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={localTasks.filter((t) => t.status === column.id)}
            onOpenDetail={handleOpenDetail}
          />
        ))}
      </div>

      <TaskDetailSheet
        task={selectedTask}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onMetadataSaved={handleMetadataSaved}
      />
    </>
  );
}
