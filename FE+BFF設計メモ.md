# 設計メモ：Supabase Auth + Vercel FE/BFF + Dify + Supabase

## 1. 目的

Supabase AuthでGoogle/GitHub OAuthログインを行い、Vercel上のフロントエンドとBFFからDify APIおよびSupabaseを利用する。

Difyはユーザー管理システムとしては使わず、AIワークフロー実行エンジンとして扱う。ユーザー識別はSupabase AuthのユーザーIDを基準にする。

## 2. 全体構成

```text
Browser
  ↓
Vercel Frontend
  ↓
Vercel BFF / API Routes
  ↓             ↓
Dify API        Supabase
                - Auth
                - DB
                - Edge Functions
```

## 3. 採用技術

* Frontend: Vercel上のNext.jsまたはVite/React
* BFF: Vercel API Routes
* Auth: Supabase Auth
* OAuth Provider: Google / GitHub
* DB: Supabase PostgreSQL
* AI Backend: Dify API
* Existing Supabase Edge Functions:

  * planning-api
  * user-crud

## 4. 認証方針

Supabase Authを唯一のユーザー認証基盤とする。

ログイン後、FEはSupabase Authのセッションを保持する。BFF呼び出し時にはSupabaseのaccess_tokenをAuthorizationヘッダーで送る。

```text
Authorization: Bearer <supabase_access_token>
```

BFF側ではこのJWTを検証し、`user.id` を取得する。

以後、アプリ内のユーザー識別子は原則としてSupabase Authの `auth.users.id` を使う。

## 5. Dify連携方針

Dify APIキーは絶対にフロントエンドに置かない。

Dify APIキーはVercelの環境変数に保存する。

```env
DIFY_API_KEY=...
DIFY_API_BASE_URL=...
```

FEからDifyを直接呼ばず、必ずVercel BFF経由で呼ぶ。

```text
FE → /api/chat → Dify API
```

Dify APIの `user` パラメータにはSupabase Authの `user.id` を渡す。

例：

```json
{
  "inputs": {
    "user_id": "<supabase_user_id>"
  },
  "query": "ユーザー入力",
  "response_mode": "streaming",
  "conversation_id": "<dify_conversation_id>",
  "user": "<supabase_user_id>"
}
```

## 6. チャット履歴管理

Dify側のconversation_idをSupabase側で管理する。

追加テーブル案：

```sql
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dify_conversation_id text not null,
  title text,
  app_key text default 'mindseeker',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, dify_conversation_id)
);

alter table public.chat_threads enable row level security;

create policy "select own chat_threads"
on public.chat_threads
for select
using (auth.uid() = user_id);

create policy "insert own chat_threads"
on public.chat_threads
for insert
with check (auth.uid() = user_id);

create policy "update own chat_threads"
on public.chat_threads
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "delete own chat_threads"
on public.chat_threads
for delete
using (auth.uid() = user_id);
```

左ペインのチャット一覧は `chat_threads` を `user_id = auth.uid()` で取得して表示する。

## 7. 既存テーブルのマルチユーザー化

現在の既存モデルは以下の構造を活かす。

```text
goals
  ↓
subjects
  ↓
issues
  ↓
tasks

events は goal / subject / issue / task に紐づくイベントログ
```

ただし、現状はユーザー別データ分離用の `user_id` が無い。商用化・ログイン対応するには、主要テーブルに `user_id uuid references auth.users(id)` を追加する。

対象：

* goals
* subjects
* issues
* tasks
* events

DDL案：

```sql
alter table public.goals
add column user_id uuid references auth.users(id) on delete cascade;

alter table public.subjects
add column user_id uuid references auth.users(id) on delete cascade;

alter table public.issues
add column user_id uuid references auth.users(id) on delete cascade;

alter table public.tasks
add column user_id uuid references auth.users(id) on delete cascade;

alter table public.events
add column user_id uuid references auth.users(id) on delete cascade;
```

既存データがあるため、移行時は一時的にnullableで追加し、既存データに管理者ユーザーIDを埋めた後、必要ならnot null化する。

```sql
-- 既存データ移行後に実施
alter table public.goals alter column user_id set not null;
alter table public.subjects alter column user_id set not null;
alter table public.issues alter column user_id set not null;
alter table public.tasks alter column user_id set not null;
alter table public.events alter column user_id set not null;
```

## 8. RLS方針

各テーブルはRLSを有効化し、`auth.uid() = user_id` のみ許可する。

例：

```sql
create policy "select own goals"
on public.goals
for select
using (auth.uid() = user_id);

create policy "insert own goals"
on public.goals
for insert
with check (auth.uid() = user_id);

create policy "update own goals"
on public.goals
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "delete own goals"
on public.goals
for delete
using (auth.uid() = user_id);
```

同様のポリシーを subjects / issues / tasks / events にも設定する。

## 9. BFF API案

Vercelに以下のAPIを作る。

### POST /api/chat

Difyにチャットメッセージを送信する。

処理：

1. AuthorizationヘッダーからSupabase JWTを取得
2. Supabase Authでユーザー確認
3. request bodyから `message` と任意の `thread_id` を取得
4. `thread_id` がある場合、Supabaseから自分のchat_threadsを取得
5. Dify APIを呼び出す
6. 新規conversation_idが返った場合はchat_threadsに保存
7. Difyの応答をFEに返す

### GET /api/chat/threads

ログインユーザーのチャットスレッド一覧を返す。

### DELETE /api/chat/threads/:id

ログインユーザーのチャットスレッドを削除する。必要ならDify側の会話削除APIも呼ぶ。

### GET /api/goals

Supabaseまたはplanning-api経由でログインユーザーのgoalsを取得する。

### POST /api/goals

ログインユーザーのgoalを作成する。

### GET /api/goals/:id

goal詳細、subjects、issues、tasks、eventsを取得する。

## 10. Supabase接続方針

FEではanon keyのみ利用する。

Vercel BFFでは必要に応じて以下を使い分ける。

* 通常操作: ユーザーJWT + anon key
* 管理操作: service_role key

service_role keyは絶対にFEに出さない。Vercel環境変数にのみ保存する。

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 11. DifyからSupabaseへのアクセス

DifyからSupabase DBを直接操作させない。

Difyがデータ参照・登録を必要とする場合は、Dify ToolまたはHTTP Requestから自社APIを呼ばせる。

```text
Dify
  ↓
Vercel BFF or Supabase Edge Function
  ↓
Supabase DB
```

このときDifyにはDBキーを持たせず、BFF/Edge Function側でAPIキーまたは署名付きシークレットを検証する。

Difyに渡すユーザー識別子は `user_id` のみとし、DBアクセス権限そのものは渡さない。

## 12. 環境変数

Vercelに設定する環境変数：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DIFY_API_BASE_URL=
DIFY_API_KEY=
```

ローカル開発用 `.env.local` も同じ構成にする。ただし `.env.local` はgitにコミットしない。

## 13. Codexへの実装依頼タスク

### Phase 1: 認証

* Supabase Authを導入
* Google OAuthログインを実装
* GitHub OAuthログインを実装
* ログイン状態によって画面を切り替える
* 未ログイン時はログイン画面へ誘導

### Phase 2: BFF

* Vercel API Routesに `/api/chat` を作成
* Supabase JWT検証処理を共通化
* Dify API呼び出し処理を実装
* Dify APIキーを環境変数から読む

### Phase 3: チャット履歴

* `chat_threads` テーブルDDLを追加
* RLSポリシーを追加
* 左ペインにチャット履歴一覧を表示
* 新規チャット作成
* 既存チャット継続
* チャットタイトル更新

### Phase 4: 既存planningモデル連携

* goals / subjects / issues / tasks / events に `user_id` を追加するマイグレーション案を作る
* 既存データ移行手順を用意する
* RLSポリシーを追加する
* ログインユーザーのデータだけ取得・更新する

### Phase 5: Dify Tool連携

* Difyから呼ぶための安全なAPIを作る
* Difyにはuser_idを渡す
* API側でuser_idをもとにSupabaseを検索する
* DifyにはSupabaseのDBキーを渡さない

## 14. 実装時の注意

* Dify APIキーはFEに出さない
* Supabase service_role keyはFEに出さない
* RLSを必ず有効にする
* user_idによるテナント分離を徹底する
* Difyのconversation_idはSupabase側でユーザーごとに管理する
* 将来Cloudflare Pagesへ移行できるよう、BFFロジックは薄く保つ
* DBアクセスの中核ロジックは可能ならSupabase Edge Functionsへ寄せる
* Vercel依存を強くしすぎない
