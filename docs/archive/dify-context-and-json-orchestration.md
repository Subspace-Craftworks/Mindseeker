# Dify Context Injection & JSON Orchestration Flow

Updated: 2026-06-14

このドキュメントは、Next.js BFF と Dify 間で行われる「コンテキストの動的送信」と「Difyが生成したJSONによるデータベース自動更新（オーケストレーション）」の仕組みについて解説します。

## 1. コンテキストの動的送信 (Context Injection)

Dify の AI エージェントが文脈を理解できるように、BFF はユーザーのチャット入力とともに「現在フォーカスしているゴールの状態（コンテキスト）」を Dify に送信します。

### 処理フロー
1. **チャット送信受付**: ユーザーから `/api/chat` にメッセージと `conversation_id` が送られる。
2. **フォーカス目標の特定**: `chat_threads` テーブルから `conversation_id` に紐づく `current_goal_id` を取得する。
3. **コンテキスト文字列の生成**: `lib/mcp/handlers.ts` の `getGoalContextText()` を用いて、対象ゴールに紐づくサブジェクト、イシュー、タスクなどを構造化した文字列 (`currentGoalContextStr`) を組み立てる。
4. **Difyへの送信**: Dify の `POST /chat-messages` API を呼ぶ際、リクエストボディの `inputs` オブジェクトに以下を仕込んで送信する。
   ```json
   {
     "inputs": {
       "current_goal_id": "<ID>",
       "current_goal_context": "<組み立てられたコンテキスト文字列>"
     },
     "query": "<ユーザーのメッセージ>",
     ...
   }
   ```
   *これにより、Dify側のシステムプロンプト内で `{{current_goal_context}}` のような変数として参照可能になります。*

## 2. JSONブロック出力とオーケストレーション (JSON Orchestration)

AIエージェントが自律的にデータベース（目標やタスク）を更新できるように、Mindseeker では「Difyからの出力に含まれる JSON を BFF が解釈して実行する」というパターンを採用しています。

### 処理フロー
1. **Dify側のシステムプロンプト指示**: Difyには「DBを更新する場合は、回答の**最後**に所定のフォーマットでJSONコードブロックを出力せよ」と指示されています（参考: `dify/プロンプト_bff版.md`）。
2. **回答のストリーミング**: BFFはDifyからのレスポンスをフロントエンドにそのままストリーミング配信します（JSON部分も画面上でチャットテキストとして流れます）。
3. **ストリーム完了後のパースと実行**:
   * ストリームが完了した直後、BFF (`app/api/chat/route.ts`) は生成された完全な回答テキスト (`answer`) を `lib/orchestrator.ts` の `executeOperations()` 関数に渡します。
   * `executeOperations()` はテキスト末尾の ` ```json ... ``` ` ブロックを抽出し、パースします。
   * JSON 内の `operations` 配列（例: `action: "create_goal"`, `action: "update_task"` など）の指示に従って、BFF側で直接 Supabase のデータベースを更新処理します。
   * もし JSON のルートに新しい `current_goal_id` が指定されていた場合、そのスレッドのフォーカス対象も自動的に新しいゴールへ切り替えます。

### アーキテクチャ上の利点
* **フロントエンドの単純化**: フロントエンドは「テキストストリームを受け取って表示するだけ」であり、DB更新のための複雑なAPI呼び出しを管理する必要がありません。
* **権限管理の集約**: Difyが直接DB操作のAPI（Edge Functions等）を叩くのではなく、BFFがJSONの内容を一度受け取り、認証済みユーザーのコンテキストで実行 (`lib/orchestrator.ts`) するため、データの安全性とエラーハンドリングが担保しやすい仕組みになっています。
