import { NextRequest, NextResponse } from "next/server";
import { recordAppError } from "@/lib/db/app-logs";
import { requireSupabaseUser } from "@/lib/auth";
import { deleteChatThread, getChatThread } from "@/lib/db/chat-threads";
import { deleteConversation, listConversationMessages } from "@/lib/api/dify";
import { deleteSessionByConversation } from "@/lib/db/sessions";

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const routeName = "/api/chat/threads/[id]";
  const requestId = crypto.randomUUID();
  try {
    const { user } = await requireSupabaseUser(req);
    const { id } = await context.params;
    const thread = await getChatThread(user.id, id);
    if (thread) {
      try {
        await deleteConversation({
          conversationId: thread.dify_conversation_id,
          userId: user.id,
        });
      } catch (err) {
        console.warn("Ignored Dify delete error:", err);
      }
    }
    await deleteChatThread(user.id, id);

    // Also delete the associated session
    if (thread) {
      try {
        await deleteSessionByConversation(thread.dify_conversation_id, user.id);
      } catch (err) {
        console.warn("Failed to delete associated session:", err);
      }
    }

    return NextResponse.json({ ok: true, data: { deleted: id }, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    if (status === 500) {
      void recordAppError({
        source: "bff",
        component: "app/api/chat/threads/[id]/route",
        operation: "DELETE",
        route: routeName,
        requestId,
        message,
        details: error,
        appKey: "mindseeker",
      });
    }
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

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const routeName = "/api/chat/threads/[id]";
  const requestId = crypto.randomUUID();
  try {
    const { user } = await requireSupabaseUser(req);
    const { id } = await context.params;
    const thread = await getChatThread(user.id, id);

    if (!thread) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Thread not found" } },
        { status: 404 },
      );
    }

    const history = await listConversationMessages({
      conversationId: thread.dify_conversation_id,
      userId: user.id,
      limit: 100,
    }).catch((err: any) => {
      if (err instanceof Error && err.message.includes("404")) {
        // Conversation does not exist in Dify anymore, return empty messages
        return { messages: [] };
      }
      throw err;
    });

    return NextResponse.json({
      ok: true,
      data: {
        thread,
        messages: history.messages,
      },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    if (status === 500) {
      void recordAppError({
        source: "bff",
        component: "app/api/chat/threads/[id]/route",
        operation: "GET",
        route: routeName,
        requestId,
        message,
        details: error,
        appKey: "mindseeker",
      });
    }
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
