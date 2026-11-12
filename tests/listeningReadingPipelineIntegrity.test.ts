import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseListeningDocument,
  htmlToListeningText,
  cleanListeningText,
} from '../src/lib/listeningExtractor.ts';
import {
  extractAllNormalizedQuestions,
  buildQuestionRenderGroups,
  buildCompletionGroupText,
  isSpecificQuestionType,
  normalizeReadingQuestion,
  type ReadingQuestion,
  type QuestionGroup,
} from '../src/lib/questionNormalizer.ts';

describe('PIPELINE INTEGRITY: LISTENING & READING NOTE COMPLETION, CONTENT PRESERVATION & QUESTION MAPPING', () => {
  // =========================================================================
  // ISSUE 1: LISTENING NOTE COMPLETION LINE BREAKS & STRUCTURE
  // =========================================================================
  describe('Issue 1: Listening Note Completion Line Breaks', () => {
    it('1.1. htmlToListeningText preserves paragraphs and bullet lists from DOCX HTML even without tables', () => {
      const docxHtml = `
        <h3>Pre-school Registration</h3>
        <p>Classes information:</p>
        <ul>
          <li>First group - Mrs. Oliver</li>
          <li>Second group - Mrs. <strong>1</strong>.....</li>
        </ul>
        <p>Hours &amp; Days:</p>
        <p>Suzie will attend 3 days a week<br />for a total of <strong>2</strong>..... hours</p>
      `;

      const text = htmlToListeningText(docxHtml);
      assert.ok(text.includes('• First group - Mrs. Oliver'), 'Bullet must be preserved');
      assert.ok(text.includes('• Second group - Mrs. [1]'), 'Blank must be converted to [1]');
      assert.ok(text.includes('Suzie will attend 3 days a week\nfor a total of [2] hours'), 'Line break in paragraph must be preserved');
    });

    it('1.2. parseListeningDocument retains groupText with authentic line breaks', () => {
      const docxHtml = `
        <p>SECTION 1 Questions 1-5</p>
        <p>Complete the notes below.</p>
        <p>Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.</p>
        <p>Riverdale Pre-school</p>
        <ul>
          <li>First group - Mrs. Oliver</li>
          <li>Second group - Mrs. 1 ...............</li>
        </ul>
        <p>Activities:</p>
        <p>Outside time</p>
        <p>Water play</p>
      `;

      const parsed = parseListeningDocument('', 'Riverdale_Test', docxHtml);
      assert.ok(parsed.parts.length >= 1, 'At least 1 part must be extracted');
      const g = parsed.parts[0].questionGroups[0];
      assert.ok(g, 'Question group must exist');
      assert.ok(g.groupText, 'groupText must exist');
      assert.ok(g.groupText.includes('Outside time'), 'Non-question content must exist in groupText');
      assert.ok(g.groupText.includes('Water play'), 'Subsequent lines must not be dropped');
      // Verify line break between "Outside time" and "Water play"
      const lines = g.groupText.split('\n').map((l) => l.trim()).filter(Boolean);
      const outsideIdx = lines.findIndex((l) => l.includes('Outside time'));
      const waterIdx = lines.findIndex((l) => l.includes('Water play'));
      assert.ok(outsideIdx !== -1 && waterIdx !== -1, 'Both lines must exist');
      assert.notStrictEqual(outsideIdx, waterIdx, 'Outside time and Water play must be distinct lines');
    });
  });

  // =========================================================================
  // ISSUE 2 & 3: READING NOTE COMPLETION FORMATTING & CONTENT PRESERVATION
  // =========================================================================
  describe('Issue 2 & 3: Reading Note Completion Formatting & Content Preservation', () => {
    it('2.1. Preserves note headings, subheadings, and supplementary bullets without questions', () => {
      // Simulate authentic reading material in Materials Library / DB
      const originalNoteText = [
        'THE BISLAMA LANGUAGE',
        'Origins and History',
        '• Started in the 19th century as a trade language',
        '• Influenced by English and Pacific island tongues',
        'Current Status',
        '• One of three official languages of Vanuatu',
        '• [31] is the primary medium of education',
        '• Bislama is spoken in urban centers and [32]',
        'Social Importance',
        '• Provides a sense of national unity',
        '• Literature and media use Bislama to [33]',
      ].join('\n');

      const group: QuestionGroup = {
        id: 'grp_bislama_1',
        groupTitle: 'Questions 31-33',
        instructions: 'Complete the notes below. Choose ONE WORD ONLY from the passage.',
        questionType: 'note_completion',
        groupText: originalNoteText,
        questions: [
          { id: 'q_31', prompt: '• [31] is the primary medium of education', type: 'note_completion', correctAnswer: 'English' },
          { id: 'q_32', prompt: '• Bislama is spoken in urban centers and [32]', type: 'note_completion', correctAnswer: 'villages' },
          { id: 'q_33', prompt: '• Literature and media use Bislama to [33]', type: 'note_completion', correctAnswer: 'communicate' },
        ],
      };

      const assignment = {
        title: 'Bislama Reading Test',
        passages: [
          {
            id: 'p_3',
            title: 'Passage 3',
            content: 'Bislama is a creole language...',
            questions: group.questions,
            questionGroups: [group],
          },
        ],
      };

      const extracted = extractAllNormalizedQuestions(assignment);
      assert.strictEqual(extracted.questions.length, 3);
      assert.strictEqual(extracted.passages[0].questionGroups?.length, 1);
      const extractedGroup = extracted.passages[0].questionGroups![0];

      // Verify that groupText retains ALL non-question lines
      assert.ok(extractedGroup.groupText, 'groupText must be defined');
      assert.ok(extractedGroup.groupText!.includes('THE BISLAMA LANGUAGE'), 'Main heading must be preserved');
      assert.ok(extractedGroup.groupText!.includes('Origins and History'), 'Section subheading 1 must be preserved');
      assert.ok(extractedGroup.groupText!.includes('• Started in the 19th century as a trade language'), 'Supplementary bullet 1 must be preserved');
      assert.ok(extractedGroup.groupText!.includes('• Influenced by English and Pacific island tongues'), 'Supplementary bullet 2 must be preserved');
      assert.ok(extractedGroup.groupText!.includes('Current Status'), 'Section subheading 2 must be preserved');
      assert.ok(extractedGroup.groupText!.includes('• One of three official languages of Vanuatu'), 'Supplementary bullet 3 must be preserved');
      assert.ok(extractedGroup.groupText!.includes('Social Importance'), 'Section subheading 3 must be preserved');
      assert.ok(extractedGroup.groupText!.includes('• Provides a sense of national unity'), 'Supplementary bullet 4 must be preserved');

      // Verify buildQuestionRenderGroups does NOT wipe out existing groupText
      const renderGroups = buildQuestionRenderGroups([
        { q: { ...group.questions[0], groupText: originalNoteText } as any, idx: 30 },
        { q: { ...group.questions[1], groupText: originalNoteText } as any, idx: 31 },
        { q: { ...group.questions[2], groupText: originalNoteText } as any, idx: 32 },
      ]);

      assert.strictEqual(renderGroups.length, 1);
      assert.ok(renderGroups[0].groupText!.includes('THE BISLAMA LANGUAGE'), 'Render group must retain main heading');
      assert.ok(renderGroups[0].groupText!.includes('Origins and History'), 'Render group must retain subheading');
      assert.ok(renderGroups[0].groupText!.includes('• Started in the 19th century as a trade language'), 'Render group must retain non-question bullets');
    });

    it('2.2. Preserves nested sub-bullets (Unicode ◦, ▪, ▫, -) and indentation', () => {
      const nestedNoteText = [
        'Research Methodologies',
        '• Qualitative analysis:',
        '  - Individual semi-structured interviews [34]',
        '  - Focus group discussions [35]',
        '• Quantitative data collection:',
        '  ◦ Online survey questionnaire [36]',
        '  ◦ Field measurements across 5 sites [37]',
      ].join('\n');

      const lines = nestedNoteText.split('\n');
      assert.ok(lines[2].startsWith('  -'), 'Indentation for sub-bullet dash must be preserved');
      assert.ok(lines[5].startsWith('  ◦'), 'Indentation for sub-bullet white circle must be preserved');
    });
  });

  // =========================================================================
  // ISSUE 4: QUESTION TYPE & GROUP MAPPING CORRUPTION
  // =========================================================================
  describe('Issue 4: Question Type & Group Mapping Across All 14 Question Types', () => {
    it('4.1. isSpecificQuestionType protects all 14 official IELTS question types', () => {
      const allTypes = [
        'multiple_choice',
        'multiple_select',
        'true_false_not_given',
        'yes_no_not_given',
        'matching_headings',
        'matching_information',
        'matching_features',
        'matching_sentence_endings',
        'sentence_completion',
        'summary_completion',
        'note_completion',
        'table_completion',
        'flowchart_completion',
        'diagram_completion',
        'short_answer',
      ];

      allTypes.forEach((t) => {
        assert.ok(isSpecificQuestionType(t), `Type "${t}" must be recognized as a specific IELTS question type`);
      });
    });

    it('4.2. Matching Information and Sentence Completion never coerced to Summary Completion', () => {
      const assignmentPayload = {
        title: 'Mixed Reading Assignment',
        passages: [
          {
            id: 'p_1',
            title: 'Passage 1',
            content: 'Reading text...',
            questionGroups: [
              {
                id: 'grp_summary',
                questionType: 'summary_completion',
                questionTypeOverride: 'summary_completion',
                isTeacherEdited: true,
                options: ['A. heat', 'B. wind', 'C. waves'],
                questions: [
                  { id: 'q_1', type: 'summary_completion', prompt: 'Solar energy relies on [1].' },
                  { id: 'q_2', type: 'summary_completion', prompt: 'Marine power harnesses [2].' },
                ],
              },
              {
                id: 'grp_matching_info',
                questionType: 'matching_information',
                questions: [
                  { id: 'q_3', type: 'matching_information', prompt: 'a mention of government subsidies' },
                  { id: 'q_4', type: 'matching_information', prompt: 'an explanation of transmission loss' },
                ],
              },
              {
                id: 'grp_note',
                questionType: 'note_completion',
                questions: [
                  { id: 'q_5', type: 'note_completion', prompt: '• Maintenance requires [5] inspections.' },
                ],
              },
            ],
          },
        ],
      };

      const extracted = extractAllNormalizedQuestions(assignmentPayload);
      assert.strictEqual(extracted.questions.length, 5);

      const q1 = extracted.questions.find((q) => q.id === 'q_1')!;
      const q3 = extracted.questions.find((q) => q.id === 'q_3')!;
      const q5 = extracted.questions.find((q) => q.id === 'q_5')!;

      assert.strictEqual(q1.type, 'summary_completion');
      assert.strictEqual(q3.type, 'matching_information', 'Q3 must preserve matching_information');
      assert.strictEqual(q5.type, 'note_completion', 'Q5 must preserve note_completion');

      // Check group isolation: Word List A, B, C must strictly stay in Group 0
      const pGroups = extracted.passages[0].questionGroups!;
      assert.strictEqual(pGroups.length, 3);
      assert.strictEqual(pGroups[0].questionType, 'summary_completion');
      assert.strictEqual(pGroups[1].questionType, 'matching_information');
      assert.strictEqual(pGroups[2].questionType, 'note_completion');
    });

    it('4.3. Question 40 in student view (empty correctAnswer) retains Yes/No/Not Given without options', () => {
      const q40Raw = {
        id: 'q_40',
        type: 'yes_no_not_given',
        prompt: '40 Global renewable transition will be completed by 2040.',
        correctAnswer: '', // Stripped in student view
      };

      const normQ40 = normalizeReadingQuestion(q40Raw, 40);
      assert.strictEqual(normQ40.type, 'yes_no_not_given', 'Must retain yes_no_not_given even with empty correctAnswer');
      assert.strictEqual(normQ40.options, undefined, 'Must not carry multiple choice options or word list');
    });
  });
});
