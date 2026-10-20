-- =============================================================================
-- Migration: 20261020000002_fix_courses_rls_infinite_recursion.sql
-- Description:
-- 1. Eliminates circular RLS recursion between courses, enrollments, and profiles
--    using Postgres SECURITY DEFINER helper functions that bypass RLS evaluation.
-- 2. Binds helper functions directly to auth.uid() to eliminate any possibility
--    of parameter spoofing or accessing another user's data.
-- 3. Preserves strict teacher ownership, student enrollment rules, and privacy.
-- 4. Ensures safe search_path (public, pg_temp) and strict EXECUTE privileges.
-- 5. Does not touch or weaken unrelated tables (activity_logs, authorized_teachers,
--    monthly_assessments, payment_records, tuition_settings, tuition_statements).
-- 6. Grants authenticated users insert capability on profiles (matching auth.uid()).
-- 7. Ensures idempotent backfill of profiles for auth.users.
-- 8. Signals PostgREST schema cache reload.
-- =============================================================================

-- =============================================================================
-- SECTION 1: SECURITY DEFINER HELPER FUNCTIONS (Bound to auth.uid())
-- =============================================================================

-- 1. Check if caller has teacher role (bound to caller auth.uid())
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

-- 2. Check if caller has student role (bound to caller auth.uid())
create or replace function public.is_student()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'student'
  );
$$;

-- 3. Check if caller is the teacher of a specific course (bound to caller auth.uid())
create or replace function public.is_course_teacher(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.courses
    where id = p_course_id and teacher_id = auth.uid()
  );
$$;

-- 4. Check if caller is an approved enrolled student of a course (bound to caller auth.uid())
create or replace function public.is_student_enrolled(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.enrollments
    where course_id = p_course_id
      and student_id = auth.uid()
      and status = 'approved'
  );
$$;

-- 5. Check if caller teaches a specific student in any course (bound to caller auth.uid())
create or replace function public.is_teacher_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.courses c
    join public.enrollments e on e.course_id = c.id
    where c.teacher_id = auth.uid()
      and e.student_id = p_student_id
  );
$$;

-- 6. Helper: get caller's own role safely
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

-- Explicitly revoke public execution and grant only to authenticated
revoke all on function public.is_teacher() from public;
revoke all on function public.is_student() from public;
revoke all on function public.is_course_teacher(uuid) from public;
revoke all on function public.is_student_enrolled(uuid) from public;
revoke all on function public.is_teacher_of_student(uuid) from public;
revoke all on function public.get_my_role() from public;

grant execute on function public.is_teacher() to authenticated;
grant execute on function public.is_student() to authenticated;
grant execute on function public.is_course_teacher(uuid) to authenticated;
grant execute on function public.is_student_enrolled(uuid) to authenticated;
grant execute on function public.is_teacher_of_student(uuid) to authenticated;
grant execute on function public.get_my_role() to authenticated;

-- =============================================================================
-- SECTION 2: PROFILES POLICIES
-- =============================================================================

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Authenticated users can view teacher profiles" on public.profiles;
create policy "Authenticated users can view teacher profiles"
  on public.profiles for select
  to authenticated
  using (role = 'teacher');

drop policy if exists "Teachers can view enrolled or applicant student profiles" on public.profiles;
create policy "Teachers can view enrolled or applicant student profiles"
  on public.profiles for select
  to authenticated
  using (public.is_teacher_of_student(id));

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile fields" on public.profiles;
create policy "Users can update own profile fields"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (role = public.get_my_role() or public.get_my_role() is null)
  );

-- =============================================================================
-- SECTION 3: COURSES POLICIES
-- =============================================================================

drop policy if exists "Teachers can view own courses" on public.courses;
drop policy if exists "Teachers can insert own courses" on public.courses;
drop policy if exists "Teachers can update own courses" on public.courses;
drop policy if exists "Teachers can delete own courses" on public.courses;
drop policy if exists "Authenticated students can view active or enrolled courses" on public.courses;
drop policy if exists "Students can view enrolled courses or active courses by code" on public.courses;
drop policy if exists "Authenticated users can view active or enrolled courses" on public.courses;

create policy "Teachers can view own courses"
  on public.courses for select
  to authenticated
  using (teacher_id = auth.uid());

create policy "Teachers can insert own courses"
  on public.courses for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and public.is_teacher()
  );

create policy "Teachers can update own courses"
  on public.courses for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "Teachers can delete own courses"
  on public.courses for delete
  to authenticated
  using (teacher_id = auth.uid());

create policy "Authenticated users can view active or enrolled courses"
  on public.courses for select
  to authenticated
  using (
    status = 'active'
    or teacher_id = auth.uid()
    or public.is_student_enrolled(id)
  );

-- =============================================================================
-- SECTION 4: ENROLLMENTS POLICIES
-- =============================================================================

drop policy if exists "Students can view own enrollment records" on public.enrollments;
drop policy if exists "Teachers can view enrollments in their courses" on public.enrollments;
drop policy if exists "Students can request enrollment" on public.enrollments;
drop policy if exists "Students can re-apply rejected enrollment" on public.enrollments;
drop policy if exists "Teachers can update enrollments in their courses" on public.enrollments;
drop policy if exists "Students can cancel own pending requests" on public.enrollments;
drop policy if exists "Teachers can delete course enrollments" on public.enrollments;

create policy "Students can view own enrollment records"
  on public.enrollments for select
  to authenticated
  using (student_id = auth.uid());

create policy "Teachers can view enrollments in their courses"
  on public.enrollments for select
  to authenticated
  using (public.is_course_teacher(course_id));

create policy "Students can request enrollment"
  on public.enrollments for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.courses c
      where c.id = enrollments.course_id
        and c.status = 'active'
        and c.teacher_id <> auth.uid()
    )
  );

create policy "Students can re-apply rejected enrollment"
  on public.enrollments for update
  to authenticated
  using (student_id = auth.uid() and status = 'rejected')
  with check (student_id = auth.uid() and status = 'pending');

create policy "Teachers can update enrollments in their courses"
  on public.enrollments for update
  to authenticated
  using (public.is_course_teacher(course_id));

create policy "Students can cancel own pending requests" on public.enrollments;
create policy "Students can cancel own pending requests"
  on public.enrollments for delete
  to authenticated
  using (student_id = auth.uid() and status = 'pending');

create policy "Teachers can delete course enrollments"
  on public.enrollments for delete
  to authenticated
  using (public.is_course_teacher(course_id));

-- =============================================================================
-- SECTION 5: DEPENDENT TABLES (Assignments, Submissions, Class Sessions, Resources)
-- =============================================================================

-- Assignments
drop policy if exists "Teachers can view own course assignments" on public.assignments;
drop policy if exists "Enrolled students can view published assignments" on public.assignments;
drop policy if exists "Teachers can insert assignments" on public.assignments;
drop policy if exists "Teachers can update assignments" on public.assignments;
drop policy if exists "Teachers can delete assignments" on public.assignments;

create policy "Teachers can view own course assignments"
  on public.assignments for select
  to authenticated
  using (public.is_course_teacher(course_id));

create policy "Enrolled students can view published assignments"
  on public.assignments for select
  to authenticated
  using (
    status = 'published'
    and public.is_student_enrolled(course_id)
  );

create policy "Teachers can insert assignments"
  on public.assignments for insert
  to authenticated
  with check (public.is_course_teacher(course_id));

create policy "Teachers can update assignments"
  on public.assignments for update
  to authenticated
  using (public.is_course_teacher(course_id))
  with check (public.is_course_teacher(course_id));

create policy "Teachers can delete assignments"
  on public.assignments for delete
  to authenticated
  using (public.is_course_teacher(course_id));

-- Submissions (Teacher policies updated to use helper; student policies preserved)
drop policy if exists "Teachers can view course submissions" on public.submissions;
create policy "Teachers can view course submissions"
  on public.submissions for select
  to authenticated
  using (public.is_course_teacher(course_id));

drop policy if exists "Teachers can grade course submissions" on public.submissions;
create policy "Teachers can grade course submissions"
  on public.submissions for update
  to authenticated
  using (public.is_course_teacher(course_id))
  with check (public.is_course_teacher(course_id));

-- Class Sessions
drop policy if exists "Teachers can view class sessions" on public.class_sessions;
drop policy if exists "Enrolled students can view published sessions" on public.class_sessions;
drop policy if exists "Teachers can insert class sessions" on public.class_sessions;
drop policy if exists "Teachers can update class sessions" on public.class_sessions;
drop policy if exists "Teachers can delete class sessions" on public.class_sessions;

create policy "Teachers can view class sessions"
  on public.class_sessions for select
  to authenticated
  using (public.is_course_teacher(course_id));

create policy "Enrolled students can view published sessions"
  on public.class_sessions for select
  to authenticated
  using (
    is_published = true
    and public.is_student_enrolled(course_id)
  );

create policy "Teachers can insert class sessions"
  on public.class_sessions for insert
  to authenticated
  with check (public.is_course_teacher(course_id));

create policy "Teachers can update class sessions"
  on public.class_sessions for update
  to authenticated
  using (public.is_course_teacher(course_id))
  with check (public.is_course_teacher(course_id));

create policy "Teachers can delete class sessions"
  on public.class_sessions for delete
  to authenticated
  using (public.is_course_teacher(course_id));

-- Resources
drop policy if exists "Teachers can view resources" on public.resources;
drop policy if exists "Enrolled students can view published resources" on public.resources;
drop policy if exists "Teachers can insert resources" on public.resources;
drop policy if exists "Teachers can update resources" on public.resources;
drop policy if exists "Teachers can delete resources" on public.resources;

create policy "Teachers can view resources"
  on public.resources for select
  to authenticated
  using (teacher_id = auth.uid());

create policy "Enrolled students can view published resources"
  on public.resources for select
  to authenticated
  using (
    is_published = true
    and (course_id is null or public.is_student_enrolled(course_id))
  );

create policy "Teachers can insert resources"
  on public.resources for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and public.is_teacher()
  );

create policy "Teachers can update resources"
  on public.resources for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "Teachers can delete resources"
  on public.resources for delete
  to authenticated
  using (teacher_id = auth.uid());

-- =============================================================================
-- SECTION 6: USER BACKFILL & ROLE FIDELITY (Idempotent)
-- =============================================================================

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

update public.profiles
set role = 'teacher', updated_at = now()
where lower(email) = 'dinhvu06nthbf@gmail.com' and role <> 'teacher';

update public.profiles
set role = 'student', updated_at = now()
where lower(email) = 'k63.2412150326@ftu.edu.vn' and role <> 'student';

-- Signal PostgREST to reload schema cache
notify pgrst, 'reload schema';
