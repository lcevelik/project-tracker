import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FolderOpen, GitBranch, LayoutDashboard, ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Onboarding component shown when a user has no projects
// ---------------------------------------------------------------------------

export function OnboardingEmpty() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/50 ring-1 ring-zinc-700/50">
          <FolderOpen className="h-8 w-8 text-zinc-400" />
        </div>

        <h2 className="text-xl font-semibold text-zinc-100">
          Welcome to Project Tracker
        </h2>
        <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
          Track all your GitHub repositories in one place. Sync PROJECT.md files,
          manage Kanban boards, monitor releases, and stay on top of your work.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: FolderOpen,
              title: "Add a repo",
              desc: "Connect your first GitHub repository",
            },
            {
              icon: GitBranch,
              title: "Auto-sync",
              desc: "We parse PROJECT.md and sync issues & PRs",
            },
            {
              icon: LayoutDashboard,
              title: "Track progress",
              desc: "Kanban board, releases, and activity charts",
            },
          ].map((step, i) => (
            <Card key={i} className="border-zinc-800/50 bg-zinc-900/30">
              <CardContent className="pt-4 pb-3 text-center">
                <step.icon className="mx-auto h-5 w-5 text-zinc-500 mb-2" />
                <p className="text-xs font-medium text-zinc-300">{step.title}</p>
                <p className="mt-1 text-[11px] text-zinc-600">{step.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Link href="/add-project">
          <Button className="mt-8 gap-2 px-6">
            Add your first project
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
