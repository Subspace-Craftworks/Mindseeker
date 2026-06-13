# Mindseeker MCP サーバー設定ガイド

Difyの「ツール」設定画面で、MindseekerのMCPを登録する際の正確な情報です。
（※Mindseekerは独自のOAuthプロバイダを内蔵しています）

## 基本設定

| 項目名 | 設定値 |
| :--- | :--- |
| **名前 (Name)** | `Mindseeker` |
| **接続タイプ (Type)** | `REST` |
| **URL (Endpoint)** | `https://mindseeker-tom-kidos-projects.vercel.app/api/mcp/dify-main` (メイン用)<br>※整理用サブエージェントの場合は末尾を `dify-sub` に変更してください。 |

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
