# Update Only Scenario

Updated: 2026-06-10

この文書は、前回の実行で得られた ID を使って、更新系 fixture だけを順番に実行するためのガイドです。

## 基本方針

- 新規作成は行わない
- 前回の実行で得られた Goal / Subject / Issue / Task の ID を使う
- 各 fixture の送信データは、固定プレースホルダを実 ID に差し替えてから送る
- 送信前の差し替え済み入力ファイルと、実行時の生ログを両方保存する

## 推奨順序

1. `update_goal.json`
2. `update_subject.json`
3. `update_issue.json`
4. `update_task.json`

## 実行時の注意

- それぞれの fixture は、`11111111-1111-1111-1111-111111111111` などのプレースホルダを含む場合がある
- 実行前に、前回の `ordered-execution` の結果から得た ID に置き換える
- 更新文面も、対象 ID が分かるように少し変えて送る

## 実行例

```powershell
.\dify\dify-test-data\run-update-only.ps1
```
