# context-api Parameters

This document is the source-aligned parameter reference for `supabase/functions/context-api/index.ts`.

## Top-level request shape

```json
{
  "action": "set_current_goal",
  "params": {}
}
```

- `action`: required
- `params`: optional object, action-specific

## Action parameter reference

### `set_current_goal`

- Required:
  - `conversation_id`
- Optional:
  - `goal_id`
- Behavior:
  - Updates `chat_threads.current_goal_id` for the row matched by `dify_conversation_id`
  - Omit `goal_id` or pass an empty value to clear the current goal

## Recommended Dify mapping

- Use `X-Planning-Api-Key` as the auth header for now.
- Pass `sys.conversation_id` as `conversation_id`.
- Pass the selected goal's `goal_id` when switching focus.
- Send the body as:

```json
{
  "action": "set_current_goal",
  "params": {
    "...": "..."
  }
}
```
