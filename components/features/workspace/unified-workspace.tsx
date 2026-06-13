"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { GoalEditor, type GoalDetail, type GoalRecord } from "./goal-editor";

type ChatThread = {
  id: string;
  user_id: string;
  dify_conversation_id: string;
  title: string | null;
  app_key: string;
  current_goal_id: string | null;
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  thought?: string;
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
  currentGoalId: string | null;
  goal: {
    id: string;
    title: string;
    status: string;
    subjects: { title: string }[];
    issues: { title: string }[];
    tasks: { title: string }[];
    events: { title: string }[];
  } | null;
  goals: {
    id: string;
    title: string;
    status: string;
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

type GoalDetailResponse = {
  ok: boolean;
  data: GoalDetail | null;
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
  selected,
  isLatest,
  isActiveEditor,
  onClick,
}: {
  goal: ContextMap["goals"][number];
  selected?: boolean;
  isLatest?: boolean;
  isActiveEditor?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "8px 12px",
        borderRadius: "var(--radius-md)",
        border: "none",
        background: isActiveEditor ? "var(--accent)" : selected ? "var(--panel-2)" : "transparent",
        color: isActiveEditor ? "white" : goal.status === "inactive" ? "var(--muted)" : "inherit",
        opacity: selected || isActiveEditor ? 1 : 0.75,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        transition: "all 0.2s ease-in-out",
      }}
    >
      <div style={{ width: "100%", display: "flex", alignItems: "center" }}>
        <div
          style={{
            flexGrow: 1,
            fontSize: 13,
            lineHeight: 1.4,
            fontWeight: selected || isActiveEditor ? 600 : 400,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {goal.title}{goal.status === "inactive" ? " (Inactive)" : ""}
        </div>
      </div>
    </button>
  );
}

export function UnifiedWorkspace() {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [contextMap, setContextMap] = useState<ContextMap | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [openingStatement, setOpeningStatement] = useState<string>("");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messagesByThread, setMessagesByThread] = useState<Record<string, ChatMessage[]>>({});
  const [draft, setDraft] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Goal Editor states
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedGoalDetail, setSelectedGoalDetail] = useState<GoalDetail | null>(null);
  const [loadingGoalDetail, setLoadingGoalDetail] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, threads],
  );

  const visibleGoals = useMemo(
    () => contextMap?.goals.filter((g) => showInactive || g.status === "active") ?? [],
    [contextMap, showInactive],
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
        const params = new URLSearchParams();
        if (activeThreadId) {
          params.set("thread_id", activeThreadId);
        }

        const response = await fetch(`/api/context-map${params.toString() ? `?${params.toString()}` : ""}`, {
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
            currentGoalId: null,
            goal: null,
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
  }, [activeThreadId, sessionToken]);

  useEffect(() => {
    if (!sessionToken || !selectedGoalId) {
      return;
    }

    let cancelled = false;

    async function loadGoalDetail() {
      setLoadingGoalDetail(true);
      setError(null);
      try {
        const response = await fetch(`/api/goals/${selectedGoalId}`, {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });
        const payload = (await response.json()) as GoalDetailResponse;
        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error?.message ?? `Failed to load goal details (${response.status})`);
        }

        if (cancelled) {
          return;
        }

        setSelectedGoalDetail(payload.data);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load goal details");
        }
      } finally {
        if (!cancelled) {
          setLoadingGoalDetail(false);
        }
      }
    }

    void loadGoalDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedGoalId, sessionToken]);

  const activeMessages = activeThreadId ? messagesByThread[activeThreadId] ?? [] : messagesByThread.draft ?? [];

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activeMessages, sending]);

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

  async function handleSaveArtifact(messageContent: string) {
    if (!sessionToken || !selectedGoalId) return;
    const title = window.prompt("Enter a title for this artifact:", "無題");
    if (!title) return; // User cancelled

    try {
      const res = await fetch("/api/artifacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          goal_id: selectedGoalId,
          title,
          content: messageContent,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error?.message ?? "Failed to save artifact");
      }
      // Refresh the goal detail to show the new artifact
      if (selectedGoalDetail) {
        handleGoalSaved(selectedGoalDetail.goal);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
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

  async function refreshGoalDetail(goalId?: string | null) {
    const targetId = goalId ?? selectedGoalId;
    if (!sessionToken || !targetId) {
      return;
    }

    try {
      const response = await fetch(`/api/goals/${targetId}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      const payload = (await response.json()) as GoalDetailResponse;
      if (response.ok && payload.ok && payload.data) {
        setSelectedGoalDetail(payload.data);
      }
    } catch (err) {
      console.error("Failed to silently refresh goal detail:", err);
    }
  }

  async function refreshContextMap(threadId?: string | null) {
    if (!sessionToken) {
      return;
    }

    const params = new URLSearchParams();
    const effectiveThreadId = threadId ?? activeThreadId;
    if (effectiveThreadId) {
      params.set("thread_id", effectiveThreadId);
    }

    const response = await fetch(`/api/context-map${params.toString() ? `?${params.toString()}` : ""}`, {
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
        let assistantThought = "";

        await readChatStream(response, (event) => {
          if (event.type === "error") {
            throw new Error(event.message);
          }

          if (event.type === "thought") {
            if (event.conversationId) {
              conversationId = event.conversationId;
            }
            assistantThought += event.thought + "\n";
            setMessagesByThread((current) => {
              const currentMessages = current[threadKey] ?? [];
              return {
                ...current,
                [threadKey]: currentMessages.map((currentMessage) =>
                  currentMessage.id === assistantId
                    ? { ...currentMessage, thought: assistantThought }
                    : currentMessage,
                ),
              };
            });
            return;
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
        await refreshContextMap(nextThreadId ?? activeThreadId);
        await refreshGoalDetail();
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
      await refreshContextMap(nextThreadId ?? activeThreadId);
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
    void refreshContextMap(null).catch(() => undefined);
  }

  function handleGoalSaved(updated: GoalRecord) {
    // Refresh context map so that Goal list is updated
    void refreshContextMap().catch(() => undefined);
    // Reload full goal details so subjects, tasks etc. are refreshed
    void refreshGoalDetail(updated.id).catch(() => undefined);
  }

  function handleGoalDeleted(goalId: string) {
    void refreshContextMap().catch(() => undefined);
    if (selectedGoalId === goalId) {
      setSelectedGoalId(null);
      setSelectedGoalDetail(null);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        alignItems: "stretch",
        overflow: "hidden",
      }}
    >
      <aside
        style={{
          width: 280,
          flexShrink: 0,
          borderRight: "var(--pane-border)",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 12,
            borderBottom: "var(--pane-border)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: "40%",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)" }}>
              Goals
            </div>
            <label style={{ fontSize: 10, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Inactiveも表示
            </label>
          </div>
          {contextMap ? (
            <div style={{ display: "grid", gap: 8, overflow: "auto", paddingRight: 4 }}>
              {visibleGoals.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 11 }}>-</div>
              ) : (
                visibleGoals.map((goal) => (
                  <ContextGoalBlock
                    key={goal.id}
                    goal={goal}
                    selected={contextMap.currentGoalId === goal.id}
                    isLatest={contextMap.currentGoalId === goal.id}
                    isActiveEditor={selectedGoalId === goal.id}
                    onClick={() => setSelectedGoalId(goal.id === selectedGoalId ? null : goal.id)}
                  />
                ))
              )}
            </div>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: 11 }}>Loading context...</div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, overflow: "hidden", padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)" }}>
              Threads
            </div>
            <button
              type="button"
              onClick={startNewThread}
              style={{
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                border: "var(--pane-border)",
                background: "var(--panel)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              New
            </button>
          </div>

          <div style={{ display: "grid", gap: 4, overflow: "auto", paddingRight: 4 }}>
            {loadingThreads ? (
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Loading threads...</div>
            ) : threads.length === 0 ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: "var(--radius-sm)",
                  border: "1px dashed var(--line)",
                  color: "var(--muted)",
                  fontSize: 12,
                }}
              >
                No threads found.
              </div>
            ) : (
              threads.map((thread) => {
                const selected = thread.id === activeThreadId;
                const isRelatedToSelectedGoal = selectedGoalId && thread.current_goal_id === selectedGoalId;
                
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setActiveThreadId(thread.id)}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: isRelatedToSelectedGoal && !selected ? "1px solid var(--accent)" : "1px solid transparent",
                      background: selected ? "var(--accent)" : "transparent",
                      color: selected ? "white" : "inherit",
                      opacity: selected ? 1 : (isRelatedToSelectedGoal ? 0.9 : 0.75),
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      width: "100%",
                      transition: "all 0.2s ease-in-out",
                    }}
                  >
                    <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flexGrow: 1, fontWeight: selected ? 600 : 400, fontSize: 13, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {thread.title || "New conversation"}
                      </div>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteThread(thread.id).catch((deleteError) => {
                            setError(deleteError instanceof Error ? deleteError.message : "Failed to delete thread");
                          });
                        }}
                        title="Delete thread"
                        style={{
                          background: "none",
                          border: "none",
                          padding: "2px 4px",
                          cursor: "pointer",
                          color: selected ? "rgba(255,255,255,0.7)" : "var(--muted)",
                          fontSize: 14,
                          fontWeight: 300,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </div>
                    </div>
                  </button>
              );
            })
          )}
        </div>
        </div>
      </aside>

      {/* ── Pane 2: Goal Editor (Middle) ── */}
      <section
        style={{
          width: 400,
          flexShrink: 0,
          borderRight: "var(--pane-border)",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "12px 16px",
            borderBottom: "var(--pane-border)",
            background: "var(--bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {selectedGoalDetail ? "Goal Editor" : "Inspector"}
          </div>
        </header>
        <div style={{ flexGrow: 1, overflowY: "auto", padding: 16 }}>
          {selectedGoalId ? (
            loadingGoalDetail ? (
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Loading goal...</div>
            ) : selectedGoalDetail && sessionToken ? (
              <GoalEditor
                key={selectedGoalDetail.goal.id}
                detail={selectedGoalDetail}
                sessionToken={sessionToken}
                onSaved={handleGoalSaved}
                onDeleted={handleGoalDeleted}
                onNewChat={() => {
                  startNewThread();
                }}
              />
            ) : (
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Failed to load goal.</div>
            )
          ) : (
            <div style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>
              Select a goal from Context Map to edit details.
            </div>
          )}
        </div>
      </section>

      {/* ── Pane 3: Chat (Right) ── */}
      <section
        style={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          background: "var(--panel)",
          position: "relative",
          minHeight: 0,
        }}
      >
        <header
          style={{
            padding: "12px 16px",
            borderBottom: "var(--pane-border)",
            background: "var(--bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {activeThread?.title ?? "New conversation"}
            </div>
            <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>
              {activeThread
                ? `ID: ${activeThread.dify_conversation_id}`
                : "Start a new thread by sending a message"}
            </div>
          </div>
          {loadingThreadId === activeThreadId ? (
            <div style={{ color: "var(--muted)", fontSize: 11 }}>Loading...</div>
          ) : null}
        </header>

        <div
          ref={chatScrollRef}
          style={{
            flexGrow: 1,
            overflowY: "auto",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
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
                  alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: message.role === "user" ? "80%" : "100%",
                  width: message.role === "assistant" ? "100%" : "auto",
                  padding: message.role === "user" ? "10px 14px" : "12px 0",
                  borderRadius: message.role === "user" ? "var(--radius-md)" : 0,
                  background: message.role === "user" ? "var(--text)" : "transparent",
                  color: message.role === "user" ? "var(--bg)" : "var(--text)",
                  border: "none",
                  boxShadow: "none",
                  lineHeight: 1.7,
                }}
              >
                {message.thought && (
                  <details style={{ marginBottom: message.content ? 12 : 0, color: "var(--muted)", fontSize: 13 }}>
                    <summary style={{ cursor: "pointer", outline: "none", opacity: 0.8 }}>
                      💭 Difyの思考プロセス
                    </summary>
                    <div style={{ marginTop: 8, padding: 12, background: "rgba(23, 33, 43, 0.04)", borderRadius: 12, whiteSpace: "pre-wrap" }}>
                      {message.thought}
                    </div>
                  </details>
                )}
                {message.role === "assistant" ? (
                  <div style={{ position: "relative" }}>
                    <MarkdownMessage content={message.content} />
                    {selectedGoalId && (
                      <button
                        type="button"
                        onClick={() => handleSaveArtifact(message.content)}
                        style={{
                          marginTop: 8,
                          padding: "4px 8px",
                          fontSize: 12,
                          background: "var(--line)",
                          color: "var(--text)",
                          border: "none",
                          borderRadius: "var(--radius-sm)",
                          cursor: "pointer",
                        }}
                      >
                        💾 Save as Artifact
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
                )}
              </article>
            ))
          )}
          {sending ? (
            <div className="typing-indicator" style={{ alignSelf: "flex-start" }}>
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
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
