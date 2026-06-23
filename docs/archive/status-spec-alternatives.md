# ステータス設計 案の比較

Updated: 2026-06-22

---

## 案A: status + is_active の2軸（現行仕様書 status-spec.md）

status でドメイン進捗（open/done 等）を管理し、is_active で表示/非表示を独立管理する。

**詳細は status-spec.md を参照。**

---

## 案B: status を削除し、is_active のみで制御

### 概要

- `status` カラムを全テーブルから削除
- `is_active` (boolean) のみで管理
- ドメイン進捗（todo/done 等）の概念を廃止

### データモデル

| テーブル | カラム | 意味 |
|---------|--------|------|
| goals | `is_active` | true=進行中、false=完了・凍結 |
| subjects | `is_active` | true=進行中、false=完了・不要 |
| issues | `is_active` | true=未解決、false=解決済み |
| tasks | `is_active` | true=未完了、false=完了 |

### UIの表現

- バッジ: 表示しない（または `active` / `inactive` の2択のみ）
- トグル: active/inactive の切り替えのみ
- フィルター: "show Inactive" で非表示アイテムを表示

### メリット

- **シンプル**: 状態が1つしかないので混乱がない
- **実装が薄い**: DB制約、初期値のバリエーション、遷移ルールすべて不要
- **FE/MCP の整合性問題がない**: 何を表示するか迷わない

### デメリット

- **進捗が追えない**: タスクが「着手中」なのか「未着手」なのか区別できない
- **情報の欠落**: issue が解決したのか、単に非表示にしたのか区別できない
- **AI の判断材料が減る**: Dify がコンテキストを読む際に進捗状態がわからない
- **将来のカンバン等が作れない**: todo → in_progress → done のフローが実現不可

---

## 案C: is_active を削除し、status のみで制御（active/inactive）

### 概要

- `is_active` カラムを全テーブルから削除
- `status` を `active` / `inactive` の2値に統一
- 表示/非表示は `status = "inactive"` でフィルター

### データモデル

| テーブル | status の取り得る値 | 意味 |
|---------|-------------------|------|
| goals | `active`, `inactive` | 進行中 / 完了・凍結 |
| subjects | `active`, `inactive` | 進行中 / 完了・不要 |
| issues | `active`, `inactive` | 未解決 / 解決済み |
| tasks | `active`, `inactive` | 未完了 / 完了 |

### UIの表現

- バッジ: `active` / `inactive` を表示
- トグル: status を active/inactive に切り替え
- フィルター: "show Inactive" で `status = "inactive"` を表示

### メリット

- **シンプル**: カラムが1つで完結。2軸の混乱がない
- **以前のバグが根本的に消える**: 「`status` と `is_active` のどちらを見ればいいか」問題がない
- **Dify との相性が良い**: `status: "inactive"` と指示するだけで済む。boolean の `is_active` は LLM にとって扱いにくい場合がある
- **既存実装に近い**: Goals は元々この方式だった

### デメリット

- **進捗が追えない**: 案B と同じ。todo/in_progress/done の区別がない
- **情報の欠落**: 案B と同じ
- **将来のカンバン等が作れない**: 案B と同じ

### 案B との違い

- 案B: boolean で管理 → `true` / `false`
- 案C: text で管理 → `"active"` / `"inactive"`

実質的に同じだが、案C は将来 `active` / `inactive` 以外のステータス（`paused` 等）を追加しやすい。

---

## 比較まとめ

| 観点 | 案A (status + is_active) | 案B (is_active のみ) | 案C (status のみ) | 案D (status + visibility) |
|------|-------------------------|---------------------|-------------------|--------------------------|
| カラム数 | 2 | 1 | 1 | 2 |
| 進捗追跡 | ○ (open/todo/done 等) | × | × | ○ (open/todo/done 等) |
| シンプルさ | △ (2軸の理解が必要) | ◎ | ○ | ○ (2軸だが名前が明確) |
| 将来の拡張性 | ◎ (カンバン, フィルター) | × | △ (ステータス追加可能) | ◎ (visible/hidden/archived 等) |
| AI の扱いやすさ | △ (2フィールドの使い分け) | ○ | ◎ | ◎ (意味が明確) |
| 既存バグの再発リスク | △ (混乱の余地あり) | ◎ | ◎ | ○ (名前が明確で混乱しにくい) |
| DB 移行コスト | 中 (値の修正) | 大 (カラム削除) | 中 (is_active 削除 + 値統一) | 中 (is_active → visibility リネーム + 値変換) |
| FE 修正コスト | 小 (初期値修正) | 中 (バッジ削除等) | 中 (is_active→status 置換) | 中 (is_active→visibility 置換) |
| 命名の明確さ | △ (is_active が曖昧) | ○ | ○ | ◎ (status=状態, visibility=表示) |

---

## 案D の追加レビュー

### 案A との差分

案D は案A の `is_active` (boolean) を `visibility` (text: visible/hidden) に置き換えたもの。
ロジック的にはほぼ同等だが、以下の改善がある:

1. **命名の改善**: `is_active = false` は「進行中でない」にも「非表示」にも読める。`visibility = "hidden"` は明確に「非表示」
2. **text 型**: boolean → text にすることで将来 `archived`, `muted` 等の追加が自然
3. **AI フレンドリー**: Dify に対して `"visibility": "hidden"` と指示する方が `"is_active": false` より意図が伝わりやすい

### 移行コスト

- `is_active` を `visibility` にリネーム
- `true` → `"visible"`, `false` → `"hidden"` に値変換
- FE / MCP ハンドラ / RPC 関数の `is_active` 参照を `visibility` に置換
- "show Inactive" → "show Hidden" に文言変更

実質的に案A からの移行は「リネーム + 値変換」で完結する。ロジックの再設計は不要。

---

## 折衷案: 案C + 将来の拡張

今は案C（active/inactive の2値）で統一し、将来「進捗を追いたい」需要が出たら、その時に `progress` カラム（todo/in_progress/done）を追加する。

この場合：
- 今: `status` = `active` / `inactive`（シンプル）
- 将来: `status` + `progress`（必要になった時に追加）

ステータスの意味が明確で、かつ拡張の余地を残せる。
