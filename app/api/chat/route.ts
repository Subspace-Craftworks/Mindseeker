import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/auth";
import { upsertChatThread } from "@/lib/chat-threads";
import { postChatMessage } from "@/lib/dify";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSupabaseUser(req);
    const body = await req.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const conversationId = typeof body.conversation_id === "string" ? body.conversation_id.trim() : "";

    if (!message) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "message is required" } },
        { status: 400 },
      );
    }

    const data = await postChatMessage({
      message,
      userId: user.id,
      conversationId: conversationId || null,
    });

    const conversation =
      typeof data === "object" && data !== null && "conversation_id" in data
        ? String((data as { conversation_id?: unknown }).conversation_id ?? "")
        : "";

    if (conversation) {
      await upsertChatThread({
        userId: user.id,
        conversationId: conversation,
        title: message.slice(0, 40),
        appKey: "mindseeker",
      });
    }

    return NextResponse.json({ ok: true, data, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: { code: status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR", message },
      },
      { status },
    );
  }
}
