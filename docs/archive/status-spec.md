# ステータスとアクティブ状態の仕様

Updated: 2026-06-22

---

## 1. 設計方針

各レコードには2つの独立した状態軸がある。

| 軸 | フィールド | 型 | 目的 |
|----|-----------|-----|------|
| **ドメインステータス** | `status` | text | そのアイテムの進捗・性質を表す |
| **アクティブ状態** | `is_active` | boolean | 表示/非表示の論理削除。運用上「もう見なくてよい」もの |

この2つは独立して管理する。`status` を変更しても `is_active` は変わらない。逆も同様。

---

## 2. テーブル別ステータス定義

### 2.1 Goals

| status | 意味 |
|--------|------|
| `active` | 進行中のゴール |
| `completed` | 達成したゴール |

- 初期値: `active`
- `is_active`: デフォルト `true`。完了・凍結したゴールを非表示にする場合に `false`
- `complete_goal` ツール実行時に `status: "completed"` + `is_active: false` に変更される

### 2.2 Subjects

| status | 意味 |
|--------|------|
| `open` | 進行中のテーマ |
| `closed` | 完了・解決したテーマ |

- 初期値: `open`
- `is_active`: デフォルト `true`。非表示にしたい場合に `false`

### 2.3 Issues

| status | 意味 |
|--------|------|
| `open` | 未解決 |
| `resolved` | 解決済み |

- 初期値: `open`
- `is_active`: デフォルト `true`

### 2.4 Tasks

| status | 意味 |
|--------|------|
| `todo` | 未着手 |
| `in_progress` | 作業中 |
| `done` | 完了 |

- 初期値: `todo`
- `is_active`: デフォルト `true`

### 2.5 Events

| status | 意味 |
|--------|------|
| (なし) | Events に status は使わない |

- `is_active` カラムなし
- Events は不変の記録であり、ステータス遷移の概念がない

---

## 3. UI での表現

### 3.1 バッジ表示

| 表示内容 | 決定元 |
|---------|--------|
| バッジのテキスト | `status` の値をそのまま表示（`open`, `todo`, `done` 等） |
| バッジの色 | `is_active` で決定 |

- `is_active = true`: アクセントカラー背景 + 白文字（目立つ）
- `is_active = false`: 透明背景 + グレー文字 + 枠線（控えめ）

### 3.2 active/inactive トグル

- subjects, issues, tasks の展開ビューに表示
- `is_active` を切り替える。`status` は変更しない
- events には表示しない

### 3.3 "show Inactive" チェックボックス

- OFF（デフォルト）: `is_active = false` のアイテムを非表示。非アクティブ subject の子（issues/tasks）も非表示
- ON: すべて表示

---

## 4. 初期値の統一ルール

| 作成元 | subjects | issues | tasks |
|--------|----------|--------|-------|
| MCP ツール (create_xxx) | `open` | `open` | `todo` |
| FE "+ Add" ボタン | `open` | `open` | `todo` |
| send_payload | `open` | `open` | `todo` |

**現状の問題**: FE の "+ Add Subject" が `status: "active"` を送っている。`"open"` に修正すべき。

---

## 5. ステータス遷移

### 5.1 Goals

```
active → completed（ゴール達成）
```

### 5.2 Subjects

```
open → closed（テーマ完了）
```

### 5.3 Issues

```
open → resolved（解決）
```

### 5.4 Tasks

```
todo → in_progress → done
```

### 5.5 is_active（全テーブル共通、Goals 含む）

```
true → false（非表示化。いつでも戻せる）
false → true（復活）
```

`is_active` はステータス遷移とは独立。`done` のタスクでも `is_active = true` のまま表示されることがある（ユーザーが明示的に非表示にするまで）。

---

## 6. 誰がステータスを変更するか

| 操作 | `status` | `is_active` |
|------|----------|-------------|
| Dify（MCP update_xxx） | 変更可能 | 変更可能 |
| FE active/inactive トグル | 変更しない | 変更する |
| FE "+Add" ボタン | 初期値を設定 | デフォルト true |
| send_payload | 変更可能 | 変更可能 |

---

## 7. DB 制約（あるべき姿）

現状は自由文字列だが、将来的に CHECK 制約を入れることを推奨:

```sql
ALTER TABLE goals ADD CONSTRAINT chk_goals_status CHECK (status IN ('active', 'completed'));
ALTER TABLE subjects ADD CONSTRAINT chk_subjects_status CHECK (status IN ('open', 'closed'));
ALTER TABLE issues ADD CONSTRAINT chk_issues_status CHECK (status IN ('open', 'resolved'));
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_status CHECK (status IN ('todo', 'in_progress', 'done'));
```

ただし、既存データの移行が先。

---

## 8. 既存データの移行が必要な項目

| テーブル | 現状の不正な値 | 修正先 |
|---------|--------------|--------|
| goals | `inactive` | `completed` + `is_active = false` |
| subjects | `active` | `open` |
| subjects | `inactive` | `open` + `is_active = false` |
| issues | `inactive` | `open` + `is_active = false` |
| issues | `closed` | `resolved` |
| tasks | `inactive` | `todo` + `is_active = false` |
| tasks | `completed` | `done` |
| tasks | `cancelled` | `done` + `is_active = false` |
