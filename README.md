# Mindseeker

AI-driven goal and task management through natural conversation.

Mindseeker lets you design, organize, and track goals through chat with an AI agent. Instead of manually creating tasks and updating statuses, you talk naturally — the AI interprets your intent and manages the underlying data structure for you.

## How It Works

```
You: "英語学習のゴールを作って。リスニングを重点的にやりたい"
AI:  → creates Goal "英語学習"
     → creates Subject "リスニング"
     → asks follow-up questions to refine the plan
```

The AI agent manages a hierarchy of planning objects:

- **Goals** — what you want to achieve
- **Subjects** — themes or areas within a goal
- **Issues** — open questions or concerns
- **Tasks** — concrete actions
- **Events** — decisions, progress, conversations (an activity log)

## Architecture

```
Browser ←→ Next.js BFF (Vercel) ←→ Dify AI Agent ←→ MCP Server ←→ Supabase DB
```

- **Frontend & BFF**: Next.js 15 (App Router), React 19, TypeScript
- **AI Agent**: Dify (chat engine with tool-calling via MCP)
- **Database & Auth**: Supabase (PostgreSQL, Row Level Security, Auth)
- **MCP Server**: Hosted within the Next.js app, exposes planning tools to Dify

The BFF acts as a secure relay — it authenticates users, manages sessions, injects context into Dify calls, and streams responses back to the browser.

## Key Features

- Streaming chat with AI-powered goal planning
- MCP-based tool execution (Dify calls tools directly to update DB)
- Session-based context injection (AI always knows what goal you're focused on)
- Multi-goal support with automatic context switching
- Goal detail editor with subjects, issues, tasks, events, and artifacts
- Google/GitHub OAuth via Supabase Auth

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Next.js 15 (App Router) |
| Styling | CSS custom properties (no framework) |
| BFF | Next.js API Routes |
| AI | Dify (LLM orchestration + tool calling) |
| MCP | JSON-RPC 2.0 over HTTP |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (Google, GitHub) |
| Hosting | Vercel |

## Getting Started

### Prerequisites

- Node.js 20+
- Supabase project (with Auth configured)
- Dify account with a chat agent configured
- Vercel account (for deployment)

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
4. Fill in your `.env` with Supabase and Dify credentials
5. Run database migrations (see `supabase/migrations/`)
6. Start the dev server:
   ```bash
   npm run dev
   ```

## Project Structure

```
app/                  # Next.js App Router (pages + API routes)
  api/chat/           # Chat BFF endpoint (streaming SSE)
  api/mcp/            # MCP server endpoint (JSON-RPC)
  api/goals/          # Goal CRUD API
  api/context-map/    # Context map API
components/           # React components
lib/
  api/                # Dify API client
  db/                 # Database helpers (goals, sessions, threads, etc.)
  mcp/                # MCP tool definitions and handlers
supabase/
  migrations/         # SQL migrations
  functions/          # Edge Functions (legacy, being phased out)
dify/                 # Dify configuration, prompts, and test data
docs/                 # Architecture and design documents
```

## Documentation

- [System Architecture](docs/system-architecture.md)
- [Session-Based Context Injection](docs/session-based-context-injection.md)
- [Migration Guide](docs/migration-to-session-architecture.md)

## License

This project is licensed under the [Business Source License 1.1](LICENSE).

- **Change Date**: 2031-06-18
- **Change License**: GNU Affero General Public License v3.0

After the Change Date, this software will be available under AGPL-3.0.
