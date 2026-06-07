import { createSupabaseServiceClient } from "@/lib/supabase/server";

type TableTitleRow = {
  title: string | null;
};

export type ContextMap = {
  goals: string[];
  subjects: string[];
  issues: string[];
  tasks: string[];
  events: string[];
};

function toTitleList(rows: TableTitleRow[] | null | undefined) {
  return (rows ?? [])
    .map((row) => (typeof row.title === "string" ? row.title.trim() : ""))
    .filter(Boolean);
}

export async function getContextMap(userId: string): Promise<ContextMap> {
  const supabase = createSupabaseServiceClient();

  const [{ data: goals, error: goalsError }, { data: subjects, error: subjectsError }, { data: issues, error: issuesError }, { data: tasks, error: tasksError }, { data: events, error: eventsError }] =
    await Promise.all([
      supabase.from("goals").select("title").eq("user_id", userId).order("updated_at", { ascending: false }),
      supabase.from("subjects").select("title").eq("user_id", userId).order("updated_at", { ascending: false }),
      supabase.from("issues").select("title").eq("user_id", userId).order("updated_at", { ascending: false }),
      supabase.from("tasks").select("title").eq("user_id", userId).order("updated_at", { ascending: false }),
      supabase.from("events").select("title").eq("user_id", userId).order("occurred_at", { ascending: false }),
    ]);

  if (goalsError) throw goalsError;
  if (subjectsError) throw subjectsError;
  if (issuesError) throw issuesError;
  if (tasksError) throw tasksError;
  if (eventsError) throw eventsError;

  return {
    goals: toTitleList(goals as TableTitleRow[] | null),
    subjects: toTitleList(subjects as TableTitleRow[] | null),
    issues: toTitleList(issues as TableTitleRow[] | null),
    tasks: toTitleList(tasks as TableTitleRow[] | null),
    events: toTitleList(events as TableTitleRow[] | null),
  };
}
