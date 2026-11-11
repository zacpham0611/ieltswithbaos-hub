-- Migration: 20261111000002_allow_enrolled_students_read_published_versions.sql
-- Description: Allow enrolled or assigned students to read public.regular_test_versions for published tests,
--              preventing version_id foreign key constraint violations during attempt creation.

DROP POLICY IF EXISTS "Students can view version structure through RPC only" ON public.regular_test_versions;
DROP POLICY IF EXISTS "Students can view version structure for published tests" ON public.regular_test_versions;

CREATE POLICY "Students can view version structure for published tests"
ON public.regular_test_versions FOR SELECT
TO authenticated
USING (
  -- 1. Test is published (scheduled, live, completed, closed)
  EXISTS (
    SELECT 1 FROM public.regular_tests rt
    WHERE rt.id = public.regular_test_versions.test_id
      AND rt.status IN ('scheduled', 'live', 'completed', 'closed')
      AND (
        -- Case A: Student is enrolled in the course with active, approved, or enrolled status
        EXISTS (
          SELECT 1 FROM public.enrollments e
          WHERE e.course_id = rt.course_id
            AND e.student_id = auth.uid()
            AND e.status IN ('approved', 'enrolled', 'active')
        )
        OR
        -- Case B: Student is explicitly assigned in eligible_student_ids
        (
          rt.eligible_student_ids IS NOT NULL
          AND auth.uid() = ANY(rt.eligible_student_ids)
        )
      )
  )
  OR
  -- 2. Student already has an attempt on this version
  EXISTS (
    SELECT 1 FROM public.regular_test_attempts rta
    WHERE rta.version_id = public.regular_test_versions.id
      AND rta.student_id = auth.uid()
  )
);

-- Ensure teachers have full select on student profiles for students taking tests
DROP POLICY IF EXISTS "Teachers can view test takers profiles" ON public.profiles;
CREATE POLICY "Teachers can view test takers profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.regular_test_attempts rta
    JOIN public.regular_tests rt ON rt.id = rta.test_id
    WHERE rta.student_id = public.profiles.id
      AND rt.teacher_id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';
