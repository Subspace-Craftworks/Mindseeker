# planning-api: complete_goal

## Purpose
Mark a goal as completed and record the completion event.

## Parameters
- Required:
  - `goal_id`
  - `user_id`
- Optional:
  - `reason`
  - `note`
  - `body`
  - `event_title`
  - `source`
  - `occurred_at`

## Notes
- `user_id` must be the actual Mindseeker application `user_id` value passed into Dify.
- Do not send the literal string `{{user_id}}`.
- This action updates the goal status to `inactive`.
- It also creates a `goal_completed` event.
