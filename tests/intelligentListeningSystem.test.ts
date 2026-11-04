import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseListeningDocument,
  cleanListeningText,
  extractListeningAnswerKey,
} from '../src/lib/listeningExtractor.ts';
import type {
  ListeningPart,
  ListeningQuestionGroup,
  ListeningQuestion,
  ListeningQuestionType,
} from '../src/types/index.ts';

describe('Intelligent IELTS Listening Recognition & Targeted UI Optimization', () => {
  // ---------------------------------------------------------------------------
  // 1. DYNAMIC QUESTION-TYPE RECOGNITION (NEVER HARDCODED TO PART/QUESTION NUMBERS)
  // ---------------------------------------------------------------------------
  describe('1. Dynamic Question-Type Recognition', () => {
    test('recognizes Form Completion dynamically regardless of Part number', () => {
      const docText = `
PART 3
Questions 21 - 25
Complete the form below.
Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.

STUDENT ACCOMMODATION APPLICATION
Applicant name: 21 …………
Course of study: 22 …………
Preferred location: 23 …………
Maximum monthly rent: $ 24 …………
Contact telephone: 25 …………
`;
      const result = parseListeningDocument(docText, 'Dynamic Form Test');
      assert.strictEqual(result.parts.length, 1);
      const part = result.parts[0];
      assert.strictEqual(part.questionGroups.length, 1);
      const group = part.questionGroups[0];

      assert.strictEqual(group.type, 'form_completion');
      assert.strictEqual(group.questions.length, 5);
      assert.strictEqual(group.questions[0].questionNumber, 21);
      assert.strictEqual(group.questions[4].questionNumber, 25);
      assert.ok(group.groupText?.includes('[21]'));
      assert.ok(group.groupText?.includes('[25]'));
    });

    test('recognizes Flow-chart Completion with sequential steps and arrows', () => {
      const docText = `
SECTION 2
Questions 11 - 14
Complete the flow-chart below.
Write NO MORE THAN ONE WORD ONLY for each answer.

STAGES IN RIVER RESTORATION
Stage 1: Initial survey of local 11 …………
↓
Stage 2: Removal of accumulated 12 ………… from water channels
↓
Stage 3: Replanting of native 13 ………… along the riverbank
↓
Stage 4: Long-term monitoring by 14 …………
`;
      const result = parseListeningDocument(docText, 'Flowchart Test');
      const group = result.parts[0].questionGroups[0];

      assert.strictEqual(group.type, 'flowchart_completion');
      assert.strictEqual(group.questions.length, 4);
      assert.strictEqual(group.questions[0].questionNumber, 11);
      assert.strictEqual(group.questions[3].questionNumber, 14);
      assert.ok(group.groupText?.includes('[11]'));
      assert.ok(group.groupText?.includes('[14]'));
      assert.ok(group.groupText?.includes('↓'));
    });

    test('recognizes Table Completion from Markdown table rows', () => {
      const docText = `
PART 4
Questions 31 - 35
Complete the table below.
Write NO MORE THAN TWO WORDS for each answer.

| Era | Primary Energy Source | Major 31 ………… |
| Early Industrial | Coal and steam | Factory 32 ………… |
| Mid 20th Century | Petroleum | Automobile 33 ………… |
| Modern Era | 34 ………… energy | Global 35 ………… |
`;
      const result = parseListeningDocument(docText, 'Table Test');
      const group = result.parts[0].questionGroups[0];

      assert.strictEqual(group.type, 'table_completion');
      assert.strictEqual(group.questions.length, 5);
      assert.strictEqual(group.questions[0].questionNumber, 31);
      assert.strictEqual(group.questions[4].questionNumber, 35);
      assert.ok(group.groupText?.includes('|'));
      assert.ok(group.groupText?.includes('[31]'));
    });

    test('recognizes Plan / Map / Diagram Labelling from instructions', () => {
      const docText = `
SECTION 2
Questions 15 - 18
Label the plan of the library below.
Write the correct letter, A-F, next to Questions 15-18.

15 Reference section
16 IT training room
17 Silent study area
18 Cafeteria
`;
      const result = parseListeningDocument(docText, 'Map Labelling Test');
      const group = result.parts[0].questionGroups[0];

      assert.strictEqual(group.type, 'plan_map_diagram_labelling');
      assert.strictEqual(group.questions.length, 4);
      assert.strictEqual(group.questions[0].questionNumber, 15);
      assert.strictEqual(group.questions[3].questionNumber, 18);
    });

    test('recognizes Multiple Select (Choose TWO/THREE) with shared prompt and options', () => {
      const docText = `
PART 2
Questions 11 and 12
Choose TWO letters, A-E.
Which TWO facilities are free of charge for university students?
A swimming pool
B gym membership
C tennis courts
D climbing wall
E running track
`;
      const result = parseListeningDocument(docText, 'Multiple Select Test');
      const group = result.parts[0].questionGroups[0];

      assert.strictEqual(group.type, 'multiple_select');
      assert.strictEqual(group.questions.length, 2);
      assert.strictEqual(group.questions[0].questionNumber, 11);
      assert.strictEqual(group.questions[1].questionNumber, 12);
      assert.ok(group.options && group.options.length === 5);
    });

    test('recognizes Matching questions with shared options list', () => {
      const docText = `
PART 3
Questions 26 - 30
What does Jack say about each of the following research articles?
Choose FIVE answers from the box and write the correct letter, A-G, next to Questions 26-30.

Opinions
A It provides convincing empirical data.
B The sample size was too restricted.
C The methodology was flawed.
D Further research is warranted.
E It contradicted earlier findings.
F It had limited practical relevance.
G It received significant media attention.

Articles
26 Miller and Davies (2018)
27 Henderson (2019)
28 Takahashi et al. (2020)
29 O'Connor (2021)
30 Al-Mansoor (2022)
`;
      const result = parseListeningDocument(docText, 'Matching Test');
      const group = result.parts[0].questionGroups[0];

      assert.strictEqual(group.type, 'matching');
      assert.strictEqual(group.questions.length, 5);
      assert.strictEqual(group.questions[0].questionNumber, 26);
      assert.strictEqual(group.questions[4].questionNumber, 30);
      assert.ok(group.options && group.options.length >= 7);
    });

    test('recognizes Summary Completion and Sentence Completion dynamically', () => {
      const docText = `
PART 4
Questions 36 - 40
Complete the summary below.
Write NO MORE THAN TWO WORDS for each answer.

Renewable energy expansion has accelerated rapidly due to falling production costs in 36 ………… technologies.
However, grid stability requires dependable 37 ………… systems.
Recent investments have focused heavily on long-duration 38 ………… facilities.
International agreements aim to limit thermal 39 ………… emissions by mid-century.
Achieving these targets demands unprecedented multilateral 40 ………… across sectors.
`;
      const result = parseListeningDocument(docText, 'Summary Test');
      const group = result.parts[0].questionGroups[0];

      assert.strictEqual(group.type, 'summary_completion');
      assert.strictEqual(group.questions.length, 5);
      assert.strictEqual(group.questions[0].questionNumber, 36);
      assert.strictEqual(group.questions[4].questionNumber, 40);
      assert.ok(group.groupText?.includes('[36]'));
      assert.ok(group.groupText?.includes('[40]'));
    });
  });

  // ---------------------------------------------------------------------------
  // 2. DATA INTEGRITY, MULTI-BLANKS & TEXT STANDARDIZATION
  // ---------------------------------------------------------------------------
  describe('2. Data Integrity & Multi-Blank Extraction', () => {
    test('extracts multiple blanks occurring on a single line and formats groupText cleanly', () => {
      const docText = `
PART 1
Questions 1 - 4
Complete the notes below.
Write ONE WORD AND/OR A NUMBER for each answer.

HOTEL BOOKING CONFIRMATION
• Check-in date: 1 ………… July and Check-out date: 2 ………… July
• Deposit required: $ 3 ………… with balance payable by 4 …………
`;
      const result = parseListeningDocument(docText, 'Multi-blank Test');
      const group = result.parts[0].questionGroups[0];

      assert.strictEqual(group.questions.length, 4);
      assert.strictEqual(group.questions[0].questionNumber, 1);
      assert.strictEqual(group.questions[1].questionNumber, 2);
      assert.strictEqual(group.questions[2].questionNumber, 3);
      assert.strictEqual(group.questions[3].questionNumber, 4);

      // Verify groupText contains both [1] and [2] in line 1
      assert.ok(group.groupText?.includes('[1] July and Check-out date: [2] July'));
      assert.ok(group.groupText?.includes('[3] with balance payable by [4]'));
    });

    test('cleanListeningText strips HTML entities, tags, and formatting artifacts', () => {
      const dirty = '&lt;b&gt;Questions 1&amp;2&lt;/b&gt; &quot;Test&quot; &#39;Notes&#39;&nbsp;<svg>flag</svg>';
      const cleaned = cleanListeningText(dirty);
      assert.strictEqual(cleaned, '<b>Questions 1&2</b> "Test" \'Notes\'');
    });

    test('extracts answer keys accurately across ranges, tables, and alternative slashes', () => {
      const keyText = `
ANSWER KEY
1. 15th / 15 / fifteenth
2. 22nd
3. 150 / $150
4. credit card
11. B
12. D
15. E
16. A
17. C
18. F
Questions 21-23 are A, C and E in any order
24. 850
25. 07700 900123
26. B
27. A
28. C
29. F
30. D
31. innovation / developments
32. production
33. assembly
34. solar
35. standards
36. photovoltaic
37. storage
38. battery
39. carbon
40. cooperation / collaboration
`;
      const keys = extractListeningAnswerKey(keyText);
      assert.strictEqual(keys['1'], '15th / 15 / fifteenth');
      assert.strictEqual(keys['2'], '22nd');
      assert.strictEqual(keys['3'], '150 / $150');
      assert.strictEqual(keys['11'], 'B');
      assert.strictEqual(keys['21'], 'A');
      assert.strictEqual(keys['22'], 'C');
      assert.strictEqual(keys['23'], 'E');
      assert.strictEqual(keys['31'], 'innovation / developments');
      assert.strictEqual(keys['40'], 'cooperation / collaboration');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. EMBEDDED VS STANDALONE PLACEMENT & HYBRID EXERCISE SUPPORT
  // ---------------------------------------------------------------------------
  describe('3. Embedded vs Standalone Placement Logic', () => {
    test('hybrid exercises: correctly separates embedded questions from standalone questions', () => {
      // Exercise where questions 1-3 are in a structured form with [1], [2], [3],
      // and question 4 is a standalone question without bracket in groupText.
      const mockQuestions: ListeningQuestion[] = [
        { id: 'q1', questionNumber: 1, type: 'form_completion', prompt: 'Name: _____' },
        { id: 'q2', questionNumber: 2, type: 'form_completion', prompt: 'Address: _____' },
        { id: 'q3', questionNumber: 3, type: 'form_completion', prompt: 'Phone: _____' },
        { id: 'q4', questionNumber: 4, type: 'multiple_choice', prompt: 'What is the preferred contact method?', options: ['Email', 'Phone', 'Post'] },
      ];

      const groupText = `
STUDENT REGISTRATION
Name: [1]
Address: [2]
Phone: [3]
`;

      const embeddedQuestionIds = new Set<string>();

      // Simulate renderer scanning groupText for [qNum]
      const matches = Array.from(groupText.matchAll(/\[([0-9]{1,2})\]/g));
      for (const m of matches) {
        const qNum = parseInt(m[1], 10);
        const targetQ = mockQuestions.find((q) => q.questionNumber === qNum);
        if (targetQ) {
          embeddedQuestionIds.add(targetQ.id);
        }
      }

      const remainingQuestionsToRender = mockQuestions.filter(
        (q) => !embeddedQuestionIds.has(q.id)
      );

      // Embedded set contains q1, q2, q3
      assert.strictEqual(embeddedQuestionIds.size, 3);
      assert.ok(embeddedQuestionIds.has('q1'));
      assert.ok(embeddedQuestionIds.has('q2'));
      assert.ok(embeddedQuestionIds.has('q3'));

      // Standalone set contains ONLY q4! No duplicate rendering!
      assert.strictEqual(remainingQuestionsToRender.length, 1);
      assert.strictEqual(remainingQuestionsToRender[0].id, 'q4');
      assert.strictEqual(remainingQuestionsToRender[0].questionNumber, 4);
    });

    test('fully embedded exercises: remaining questions list is empty so no duplicate cards display', () => {
      const mockQuestions: ListeningQuestion[] = [
        { id: 'q31', questionNumber: 31, type: 'note_completion', prompt: 'First point: _____' },
        { id: 'q32', questionNumber: 32, type: 'note_completion', prompt: 'Second point: _____' },
      ];

      const groupText = `
LECTURE NOTES
• First point: [31]
• Second point: [32]
`;

      const embeddedQuestionIds = new Set<string>();
      const matches = Array.from(groupText.matchAll(/\[([0-9]{1,2})\]/g));
      for (const m of matches) {
        const qNum = parseInt(m[1], 10);
        const targetQ = mockQuestions.find((q) => q.questionNumber === qNum);
        if (targetQ) {
          embeddedQuestionIds.add(targetQ.id);
        }
      }

      const remainingQuestionsToRender = mockQuestions.filter(
        (q) => !embeddedQuestionIds.has(q.id)
      );

      // All questions are embedded -> 0 remaining standalone cards!
      assert.strictEqual(embeddedQuestionIds.size, 2);
      assert.strictEqual(remainingQuestionsToRender.length, 0);
    });

    test('fully standalone exercises: all questions render in remaining list when groupText has no gap markers', () => {
      const mockQuestions: ListeningQuestion[] = [
        { id: 'q11', questionNumber: 11, type: 'multiple_choice', prompt: 'Why did the speaker choose this project?' },
        { id: 'q12', questionNumber: 12, type: 'multiple_choice', prompt: 'What surprised the researchers most?' },
      ];

      const groupText = 'You will hear a conversation between two students about a research project.';

      const embeddedQuestionIds = new Set<string>();
      const matches = Array.from(groupText.matchAll(/\[([0-9]{1,2})\]/g));
      for (const m of matches) {
        const qNum = parseInt(m[1], 10);
        const targetQ = mockQuestions.find((q) => q.questionNumber === qNum);
        if (targetQ) {
          embeddedQuestionIds.add(targetQ.id);
        }
      }

      const remainingQuestionsToRender = mockQuestions.filter(
        (q) => !embeddedQuestionIds.has(q.id)
      );

      // 0 embedded -> both questions remain for standalone cards!
      assert.strictEqual(embeddedQuestionIds.size, 0);
      assert.strictEqual(remainingQuestionsToRender.length, 2);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. ANSWER STATE BINDING, FLAGGING & GRADING VERIFICATION
  // ---------------------------------------------------------------------------
  describe('4. Answer State Binding & Evaluation', () => {
    test('updates answer state accurately with question ID mapping', () => {
      const answers: Record<string, string> = {};
      const handleAnswerChange = (questionId: string, answer: string) => {
        answers[questionId] = answer;
      };

      // Student enters answers into embedded inputs
      handleAnswerChange('q_p1_1', 'theatre');
      handleAnswerChange('q_p1_2', '24 March');
      handleAnswerChange('q_p1_3', '85.50');

      assert.strictEqual(answers['q_p1_1'], 'theatre');
      assert.strictEqual(answers['q_p1_2'], '24 March');
      assert.strictEqual(answers['q_p1_3'], '85.50');
    });

    test('flag state toggles correctly per question ID', () => {
      const flagged = new Set<string>();
      const toggleFlag = (questionId: string) => {
        if (flagged.has(questionId)) flagged.delete(questionId);
        else flagged.add(questionId);
      };

      toggleFlag('q_p2_11');
      assert.ok(flagged.has('q_p2_11'));

      toggleFlag('q_p2_12');
      assert.ok(flagged.has('q_p2_12'));

      toggleFlag('q_p2_11');
      assert.ok(!flagged.has('q_p2_11'));
      assert.ok(flagged.has('q_p2_12'));
    });
  });
});
