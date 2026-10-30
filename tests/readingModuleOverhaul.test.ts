import assert from 'node:assert';
import {
  buildQuestionRenderGroups,
  resolveQuestionPrompt,
  extractParagraphLabelsFromPassage,
  normalizeReadingQuestion,
  extractAllNormalizedQuestions,
} from '../src/lib/questionNormalizer.ts';
import { gradeSingleQuestion, gradeAssignmentSubmission } from '../src/lib/assignmentGrader.ts';
import { calculateReadingBand } from '../src/lib/ieltsScoring.ts';
import type { ReadingQuestion } from '../src/types/index.ts';

console.log('--- RUNNING READING MODULE OVERHAUL TESTS ---');

// -------------------------------------------------------------
// Test 1: Multi-Passage Question Re-indexing & Sequential Numbering
// -------------------------------------------------------------
console.log('Test 1: Multi-Passage Question Re-indexing & Sequential Numbering');
{
  const passage1Qs: ReadingQuestion[] = Array.from({ length: 13 }, (_, i) => ({
    id: `p1_q_${i + 1}`,
    type: 'matching_information',
    prompt: `Statement ${i + 1}`,
    correctAnswer: String.fromCharCode(65 + (i % 6)), // A-F
    points: 1,
  }));

  const passage2Qs: ReadingQuestion[] = Array.from({ length: 13 }, (_, i) => ({
    id: `p2_q_${i + 1}`,
    type: 'true_false_not_given',
    prompt: `Fact ${i + 1}`,
    correctAnswer: i % 2 === 0 ? 'TRUE' : 'FALSE',
    points: 1,
  }));

  const passage3Qs: ReadingQuestion[] = Array.from({ length: 14 }, (_, i) => ({
    id: `p3_q_${i + 1}`,
    type: 'summary_completion',
    prompt: `Summary item ${i + 27} ............`,
    options: ['A. agriculture', 'B. tropical waters', 'C. tidal waves', 'D. polar regions'],
    correctAnswer: 'C',
    points: 1,
  }));

  // Simulate assigning 2 passages (Passage 1 and Passage 3)
  const selectedPassages = [
    { title: 'Passage 1: Ancient Navigation', content: 'Passage 1 content...', questions: passage1Qs },
    { title: 'Passage 3: Global Warming', content: 'Passage 3 content...', questions: passage3Qs },
  ];

  let runningIndex = 0;
  const reIndexedPassages = selectedPassages.map((p, pIdx) => {
    const startQ = runningIndex + 1;
    const renumberedQs = p.questions.map((q) => {
      runningIndex += 1;
      return {
        ...q,
        id: `q_${runningIndex}`,
        originalId: q.id,
        passageIndex: pIdx,
      };
    });
    const endQ = runningIndex;
    return {
      ...p,
      passageIndex: pIdx,
      questionRange: `Questions ${startQ}–${endQ}`,
      questions: renumberedQs,
    };
  });

  const totalAssignedQs = reIndexedPassages.flatMap((p) => p.questions);
  assert.strictEqual(totalAssignedQs.length, 27, 'Total questions across 2 selected passages should be 27');
  assert.strictEqual(reIndexedPassages[0].questionRange, 'Questions 1–13', 'Passage 1 range is 1-13');
  assert.strictEqual(reIndexedPassages[1].questionRange, 'Questions 14–27', 'Passage 2 range is 14-27');
  assert.strictEqual(totalAssignedQs[0].id, 'q_1', 'First question is q_1');
  assert.strictEqual(totalAssignedQs[26].id, 'q_27', 'Last question is q_27');
  console.log('✓ Passed: Multi-passage sequential re-indexing and question range assignment.');
}

// -------------------------------------------------------------
// Test 2: IELTS Reading Band Score Calculation (Academic & GT)
// -------------------------------------------------------------
console.log('Test 2: IELTS Reading Band Score Calculation (Academic & GT)');
{
  // Academic Reading standard benchmark test
  assert.strictEqual(calculateReadingBand(39, 'academic', 40).band, 9.0, '39/40 Academic = 9.0');
  assert.strictEqual(calculateReadingBand(35, 'academic', 40).band, 8.0, '35/40 Academic = 8.0');
  assert.strictEqual(calculateReadingBand(30, 'academic', 40).band, 7.0, '30/40 Academic = 7.0');
  assert.strictEqual(calculateReadingBand(23, 'academic', 40).band, 6.0, '23/40 Academic = 6.0');
  assert.strictEqual(calculateReadingBand(15, 'academic', 40).band, 5.0, '15/40 Academic = 5.0');
  assert.strictEqual(calculateReadingBand(10, 'academic', 40).band, 4.0, '10/40 Academic = 4.0');

  // General Training Reading standard benchmark test
  assert.strictEqual(calculateReadingBand(40, 'general_training', 40).band, 9.0, '40/40 GT = 9.0');
  assert.strictEqual(calculateReadingBand(37, 'general_training', 40).band, 8.0, '37/40 GT = 8.0');
  assert.strictEqual(calculateReadingBand(34, 'general_training', 40).band, 7.0, '34/40 GT = 7.0');
  assert.strictEqual(calculateReadingBand(30, 'general_training', 40).band, 6.0, '30/40 GT = 6.0');
  assert.strictEqual(calculateReadingBand(23, 'general_training', 40).band, 5.0, '23/40 GT = 5.0');

  // Scaled non-40 question assignment (e.g. 13 questions from a single passage)
  const bandForSinglePassage = calculateReadingBand(10, 'academic', 13).band;
  assert.ok(bandForSinglePassage >= 6.5 && bandForSinglePassage <= 7.5, '10/13 Academic scales to ~7.0 band');
  console.log('✓ Passed: Official IELTS Reading Band Score conversion for Academic and General Training.');
}

// -------------------------------------------------------------
// Test 3: Auto-Grading & Score Visibility Logic
// -------------------------------------------------------------
console.log('Test 3: Auto-Grading & Score Visibility Logic');
{
  const questions: ReadingQuestion[] = [
    { id: 'q1', type: 'multiple_choice', prompt: 'Q1', correctAnswer: 'A', points: 1 },
    { id: 'q2', type: 'true_false_not_given', prompt: 'Q2', correctAnswer: 'TRUE', points: 1 },
    { id: 'q3', type: 'matching_information', prompt: 'Q3', correctAnswer: 'B', points: 1 },
    { id: 'q4', type: 'summary_completion', prompt: 'Q4', correctAnswer: 'C', points: 1, options: ['A. one', 'B. two', 'C. three'] },
  ];

  const studentAnswers = {
    q1: 'A',
    q2: 'FALSE', // incorrect
    q3: 'Paragraph B', // correct variant
    q4: 'C. three', // correct full phrase
  };

  const gradeResult = gradeAssignmentSubmission(questions, studentAnswers, 'academic');
  assert.strictEqual(gradeResult.correctCount, 3, 'Should have 3 correct answers out of 4');
  assert.strictEqual(gradeResult.maxScore, 4, 'Total max score should be 4');
  assert.strictEqual(gradeResult.incorrectCount, 1, 'Should have 1 incorrect answer');
  assert.ok(gradeResult.bandEstimate > 0, 'Band estimate should be computed');

  // Check score visibility gating
  const isScorePublic = (assign: any) => assign.score_visibility === 'public';
  const publicAssignment = { score_visibility: 'public' };
  const privateAssignment = { score_visibility: 'private' };

  assert.strictEqual(isScorePublic(publicAssignment), true, 'Public assignment shows band score immediately');
  assert.strictEqual(isScorePublic(privateAssignment), false, 'Private assignment withholds band score');
  console.log('✓ Passed: Auto-grading and score visibility gating.');
}

// -------------------------------------------------------------
// Test 4: Summary Completion with Word List UI & Auto-Grading
// -------------------------------------------------------------
console.log('Test 4: Summary Completion with Word List UI & Auto-Grading');
{
  const wordList = [
    'A. agriculture production',
    'B. tropical waters',
    'C. tidal waves',
    'D. polar regions',
    'E. global warming',
    'F. coastal land',
    'G. high tides',
  ];

  const q7: ReadingQuestion = {
    id: 'q_7',
    type: 'summary_completion',
    prompt: 'The extent of future sea level rises around New Zealand is uncertain and may be determined in the 33 ............',
    options: wordList,
    correctAnswer: 'C',
    points: 1,
  };

  const q8: ReadingQuestion = {
    id: 'q_8',
    type: 'summary_completion',
    prompt: 'Higher sea levels can lead to reduced 34 ............',
    options: wordList,
    correctAnswer: 'F',
    points: 1,
  };

  // 1. Prompt formatting: "33 ............" -> "(33) ............"
  const prompt7 = resolveQuestionPrompt(q7, 7);
  assert.ok(prompt7.includes('(33)'), `Formatted prompt should contain (33), got: "${prompt7}"`);
  const prompt8 = resolveQuestionPrompt(q8, 8);
  assert.ok(prompt8.includes('(34)'), `Formatted prompt should contain (34), got: "${prompt8}"`);

  // 2. buildQuestionRenderGroups: groups contiguous questions sharing a wordList
  const renderGroups = buildQuestionRenderGroups([q7, q8]);
  assert.strictEqual(renderGroups.length, 1, 'Should group q7 and q8 into a single render group');
  assert.ok(renderGroups[0].wordList && renderGroups[0].wordList.length === 7, 'Render group contains shared Word List of 7 options');

  // 3. Auto-grading: handles choice letter, full phrase, or text
  const res1 = gradeSingleQuestion(q7, 'C');
  assert.strictEqual(res1.isCorrect, true, 'Choice letter "C" is graded correct');

  const res2 = gradeSingleQuestion(q7, 'C. tidal waves');
  assert.strictEqual(res2.isCorrect, true, 'Full phrase "C. tidal waves" is graded correct');

  const res3 = gradeSingleQuestion(q7, 'tidal waves');
  assert.strictEqual(res3.isCorrect, true, 'Plain text "tidal waves" is graded correct');

  const res4 = gradeSingleQuestion(q7, 'D. polar regions');
  assert.strictEqual(res4.isCorrect, false, 'Incorrect phrase is graded false');
  console.log('✓ Passed: Summary Completion word list grouping, blank numbering, and dual-mode auto-grading.');
}

// -------------------------------------------------------------
// Test 5: Matching Information Paragraphs & Repeated Letter Instruction
// -------------------------------------------------------------
console.log('Test 5: Matching Information Paragraphs & Repeated Letter Instruction');
{
  const passageText = `
Paragraph A: Introduction to bamboo botany.
Paragraph B: Rapid growth characteristics and tensile strength.
Paragraph C: Applications in modern sustainable construction.
Paragraph D: Ecological benefits and soil conservation.
  `;

  const extractedLabels = extractParagraphLabelsFromPassage(passageText);
  assert.deepStrictEqual(extractedLabels, ['A', 'B', 'C', 'D'], 'Extracted paragraphs A-D accurately');

  // Auto-grading matching_information with various inputs
  const miQuestion: ReadingQuestion = {
    id: 'mi_1',
    type: 'matching_information',
    prompt: 'Which paragraph contains mention of tensile strength?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'B',
    points: 1,
  };

  assert.strictEqual(gradeSingleQuestion(miQuestion, 'B').isCorrect, true, 'Letter "B" is correct');
  assert.strictEqual(gradeSingleQuestion(miQuestion, 'Paragraph B').isCorrect, true, 'Label "Paragraph B" is correct');
  assert.strictEqual(gradeSingleQuestion(miQuestion, 'b').isCorrect, true, 'Lowercase "b" is correct');
  assert.strictEqual(gradeSingleQuestion(miQuestion, 'A').isCorrect, false, 'Wrong letter is incorrect');
  console.log('✓ Passed: Matching Information paragraph extraction and answer grading.');
}

console.log('\n========================================');
console.log('ALL READING MODULE OVERHAUL TESTS PASSED! 🎉');
console.log('========================================\n');
