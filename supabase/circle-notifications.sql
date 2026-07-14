-- Run this once if Gym Circle was installed before notification support.
alter table public.social_profiles
  add column if not exists notifications_seen_at timestamptz;
