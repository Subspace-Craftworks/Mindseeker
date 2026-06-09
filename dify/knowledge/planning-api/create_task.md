# planning-api: create_task

## Purpose
Create a new task.

## Parameters
- Required:
  - `user_id`
  - `subject_id`
  - `title`
- Optional:
  - `issue_id`
  - `description`
  - `status` (default `todo`)
  - `due_date`
  - `assignee`

## Notes
- `user_id` must be the actual Mindseeker application `user_id` value passed into Dify.
- Do not send the literal string `{{user_id}}`.
