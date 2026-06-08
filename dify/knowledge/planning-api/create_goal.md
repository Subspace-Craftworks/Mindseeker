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
- `user_id` must be the Mindseeker application `user_id` input variable.
- Use a short, clear title.
