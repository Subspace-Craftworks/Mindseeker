# Dify Tool / Action Specification

This document describes the Dify-side tool/action contract used by the Mindseeker project.

It is separate from the BFF transport spec:

- `BFF_DIFY_INTERFACE_SPEC.md` describes what the BFF sends to Dify over HTTP.
- This document describes what Dify should emit when it selects a tool/action.
- The actual action schemas are defined by the OpenAPI files.

## Source of truth

The function names, arguments, and required fields come from:

- `dify/planning-api.openapi.yaml`
- `dify/context-api.openapi.yaml`

Those files define:

- available `action` names
- required and optional `params`
- request payload shape for the downstream Supabase Edge Functions

## Layer separation

There are three distinct layers:

1. BFF-to-Dify request payload
   - The chat request body that the BFF sends to Dify.
2. Dify-side tool/action emission
   - The `action` and `params` that Dify should emit when it chooses a tool.
3. Supabase Edge Function request payload
   - The direct `action`/`params` body described by the OpenAPI files.

Keep those layers separate when reading or writing tests.

## Action cases

The fixtures under `dify/dify-test-data/action-cases/` describe the BFF-facing prompt and the Dify-side tool/action expectation.

They are not direct HTTP fixtures.

## Practical usage

- Use the `bff_request.body.query` text as the prompt that should cause Dify to choose an action.
- Compare Dify's selected `action` and `params` with the fixture's `expected_tool_call`.
- Verify tool/action payload details against the OpenAPI files, not against the BFF transport doc.

## Direct HTTP fixtures

The direct Dify HTTP fixture for `create_goal` lives under:

- `dify/dify-test-data/chat-messages/create_goal.json`

That file is for testing the Dify transport shape directly and does not belong to the action-case spec.
