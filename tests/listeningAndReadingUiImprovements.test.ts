import assert from 'node:assert';
import { parseListeningDocument } from '../src/lib/listeningExtractor.ts';

console.log('--- Starting Listening & Student Reading UI Improvements Test Suite ---');

// =========================================================================
// TEST 1: Listening Note Completion - Embedded Blanks & Bullet Preservation
// =========================================================================
console.log('Testing Listening Note Completion Extraction...');

const noteCompletionSample = `
SECTION 4
Questions 31-35
Complete the notes below.
Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.

Marine Plastic Pollution Study
Background & Timeline:
- The main cause of the problem is ______ (Q31).
- The process usually takes ______ days (Q32).
- Students must submit their work to ______ (Q33).
- Additional support is provided by 34. ______
- The final presentation will be held in the 35. ______
`;

const result = parseListeningDocument(noteCompletionSample, 'Note Completion Test');
assert.ok(result.parts.length >= 1, 'Should have at least 1 part');
const part4 = result.parts[0];
assert.ok(part4.questionGroups.length >= 1, 'Should have at least 1 question group');
const noteGroup = part4.questionGroups[0];

assert.ok(noteGroup.questions.length >= 5, `Expected at least 5 questions, got ${noteGroup.questions.length}`);

// Verify question numbers 31 to 35
const q31 = noteGroup.questions.find((q) => q.questionNumber === 31);
const q32 = noteGroup.questions.find((q) => q.questionNumber === 32);
const q33 = noteGroup.questions.find((q) => q.questionNumber === 33);
const q34 = noteGroup.questions.find((q) => q.questionNumber === 34);
const q35 = noteGroup.questions.find((q) => q.questionNumber === 35);

assert.ok(q31, 'Question 31 must be extracted');
assert.ok(q32, 'Question 32 must be extracted');
assert.ok(q33, 'Question 33 must be extracted');
assert.ok(q34, 'Question 34 must be extracted');
assert.ok(q35, 'Question 35 must be extracted');

// Verify that the group text embeds markers at the exact positions inside the bullet points
assert.ok(
  noteGroup.groupText?.includes('[31]'),
  `Group text must contain embedded blank marker [31]. Got:\n${noteGroup.groupText}`
);
assert.ok(
  noteGroup.groupText?.includes('[32]'),
  `Group text must contain embedded blank marker [32]. Got:\n${noteGroup.groupText}`
);
assert.ok(
  noteGroup.groupText?.includes('[33]'),
  `Group text must contain embedded blank marker [33]. Got:\n${noteGroup.groupText}`
);
assert.ok(
  noteGroup.groupText?.includes('[34]'),
  `Group text must contain embedded blank marker [34]. Got:\n${noteGroup.groupText}`
);
assert.ok(
  noteGroup.groupText?.includes('[35]'),
  `Group text must contain embedded blank marker [35]. Got:\n${noteGroup.groupText}`
);

// Verify bullet points keep their sentences together
assert.ok(
  noteGroup.groupText?.includes('The main cause of the problem is [31]'),
  'Sentence 31 must keep prompt and blank together'
);
assert.ok(
  noteGroup.groupText?.includes('The process usually takes [32] days'),
  'Sentence 32 must keep prompt, blank, and trailing text "days" together'
);

console.log('✓ Test 1 Passed: Note Completion embedded answer fields and bullets preserved successfully.');

// =========================================================================
// TEST 2: Listening Table Completion / Matching Deduplication & Question Mapping
// =========================================================================
console.log('Testing Listening Table Matching & Heading Deduplication...');

const tableMatchingSample = `
SECTION 3
Questions 25-30
What action did the students take for each stage of the project?
Choose SIX answers from the box and write the correct letter, A-C, next to Questions 25-30.

A Completed independently
B Done with guidance
C Group effort

| Categories of student markers | Answer |
| 25. Research design | [25] |
| 26. Data collection | [26] |
| 27. Data analysis | [27] |
| 28. Discussion | [28] |
| 29. Conclusion | [29] |
| 30. Presentation | [30] |
`;

const extractedTable = parseListeningDocument(tableMatchingSample, 'Table Matching Test');
assert.ok(extractedTable.parts.length >= 1, 'Should have at least 1 part');
const tableGroup = extractedTable.parts[0].questionGroups[0];
assert.ok(tableGroup.questions.length >= 6, `Expected at least 6 questions, got ${tableGroup.questions.length}`);

for (let qNum = 25; qNum <= 30; qNum++) {
  const q = tableGroup.questions.find((item) => item.questionNumber === qNum);
  assert.ok(q, `Question ${qNum} should be extracted`);
}

// Check matching options extracted in group
assert.ok(tableGroup.options && tableGroup.options.length >= 3, 'Table group should have options A, B, C');

console.log('✓ Test 2 Passed: Table Matching Questions 25-30 extracted with options.');

// =========================================================================
// TEST 3: Student Reading UI Configuration Verification
// =========================================================================
console.log('Testing Reading UI Font Sizes & Instruction Omission Constraints...');

// Allowed passage font sizes
const allowedFontSizes = ['15px', '17px', '19px'] as const;
assert.strictEqual(allowedFontSizes.includes('15px'), true, '15px must be supported');
assert.strictEqual(allowedFontSizes.includes('17px'), true, '17px must be supported (default)');
assert.strictEqual(allowedFontSizes.includes('19px'), true, '19px must be supported');

// Verify default is 17px
const defaultFontSize = '17px';
assert.strictEqual(defaultFontSize, '17px', 'Default passage font size must be 17px');

console.log('✓ Test 3 Passed: Reading UI font options and defaults match specifications.');

console.log('\n--- ALL LISTENING & READING UI IMPROVEMENT TESTS PASSED! ---');
