# Open Issues

Updated: 2026-06-10

This file should contain only the remaining work and known gaps.
When an issue is closed, remove it from here instead of leaving it in a plan doc.

## 1. Chat thread deletion resilience

- `DELETE /api/chat/threads/[id]` deletes the Dify conversation first and the local thread second.
- If Dify deletion fails, the whole request fails and the local record remains.
- We may want a safer cleanup strategy if upstream deletion is flaky.

## 2. Goal detail query shaping

- `getGoalDetail()` loads all user issues and tasks, then filters them in memory.
- This is fine for the current data size, but it is not the tightest query shape.
- If the dataset grows or relation rules get stricter, the query should be narrowed at the database level.

## 3. Current goal editing flow

- The app can read `current_goal_id` from `chat_threads`.
- There is no explicit in-UI control yet for assigning or changing the current goal from the chat workspace.
- If goal switching becomes a core interaction, the chat UI needs a direct control path.

## 4. Goals UI write actions

- The BFF already supports `POST /api/goals`.
- The current Goals screen is read-only and does not expose create/edit actions.
- If interactive goal editing becomes necessary, the screen needs a proper form flow.

## 5. Context overview when no thread is focused

- `/api/context-map` returns a full goal overview list when no thread current goal is set.
- That behavior is useful, but it may need refinement if the chat UI later needs richer context summaries.

