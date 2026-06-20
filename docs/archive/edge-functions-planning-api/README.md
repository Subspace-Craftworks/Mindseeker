# planning-api

Single-entry Edge Function for the Goal / Subject / Issue / Task / Event model.

## Environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PLANNING_API_KEY`

## Request format

```json
{
  "action": "create_goal",
  "params": {
    "title": "Azure環境構築",
    "description": "社内向け検証環境を構築する",
    "status": "active"
  }
}
```

## Auth

The function accepts either of these:

- `Authorization: Bearer <PLANNING_API_KEY>`
- `X-Planning-Api-Key: <PLANNING_API_KEY>`

For Dify, prefer the custom header form to avoid the Bearer/custom-header issue in the HTTP Request node.

## Supported actions

- `list_goals`
- `create_goal`
- `get_goal`
- `update_goal`
- `list_subjects`
- `create_subject`
- `get_subject`
- `update_subject`
- `list_issues`
- `create_issue`
- `update_issue`
- `list_tasks`
- `create_task`
- `update_task`
- `create_event`
- `list_events`
- `summarize_context`

## Response format

```json
{
  "ok": true,
  "data": {},
  "error": null
}
```
