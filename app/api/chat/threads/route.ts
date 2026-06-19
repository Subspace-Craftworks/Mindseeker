import { NextRequest, NextResponse } from "next/server";
import { recordAppError } from "@/lib/db/app-logs";
import { requireSupabaseUser } from "@/lib/auth";
import { listChatThreads } from "@/lib/db/chat-threads";
import { listSessionsByUser } from "@/lib/db/sessions";

export async function GET(req: NextRequest) {
  const routeName = "/api/chat/threads";
  const requestId = crypto.randomUUID();
  try {
    const { user } = await requireSupabaseUser(req);
    const threads = await listChatThreads(user.id);

    // Enrich threads with current_goal_id from sessions table
    const sessions = await listSessionsByUser(user.id);
    const sessionByConv = new Map(
      sessions.filter(s => s.dify_conversation_id).map(s => [s.dify_conversation_id!, s])
    );
    const enriched = threads.map(t => {
      const session = sessionByConv.get(t.dify_conversation_id);
      return {
        ...t,
        current_goal_id: session?.current_goal_id ?? t.current_goal_id ?? null,
      };
    });

    return NextResponse.json({ ok: true, data: enriched, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    if (status === 500) {
      void recordAppError({
        source: "bff",
        component: "app/api/chat/threads/route",
        operation: "GET",
        route: routeName,
        requestId,
        message,
        details: error,
        appKey: "mindseeker",
      });
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR",
          message,
        },
      },
      { status },
    );
  }
}
