import { NextRequest, NextResponse } from "next/server";
import { recordAppError } from "@/lib/app-logs";
import { requireSupabaseUser } from "@/lib/auth";
import { getGoalDetail } from "@/lib/goals";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const routeName = "/api/goals/[id]";
  const requestId = crypto.randomUUID();
  try {
    const { user } = await requireSupabaseUser(req);
    const { id } = await context.params;
    const detail = await getGoalDetail({ userId: user.id, goalId: id });

    if (!detail) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, data: detail, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    if (status === 500) {
      void recordAppError({
        source: "bff",
        component: "app/api/goals/[id]/route",
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
