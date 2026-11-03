-- =============================================================================
-- Migration: 20261103000002_add_regular_tests_sections.sql
-- Description: Ensure regular_tests table supports draft sections payload directly
--              and reload PostgREST schema cache.
-- =============================================================================

ALTER TABLE public.regular_tests 
ADD COLUMN IF NOT EXISTS sections JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.regular_tests.sections IS 'Active / draft sections payload for regular tests';

-- Explicitly trigger PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
