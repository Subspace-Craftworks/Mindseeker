# Runbook: status + visibility 移行（案D）

Updated: 2026-06-22

---

## 概要

`is_active` (boolean) を `visibility` (text: "visible" / "hidden") にリネーム・変換する。
`status` の値をテーブルごとの正規値に統一する。
Goals に `visibility` カラムを追加する。

---

## 影響範囲

### DB

| テーブル | 変更内容 |
|---------|---------|
| goals | `visibility` カラム追加。既存 `status = 'inactive'` → `status = 'completed'`, `visibility = 'hidden'` |
| subjects | `is_active` → `visibility` リネーム + 値変換。`status` 値の正規化 |
| issues | 同上 |
| tasks | 同上 |

### RPC 関数

| 関数 | 変更内容 |
|------|---------|
| `get_goal_detail` | `is_active` → `visibility` でソート・フィルタ |
| `get_context_map` | Goals の表示に `visibility` を反映 |
| `get_goal_context` | 変更なし（status/visibility を返さない） |

### BFF / MCP

| ファイル | 変更内容 |
|---------|---------|
| `lib/mcp/handlers.ts` | updateSubject/Issue/Task: `is_active` → `visibility` |
| `lib/mcp/handlers.ts` | executeTool: session 更新ロジックは変更なし |
| `lib/mcp/handlers.ts` | sendPayload: 変更なし（handlers 経由で動く） |
| `lib/mcp/tools.ts` | inputSchema: `is_active` → `visibility` |
| `app/api/records/[table]/[id]/route.ts` | PATCH: `is_active` → `visibility` |
| `app/api/mcp/[profile]/route.ts` | 変更なし |
| `lib/mcp/handlers.ts` | completeGoal: `status = 'completed'`（visibility は変更しない） |

### FE

| ファイル | 変更内容 |
|---------|---------|
| `components/features/workspace/goal-editor.tsx` | `is_active` → `visibility` (バッジスタイル、トグル、フィルター) |
| `components/features/workspace/goal-editor.tsx` | "show Inactive" → "show Hidden" |
| `components/features/workspace/goal-editor.tsx` | FE add ボタン: subjects の初期 status を `"open"` に修正 |
| `components/features/workspace/unified-workspace.tsx` | Goals サイドバーの inactive 表示ロジック（status → visibility） |

---

## 実行手順

### Step 1: DB マイグレーション

```sql
-- 1. Goals に visibility カラム追加
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'visible';

-- 2. Goals: 旧 status='inactive' を移行
UPDATE public.goals SET visibility = 'hidden', status = 'completed' WHERE status = 'inactive';

-- 3. Subjects: is_active → visibility
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'visible';
UPDATE public.subjects SET visibility = 'hidden' WHERE is_active = false;
ALTER TABLE public.subjects DROP COLUMN IF EXISTS is_active;

-- 4. Issues: is_active → visibility
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'visible';
UPDATE public.issues SET visibility = 'hidden' WHERE is_active = false;
ALTER TABLE public.issues DROP COLUMN IF EXISTS is_active;

-- 5. Tasks: is_active → visibility
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'visible';
UPDATE public.tasks SET visibility = 'hidden' WHERE is_active = false;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS is_active;

-- 6. status 値の正規化
UPDATE public.subjects SET status = 'open' WHERE status IN ('active', 'inactive');
UPDATE public.issues SET status = 'open' WHERE status = 'inactive';
UPDATE public.issues SET status = 'resolved' WHERE status = 'closed';
UPDATE public.tasks SET status = 'todo' WHERE status = 'inactive';
UPDATE public.tasks SET status = 'todo' WHERE status = 'in_progress';
UPDATE public.tasks SET status = 'done' WHERE status IN ('completed', 'cancelled');
```

### Step 2: RPC 関数更新

`get_goal_detail` の ORDER BY を更新:
- `is_active DESC` → `visibility = 'visible' DESC`（visible が先）
- subjects/issues/tasks すべて同様

`get_context_map` の Goals 取得に `visibility` を含める。

### Step 3: MCP ハンドラ修正

`lib/mcp/handlers.ts`:
- `updateSubject`, `updateIssue`, `updateTask`: `is_active` → `visibility` パラメータ
- `completeGoal`: `status = 'inactive'` → `status = 'completed'`（visibility は変更しない）

### Step 4: MCP ツール定義修正

`lib/mcp/tools.ts`:
- SESSION_ID_PROPERTY と同様に、全ツールから `is_active` → `visibility` に差し替え
- description: "visibility: 'visible' or 'hidden'"

### Step 5: BFF records API 修正

`app/api/records/[table]/[id]/route.ts`:
- PATCH: `body.is_active` → `body.visibility`

### Step 6: FE 修正

`goal-editor.tsx`:
- バッジスタイル: `item.is_active === false` → `item.visibility === "hidden"`
- トグル: `is_active: true/false` → `visibility: "visible"/"hidden"`
- フィルター: `item.is_active === false` → `item.visibility === "hidden"`
- 非アクティブ subject の子フィルター: 同様に visibility ベース
- "show Inactive" → "show Hidden"
- add ボタン: subjects の初期 status を `"active"` → `"open"` に修正

`unified-workspace.tsx`:
- Goals サイドバー: `g.status === "active"` → `g.visibility !== "hidden"`（または `g.visibility === "visible"`）
- "Inactiveも表示" → "Hiddenも表示"

### Step 7: Dify プロンプト更新

- `is_active` → `visibility` の変更をプロンプトに反映
- Dify が `update_xxx` で `visibility: "hidden"` を渡せることを明記

### Step 8: デプロイ & 確認

1. DB マイグレーション実行
2. RPC 関数更新 + REVOKE 再適用
3. コード変更をデプロイ
4. 確認項目:
   - [ ] Goals: active ゴールが表示される。completed + hidden は "show Hidden" で表示
   - [ ] Subjects/Issues/Tasks: visible が表示される。hidden は "show Hidden" で表示
   - [ ] トグル: visible ↔ hidden 切り替えが動く
   - [ ] バッジ: status の値が表示される。hidden 時はグレー
   - [ ] complete_goal: status=completed になる（visibility は変更されない）
   - [ ] Dify: update_xxx で visibility=hidden を渡して非表示にできる
   - [ ] send_payload: 変更なし（handlers 経由で動く）
   - [ ] ソート: visible が上、hidden が下

---

## ロールバック手順

```sql
-- visibility → is_active に戻す（緊急時）
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
UPDATE public.subjects SET is_active = false WHERE visibility = 'hidden';
ALTER TABLE public.subjects DROP COLUMN IF EXISTS visibility;
-- issues, tasks も同様
-- goals は visibility カラムを DROP + status='completed' を 'inactive' に戻す
```

---

## 所要時間見込み

| ステップ | 見込み |
|---------|--------|
| DB マイグレーション | 5分 |
| RPC 関数更新 | 10分 |
| MCP ハンドラ + ツール定義 | 15分 |
| BFF records API | 5分 |
| FE 修正 | 20分 |
| テスト・確認 | 15分 |
| **合計** | **約70分** |
