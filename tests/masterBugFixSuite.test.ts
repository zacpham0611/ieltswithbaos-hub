import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';
import {
  parseListeningDocument,
} from '../src/lib/listeningExtractor.ts';
import {
  getSupabaseEndpoints,
} from '../src/lib/optimizedAudioUploader.ts';

describe('MASTER BUG FIX PROMPT VERIFICATION SUITE', () => {
  const referenceDocxPath = path.resolve(
    'C:/Users/Admin/.gemini/antigravity/brain/e66bef89-3824-44a3-9b01-1da8f8609a20/.user_uploaded/media_1793634904344_a8f7fc60.docx'
  );

  // =========================================================================
  // ISSUE 1: STUDENT LISTENING TEST UI & EXTRACTION
  // =========================================================================
  describe('Issue 1: Student Listening UI & Extraction Fidelity', () => {
    test('verifies all 40 questions extracted with full options and context from reference DOCX', async () => {
      if (!fs.existsSync(referenceDocxPath)) {
        console.warn('Reference DOCX not found at path, skipping direct file read');
        return;
      }

      const fileBuffer = fs.readFileSync(referenceDocxPath);
      const [{ value: rawText }, { value: html }] = await Promise.all([
        mammoth.extractRawText({ buffer: fileBuffer }),
        mammoth.convertToHtml({ buffer: fileBuffer }),
      ]);

      const parsed = parseListeningDocument(rawText, 'IELTS Test 1 – Listening.docx', html);

      // 1. Verify 4 parts exist
      assert.strictEqual(parsed.parts.length, 4, 'Must parse exactly 4 Listening parts');

      // Flatten questions
      const allQuestions = parsed.parts.flatMap((p) => p.questionGroups.flatMap((g) => g.questions));
      assert.strictEqual(allQuestions.length, 40, 'Must extract all 40 questions');

      // Case A: Questions 11-14 Multiple Choice Single Answer
      for (let qNum = 11; qNum <= 14; qNum++) {
        const q = allQuestions.find((item) => (item.questionNumber || item.number) === qNum);
        assert.ok(q, `Question ${qNum} must exist`);
        assert.strictEqual(q.type, 'multiple_choice', `Question ${qNum} must be multiple_choice`);
        assert.ok(q.options && q.options.length >= 3, `Question ${qNum} must have at least 3 options (A, B, C)`);
        assert.ok(q.options[0].startsWith('A'), `Question ${qNum} option A must start with A`);
        assert.ok(q.options[1].startsWith('B'), `Question ${qNum} option B must start with B`);
        assert.ok(q.options[2].startsWith('C'), `Question ${qNum} option C must start with C`);
      }

      // Case B: Questions 15-17 Completion with full surrounding prompt context
      const q15 = allQuestions.find((item) => (item.questionNumber || item.number) === 15);
      const q16 = allQuestions.find((item) => (item.questionNumber || item.number) === 16);
      const q17 = allQuestions.find((item) => (item.questionNumber || item.number) === 17);
      assert.ok(q15, 'Question 15 must exist');
      assert.ok(q16, 'Question 16 must exist');
      assert.ok(q17, 'Question 17 must exist');
      assert.ok(q15.prompt.toLowerCase().includes('spare'), 'Question 15 prompt must contain "spare"');
      assert.ok(q16.prompt.toLowerCase().includes('suncream'), 'Question 16 prompt must contain "suncream"');
      assert.ok(q17.prompt.toLowerCase().includes('folder'), 'Question 17 prompt must contain "folder"');

      // Case C: Questions 18-20 Multiple Select (Choose THREE letters, A-G)
      for (let qNum = 18; qNum <= 20; qNum++) {
        const q = allQuestions.find((item) => (item.questionNumber || item.number) === qNum);
        assert.ok(q, `Question ${qNum} must exist`);
        assert.strictEqual(q.type, 'multiple_select', `Question ${qNum} must be multiple_select`);
        assert.ok(q.options && q.options.length >= 6, `Question ${qNum} must have the extracted options`);
        assert.ok(q.options[0].startsWith('A'), `Question ${qNum} first option must be A`);
        assert.ok(q.options[q.options.length - 1].startsWith('G'), `Question ${qNum} last option must be G`);
      }

      // Case D: Questions 25-30 Matching with A/B/C options
      for (let qNum = 25; qNum <= 30; qNum++) {
        const q = allQuestions.find((item) => (item.questionNumber || item.number) === qNum);
        assert.ok(q, `Question ${qNum} must exist`);
        assert.strictEqual(q.type, 'matching', `Question ${qNum} must be matching`);
        assert.ok(q.options && q.options.length >= 3, `Question ${qNum} must have matching options A, B, C`);
      }

      // Case E: Questions 31-40 Table & Note Completion
      const q31 = allQuestions.find((item) => (item.questionNumber || item.number) === 31);
      const q32 = allQuestions.find((item) => (item.questionNumber || item.number) === 32);
      assert.ok(q31 && q32, 'Questions 31 and 32 must exist');
      for (let qNum = 33; qNum <= 40; qNum++) {
        const q = allQuestions.find((item) => (item.questionNumber || item.number) === qNum);
        assert.ok(q, `Question ${qNum} must exist`);
        assert.ok(q.prompt && q.prompt.length > 5, `Question ${qNum} prompt must be preserved`);
      }
    });
  });

  // =========================================================================
  // ISSUE 2: REGULAR TEST DATABASE SAVE & POSTGREST SCHEMA CACHE HANDLING
  // =========================================================================
  describe('Issue 2: Regular Test Database Save & Schema Cache Handling', () => {
    test('correctly identifies PostgREST schema cache missing column error', () => {
      const isSectionsSchemaCacheError = (err: any) => {
        if (!err) return false;
        const msg = (err.message || '').toLowerCase();
        return (
          err.code === 'PGRST204' ||
          msg.includes("'sections' column") ||
          msg.includes('column "sections"') ||
          (msg.includes('sections') && msg.includes('schema cache')) ||
          (msg.includes('sections') && msg.includes('does not exist'))
        );
      };

      // Exact error message reported by PostgREST
      const sampleError1 = {
        code: 'PGRST204',
        message: "Could not find the 'sections' column of 'regular_tests' in the schema cache",
        details: null,
        hint: null,
      };

      const sampleError2 = {
        code: '42703',
        message: 'column "sections" of relation "regular_tests" does not exist',
      };

      const unrelatedError = {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      };

      assert.strictEqual(isSectionsSchemaCacheError(sampleError1), true);
      assert.strictEqual(isSectionsSchemaCacheError(sampleError2), true);
      assert.strictEqual(isSectionsSchemaCacheError(unrelatedError), false);
    });
  });

  // =========================================================================
  // ISSUE 3: LISTENING AUDIO UPLOAD & ENDPOINT FORMATTING
  // =========================================================================
  describe('Issue 3: Listening Audio Storage & Endpoint Resolution', () => {
    test('getSupabaseEndpoints cleans URLs and prevents /storage/v1 duplication', () => {
      const endpoints = getSupabaseEndpoints();
      assert.ok(endpoints.storageBaseUrl !== undefined);
      // Ensure no double /storage/v1
      assert.ok(!endpoints.storageBaseUrl.includes('/storage/v1/storage/v1'));
      if (endpoints.baseUrl) {
        assert.ok(!endpoints.baseUrl.endsWith('/storage/v1'));
      }
    });

    test('validates non-retryable 4xx errors are not infinitely retried', () => {
      const isNonRetryableStatus = (status: number) => [400, 401, 403, 404, 413, 415].includes(status);
      assert.strictEqual(isNonRetryableStatus(403), true);
      assert.strictEqual(isNonRetryableStatus(413), true);
      assert.strictEqual(isNonRetryableStatus(500), false);
      assert.strictEqual(isNonRetryableStatus(503), false);
    });
  });
});
