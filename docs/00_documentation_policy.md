# Documentation Policy

Updated: 2026-06-10

## Purpose

This folder keeps the current, implementation-backed specification for Mindseeker.
The goal is to make the present behavior easy to find and to separate it from old plans, drafts, and migration notes.

## Rules

- Keep only the behavior that is implemented or verified in the current codebase here.
- Put exploratory notes, phase plans, concept drafts, and obsolete migration notes in `docs/archive/`.
- Keep one file for remaining work so open items do not get scattered again.
- Prefer feature-based documentation over history-based documentation.

## Current Document Set

- `docs/current-spec.md`: current implementation spec for auth, chat, goals, and the BFF
- `docs/fe-bff-dify-flow.md`: Japanese overview of the FE -> BFF -> Dify request flow
- `docs/open-issues.md`: only the remaining work and known gaps
- `docs/archive/`: older plans and notes that are no longer the source of truth

## What Belongs Here

- Authentication flow and session behavior
- App shell behavior
- Chat workspace behavior
- Goals workspace behavior
- BFF API contracts that are already implemented
- Supabase tables, migrations, and operational notes that are still current

## What Belongs in Archive

- Implementation plans that are already complete
- Early design memos that have been superseded
- Concept notes that explain the product direction but no longer define the live behavior
- Migration notes that have already been executed or replaced
