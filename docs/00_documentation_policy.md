# Documentation Policy

Updated: 2026-06-20

## 目的

このフォルダは Mindseeker の現行仕様と設計を記述するドキュメントを管理します。
「今の動作」を素早く把握できることを重視し、過去の計画や廃止済みの仕様とは明確に分離します。

## ルール

- 現在のコードベースに実装されている動作のみを `docs/` 直下に置く
- 完了した移行計画、旧設計メモ、廃止済みの仕様は `docs/archive/` に移動する
- 未解決の課題は `open-issues.md` に集約し、解決したら削除する
- 履歴ベースではなく、機能ベースのドキュメント構成にする
- 言語は日本語を基本とする（公開用に英語版を別途作成する場合がある）

## 現在のドキュメント一覧

| ファイル | 内容 |
|---------|------|
| `system-architecture.md` | システム全体構成、コンポーネント設計、データフロー、DB設計 |
| `session-based-context-injection.md` | Session 方式によるコンテキスト管理と MCP 直接実行の詳細仕様 |
| `authentication.md` | 認証・認可の仕様（Supabase Auth + 独自 OAuth/JWT） |
| `user-tiers-and-rate-limits.md` | ユーザー Tier（free/paid/contributor）と利用制限 |
| `open-issues.md` | 未解決の課題・改善候補 |
| `00_documentation_policy.md` | 本ファイル。ドキュメント管理方針 |

## docs/ 直下に置くもの

- 認証フローとセッション管理
- チャット・ゴール・Viewer の動作仕様
- BFF API の契約（実装済みのもの）
- MCP サーバーのツール仕様
- データベーステーブル設計と RPC 関数
- パフォーマンス・セキュリティに関する設計判断

## docs/archive/ に置くもの

- 完了済みの実装計画・移行手順
- 現行と異なる旧設計メモ
- 廃止されたフロー・仕様（Edge Functions、JSON Orchestration 等）
- コンセプトノート（製品方向性の議論で、現在の動作を定義しないもの）
