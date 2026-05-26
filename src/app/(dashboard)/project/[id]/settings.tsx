"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Settings, Save, FilePlus2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { GroupPicker } from "@/components/group-picker";

interface SettingsTabProps {
  projectId: string;
  staleThresholdDays: number;
  projectMdPath: string;
  aiFallbackEnabled: boolean;
  group: string | null;
  groups: string[];
}

export function SettingsTab({
  projectId,
  staleThresholdDays,
  projectMdPath,
  aiFallbackEnabled: initialAiFallback,
  group: initialGroup,
  groups: existingGroups,
}: SettingsTabProps) {
  const router = useRouter();
  const [stale, setStale] = useState(staleThresholdDays);
  const [mdPath, setMdPath] = useState(projectMdPath);
  const [aiFallback, setAiFallback] = useState(initialAiFallback);
  const [group, setGroup] = useState(initialGroup);
  const [saving, setSaving] = useState(false);

  // Template dialog state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staleThresholdDays: stale,
          projectMdPath: mdPath,
          aiFallbackEnabled: aiFallback,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");

      // Save group separately
      const groupRes = await fetch(`/api/projects/${projectId}/group`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group }),
      });
      if (!groupRes.ok) throw new Error("Failed to save group");

      toast.success("Settings saved");
      router.refresh();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleDropTemplate() {
    setTemplateLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/template`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          toast.error(`${projectMdPath} already exists in the repository`);
        } else {
          toast.error(data.error || "Failed to create template");
        }
        return;
      }

      toast.success(`${projectMdPath} created in repository`);
      setTemplateDialogOpen(false);
    } catch {
      toast.error("Failed to create template");
    } finally {
      setTemplateLoading(false);
    }
  }

  return (
    <>
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-zinc-500" />
            <CardTitle className="text-sm font-medium text-zinc-200">
              Project Settings
            </CardTitle>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="group" className="text-zinc-300">
              Group
            </Label>
            <GroupPicker
              value={group}
              groups={existingGroups}
              onChange={setGroup}
              placeholder="Assign to a group..."
            />
            <p className="text-xs text-zinc-500">
              Organize projects into groups like &quot;Active&quot;, &quot;Tools&quot;, or &quot;Reports&quot;.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stale" className="text-zinc-300">
              Stale threshold (days)
            </Label>
            <Input
              id="stale"
              type="number"
              min={1}
              value={stale}
              onChange={(e) => setStale(Number(e.target.value))}
              className="w-32 border-zinc-800 bg-zinc-950 text-zinc-200"
            />
            <p className="text-xs text-zinc-500">
              Projects with no activity for this many days will be flagged as stale.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mdpath" className="text-zinc-300">
              PROJECT.md path
            </Label>
            <Input
              id="mdpath"
              type="text"
              value={mdPath}
              onChange={(e) => setMdPath(e.target.value)}
              placeholder="PROJECT.md"
              className="border-zinc-800 bg-zinc-950 text-zinc-200"
            />
            <p className="text-xs text-zinc-500">
              Path to the project roadmap file in the repository.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="ai-fallback"
              checked={aiFallback}
              onChange={(e) => setAiFallback(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900"
            />
            <div>
              <Label htmlFor="ai-fallback" className="text-zinc-300">
                AI fallback for task extraction
              </Label>
              <p className="text-xs text-zinc-500">
                When PROJECT.md is not found, use Claude AI to extract tasks from
                README.md, TODO.md, PLAN.md, or CHANGELOG.md.
              </p>
            </div>
          </div>

          {/* Drop PROJECT.md Template */}
          <div className="border-t border-zinc-800 pt-6">
            <div className="space-y-2">
              <Label className="text-zinc-300">PROJECT.md Template</Label>
              <p className="text-xs text-zinc-500">
                If your repo doesn&apos;t have a {projectMdPath}, you can create one with
                a ready-to-use template. This will commit the file directly to the
                repository&apos;s default branch.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                onClick={() => setTemplateDialogOpen(true)}
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                Drop {projectMdPath} Template
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              Create {projectMdPath} in repository?
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              This will create a new {projectMdPath} file with a ready-to-use template
              in the repository&apos;s default branch. The file will include sections for
              Goals, In Progress, To Do, Done, Blocked, and Releases.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300/80">
                This will create a commit directly in your repository. Make sure the
                default branch allows direct pushes.
              </p>
            </div>
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-300" />
              }
            >
              Cancel
            </DialogClose>
            <Button
              onClick={handleDropTemplate}
              disabled={templateLoading}
              className="gap-2"
            >
              {templateLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FilePlus2 className="h-3.5 w-3.5" />
              )}
              {templateLoading ? "Creating..." : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
