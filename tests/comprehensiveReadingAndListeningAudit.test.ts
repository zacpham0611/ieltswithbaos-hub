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

console.log('✅ ALL COMPREHENSIVE READING & LISTENING AUDIT TESTS PASSED WITH 100% SUCCESS!');
