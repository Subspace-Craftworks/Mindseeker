import { getDifyApiBaseUrl, getDifyApiKey } from "@/lib/env";

type ChatRequest = {
  message: string;
  userId: string;
  conversationId?: string | null;
};

export async function postChatMessage(input: ChatRequest) {
  const response = await fetch(`${getDifyApiBaseUrl()}/chat-messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getDifyApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: { user_id: input.userId },
      query: input.message,
      response_mode: "blocking",
      conversation_id: input.conversationId ?? "",
      user: input.userId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Dify request failed: ${response.status}`);
  }

  return response.json();
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
