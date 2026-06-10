# Dify Test Data

This folder currently contains Dify action-case fixtures, direct Dify HTTP fixtures, and a runner for direct Dify HTTP fixtures.

## Layout

- `run-dify-test-case.ps1`
  - Runs a direct HTTP fixture against Dify.
- `chat-messages/`
  - Direct Dify `POST /chat-messages` fixtures.
- `action-cases/`
  - BFF chat prompts that should cause Dify to select a specific tool/action.
- `scenarios/`
  - Ordered execution guides for running fixtures safely.

## Direct Dify fixtures

Use `run-dify-test-case.ps1` with files that contain a direct HTTP request shape:

- `method`
- `path`
- `headers` if needed
- `query` if needed
- `body` if needed

The runner reads the API key from:

- `dify/.secrets/api-key`

## Action cases

The files under `action-cases/` are not direct Dify HTTP fixtures.

They are action-spec fixtures that contain the BFF's upstream request to Dify and the expected Dify-side tool/action.

Important:

- They are **not** the FE-to-BFF request body.
- They mirror the BFF's payload sent to `POST /chat-messages` in `app/api/chat/route.ts`.
- The FE-to-BFF request body is `{ message, conversation_id }` when the app calls `/api/chat`.

Each action-case contains:

- `bff_request`
  - The BFF-to-Dify transport payload.
- `expected_tool_call`
  - The Dify-side action and params expected after the model chooses a tool.

Use `bff_request.body.query` as the prompt that the BFF forwards to Dify.
Compare the emitted tool/action against `expected_tool_call`.

For the tool/action schema itself, see:

- `dify/planning-api.openapi.yaml`
- `dify/context-api.openapi.yaml`
- `dify/DIFY_TOOL_ACTION_SPEC.md`

## Scenarios

For a recommended execution order that takes dependencies into account, see:

- `dify/dify-test-data/scenarios/ordered-execution.md`
