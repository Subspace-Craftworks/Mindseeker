# TODO

通常のチャットでもゴールを指定していれば同様の動きになるようにしていたと思ったが、今は違うのか確認したい（違っていても問題ない）
ゴールの選択によって、関連するチャットをハイライトする機能が変になっているような気がする

Dify → MCP	固定 API トークン（X-Api-Key ヘッダー等）

Updated: 2026-06-20

## LP / ドメイン

- [ ] LP の Workspace preview にスクリーンショット追加

## MCP / カスタムGPT

- [ ] カスタム GPT の公開範囲設定（Anyone with a link）
- [ ] MCP 経由のツール呼び出しに free ユーザー制限を適用するか検討

## コード整理

- [ ] tools/check-lp-deploy.ts を削除（一時的なデバッグ用）
- [ ] .env.newvercel を削除（一時ファイル）
- [ ] application_logs の MCP ツールログ（デバッグ用）を残すか削除するか決定
