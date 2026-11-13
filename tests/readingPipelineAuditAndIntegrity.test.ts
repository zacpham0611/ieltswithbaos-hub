import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseSinglePassage,
  parseDocumentStructure,
  detectQuestionType,
  extractWordLimitInfo,
} from '../src/lib/documentExtractor.ts';
import {
  extractAllNormalizedQuestions,
  extractQuestionNumber,
  cleanQuestionPrompt,
  normalizeReadingQuestion,
  buildQuestionRenderGroups,
} from '../src/lib/questionNormalizer.ts';
import {
  gradeAssignmentSubmission,
  gradeSingleQuestion,
} from '../src/lib/assignmentGrader.ts';
import type { ReadingQuestion, QuestionGroup, ParsedPassage } from '../src/types/index.ts';

test('MASTER AUDIT: IELTS READING COMPLETE PIPELINE INTEGRITY', async (t) => {
  await t.test('1. Direct Assignment vs Library Assignment Parity', () => {
    // Simulated dataset from a 3-passage IELTS test
    const rawPassage1 = `READING PASSAGE 1
The Secret Life of Whales
Whales are magnificent marine mammals that have fascinated scientists for centuries.

Questions 1-5
Do the following statements agree with the information given in Reading Passage 1?
In boxes 1-5 on your answer sheet, write
TRUE if the statement agrees with the information
FALSE if the statement contradicts the information
NOT GIVEN if there is no information on this

1. Whales communicate primarily through visual cues.
2. Blue whales are the largest creatures on Earth.
3. Scientists have mapped all whale migration routes.
4. Humpback whale songs can travel hundreds of miles.
5. Whales only feed during night time.

Questions 6-9
Complete the notes below.
Choose ONE WORD ONLY from the passage for each answer.
• Whale calves drink rich (6) milk for survival.
• Migration occurs towards warmer (7) waters.
• Threats include commercial (8) whaling.
• Protection efforts are led by global (9) agencies.

Answer Key:
1. FALSE
2. TRUE
3. NOT GIVEN
4. TRUE
5. FALSE
6. milk
7. waters
8. whaling
9. agencies
`;

    // 1. Direct Assignment pipeline: Parse raw document -> create assignment
    const docStruct = parseDocumentStructure(rawPassage1, 'Cambridge Drill Test');
    assert.ok(docStruct.candidateTests.length > 0, 'Must produce candidate tests');
    const directCandidate = docStruct.candidateTests[0];

    const directPassage: ParsedPassage = {
      id: 'p_1',
      passageIndex: 0,
      title: directCandidate.title,
      content: directCandidate.passageText,
      questions: directCandidate.questions,
      questionGroups: directCandidate.questionGroups,
    };

    const directExtracted = extractAllNormalizedQuestions({
      passages: [directPassage],
      readingQuestions: directCandidate.questions,
      questionGroups: directCandidate.questionGroups,
    });

    // 2. Library Assignment pipeline: Save to Library JSON -> retrieve -> create assignment
    const libraryPayload = {
      title: directCandidate.title,
      skill: 'reading',
      readingPassage: directCandidate.passageText,
      content: directCandidate.passageText,
      passages: [
        {
          id: 'p_1',
          passageIndex: 0,
          title: directCandidate.title,
          content: directCandidate.passageText,
          questions: directCandidate.questions,
          questionGroups: directCandidate.questionGroups,
        },
      ],
      questionGroups: directCandidate.questionGroups,
      questions: directCandidate.questions,
      readingQuestions: directCandidate.questions,
    };

    const serializedLibraryJson = JSON.stringify(libraryPayload);
    const parsedLibraryResource = JSON.parse(serializedLibraryJson);

    const libraryExtracted = extractAllNormalizedQuestions(parsedLibraryResource);

    // Verify 100% parity between Direct Assignment and Library Assignment
    assert.strictEqual(
      directExtracted.questions.length,
      libraryExtracted.questions.length,
      'Both pipelines must extract the exact same number of questions'
    );
    assert.strictEqual(
      directExtracted.questionGroups.length,
      libraryExtracted.questionGroups.length,
      'Both pipelines must preserve identical question groups'
    );
    assert.strictEqual(
      directExtracted.questions[0].id,
      libraryExtracted.questions[0].id,
      'First question ID must match'
    );
    assert.strictEqual(
      directExtracted.questions[0].correctAnswer,
      libraryExtracted.questions[0].correctAnswer,
      'Answer key association must be 100% identical'
    );
  });

  await t.test('2. Overlapping question group deduplication (e.g. Summary Completion 20-26 vs 24-26)', () => {
    // Document with a parent summary completion 20-26 and an embedded sub-heading / OCR artifact 24-26
    const rawChunk = `READING PASSAGE 2
Autonomous Transportation
Autonomous driving has progressed significantly over the past decade.

Questions 20-26
Complete the summary below.
Choose NO MORE THAN TWO WORDS from the passage for each answer.
Write your answers in boxes 20-26 on your answer sheet.

Automated vehicles utilize advanced sensors to detect [20] obstacles on roadways.
Early navigation relied heavily on satellite [21] telemetry for guidance.
System safety is enhanced by redundant emergency [22] brakes.
Urban deployments face significant regulatory [23] hurdles.

Questions 24-26
The benefits of automated vehicles include reduced traffic [24] congestion.
Additionally, increased fuel [25] efficiency contributes to environmental savings.
Finally, passenger [26] comfort is expected to improve.

Answer Key:
20. obstacles
21. telemetry
22. brakes
23. hurdles
24. congestion
25. efficiency
26. comfort
`;

    const parsed = parseSinglePassage(rawChunk, 2, {}, {});

    // Overlapping groups must be consolidated into a single unified group
    assert.strictEqual(
      parsed.questionGroups.length,
      1,
      'Must consolidate overlapping Summary Completion groups into 1 single group'
    );
    assert.strictEqual(
      parsed.questions.length,
      7,
      'Must contain all 7 questions (20 to 26)'
    );

    const group = parsed.questionGroups[0];
    assert.ok(
      group.groupTitle?.includes('20') && group.groupTitle?.includes('26'),
      `Group title should reflect the full 20–26 range, got: ${group.groupTitle}`
    );
    assert.ok(
      group.questions.some((q) => q.id === 'q_20'),
      'Must contain Q20'
    );
    assert.ok(
      group.questions.some((q) => q.id === 'q_26'),
      'Must contain Q26'
    );
  });

  await t.test('3. Multiple Selection MCQ: prompt extraction, single rendering, and pooled grading', () => {
    const rawChunk = `READING PASSAGE 3
The Psychology of Human Motivation
Human behavior is governed by a complex hierarchy of psychological drives.

Questions 32-34
Choose THREE letters, A-F.
Write your answers in boxes 32-34 on your answer sheet.
Which THREE of the following statements are true of the study of drives?

A. Primary drives are strictly biological in nature.
B. Social incentives can supersede fundamental physiological needs.
C. Drive reduction theory fully explains all creative behavior.
D. Intrinsic motivation increases task persistence over time.
E. External rewards always enhance long-term interest.
F. Modern neuroscience has identified specific reward circuitry.

Answer Key:
32. B
33. D
34. F
`;

    const parsed = parseSinglePassage(rawChunk, 3, {}, {});
    assert.strictEqual(parsed.questions.length, 3, 'Must extract 3 questions for Q32-34');

    const q32 = parsed.questions[0];
    const q33 = parsed.questions[1];
    const q34 = parsed.questions[2];

    // Check prompt integrity: prompt MUST NOT be contaminated with instructions or lost
    assert.ok(
      q32.prompt?.includes('Which THREE of the following statements are true'),
      `Prompt must contain actual question statement, got: ${q32.prompt}`
    );
    assert.ok(
      !q32.prompt?.startsWith('Choose THREE letters'),
      'Prompt must NOT start with instruction directive'
    );
    assert.strictEqual(q32.type, 'multiple_select');
    assert.strictEqual(q32.multipleSelectCount, 3);
    assert.strictEqual(q32.options?.length, 6);

    // Test official IELTS Pooled Answer Grading (order independent)
    // Student answers in different order: Q32='D', Q33='B', Q34='F'
    const studentAnswersOrder1 = {
      q_32: 'D',
      q_33: 'B',
      q_34: 'F',
    };
    const gradeRes1 = gradeAssignmentSubmission(parsed.questions, studentAnswersOrder1);
    assert.strictEqual(gradeRes1.correctCount, 3, 'All 3 must be correct regardless of order');
    assert.strictEqual(gradeRes1.earnedScore, 3, 'Earned score must be 3 points');

    // Partial correct: 2 correct, 1 incorrect ('A' instead of 'F')
    const studentAnswersOrder2 = {
      q_32: 'F',
      q_33: 'A', // Incorrect
      q_34: 'D', // Correct
    };
    const gradeRes2 = gradeAssignmentSubmission(parsed.questions, studentAnswersOrder2);
    assert.strictEqual(gradeRes2.correctCount, 2, '2 correct answers from the pool');
    assert.strictEqual(gradeRes2.incorrectCount, 1, '1 incorrect answer');
    assert.strictEqual(gradeRes2.earnedScore, 2, 'Earned score must be 2 points');
  });

  await t.test('4. Comprehensive Question Type Audit Across All IELTS Types', () => {
    const testCases: Array<{ instruction: string; prompt: string; expectedType: string }> = [
      {
        instruction: 'Choose the correct letter, A, B, C or D.',
        prompt: 'The primary purpose of the experiment was to',
        expectedType: 'multiple_choice',
      },
      {
        instruction: 'Do the following statements agree with the information given in the passage? TRUE / FALSE / NOT GIVEN',
        prompt: 'The expedition succeeded in reaching the summit in winter.',
        expectedType: 'true_false_not_given',
      },
      {
        instruction: 'Do the following statements agree with the views of the writer? YES / NO / NOT GIVEN',
        prompt: 'Governments should prioritize funding for sustainable agriculture.',
        expectedType: 'yes_no_not_given',
      },
      {
        instruction: 'Choose the correct heading for each paragraph from the list of headings below.',
        prompt: 'Paragraph A',
        expectedType: 'matching_headings',
      },
      {
        instruction: 'Which paragraph contains the following information? Write the correct letter, A-G.',
        prompt: 'a mention of the technological limitations of early radar systems',
        expectedType: 'matching_information',
      },
      {
        instruction: 'Look at the following researchers and the list of findings below. Match each researcher with the correct finding.',
        prompt: 'Dr. Evelyn Reed',
        expectedType: 'matching_features',
      },
      {
        instruction: 'Complete each sentence with the correct ending, A-F, below.',
        prompt: 'High-altitude glaciers in the Andes',
        expectedType: 'matching_sentence_endings',
      },
      {
        instruction: 'Complete the summary using the list of words, A-I, below.',
        prompt: 'Urban planners now emphasize the importance of [15] infrastructure.',
        expectedType: 'summary_completion',
      },
      {
        instruction: 'Complete the notes below. Choose ONE WORD ONLY from the passage.',
        prompt: '• Average precipitation: (12) millimeters per year',
        expectedType: 'note_completion',
      },
      {
        instruction: 'Complete the table below. Choose NO MORE THAN TWO WORDS.',
        prompt: 'Standard turbine capacity: [8] megawatts',
        expectedType: 'table_completion',
      },
      {
        instruction: 'Complete the flow-chart below. Choose NO MORE THAN ONE WORD.',
        prompt: 'Step 1: Extract natural [5] compounds from raw sediment.',
        expectedType: 'flowchart_completion',
      },
      {
        instruction: 'Label the diagram below. Choose NO MORE THAN TWO WORDS.',
        prompt: 'Combustion chamber intake [2]',
        expectedType: 'diagram_completion',
      },
      {
        instruction: 'Answer the questions below. Choose NO MORE THAN THREE WORDS.',
        prompt: 'What was the main commercial crop produced in the colony?',
        expectedType: 'short_answer',
      },
    ];

    for (const tc of testCases) {
      const detected = detectQuestionType(tc.prompt, tc.instruction);
      assert.strictEqual(
        detected,
        tc.expectedType,
        `Question type detection failed for: "${tc.instruction}". Expected: ${tc.expectedType}, Got: ${detected}`
      );
    }
  });

  await t.test('5. Safe JSON Library Resource Handling Without Regex Re-parsing', () => {
    // Structured JSON resource representing an imported test in Materials Library
    const resourceContent = JSON.stringify({
      title: 'Passage 1: Architecture of Ancient Rome',
      skill: 'reading',
      readingPassage: 'Ancient Roman concrete was remarkably durable.',
      passages: [
        {
          id: 'p_1',
          passageIndex: 0,
          title: 'Architecture of Ancient Rome',
          content: 'Ancient Roman concrete was remarkably durable.',
          questions: [
            { id: 'q_1', prompt: 'Roman concrete contained volcanic ash.', type: 'true_false_not_given', correctAnswer: 'TRUE' },
            { id: 'q_2', prompt: 'Monuments required annual maintenance.', type: 'true_false_not_given', correctAnswer: 'FALSE' },
          ],
          questionGroups: [
            {
              id: 'g_0',
              groupTitle: 'Questions 1-2',
              instructions: 'TRUE / FALSE / NOT GIVEN',
              questionType: 'true_false_not_given',
              questions: [
                { id: 'q_1', prompt: 'Roman concrete contained volcanic ash.', type: 'true_false_not_given', correctAnswer: 'TRUE' },
                { id: 'q_2', prompt: 'Monuments required annual maintenance.', type: 'true_false_not_given', correctAnswer: 'FALSE' },
              ],
            },
          ],
        },
      ],
      questions: [
        { id: 'q_1', prompt: 'Roman concrete contained volcanic ash.', type: 'true_false_not_given', correctAnswer: 'TRUE' },
        { id: 'q_2', prompt: 'Monuments required annual maintenance.', type: 'true_false_not_given', correctAnswer: 'FALSE' },
      ],
    });

    // Verification: Parsing JSON directly must never corrupt groups or create fake passages
    const parsed = JSON.parse(resourceContent);
    const extracted = extractAllNormalizedQuestions(parsed);

    assert.strictEqual(extracted.questions.length, 2, 'Must extract exactly 2 questions');
    assert.strictEqual(extracted.passages.length, 1, 'Must extract exactly 1 passage');
    assert.strictEqual(extracted.questionGroups.length, 1, 'Must extract exactly 1 question group');
    assert.strictEqual(extracted.questionGroups[0].groupTitle, 'Questions 1-2');
  });

  await t.test('6. Navigator Question Parity and Anchor Resolution', () => {
    const rawPassage = `READING PASSAGE 1
Deep Sea Exploration
Submersibles allow humans to explore ocean trenches.

Questions 1-3
TRUE / FALSE / NOT GIVEN
1. Light penetrates to the deepest ocean trenches.
2. Pressure at the seabed can crush standard hulls.
3. Vent ecosystems survive without sunlight.

Questions 4-6
Choose ONE WORD ONLY from the passage.
• Trench depth reaches eleven (4) kilometers.
• Microbes utilize chemosynthetic (5) pathways.
• Mineral deposits form hydrothermal (6) chimneys.

Answer Key:
1. FALSE
2. TRUE
3. TRUE
4. kilometers
5. pathways
6. chimneys
`;

    const parsed = parseSinglePassage(rawPassage, 1, {}, {});
    const renderGroups = buildQuestionRenderGroups(
      parsed.questions.map((q, idx) => ({ q, idx, absoluteIdx: idx, passageIndex: 0 }))
    );

    // Count all questions rendered across all groups
    const totalRenderedQuestions = renderGroups.reduce((acc, g) => acc + g.questions.length, 0);
    assert.strictEqual(
      totalRenderedQuestions,
      parsed.questions.length,
      'Navigator count must exactly match the number of rendered question items'
    );
    assert.strictEqual(totalRenderedQuestions, 6, 'Total questions must be 6');
  });

  await t.test('7. Authentic Question Numbering & Extraction Integrity', () => {
    const q1 = { id: 'q_14', prompt: 'Which of the following is true?', questionNumber: 14 };
    const q2 = { id: 'q_custom_id', prompt: '27. The author suggests that...', type: 'multiple_choice' };
    const q3 = { id: 'q_gen_blank', prompt: '• Research began in (32) Scotland.' };
    const q4 = { id: 'uuid-123-456', prompt: 'Question without any number' };

    assert.strictEqual(extractQuestionNumber(q1), 14, 'Must extract from questionNumber or q_14');
    assert.strictEqual(extractQuestionNumber(q2), 27, 'Must extract leading 27. from prompt');
    assert.strictEqual(extractQuestionNumber(q3), 32, 'Must extract blank (32) from prompt');
    assert.strictEqual(extractQuestionNumber(q4, 5), 5, 'Must fallback to fallbackIndex when provided');
  });

  await t.test('8. Non-standard 14-question Passage 1 Partition Parity', () => {
    // IELTS Reading test with 14 questions in Passage 1, 13 in Passage 2, 13 in Passage 3
    const p1Questions = Array.from({ length: 14 }, (_, i) => ({
      id: `q_${i + 1}`,
      questionNumber: i + 1,
      prompt: `Passage 1 Question ${i + 1}`,
      type: 'true_false_not_given' as const,
      correctAnswer: 'TRUE',
      explanation: '',
    }));

    const p2Questions = Array.from({ length: 13 }, (_, i) => ({
      id: `q_${i + 15}`,
      questionNumber: i + 15,
      prompt: `Passage 2 Question ${i + 15}`,
      type: 'multiple_choice' as const,
      correctAnswer: 'A',
      explanation: '',
    }));

    const p3Questions = Array.from({ length: 13 }, (_, i) => ({
      id: `q_${i + 28}`,
      questionNumber: i + 28,
      prompt: `Passage 3 Question ${i + 28}`,
      type: 'summary_completion' as const,
      correctAnswer: 'word',
      explanation: '',
    }));

    const assignment = {
      passages: [
        { id: 'p_1', title: 'Passage 1', content: 'Text 1', questions: p1Questions, questionGroups: [{ id: 'g_1', groupTitle: 'Questions 1–14', questions: p1Questions, questionType: 'true_false_not_given' as const, instructions: '' }] },
        { id: 'p_2', title: 'Passage 2', content: 'Text 2', questions: p2Questions, questionGroups: [{ id: 'g_2', groupTitle: 'Questions 15–27', questions: p2Questions, questionType: 'multiple_choice' as const, instructions: '' }] },
        { id: 'p_3', title: 'Passage 3', content: 'Text 3', questions: p3Questions, questionGroups: [{ id: 'g_3', groupTitle: 'Questions 28–40', questions: p3Questions, questionType: 'summary_completion' as const, instructions: '' }] },
      ],
      readingQuestions: [...p1Questions, ...p2Questions, ...p3Questions],
    };

    const extracted = extractAllNormalizedQuestions(assignment);
    assert.strictEqual(extracted.questions.length, 40, 'Total questions must be exactly 40');

    // Verify Question 14 is assigned strictly to Passage 0 (Passage 1)
    assert.strictEqual(extracted.passageMap['q_14'], 0, 'Question 14 must belong to Passage 1');
    assert.strictEqual(extracted.passageMap['q_15'], 1, 'Question 15 must belong to Passage 2');
    assert.strictEqual(extracted.passageMap['q_27'], 1, 'Question 27 must belong to Passage 2');
    assert.strictEqual(extracted.passageMap['q_28'], 2, 'Question 28 must belong to Passage 3');
    assert.strictEqual(extracted.passageMap['q_40'], 2, 'Question 40 must belong to Passage 3');

    // Verify passages have exact question counts without stealing
    assert.strictEqual(extracted.passages[0].questions?.length, 14, 'Passage 1 must have 14 questions');
    assert.strictEqual(extracted.passages[1].questions?.length, 13, 'Passage 2 must have 13 questions');
    assert.strictEqual(extracted.passages[2].questions?.length, 13, 'Passage 3 must have 13 questions');
  });

  await t.test('9. Out-of-order Questions Input Normalizes to Exact Ascending Sequence', () => {
    // Unordered input questions
    const scramble = [
      { id: 'q_20', questionNumber: 20, prompt: '20. Twentieth' },
      { id: 'q_5', questionNumber: 5, prompt: '5. Fifth' },
      { id: 'q_1', questionNumber: 1, prompt: '1. First' },
      { id: 'q_12', questionNumber: 12, prompt: '12. Twelfth' },
    ];

    const extracted = extractAllNormalizedQuestions({ readingQuestions: scramble });
    const numbers = extracted.questions.map((q) => extractQuestionNumber(q));
    assert.deepStrictEqual(numbers, [1, 5, 12, 20], 'Questions must sort into ascending authentic question order');
  });

  await t.test('10. Clean Question Prompt Removes Group Instructions and Redundant Prefixes', () => {
    const rawInstruction = 'Do the following statements agree with the views of the writer? Write YES / NO / NOT GIVEN in boxes 1-5.';
    const promptWithInstruction = 'Do the following statements agree with the views of the writer? Write YES / NO / NOT GIVEN in boxes 1-5. 1. The city was founded in 1850.';
    const cleaned = cleanQuestionPrompt(promptWithInstruction, 1, rawInstruction);

    assert.strictEqual(cleaned, 'The city was founded in 1850.', 'Must strip duplicate group instructions and redundant "1."');
  });
});
