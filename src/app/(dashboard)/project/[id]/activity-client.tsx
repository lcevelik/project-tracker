"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  GitCommit,
  GitPullRequest,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  ListTodo,
  Activity,
  Target,
} from "lucide-react";

interface CommitDay {
  day: string;
  count: number;
}

interface TaskData {
  id: string;
  title: string;
  status: string;
  source: string;
  externalId: string | null;
  createdAt: string;
}

interface GoalData {
  id: string;
  title: string;
  status: string;
  targetDate: string | null;
}

interface ActivityClientProps {
  commitDailies: CommitDay[];
  tasks: TaskData[];
  goals: GoalData[];
}

// ── Commit Sparkline ──────────────────────────────────────────────

function CommitSparkline({ data }: { data: CommitDay[] }) {
  const chartData = useMemo(() => {
    // Take last 30 days, sort ascending
    const sorted = [...data]
      .sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime())
      .slice(-30);
    return sorted.map((d) => ({
      day: new Date(d.day).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      commits: d.count,
    }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs text-zinc-600">
          No commit data yet — sync to populate
        </p>
      </div>
    );
  }

  return (
    <div className="h-[120px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="commitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="day"
            tick={{ fill: "#a1a1aa", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#27272a" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#a1a1aa", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #27272a",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#e4e4e7",
            }}
          />
          <Area
            type="monotone"
            dataKey="commits"
            stroke="#10b981"
            fill="url(#commitGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Burndown Chart ────────────────────────────────────────────────

function BurndownChart({
  tasks,
  goals,
}: {
  tasks: TaskData[];
  goals: GoalData[];
}) {
  const openTaskCount = tasks.filter(
    (t) => t.status !== "done"
  ).length;

  // Find the nearest active goal with a target date
  const activeGoal = useMemo(() => {
    const now = new Date();
    return goals
      .filter((g) => g.status === "active" && g.targetDate)
      .sort(
        (a, b) =>
          new Date(a.targetDate!).getTime() - new Date(b.targetDate!).getTime()
      )
      .find((g) => new Date(g.targetDate!) >= now);
  }, [goals]);

  if (!activeGoal || !activeGoal.targetDate) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <Target className="h-5 w-5 text-zinc-600" />
        <p className="text-xs text-zinc-600">
          No goal target set — create a goal with a target date to see burndown
        </p>
      </div>
    );
  }

  const chartData = useMemo(() => {
    const now = new Date();
    const target = new Date(activeGoal.targetDate!);
    const totalDays = Math.max(
      Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      1
    );

    const points = [];
    const numPoints = Math.min(totalDays, 14); // Max 14 data points
    for (let i = 0; i <= numPoints; i++) {
      const dayFraction = i / numPoints;
      const daysFromNow = Math.round(dayFraction * totalDays);
      const date = new Date(now);
      date.setDate(date.getDate() + daysFromNow);

      // Ideal burndown: linear from current count to 0
      const ideal = Math.round(openTaskCount * (1 - dayFraction));
      // Actual: for now, just show current state (flat line from start)
      // In a real implementation, you'd pull from historical data
      const actual = i === 0 ? openTaskCount : null;

      points.push({
        day: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        ideal,
        actual,
      });
    }
    // Fill actual with current count at the end for the snapshot
    points[points.length - 1].actual = openTaskCount;

    return points;
  }, [openTaskCount, activeGoal.targetDate]);

  return (
    <div className="h-[120px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="day"
            tick={{ fill: "#a1a1aa", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#27272a" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#a1a1aa", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #27272a",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#e4e4e7",
            }}
          />
          <Line
            type="monotone"
            dataKey="ideal"
            stroke="#6366f1"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
            name="Ideal"
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ fill: "#f59e0b", r: 3 }}
            connectNulls
            name="Actual"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Activity Feed ─────────────────────────────────────────────────

function ActivityFeed({
  tasks,
  commitDailies,
}: {
  tasks: TaskData[];
  commitDailies: CommitDay[];
}) {
  const feedItems = useMemo(() => {
    const items: {
      type: string;
      icon: React.ElementType;
      title: string;
      date: string;
      color: string;
    }[] = [];

    // Recent commits
    const recentCommits = [...commitDailies]
      .sort((a, b) => new Date(b.day).getTime() - new Date(a.day).getTime())
      .slice(0, 5);
    for (const cd of recentCommits) {
      if (cd.count > 0) {
        items.push({
          type: "commit",
          icon: GitCommit,
          title: `${cd.count} commit${cd.count !== 1 ? "s" : ""}`,
          date: cd.day,
          color: "text-emerald-400",
        });
      }
    }

    // Recent issues
    const issues = tasks
      .filter((t) => t.source === "issue")
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 5);
    for (const issue of issues) {
      items.push({
        type: "issue",
        icon: AlertCircle,
        title: issue.title,
        date: issue.createdAt,
        color: "text-blue-400",
      });
    }

    // Recent PRs
    const prs = tasks
      .filter((t) => t.source === "pr")
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 5);
    for (const pr of prs) {
      items.push({
        type: "pr",
        icon: GitPullRequest,
        title: pr.title,
        date: pr.createdAt,
        color: "text-purple-400",
      });
    }

    // Sort all by date descending, take top 10
    return items
      .sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      .slice(0, 10);
  }, [tasks, commitDailies]);

  if (feedItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 gap-2">
        <Activity className="h-4 w-4 text-zinc-600" />
        <span className="text-xs text-zinc-600">
          No recent activity — sync to populate
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {feedItems.map((item, i) => {
        const Icon = item.icon;
        return (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-zinc-800/50 transition-colors"
          >
            <Icon className={cn("h-4 w-4 shrink-0", item.color)} />
            <span className="flex-1 text-sm text-zinc-300 truncate">
              {item.title}
            </span>
            <span className="shrink-0 text-[10px] text-zinc-600">
              {new Date(item.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Stats Cards ───────────────────────────────────────────────────

function StatsCards({ tasks }: { tasks: TaskData[] }) {
  const total = tasks.length;
  const open = tasks.filter(
    (t) => t.status === "todo" || t.status === "in_progress"
  ).length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const done = tasks.filter((t) => t.status === "done").length;

  // Stale: tasks with source=issue or pr that have been in a non-done state
  // We can't easily check staleness without updatedAt, so just show blocked
  const stale = blocked;

  const stats = [
    {
      label: "Total Tasks",
      value: total,
      icon: ListTodo,
      color: "text-zinc-400",
    },
    {
      label: "Open",
      value: open,
      icon: Clock,
      color: "text-blue-400",
    },
    {
      label: "Completed",
      value: done,
      icon: CheckCircle2,
      color: "text-emerald-400",
    },
    {
      label: "Blocked",
      value: stale,
      icon: AlertCircle,
      color: stale > 0 ? "text-red-400" : "text-zinc-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
          >
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4", stat.color)} />
              <span className="text-xs text-zinc-500">{stat.label}</span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">
              {stat.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────

export function ActivityClient({
  commitDailies,
  tasks,
  goals,
}: ActivityClientProps) {
  const totalCommits = commitDailies.reduce((sum, d) => sum + d.count, 0);
  const activeDays = commitDailies.filter((d) => d.count > 0).length;

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <StatsCards tasks={tasks} />

      {/* Charts Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Commit Sparkline */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <GitCommit className="h-5 w-5 text-zinc-500" />
            <div>
              <CardTitle className="text-sm font-medium text-zinc-200">
                Commit Activity
              </CardTitle>
              <p className="text-xs text-zinc-500">
                {totalCommits} commits · {activeDays} active days
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <CommitSparkline data={commitDailies} />
          </CardContent>
        </Card>

        {/* Burndown Chart */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <BarChart3 className="h-5 w-5 text-zinc-500" />
            <CardTitle className="text-sm font-medium text-zinc-200">
              Burndown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BurndownChart tasks={tasks} goals={goals} />
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Activity className="h-5 w-5 text-zinc-500" />
          <CardTitle className="text-sm font-medium text-zinc-200">
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed tasks={tasks} commitDailies={commitDailies} />
        </CardContent>
      </Card>
    </div>
  );
}
