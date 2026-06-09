# BFF -> Dify Full Coverage Scenario

This scenario is designed to exercise all actions defined in:

- `dify/planning-api.openapi.yaml`
- `dify/context-api.openapi.yaml`

The scenario uses the BFF chat flow and expects Dify to select the matching tool/action for each user utterance.

## Goal

Cover every action at least once:

- `planning-api`
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
- `context-api`
  - `set_current_goal`

## Preconditions

- The BFF is connected to Dify via the current chat flow.
- The Dify app is configured with the tool definitions that map to the OpenAPI files above.
- A test user is logged in through the BFF.

## IDs used in this scenario

Use the IDs returned by each create step in the later steps.

- `goal_id`: the ID returned by `create_goal`
- `subject_id`: the ID returned by `create_subject`
- `issue_id`: the ID returned by `create_issue`
- `task_id`: the ID returned by `create_task`
- `conversation_id`: the ID returned by the first chat response

## Conversation flow

### 1. Start by checking existing goals

- User says:
  - `現在のGoalを一覧で見せてください。`
- Expected action:
  - `list_goals`
- Expected params:
  - `status: active`
  - `limit: 20`

### 2. Create a new goal

- User says:
  - `新しいGoalを作成してください。タイトルは「Difyテスト用Goal」、説明は「Difyの create_goal 動作確認用」です。`
- Expected action:
  - `create_goal`
- Expected params:
  - `user_id`
  - `title`
  - `description`
  - `status`

### 3. Inspect the created goal

- User says:
  - `さっき作ったGoalの詳細を見せてください。`
- Expected action:
  - `get_goal`
- Expected params:
  - `goal_id`

### 4. Update the goal

- User says:
  - `そのGoalのタイトルを更新してください。`
- Expected action:
  - `update_goal`
- Expected params:
  - `goal_id`
  - `title`
  - optional `description` or `status` if the prompt includes them

### 5. List subjects under the goal

- User says:
  - `このGoalに紐づくSubjectを一覧してください。`
- Expected action:
  - `list_subjects`
- Expected params:
  - `goal_id`
  - `status`
  - `priority`
  - `limit`

### 6. Create a subject

- User says:
  - `このGoalに Subject を作ってください。タイトルは「Difyテスト用Subject」です。`
- Expected action:
  - `create_subject`
- Expected params:
  - `user_id`
  - `goal_id`
  - `title`
  - optional `description`, `status`, `priority`

### 7. Inspect the created subject

- User says:
  - `さっき作ったSubjectの詳細を見せてください。`
- Expected action:
  - `get_subject`
- Expected params:
  - `subject_id`

### 8. Update the subject

- User says:
  - `そのSubjectのタイトルを更新してください。`
- Expected action:
  - `update_subject`
- Expected params:
  - `subject_id`
  - optional `goal_id`, `title`, `description`, `status`, `priority`

### 9. List issues for the goal or subject

- User says:
  - `このGoalに紐づくIssueを一覧してください。`
- Expected action:
  - `list_issues`
- Expected params:
  - `goal_id`
  - `subject_id` if relevant
  - `status`
  - `severity`
  - `limit`

### 10. Create an issue

- User says:
  - `このSubjectに Issue を作ってください。タイトルは「Difyテスト用Issue」です。`
- Expected action:
  - `create_issue`
- Expected params:
  - `user_id`
  - `subject_id`
  - `title`
  - optional `description`, `status`, `severity`

### 11. Update the issue

- User says:
  - `そのIssueのタイトルを更新してください。`
- Expected action:
  - `update_issue`
- Expected params:
  - `issue_id`
  - optional `subject_id`, `title`, `description`, `status`, `severity`

### 12. List tasks

- User says:
  - `このGoalに紐づくTaskを一覧してください。`
- Expected action:
  - `list_tasks`
- Expected params:
  - `goal_id`
  - `subject_id`
  - `issue_id`
  - `status`
  - `limit`

### 13. Create a task

- User says:
  - `このIssueに Task を作ってください。タイトルは「Difyテスト用Task」です。`
- Expected action:
  - `create_task`
- Expected params:
  - `user_id`
  - `subject_id`
  - `issue_id`
  - `title`
  - optional `description`, `status`, `due_date`, `assignee`

### 14. Update the task

- User says:
  - `そのTaskの内容を更新してください。`
- Expected action:
  - `update_task`
- Expected params:
  - `task_id`
  - optional `issue_id`, `subject_id`, `title`, `description`, `status`, `due_date`, `assignee`

### 15. Record a conversation event

- User says:
  - `この会話の要点をイベントとして記録してください。`
- Expected action:
  - `create_event`
- Expected params:
  - `user_id`
  - `goal_id`
  - `subject_id`
  - `issue_id`
  - `task_id`
  - `event_type`
  - `title`
  - optional `body`, `source`, `occurred_at`

### 16. List events

- User says:
  - `このGoal周辺のイベントを時系列で一覧してください。`
- Expected action:
  - `list_events`
- Expected params:
  - `goal_id`
  - `subject_id`
  - `issue_id`
  - `task_id`
  - `event_type`
  - `source`
  - `from`
  - `to`
  - `limit`

### 17. Summarize the context

- User says:
  - `このGoalの現在の状況を要約してください。`
- Expected action:
  - `summarize_context`
- Expected params:
  - `goal_id`

### 18. Switch the active conversation focus

- User says:
  - `この会話の注目先をこのGoalに切り替えてください。`
- Expected action:
  - `set_current_goal`
- Expected params:
  - `conversation_id`
  - `goal_id`

### 19. Clear the active conversation focus

- User says:
  - `この会話の注目先を解除してください。`
- Expected action:
  - `set_current_goal`
- Expected params:
  - `conversation_id`
  - `goal_id: null`

### 20. Complete the goal

- User says:
  - `このGoalは完了です。inactive にして、完了イベントも記録してください。`
- Expected action:
  - `complete_goal`
- Expected params:
  - `user_id`
  - `goal_id`
  - optional `reason`, `note`, `body`, `event_title`, `source`, `occurred_at`

## Verification checklist

For each step, verify:

- the BFF sends the chat request successfully
- Dify selects the expected action
- the emitted parameters match the OpenAPI spec
- IDs produced by create actions are reused by later steps
- `set_current_goal` writes the selected goal to the current conversation
- `complete_goal` changes the goal status to `inactive`

## Recommended execution order

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

