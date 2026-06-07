import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type ChatThreadRecord = {
  id: string;
  user_id: string;
  dify_conversation_id: string;
  title: string | null;
  app_key: string;
  current_goal_id: string | null;
  created_at: string;
  updated_at: string;
};

type UpsertChatThreadInput = {
  userId: string;
  conversationId: string;
  title?: string | null;
  appKey?: string;
  currentGoalId?: string | null;
};

export async function listChatThreads(userId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ChatThreadRecord[];
}

export async function getChatThread(userId: string, threadId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("*")
    .eq("id", threadId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as ChatThreadRecord | null;
}

export async function upsertChatThread(input: UpsertChatThreadInput) {
  const supabase = createSupabaseServiceClient();
  const record: Record<string, unknown> = {
    user_id: input.userId,
    dify_conversation_id: input.conversationId,
    title: input.title ?? null,
    app_key: input.appKey ?? "mindseeker",
    updated_at: new Date().toISOString(),
  };

  if (input.currentGoalId !== undefined) {
    record.current_goal_id = input.currentGoalId;
  }

  const { data, error } = await supabase
    .from("chat_threads")
    .upsert(record, {
      onConflict: "user_id,dify_conversation_id",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as ChatThreadRecord;
}

export async function deleteChatThread(userId: string, threadId: string) {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("chat_threads").delete().eq("id", threadId).eq("user_id", userId);
  if (error) {
    throw error;
  }
}

export async function updateChatThreadCurrentGoal(input: {
  userId?: string;
  conversationId?: string;
  threadId?: string;
  currentGoalId: string | null;
}) {
  const supabase = createSupabaseServiceClient();
  let query = supabase.from("chat_threads").update({
    current_goal_id: input.currentGoalId,
    updated_at: new Date().toISOString(),
  });

  if (input.threadId) {
    query = query.eq("id", input.threadId);
  } else if (input.conversationId) {
    query = query.eq("dify_conversation_id", input.conversationId);
  } else {
    throw new Error("threadId or conversationId is required");
  }

  if (input.userId) {
    query = query.eq("user_id", input.userId);
  }

  const { data, error } = await query.select("*").maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return data as ChatThreadRecord;
}
