import { NextRequest, NextResponse } from "next/server";
import { recordAppError } from "@/lib/app-logs";
import { requireSupabaseUser } from "@/lib/auth";
import { getContextMap } from "@/lib/context-map";

export async function GET(req: NextRequest) {
  const routeName = "/api/context-map";
  const requestId = crypto.randomUUID();
  try {
    const { user } = await requireSupabaseUser(req);
    const threadId = req.nextUrl.searchParams.get("thread_id");
    const contextMap = await getContextMap(user.id, threadId);
    return NextResponse.json({ ok: true, data: contextMap, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    if (status === 500) {
      void recordAppError({
        source: "bff",
        component: "app/api/context-map/route",
        operation: "GET",
        route: routeName,
        requestId,
        message,
        details: error,
        appKey: "mindseeker",
      });
    }
    return NextResponse.json(
      { ok: false, error: { code: status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR", message } },
      { status },
    );
  }
}
