import { NextRequest, NextResponse } from "next/server";
import { recordAppError } from "@/lib/db/app-logs";
import { requireSupabaseUser } from "@/lib/auth";
import { createGoal, listGoals } from "@/lib/db/goals";

export async function GET(req: NextRequest) {
  const routeName = "/api/goals";
  const requestId = crypto.randomUUID();
  try {
    const { user } = await requireSupabaseUser(req);
    const goals = await listGoals(user.id);
    return NextResponse.json({ ok: true, data: goals, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    if (status === 500) {
      void recordAppError({
        source: "bff",
        component: "app/api/goals/route",
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

export async function POST(req: NextRequest) {
  const routeName = "/api/goals";
  const requestId = crypto.randomUUID();
  try {
    const { user } = await requireSupabaseUser(req);
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const background = typeof body.background === "string" ? body.background.trim() : null;
    const status = typeof body.status === "string" ? body.status.trim() : null;

    if (!title) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "title is required" } },
        { status: 400 },
      );
    }

    const goal = await createGoal({
      userId: user.id,
      title,
      description: description || null,
      background: background || null,
      status: status || null,
    });

    return NextResponse.json({ ok: true, data: goal, error: null }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    if (status === 500) {
      void recordAppError({
        source: "bff",
        component: "app/api/goals/route",
        operation: "POST",
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
