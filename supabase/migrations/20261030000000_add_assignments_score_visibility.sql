-- Migration: 20261030000000_add_assignments_score_visibility.sql
-- Description: Add score_visibility column to assignments, set default and check constraint, 
--              backfill existing records, and immediately reload PostgREST schema cache.

-- 1. Safely add score_visibility column to public.assignments if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'assignments' 
      AND column_name = 'score_visibility'
  ) THEN
    ALTER TABLE public.assignments
    ADD COLUMN score_visibility TEXT NOT NULL DEFAULT 'private' CHECK (score_visibility IN ('private', 'public'));
  END IF;
END $$;

-- 2. Backfill existing records to 'private' if any have NULL
UPDATE public.assignments
SET score_visibility = 'private'
WHERE score_visibility IS NULL;

-- 3. Create index for fast query performance
CREATE INDEX IF NOT EXISTS idx_assignments_score_visibility 
ON public.assignments(score_visibility);

-- 4. Force PostgREST to reload its schema cache immediately so the new column is active
NOTIFY pgrst, 'reload schema';
