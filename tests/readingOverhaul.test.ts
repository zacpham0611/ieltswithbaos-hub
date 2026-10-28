import assert from 'node:assert';
import {
  normalizeQuestionType,
  normalizeOptions,
  resolveQuestionPrompt,
  normalizeReadingQuestion,
  extractParagraphLabelsFromPassage,
  extractAllNormalizedQuestions,
  sanitizeQuestionsForStudent,
} from '../src/lib/questionNormalizer.ts';
import {
  gradeSingleQuestion,
  gradeAssignmentSubmission,
} from '../src/lib/assignmentGrader.ts';
import type { ReadingQuestion, QuestionGroup, ParsedPassage } from '../src/types/index.ts';

console.log('--- RUNNING READING OVERHAUL & QUESTION NORMALIZER REGRESSION TESTS ---');

// 1. Question Type Normalization
assert.strictEqual(normalizeQuestionType('matching-information'), 'matching_information');
assert.strictEqual(normalizeQuestionType('which_paragraph'), 'matching_information');
assert.strictEqual(normalizeQuestionType('information_matching'), 'matching_information');
assert.strictEqual(normalizeQuestionType('tfng'), 'true_false_not_given');
assert.strictEqual(normalizeQuestionType('true-false-not-given'), 'true_false_not_given');
assert.strictEqual(normalizeQuestionType('ynng'), 'yes_no_not_given');
assert.strictEqual(normalizeQuestionType('yes-no-not-given'), 'yes_no_not_given');
assert.strictEqual(normalizeQuestionType('mcq'), 'multiple_choice');
assert.strictEqual(normalizeQuestionType('headings'), 'matching_headings');
assert.strictEqual(normalizeQuestionType('matching-headings'), 'matching_headings');
assert.strictEqual(normalizeQuestionType('features'), 'matching_features');
assert.strictEqual(normalizeQuestionType('matching-sentence-endings'), 'matching_sentence_endings');
assert.strictEqual(normalizeQuestionType('flowchart'), 'flowchart_completion');
assert.strictEqual(normalizeQuestionType('table'), 'table_completion');
assert.strictEqual(normalizeQuestionType('unknown_custom_type'), 'short_answer');
console.log('✓ Passed: Question type normalization across all variants.');

// 2. Blank Question Prevention & Field Resolution
const legacyQ1 = {
  id: 'legacy_1',
  questionText: 'Which discovery led to the breakthrough in aviation?',
  type: 'multiple_choice',
  choices: ['A. Streamlined wings', 'B. Lightweight engine'],
  correct_answer: 'B',
};
const normQ1 = normalizeReadingQuestion(legacyQ1, 1);
assert.strictEqual(normQ1.prompt, 'Which discovery led to the breakthrough in aviation?');
assert.strictEqual(normQ1.type, 'multiple_choice');
assert.deepStrictEqual(normQ1.options, ['A. Streamlined wings', 'B. Lightweight engine']);
assert.strictEqual(normQ1.correctAnswer, 'B');

const legacyQ2 = {
  id: 'legacy_2',
  statement: 'The initial experiment was deemed a failure.',
  questionType: 'tfng',
  key: 'TRUE',
};
const normQ2 = normalizeReadingQuestion(legacyQ2, 2);
assert.strictEqual(normQ2.prompt, 'The initial experiment was deemed a failure.');
assert.strictEqual(normQ2.type, 'true_false_not_given');
assert.strictEqual(normQ2.correctAnswer, 'TRUE');

const blankQ = { id: 'empty_prompt_q' };
const normBlank = normalizeReadingQuestion(blankQ, 3);
assert.strictEqual(normBlank.prompt, 'Question 3'); // Never blank!
console.log('✓ Passed: Blank question prevention & legacy field mapping.');

// 3. Options Normalization
const objOptions = [{ label: 'A', text: 'First item' }, { label: 'B', text: 'Second item' }];
assert.deepStrictEqual(normalizeOptions(objOptions), ['A. First item', 'B. Second item']);

const stringOptions = 'A. Alpha\nB. Beta; C. Gamma';
assert.deepStrictEqual(normalizeOptions(stringOptions), ['A. Alpha', 'B. Beta', 'C. Gamma']);
console.log('✓ Passed: Options normalization.');

// 4. Multi-Passage Extraction & Elimination of 0 / 0 Answered Bug
const testAssignmentWithNestedPassages = {
  id: 'mock_test_1',
  title: 'Full Mock Test 2024',
  passages: [
    {
      id: 'p1',
      passageIndex: 1,
      title: 'Passage 1: Urban Farming',
      content: 'Paragraph A: Urban farming takes root...\n\nParagraph B: Economic advantages...',
      questionGroups: [
        {
          id: 'g1',
          instructions: 'Questions 1-3: Choose TRUE, FALSE or NOT GIVEN',
          questionType: 'true_false_not_given',
          questions: [
            { id: 'p1_q1', prompt: 'Farms exist in cities.', correctAnswer: 'TRUE' },
            { id: 'p1_q2', prompt: 'Profits are guaranteed.', correctAnswer: 'FALSE' },
            { id: 'p1_q3', prompt: 'Only vegetables are grown.', correctAnswer: 'NOT GIVEN' },
          ],
        },
      ],
    },
    {
      id: 'p2',
      passageIndex: 2,
      title: 'Passage 2: Marine Biology',
      content: 'Deep sea exploration has revealed mysterious species...',
      questions: [
        { id: 'p2_q4', prompt: 'What depth was reached?', correctAnswer: '3000 metres' },
      ],
    },
  ],
  readingQuestions: [], // top level was empty in the legacy bug!
};

const extracted = extractAllNormalizedQuestions(testAssignmentWithNestedPassages);
assert.strictEqual(extracted.totalCount, 4);
assert.strictEqual(extracted.questions.length, 4);
assert.strictEqual(extracted.passageMap['p1_q1'], 0);
assert.strictEqual(extracted.passageMap['p2_q4'], 1);
console.log('✓ Passed: Multi-passage extraction eliminates 0 / 0 Answered bug.');

// 5. Paragraph Label Extraction for Matching Information
const samplePassageText = `
Paragraph A
Historically, navigation relied on astronomical charts.

Paragraph B
With the invention of the compass, sailors traveled further.

Paragraph C
Modern satellite communication provides sub-meter precision.

Paragraph D
Future developments promise autonomous oceanic vessels.
`;
const extractedLabels = extractParagraphLabelsFromPassage(samplePassageText);
assert.deepStrictEqual(extractedLabels, ['A', 'B', 'C', 'D']);
console.log('✓ Passed: Paragraph label extraction from passage.');

// 6. Matching Information Question Grading (Single & Repeated Letters)
const matchingInfoQ1: ReadingQuestion = {
  id: 'mi_1',
  type: 'matching_information',
  prompt: 'a reference to traditional navigational techniques based on the night sky',
  correctAnswer: 'A',
  explanation: 'Paragraph A mentions astronomical charts.',
};
const matchingInfoQ2: ReadingQuestion = {
  id: 'mi_2',
  type: 'matching_information',
  prompt: 'mention of future unmanned shipping',
  correctAnswer: 'Paragraph D',
  explanation: 'Paragraph D outlines autonomous oceanic vessels.',
};
// Test exact letter, lowercase letter, full phrase "Paragraph A", bracket "[A]"
assert.strictEqual(gradeSingleQuestion(matchingInfoQ1, 'A').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(matchingInfoQ1, 'a').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(matchingInfoQ1, 'Paragraph A').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(matchingInfoQ1, '[A]').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(matchingInfoQ1, 'B').isCorrect, false);

assert.strictEqual(gradeSingleQuestion(matchingInfoQ2, 'D').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(matchingInfoQ2, 'Paragraph D').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(matchingInfoQ2, 'C').isCorrect, false);
console.log('✓ Passed: Matching Information question grading with letter variations.');

// 7. Ungrounded / Missing Answer Key Handling:
// Missing key MUST result in isPendingReview: true, earnedPoints: 0, and excluded from graded denominator.
const ungroundedQ: ReadingQuestion = {
  id: 'ungrounded_q',
  type: 'short_answer',
  prompt: 'What was the initial temperature?',
  correctAnswer: '', // No answer key available!
  explanation: '',
};

const singleUngroundedRes = gradeSingleQuestion(ungroundedQ, '25 degrees');
assert.strictEqual(singleUngroundedRes.isCorrect, false);
assert.strictEqual(singleUngroundedRes.isPendingReview, true);
assert.strictEqual(singleUngroundedRes.earnedPoints, 0);

// Grade whole submission containing 2 graded questions and 1 ungrounded question
const testQuestions: ReadingQuestion[] = [
  { id: 'q1', type: 'true_false_not_given', prompt: 'P1', correctAnswer: 'TRUE', explanation: '' },
  { id: 'q2', type: 'multiple_choice', prompt: 'P2', correctAnswer: 'B', explanation: '' },
  ungroundedQ,
];

const studentAns = {
  q1: 'TRUE',
  q2: 'B',
  ungrounded_q: 'Some student hypothesis',
};

const submissionSummary = gradeAssignmentSubmission(testQuestions, studentAns, 'academic');
// Student got 2 out of 2 gradable questions correct
assert.strictEqual(submissionSummary.correctCount, 2);
assert.strictEqual(submissionSummary.incorrectCount, 0); // Ungrounded question must NOT be marked incorrect!
assert.strictEqual(submissionSummary.hasOpenEnded, true);
assert.strictEqual(submissionSummary.finalStatus, 'submitted'); // awaits teacher evaluation
assert.strictEqual(submissionSummary.gradableCount, 2); // Only 2 gradable
assert.strictEqual(submissionSummary.percentage, 100); // 2/2 = 100% of gradable questions
console.log('✓ Passed: Ungrounded/missing keys excluded from denominator and marked pending review.');

// 8. Answer Key Security & Student Sanitization
const teacherQuestions: ReadingQuestion[] = [
  { id: 'sec_1', type: 'multiple_choice', prompt: 'Question 1', correctAnswer: 'A', explanation: 'Found in para 1' },
  { id: 'sec_2', type: 'short_answer', prompt: 'Question 2', correctAnswer: 'coal mine', explanation: 'Line 45' },
];

const sanitized = sanitizeQuestionsForStudent(teacherQuestions, false);
assert.strictEqual(sanitized[0].correctAnswer, '');
assert.strictEqual(sanitized[0].explanation, '');
assert.strictEqual(sanitized[1].correctAnswer, '');
assert.strictEqual(sanitized[1].explanation, '');
assert.strictEqual(sanitized[0].prompt, 'Question 1'); // Prompts remain intact

const released = sanitizeQuestionsForStudent(teacherQuestions, true);
assert.strictEqual(released[0].correctAnswer, 'A');
assert.strictEqual(released[0].explanation, 'Found in para 1');
console.log('✓ Passed: Student answer key sanitization and security.');

console.log('--- ALL READING OVERHAUL REGRESSION TESTS PASSED (8/8) ---');
