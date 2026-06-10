# FE - BFF - Dify Flow

Updated: 2026-06-10

この文書は、Mindseeker の会話処理が
`FE -> BFF -> Dify` の順で流れるときの役割分担を、日本語でまとめたものです。

## 目的

仕様を読むときに、

- FE が何を送るのか
- BFF が何を受け取って Dify にどう変換するのか
- Dify 側で tool/action がどう扱われるのか

を混同しないようにするための整理です。

## 1. FE から BFF へ

チャット画面の FE は、`/api/chat` に対して以下のような JSON を送ります。

```json
{
  "message": "<ユーザーの入力>",
  "conversation_id": "<thread の Dify conversation id または空文字>"
}
```

この段階では、FE は Dify の API 仕様を意識しません。

FE の役割は「ユーザー入力を BFF に渡すこと」です。


## 2. BFF から Dify へ

BFF は `app/api/chat/route.ts` で FE からのリクエストを受け取り、Dify の `POST /chat-messages` に変換して送ります。

実際に Dify へ送る内容は、概ね次の形です。

```json
{
  "query": "<ユーザーのメッセージ>",
  "response_mode": "streaming",
  "conversation_id": "<conversation id or 空文字>",
  "user": "<Supabase user.id>",
  "auto_generate_name": true
}
```

ここで重要なのは、BFF が Dify に送るのは FE の入力をそのままではなく、Dify の `chat-messages` 用に整形した payload だという点です。

## 3. Dify からの tool/action

Dify は、受け取った会話内容に応じて tool/action を選びます。

Mindseeker では、その tool/action の候補と params は次の OpenAPI ファイルで定義されています。

- `dify/planning-api.openapi.yaml`
- `dify/context-api.openapi.yaml`

`create_goal` などの action 名や params は、BFF の HTTP 仕様ではなく、Dify が選ぶ tool/action の仕様です。

## 4. テストデータの見方

`dify/dify-test-data/chat-messages/create_goal.json` は、Dify に直接送る HTTP fixture です。

このファイルには BFF の action-case のような期待値は入っていません。

つまり、このファイルは FE が BFF に送る入力でもなく、BFF から Dify へ送る変換済み payload をそのまま直接試すための fixture です。

## 5. 参照すべき文書

- FE -> BFF の詳細
  - `docs/current-spec.md`
- BFF -> Dify の transport 仕様
  - `dify/BFF_DIFY_INTERFACE_SPEC.md`
- Dify の tool/action 仕様
  - `dify/DIFY_TOOL_ACTION_SPEC.md`
- action-case fixture の使い方
  - `dify/dify-test-data/README.md`
