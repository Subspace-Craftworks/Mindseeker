# Dify Action Test Cases

These fixtures are for testing Dify-facing behavior through the BFF chat flow.

Each file contains:

- the BFF chat request payload under `bff_request`
- the intended tool/action that Dify should select under `expected_tool_call`
- the params that should be passed to the tool under `expected_tool_call.params`

Do not read `expected_tool_call` as the BFF request payload. It is the expected Dify-side tool emission.

## Structure

- `planning-api/*.json`
- `context-api/*.json`
- `scenarios/*.md`

## Notes

- These are not direct Supabase Edge Function requests.
- They are chat prompts that should cause Dify to choose the corresponding tool/action.
- `user` in the BFF request is the resolved application user ID.
- `user_id` inside tool params should be treated as that same resolved value.
- The expected `action` and `params` must be compared against the OpenAPI source of truth in:
  - `dify/planning-api.openapi.yaml`
  - `dify/context-api.openapi.yaml`

## Scenario guide

For a full end-to-end coverage pass, see:

- `dify/bff-test-data/scenarios/full_coverage.md`
