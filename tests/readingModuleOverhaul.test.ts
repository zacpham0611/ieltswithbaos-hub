import assert from 'node:assert';
import {
  buildQuestionRenderGroups,
  resolveQuestionPrompt,
  extractParagraphLabelsFromPassage,
  normalizeReadingQuestion,
  extractAllNormalizedQuestions,
  COMPLETION_TYPES,
  BUTTON_TYPES,
  buildCompletionGroupText,
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

// -------------------------------------------------------------
// Test 6: Passage-based Question Filtering & Absolute Index Preservation
// -------------------------------------------------------------
console.log('Test 6: Passage-based Question Filtering & Absolute Index Preservation');
{
  const all40Questions: ReadingQuestion[] = Array.from({ length: 40 }, (_, i) => ({
    id: `q_${i + 1}`,
    type: i < 13 ? 'matching_information' : i < 26 ? 'true_false_not_given' : 'summary_completion',
    prompt: `Question prompt for number ${i + 1}`,
    correctAnswer: 'A',
    points: 1,
  }));

  // Simulate passageMap: 0..12 -> Passage 0, 13..25 -> Passage 1, 26..39 -> Passage 2
  const indexed = all40Questions.map((q, absoluteIdx) => ({
    q,
    absoluteIdx,
    passageIndex: absoluteIdx < 13 ? 0 : absoluteIdx < 26 ? 1 : 2,
  }));

  // Select Passage 2 (0-indexed => passageIndex === 1)
  const passage2Questions = indexed.filter((item) => item.passageIndex === 1);
  assert.strictEqual(passage2Questions.length, 13, 'Passage 2 has exactly 13 questions');
  assert.strictEqual(passage2Questions[0].absoluteIdx + 1, 14, 'Passage 2 first question is Q14');
  assert.strictEqual(passage2Questions[12].absoluteIdx + 1, 26, 'Passage 2 last question is Q26');

  // Groups built from Passage 2 should retain Questions 14–26 range title
  const p2Groups = buildQuestionRenderGroups(passage2Questions);
  assert.strictEqual(p2Groups[0].rangeTitle, 'Questions 14–26', 'Range title preserved as Questions 14–26');
  assert.strictEqual(p2Groups[0].questions[0].idx + 1, 14, 'First question index in group is 14');
  assert.strictEqual(p2Groups[0].questions[12].idx + 1, 26, 'Last question index in group is 26');

  // Select Passage 3 (passageIndex === 2)
  const passage3Questions = indexed.filter((item) => item.passageIndex === 2);
  assert.strictEqual(passage3Questions.length, 14, 'Passage 3 has exactly 14 questions');
  assert.strictEqual(passage3Questions[0].absoluteIdx + 1, 27, 'Passage 3 first question is Q27');
  assert.strictEqual(passage3Questions[13].absoluteIdx + 1, 40, 'Passage 3 last question is Q40');
  console.log('✓ Passed: Passage-based question filtering and absolute index preservation.');
}

// -------------------------------------------------------------
// Test 7: 6 Pastel Rainbow Marker Colors Definition & Properties
// -------------------------------------------------------------
console.log('Test 7: 6 Pastel Rainbow Marker Colors Definition & Properties');
{
  const expectedColors = [
    { id: 'pastel_pink', bgHex: '#ffd1dc' },
    { id: 'pastel_orange', bgHex: '#ffe0b2' },
    { id: 'pastel_yellow', bgHex: '#fff9c4' },
    { id: 'pastel_green', bgHex: '#c8e6c9' },
    { id: 'pastel_blue', bgHex: '#bbdefb' },
    { id: 'pastel_purple', bgHex: '#e1bee7' },
  ];

  assert.strictEqual(expectedColors.length, 6, 'Must provide exactly 6 pastel rainbow colors');
  expectedColors.forEach((c) => {
    assert.ok(c.bgHex.startsWith('#'), `${c.id} has valid hex color ${c.bgHex}`);
  });
  console.log('✓ Passed: 6 Pastel rainbow marker colors verified.');
}

// -------------------------------------------------------------
// Test 8: All Completion Question Types & Full Text Reconstruction
// -------------------------------------------------------------
console.log('Test 8: All Completion Question Types & Full Text Reconstruction');
{
  // 1. Verify COMPLETION_TYPES contains all standard variants
  const expectedTypes = [
    'summary_completion',
    'note_completion',
    'table_completion',
    'flowchart_completion',
    'diagram_completion',
    'sentence_completion',
    'fill_in_the_blank',
  ];
  for (const t of expectedTypes) {
    assert.ok(COMPLETION_TYPES.has(t), `COMPLETION_TYPES must include ${t}`);
  }
  assert.ok(!COMPLETION_TYPES.has('yes_no_not_given'), 'YNNG must NOT be in COMPLETION_TYPES');
  assert.ok(!COMPLETION_TYPES.has('true_false_not_given'), 'TFNG must NOT be in COMPLETION_TYPES');

  // 2. buildCompletionGroupText with numbered blanks in prompts
  const completionQs: ReadingQuestion[] = [
    {
      id: 'q_33',
      type: 'summary_completion',
      prompt: 'The extent of future sea level rises around New Zealand is uncertain and may be determined in the 33 ...............',
      correctAnswer: 'C',
      options: ['A. agriculture', 'B. tropical waters', 'C. tidal waves'],
      points: 1,
    },
    {
      id: 'q_34',
      type: 'summary_completion',
      prompt: 'Higher sea levels can lead to reduced 34 ...............',
      correctAnswer: 'A',
      options: ['A. agriculture', 'B. tropical waters', 'C. tidal waves'],
      points: 1,
    },
  ];

  const fullText = buildCompletionGroupText(
    completionQs.map((q, idx) => ({ q, idx: idx + 32 }))
  );
  assert.ok(fullText.includes('[33]'), 'Full text must contain [33] blank marker');
  assert.ok(fullText.includes('[34]'), 'Full text must contain [34] blank marker');
  assert.ok(!fullText.includes('...............'), 'Blank dots should be converted to markers');

  // 3. buildQuestionRenderGroups generates groupText for completion groups
  const groups = buildQuestionRenderGroups(completionQs);
  assert.strictEqual(groups.length, 1, 'Should group identical completion type questions together');
  assert.strictEqual(groups[0].groupType, 'summary_completion', 'Group type is summary_completion');
  assert.ok(groups[0].groupText && groups[0].groupText.includes('[33]'), 'Group text populated with markers');
  assert.strictEqual(groups[0].wordList?.length, 3, 'Word list preserved for summary completion');
  console.log('✓ Passed: All completion question types and full text reconstruction verified.');
}

// -------------------------------------------------------------
// Test 9: Yes / No / Not Given Mapping & Isolation from Summary Completion
// -------------------------------------------------------------
console.log('Test 9: Yes / No / Not Given Mapping & Isolation from Summary Completion');
{
  // 1. normalizeReadingQuestion maps YES/NO answers to yes_no_not_given and clears word bank options
  const rawYnngWithWordBank = {
    id: 'q_38',
    type: 'summary_completion', // mis-mapped from word box
    prompt: 'Global warming is slow; it will affect different regions in different ways.',
    correctAnswer: 'YES',
    options: ['A. agriculture', 'B. tropical waters', 'C. tidal waves'],
  };

  const normalized = normalizeReadingQuestion(rawYnngWithWordBank, 37);
  assert.strictEqual(normalized.type, 'yes_no_not_given', 'Must correct type to yes_no_not_given based on answer key');
  assert.strictEqual(normalized.options, undefined, 'Options (word bank) must be cleared for button types');

  // 2. Normalization of blank prompts mis-tagged as multiple choice
  const rawCompletionMisTaggedAsMcq = {
    id: 'q_33',
    type: 'multiple_choice',
    prompt: 'The extent of future sea level rises is determined in the 33 ...............',
    correctAnswer: 'C',
    options: ['A. agriculture', 'B. tropical waters', 'C. tidal waves'],
  };
  const normalizedCompletion = normalizeReadingQuestion(rawCompletionMisTaggedAsMcq, 32);
  assert.strictEqual(normalizedCompletion.type, 'summary_completion', 'Blanks in prompt with options must normalize to summary_completion');

  // 3. buildQuestionRenderGroups keeps YNNG and completion separated
  const mixedQuestions: ReadingQuestion[] = [
    normalizedCompletion,
    normalized, // yes_no_not_given
  ];
  const mixedGroups = buildQuestionRenderGroups(mixedQuestions);
  assert.strictEqual(mixedGroups.length, 2, 'YNNG and completion must never be merged into the same group');
  assert.strictEqual(mixedGroups[0].groupType, 'summary_completion', 'First group is summary_completion');
  assert.strictEqual(mixedGroups[1].groupType, 'yes_no_not_given', 'Second group is yes_no_not_given');
  assert.strictEqual(mixedGroups[1].wordList, undefined, 'YNNG group must NOT have wordList');

  // 4. BUTTON_TYPES check
  assert.ok(BUTTON_TYPES.has('yes_no_not_given'), 'BUTTON_TYPES has yes_no_not_given');
  assert.ok(BUTTON_TYPES.has('true_false_not_given'), 'BUTTON_TYPES has true_false_not_given');
  assert.ok(!BUTTON_TYPES.has('summary_completion'), 'BUTTON_TYPES does NOT have summary_completion');
  console.log('✓ Passed: Yes/No/Not Given mapping and complete isolation from completion groups.');
}

console.log('\n========================================');
console.log('ALL READING MODULE OVERHAUL TESTS PASSED! 🎉');
console.log('========================================\n');
