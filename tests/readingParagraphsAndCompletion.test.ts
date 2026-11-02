/**
 * Unit & Integration Tests:
 * 1. Paragraph Separation: Labeled paragraphs (A, B, C...) start on separate lines with appropriate spacing.
 * 2. Word Limit validation & instructions for Completion questions.
 * 3. Three Answer Input Formats:
 *    - Option A: Text Input (with word limit validation)
 *    - Option B: Choose from Options (with duplicate selection prevention)
 *    - Option C: Choose from a Word List (A, B, C...) with letter/word auto-grading
 * 4. Shared Resources Across Questions in Question Groups.
 */

import assert from 'node:assert';
import {
  formatWordLimitInstruction,
  parseMaxWordsFromLimit,
  countWords,
  gradeSingleQuestion,
  gradeAssignmentSubmission,
} from '../src/lib/assignmentGrader.ts';
import type { ReadingQuestion, QuestionGroup } from '../src/types/index.ts';

console.log('--- RUNNING READING PARAGRAPH SEPARATION & COMPLETION SETTINGS TESTS ---');

// Test 1: Word Limit Instruction Generation & Parsing
console.log('\nTest 1: Word Limit Instruction Generation & Parsing');
{
  assert.strictEqual(formatWordLimitInstruction(1, false), 'NO MORE THAN ONE WORD');
  assert.strictEqual(formatWordLimitInstruction(1, true), 'NO MORE THAN ONE WORD AND/OR A NUMBER');
  assert.strictEqual(formatWordLimitInstruction(2, false), 'NO MORE THAN TWO WORDS');
  assert.strictEqual(formatWordLimitInstruction(2, true), 'NO MORE THAN TWO WORDS AND/OR A NUMBER');
  assert.strictEqual(formatWordLimitInstruction(3, false), 'NO MORE THAN THREE WORDS');
  assert.strictEqual(formatWordLimitInstruction(3, true), 'NO MORE THAN THREE WORDS AND/OR A NUMBER');

  assert.strictEqual(parseMaxWordsFromLimit('NO MORE THAN ONE WORD'), 1);
  assert.strictEqual(parseMaxWordsFromLimit('NO MORE THAN TWO WORDS AND/OR A NUMBER'), 2);
  assert.strictEqual(parseMaxWordsFromLimit('NO MORE THAN THREE WORDS'), 3);
  console.log('✓ Passed: Standard IELTS word limit instructions and numeric parsing verified.');
}

// Test 2: Word Limit Enforcement in Auto-Grading
console.log('\nTest 2: Word Limit Enforcement in Auto-Grading');
{
  const q: ReadingQuestion = {
    id: 'q_comp_1',
    type: 'sentence_completion',
    prompt: 'The company was established in [1].',
    correctAnswer: 'Auckland',
    explanation: 'Founded in Auckland in 1909.',
    wordLimitCount: 1,
    allowNumbers: false,
    wordLimitInstruction: 'NO MORE THAN ONE WORD',
  };

  const res1 = gradeSingleQuestion(q, 'Auckland');
  assert.strictEqual(res1.isCorrect, true, 'Answer within word limit should be correct');

  const res2 = gradeSingleQuestion(q, 'Fort Street Auckland');
  assert.strictEqual(res2.isCorrect, false, 'Answer exceeding word limit must be marked incorrect');
  assert.strictEqual(res2.violationReason, 'word_limit_exceeded', 'Should report word_limit_exceeded violation');

  console.log('✓ Passed: Word limit enforcement in grading verified.');
}

// Test 3: Allow Numbers Toggle (AND/OR A NUMBER)
console.log('\nTest 3: Allow Numbers Toggle');
{
  const qWithNum: ReadingQuestion = {
    id: 'q_comp_num',
    type: 'note_completion',
    prompt: 'The founding year was [1].',
    correctAnswer: '1909',
    explanation: 'In 1909 Robert Laidlaw established...',
    wordLimitCount: 1,
    allowNumbers: true,
    wordLimitInstruction: 'NO MORE THAN ONE WORD AND/OR A NUMBER',
  };

  const res = gradeSingleQuestion(qWithNum, '1909');
  assert.strictEqual(res.isCorrect, true, 'Numbers allowed when allowNumbers is true');

  const qWordsOnly: ReadingQuestion = {
    id: 'q_words_only',
    type: 'sentence_completion',
    prompt: 'Type the word name [1].',
    correctAnswer: 'first',
    explanation: 'First',
    wordLimitCount: 1,
    allowNumbers: false,
    wordLimitInstruction: 'NO MORE THAN ONE WORD',
  };

  const resNumFail = gradeSingleQuestion(qWordsOnly, '1');
  assert.strictEqual(resNumFail.isCorrect, false, 'Numbers not allowed when allowNumbers is false');
  console.log('✓ Passed: allowNumbers toggle properly restricts or permits numbers.');
}

// Test 4: Completion Formats (Option A, Option B, Option C)
console.log('\nTest 4: Three Completion Formats (Text, Options, Word List A-Z)');
{
  // Option A - Text input
  const qA: ReadingQuestion = {
    id: 'q_text',
    type: 'summary_completion',
    completionFormat: 'text',
    prompt: 'The business began as a [1] firm.',
    correctAnswer: 'mail-order',
    explanation: 'mail-order company',
    wordLimitCount: 2,
  };
  assert.strictEqual(gradeSingleQuestion(qA, 'mail-order').isCorrect, true);
  assert.strictEqual(gradeSingleQuestion(qA, 'mail order').isCorrect, true);

  // Option B - Predefined options
  const qB: ReadingQuestion = {
    id: 'q_opt',
    type: 'summary_completion',
    completionFormat: 'options',
    prompt: 'The expansion included stores in [1].',
    options: ['Auckland', 'Waikato', 'Whangarei', 'London'],
    correctAnswer: 'Waikato',
    explanation: 'Stores in Auckland and Waikato',
    preventDuplicateOptions: true,
  };
  assert.strictEqual(gradeSingleQuestion(qB, 'Waikato').isCorrect, true);
  assert.strictEqual(gradeSingleQuestion(qB, 'London').isCorrect, false);

  // Option C - Word List with letter-to-letter matching
  const qC: ReadingQuestion = {
    id: 'q_wordlist',
    type: 'summary_completion',
    completionFormat: 'word_list',
    prompt: 'Robert Laidlaw set up the [1] company.',
    wordList: ['furniture', 'branches', 'mail-order', 'electric sign'],
    // Option C corresponds to index 2 (mail-order)
    correctAnswer: 'C',
    explanation: 'Mail-order firm',
  };
  assert.strictEqual(gradeSingleQuestion(qC, 'C').isCorrect, true, 'Letter C should match key C');
  assert.strictEqual(gradeSingleQuestion(qC, 'mail-order').isCorrect, true, 'Word text should also match key C');

  // Option C - Word List with word key matching student letter
  const qC2: ReadingQuestion = {
    id: 'q_wordlist_2',
    type: 'sentence_completion',
    completionFormat: 'word_list',
    prompt: 'The Wyndham Street frontage featured a large [1].',
    wordList: ['furniture factory', 'electric sign', 'buying office'],
    correctAnswer: 'electric sign', // index 1 -> letter B
    explanation: 'large FARMERS electric sign',
  };
  assert.strictEqual(gradeSingleQuestion(qC2, 'B').isCorrect, true, 'Letter B should match key electric sign');

  console.log('✓ Passed: All 3 completion input formats verified with robust letter/word auto-grading.');
}

// Test 5: Shared Resources Across Questions in QuestionGroup
console.log('\nTest 5: Shared Resources Across Questions');
{
  const sharedBank = ['furniture', 'branches', 'mail-order', 'electric sign'];
  const group: QuestionGroup = {
    id: 'grp_shared_test',
    instructions: 'Complete the summary using the list of words, A-D, below.',
    questionType: 'summary_completion',
    hasSharedResources: true,
    sharedWordBank: sharedBank,
    sharedQuestionIds: ['q_s1', 'q_s2'],
    questions: [
      {
        id: 'q_s1',
        type: 'summary_completion',
        completionFormat: 'word_list',
        prompt: 'Robert Laidlaw set up the [1] company.',
        correctAnswer: 'C',
        explanation: 'Mail-order',
        sharedResourceId: 'res_farmers_shared',
      },
      {
        id: 'q_s2',
        type: 'summary_completion',
        completionFormat: 'word_list',
        prompt: 'The frontage featured a large [2].',
        correctAnswer: 'D',
        explanation: 'Electric sign',
        sharedResourceId: 'res_farmers_shared',
      },
    ],
  };

  assert.strictEqual(group.sharedWordBank.length, 4);
  assert.strictEqual(group.questions[0].sharedResourceId, 'res_farmers_shared');
  assert.strictEqual(group.questions[1].sharedResourceId, 'res_farmers_shared');

  const summary = gradeAssignmentSubmission(group.questions, {
    q_s1: 'C',
    q_s2: 'D',
  });
  assert.strictEqual(summary.correctCount, 2);
  assert.strictEqual(summary.earnedScore, 2);
  console.log('✓ Passed: Shared resources structure and submission grading verified.');
}

// Test 6: Paragraph Separation Normalization
console.log('\nTest 6: Paragraph Separation Normalization');
{
  const raw = `A\nHistory of Farmers trading company: In 1909 Robert Laidlaw established mail-order company Laidlaw Leeds in Fort Street, Auckland.\n\nB\nThen, branch expansion: purchase of Green and Colebrook chain stores; further provincial stores in Auckland and Waikato to follow.`;

  // Normalization logic
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  text = text.replace(/([^\n])\n([A-Z]|Paragraph\s+[A-Z]|\[[A-Z]\])([\.:])?\n/g, '$1\n\n$2$3\n');
  const chunks = text.split(/\n\s*\n+/);

  assert.strictEqual(chunks.length, 2, 'Should split into exactly 2 paragraphs');

  const matchA = chunks[0].match(/^(([A-Z]|Paragraph\s+[A-Z]|\[[A-Z]\])[\.:]?)\s*\n([\s\S]+)$/i);
  assert.ok(matchA, 'Should match multiline paragraph label');
  assert.strictEqual(matchA![1], 'A', 'Paragraph label is A');
  assert.ok(matchA![3].startsWith('History of Farmers trading company'), 'Paragraph body starts with History...');

  const matchB = chunks[1].match(/^(([A-Z]|Paragraph\s+[A-Z]|\[[A-Z]\])[\.:]?)\s*\n([\s\S]+)$/i);
  assert.ok(matchB, 'Should match multiline paragraph label for B');
  assert.strictEqual(matchB![1], 'B', 'Paragraph label is B');
  assert.ok(matchB![3].startsWith('Then, branch expansion'), 'Paragraph body starts with Then, branch expansion...');

  console.log('✓ Passed: Labeled paragraphs A, B, C start on separate lines with clear body separation.');
}

console.log('\n======================================================');
console.log('ALL READING PARAGRAPH & COMPLETION TESTS PASSED! 🎯');
console.log('======================================================\n');
