import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type ArtifactRecord = {
  id: string;
  user_id: string;
  goal_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export async function createArtifact(input: { userId: string; goalId: string; title: string; content: string }) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("artifacts")
    .insert({
      user_id: input.userId,
      goal_id: input.goalId,
      title: input.title,
      content: input.content,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as ArtifactRecord;
}

export async function deleteArtifact(input: { userId: string; artifactId: string }) {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("artifacts")
    .delete()
    .eq("id", input.artifactId)
    .eq("user_id", input.userId);

  if (error) {
    throw error;
  }
}
