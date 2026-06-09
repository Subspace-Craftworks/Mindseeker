# Dify Test Data

This folder contains one runnable request fixture per function.

These fixtures are for direct testing of the Supabase Edge Functions, not the BFF-to-Dify chat payload.

## Structure

- `planning-api/*.json`
- `context-api/*.json`
- `run-test-case.ps1`

Each JSON file contains:

- `function_name`
- `api`
- `action`
- `params`

The `action` and `params` values mirror the prompt, tool definitions, and parameter docs.

For the current BFF-to-Dify interface, see:

- `dify/BFF_DIFY_INTERFACE_SPEC.md`

## How to run

Use the PowerShell runner to post a single fixture to the matching Supabase Edge Function:

```powershell
.\dify\test-data\run-test-case.ps1 -DataFile .\dify\test-data\planning-api\create_goal.json
```

Examples:

```powershell
.\dify\test-data\run-test-case.ps1 -DataFile .\dify\test-data\planning-api\list_goals.json
.\dify\test-data\run-test-case.ps1 -DataFile .\dify\test-data\planning-api\complete_goal.json
.\dify\test-data\run-test-case.ps1 -DataFile .\dify\test-data\context-api\set_current_goal.json
```

## Notes

- The UUIDs in these fixtures are sample values.
- For `get_*`, `update_*`, and `complete_goal`, replace the IDs with real records if you want a successful mutation against live data.
- The runner uses `.secrets/planning_api_key` and posts to the current Supabase Edge Function endpoints.
