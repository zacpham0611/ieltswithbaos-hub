-- =============================================================================
-- Migration: 20261020000002_fix_profiles_rls_and_backfill.sql
-- Description:
-- 1. Adds missing INSERT RLS policy on public.profiles for authenticated users.
-- 2. Backfills any existing auth.users rows that lack public.profiles records.
-- 3. Ensures teacher role is set for authorized teachers (e.g. dinhvu06nthbf@gmail.com).
-- 4. Reloads PostgREST schema cache.
-- Idempotent and safe to run multiple times.
-- =============================================================================

-- 1. Allow authenticated users to insert their own profile matching auth.uid()
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- 2. Idempotent backfill of any existing auth.users lacking a public.profiles entry
insert into public.profiles (id, name, email, role, language_preference)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data->>'name'), ''), split_part(u.email, '@', 1), 'User'),
  coalesce(u.email, ''),
  case
    when lower(coalesce(u.raw_user_meta_data->>'role', '')) = 'teacher' then 'teacher'
    when lower(u.email) in ('dinhvu06nthbf@gmail.com') then 'teacher'
    else 'student'
  end,
  case
    when u.raw_user_meta_data->>'language_preference' in ('vi', 'en') then u.raw_user_meta_data->>'language_preference'
    else 'vi'
  end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- 3. Ensure role fidelity for confirmed user accounts
update public.profiles
set role = 'teacher', updated_at = now()
where lower(email) = 'dinhvu06nthbf@gmail.com' and role <> 'teacher';

update public.profiles
set role = 'student', updated_at = now()
where lower(email) = 'k63.2412150326@ftu.edu.vn' and role <> 'student';

-- 4. Signal PostgREST to reload schema cache
notify pgrst, 'reload schema';
