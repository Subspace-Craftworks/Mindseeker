import { getDifyApiBaseUrl, getDifyApiKey } from "@/lib/env";

type ChatRequest = {
  message: string;
  userId: string;
  conversationId?: string | null;
};

type ConversationHistoryRequest = {
  conversationId: string;
  userId: string;
  limit?: number;
};

type DifyChatResult = {
  conversation_id: string;
  answer: string;
  message_id?: string;
  task_id?: string;
  event?: string;
  raw: unknown[];
};

export type DifyAppParameters = {
  opening_statement?: string;
  suggested_questions?: string[];
};

type DifyConversationMessage = {
  id?: string;
  conversation_id?: string;
  query?: string;
  answer?: string;
  created_at?: number;
};

export type ChatHistoryMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

function compareHistoryMessages(left: ChatHistoryMessage, right: ChatHistoryMessage) {
  const timeDelta = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  if (timeDelta !== 0) {
    return timeDelta;
  }

  if (left.role === right.role) {
    return left.id.localeCompare(right.id);
  }

  return left.role === "user" ? -1 : 1;
}

function extractSseEvents(text: string) {
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

function normalizeDifyResponse(text: string): DifyChatResult {
  const events = extractSseEvents(text);
  let answer = "";
  let conversationId = "";
  let messageId = "";
  let taskId = "";
  let eventName = "";

  for (const event of events) {
    const nextAnswer = event.answer;
    if (typeof nextAnswer === "string" && nextAnswer) {
      answer += nextAnswer;
    }

    if (!conversationId && typeof event.conversation_id === "string") {
      conversationId = event.conversation_id;
    }

    if (!messageId && typeof event.message_id === "string") {
      messageId = event.message_id;
    }

    if (!taskId && typeof event.task_id === "string") {
      taskId = event.task_id;
    }

    if (!eventName && typeof event.event === "string") {
      eventName = event.event;
    }
  }

  return {
    conversation_id: conversationId,
    answer: answer.trim(),
    message_id: messageId || undefined,
    task_id: taskId || undefined,
    event: eventName || undefined,
    raw: events,
  };
}

export async function postChatMessage(input: ChatRequest) {
  const response = await fetch(`${getDifyApiBaseUrl()}/chat-messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getDifyApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: input.message,
      response_mode: "streaming",
      conversation_id: input.conversationId ?? "",
      user: input.userId,
      auto_generate_name: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Dify request failed: ${response.status}${errorText ? ` - ${errorText.slice(0, 500)}` : ""}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as DifyChatResult;
  }

  const text = await response.text();
  return normalizeDifyResponse(text);
}

export async function deleteConversation(input: { conversationId: string; userId: string }) {
  const response = await fetch(`${getDifyApiBaseUrl()}/conversations/${input.conversationId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${getDifyApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user: input.userId,
    }),
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Dify delete conversation failed: ${response.status}`);
  }

  return true;
}

export async function listConversationMessages(input: ConversationHistoryRequest) {
  const params = new URLSearchParams({
    conversation_id: input.conversationId,
    user: input.userId,
    limit: String(input.limit ?? 100),
  });

  const response = await fetch(`${getDifyApiBaseUrl()}/messages?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getDifyApiKey()}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Dify list messages failed: ${response.status}${errorText ? ` - ${errorText.slice(0, 500)}` : ""}`);
  }

  const payload = (await response.json()) as { data?: DifyConversationMessage[] };
  const data = Array.isArray(payload.data) ? payload.data : [];

  const messages: ChatHistoryMessage[] = [];
  for (const item of [...data].reverse()) {
    const createdAt = item.created_at ? new Date(item.created_at * 1000).toISOString() : new Date().toISOString();
    const baseId = item.id ?? `${item.conversation_id ?? input.conversationId}-${createdAt}`;

    if (typeof item.query === "string" && item.query.trim()) {
      messages.push({
        id: `${baseId}-user`,
        role: "user",
        content: item.query,
        createdAt,
      });
    }

    if (typeof item.answer === "string" && item.answer.trim()) {
      messages.push({
        id: `${baseId}-assistant`,
        role: "assistant",
        content: item.answer,
        createdAt,
      });
    }
  }

  messages.sort(compareHistoryMessages);

  return {
    messages,
    raw: payload,
  };
}

export async function getAppParameters() {
  const response = await fetch(`${getDifyApiBaseUrl()}/parameters`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getDifyApiKey()}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Dify get parameters failed: ${response.status}${errorText ? ` - ${errorText.slice(0, 500)}` : ""}`);
  }

  const payload = (await response.json()) as DifyAppParameters;
  return payload;
}
