import { supabase, isSupabaseConfigured } from './supabase.ts';
import { uploadAudioOptimized, type AudioUploadProgress } from './optimizedAudioUploader.ts';

export type { AudioUploadProgress };

export const blobToBase64 = async (b: Blob): Promise<string> => {
  if (typeof FileReader === 'undefined') {
    const arrayBuffer = await b.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:${b.type || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(b);
  });
};

/**
 * Uploads a media file (audio, image, document) to Supabase Storage with bucket auto-creation
 * and base64 fallback when offline/unconfigured.
 */
export async function uploadMediaFile(
  fileOrBlob: Blob | File,
  folder: 'audio' | 'images' | 'documents' = 'audio',
  preferredFileName?: string,
  options?: { onProgress?: (p: AudioUploadProgress) => void; signal?: AbortSignal }
): Promise<string> {
  // If uploading audio, utilize the optimized, resumable and cached audio uploader
  if (folder === 'audio') {
    return uploadAudioOptimized(fileOrBlob, {
      folder: 'audio',
      preferredFileName,
      onProgress: options?.onProgress,
      signal: options?.signal,
    });
  }

  const timestamp = Date.now();
  let ext = 'bin';
  const type = fileOrBlob.type || '';
  const size = fileOrBlob.size || 0;

  // File size validation: 20MB for images/docs
  const maxSize = 20 * 1024 * 1024;
  if (size > maxSize) {
    throw new Error(
      `Kích thước file vượt quá giới hạn cho phép (tối đa ${Math.round(maxSize / (1024 * 1024))}MB).`
    );
  }

  // Audio & Media MIME type mapping
  let determinedContentType = type;
  if (type.includes('png')) {
    ext = 'png';
    determinedContentType = 'image/png';
  } else if (type.includes('jpeg') || type.includes('jpg')) {
    ext = 'jpg';
    determinedContentType = 'image/jpeg';
  } else if (type.includes('webp')) {
    ext = 'webp';
    determinedContentType = 'image/webp';
  } else if (type.includes('svg')) {
    ext = 'svg';
    determinedContentType = 'image/svg+xml';
  } else if (type.includes('mp3') || type.includes('mpeg')) {
    ext = 'mp3';
    determinedContentType = 'audio/mpeg';
  } else if (type.includes('wav')) {
    ext = 'wav';
    determinedContentType = 'audio/wav';
  } else if (type.includes('m4a') || type.includes('mp4')) {
    ext = 'm4a';
    determinedContentType = 'audio/mp4';
  } else if (type.includes('ogg')) {
    ext = 'ogg';
    determinedContentType = 'audio/ogg';
  } else if (type.includes('webm')) {
    ext = 'webm';
    determinedContentType = 'audio/webm';
  } else if (type.includes('aac')) {
    ext = 'aac';
    determinedContentType = 'audio/aac';
  } else if (preferredFileName && preferredFileName.includes('.')) {
    const rawExt = preferredFileName.split('.').pop()?.toLowerCase() || 'bin';
    ext = rawExt;
    if (rawExt === 'mp3') determinedContentType = 'audio/mpeg';
    else if (rawExt === 'wav') determinedContentType = 'audio/wav';
    else if (rawExt === 'm4a') determinedContentType = 'audio/mp4';
    else if (rawExt === 'ogg') determinedContentType = 'audio/ogg';
    else if (rawExt === 'webm') determinedContentType = 'audio/webm';
    else if (rawExt === 'aac') determinedContentType = 'audio/aac';
  }

  if (!determinedContentType) {
    determinedContentType = folder === 'images' ? 'image/png' : 'audio/mpeg';
  }

  const cleanName = (preferredFileName || `${folder}_${timestamp}`)
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = `${folder}/${cleanName}_${timestamp}.${ext}`;

  if (!isSupabaseConfigured) {
    if (size > 8 * 1024 * 1024 && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      return URL.createObjectURL(fileOrBlob);
    }
    return blobToBase64(fileOrBlob);
  }

  // Candidate storage buckets in order of preference
  const candidateBuckets = ['materials', 'teacher_assets'];

  let lastUploadError: string | null = null;

  for (const bucket of candidateBuckets) {
    try {
      let uploadRes = await supabase.storage.from(bucket).upload(filePath, fileOrBlob, {
        upsert: true,
        contentType: determinedContentType,
      });

      // If bucket does not exist, attempt auto-creation
      if (uploadRes.error && uploadRes.error.message?.toLowerCase().includes('bucket not found')) {
        try {
          await supabase.storage.createBucket(bucket, {
            public: true,
            fileSizeLimit: 50 * 1024 * 1024,
          });

          uploadRes = await supabase.storage.from(bucket).upload(filePath, fileOrBlob, {
            upsert: true,
            contentType: determinedContentType,
          });
        } catch (createErr) {
          console.warn(`Auto-create ${bucket} bucket error:`, createErr);
        }
      }

      if (!uploadRes.error) {
        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      } else {
        lastUploadError = uploadRes.error.message;
        console.warn(`Upload to ${bucket} failed:`, uploadRes.error.message);
      }
    } catch (err: any) {
      lastUploadError = err.message || String(err);
      console.warn(`Exception uploading to ${bucket}:`, err);
    }
  }

  // If Supabase upload failed across candidate buckets:
  // For small files (< 4MB), allow base64 fallback so local development still functions.
  if (size <= 4 * 1024 * 1024) {
    return blobToBase64(fileOrBlob);
  }

  // For larger files (> 4MB), throw meaningful error rather than causing a 413 Payload Too Large crash
  throw new Error(
    `Không thể tải file lên Supabase Storage (${lastUploadError || 'Lỗi lưu trữ'}). Vui lòng kiểm tra kết nối mạng hoặc quyền truy cập storage bucket 'materials'.`
  );
}
