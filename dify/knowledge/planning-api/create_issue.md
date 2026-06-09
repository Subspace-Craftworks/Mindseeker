# planning-api: create_issue

## Purpose
Create a new issue under a subject.

## Parameters
- Required:
  - `user_id`
  - `subject_id`
  - `title`
- Optional:
  - `description`
  - `status` (default `open`)
  - `severity` (default `medium`)

## Notes
- `user_id` must be the actual Mindseeker application `user_id` value passed into Dify.
- Do not send the literal string `{{user_id}}`.
