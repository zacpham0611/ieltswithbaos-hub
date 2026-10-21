import assert from 'node:assert';
import {
  gradeSingleQuestion,
  gradeAssignmentSubmission,
  normalizeAnswerText,
  countWords,
} from '../src/lib/assignmentGrader.ts';
import type { ReadingQuestion } from '../src/types/index.ts';

console.log('--- RUNNING IELTS ASSIGNMENT GRADER TESTS ---');

// 1. Multiple Choice Tests
const mcq: ReadingQuestion = {
  id: 'q1',
  type: 'multiple_choice',
  prompt: 'What was the primary motive?',
  options: ['A. Economic gain', 'B. Scientific inquiry', 'C. Political pressure'],
  correctAnswer: 'B',
  explanation: 'Paragraph 2 mentions pure scientific inquiry.',
};

assert.strictEqual(gradeSingleQuestion(mcq, 'B').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(mcq, 'b').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(mcq, 'B. Scientific inquiry').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(mcq, 'A').isCorrect, false);
assert.strictEqual(gradeSingleQuestion(mcq, '').isCorrect, false);
console.log('✓ Passed: Multiple Choice grading.');

// 2. Multiple Select (Set comparison, order independent)
const msq: ReadingQuestion = {
  id: 'q2',
  type: 'multiple_select',
  prompt: 'Choose TWO letters, A-E.',
  options: ['A. Solar', 'B. Wind', 'C. Hydro', 'D. Nuclear', 'E. Coal'],
  correctAnswer: 'A, C',
  explanation: 'Solar and Hydro are mentioned.',
};

assert.strictEqual(gradeSingleQuestion(msq, 'A, C').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(msq, 'C, A').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(msq, 'a; c').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(msq, 'A, B').isCorrect, false);
assert.strictEqual(gradeSingleQuestion(msq, 'A').isCorrect, false);
assert.strictEqual(gradeSingleQuestion(msq, 'A, C, D').isCorrect, false);
console.log('✓ Passed: Multiple Select set comparison.');

// 3. True / False / Not Given vs Yes / No / Not Given (Strict Distinction)
const tfng: ReadingQuestion = {
  id: 'q3',
  type: 'true_false_not_given',
  prompt: 'The expedition reached the summit before winter.',
  correctAnswer: 'TRUE',
  explanation: 'Reached on October 12.',
};

assert.strictEqual(gradeSingleQuestion(tfng, 'TRUE').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(tfng, 'true').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(tfng, 'True').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(tfng, 'FALSE').isCorrect, false);
// Cross-type rejection: YES is NOT acceptable on T/F/NG
assert.strictEqual(gradeSingleQuestion(tfng, 'YES').isCorrect, false);
console.log('✓ Passed: True / False / Not Given strict grading.');

const ynng: ReadingQuestion = {
  id: 'q4',
  type: 'yes_no_not_given',
  prompt: 'The author claims government intervention was necessary.',
  correctAnswer: 'YES',
  explanation: 'Author states regulation is imperative.',
};

assert.strictEqual(gradeSingleQuestion(ynng, 'YES').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(ynng, 'yes').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(ynng, 'NO').isCorrect, false);
// Cross-type rejection: TRUE is NOT acceptable on Y/N/NG
assert.strictEqual(gradeSingleQuestion(ynng, 'TRUE').isCorrect, false);
console.log('✓ Passed: Yes / No / Not Given strict grading.');

// 4. Matching Headings
const mh: ReadingQuestion = {
  id: 'q5',
  type: 'matching_headings',
  prompt: 'Paragraph A heading',
  correctAnswer: 'iv',
  explanation: 'Heading iv matches paragraph theme.',
};

assert.strictEqual(gradeSingleQuestion(mh, 'iv').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(mh, 'IV').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(mh, 'v').isCorrect, false);
console.log('✓ Passed: Matching Headings Roman numeral grading.');

// 5. Completion with Word Limits & Substring Rejection
const sc: ReadingQuestion = {
  id: 'q6',
  type: 'sentence_completion',
  prompt: 'Water loss occurs primarily through _______.',
  correctAnswer: 'evaporation',
  wordLimit: 'NO MORE THAN ONE WORD',
  maxWords: 1,
  explanation: 'Text states loss via evaporation.',
};

assert.strictEqual(gradeSingleQuestion(sc, 'evaporation').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(sc, 'Evaporation').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(sc, 'EVAPORATION').isCorrect, true);
// Substring rejection: "rapid evaporation process" contains evaporation but is incorrect and violates limit
assert.strictEqual(gradeSingleQuestion(sc, 'rapid evaporation').isCorrect, false);
assert.strictEqual(gradeSingleQuestion(sc, 'evap').isCorrect, false);
console.log('✓ Passed: Sentence Completion with word limit and substring rejection.');

// 6. Alternative Accepted Answers & Optional Articles
const sa: ReadingQuestion = {
  id: 'q7',
  type: 'short_answer',
  prompt: 'What was the main environmental factor?',
  correctAnswer: 'rainfall / precipitation',
  wordLimit: 'NO MORE THAN TWO WORDS',
  maxWords: 2,
  explanation: 'Rainfall or precipitation is cited.',
};

assert.strictEqual(gradeSingleQuestion(sa, 'rainfall').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(sa, 'the rainfall').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(sa, 'precipitation').isCorrect, true);
assert.strictEqual(gradeSingleQuestion(sa, 'heavy snowfall').isCorrect, false);
console.log('✓ Passed: Alternative answers and optional article handling.');

// 7. Full Assignment Grading with Academic Band Output
const questions: ReadingQuestion[] = [
  mcq, msq, tfng, ynng, mh, sc, sa,
];

const answers: Record<string, string> = {
  q1: 'B',
  q2: 'A, C',
  q3: 'TRUE',
  q4: 'YES',
  q5: 'iv',
  q6: 'evaporation',
  q7: 'the rainfall',
};

const fullSummary = gradeAssignmentSubmission(questions, answers, 'academic');
assert.strictEqual(fullSummary.correctCount, 7);
assert.strictEqual(fullSummary.incorrectCount, 0);
assert.strictEqual(fullSummary.unansweredCount, 0);
assert.strictEqual(fullSummary.earnedScore, 7);
assert.strictEqual(fullSummary.percentage, 100);
console.log('✓ Passed: Full 100% correct assignment grading summary.');

// Test with 3 unanswered and 1 incorrect
const partialAnswers: Record<string, string> = {
  q1: 'B', // correct
  q2: 'A, D', // incorrect
  q3: 'TRUE', // correct
  q4: '', // unanswered
  q5: '', // unanswered
  q6: 'evaporation', // correct
  q7: '', // unanswered
};

const partialSummary = gradeAssignmentSubmission(questions, partialAnswers, 'academic');
assert.strictEqual(partialSummary.correctCount, 3);
assert.strictEqual(partialSummary.incorrectCount, 1);
assert.strictEqual(partialSummary.unansweredCount, 3);
assert.strictEqual(partialSummary.finalStatus, 'graded');
console.log('✓ Passed: Partial assignment grading counts and status.');

console.log('ALL ASSIGNMENT GRADER TESTS PASSED! 🎉');
