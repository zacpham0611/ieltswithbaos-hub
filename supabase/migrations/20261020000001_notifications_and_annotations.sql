-- IELTS Teaching Hub Migration: Notifications Table, Submissions Annotation Support & Realtime Setup
-- Migration: 20261020000001_notifications_and_annotations.sql

-- 1. Create Notifications Table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text default 'info' check (type in ('info', 'success', 'warning')),
  read boolean default false not null,
  link_target text,
  created_at timestamptz default now() not null
);

-- Index for speedy retrieval by user ordered by timestamp
create index if not exists idx_notifications_user_created 
  on public.notifications(user_id, created_at desc);

-- 2. Row Level Security on Notifications
alter table public.notifications enable row level security;

-- Users can only view their own notifications
drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications
  for select
  using (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Authenticated teachers and system actions can create notifications for relevant users
drop policy if exists "Authenticated users can insert notifications" on public.notifications;
create policy "Authenticated users can insert notifications"
  on public.notifications
  for insert
  with check (auth.role() = 'authenticated');

-- Users can delete their own notifications
drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
  on public.notifications
  for delete
  using (auth.uid() = user_id);

-- 3. Optional direct annotations column on submissions (backward compatible with teacher_comments JSON)
alter table public.submissions add column if not exists annotations jsonb default '[]'::jsonb;

-- 4. Enable Supabase Realtime for Notifications Table
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
