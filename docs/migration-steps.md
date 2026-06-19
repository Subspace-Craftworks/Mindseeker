# Migration Steps: Session-Based MCP Architecture

Updated: 2026-06-18

本文書は、JSON Orchestration 方式から Session + MCP Direct Execution 方式への移行を実施するための具体的な作業手順書です。

> 前提文書: [migration-to-session-architecture.md](./migration-to-session-architecture.md), [session-based-context-injection.md](./session-based-context-injection.md)

---

## Phase 1: 基盤構築

### Step 1.1: sessions テーブル作成

**ツール**: `tools/infra/manage-supabase.ts`

```bash
npx tsx tools/infra/manage-supabase.ts exec-sql "
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  dify_conversation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY \"select own sessions\" ON public.sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY \"insert own sessions\" ON public.sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY \"update own sessions\" ON public.sessions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY \"delete own sessions\" ON public.sessions
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_sessions_user_id ON public.sessions (user_id);
CREATE INDEX idx_sessions_dify_conversation_id ON public.sessions (dify_conversation_id);
"
```

**検証**:
```bash
npx tsx tools/infra/manage-supabase.ts exec-sql "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sessions' ORDER BY ordinal_position;"
```

**マイグレーションファイル作成** (ローカル記録用):
- `supabase/migrations/20260618000000_create_sessions.sql` に同じ SQL を保存

---

### Step 1.2: lib/db/sessions.ts 作成

新規ファイル `lib/db/sessions.ts` を作成する。

```typescript
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type SessionRecord = {
  id: string;
  user_id: string;
  current_goal_id: string | null;
  dify_conversation_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function createSession(userId: string): Promise<SessionRecord> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({ user_id: userId })
    .select("*")
    .single();

  if (error) throw error;
  return data as SessionRecord;
}

export async function getSession(sessionId: string, userId: string): Promise<SessionRecord | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as SessionRecord | null;
}

export async function updateSessionGoal(sessionId: string, currentGoalId: string | null): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("sessions")
    .update({
      current_goal_id: currentGoalId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}

export async function updateSessionConversation(sessionId: string, conversationId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("sessions")
    .update({
      dify_conversation_id: conversationId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}
```

---

### Step 1.3: MCP ハンドラに session 更新ロジック追加

**ファイル**: `lib/mcp/handlers.ts`

`executeTool` 関数を拡張し、`session_id` が渡された場合に自動で sessions テーブルを更新する。

```typescript
// 変更前
export async function executeTool(name: string, args: JsonObject, userId: string): Promise<any> {
  const handler = TOOL_HANDLERS.get(name);
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  const supabase = getSupabaseClient();
  const params = { ...args, user_id: userId };
  return handler(supabase, params);
}

// 変更後
import { updateSessionGoal } from "@/lib/db/sessions";

const GOAL_FOCUS_TOOLS = new Set(["create_goal", "update_goal", "get_goal"]);
const GOAL_CLEAR_TOOLS = new Set(["complete_goal"]);

export async function executeTool(name: string, args: JsonObject, userId: string): Promise<any> {
  const handler = TOOL_HANDLERS.get(name);
  if (!handler) throw new Error(`Unknown tool: ${name}`);

  const supabase = getSupabaseClient();
  // session_id を params から分離
  const { session_id, ...restArgs } = args as { session_id?: string } & JsonObject;
  const params = { ...restArgs, user_id: userId };
  
  const result = await handler(supabase, params);

  // session_id がある場合、current_goal_id を自動更新
  if (session_id && typeof session_id === "string") {
    try {
      if (GOAL_FOCUS_TOOLS.has(name) && result?.id) {
        await updateSessionGoal(session_id, result.id);
      } else if (GOAL_CLEAR_TOOLS.has(name)) {
        await updateSessionGoal(session_id, null);
      }
    } catch (err) {
      console.error("Failed to update session goal:", err);
      // セッション更新失敗はツール実行自体の失敗にしない
    }
  }

  return result;
}
```

---

### Step 1.4: MCP ツール定義に session_id を追加

**ファイル**: `lib/mcp/tools.ts`

各ツールの `inputSchema.properties` に以下を追加:

```typescript
session_id: { type: "string", description: "Optional session ID for context tracking" }
```

すべてのツールに一律で追加する（optional なので既存の呼び出しには影響しない）。

---

### Step 1.5: BFF chat route に session 解決ロジック追加

**ファイル**: `app/api/chat/route.ts`

POST ハンドラを以下のように変更:

```typescript
// リクエストから session_id を取得
const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";

// Session 解決
let resolvedSessionId = sessionId;
let currentGoalIdStr = "";
let currentGoalContextStr = "";

if (sessionId) {
  // 2回目以降: sessions テーブルから取得
  try {
    const session = await getSession(sessionId, user.id);
    if (session?.current_goal_id) {
      currentGoalIdStr = session.current_goal_id;
      const { getGoalContextText } = await import("@/lib/mcp/handlers");
      currentGoalContextStr = await getGoalContextText(currentGoalIdStr, user.id);
    }
  } catch (err) {
    console.error("Failed to resolve session:", err);
  }
} else {
  // 初回: 新しいセッションを作成
  try {
    const newSession = await createSession(user.id);
    resolvedSessionId = newSession.id;
  } catch (err) {
    console.error("Failed to create session:", err);
    resolvedSessionId = crypto.randomUUID(); // フォールバック
  }
}

// Dify への inputs に session_id を追加
const inputs = {
  session_id: resolvedSessionId,
  current_goal_id: currentGoalIdStr,
  current_goal_context: currentGoalContextStr,
};
```

ストリーム完了時の処理:

```typescript
// orchestrator を条件付きで実行（session_id がある場合はスキップ）
if (!resolvedSessionId) {
  // 旧方式フォールバック
  try {
    const result = await executeOperations(answer, user.id, currentGoalIdStr || undefined);
    if (result.resolvedCurrentGoalId) {
      finalCurrentGoalId = result.resolvedCurrentGoalId;
    }
  } catch (err) {
    console.error("Orchestration failed:", err);
  }
}

// session に conversation_id を紐付け
if (resolvedSessionId && upstreamConversationId) {
  try {
    await updateSessionConversation(resolvedSessionId, upstreamConversationId);
  } catch (err) {
    console.error("Failed to update session conversation:", err);
  }
}

// done イベントに session_id を含める
controller.enqueue(
  encoder.encode(
    encodeSseEvent({
      type: "done",
      conversationId: upstreamConversationId || undefined,
      answer,
      sessionId: resolvedSessionId || undefined,  // 追加
    }),
  ),
);
```

---

## Phase 2: FE 対応 + Dify 設定変更

### Step 2.1: FE に session_id 管理を追加

**ファイル**: `components/features/workspace/unified-workspace.tsx`

```typescript
// State 追加
const [sessionId, setSessionId] = useState<string | null>(null);

// 新規スレッド作成時にリセット
function handleNewThread() {
  setActiveThreadId(null);
  setSessionId(null);  // 新しいセッション開始
  // ...
}

// チャット送信時に session_id を含める
const response = await fetch("/api/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionToken}`,
  },
  body: JSON.stringify({
    message: input,
    conversation_id: conversationId,
    session_id: sessionId || undefined,  // 追加
  }),
});

// done イベントから session_id を受け取る
if (event.type === "done") {
  if (event.sessionId) {
    setSessionId(event.sessionId);
  }
  // ...
}
```

**StreamEvent 型の更新**:

```typescript
type ChatStreamEvent =
  | { type: "delta"; delta: string; conversationId?: string; }
  | { type: "thought"; thought: string; conversationId?: string; }
  | { type: "done"; conversationId?: string; answer: string; sessionId?: string; }  // sessionId 追加
  | { type: "error"; message: string; };
```

---

### Step 2.2: Dify エージェント設定変更

#### 2.2.1 inputs 変数の追加

Dify アプリの設定で、`session_id` を inputs 変数として追加する。

- 変数名: `session_id`
- 型: テキスト
- 必須: いいえ

#### 2.2.2 プロンプトの変更

**削除する指示** (旧 JSON Orchestration 関連):
```
データベースへの更新が必要な場合は、回答の最後に以下のフォーマットでJSONコードブロックを出力してください...
```

**追加する指示**:
```
## ツール利用時の注意
- データベースへの変更が必要な場合は、提供されているツール（create_goal, create_subject など）を使用してください。
- ツールを呼び出す際は、必ず session_id パラメータに {{session_id}} の値を含めてください。
- ツールの実行結果を確認し、成功/失敗に応じてユーザーに適切に報告してください。
```

#### 2.2.3 MCP ツールの登録確認

Dify に登録されている MCP ツールが、`session_id` パラメータを受け付けるようになっていることを確認する。Dify の Tool 設定画面で OpenAPI スキーマを再読み込みするか、手動で更新する。

---

### Step 2.3: 動作確認

1. FE からチャット送信（session_id なし → 初回）
2. BFF が session_id を生成してレスポンスに含めることを確認
3. FE が session_id を保管して2回目の送信に含めることを確認
4. Dify が MCP ツールを呼び出し、session_id を渡すことを確認
5. sessions テーブルの current_goal_id が自動更新されることを確認
6. 2回目以降のチャットで正しいコンテキストが送信されることを確認

```bash
# sessions テーブルの中身を確認
npx tsx tools/infra/manage-supabase.ts query-table sessions
```

---

## Phase 3: クリーンアップ

### Step 3.1: orchestrator 削除

Phase 2 が安定稼働していることを確認した後:

1. `app/api/chat/route.ts` から `executeOperations` の import と呼び出しを削除
2. `lib/orchestrator.ts` を削除

### Step 3.2: chat_threads.current_goal_id の廃止

1. `lib/db/context-map.ts` 内のロジックを sessions テーブルベースに変更
2. `lib/db/chat-threads.ts` から `updateChatThreadCurrentGoal` を削除
3. `upsertChatThread` から `currentGoalId` パラメータを削除
4. （任意）マイグレーションで `chat_threads.current_goal_id` カラムを DROP

```bash
npx tsx tools/infra/manage-supabase.ts exec-sql "ALTER TABLE public.chat_threads DROP COLUMN IF EXISTS current_goal_id;"
```

### Step 3.3: Supabase Edge Functions の再評価

MCP サーバ経由で全ツール操作が行われるようになった場合:
- `planning-api` Edge Function: Dify から直接呼ばれなくなるため、削除候補
- `context-api` Edge Function: `set_current_goal` 等が sessions テーブルに移行されるため、削除候補

ただし、他のクライアントからの利用がある場合は残す。

### Step 3.4: ドキュメント更新

- `docs/dify-context-and-json-orchestration.md` に「旧方式（廃止済み）」の注記を追加
- `docs/system-architecture.md` のシーケンス図を新方式に更新
- `docs/open-issues.md` から解決済みの Issue を削除

---

## チェックリスト

### Phase 1 完了条件
- [ ] sessions テーブルが作成されている
- [ ] `lib/db/sessions.ts` が作成されている
- [ ] MCP ハンドラが session_id を受け取り、sessions.current_goal_id を更新する
- [ ] MCP ツール定義に session_id が含まれている
- [ ] BFF chat route が session を解決し、inputs に含めて Dify を呼ぶ
- [ ] session_id がない場合、旧方式（orchestrator）にフォールバックする

### Phase 2 完了条件
- [ ] FE が session_id を管理し、送受信できる
- [ ] Dify プロンプトから JSON 出力指示が削除されている
- [ ] Dify がツール呼び出し時に session_id を渡す
- [ ] E2E でゴール作成→2回目チャットでコンテキスト反映が確認できる

### Phase 3 完了条件
- [ ] `lib/orchestrator.ts` が削除されている
- [ ] `chat_threads.current_goal_id` への参照がコード内にない
- [ ] ドキュメントが最新状態に更新されている
