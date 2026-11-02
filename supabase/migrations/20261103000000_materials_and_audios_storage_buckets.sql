-- Migration: 20261103000000_materials_and_audios_storage_buckets.sql
-- Description: Sets up Supabase Storage buckets for teaching hub materials (audio, images, documents)
--              and speaking recordings with appropriate public access and RLS policies.

-- 1. Materials bucket (for Listening audio files, Reading images, Writing charts & diagrams)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'materials',
  'materials',
  true,
  52428800, -- 50MB
  ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/m4a',
    'audio/x-m4a',
    'audio/mp4',
    'audio/webm',
    'audio/ogg',
    'audio/aac',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/m4a',
    'audio/x-m4a',
    'audio/mp4',
    'audio/webm',
    'audio/ogg',
    'audio/aac',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

-- 2. Speaking Audios bucket (for student and teacher speaking recordings)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'speaking_audios',
  'speaking_audios',
  true,
  26214400, -- 25MB
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'];

-- 3. Storage RLS Policies for materials
DROP POLICY IF EXISTS "Public read access for materials" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload materials" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update materials" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete materials" ON storage.objects;

CREATE POLICY "Public read access for materials"
ON storage.objects FOR SELECT
USING (bucket_id = 'materials');

CREATE POLICY "Authenticated users can upload materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'materials');

CREATE POLICY "Authenticated users can update materials"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'materials');

CREATE POLICY "Authenticated users can delete materials"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'materials');

-- 4. Storage RLS Policies for speaking_audios
DROP POLICY IF EXISTS "Public read access for speaking audios" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload speaking audios" ON storage.objects;

CREATE POLICY "Public read access for speaking audios"
ON storage.objects FOR SELECT
USING (bucket_id = 'speaking_audios');

CREATE POLICY "Users can upload speaking audios"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'speaking_audios');
