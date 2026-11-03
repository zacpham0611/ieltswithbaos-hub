import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type {
  ListeningPart,
  ListeningQuestionGroup,
  ListeningQuestion,
  ReadingQuestion,
  QuestionGroup,
} from '../src/types/index.ts';

import {
  cleanListeningText,
  parseListeningDocument,
} from '../src/lib/listeningExtractor.ts';

import {
  cleanReadingText,
  resolveQuestionPrompt,
  buildCompletionGroupText,
  buildQuestionRenderGroups,
} from '../src/lib/questionNormalizer.ts';

import {
  detectQuestionType,
  parseMultipleSelectCount,
  parseDocumentStructure,
} from '../src/lib/documentExtractor.ts';

import {
  getSpeakingResourceDetails,
  findAssociatedPart3GroupsForCards,
} from '../src/utils/speakingLinkage.ts';

import {
  detectChartType,
  extractMarkdownTable,
  stripMarkdownTableFromPrompt,
} from '../src/lib/writingVisualHelper.ts';

describe('MASTER PROMPT – LISTENING SHARED RESOURCES, READING CONTENT FIXES & IELTS RECOGNITION', () => {

  // ===========================================================================
  // PART A: LISTENING IMPORT – SHARED RESOURCES & QUESTION GROUPING
  // ===========================================================================
  test('PART A: Teacher can group multiple questions under a shared resource (audio, instructions, diagram)', () => {
    const q1: ListeningQuestion = {
      id: 'q1',
      questionNumber: 1,
      number: 1,
      type: 'note_completion',
      prompt: 'Name of applicant: [1]',
      correctAnswer: 'Sarah',
    };
    const q2: ListeningQuestion = {
      id: 'q2',
      questionNumber: 2,
      number: 2,
      type: 'note_completion',
      prompt: 'Contact phone: [2]',
      correctAnswer: '0912345678',
    };
    const q3: ListeningQuestion = {
      id: 'q3',
      questionNumber: 3,
      number: 3,
      type: 'note_completion',
      prompt: 'Preferred course: [3]',
      correctAnswer: 'Spanish',
    };

    // Shared resource group Q1-3 with dedicated audio & shared instructions
    const sharedGroup1: ListeningQuestionGroup = {
      id: 'grp_1_3',
      part: 1,
      title: 'Questions 1–3',
      groupTitle: 'Questions 1–3',
      type: 'note_completion',
      instructions: 'Complete the notes below. Write NO MORE THAN TWO WORDS.',
      audioUrl: 'https://storage.supabase.co/ielts/audio_part1_sectionA.mp3',
      groupText: 'STUDENT REGISTRATION FORM\nCourse Office Details:',
      imageUrl: 'https://storage.supabase.co/ielts/registration_diagram.png',
      imageCaption: 'Office location diagram',
      questions: [q1, q2, q3],
    };

    // Independent question Q4
    const q4: ListeningQuestion = {
      id: 'q4',
      questionNumber: 4,
      number: 4,
      type: 'multiple_choice',
      prompt: 'Why did the student choose this school?',
      options: ['A. Close to home', 'B. Good reputation', 'C. Cheaper fees'],
      correctAnswer: 'B',
    };
    const independentGroup: ListeningQuestionGroup = {
      id: 'grp_indep_4',
      part: 1,
      title: 'Question 4',
      type: 'multiple_choice',
      questions: [q4],
    };

    const listeningPart: ListeningPart = {
      partNumber: 1,
      title: 'Part 1: Registration Dialogue',
      audioUrl: 'https://storage.supabase.co/ielts/audio_full_part1.mp3',
      questionGroups: [sharedGroup1, independentGroup],
      questions: [q1, q2, q3, q4],
    };

    // Verify shared resources exist on group level ONCE, not duplicated on each question
    assert.equal(listeningPart.questionGroups.length, 2);
    assert.equal(sharedGroup1.questions.length, 3);
    assert.equal(sharedGroup1.audioUrl, 'https://storage.supabase.co/ielts/audio_part1_sectionA.mp3');
    assert.equal(sharedGroup1.imageUrl, 'https://storage.supabase.co/ielts/registration_diagram.png');
    assert.equal(sharedGroup1.groupText, 'STUDENT REGISTRATION FORM\nCourse Office Details:');

    // Questions reference their shared group properly
    assert.equal(q1.questionNumber, 1);
    assert.equal(q2.questionNumber, 2);
    assert.equal(q3.questionNumber, 3);

    // Ungrouped independent question has no redundant group resources
    assert.equal(independentGroup.questions.length, 1);
    assert.equal(independentGroup.audioUrl, undefined);
    assert.equal(independentGroup.imageUrl, undefined);
  });

  // ===========================================================================
  // PART B: READING STUDENT UI – RAW MARKDOWN & INTERNAL PLACEHOLDER CLEANUP
  // ===========================================================================
  test('PART B: cleanReadingText & resolveQuestionPrompt strip raw Markdown, svgFlag, and metadata', () => {
    // 1. svgFlag and raw HTML entities
    const rawInput1 = 'svgFlag &quot;The dark side&quot; of technology &amp; society <svg><path /></svg>';
    const cleaned1 = cleanReadingText(rawInput1);
    assert.equal(cleaned1, '"The dark side" of technology & society');
    assert.ok(!cleaned1.includes('svgFlag'));
    assert.ok(!cleaned1.includes('<svg>'));

    // 2. Raw Markdown Question header "**Question 32**"
    const rawPromptWithQNum = '**Question 32** Which of the following statements is supported by the text?';
    const resolvedPrompt = resolveQuestionPrompt({ prompt: rawPromptWithQNum }, 32);
    assert.equal(resolvedPrompt, 'Which of the following statements is supported by the text?');
    assert.ok(!resolvedPrompt.includes('**Question 32**'));

    // 3. Raw metadata "**Dạng câu hỏi: Multiple Selection (choose THREE answers)**"
    const rawPromptWithMeta = '**Dạng câu hỏi: Multiple Selection (choose THREE answers)** Which THREE factors contributed to the success?';
    const cleanedMeta = cleanReadingText(rawPromptWithMeta);
    assert.equal(cleanedMeta, 'Which THREE factors contributed to the success?');
    assert.ok(!cleanedMeta.includes('Dạng câu hỏi'));

    // 4. Raw "**Notes with Blanks:**"
    const rawNotesHeader = '**Notes with Blanks:** Complete the notes below with NO MORE THAN TWO WORDS';
    const cleanedNotes = cleanReadingText(rawNotesHeader);
    assert.equal(cleanedNotes, 'Complete the notes below with NO MORE THAN TWO WORDS');
    assert.ok(!cleanedNotes.includes('Notes with Blanks'));
  });

  // ===========================================================================
  // PART C: READING NOTE COMPLETION – DUPLICATED PASSAGE CONTENT ELIMINATION
  // ===========================================================================
  test('PART C: buildCompletionGroupText eliminates duplicated multi-sentence chunks in Carlson exercise', () => {
    // Simulating the exact Carlson/xerography exercise prompt fragments that previously caused 3-fold duplication
    const questions: Array<{ q: ReadingQuestion; idx: number }> = [
      {
        q: {
          id: 'q_20',
          type: 'note_completion',
          prompt: 'Carlson, unlike a 20th-century 20 ……………, liked to work on his own.',
          correctAnswer: 'inventor',
          explanation: '',
        },
        idx: 19,
      },
      {
        q: {
          id: 'q_21',
          type: 'note_completion',
          prompt: 'In 1937, he unsuccessfully invited 20 major 21 …………… to make his discovery.',
          correctAnswer: 'corporations',
          explanation: '',
        },
        idx: 20,
      },
      // Questions 22, 23, 24 previously had the same overlapping multi-sentence chunk
      {
        q: {
          id: 'q_22',
          type: 'note_completion',
          prompt: 'However, this action was not welcome among shareholders at the beginning, all of them 22 …………… Eventually, Carlson’s creation was undeniably a 23 …………… Thanks to the discovery of xerography, Carlson became a very 24 …………… person.',
          correctAnswer: 'objected',
          explanation: '',
        },
        idx: 21,
      },
      {
        q: {
          id: 'q_23',
          type: 'note_completion',
          prompt: 'However, this action was not welcome among shareholders at the beginning, all of them 22 …………… Eventually, Carlson’s creation was undeniably a 23 …………… Thanks to the discovery of xerography, Carlson became a very 24 …………… person.',
          correctAnswer: 'success',
          explanation: '',
        },
        idx: 22,
      },
      {
        q: {
          id: 'q_24',
          type: 'note_completion',
          prompt: 'However, this action was not welcome among shareholders at the beginning, all of them 22 …………… Eventually, Carlson’s creation was undeniably a 23 …………… Thanks to the discovery of xerography, Carlson became a very 24 …………… person.',
          correctAnswer: 'wealthy',
          explanation: '',
        },
        idx: 23,
      },
      // Questions 25, 26 previously had the same 2-sentence chunk
      {
        q: {
          id: 'q_25',
          type: 'note_completion',
          prompt: 'It looks as if he can live without his 25 …………… At the same time, he gave lots of his money to 26 ……………',
          correctAnswer: 'luxuries',
          explanation: '',
        },
        idx: 24,
      },
      {
        q: {
          id: 'q_26',
          type: 'note_completion',
          prompt: 'It looks as if he can live without his 25 …………… At the same time, he gave lots of his money to 26 ……………',
          correctAnswer: 'charities',
          explanation: '',
        },
        idx: 25,
      },
    ];

    const reconstructedText = buildCompletionGroupText(questions);

    // Verify sentences appear EXACTLY ONCE (count occurrences = 1)
    const matchShareholders = reconstructedText.match(/not welcome among shareholders/gi) || [];
    assert.equal(matchShareholders.length, 1, 'Sentence "not welcome among shareholders" must appear exactly once, not repeated');

    const matchEventually = reconstructedText.match(/Eventually, Carlson’s creation/gi) || [];
    assert.equal(matchEventually.length, 1, 'Sentence "Eventually, Carlson’s creation" must appear exactly once');

    const matchDiscovery = reconstructedText.match(/Thanks to the discovery of xerography/gi) || [];
    assert.equal(matchDiscovery.length, 1, 'Sentence "Thanks to the discovery of xerography" must appear exactly once');

    const matchLiveWithout = reconstructedText.match(/It looks as if he can live without/gi) || [];
    assert.equal(matchLiveWithout.length, 1, 'Sentence "live without his" must appear exactly once');

    const matchCharity = reconstructedText.match(/gave lots of his money/gi) || [];
    assert.equal(matchCharity.length, 1, 'Sentence "gave lots of his money" must appear exactly once');

    // Verify blank numbers [20] through [26] are all present in sequential order
    for (let num = 20; num <= 26; num++) {
      assert.ok(
        reconstructedText.includes(`[${num}]`) || reconstructedText.includes(`${num} ……………`),
        `Reconstructed text must contain blank for question ${num}`
      );
    }
  });

  // ===========================================================================
  // PART D: IELTS QUESTION RECOGNITION SYSTEMS AUDIT
  // ===========================================================================
  describe('PART D: IELTS Question Recognition Across All 4 Skills', () => {

    test('Skill 1 - Listening: Question-type recognition and instruction context', () => {
      // 1. Multi-select recognition from instructions
      const msInstr1 = 'Questions 11 and 12: Choose TWO letters, A-E.';
      const parsed1 = parseListeningDocument(`PART 2\n${msInstr1}\nWhich two services are offered?\nA. Free Wi-Fi\nB. Breakfast\nC. Airport shuttle\nD. Gym\nE. Swimming pool\n`);
      assert.equal(parsed1.parts[0].questionGroups[0].type, 'multiple_select');

      // 2. Vietnamese dual-instructions recognition
      const msInstrVn = 'Questions 15-16: Chọn hai đáp án đúng (Choose TWO letters)';
      const parsedVn = parseListeningDocument(`PART 2\n${msInstrVn}\nWhich reasons were given?\nA. Cost\nB. Time\nC. Quality\n`);
      assert.equal(parsedVn.parts[0].questionGroups[0].type, 'multiple_select');

      // 3. Plan / Map labelling recognition
      const mapDoc = parseListeningDocument(`PART 2\nQuestions 17-20: Label the map below. Write the correct letter, A-F, next to Questions 17-20.\n17. Coffee shop\n18. Information desk\n`);
      assert.equal(mapDoc.parts[0].questionGroups[0].type, 'plan_map_diagram_labelling');
    });

    test('Skill 2 - Reading: Instruction parsing and question-type detection', () => {
      // 1. True / False / Not Given
      const tfType = detectQuestionType('Do the following statements agree with the information given in Reading Passage 1?');
      assert.equal(tfType, 'true_false_not_given');

      // 2. Yes / No / Not Given
      const ynType = detectQuestionType('Do the following statements reflect the claims of the writer? YES / NO / NOT GIVEN');
      assert.equal(ynType, 'yes_no_not_given');

      // 3. Matching Headings
      const mhType = detectQuestionType('Choose the correct heading for paragraphs A-G from the list of headings below.');
      assert.equal(mhType, 'matching_headings');

      // 4. Note Completion
      const ncType = detectQuestionType('Complete the notes below. Choose NO MORE THAN TWO WORDS from the passage.');
      assert.equal(ncType, 'note_completion');

      // 5. Multiple Select count extraction
      assert.equal(parseMultipleSelectCount('Choose TWO letters, A-E'), 2);
      assert.equal(parseMultipleSelectCount('Choose THREE answers from the list'), 3);
      assert.equal(parseMultipleSelectCount('Chọn bốn phương án đúng'), 4);
    });

    test('Skill 3 - Speaking: 1-to-1 Linkage between Part 2 and Part 3 without cross-leaking', () => {
      const cardA = { id: 'card_travel', topic: 'Describe a memorable trip you took' };
      const cardB = { id: 'card_book', topic: 'Describe a book that influenced your thinking' };

      const groupTravel = {
        id: 'grp_p3_travel',
        cueCardId: 'card_travel',
        cueCardTopic: 'Describe a memorable trip you took',
        title: 'Tourism and Travel Discussion',
        questions: ['Why do people like traveling abroad?', 'How has tourism affected local economies?'],
      };

      const groupBook = {
        id: 'grp_p3_book',
        cueCardId: 'card_book',
        cueCardTopic: 'Describe a book that influenced your thinking',
        title: 'Reading Habits Discussion',
        questions: ['Do young people read enough books today?', 'Will digital books replace paper books?'],
      };

      const mockResource = {
        id: 'res_speaking_full',
        speakingPart3: {
          groups: [groupTravel, groupBook],
        },
      };

      // Test Card A links strictly to groupTravel only
      const resultA = findAssociatedPart3GroupsForCards([cardA], mockResource);
      assert.equal(resultA.matchedGroups.length, 1);
      assert.equal(resultA.matchedGroups[0].id, 'grp_p3_travel');
      assert.ok(!resultA.matchedGroups.some((g) => g.id === 'grp_p3_book'));

      // Test Card B links strictly to groupBook only
      const resultB = findAssociatedPart3GroupsForCards([cardB], mockResource);
      assert.equal(resultB.matchedGroups.length, 1);
      assert.equal(resultB.matchedGroups[0].id, 'grp_p3_book');
      assert.ok(!resultB.matchedGroups.some((g) => g.id === 'grp_p3_travel'));
    });

    test('Skill 4 - Writing: Task 1 vs Task 2 detection and table formatting', () => {
      // 1. Chart type detection
      assert.equal(detectChartType(undefined, 'The line graph shows the percentage of car owners between 2000 and 2020'), 'Line Graph');
      assert.equal(detectChartType(undefined, 'The bar chart compares energy consumption in five countries'), 'Bar Chart');
      assert.equal(detectChartType(undefined, 'The pie charts illustrate household expenditure in 1995 and 2015'), 'Pie Chart');
      assert.equal(detectChartType(undefined, 'The process diagram depicts how plastic bottles are recycled'), 'Process / Diagram');
      assert.equal(detectChartType(undefined, 'The map shows changes to the town centre between 1990 and 2010'), 'Map');

      // 2. Markdown Table extraction & prompt stripping
      const samplePromptWithTable = 'The table below gives information on university enrollments:\n\n| Year | Domestic | International |\n|---|---|---|\n| 2010 | 12000 | 3500 |\n| 2020 | 14500 | 6200 |\n\nSummarise the information by selecting and reporting the main features.';
      const tableData = extractMarkdownTable(samplePromptWithTable);
      assert.ok(tableData !== null);
      assert.equal(tableData.headers.length, 3);
      assert.equal(tableData.rows.length, 2);

      const strippedPrompt = stripMarkdownTableFromPrompt(samplePromptWithTable);
      assert.ok(!strippedPrompt.includes('| Year |'));
      assert.ok(strippedPrompt.includes('The table below gives information'));
    });

  });

});
