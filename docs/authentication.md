# Authentication & Authorization

Updated: 2026-06-20

## 概要

Mindseeker は用途に応じて2つの認証方式を使い分けています。

| 機能 | 認証方式 | ユーザー特定 |
|------|---------|-------------|
| メイン画面 (`/`) | Supabase Auth (Cookie) | `auth.uid()` |
| Viewer (`/viewer`) | Supabase Auth (Cookie) | `auth.uid()` |
| BFF API (`/api/chat` 等) | Supabase Auth (Bearer token) | `requireSupabaseUser()` |
| MCP Server (`/api/mcp/[profile]`) | 独自 OAuth → JWT | JWT payload の `user_id` |

---

## 1. Supabase Auth（メイン画面 / Viewer / BFF API）

### ログインフロー

1. ユーザーが `/login` にアクセス
2. Google または GitHub の OAuth プロバイダを選択
3. Supabase Auth が認証処理を実施
4. `/auth/callback` でセッション確立（Cookie にトークン保存）
5. FE は `supabase.auth.getSession()` で access_token を取得
6. BFF API へのリクエスト時に `Authorization: Bearer <supabase_access_token>` を付与

### BFF 側の検証

```typescript
// lib/auth.ts
export async function requireSupabaseUser(req: NextRequest) {
  // Authorization ヘッダーから Bearer token を取得
  // Supabase の getUser() で検証
  // 失敗時は 401 を throw
}
```

### 対象エンドポイント

- `POST /api/chat` — チャット送信
- `GET /api/chat/threads` — スレッド一覧
- `GET /api/chat/threads/[id]` — スレッド詳細・履歴
- `DELETE /api/chat/threads/[id]` — スレッド削除
- `GET /api/context-map` — コンテキストマップ
- `GET /api/goals/[id]` — ゴール詳細
- `PATCH /api/goals/[id]` — ゴール更新
- `DELETE /api/goals/[id]` — ゴール削除
- `POST /api/goals` — ゴール作成
- `GET /api/chat/opening-statement` — 開始メッセージ取得
- `POST /api/artifacts` — アーティファクト作成
- その他 CRUD 系 API

---

## 2. 独自 OAuth + JWT（MCP Server）

### なぜ独自 OAuth が必要か

MCP Server は外部クライアント（Dify）から呼び出されます。Dify はブラウザではないため Supabase Auth の Cookie セッションが使えません。代わりに、OAuth 2.0 Authorization Code フローで長寿命の JWT トークンを発行し、それで認証します。

### OAuth フロー

```
┌─────────┐          ┌──────────────┐          ┌───────────────┐
│  Dify   │          │  Mindseeker  │          │   ユーザー     │
│(Client) │          │   (Server)   │          │  (Browser)    │
└────┬────┘          └──────┬───────┘          └──────┬────────┘
     │                      │                         │
     │ 1. /oauth/authorize  │                         │
     │   (client_id,        │                         │
     │    redirect_uri,     │                         │
     │    response_type=code)                         │
     │─────────────────────>│                         │
     │                      │  2. ログイン要求         │
     │                      │────────────────────────>│
     │                      │                         │
     │                      │  3. ユーザー承認         │
     │                      │<────────────────────────│
     │                      │                         │
     │ 4. redirect_uri      │                         │
     │    ?code=<JWT>       │                         │
     │<─────────────────────│                         │
     │                      │                         │
     │ 5. POST /api/oauth/token                       │
     │    grant_type=authorization_code               │
     │    code=<JWT>        │                         │
     │─────────────────────>│                         │
     │                      │                         │
     │ 6. access_token +    │                         │
     │    refresh_token     │                         │
     │<─────────────────────│                         │
     │                      │                         │
     │ 7. MCP requests      │                         │
     │    Bearer <access_token>                       │
     │─────────────────────>│                         │
```

### トークン仕様

| トークン種別 | 有効期限 | 用途 |
|------------|---------|------|
| Authorization Code | 5分 | OAuth コード交換用（一時的） |
| Access Token | 1年 | MCP リクエストの認証 |
| Refresh Token | 10年 | Access Token の再発行 |

### JWT Payload

```json
{
  "user_id": "678ea7b6-e79e-4f2c-ae35-4af35b650071",
  "type": "access",
  "iat": 1718700000,
  "exp": 1750236000
}
```

### MCP Server 側の検証

```typescript
// app/api/mcp/[profile]/route.ts
const { payload } = await jwtVerify(token, secretBytes);
if (payload.type !== "access" || !payload.user_id) {
  throw new Error("Invalid token payload");
}
userId = payload.user_id as string;
```

### 環境変数

- `OAUTH_JWT_SECRET` — JWT 署名/検証用の共有秘密鍵

---

## 3. Viewer (`/viewer`)

Viewer はゴールの閲覧・編集に特化した読み取り中心のビューです。

- 認証: Supabase Auth（Cookie）— メイン画面と同一
- 未認証時は `/login` にリダイレクト
- チャット機能なし（Rate Limit の対象外）
- 5秒間隔のポーリング + ウィンドウフォーカス時に自動同期
- BFF API (`/api/context-map`, `/api/goals/[id]`) を呼び出して表示

---

## 4. OAuth エンドポイント一覧

| エンドポイント | 用途 |
|--------------|------|
| `GET /oauth/authorize` | 承認画面表示（ユーザーが "Allow" を押す） |
| `POST /api/oauth/token` | authorization_code → access_token 交換 |
| `GET /.well-known/oauth-authorization-server` | OAuth サーバーメタデータ |
| `GET /.well-known/openid-configuration` | OpenID Connect ディスカバリ |

---

## 5. セキュリティ考慮事項

- RLS (Row Level Security) により、ユーザーは自分のデータのみアクセス可能
- BFF は `SUPABASE_SERVICE_ROLE_KEY` で操作するため RLS をバイパスするが、必ず `user_id` を検証してから実行
- MCP Server の RPC 関数は `SECURITY DEFINER` だが、`anon` / `authenticated` ロールからの EXECUTE は REVOKE 済み
- OAuth access_token は `OAUTH_JWT_SECRET` で署名検証。秘密鍵はサーバー側のみ保持
