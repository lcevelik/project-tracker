"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NotesTabProps {
  projectId: string;
  initialContent: string;
}

export function NotesTab({ projectId, initialContent }: NotesTabProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNotes() {
      try {
        const res = await fetch(`/api/projects/${projectId}/notes`);
        if (res.ok) {
          const data = await res.json();
          if (data.markdown) {
            setContent(data.markdown);
          }
        }
      } catch {
        // Silently fall back to initialContent
      } finally {
        setLoading(false);
      }
    }
    loadNotes();
  }, [projectId]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: content }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Notes saved");
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-zinc-500" />
          <CardTitle className="text-sm font-medium text-zinc-200">
            Private Scratchpad
          </CardTitle>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />}
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || loading}
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </CardHeader>
      <CardContent>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write private notes in markdown..."
          disabled={loading}
          className="min-h-[300px] resize-y border-zinc-800 bg-zinc-950 font-mono text-sm text-zinc-300 placeholder:text-zinc-600"
        />
      </CardContent>
    </Card>
  );
}
