# context-api: set_current_goal

## Purpose
Update the current goal for the active conversation.

## Parameters
- Required:
  - `conversation_id`
- Optional:
  - `goal_id`

## Notes
- Updates `chat_threads.current_goal_id`.
- Omit `goal_id` or pass an empty value to clear the current goal.
- Pass `sys.conversation_id` as `conversation_id`.
