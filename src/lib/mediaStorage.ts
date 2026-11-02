import { supabase, isSupabaseConfigured } from './supabase.ts';

export const blobToBase64 = (b: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(b);
  });

/**
 * Uploads a media file (audio, image, document) to Supabase Storage with bucket auto-creation
 * and base64 fallback when offline/unconfigured.
 */
export async function uploadMediaFile(
  fileOrBlob: Blob | File,
  folder: 'audio' | 'images' | 'documents' = 'audio',
  preferredFileName?: string
): Promise<string> {
  const timestamp = Date.now();
  let ext = 'bin';
  const type = fileOrBlob.type || '';

  if (type.includes('png')) ext = 'png';
  else if (type.includes('jpeg') || type.includes('jpg')) ext = 'jpg';
  else if (type.includes('webp')) ext = 'webp';
  else if (type.includes('svg')) ext = 'svg';
  else if (type.includes('mp3') || type.includes('mpeg')) ext = 'mp3';
  else if (type.includes('wav')) ext = 'wav';
  else if (type.includes('m4a') || type.includes('mp4')) ext = 'm4a';
  else if (type.includes('ogg')) ext = 'ogg';
  else if (type.includes('webm')) ext = 'webm';
  else if (preferredFileName && preferredFileName.includes('.')) {
    ext = preferredFileName.split('.').pop() || 'bin';
  }

  const cleanName = (preferredFileName || `${folder}_${timestamp}`)
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = `${folder}/${cleanName}_${timestamp}.${ext}`;
  const bucketName = 'materials';

  if (!isSupabaseConfigured) {
    return blobToBase64(fileOrBlob);
  }

  try {
    let uploadRes = await supabase.storage.from(bucketName).upload(filePath, fileOrBlob, {
      upsert: true,
      contentType: fileOrBlob.type || (folder === 'images' ? 'image/png' : 'audio/mpeg'),
    });

    if (uploadRes.error && uploadRes.error.message?.toLowerCase().includes('bucket not found')) {
      try {
        await supabase.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 50 * 1024 * 1024,
        });

        uploadRes = await supabase.storage.from(bucketName).upload(filePath, fileOrBlob, {
          upsert: true,
          contentType: fileOrBlob.type || (folder === 'images' ? 'image/png' : 'audio/mpeg'),
        });
      } catch (createErr) {
        console.warn('Auto-create materials bucket error:', createErr);
      }
    }

    if (!uploadRes.error) {
      const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      if (publicUrlData?.publicUrl) {
        return publicUrlData.publicUrl;
      }
    } else {
      console.warn('Upload error, utilizing fallback:', uploadRes.error.message);
    }
  } catch (err) {
    console.warn('Storage exception, utilizing fallback:', err);
  }

  return blobToBase64(fileOrBlob);
}
