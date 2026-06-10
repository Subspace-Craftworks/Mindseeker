# Direct Dify HTTP Fixtures

These fixtures are sent directly to the Dify HTTP API.

## Current fixtures

- `clear_current_goal.json`
- `complete_goal.json`
- `create_event.json`
- `create_goal.json`
- `create_issue.json`
- `create_subject.json`
- `create_task.json`
- `get_goal.json`
- `get_subject.json`
- `list_events.json`
- `list_goals.json`
- `list_issues.json`
- `list_subjects.json`
- `list_tasks.json`
- `set_current_goal.json`
- `summarize_context.json`
- `update_goal.json`
- `update_issue.json`
- `update_subject.json`
- `update_task.json`

## How to use

Use `run-dify-test-case.ps1` with one of these files.

The fixture should contain a direct HTTP request shape:

- `method`
- `path`
- `headers` if needed
- `query` if needed
- `body` if needed

## Example

```powershell
.\dify\dify-test-data\run-dify-test-case.ps1 -DataFile .\dify\dify-test-data\chat-messages\create_goal.json
```
