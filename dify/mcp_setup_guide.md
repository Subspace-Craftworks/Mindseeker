# Mindseeker MCP サーバー設定ガイド

Difyの「ツール」設定画面で、MindseekerのMCPを登録する際の正確な情報です。
（※Mindseekerは独自のOAuthプロバイダを内蔵しています）

## 基本設定

エージェントの目的に合わせて、以下のいずれかのURL（Endpoint）を設定してください。

| プロファイル（用途） | URL (Endpoint) |
| :--- | :--- |
| **メインアシスタント用** (`dify-main`)<br>※日常のゴール・タスク管理用 | `https://mindseeker-tom-kidos-projects.vercel.app/api/mcp/dify-main` |
| **整理特化サブエージェント用** (`dify-sub`)<br>※情報の構造化・一括整理専用 | `https://mindseeker-tom-kidos-projects.vercel.app/api/mcp/dify-sub` |
| **全機能版** (`general`)<br>※Artifact管理などすべての機能を含む | `https://mindseeker-tom-kidos-projects.vercel.app/api/mcp/general` |

Difyの「名前 (Name)」は、どのプロファイルか判別しやすい名前（例: `Mindseeker (Main)` や `Mindseeker (Sub)`）にすることをお勧めします。
「接続タイプ (Type)」はすべて `REST` を選択してください。

## 認証設定 (Authentication)

Dify側の認証方法として **OAuth2**（またはそれに準ずるカスタムOAuth）を選択し、以下の情報を入力してください。

| 項目名 | 設定値 |
| :--- | :--- |
| **Authorization URL** | `https://mindseeker-tom-kidos-projects.vercel.app/oauth/authorize` |
| **Token URL** | `https://mindseeker-tom-kidos-projects.vercel.app/api/oauth/token` |
| **Client ID** | `mindseeker-dify` (または任意の文字列) |
| **Client Secret** | `dify-secret` (または任意の文字列) |
| **Scope** | 空白で構いません |

※現在の実装では、Client IDとClient Secretの厳密な検証をバイパスする形になっていますので、Dify側で入力を求められた場合は適当な文字列（上記のようなもの）を入力してください。

設定後、Dify上で「Authorize（認証する）」ボタンを押すとMindseekerの画面に飛びます。そこでログインし「Authorize」を押すことで、自動的にアクセストークンがDifyに保存され、通信ができるようになります。

---

## 【新方式】BFFオーケストレーション方式での設定（推奨）

現在テスト中の「BFFオーケストレーション方式」では、Difyに直接MCPツールを登録・実行させるのではなく、**プロンプトでJSONを出力させ、Mindseeker側でそれをパースして実行**します。これにより、ネットワーク遅延が大幅に削減されます。

### 移行手順
1. **MCPツールの解除:** Dify側のエージェント設定画面から、登録されているMindseekerのMCPツールをすべて削除（または無効化）してください。
2. **システムプロンプトの追加:** エージェントのシステムプロンプトの**末尾**に、以下の指示を追記してください。

```markdown
## データベースの更新について
あなたは外部ツール（MCP）を直接呼び出すことはできません。データベース（Goal, Subject, Task, Event, Artifactなど）を更新・作成・削除したい場合は、必ず回答の**最後に**以下の形式のJSONコードブロックを出力してください。システムがそれを読み取って自動的にデータベースを更新します。

\`\`\`json
{
  "operations": [
    {
      "action": "create_task",
      "params": {
        "goal_id": "<対象のゴールID>",
        "title": "タスクのタイトル",
        "description": "詳細（省略可）"
      }
    },
    {
      "action": "bulk_add_goal_data",
      "params": {
        "goal_id": "<対象のゴールID>",
        "tasks": ["タスクA", "タスクB"],
        "subjects": ["サブジェクトA"]
      }
    }
  ]
}
\`\`\`

※ 新しくGoalを作成し、そのGoalに対して同時にTask等を追加したい場合は、`goal_id` に `"NEW"` と指定してください。
※ `action` に指定できるコマンド名は、以前まで使用していたMCPツールの名前（create_goal, create_subject, bulk_add_goal_data など）と完全に一致します。
```
