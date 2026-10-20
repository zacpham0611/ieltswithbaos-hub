-- =============================================================================
-- IELTS Teaching Hub — Production Relational Database Schema & Security
-- Migration Version: 20261020000000_init_ielts_hub_schema.sql
-- Description: 12 Normalized tables, strict RLS with WITH CHECK clauses,
--              hardened handle_new_user() trigger, teacher authorization,
--              submission tamper-prevention, and Realtime publications.
-- =============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- =============================================================================
-- 1. PROFILES TABLE
-- =============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('teacher', 'student')),
  avatar_url text,
  bio text,
  target_band text,
  language_preference text not null default 'vi' check (language_preference in ('vi', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- 1B. AUTHORIZED TEACHERS (Secure Onboarding & Verification)
-- =============================================================================
create table if not exists public.authorized_teachers (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  invite_code text unique,
  created_at timestamptz not null default now()
);

-- Pre-seed default teacher onboarding invite code for the project
insert into public.authorized_teachers (invite_code)
values ('IELTS-TEACHER-2026')
on conflict (invite_code) do nothing;

-- =============================================================================
-- 2. COURSES TABLE
-- =============================================================================
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  cover_url text,
  skills text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'archived', 'closed')),
  code text not null unique,
  start_date date,
  end_date date,
  tuition_model text not null default 'fixed_monthly' check (tuition_model in ('fixed_monthly', 'per_session', 'hourly', 'course_package')),
  tuition_amount numeric not null default 0 check (tuition_amount >= 0),
  currency text not null default 'VND' check (currency in ('VND', 'USD')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_courses_code on public.courses(code);
create index if not exists idx_courses_teacher on public.courses(teacher_id);

-- =============================================================================
-- 3. ENROLLMENTS TABLE (Roster & Join Requests)
-- =============================================================================
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'removed')),
  rejection_reason text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint uq_course_student unique (course_id, student_id)
);

create index if not exists idx_enrollments_course on public.enrollments(course_id);
create index if not exists idx_enrollments_student on public.enrollments(student_id);

-- =============================================================================
-- 4. ASSIGNMENTS TABLE
-- =============================================================================
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  instructions text not null default '',
  skill text not null check (skill in ('reading', 'writing', 'speaking', 'listening')),
  objectives text not null default '',
  due_date text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  reading_passage text,
  reading_questions jsonb default '[]'::jsonb,
  writing_task_type text,
  writing_prompt text,
  writing_min_words integer default 250,
  speaking_part text,
  speaking_cue_card jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assignments_course on public.assignments(course_id);

-- =============================================================================
-- 5. SUBMISSIONS TABLE
-- =============================================================================
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  skill text not null check (skill in ('reading', 'writing', 'speaking', 'listening')),
  status text not null default 'submitted' check (status in ('submitted', 'returned', 'resubmitted', 'graded')),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reading_answers jsonb,
  reading_score jsonb,
  reading_error_analysis jsonb,
  writing_text text,
  writing_word_count integer,
  writing_revisions jsonb default '[]'::jsonb,
  speaking_audio_url text,
  speaking_transcript text,
  speaking_duration integer,
  rubric_scores jsonb default '[]'::jsonb,
  strengths text,
  areas_to_improve text,
  teacher_comments text,
  next_steps text,
  ai_suggested_feedback text,
  score numeric
);

create index if not exists idx_submissions_assignment on public.submissions(assignment_id);
create index if not exists idx_submissions_student on public.submissions(student_id);
create index if not exists idx_submissions_course on public.submissions(course_id);

-- =============================================================================
-- 6. MONTHLY ASSESSMENTS TABLE
-- =============================================================================
create table if not exists public.monthly_assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  month text not null,
  target_band text,
  state text not null default 'draft' check (state in ('draft', 'ai_generated', 'in_review', 'approved', 'published', 'void')),
  learning_evidence jsonb not null default '{}'::jsonb,
  ai_draft jsonb not null default '{}'::jsonb,
  teacher_evaluation jsonb not null default '{}'::jsonb,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists idx_assessments_student on public.monthly_assessments(student_id);
create index if not exists idx_assessments_teacher on public.monthly_assessments(teacher_id);

-- =============================================================================
-- 7. TUITION SETTINGS TABLE
-- =============================================================================
create table if not exists public.tuition_settings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade unique,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  model text not null check (model in ('fixed_monthly', 'per_session', 'hourly', 'course_package')),
  currency text not null default 'VND' check (currency in ('VND', 'USD')),
  amount numeric not null default 0,
  session_rate numeric,
  hourly_rate numeric,
  billing_day integer default 1,
  due_days integer default 15,
  proration_rule text default 'none' check (proration_rule in ('none', 'daily', 'session')),
  early_payment_discount_percent numeric default 0,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- 8. TUITION STATEMENTS TABLE
-- =============================================================================
create table if not exists public.tuition_statements (
  id uuid primary key default gen_random_uuid(),
  statement_number text not null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  billing_period text not null,
  issue_date date not null default current_date,
  due_date date not null,
  currency text not null default 'VND' check (currency in ('VND', 'USD')),
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'published', 'paid', 'partially_paid', 'overdue', 'void')),
  model text not null,
  itemized_charges jsonb not null default '[]'::jsonb,
  discount_amount numeric not null default 0,
  discount_description text,
  previous_balance numeric not null default 0,
  total_amount_due numeric not null default 0,
  amount_paid numeric not null default 0,
  remaining_balance numeric not null default 0,
  bank_info jsonb not null default '{}'::jsonb,
  audit_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_statements_student on public.tuition_statements(student_id);
create index if not exists idx_statements_teacher on public.tuition_statements(teacher_id);

-- =============================================================================
-- 9. PAYMENT RECORDS TABLE
-- =============================================================================
create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.tuition_statements(id) on delete cascade,
  amount numeric not null default 0 check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null default 'Bank Transfer',
  transaction_reference text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_statement on public.payment_records(statement_id);

-- =============================================================================
-- 10. CLASS SESSIONS TABLE
-- =============================================================================
create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  objectives text not null default '',
  skill text not null check (skill in ('reading', 'writing', 'speaking', 'listening')),
  teacher_notes text not null default '',
  activities text not null default '',
  homework text not null default '',
  session_date date not null default current_date,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_course on public.class_sessions(course_id);

-- =============================================================================
-- 11. RESOURCES TABLE
-- =============================================================================
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  title text not null,
  type text not null default 'pdf',
  url text,
  content text,
  tags text[] not null default '{}',
  skill text,
  folder text,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_resources_teacher on public.resources(teacher_id);

-- =============================================================================
-- 12. ACTIVITY LOGS TABLE
-- =============================================================================
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  text text not null,
  type text not null default 'info',
  target_tab text,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_user on public.activity_logs(user_id);

-- =============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER & ONBOARDING AUTHORIZATION
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := 'student';
  v_requested_role text;
  v_teacher_code text;
  v_is_authorized boolean := false;
  v_teacher_count int;
begin
  v_requested_role := lower(coalesce(new.raw_user_meta_data->>'role', 'student'));
  v_teacher_code := trim(coalesce(new.raw_user_meta_data->>'teacher_code', ''));

  if v_requested_role = 'teacher' then
    -- Check 1: Is this email pre-authorized in authorized_teachers?
    select exists (
      select 1 from public.authorized_teachers
      where email is not null and lower(email) = lower(new.email)
    ) into v_is_authorized;

    -- Check 2: If not pre-authorized by email, did they provide a valid invite code?
    if not v_is_authorized and v_teacher_code <> '' then
      select exists (
        select 1 from public.authorized_teachers
        where invite_code is not null and upper(invite_code) = upper(v_teacher_code)
      ) into v_is_authorized;
    end if;

    -- Check 3: Bootstrap mode — if no teacher exists yet in the database, allow the first registering teacher
    if not v_is_authorized then
      select count(*) into v_teacher_count from public.profiles where role = 'teacher';
      if v_teacher_count = 0 then
        v_is_authorized := true;
      end if;
    end if;

    if v_is_authorized then
      v_role := 'teacher';
    else
      -- Do not trust unverified metadata; assign student role
      v_role := 'student';
    end if;
  end if;

  insert into public.profiles (
    id,
    name,
    email,
    role,
    language_preference
  )
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    v_role,
    case
      when new.raw_user_meta_data->>'language_preference' in ('vi', 'en')
        then new.raw_user_meta_data->>'language_preference'
      else 'vi'
    end
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(nullif(excluded.name, ''), public.profiles.name),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- PROFILE INTEGRITY TRIGGER (Prevent Role Self-Promotion)
-- =============================================================================

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Prevent user from changing their role directly
  if new.role is distinct from old.role then
    raise exception 'Direct role modification is not permitted.';
  end if;

  -- Prevent user from changing their primary ID
  if new.id is distinct from old.id then
    raise exception 'Changing user ID is not permitted.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tr_protect_profile_fields on public.profiles;
create trigger tr_protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- =============================================================================
-- SUBMISSION TAMPER-PREVENTION TRIGGER
-- =============================================================================

create or replace function public.validate_submission_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_teacher boolean := false;
begin
  -- Check if current authenticated caller is the course teacher
  select exists (
    select 1 from public.courses c
    where c.id = old.course_id and c.teacher_id = auth.uid()
  ) into v_is_teacher;

  if v_is_teacher then
    -- Teacher is grading: preserve student submission content exactly
    new.student_id := old.student_id;
    new.course_id := old.course_id;
    new.assignment_id := old.assignment_id;
    new.skill := old.skill;
    new.writing_text := old.writing_text;
    new.reading_answers := old.reading_answers;
    new.speaking_audio_url := old.speaking_audio_url;
  elsif auth.uid() = old.student_id then
    -- Student is updating their own work:
    -- Cannot modify already graded writing/speaking submissions
    if old.status = 'graded' and old.skill in ('writing', 'speaking') then
      raise exception 'Cannot modify an already graded submission.';
    end if;

    -- Students CANNOT modify teacher comments, rubrics, strengths, or scores
    if old.skill in ('writing', 'speaking') then
      new.score := old.score;
      new.rubric_scores := old.rubric_scores;
      new.strengths := old.strengths;
      new.areas_to_improve := old.areas_to_improve;
      new.teacher_comments := old.teacher_comments;
      new.next_steps := old.next_steps;
      new.ai_suggested_feedback := old.ai_suggested_feedback;
      -- Force status to resubmitted if revising after return, else submitted
      if new.status not in ('submitted', 'resubmitted') then
        new.status := case when old.status = 'returned' then 'resubmitted' else 'submitted' end;
      end if;
    else
      -- Reading quiz: auto-scoring permitted on submit, but feedback fields cannot be forged
      new.strengths := old.strengths;
      new.areas_to_improve := old.areas_to_improve;
      new.teacher_comments := old.teacher_comments;
      new.next_steps := old.next_steps;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tr_validate_submission_update on public.submissions;
create trigger tr_validate_submission_update
  before update on public.submissions
  for each row execute function public.validate_submission_update();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.authorized_teachers enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.monthly_assessments enable row level security;
alter table public.tuition_settings enable row level security;
alter table public.tuition_statements enable row level security;
alter table public.payment_records enable row level security;
alter table public.class_sessions enable row level security;
alter table public.resources enable row level security;
alter table public.activity_logs enable row level security;

-- -----------------------------------------------------------------------------
-- PROFILES POLICIES
-- -----------------------------------------------------------------------------

drop policy if exists "Allow users to read their own profile" on public.profiles;
drop policy if exists "Allow teachers and students in same course to view profile" on public.profiles;
drop policy if exists "Allow users to update own profile" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Authenticated users can view teacher profiles" on public.profiles;
drop policy if exists "Teachers can view enrolled or applicant student profiles" on public.profiles;
drop policy if exists "Users can update own profile fields" on public.profiles;

-- Users can read their own profile
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- Authenticated users can view public teacher profiles (for course preview & discovery)
create policy "Authenticated users can view teacher profiles"
  on public.profiles for select
  to authenticated
  using (role = 'teacher');

-- Teachers can view profiles of students who are enrolled in or applied to their courses
create policy "Teachers can view enrolled or applicant student profiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      join public.enrollments e on e.course_id = c.id
      where c.teacher_id = auth.uid()
        and e.student_id = public.profiles.id
    )
  );

-- Users can update their own profile fields (role alteration guarded by WITH CHECK and trigger)
create policy "Users can update own profile fields"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- AUTHORIZED TEACHERS POLICIES
-- -----------------------------------------------------------------------------

drop policy if exists "Teachers can view authorized teacher list" on public.authorized_teachers;

create policy "Teachers can view authorized teacher list"
  on public.authorized_teachers for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'teacher'
    )
  );

-- -----------------------------------------------------------------------------
-- COURSES POLICIES
-- -----------------------------------------------------------------------------

drop policy if exists "Teachers can manage own courses" on public.courses;
drop policy if exists "Students can view enrolled courses or active courses by code" on public.courses;
drop policy if exists "Authenticated students can view active or enrolled courses" on public.courses;
drop policy if exists "Teachers can insert own courses" on public.courses;
drop policy if exists "Teachers can update own courses" on public.courses;
drop policy if exists "Teachers can delete own courses" on public.courses;
drop policy if exists "Teachers can view own courses" on public.courses;

-- Teachers can view, insert, update, delete their own courses
create policy "Teachers can view own courses"
  on public.courses for select
  to authenticated
  using (teacher_id = auth.uid());

create policy "Teachers can insert own courses"
  on public.courses for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'teacher'
    )
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

-- Authenticated students can search active courses by code or view enrolled courses
-- (ANONYMOUS USERS GET NO ACCESS)
create policy "Authenticated students can view active or enrolled courses"
  on public.courses for select
  to authenticated
  using (
    (
      status = 'active'
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'student'
      )
    )
    or exists (
      select 1 from public.enrollments e
      where e.course_id = courses.id
        and e.student_id = auth.uid()
        and e.status = 'approved'
    )
  );

-- -----------------------------------------------------------------------------
-- ENROLLMENTS POLICIES
-- -----------------------------------------------------------------------------

drop policy if exists "Students can view own enrollment records" on public.enrollments;
drop policy if exists "Students can request enrollment" on public.enrollments;
drop policy if exists "Students can re-apply rejected enrollment" on public.enrollments;
drop policy if exists "Teachers can view enrollments in their courses" on public.enrollments;
drop policy if exists "Teachers can update enrollments in their courses" on public.enrollments;
drop policy if exists "Students can cancel own pending requests" on public.enrollments;
drop policy if exists "Teachers can delete course enrollments" on public.enrollments;

-- Students view their own enrollment records
create policy "Students can view own enrollment records"
  on public.enrollments for select
  to authenticated
  using (student_id = auth.uid());

-- Teachers view enrollments for their own courses
create policy "Teachers can view enrollments in their courses"
  on public.enrollments for select
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = enrollments.course_id
        and c.teacher_id = auth.uid()
    )
  );

-- Students can request enrollment (CANNOT approve themselves; status MUST be 'pending')
create policy "Students can request enrollment"
  on public.enrollments for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'student'
    )
    and exists (
      select 1 from public.courses c
      where c.id = enrollments.course_id
        and c.status = 'active'
        and c.teacher_id <> auth.uid()
    )
  );

-- Students can re-apply if previously rejected (set status back to pending only)
create policy "Students can re-apply rejected enrollment"
  on public.enrollments for update
  to authenticated
  using (
    student_id = auth.uid()
    and status = 'rejected'
  )
  with check (
    student_id = auth.uid()
    and status = 'pending'
  );

-- Only course teachers can approve, reject, or remove student enrollments
create policy "Teachers can update enrollments in their courses"
  on public.enrollments for update
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = enrollments.course_id
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.courses c
      where c.id = enrollments.course_id
        and c.teacher_id = auth.uid()
    )
  );

-- Students can cancel own pending enrollment requests
create policy "Students can cancel own pending requests"
  on public.enrollments for delete
  to authenticated
  using (
    student_id = auth.uid()
    and status = 'pending'
  );

-- Teachers can remove/delete enrollment records from their courses
create policy "Teachers can delete course enrollments"
  on public.enrollments for delete
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = enrollments.course_id
        and c.teacher_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- ASSIGNMENTS POLICIES
-- -----------------------------------------------------------------------------

drop policy if exists "Teachers can manage assignments" on public.assignments;
drop policy if exists "Enrolled students can view published assignments" on public.assignments;
drop policy if exists "Teachers can view own course assignments" on public.assignments;
drop policy if exists "Teachers can insert assignments" on public.assignments;
drop policy if exists "Teachers can update assignments" on public.assignments;
drop policy if exists "Teachers can delete assignments" on public.assignments;

-- Teachers view assignments in their courses
create policy "Teachers can view own course assignments"
  on public.assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = assignments.course_id
        and c.teacher_id = auth.uid()
    )
  );

-- Enrolled students view published assignments in approved courses
create policy "Enrolled students can view published assignments"
  on public.assignments for select
  to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.enrollments e
      where e.course_id = assignments.course_id
        and e.student_id = auth.uid()
        and e.status = 'approved'
    )
  );

-- Teachers insert assignments for their own courses
create policy "Teachers can insert assignments"
  on public.assignments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.courses c
      where c.id = assignments.course_id
        and c.teacher_id = auth.uid()
    )
  );

-- Teachers update assignments in their own courses
create policy "Teachers can update assignments"
  on public.assignments for update
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = assignments.course_id
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.courses c
      where c.id = assignments.course_id
        and c.teacher_id = auth.uid()
    )
  );

-- Teachers delete assignments in their own courses
create policy "Teachers can delete assignments"
  on public.assignments for delete
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = assignments.course_id
        and c.teacher_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- SUBMISSIONS POLICIES
-- -----------------------------------------------------------------------------

drop policy if exists "Students can view own submissions" on public.submissions;
drop policy if exists "Students can insert own submissions" on public.submissions;
drop policy if exists "Students can update own submissions before grading" on public.submissions;
drop policy if exists "Students can update own submissions" on public.submissions;
drop policy if exists "Teachers can view course submissions" on public.submissions;
drop policy if exists "Teachers can grade course submissions" on public.submissions;

-- Students view own submissions
create policy "Students can view own submissions"
  on public.submissions for select
  to authenticated
  using (student_id = auth.uid());

-- Teachers view submissions in their courses
create policy "Teachers can view course submissions"
  on public.submissions for select
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = submissions.course_id
        and c.teacher_id = auth.uid()
    )
  );

-- Students insert own submissions for approved courses and published assignments
-- (Must NOT forge teacher feedback, rubrics, or teacher comments)
create policy "Students can insert own submissions"
  on public.submissions for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.enrollments e
      where e.course_id = submissions.course_id
        and e.student_id = auth.uid()
        and e.status = 'approved'
    )
    and exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id
        and a.course_id = submissions.course_id
        and a.status = 'published'
    )
    and teacher_comments is null
    and strengths is null
    and areas_to_improve is null
    and next_steps is null
    and (rubric_scores is null or rubric_scores = '[]'::jsonb)
  );

-- Students update own submissions before finalized grading
-- (Trigger tr_validate_submission_update prevents tampering with score/rubrics/comments)
create policy "Students can update own submissions"
  on public.submissions for update
  to authenticated
  using (
    student_id = auth.uid()
    and status in ('submitted', 'returned', 'resubmitted')
  )
  with check (
    student_id = auth.uid()
  );

-- Teachers grade submissions in their courses
create policy "Teachers can grade course submissions"
  on public.submissions for update
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = submissions.course_id
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.courses c
      where c.id = submissions.course_id
        and c.teacher_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- MONTHLY ASSESSMENTS POLICIES
-- -----------------------------------------------------------------------------

drop policy if exists "Teachers can manage monthly assessments" on public.monthly_assessments;
drop policy if exists "Students can view published assessments" on public.monthly_assessments;
drop policy if exists "Teachers can view monthly assessments" on public.monthly_assessments;
drop policy if exists "Teachers can insert monthly assessments" on public.monthly_assessments;
drop policy if exists "Teachers can update monthly assessments" on public.monthly_assessments;
drop policy if exists "Teachers can delete monthly assessments" on public.monthly_assessments;

-- Teachers view assessments for their courses
create policy "Teachers can view monthly assessments"
  on public.monthly_assessments for select
  to authenticated
  using (teacher_id = auth.uid());

-- Students view published assessments only
create policy "Students can view published assessments"
  on public.monthly_assessments for select
  to authenticated
  using (student_id = auth.uid() and state = 'published');

-- Teachers insert assessments for own courses & enrolled students
create policy "Teachers can insert monthly assessments"
  on public.monthly_assessments for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1 from public.courses c
      where c.id = monthly_assessments.course_id
        and c.teacher_id = auth.uid()
    )
    and exists (
      select 1 from public.enrollments e
      where e.course_id = monthly_assessments.course_id
        and e.student_id = monthly_assessments.student_id
        and e.status = 'approved'
    )
  );

-- Teachers update own assessments
create policy "Teachers can update monthly assessments"
  on public.monthly_assessments for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- Teachers delete own assessments
create policy "Teachers can delete monthly assessments"
  on public.monthly_assessments for delete
  to authenticated
  using (teacher_id = auth.uid());

-- -----------------------------------------------------------------------------
-- TUITION SETTINGS POLICIES
-- -----------------------------------------------------------------------------

drop policy if exists "Teachers can manage tuition settings" on public.tuition_settings;
drop policy if exists "Students can view course tuition settings" on public.tuition_settings;
drop policy if exists "Teachers can view tuition settings" on public.tuition_settings;
drop policy if exists "Teachers can insert tuition settings" on public.tuition_settings;
drop policy if exists "Teachers can update tuition settings" on public.tuition_settings;
drop policy if exists "Teachers can delete tuition settings" on public.tuition_settings;

create policy "Teachers can view tuition settings"
  on public.tuition_settings for select
  to authenticated
  using (teacher_id = auth.uid());

create policy "Students can view course tuition settings"
  on public.tuition_settings for select
  to authenticated
  using (
    exists (
      select 1 from public.enrollments e
      where e.course_id = tuition_settings.course_id
        and e.student_id = auth.uid()
        and e.status = 'approved'
    )
  );

create policy "Teachers can insert tuition settings"
  on public.tuition_settings for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1 from public.courses c
      where c.id = tuition_settings.course_id
        and c.teacher_id = auth.uid()
    )
  );

create policy "Teachers can update tuition settings"
  on public.tuition_settings for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1 from public.courses c
      where c.id = tuition_settings.course_id
        and c.teacher_id = auth.uid()
    )
  );

create policy "Teachers can delete tuition settings"
  on public.tuition_settings for delete
  to authenticated
  using (teacher_id = auth.uid());

-- -----------------------------------------------------------------------------
-- TUITION STATEMENTS POLICIES
-- -----------------------------------------------------------------------------

drop policy if exists "Teachers can manage tuition statements" on public.tuition_statements;
drop policy if exists "Students can view published tuition statements" on public.tuition_statements;
drop policy if exists "Teachers can view tuition statements" on public.tuition_statements;
drop policy if exists "Teachers can insert tuition statements" on public.tuition_statements;
drop policy if exists "Teachers can update tuition statements" on public.tuition_statements;
drop policy if exists "Teachers can delete tuition statements" on public.tuition_statements;

create policy "Teachers can view tuition statements"
  on public.tuition_statements for select
  to authenticated
  using (teacher_id = auth.uid());

create policy "Students can view published tuition statements"
  on public.tuition_statements for select
  to authenticated
  using (
    student_id = auth.uid()
    and status in ('approved', 'published', 'paid', 'partially_paid', 'overdue')
  );

create policy "Teachers can insert tuition statements"
  on public.tuition_statements for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1 from public.courses c
      where c.id = tuition_statements.course_id
        and c.teacher_id = auth.uid()
    )
    and exists (
      select 1 from public.enrollments e
      where e.course_id = tuition_statements.course_id
        and e.student_id = tuition_statements.student_id
        and e.status = 'approved'
    )
  );

create policy "Teachers can update tuition statements"
  on public.tuition_statements for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "Teachers can delete tuition statements"
  on public.tuition_statements for delete
  to authenticated
  using (teacher_id = auth.uid());

-- -----------------------------------------------------------------------------
-- PAYMENT RECORDS POLICIES
-- -----------------------------------------------------------------------------

drop policy if exists "Teachers can manage payment records" on public.payment_records;
drop policy if exists "Students can view payment records for their statements" on public.payment_records;
drop policy if exists "Teachers can view payment records" on public.payment_records;
drop policy if exists "Teachers can insert payment records" on public.payment_records;
drop policy if exists "Teachers can update payment records" on public.payment_records;
drop policy if exists "Teachers can delete payment records" on public.payment_records;

create policy "Teachers can view payment records"
  on public.payment_records for select
  to authenticated
  using (
    exists (
      select 1 from public.tuition_statements s
      where s.id = payment_records.statement_id
        and s.teacher_id = auth.uid()
    )
  );

create policy "Students can view payment records for their statements"
  on public.payment_records for select
  to authenticated
  using (
    exists (
      select 1 from public.tuition_statements s
      where s.id = payment_records.statement_id
        and s.student_id = auth.uid()
    )
  );

create policy "Teachers can insert payment records"
  on public.payment_records for insert
  to authenticated
  with check (
    exists (
      select 1 from public.tuition_statements s
      where s.id = payment_records.statement_id
        and s.teacher_id = auth.uid()
    )
  );

create policy "Teachers can update payment records"
  on public.payment_records for update
  to authenticated
  using (
    exists (
      select 1 from public.tuition_statements s
      where s.id = payment_records.statement_id
        and s.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tuition_statements s
      where s.id = payment_records.statement_id
        and s.teacher_id = auth.uid()
    )
  );

create policy "Teachers can delete payment records"
  on public.payment_records for delete
  to authenticated
  using (
    exists (
      select 1 from public.tuition_statements s
      where s.id = payment_records.statement_id
        and s.teacher_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- CLASS SESSIONS POLICIES
-- -----------------------------------------------------------------------------

drop policy if exists "Teachers can manage class sessions" on public.class_sessions;
drop policy if exists "Enrolled students can view published sessions" on public.class_sessions;
drop policy if exists "Teachers can view class sessions" on public.class_sessions;
drop policy if exists "Teachers can insert class sessions" on public.class_sessions;
drop policy if exists "Teachers can update class sessions" on public.class_sessions;
drop policy if exists "Teachers can delete class sessions" on public.class_sessions;

create policy "Teachers can view class sessions"
  on public.class_sessions for select
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = class_sessions.course_id
        and c.teacher_id = auth.uid()
    )
  );

create policy "Enrolled students can view published sessions"
  on public.class_sessions for select
  to authenticated
  using (
    is_published = true
    and exists (
      select 1 from public.enrollments e
      where e.course_id = class_sessions.course_id
        and e.student_id = auth.uid()
        and e.status = 'approved'
    )
  );

create policy "Teachers can insert class sessions"
  on public.class_sessions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.courses c
      where c.id = class_sessions.course_id
        and c.teacher_id = auth.uid()
    )
  );

create policy "Teachers can update class sessions"
  on public.class_sessions for update
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = class_sessions.course_id
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.courses c
      where c.id = class_sessions.course_id
        and c.teacher_id = auth.uid()
    )
  );

create policy "Teachers can delete class sessions"
  on public.class_sessions for delete
  to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = class_sessions.course_id
        and c.teacher_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- RESOURCES POLICIES
-- -----------------------------------------------------------------------------

drop policy if exists "Teachers can manage resources" on public.resources;
drop policy if exists "Enrolled students can view published resources" on public.resources;
drop policy if exists "Teachers can view resources" on public.resources;
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
    and course_id is not null
    and exists (
      select 1 from public.enrollments e
      where e.course_id = resources.course_id
        and e.student_id = auth.uid()
        and e.status = 'approved'
    )
  );

create policy "Teachers can insert resources"
  on public.resources for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and (
      course_id is null
      or exists (
        select 1 from public.courses c
        where c.id = resources.course_id
          and c.teacher_id = auth.uid()
      )
    )
  );

create policy "Teachers can update resources"
  on public.resources for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (
    teacher_id = auth.uid()
    and (
      course_id is null
      or exists (
        select 1 from public.courses c
        where c.id = resources.course_id
          and c.teacher_id = auth.uid()
      )
    )
  );

create policy "Teachers can delete resources"
  on public.resources for delete
  to authenticated
  using (teacher_id = auth.uid());

-- -----------------------------------------------------------------------------
-- ACTIVITY LOGS POLICIES
-- -----------------------------------------------------------------------------

drop policy if exists "Users can view and manage their own activity logs" on public.activity_logs;
drop policy if exists "Users can view own activity logs" on public.activity_logs;
drop policy if exists "Users can insert own activity logs" on public.activity_logs;
drop policy if exists "Users can update own activity logs" on public.activity_logs;
drop policy if exists "Users can delete own activity logs" on public.activity_logs;

create policy "Users can view own activity logs"
  on public.activity_logs for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own activity logs"
  on public.activity_logs for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own activity logs"
  on public.activity_logs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own activity logs"
  on public.activity_logs for delete
  to authenticated
  using (user_id = auth.uid());

-- =============================================================================
-- REALTIME SUBSCRIPTIONS PUBLICATION
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'enrollments'
  ) then
    alter publication supabase_realtime add table public.enrollments;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'submissions'
  ) then
    alter publication supabase_realtime add table public.submissions;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tuition_statements'
  ) then
    alter publication supabase_realtime add table public.tuition_statements;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'monthly_assessments'
  ) then
    alter publication supabase_realtime add table public.monthly_assessments;
  end if;
exception
  when undefined_object then
    null;
end;
$$;
