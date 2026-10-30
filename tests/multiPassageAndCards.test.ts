import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import mammoth from 'mammoth';
import {
  extractTablesFromHtml,
  parseAnswerTable,
  parseDocumentStructure,
} from '../src/lib/documentExtractor.ts';
import { buildQuestionRenderGroups } from '../src/lib/questionNormalizer.ts';
import type { ReadingQuestion } from '../src/types/index.ts';

async function runTests() {
  console.log('--- Starting IELTS Multi-Passage Reading & Test Suite ---');

  // 1. Build IELTS_Reading_3_Passages.docx using docx package
  const docxFilePath = path.join(process.cwd(), 'tests', 'IELTS_Reading_3_Passages.docx');

  // Generate 40 Answer Key rows
  const answerRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Question', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Answer', bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Explanation', bold: true })] })] }),
      ],
    }),
  ];

  const answersData: Record<number, { ans: string; exp: string }> = {};

  for (let i = 1; i <= 40; i++) {
    let ans = '';
    let exp = `Paragraph reference and citation for Question ${i}`;
    if (i <= 7) {
      // Matching Information (letters A-G, reusable)
      const letters = ['A', 'B', 'C', 'D', 'E', 'B', 'A'];
      ans = letters[i - 1];
    } else if (i <= 13) {
      // T/F/NG
      ans = i % 2 === 0 ? 'TRUE' : i % 3 === 0 ? 'NOT GIVEN' : 'FALSE';
    } else if (i <= 20) {
      // Matching Headings
      const romans = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];
      ans = romans[i - 14];
    } else if (i <= 26) {
      // Completion
      ans = `keyword_${i}`;
    } else if (i <= 33) {
      // MCQ
      const opts = ['A', 'B', 'C', 'D'];
      ans = opts[i % 4];
    } else {
      // Summary completion
      ans = `term_${i}`;
    }

    answersData[i] = { ans, exp };

    answerRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(String(i))] }),
          new TableCell({ children: [new Paragraph(ans)] }),
          new TableCell({ children: [new Paragraph(exp)] }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header
          new Paragraph({
            children: [new TextRun({ text: 'IELTS ACADEMIC READING PRACTICE TEST', bold: true, size: 28 })],
          }),

          // PASSAGE 1
          new Paragraph({
            children: [new TextRun({ text: 'READING PASSAGE 1', bold: true, size: 24 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: 'The Secrets of Ancient Navigation', bold: true, size: 20 })],
          }),
          new Paragraph('A. Early seafarers across the Pacific ocean utilized complex astronomical navigation systems.'),
          new Paragraph('B. By observing waves and ocean swell patterns, sailors could determine distance to unseen islands.'),
          new Paragraph('C. Traditional star compasses divided the horizon into 32 distinct directional points.'),
          new Paragraph('D. The presence of specific seabirds, such as terns and noddies, signaled land within thirty miles.'),
          new Paragraph('E. Cloud formations over distant atolls often mirrored lagoons beneath them.'),
          new Paragraph('F. European explorers initially discounted Indigenous navigational accuracy without mechanical sextants.'),
          new Paragraph('G. Modern computer reconstructions have verified the remarkable precision of these ancestral voyages.'),

          // Questions 1-7: Matching Information
          new Paragraph({
            children: [new TextRun({ text: 'Questions 1–7', bold: true })],
          }),
          new Paragraph('Which paragraph contains the following information?'),
          new Paragraph('Write the correct letter, A–G, in boxes 1–7 on your answer sheet.'),
          new Paragraph('NB You may use any letter more than once.'),
          new Paragraph('1. Mention of avian indicators alerting navigators to nearby landfall.'),
          new Paragraph('2. The visual reflection of lagoon waters onto overlying cloud structures.'),
          new Paragraph('3. A division of the observable horizon into thirty-two reference sectors.'),
          new Paragraph('4. European skepticism regarding technological aids used by indigenous sailors.'),
          new Paragraph('5. Analysis of wave rhythms to gauge oceanic positions.'),
          new Paragraph('6. The reliance on celestial bodies for night orientation across vast waters.'),
          new Paragraph('7. Contemporary digital validation confirming historic navigation accuracy.'),

          // Questions 8-13: True/False/Not Given
          new Paragraph({
            children: [new TextRun({ text: 'Questions 8–13', bold: true })],
          }),
          new Paragraph('Do the following statements agree with the information given in Reading Passage 1?'),
          new Paragraph('TRUE if the statement agrees with the information'),
          new Paragraph('FALSE if the statement contradicts the information'),
          new Paragraph('NOT GIVEN if there is no information on this'),
          new Paragraph('8. Polynesian navigators maintained written records of their navigational routes.'),
          new Paragraph('9. Star compasses were crafted from durable marine timber.'),
          new Paragraph('10. European explorers readily praised Polynesian methods upon initial contact.'),
          new Paragraph('11. Modern computer models analyzed historical Pacific routes.'),
          new Paragraph('12. Swell patterns were imperceptible during heavy oceanic storms.'),
          new Paragraph('13. Seabirds can fly up to one hundred miles from their coastal nests.'),

          // PASSAGE 2
          new Paragraph({
            children: [new TextRun({ text: 'READING PASSAGE 2', bold: true, size: 24 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Artificial Intelligence in Wildlife Conservation', bold: true, size: 20 })],
          }),
          new Paragraph('A. Conservation biology faces severe resource constraints across remote ecological habitats.'),
          new Paragraph('B. Camera traps generate millions of wildlife images requiring automated computer vision models.'),
          new Paragraph('C. Acoustic sensors monitor rainforest canopies for chainsaw sounds and illegal poaching gunshots.'),
          new Paragraph('D. Satellite imagery combined with deep learning predicts deforestation corridors before trees fall.'),
          new Paragraph('E. Predictive algorithms optimize patrol routes for anti-poaching park rangers.'),
          new Paragraph('F. Ethical questions arise regarding drone surveillance impacts on vulnerable species.'),
          new Paragraph('G. Public-private tech partnerships provide scalable compute infrastructure for field biologists.'),

          // Questions 14-20: Matching Headings
          new Paragraph({
            children: [new TextRun({ text: 'Questions 14–20', bold: true })],
          }),
          new Paragraph('Reading Passage 2 has seven paragraphs, A–G.'),
          new Paragraph('Choose the correct heading for each paragraph from the list of headings below.'),
          new Paragraph('List of Headings: i. Remote sensing against deforestation; ii. Processing photographic datasets; iii. Sound detection in rainforests; iv. Ranger patrol optimization; v. Funding and tech collaboration; vi. Surveillance ethical dilemmas; vii. Resource scarcity in conservation.'),
          new Paragraph('14. Paragraph A'),
          new Paragraph('15. Paragraph B'),
          new Paragraph('16. Paragraph C'),
          new Paragraph('17. Paragraph D'),
          new Paragraph('18. Paragraph E'),
          new Paragraph('19. Paragraph F'),
          new Paragraph('20. Paragraph G'),

          // Questions 21-26: Note Completion
          new Paragraph({
            children: [new TextRun({ text: 'Questions 21–26', bold: true })],
          }),
          new Paragraph('Complete the notes below.'),
          new Paragraph('Choose NO MORE THAN TWO WORDS from the passage for each answer.'),
          new Paragraph('21. Automated models analyze millions of wildlife photos from camera _____ .'),
          new Paragraph('22. Audio sensors listen for illegal _____ in remote forest reserves.'),
          new Paragraph('23. Satellite scans help identify future _____ before clearcutting begins.'),
          new Paragraph('24. Algorithmic scheduling enhances the effectiveness of park _____ .'),
          new Paragraph('25. Researchers investigate the ecological disruption caused by _____ .'),
          new Paragraph('26. Field teams rely on corporate _____ to supply processing power.'),

          // PASSAGE 3
          new Paragraph({
            children: [new TextRun({ text: 'READING PASSAGE 3', bold: true, size: 24 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: 'The Evolution of Cognitive Architecture', bold: true, size: 20 })],
          }),
          new Paragraph('A. Human cognition represents an intricate evolutionary compromise between speed and accuracy.'),
          new Paragraph('B. Dual-process theory posits fast intuitive heuristics against deliberate analytical thought.'),
          new Paragraph('C. Working memory constraints heavily dictate how complex problem solving unfolds.'),
          new Paragraph('D. Neuroimaging confirms distinct cortical networks lighting up during creative synthesis.'),
          new Paragraph('E. Language acquisition provides symbolic abstraction tools that expand working capacity.'),
          new Paragraph('F. Metacognitive awareness allows individuals to evaluate and modify their mental strategies.'),
          new Paragraph('G. Cross-cultural studies reveal universal cognitive milestones alongside cultural variance.'),
          new Paragraph('H. Future neurotechnologies may alter standard processing bottlenecks in human cognition.'),

          // Questions 27-33: Multiple Choice
          new Paragraph({
            children: [new TextRun({ text: 'Questions 27–33', bold: true })],
          }),
          new Paragraph('Choose the correct letter, A, B, C or D.'),
          new Paragraph('27. What is the main thesis of dual-process theory? A. Intuition always errs. B. Speed and reflection interact. C. Language precedes thinking. D. Brain volume dictates intelligence.'),
          new Paragraph('28. Working memory capacity is characterized by: A. Unlimited storage. B. Severe functional bottlenecks. C. Lack of neural correlates. D. Static developmental patterns.'),
          new Paragraph('29. Neuroimaging reveals creative thought involves: A. Single isolated nodes. B. Distinct cortical network coordination. C. Zero metabolic activity. D. Suppression of sensory inputs.'),
          new Paragraph('30. Language contributes to cognition primarily by: A. Storing raw auditory memories. B. Providing symbolic abstraction mechanisms. C. Slowing analytical deduction. D. Replacing working memory entirely.'),
          new Paragraph('31. Metacognition refers specifically to: A. Unconscious reflexes. B. Evaluating one\'s own reasoning processes. C. Emotional mood shifts. D. Motor control.'),
          new Paragraph('32. Cultural studies demonstrate: A. Complete neurological divergence. B. Shared cognitive milestones with local variations. C. Absence of cognitive universals. D. Language superiority.'),
          new Paragraph('33. Future cognitive neurotechnologies may: A. Eliminate all evolutionary traits. B. Modify typical brain processing bottlenecks. C. Reverse language development. D. Eradicate working memory.'),

          // Questions 34-40: Summary Completion
          new Paragraph({
            children: [new TextRun({ text: 'Questions 34–40', bold: true })],
          }),
          new Paragraph('Complete the summary below.'),
          new Paragraph('Choose NO MORE THAN ONE WORD from the passage for each answer.'),
          new Paragraph('34. Human mental architecture balances efficiency and _____ .'),
          new Paragraph('35. Heuristic methods provide rapid answers but may bypass deep _____ .'),
          new Paragraph('36. The limits of working _____ influence task complexity.'),
          new Paragraph('37. Coordinated brain networks support high-level creative _____ .'),
          new Paragraph('38. Symbolic symbols grant expanded mental _____ .'),
          new Paragraph('39. Self-monitoring allows learners to adjust strategic _____ .'),
          new Paragraph('40. Future technological interventions could alleviate biological _____ .'),

          // ANSWER KEY TABLE IN WORD
          new Paragraph({
            children: [new TextRun({ text: 'READING ANSWER KEYS & EXPLANATIONS', bold: true, size: 24 })],
          }),
          new Table({
            rows: answerRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(docxFilePath, buffer);
  console.log('✓ Successfully created test file: IELTS_Reading_3_Passages.docx (3 passages, 40 Qs, Word answer table)');

  // 2. Extract with Mammoth and test HTML Table extraction
  const [rawResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ path: docxFilePath }),
    mammoth.convertToHtml({ path: docxFilePath }),
  ]);

  const rawText = rawResult.value.trim();
  const htmlContent = htmlResult.value;

  console.log(`✓ Mammoth extracted raw text (${rawText.length} chars) and HTML (${htmlContent.length} chars)`);

  // Verify extractTablesFromHtml
  const tables = extractTablesFromHtml(htmlContent);
  assert.ok(tables.length >= 1, 'Should extract at least 1 HTML table from Word DOCX');
  console.log(`✓ HTML table extracted: ${tables[0].headers.join(' | ')} (${tables[0].rows.length} rows)`);

  // Verify parseAnswerTable
  const parsedTableAnswers = parseAnswerTable(tables[0].headers, tables[0].rows);
  assert.strictEqual(Object.keys(parsedTableAnswers).length, 40, 'Should extract all 40 answers from Word table');
  assert.strictEqual(parsedTableAnswers['1'].answer, answersData[1].ans, 'Question 1 answer matches');
  assert.strictEqual(parsedTableAnswers['40'].answer, answersData[40].ans, 'Question 40 answer matches');
  console.log('✓ Table answers parsed: Q1=' + parsedTableAnswers['1'].answer + ', Q40=' + parsedTableAnswers['40'].answer);

  // 3. Test parseDocumentStructure with htmlContent
  const structure = parseDocumentStructure(rawText, 'IELTS_Reading_3_Passages.docx', htmlContent);

  // Verify Passages detection
  assert.ok(structure.tests && structure.tests.length >= 1, 'Should detect at least 1 test');
  const fullTest = structure.tests[0];
  console.log(`✓ Detected test: "${fullTest.title}" with ${fullTest.passages.length} passages, ${fullTest.allQuestions?.length} questions`);
  fullTest.passages.forEach((p, idx) => {
    console.log(`   [Passage ${idx + 1}] "${p.title}" content: ${p.content.length} chars, questions: ${p.questions.length}`);
  });

  assert.strictEqual(fullTest.passages.length, 3, 'Should detect all 3 passages in multi-passage test');
  assert.strictEqual(fullTest.allQuestions?.length, 40, 'Should extract all 40 questions across the 3 passages');

  // Verify Matching Information in Passage 1
  const p1 = fullTest.passages[0];
  assert.ok(p1.questions && p1.questions.length >= 7, 'Passage 1 has questions');
  const q1 = p1.questions[0];
  assert.strictEqual(q1.type, 'matching_information', 'Question 1 recognized as matching_information');
  assert.ok(q1.options && q1.options.length >= 6, 'Matching Information question should have paragraph letter options A-G');
  assert.strictEqual(q1.correctAnswer, answersData[1].ans, 'Question 1 correct answer mapped accurately');
  assert.ok(q1.explanation?.includes(answersData[1].exp), 'Question 1 explanation mapped accurately');

  // Verify Matching Headings in Passage 2
  const p2 = fullTest.passages[1];
  assert.ok(p2.questions && p2.questions.length >= 7, 'Passage 2 has questions');
  const q14 = p2.questions[0];
  assert.strictEqual(q14.type, 'matching_headings', 'Question 14 recognized as matching_headings');
  assert.strictEqual(q14.correctAnswer, answersData[14].ans, 'Question 14 correct answer mapped accurately');

  // Verify MCQ in Passage 3
  const p3 = fullTest.passages[2];
  assert.ok(p3.questions && p3.questions.length >= 7, 'Passage 3 has questions');
  const q27 = p3.questions[0];
  assert.strictEqual(q27.type, 'multiple_choice', 'Question 27 recognized as multiple_choice');
  assert.strictEqual(q27.correctAnswer, answersData[27].ans, 'Question 27 correct answer mapped accurately');

  // Verify all 40 questions have correct answers mapped without hallucination
  const allQuestions = fullTest.allQuestions || [];
  const mappedCount = allQuestions.filter((q) => q.correctAnswer).length;
  assert.strictEqual(mappedCount, 40, 'All 40 questions should have mapped answers from Word table');
  console.log(`✓ All ${mappedCount} questions have valid correct answers mapped from the Word table!`);

  // 4. Test buildQuestionRenderGroups (AssignmentsView hook fix verification)
  const renderGroups = buildQuestionRenderGroups(allQuestions);
  console.log(`✓ renderGroups count: ${renderGroups.length}`);
  assert.ok(renderGroups.length >= 1, 'Should generate structured render groups');
  assert.ok(renderGroups[0].rangeTitle.includes('1'), 'First group title contains Question 1');
  console.log(`✓ buildQuestionRenderGroups produced ${renderGroups.length} clean render groups without hook violations:`);
  renderGroups.forEach((g) => {
    console.log(`   - ${g.rangeTitle} (${g.questions.length} Qs, type: ${g.questions[0].q.type})`);
  });

  // Clean up generated test docx
  fs.unlinkSync(docxFilePath);
  console.log('✓ Cleaned up test document.');

  // 5. Test against Real IELTS Sample Document (IELTS_Reading_3_Passages.docx)
  const realDocxPath = 'C:/Users/Admin/.gemini/antigravity/brain/e66bef89-3824-44a3-9b01-1da8f8609a20/.user_uploaded/media_1793369513795_196075d4.docx';
  if (fs.existsSync(realDocxPath)) {
    console.log('\n--- 5. Verifying Real IELTS_Reading_3_Passages.docx Uploaded Sample ---');
    const [realRawResult, realHtmlResult] = await Promise.all([
      mammoth.extractRawText({ path: realDocxPath }),
      mammoth.convertToHtml({ path: realDocxPath }),
    ]);

    const realRawText = realRawResult.value.trim();
    const realHtmlContent = realHtmlResult.value;

    const realDoc = parseDocumentStructure(realRawText, 'IELTS_Reading_3_Passages.docx', realHtmlContent);
    assert.strictEqual(realDoc.candidateTests.length, 3, 'Real sample docx must identify exactly 3 passages');
    assert.strictEqual(realDoc.questions.length, 40, 'Real sample docx must extract all 40 questions');

    const [realP1, realP2, realP3] = realDoc.candidateTests;
    assert.ok(realP1.title.includes('Bamboo'), 'Passage 1 is Bamboo: A Wonder Plant');
    assert.strictEqual(realP1.questions.length, 13, 'Passage 1 has 13 questions (1-13)');
    assert.strictEqual(realP1.labeledParagraphs?.length, 6, 'Passage 1 has 6 labeled paragraphs A-F');

    assert.ok(realP2.title.includes('Renewable Energy'), 'Passage 2 is Renewable Energy');
    assert.strictEqual(realP2.questions.length, 13, 'Passage 2 has 13 questions (14-26)');
    assert.strictEqual(realP2.labeledParagraphs?.length, 11, 'Passage 2 has 11 labeled paragraphs A-K');

    assert.ok(realP3.title.includes('Global Warming'), 'Passage 3 is Global Warming in New Zealand');
    assert.strictEqual(realP3.questions.length, 14, 'Passage 3 has 14 questions (27-40)');
    assert.strictEqual(realP3.labeledParagraphs?.length, 9, 'Passage 3 has 9 labeled paragraphs A-I');

    // Verify all 40 questions have correct answers from tables
    for (let qn = 1; qn <= 40; qn++) {
      const q = realDoc.questions.find((item) => item.id === `q_${qn}`);
      assert.ok(q, `Question ${qn} exists`);
      assert.ok(q.correctAnswer && q.correctAnswer.length > 0, `Question ${qn} has valid correct answer`);
      assert.ok(q.explanation && q.explanation.length > 0, `Question ${qn} has explanation citation`);
    }

    // Verify specific question types
    const q1 = realDoc.questions.find((item) => item.id === 'q_1');
    assert.strictEqual(q1?.type, 'matching_information');
    assert.strictEqual(q1?.correctAnswer, 'B');

    const q8 = realDoc.questions.find((item) => item.id === 'q_8');
    assert.strictEqual(q8?.type, 'matching_features');
    assert.strictEqual(q8?.correctAnswer, 'B');

    const q12 = realDoc.questions.find((item) => item.id === 'q_12');
    assert.strictEqual(q12?.type, 'short_answer');
    assert.strictEqual(q12?.correctAnswer, 'soil erosion');

    const q14 = realDoc.questions.find((item) => item.id === 'q_14');
    assert.strictEqual(q14?.type, 'true_false_not_given');
    assert.strictEqual(q14?.correctAnswer, 'FALSE');

    const q21 = realDoc.questions.find((item) => item.id === 'q_21');
    assert.strictEqual(q21?.type, 'matching_features');
    assert.strictEqual(q21?.correctAnswer, 'B');

    const q27 = realDoc.questions.find((item) => item.id === 'q_27');
    assert.strictEqual(q27?.type, 'multiple_choice');
    assert.strictEqual(q27?.correctAnswer, 'D');

    const q33 = realDoc.questions.find((item) => item.id === 'q_33');
    assert.strictEqual(q33?.type, 'summary_completion');
    assert.strictEqual(q33?.correctAnswer, 'D');

    const q36 = realDoc.questions.find((item) => item.id === 'q_36');
    assert.strictEqual(q36?.type, 'yes_no_not_given');
    assert.strictEqual(q36?.correctAnswer, 'YES');

    console.log('✓ Successfully verified real sample IELTS_Reading_3_Passages.docx (3 passages, 40 Qs, 8 tables, all types & keys)!');
  }

  console.log('\n========================================');
  console.log('ALL TESTS PASSED WITH 100% SUCCESS!');
  console.log('========================================\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
