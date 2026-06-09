import { NextRequest, NextResponse } from "next/server";
import { recordAppError } from "@/lib/app-logs";
import { requireSupabaseUser } from "@/lib/auth";
import { listChatThreads } from "@/lib/chat-threads";

export async function GET(req: NextRequest) {
  const routeName = "/api/chat/threads";
  const requestId = crypto.randomUUID();
  try {
    const { user } = await requireSupabaseUser(req);
    const threads = await listChatThreads(user.id);
    return NextResponse.json({ ok: true, data: threads, error: null });
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
