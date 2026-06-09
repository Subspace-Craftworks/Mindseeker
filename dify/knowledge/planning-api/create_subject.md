# planning-api: create_subject

## Purpose
Create a new subject under a goal.

## Parameters
- Required:
  - `user_id`
  - `goal_id`
  - `title`
- Optional:
  - `description`
  - `status` (default `open`)
  - `priority` (default `normal`)

## Notes
- `user_id` must be the actual Mindseeker application `user_id` value passed into Dify.
- Do not send the literal string `{{user_id}}`.
