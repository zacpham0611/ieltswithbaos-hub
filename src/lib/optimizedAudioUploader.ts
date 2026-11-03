import { supabase, isSupabaseConfigured } from './supabase.ts';

export type AudioUploadStatus =
  | 'pending'
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'cancelled';

export interface AudioUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  status: AudioUploadStatus;
  speedBytesPerSec?: number;
  chunkIndex?: number;
  totalChunks?: number;
  error?: string;
  isResumed?: boolean;
}

export interface AudioUploadOptions {
  folder?: 'audio' | 'speaking' | 'materials' | string;
  preferredFileName?: string;
  fileName?: string;
  contentType?: string;
  bucket?: string;
  chunkSize?: number; // default: 6MB (6 * 1024 * 1024)
  maxRetries?: number; // default: 3
  onProgress?: (progress: AudioUploadProgress) => void;
  signal?: AbortSignal;
  enableTus?: boolean; // default: true for files >= 6MB
}

// In-flight upload deduplication cache (prevents duplicate requests for the exact same file)
const inFlightUploads = new Map<string, Promise<string>>();

// Successfully completed uploads cache (signature -> publicUrl)
const completedUploadsCache = new Map<string, string>();

// Resumable upload session cache (signature -> resumableUploadUrl)
const resumableSessionCache = new Map<string, { url: string; offset: number; timestamp: number }>();

// Verified working bucket cache to eliminate sequential candidate bucket probing
let verifiedWorkingBucket: string | null = null;

/**
 * Generates a unique content signature for deduplication and session recovery
 */
export function getFileSignature(fileOrBlob: Blob | File, preferredFileName?: string): string {
  const name = (fileOrBlob as File).name || preferredFileName || 'audio_file';
  const size = fileOrBlob.size || 0;
  const lastModified = (fileOrBlob as File).lastModified || 0;
  const type = fileOrBlob.type || '';
  return `${name}_${size}_${lastModified}_${type}`;
}

/**
 * Resolves standard MIME type and file extension
 */
export function resolveAudioMimeAndExt(fileOrBlob: Blob | File, preferredFileName?: string): { mimeType: string; ext: string } {
  const type = (fileOrBlob.type || '').toLowerCase();
  let ext = 'mp3';
  let mimeType = 'audio/mpeg';

  if (type.includes('wav')) {
    ext = 'wav';
    mimeType = 'audio/wav';
  } else if (type.includes('m4a') || type.includes('mp4')) {
    ext = 'm4a';
    mimeType = 'audio/mp4';
  } else if (type.includes('ogg')) {
    ext = 'ogg';
    mimeType = 'audio/ogg';
  } else if (type.includes('webm')) {
    ext = 'webm';
    mimeType = 'audio/webm';
  } else if (type.includes('aac')) {
    ext = 'aac';
    mimeType = 'audio/aac';
  } else if (preferredFileName && preferredFileName.includes('.')) {
    const rawExt = preferredFileName.split('.').pop()?.toLowerCase() || 'mp3';
    ext = rawExt;
    if (rawExt === 'wav') mimeType = 'audio/wav';
    else if (rawExt === 'm4a') mimeType = 'audio/mp4';
    else if (rawExt === 'ogg') mimeType = 'audio/ogg';
    else if (rawExt === 'webm') mimeType = 'audio/webm';
    else if (rawExt === 'aac') mimeType = 'audio/aac';
  }

  return { mimeType, ext };
}

/**
 * Fallback Base64 encoder for offline/local environment
 */
export const blobToBase64 = async (b: Blob): Promise<string> => {
  if (typeof FileReader === 'undefined') {
    const arrayBuffer = await b.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:${b.type || 'audio/mpeg'};base64,${buffer.toString('base64')}`;
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(b);
  });
};

/**
 * Uploads an individual chunk using standard XMLHttpRequest for accurate progress and timeout control
 */
function uploadChunkXHR(
  url: string,
  chunk: Blob,
  headers: Record<string, string>,
  method: 'POST' | 'PATCH' | 'PUT',
  onChunkProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<{ status: number; headers: Record<string, string>; responseText: string }> {
  if (typeof XMLHttpRequest === 'undefined') {
    // Universal Node/Fetch environment fallback
    return fetch(url, {
      method,
      headers,
      body: chunk,
      signal,
    }).then(async (res) => {
      const respHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        respHeaders[k.toLowerCase()] = v;
      });
      const text = await res.text().catch(() => '');
      onChunkProgress?.(chunk.size, chunk.size);
      return {
        status: res.status,
        headers: respHeaders,
        responseText: text,
      };
    });
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('Upload aborted by user'));
    }

    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    Object.entries(headers).forEach(([k, v]) => {
      xhr.setRequestHeader(k, v);
    });

    if (xhr.upload && onChunkProgress) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          onChunkProgress(evt.loaded, evt.total);
        }
      };
    }

    const onAbort = () => {
      xhr.abort();
      reject(new Error('Upload aborted by user'));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort);
    }

    xhr.onload = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      const respHeaders: Record<string, string> = {};
      const rawHeaders = xhr.getAllResponseHeaders();
      rawHeaders.trim().split(/[\r\n]+/).forEach((line) => {
        const parts = line.split(': ');
        const header = parts.shift();
        const value = parts.join(': ');
        if (header) respHeaders[header.toLowerCase()] = value;
      });

      resolve({
        status: xhr.status,
        headers: respHeaders,
        responseText: xhr.responseText,
      });
    };

    xhr.onerror = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error(`Network error during ${method} chunk upload`));
    };

    xhr.ontimeout = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error(`Timeout during ${method} chunk upload`));
    };

    xhr.send(chunk);
  });
}

// Extract Supabase project details from client safely without storage/v1 duplication
export function getSupabaseEndpoints(): { baseUrl: string; storageBaseUrl: string; apiKey: string } {
  const rawStorage = (supabase as any).storageUrl;
  const rawSupabase = (supabase as any).supabaseUrl;

  let baseUrl = '';
  if (typeof rawSupabase === 'string' && rawSupabase) {
    baseUrl = rawSupabase.replace(/\/+$/, '');
  } else if (rawStorage) {
    const s = typeof rawStorage === 'string' ? rawStorage : rawStorage.origin || rawStorage.href || '';
    baseUrl = s.replace(/\/storage\/v1\/?$/, '').replace(/\/+$/, '');
  }

  const storageBaseUrl = baseUrl ? `${baseUrl}/storage/v1` : '';
  const apiKey = (supabase as any).supabaseKey || '';
  return { baseUrl, storageBaseUrl, apiKey };
}

/**
 * TUS Resumable Upload Engine (Supabase Storage open protocol)
 * Designed for large audio files (>= 6 MB) with automatic chunking and resume capability
 */
export async function uploadViaTusResumable(
  fileOrBlob: Blob | File,
  bucket: string,
  filePath: string,
  contentType: string,
  options: AudioUploadOptions
): Promise<string> {
  const { onProgress, signal, chunkSize = 6 * 1024 * 1024, maxRetries = 3 } = options;
  const totalSize = fileOrBlob.size;
  const signature = getFileSignature(fileOrBlob, options.preferredFileName);

  const { baseUrl, storageBaseUrl, apiKey } = getSupabaseEndpoints();
  let token = apiKey;

  // Retrieve current session token if signed in
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.access_token) {
      token = sessionData.session.access_token;
    }
  } catch {}

  const tusEndpoint = `${storageBaseUrl}/upload/resumable`;
  let uploadUrl: string | null = null;
  let currentOffset = 0;
  let isResumed = false;

  // 1. Check existing resumable session
  const cachedSession = resumableSessionCache.get(signature);
  if (cachedSession && Date.now() - cachedSession.timestamp < 24 * 3600 * 1000) {
    try {
      // Query server for current offset via HEAD
      const headRes = await fetch(cachedSession.url, {
        method: 'HEAD',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: apiKey,
          'Tus-Resumable': '1.0.0',
        },
        signal,
      });

      if (headRes.ok) {
        const serverOffset = Number(headRes.headers.get('Upload-Offset'));
        if (!isNaN(serverOffset) && serverOffset <= totalSize) {
          uploadUrl = cachedSession.url;
          currentOffset = serverOffset;
          isResumed = currentOffset > 0;
        }
      }
    } catch {}
  }

  // 2. If no valid resumable session, initiate a new TUS session
  if (!uploadUrl) {
    const metadataParts = [
      `bucketName ${btoa(bucket)}`,
      `objectName ${btoa(filePath)}`,
      `contentType ${btoa(contentType)}`,
    ];

    const initHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      apikey: apiKey,
      'Upload-Length': String(totalSize),
      'Upload-Metadata': metadataParts.join(','),
      'Tus-Resumable': '1.0.0',
      'x-upsert': 'true',
    };

    const initRes = await fetch(tusEndpoint, {
      method: 'POST',
      headers: initHeaders,
      signal,
    });

    if (!initRes.ok && initRes.status !== 201) {
      throw new Error(`TUS session initiation failed (status ${initRes.status})`);
    }

    const location = initRes.headers.get('Location');
    if (!location) {
      throw new Error('TUS server did not return Location header');
    }

    // Handle relative vs absolute Location URL
    uploadUrl = location.startsWith('http') ? location : `${baseUrl}${location.startsWith('/') ? '' : '/'}${location}`;
    currentOffset = 0;

    resumableSessionCache.set(signature, {
      url: uploadUrl,
      offset: 0,
      timestamp: Date.now(),
    });
  }

  // Initial progress notify
  onProgress?.({
    loaded: currentOffset,
    total: totalSize,
    percentage: Math.round((currentOffset / totalSize) * 100),
    status: isResumed ? 'uploading' : 'uploading',
    isResumed,
  });

  // 3. Upload chunks sequentially with retry mechanism
  const startTime = Date.now();
  let lastLoadedBytes = currentOffset;
  let lastProgressTime = startTime;

  while (currentOffset < totalSize) {
    if (signal?.aborted) {
      throw new Error('Upload aborted by user');
    }

    const nextChunkEnd = Math.min(currentOffset + chunkSize, totalSize);
    const chunkBlob = fileOrBlob.slice(currentOffset, nextChunkEnd);
    const chunkLength = chunkBlob.size;

    let chunkAttempts = 0;
    let chunkSuccess = false;

    while (chunkAttempts < maxRetries && !chunkSuccess) {
      try {
        chunkAttempts++;
        const patchHeaders: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          apikey: apiKey,
          'Upload-Offset': String(currentOffset),
          'Content-Type': 'application/offset+octet-stream',
          'Tus-Resumable': '1.0.0',
        };

        const patchResult = await uploadChunkXHR(
          uploadUrl,
          chunkBlob,
          patchHeaders,
          'PATCH',
          (chunkLoaded) => {
            const currentTotalLoaded = currentOffset + chunkLoaded;
            const now = Date.now();
            const timeDeltaSec = (now - lastProgressTime) / 1000;
            let speedBytesPerSec = undefined;

            if (timeDeltaSec >= 0.5) {
              speedBytesPerSec = Math.round((currentTotalLoaded - lastLoadedBytes) / timeDeltaSec);
              lastLoadedBytes = currentTotalLoaded;
              lastProgressTime = now;
            }

            onProgress?.({
              loaded: currentTotalLoaded,
              total: totalSize,
              percentage: Math.min(99, Math.round((currentTotalLoaded / totalSize) * 100)),
              status: 'uploading',
              speedBytesPerSec,
              isResumed,
            });
          },
          signal
        );

        if (patchResult.status === 204 || patchResult.status === 200) {
          const newOffset = Number(patchResult.headers['upload-offset']);
          currentOffset = !isNaN(newOffset) ? newOffset : nextChunkEnd;
          chunkSuccess = true;

          // Update session offset
          resumableSessionCache.set(signature, {
            url: uploadUrl,
            offset: currentOffset,
            timestamp: Date.now(),
          });
        } else if (patchResult.status === 409) {
          // Offset mismatch: retrieve server offset and continue
          const headRes = await fetch(uploadUrl, {
            method: 'HEAD',
            headers: {
              Authorization: `Bearer ${token}`,
              apikey: apiKey,
              'Tus-Resumable': '1.0.0',
            },
          });
          const serverOffset = Number(headRes.headers.get('Upload-Offset'));
          if (!isNaN(serverOffset)) {
            currentOffset = serverOffset;
            chunkSuccess = true;
          }
        } else {
          throw new Error(`HTTP ${patchResult.status} during TUS PATCH`);
        }
      } catch (err: any) {
        if (chunkAttempts >= maxRetries) {
          onProgress?.({
            loaded: currentOffset,
            total: totalSize,
            percentage: Math.round((currentOffset / totalSize) * 100),
            status: 'failed',
            error: err.message,
          });
          throw err;
        }

        onProgress?.({
          loaded: currentOffset,
          total: totalSize,
          percentage: Math.round((currentOffset / totalSize) * 100),
          status: 'retrying',
          error: `Đang kết nối lại (thử lần ${chunkAttempts}/${maxRetries})...`,
        });

        // Exponential backoff wait before retry
        await new Promise((r) => setTimeout(r, Math.min(1000 * Math.pow(2, chunkAttempts - 1), 5000)));
      }
    }
  }

  // Upload complete: clean up session cache
  resumableSessionCache.delete(signature);

  onProgress?.({
    loaded: totalSize,
    total: totalSize,
    percentage: 100,
    status: 'finalizing',
  });

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

  onProgress?.({
    loaded: totalSize,
    total: totalSize,
    percentage: 100,
    status: 'completed',
  });
  return publicUrlData.publicUrl;
}

/**
 * Standard Fast Upload with Accurate Progress Tracking (for files < 6 MB or fallback)
 */
export async function uploadViaStandardProgress(
  fileOrBlob: Blob | File,
  bucket: string,
  filePath: string,
  contentType: string,
  options: AudioUploadOptions
): Promise<string> {
  const { onProgress, signal, maxRetries = 3 } = options;
  const totalSize = fileOrBlob.size;

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      if (signal?.aborted) {
        onProgress?.({
          loaded: totalSize,
          total: totalSize,
          percentage: 100,
          status: 'cancelled',
          error: 'Tải lên đã bị hủy bởi người dùng',
        });
        throw new Error('Upload aborted by user');
      }

      // If in browser with XHR and Supabase storage endpoint available:
      const { storageBaseUrl, apiKey } = getSupabaseEndpoints();

      if (typeof XMLHttpRequest !== 'undefined' && storageBaseUrl && apiKey) {
        let token = apiKey;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.access_token) {
            token = sessionData.session.access_token;
          }
        } catch {}

        const uploadUrl = `${storageBaseUrl}/object/${bucket}/${filePath}`;
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          apikey: apiKey,
          'Content-Type': contentType,
          'x-upsert': 'true',
        };

        try {
          const res = await uploadChunkXHR(
            uploadUrl,
            fileOrBlob,
            headers,
            'POST',
            (loaded, total) => {
              onProgress?.({
                loaded,
                total,
                percentage: Math.min(99, Math.round((loaded / total) * 100)),
                status: 'uploading',
              });
            },
            signal
          );

          if (res.status === 200 || res.status === 201) {
            onProgress?.({
              loaded: totalSize,
              total: totalSize,
              percentage: 99,
              status: 'finalizing',
            });

            const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

            onProgress?.({
              loaded: totalSize,
              total: totalSize,
              percentage: 100,
              status: 'completed',
            });
            return publicUrlData.publicUrl;
          }

          // If bucket not found, attempt auto-creation
          if (res.status === 404 || res.responseText?.toLowerCase().includes('bucket not found')) {
            try {
              await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: 50 * 1024 * 1024 });
              continue;
            } catch {}
          }

          // For permanent client errors (400, 401, 403, 413, 415), do not spin in retry loops
          if (res.status === 401 || res.status === 403) {
            throw new Error(`Lỗi phân quyền Supabase Storage (${res.status}): Người dùng chưa được cấp quyền tải lên bucket "${bucket}".`);
          }
          if (res.status === 413) {
            throw new Error(`Tệp âm thanh vượt quá giới hạn dung lượng lưu trữ của bucket "${bucket}".`);
          }
          if (res.status === 415) {
            throw new Error(`Định dạng âm thanh "${contentType}" không được hỗ trợ trong bucket "${bucket}".`);
          }

          // Try SDK fallback before failing
          console.warn(`XHR upload returned status ${res.status}, falling back to Supabase SDK upload:`, res.responseText);
        } catch (xhrErr: any) {
          // If permanent permission or size error, rethrow immediately
          if (xhrErr.message?.includes('401') || xhrErr.message?.includes('403') || xhrErr.message?.includes('413') || xhrErr.message?.includes('415')) {
            throw xhrErr;
          }
          console.warn('XHR upload attempt error, falling back to Supabase SDK upload:', xhrErr.message);
        }
      }

      // Default SDK upload fallback
      let uploadRes = await supabase.storage.from(bucket).upload(filePath, fileOrBlob, {
        upsert: true,
        contentType,
      });

      if (uploadRes.error && uploadRes.error.message?.toLowerCase().includes('bucket not found')) {
        try {
          await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: 50 * 1024 * 1024 });
          uploadRes = await supabase.storage.from(bucket).upload(filePath, fileOrBlob, {
            upsert: true,
            contentType,
          });
        } catch {}
      }

      if (!uploadRes.error) {
        onProgress?.({
          loaded: totalSize,
          total: totalSize,
          percentage: 99,
          status: 'finalizing',
        });
        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        onProgress?.({
          loaded: totalSize,
          total: totalSize,
          percentage: 100,
          status: 'completed',
        });
        return publicUrlData.publicUrl;
      }

      throw new Error(uploadRes.error.message);
    } catch (err: any) {
      lastError = err;
      if (signal?.aborted) {
        onProgress?.({
          loaded: totalSize,
          total: totalSize,
          percentage: 100,
          status: 'cancelled',
          error: 'Tải lên đã bị hủy bởi người dùng',
        });
        throw err;
      }
      if (attempt >= maxRetries) {
        break;
      }
      onProgress?.({
        loaded: 0,
        total: totalSize,
        percentage: 0,
        status: 'retrying',
        error: `Đang thử lại (lần ${attempt}/${maxRetries})...`,
      });
      await new Promise((r) => setTimeout(r, Math.min(1000 * attempt, 3000)));
    }
  }

  onProgress?.({
    loaded: 0,
    total: totalSize,
    percentage: 0,
    status: 'failed',
    error: lastError?.message,
  });

  throw lastError || new Error('Upload failed after retries');
}

/**
 * High-performance, resilient Audio Upload function
 * Supports progress callbacks, deduplication, TUS resumable upload for large files,
 * working bucket caching, and graceful offline fallback.
 */
export async function uploadAudioOptimized(
  fileOrBlob: Blob | File,
  options: AudioUploadOptions = {}
): Promise<string> {
  const effectiveFileName = options.fileName || options.preferredFileName;
  const { folder = 'audio', onProgress, enableTus = true } = options;
  const size = fileOrBlob.size || 0;
  const signature = getFileSignature(fileOrBlob, effectiveFileName);

  // Monotonic progress tracker - prevents 99% -> 1% jumps and backwards progress regressions
  let highestPercentage = 0;
  let highestLoaded = 0;
  const safeProgress = (p: AudioUploadProgress) => {
    highestPercentage = Math.max(highestPercentage, p.percentage);
    highestLoaded = Math.max(highestLoaded, p.loaded);
    onProgress?.({
      ...p,
      loaded: highestLoaded,
      percentage: highestPercentage,
    });
  };

  const safeOptions: AudioUploadOptions = {
    ...options,
    onProgress: safeProgress,
  };

  // 1. Check if identical file was already successfully uploaded (instant 0ms cache hit)
  if (completedUploadsCache.has(signature)) {
    const cachedUrl = completedUploadsCache.get(signature)!;
    safeProgress({
      loaded: size,
      total: size,
      percentage: 100,
      status: 'completed',
    });
    return cachedUrl;
  }

  // 2. Check if identical file is currently uploading (deduplicate in-flight requests)
  if (inFlightUploads.has(signature)) {
    return inFlightUploads.get(signature)!;
  }

  // Execute upload with deduplication lock
  const uploadPromise = (async () => {
    // File size constraint check (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (size > maxSize) {
      throw new Error(`Kích thước file audio vượt quá 50MB (kích thước hiện tại: ${Math.round(size / (1024 * 1024))}MB).`);
    }

    const { mimeType, ext } = resolveAudioMimeAndExt(fileOrBlob, effectiveFileName);
    const timestamp = Date.now();
    const cleanName = (effectiveFileName || `${folder}_${timestamp}`)
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = `${folder}/${cleanName}_${timestamp}.${ext}`;

    // Local / unconfigured fallback
    if (!isSupabaseConfigured) {
      safeProgress({
        loaded: Math.round(size * 0.5),
        total: size,
        percentage: 50,
        status: 'uploading',
        speedBytesPerSec: 1024 * 1024,
      });

      let localUrl: string;
      if (size > 8 * 1024 * 1024 && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        localUrl = URL.createObjectURL(fileOrBlob);
      } else {
        localUrl = await blobToBase64(fileOrBlob);
      }

      safeProgress({
        loaded: size,
        total: size,
        percentage: 100,
        status: 'completed',
        speedBytesPerSec: 2 * 1024 * 1024,
      });

      completedUploadsCache.set(signature, localUrl);
      return localUrl;
    }

    // Determine target bucket priority
    const candidateBuckets = verifiedWorkingBucket
      ? [verifiedWorkingBucket]
      : options.bucket
      ? [options.bucket]
      : folder === 'speaking'
      ? ['speaking_audios', 'materials', 'teacher_assets']
      : ['materials', 'speaking_audios', 'teacher_assets'];

    let lastError: any = null;

    for (const bucket of candidateBuckets) {
      try {
        let finalUrl: string;

        // Use TUS Resumable Upload for files >= 6 MB when enabled
        const isLargeFile = size >= 6 * 1024 * 1024;
        if (isLargeFile && enableTus) {
          try {
            finalUrl = await uploadViaTusResumable(fileOrBlob, bucket, filePath, mimeType, safeOptions);
          } catch (tusErr) {
            console.warn('TUS resumable upload notice, falling back to standard upload:', tusErr);
            finalUrl = await uploadViaStandardProgress(fileOrBlob, bucket, filePath, mimeType, safeOptions);
          }
        } else {
          finalUrl = await uploadViaStandardProgress(fileOrBlob, bucket, filePath, mimeType, safeOptions);
        }

        // Cache verified bucket and completed file URL
        verifiedWorkingBucket = bucket;
        completedUploadsCache.set(signature, finalUrl);
        return finalUrl;
      } catch (err: any) {
        lastError = err;
        console.warn(`Attempt on bucket '${bucket}' failed:`, err.message || err);
      }
    }

    // If small file (< 4MB) and all storage attempts fail, allow local Base64 fallback
    if (size <= 4 * 1024 * 1024) {
      console.warn('Storage failed across buckets, utilizing local base64 fallback.');
      return blobToBase64(fileOrBlob);
    }

    throw new Error(
      `Không thể tải audio lên Supabase Storage (${lastError?.message || 'Lỗi mạng'}). Vui lòng kiểm tra kết nối mạng hoặc thử lại.`
    );
  })();

  inFlightUploads.set(signature, uploadPromise);

  try {
    const result = await uploadPromise;
    return result;
  } finally {
    inFlightUploads.delete(signature);
  }
}

/**
 * Parallel Batch Audio Uploader with Concurrency Limiter
 * Uploads multiple audio files concurrently (default concurrency: 3)
 */
export async function uploadMultipleAudioFiles(
  items: Array<{ fileOrBlob: Blob | File; options?: AudioUploadOptions }>,
  concurrency = 3,
  onBatchProgress?: (completed: number, total: number, latestUrl?: string) => void
): Promise<string[]> {
  const results: string[] = new Array(items.length);
  let completedCount = 0;
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      const item = items[idx];
      const url = await uploadAudioOptimized(item.fileOrBlob, item.options);
      results[idx] = url;
      completedCount++;
      onBatchProgress?.(completedCount, items.length, url);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Cache Management Utilities for Testing & Reset
 */
export function clearAudioUploadCaches(): void {
  inFlightUploads.clear();
  completedUploadsCache.clear();
  resumableSessionCache.clear();
  verifiedWorkingBucket = null;
}

export function getVerifiedWorkingBucket(): string | null {
  return verifiedWorkingBucket;
}

export function setVerifiedWorkingBucket(bucket: string | null): void {
  verifiedWorkingBucket = bucket;
}
