import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type GoalRecord = {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type GoalDetail = {
  goal: GoalRecord;
  subjects: Record<string, unknown>[];
  issues: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  events: Record<string, unknown>[];
};

export async function listGoals(userId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as GoalRecord[];
}

export async function createGoal(input: { userId: string; title: string; description?: string | null; status?: string | null }) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: input.userId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "active",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as GoalRecord;
}

export async function updateGoal(input: {
  userId: string;
  goalId: string;
  title?: string;
  description?: string | null;
  status?: string;
}) {
  const supabase = createSupabaseServiceClient();
  const updates: Partial<{ title: string; description: string | null; status: string; updated_at: string }> = {
    updated_at: new Date().toISOString(),
  };
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.status !== undefined) updates.status = input.status;

  const { data, error } = await supabase
    .from("goals")
    .update(updates)
    .eq("id", input.goalId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) throw error;
  return data as GoalRecord;
}

export async function deleteGoal(input: { userId: string; goalId: string }) {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", input.goalId)
    .eq("user_id", input.userId);

  if (error) throw error;
}

export async function getGoalDetail(input: { userId: string; goalId: string }) {
  const supabase = createSupabaseServiceClient();
  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("*")
    .eq("id", input.goalId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (goalError) {
    throw goalError;
  }
  if (!goal) {
    return null;
  }

  const [{ data: subjects, error: subjectsError }, { data: issues, error: issuesError }, { data: tasks, error: tasksError }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from("subjects").select("*").eq("goal_id", input.goalId).eq("user_id", input.userId).order("updated_at", { ascending: false }),
    supabase.from("issues").select("*").eq("user_id", input.userId).order("updated_at", { ascending: false }),
    supabase.from("tasks").select("*").eq("user_id", input.userId).order("updated_at", { ascending: false }),
    supabase.from("events").select("*").eq("goal_id", input.goalId).eq("user_id", input.userId).order("occurred_at", { ascending: false }),
  ]);

  if (subjectsError) throw subjectsError;
  if (issuesError) throw issuesError;
  if (tasksError) throw tasksError;
  if (eventsError) throw eventsError;

  const subjectIds = new Set((subjects ?? []).map((row) => String((row as { id?: unknown }).id ?? "")).filter(Boolean));
  const issuesFiltered = (issues ?? []).filter((row) => {
    const subjectId = String((row as { subject_id?: unknown }).subject_id ?? "");
    return subjectIds.has(subjectId);
  });
  const issueIds = new Set(issuesFiltered.map((row) => String((row as { id?: unknown }).id ?? "")).filter(Boolean));
  const tasksFiltered = (tasks ?? []).filter((row) => {
    const subjectId = String((row as { subject_id?: unknown }).subject_id ?? "");
    const issueId = String((row as { issue_id?: unknown }).issue_id ?? "");
    return subjectIds.has(subjectId) || issueIds.has(issueId);
  });

  return {
    goal: goal as GoalRecord,
    subjects: subjects ?? [],
    issues: issuesFiltered,
    tasks: tasksFiltered,
    events: events ?? [],
  } as GoalDetail;
}

