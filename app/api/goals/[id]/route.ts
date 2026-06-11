import { NextRequest, NextResponse } from "next/server";
import { recordAppError } from "@/lib/db/app-logs";
import { requireSupabaseUser } from "@/lib/auth";
import { getGoalDetail, updateGoal, deleteGoal } from "@/lib/db/goals";

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

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const routeName = "/api/goals/[id]";
  const requestId = crypto.randomUUID();
  try {
    const { user } = await requireSupabaseUser(req);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    const updates: { title?: string; description?: string | null; status?: string } = {};

    if (typeof body.title === "string") {
      const trimmed = body.title.trim();
      if (!trimmed) {
        return NextResponse.json(
          { ok: false, error: { code: "VALIDATION_ERROR", message: "title cannot be empty" } },
          { status: 400 },
        );
      }
      updates.title = trimmed;
    }

    if ("description" in body) {
      updates.description = typeof body.description === "string" ? body.description.trim() || null : null;
    }

    if (typeof body.status === "string") {
      const s = body.status.trim();
      if (s !== "active" && s !== "inactive") {
        return NextResponse.json(
          { ok: false, error: { code: "VALIDATION_ERROR", message: "status must be active or inactive" } },
          { status: 400 },
        );
      }
      updates.status = s;
    }

    const goal = await updateGoal({ userId: user.id, goalId: id, ...updates });
    return NextResponse.json({ ok: true, data: goal, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    if (status === 500) {
      void recordAppError({
        source: "bff",
        component: "app/api/goals/[id]/route",
        operation: "PATCH",
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

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const routeName = "/api/goals/[id]";
  const requestId = crypto.randomUUID();
  try {
    const { user } = await requireSupabaseUser(req);
    const { id } = await context.params;
    await deleteGoal({ userId: user.id, goalId: id });
    return NextResponse.json({ ok: true, data: null, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    if (status === 500) {
      void recordAppError({
        source: "bff",
        component: "app/api/goals/[id]/route",
        operation: "DELETE",
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
