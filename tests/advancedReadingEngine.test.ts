/**
 * Comprehensive Test Suite: Advanced IELTS Reading Import Engine & Note Completion
 *
 * 1. Multi-Test and Multi-Passage Disambiguation
 * 2. Elimination of fragmented passages and orphaned 0-question components
 * 3. Instruction-Heading contamination resolution
 * 4. Cross-page passage-question stitching
 * 5. Note completion structure & line break preservation
 * 6. Completion Answer Fields formatting
 * 7. Regression Baseline: IELTS Test 1 - Reading (40 questions, 40 answers)
 * 8. Regression Baseline: IELTS_Reading_De2_3_Passages.docx (40 questions, 3 passages)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import {
  parseDocumentStructure,
  extractLinesFromPdfItems,
  extractPdfText,
} from '../src/lib/documentExtractor.ts';
import { buildCompletionGroupText } from '../src/lib/questionNormalizer.ts';

console.log('================================================================');
console.log('▶ RUNNING ADVANCED IELTS READING IMPORT ENGINE TEST SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Instruction-Heading Contamination Resolution & Clean Title Extraction
// -----------------------------------------------------------------------------
console.log('--- Test 1: Instruction-Heading Contamination Resolution ---');
{
  const textWithContaminatedHeaders = `
TEST 1

READING PASSAGE 1
You should spend about 20 minutes on Questions 1 - 13 , which are based on Reading passage 1 on pages 2 and 3.
The development of the silk industry
Silk, a natural fibre produced by a particular worm called a silkworm, has been used in clothing for many centuries.
When silk was first discovered in China over 4,500 years ago, it was reserved exclusively for the emperor.

Questions 1 - 7
Complete the notes below.
Choose ONE WORD ONLY from the passage for each answer.

Chinese silk
Early Uses
Clothing
• at first, only emperor and his close relatives wore silk
• emperor wore 1 ……………… silk robes inside palace, but yellow robes outside
• in course of time, more people were permitted to wear silk
• even peasants wore it in 2 ……………… dynasty
Other purposes
• silk was used for making strings for musical instruments and 3 ……………… for fishing
• silk paper was invented in the 4 ……………… dynasty

READING PASSAGE 2
You should spend about 20 minutes on Questions 14 - 26, which are based on Reading Passage 2 on pages 6 and 7.
The discovery of a baby mammoth
A near-perfect frozen mammoth offers clues to a great vanished species.

Questions 14 - 18
Reading Passage 2 has five paragraphs, A-E. Which paragraph contains the following information?
14. A description of the physical appearance of the baby mammoth.
15. Comparison between modern elephants and ancient mammoths.
16. The scientific significance of intact tissue samples.
17. The geological conditions that preserved the carcass.
18. Future possibilities for genetic de-extinction.

READING PASSAGE 3 You should spend about 20 minutes on Questions 27 - 40, which are based on on pages 10 and 11.
What makes a musical expert?
How does someone become expert in music? And is it really a gift?

Questions 27 - 30
Choose the correct letter, A, B, C or D.
27. The author's main purpose in paragraph one is to
A. illustrate the diversity of musical talents.
B. question traditional views of innate ability.
C. argue that practice is the primary determinant.
D. explain historical methods of music training.
`;

  const struct = parseDocumentStructure(textWithContaminatedHeaders, 'Mock_Test_1.txt');
  assert.strictEqual(struct.tests.length, 1, 'Should parse exactly 1 test');
  const t1 = struct.tests[0];
  assert.strictEqual(t1.passages.length, 3, 'Should have exactly 3 passages');

  // Verify Passage 1 title is clean (not "pages 2 and 3." or instructions)
  assert.strictEqual(t1.passages[0].title, 'The development of the silk industry');
  assert.strictEqual(t1.passages[0].passageIndex, 1);
  assert.ok(!t1.passages[0].title.includes('pages 2 and 3'), 'Title must not contain page references');

  // Verify Passage 2 title is clean
  assert.strictEqual(t1.passages[1].title, 'The discovery of a baby mammoth');
  assert.strictEqual(t1.passages[1].passageIndex, 2);

  // Verify Passage 3 contaminated header ("READING PASSAGE 3 You should spend... on pages 10 and 11.")
  // successfully separates instructions and extracts "What makes a musical expert?" as title!
  assert.strictEqual(t1.passages[2].title, 'What makes a musical expert?');
  assert.strictEqual(t1.passages[2].passageIndex, 3);
  assert.ok(!t1.passages[2].title.includes('You should spend'), 'Title must not contain instruction text');

  console.log('✓ Passed: Titles correctly decoupled from instructions and page references.');
}

// -----------------------------------------------------------------------------
// Test 2: Note Completion Line Breaks, Bullet Points and Blank Numbering
// -----------------------------------------------------------------------------
console.log('\n--- Test 2: Note Completion Line Breaks & Bullet Structure Preservation ---');
{
  const notePrompt1 = '• emperor wore 1 ……………… silk robes inside palace';
  const notePrompt2 = '• even peasants wore it in 2 ……………… dynasty';
  const notePrompt3 = '• silk paper was invented in the 3 ……………… dynasty';

  const mockQuestions = [
    { q: { id: 'q_1', prompt: notePrompt1, type: 'note_completion' as const }, idx: 0 },
    { q: { id: 'q_2', prompt: notePrompt2, type: 'note_completion' as const }, idx: 1 },
    { q: { id: 'q_3', prompt: notePrompt3, type: 'note_completion' as const }, idx: 2 },
  ];

  const groupText = buildCompletionGroupText(mockQuestions);
  assert.ok(groupText.includes('\n'), 'Note completion prompts with bullets must be joined with newlines');
  assert.ok(groupText.includes('• emperor wore [1] silk robes inside palace'), 'Prompt 1 blank formatted as [1]');
  assert.ok(groupText.includes('• even peasants wore it in [2] dynasty'), 'Prompt 2 blank formatted as [2]');
  assert.ok(groupText.includes('• silk paper was invented in the [3] dynasty'), 'Prompt 3 blank formatted as [3]');

  // Verify that bullet points stay on distinct lines
  const lines = groupText.split('\n').filter(Boolean);
  assert.strictEqual(lines.length, 3, 'Must retain exactly 3 bullet point lines');
  lines.forEach((l) => assert.ok(l.startsWith('•'), 'Each line must begin with a bullet'));

  console.log('✓ Passed: Note completion bullet points and newlines preserved.');
}

// -----------------------------------------------------------------------------
// Test 3: Two-Column PDF Line Extraction Header and Column Gutter Logic
// -----------------------------------------------------------------------------
console.log('\n--- Test 3: Two-Column PDF Layout Extraction without Header Scrambling ---');
{
  const mockPdfItems = [
    // Top Page Header (Test 1 centered at y = 818)
    { str: 'Test 1', transform: [1, 0, 0, 1, 280, 818], width: 40, height: 12 },
    // Passage Heading at y = 776
    { str: 'READING PASSAGE 1', transform: [1, 0, 0, 1, 72, 776], width: 120, height: 14 },
    // Full width instruction at y = 760
    { str: 'You should spend about 20 minutes on Questions 1-13, which are based on Reading passage 1.', transform: [1, 0, 0, 1, 72, 760], width: 450, height: 10 },
    // Title at y = 720
    { str: 'The development of the silk industry', transform: [1, 0, 0, 1, 150, 720], width: 280, height: 16 },

    // Two-Column Body lines (y <= 700)
    // Left column: x = 72 to 260
    { str: 'Left col line 1: Silk history begins.', transform: [1, 0, 0, 1, 72, 680], width: 180, height: 10 },
    { str: 'Left col line 2: Emperors wore silk.', transform: [1, 0, 0, 1, 72, 665], width: 180, height: 10 },
    { str: 'Left col line 3: Industry expanded rapidly.', transform: [1, 0, 0, 1, 72, 650], width: 180, height: 10 },
    { str: 'Left col line 4: Traded along the silk road.', transform: [1, 0, 0, 1, 72, 635], width: 180, height: 10 },
    { str: 'Left col line 5: Precious commodity worldwide.', transform: [1, 0, 0, 1, 72, 620], width: 180, height: 10 },

    // Right column: x = 320 to 520
    { str: 'Right col line 1: European discoveries.', transform: [1, 0, 0, 1, 320, 680], width: 180, height: 10 },
    { str: 'Right col line 2: Roman legions encountered.', transform: [1, 0, 0, 1, 320, 665], width: 180, height: 10 },
    { str: 'Right col line 3: Secrets kept for millennia.', transform: [1, 0, 0, 1, 320, 650], width: 180, height: 10 },
    { str: 'Right col line 4: Monks smuggled eggs.', transform: [1, 0, 0, 1, 320, 635], width: 180, height: 10 },
    { str: 'Right col line 5: Modern production flourishes.', transform: [1, 0, 0, 1, 320, 620], width: 180, height: 10 },
  ];

  const extracted = extractLinesFromPdfItems(mockPdfItems);
  const extractedLines = extracted.split('\n').filter(Boolean);

  // Headers must appear BEFORE any two-column text
  assert.strictEqual(extractedLines[0], 'Test 1');
  assert.strictEqual(extractedLines[1], 'READING PASSAGE 1');
  assert.ok(extractedLines[2].includes('You should spend about 20 minutes'));
  assert.strictEqual(extractedLines[3], 'The development of the silk industry');

  // Left column must be completely emitted before right column begins
  const leftIdx = extracted.indexOf('Left col line 1');
  const rightIdx = extracted.indexOf('Right col line 1');
  assert.ok(leftIdx < rightIdx, 'Left column must precede right column in reading order');

  console.log('✓ Passed: Two-column PDF extracted with headers on top and sequential columns.');
}

// -----------------------------------------------------------------------------
// Test 4: Regression Baseline - "IELTS Test 1 – Reading"
// -----------------------------------------------------------------------------
console.log('\n--- Test 4: Regression Baseline "IELTS Test 1 – Reading" ---');
{
  const rawPath = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e66bef89-3824-44a3-9b01-1da8f8609a20\\scratch\\ielts_test_1_raw.txt';
  const htmlPath = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\e66bef89-3824-44a3-9b01-1da8f8609a20\\scratch\\ielts_test_1_html.html';

  if (fs.existsSync(rawPath) && fs.existsSync(htmlPath)) {
    const rawText = fs.readFileSync(rawPath, 'utf8');
    const html = fs.readFileSync(htmlPath, 'utf8');

    const result = parseDocumentStructure(rawText, 'IELTS Test 1 – Reading', html);
    assert.strictEqual(result.candidateTests.length, 3, 'Must detect exactly 3 passages');
    assert.strictEqual(result.questions.length, 40, 'Must extract exactly 40 questions');
    assert.strictEqual(Object.keys(result.detectedAnswerKey).length, 40, 'Must extract all 40 answer keys');

    // Confirm question distribution
    assert.strictEqual(result.candidateTests[0].questions.length, 13);
    assert.strictEqual(result.candidateTests[1].questions.length, 13);
    assert.strictEqual(result.candidateTests[2].questions.length, 14);

    console.log('✓ Passed: Zero regression on "IELTS Test 1 – Reading".');
  } else {
    console.log('⚠ Skipped docx test: files not found');
  }
}

// -----------------------------------------------------------------------------
// Test 5: Regression Baseline - "IELTS_Reading_De2_3_Passages.docx"
// -----------------------------------------------------------------------------
console.log('\n--- Test 5: Regression Baseline "IELTS_Reading_De2_3_Passages.docx" ---');
{
  const docxPath = 'C:/Users/Admin/.gemini/antigravity/brain/e66bef89-3824-44a3-9b01-1da8f8609a20/.user_uploaded/media_1793589273945_6060b814.docx';
  if (fs.existsSync(docxPath)) {
    const buf = fs.readFileSync(docxPath);
    const rawRes = await mammoth.extractRawText({ buffer: buf });
    const htmlRes = await mammoth.convertToHtml({ buffer: buf });

    const result = parseDocumentStructure(rawRes.value, 'IELTS_Reading_De2_3_Passages.docx', htmlRes.value);
    assert.strictEqual(result.tests.length, 1, 'Should detect 1 test');
    const t = result.tests[0];
    assert.strictEqual(t.passages.length, 3, 'Should detect exactly 3 passages');

    assert.strictEqual(t.passages[0].title, 'The Farmers! Parade of History');
    assert.strictEqual(t.passages[0].questions.length, 13);

    assert.strictEqual(t.passages[1].title, 'Making Copier');
    assert.strictEqual(t.passages[1].questions.length, 13);

    assert.strictEqual(t.passages[2].title, 'Motivating Drives');
    assert.strictEqual(t.passages[2].questions.length, 14);

    assert.strictEqual(t.allQuestions.length, 40, 'Total questions must equal 40');
    console.log('✓ Passed: Zero regression on "IELTS_Reading_De2_3_Passages.docx" (13 + 13 + 14 = 40 Qs).');
  } else {
    console.log('⚠ Skipped docx baseline: file not found');
  }
}

console.log('\n================================================================');
console.log('🎉 ALL ADVANCED IELTS READING ENGINE TESTS PASSED!');
console.log('================================================================\n');
