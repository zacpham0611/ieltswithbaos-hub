-- Migration: 20261028000000_secure_reading_answer_keys.sql
-- Description: Adds answer key version tracking, regrade flagging, and secure server-side RPCs 
--              preventing client-side inspection of IELTS Reading answer keys before grading.

-- 1. Add version tracking to assignments
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS answer_key_version INTEGER NOT NULL DEFAULT 1;

-- 2. Add regrade tracking to submissions
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS graded_answer_key_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS needs_regrade BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Create index for regrade queries
CREATE INDEX IF NOT EXISTS idx_submissions_needs_regrade ON public.submissions (needs_regrade) WHERE needs_regrade = TRUE;

-- 4. Create secure server-side function to retrieve sanitized reading assignment for students
--    Strips correctAnswer and explanation from reading_questions JSONB unless the student submission is graded.
CREATE OR REPLACE FUNCTION public.get_student_reading_assignment(p_assignment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_assign RECORD;
  v_sub RECORD;
  v_is_graded BOOLEAN := FALSE;
  v_raw_questions JSONB;
  v_sanitized JSONB;
BEGIN
  -- Determine caller role
  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

  -- Fetch assignment
  SELECT * INTO v_assign FROM public.assignments WHERE id = p_assignment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment not found' USING ERRCODE = 'P0002';
  END IF;

  -- Teachers and Admins receive complete data with answer keys
  IF v_user_role IN ('teacher', 'admin') THEN
    RETURN row_to_json(v_assign)::jsonb;
  END IF;

  -- Check student submission status
  SELECT status INTO v_sub FROM public.submissions 
  WHERE assignment_id = p_assignment_id AND student_id = v_user_id
  ORDER BY submitted_at DESC LIMIT 1;

  IF FOUND AND v_sub.status = 'graded' THEN
    v_is_graded := TRUE;
  END IF;

  -- If graded, student may view answers
  IF v_is_graded THEN
    RETURN row_to_json(v_assign)::jsonb;
  END IF;

  -- Strip answer keys and explanations recursively
  v_raw_questions := v_assign.reading_questions;
  
  -- Return sanitized assignment record
  RETURN jsonb_build_object(
    'id', v_assign.id,
    'course_id', v_assign.course_id,
    'title', v_assign.title,
    'instructions', v_assign.instructions,
    'skill', v_assign.skill,
    'objectives', v_assign.objectives,
    'due_date', v_assign.due_date,
    'status', v_assign.status,
    'reading_passage', v_assign.reading_passage,
    'reading_test_type', v_assign.reading_test_type,
    'reading_questions', (
      CASE 
        WHEN jsonb_typeof(v_raw_questions) = 'array' THEN
          (SELECT jsonb_agg(elem - 'correctAnswer' - 'correct_answer' - 'explanation' - 'citation')
           FROM jsonb_array_elements(v_raw_questions) elem)
        ELSE
          v_raw_questions - 'correctAnswer' - 'correct_answer' - 'explanation'
      END
    ),
    'answer_key_version', v_assign.answer_key_version
  );
END;
$$;

-- 5. Trigger to flag existing submissions for regrading when teacher updates assignment answer keys
CREATE OR REPLACE FUNCTION public.trg_assignments_answer_key_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reading_questions IS DISTINCT FROM OLD.reading_questions THEN
    NEW.answer_key_version := OLD.answer_key_version + 1;
    
    -- Flag all submissions on this assignment as needing regrade
    UPDATE public.submissions
    SET needs_regrade = TRUE
    WHERE assignment_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assignments_reading_questions_update ON public.assignments;
CREATE TRIGGER trg_assignments_reading_questions_update
BEFORE UPDATE ON public.assignments
FOR EACH ROW
WHEN (NEW.skill = 'reading')
EXECUTE FUNCTION public.trg_assignments_answer_key_updated();

COMMENT ON FUNCTION public.get_student_reading_assignment IS 'Returns reading assignment stripped of answer keys for students until graded.';
