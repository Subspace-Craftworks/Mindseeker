# Development Guide

This document summarizes the local development setup for Mindseeker and how it connects to Supabase, GitHub, and Vercel.

## Overview

- Frontend/BFF: Next.js App Router
- Database/Auth/Edge Functions: Supabase
- Hosting: Vercel
- Source control: GitHub private repository `tom-kido/Mindseeker`

## Connected Services

- Supabase GitHub integration is connected to the repository root.
- Supabase production branch is `main`.
- Vercel is connected to the same GitHub repository.
- Vercel environment variable sync is enabled for:
  - Production
  - Preview
- Vercel environment variable sync is disabled for:
  - Development

## Local Development

### Prerequisites

- Node.js installed
- Git installed
- Supabase project already created
- Vercel project already linked

### Install dependencies

```bash
npm install
```

### Start the app locally

```bash
npm run dev
```

The app runs with Next.js development server.

### Type check

```bash
npm run typecheck
```

### Build check

```bash
npm run build
```

## Environment Variables

### Local `.env.local`

Because Vercel Development sync is disabled, local development should use `.env.local`.

Required variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DIFY_API_BASE_URL=
DIFY_API_KEY=
```

### Notes

- Do not commit secret values.
- Keep `.secrets/` out of Git history.
- Public client variables must use the `NEXT_PUBLIC_` prefix.

## Vercel Environment Settings

Current intended behavior:

- Production: enabled
- Preview: enabled
- Development: disabled

This means:

- Production deploys use Vercel-managed secrets.
- Preview deploys use the same Vercel-managed secrets.
- Local development uses `.env.local` or a pulled env file.

If you want to sync local values from Vercel, use:

```bash
vercel env pull .env.local
```

## Git Workflow

- Default branch: `main`
- Pushes to `main` are treated as production-ready changes.
- The repository is private.

## Supabase Notes

- Supabase GitHub integration watches the repository root.
- Migration files live under `supabase/migrations/`.
- Edge Function code lives under `supabase/functions/planning-api/`.
- The `planning-api` Edge Function uses `PLANNING_API_KEY` for request authentication.

## Supabase API Key Migration Note

- Current code keeps using the legacy Supabase keys:
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Supabase docs now recommend moving to the new key model:
  - `sb_publishable_...` for client-side access
  - `sb_secret_...` for server-side access
- Legacy `anon` and `service_role` keys are marked deprecated in the Dashboard and will be phased out in the future.
- No immediate code change is required for this project right now.
- When migrating later, update environment variables and code together so the FE, BFF, and Edge Function stay in sync.

## Useful Files

- `.env.example`
- `FE_BFF_IMPLEMENTATION_PLAN_phase1.md`
- `FE_BFF_IMPLEMENTATION_PLAN_phase2.md`
- `supabase/functions/planning-api/README.md`
- `supabase/functions/planning-api/PARAMETERS.md`
- `supabase/migrations/20260606_create_chat_threads.sql`
- `supabase/migrations/20260606_add_user_id_and_rls.sql`

## Common Checks

Before shipping a change:

1. `npm run typecheck`
2. `npm run build`
3. Confirm the relevant Supabase migration or Edge Function change is committed
4. Confirm the change is safe for Vercel Production and Preview environments
