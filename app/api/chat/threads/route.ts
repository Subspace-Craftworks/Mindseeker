import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/auth";
import { listChatThreads } from "@/lib/chat-threads";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireSupabaseUser(req);
    const threads = await listChatThreads(user.id);
    return NextResponse.json({ ok: true, data: threads, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
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
