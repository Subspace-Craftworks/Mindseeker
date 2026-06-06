import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/auth";
import { createGoal, listGoals } from "@/lib/goals";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireSupabaseUser(req);
    const goals = await listGoals(user.id);
    return NextResponse.json({ ok: true, data: goals, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    return NextResponse.json(
      { ok: false, error: { code: status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR", message } },
      { status },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSupabaseUser(req);
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;
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
      status: status || null,
    });

    return NextResponse.json({ ok: true, data: goal, error: null }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    return NextResponse.json(
      { ok: false, error: { code: status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR", message } },
      { status },
    );
  }
}

