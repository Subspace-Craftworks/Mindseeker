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
- `user_id` must be passed from the Mindseeker `user_id` input variable.
