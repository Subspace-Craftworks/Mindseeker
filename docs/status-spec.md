はい。案Aをベースにするなら、案Dはかなり自然です。

## 案D: `status + visibility`

### 概要

`status` はドメイン上の状態、`visibility` は画面・AIコンテキスト上の表示制御として分離する。

```json
{
  "status": "resolved",
  "visibility": "visible"
}
```

これは矛盾しません。

意味は、

> 解決済みだが、まだ見える場所に置いておく

です。

---

## 設計方針

| 軸      | カラム          | 型    | 意味         |
| ------ | ------------ | ---- | ---------- |
| ドメイン状態 | `status`     | text | 進捗・完了・解決など |
| 表示状態   | `visibility` | text | 表示するか、隠すか  |

現行案Aの思想は維持しつつ、`is_active` という名前の混乱を避けます。現行仕様では `status` と `is_active` を独立軸として扱っていますが、`is_active` が「進行中」に見えてしまうのが問題でした。

---

## visibility の値

最初は2値で十分です。

```text
visible
hidden
```

| visibility | 意味                        |
| ---------- | ------------------------- |
| `visible`  | 通常表示する                    |
| `hidden`   | 通常画面では隠す。show hidden時だけ表示 |

将来必要なら、

```text
archived
muted
```

などを追加できます。

ただし最初は増やさない方がよいです。

---

## テーブル別 status

これは案Aをほぼ維持します。

| テーブル     | status                        |
| -------- | ----------------------------- |
| goals    | `active`, `completed`         |
| subjects | `open`, `closed`              |
| issues   | `open`, `resolved`            |
| tasks    | `todo` , `done` |
| events   | なし                            |

現行仕様でも、Goals / Subjects / Issues / Tasks ごとに status の意味を分ける設計になっています。

---

## UIルール

### 通常表示

* `visibility = visible` のみ表示
* `visibility = hidden` は非表示
* “show hidden” をONにすると hidden も表示

### バッジ

* バッジの文字: `status`
* バッジの見た目: `visibility`

例:

```text
open       通常表示
resolved   通常表示
resolved   hidden時は控えめ表示
```

---

## 操作ルール

| 操作            | status      | visibility    |
| ------------- | ----------- | ------------- |
| 完了・解決         | 変更する        | 変更しない         |
| 非表示化          | 変更しない       | `hidden` にする  |
| 復活            | 変更しない       | `visible` にする |
| complete_goal | `completed` | 変更しない         |
| 新規作成          | 初期値         | `visible`     |

---

## 例

### 解決したが、まだ表示したいIssue

```json
{
  "type": "issue",
  "title": "夜更かししてしまう",
  "status": "resolved",
  "visibility": "visible"
}
```

### 完了して、通常画面から隠したTask

```json
{
  "type": "task",
  "title": "睡眠ログを1週間つける",
  "status": "done",
  "visibility": "hidden"
}
```

### 閉じたSubjectだが、振り返り用に残す

```json
{
  "type": "subject",
  "title": "睡眠改善",
  "status": "closed",
  "visibility": "visible"
}
```

---

## 案Dの評価

| 観点          | 評価 |
| ----------- | -- |
| 思想の明確さ      | ◎  |
| AIへの伝わりやすさ  | ◎  |
| UIへの落とし込み   | ○  |
| DB移行コスト     | 中  |
| 将来拡張        | ◎  |
| 案Aからの移行しやすさ | ○  |

結論として、**案DがいちばんMindseekerらしい**と思います。

`status` は「そのものの状態」。
`visibility` は「いま見せるかどうか」。

この2つなら、AIにも人間にも説明しやすいです。
