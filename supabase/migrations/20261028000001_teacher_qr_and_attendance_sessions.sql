-- Migration: 20261028000001_teacher_qr_and_attendance_sessions.sql
-- Description: Adds teacher payment QR and bank info to profiles, attendance tracking & billability 
--              to class_sessions, and storage bucket setup for teacher payment QR assets.

-- 1. Add payment QR code and bank account info to teacher profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS payment_qr_url TEXT,
ADD COLUMN IF NOT EXISTS bank_info JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Add attendance, duration, and student targeting to class_sessions
ALTER TABLE public.class_sessions
ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'scheduled', 'cancelled')),
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS is_billable BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.class_sessions DROP CONSTRAINT IF EXISTS class_sessions_skill_check;
ALTER TABLE public.class_sessions ADD CONSTRAINT class_sessions_skill_check CHECK (skill IN ('reading', 'writing', 'speaking', 'listening', 'all'));

-- 3. Create index for fast monthly tuition queries and prevent duplicate date entries
CREATE INDEX IF NOT EXISTS idx_sessions_course_date ON public.class_sessions (course_id, session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_student_date ON public.class_sessions (student_id, session_date) WHERE student_id IS NOT NULL;

-- Unique partial index preventing duplicate sessions for the same student on the same date within a course
CREATE UNIQUE INDEX IF NOT EXISTS uq_course_student_session_date 
ON public.class_sessions (course_id, student_id, session_date) 
WHERE student_id IS NOT NULL AND status != 'cancelled';

-- 4. Set up Supabase Storage bucket for teacher payment QR codes and assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'teacher_assets',
  'teacher_assets',
  true,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

-- Storage RLS Policies for teacher_assets
-- Allow public viewing of teacher payment QR codes so students can scan on tuition statements
CREATE POLICY "Public read access for teacher assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'teacher_assets');

-- Allow teachers to upload their own payment QR code
CREATE POLICY "Teachers can upload own payment QR assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'teacher_assets' AND
  (storage.foldername(name))[1] = 'teachers' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow teachers to update/replace their own payment QR code
CREATE POLICY "Teachers can update own payment QR assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'teacher_assets' AND
  (storage.foldername(name))[1] = 'teachers' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow teachers to delete their own payment QR code
CREATE POLICY "Teachers can delete own payment QR assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'teacher_assets' AND
  (storage.foldername(name))[1] = 'teachers' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- 5. Force PostgREST to reload its schema cache immediately so duration_minutes and is_billable are visible
NOTIFY pgrst, 'reload schema';
