import { NextRequest, NextResponse } from "next/server";
import { recordAppError } from "@/lib/db/app-logs";
import { requireSupabaseUser } from "@/lib/auth";
import { deleteArtifact } from "@/lib/db/artifacts";

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const routeName = "/api/artifacts/[id]";
  const requestId = crypto.randomUUID();
  try {
    const { user } = await requireSupabaseUser(req);
    const { id } = await context.params;
    await deleteArtifact({ userId: user.id, artifactId: id });
    return NextResponse.json({ ok: true, data: null, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    if (status === 500) {
      void recordAppError({
        source: "bff",
        component: "app/api/artifacts/[id]/route",
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
