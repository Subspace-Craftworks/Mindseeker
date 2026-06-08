import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type JsonObject = Record<string, unknown>;

type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

type ApiResponse<T> = {
  ok: boolean;
  data: T | null;
  error: ApiError | null;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

function json<T>(body: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function success<T>(data: T): Response {
  return json<T>({ ok: true, data, error: null });
}

function fail(code: string, message: string, status = 400, details?: unknown): Response {
  return json<null>(
    {
      ok: false,
      data: null,
      error: { code, message, details },
    },
    status,
  );
}

function corsHeaders(origin: string | null) {
  return {
    ...JSON_HEADERS,
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-headers": "authorization, content-type, x-client-info, apikey",
    "access-control-allow-methods": "POST, OPTIONS",
  };
}

function withCors(response: Response, origin: string | null) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(origin);
  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getSupabaseClient() {
  const url = getEnv("SUPABASE_URL");
  const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toInt(value: unknown, fallback: number, min = 1, max = 100): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.trunc(n);
  return Math.min(max, Math.max(min, rounded));
}

function arrayUnique(values: string[]) {
  return [...new Set(values)];
}

function nonEmptyIds(values: Array<string | null | undefined>): string[] {
  return arrayUnique(values.filter((v): v is string => typeof v === "string" && v.length > 0));
}

async function readBody(req: Request): Promise<JsonObject> {
  const text = await req.text();
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Request body must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object");
  }
  return parsed as JsonObject;
}

function getParams(body: JsonObject): JsonObject {
  const params = body.params;
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return {};
  }
  return params as JsonObject;
}

async function listGoals(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  let query = supabase.from("goals").select("*").order("updated_at", { ascending: false });
  const status = cleanString(params.status);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.limit(toInt(params.limit, 20, 1, 100));
  if (error) throw error;
  return success(data ?? []);
}

async function createGoal(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  const title = cleanString(params.title);
  const userId = cleanString(params.user_id);
  if (!title) return fail("VALIDATION_ERROR", "title is required", 400);
  if (!userId) return fail("VALIDATION_ERROR", "user_id is required", 400);

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      title,
      description: cleanString(params.description),
      status: cleanString(params.status) ?? "active",
    })
    .select("*")
    .single();

  if (error) throw error;
  return success(data);
}

async function updateGoal(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  const goalId = cleanString(params.goal_id);
  if (!goalId) return fail("VALIDATION_ERROR", "goal_id is required", 400);

  const patch: JsonObject = {};
  const title = cleanString(params.title);
  const description = params.description === undefined ? undefined : cleanString(params.description);
  const status = cleanString(params.status);

  if (title) patch.title = title;
  if (description !== undefined) patch.description = description;
  if (status) patch.status = status;

  if (Object.keys(patch).length === 0) {
    return fail("VALIDATION_ERROR", "At least one field must be provided", 400);
  }

  const { data, error } = await supabase
    .from("goals")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", goalId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) return fail("NOT_FOUND", "Goal not found", 404);
  return success(data);
}

async function completeGoal(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  const goalId = cleanString(params.goal_id);
  const userId = cleanString(params.user_id);
  if (!goalId) return fail("VALIDATION_ERROR", "goal_id is required", 400);
  if (!userId) return fail("VALIDATION_ERROR", "user_id is required", 400);

  const { data: goal, error: goalError } = await supabase.from("goals").select("*").eq("id", goalId).maybeSingle();
  if (goalError) throw goalError;
  if (!goal) return fail("NOT_FOUND", "Goal not found", 404);

  const { data: updatedGoal, error: updateError } = await supabase
    .from("goals")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", goalId)
    .select("*")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updatedGoal) return fail("NOT_FOUND", "Goal not found", 404);

  const occurredAt = cleanString(params.occurred_at);
  if (occurredAt && Number.isNaN(Date.parse(occurredAt))) {
    return fail("VALIDATION_ERROR", "occurred_at must be a valid date-time string", 400);
  }

  const completionReason = cleanString(params.reason) ?? cleanString(params.note) ?? cleanString(params.body);
  const title = cleanString(params.event_title) ?? `Goal completed: ${String(goal.title ?? "goal")}`;
  const body = completionReason ?? `Goal \"${String(goal.title ?? goalId)}\" was marked inactive.`;
  const source = cleanString(params.source) ?? "planning-api";

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      goal_id: goalId,
      event_type: "goal_completed",
      title,
      body,
      source,
      occurred_at: occurredAt ?? new Date().toISOString(),
    })
    .select("*")
    .single();

  if (eventError) throw eventError;

  return success({
    goal: updatedGoal,
    event,
  });
}

async function listSubjects(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  let query = supabase.from("subjects").select("*").order("updated_at", { ascending: false });
  const goalId = cleanString(params.goal_id);
  const status = cleanString(params.status);
  const priority = cleanString(params.priority);
  if (goalId) query = query.eq("goal_id", goalId);
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  const { data, error } = await query.limit(toInt(params.limit, 20, 1, 100));
  if (error) throw error;
  return success(data ?? []);
}

async function createSubject(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  const goalId = cleanString(params.goal_id);
  const title = cleanString(params.title);
  const userId = cleanString(params.user_id);
  if (!goalId) return fail("VALIDATION_ERROR", "goal_id is required", 400);
  if (!title) return fail("VALIDATION_ERROR", "title is required", 400);
  if (!userId) return fail("VALIDATION_ERROR", "user_id is required", 400);

  const { data, error } = await supabase
    .from("subjects")
    .insert({
      user_id: userId,
      goal_id: goalId,
      title,
      description: cleanString(params.description),
      status: cleanString(params.status) ?? "open",
      priority: cleanString(params.priority) ?? "normal",
    })
    .select("*")
    .single();

  if (error) throw error;
  return success(data);
}

async function updateSubject(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  const subjectId = cleanString(params.subject_id);
  if (!subjectId) return fail("VALIDATION_ERROR", "subject_id is required", 400);

  const patch: JsonObject = {};
  const goalId = cleanString(params.goal_id);
  const title = cleanString(params.title);
  const description = params.description === undefined ? undefined : cleanString(params.description);
  const status = cleanString(params.status);
  const priority = cleanString(params.priority);

  if (goalId) patch.goal_id = goalId;
  if (title) patch.title = title;
  if (description !== undefined) patch.description = description;
  if (status) patch.status = status;
  if (priority) patch.priority = priority;

  if (Object.keys(patch).length === 0) {
    return fail("VALIDATION_ERROR", "At least one field must be provided", 400);
  }

  const { data, error } = await supabase
    .from("subjects")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", subjectId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) return fail("NOT_FOUND", "Subject not found", 404);
  return success(data);
}

async function listIssues(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  let query = supabase.from("issues").select("*").order("updated_at", { ascending: false });
  const goalId = cleanString(params.goal_id);
  const subjectId = cleanString(params.subject_id);
  const status = cleanString(params.status);
  const severity = cleanString(params.severity);
  if (subjectId) query = query.eq("subject_id", subjectId);
  if (status) query = query.eq("status", status);
  if (severity) query = query.eq("severity", severity);
  if (goalId) {
    const subjectIdsResult = await supabase.from("subjects").select("id").eq("goal_id", goalId);
    if (subjectIdsResult.error) throw subjectIdsResult.error;
    const subjectIds = (subjectIdsResult.data ?? []).map((row) => row.id).filter(Boolean);
    query = subjectIds.length > 0 ? query.in("subject_id", subjectIds) : query.eq("subject_id", "__none__");
  }
  const { data, error } = await query.limit(toInt(params.limit, 20, 1, 100));
  if (error) throw error;
  return success(data ?? []);
}

async function createIssue(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  const subjectId = cleanString(params.subject_id);
  const title = cleanString(params.title);
  const userId = cleanString(params.user_id);
  if (!subjectId) return fail("VALIDATION_ERROR", "subject_id is required", 400);
  if (!title) return fail("VALIDATION_ERROR", "title is required", 400);
  if (!userId) return fail("VALIDATION_ERROR", "user_id is required", 400);

  const { data, error } = await supabase
    .from("issues")
    .insert({
      user_id: userId,
      subject_id: subjectId,
      title,
      description: cleanString(params.description),
      status: cleanString(params.status) ?? "open",
      severity: cleanString(params.severity) ?? "medium",
    })
    .select("*")
    .single();

  if (error) throw error;
  return success(data);
}

async function updateIssue(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  const issueId = cleanString(params.issue_id);
  if (!issueId) return fail("VALIDATION_ERROR", "issue_id is required", 400);

  const patch: JsonObject = {};
  const subjectId = cleanString(params.subject_id);
  const title = cleanString(params.title);
  const description = params.description === undefined ? undefined : cleanString(params.description);
  const status = cleanString(params.status);
  const severity = cleanString(params.severity);

  if (subjectId) patch.subject_id = subjectId;
  if (title) patch.title = title;
  if (description !== undefined) patch.description = description;
  if (status) patch.status = status;
  if (severity) patch.severity = severity;

  if (Object.keys(patch).length === 0) {
    return fail("VALIDATION_ERROR", "At least one field must be provided", 400);
  }

  const { data, error } = await supabase
    .from("issues")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", issueId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) return fail("NOT_FOUND", "Issue not found", 404);
  return success(data);
}

async function listTasks(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  let query = supabase.from("tasks").select("*").order("updated_at", { ascending: false });
  const goalId = cleanString(params.goal_id);
  const subjectId = cleanString(params.subject_id);
  const issueId = cleanString(params.issue_id);
  const status = cleanString(params.status);
  if (subjectId) query = query.eq("subject_id", subjectId);
  if (issueId) query = query.eq("issue_id", issueId);
  if (status) query = query.eq("status", status);
  if (goalId) {
    const subjectIdsResult = await supabase.from("subjects").select("id").eq("goal_id", goalId);
    if (subjectIdsResult.error) throw subjectIdsResult.error;
    const subjectIds = (subjectIdsResult.data ?? []).map((row) => row.id).filter(Boolean);
    query = subjectIds.length > 0 ? query.in("subject_id", subjectIds) : query.eq("subject_id", "__none__");
  }
  const { data, error } = await query.limit(toInt(params.limit, 20, 1, 100));
  if (error) throw error;
  return success(data ?? []);
}

async function createTask(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  const subjectId = cleanString(params.subject_id);
  const title = cleanString(params.title);
  const userId = cleanString(params.user_id);
  if (!subjectId) return fail("VALIDATION_ERROR", "subject_id is required", 400);
  if (!title) return fail("VALIDATION_ERROR", "title is required", 400);
  if (!userId) return fail("VALIDATION_ERROR", "user_id is required", 400);

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      issue_id: cleanString(params.issue_id),
      subject_id: subjectId,
      title,
      description: cleanString(params.description),
      status: cleanString(params.status) ?? "todo",
      due_date: cleanString(params.due_date),
      assignee: cleanString(params.assignee),
    })
    .select("*")
    .single();

  if (error) throw error;
  return success(data);
}

async function updateTask(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  const taskId = cleanString(params.task_id);
  if (!taskId) return fail("VALIDATION_ERROR", "task_id is required", 400);

  const patch: JsonObject = {};
  const issueId = cleanString(params.issue_id);
  const subjectId = cleanString(params.subject_id);
  const title = cleanString(params.title);
  const description = params.description === undefined ? undefined : cleanString(params.description);
  const status = cleanString(params.status);
  const dueDate = params.due_date === undefined ? undefined : cleanString(params.due_date);
  const assignee = params.assignee === undefined ? undefined : cleanString(params.assignee);

  if (issueId) patch.issue_id = issueId;
  if (subjectId) patch.subject_id = subjectId;
  if (title) patch.title = title;
  if (description !== undefined) patch.description = description;
  if (status) patch.status = status;
  if (dueDate !== undefined) patch.due_date = dueDate;
  if (assignee !== undefined) patch.assignee = assignee;

  if (Object.keys(patch).length === 0) {
    return fail("VALIDATION_ERROR", "At least one field must be provided", 400);
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) return fail("NOT_FOUND", "Task not found", 404);
  return success(data);
}

async function createEvent(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  const eventType = cleanString(params.event_type);
  const title = cleanString(params.title);
  const userId = cleanString(params.user_id);
  if (!eventType) return fail("VALIDATION_ERROR", "event_type is required", 400);
  if (!title) return fail("VALIDATION_ERROR", "title is required", 400);
  if (!userId) return fail("VALIDATION_ERROR", "user_id is required", 400);

  const occurredAt = cleanString(params.occurred_at);
  if (occurredAt && Number.isNaN(Date.parse(occurredAt))) {
    return fail("VALIDATION_ERROR", "occurred_at must be a valid date-time string", 400);
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      goal_id: cleanString(params.goal_id),
      subject_id: cleanString(params.subject_id),
      issue_id: cleanString(params.issue_id),
      task_id: cleanString(params.task_id),
      event_type: eventType,
      title,
      body: cleanString(params.body),
      source: cleanString(params.source) ?? "planning-api",
      occurred_at: occurredAt ?? new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return success(data);
}

async function listEvents(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  let query = supabase.from("events").select("*").order("occurred_at", { ascending: false });
  const goalId = cleanString(params.goal_id);
  const subjectId = cleanString(params.subject_id);
  const issueId = cleanString(params.issue_id);
  const taskId = cleanString(params.task_id);
  const eventType = cleanString(params.event_type);
  const source = cleanString(params.source);
  const from = cleanString(params.from);
  const to = cleanString(params.to);

  if (goalId) query = query.eq("goal_id", goalId);
  if (subjectId) query = query.eq("subject_id", subjectId);
  if (issueId) query = query.eq("issue_id", issueId);
  if (taskId) query = query.eq("task_id", taskId);
  if (eventType) query = query.eq("event_type", eventType);
  if (source) query = query.eq("source", source);
  if (from) query = query.gte("occurred_at", from);
  if (to) query = query.lte("occurred_at", to);

  const { data, error } = await query.limit(toInt(params.limit, 50, 1, 200));
  if (error) throw error;
  return success(data ?? []);
}

async function getGoal(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  const goalId = cleanString(params.goal_id);
  if (!goalId) return fail("VALIDATION_ERROR", "goal_id is required", 400);

  const { data: goal, error: goalError } = await supabase.from("goals").select("*").eq("id", goalId).maybeSingle();
  if (goalError) throw goalError;
  if (!goal) return fail("NOT_FOUND", "Goal not found", 404);

  const { data: subjects, error: subjectsError } = await supabase
    .from("subjects")
    .select("*")
    .eq("goal_id", goalId)
    .order("updated_at", { ascending: false });
  if (subjectsError) throw subjectsError;

  const subjectIds = nonEmptyIds((subjects ?? []).map((row) => row.id as string | null | undefined));
  const issueResult = subjectIds.length
    ? await supabase.from("issues").select("*").in("subject_id", subjectIds).order("updated_at", { ascending: false })
    : { data: [] as Array<Record<string, unknown>>, error: null };
  if (issueResult.error) throw issueResult.error;

  const issues = issueResult.data ?? [];
  const issueIds = nonEmptyIds(issues.map((row) => row.id as string | null | undefined));

  const tasksFromSubjects = subjectIds.length
    ? await supabase.from("tasks").select("*").in("subject_id", subjectIds).order("updated_at", { ascending: false })
    : { data: [] as Array<Record<string, unknown>>, error: null };
  if (tasksFromSubjects.error) throw tasksFromSubjects.error;

  const tasksFromIssues = issueIds.length
    ? await supabase.from("tasks").select("*").in("issue_id", issueIds).order("updated_at", { ascending: false })
    : { data: [] as Array<Record<string, unknown>>, error: null };
  if (tasksFromIssues.error) throw tasksFromIssues.error;

  const taskIds = nonEmptyIds([
    ...tasksFromSubjects.data.map((row) => row.id as string | null | undefined),
    ...tasksFromIssues.data.map((row) => row.id as string | null | undefined),
  ]);
  const taskResult = taskIds.length
    ? await supabase.from("tasks").select("*").in("id", taskIds).order("updated_at", { ascending: false })
    : { data: [] as Array<Record<string, unknown>>, error: null };
  if (taskResult.error) throw taskResult.error;

  const eventResult = await supabase.from("events").select("*").eq("goal_id", goalId).order("occurred_at", { ascending: false });
  if (eventResult.error) throw eventResult.error;

  const subjectEvents = subjectIds.length
    ? await supabase.from("events").select("*").in("subject_id", subjectIds).order("occurred_at", { ascending: false })
    : { data: [] as Array<Record<string, unknown>>, error: null };
  if (subjectEvents.error) throw subjectEvents.error;

  const issueEvents = issueIds.length
    ? await supabase.from("events").select("*").in("issue_id", issueIds).order("occurred_at", { ascending: false })
    : { data: [] as Array<Record<string, unknown>>, error: null };
  if (issueEvents.error) throw issueEvents.error;

  const taskEvents = taskIds.length
    ? await supabase.from("events").select("*").in("task_id", taskIds).order("occurred_at", { ascending: false })
    : { data: [] as Array<Record<string, unknown>>, error: null };
  if (taskEvents.error) throw taskEvents.error;

  const eventMap = new Map<string, Record<string, unknown>>();
  for (const row of [
    ...(eventResult.data ?? []),
    ...(subjectEvents.data ?? []),
    ...(issueEvents.data ?? []),
    ...(taskEvents.data ?? []),
  ]) {
    const item = row as Record<string, unknown> & { id?: string };
    if (typeof item.id === "string") eventMap.set(item.id, item);
  }

  return success({
    goal,
    subjects: subjects ?? [],
    issues,
    tasks: taskResult.data ?? [],
    events: [...eventMap.values()].sort((a, b) => {
      const aTime = new Date(String(a.occurred_at ?? 0)).getTime();
      const bTime = new Date(String(b.occurred_at ?? 0)).getTime();
      return bTime - aTime;
    }),
  });
}

async function getSubject(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  const subjectId = cleanString(params.subject_id);
  if (!subjectId) return fail("VALIDATION_ERROR", "subject_id is required", 400);

  const { data: subject, error: subjectError } = await supabase.from("subjects").select("*").eq("id", subjectId).maybeSingle();
  if (subjectError) throw subjectError;
  if (!subject) return fail("NOT_FOUND", "Subject not found", 404);

  const { data: issues, error: issuesError } = await supabase
    .from("issues")
    .select("*")
    .eq("subject_id", subjectId)
    .order("updated_at", { ascending: false });
  if (issuesError) throw issuesError;

  const issueIds = nonEmptyIds((issues ?? []).map((row) => row.id as string | null | undefined));
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("*")
    .eq("subject_id", subjectId)
    .order("updated_at", { ascending: false });
  if (tasksError) throw tasksError;

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("*")
    .eq("subject_id", subjectId)
    .order("occurred_at", { ascending: false });
  if (eventsError) throw eventsError;

  let issueEvents: unknown[] = [];
  if (issueIds.length) {
    const { data, error } = await supabase.from("events").select("*").in("issue_id", issueIds).order("occurred_at", { ascending: false });
    if (error) throw error;
    issueEvents = data ?? [];
  }

  return success({
    subject,
    issues: issues ?? [],
    tasks: tasks ?? [],
    events: [...(events ?? []), ...issueEvents],
  });
}

async function summarizeContext(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  const goalId = cleanString(params.goal_id);
  const subjectId = cleanString(params.subject_id);

  if (subjectId) {
    const subjectResponse = await getSubject(supabase, { id: subjectId });
    if (subjectResponse.status === 200) {
      const payload = await subjectResponse.json();
      return success({
        scope: "subject",
        ...payload.data,
      });
    }
    const payload = await subjectResponse.json();
    return new Response(JSON.stringify(payload), {
      status: subjectResponse.status,
      headers: JSON_HEADERS,
    });
  }

  if (!goalId) return fail("VALIDATION_ERROR", "goal_id or subject_id is required", 400);

  const goalResponse = await getGoal(supabase, { id: goalId });
  const payload = await goalResponse.json();
  if (goalResponse.status !== 200) {
    return new Response(JSON.stringify(payload), {
      status: goalResponse.status,
      headers: JSON_HEADERS,
    });
  }

  const data = payload.data as {
    goal: Record<string, unknown>;
    subjects: Array<Record<string, unknown>>;
    issues: Array<Record<string, unknown>>;
    tasks: Array<Record<string, unknown>>;
    events: Array<Record<string, unknown>>;
  };

  const openIssues = data.issues.filter((issue) => issue.status !== "resolved" && issue.status !== "closed");
  const openTasks = data.tasks.filter((task) => task.status !== "done" && task.status !== "completed" && task.status !== "cancelled");

  return success({
    scope: "goal",
    goal: data.goal,
    subjects: data.subjects,
    open_issues: openIssues,
    open_tasks: openTasks,
    recent_events: data.events.slice(0, 10),
    counts: {
      subjects: data.subjects.length,
      issues: data.issues.length,
      open_issues: openIssues.length,
      tasks: data.tasks.length,
      open_tasks: openTasks.length,
      events: data.events.length,
    },
  });
}

const ACTIONS = new Map<string, (supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) => Promise<Response>>([
  ["list_goals", listGoals],
  ["create_goal", createGoal],
  ["get_goal", getGoal],
  ["update_goal", updateGoal],
  ["complete_goal", completeGoal],
  ["list_subjects", listSubjects],
  ["create_subject", createSubject],
  ["get_subject", getSubject],
  ["update_subject", updateSubject],
  ["list_issues", listIssues],
  ["create_issue", createIssue],
  ["update_issue", updateIssue],
  ["list_tasks", listTasks],
  ["create_task", createTask],
  ["update_task", updateTask],
  ["create_event", createEvent],
  ["list_events", listEvents],
  ["summarize_context", summarizeContext],
]);

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204, headers: JSON_HEADERS }), origin);
  }

  try {
    const apiKey = getEnv("PLANNING_API_KEY");
    const authHeader = req.headers.get("authorization") ?? "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
    const customToken =
      req.headers.get("x-planning-api-key") ??
      req.headers.get("x-api-key") ??
      req.headers.get("apikey") ??
      req.headers.get("api-key") ??
      "";

    const token = bearerToken || customToken;
    if (token !== apiKey) {
      return withCors(fail("UNAUTHORIZED", "Invalid API key", 401), origin);
    }

    if (req.method !== "POST") {
      return withCors(fail("METHOD_NOT_ALLOWED", "Only POST is supported", 405), origin);
    }

    const body = await readBody(req);
    const action = cleanString(body.action);
    if (!action) {
      return withCors(
        fail("VALIDATION_ERROR", "action is required", 400, {
          received_keys: Object.keys(body),
        }),
        origin,
      );
    }

    const params = getParams(body);
    const handler = ACTIONS.get(action);
    if (!handler) {
      return withCors(
        fail("UNKNOWN_ACTION", `Unknown action: ${action}`, 400, {
          available_actions: [...ACTIONS.keys()],
          received_keys: Object.keys(body),
        }),
        origin,
      );
    }

    const supabase = getSupabaseClient();
    const response = await handler(supabase, params);
    return withCors(response, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("JSON") ? 400 : 500;
    return withCors(fail(status === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR", message, status), origin);
  }
});
