# Action Cases

These fixtures describe the BFF's upstream request to Dify and the Dify tool/action response they should trigger.

Important:

- `bff_request` is the payload that the BFF sends to `POST /chat-messages`.
- It is **not** the FE-to-BFF request body.
- The FE-to-BFF request body lives in the `app/api/chat/route.ts` contract and uses `{ message, conversation_id }`.

## What is in each file

- `bff_request`
  - The chat request the BFF sends to Dify.
- `expected_tool_call`
  - The action and params Dify should emit after the model selects a tool.

## Related docs

- `dify/BFF_DIFY_INTERFACE_SPEC.md`
  - BFF-to-Dify transport contract
- `dify/DIFY_TOOL_ACTION_SPEC.md`
  - Dify tool/action contract and layer separation
- `dify/planning-api.openapi.yaml`
- `dify/context-api.openapi.yaml`
