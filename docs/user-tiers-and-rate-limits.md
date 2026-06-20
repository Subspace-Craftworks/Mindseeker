# User Tiers & Rate Limits

Updated: 2026-06-20

## ユーザー種別

| Tier | 説明 | 利用制限 | 課金 |
|------|------|----------|------|
| `contributor` | コントリビューター・特別ユーザー | なし | なし |
| `paid` | 有料会員 | なし | あり（2026/10 Stripe導入予定） |
| `free` | 無料ユーザー | あり | なし |

- `contributor` と `paid` は現時点で機能的に同等（制限なし）。差は課金の有無のみ。
- `contributor` は手動付与。
- 新規ユーザーは初回チャット時に自動で `free` として `user_profiles` に登録される。

---

## Rate Limit（free ユーザー向け）

### 制限対象

`POST /api/chat` — Dify（LLM）呼び出しを伴うチャット送信

### 制限値

| 種類 | 上限 | リセット |
|------|------|----------|
| 日次制限 | 10回/日 | 毎日 0:00 UTC |
| 累計制限 | 100回 | リセットなし |

### 制限超過時の動作

- HTTP 429 を返却
- レスポンスに `tier`, `dailyUsed`, `dailyLimit`, `totalUsed`, `totalLimit` を含める
- FE でエラーメッセージ表示

---

## データモデル

### user_profiles

```sql
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'free',  -- 'free' | 'paid' | 'contributor'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### chat_usage

```sql
CREATE TABLE public.chat_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_usage_user_date ON public.chat_usage (user_id, used_at);
```

---

## BFF 処理フロー（`POST /api/chat`）

```
1. ユーザー認証
2. ensureUserProfile(user.id) — profile がなければ free で作成
3. checkRateLimit(user.id):
   - tier が paid/contributor → 制限なし
   - tier が free → 日次 + 累計チェック
   - 超過 → 429 返却
4. 通常処理（Dify 呼び出し）
5. recordChatUsage(user.id) — 成功時に使用記録
```

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| `lib/db/rate-limit.ts` | getUserTier, checkRateLimit, recordChatUsage, ensureUserProfile |
| `app/api/chat/route.ts` | rate limit チェック実行箇所 |
| `supabase/migrations/20260620000000_create_user_profiles_and_chat_usage.sql` | テーブル定義 |
