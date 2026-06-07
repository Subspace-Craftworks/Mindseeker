alter table public.chat_threads
add column if not exists current_goal_id uuid null references public.goals(id) on delete set null;

create index if not exists chat_threads_current_goal_id_idx
  on public.chat_threads (current_goal_id);
