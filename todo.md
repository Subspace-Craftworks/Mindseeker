# TODO

Updated: 2026-06-20

## LP / ドメイン

- [ ] LP にカスタムドメイン設定（subspace-craftworks.jp → LP プロジェクト）
- [ ] アプリをサブドメインに移行（app.subspace-craftworks.jp）
- [ ] アプリ移行に伴う Supabase Auth リダイレクト URL 更新
- [ ] アプリ移行に伴う Dify MCP 接続先 URL 更新
- [x] LP の GitHub リンクを実際の URL に差し替え
- [x] LP の「β版を試す」リンクを実際の URL に差し替え
- [ ] LP の Workspace preview にスクリーンショット追加

## MCP / カスタムGPT

- [ ] ChatGPT カスタム GPT を作成（MCP 接続設定 + プロンプト）
- [ ] カスタム GPT の公開範囲設定（Anyone with a link）
- [ ] MCP 経由のツール呼び出しに free ユーザー制限を適用するか検討

## コード整理

- [ ] tools/check-lp-deploy.ts を削除（一時的なデバッグ用）
- [ ] .env.newvercel を削除（一時ファイル）
- [ ] application_logs の MCP ツールログ（デバッグ用）を残すか削除するか決定
