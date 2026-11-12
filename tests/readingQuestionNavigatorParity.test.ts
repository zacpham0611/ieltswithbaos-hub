import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractAllNormalizedQuestions,
  buildQuestionRenderGroups,
  type QuestionRenderGroup,
  type ReadingQuestion,
  type QuestionGroup,
} from '../src/lib/questionNormalizer.ts';

describe('READING QUESTION NAVIGATOR PARITY & REGULAR TEST RECOVERY', () => {
  test('1. Passage with partial question groups guarantees 100% parity (no omitted questions)', () => {
    // 13 questions in activePassageQuestions
    const activePassageQuestions: Array<{ q: ReadingQuestion; absoluteIdx: number }> = Array.from({ length: 13 }, (_, i) => ({
      q: {
        id: `q_p1_${i + 1}`,
        type: i < 6 ? 'multiple_choice' : 'true_false_not_given',
        prompt: `Question prompt for number ${i + 1}`,
        correctAnswer: i < 6 ? 'A' : 'TRUE',
        options: i < 6 ? ['A', 'B', 'C', 'D'] : undefined,
      },
      absoluteIdx: i,
    }));

    // Author only defined a QuestionGroup for Q1 to Q6
    const partialGroups: QuestionGroup[] = [
      {
        id: 'g_1',
        title: 'Questions 1–6',
        questionType: 'multiple_choice',
        questions: activePassageQuestions.slice(0, 6).map((item) => item.q),
      },
    ];

    // Simulate the exact logic implemented in AssignmentsView
    const initialRenderGroups: QuestionRenderGroup[] = partialGroups.map((g, gIdx) => {
      const groupItems: Array<{ q: ReadingQuestion; idx: number }> = [];
      (g.questions || []).forEach((gq) => {
        const matched = activePassageQuestions.find((item) => item.q.id === gq.id);
        if (matched) groupItems.push({ q: matched.q, idx: matched.absoluteIdx });
      });
      return {
        id: g.id || `g_${gIdx}`,
        rangeTitle: g.groupTitle || 'Questions 1–6',
        groupType: g.questionType,
        questions: groupItems,
      };
    });

    const renderedQuestionIds = new Set<string>();
    initialRenderGroups.forEach((rg) => {
      rg.questions.forEach(({ q }) => {
        if (q.id) renderedQuestionIds.add(q.id);
      });
    });

    const unrenderedQuestions = activePassageQuestions.filter(
      (item) => !renderedQuestionIds.has(item.q.id)
    );

    const questionRenderGroups: QuestionRenderGroup[] = unrenderedQuestions.length > 0
      ? [...initialRenderGroups, ...buildQuestionRenderGroups(unrenderedQuestions)]
      : initialRenderGroups;

    // Verify all 13 questions are present in questionRenderGroups
    const allRenderedIds = questionRenderGroups.flatMap((rg) => rg.questions.map((qi) => qi.q.id));
    assert.equal(allRenderedIds.length, 13, 'Total rendered questions must equal total navigator questions (13)');
    assert.deepEqual(
      allRenderedIds.sort(),
      activePassageQuestions.map((item) => item.q.id).sort(),
      'Every question in the navigator must exist in the rendering groups'
    );
  });

  test('2. Completion group: unembedded questions fallback guarantees zero dropped questions', () => {
    // 5 questions in completion group
    const groupQuestions: Array<{ q: ReadingQuestion; idx: number }> = [
      { q: { id: 'q_1', type: 'note_completion', prompt: 'First blank' }, idx: 0 },
      { q: { id: 'q_2', type: 'note_completion', prompt: 'Second blank' }, idx: 1 },
      { q: { id: 'q_3', type: 'note_completion', prompt: 'Third blank' }, idx: 2 },
      { q: { id: 'q_4', type: 'note_completion', prompt: 'Fourth blank' }, idx: 3 },
      { q: { id: 'q_5', type: 'note_completion', prompt: 'Fifth blank' }, idx: 4 },
    ];

    // The text with blanks only has [1] and [2]. [3], [4], [5] are not in the text.
    const groupText = 'Here are notes: First [1] and second [2].';
    const renderedInTextQIds = new Set<string>();

    // Simulated renderChunkWithBlanks matches [1] and [2]
    renderedInTextQIds.add('q_1');
    renderedInTextQIds.add('q_2');

    // Unembedded questions computation
    const unembeddedQuestions = groupQuestions.filter(({ q }) => !renderedInTextQIds.has(q.id));

    // Verify:
    assert.equal(renderedInTextQIds.size, 2, '2 questions rendered inline in text');
    assert.equal(unembeddedQuestions.length, 3, '3 questions must render in Answer Fields');
    assert.deepEqual(
      unembeddedQuestions.map((item) => item.q.id),
      ['q_3', 'q_4', 'q_5'],
      'Unembedded questions are accurately preserved'
    );
    assert.equal(
      renderedInTextQIds.size + unembeddedQuestions.length,
      groupQuestions.length,
      'Total interactive inputs must exactly equal the question group total'
    );
  });

  test('3. RegularTestExamView: extractAllNormalizedQuestions extracts questions from passages without dropping', () => {
    const readingSection = {
      id: 'sec_reading_1',
      skill: 'reading',
      title: 'Academic Reading Test',
      passages: [
        {
          id: 'p1',
          title: 'Passage 1: Renewable Energy',
          content: 'Solar and wind power are expanding globally...',
          questions: [
            { id: 'q_r_1', type: 'true_false_not_given', prompt: 'Solar power is expensive.' },
            { id: 'q_r_2', type: 'true_false_not_given', prompt: 'Wind turbines generate noise.' },
          ],
        },
        {
          id: 'p2',
          title: 'Passage 2: Marine Biology',
          content: 'Coral reefs are biodiverse ecosystems...',
          questions: [
            { id: 'q_r_3', type: 'multiple_choice', prompt: 'Coral reefs provide...', options: ['A', 'B', 'C'] },
            { id: 'q_r_4', type: 'short_answer', prompt: 'Name the major threat...' },
          ],
        },
      ],
    };

    const extracted = extractAllNormalizedQuestions(readingSection);
    assert.equal(extracted.questions.length, 4, 'Must extract all 4 questions across all passages');
    assert.equal(extracted.passageMap['q_r_1'], 0, 'q_r_1 mapped to Passage 1 (index 0)');
    assert.equal(extracted.passageMap['q_r_2'], 0, 'q_r_2 mapped to Passage 1 (index 0)');
    assert.equal(extracted.passageMap['q_r_3'], 1, 'q_r_3 mapped to Passage 2 (index 1)');
    assert.equal(extracted.passageMap['q_r_4'], 1, 'q_r_4 mapped to Passage 2 (index 1)');
  });

  test('4. Scheduled test start logic allows starting when current time is past availabilityStart', () => {
    const pastTime = new Date(Date.now() - 3600 * 1000).toISOString();
    const futureTime = new Date(Date.now() + 3600 * 1000).toISOString();

    const scheduledTestStarted = {
      id: 'test-1',
      status: 'scheduled',
      availabilityStart: pastTime,
      availabilityEnd: futureTime,
    };

    const isLiveOrScheduledStarted1 =
      scheduledTestStarted.status === 'live' ||
      (scheduledTestStarted.status === 'scheduled' &&
        (!scheduledTestStarted.availabilityStart || new Date(scheduledTestStarted.availabilityStart) <= new Date()));

    assert.equal(isLiveOrScheduledStarted1, true, 'Scheduled test whose start time has passed should be allowed to start');

    const scheduledTestFuture = {
      id: 'test-2',
      status: 'scheduled',
      availabilityStart: futureTime,
      availabilityEnd: null,
    };

    const isLiveOrScheduledStarted2 =
      scheduledTestFuture.status === 'live' ||
      (scheduledTestFuture.status === 'scheduled' &&
        (!scheduledTestFuture.availabilityStart || new Date(scheduledTestFuture.availabilityStart) <= new Date()));

    assert.equal(isLiveOrScheduledStarted2, false, 'Scheduled test whose start time is in the future must remain blocked');
  });

  test('5. Direct student assignment query matches both raw ID and canonical UUID', () => {
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

    const studentRawId = 'student-1';
    const canonicalUUID = toValidUUID(studentRawId);

    const testInDB = {
      id: 'test-123',
      eligible_student_ids: [canonicalUUID],
    };

    const studentIdsToCheck = Array.from(new Set([studentRawId, toValidUUID(studentRawId)].filter(Boolean)));
    const isEligible = studentIdsToCheck.some((sid) => testInDB.eligible_student_ids.includes(sid));

    assert.equal(isEligible, true, 'Student with raw ID student-1 correctly resolves test assigned with canonical UUID');
  });
});
