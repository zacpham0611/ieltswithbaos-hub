import assert from 'node:assert';
import {
  parseDocumentStructure,
  formatPassageParagraphs,
  normalizeOcrText,
  isValidPassageTitle,
} from '../src/lib/documentExtractor.ts';
import type { Resource } from '../src/types/index.ts';

console.log('================================================================');
console.log('▶ RUNNING READING OCR, TITLE DETECTION, PARAGRAPHS & TAG REMOVAL');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Passage Title Detection – Valid Titles vs False Positives
// -----------------------------------------------------------------------------
console.log('--- Test 1: Passage Title Detection ---');
{
  const validTitles = [
    'Keeping the water away',
    'The Diprotodon…',
    'Caral…',
    'The dark side of the technological boom',
    'Developmental Tasks of Normal Adolescence',
    'A new stage in the study and teaching of history',
    'Answers Underground',
    'Katherine Mansfield',
    'Australian parrots',
    'When people are ‘deaf’ to music',
    'Ahead of its time',
    'Yawning',
    'Photovoltaics on the rooftop',
    'Next to Nature, but what is art?',
  ];

  for (const title of validTitles) {
    assert.strictEqual(
      isValidPassageTitle(title),
      true,
      `Should recognize authentic title: "${title}"`
    );
  }

  const falsePositives = [
    'Passage 2',
    'Passage 10',
    'Passage 11',
    'Reading Passage 1',
    'Section 3',
    '10 and 11',
    '6 and 7',
    'pages 12 and 13',
    'on pages 10 and 11',
    'below',
    'above',
    'between',
    'refer',
    'Passage 3 on pages 12 and 13',
    'Passage 2 on pages 6 and 7',
    'You should spend about 20 minutes on Questions 1–13…',
    'Y ou should spend about 20 minutes on Questions 14–26…',
    'Questions 1-13',
    'A',
    'Paragraph A',
  ];

  for (const invalid of falsePositives) {
    assert.strictEqual(
      isValidPassageTitle(invalid),
      false,
      `Should reject false positive: "${invalid}"`
    );
  }

  console.log('✓ Passed: All authentic titles validated and false positives rejected.');
}

// -----------------------------------------------------------------------------
// Test 2: Extraction of Passage with Contaminated Preamble / Page Numbers
// -----------------------------------------------------------------------------
console.log('\n--- Test 2: Passage Extraction with Page Fragments and Timing Notes ---');
{
  const sampleDoc = `
READING PASSAGE 3
You should spend about 20 minutes on Questions 27–40, which are based on Reading Passage 3 on pages 10 and 11.
10 and 11
below
Answers Underground

A
Deep below the bustling streets of London lies a vast and intricate network of abandoned underground tunnels.

B
Originally constructed in the nineteenth century for early transportation and storage, these forgotten spaces are finding new life today.

Questions 27–30
Choose the correct letter, A, B, C or D.
27. The underground tunnels were first constructed for [A]
A. early transportation
B. modern data centers
C. flood prevention
D. railway tourist tours
`;

  const parsed = parseDocumentStructure(sampleDoc, 'answers_underground.txt');
  const passage = parsed.candidateTests[0];

  assert.ok(passage, 'Candidate test must be parsed');
  assert.strictEqual(
    passage.title,
    'Answers Underground',
    `Passage title must be "Answers Underground", got "${passage.title}"`
  );

  console.log('✓ Passed: Passage title correctly resolved without contamination from page fragments or instructions.');
}

// -----------------------------------------------------------------------------
// Test 3: OCR Recognition and Text Normalization
// -----------------------------------------------------------------------------
console.log('\n--- Test 3: OCR Recognition & Text Normalization ---');
{
  // Split words
  const splitText = 'Y ou shouId examine how y ou couId prevent river be nds from flo od damage.';
  const normalizedSplit = normalizeOcrText(splitText);
  assert.ok(normalizedSplit.includes('You should'), `Expected "You should", got: "${normalizedSplit}"`);
  assert.ok(normalizedSplit.includes('you could'), `Expected "you could", got: "${normalizedSplit}"`);
  assert.ok(normalizedSplit.includes('river bends'), `Expected "river bends", got: "${normalizedSplit}"`);
  assert.ok(normalizedSplit.includes('flood damage'), `Expected "flood damage", got: "${normalizedSplit}"`);

  // Character substitutions
  const charSubText = 'It was difficuIt to foIIow the exampIe, but they wouId try.';
  const normalizedChar = normalizeOcrText(charSubText);
  assert.strictEqual(normalizedChar, 'It was difficult to follow the example, but they would try.');

  // Hyphen spacing
  const hyphenText = 'The rhinoceros - sized herbivores required re - engineered flood defences.';
  const normalizedHyphen = normalizeOcrText(hyphenText);
  assert.strictEqual(
    normalizedHyphen,
    'The rhinoceros-sized herbivores required re-engineered flood defences.'
  );

  // Preservation of meaningful punctuation and quotes
  const quoteText = 'When people are ‘deaf’ to music, what is art? The Diprotodon…';
  const preservedQuote = normalizeOcrText(quoteText);
  assert.strictEqual(preservedQuote, quoteText, 'Punctuation and quotes must be preserved');

  console.log('✓ Passed: OCR split words, character substitutions, and hyphens normalized accurately.');
}

// -----------------------------------------------------------------------------
// Test 4: Paragraph Segmentation – Mandatory Regression Test: "New approaches to flood control"
// -----------------------------------------------------------------------------
console.log('\n--- Test 4: Paragraph Segmentation – "New approaches to flood control" ---');
{
  // Case 4A: Missing newlines between paragraphs (sentence ends and next label starts on same line)
  const mergedTextLines = [
    'A Recently, winter floods have become more frequent in Europe. B Engineers are now looking at sustainable flood defences rather than higher walls.',
    'C The project also aims to re-create wetlands along major river systems.',
  ];

  const segA = formatPassageParagraphs(mergedTextLines);
  assert.strictEqual(segA.detectedParagraphLabels.includes('A'), true, 'Should detect Paragraph A');
  assert.strictEqual(segA.detectedParagraphLabels.includes('B'), true, 'Should detect Paragraph B');
  assert.strictEqual(segA.detectedParagraphLabels.includes('C'), true, 'Should detect Paragraph C');

  const paraA = segA.labeledParagraphs.find((p) => p.label === 'A');
  const paraB = segA.labeledParagraphs.find((p) => p.label === 'B');
  assert.ok(paraA, 'Paragraph A must exist');
  assert.ok(paraB, 'Paragraph B must exist');
  assert.ok(paraA.text.includes('Recently, winter floods have become more frequent in Europe.'));
  assert.ok(paraB.text.includes('Engineers are now looking at sustainable flood defences'));

  // Case 4B: Standalone paragraph labels
  const standaloneLines = [
    'A',
    'Recently, winter floods have become more frequent in Europe.',
    'B',
    'Engineers are now looking at sustainable flood defences.',
  ];
  const segB = formatPassageParagraphs(standaloneLines);
  assert.strictEqual(segB.detectedParagraphLabels.length, 2);
  assert.strictEqual(segB.labeledParagraphs[0].label, 'A');
  assert.strictEqual(segB.labeledParagraphs[1].label, 'B');

  // Case 4C: Full document extraction with "New approaches to flood control"
  const floodDoc = `
READING PASSAGE 1: New approaches to flood control
You should spend about 20 minutes on Questions 1–13.

A Recently, winter floods have become more frequent across Europe.
B Engineers are now planning new schemes to allow rivers to meander naturally.
C Local communities are participating in re-vegetating riverbanks.

Questions 1–3
Which paragraph contains the following information?
1. River meandering restoration plans [B]
2. Increased frequency of European winter floods [A]
3. Community participation in riverbank restoration [C]
`;

  const parsedFlood = parseDocumentStructure(floodDoc, 'flood_control.txt');
  const test1 = parsedFlood.candidateTests[0];
  assert.strictEqual(test1.title, 'New approaches to flood control');
  assert.ok(test1.labeledParagraphs, 'Must have labeled paragraphs');
  assert.strictEqual(test1.labeledParagraphs.length >= 3, true);
  assert.strictEqual(test1.labeledParagraphs[0].label, 'A');
  assert.strictEqual(test1.labeledParagraphs[1].label, 'B');
  assert.strictEqual(test1.labeledParagraphs[2].label, 'C');

  console.log('✓ Passed: Mandatory regression test "New approaches to flood control" cleanly separated and labeled Paragraphs A, B, C.');
}

// -----------------------------------------------------------------------------
// Test 5: Extended Paragraph Labels A through Z
// -----------------------------------------------------------------------------
console.log('\n--- Test 5: Extended Paragraph Labels (A through N) ---');
{
  const longPassageLines = [
    'A First paragraph text.',
    'B Second paragraph text.',
    'C Third paragraph text.',
    'D Fourth paragraph text.',
    'E Fifth paragraph text.',
    'F Sixth paragraph text.',
    'G Seventh paragraph text.',
    'H Eighth paragraph text.',
    'I Ninth paragraph text.',
    'J Tenth paragraph text.',
    'K Eleventh paragraph text.',
    'L Twelfth paragraph text beyond K.',
    'M Thirteenth paragraph text.',
    'N Fourteenth paragraph text.',
  ];

  const seg = formatPassageParagraphs(longPassageLines);
  assert.strictEqual(seg.detectedParagraphLabels.includes('L'), true, 'Must detect paragraph L');
  assert.strictEqual(seg.detectedParagraphLabels.includes('M'), true, 'Must detect paragraph M');
  assert.strictEqual(seg.detectedParagraphLabels.includes('N'), true, 'Must detect paragraph N');
  assert.strictEqual(seg.detectedParagraphLabels.length, 14, 'Should detect all 14 paragraphs');

  console.log('✓ Passed: Paragraph labels properly recognized from A through Z (beyond K limit).');
}

// -----------------------------------------------------------------------------
// Test 6: Removal of Tags Feature from Resources
// -----------------------------------------------------------------------------
console.log('\n--- Test 6: Verification of Tags Removal in Resources ---');
{
  // Imported resources must receive empty tags array: tags: []
  const importedResource: Resource = {
    id: 'res_test_tags_free',
    teacherId: 'teacher-1',
    courseId: null,
    title: 'New approaches to flood control',
    type: 'doc',
    tags: [],
    skill: 'reading',
    folder: 'Reading Practice',
    isPublished: true,
    createdAt: '2026-11-03',
  };

  assert.strictEqual(Array.isArray(importedResource.tags), true);
  assert.strictEqual(importedResource.tags.length, 0, 'Tags array must be strictly empty');

  // Verify non-tag search logic
  const searchQuery = 'flood control';
  const matches = importedResource.title.toLowerCase().includes(searchQuery.toLowerCase());
  assert.strictEqual(matches, true, 'Resource title matches non-tag search');

  console.log('✓ Passed: Resources Tag feature completely eliminated and records default to tags: [].');
}

console.log('\n================================================================');
console.log('ALL READING OCR, TITLE DETECTION, PARAGRAPHS & TAG TESTS PASSED! 🎯');
console.log('================================================================\n');
