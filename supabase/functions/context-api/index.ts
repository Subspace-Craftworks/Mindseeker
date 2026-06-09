import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { recordAppError } from "../_shared/app-logs.ts";

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

async function setCurrentGoal(supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) {
  const conversationId = cleanString(params.conversation_id);
  if (!conversationId) return fail("VALIDATION_ERROR", "conversation_id is required", 400);

  const goalIdRaw = params.goal_id;
  const goalId = cleanString(goalIdRaw);

  if (goalId) {
    const goalResult = await supabase.from("goals").select("id").eq("id", goalId).maybeSingle();
    if (goalResult.error) throw goalResult.error;
    if (!goalResult.data) return fail("NOT_FOUND", "Goal not found", 404);
  } else if (goalIdRaw !== undefined && goalIdRaw !== null && String(goalIdRaw).trim().length > 0 && !goalId) {
    return fail("VALIDATION_ERROR", "goal_id must be a valid string or omitted", 400);
  }

  const { data, error } = await supabase
    .from("chat_threads")
    .update({
      current_goal_id: goalId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("dify_conversation_id", conversationId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) return fail("NOT_FOUND", "Chat thread not found", 404);

  return success(data);
}

const ACTIONS = new Map<string, (supabase: ReturnType<typeof getSupabaseClient>, params: JsonObject) => Promise<Response>>([
  ["set_current_goal", setCurrentGoal],
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

    const params = body.params && typeof body.params === "object" && !Array.isArray(body.params) ? (body.params as JsonObject) : {};
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
    void recordAppError({
      source: "edge-function",
      component: "supabase/functions/context-api",
      operation: "unknown",
      route: "/functions/v1/context-api",
      requestId: crypto.randomUUID(),
      message,
      details: error,
      statusCode: status,
      errorCode: status === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR",
      executionId: req.headers.get("x-supabase-execution-id"),
      appKey: "mindseeker",
    });
    return withCors(fail(status === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR", message, status), origin);
  }
});
