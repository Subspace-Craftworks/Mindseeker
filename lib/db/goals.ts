import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type GoalRecord = {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  background: string | null;
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
  artifacts: Record<string, unknown>[];
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

export async function createGoal(input: { userId: string; title: string; description?: string | null; background?: string | null; status?: string | null }) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: input.userId,
      title: input.title,
      description: input.description ?? null,
      background: input.background ?? null,
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
  background?: string | null;
  status?: string;
}) {
  const supabase = createSupabaseServiceClient();
  const updates: Partial<{ title: string; description: string | null; background: string | null; status: string; updated_at: string }> = {
    updated_at: new Date().toISOString(),
  };
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.background !== undefined) updates.background = input.background;
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

  // Get subjects for the goal
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id")
    .eq("goal_id", input.goalId)
    .eq("user_id", input.userId);
  const subjectIds = (subjects ?? []).map((s) => s.id);

  // Get issues for the subjects
  let issueIds: string[] = [];
  if (subjectIds.length > 0) {
    const { data: issues } = await supabase
      .from("issues")
      .select("id")
      .in("subject_id", subjectIds)
      .eq("user_id", input.userId);
    issueIds = (issues ?? []).map((i) => i.id);
  }

  // Delete events
  await supabase.from("events").delete().eq("goal_id", input.goalId).eq("user_id", input.userId);
  if (subjectIds.length > 0) {
    await supabase.from("events").delete().in("subject_id", subjectIds).eq("user_id", input.userId);
    await supabase.from("tasks").delete().in("subject_id", subjectIds).eq("user_id", input.userId);
  }
  if (issueIds.length > 0) {
    await supabase.from("events").delete().in("issue_id", issueIds).eq("user_id", input.userId);
    await supabase.from("tasks").delete().in("issue_id", issueIds).eq("user_id", input.userId);
  }

  // Delete issues & subjects
  if (subjectIds.length > 0) {
    await supabase.from("issues").delete().in("subject_id", subjectIds).eq("user_id", input.userId);
  }
  await supabase.from("subjects").delete().eq("goal_id", input.goalId).eq("user_id", input.userId);

  // Finally delete the goal
  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", input.goalId)
    .eq("user_id", input.userId);

  if (error) throw error;
}

export async function getGoalDetail(input: { userId: string; goalId: string }) {
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase.rpc('get_goal_detail', {
    p_goal_id: input.goalId,
    p_user_id: input.userId,
  });

  if (error) throw error;
  if (!data || !data.goal) return null;

  return {
    goal: data.goal as GoalRecord,
    subjects: data.subjects ?? [],
    issues: data.issues ?? [],
    tasks: data.tasks ?? [],
    events: data.events ?? [],
    artifacts: data.artifacts ?? [],
  } as GoalDetail;
}

