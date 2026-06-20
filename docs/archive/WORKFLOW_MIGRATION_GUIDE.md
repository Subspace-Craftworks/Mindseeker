# Dify ワークフロー移行手順書

## 目的

現在の Dify チャット API 連携を、ワークフロー API ベースの実装へ切り替える。

今回の前提:

- `dify_api_key_2` はワークフロー側につながっている
- ワークフロー API では `user` と `conversation_id` が明示的に受け渡される
- ワークフロー内では `user` は `sys.user_id` として参照できる
- `conversation_id` も同様に明示的に使う

この手順書は、いまの実装を壊さずに段階的に移行するための作業順をまとめたもの。

---

## 現状整理

現在のチャット系実装では、主に次の場所で Dify のチャット API を使っている。

- `app/api/chat/route.ts`
- `lib/dify.ts`

さらに、会話の識別や履歴取得では次が使われている。

- `conversation_id`
- `user` パラメータ

今回の移行では、これらの扱いを Dify ワークフロー側の仕様に合わせて整理する。

---

## 移行方針

1. チャット送信を Dify ワークフロー API に切り替える
2. Dify に渡す識別子は、ワークフロー側で解決される前提に揃える
3. `conversation_id` は明示的に送る
4. `user_id` はワークフロー側で `sys.user_id` として扱う
5. 会話変数の同期ロジックは使わない前提で整理する
6. ナレッジをワークフロー向けに再確認する
7. 実運用前に、新旧両方の挙動差をテストする

---

## 実施手順

### 1. 現行仕様のバックアップを取る

変更前に、次を残す。

- `app/api/chat/route.ts`
- `lib/dify.ts`
- `supabase/functions/planning-api/PARAMETERS.md`
- `dify/knowledge/planning-api/create_goal.md`

目的は、移行後に差分を追跡できるようにすること。

---

### 2. Dify 側の接続先をワークフローに切り替える

確認すること:

- `dify_api_key_2` がワークフロー用のキーであること
- ワークフローのエンドポイントがどれか
- 必須入力が何か

特に次を明確にする。

- `user` はワークフロー内で `sys.user_id` として扱う
- `conversation_id` はワークフローの会話識別に使う

ここで、チャット API に依存していた前提を捨てる。

---

### 3. BFF のチャット送信をワークフロー API に差し替える

`app/api/chat/route.ts` を修正する。

やること:

- Dify の送信先をワークフロー API に変える
- リクエスト body をワークフロー仕様に合わせる
- `user` と `conversation_id` を明示的に送る
- 返却形式が SSE / JSON のどちらかを確認して、それに合わせてストリーム処理を書く

この段階で、`user_id` を `inputs` に入れる前提の処理は外す。

---

### 4. `lib/dify.ts` の送信ヘルパーを整理する

`lib/dify.ts` の責務を分ける。

候補:

- チャット API 用の関数を廃止してワークフロー用関数に置き換える
- 会話履歴取得や会話削除が必要なら、それだけを残す
- 会話変数の同期関数は削除する

少なくとも次の観点で見直す。

- `postChatMessage()`
- 会話変数に依存する補助関数

ワークフロー移行後は、`user_id` の会話変数同期は使わない。

---

### 5. プロンプトについて

プロンプトは手動で修正済みのため、この手順書では追加修正を行わない。

現時点では、ワークフロー側で `sys.user_id` と `sys.conversation_id` を使う前提に揃っていることだけを確認する。

---

### 6. ナレッジ文書を再点検する

少なくとも次の文書を確認する。

- `dify/knowledge/planning-api/create_goal.md`
- `dify/knowledge/planning-api/complete_goal.md`
- `dify/knowledge/context-api/set_current_goal.md`
- `supabase/functions/planning-api/PARAMETERS.md`
- `supabase/functions/context-api/PARAMETERS.md`

確認ポイント:

- `user_id` の説明が「実値」であること
- `sys.user_id` / `sys.conversation_id` の前提と矛盾しないこと
- `conversation_id` の使い方がチャット API 前提のまま残っていないこと

---

### 7. 受け渡しパラメータを最小化する

ワークフロー側で自動解決できるものは、BFF 側で重複送信しない。

見直し対象:

- `user_id`
- `conversation_id`
- `inputs`

考え方:

- ワークフローが必要とする値だけ送る
- `sys.user_id` に任せられるものは任せる
- 余計なテンプレート変数は減らす

---

### 8. 実装後の確認項目

次を順番に確認する。

1. 新規チャット開始
2. 既存スレッドの再表示
3. Goal 作成
4. `complete_goal` 実行
5. `context-api` の `set_current_goal`
6. `conversation_id` の継続
7. `user_id` が `{{user_id}}` に化けていないこと

確認時は、Dify 側と BFF 側のログの両方を見る。

---

## 変更対象ファイルの候補

### BFF / FE

- `app/api/chat/route.ts`
- `app/api/chat/opening-statement/route.ts`
- `lib/dify.ts`
- `lib/env.ts`

### Dify文書

- `dify/knowledge/planning-api/*.md`
- `dify/knowledge/context-api/*.md`

### Supabase / API文書

- `supabase/functions/planning-api/PARAMETERS.md`
- `supabase/functions/context-api/PARAMETERS.md`

---

## 実施順のおすすめ

1. ワークフロー API の送信仕様を確定する
2. `app/api/chat/route.ts` を切り替える
3. `lib/dify.ts` を整理する
4. ナレッジを再点検する
5. 本番デプロイ前に動作確認する

---

## ロールバック方針

移行中に問題が出た場合は、次の順で戻す。

1. `app/api/chat/route.ts` を旧チャット API に戻す
2. `lib/dify.ts` の新規ワークフロー処理を外す
3. Dify 側のワークフロー設定を止める
4. 旧 `DIFY_API_KEY` の利用へ戻す

---

## 補足

今回のポイントは、`user_id` を「入力変数として渡す」のではなく、ワークフローの実行文脈に載る `sys.user_id` として扱うこと。

同様に `conversation_id` も、曖昧な暗黙値ではなく明示的に扱う。

この2点を揃えると、チャット API とワークフロー API の挙動差による混乱を減らせる。
