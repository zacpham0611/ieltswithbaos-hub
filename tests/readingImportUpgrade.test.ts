import fs from 'fs';
import path from 'path';
import assert from 'assert';
import {
  parseDocumentStructure,
  analyzePassageGrouping,
  inferUnlabelledQuestionType,
  parseAnswerTable,
  parseConsolidatedAnswerText,
  formatPassageParagraphs,
} from '../src/lib/documentExtractor.ts';

console.log('====================================================');
console.log('▶ MASTER PROMPT: ADDITIVE UPGRADE FOR READING IMPORT');
console.log('====================================================\n');

// -------------------------------------------------------------
// Test 1: Real-World Test with "IELTS Test 1 – Reading"
// -------------------------------------------------------------
console.log('--- Test 1: Real-World File "IELTS Test 1 – Reading" ---');
{
  const rawText = fs.readFileSync('C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e66bef89-3824-44a3-9b01-1da8f8609a20\\scratch\\ielts_test_1_raw.txt', 'utf8');
  const html = fs.readFileSync('C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e66bef89-3824-44a3-9b01-1da8f8609a20\\scratch\\ielts_test_1_html.html', 'utf8');

  const result = parseDocumentStructure(rawText, 'IELTS Test 1 – Reading', html);

  // Requirement: exactly 3 passages detected, no preamble, no answer-key candidate
  assert.strictEqual(result.candidateTests.length, 3, 'Must detect exactly 3 passages (no preamble, no answer table section)');

  const [p1, p2, p3] = result.candidateTests;
  assert.ok(p1.title.includes('silk'), `Passage 1 title should be silk industry, got: ${p1.title}`);
  assert.ok(p2.title.includes('mammoth'), `Passage 2 title should be baby mammoth, got: ${p2.title}`);
  assert.ok(p3.title.includes('musical expert'), `Passage 3 title should be musical expert, got: ${p3.title}`);

  assert.strictEqual(p1.questions.length, 13, 'Passage 1 must have 13 questions');
  assert.strictEqual(p2.questions.length, 13, 'Passage 2 must have 13 questions');
  assert.strictEqual(p3.questions.length, 14, 'Passage 3 must have 14 questions');
  assert.strictEqual(result.questions.length, 40, 'Total questions across all passages must equal 40');

  // Verify all 40 answer keys are accurately mapped from the consolidated Answer Key table
  const expectedAnswers: Record<string, string> = {
    '1': 'white', '2': 'paper', '3': 'taxes', '4': 'gold', '5': 'foreign', '6': 'mummy', '7': 'caves',
    '8': 'TRUE', '9': 'NOT GIVEN', '10': 'FALSE', '11': 'FALSE', '12': 'TRUE', '13': 'FALSE',
    '14': 'D', '15': 'B', '16': 'E', '17': 'A', '18': 'C',
    '19': 'C', '20': 'E', '21': 'D', '22': 'A', '23': 'E',
    '24': 'vegetation', '25': 'human hunting', '26': 'North American',
    '27': 'C', '28': 'C', '29': 'A', '30': 'A',
    '31': 'NOT GIVEN', '32': 'YES', '33': 'NOT GIVEN', '34': 'NO', '35': 'NO', '36': 'YES',
    '37': 'E', '38': 'D', '39': 'A', '40': 'G'
  };

  assert.strictEqual(Object.keys(result.detectedAnswerKey).length, 40, 'Consolidated answer key must extract all 40 answers');
  for (const [qNum, expectedAns] of Object.entries(expectedAnswers)) {
    assert.strictEqual(result.detectedAnswerKey[qNum], expectedAns, `Question ${qNum} answer mismatch`);
  }

  // Question type verifications
  // Passage 1: Note Completion (Q1-7), TFNG (Q8-13)
  for (let i = 0; i < 7; i++) {
    assert.strictEqual(p1.questions[i].type, 'note_completion', `P1 Q${i + 1} should be note_completion`);
    assert.strictEqual(p1.questions[i].correctAnswer, expectedAnswers[String(i + 1)]);
  }
  for (let i = 7; i < 13; i++) {
    assert.strictEqual(p1.questions[i].type, 'true_false_not_given', `P1 Q${i + 1} should be true_false_not_given`);
    assert.strictEqual(p1.questions[i].correctAnswer, expectedAnswers[String(i + 1)]);
  }

  // Passage 2: Matching Information (Q14-18), Matching Features (Q19-23), Sentence Completion (Q24-26)
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(p2.questions[i].type, 'matching_information', `P2 Q${i + 14} should be matching_information`);
    assert.strictEqual(p2.questions[i].correctAnswer, expectedAnswers[String(i + 14)]);
  }
  for (let i = 5; i < 10; i++) {
    assert.strictEqual(p2.questions[i].type, 'matching_features', `P2 Q${i + 14} should be matching_features`);
    assert.strictEqual(p2.questions[i].correctAnswer, expectedAnswers[String(i + 14)]);
    assert.strictEqual(p2.questions[i].options?.length, 7, 'Matching features must include 7 options (A-G)');
  }
  for (let i = 10; i < 13; i++) {
    assert.strictEqual(p2.questions[i].type, 'sentence_completion', `P2 Q${i + 14} should be sentence_completion`);
    assert.strictEqual(p2.questions[i].correctAnswer, expectedAnswers[String(i + 14)]);
  }

  // Passage 3: MCQ (Q27-30), YNNG (Q31-36), Summary Completion (Q37-40)
  for (let i = 0; i < 4; i++) {
    assert.strictEqual(p3.questions[i].type, 'multiple_choice', `P3 Q${i + 27} should be multiple_choice`);
    assert.strictEqual(p3.questions[i].correctAnswer, expectedAnswers[String(i + 27)]);
    assert.strictEqual(p3.questions[i].options?.length, 4, 'MCQ must have 4 options (A-D)');
  }
  for (let i = 4; i < 10; i++) {
    assert.strictEqual(p3.questions[i].type, 'yes_no_not_given', `P3 Q${i + 27} should be yes_no_not_given`);
    assert.strictEqual(p3.questions[i].correctAnswer, expectedAnswers[String(i + 27)]);
  }
  for (let i = 10; i < 14; i++) {
    assert.strictEqual(p3.questions[i].type, 'summary_completion', `P3 Q${i + 27} should be summary_completion`);
    assert.strictEqual(p3.questions[i].correctAnswer, expectedAnswers[String(i + 27)]);
    assert.strictEqual(p3.questions[i].options?.length, 10, 'Summary completion must have 10 word bank options (A-J)');
  }

  console.log('✓ Passed: "IELTS Test 1 – Reading" produces exactly 3 passages, all 40 questions typed accurately, all 40 answer keys mapped.');
}

// -------------------------------------------------------------
// Test 2: Unlabelled Question Type Inference
// -------------------------------------------------------------
console.log('\n--- Test 2: Unlabelled Question Type Recognition ---');
{
  // Note Completion: headings and bullets with blanks
  const noteType = inferUnlabelledQuestionType('• emperor wore 1 ………… silk indoors', 'Chinese silk\nEarly uses\nClothing');
  assert.strictEqual(noteType, 'note_completion');

  // Form Completion: field name with colon
  const formType = inferUnlabelledQuestionType('Name: ……………', 'Complete the registration form below');
  assert.strictEqual(formType, 'form_completion');

  // Sentence Completion: complete grammatical sentence with single blank
  const sentType = inferUnlabelledQuestionType('Some researchers say that a marked rise in temperature caused 24 ............ to disappear.', 'Complete the sentences below.');
  assert.strictEqual(sentType, 'sentence_completion');

  // Summary Completion with word options
  const summaryType = inferUnlabelledQuestionType('The young Mozart received a lot of 37 ………… from his father.', 'Complete the summary below.', ['A. popular', 'B. artistic']);
  assert.strictEqual(summaryType, 'summary_completion');

  // Matching Headings
  const headingsType = inferUnlabelledQuestionType('Paragraph A', 'Choose the correct heading for each paragraph from the list of headings below.', undefined, ['iv']);
  assert.strictEqual(headingsType, 'matching_headings');

  // Matching Features
  const featuresType = inferUnlabelledQuestionType('The indications are that mammoths died as a result of climate change.', 'Look at the following statements and the list of people below. Match each statement with the correct person, A–G.');
  assert.strictEqual(featuresType, 'matching_features');

  // TFNG vs YNNG
  const tfngType = inferUnlabelledQuestionType('Their first sight of silk created fear.', 'Do the following statements agree with the information given in Reading Passage 1?', undefined, ['TRUE']);
  assert.strictEqual(tfngType, 'true_false_not_given');

  const ynngType = inferUnlabelledQuestionType('Different areas of expertise seem to have different rules.', 'Do the following statements agree with the claims of the writer?', undefined, ['YES']);
  assert.strictEqual(ynngType, 'yes_no_not_given');

  console.log('✓ Passed: Unlabelled formats accurately distinguished across completion, matching, and affirmation types.');
}

// -------------------------------------------------------------
// Test 3: Passage Sequence Validation and Flexible Grouping
// -------------------------------------------------------------
console.log('\n--- Test 3: Passage Sequence Validation and Grouping ---');
{
  const mockCandidates = [
    { id: 'c1', title: 'Reading Passage 1: History of Silk', passageText: 'Text 1', instructions: '', questions: [], detectedAnswerKey: {}, hasAnswerKeys: true, questionCount: 13, recognizedTypes: [], warnings: [] },
    { id: 'c2', title: 'Reading Passage 2: Baby Mammoth', passageText: 'Text 2', instructions: '', questions: [], detectedAnswerKey: {}, hasAnswerKeys: true, questionCount: 13, recognizedTypes: [], warnings: [] },
    { id: 'c3', title: 'Reading Passage 3: Musical Expert', passageText: 'Text 3', instructions: '', questions: [], detectedAnswerKey: {}, hasAnswerKeys: true, questionCount: 14, recognizedTypes: [], warnings: [] },
  ];

  const analysis = analyzePassageGrouping(mockCandidates as any);
  assert.strictEqual(analysis.groups.length, 1);
  assert.strictEqual(analysis.groups[0].isValidSequence, true);
  assert.strictEqual(analysis.groups[0].status, 'complete_3_passages');
  assert.deepStrictEqual(analysis.groups[0].candidateIds, ['c1', 'c2', 'c3']);

  // Test multi-test grouping (6 passages -> 2 tests)
  const mockCandidates6 = [
    ...mockCandidates,
    { id: 'c4', title: 'Reading Passage 4: Space Travel', passageText: 'Text 4', instructions: '', questions: [], detectedAnswerKey: {}, hasAnswerKeys: true, questionCount: 13, recognizedTypes: [], warnings: [] },
    { id: 'c5', title: 'Reading Passage 5: Deep Oceans', passageText: 'Text 5', instructions: '', questions: [], detectedAnswerKey: {}, hasAnswerKeys: true, questionCount: 13, recognizedTypes: [], warnings: [] },
    { id: 'c6', title: 'Reading Passage 6: Artificial Brain', passageText: 'Text 6', instructions: '', questions: [], detectedAnswerKey: {}, hasAnswerKeys: true, questionCount: 14, recognizedTypes: [], warnings: [] },
  ];
  const analysis6 = analyzePassageGrouping(mockCandidates6 as any);
  assert.strictEqual(analysis6.groups.length, 2);
  assert.strictEqual(analysis6.groups[0].status, 'complete_3_passages');
  assert.strictEqual(analysis6.groups[1].status, 'complete_3_passages');

  // Test incomplete sequence
  const mockIncomplete = mockCandidates.slice(0, 2);
  const analysisIncomplete = analyzePassageGrouping(mockIncomplete as any);
  assert.strictEqual(analysisIncomplete.groups[0].status, 'partial');
  assert.strictEqual(analysisIncomplete.groups[0].isValidSequence, false);

  console.log('✓ Passed: Sequence analysis correctly validates 3-passage structures, multi-test documents, and flags incomplete sets.');
}

// -------------------------------------------------------------
// Test 4: Preservation of Per-Passage Localized Answer Keys
// -------------------------------------------------------------
console.log('\n--- Test 4: Preservation of Per-Passage Localized Answer Keys ---');
{
  const perPassageDoc = `
READING PASSAGE 1
You should spend about 20 minutes on Questions 1–5.
The Microplastics Crisis
Plastic debris has contaminated oceans worldwide.

Questions 1–3
Complete the sentences below.
1 Scientists discovered high concentrations of ............ in the Arctic.
2 Filter-feeding whales ingest toxic ............ from plastic waste.
3 Industrial manufacturing produces micro-sized ............ used in cosmetics.

Reading Passage 1 Answer Key:
1 microplastics
2 chemicals
3 beads

READING PASSAGE 2
You should spend about 20 minutes on Questions 4–6.
The Future of Geothermal Energy
Deep thermal vents produce renewable clean power.

Questions 4–6
Do the following statements agree with the information?
4 Geothermal energy requires constant rainfall.
5 Deep wells reach steam reservoirs.
6 Iceland generates all its heat geothermally.

Reading Passage 2 Answer Key:
4 FALSE
5 TRUE
6 TRUE
  `;

  const res = parseDocumentStructure(perPassageDoc, 'Per-Passage Test');
  assert.strictEqual(res.candidateTests.length, 2, 'Should detect 2 passages');
  assert.strictEqual(res.candidateTests[0].detectedAnswerKey['1'], 'microplastics');
  assert.strictEqual(res.candidateTests[0].detectedAnswerKey['2'], 'chemicals');
  assert.strictEqual(res.candidateTests[0].detectedAnswerKey['3'], 'beads');
  assert.strictEqual(res.candidateTests[1].detectedAnswerKey['4'], 'FALSE');
  assert.strictEqual(res.candidateTests[1].detectedAnswerKey['5'], 'TRUE');
  assert.strictEqual(res.candidateTests[1].detectedAnswerKey['6'], 'TRUE');

  console.log('✓ Passed: Original per-passage localized answer key mechanism remains completely intact.');
}

console.log('\n====================================================');
console.log('🎉 ALL READING IMPORT ADDITIVE UPGRADE TESTS PASSED!');
console.log('====================================================');
