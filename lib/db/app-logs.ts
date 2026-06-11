import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseUrl, getSupabaseServiceRoleKey } from "@/lib/utils/env";

export type AppLogLevel = "error" | "warn" | "info";

export type AppLogInput = {
  level?: AppLogLevel;
  source: string;
  component: string;
  operation?: string;
  route?: string;
  message: string;
  details?: unknown;
  userId?: string | null;
  conversationId?: string | null;
  requestId?: string | null;
  executionId?: string | null;
  statusCode?: number | null;
  errorCode?: string | null;
  stack?: string | null;
  appKey?: string;
};

let adminClient:
  | ReturnType<typeof createClient>
  | null = null;

function getAdminClient() {
  if (!adminClient) {
    adminClient = createClient(getPublicSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return adminClient;
}

function safeDetails(details: unknown) {
  if (details === undefined) {
    return {};
  }

  if (details instanceof Error) {
    return {
      name: details.name,
      message: details.message,
      stack: details.stack ?? null,
    };
  }

  if (typeof details === "object" && details !== null) {
    return details;
  }

  return { value: String(details) };
}

export async function recordAppLog(input: AppLogInput) {
  const client = getAdminClient();
  const row = {
    level: input.level ?? "error",
    source: input.source,
    component: input.component,
    operation: input.operation ?? null,
    route: input.route ?? null,
    message: input.message,
    details: safeDetails(input.details),
    user_id: input.userId ?? null,
    conversation_id: input.conversationId ?? null,
    request_id: input.requestId ?? null,
    execution_id: input.executionId ?? null,
    status_code: input.statusCode ?? null,
    error_code: input.errorCode ?? null,
    stack: input.stack ?? null,
    app_key: input.appKey ?? "mindseeker",
  };

  const { error } = await (client.from("application_logs") as any).insert(row);

  if (error) {
    console.error("[app-logs] failed to write log row", {
      message: input.message,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
    });
    return { ok: false as const, error };
  }

  return { ok: true as const };
}

export async function recordAppError(input: Omit<AppLogInput, "level">) {
  return recordAppLog({ ...input, level: "error" });
}
