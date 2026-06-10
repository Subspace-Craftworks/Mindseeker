# BFF -> Dify Full Coverage Send Scenario

This document is a send scenario for the BFF chat flow.

Its purpose is to define the message payloads that the BFF sends to Dify so that Dify can select the corresponding tool/action.

Source of truth for the tool/action names and emitted params:

- `dify/planning-api.openapi.yaml`
- `dify/context-api.openapi.yaml`

## What this scenario is

- A sequence of BFF-to-Dify chat requests
- Coverage for all planning-api and context-api actions
- A way to verify that the BFF sends the right user-facing message, conversation context, and user ID to Dify

## What this scenario is not

- It is not a direct Supabase Edge Function request spec
- It is not the Dify-side tool/action emission spec
- It is not a workflow-run payload spec

## Shared request shape

Every step in this scenario uses the BFF chat payload shape:

```json
{
  "query": "<user message>",
  "response_mode": "streaming",
  "conversation_id": "<existing conversation id or empty string>",
  "user": "<resolved application user id>",
  "auto_generate_name": true
}
```

## Scenario goals

Cover the full action set:

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
- `complete_goal`
- `set_current_goal`

## Test data assumptions

- `user` in the BFF request is the authenticated Mindseeker application user ID.
- `conversation_id` is empty for a new thread and reused after the first response.
- IDs returned by create operations are reused in later steps.

## Step-by-step send scenario

### 1. List existing goals

Send:

```json
{
  "query": "現在のGoalを一覧で見せてください。activeなものを中心に確認したいです。",
  "response_mode": "streaming",
  "conversation_id": "",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 2. Create a goal

Send:

```json
{
  "query": "新しいGoalを作成してください。タイトルは「Difyテスト用Goal」、説明は「Difyの create_goal 動作確認用」です。",
  "response_mode": "streaming",
  "conversation_id": "",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 3. Inspect the created goal

Send:

```json
{
  "query": "さっき作ったGoalの詳細を見せてください。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 4. Update the goal

Send:

```json
{
  "query": "そのGoalのタイトルを「Difyテスト用Goal updated」に変更してください。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 5. List subjects under the goal

Send:

```json
{
  "query": "このGoalに紐づくSubjectを一覧してください。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 6. Create a subject

Send:

```json
{
  "query": "このGoalに Subject を作ってください。タイトルは「Difyテスト用Subject」です。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 7. Inspect the created subject

Send:

```json
{
  "query": "さっき作ったSubjectの詳細を見せてください。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 8. Update the subject

Send:

```json
{
  "query": "そのSubjectのタイトルを「Difyテスト用Subject updated」に変更してください。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 9. List issues

Send:

```json
{
  "query": "このGoalに紐づくIssueを一覧してください。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 10. Create an issue

Send:

```json
{
  "query": "このSubjectに Issue を作ってください。タイトルは「Difyテスト用Issue」です。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 11. Update the issue

Send:

```json
{
  "query": "そのIssueのタイトルを更新してください。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 12. List tasks

Send:

```json
{
  "query": "このGoalに紐づくTaskを一覧してください。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 13. Create a task

Send:

```json
{
  "query": "このIssueに Task を作ってください。タイトルは「Difyテスト用Task」です。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 14. Update the task

Send:

```json
{
  "query": "そのTaskの内容を更新してください。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 15. Record an event

Send:

```json
{
  "query": "この会話の要点をイベントとして記録してください。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 16. List events

Send:

```json
{
  "query": "このGoal周辺のイベントを時系列で一覧してください。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 17. Summarize the context

Send:

```json
{
  "query": "このGoalの現在の状況を要約してください。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 18. Switch the current goal

Send:

```json
{
  "query": "この会話の注目先をこのGoalに切り替えてください。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 19. Clear the current goal

Send:

```json
{
  "query": "この会話の注目先を解除してください。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

### 20. Complete the goal

Send:

```json
{
  "query": "このGoalは完了です。inactive にして、完了イベントも記録してください。",
  "response_mode": "streaming",
  "conversation_id": "<conversation_id from step 1 or 2>",
  "user": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "auto_generate_name": true
}
```

## Verification notes

- The BFF payload in each step is the thing to send to Dify.
- Dify should then choose the tool/action that matches the corresponding OpenAPI spec.
- If you want to verify the tool/action emission, compare it separately against:
  - `dify/planning-api.openapi.yaml`
  - `dify/context-api.openapi.yaml`

## Execution order

1. `list_goals`
2. `create_goal`
3. `get_goal`
4. `update_goal`
5. `list_subjects`
6. `create_subject`
7. `get_subject`
8. `update_subject`
9. `list_issues`
10. `create_issue`
11. `update_issue`
12. `list_tasks`
13. `create_task`
14. `update_task`
15. `create_event`
16. `list_events`
17. `summarize_context`
18. `set_current_goal`
19. `clear_current_goal`
20. `complete_goal`

