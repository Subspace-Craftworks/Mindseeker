# FE ゴール選択とステータスバッジの仕様

Updated: 2026-06-22

---

## 1. センターペインのゴール表示（selectedGoalId の決定フロー）

### 概要

センターペイン（Goal Editor）に表示されるゴールは `selectedGoalId` state で管理されます。

### selectedGoalId が変更されるトリガー

| トリガー | 動作 | コード箇所 |
|---------|------|-----------|
| **左ペインの Goals リストをクリック** | クリックしたゴールを選択（もう一度クリックで解除） | `onClick={() => setSelectedGoalId(goal.id === selectedGoalId ? null : goal.id)}` |
| **スレッド切り替え / thread データ更新 / contextMap 更新** | `activeThread.current_goal_id` がcontextMap 内に存在すれば追従 | effect 依存: `[activeThreadId, activeThread?.current_goal_id, contextMap]` |
| **チャット送信前の同期** | `activeThread.current_goal_id` に合わせる（session が正） | handleSend 内 |
| **ゴール削除** | 削除されたゴールを選択中なら null にリセット | `handleGoalDeleted` |

### 新規ゴール作成後の表示フロー

```
1. ユーザーがチャット送信
2. BFF → Dify → MCP create_goal → sessions.current_goal_id 更新
3. ストリーム完了
4. refreshThreads() → threads 再取得（sessions テーブルの current_goal_id を含む）
5. Promise.all([refreshContextMap(), refreshGoalDetail()])
6. contextMap が更新される → goal sync effect が発火
7. activeThread.current_goal_id が新ゴールを指す
8. contextMap.goals に新ゴールが存在する → setSelectedGoalId(新ゴールID)
9. selectedGoalId 変更 → loadGoalDetail effect が発火 → GoalEditor に表示
```

### 既知の問題点

- **Step 4 の threads 再取得**: `GET /api/chat/threads` は sessions テーブルを JOIN して `current_goal_id` を取得するが、sessions テーブルの更新（Step 2）と threads の再取得（Step 4）の間にタイミングの問題がある可能性
- **Step 7**: `activeThread` は `threads` state から `useMemo` で導出される。`refreshThreads` で threads が更新されると `activeThread` も更新される。しかし新規スレッドの場合、`activeThreadId` が `refreshThreads` 内で `setActiveThreadId(matched.id)` に更新されるのと同じレンダリングサイクルで `activeThread` が反映されるか不確定
- **Goal sync effect が `contextMap` に依存**: contextMap の更新が頻繁に起きると不要な再発火がある。ただし条件 `if (threadGoalId) { if (goalExists) { ... } }` があるので、同じゴールが選択済みなら実質的に無害

### 問題の推定原因

新規チャットで「新しいスレッド」が作られた場合のフロー:
1. `threadKey = "draft"` でチャット開始
2. ストリーム完了後 `refreshThreads(conversationId)` → 新スレッドを見つけて `setActiveThreadId(matched.id)` → `return matched.id`
3. `nextThreadId` が返る → `refreshContextMap(nextThreadId)`
4. **しかし**: `activeThread` は次のレンダリングまで更新されない
5. goal sync effect は `activeThread?.current_goal_id` に依存するが、**この時点の activeThread はまだ null or 旧値**
6. `contextMap` 更新で effect が再発火するが、`activeThread` がまだ反映されていないため `if (!activeThread) return` で早期リターン

→ **activeThread の更新と contextMap の更新が同じレンダリングサイクルで起きた場合、effect は1回しか発火しない。その時点で activeThread が新しい thread を指していなければ、ゴール選択が追従しない。**

---

## 2. ステータスバッジの現状仕様

### データモデル

各レコード（subject, issue, task）には2つの状態フィールドがある:

| フィールド | 型 | 意味 | 例 |
|-----------|-----|------|-----|
| `status` | text | ドメイン固有のステータス | `open`, `todo`, `in_progress`, `done`, `resolved`, `closed` |
| `is_active` | boolean | アクティブ/非アクティブ（論理削除的） | `true` / `false` |

### バッジの表示ロジック（goal-editor.tsx RecordListItem）

```typescript
{Boolean(item.status) && (
  <span style={{
    background: item.is_active === false ? "transparent" : "var(--accent)",
    color: item.is_active === false ? "var(--muted)" : "white",
    border: item.is_active === false ? "1px solid var(--line)" : "none",
  }}>
    {String(item.status)}  ← status の値をそのまま表示
  </span>
)}
```

**つまり:**
- バッジのテキスト: `status` フィールドの値（`open`, `todo`, `done` 等）
- バッジのスタイル: `is_active` で決まる
  - `is_active = true` → 塗りつぶし（アクセントカラー背景 + 白文字）
  - `is_active = false` → 枠線のみ（透明背景 + グレー文字）

### active/inactive トグルボタン（goal-editor.tsx RecordListItem）

```typescript
// events 以外で表示
{table !== "events" && (
  <div>
    {["active", "inactive"].map((s) => {
      const isActive = item.is_active !== false;
      const isSelected = s === "active" ? isActive : !isActive;
      // クリック時: PATCH /api/records/{table}/{id} に { is_active: true/false } を送信
    })}
  </div>
)}
```

- トグルは `is_active` を変更する（`status` は変更しない）
- `events` テーブルにはトグルを表示しない（`is_active` カラムが無い）

### "show Inactive" チェックボックス（goal-editor.tsx GoalEditor）

```typescript
const filteredItems = showInactiveRelated
  ? items
  : items.filter((item) => {
      if (item.is_active === false) return false;  // is_active=false を非表示
      if ((table === "issues" || table === "tasks") && inactiveSubjectIds.has(item.subject_id)) return false;  // 非アクティブ subject の子も非表示
      return true;
    });
```

### 問題点と曖昧な箇所

1. **`status` の初期値が統一されていない**:
   - subjects: MCP create_subject → `status: "open"`, FE add → `status: "active"`
   - issues: MCP create_issue → `status: "open"`
   - tasks: MCP create_task → `status: "todo"`, FE add → `status: "todo"`
   - FE の add ボタン: `status: table === "tasks" ? "todo" : "active"`

2. **`status` の取り得る値が定義されていない**: DB に制約がなく自由文字列。実際に存在する値:
   - subjects: `open`, `active`, `closed`
   - issues: `open`, `resolved`, `closed`
   - tasks: `todo`, `in_progress`, `done`, `completed`, `cancelled`

3. **Goals の status**: Goals は `is_active` を持たず、`status` のみ（`active` / `inactive`）。Goals の active/inactive は `status` フィールドで管理。

4. **MCP の update ハンドラ**: `is_active` パラメータを受け付けるようにしたが、ツール定義（inputSchema）に `is_active` が明示されていないため、Dify/ChatGPT が認識しにくい可能性がある。

---

## 3. ソート順（get_goal_detail RPC）

| テーブル | ソート |
|---------|--------|
| subjects | `is_active DESC`, `updated_at DESC` |
| issues | `sub.is_active DESC`, `sub.updated_at DESC`, `i.is_active DESC`, `i.created_at ASC` |
| tasks | `sub.is_active DESC`, `sub.updated_at DESC`, `t.is_active DESC`, `t.created_at ASC` |
| events | `occurred_at DESC` |
| artifacts | `created_at DESC` |
