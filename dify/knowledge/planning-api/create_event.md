# planning-api: create_event

## Purpose
Create an event record.

## Parameters
- Required:
  - `user_id`
  - `event_type`
  - `title`
- Optional:
  - `goal_id`
  - `subject_id`
  - `issue_id`
  - `task_id`
  - `body`
  - `source` (default `planning-api`)
  - `occurred_at`

## Notes
- `occurred_at` must be a valid date-time string if provided.
- `user_id` must be the actual Mindseeker application `user_id` value passed into Dify.
- Do not send the literal string `{{user_id}}`.
