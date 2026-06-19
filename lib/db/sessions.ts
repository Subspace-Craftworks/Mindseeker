import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type SessionRecord = {
  id: string;
  user_id: string;
  current_goal_id: string | null;
  dify_conversation_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function createSession(userId: string): Promise<SessionRecord> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({ user_id: userId })
    .select("*")
    .single();

  if (error) throw error;
  return data as SessionRecord;
}

export async function getSession(sessionId: string, userId: string): Promise<SessionRecord | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as SessionRecord | null;
}

export async function updateSessionGoal(sessionId: string, currentGoalId: string | null): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("sessions")
    .update({
      current_goal_id: currentGoalId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}

export async function updateSessionConversation(sessionId: string, conversationId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("sessions")
    .update({
      dify_conversation_id: conversationId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}

export async function getSessionByConversation(conversationId: string, userId: string): Promise<SessionRecord | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("dify_conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as SessionRecord | null;
}



export async function deleteSessionByConversation(conversationId: string, userId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("dify_conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) throw error;
}


export async function listSessionsByUser(userId: string): Promise<SessionRecord[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []) as SessionRecord[];
}
