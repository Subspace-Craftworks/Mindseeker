create table if not exists public.application_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  level text not null default 'error',
  source text not null,
  component text not null,
  operation text,
  route text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete set null,
  conversation_id text,
  request_id text,
  execution_id text,
  status_code integer,
  error_code text,
  stack text,
  app_key text not null default 'mindseeker'
);

create index if not exists application_logs_created_at_idx on public.application_logs (created_at desc);
create index if not exists application_logs_source_idx on public.application_logs (source);
create index if not exists application_logs_component_idx on public.application_logs (component);
create index if not exists application_logs_request_id_idx on public.application_logs (request_id);
create index if not exists application_logs_conversation_id_idx on public.application_logs (conversation_id);

alter table public.application_logs enable row level security;
