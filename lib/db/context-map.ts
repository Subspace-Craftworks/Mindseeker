import { getGoalDetail } from "@/lib/db/goals";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

type GoalSummaryRow = {
  id: string;
  title: string | null;
  status: string | null;
  updated_at: string | null;
};

export type ContextMapItem = {
  title: string;
};

export type ContextMapGoal = {
  id: string;
  title: string;
  status: string;
  subjects: ContextMapItem[];
  issues: ContextMapItem[];
  tasks: ContextMapItem[];
  events: ContextMapItem[];
};

export type ContextMap = {
  currentGoalId: string | null;
  goal: ContextMapGoal | null;
  goals: ContextMapGoal[];
};

function toTitle(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

type GoalDetail = NonNullable<Awaited<ReturnType<typeof getGoalDetail>>>;

async function loadGoalOverview(userId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("goals")
    .select("id,title,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  const goals = (data ?? []) as GoalSummaryRow[];
  return goals.map((goal) => ({
    id: goal.id,
    title: toTitle(goal.title) || "Untitled goal",
    subjects: [],
    issues: [],
    tasks: [],
    events: [],
  }));
}

function toContextGoal(detail: GoalDetail | null): ContextMapGoal | null {
  if (!detail) {
    return null;
  }

  return {
    id: detail.goal.id,
    title: toTitle(detail.goal.title) || "Untitled goal",
    status: detail.goal.status || "active",
    subjects: (detail.subjects ?? []).map((subject: any) => ({
      title: toTitle((subject as { title?: string | null }).title) || "Untitled subject",
    })),
    issues: (detail.issues ?? []).map((issue: any) => ({
      title: toTitle((issue as { title?: string | null }).title) || "Untitled issue",
    })),
    tasks: (detail.tasks ?? []).map((task: any) => ({
      title: toTitle((task as { title?: string | null }).title) || "Untitled task",
    })),
    events: (detail.events ?? []).map((event: any) => ({
      title: toTitle((event as { title?: string | null }).title) || "Untitled event",
    })),
  };
}

export async function getContextMap(userId: string, threadId?: string | null): Promise<ContextMap> {
  const supabase = createSupabaseServiceClient();

  const { data: goalsData } = await supabase.from("goals").select("id,title,status,updated_at").eq("user_id", userId);
  const goals = (goalsData ?? []) as GoalSummaryRow[];

  const [
    { data: subjects },
    { data: issues },
    { data: tasks },
    { data: events }
  ] = await Promise.all([
    supabase.from("subjects").select("id, goal_id, updated_at").eq("user_id", userId),
    supabase.from("issues").select("id, subject_id, updated_at").eq("user_id", userId),
    supabase.from("tasks").select("id, subject_id, issue_id, updated_at").eq("user_id", userId),
    supabase.from("events").select("id, goal_id, occurred_at").eq("user_id", userId),
  ]);

  const goalUpdatedAt = new Map<string, number>();
  for (const g of goals) {
    goalUpdatedAt.set(g.id, new Date(g.updated_at || 0).getTime());
  }

  const subjectToGoal = new Map<string, string>();
  for (const s of subjects || []) {
    if (s.goal_id) {
      subjectToGoal.set(String(s.id), String(s.goal_id));
      const t = new Date(s.updated_at).getTime();
      if (t > (goalUpdatedAt.get(String(s.goal_id)) || 0)) goalUpdatedAt.set(String(s.goal_id), t);
    }
  }

  const issueToSubject = new Map<string, string>();
  for (const i of issues || []) {
    if (i.subject_id) {
      issueToSubject.set(String(i.id), String(i.subject_id));
      const gid = subjectToGoal.get(String(i.subject_id));
      if (gid) {
        const t = new Date(i.updated_at).getTime();
        if (t > (goalUpdatedAt.get(gid) || 0)) goalUpdatedAt.set(gid, t);
      }
    }
  }

  for (const t of tasks || []) {
    let gid: string | undefined;
    if (t.subject_id) gid = subjectToGoal.get(String(t.subject_id));
    else if (t.issue_id) gid = subjectToGoal.get(issueToSubject.get(String(t.issue_id)) || "");
    
    if (gid) {
      const time = new Date(t.updated_at).getTime();
      if (time > (goalUpdatedAt.get(gid) || 0)) goalUpdatedAt.set(gid, time);
    }
  }

  for (const e of events || []) {
    if (e.goal_id) {
      const time = new Date(e.occurred_at).getTime();
      if (time > (goalUpdatedAt.get(String(e.goal_id)) || 0)) goalUpdatedAt.set(String(e.goal_id), time);
    }
  }

  const sortedGoals = [...goals].sort((a, b) => (goalUpdatedAt.get(b.id) || 0) - (goalUpdatedAt.get(a.id) || 0));
  const latestGoalId = sortedGoals.length > 0 ? sortedGoals[0].id : null;

  let latestGoalDetail: ContextMapGoal | null = null;
  if (latestGoalId) {
    const detail = await getGoalDetail({ userId, goalId: latestGoalId });
    latestGoalDetail = toContextGoal(detail);
    if (latestGoalDetail) {
       latestGoalDetail.status = goals.find(g => g.id === latestGoalId)?.status || "active";
    }
  }

  const finalGoals = sortedGoals.map(g => {
    if (g.id === latestGoalId && latestGoalDetail) {
      return latestGoalDetail;
    }
    return {
      id: g.id,
      title: toTitle(g.title) || "Untitled goal",
      status: g.status || "active",
      subjects: [],
      issues: [],
      tasks: [],
      events: []
    } satisfies ContextMapGoal;
  });

  return {
    currentGoalId: latestGoalId,
    goal: latestGoalDetail,
    goals: finalGoals
  };
}

export async function getGoalContext(userId: string, goalId: string) {
  const focused = toContextGoal(await getGoalDetail({ userId, goalId }));
  return {
    currentGoalId: focused?.id ?? goalId,
    goal: focused,
    goals: focused ? [focused] : [],
  } satisfies ContextMap;
}
