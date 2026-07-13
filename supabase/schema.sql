create table if not exists public.app_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  store text not null check (store in ('exercises','programs','workouts','activeWorkout','profile','recovery')),
  record_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, store, record_id)
);

alter table public.app_data enable row level security;
create policy "Users read their own RepMate data" on public.app_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert their own RepMate data" on public.app_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own RepMate data" on public.app_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own RepMate data" on public.app_data for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.app_data to authenticated;
