import assert from 'node:assert';
import {
  normalizeReadingQuestion,
  extractAllNormalizedQuestions,
  buildQuestionRenderGroups,
} from '../src/lib/questionNormalizer.ts';
import type { QuestionGroup, ReadingQuestion, ParsedPassage } from '../src/types/index.ts';

console.log('--- STARTING QUESTION TYPE OVERRIDE PERSISTENCE TESTS ---');

// Test 1: Summary Completion -> Multiple Choice with blanks in prompt
console.log('Testing Test 1: Summary Completion -> Multiple Choice persists despite blanks in prompt...');
{
  const rawQWithBlanks: any = {
    id: 'q1',
    prompt: 'The industrial revolution began in England in the late ... [1] period.',
    options: ['A. Victorian', 'B. Georgian', 'C. Edwardian', 'D. Elizabethan'],
    correctAnswer: 'A',
    type: 'multiple_choice',
    questionTypeOverride: 'multiple_choice',
    isTeacherEdited: true,
  };

  const normalized = normalizeReadingQuestion(rawQWithBlanks, 1, 0);
  assert.strictEqual(
    normalized.type,
    'multiple_choice',
    'Question type must remain multiple_choice even though prompt has blanks'
  );
  assert.strictEqual(
    normalized.questionTypeOverride,
    'multiple_choice',
    'questionTypeOverride must be preserved'
  );
  assert.strictEqual(normalized.isTeacherEdited, true, 'isTeacherEdited must be true');
  console.log('✓ Test 1 Passed: Summary Completion -> Multiple Choice override preserved.');
}

// Test 2: Multiple Choice -> Note Completion persists
console.log('Testing Test 2: Multiple Choice -> Note Completion persists...');
{
  const rawQ: any = {
    id: 'q2',
    prompt: 'Local languages: Declining languages: 17 • [2] languages: 8',
    correctAnswer: 'extinct',
    type: 'note_completion',
    questionTypeOverride: 'note_completion',
    isTeacherEdited: true,
  };

  const normalized = normalizeReadingQuestion(rawQ, 2, 0);
  assert.strictEqual(normalized.type, 'note_completion');
  assert.strictEqual(normalized.questionTypeOverride, 'note_completion');
  console.log('✓ Test 2 Passed: Multiple Choice -> Note Completion override preserved.');
}

// Test 3: Group-level Question Type Override cascade to questions
console.log('Testing Test 3: Question Group type change cascades to all child questions...');
{
  const testGroup: QuestionGroup = {
    id: 'g_test_1',
    instructions: 'Choose the correct letter, A, B, C or D.',
    questionType: 'multiple_choice',
    questionTypeOverride: 'multiple_choice',
    isTeacherEdited: true,
    questions: [
      {
        id: 'q10',
        prompt: 'The author notes that ancient trade routes ... 10 ...',
        options: ['A. were vast', 'B. were local', 'C. were sea-only', 'D. were dangerous'],
        correctAnswer: 'A',
        type: 'summary_completion', // originally detected as summary
        explanation: '',
      },
      {
        id: 'q11',
        prompt: 'Archaeologists discovered evidence of ... 11 ...',
        options: ['A. silk garments', 'B. gold coins', 'C. spices', 'D. pottery'],
        correctAnswer: 'B',
        type: 'summary_completion', // originally detected as summary
        explanation: '',
      },
    ],
  };

  const extracted = extractAllNormalizedQuestions({
    questionGroups: [testGroup],
    passages: [],
  });

  assert.strictEqual(extracted.questions.length, 2);
  assert.strictEqual(
    extracted.questions[0].type,
    'multiple_choice',
    'Question 10 must inherit group override to multiple_choice'
  );
  assert.strictEqual(
    extracted.questions[1].type,
    'multiple_choice',
    'Question 11 must inherit group override to multiple_choice'
  );
  assert.strictEqual(extracted.questionGroups[0].questionType, 'multiple_choice');
  console.log('✓ Test 3 Passed: Group-level override successfully cascades to all child questions.');
}

// Test 4: Full Library Resource JSON Import -> Assignment creation flow
console.log('Testing Test 4: End-to-end Library Resource JSON Import -> Assignment creation...');
{
  const libraryResourceJson = {
    title: 'Silk Industry Reading Test',
    skill: 'reading',
    passages: [
      {
        id: 'p_silk',
        passageIndex: 0,
        title: 'The development of the silk industry',
        content: 'Silk is a fine, strong, soft, lustrous fiber produced by silkworms...',
        questionGroups: [
          {
            id: 'g_silk_1',
            instructions: 'Choose the correct letter, A, B, C or D.',
            questionType: 'multiple_choice',
            questionTypeOverride: 'multiple_choice',
            isTeacherEdited: true,
            questions: [
              {
                id: 'silk_q1',
                prompt: 'According to paragraph 1, silkworms were first cultivated in ... [1]',
                options: ['A. China', 'B. India', 'C. Japan', 'D. Persia'],
                correctAnswer: 'A',
                type: 'multiple_choice',
                questionTypeOverride: 'multiple_choice',
                isTeacherEdited: true,
                explanation: '',
              },
              {
                id: 'silk_q2',
                prompt: 'The trade routes became known as the Silk Road because ... [2]',
                options: ['A. silk was the primary export', 'B. travelers wore silk', 'C. roads were smooth', 'D. emperors ordered it'],
                correctAnswer: 'A',
                type: 'multiple_choice',
                questionTypeOverride: 'multiple_choice',
                isTeacherEdited: true,
                explanation: '',
              },
            ],
          },
        ],
        questions: [
          {
            id: 'silk_q1',
            prompt: 'According to paragraph 1, silkworms were first cultivated in ... [1]',
            options: ['A. China', 'B. India', 'C. Japan', 'D. Persia'],
            correctAnswer: 'A',
            type: 'multiple_choice',
            questionTypeOverride: 'multiple_choice',
            isTeacherEdited: true,
            explanation: '',
          },
          {
            id: 'silk_q2',
            prompt: 'The trade routes became known as the Silk Road because ... [2]',
            options: ['A. silk was the primary export', 'B. travelers wore silk', 'C. roads were smooth', 'D. emperors ordered it'],
            correctAnswer: 'A',
            type: 'multiple_choice',
            questionTypeOverride: 'multiple_choice',
            isTeacherEdited: true,
            explanation: '',
          },
        ],
      },
    ],
  };

  // Simulate Assignment import
  const extracted = extractAllNormalizedQuestions(libraryResourceJson);

  assert.strictEqual(extracted.questions.length, 2);
  assert.strictEqual(extracted.questions[0].type, 'multiple_choice');
  assert.strictEqual(extracted.questions[1].type, 'multiple_choice');

  // Verify student-facing render groups produce multiple_choice rather than completion
  const renderGroups = buildQuestionRenderGroups(extracted.questions);
  assert.strictEqual(renderGroups.length, 1);
  assert.strictEqual(renderGroups[0].groupType, 'multiple_choice');
  assert.strictEqual(renderGroups[0].groupText, undefined, 'Multiple Choice should not have completion groupText');
  console.log('✓ Test 4 Passed: Library JSON import correctly retains teacher override in Assignment.');
}

// Test 5: Matching Headings -> Matching Information override persistence
console.log('Testing Test 5: Matching Headings -> Matching Information override...');
{
  const rawQ: any = {
    id: 'q_match',
    prompt: 'Which paragraph contains the following information: Discoveries of silk remnants?',
    correctAnswer: 'B',
    type: 'matching_information',
    questionTypeOverride: 'matching_information',
    isTeacherEdited: true,
    headingsList: ['i. History of silk', 'ii. Production techniques'], // legacy headings attached during detection
  };

  const normalized = normalizeReadingQuestion(rawQ, 1, 0);
  assert.strictEqual(normalized.type, 'matching_information');
  assert.strictEqual(normalized.questionTypeOverride, 'matching_information');
  console.log('✓ Test 5 Passed: Matching Headings -> Matching Information override preserved.');
}

console.log('\n================================================================');
console.log('ALL QUESTION TYPE OVERRIDE PERSISTENCE TESTS PASSED! 🎉');
console.log('================================================================\n');
