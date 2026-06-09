# BFF -> Dify Test Data

This folder contains request fixtures for Dify-facing tests through the BFF.

There are two layers:

- `action-cases/`
  - Chat prompts that should cause Dify to select a specific planning/context action.
  - This is the main test set for Dify behavior.
- legacy HTTP fixtures at the top level
  - Lower-level request shapes for the current BFF-to-Dify transport.

## Included endpoints in the legacy HTTP fixtures

- `POST /chat-messages`
- `GET /parameters`
- `GET /messages`
- `DELETE /conversations/{conversationId}`

## Included action cases

- all planning-api actions from `planning-api.openapi.yaml`
- the `set_current_goal` context-api action, plus a clear-state variant

## Structure

Each JSON file contains:

- action-cases:
  - `function_name`
  - `api`
  - `action`
  - `bff_request`
  - `expected_tool_call`
- legacy HTTP fixtures:
  - `name`
  - `method`
  - `path`
  - `headers`
  - `query`
  - `body`

## How to use the action cases

Use the prompts to drive Dify through the BFF and then compare the invoked tool/action against `expected_tool_call`.

## How to use the legacy HTTP fixtures

Use the runner to execute a single transport-level fixture:

```powershell
.\dify\bff-test-data\run-bff-test-case.ps1 -DataFile .\dify\bff-test-data\chat-messages\new-conversation.json
```

## Notes

- The action cases intentionally use sample IDs.
- Replace the IDs with real values if you want to observe real data changes.
- The current BFF source uses `DIFY_API_KEY`, not `dify_api_key_2`.
- These fixtures reflect the current code path in `app/api/chat/route.ts`, `app/api/chat/opening-statement/route.ts`, and `lib/dify.ts`.
