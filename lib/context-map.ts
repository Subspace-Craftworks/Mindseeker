import { getGoalDetail } from "@/lib/goals";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

type GoalSummaryRow = {
  id: string;
  title: string | null;
  updated_at: string | null;
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
    subjects: (detail.subjects ?? []).map((subject) => ({
      title: toTitle((subject as { title?: string | null }).title) || "Untitled subject",
    })),
    issues: (detail.issues ?? []).map((issue) => ({
      title: toTitle((issue as { title?: string | null }).title) || "Untitled issue",
    })),
    tasks: (detail.tasks ?? []).map((task) => ({
      title: toTitle((task as { title?: string | null }).title) || "Untitled task",
    })),
    events: (detail.events ?? []).map((event) => ({
      title: toTitle((event as { title?: string | null }).title) || "Untitled event",
    })),
  };
}

export async function getContextMap(userId: string, threadId?: string | null): Promise<ContextMap> {
  const supabase = createSupabaseServiceClient();

  if (threadId) {
    const { data: thread, error } = await supabase
      .from("chat_threads")
      .select("id,current_goal_id")
      .eq("id", threadId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const currentGoalId = (thread?.current_goal_id as string | null | undefined) ?? null;
    if (currentGoalId) {
      const focused = toContextGoal(await getGoalDetail({ userId, goalId: currentGoalId }));
      return {
        currentGoalId,
        goal: focused,
        goals: focused ? [focused] : [],
      };
    }
  }

  return {
    currentGoalId: null,
    goal: null,
    goals: await loadGoalOverview(userId),
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
