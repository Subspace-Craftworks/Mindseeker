import { NextRequest, NextResponse } from "next/server";
import { recordAppError } from "@/lib/db/app-logs";
import { requireSupabaseUser } from "@/lib/auth";
import { createArtifact } from "@/lib/db/artifacts";

export async function POST(req: NextRequest) {
  const routeName = "/api/artifacts";
  const requestId = crypto.randomUUID();
  try {
    const { user } = await requireSupabaseUser(req);
    const body = await req.json().catch(() => ({}));
    const goalId = typeof body.goal_id === "string" ? body.goal_id.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content : "";

    if (!goalId || !title || !content) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "goal_id, title, and content are required" } },
        { status: 400 },
      );
    }

    const artifact = await createArtifact({
      userId: user.id,
      goalId,
      title,
      content,
    });

    return NextResponse.json({ ok: true, data: artifact, error: null }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    if (status === 500) {
      void recordAppError({
        source: "bff",
        component: "app/api/artifacts/route",
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
