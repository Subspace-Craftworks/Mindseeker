import { NextRequest, NextResponse } from "next/server";
import { recordAppError } from "@/lib/app-logs";
import { requireSupabaseUser } from "@/lib/auth";
import { getAppParameters } from "@/lib/dify";

export async function GET(req: NextRequest) {
  const routeName = "/api/chat/opening-statement";
  const requestId = crypto.randomUUID();
  try {
    await requireSupabaseUser(req);
    const params = await getAppParameters();
    return NextResponse.json({
      ok: true,
      data: {
        openingStatement: typeof params.opening_statement === "string" ? params.opening_statement.trim() : "",
      },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    if (status === 500) {
      void recordAppError({
        source: "bff",
        component: "app/api/chat/opening-statement/route",
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
