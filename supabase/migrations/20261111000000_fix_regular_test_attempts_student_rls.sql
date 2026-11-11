-- =============================================================================
-- Migration: 20261111000000_fix_regular_test_attempts_student_rls.sql
-- Description: Add missing INSERT and UPDATE Row Level Security policies
--              for students on public.regular_test_attempts so attempts
--              and submissions can be persisted directly and retrieved
--              by teachers and students across reloads.
-- =============================================================================

-- 1. Ensure students can insert their own examination attempts
DROP POLICY IF EXISTS "Students can insert their own attempts" ON public.regular_test_attempts;
CREATE POLICY "Students can insert their own attempts"
ON public.regular_test_attempts FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

-- 2. Ensure students can update their own examination attempts (save answers, submit)
DROP POLICY IF EXISTS "Students can update their own attempts" ON public.regular_test_attempts;
CREATE POLICY "Students can update their own attempts"
ON public.regular_test_attempts FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- 3. Ensure teachers can select all attempts for tests they created (with explicit OR for test ownership)
DROP POLICY IF EXISTS "Teachers can view and grade attempts on their tests" ON public.regular_test_attempts;
CREATE POLICY "Teachers can view and grade attempts on their tests"
ON public.regular_test_attempts FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.regular_tests 
    WHERE id = public.regular_test_attempts.test_id AND teacher_id = auth.uid()
  )
);

-- 4. Ensure students can select their own attempts
DROP POLICY IF EXISTS "Students can view their own attempts" ON public.regular_test_attempts;
CREATE POLICY "Students can view their own attempts"
ON public.regular_test_attempts FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- 5. Explicitly reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
