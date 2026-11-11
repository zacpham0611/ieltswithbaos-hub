-- Migration: 20261111000001_fix_regular_tests_student_rls.sql
-- Description: Ensure students can view published regular tests if enrolled (approved, enrolled, active)
--              OR if directly assigned via eligible_student_ids, eliminating disappearing tests.

DROP POLICY IF EXISTS "Students can view eligible published tests in their courses" ON public.regular_tests;

CREATE POLICY "Students can view eligible published tests in their courses"
ON public.regular_tests FOR SELECT
TO authenticated
USING (
  status IN ('scheduled', 'live', 'completed', 'closed')
  AND (
    -- Case 1: Student is enrolled in the course with an active, approved, or enrolled status
    EXISTS (
      SELECT 1 FROM public.enrollments 
      WHERE course_id = public.regular_tests.course_id 
        AND student_id = auth.uid() 
        AND status IN ('approved', 'enrolled', 'active')
    )
    OR
    -- Case 2: Student is explicitly assigned in eligible_student_ids
    (
      eligible_student_ids IS NOT NULL 
      AND auth.uid() = ANY(eligible_student_ids)
    )
  )
);

-- Ensure teachers can cascade delete their own test versions and report links
DROP POLICY IF EXISTS "Teachers can delete report links on their tests" ON public.regular_test_report_links;
CREATE POLICY "Teachers can delete report links on their tests"
ON public.regular_test_report_links FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.regular_tests 
    WHERE id = public.regular_test_report_links.test_id AND teacher_id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';
