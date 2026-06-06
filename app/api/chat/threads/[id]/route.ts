import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/auth";
import { deleteChatThread, getChatThread } from "@/lib/chat-threads";
import { deleteConversation } from "@/lib/dify";

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireSupabaseUser(req);
    const { id } = await context.params;
    const thread = await getChatThread(user.id, id);
    if (thread) {
      await deleteConversation({
        conversationId: thread.dify_conversation_id,
        userId: user.id,
      });
    }
    await deleteChatThread(user.id, id);
    return NextResponse.json({ ok: true, data: { deleted: id }, error: null });
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
