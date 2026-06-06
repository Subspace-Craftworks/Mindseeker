create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dify_conversation_id text not null,
  title text,
  app_key text not null default 'mindseeker',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, dify_conversation_id)
);

alter table public.chat_threads enable row level security;

drop policy if exists "select own chat_threads" on public.chat_threads;
create policy "select own chat_threads"
on public.chat_threads
for select
using (auth.uid() = user_id);

drop policy if exists "insert own chat_threads" on public.chat_threads;
create policy "insert own chat_threads"
on public.chat_threads
for insert
with check (auth.uid() = user_id);

drop policy if exists "update own chat_threads" on public.chat_threads;
create policy "update own chat_threads"
on public.chat_threads
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own chat_threads" on public.chat_threads;
create policy "delete own chat_threads"
on public.chat_threads
for delete
using (auth.uid() = user_id);

