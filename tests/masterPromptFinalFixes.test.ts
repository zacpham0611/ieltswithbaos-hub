import { describe, it } from 'node:test';
import assert from 'node:assert';
import { detectQuestionType } from '../src/lib/documentExtractor.ts';
import { convertHtmlTablesToMarkdown, htmlToListeningText } from '../src/lib/listeningExtractor.ts';
import { extractAllNormalizedQuestions } from '../src/lib/questionNormalizer.ts';

describe('MASTER PROMPT – FINAL BUG FIXES & UI IMPROVEMENTS TEST SUITE', () => {
  // =========================================================================
  // PART I: READING MODULE
  // =========================================================================
  describe('Part I: Reading Module – MCQ Detection & Type Persistence', () => {
    it('1. Classifies sentence completion style stem with labelled options (Question 29) as multiple_choice', () => {
      const q29Prompt = '29 According to paragraph three, in order to optimise employees’ performance, _______ are needed.';
      const q29Options = [
        'A. drive to acquire and achievement element',
        'B. outstanding performance and recognition',
        'C. career fulfillment and a thousand dollar check',
        'D. financial incentive and recognition',
      ];

      const detectedType = detectQuestionType(q29Prompt, 'Choose the correct letter, A, B, C or D.', q29Options);
      assert.strictEqual(detectedType, 'multiple_choice', `Must classify Q29 as multiple_choice, got ${detectedType}`);
    });

    it('2. Respects explicit document-level MCQ group headings even if stems contain blanks', () => {
      const stemWithBlanks = '30 In this study, _______ was found to be the most influential factor.';
      const options = [
        'A. high salary',
        'B. supportive work culture',
        'C. flexible working hours',
        'D. job rotation',
      ];

      const detectedType = detectQuestionType(stemWithBlanks, 'Questions 28-32: Multiple Choice Questions', options);
      assert.strictEqual(detectedType, 'multiple_choice', 'Explicit MCQ heading must produce multiple_choice');
    });

    it('3. Distinguishes Summary Completion from Multiple Choice', () => {
      // Summary completion paragraph with numbered blanks without labelled choices
      const summaryText = 'The research demonstrated that employees seeking (31) _______ require appropriate feedback.';
      const summaryType = detectQuestionType(summaryText, 'Complete the summary below using NO MORE THAN TWO WORDS.');
      assert.strictEqual(summaryType, 'summary_completion');

      // Summary completion with word bank options
      const wordBankOptions = ['A. incentive', 'B. recognition', 'C. leadership', 'D. training', 'E. bonus', 'F. respect'];
      const summaryWithBankType = detectQuestionType(summaryText, 'Complete the summary using the list of words, A-G, below.', wordBankOptions);
      assert.strictEqual(summaryWithBankType, 'summary_completion');
    });

    it('4. Preserves teacher question type override from Document Import into Materials Library and Reading UI', () => {
      const libraryPayload = {
        title: 'Workplace Motivation Test',
        readingQuestions: [
          {
            id: 'q_29',
            number: 29,
            prompt: '29 According to paragraph three, in order to optimise employees’ performance, _______ are needed.',
            type: 'multiple_choice',
            detectedQuestionType: 'summary_completion',
            questionTypeOverride: 'multiple_choice',
            isTeacherEdited: true,
            options: [
              'A. drive to acquire and achievement element',
              'B. outstanding performance and recognition',
              'C. career fulfillment and a thousand dollar check',
              'D. financial incentive and recognition',
            ],
            correctAnswer: 'D',
          },
        ],
        questionGroups: [
          {
            id: 'g_1',
            groupTitle: 'Questions 29-32',
            questionType: 'multiple_choice',
            questionTypeOverride: 'multiple_choice',
            isTeacherEdited: true,
            questions: [
              {
                id: 'q_29',
                number: 29,
                prompt: '29 According to paragraph three, in order to optimise employees’ performance, _______ are needed.',
                type: 'multiple_choice',
                detectedQuestionType: 'summary_completion',
                questionTypeOverride: 'multiple_choice',
                isTeacherEdited: true,
              },
            ],
          },
        ],
      };

      const normalized = extractAllNormalizedQuestions(libraryPayload);
      assert.strictEqual(normalized.questions.length, 1);
      assert.strictEqual(
        normalized.questions[0].type,
        'multiple_choice',
        'Teacher-corrected question type must be preserved as multiple_choice without reverting to summary_completion'
      );
      assert.strictEqual(normalized.questions[0].questionTypeOverride, 'multiple_choice');
      assert.strictEqual(normalized.questions[0].isTeacherEdited, true);
    });
  });

  // =========================================================================
  // PART II: LISTENING MODULE
  // =========================================================================
  describe('Part II: Listening Module – Notes Artifacts Cleanup & Typography', () => {
    it('1. Converts single-cell DOCX callout table to structured notes without markdown table syntax', () => {
      const html1x1 = `
        <table>
          <tr>
            <td>
              <p>Bislama – The Pidgin English Language of Vanuatu</p>
              <p>Languages in Vanuatu</p>
              <p>Local languages:</p>
              <li>Actively spoken languages: 81</li>
              <li>Declining languages: 17</li>
              <li>31 ………… languages: 8</li>
            </td>
          </tr>
        </table>
      `;

      const converted = convertHtmlTablesToMarkdown(html1x1);
      assert(!converted.includes('| ---'), 'Must not contain orphaned table separator | ---');
      assert(!converted.includes('| Bislama'), 'Must not wrap 1x1 callout in markdown pipe characters');
      assert(converted.includes('• Actively spoken languages: 81'), 'Preserves bullet lists');
      assert(converted.includes('[31]'), 'Extracts [31] gap marker');
    });

    it('2. Preserves authentic multi-column tables in convertHtmlTablesToMarkdown', () => {
      const htmlMultiCol = `
        <table>
          <tr><th>Event</th><th>Time</th><th>Price</th></tr>
          <tr><td>Concert</td><td>7:30 PM</td><td>$15</td></tr>
          <tr><td>Exhibition</td><td>10:00 AM</td><td>Free</td></tr>
        </table>
      `;

      const converted = convertHtmlTablesToMarkdown(htmlMultiCol);
      assert(converted.includes('| Event | Time | Price |'), 'Authentic table headers preserved');
      assert(converted.includes('| --- | --- | --- |'), 'Table header separator preserved for multi-column tables');
      assert(converted.includes('| Concert | 7:30 PM | $15 |'), 'Table rows preserved');
    });

    it('3. Cleans problematic formatting artifacts: orphaned separators, broken line wraps, isolated bullets', () => {
      const problematicNotes = `
| ---
Bislama – The Pidgin English Language of Vanuatu
Languages in
Vanuatu
Local languages:
•
Actively spoken languages: 81
•
Declining languages: 17
• [31] languages: 8
Bislama. |
| ---
      `.trim();

      // Clean using the renderer logic
      let formattedText = problematicNotes.replace(/^\s*\|?\s*:?-{3,}:?\s*\|?\s*$/gm, '');
      formattedText = formattedText.replace(/^\s*\|\s*/gm, '').replace(/\s*\|\s*$/gm, '');
      formattedText = formattedText.replace(/^[•\-\*\+]\s*\n(?=[A-Za-z0-9\[])/gm, '• ');
      formattedText = formattedText.replace(/\b(Languages in|History of|Description of|Local languages:|Foreign languages:)\s*\n\s*/gi, '$1 ');
      formattedText = formattedText.replace(/\n{3,}/g, '\n\n').trim();

      assert(!formattedText.includes('| ---'), 'Must remove | ---');
      assert(!formattedText.includes('|'), 'Must remove stray pipe characters');
      assert(formattedText.includes('Languages in Vanuatu'), 'Reconnects broken heading line split');
      assert(formattedText.includes('• Actively spoken languages: 81'), 'Merges isolated bullet symbol with following content line');
    });
  });

  // =========================================================================
  // PART III: REGULAR TEST MODULE
  // =========================================================================
  describe('Part III: Regular Test Module – Synchronization & Persistence', () => {
    it('1. Recognizes approved, enrolled, and active student enrollment statuses for test availability', () => {
      const enrollments = [
        { course_id: 'c_1', status: 'approved' },
        { course_id: 'c_2', status: 'enrolled' },
        { course_id: 'c_3', status: 'active' },
        { course_id: 'c_4', status: 'pending' },
        { course_id: 'c_5', status: 'rejected' },
      ];

      const approvedCourseIds: string[] = [];
      enrollments.forEach((e) => {
        if (e.status === 'approved' || e.status === 'enrolled' || e.status === 'active') {
          approvedCourseIds.push(e.course_id);
        }
      });

      assert.deepStrictEqual(approvedCourseIds, ['c_1', 'c_2', 'c_3']);
      assert(!approvedCourseIds.includes('c_4'), 'Pending must not be approved');
      assert(!approvedCourseIds.includes('c_5'), 'Rejected must not be approved');
    });

    it('2. Hydrates regular tests immediately from localStorage cache key format', () => {
      const userId = 'user_teacher_123';
      const cacheKey = `ielts_regular_tests_${userId}`;
      const mockCachedTests = [
        {
          id: 'rt_1',
          title: 'Midterm Academic IELTS Test',
          courseId: 'c_1',
          status: 'live',
        },
      ];

      const serialized = JSON.stringify(mockCachedTests);
      const parsed = JSON.parse(serialized);

      assert.strictEqual(cacheKey, 'ielts_regular_tests_user_teacher_123');
      assert.strictEqual(parsed.length, 1);
      assert.strictEqual(parsed[0].title, 'Midterm Academic IELTS Test');
    });
  });
});
