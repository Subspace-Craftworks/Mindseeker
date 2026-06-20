import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

type AppLogInput = {
  level?: "error" | "warn" | "info";
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

let adminClient: ReturnType<typeof createClient> | null = null;

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getSupabaseClient() {
  if (!adminClient) {
    const url = getEnv("SUPABASE_URL");
    const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    adminClient = createClient(url, serviceRole, {
      auth: { persistSession: false },
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
  const client = getSupabaseClient();
  const { error } = await client.from("application_logs").insert({
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
  });

  if (error) {
    console.error("[app-logs] failed to write log row", {
      message: input.message,
      error,
    });
    return { ok: false as const, error };
  }

  return { ok: true as const };
}

export async function recordAppError(input: Omit<AppLogInput, "level">) {
  return recordAppLog({ ...input, level: "error" });
}
