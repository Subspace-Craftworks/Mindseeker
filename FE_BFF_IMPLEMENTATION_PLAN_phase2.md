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

## Notes

- Phase 1 is already complete and provides the foundation for this work.
- Phase 2 should avoid changing the underlying BFF contract unless the UI requires it.
- Dify should remain behind the BFF boundary.
- Keep future Supabase key migration concerns documented but out of the critical path.

