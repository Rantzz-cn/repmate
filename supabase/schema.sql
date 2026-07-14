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

-- Gym Circle: public identity, friendships, workout posts, and reactions.
create table if not exists public.social_profiles (user_id uuid primary key references auth.users(id) on delete cascade, username text not null, display_name text not null, avatar_url text, bio text not null default '', notifications_seen_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), constraint social_profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$'));
alter table public.social_profiles add column if not exists notifications_seen_at timestamptz;
create unique index if not exists social_profiles_username_lower_idx on public.social_profiles (lower(username));
create table if not exists public.friendships (id uuid primary key default gen_random_uuid(), requester_id uuid not null references auth.users(id) on delete cascade, addressee_id uuid not null references auth.users(id) on delete cascade, status text not null default 'pending' check (status in ('pending','accepted')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), constraint friendships_different_users check (requester_id <> addressee_id), constraint friendships_unique_direction unique (requester_id, addressee_id));
create table if not exists public.social_posts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, workout_id text, workout_summary jsonb not null default '{}'::jsonb, caption text not null default '' check (char_length(caption) <= 280), visibility text not null default 'friends' check (visibility in ('friends','public')), created_at timestamptz not null default now());
create table if not exists public.post_reactions (post_id uuid not null references public.social_posts(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, reaction text not null check (reaction in ('strong','respect','pr')), created_at timestamptz not null default now(), primary key (post_id, user_id));
alter table public.social_profiles enable row level security; alter table public.friendships enable row level security; alter table public.social_posts enable row level security; alter table public.post_reactions enable row level security;
create policy "Authenticated users discover profiles" on public.social_profiles for select to authenticated using (true);
create policy "Users create their social profile" on public.social_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their social profile" on public.social_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users view their friendships" on public.friendships for select to authenticated using ((select auth.uid()) in (requester_id, addressee_id));
create policy "Users send friend requests" on public.friendships for insert to authenticated with check ((select auth.uid()) = requester_id and status = 'pending');
create policy "Recipients accept friend requests" on public.friendships for update to authenticated using ((select auth.uid()) = addressee_id) with check ((select auth.uid()) = addressee_id and status = 'accepted');
create policy "Participants remove friendships" on public.friendships for delete to authenticated using ((select auth.uid()) in (requester_id, addressee_id));
create policy "Users view permitted social posts" on public.social_posts for select to authenticated using (user_id = (select auth.uid()) or visibility = 'public' or exists (select 1 from public.friendships f where f.status = 'accepted' and ((f.requester_id = (select auth.uid()) and f.addressee_id = social_posts.user_id) or (f.addressee_id = (select auth.uid()) and f.requester_id = social_posts.user_id))));
create policy "Users create their social posts" on public.social_posts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users delete their social posts" on public.social_posts for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Users view reactions on visible posts" on public.post_reactions for select to authenticated using (exists (select 1 from public.social_posts p where p.id = post_id));
create policy "Users add their reactions" on public.post_reactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users change their reactions" on public.post_reactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users remove their reactions" on public.post_reactions for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update on public.social_profiles to authenticated; grant select, insert, update, delete on public.friendships to authenticated; grant select, insert, delete on public.social_posts to authenticated; grant select, insert, update, delete on public.post_reactions to authenticated;
