"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Inbox, Plus, Trash2, Link, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface QuickCaptureItem {
  id: string;
  text: string;
  capturedAt: string;
  assignedToProjectId: string | null;
}

interface Project {
  id: string;
  repoOwner: string;
  repoName: string;
}

interface QuickCaptureDialogProps {
  projects: Project[];
}

export function QuickCaptureDialog({ projects }: QuickCaptureDialogProps) {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [items, setItems] = useState<QuickCaptureItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Global keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        // Don't trigger if user is typing in an input/textarea
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/quick-capture");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Load items when dialog opens
  useEffect(() => {
    if (open) {
      loadItems();
    }
  }, [open, loadItems]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/quick-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText.trim() }),
      });

      if (!res.ok) throw new Error("Failed to capture");

      const newItem = await res.json();
      setItems((prev) => [newItem, ...prev]);
      setInputText("");
      toast.success("Captured!");
    } catch {
      toast.error("Failed to capture item");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign(itemId: string, projectId: string) {
    try {
      const res = await fetch("/api/quick-capture", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId, assignedToProjectId: projectId }),
      });

      if (!res.ok) throw new Error("Failed to assign");

      // Remove from inbox list (it's now assigned)
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      toast.success("Assigned to project");
    } catch {
      toast.error("Failed to assign item");
    }
  }

  async function handleDelete(itemId: string) {
    try {
      const res = await fetch(`/api/quick-capture?id=${itemId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      setItems((prev) => prev.filter((item) => item.id !== itemId));
      toast.success("Item deleted");
    } catch {
      toast.error("Failed to delete item");
    }
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Inbox className="h-4 w-4 text-zinc-400" />
            Quick Capture
          </DialogTitle>
          <DialogDescription>
            Quickly capture thoughts and assign them to projects later.
          </DialogDescription>
        </DialogHeader>

        {/* Capture Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="What's on your mind?"
            className="flex-1 border-zinc-800 bg-zinc-900 text-zinc-200 placeholder:text-zinc-600"
            autoFocus
          />
          <Button
            type="submit"
            size="sm"
            disabled={!inputText.trim() || submitting}
            className="gap-1.5 shrink-0"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Capture
          </Button>
        </form>

        {/* Inbox Items */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Inbox
            </p>
            <Badge variant="secondary" className="text-[10px]">
              {items.length} items
            </Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-600">
              Inbox empty — capture something!
            </p>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="group rounded-md border border-zinc-800 bg-zinc-900 p-3 transition-colors hover:border-zinc-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex-1 text-sm text-zinc-300 break-words">
                        {item.text}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        className="h-6 w-6 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] text-zinc-600">
                        {formatTime(item.capturedAt)}
                      </span>

                      {/* Assign to project */}
                      <Select
                        onValueChange={(projectId) => {
                          if (projectId && projectId !== "__none") {
                            handleAssign(item.id, projectId as string);
                          }
                        }}
                      >
                        <SelectTrigger
                          className={cn(
                            "h-6 w-auto border-zinc-800 bg-zinc-950 text-[10px] text-zinc-500 gap-1",
                            "hover:border-zinc-700 hover:text-zinc-400 transition-colors"
                          )}
                        >
                          <Link className="h-2.5 w-2.5" />
                          <SelectValue placeholder="Assign..." />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.repoOwner}/{project.repoName}
                            </SelectItem>
                          ))}
                          {projects.length === 0 && (
                            <SelectItem value="__none" disabled>
                              No projects
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
