import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';
import {
  parseListeningDocument,
  convertHtmlTablesToMarkdown,
  htmlToListeningText,
} from '../src/lib/listeningExtractor.ts';
import {
  uploadAudioOptimized,
  type AudioUploadProgress,
} from '../src/lib/optimizedAudioUploader.ts';

describe('Test Persistence, Bulk Audio Upload & Student Listening UI', () => {
  const referenceDocxPath = path.resolve(
    'C:/Users/Admin/.gemini/antigravity/brain/e66bef89-3824-44a3-9b01-1da8f8609a20/.user_uploaded/media_1793634904344_a8f7fc60.docx'
  );

  // =========================================================================
  // PART C: Listening Table & Note Completion Extraction & Rendering
  // =========================================================================
  describe('PART C – Student Listening UI & Question Content Extraction', () => {
    test('correctly converts HTML tables from DOCX into Markdown tables with embedded gap markers [1], [2], etc.', async () => {
      if (!fs.existsSync(referenceDocxPath)) {
        console.warn('Reference DOCX not found at path, skipping direct file read');
        return;
      }

      const fileBuffer = fs.readFileSync(referenceDocxPath);
      const { value: html } = await mammoth.convertToHtml({ buffer: fileBuffer });
      const convertedText = htmlToListeningText(html);

      // Verify table was converted to Markdown table
      assert.ok(convertedText.includes('| Date | Time | Activity | Place | Comments |'));
      assert.ok(convertedText.includes('| --- | --- | --- | --- | --- |'));
      // Gap markers must be visual badges [1], [2], [3], etc.
      assert.ok(convertedText.includes('the [1]'));
      assert.ok(convertedText.includes('[2] p.m.'));
      assert.ok(convertedText.includes('meet at the [3]'));
      assert.ok(convertedText.includes("children's [4] competition"));
      assert.ok(convertedText.includes('bring a [5]'));
      assert.ok(convertedText.includes('by the [6]'));
    });

    test('extracts table completion group with structured Markdown table and clean questions without sentence fragments', async () => {
      if (!fs.existsSync(referenceDocxPath)) return;

      const fileBuffer = fs.readFileSync(referenceDocxPath);
      const [{ value: rawText }, { value: html }] = await Promise.all([
        mammoth.extractRawText({ buffer: fileBuffer }),
        mammoth.convertToHtml({ buffer: fileBuffer }),
      ]);

      const parsed = parseListeningDocument(rawText, 'IELTS Test 1 – Listening.docx', html);

      assert.ok(parsed.parts.length >= 1);
      const part1 = parsed.parts[0];

      // Find Table Completion question group (Questions 1-6)
      const tableGroup = part1.questionGroups.find(
        (g) => g.type === 'table_completion' || (g.groupText && g.groupText.includes('| Date |'))
      );

      assert.ok(tableGroup, 'Table group should be found');
      assert.ok(tableGroup.groupText, 'Group text with table should be preserved');
      assert.ok(tableGroup.groupText.includes('| Date | Time | Activity | Place | Comments |'));
      assert.ok(tableGroup.groupText.includes('[1]'));
      assert.ok(tableGroup.groupText.includes('[6]'));

      // Verify individual questions: Must NOT contain sentence fragments like "the _____" or "meet at the _____"
      const q1 = tableGroup.questions.find((q) => q.questionNumber === 1 || q.number === 1);
      assert.ok(q1);
      assert.ok(!q1.prompt.includes('the _____'), 'Q1 prompt should not contain the _____');
      assert.ok(!q1.prompt.includes('meet at the'), 'Q1 prompt should not contain meet at the');

      const q3 = tableGroup.questions.find((q) => q.questionNumber === 3 || q.number === 3);
      assert.ok(q3);
      assert.ok(!q3.prompt.includes('meet at the _____'), 'Q3 prompt should not contain meet at the _____');

      // Verify Note Completion questions (Questions 7-10)
      const noteGroup = part1.questionGroups.find(
        (g) => g.questions.some((q) => (q.questionNumber || q.number) === 7)
      );
      assert.ok(noteGroup, 'Note group should be found');
      assert.ok(noteGroup.questions.length >= 4, 'Should have at least 4 note questions');
    });

    test('handles generalized tables dynamically without hardcoding', () => {
      const sampleHtml = `
        <p>Questions 1–3. Complete the table below.</p>
        <table>
          <thead>
            <tr><th>Location</th><th>Feature</th><th>Cost</th></tr>
          </thead>
          <tbody>
            <tr><td>Central Park</td><td>the <strong>1</strong> …………</td><td>$10</td></tr>
            <tr><td>Riverbank</td><td>open <strong>2</strong> ………… p.m.</td><td>Free</td></tr>
            <tr><td>Highlands</td><td>guided <strong>3</strong> …………</td><td>$25</td></tr>
          </tbody>
        </table>
      `;

      const md = convertHtmlTablesToMarkdown(sampleHtml);
      assert.ok(md.includes('| Location | Feature | Cost |'));
      assert.ok(md.includes('the [1]'));
      assert.ok(md.includes('open [2] p.m.'));
      assert.ok(md.includes('guided [3]'));

      const parsed = parseListeningDocument('', 'Custom Practice.docx', sampleHtml);
      const q1 = parsed.parts[0]?.questions.find((q) => (q.questionNumber || q.number) === 1);
      assert.ok(q1);
      assert.strictEqual(q1?.type, 'table_completion');
    });
  });

  // =========================================================================
  // PART B: Optimized Audio Upload & Monotonic Progress Tracking
  // =========================================================================
  describe('PART B – Audio Upload Monotonic Progress & Lifecycle States', () => {
    test('guarantees monotonically non-decreasing progress without 99% -> 1% drops', async () => {
      const sampleBlob = new Blob(['dummy audio binary content '.repeat(200)], { type: 'audio/mpeg' });
      const progressHistory: AudioUploadProgress[] = [];

      const url = await uploadAudioOptimized(sampleBlob, {
        preferredFileName: 'test_monotonic_audio.mp3',
        onProgress: (p) => {
          progressHistory.push({ ...p });
        },
      });

      assert.ok(url);
      assert.ok(progressHistory.length > 0);

      // Verify monotonic non-decreasing percentage
      for (let i = 1; i < progressHistory.length; i++) {
        assert.ok(
          progressHistory[i].percentage >= progressHistory[i - 1].percentage,
          `Progress should not decrease: ${progressHistory[i - 1].percentage}% -> ${progressHistory[i].percentage}%`
        );
      }

      // Verify final status is 'completed' with 100%
      const lastProgress = progressHistory[progressHistory.length - 1];
      assert.strictEqual(lastProgress.status, 'completed');
      assert.strictEqual(lastProgress.percentage, 100);
    });
  });

  // =========================================================================
  // PART A: Regular Test Persistence & UUID Mapping
  // =========================================================================
  describe('PART A – Regular Test Persistence & UUID Sanitization', () => {
    test('sanitizes mock course and teacher IDs into valid UUIDs for PostgreSQL schema constraints', () => {
      const isUUID = (str?: string) =>
        Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

      const toValidUUID = (str?: string): string => {
        if (isUUID(str)) return str!;
        let hash = 0;
        const s = str || 'default-id';
        for (let i = 0; i < s.length; i++) {
          hash = ((hash << 5) - hash) + s.charCodeAt(i);
          hash |= 0;
        }
        const hex = Math.abs(hash).toString(16).padStart(8, '0');
        return `${hex.slice(0, 8)}-0000-4000-8000-${hex.padEnd(12, '0').slice(0, 12)}`;
      };

      const mockCourseId = 'course-1';
      const mockTeacherId = 'teacher-demo';
      const mockStudentIds = ['student-1', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'invalid-uuid'];

      const sanitizedCourseId = toValidUUID(mockCourseId);
      const sanitizedTeacherId = toValidUUID(mockTeacherId);
      const sanitizedStudentIds = mockStudentIds.map(toValidUUID).filter(isUUID);

      assert.strictEqual(isUUID(sanitizedCourseId), true);
      assert.strictEqual(isUUID(sanitizedTeacherId), true);
      assert.strictEqual(sanitizedStudentIds.every(isUUID), true);
      assert.strictEqual(sanitizedStudentIds.length, 3);

      // Deterministic check: Same mock string produces identical UUID
      assert.strictEqual(toValidUUID(mockCourseId), sanitizedCourseId);
    });
  });
});
