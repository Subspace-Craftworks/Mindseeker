# FE+BFF Implementation Plan - Phase 2

This file tracks the second implementation wave for the Mindseeker product UI and day-to-day application behavior.

## Goal

Build the actual end-user experience on top of the working FE/BFF, Supabase, Vercel, and Dify foundation.

## Scope

1. Authentication completion
2. Chat workspace implementation
3. Goals workspace implementation
4. Thread and session UX
5. Production polish and operational hardening

## Deliverables

- Fully working login and sign-out flow
- Auth-gated routing and session handling
- Functional chat UI backed by the BFF and Dify
- Goal list and goal detail screens backed by the BFF
- Thread list, thread delete, and thread title UX
- Production-ready loading, empty, and error states

## Work Items

### 1. Authentication completion

- Add a proper authenticated app shell.
- Redirect unauthenticated users to `/login`.
- Redirect authenticated users away from `/login` when appropriate.
- Add sign-out behavior.
- Confirm OAuth redirect flow after Supabase callback.

### 2. Chat workspace implementation

- Replace the placeholder chat page with a real chat UI.
- Show message history for the active thread.
- Add message composer and send action.
- Call the BFF chat route from the FE.
- Render Dify responses in the conversation view.
- Handle loading, retry, and error states.

### 3. Goals workspace implementation

- Build the Goals list page from BFF data.
- Build a Goal detail page with subjects, issues, tasks, and events.
- Add create/edit UX where appropriate.
- Keep the UI aligned with the data model already used by the BFF.

### 4. Thread and session UX

- Show thread list in the chat workspace.
- Allow thread selection and deletion.
- Keep the active thread in sync with the URL or local state.
- Update thread titles after the conversation stabilizes.

### 5. Production polish and operational hardening

- Add better empty states and copy.
- Improve error handling and retry paths.
- Verify the app works with Vercel Production and Preview environments.
- Verify Supabase auth and BFF requests end to end in the browser.
- Keep implementation compatible with the current Supabase key migration path.

## Suggested Order

1. Auth shell and routing
2. Chat UI
3. Thread UX
4. Goals UI
5. Polish and verification

## Immediate Next Tasks

### Task 1: Auth shell and route protection

- Add a shared app shell for authenticated pages.
- Redirect unauthenticated users to `/login`.
- Redirect authenticated users away from `/login` when already signed in.
- Add sign-out in the app shell or header.
- Verify OAuth callback lands in the authenticated area.

### Task 2: Chat UI skeleton

- Replace the placeholder chat page with a usable layout.
- Add the left-side thread list area.
- Add the main conversation area.
- Add the message composer at the bottom.
- Wire the page to the BFF chat route without final styling polish.

### Task 3: Basic chat data flow

- Fetch thread list from the BFF.
- Create or reuse an active thread.
- Send a message through the BFF.
- Render assistant responses in the conversation area.
- Confirm the Dify roundtrip works end to end.

### Task 4: Goals page basics

- Replace the placeholder goals page with a list view.
- Fetch goals from the BFF.
- Add goal selection and a simple detail panel.
- Keep the first version read-only if needed.

### Task 5: Verification and cleanup

- Run `npm run typecheck`.
- Run `npm run build`.
- Test the auth flow in the browser.
- Test one chat exchange in production or preview.
- Clean up any temporary UI scaffolding.

## Notes

- Phase 1 is already complete and provides the foundation for this work.
- Phase 2 should avoid changing the underlying BFF contract unless the UI requires it.
- Dify should remain behind the BFF boundary.
- Keep future Supabase key migration concerns documented but out of the critical path.

## Progress Log

- 2026-06-06: Task 1 started and the auth shell / route protection foundation was implemented.
- 2026-06-06: `@supabase/ssr` was added to support server-side session handling and middleware auth checks.
- 2026-06-06: `middleware.ts` was added to protect `/chat` and `/goals`, and to redirect authenticated users away from `/login`.
- 2026-06-06: Shared app shell UI with sign-out was added for authenticated pages.
- 2026-06-06: `login`, `chat`, and `goals` pages now use server-side auth checks.
- 2026-06-06: `npm run typecheck` and `npm run build` both passed after the auth shell implementation.
- 2026-06-06: Task 2 started and the chat workspace shell was implemented with thread list, composer, and conversation panes.
- 2026-06-06: Task 3 started and the chat workspace was wired to the BFF chat and thread APIs.
- 2026-06-06: Thread deletion, optimistic message display, and assistant response rendering were added to the chat workspace.
- 2026-06-06: `npm run typecheck` and `npm run build` both passed after the chat workspace implementation.
- 2026-06-06: OAuth login redirect was corrected to use `/auth/callback?next=/chat` instead of redirecting directly to `/chat`.
- 2026-06-06: An auth callback route was added to exchange the OAuth code for a session before redirecting into the app.
- 2026-06-06: Login page now surfaces callback errors for easier diagnosis.
- 2026-06-06: `npm run typecheck` and `npm run build` both passed after the login fix.
- 2026-06-06: Login panel now explicitly reads the OAuth redirect URL and performs `window.location.assign(...)` for clearer navigation behavior.
- 2026-06-06: `npm run typecheck` and `npm run build` both passed after the login panel fallback fix.
- 2026-06-06: Browser-side Supabase client was changed to use direct `NEXT_PUBLIC_*` references instead of dynamic env lookup so Next.js can inline them correctly.
- 2026-06-06: `npm run typecheck` and `npm run build` both passed after the browser env fix.
- 2026-06-06: OAuth callback route was updated to write the session cookies into the redirect response before forwarding to `/chat`.
- 2026-06-06: `npm run typecheck` and `npm run build` both passed after the callback cookie fix.
- 2026-06-07: Streaming chat output was wired from the BFF into the FE so assistant replies render incrementally.
- 2026-06-07: The Goals workspace was connected to the authenticated `/goals` page, giving the app a read-only list/detail surface for goals, subjects, issues, tasks, and events.
- 2026-06-07: New chat conversations now load the Dify opening statement through the BFF and show it in the empty draft thread.
- 2026-06-07: `chat_threads.current_goal_id` was added and the chat sidebar context map now follows the active thread's focused Goal.

## Work Memo

### Completed

- Auth shell and route protection are in place.
- OAuth login and callback flow work end to end.
- The browser Supabase client is wired for SSR-compatible session handling.
- The chat workspace is implemented with a thread list, composer, and message area.
- Dify chat requests are wired through the BFF and the reply text is rendered in the chat UI.
- Thread deletion is available from the chat workspace.
- Thread selection now loads the selected conversation history from the BFF.
- Streaming chat responses are rendered incrementally in the FE.
- The Goals workspace is now connected to the `/goals` page with a read-only list/detail view.
- New chat conversations now show the Dify opening statement from the BFF.
- The chat sidebar context map can now follow the active thread's current Goal.
- Production deployment is live and working.

### Remaining

- Streaming-style response rendering in the FE.
- Verification and cleanup for the final phase2 pass.
- Optional polish for thread title refresh behavior and loading/error states.
