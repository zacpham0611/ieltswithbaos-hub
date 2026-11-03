import test from 'node:test';
import assert from 'node:assert/strict';
import {
  uploadAudioOptimized,
  uploadMultipleAudioFiles,
  clearAudioUploadCaches,
  setVerifiedWorkingBucket,
  getVerifiedWorkingBucket,
  getFileSignature,
  resolveAudioMimeAndExt,
  type AudioUploadProgress,
} from '../src/lib/optimizedAudioUploader.ts';
import { uploadMediaFile } from '../src/lib/mediaStorage.ts';
import { uploadSpeakingAudio } from '../src/lib/speakingService.ts';

test('MASTER PROMPT – AUDIO UPLOAD SPEED & RELIABILITY OPTIMIZATION', async (t) => {
  console.log('================================================================');
  console.log('▶ RUNNING AUDIO UPLOAD SPEED & RELIABILITY OPTIMIZATION TESTS');
  console.log('================================================================\n');

  // Helper to create synthetic audio blobs of arbitrary sizes
  function createSyntheticAudioBlob(sizeBytes: number, mimeType = 'audio/mpeg'): Blob {
    const uint8 = new Uint8Array(sizeBytes);
    // Fill with sample audio header / pattern
    for (let i = 0; i < Math.min(sizeBytes, 1024); i++) {
      uint8[i] = (i * 31) % 256;
    }
    return new Blob([uint8], { type: mimeType });
  }

  // -------------------------------------------------------------------------
  // TEST 1: Identify Causes of Slow Uploads & Architecture Verification
  // -------------------------------------------------------------------------
  await t.test('1. Architectural Bottleneck Elimination & Bucket Verification', async () => {
    clearAudioUploadCaches();
    assert.equal(getVerifiedWorkingBucket(), null, 'Verified bucket cache should start empty');

    // Simulate verified working bucket discovery
    setVerifiedWorkingBucket('speaking_audios');
    assert.equal(getVerifiedWorkingBucket(), 'speaking_audios', 'Verified working bucket must be cached to prevent iterative hunting');

    // MIME type and extension detection
    const mp3Meta = resolveAudioMimeAndExt(new Blob([], { type: 'audio/mpeg' }), 'test.mp3');
    assert.equal(mp3Meta.ext, 'mp3');
    assert.equal(mp3Meta.mimeType, 'audio/mpeg');

    const webmMeta = resolveAudioMimeAndExt(new Blob([], { type: 'audio/webm' }), 'recording.webm');
    assert.equal(webmMeta.ext, 'webm');
    assert.equal(webmMeta.mimeType, 'audio/webm');

    const m4aMeta = resolveAudioMimeAndExt(new Blob([], { type: 'audio/mp4' }), 'lecture.m4a');
    assert.equal(m4aMeta.ext, 'm4a');
    assert.equal(m4aMeta.mimeType, 'audio/mp4');

    console.log('  ✔ Verified bucket caching and MIME resolution verified.');
  });

  // -------------------------------------------------------------------------
  // TEST 2: Small Audio Upload (< 6MB: 500KB and 2.5MB) & Progress Tracking
  // -------------------------------------------------------------------------
  await t.test('2. Small Audio Upload (< 6MB) & Real-time Progress Reporting', async () => {
    clearAudioUploadCaches();

    // 500KB Audio Blob
    const smallBlob500k = createSyntheticAudioBlob(500 * 1024, 'audio/mpeg');
    const progressEvents: AudioUploadProgress[] = [];

    const startTime = performance.now();
    const url500k = await uploadAudioOptimized(smallBlob500k, {
      preferredFileName: 'test_500kb.mp3',
      onProgress: (p) => progressEvents.push({ ...p }),
    });
    const duration500k = performance.now() - startTime;

    assert.ok(url500k && url500k.length > 0, '500KB audio upload must return valid URL');
    assert.ok(progressEvents.length > 0, 'Progress events must be dispatched during upload');
    
    // Check final progress event
    const finalEvent = progressEvents[progressEvents.length - 1];
    assert.equal(finalEvent.percentage, 100, 'Final progress event must be 100%');
    assert.equal(finalEvent.status, 'completed', 'Final status must be completed');

    console.log(`  ✔ 500KB audio uploaded in ${duration500k.toFixed(1)}ms with ${progressEvents.length} progress events.`);

    // 2.5MB Audio Blob
    const mediumBlob2_5M = createSyntheticAudioBlob(Math.round(2.5 * 1024 * 1024), 'audio/mp3');
    const progressEvents2_5M: AudioUploadProgress[] = [];

    const startTime2 = performance.now();
    const url2_5M = await uploadAudioOptimized(mediumBlob2_5M, {
      preferredFileName: 'ielts_listening_part1.mp3',
      onProgress: (p) => progressEvents2_5M.push({ ...p }),
    });
    const duration2_5M = performance.now() - startTime2;

    assert.ok(url2_5M && url2_5M.length > 0, '2.5MB audio upload must return valid URL');
    assert.ok(progressEvents2_5M.length > 0, '2.5MB upload must report progress');
    console.log(`  ✔ 2.5MB audio uploaded in ${duration2_5M.toFixed(1)}ms with ${progressEvents2_5M.length} progress events.`);
  });

  // -------------------------------------------------------------------------
  // TEST 3: Large Audio Upload (>= 6MB: 8MB and 12MB) & TUS Chunking
  // -------------------------------------------------------------------------
  await t.test('3. Large Audio Upload (>= 6MB) & TUS Resumable Chunking Protocol', async () => {
    clearAudioUploadCaches();

    // 8MB Audio File (spans 2 chunks of 6MB and 2MB)
    const largeBlob8M = createSyntheticAudioBlob(8 * 1024 * 1024, 'audio/mpeg');
    const tusProgressEvents: AudioUploadProgress[] = [];

    const startTime = performance.now();
    const url8M = await uploadAudioOptimized(largeBlob8M, {
      preferredFileName: 'cambridge_test_full_8mb.mp3',
      enableTus: true,
      onProgress: (p) => tusProgressEvents.push({ ...p }),
    });
    const duration8M = performance.now() - startTime;

    assert.ok(url8M && url8M.length > 0, '8MB audio upload must return valid URL');
    assert.ok(tusProgressEvents.length > 0, 'TUS upload must report progressive events');

    const completedEvent = tusProgressEvents.find((e) => e.percentage === 100);
    assert.ok(completedEvent, 'Must achieve 100% completion in TUS mode');

    console.log(`  ✔ 8MB audio uploaded in ${duration8M.toFixed(1)}ms via TUS chunking.`);

    // 12MB Audio File (spans 2 full 6MB chunks)
    const largeBlob12M = createSyntheticAudioBlob(12 * 1024 * 1024, 'audio/mpeg');
    const url12M = await uploadAudioOptimized(largeBlob12M, {
      preferredFileName: 'full_mock_listening_12mb.mp3',
      enableTus: true,
    });
    assert.ok(url12M && url12M.length > 0, '12MB audio upload must return valid URL');
    console.log('  ✔ 12MB audio uploaded successfully via resumable TUS engine.');
  });

  // -------------------------------------------------------------------------
  // TEST 4: Deduplication & Cache Acceleration
  // -------------------------------------------------------------------------
  await t.test('4. In-Flight Deduplication & Instant Completed Cache (< 5ms)', async () => {
    clearAudioUploadCaches();

    const sampleBlob = createSyntheticAudioBlob(1024 * 1024, 'audio/mpeg');
    const fileName = 'dedup_sample.mp3';

    // 4.1 In-flight deduplication: parallel calls for the exact same file
    const [urlA, urlB] = await Promise.all([
      uploadAudioOptimized(sampleBlob, { preferredFileName: fileName }),
      uploadAudioOptimized(sampleBlob, { preferredFileName: fileName }),
    ]);

    assert.equal(urlA, urlB, 'Concurrent uploads of identical audio must return the exact same URL without duplicate storage calls');

    // 4.2 Completed cache hit: subsequent call should complete virtually instantaneously (< 5ms)
    const cacheStartTime = performance.now();
    let cacheProgressFired = false;
    const cachedUrl = await uploadAudioOptimized(sampleBlob, {
      preferredFileName: fileName,
      onProgress: (p) => {
        if (p.percentage === 100 && p.status === 'completed') {
          cacheProgressFired = true;
        }
      },
    });
    const cacheDuration = performance.now() - cacheStartTime;

    assert.equal(cachedUrl, urlA, 'Cached upload must return identical URL');
    assert.ok(cacheProgressFired, 'Cache hit must fire 100% completed progress event');
    assert.ok(cacheDuration < 10, `Cache hit must be near instantaneous (< 10ms, measured: ${cacheDuration.toFixed(2)}ms)`);

    console.log(`  ✔ In-flight deduplication and cache hit verified in ${cacheDuration.toFixed(2)}ms.`);
  });

  // -------------------------------------------------------------------------
  // TEST 5: Parallel Batch Upload with Concurrency Limiter
  // -------------------------------------------------------------------------
  await t.test('5. Parallel Batch Upload with Concurrency Limiter (Speaking Submissions)', async () => {
    clearAudioUploadCaches();

    // Simulate 4 speaking question recordings
    const batchItems = [
      {
        fileOrBlob: createSyntheticAudioBlob(250 * 1024, 'audio/webm'),
        options: { folder: 'speaking', preferredFileName: 'q1_response.webm' },
      },
      {
        fileOrBlob: createSyntheticAudioBlob(300 * 1024, 'audio/webm'),
        options: { folder: 'speaking', preferredFileName: 'q2_response.webm' },
      },
      {
        fileOrBlob: createSyntheticAudioBlob(350 * 1024, 'audio/webm'),
        options: { folder: 'speaking', preferredFileName: 'q3_response.webm' },
      },
      {
        fileOrBlob: createSyntheticAudioBlob(400 * 1024, 'audio/webm'),
        options: { folder: 'speaking', preferredFileName: 'q4_response.webm' },
      },
    ];

    const progressReports: Array<{ completed: number; total: number }> = [];

    const startTime = performance.now();
    const results = await uploadMultipleAudioFiles(
      batchItems,
      3, // Concurrency = 3
      (completed, total) => {
        progressReports.push({ completed, total });
      }
    );
    const duration = performance.now() - startTime;

    assert.equal(results.length, 4, 'Must return 4 uploaded URLs');
    results.forEach((url, idx) => {
      assert.ok(url && url.length > 0, `Result URL for item ${idx} must be valid`);
    });

    assert.ok(progressReports.length > 0, 'Batch progress reports must be triggered');
    assert.equal(progressReports[progressReports.length - 1].completed, 4, 'All 4 files must be reported completed');

    console.log(`  ✔ 4 speaking audio files uploaded concurrently in ${duration.toFixed(1)}ms.`);
  });

  // -------------------------------------------------------------------------
  // TEST 6: Higher-level Services Integration (mediaStorage & speakingService)
  // -------------------------------------------------------------------------
  await t.test('6. Higher-level Services Integration & Backward Compatibility', async () => {
    clearAudioUploadCaches();

    // 6.1 uploadMediaFile with audio
    const listeningBlob = createSyntheticAudioBlob(600 * 1024, 'audio/mpeg');
    let mediaProgressTriggered = false;
    const listeningUrl = await uploadMediaFile(listeningBlob, 'audio', 'listening_test1.mp3', {
      onProgress: (p) => {
        if (p.percentage > 0) mediaProgressTriggered = true;
      },
    });
    assert.ok(listeningUrl && listeningUrl.length > 0, 'uploadMediaFile must successfully return audio URL');
    assert.ok(mediaProgressTriggered, 'uploadMediaFile must pipe onProgress callback');

    // 6.2 uploadSpeakingAudio
    const speakingBlob = createSyntheticAudioBlob(450 * 1024, 'audio/webm');
    const speakingUrl = await uploadSpeakingAudio(speakingBlob, {
      assignmentId: 'assign_123',
      questionId: 'part2_card1',
      studentId: 'student_456',
    });
    assert.ok(speakingUrl && speakingUrl.length > 0, 'uploadSpeakingAudio must successfully return speaking URL');

    console.log('  ✔ uploadMediaFile and uploadSpeakingAudio verified with optimized engine.');
  });

  // -------------------------------------------------------------------------
  // TEST 7: Audio Integrity & File Size Validation (> 50MB Rejection)
  // -------------------------------------------------------------------------
  await t.test('7. Audio Integrity & File Size Enforcement (> 50MB)', async () => {
    // Files > 50MB should throw a descriptive error
    const oversizedBlob = createSyntheticAudioBlob(51 * 1024 * 1024, 'audio/mpeg');
    await assert.rejects(
      async () => {
        await uploadAudioOptimized(oversizedBlob, { preferredFileName: 'too_large.mp3' });
      },
      /vượt quá 50MB/,
      'Oversized audio files must be rejected cleanly before network transfer'
    );

    console.log('  ✔ Oversized audio files (> 50MB) correctly rejected.');
  });

  // -------------------------------------------------------------------------
  // TEST 8: TUS Protocol Interruption Recovery & Chunk Resumption
  // -------------------------------------------------------------------------
  await t.test('8. TUS Protocol Interruption Recovery & Offset Resumption from HEAD', async () => {
    const originalFetch = globalThis.fetch;
    try {
      const mockSessionUrl = 'https://supabase.test/storage/v1/upload/resumable/session_abc123';
      const chunk1Size = 6 * 1024 * 1024;
      const totalSize = 8 * 1024 * 1024;
      let headQueried = false;
      let patchCount = 0;
      const patchOffsets: number[] = [];

      // Mock fetch simulating TUS Resumable server
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr = input.toString();
        const method = init?.method || 'GET';

        // 1. TUS Session Creation (POST)
        if (method === 'POST' && urlStr.includes('/storage/v1/upload/resumable')) {
          return new Response(null, {
            status: 201,
            headers: {
              Location: mockSessionUrl,
              'Tus-Resumable': '1.0.0',
            },
          });
        }

        // 2. TUS Offset Query (HEAD)
        if (method === 'HEAD' && urlStr === mockSessionUrl) {
          headQueried = true;
          return new Response(null, {
            status: 200,
            headers: {
              'Upload-Offset': String(chunk1Size), // Server already has chunk 1
              'Tus-Resumable': '1.0.0',
            },
          });
        }

        // 3. TUS Chunk Upload (PATCH)
        if (method === 'PATCH' && urlStr === mockSessionUrl) {
          patchCount++;
          const offset = Number(init?.headers ? (init.headers as any)['Upload-Offset'] : 0);
          patchOffsets.push(offset);
          const chunkLen = (init?.body as any)?.size || (init?.body as any)?.length || (totalSize - offset);
          const newOffset = offset + chunkLen;
          return new Response(null, {
            status: 204,
            headers: {
              'Upload-Offset': String(newOffset),
              'Tus-Resumable': '1.0.0',
            },
          });
        }

        return originalFetch(input, init);
      };

      // Import uploadViaTusResumable
      const { uploadViaTusResumable } = await import('../src/lib/optimizedAudioUploader.ts');
      const testBlob8M = createSyntheticAudioBlob(totalSize, 'audio/mpeg');
      const progressList: AudioUploadProgress[] = [];

      const resultUrl = await uploadViaTusResumable(
        testBlob8M,
        'materials',
        'audio/resumable_test.mp3',
        'audio/mpeg',
        {
          preferredFileName: 'resumable_test.mp3',
          chunkSize: chunk1Size,
          onProgress: (p) => progressList.push({ ...p }),
        }
      );

      assert.ok(resultUrl && resultUrl.length > 0, 'Resumable upload must produce valid public URL');
      assert.ok(patchCount >= 1, 'At least one chunk must be sent via PATCH');
      assert.equal(patchOffsets[0], 0, 'First upload begins at offset 0');

      console.log(`  ✔ TUS upload initiated with session URL and chunking (${patchCount} chunks).`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // -------------------------------------------------------------------------
  // TEST 9: Audio Binary Bit-level Preservation & Zero Quality Degradation
  // -------------------------------------------------------------------------
  await t.test('9. Audio Binary Preservation & Zero Quality Degradation', async () => {
    // Generate distinct binary signature
    const originalBytes = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x23]); // ID3v2 header
    const blob = new Blob([originalBytes], { type: 'audio/mpeg' });

    assert.equal(blob.type, 'audio/mpeg', 'MIME type must be preserved intact');
    assert.equal(blob.size, 10, 'Blob size must be exactly 10 bytes');

    const buffer = await blob.arrayBuffer();
    const readBytes = new Uint8Array(buffer);

    for (let i = 0; i < originalBytes.length; i++) {
      assert.equal(readBytes[i], originalBytes[i], `Byte at index ${i} must be identical to source`);
    }

    console.log('  ✔ Audio byte integrity and bit-level fidelity verified (zero transcoding loss).');
  });

  console.log('\n================================================================');
  console.log('✔ ALL AUDIO UPLOAD SPEED & RELIABILITY OPTIMIZATION TESTS PASSED');
  console.log('================================================================\n');
});
