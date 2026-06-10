# BFF - Dify Transport Specification

This document describes only the transport-level contract between the Mindseeker BFF and Dify.

It intentionally excludes Dify tool/action semantics. Those belong in the OpenAPI files and the separate Dify action spec document.

## Scope

The BFF talks to Dify from these places:

- `app/api/chat/route.ts`
- `app/api/chat/opening-statement/route.ts`
- `lib/dify.ts`

The implemented transport endpoints are:

- `POST /chat-messages`
- `GET /parameters`
- `GET /messages`
- `DELETE /conversations/{conversationId}`

## Environment variables

The BFF reads:

- `DIFY_API_BASE_URL`
- `DIFY_API_KEY`

Current source usage:

- `DIFY_API_BASE_URL` is the base URL for all Dify requests.
- `DIFY_API_KEY` is sent as a bearer token.

The current source does not read `dify_api_key_2`.

---

## 1. Chat message send

### Endpoint

- `POST {DIFY_API_BASE_URL}/chat-messages`

### Auth header

```http
Authorization: Bearer <DIFY_API_KEY>
Content-Type: application/json
```

### Request body

The BFF currently sends the following JSON shape:

```json
{
  "query": "<user message>",
  "response_mode": "streaming",
  "conversation_id": "<conversation id or empty string>",
  "user": "<Supabase user.id>",
  "auto_generate_name": true
}
```

### Field semantics

- `query`
  - The user message text.
  - Required and trimmed before sending.
- `response_mode`
  - Always set to `"streaming"`.
- `conversation_id`
  - The current Dify conversation ID if present.
  - Sent as an empty string when creating a new conversation.
- `user`
  - The authenticated Supabase user ID from `requireSupabaseUser(req)`.
- `auto_generate_name`
  - Always set to `true`.

### Not sent

The current implementation does **not** send:

- `inputs`
- `inputs.user_id`
- any workflow-only payload

### Upstream response handling

The BFF accepts either:

- JSON response
- SSE-style streamed response

The parser extracts these fields when present:

- `conversation_id`
- `answer`
- `message_id`
- `task_id`
- `event`

### Downstream response to the frontend

The BFF re-emits its own SSE events:

```json
{ "type": "delta", "delta": "...", "conversationId": "...", "messageId": "...", "taskId": "..." }
```

```json
{ "type": "done", "conversationId": "...", "answer": "..." }
```

```json
{ "type": "error", "message": "..." }
```

---

## 2. Opening statement fetch

### Endpoint

- `GET {DIFY_API_BASE_URL}/parameters`

### Auth header

```http
Authorization: Bearer <DIFY_API_KEY>
Content-Type: application/json
```

### Response fields used

The BFF currently reads only:

- `opening_statement`

The response type in code also allows:

- `suggested_questions`

### Downstream response to the frontend

The BFF returns:

```json
{
  "ok": true,
  "data": {
    "openingStatement": "<trimmed opening_statement>"
  },
  "error": null
}
```

---

## 3. Conversation history

### Endpoint

- `GET {DIFY_API_BASE_URL}/messages?conversation_id=...&user=...&limit=...`

### Auth header

```http
Authorization: Bearer <DIFY_API_KEY>
Content-Type: application/json
```

### Query parameters

- `conversation_id`
  - Required
- `user`
  - Required
- `limit`
  - Optional, default `100`

### Response handling

The BFF expects `data` to contain an array of message records with fields such as:

- `id`
- `conversation_id`
- `query`
- `answer`
- `created_at`

The helper converts Dify records into Mindseeker chat history messages with:

- `role: "user"` for `query`
- `role: "assistant"` for `answer`

---

## 4. Conversation delete

### Endpoint

- `DELETE {DIFY_API_BASE_URL}/conversations/{conversationId}`

### Auth header

```http
Authorization: Bearer <DIFY_API_KEY>
Content-Type: application/json
```

### Request body

```json
{
  "user": "<Supabase user.id>"
}
```

---

## Current BFF behavior summary

The current system uses Dify as a chat backend with explicit conversation handling in the BFF.

Current important points:

- The chat request uses `chat-messages`
- The BFF passes `user` explicitly as `Supabase user.id`
- The BFF passes `conversation_id` explicitly when it exists
- The BFF does not currently send planning function calls like `create_goal`
- The BFF does not currently send `inputs.user_id`

