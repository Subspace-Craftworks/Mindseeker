# Migration: JSON Orchestration → Session-Based MCP Architecture

Updated: 2026-06-18

本文書は、Mindseeker のチャット→DB更新フローを「JSON Orchestration 方式」から「Session + MCP Direct Execution 方式」へ移行する背景、理由、影響範囲、および移行方針をまとめたものです。

---

## 1. 移行の背景

### 旧方式の課題

現行の JSON Orchestration 方式（[dify-context-and-json-orchestration.md](./dify-context-and-json-orchestration.md) 参照）では以下の課題がありました：

1. **Dify が実行結果を知らない**: JSON ブロックを出力した時点では、実際に DB 更新が成功したかどうかを Dify は把握できない。リトライや代替アクションの判断ができない。
2. **BFF の orchestrator が複雑**: `lib/orchestrator.ts` は JSON パース、`"NEW"` プレースホルダーの解決、操作の逐次実行、エラーハンドリングなど多くの責務を抱えている。
3. **更新タイミングが遅い**: ストリーム完了後に一括実行するため、長い回答の場合に DB 反映が遅延する。
4. **コンテキスト管理の分散**: `chat_threads.current_goal_id` の更新が orchestrator 内の `current_goal_id: "NEW"` 解決に依存しており、ロジックが散在。

### 新方式で解決されること

Session + MCP Direct Execution 方式（[session-based-context-injection.md](./session-based-context-injection.md) 参照）により：

- Dify がツール実行結果を即座に受け取り、後続の判断に活用可能
- BFF から orchestrator を削除し、責務を大幅に簡素化
- DB 更新がリアルタイムに反映
- コンテキスト管理が `sessions` テーブル + MCP ハンドラに集約

---

## 2. 変更の全体像

```
【削除されるもの】
- lib/orchestrator.ts（JSON Orchestration ロジック全体）
- chat_threads.current_goal_id カラムへの依存
- Dify プロンプト内の「JSON ブロック出力」指示

【新規作成されるもの】
- sessions テーブル（Supabase マイグレーション）
- lib/db/sessions.ts（sessions テーブルの CRUD ヘルパー）
- MCP ハンドラ内の session 自動更新ロジック

【変更されるもの】
- app/api/chat/route.ts（session 解決 + orchestrator 呼び出し削除）
- app/api/mcp/[profile]/route.ts（session_id パラメータ対応）
- lib/mcp/handlers.ts（session 更新ロジック追加）
- lib/mcp/tools.ts（session_id パラメータをスキーマに追加）
- components/features/workspace/unified-workspace.tsx（session_id 管理）
- Dify エージェント設定（MCP ツール登録、プロンプト変更）
```

---

## 3. 影響範囲

### 3.1 バックエンド (BFF)

| ファイル | 変更内容 |
|----------|----------|
| `app/api/chat/route.ts` | session 解決ロジック追加、orchestrator 呼び出し削除、done イベントに session_id 追加 |
| `app/api/mcp/[profile]/route.ts` | session_id を args から抽出して handlers に渡す対応 |
| `lib/orchestrator.ts` | 最終的に削除（移行完了後） |
| `lib/mcp/handlers.ts` | `executeTool` に session 更新ロジック追加 |
| `lib/mcp/tools.ts` | 各ツールの inputSchema に `session_id` (optional) を追加 |
| `lib/db/sessions.ts` | 新規作成 |
| `lib/db/chat-threads.ts` | `current_goal_id` 関連関数の段階的な廃止 |

### 3.2 フロントエンド

| ファイル | 変更内容 |
|----------|----------|
| `unified-workspace.tsx` | session_id の state 管理、リクエストへの付与、done イベントからの取得 |

### 3.3 データベース (Supabase)

| 変更 | 内容 |
|------|------|
| 新規テーブル | `sessions` テーブル作成 + RLS ポリシー |
| 既存テーブル | `chat_threads.current_goal_id` は当面残すが、参照を段階的に削除 |

### 3.4 Dify エージェント

| 変更 | 内容 |
|------|------|
| ツール登録 | MCP サーバのツールを Dify に登録（既に登録済みの場合は session_id 対応を追加） |
| プロンプト | JSON ブロック出力指示を削除、`{{session_id}}` 変数の利用方法を追加 |
| inputs 変数 | `session_id` を新規追加 |

### 3.5 Supabase Edge Functions

`planning-api` および `context-api` Edge Functions は、MCP サーバへの移行が完了すれば不要になる可能性があります。ただし、Dify が直接 MCP サーバを呼び出す方式に完全移行するまでは残します。

---

## 4. 移行方針

### 段階的移行（推奨）

一度にすべてを切り替えるのではなく、以下の段階で安全に移行します：

#### Phase 1: 基盤構築（並行稼働可能）
- `sessions` テーブル作成
- `lib/db/sessions.ts` 作成
- MCP ハンドラに session 更新ロジック追加（`session_id` がある場合のみ動作）
- BFF に session 解決ロジック追加（`session_id` が来なければ旧方式にフォールバック）

#### Phase 2: FE 対応 + Dify 設定変更
- FE に session_id 管理を追加
- Dify プロンプトから JSON 出力指示を削除
- Dify ツールに session_id パラメータを追加

#### Phase 3: クリーンアップ
- `lib/orchestrator.ts` を削除
- `chat_threads.current_goal_id` への依存を削除
- `lib/db/context-map.ts` のロジックを sessions ベースに変更
- Supabase Edge Functions (`planning-api`, `context-api`) の役割を再評価

### 互換性に関する注意

- Phase 1 完了時点では、`session_id` を送らない旧クライアントも正常に動作する（orchestrator がフォールバックとして残る）
- Phase 2 で Dify が MCP 経由で DB を更新するようになった時点で、orchestrator はもう動作しない（JSON ブロックが出力されないため）
- Phase 3 は Phase 2 が安定稼働してから実施する

---

## 5. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| Dify → MCP サーバ間の認証失敗 | DB更新が行われない | OAuth トークン発行フローの確認、エラーログの強化 |
| session_id の消失（FE側） | コンテキストが引き継がれない | LocalStorage にバックアップ、サーバー側でも conversation_id から session を復元可能にする |
| MCP ツール実行の部分失敗 | Dify は結果を見て判断可能だが、ユーザーへの通知が不完全 | Dify プロンプトで「ツール失敗時はユーザーに説明する」指示を追加 |
| 移行期間中の二重書き込み | Phase 1 中は orchestrator と MCP 両方が動く可能性 | session_id がある場合は orchestrator をスキップする条件分岐を追加 |

---

## 6. 関連文書

- [session-based-context-injection.md](./session-based-context-injection.md) — 新方式の技術仕様
- [dify-context-and-json-orchestration.md](./dify-context-and-json-orchestration.md) — 旧方式の技術仕様（参考用として保持）
- [migration-steps.md](./migration-steps.md) — 具体的な作業手順書
- [system-architecture.md](./system-architecture.md) — システム全体構成図
