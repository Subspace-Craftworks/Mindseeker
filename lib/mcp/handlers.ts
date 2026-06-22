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
      background: cleanString(params.background),
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
  const background = params.background === undefined ? undefined : cleanString(params.background);
  const status = cleanString(params.status);

  if (title) patch.title = title;
  if (description !== undefined) patch.description = description;
  if (background !== undefined) patch.background = background;
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

async function bulkAddGoalData(supabase: SupabaseClient, params: JsonObject) {
  const goalId = cleanString(params.goal_id);
  const userId = cleanString(params.user_id);
  if (!goalId) throw new Error("goal_id is required");
  if (!userId) throw new Error("user_id is required");

  // Verify ownership
  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("user_id", userId)
    .single();

  if (goalError || !goal) throw new Error("Goal not found or access denied");

  // 1. Update goal if goal_update is provided
  if (params.goal_update && typeof params.goal_update === "object") {
    const updateData: any = {};
    const updates = params.goal_update as JsonObject;
    if (typeof updates.title === "string") updateData.title = updates.title;
    if (typeof updates.description === "string") updateData.description = updates.description;
    if (typeof updates.background === "string") updateData.background = updates.background;
    if (typeof updates.status === "string") updateData.status = updates.status;

    if (Object.keys(updateData).length > 0) {
      await supabase.from("goals").update(updateData).eq("id", goalId).eq("user_id", userId);
    }
  }

  const results = {
    subjects_created: 0,
    issues_created: 0,
    tasks_created: 0
  };

  // 2. Insert Subjects and nested Items
  if (Array.isArray(params.subjects)) {
    for (const sub of params.subjects) {
      if (typeof sub.title !== "string") continue;
      const { data: subjectData } = await supabase
        .from("subjects")
        .insert({
          goal_id: goalId,
          user_id: userId,
          title: sub.title,
          description: sub.description || null,
          status: sub.status || "active"
        })
        .select("id")
        .single();
      
      if (!subjectData) continue;
      results.subjects_created++;

      if (Array.isArray(sub.issues)) {
        for (const iss of sub.issues) {
          if (typeof iss.title !== "string") continue;
          const { data: issueData } = await supabase
            .from("issues")
            .insert({
              goal_id: goalId,
              subject_id: subjectData.id,
              user_id: userId,
              title: iss.title,
              description: iss.description || null,
              severity: iss.severity || "medium",
              status: iss.status || "open"
            })
            .select("id")
            .single();

          if (!issueData) continue;
          results.issues_created++;

          if (Array.isArray(iss.tasks)) {
            for (const tsk of iss.tasks) {
              if (typeof tsk.title !== "string") continue;
              await supabase.from("tasks").insert({
                goal_id: goalId,
                subject_id: subjectData.id,
                issue_id: issueData.id,
                user_id: userId,
                title: tsk.title,
                description: tsk.description || null,
                status: tsk.status || "todo"
              });
              results.tasks_created++;
            }
          }
        }
      }
    }
  }

  // 3. Insert Unassigned Issues
  if (Array.isArray(params.unassigned_issues)) {
    for (const iss of params.unassigned_issues) {
      if (typeof iss.title !== "string") continue;
      const { data: issueData } = await supabase
        .from("issues")
        .insert({
          goal_id: goalId,
          user_id: userId,
          title: iss.title,
          description: iss.description || null,
          severity: iss.severity || "medium",
          status: iss.status || "open"
        })
        .select("id")
        .single();

      if (!issueData) continue;
      results.issues_created++;

      if (Array.isArray(iss.tasks)) {
        for (const tsk of iss.tasks) {
          if (typeof tsk.title !== "string") continue;
          await supabase.from("tasks").insert({
            goal_id: goalId,
            issue_id: issueData.id,
            user_id: userId,
            title: tsk.title,
            description: tsk.description || null,
            status: tsk.status || "todo"
          });
          results.tasks_created++;
        }
      }
    }
  }

  // 4. Insert Unassigned Tasks
  if (Array.isArray(params.unassigned_tasks)) {
    for (const tsk of params.unassigned_tasks) {
      if (typeof tsk.title !== "string") continue;
      await supabase.from("tasks").insert({
        goal_id: goalId,
        user_id: userId,
        title: tsk.title,
        description: tsk.description || null,
        status: tsk.status || "todo"
      });
      results.tasks_created++;
    }
  }

  return { success: true, results };
}

async function listArtifacts(supabase: SupabaseClient, params: JsonObject) {
  const userId = cleanString(params.user_id);
  if (!userId) throw new Error("user_id is required");

  let query = supabase.from("artifacts").select("id, goal_id, title, created_at, updated_at").eq("user_id", userId).order("updated_at", { ascending: false });
  const goalId = cleanString(params.goal_id);
  if (goalId) query = query.eq("goal_id", goalId);
  const { data, error } = await query.limit(toInt(params.limit, 20, 1, 100));
  if (error) throw error;
  return data ?? [];
}

async function getArtifact(supabase: SupabaseClient, params: JsonObject) {
  const artifactId = cleanString(params.artifact_id);
  const userId = cleanString(params.user_id);
  if (!artifactId) throw new Error("artifact_id is required");

  const { data, error } = await supabase.from("artifacts").select("*").eq("id", artifactId).eq("user_id", userId).single();
  if (error) throw error;
  return data;
}

async function createArtifact(supabase: SupabaseClient, params: JsonObject) {
  const goalId = cleanString(params.goal_id);
  const title = cleanString(params.title);
  const content = cleanString(params.content);
  const userId = cleanString(params.user_id);

  if (!goalId) throw new Error("goal_id is required");
  if (!title) throw new Error("title is required");
  if (!content) throw new Error("content is required");
  if (!userId) throw new Error("user_id is required");

  const { data, error } = await supabase.from("artifacts").insert({
    user_id: userId,
    goal_id: goalId,
    title,
    content
  }).select("*").single();

  if (error) throw error;
  return data;
}

async function updateArtifact(supabase: SupabaseClient, params: JsonObject) {
  const artifactId = cleanString(params.artifact_id);
  const userId = cleanString(params.user_id);
  if (!artifactId) throw new Error("artifact_id is required");

  const patch: any = {};
  const title = cleanString(params.title);
  const content = cleanString(params.content);
  
  if (title) patch.title = title;
  if (content) patch.content = content;

  if (Object.keys(patch).length === 0) throw new Error("At least one field to update is required");

  const { data, error } = await supabase.from("artifacts").update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", artifactId).eq("user_id", userId).select("*").single();

  if (error) throw error;
  return data;
}

async function deleteArtifact(supabase: SupabaseClient, params: JsonObject) {
  const artifactId = cleanString(params.artifact_id);
  const userId = cleanString(params.user_id);
  if (!artifactId) throw new Error("artifact_id is required");

  const { error } = await supabase.from("artifacts").delete().eq("id", artifactId).eq("user_id", userId);
  if (error) throw error;
  return { success: true };
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
  ["bulk_add_goal_data", bulkAddGoalData],
  ["list_artifacts", listArtifacts],
  ["get_artifact", getArtifact],
  ["create_artifact", createArtifact],
  ["update_artifact", updateArtifact],
  ["delete_artifact", deleteArtifact],
]);

// Tools that should set sessions.current_goal_id to the result goal ID
const SESSION_GOAL_FOCUS_TOOLS = new Set(["create_goal", "update_goal", "get_goal"]);
// Tools that should clear sessions.current_goal_id
const SESSION_GOAL_CLEAR_TOOLS = new Set(["complete_goal"]);

export async function executeTool(name: string, args: JsonObject, userId: string): Promise<any> {
  const handler = TOOL_HANDLERS.get(name);
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  const supabase = getSupabaseClient();
  // Extract session_id from args (not passed to handler)
  const { session_id, ...restArgs } = args as { session_id?: string } & JsonObject;

  // Resolve actual user_id: if session_id is provided, use the session's user_id
  // This ensures multi-user correctness when Dify (single OAuth token) calls on behalf of different users
  let resolvedUserId = userId;
  if (session_id && typeof session_id === "string") {
    try {
      const { data: session } = await supabase
        .from("sessions")
        .select("user_id")
        .eq("id", session_id)
        .maybeSingle();
      if (session?.user_id) {
        resolvedUserId = session.user_id;
      }
    } catch (err) {
      console.error("Failed to resolve user_id from session:", err);
    }
  }

  // Check goal limit for create_goal
  if (name === "create_goal") {
    const { checkGoalLimit } = await import("@/lib/db/rate-limit");
    const limitResult = await checkGoalLimit(resolvedUserId);
    if (!limitResult.allowed) {
      throw new Error(limitResult.reason ?? "Goal limit reached");
    }
  }

  // Inject resolvedUserId into params
  const params = { ...restArgs, user_id: resolvedUserId };
  const result = await handler(supabase, params);

  // Auto-update sessions.current_goal_id when session_id is provided
  if (session_id && typeof session_id === "string") {
    try {
      const { updateSessionGoal } = await import("@/lib/db/sessions");
      if (SESSION_GOAL_FOCUS_TOOLS.has(name)) {
        const goalId = result?.id ?? result?.goal?.id;
        if (goalId) {
          await updateSessionGoal(session_id, goalId);
        }
      } else if (SESSION_GOAL_CLEAR_TOOLS.has(name)) {
        await updateSessionGoal(session_id, null);
      }
    } catch (err) {
      console.error("Failed to update session goal:", err);
      // Session update failure should not break tool execution
    }
  }

  return result;
}

// Allowed actions in sendPayload
const PAYLOAD_ALLOWED_ACTIONS = new Set([
  "create_goal", "update_goal",
  "create_subject", "update_subject",
  "create_issue", "update_issue",
  "create_task", "update_task",
]);

type PayloadOperation = {
  action: string;
  ref?: string;
  params: Record<string, unknown>;
};

type PayloadResult = {
  ref: string | null;
  action: string;
  ok: boolean;
  data?: unknown;
  error?: string;
};

/**
 * Resolves $ref.field placeholders in params using previous results.
 */
function resolveRefs(params: Record<string, unknown>, refMap: Map<string, Record<string, unknown>>): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.startsWith("$")) {
      const match = value.match(/^\$(\w+)\.(\w+)$/);
      if (match) {
        const [, refName, field] = match;
        const refData = refMap.get(refName);
        if (refData && field in refData) {
          resolved[key] = refData[field];
          continue;
        }
      }
    }
    resolved[key] = value;
  }
  return resolved;
}

/**
 * Execute multiple operations in sequence. Stops on first failure.
 * Supports $ref.field placeholders to reference results from previous operations.
 */
export async function sendPayload(args: JsonObject, userId: string): Promise<{ success: boolean; results: PayloadResult[] }> {
  const sessionId = typeof args.session_id === "string" ? args.session_id : undefined;
  const operations = Array.isArray(args.operations) ? args.operations as PayloadOperation[] : [];

  if (operations.length === 0) {
    return { success: false, results: [{ ref: null, action: "", ok: false, error: "No operations provided" }] };
  }

  // Resolve user_id from session
  const supabase = getSupabaseClient();
  let resolvedUserId = userId;
  if (sessionId) {
    try {
      const { data: session } = await supabase
        .from("sessions")
        .select("user_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (session?.user_id) {
        resolvedUserId = session.user_id;
      }
    } catch (err) {
      console.error("Failed to resolve user_id from session in sendPayload:", err);
    }
  }

  const results: PayloadResult[] = [];
  const refMap = new Map<string, Record<string, unknown>>();

  for (const op of operations) {
    if (!PAYLOAD_ALLOWED_ACTIONS.has(op.action)) {
      results.push({ ref: op.ref ?? null, action: op.action, ok: false, error: `Action not allowed: ${op.action}` });
      return { success: false, results };
    }

    const handler = TOOL_HANDLERS.get(op.action);
    if (!handler) {
      results.push({ ref: op.ref ?? null, action: op.action, ok: false, error: `Unknown action: ${op.action}` });
      return { success: false, results };
    }

    // Check goal limit for create_goal
    if (op.action === "create_goal") {
      try {
        const { checkGoalLimit } = await import("@/lib/db/rate-limit");
        const limitResult = await checkGoalLimit(resolvedUserId);
        if (!limitResult.allowed) {
          results.push({ ref: op.ref ?? null, action: op.action, ok: false, error: limitResult.reason ?? "Goal limit reached" });
          return { success: false, results };
        }
      } catch (err) {
        results.push({ ref: op.ref ?? null, action: op.action, ok: false, error: "Failed to check goal limit" });
        return { success: false, results };
      }
    }

    // Resolve $ref placeholders
    const resolvedParams = resolveRefs(op.params ?? {}, refMap);
    const params = { ...resolvedParams, user_id: resolvedUserId };

    try {
      const result = await handler(supabase, params);
      const data = result as Record<string, unknown>;
      results.push({ ref: op.ref ?? null, action: op.action, ok: true, data });

      // Store result in refMap for future reference
      if (op.ref) {
        refMap.set(op.ref, data);
      }

      // Auto-update session current_goal_id
      if (sessionId) {
        try {
          const { updateSessionGoal } = await import("@/lib/db/sessions");
          if (SESSION_GOAL_FOCUS_TOOLS.has(op.action)) {
            const goalId = data?.id ?? (data as any)?.goal?.id;
            if (goalId) {
              await updateSessionGoal(sessionId, String(goalId));
            }
          } else if (SESSION_GOAL_CLEAR_TOOLS.has(op.action)) {
            await updateSessionGoal(sessionId, null);
          }
        } catch {
          // Session update failure is non-fatal
        }
      }
    } catch (err) {
      results.push({ ref: op.ref ?? null, action: op.action, ok: false, error: err instanceof Error ? err.message : "Unknown error" });
      return { success: false, results };
    }
  }

  return { success: true, results };
}

export async function getGoalContextText(goalId: string, userId: string): Promise<string> {
  const supabase = getSupabaseClient();
  try {
    const { data: payload, error } = await supabase.rpc('get_goal_context', {
      p_goal_id: goalId,
      p_user_id: userId,
    });

    if (error) throw error;
    if (!payload || !payload.goal) return "";

    let text = `[Goal]\n`;
    text += `title: ${payload.goal.title}\n`;
    if (payload.goal.description) text += `description: ${payload.goal.description}\n`;
    text += `status: ${payload.goal.status}\n\n`;

    if (payload.subjects && payload.subjects.length > 0) {
      text += `[Subjects]\n`;
      for (const sub of payload.subjects) {
        text += `- subject_id=${sub.id} ${sub.title} (${sub.status})\n`;
      }
      text += `\n`;
    }

    if (payload.open_issues && payload.open_issues.length > 0) {
      text += `[Open Issues]\n`;
      for (const issue of payload.open_issues) {
        text += `- issue_id=${issue.id} ${issue.title} (${issue.severity})\n`;
      }
      text += `\n`;
    }

    if (payload.open_tasks && payload.open_tasks.length > 0) {
      text += `[Open Tasks]\n`;
      for (const task of payload.open_tasks) {
        text += `- task_id=${task.id} ${task.title} (${task.status})\n`;
      }
      text += `\n`;
    }

    if (payload.recent_events && payload.recent_events.length > 0) {
      text += `[Recent Events]\n`;
      for (const ev of payload.recent_events) {
        text += `- event_id=${ev.id} ${ev.title}\n`;
      }
    }

    return text.trim();
  } catch (err) {
    console.error("Failed to get goal context:", err);
    return "";
  }
}
