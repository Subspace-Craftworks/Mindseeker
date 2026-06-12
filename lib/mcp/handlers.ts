import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type JsonObject = Record<string, unknown>;

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error("Missing Supabase configuration");
  }
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

async function listGoals(supabase: SupabaseClient, params: JsonObject) {
  const userId = cleanString(params.user_id);
  if (!userId) throw new Error("user_id is required");

  let query = supabase.from("goals").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
  const status = cleanString(params.status);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.limit(toInt(params.limit, 20, 1, 100));
  if (error) throw error;
  return data ?? [];
}

async function createGoal(supabase: SupabaseClient, params: JsonObject) {
  const title = cleanString(params.title);
  const userId = cleanString(params.user_id);
  if (!title) throw new Error("title is required");
  if (!userId) throw new Error("user_id is required");

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
  return data;
}

async function updateGoal(supabase: SupabaseClient, params: JsonObject) {
  const goalId = cleanString(params.goal_id);
  const userId = cleanString(params.user_id);
  if (!goalId) throw new Error("goal_id is required");

  const patch: JsonObject = {};
  const title = cleanString(params.title);
  const description = params.description === undefined ? undefined : cleanString(params.description);
  const status = cleanString(params.status);

  if (title) patch.title = title;
  if (description !== undefined) patch.description = description;
  if (status) patch.status = status;

  if (Object.keys(patch).length === 0) {
    throw new Error("At least one field must be provided");
  }

  const { data, error } = await supabase
    .from("goals")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", goalId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Goal not found");
  return data;
}

async function completeGoal(supabase: SupabaseClient, params: JsonObject) {
  const goalId = cleanString(params.goal_id);
  const userId = cleanString(params.user_id);
  if (!goalId) throw new Error("goal_id is required");
  if (!userId) throw new Error("user_id is required");

  const { data: goal, error: goalError } = await supabase.from("goals").select("*").eq("id", goalId).eq("user_id", userId).maybeSingle();
  if (goalError) throw goalError;
  if (!goal) throw new Error("Goal not found");

  const { data: updatedGoal, error: updateError } = await supabase
    .from("goals")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", goalId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updatedGoal) throw new Error("Goal not found during update");

  const occurredAt = cleanString(params.occurred_at);
  if (occurredAt && Number.isNaN(Date.parse(occurredAt))) {
    throw new Error("occurred_at must be a valid date-time string");
  }

  const completionReason = cleanString(params.reason) ?? cleanString(params.note) ?? cleanString(params.body);
  const title = cleanString(params.event_title) ?? `Goal completed: ${String(goal.title ?? "goal")}`;
  const body = completionReason ?? `Goal "${String(goal.title ?? goalId)}" was marked inactive.`;
  const source = cleanString(params.source) ?? "mcp-api";

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

  return { goal: updatedGoal, event };
}

async function listSubjects(supabase: SupabaseClient, params: JsonObject) {
  const userId = cleanString(params.user_id);
  if (!userId) throw new Error("user_id is required");

  let query = supabase.from("subjects").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
  const goalId = cleanString(params.goal_id);
  const status = cleanString(params.status);
  const priority = cleanString(params.priority);
  if (goalId) query = query.eq("goal_id", goalId);
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  const { data, error } = await query.limit(toInt(params.limit, 20, 1, 100));
  if (error) throw error;
  return data ?? [];
}

async function createSubject(supabase: SupabaseClient, params: JsonObject) {
  const goalId = cleanString(params.goal_id);
  const title = cleanString(params.title);
  const userId = cleanString(params.user_id);
  if (!goalId) throw new Error("goal_id is required");
  if (!title) throw new Error("title is required");
  if (!userId) throw new Error("user_id is required");

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
  return data;
}

async function updateSubject(supabase: SupabaseClient, params: JsonObject) {
  const subjectId = cleanString(params.subject_id);
  const userId = cleanString(params.user_id);
  if (!subjectId) throw new Error("subject_id is required");

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
    throw new Error("At least one field must be provided");
  }

  const { data, error } = await supabase
    .from("subjects")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", subjectId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Subject not found");
  return data;
}

async function listIssues(supabase: SupabaseClient, params: JsonObject) {
  const userId = cleanString(params.user_id);
  if (!userId) throw new Error("user_id is required");

  let query = supabase.from("issues").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
  const goalId = cleanString(params.goal_id);
  const subjectId = cleanString(params.subject_id);
  const status = cleanString(params.status);
  const severity = cleanString(params.severity);
  if (subjectId) query = query.eq("subject_id", subjectId);
  if (status) query = query.eq("status", status);
  if (severity) query = query.eq("severity", severity);
  if (goalId) {
    const subjectIdsResult = await supabase.from("subjects").select("id").eq("user_id", userId).eq("goal_id", goalId);
    if (subjectIdsResult.error) throw subjectIdsResult.error;
    const subjectIds = (subjectIdsResult.data ?? []).map((row) => row.id).filter(Boolean);
    query = subjectIds.length > 0 ? query.in("subject_id", subjectIds) : query.eq("subject_id", "__none__");
  }
  const { data, error } = await query.limit(toInt(params.limit, 20, 1, 100));
  if (error) throw error;
  return data ?? [];
}

async function createIssue(supabase: SupabaseClient, params: JsonObject) {
  const subjectId = cleanString(params.subject_id);
  const title = cleanString(params.title);
  const userId = cleanString(params.user_id);
  if (!subjectId) throw new Error("subject_id is required");
  if (!title) throw new Error("title is required");
  if (!userId) throw new Error("user_id is required");

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
  return data;
}

async function updateIssue(supabase: SupabaseClient, params: JsonObject) {
  const issueId = cleanString(params.issue_id);
  const userId = cleanString(params.user_id);
  if (!issueId) throw new Error("issue_id is required");

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
    throw new Error("At least one field must be provided");
  }

  const { data, error } = await supabase
    .from("issues")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", issueId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Issue not found");
  return data;
}

async function listTasks(supabase: SupabaseClient, params: JsonObject) {
  const userId = cleanString(params.user_id);
  if (!userId) throw new Error("user_id is required");

  let query = supabase.from("tasks").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
  const goalId = cleanString(params.goal_id);
  const subjectId = cleanString(params.subject_id);
  const issueId = cleanString(params.issue_id);
  const status = cleanString(params.status);
  if (subjectId) query = query.eq("subject_id", subjectId);
  if (issueId) query = query.eq("issue_id", issueId);
  if (status) query = query.eq("status", status);
  if (goalId) {
    const subjectIdsResult = await supabase.from("subjects").select("id").eq("user_id", userId).eq("goal_id", goalId);
    if (subjectIdsResult.error) throw subjectIdsResult.error;
    const subjectIds = (subjectIdsResult.data ?? []).map((row) => row.id).filter(Boolean);
    query = subjectIds.length > 0 ? query.in("subject_id", subjectIds) : query.eq("subject_id", "__none__");
  }
  const { data, error } = await query.limit(toInt(params.limit, 20, 1, 100));
  if (error) throw error;
  return data ?? [];
}

async function createTask(supabase: SupabaseClient, params: JsonObject) {
  const subjectId = cleanString(params.subject_id);
  const title = cleanString(params.title);
  const userId = cleanString(params.user_id);
  if (!subjectId) throw new Error("subject_id is required");
  if (!title) throw new Error("title is required");
  if (!userId) throw new Error("user_id is required");

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
  return data;
}

async function updateTask(supabase: SupabaseClient, params: JsonObject) {
  const taskId = cleanString(params.task_id);
  const userId = cleanString(params.user_id);
  if (!taskId) throw new Error("task_id is required");

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
    throw new Error("At least one field must be provided");
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Task not found");
  return data;
}

async function createEvent(supabase: SupabaseClient, params: JsonObject) {
  const eventType = cleanString(params.event_type);
  const title = cleanString(params.title);
  const userId = cleanString(params.user_id);
  if (!eventType) throw new Error("event_type is required");
  if (!title) throw new Error("title is required");
  if (!userId) throw new Error("user_id is required");

  const occurredAt = cleanString(params.occurred_at);
  if (occurredAt && Number.isNaN(Date.parse(occurredAt))) {
    throw new Error("occurred_at must be a valid date-time string");
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
      source: cleanString(params.source) ?? "mcp-api",
      occurred_at: occurredAt ?? new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function listEvents(supabase: SupabaseClient, params: JsonObject) {
  const userId = cleanString(params.user_id);
  if (!userId) throw new Error("user_id is required");

  let query = supabase.from("events").select("*").eq("user_id", userId).order("occurred_at", { ascending: false });
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
  return data ?? [];
}

async function getGoal(supabase: SupabaseClient, params: JsonObject) {
  const goalId = cleanString(params.goal_id);
  const userId = cleanString(params.user_id);
  if (!goalId) throw new Error("goal_id is required");

  const { data: goal, error: goalError } = await supabase.from("goals").select("*").eq("id", goalId).eq("user_id", userId).maybeSingle();
  if (goalError) throw goalError;
  if (!goal) throw new Error("Goal not found");

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

  return {
    goal,
    subjects: subjects ?? [],
    issues,
    tasks: taskResult.data ?? [],
    events: [...eventMap.values()].sort((a, b) => {
      const aTime = new Date(String(a.occurred_at ?? 0)).getTime();
      const bTime = new Date(String(b.occurred_at ?? 0)).getTime();
      return bTime - aTime;
    }),
  };
}

async function getSubject(supabase: SupabaseClient, params: JsonObject) {
  const subjectId = cleanString(params.subject_id);
  const userId = cleanString(params.user_id);
  if (!subjectId) throw new Error("subject_id is required");

  const { data: subject, error: subjectError } = await supabase.from("subjects").select("*").eq("id", subjectId).eq("user_id", userId).maybeSingle();
  if (subjectError) throw subjectError;
  if (!subject) throw new Error("Subject not found");

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

  return {
    subject,
    issues: issues ?? [],
    tasks: tasks ?? [],
    events: [...(events ?? []), ...issueEvents],
  };
}

async function summarizeContext(supabase: SupabaseClient, params: JsonObject) {
  const goalId = cleanString(params.goal_id);
  const subjectId = cleanString(params.subject_id);

  if (subjectId) {
    const payload = await getSubject(supabase, { subject_id: subjectId, user_id: params.user_id });
    return {
      scope: "subject",
      ...payload,
    };
  }

  if (!goalId) throw new Error("goal_id or subject_id is required");

  const payload = await getGoal(supabase, { goal_id: goalId, user_id: params.user_id });
  const openIssues = payload.issues.filter((issue: any) => issue.status !== "resolved" && issue.status !== "closed");
  const openTasks = payload.tasks.filter((task: any) => task.status !== "done" && task.status !== "completed" && task.status !== "cancelled");

  return {
    scope: "goal",
    goal: payload.goal,
    subjects: payload.subjects,
    open_issues: openIssues,
    open_tasks: openTasks,
    recent_events: payload.events.slice(0, 10),
    counts: {
      subjects: payload.subjects.length,
      issues: payload.issues.length,
      open_issues: openIssues.length,
      tasks: payload.tasks.length,
      open_tasks: openTasks.length,
      events: payload.events.length,
    },
  };
}

const TOOL_HANDLERS = new Map<string, (supabase: SupabaseClient, params: JsonObject) => Promise<any>>([
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

export async function executeTool(name: string, args: JsonObject, userId: string): Promise<any> {
  const handler = TOOL_HANDLERS.get(name);
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  
  const supabase = getSupabaseClient();
  // Inject userId into params
  const params = { ...args, user_id: userId };
  return handler(supabase, params);
}

export async function getGoalContextText(goalId: string, userId: string): Promise<string> {
  const supabase = getSupabaseClient();
  try {
    const payload = await summarizeContext(supabase, { goal_id: goalId, user_id: userId });
    
    let text = `Goal [ID: ${payload.goal.id}]: ${payload.goal.title}\n`;
    if (payload.goal.description) text += `Description: ${payload.goal.description}\n`;
    text += `Status: ${payload.goal.status}\n\n`;

    if (payload.subjects.length > 0) {
      text += `[Subjects]\n`;
      for (const sub of payload.subjects) {
        text += `- [ID: ${sub.id}] ${sub.title} (${sub.status})\n`;
      }
      text += `\n`;
    }

    if (payload.open_issues.length > 0) {
      text += `[Open Issues]\n`;
      for (const issue of payload.open_issues) {
        text += `- [ID: ${issue.id}] ${issue.title} (${issue.severity})\n`;
      }
      text += `\n`;
    }

    if (payload.open_tasks.length > 0) {
      text += `[Open Tasks]\n`;
      for (const task of payload.open_tasks) {
        text += `- [ID: ${task.id}] ${task.title} (${task.status})\n`;
      }
      text += `\n`;
    }

    if (payload.recent_events.length > 0) {
      text += `[Recent Events]\n`;
      for (const ev of payload.recent_events) {
        text += `- [ID: ${ev.id}] ${ev.title}\n`;
      }
    }

    return text.trim();
  } catch (err) {
    console.error("Failed to get goal context:", err);
    return "";
  }
}
