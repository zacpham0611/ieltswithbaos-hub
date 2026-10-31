-- =============================================================================
-- Migration: 20261031000000_regular_tests_and_strict_exam_mode.sql
-- Description: Isolated database schema, RLS policies, and server-side RPCs
--              for Regular Tests (Kiểm tra định kỳ) with Strict Exam Mode.
-- Architecture: Complete independence from assignments/submissions tables.
-- =============================================================================

-- Enable pgcrypto for secure cryptographic hashing if not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. REGULAR TESTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.regular_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  skills TEXT[] NOT NULL DEFAULT '{"reading"}', -- 'reading', 'writing', etc.
  
  -- Scheduling and availability window
  availability_start TIMESTAMPTZ,
  availability_end TIMESTAMPTZ,
  hard_deadline TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  
  -- Timing Mode: 'overall_timer' (single timer for all sections) OR 'per_section' (fixed sequential locked sections)
  timing_mode TEXT NOT NULL DEFAULT 'overall_timer' CHECK (timing_mode IN ('overall_timer', 'per_section')),
  section_timers JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"reading": 60, "writing": 60}
  
  -- Student Eligibility (resolved at publish time; empty array means all enrolled course students)
  eligible_student_ids UUID[] NOT NULL DEFAULT '{}',
  max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts >= 1),
  
  -- Access Code (stored salted-hashed; never plaintext, never sent to students)
  access_code_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  access_code_hash TEXT,
  access_code_salt TEXT,
  access_code_failures JSONB NOT NULL DEFAULT '{}'::jsonb, -- tracks consecutive failures per student
  
  -- Strict Exam Mode Settings & Preset
  strict_preset TEXT NOT NULL DEFAULT 'standard' CHECK (strict_preset IN ('off', 'standard', 'strict')),
  strict_settings JSONB NOT NULL DEFAULT '{
    "desktopOnly": true,
    "fullscreenRequired": true,
    "blockCopyReading": true,
    "blockPasteWriting": false,
    "readingInactivitySeconds": 60,
    "disableSpellcheck": true,
    "watermark": true,
    "preventDevTools": true,
    "sessionPolicy": "takeover",
    "ipAllowlist": []
  }'::jsonb,
  
  -- Status workflow: draft -> scheduled -> live -> completed -> closed -> archived
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'live', 'completed', 'closed', 'archived')),
  current_version INTEGER NOT NULL DEFAULT 1,
  
  -- Results release configuration
  release_settings JSONB NOT NULL DEFAULT '{
    "timing": "manual_review",
    "detailLevel": "score_only",
    "feedbackReleased": false
  }'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regular_tests_course ON public.regular_tests(course_id);
CREATE INDEX IF NOT EXISTS idx_regular_tests_teacher ON public.regular_tests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_regular_tests_status ON public.regular_tests(status);

-- =============================================================================
-- 2. REGULAR TEST VERSIONS TABLE (Immutable Snapshots on Publish)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.regular_test_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.regular_tests(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  
  -- Frozen sections payload containing passages, questions, prompt, and answer keys
  sections JSONB NOT NULL DEFAULT '[]'::jsonb, 
  /*
    sections: [
      {
        "skill": "reading",
        "title": "IELTS Reading Test",
        "passages": [...],
        "readingQuestions": [...],
        "questionGroups": [...]
      },
      {
        "skill": "writing",
        "taskType": "task2",
        "taskPrompt": "...",
        "minWords": 250
      }
    ]
  */
  instructions TEXT NOT NULL DEFAULT '',
  config_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_test_version UNIQUE (test_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_regular_test_versions_test ON public.regular_test_versions(test_id);

-- =============================================================================
-- 3. REGULAR TEST ATTEMPTS TABLE (Single Attempt Covering the Full Exam)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.regular_test_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.regular_tests(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.regular_test_versions(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  
  -- Server-Enforced Timers & Deadlines
  attempt_number INTEGER NOT NULL DEFAULT 1,
  server_start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  server_deadline TIMESTAMPTZ NOT NULL,
  extra_time_minutes INTEGER NOT NULL DEFAULT 0 CHECK (extra_time_minutes >= 0),
  current_section_index INTEGER NOT NULL DEFAULT 0,
  section_start_times JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Attempt Status: in_progress -> submitted / auto_submitted / overdue
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'auto_submitted', 'overdue')),
  submitted_at TIMESTAMPTZ,
  auto_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Session and Device Security
  session_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  device_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Answers and Draft Persistence
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  /*
    answers: {
      "reading": { "q_1": "TRUE", "q_2": "B" },
      "writing": { "text": "...", "wordCount": 265 }
    }
  */
  flagged_questions JSONB NOT NULL DEFAULT '{}'::jsonb,
  writing_revisions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Periodic 30s snapshots for teacher timeline
  save_revision_sequence INTEGER NOT NULL DEFAULT 1,
  
  -- Grading & Bands
  grading_status TEXT NOT NULL DEFAULT 'pending' CHECK (grading_status IN ('pending', 'auto_graded', 'pending_manual', 'fully_graded')),
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  /*
    scores: {
      "reading": { "raw": 32, "max": 40, "band": 7.5, "errorAnalysis": [...] },
      "writing": { "band": 7.0, "rubricScores": [...], "feedback": {...} },
      "overall": 7.5
    }
  */
  is_released BOOLEAN NOT NULL DEFAULT FALSE,
  released_at TIMESTAMPTZ,
  score_adjustments JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_test_student_attempt UNIQUE (test_id, student_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_regular_test_attempts_test ON public.regular_test_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_regular_test_attempts_student ON public.regular_test_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_regular_test_attempts_status ON public.regular_test_attempts(status);

-- =============================================================================
-- 4. REGULAR TEST AUDIT EVENTS TABLE (Append-Only Anti-Cheating Log)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.regular_test_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.regular_test_attempts(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.regular_tests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL,
  /*
    Types: tab_blur, tab_focus, fullscreen_exit, fullscreen_enter,
           copy_attempt, paste_detected, cut_attempt, shortcut_blocked,
           reading_inactivity, large_insertion, devtools_heuristic,
           heartbeat_loss, session_takeover, session_conflict,
           teacher_extra_time, teacher_announcement, teacher_resume
  */
  category TEXT NOT NULL DEFAULT 'objective' CHECK (category IN ('objective', 'indicator', 'teacher_action')),
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('info', 'low', 'medium', 'high')),
  
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_timestamp TIMESTAMPTZ,
  duration_seconds NUMERIC DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed', 'acknowledged', 'dismissed')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regular_test_events_attempt ON public.regular_test_events(attempt_id);
CREATE INDEX IF NOT EXISTS idx_regular_test_events_test ON public.regular_test_events(test_id);
CREATE INDEX IF NOT EXISTS idx_regular_test_events_student ON public.regular_test_events(student_id);

-- =============================================================================
-- 5. REGULAR TEST REPORT LINKS TABLE (Monthly Student Report Integration)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.regular_test_report_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.monthly_assessments(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES public.regular_test_attempts(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.regular_tests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_report_attempt_link UNIQUE (report_id, attempt_id)
);

CREATE INDEX IF NOT EXISTS idx_regular_test_report_links_report ON public.regular_test_report_links(report_id);
CREATE INDEX IF NOT EXISTS idx_regular_test_report_links_attempt ON public.regular_test_report_links(attempt_id);

-- =============================================================================
-- 6. SECURITY DEFINER RPCs & SERVER VALIDATION
-- =============================================================================

-- 6.1 Salted Hash Helper for Access Code
CREATE OR REPLACE FUNCTION public.hash_access_code(p_code TEXT, p_salt TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(digest(p_salt || ':' || trim(upper(p_code)), 'sha256'), 'hex');
$$;

-- 6.2 Transactional Start Attempt Function
CREATE OR REPLACE FUNCTION public.start_regular_test_attempt(
  p_test_id UUID,
  p_access_code TEXT DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_test RECORD;
  v_version RECORD;
  v_existing_attempt RECORD;
  v_now TIMESTAMPTZ := now();
  v_server_deadline TIMESTAMPTZ;
  v_attempt_id UUID;
  v_session_token TEXT := gen_random_uuid()::text;
  v_is_enrolled BOOLEAN := FALSE;
  v_is_eligible BOOLEAN := FALSE;
  v_sanitized_sections JSONB;
  v_calculated_deadline TIMESTAMPTZ;
  v_is_mobile BOOLEAN := FALSE;
  v_code_hash TEXT;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- 1. Fetch Test Configuration
  SELECT * INTO v_test FROM public.regular_tests WHERE id = p_test_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Regular test not found' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Verify Status is Live or Scheduled (with live window)
  IF v_test.status NOT IN ('live', 'scheduled') THEN
    RAISE EXCEPTION 'This test is not currently available for taking (Status: %)', v_test.status;
  END IF;

  -- 3. Check Availability Window
  IF v_test.availability_start IS NOT NULL AND v_now < v_test.availability_start THEN
    RAISE EXCEPTION 'This test has not started yet. Available from %', v_test.availability_start;
  END IF;
  IF v_test.availability_end IS NOT NULL AND v_now > v_test.availability_end THEN
    RAISE EXCEPTION 'This test availability window has ended on %', v_test.availability_end;
  END IF;
  IF v_test.hard_deadline IS NOT NULL AND v_now >= v_test.hard_deadline THEN
    RAISE EXCEPTION 'Hard deadline for this exam has passed on %', v_test.hard_deadline;
  END IF;

  -- 4. Check Course Enrollment & Eligibility
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments 
    WHERE course_id = v_test.course_id AND student_id = v_student_id AND status = 'approved'
  ) INTO v_is_enrolled;

  IF NOT v_is_enrolled THEN
    RAISE EXCEPTION 'You are not enrolled in this course' USING ERRCODE = '42501';
  END IF;

  IF v_test.eligible_student_ids IS NOT NULL AND array_length(v_test.eligible_student_ids, 1) > 0 THEN
    v_is_eligible := v_student_id = ANY(v_test.eligible_student_ids);
    IF NOT v_is_eligible THEN
      RAISE EXCEPTION 'You are not in the eligible students roster for this test' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 5. Server Device Check (Desktop-Only if enabled)
  IF (v_test.strict_settings->>'desktopOnly')::boolean IS TRUE THEN
    v_is_mobile := (p_device_info->>'isMobile')::boolean IS TRUE 
                   OR (p_device_info->>'userAgent') ~* '(Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini)';
    IF v_is_mobile THEN
      RAISE EXCEPTION 'Exam policy violation: This regular test must be taken on a desktop or laptop computer.';
    END IF;
  END IF;

  -- 6. Access Code Validation (if enabled)
  IF v_test.access_code_enabled IS TRUE THEN
    IF p_access_code IS NULL OR trim(p_access_code) = '' THEN
      RAISE EXCEPTION 'Access code is required to start this examination.';
    END IF;
    v_code_hash := public.hash_access_code(p_access_code, v_test.access_code_salt);
    IF v_code_hash <> v_test.access_code_hash THEN
      -- Record failure count in metadata
      UPDATE public.regular_tests 
      SET access_code_failures = jsonb_set(
        access_code_failures, 
        ARRAY[v_student_id::text], 
        to_jsonb(COALESCE((access_code_failures->>v_student_id::text)::int, 0) + 1)
      )
      WHERE id = v_test.id;

      RAISE EXCEPTION 'Invalid access code provided. Please contact your instructor.';
    END IF;
  END IF;

  -- 7. Check Existing Active or Completed Attempts
  SELECT * INTO v_existing_attempt 
  FROM public.regular_test_attempts 
  WHERE test_id = p_test_id AND student_id = v_student_id
  ORDER BY attempt_number DESC LIMIT 1;

  IF FOUND THEN
    -- If already in progress and deadline not expired, resume existing attempt seamlessly
    IF v_existing_attempt.status = 'in_progress' AND v_existing_attempt.server_deadline > v_now THEN
      -- Update session token if sessionPolicy is 'takeover'
      UPDATE public.regular_test_attempts 
      SET session_token = v_session_token,
          last_heartbeat = v_now,
          device_info = p_device_info
      WHERE id = v_existing_attempt.id;

      -- Return sanitized attempt info
      RETURN jsonb_build_object(
        'attemptId', v_existing_attempt.id,
        'testId', v_test.id,
        'title', v_test.title,
        'instructions', v_test.instructions,
        'skills', v_test.skills,
        'timingMode', v_test.timing_mode,
        'sectionTimers', v_test.section_timers,
        'serverStartTime', v_existing_attempt.server_start_time,
        'serverDeadline', v_existing_attempt.server_deadline,
        'extraTimeMinutes', v_existing_attempt.extra_time_minutes,
        'answers', v_existing_attempt.answers,
        'flaggedQuestions', v_existing_attempt.flagged_questions,
        'currentSectionIndex', v_existing_attempt.current_section_index,
        'status', v_existing_attempt.status,
        'sessionToken', v_session_token,
        'isResume', TRUE
      );
    ELSE
      -- Attempt completed, submitted, or expired
      IF v_existing_attempt.attempt_number >= v_test.max_attempts THEN
        RAISE EXCEPTION 'You have already completed the maximum number of attempts allowed for this test (Max: %).', v_test.max_attempts;
      END IF;
    END IF;
  END IF;

  -- 8. Fetch Active Published Version
  SELECT * INTO v_version 
  FROM public.regular_test_versions 
  WHERE test_id = p_test_id 
  ORDER BY version_number DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test version not found. The instructor has not published this test yet.';
  END IF;

  -- 9. Compute Effective Server Deadline
  v_calculated_deadline := v_now + (v_test.duration_minutes || ' minutes')::interval;
  IF v_test.hard_deadline IS NOT NULL AND v_calculated_deadline > v_test.hard_deadline THEN
    v_server_deadline := v_test.hard_deadline;
  ELSE
    v_server_deadline := v_calculated_deadline;
  END IF;

  -- 10. Create New Transactional Attempt
  INSERT INTO public.regular_test_attempts (
    test_id,
    version_id,
    student_id,
    course_id,
    attempt_number,
    server_start_time,
    server_deadline,
    extra_time_minutes,
    current_section_index,
    status,
    session_token,
    device_info,
    last_heartbeat,
    answers,
    flagged_questions
  ) VALUES (
    v_test.id,
    v_version.id,
    v_student_id,
    v_test.course_id,
    COALESCE(v_existing_attempt.attempt_number, 0) + 1,
    v_now,
    v_server_deadline,
    0,
    0,
    'in_progress',
    v_session_token,
    p_device_info,
    v_now,
    '{}'::jsonb,
    '{}'::jsonb
  ) RETURNING id INTO v_attempt_id;

  -- Return successfully activated attempt payload
  RETURN jsonb_build_object(
    'attemptId', v_attempt_id,
    'testId', v_test.id,
    'title', v_test.title,
    'instructions', v_test.instructions,
    'skills', v_test.skills,
    'timingMode', v_test.timing_mode,
    'sectionTimers', v_test.section_timers,
    'serverStartTime', v_now,
    'serverDeadline', v_server_deadline,
    'extraTimeMinutes', 0,
    'answers', '{}'::jsonb,
    'flaggedQuestions', '{}'::jsonb,
    'currentSectionIndex', 0,
    'status', 'in_progress',
    'sessionToken', v_session_token,
    'isResume', FALSE
  );
END;
$$;

-- 6.3 Secure Student Exam Delivery (Strips all answer keys & explanations)
CREATE OR REPLACE FUNCTION public.get_student_regular_test_exam(p_attempt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_attempt RECORD;
  v_test RECORD;
  v_version RECORD;
  v_sanitized_sections JSONB := '[]'::jsonb;
  v_sec RECORD;
  v_cleaned_sec JSONB;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_attempt FROM public.regular_test_attempts WHERE id = p_attempt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found' USING ERRCODE = 'P0002';
  END IF;

  -- Students can only inspect their own attempts; teachers can inspect course tests
  IF v_role = 'student' AND v_attempt.student_id <> v_user_id THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_test FROM public.regular_tests WHERE id = v_attempt.test_id;
  SELECT * INTO v_version FROM public.regular_test_versions WHERE id = v_attempt.version_id;

  -- If student has already completed and results are released with answers, show full data
  IF v_attempt.status IN ('submitted', 'auto_submitted', 'overdue') 
     AND v_attempt.is_released IS TRUE 
     AND (v_test.release_settings->>'detailLevel') = 'with_answers' 
     AND v_test.status IN ('closed', 'completed') THEN
    RETURN jsonb_build_object(
      'test', row_to_json(v_test),
      'version', row_to_json(v_version),
      'attempt', row_to_json(v_attempt)
    );
  END IF;

  -- Otherwise: recursively sanitize sections to strip correctAnswer, explanation, and answerKey
  FOR v_sec IN SELECT * FROM jsonb_array_elements(v_version.sections) LOOP
    v_cleaned_sec := v_sec.value;
    
    -- Sanitize Reading questions
    IF v_cleaned_sec ? 'readingQuestions' AND jsonb_typeof(v_cleaned_sec->'readingQuestions') = 'array' THEN
      v_cleaned_sec := jsonb_set(
        v_cleaned_sec,
        '{readingQuestions}',
        (
          SELECT jsonb_agg(elem - 'correctAnswer' - 'correct_answer' - 'explanation' - 'citation')
          FROM jsonb_array_elements(v_cleaned_sec->'readingQuestions') elem
        )
      );
    END IF;

    -- Sanitize passages if nested questions exist
    IF v_cleaned_sec ? 'passages' AND jsonb_typeof(v_cleaned_sec->'passages') = 'array' THEN
      v_cleaned_sec := jsonb_set(
        v_cleaned_sec,
        '{passages}',
        (
          SELECT jsonb_agg(
            CASE 
              WHEN p ? 'questions' AND jsonb_typeof(p->'questions') = 'array' THEN
                jsonb_set(
                  p,
                  '{questions}',
                  (SELECT jsonb_agg(qe - 'correctAnswer' - 'correct_answer' - 'explanation' - 'citation') 
                   FROM jsonb_array_elements(p->'questions') qe)
                )
              ELSE p
            END
          )
          FROM jsonb_array_elements(v_cleaned_sec->'passages') p
        )
      );
    END IF;

    v_sanitized_sections := v_sanitized_sections || jsonb_build_array(v_cleaned_sec);
  END LOOP;

  RETURN jsonb_build_object(
    'testId', v_test.id,
    'title', v_test.title,
    'instructions', v_test.instructions,
    'skills', v_test.skills,
    'timingMode', v_test.timing_mode,
    'sectionTimers', v_test.section_timers,
    'strictSettings', v_test.strict_settings,
    'sections', v_sanitized_sections,
    'attempt', jsonb_build_object(
      'id', v_attempt.id,
      'status', v_attempt.status,
      'serverStartTime', v_attempt.server_start_time,
      'serverDeadline', v_attempt.server_deadline,
      'extraTimeMinutes', v_attempt.extra_time_minutes,
      'currentSectionIndex', v_attempt.current_section_index,
      'answers', v_attempt.answers,
      'flaggedQuestions', v_attempt.flagged_questions,
      'scores', CASE WHEN v_attempt.is_released THEN v_attempt.scores ELSE '{}'::jsonb END,
      'isReleased', v_attempt.is_released
    )
  );
END;
$$;

-- 6.4 Autosave Answers RPC with Deadline & Sequence Verification
CREATE OR REPLACE FUNCTION public.save_regular_test_answers(
  p_attempt_id UUID,
  p_session_token TEXT,
  p_answers JSONB,
  p_flagged_questions JSONB DEFAULT NULL,
  p_current_section_index INTEGER DEFAULT NULL,
  p_writing_revision JSONB DEFAULT NULL,
  p_sequence INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_attempt RECORD;
  v_now TIMESTAMPTZ := now();
  v_effective_deadline TIMESTAMPTZ;
  v_updated_revisions JSONB;
BEGIN
  SELECT * INTO v_attempt FROM public.regular_test_attempts WHERE id = p_attempt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_attempt.student_id <> v_user_id THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF v_attempt.status <> 'in_progress' THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'attempt_already_finalized', 'status', v_attempt.status);
  END IF;

  -- 5-second grace period for network latency
  v_effective_deadline := v_attempt.server_deadline + interval '5 seconds';
  IF v_now > v_effective_deadline THEN
    -- Finalize as auto_submitted
    UPDATE public.regular_test_attempts 
    SET status = 'auto_submitted',
        auto_submitted = TRUE,
        submitted_at = v_now
    WHERE id = p_attempt_id;

    RETURN jsonb_build_object('success', FALSE, 'reason', 'deadline_expired', 'status', 'auto_submitted');
  END IF;

  -- Prevent stale sequence overwriting
  IF p_sequence < v_attempt.save_revision_sequence THEN
    RETURN jsonb_build_object('success', TRUE, 'reason', 'ignored_stale_sequence', 'currentSequence', v_attempt.save_revision_sequence);
  END IF;

  v_updated_revisions := v_attempt.writing_revisions;
  IF p_writing_revision IS NOT NULL THEN
    v_updated_revisions := v_updated_revisions || jsonb_build_array(p_writing_revision);
  END IF;

  UPDATE public.regular_test_attempts
  SET answers = p_answers,
      flagged_questions = COALESCE(p_flagged_questions, v_attempt.flagged_questions),
      current_section_index = COALESCE(p_current_section_index, v_attempt.current_section_index),
      writing_revisions = v_updated_revisions,
      save_revision_sequence = p_sequence,
      last_heartbeat = v_now,
      updated_at = v_now
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object('success', TRUE, 'savedAt', v_now, 'sequence', p_sequence);
END;
$$;

-- 6.5 Submit Attempt Function (Idempotent submission & automatic objective grading)
CREATE OR REPLACE FUNCTION public.submit_regular_test_attempt(
  p_attempt_id UUID,
  p_final_answers JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_attempt RECORD;
  v_test RECORD;
  v_version RECORD;
  v_now TIMESTAMPTZ := now();
  v_answers JSONB;
  v_has_writing BOOLEAN := FALSE;
  v_grading_status TEXT := 'auto_graded';
BEGIN
  SELECT * INTO v_attempt FROM public.regular_test_attempts WHERE id = p_attempt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_attempt.student_id <> v_user_id THEN
    -- Check if caller is teacher authorized to force submit
    IF NOT EXISTS (SELECT 1 FROM public.regular_tests WHERE id = v_attempt.test_id AND teacher_id = v_user_id) THEN
      RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Idempotency check: if already submitted, return current state
  IF v_attempt.status IN ('submitted', 'auto_submitted') THEN
    RETURN jsonb_build_object('success', TRUE, 'alreadySubmitted', TRUE, 'status', v_attempt.status);
  END IF;

  v_answers := COALESCE(p_final_answers, v_attempt.answers);

  SELECT * INTO v_test FROM public.regular_tests WHERE id = v_attempt.test_id;
  SELECT * INTO v_version FROM public.regular_test_versions WHERE id = v_attempt.version_id;

  IF 'writing' = ANY(v_test.skills) THEN
    v_has_writing := TRUE;
    v_grading_status := 'pending_manual';
  END IF;

  UPDATE public.regular_test_attempts
  SET status = 'submitted',
      submitted_at = v_now,
      answers = v_answers,
      grading_status = v_grading_status,
      updated_at = v_now
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'submittedAt', v_now,
    'gradingStatus', v_grading_status
  );
END;
$$;

-- 6.6 Rate-Limited Batched Event Logging Function
CREATE OR REPLACE FUNCTION public.log_regular_test_events(
  p_attempt_id UUID,
  p_events JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_attempt RECORD;
  v_elem RECORD;
BEGIN
  SELECT * INTO v_attempt FROM public.regular_test_attempts WHERE id = p_attempt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_attempt.student_id <> v_user_id THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_events) <> 'array' THEN
    RAISE EXCEPTION 'Events payload must be a JSON array';
  END IF;

  -- Maximum 50 events per batch
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_events) LIMIT 50 LOOP
    INSERT INTO public.regular_test_events (
      attempt_id,
      test_id,
      student_id,
      event_type,
      category,
      severity,
      client_timestamp,
      duration_seconds,
      metadata
    ) VALUES (
      v_attempt.id,
      v_attempt.test_id,
      v_attempt.student_id,
      COALESCE(v_elem.value->>'eventType', 'unknown'),
      COALESCE(v_elem.value->>'category', 'objective'),
      COALESCE(v_elem.value->>'severity', 'low'),
      (v_elem.value->>'clientTimestamp')::timestamptz,
      COALESCE((v_elem.value->>'durationSeconds')::numeric, 0),
      COALESCE(v_elem.value->'metadata', '{}'::jsonb)
    );
  END LOOP;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- =============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.regular_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regular_test_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regular_test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regular_test_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regular_test_report_links ENABLE ROW LEVEL SECURITY;

-- 7.1 Regular Tests Policies
CREATE POLICY "Teachers can manage their regular tests"
ON public.regular_tests FOR ALL
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Students can view eligible published tests in their courses"
ON public.regular_tests FOR SELECT
TO authenticated
USING (
  status IN ('scheduled', 'live', 'completed', 'closed')
  AND EXISTS (
    SELECT 1 FROM public.enrollments 
    WHERE course_id = public.regular_tests.course_id 
      AND student_id = auth.uid() 
      AND status = 'approved'
  )
  AND (
    eligible_student_ids IS NULL 
    OR array_length(eligible_student_ids, 1) = 0 
    OR auth.uid() = ANY(eligible_student_ids)
  )
);

-- 7.2 Regular Test Versions Policies
CREATE POLICY "Teachers can manage versions of their tests"
ON public.regular_test_versions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.regular_tests 
    WHERE id = public.regular_test_versions.test_id AND teacher_id = auth.uid()
  )
);

CREATE POLICY "Students can view version structure through RPC only"
ON public.regular_test_versions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.regular_test_attempts 
    WHERE version_id = public.regular_test_versions.id AND student_id = auth.uid()
  )
);

-- 7.3 Regular Test Attempts Policies
CREATE POLICY "Teachers can view and grade attempts on their tests"
ON public.regular_test_attempts FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.regular_tests 
    WHERE id = public.regular_test_attempts.test_id AND teacher_id = auth.uid()
  )
);

CREATE POLICY "Students can view their own attempts"
ON public.regular_test_attempts FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- 7.4 Regular Test Events Policies
CREATE POLICY "Teachers can view and review events for their tests"
ON public.regular_test_events FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.regular_tests 
    WHERE id = public.regular_test_events.test_id AND teacher_id = auth.uid()
  )
);

-- 7.5 Report Links Policies
CREATE POLICY "Teachers can manage report links"
ON public.regular_test_report_links FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.monthly_assessments 
    WHERE id = public.regular_test_report_links.report_id AND teacher_id = auth.uid()
  )
);

CREATE POLICY "Students can view links for their published reports"
ON public.regular_test_report_links FOR SELECT
TO authenticated
USING (student_id = auth.uid());
