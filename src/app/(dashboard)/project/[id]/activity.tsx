import { ActivityClient } from "./activity-client";

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

interface ActivityTabProps {
  commitDailies: CommitDay[];
  tasks: TaskData[];
  goals: GoalData[];
}

export function ActivityTab({
  commitDailies = [],
  tasks = [],
  goals = [],
}: ActivityTabProps) {
  return (
    <ActivityClient
      commitDailies={commitDailies}
      tasks={tasks}
      goals={goals}
    />
  );
}
