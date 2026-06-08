# planning-api Parameters

This document is the source-aligned parameter reference for `supabase/functions/planning-api/index.ts`.

## Top-level request shape

```json
{
  "action": "list_goals",
  "params": {}
}
```

- `action`: required
- `params`: optional object, action-specific

## Shared notes

- Empty strings are treated as `null` by `cleanString()`.
- List endpoints support `limit` with the defaults and bounds described below.
- Detail/update actions use the entity-specific identifier fields only. Do not use a generic `id` field in Dify.

## Action parameter reference

### `list_goals`

- Required: none
- Optional:
  - `status`
  - `limit` (default `20`, min `1`, max `100`)

### `create_goal`

- Required:
  - `user_id`
  - `title`
- Optional:
  - `description`
  - `status` (default `active`)

### `get_goal`

- Required:
  - `goal_id`

### `update_goal`

- Required:
  - `goal_id`
- Optional:
  - `title`
  - `description`
  - `status`

### `complete_goal`

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

### `list_subjects`

- Required: none
- Optional:
  - `goal_id`
  - `status`
  - `priority`
  - `limit` (default `20`, min `1`, max `100`)

### `create_subject`

- Required:
  - `user_id`
  - `goal_id`
  - `title`
- Optional:
  - `description`
  - `status` (default `open`)
  - `priority` (default `normal`)

### `get_subject`

- Required:
  - `subject_id`

### `update_subject`

- Required:
  - `subject_id`
- Optional:
  - `goal_id`
  - `title`
  - `description`
  - `status`
  - `priority`

### `list_issues`

- Required: none
- Optional:
  - `goal_id`
  - `subject_id`
  - `status`
  - `severity`
  - `limit` (default `20`, min `1`, max `100`)

### `create_issue`

- Required:
  - `user_id`
  - `subject_id`
  - `title`
- Optional:
  - `description`
  - `status` (default `open`)
  - `severity` (default `medium`)

### `update_issue`

- Required:
  - `issue_id`
- Optional:
  - `subject_id`
  - `title`
  - `description`
  - `status`
  - `severity`

### `list_tasks`

- Required: none
- Optional:
  - `goal_id`
  - `subject_id`
  - `issue_id`
  - `status`
  - `limit` (default `20`, min `1`, max `100`)

### `create_task`

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

### `update_task`

- Required:
  - `task_id`
- Optional:
  - `issue_id`
  - `subject_id`
  - `title`
  - `description`
  - `status`
  - `due_date`
  - `assignee`

### `create_event`

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
  - `occurred_at` (must be a valid date-time string if provided)

### `list_events`

- Required: none
- Optional:
  - `goal_id`
  - `subject_id`
  - `issue_id`
  - `task_id`
  - `event_type`
  - `source`
  - `from`
  - `to`
  - `limit` (default `50`, min `1`, max `200`)

### `summarize_context`

- Required:
  - `goal_id` or `subject_id`
- Optional:
  - none

## Canonical identifier fields

Use these names consistently in Dify:

- `goal_id` for goal-scoped relations
- `subject_id` for subject-scoped relations
- `issue_id` for issue-scoped relations
- `task_id` for task-scoped relations
- `conversation_id` for context API updates

Do not send a generic `id` field.

## Recommended Dify mapping

- Use `X-Planning-Api-Key` as the auth header.
- When creating or logging records, pass the Mindseeker application `user_id` input variable as `user_id`.
- When completing a goal, use `complete_goal` with the same `user_id` so the completion event is recorded.
- When updating the active conversation focus, use the separate context API with `sys.conversation_id` as `conversation_id` and the selected goal's `goal_id`.
- Send the body as:

```json
{
  "action": "<action_name>",
  "params": {
    "...": "..."
  }
}
```
