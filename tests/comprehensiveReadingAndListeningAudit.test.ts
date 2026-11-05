import fs from 'fs';
import path from 'path';
import { parseListeningDocument, extractListeningAnswerKey } from '../src/lib/listeningExtractor.ts';
import { parseDocumentStructure } from '../src/lib/documentExtractor.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('--- Starting Comprehensive Reading & Listening Audit Tests ---');

// 1. Listening Document Audit on Fixtures
const fixtures = [
  { name: 'ielts_test_1_listening_en.txt', expectedQ: 40 },
  { name: 'ielts_test_1_listening_vi.txt', expectedQ: 40 },
  { name: 'ielts_test_2_listening_vi.txt', expectedQ: 40 },
];

for (const fix of fixtures) {
  const filePath = path.join('tests', 'fixtures', fix.name);
  assert(fs.existsSync(filePath), `Fixture file exists: ${fix.name}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = parseListeningDocument(content, fix.name);

  const totalQs = result.parts.reduce((s, p) => s + p.questions.length, 0);
  console.log(`[Listening] ${fix.name}: total=${totalQs}, parts=${result.parts.length}`);
  assert(totalQs === fix.expectedQ, `${fix.name} must extract exactly ${fix.expectedQ} questions, got ${totalQs}`);
  assert(result.parts.length === 4, `${fix.name} must have exactly 4 parts, got ${result.parts.length}`);

  for (let pNum = 1; pNum <= 4; pNum++) {
    const part = result.parts.find((p) => p.partNumber === pNum);
    assert(Boolean(part), `${fix.name} Part ${pNum} exists`);
    assert(part!.questions.length === 10, `${fix.name} Part ${pNum} must have exactly 10 questions, got ${part!.questions.length}`);
  }

  // Verify questions 1..40 all present without duplicates
  const allNums = result.parts.flatMap((p) => p.questions.map((q) => q.questionNumber || q.number)).filter(Boolean);
  assert(allNums.length === 40, `${fix.name} has 40 question numbers`);
  for (let n = 1; n <= 40; n++) {
    assert(allNums.includes(n), `${fix.name} contains question number ${n}`);
  }
}

// 2. Specific Question Types verification on Vietnamese Fixtures
// Test 1 VI:
const t1Content = fs.readFileSync(path.join('tests', 'fixtures', 'ielts_test_1_listening_vi.txt'), 'utf-8');
const t1Result = parseListeningDocument(t1Content, 'Test 1 VI');
const p1Groups = t1Result.parts[0].questionGroups;
assert(p1Groups.length >= 2, 'Test 1 VI Part 1 has at least 2 groups (Table Completion + Note/Sentence Completion)');
const p2Groups = t1Result.parts[1].questionGroups;
assert(p2Groups.some((g) => g.type === 'multiple_choice'), 'Test 1 VI Part 2 contains multiple choice (Q11-14)');
assert(p2Groups.some((g) => g.type === 'multiple_select'), 'Test 1 VI Part 2 contains multiple select (Q18-20)');
const p3Groups = t1Result.parts[2].questionGroups;
assert(p3Groups.some((g) => g.type === 'matching'), 'Test 1 VI Part 3 contains matching (Q25-30)');

// Test 2 VI:
const t2Content = fs.readFileSync(path.join('tests', 'fixtures', 'ielts_test_2_listening_vi.txt'), 'utf-8');
const t2Result = parseListeningDocument(t2Content, 'Test 2 VI');
const t2P3Groups = t2Result.parts[2].questionGroups;
const msGroups = t2P3Groups.filter((g) => g.type === 'multiple_select');
assert(msGroups.length === 2, `Test 2 VI Part 3 contains two multi-select groups (27-28 and 29-30), got ${msGroups.length}`);
const t2P4Groups = t2Result.parts[3].questionGroups;
assert(t2P4Groups.some((g) => g.type === 'matching'), 'Test 2 VI Part 4 contains matching (Q37-40)');

// 3. Answer Key Verification (no key leakage into Section 4, accurate mapping)
const t2P4Qs = t2Result.parts[3].questions;
const q37 = t2P4Qs.find((q) => q.questionNumber === 37);
const q40 = t2P4Qs.find((q) => q.questionNumber === 40);
assert(q37?.correctAnswer === 'E', `Q37 correct answer mapped as E, got ${q37?.correctAnswer}`);
assert(q40?.correctAnswer === 'B', `Q40 correct answer mapped as B, got ${q40?.correctAnswer}`);

// 4. Reading Document Extraction Audit (Matching Features & Sentence Endings)
const sampleReadingText = `
Reading Passage 1
You should spend about 20 minutes on Questions 1-13.

The History of Renewable Energy

Questions 1-4
Look at the following statements (Questions 1-4) and the list of researchers below.
Match each statement with the correct researcher, A-D.
Write the correct letter, A-D, in boxes 1-4 on your answer sheet.

List of Researchers
A Dr. Maria Santos
B Prof. Alan Turing
C Dr. Elena Rostova
D Prof. James Watt

1 Proposed the early concept of automated calculation
2 Invented improvements to the steam condenser
3 Measured geothermal gradient in southern Europe
4 Analyzed tidal energy dispersion models

Questions 5-8
Complete each sentence with the correct ending, A-E, below.
Write the correct letter, A-E, in boxes 5-8 on your answer sheet.

List of Sentence Endings
A has experienced rapid industrial adoption since 2010.
B was initially constrained by transmission losses.
C relies heavily on silicon supply chain resilience.
D requires continuous grid frequency stabilization.
E provides constant baseline generation without emissions.

5 Early solar photovoltaic deployment
6 Modern wind farm integration
7 Commercial deep geothermal systems
8 Large-scale battery storage facilities
`;

const docStruct = parseDocumentStructure(sampleReadingText, 'Renewable Energy Test');
assert(docStruct.candidateTests.length === 1, `Extracted 1 passage, got ${docStruct.candidateTests.length}`);
const p1 = docStruct.candidateTests[0];
assert(p1.questionGroups.length === 2, `Expected 2 question groups, got ${p1.questionGroups.length}`);

// Group 1: Matching Features
const g1 = p1.questionGroups[0];
assert(g1.questionType === 'matching_features', `Group 1 must be matching_features, got ${g1.questionType}`);
assert(g1.questions.every((q) => q.type === 'matching_features'), 'All Q1-4 questions have type matching_features');
assert(g1.optionsBox !== undefined && g1.optionsBox.length === 4, `Group 1 optionsBox contains 4 researchers, got ${g1.optionsBox?.length}`);
assert(g1.questions[0].options?.length === 4, 'Q1 options contains 4 researchers');

// Group 2: Matching Sentence Endings
const g2 = p1.questionGroups[1];
assert(g2.questionType === 'matching_sentence_endings', `Group 2 must be matching_sentence_endings, got ${g2.questionType}`);
assert(g2.questions.every((q) => q.type === 'matching_sentence_endings'), 'All Q5-8 questions have type matching_sentence_endings');
assert(g2.optionsBox !== undefined && g2.optionsBox.length === 5, `Group 2 optionsBox contains 5 sentence endings, got ${g2.optionsBox?.length}`);
assert(g2.questions[0].options?.length === 5, 'Q5 options contains 5 sentence endings');

// 5. Primary Test Fixture: IELTS Test 2 Reading (40 Questions across 3 Passages)
const test2ReadingPath = path.join('tests', 'fixtures', 'ielts_test_2_reading.txt');
if (fs.existsSync(test2ReadingPath)) {
  const test2Content = fs.readFileSync(test2ReadingPath, 'utf-8');
  const t2ReadingDoc = parseDocumentStructure(test2Content, 'IELTS_Test2_Reading.txt');
  assert(t2ReadingDoc.candidateTests.length === 3, `Expected 3 passages, got ${t2ReadingDoc.candidateTests.length}`);

  const p1 = t2ReadingDoc.candidateTests[0];
  const p2 = t2ReadingDoc.candidateTests[1];
  const p3 = t2ReadingDoc.candidateTests[2];

  assert(p1.questions.length === 13, `Passage 1 has 13 questions, got ${p1.questions.length}`);
  assert(p2.questions.length === 13, `Passage 2 has 13 questions, got ${p2.questions.length}`);
  assert(p3.questions.length === 14, `Passage 3 has 14 questions, got ${p3.questions.length}`);

  // Q1-6: True/False/Not Given
  const tfGroup = p1.questionGroups[0];
  assert(tfGroup.questionType === 'true_false_not_given', `Q1-6 type must be true_false_not_given, got ${tfGroup.questionType}`);
  assert(tfGroup.questions[0].correctAnswer === 'FALSE', `Q1 answer FALSE, got ${tfGroup.questions[0].correctAnswer}`);
  assert(tfGroup.questions[1].correctAnswer === 'TRUE', `Q2 answer TRUE, got ${tfGroup.questions[1].correctAnswer}`);
  assert(tfGroup.questions[3].correctAnswer === 'NOT GIVEN', `Q4 answer NOT GIVEN, got ${tfGroup.questions[3].correctAnswer}`);

  // Q7-13: Note Completion with structured groupText
  const noteGroup = p1.questionGroups[1];
  assert(noteGroup.questionType === 'note_completion', `Q7-13 type must be note_completion, got ${noteGroup.questionType}`);
  assert(Boolean(noteGroup.groupText && noteGroup.groupText.includes('[7]')), 'Note completion contains [7] placeholder');
  assert(Boolean(noteGroup.groupText && noteGroup.groupText.includes('The ships')), 'Note completion preserves subheading The ships');
  assert(noteGroup.questions[0].correctAnswer === 'sails', `Q7 answer sails, got ${noteGroup.questions[0].correctAnswer}`);
  assert(noteGroup.questions[6].correctAnswer === 'money', `Q13 answer money, got ${noteGroup.questions[6].correctAnswer}`);

  // Q14-18: Summary Completion with structured groupText
  const summaryGroup = p2.questionGroups[0];
  assert(summaryGroup.questionType === 'summary_completion', `Q14-18 type must be summary_completion, got ${summaryGroup.questionType}`);
  assert(Boolean(summaryGroup.groupText && summaryGroup.groupText.includes('[14]')), 'Summary completion contains [14] placeholder');
  assert(summaryGroup.questions[0].correctAnswer === 'visual memory', `Q14 answer visual memory, got ${summaryGroup.questions[0].correctAnswer}`);
  assert(summaryGroup.questions[4].correctAnswer === '(laysan) albatross', `Q18 answer (laysan) albatross, got ${summaryGroup.questions[4].correctAnswer}`);

  // Q19-22: Matching Information
  const matchInfoGroup = p2.questionGroups[1];
  assert(matchInfoGroup.questionType === 'matching_information', `Q19-22 type must be matching_information, got ${matchInfoGroup.questionType}`);
  assert(matchInfoGroup.questions[0].correctAnswer === 'C', `Q19 answer C, got ${matchInfoGroup.questions[0].correctAnswer}`);
  assert(matchInfoGroup.questions[3].correctAnswer === 'G', `Q22 answer G, got ${matchInfoGroup.questions[3].correctAnswer}`);

  // Q23-26: Matching Features
  const matchFeatGroup = p2.questionGroups[2];
  assert(matchFeatGroup.questionType === 'matching_features', `Q23-26 type must be matching_features, got ${matchFeatGroup.questionType}`);
  assert(matchFeatGroup.optionsBox !== undefined && matchFeatGroup.optionsBox.length === 7, `Q23-26 has 7 features, got ${matchFeatGroup.optionsBox?.length}`);
  assert(matchFeatGroup.questions[1].correctAnswer === 'F', `Q24 answer F (not FALSE), got ${matchFeatGroup.questions[1].correctAnswer}`);
  assert(!matchFeatGroup.questions[3].prompt.includes('|'), `Q26 prompt clean without pipe tables: "${matchFeatGroup.questions[3].prompt}"`);

  // Q27-31: Yes/No/Not Given
  const ynGroup = p3.questionGroups[0];
  assert(ynGroup.questionType === 'yes_no_not_given', `Q27-31 type must be yes_no_not_given, got ${ynGroup.questionType}`);
  assert(ynGroup.questions[0].correctAnswer === 'YES', `Q27 answer YES, got ${ynGroup.questions[0].correctAnswer}`);
  assert(ynGroup.questions[1].correctAnswer === 'NO', `Q28 answer NO, got ${ynGroup.questions[1].correctAnswer}`);
  assert(ynGroup.questions[4].correctAnswer === 'NOT GIVEN', `Q31 answer NOT GIVEN, got ${ynGroup.questions[4].correctAnswer}`);

  // Q32-35: Matching Sentence Endings
  const seGroup = p3.questionGroups[1];
  assert(seGroup.questionType === 'matching_sentence_endings', `Q32-35 type must be matching_sentence_endings, got ${seGroup.questionType}`);
  assert(seGroup.optionsBox !== undefined && seGroup.optionsBox.length === 8, `Q32-35 has 8 endings, got ${seGroup.optionsBox?.length}`);
  assert(seGroup.questions[0].correctAnswer === 'F', `Q32 answer F (not FALSE), got ${seGroup.questions[0].correctAnswer}`);
  assert(seGroup.questions[1].correctAnswer === 'G', `Q33 answer G, got ${seGroup.questions[1].correctAnswer}`);
  assert(!seGroup.questions[3].prompt.includes('|'), `Q35 prompt clean without pipe tables: "${seGroup.questions[3].prompt}"`);

  // Q36-40: Multiple Choice
  const mcGroup = p3.questionGroups[2];
  assert(mcGroup.questionType === 'multiple_choice', `Q36-40 type must be multiple_choice, got ${mcGroup.questionType}`);
  assert(mcGroup.questions.length === 5, `Q36-40 has 5 questions, got ${mcGroup.questions.length}`);
  assert(mcGroup.questions[0].correctAnswer === 'B', `Q36 answer B, got ${mcGroup.questions[0].correctAnswer}`);
  assert(mcGroup.questions[4].correctAnswer === 'B', `Q40 answer B, got ${mcGroup.questions[4].correctAnswer}`);

  // Verify none of the 40 questions have table pipe '|' in their answer key
  const all40Qs = [...p1.questions, ...p2.questions, ...p3.questions];
  assert(all40Qs.length === 40, `Total questions extracted = 40, got ${all40Qs.length}`);
  all40Qs.forEach((q, idx) => {
    assert(!q.correctAnswer?.includes('|'), `Q${idx + 1} correctAnswer '${q.correctAnswer}' does not contain pipe`);
  });
  console.log('[Reading] IELTS Test 2 Reading: All 40 questions and types verified successfully!');
}

console.log('✅ ALL COMPREHENSIVE READING & LISTENING AUDIT TESTS PASSED WITH 100% SUCCESS!');
