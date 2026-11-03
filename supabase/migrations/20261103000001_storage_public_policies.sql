-- Update RLS policies for storage.objects on materials and speaking_audios to allow public access

DROP POLICY IF EXISTS "materials_public_read" ON storage.objects;
DROP POLICY IF EXISTS "materials_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "materials_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "materials_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "materials_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "materials_public_update" ON storage.objects;
DROP POLICY IF EXISTS "materials_public_delete" ON storage.objects;

CREATE POLICY "materials_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'materials');

CREATE POLICY "materials_public_insert"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'materials');

CREATE POLICY "materials_public_update"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'materials')
WITH CHECK (bucket_id = 'materials');

CREATE POLICY "materials_public_delete"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'materials');

DROP POLICY IF EXISTS "speaking_audios_public_read" ON storage.objects;
DROP POLICY IF EXISTS "speaking_audios_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "speaking_audios_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "speaking_audios_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "speaking_audios_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "speaking_audios_public_update" ON storage.objects;
DROP POLICY IF EXISTS "speaking_audios_public_delete" ON storage.objects;

CREATE POLICY "speaking_audios_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'speaking_audios');

CREATE POLICY "speaking_audios_public_insert"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'speaking_audios');

CREATE POLICY "speaking_audios_public_update"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'speaking_audios')
WITH CHECK (bucket_id = 'speaking_audios');

CREATE POLICY "speaking_audios_public_delete"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'speaking_audios');
