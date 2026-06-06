-- Add tenant ownership columns to the core planning tables.
-- Existing rows stay nullable until a backfill strategy is decided.

alter table public.goals
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.subjects
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.issues
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.events
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists goals_user_id_idx on public.goals (user_id);
create index if not exists subjects_user_id_idx on public.subjects (user_id);
create index if not exists issues_user_id_idx on public.issues (user_id);
create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists events_user_id_idx on public.events (user_id);

alter table public.goals enable row level security;
alter table public.subjects enable row level security;
alter table public.issues enable row level security;
alter table public.tasks enable row level security;
alter table public.events enable row level security;

drop policy if exists "select own goals" on public.goals;
create policy "select own goals"
on public.goals
for select
using (auth.uid() = user_id);

drop policy if exists "insert own goals" on public.goals;
create policy "insert own goals"
on public.goals
for insert
with check (auth.uid() = user_id);

drop policy if exists "update own goals" on public.goals;
create policy "update own goals"
on public.goals
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own goals" on public.goals;
create policy "delete own goals"
on public.goals
for delete
using (auth.uid() = user_id);

drop policy if exists "select own subjects" on public.subjects;
create policy "select own subjects"
on public.subjects
for select
using (auth.uid() = user_id);

drop policy if exists "insert own subjects" on public.subjects;
create policy "insert own subjects"
on public.subjects
for insert
with check (auth.uid() = user_id);

drop policy if exists "update own subjects" on public.subjects;
create policy "update own subjects"
on public.subjects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own subjects" on public.subjects;
create policy "delete own subjects"
on public.subjects
for delete
using (auth.uid() = user_id);

drop policy if exists "select own issues" on public.issues;
create policy "select own issues"
on public.issues
for select
using (auth.uid() = user_id);

drop policy if exists "insert own issues" on public.issues;
create policy "insert own issues"
on public.issues
for insert
with check (auth.uid() = user_id);

drop policy if exists "update own issues" on public.issues;
create policy "update own issues"
on public.issues
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own issues" on public.issues;
create policy "delete own issues"
on public.issues
for delete
using (auth.uid() = user_id);

drop policy if exists "select own tasks" on public.tasks;
create policy "select own tasks"
on public.tasks
for select
using (auth.uid() = user_id);

drop policy if exists "insert own tasks" on public.tasks;
create policy "insert own tasks"
on public.tasks
for insert
with check (auth.uid() = user_id);

drop policy if exists "update own tasks" on public.tasks;
create policy "update own tasks"
on public.tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own tasks" on public.tasks;
create policy "delete own tasks"
on public.tasks
for delete
using (auth.uid() = user_id);

drop policy if exists "select own events" on public.events;
create policy "select own events"
on public.events
for select
using (auth.uid() = user_id);

drop policy if exists "insert own events" on public.events;
create policy "insert own events"
on public.events
for insert
with check (auth.uid() = user_id);

drop policy if exists "update own events" on public.events;
create policy "update own events"
on public.events
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own events" on public.events;
create policy "delete own events"
on public.events
for delete
using (auth.uid() = user_id);

