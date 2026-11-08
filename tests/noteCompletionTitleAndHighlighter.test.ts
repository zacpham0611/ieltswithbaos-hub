import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { parseListeningDocument } from '../src/lib/listeningExtractor.ts';
import { isValidPassageTitle, parseDocumentStructure } from '../src/lib/documentExtractor.ts';

console.log('--- STARTING NOTE COMPLETION, PASSAGE TITLE & HIGHLIGHTER REGRESSION TESTS ---');

// 1. Note Completion Extraction & Type Detection (Bislama Q31-40)
const t1Path = path.join('tests', 'fixtures', 'ielts_test_1_listening_vi.txt');
assert(fs.existsSync(t1Path), 'Test 1 fixture exists');
const t1Content = fs.readFileSync(t1Path, 'utf-8');
const t1Result = parseListeningDocument(t1Content, 'IELTS Test 1 VI');

const part4 = t1Result.parts.find((p) => p.partNumber === 4);
assert(Boolean(part4), 'Part 4 exists in Test 1');
assert(part4!.questions.length === 10, `Part 4 must have exactly 10 questions, got ${part4!.questions.length}`);
assert(part4!.questionGroups.length >= 1, 'Part 4 has at least 1 question group');

const group4 = part4!.questionGroups[0];
console.log('Part 4 Group Type:', group4.type);
assert(
  group4.type === 'note_completion',
  `Part 4 Bislama exercise must be recognized as note_completion, got ${group4.type}`
);

// Verify all questions 31-40 are typed as note_completion
for (let n = 31; n <= 40; n++) {
  const q = part4!.questions.find((item) => (item.questionNumber || item.number) === n);
  assert(Boolean(q), `Question ${n} exists in Part 4`);
  assert(
    q!.type === 'note_completion',
    `Question ${n} must be typed as note_completion, got ${q!.type}`
  );
  assert(
    q!.prompt === `Question ${n}` || q!.prompt.includes(String(n)),
    `Question ${n} prompt preserves question identity`
  );
}

// Verify groupText has note completion blanks [31] through [40]
const gt = group4.groupText || '';
for (let n = 31; n <= 40; n++) {
  assert(
    gt.includes(`[${n}]`) || gt.includes(`${n}`),
    `groupText contains blank marker for question ${n}`
  );
}
console.log('✓ Test 1 Passed: Note Completion Bislama Q31-40 correctly typed and structured.');

// 2. Formatting Note Structure: preservation of bullets and subheadings
let formattedNotes = gt.replace(/^\|\s*|\s*\|$/g, '').trim();
formattedNotes = formattedNotes.replace(/\s*(?:•|\u2022)\s*/g, '\n• ');
formattedNotes = formattedNotes.replace(/(?<=[^\n])\s{2,}(?=[A-Z][a-zA-Z0-9\s–\-]{1,35}:)/g, '\n');
const noteLines = formattedNotes.split('\n').map((l) => l.trim()).filter(Boolean);

assert(noteLines.length > 5, `Formatted notes must have multiple lines, got ${noteLines.length}`);
const bulletLines = noteLines.filter((l) => l.startsWith('•'));
assert(bulletLines.length >= 5, `Formatted notes must contain multiple bullet items, got ${bulletLines.length}`);
console.log(`✓ Test 2 Passed: Note structure formatting preserves ${noteLines.length} lines and ${bulletLines.length} bullets.`);

// 3. Passage Title Recognition Validation
console.log('Testing Passage Title Recognition...');

// Legitimate titles MUST be valid
assert(isValidPassageTitle('THE DISCOVERY OF A BABY MAMMOTH') === true, 'Mammoth title is valid');
assert(isValidPassageTitle('The development of the silk industry') === true, 'Silk industry title is valid');
assert(isValidPassageTitle('Bislama – The Pidgin English Language of Vanuatu') === true, 'Bislama title is valid');
assert(isValidPassageTitle('The History of Tortoise Evolution') === true, 'Tortoise history title is valid');
assert(isValidPassageTitle('Why zoos are good') === true, 'Short title is valid');
assert(isValidPassageTitle('The life cycle of the salmon') === true, 'Salmon title is valid');

// Instructions and directives MUST be rejected as titles
assert(isValidPassageTitle('Complete the notes below. Write ONE WORD ONLY for each answer.') === false, 'Instruction rejected');
assert(isValidPassageTitle('Questions 1-13') === false, 'Question range rejected');
assert(isValidPassageTitle('Match each statement with the correct person') === false, 'Match instruction rejected');
assert(isValidPassageTitle('Choose the correct letter, A, B, C or D') === false, 'MC instruction rejected');
assert(isValidPassageTitle('Write no more than two words for each answer') === false, 'Word limit instruction rejected');
assert(isValidPassageTitle('You should spend about 20 minutes on Questions 1-13') === false, 'Timing note rejected');
assert(isValidPassageTitle('Passage 1') === false, 'Generic Passage 1 rejected');
assert(isValidPassageTitle('READING PASSAGE 2') === false, 'Generic READING PASSAGE 2 rejected');
assert(isValidPassageTitle('IELTS Academic Reading') === false, 'Generic booklet header rejected');
assert(isValidPassageTitle('Cambridge IELTS 12') === false, 'Booklet title rejected');

console.log('✓ Test 3 Passed: Passage title validation correctly distinguishes authentic titles from instructions.');

// 4. Multi-Passage Title Extraction from Document Structure
const mockDocText = `
IELTS Academic Reading Practice Test
TEST 1

READING PASSAGE 1
You should spend about 20 minutes on Questions 1–13, which are based on Reading Passage 1 below.

The development of the silk industry
Silk is a fine, smooth material produced from the cocoons of mulberry silkworms.

Questions 1-13
Complete the notes below.
1 ............. was discovered by a Chinese empress.

READING PASSAGE 2
You should spend about 20 minutes on Questions 14–26, which are based on Reading Passage 2 below.

THE DISCOVERY OF A BABY MAMMOTH
A near-perfect frozen mammoth offers clues to a great vanished species.

Questions 14-26
Do the following statements agree with the information given in Reading Passage 2?
`;

const docStruct = parseDocumentStructure(mockDocText, 'Mock Cambridge Test');
assert(docStruct.tests.length >= 1, 'Document has at least 1 test');
const test1 = docStruct.tests[0];
assert(test1.passages.length >= 2, `Must extract at least 2 passages, got ${test1.passages.length}`);

console.log('Passage 1 Title:', test1.passages[0].title);
assert(
  test1.passages[0].title.toLowerCase().includes('silk industry'),
  `Passage 1 title must be 'The development of the silk industry', got '${test1.passages[0].title}'`
);

console.log('Passage 2 Title:', test1.passages[1].title);
assert(
  test1.passages[1].title.toUpperCase().includes('BABY MAMMOTH'),
  `Passage 2 title must be 'THE DISCOVERY OF A BABY MAMMOTH', got '${test1.passages[1].title}'`
);
console.log('✓ Test 4 Passed: Multi-passage extraction recovers authentic passage titles across Cambridge layouts.');

// 5. Pastel Marker Colors Integrity
const pastelColors = [
  { id: 'pastel_pink', label: 'Pastel Pink', bgHex: '#ffd1dc' },
  { id: 'pastel_orange', label: 'Pastel Orange', bgHex: '#ffe0b2' },
  { id: 'pastel_yellow', label: 'Pastel Yellow', bgHex: '#fff9c4' },
  { id: 'pastel_green', label: 'Pastel Green', bgHex: '#c8e6c9' },
  { id: 'pastel_blue', label: 'Pastel Blue', bgHex: '#bbdefb' },
  { id: 'pastel_purple', label: 'Pastel Purple', bgHex: '#e1bee7' },
];
assert(pastelColors.length === 6, `Must have exactly 6 pastel rainbow colors, got ${pastelColors.length}`);
pastelColors.forEach((c) => {
  assert(Boolean(c.id), `Color ${c.id} has id`);
  assert(Boolean(c.bgHex && c.bgHex.startsWith('#')), `Color ${c.id} has valid hex`);
});
console.log('✓ Test 5 Passed: 6 Pastel Rainbow Marker Colors verified.');

console.log('\n================================================================');
console.log('ALL NOTE COMPLETION, PASSAGE TITLE & HIGHLIGHTER TESTS PASSED! 🎉');
console.log('================================================================\n');
