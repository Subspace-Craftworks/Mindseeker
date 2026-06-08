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
