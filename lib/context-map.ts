import { createSupabaseServiceClient } from "@/lib/supabase/server";

type GoalRow = {
  id: string;
  title: string | null;
  updated_at: string | null;
};

type SubjectRow = {
  id: string;
  goal_id: string | null;
  title: string | null;
  updated_at: string | null;
};

type IssueRow = {
  id: string;
  subject_id: string | null;
  title: string | null;
  updated_at: string | null;
};

type TaskRow = {
  id: string;
  subject_id: string | null;
  issue_id: string | null;
  title: string | null;
  updated_at: string | null;
};

type EventRow = {
  id: string;
  goal_id: string | null;
  title: string | null;
  occurred_at: string | null;
};

export type ContextMapItem = {
  title: string;
};

export type ContextMapGoal = {
  id: string;
  title: string;
  subjects: ContextMapItem[];
  issues: ContextMapItem[];
  tasks: ContextMapItem[];
  events: ContextMapItem[];
};

export type ContextMap = {
  goals: ContextMapGoal[];
};

function toTitle(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function sortByDateDesc(left: string | null, right: string | null) {
  return new Date(right ?? 0).getTime() - new Date(left ?? 0).getTime();
}

export async function getContextMap(userId: string): Promise<ContextMap> {
  const supabase = createSupabaseServiceClient();

  const [
    { data: goalRows, error: goalsError },
    { data: subjectRows, error: subjectsError },
    { data: issueRows, error: issuesError },
    { data: taskRows, error: tasksError },
    { data: eventRows, error: eventsError },
  ] = await Promise.all([
    supabase.from("goals").select("id,title,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }),
    supabase.from("subjects").select("id,goal_id,title,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }),
    supabase.from("issues").select("id,subject_id,title,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }),
    supabase.from("tasks").select("id,subject_id,issue_id,title,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }),
    supabase.from("events").select("id,goal_id,title,occurred_at").eq("user_id", userId).order("occurred_at", { ascending: false }),
  ]);

  if (goalsError) throw goalsError;
  if (subjectsError) throw subjectsError;
  if (issuesError) throw issuesError;
  if (tasksError) throw tasksError;
  if (eventsError) throw eventsError;

  const goals = (goalRows ?? []) as GoalRow[];
  const subjects = (subjectRows ?? []) as SubjectRow[];
  const issues = (issueRows ?? []) as IssueRow[];
  const tasks = (taskRows ?? []) as TaskRow[];
  const events = (eventRows ?? []) as EventRow[];

  const tasksBySubjectId = new Map<string, TaskRow[]>();
  const tasksByIssueId = new Map<string, TaskRow[]>();
  const subjectsByGoalId = new Map<string, SubjectRow[]>();
  const issuesBySubjectId = new Map<string, IssueRow[]>();
  const eventsByGoalId = new Map<string, EventRow[]>();

  for (const subject of subjects) {
    if (!subject.goal_id) continue;
    const list = subjectsByGoalId.get(subject.goal_id) ?? [];
    list.push(subject);
    subjectsByGoalId.set(subject.goal_id, list);
  }

  for (const issue of issues) {
    if (!issue.subject_id) continue;
    const list = issuesBySubjectId.get(issue.subject_id) ?? [];
    list.push(issue);
    issuesBySubjectId.set(issue.subject_id, list);
  }

  for (const task of tasks) {
    if (task.subject_id) {
      const list = tasksBySubjectId.get(task.subject_id) ?? [];
      list.push(task);
      tasksBySubjectId.set(task.subject_id, list);
    }
    if (task.issue_id) {
      const list = tasksByIssueId.get(task.issue_id) ?? [];
      list.push(task);
      tasksByIssueId.set(task.issue_id, list);
    }
  }

  for (const event of events) {
    if (!event.goal_id) continue;
    const list = eventsByGoalId.get(event.goal_id) ?? [];
    list.push(event);
    eventsByGoalId.set(event.goal_id, list);
  }

  return {
    goals: goals.map((goal) => {
      const goalSubjects = (subjectsByGoalId.get(goal.id) ?? [])
        .slice()
        .sort((left, right) => sortByDateDesc(left.updated_at, right.updated_at));

      const subjectIds = new Set(goalSubjects.map((subject) => subject.id));

      const goalIssues = goalSubjects.flatMap((subject) =>
        (issuesBySubjectId.get(subject.id) ?? []).slice().sort((left, right) => sortByDateDesc(left.updated_at, right.updated_at)),
      );
      const issueIds = new Set(goalIssues.map((issue) => issue.id));

      const goalTasks = tasks
        .filter((task) => (task.subject_id ? subjectIds.has(task.subject_id) : false) || (task.issue_id ? issueIds.has(task.issue_id) : false))
        .slice()
        .sort((left, right) => sortByDateDesc(left.updated_at, right.updated_at));

      const goalEvents = (eventsByGoalId.get(goal.id) ?? []).slice().sort((left, right) => sortByDateDesc(left.occurred_at, right.occurred_at));

      return {
        id: goal.id,
        title: toTitle(goal.title) || "Untitled goal",
        subjects: goalSubjects.map((subject) => ({ title: toTitle(subject.title) || "Untitled subject" })),
        issues: goalIssues.map((issue) => ({ title: toTitle(issue.title) || "Untitled issue" })),
        tasks: goalTasks.map((task) => ({ title: toTitle(task.title) || "Untitled task" })),
        events: goalEvents.map((event) => ({ title: toTitle(event.title) || "Untitled event" })),
      } satisfies ContextMapGoal;
    }),
  };
}
