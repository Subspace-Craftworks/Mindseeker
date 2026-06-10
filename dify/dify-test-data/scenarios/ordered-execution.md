# Ordered Execution Scenario

Updated: 2026-06-10

この文書は、`dify/dify-test-data/chat-messages/` にある direct HTTP fixture を、依存関係を意識して順番に実行するためのガイドです。

## 基本方針

- まず読み取り系で現在状態を確認する
- 次に `create_goal` で新規作成を試す
- その後、作成した Goal を前提に更新系を実行する
- `complete_goal` は最後に実行する

## 推奨順序

1. `list_goals.json`
   - 現在の Goal の一覧を確認する
2. `create_goal.json`
   - 新しい Goal を作成する
3. `list_goals.json`
   - 作成後の一覧を再確認する
4. `get_goal.json`
   - 作成した Goal の詳細を確認する
   - `query` 内の Goal ID は、`create_goal` の結果に合わせて必要に応じて差し替える
5. `update_goal.json`
   - 同じ Goal を更新する
   - `query` 内の Goal ID は、`create_goal` の結果に合わせて必要に応じて差し替える
6. `summarize_context.json`
   - 直近の Goal 状態が要約に反映されるか確認する
7. `create_subject.json`
8. `get_subject.json`
9. `update_subject.json`
10. `create_issue.json`
11. `update_issue.json`
12. `create_task.json`
13. `update_task.json`
14. `list_subjects.json`
15. `list_issues.json`
16. `list_tasks.json`
17. `create_event.json`
18. `list_events.json`
19. `complete_goal.json`
   - ここで対象 Goal を完了状態にする

## 実行時の注意

- `get_goal.json`、`update_goal.json`、`create_subject.json`、`get_subject.json`、`update_subject.json`、`create_issue.json`、`update_issue.json`、`create_task.json`、`update_task.json`、`complete_goal.json` は、固定 ID を前提にした文面になっていることがあります。
- そのまま実行できない場合は、直前の `create_goal` で得た ID や、現在の環境にある既存 ID に置き換えてください。
- `list_*` 系は読み取り専用なので、前後比較に向いています。
- `complete_goal.json` は状態を戻しにくいので、最後に回すのが安全です。

## 実行例

```powershell
.\dify\dify-test-data\run-dify-test-case.ps1 -DataFile .\dify\dify-test-data\chat-messages\list_goals.json
.\dify\dify-test-data\run-dify-test-case.ps1 -DataFile .\dify\dify-test-data\chat-messages\create_goal.json
.\dify\dify-test-data\run-dify-test-case.ps1 -DataFile .\dify\dify-test-data\chat-messages\list_goals.json
```
