# Stripe 導入計画

Updated: 2026-06-20
予定時期: 2026/10

## 方針

- Supabase Auth を認証基盤として維持
- Stripe はサブスクリプション課金のみ担当
- `user_profiles.stripe_customer_id` で紐付け

## フロー

```
1. ユーザーがアプリ内のプラン設定画面で "Upgrade" を押す
2. BFF が Stripe Checkout セッションを作成（metadata: { user_id }）
3. ユーザーが Stripe で支払い完了
4. Stripe Webhook → BFF (checkout.session.completed)
5. BFF が user_profiles.tier を 'paid' に更新 + stripe_customer_id を保存
```

## DB 変更（実装時）

```sql
ALTER TABLE user_profiles ADD COLUMN stripe_customer_id text;
ALTER TABLE user_profiles ADD COLUMN stripe_subscription_id text;
ALTER TABLE user_profiles ADD COLUMN plan_expires_at timestamptz;
```

## エンドポイント（実装時）

- `POST /api/billing/checkout` — Checkout セッション作成
- `POST /api/billing/webhook` — Stripe Webhook 受信
- `GET /api/billing/portal` — Stripe Customer Portal URL 生成（解約・プラン変更）

## UI 配置

- アプリ内にプラン設定画面を設ける（ログイン済み前提）
- LP からはアプリのプラン設定画面へリンク

## 注意事項

- Webhook の署名検証（`STRIPE_WEBHOOK_SECRET`）は必須
- サブスク解約時は `customer.subscription.deleted` で tier を 'free' に戻す
- 試用期間（trial）を設ける場合は Stripe 側で設定
