export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { recordAppError } from "@/lib/db/app-logs";
import { requireSupabaseUser } from "@/lib/auth";
import { upsertChatThread } from "@/lib/db/chat-threads";
import { getDifyApiBaseUrl, getDifyApiKey } from "@/lib/utils/env";
import { createSession, getSessionByConversation, updateSessionConversation } from "@/lib/db/sessions";

type StreamEvent =
  | {
      type: "delta";
      delta: string;
      conversationId?: string;
      messageId?: string;
      taskId?: string;
    }
  | {
      type: "thought";
      thought: string;
      conversationId?: string;
    }
  | {
      type: "done";
      conversationId?: string;
      answer: string;
    }
  | {
      type: "error";
      message: string;
    };

function encodeSseEvent(event: StreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function parseSseEvents(text: string) {
  return text
    .split(/\r?\n\r?\n/)
    .map((block) =>
      block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s?/, ""))
        .join("\n"),
    )
    .filter(Boolean)
    .map((json) => {
      try {
        return JSON.parse(json) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((event): event is Record<string, unknown> => event !== null);
}

function createReadableStreamFromResponse(response: Response, onChunk: (chunk: string) => void) {
  const reader = response.body?.getReader();
  if (!reader) {
    return Promise.resolve([]);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  const events: Record<string, unknown>[] = [];

  const flush = (text: string) => {
    buffer += text;
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const data = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s?/, ""))
        .join("\n");

      if (!data) {
        continue;
      }

      try {
        const event = JSON.parse(data) as Record<string, unknown>;
        events.push(event);

        if (event.event === "agent_thought" && typeof event.thought === "string" && event.thought) {
          onChunk(JSON.stringify({ type: "thought", thought: event.thought }));
          continue;
        }

        const nextAnswer = event.answer;
        if (typeof nextAnswer === "string" && nextAnswer) {
          onChunk(JSON.stringify({ type: "delta", delta: nextAnswer }));
        }
      } catch {
        // Ignore malformed chunks and keep draining the stream.
      }
    }
  };

  return (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        flush(decoder.decode(value, { stream: true }));
      }

      const remainder = decoder.decode();
      if (remainder) {
        flush(remainder);
      }

      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.replace(/^data:\s?/, "")) as Record<string, unknown>;
          events.push(event);

          if (event.event === "agent_thought" && typeof event.thought === "string" && event.thought) {
            onChunk(JSON.stringify({ type: "thought", thought: event.thought }));
          } else {
            const nextAnswer = event.answer;
            if (typeof nextAnswer === "string" && nextAnswer) {
              onChunk(JSON.stringify({ type: "delta", delta: nextAnswer }));
            }
          }
        } catch {
          // Ignore leftover parse errors.
        }
      }
    } finally {
      reader.releaseLock();
    }

    return events;
  })();
}

export async function POST(req: NextRequest) {
  const routeName = "/api/chat";
  const requestId = crypto.randomUUID();
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

    // 1. Resolve session and build context
    // Session is resolved internally: conversation_id → sessions table lookup, or create new
    let resolvedSessionId = "";
    let currentGoalIdStr = "";
    let currentGoalContextStr = "";

    if (conversationId) {
      // Existing conversation: find session by dify_conversation_id
      try {
        const session = await getSessionByConversation(conversationId, user.id);
        if (session) {
          resolvedSessionId = session.id;
          if (session.current_goal_id) {
            currentGoalIdStr = session.current_goal_id;
            const { getGoalContextText } = await import("@/lib/mcp/handlers");
            currentGoalContextStr = await getGoalContextText(currentGoalIdStr, user.id);
          }
        }
      } catch (err) {
        console.error("Failed to resolve session from conversation_id:", err);
      }
    }

    // If no session was found (new conversation or missing session), create one
    if (!resolvedSessionId) {
      try {
        const newSession = await createSession(user.id);
        resolvedSessionId = newSession.id;
      } catch (err) {
        console.error("Failed to create session:", err);
        resolvedSessionId = crypto.randomUUID();
      }
    }

    const upstream = await fetch(`${getDifyApiBaseUrl()}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getDifyApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          session_id: resolvedSessionId,
          current_goal_id: currentGoalIdStr,
          current_goal_context: currentGoalContextStr,
        },
        query: message,
        response_mode: "streaming",
        conversation_id: conversationId || "",
        user: user.id,
        auto_generate_name: true,
      }),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UPSTREAM_ERROR",
            message: `Dify request failed: ${upstream.status}${errorText ? ` - ${errorText.slice(0, 500)}` : ""}`,
          },
        },
        { status: 502 },
      );
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        let answer = "";
        let upstreamConversationId = "";
        let streamError: string | null = null;

        try {
          const contentType = upstream.headers.get("content-type") ?? "";

          if (contentType.includes("application/json")) {
            const payload = (await upstream.json()) as { conversation_id?: string; answer?: string };
            answer = typeof payload.answer === "string" ? payload.answer : "";
            upstreamConversationId = typeof payload.conversation_id === "string" ? payload.conversation_id : "";

            controller.enqueue(
              encoder.encode(
                encodeSseEvent({
                  type: "delta",
                  delta: answer,
                  conversationId: upstreamConversationId || undefined,
                }),
              ),
            );
          } else {
            const events = await createReadableStreamFromResponse(upstream, (chunkStr) => {
              try {
                const chunkData = JSON.parse(chunkStr);
                if (chunkData.type === "thought") {
                  controller.enqueue(
                    encoder.encode(
                      encodeSseEvent({
                        type: "thought",
                        thought: chunkData.thought,
                        conversationId: upstreamConversationId || undefined,
                      }),
                    ),
                  );
                } else if (chunkData.type === "delta") {
                  answer += chunkData.delta;
                  controller.enqueue(
                    encoder.encode(
                      encodeSseEvent({
                        type: "delta",
                        delta: chunkData.delta,
                        conversationId: upstreamConversationId || undefined,
                      }),
                    ),
                  );
                }
              } catch {
                // Ignore parsing errors for internal chunk format
              }
            });

            for (const event of events) {
              if (!upstreamConversationId && typeof event.conversation_id === "string") {
                upstreamConversationId = event.conversation_id;
              }
              if (!answer && typeof event.answer === "string") {
                answer = event.answer;
              }
            }
          }

          if (upstreamConversationId) {
            let finalCurrentGoalId = currentGoalIdStr || undefined;

            // Update session with dify_conversation_id
            if (resolvedSessionId) {
              try {
                await updateSessionConversation(resolvedSessionId, upstreamConversationId);
              } catch (err) {
                console.error("Failed to update session conversation:", err);
              }
            }

            await upsertChatThread({
              userId: user.id,
              conversationId: upstreamConversationId,
              title: message.slice(0, 40),
              appKey: "mindseeker",
              currentGoalId: finalCurrentGoalId,
            });
          }

          controller.enqueue(
            encoder.encode(
              encodeSseEvent({
                type: "done",
                conversationId: upstreamConversationId || undefined,
                answer: answer.trim(),
              }),
            ),
          );
        } catch (error) {
          streamError = error instanceof Error ? error.message : "Unknown error";
          void recordAppError({
            source: "bff",
            component: "app/api/chat/route",
            operation: "stream-start",
            route: routeName,
            requestId,
            userId: user.id,
            message: streamError,
            details: error,
            appKey: "mindseeker",
          });
          controller.enqueue(
            encoder.encode(
              encodeSseEvent({
                type: "error",
                message: streamError,
              }),
            ),
          );
        } finally {
          controller.close();
          if (streamError) {
            console.error("Chat stream error:", streamError);
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Unauthorized" || message === "Missing bearer token" ? 401 : 500;
    if (status === 500) {
      void recordAppError({
        source: "bff",
        component: "app/api/chat/route",
        operation: "POST",
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
        error: { code: status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR", message },
      },
      { status },
    );
  }
}
