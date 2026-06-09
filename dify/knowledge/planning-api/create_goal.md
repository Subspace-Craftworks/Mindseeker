# planning-api: create_goal

## Purpose
Create a new goal.

## Parameters
- Required:
  - `user_id`
  - `title`
- Optional:
  - `description`
  - `status` (default `active`)

## Notes
- `user_id` must be the actual Mindseeker application `user_id` value passed into Dify.
- Do not send the literal string `{{user_id}}`.
- Use a short, clear title.
