"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type ChatThread = {
  id: string;
  user_id: string;
  dify_conversation_id: string;
  title: string | null;
  app_key: string;
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type ChatThreadsResponse = {
  ok: boolean;
  data: ChatThread[];
  error: { code: string; message: string } | null;
};

type ChatMessageResponse = {
  ok: boolean;
  data: unknown;
  error: { code: string; message: string } | null;
};

type ChatThreadHistoryResponse = {
  ok: boolean;
  data:
    | {
        thread: ChatThread;
        messages: ChatMessage[];
      }
    | null;
  error: { code: string; message: string } | null;
};

type OpeningStatementResponse = {
  ok: boolean;
  data: {
    openingStatement: string;
  };
  error: { code: string; message: string } | null;
};

type ContextMap = {
  goals: {
    id: string;
    title: string;
    subjects: { title: string }[];
    issues: { title: string }[];
    tasks: { title: string }[];
    events: { title: string }[];
  }[];
};

type ContextMapResponse = {
  ok: boolean;
  data: ContextMap;
  error: { code: string; message: string } | null;
};

type ChatStreamEvent =
  | {
      type: "delta";
      delta: string;
      conversationId?: string;
      messageId?: string;
      taskId?: string;
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

function extractConversationId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates = [
    (payload as { conversation_id?: unknown }).conversation_id,
    (payload as { conversationId?: unknown }).conversationId,
    (payload as { data?: { conversation_id?: unknown } }).data?.conversation_id,
  ];

  return candidates.find((value) => typeof value === "string" && value.trim())?.toString().trim() ?? "";
}

function extractAssistantText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates = [
    (payload as { answer?: unknown }).answer,
    (payload as { text?: unknown }).text,
    (payload as { message?: unknown }).message,
    (payload as { data?: { answer?: unknown } }).data?.answer,
    (payload as { data?: { text?: unknown } }).data?.text,
  ];

  return candidates.find((value) => typeof value === "string" && value.trim())?.toString().trim() ?? "";
}

async function readChatStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const body = response.body;
  if (!body) {
    throw new Error("Chat stream is unavailable");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flush = (chunk: string) => {
    buffer += chunk;
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
        const event = JSON.parse(data) as ChatStreamEvent;
        onEvent(event);
      } catch {
        // Ignore malformed chunks and keep draining the stream.
      }
    }
  };

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
        const event = JSON.parse(buffer.replace(/^data:\s?/, "")) as ChatStreamEvent;
        onEvent(event);
      } catch {
        // Ignore leftover parse errors.
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p style={{ margin: "0 0 0.85em" }}>{children}</p>,
        strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
        em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
            {children}
          </a>
        ),
        code: ({ children, className }) => {
          const isBlock = Boolean(className);
          if (isBlock) {
            return (
              <code
                style={{
                  display: "block",
                  whiteSpace: "pre-wrap",
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "rgba(23, 33, 43, 0.06)",
                  border: "1px solid rgba(23, 33, 43, 0.08)",
                  overflowX: "auto",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace",
                }}
              >
                {children}
              </code>
            );
          }

          return (
            <code
              style={{
                padding: "0.15em 0.4em",
                borderRadius: 6,
                background: "rgba(23, 33, 43, 0.08)",
                fontFamily:
                  "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace",
              }}
            >
              {children}
            </code>
          );
        },
        ul: ({ children }) => <ul style={{ margin: "0 0 0.85em", paddingLeft: "1.4em" }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ margin: "0 0 0.85em", paddingLeft: "1.4em" }}>{children}</ol>,
        li: ({ children }) => <li style={{ margin: "0.25em 0" }}>{children}</li>,
        blockquote: ({ children }) => (
          <blockquote
            style={{
              margin: "0 0 0.85em",
              paddingLeft: 14,
              borderLeft: "3px solid rgba(23, 33, 43, 0.18)",
              color: "var(--muted)",
            }}
          >
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div style={{ overflowX: "auto", margin: "0 0 0.85em" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th
            style={{
              border: "1px solid rgba(23, 33, 43, 0.12)",
              padding: "8px 10px",
              textAlign: "left",
              background: "rgba(23, 33, 43, 0.04)",
            }}
          >
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td style={{ border: "1px solid rgba(23, 33, 43, 0.12)", padding: "8px 10px", verticalAlign: "top" }}>
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function ContextLine({ label, items }: { label: string; items: string[] }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ color: "var(--muted)", fontSize: 12 }}>{label}:</div>
      <div style={{ display: "grid", gap: 2, paddingLeft: 12 }}>
        {items.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 12 }}>-</div>
        ) : (
          items.map((item) => (
            <div key={item} style={{ fontSize: 12, lineHeight: 1.5 }}>
              {item}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ContextGoalBlock({
  goal,
}: {
  goal: ContextMap["goals"][number];
}) {
  return (
    <div style={{ display: "grid", gap: 8, paddingBottom: 12, borderBottom: "1px solid rgba(23, 33, 43, 0.08)" }}>
      <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.04 }}>
        Goal:
      </div>
      <div style={{ display: "grid", gap: 10, paddingLeft: 8 }}>
        <div style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 600 }}>・{goal.title}</div>
        <div style={{ display: "grid", gap: 8, paddingLeft: 10 }}>
          <ContextLine label="Subject" items={goal.subjects.map((item) => item.title)} />
          <ContextLine label="Issue" items={goal.issues.map((item) => item.title)} />
          <ContextLine label="Task" items={goal.tasks.map((item) => item.title)} />
          <ContextLine label="Event" items={goal.events.map((item) => item.title)} />
        </div>
      </div>
    </div>
  );
}

export function ChatWorkspace() {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [contextMap, setContextMap] = useState<ContextMap | null>(null);
  const [openingStatement, setOpeningStatement] = useState<string>("");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messagesByThread, setMessagesByThread] = useState<Record<string, ChatMessage[]>>({});
  const [draft, setDraft] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, threads],
  );

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;

      if (!active) {
        return;
      }

      if (!token) {
        router.replace("/login");
        return;
      }

      setSessionToken(token);
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!sessionToken) {
      return;
    }

    let cancelled = false;

    async function loadThreads() {
      setLoadingThreads(true);
      setError(null);
      try {
        const response = await fetch("/api/chat/threads", {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });
        const payload = (await response.json()) as ChatThreadsResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error?.message ?? `Failed to load threads (${response.status})`);
        }

        if (cancelled) {
          return;
        }

        setThreads(payload.data);
        setActiveThreadId((current) => current ?? payload.data[0]?.id ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load threads");
        }
      } finally {
        if (!cancelled) {
          setLoadingThreads(false);
        }
      }
    }

    void loadThreads();

    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken) {
      return;
    }

    let cancelled = false;

    async function loadOpeningStatement() {
      try {
        const response = await fetch("/api/chat/opening-statement", {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });

        const payload = (await response.json()) as OpeningStatementResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error?.message ?? `Failed to load opening statement (${response.status})`);
        }

        if (cancelled) {
          return;
        }

        setOpeningStatement(payload.data.openingStatement);
      } catch {
        if (!cancelled) {
          setOpeningStatement("");
        }
      }
    }

    void loadOpeningStatement();

    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken) {
      return;
    }

    let cancelled = false;

    async function loadContextMap() {
      try {
        const response = await fetch("/api/context-map", {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });

        const payload = (await response.json()) as ContextMapResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error?.message ?? `Failed to load context map (${response.status})`);
        }

        if (cancelled) {
          return;
        }

        setContextMap(payload.data);
      } catch (loadError) {
        if (!cancelled) {
          setContextMap({
            goals: [],
          });
          setError(loadError instanceof Error ? loadError.message : "Failed to load context map");
        }
      }
    }

    void loadContextMap();

    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  const activeMessages = activeThreadId ? messagesByThread[activeThreadId] ?? [] : messagesByThread.draft ?? [];

  useEffect(() => {
    if (sessionToken && activeThreadId === null) {
      seedOpeningStatement();
    }
  }, [activeThreadId, openingStatement, sessionToken]);

  function seedOpeningStatement() {
    if (!openingStatement.trim()) {
      return;
    }

    const opener: ChatMessage = {
      id: "opening-statement",
      role: "assistant",
      content: openingStatement.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessagesByThread((current) => {
      const draftMessages = current.draft ?? [];
      if (draftMessages.length > 0) {
        return current;
      }

      return {
        ...current,
        draft: [opener],
      };
    });
  }

  useEffect(() => {
    if (!sessionToken || !activeThreadId) {
      return;
    }

    const threadId = activeThreadId;

    if (Object.prototype.hasOwnProperty.call(messagesByThread, threadId)) {
      return;
    }

    let cancelled = false;

    async function loadThreadMessages() {
      setLoadingThreadId(threadId);
      setError(null);
      try {
        const response = await fetch(`/api/chat/threads/${threadId}`, {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });

        const payload = (await response.json()) as ChatThreadHistoryResponse;
        const history = payload.data;
        if (!response.ok || !payload.ok || !history) {
          throw new Error(payload.error?.message ?? `Failed to load conversation (${response.status})`);
        }

        if (cancelled) {
          return;
        }

        setMessagesByThread((current) => ({
          ...current,
          [threadId]: history.messages,
        }));
        setThreads((current) =>
          current.map((thread) =>
            thread.id === history.thread.id ? { ...history.thread } : thread,
          ),
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load conversation");
        }
      } finally {
        if (!cancelled) {
          setLoadingThreadId((current) => (current === threadId ? null : current));
        }
      }
    }

    void loadThreadMessages();

    return () => {
      cancelled = true;
    };
  }, [activeThreadId, messagesByThread, sessionToken]);

  async function refreshThreads(nextConversationId?: string) {
    if (!sessionToken) {
      return null;
    }

    const response = await fetch("/api/chat/threads", {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    const payload = (await response.json()) as ChatThreadsResponse;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error?.message ?? `Failed to refresh threads (${response.status})`);
    }

    setThreads(payload.data);

    if (nextConversationId) {
      const matched = payload.data.find((thread) => thread.dify_conversation_id === nextConversationId);
      if (matched) {
        setActiveThreadId(matched.id);
        return matched.id;
      }
    }

    return null;
  }

  async function refreshContextMap() {
    if (!sessionToken) {
      return;
    }

    const response = await fetch("/api/context-map", {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    const payload = (await response.json()) as ContextMapResponse;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error?.message ?? `Failed to refresh context map (${response.status})`);
    }

    setContextMap(payload.data);
  }

  async function handleSend() {
    const message = draft.trim();
    if (!message || !sessionToken || sending) {
      return;
    }

    const threadKey = activeThread?.id ?? "draft";
    const assistantId = `assistant-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      createdAt,
    };
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt,
    };

    setDraft("");
    setSending(true);
    setError(null);
    setMessagesByThread((current) => ({
      ...current,
      [threadKey]: [...(current[threadKey] ?? []), userMessage, assistantMessage],
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          message,
          conversation_id: activeThread?.dify_conversation_id ?? "",
        }),
      });
      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok) {
        const payload = contentType.includes("application/json")
          ? ((await response.json().catch(() => null)) as ChatMessageResponse | null)
          : null;
        const errorText = contentType.includes("text/plain") ? await response.text().catch(() => "") : "";
        throw new Error(
          payload?.error?.message ??
            errorText ??
            `Failed to send message (${response.status})`,
        );
      }

      if (contentType.includes("text/event-stream")) {
        let conversationId = activeThread?.dify_conversation_id ?? "";
        let assistantContent = "";

        await readChatStream(response, (event) => {
          if (event.type === "error") {
            throw new Error(event.message);
          }

          if (event.type === "delta") {
            if (event.conversationId) {
              conversationId = event.conversationId;
            }
            assistantContent += event.delta;
            setMessagesByThread((current) => {
              const currentMessages = current[threadKey] ?? [];
              return {
                ...current,
                [threadKey]: currentMessages.map((currentMessage) =>
                  currentMessage.id === assistantId
                    ? { ...currentMessage, content: assistantContent }
                    : currentMessage,
                ),
              };
            });
            return;
          }

          if (event.type === "done") {
            if (event.conversationId) {
              conversationId = event.conversationId;
            }
            assistantContent = event.answer || assistantContent;
            setMessagesByThread((current) => {
              const currentMessages = current[threadKey] ?? [];
              return {
                ...current,
                [threadKey]: currentMessages.map((currentMessage) =>
                  currentMessage.id === assistantId
                    ? { ...currentMessage, content: assistantContent }
                    : currentMessage,
                ),
              };
            });
          }
        });

        const nextThreadId = await refreshThreads(conversationId || activeThread?.dify_conversation_id || undefined);
        await refreshContextMap();
        if (threadKey === "draft" && nextThreadId) {
          setMessagesByThread((current) => {
            const draftMessages = current.draft ?? [];
            const next = { ...current };
            next[nextThreadId] = draftMessages;
            delete next.draft;
            return next;
          });
        }
        return;
      }

      const payload = (await response.json()) as ChatMessageResponse;
      if (!payload.ok) {
        throw new Error(payload.error?.message ?? `Failed to send message (${response.status})`);
      }

      const assistantText = extractAssistantText(payload.data);
      const conversationId = extractConversationId(payload.data);

      if (assistantText) {
        setMessagesByThread((current) => ({
          ...current,
          [threadKey]: (current[threadKey] ?? []).map((currentMessage) =>
            currentMessage.id === assistantId
              ? { ...currentMessage, content: assistantText }
              : currentMessage,
          ),
        }));
      }

      const nextThreadId = await refreshThreads(conversationId || activeThread?.dify_conversation_id || undefined);
      await refreshContextMap();
      if (threadKey === "draft" && nextThreadId) {
        setMessagesByThread((current) => {
          const draftMessages = current.draft ?? [];
          const next = { ...current };
          next[nextThreadId] = draftMessages;
          delete next.draft;
          return next;
        });
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteThread(threadId: string) {
    if (!sessionToken) {
      return;
    }

    const confirmed = window.confirm("Delete this chat thread?");
    if (!confirmed) {
      return;
    }

    setError(null);

    const response = await fetch(`/api/chat/threads/${threadId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    const payload = (await response.json()) as { ok: boolean; error: { message: string } | null };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error?.message ?? `Failed to delete thread (${response.status})`);
    }

    setThreads((current) => current.filter((thread) => thread.id !== threadId));
    setMessagesByThread((current) => {
      const next = { ...current };
      delete next[threadId];
      return next;
    });
    setActiveThreadId((current) => {
      if (current !== threadId) {
        return current;
      }
      return threads.find((thread) => thread.id !== threadId)?.id ?? null;
    });
  }

  function startNewThread() {
    setActiveThreadId(null);
    setError(null);
    seedOpeningStatement();
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px minmax(0, 1fr)",
        gap: 20,
        alignItems: "stretch",
      }}
    >
      <aside
        style={{
          border: "1px solid var(--line)",
          borderRadius: 24,
          background: "rgba(255, 255, 255, 0.78)",
          padding: 20,
          minHeight: 640,
        }}
      >
        <div
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: 18,
            border: "1px solid var(--line)",
            background: "rgba(247, 245, 240, 0.56)",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: 0.08, textTransform: "uppercase", color: "var(--muted)" }}>
            Context map
          </div>
          {contextMap ? (
            <div style={{ display: "grid", gap: 12, maxHeight: 240, overflow: "auto", paddingRight: 4 }}>
              {contextMap.goals.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 12 }}>-</div>
              ) : (
                contextMap.goals.map((goal) => <ContextGoalBlock key={goal.id} goal={goal} />)
              )}
            </div>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: 12 }}>Loading context...</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Threads</div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Conversation history</div>
          </div>
          <button
            type="button"
            onClick={startNewThread}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "var(--panel)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            New
          </button>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {loadingThreads ? (
            <div style={{ color: "var(--muted)", fontSize: 14 }}>Loading threads...</div>
          ) : threads.length === 0 ? (
            <div
              style={{
                padding: 16,
                borderRadius: 16,
                border: "1px dashed var(--line)",
                color: "var(--muted)",
                lineHeight: 1.7,
              }}
            >
              No threads yet. Start a new chat from the composer.
            </div>
          ) : (
            threads.map((thread) => {
              const selected = thread.id === activeThreadId;
              return (
                <div
                  key={thread.id}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    borderRadius: 16,
                    border: selected ? "1px solid var(--accent)" : "1px solid var(--line)",
                    background: selected ? "rgba(15, 118, 110, 0.08)" : "var(--panel)",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveThreadId(thread.id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{thread.title ?? "Untitled thread"}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
                      Updated {new Date(thread.updated_at).toLocaleString()}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteThread(thread.id).catch((deleteError) => {
                        setError(deleteError instanceof Error ? deleteError.message : "Failed to delete thread");
                      });
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--muted)",
                      cursor: "pointer",
                      fontSize: 12,
                      justifySelf: "start",
                      padding: 0,
                    }}
                  >
                    Delete
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      <section
        style={{
          border: "1px solid var(--line)",
          borderRadius: 24,
          background: "rgba(255, 255, 255, 0.78)",
          padding: 20,
          minHeight: 640,
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
          gap: 16,
        }}
      >
        <header style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {activeThread?.title ?? "New conversation"}
              </div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                {activeThread
                  ? `Conversation ID: ${activeThread.dify_conversation_id}`
                  : "Start a new thread by sending a message"}
              </div>
            </div>
          </div>
          {loadingThreadId === activeThreadId ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Loading conversation...</div>
          ) : null}
          {error ? (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(140, 75, 45, 0.24)",
                background: "rgba(140, 75, 45, 0.08)",
                color: "var(--accent-2)",
              }}
            >
              {error}
            </div>
          ) : null}
        </header>

        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 20,
            background: "rgba(247, 245, 240, 0.56)",
            padding: 18,
            overflow: "auto",
            display: "grid",
            gap: 12,
            alignContent: "start",
          }}
        >
          {activeMessages.length === 0 ? (
            <div style={{ color: "var(--muted)", lineHeight: 1.8 }}>
              No messages yet. Ask the first question to begin.
            </div>
          ) : (
            activeMessages.map((message) => (
              <article
                key={message.id}
                style={{
                  justifySelf: message.role === "user" ? "end" : "start",
                  maxWidth: "80%",
                  padding: "12px 14px",
                  borderRadius: 18,
                  background: message.role === "user" ? "var(--accent)" : "white",
                  color: message.role === "user" ? "white" : "var(--text)",
                  border: message.role === "user" ? "none" : "1px solid var(--line)",
                  boxShadow: "0 10px 24px rgba(23, 33, 43, 0.06)",
                  lineHeight: 1.7,
                }}
              >
                {message.role === "assistant" ? (
                  <MarkdownMessage content={message.content} />
                ) : (
                  <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
                )}
              </article>
            ))
          )}
          {sending ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Sending message...</div>
          ) : null}
        </div>

        <footer
          style={{
            display: "grid",
            gap: 12,
            paddingTop: 8,
            borderTop: "1px solid var(--line)",
          }}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a message..."
            rows={4}
            style={{
              width: "100%",
              resize: "vertical",
              padding: 16,
              borderRadius: 18,
              border: "1px solid var(--line)",
              background: "white",
              color: "var(--text)",
              fontFamily: "inherit",
              lineHeight: 1.7,
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              Auth token is read from the current Supabase session.
            </div>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending || draft.trim().length === 0}
              style={{
                padding: "12px 18px",
                borderRadius: 14,
                border: "1px solid var(--line)",
                background: "var(--accent)",
                color: "white",
                fontWeight: 700,
                cursor: sending || draft.trim().length === 0 ? "not-allowed" : "pointer",
                opacity: sending || draft.trim().length === 0 ? 0.65 : 1,
              }}
            >
              Send
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
