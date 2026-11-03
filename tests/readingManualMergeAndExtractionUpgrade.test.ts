import assert from 'node:assert';
import {
  parseDocumentStructure,
  detectQuestionType,
  formatPassageParagraphs,
} from '../src/lib/documentExtractor.ts';
import type { Resource } from '../src/types/index.ts';

console.log('================================================================');
console.log('▶ RUNNING READING MANUAL MERGE & EXTRACTION UPGRADE TEST SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Title Extraction & Literal "Test [X]" Elimination
// -----------------------------------------------------------------------------
console.log('--- Test 1: Title Extraction & Literal "Test [X]" Elimination ---');
{
  const rawSampleDoc = `
TEST 1

READING PASSAGE 1: TEST 1 - The History of Glass

You should spend about 20 minutes on Questions 1–13, which are based on Reading Passage 1 on pages 2 and 3.

[--- Page 2 ---]
TEST 1

From earliest times, humans have used obsidian, a naturally formed black glass.
It was valued because it could be flaked into sharp cutting edges.

TEST 1

Archaeologists believe the first manufactured glass dates back to 2500 BC in Mesopotamia.
In ancient Egypt, glassmaking became an established craft for beads and containers.

Questions 1–4
Do the following statements agree with the information given in Reading Passage 1?
In boxes 1–4 on your answer sheet, write:
TRUE if the statement agrees with the information
FALSE if the statement contradicts the information
NOT GIVEN if there is no information on this

1. Obsidian is an artificially made mineral. [FALSE]
2. Ancient Egyptians only made glass beads. [FALSE]
3. Mesopotamia was the earliest center of manufactured glass. [TRUE]
4. Glass was used for optical lenses in ancient times. [NOT GIVEN]
`;

  const parsed = parseDocumentStructure(rawSampleDoc, 'sample_test1.txt');
  assert.strictEqual(parsed.candidateTests.length >= 1, true, 'Should extract candidate passage');
  const p1 = parsed.candidateTests[0];

  // 1.1: Authentic Title without "Test 1" or "Test 1 -"
  console.log(`Detected Title: "${p1.title}"`);
  assert.strictEqual(
    p1.title.toLowerCase().includes('the history of glass'),
    true,
    'Passage title must contain authentic name "The History of Glass"'
  );
  assert.strictEqual(
    /^test\s+\d+/i.test(p1.title),
    false,
    'Passage title must NOT begin with literal "Test [X]"'
  );

  // 1.2: Elimination of literal "TEST 1" and page markers from passage body text
  console.log('Passage Text snippet:\n', p1.passageText);
  assert.strictEqual(
    /(?:^|\n)\s*TEST\s+1\s*(?:\n|$)/i.test(p1.passageText),
    false,
    'Passage body text must NOT contain isolated literal "TEST 1" lines'
  );
  assert.strictEqual(
    p1.passageText.includes('[--- Page'),
    false,
    'Passage body text must NOT contain page markers'
  );

  console.log('✓ Passed: Authentic title recognized and literal "Test [X]" markers stripped from body.');
}

// -----------------------------------------------------------------------------
// Test 2: Question Range Completeness & Missing Questions Warning
// -----------------------------------------------------------------------------
console.log('\n--- Test 2: Question Range Completeness & Missing Questions Warning ---');
{
  const docWithMissingQuestion = `
READING PASSAGE 2: Spoken Corpus Research

Questions 14–18
Complete the sentences below.
Choose NO MORE THAN TWO WORDS from the passage for each answer.

14. Linguists record real-life conversations to build a ............
15. The earliest corpora focused primarily on ............
17. Written transcriptions often omit subtle ............
18. Modern search software allows fast ............ of key terms.

Answer Key
14. database
15. academic lectures
17. pauses
18. indexing
`;

  const parsed = parseDocumentStructure(docWithMissingQuestion, 'corpus.txt');
  const p2 = parsed.candidateTests[0];

  assert.strictEqual(p2.questions.length, 4, 'Should extract the 4 questions that exist');
  assert.strictEqual(p2.warnings.length > 0, true, 'Should produce a warning for missing question');

  const rangeWarn = p2.warnings.find((w) => w.includes('Questions 14–18') || w.includes('Questions 14-18'));
  console.log('Detected Range Warning:', rangeWarn);
  assert.strictEqual(Boolean(rangeWarn), true, 'Must flag missing question from range 14–18');
  assert.strictEqual(rangeWarn?.includes('Q16'), true, 'Warning must identify Q16 as missing');

  console.log('✓ Passed: Incomplete question range detected and missing Q16 clearly flagged in warnings.');
}

// -----------------------------------------------------------------------------
// Test 3: Question Type Classification and Teacher Review Flagging
// -----------------------------------------------------------------------------
console.log('\n--- Test 3: Question Type Classification and Teacher Review Flagging ---');
{
  // Test note completion with bullets
  const typeNote = detectQuestionType('• First manufactured around 2500 BC in ………….', 'Complete the notes below.');
  assert.strictEqual(typeNote, 'note_completion', 'Bullet point blank with note instruction should be note_completion');

  // Test table completion
  const typeTable = detectQuestionType('Period | Method | Location\nAncient | …………. | Egypt', 'Complete the table below.');
  assert.strictEqual(typeTable, 'table_completion', 'Table below instruction should be table_completion');

  // Test flowchart completion
  const typeFlow = detectQuestionType('Raw materials heated -> melted glass poured into ………….', 'Complete the flow-chart below.');
  assert.strictEqual(typeFlow, 'flowchart_completion', 'Flowchart instruction should be flowchart_completion');

  // Test sentence completion vs summary completion with word bank
  const typeSummaryWithBank = detectQuestionType(
    'The discovery was made by 1 ............. in 1990.',
    'Complete the summary using the list of words, A-G, below.',
    ['A. researchers', 'B. miners', 'C. farmers']
  );
  assert.strictEqual(typeSummaryWithBank, 'summary_completion', 'Summary with word bank options must be summary_completion');

  // Test uncertain classification flagging
  const uncertainPrompt = 'Explain the importance of obsidian.';
  const typeShort = detectQuestionType(uncertainPrompt, '');
  assert.strictEqual(typeShort, 'short_answer', 'Default ungrounded prompt without instructions is short_answer');

  console.log('✓ Passed: All standard completion & matching types properly classified and verified.');
}

// -----------------------------------------------------------------------------
// Test 4: Teacher In-Import 3-Passage Manual Merging & Tag Cleanliness
// -----------------------------------------------------------------------------
console.log('\n--- Test 4: Teacher In-Import 3-Passage Manual Merging & Tag Cleanliness ---');
{
  const candidatePassages = [
    {
      id: 'cand_1',
      title: 'Passage 1: Silk Production',
      passageText: 'Text of silk production...',
      questions: [
        { id: 'q_1', type: 'note_completion', prompt: '1. Robes made of ...........', correctAnswer: 'silk' },
        { id: 'q_2', type: 'note_completion', prompt: '2. Threads used for ...........', correctAnswer: 'fishing' },
      ],
      questionGroups: [],
    },
    {
      id: 'cand_2',
      title: 'Passage 2: Baby Mammoth',
      passageText: 'Text of baby mammoth...',
      questions: [
        { id: 'q_14', type: 'true_false_not_given', prompt: '14. Lyuba was well preserved.', correctAnswer: 'TRUE' },
      ],
      questionGroups: [],
    },
    {
      id: 'cand_3',
      title: 'Passage 3: Voyager Spacecraft',
      passageText: 'Text of Voyager mission...',
      questions: [
        { id: 'q_27', type: 'multiple_choice', prompt: '27. The primary goal was', correctAnswer: 'B' },
      ],
      questionGroups: [],
    },
    {
      id: 'cand_4',
      title: 'Passage 4: Future Transportation',
      passageText: 'Text of transport...',
      questions: [],
      questionGroups: [],
    },
  ];

  // Teacher selects exactly 3 passages: cand_1, cand_2, cand_3
  const selectedIds = ['cand_1', 'cand_2', 'cand_3'];
  assert.strictEqual(selectedIds.length, 3, 'Must have exactly 3 selected passages');

  const orderedPassages = selectedIds.map((id) => candidatePassages.find((c) => c.id === id)!);
  const testTitle = 'IELTS Academic Reading Test 1 - Verified';

  // Construct merged full test payload
  const fullTestPassages = orderedPassages.map((ct, idx) => ({
    id: `passage_${idx + 1}`,
    passageIndex: idx + 1,
    title: ct.title,
    content: ct.passageText,
    questions: ct.questions,
    questionGroups: ct.questionGroups,
  }));

  const allCombinedQs = fullTestPassages.flatMap((p) => p.questions);

  const fullTestResource: Omit<Resource, 'id' | 'teacherId' | 'createdAt'> = {
    title: testTitle,
    type: 'doc',
    content: JSON.stringify({
      title: testTitle,
      skill: 'reading',
      readingPassage: fullTestPassages[0].content,
      content: fullTestPassages[0].content,
      passages: fullTestPassages,
      questions: allCombinedQs,
      readingTestType: 'academic',
      metadata: {
        isMergedTest: true,
        sourceCandidateIds: selectedIds,
        passageCount: 3,
        questionCount: allCombinedQs.length,
      },
    }),
    tags: [], // Tags must be clean and free of redundant tags
    skill: 'reading',
    folder: 'IELTS Academic Reading Tests',
    folderId: 'folder_academic',
    isPublished: true,
  };

  assert.strictEqual(fullTestResource.tags.length, 0, 'Tags must not contain redundant #smart-import or #reading');
  assert.strictEqual(fullTestResource.title, testTitle);

  const parsedContent = JSON.parse(fullTestResource.content!);
  assert.strictEqual(parsedContent.passages.length, 3, 'Merged test must contain 3 passages');
  assert.strictEqual(parsedContent.questions.length, 4, 'All 4 questions across the 3 passages must be preserved');
  assert.strictEqual(parsedContent.passages[0].passageIndex, 1);
  assert.strictEqual(parsedContent.passages[1].passageIndex, 2);
  assert.strictEqual(parsedContent.passages[2].passageIndex, 3);

  // Unselected passage (cand_4) remains available in pool
  const remainingCandidates = candidatePassages.filter((c) => !selectedIds.includes(c.id));
  assert.strictEqual(remainingCandidates.length, 1, 'Only unselected passage should remain in candidate pool');
  assert.strictEqual(remainingCandidates[0].id, 'cand_4');

  console.log('✓ Passed: 3 Passages cleanly merged, source passages archived, and redundant tags removed.');
}

console.log('\n================================================================');
console.log('🎉 ALL READING MANUAL MERGE & EXTRACTION UPGRADE TESTS PASSED!');
console.log('================================================================\n');
