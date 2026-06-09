# Dify Action Test Cases

These fixtures are for testing Dify-facing behavior through the BFF chat flow.

Each file contains:

- the BFF chat request payload
- the intended tool/action that Dify should select
- the params that should be passed to the tool

## Structure

- `planning-api/*.json`
- `context-api/*.json`
- `scenarios/*.md`

## Notes

- These are not direct Supabase Edge Function requests.
- They are chat prompts that should cause Dify to choose the corresponding tool/action.
- `user` in the BFF request is the resolved application user ID.
- `user_id` inside tool params should be treated as that same resolved value.

## Scenario guide

For a full end-to-end coverage pass, see:

- `dify/bff-test-data/scenarios/full_coverage.md`
