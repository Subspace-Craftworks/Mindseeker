import { createSupabaseServiceClient } from "@/lib/supabase/server";

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

export async function getContextMap(userId: string): Promise<ContextMap> {
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase.rpc('get_context_map', { p_user_id: userId });
  if (error) throw error;

  const goals: ContextMapGoal[] = (data ?? []).map((g: any) => ({
    id: g.id,
    title: g.title || "Untitled goal",
    status: g.status || "active",
    subjects: g.subjects ?? [],
    issues: g.issues ?? [],
    tasks: g.tasks ?? [],
    events: g.events ?? [],
  }));

  // The first goal (most recently active) is the "current" for context-map display
  const latestGoal = goals.length > 0 ? goals[0] : null;

  return {
    currentGoalId: latestGoal?.id ?? null,
    goal: latestGoal,
    goals,
  };
}

export async function getGoalContext(userId: string, goalId: string): Promise<ContextMap> {
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase.rpc('get_context_map', { p_user_id: userId });
  if (error) throw error;

  const goals: ContextMapGoal[] = (data ?? []).map((g: any) => ({
    id: g.id,
    title: g.title || "Untitled goal",
    status: g.status || "active",
    subjects: g.subjects ?? [],
    issues: g.issues ?? [],
    tasks: g.tasks ?? [],
    events: g.events ?? [],
  }));

  const focused = goals.find(g => g.id === goalId) ?? null;

  return {
    currentGoalId: focused?.id ?? goalId,
    goal: focused,
    goals,
  };
}
