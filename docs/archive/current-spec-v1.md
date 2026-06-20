# Mindseeker Current Specification

Updated: 2026-06-10

This document describes the implemented behavior in the current codebase.
It is intentionally limited to features that already exist.

## 1. Product Shape

Mindseeker is a Supabase-backed Next.js app with:

- Supabase Auth for user login
- Vercel-hosted frontend and BFF routes
- Dify as the AI workflow backend
- Supabase PostgreSQL as the persistence layer

The application uses Supabase Auth as the only user identity source.
All app-level data is scoped by Supabase user ID.

## 2. Authentication

### Login

- `/login` is the sign-in entry point.
- Users can sign in with Google or GitHub.
- OAuth redirect goes through `/auth/callback` and then lands in `/chat` by default.
- If a user is already signed in, `/login` redirects to `/chat`.

### Session model

- Client-side session reads use the Supabase browser client.
- Server-side user checks use the Supabase server client or a bearer token passed to BFF routes.
- Protected pages redirect unauthenticated users to `/login`.

### Sign out

- The authenticated app shell exposes a sign-out button.
- Sign-out clears the Supabase browser session and sends the user back to `/login`.

## 3. App Shell

The authenticated pages share a common shell.

### Visible behavior

- Shows the Mindseeker brand
- Shows the signed-in email when available
- Provides navigation to `Chat` and `Goals`
- Provides a sign-out action

### Protected pages

- `/chat`
- `/goals`

## 4. Chat Workspace

### Page behavior

- `/chat` is the main interactive workspace after login.
- The page loads thread state, opening statement text, and context data from BFF routes.
- The UI is a two-column layout:
  - left: thread list and context preview
  - right: conversation view and composer

### Thread behavior

- Threads are loaded from `/api/chat/threads`.
- The most recently updated thread is shown first.
- The first thread becomes the active thread when nothing is selected yet.
- Thread detail is loaded from `/api/chat/threads/[id]`.
- Thread delete removes the Dify conversation and the local Supabase record.

### Message flow

- Messages are sent to `/api/chat`.
- The route forwards the request to Dify with streaming response mode.
- The client consumes SSE events and updates the conversation in real time.
- The final assistant answer is stored after the stream completes.
- For the layered request flow from FE to BFF to Dify, see `docs/fe-bff-dify-flow.md`.

### Conversation history

- Message history is fetched from Dify through the BFF thread detail route.
- User and assistant messages are normalized into a single chronological timeline.

### Opening statement

- The UI fetches `/api/chat/opening-statement`.
- The route returns the Dify app opening statement when one is configured.
- If the opening statement is missing or empty, the UI simply omits it.

### Context map

- The UI fetches `/api/context-map`.
- When the active thread has a current goal, the context map focuses on that goal.
- When no thread goal is set, the route returns a goal overview list for the user.

### Visual and state handling

- Loading states are shown while threads and details are being fetched.
- Error states are shown in the main workspace when a request fails.
- Markdown rendering is supported in assistant messages.

## 5. Goals Workspace

### Page behavior

- `/goals` shows the user’s goals in a left sidebar and goal detail in the main panel.
- The first goal in the list becomes selected by default when available.

### Data flow

- Goal list is loaded from `/api/goals`.
- Goal detail is loaded from `/api/goals/[id]`.
- Both routes require a valid Supabase bearer token.

### Goal detail shape

- The detail view includes:
  - goal record
  - subjects
  - issues
  - tasks
  - events
- The screen is currently read-only.
- The UI renders compact summaries of each record and falls back to raw JSON when no obvious text fields are available.

### Create support

- The BFF supports `POST /api/goals`.
- The current UI does not expose a create form yet.

## 6. BFF API Contract

### Shared auth rule

- All protected BFF routes require an `Authorization: Bearer <supabase_access_token>` header.
- The BFF validates the token through Supabase before continuing.

### Implemented routes

- `GET /api/chat/threads`
- `GET /api/chat/threads/[id]`
- `DELETE /api/chat/threads/[id]`
- `POST /api/chat`
- `GET /api/chat/opening-statement`
- `GET /api/context-map`
- `GET /api/goals`
- `POST /api/goals`
- `GET /api/goals/[id]`

### Error shape

- Successful responses use `{ ok: true, data, error: null }`.
- Failures use `{ ok: false, error: { code, message } }`.
- Unauthorized access returns `401`.
- Missing records return `404`.
- Upstream failures are logged and usually surfaced as `500` or `502`.

## 7. Data Model

### chat_threads

Current fields used by the app:

- `id`
- `user_id`
- `dify_conversation_id`
- `title`
- `app_key`
- `current_goal_id`
- `created_at`
- `updated_at`

### goals

Current fields used by the app:

- `id`
- `user_id`
- `title`
- `description`
- `status`
- `created_at`
- `updated_at`

### application_logs

- Application errors are inserted into `application_logs`.
- Logs capture component, route, request ID, user ID, and details payloads.

## 8. Operational Notes

- Dify credentials stay server-side only.
- The app uses a Supabase service client for server-side data access where needed.
- The chat route streams Dify responses as SSE events to the client.
- App errors are recorded centrally so BFF failures are easier to inspect.
