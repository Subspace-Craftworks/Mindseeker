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
- This action updates the goal status to `inactive`.
- It also creates a `goal_completed` event.
