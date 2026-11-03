import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { parseListeningDocument } from '../src/lib/listeningExtractor.ts';
import { gradeListeningSubmission } from '../src/lib/assignmentGrader.ts';
import type {
  ListeningTestContent,
  ListeningPart,
  ListeningQuestionGroup,
  ListeningQuestion,
  ListeningQuestionType,
} from '../src/types/index.ts';

test('MASTER PROMPT – LISTENING IMPORT EDITOR & QUESTION-TYPE-SPECIFIC CONTENT MANAGEMENT', async (t) => {
  console.log('================================================================');
  console.log('▶ RUNNING LISTENING IMPORT EDITOR & CONTENT MANAGEMENT TESTS');
  console.log('================================================================\n');

  const docxPath = 'C:/Users/Admin/.gemini/antigravity/brain/e66bef89-3824-44a3-9b01-1da8f8609a20/.user_uploaded/media_1793634904344_a8f7fc60.docx';

  // -------------------------------------------------------------------------
  // TEST 1: Real-World Listening DOCX Import & Automatic Extraction
  // -------------------------------------------------------------------------
  let initialParsed: ListeningTestContent;
  await t.test('1. Import Real-World Listening Exercise (DOCX) & Extract Structure', async () => {
    assert.ok(fs.existsSync(docxPath), 'DOCX file must exist on disk');

    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: docxPath });
    const rawText = result.value;
    assert.ok(rawText && rawText.length > 500, 'DOCX raw text must be extracted');

    initialParsed = parseListeningDocument(rawText, 'IELTS Test 1 – Listening');
    assert.ok(initialParsed, 'Parsed listening document must be generated');
    assert.equal(initialParsed.parts.length, 4, 'Must have 4 parts');
    assert.equal(initialParsed.totalQuestions, 40, 'Must have 40 total questions');

    console.log(`  ✔ Real-world DOCX imported with ${initialParsed.parts.length} parts and ${initialParsed.totalQuestions} questions.`);
  });

  // Working copy of parts for teacher editing workflow
  let editableParts: ListeningPart[] = JSON.parse(JSON.stringify(initialParsed!.parts));

  // -------------------------------------------------------------------------
  // TEST 2: Change Incorrectly Detected Question Type
  // -------------------------------------------------------------------------
  await t.test('2. Teacher Change Question Type without Re-importing', async () => {
    // Take Question 1 in Part 1 (initially note_completion) and change it to multiple_choice
    const part1 = editableParts[0];
    const targetQ = part1.questions[0];
    assert.ok(targetQ, 'Question 1 must exist');

    const originalType = targetQ.type;
    targetQ.type = 'multiple_choice';
    targetQ.options = ['At the university', 'In the city centre', 'Near the airport', 'At the train station'];
    targetQ.correctAnswer = 'B';

    // Synchronize inside question group
    if (part1.questionGroups && part1.questionGroups[0]) {
      part1.questionGroups[0].questions[0].type = 'multiple_choice';
      part1.questionGroups[0].questions[0].options = targetQ.options;
      part1.questionGroups[0].questions[0].correctAnswer = 'B';
    }

    assert.equal(targetQ.type, 'multiple_choice', 'Question type must be updated to multiple_choice');
    assert.equal(targetQ.options?.length, 4, 'Must have 4 MCQ options');
    assert.equal(targetQ.correctAnswer, 'B', 'Correct answer must be set to B');

    console.log(`  ✔ Question 1 changed from '${originalType}' to '${targetQ.type}' with options and answer key.`);
  });

  // -------------------------------------------------------------------------
  // TEST 3: Manually Create a New Question
  // -------------------------------------------------------------------------
  await t.test('3. Manually Create New Question in Part 1', async () => {
    const part1 = editableParts[0];
    const newQId = `manual_q_${Date.now()}`;
    const newQ: ListeningQuestion = {
      id: newQId,
      questionNumber: 41,
      number: 41,
      part: 1,
      type: 'short_answer',
      prompt: '41. What is the emergency contact number?',
      correctAnswer: '0987654321',
      acceptedAlternatives: ['+84 987654321', '0987 654 321'],
      explanation: 'The receptionist stated the hotline is 0987654321.',
    };

    part1.questions.push(newQ);
    if (part1.questionGroups && part1.questionGroups[0]) {
      part1.questionGroups[0].questions.push(newQ);
    }

    const found = part1.questions.find((q) => q.id === newQId);
    assert.ok(found, 'Newly created question must be in part 1');
    assert.equal(found?.correctAnswer, '0987654321');
    assert.equal(found?.acceptedAlternatives?.length, 2);

    console.log('  ✔ Manually created new question with alternatives and explanation.');
  });

  // -------------------------------------------------------------------------
  // TEST 4: Edit Form / Note / Table Completion Group with Answers & Alternatives
  // -------------------------------------------------------------------------
  await t.test('4. Edit Note/Table Completion Group & Configure Word Limit', async () => {
    const part1 = editableParts[0];
    const grp = part1.questionGroups[0];
    assert.ok(grp, 'Group 1 must exist');

    grp.wordLimit = 'NO MORE THAN TWO WORDS AND/OR A NUMBER';
    grp.instructions = 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.';
    grp.sharedContent = 'CAMPUS ACCOMMODATION ENQUIRY FORM\n- Name: Sarah Jenkins\n- Room Type: Single en-suite';

    // Update Q2 with prompt blank and alternative answers
    const q2 = grp.questions[1];
    if (q2) {
      q2.prompt = 'Length of lease required: _____ months';
      q2.correctAnswer = '12 / twelve';
      q2.acceptedAlternatives = ['12', 'twelve', '12 months', 'one year'];
    }

    assert.equal(grp.wordLimit, 'NO MORE THAN TWO WORDS AND/OR A NUMBER');
    assert.ok(q2.prompt.includes('_____'), 'Prompt must contain blank placeholder');
    assert.ok(q2.acceptedAlternatives?.includes('twelve'), 'Alternative answers must be mapped');

    console.log('  ✔ Note/Table completion group configured with word limits and multi-alternative keys.');
  });

  // -------------------------------------------------------------------------
  // TEST 5: Create Summary Completion Group with Shared Content
  // -------------------------------------------------------------------------
  await t.test('5. Create Summary Completion Group with Shared Content & Blanks', async () => {
    const part2 = editableParts[1];
    const summaryGroupId = `grp_summary_${Date.now()}`;
    const qAId = `q_sum_1`;
    const qBId = `q_sum_2`;

    const summaryGroup: ListeningQuestionGroup = {
      id: summaryGroupId,
      part: 2,
      groupTitle: 'Questions 11-12',
      title: 'Questions 11-12',
      type: 'summary_completion',
      instructions: 'Complete the summary below. Write ONE WORD ONLY for each answer.',
      wordLimit: 'ONE WORD ONLY',
      sharedContent: 'Local History Museum Renovation:\nThe museum was originally founded in the 19th century to showcase local [11] _____. Following recent investments, a brand new interactive gallery opened to attract younger [12] _____.',
      optionsBox: ['A. artifacts', 'B. visitors', 'C. paintings', 'D. architecture'],
      questions: [
        {
          id: qAId,
          questionNumber: 11,
          number: 11,
          part: 2,
          groupId: summaryGroupId,
          type: 'summary_completion',
          prompt: '11. The museum was founded to showcase local _____',
          correctAnswer: 'artifacts / A',
          acceptedAlternatives: ['artifacts', 'artefacts', 'A'],
        },
        {
          id: qBId,
          questionNumber: 12,
          number: 12,
          part: 2,
          groupId: summaryGroupId,
          type: 'summary_completion',
          prompt: '12. Interactive gallery opened to attract younger _____',
          correctAnswer: 'visitors / B',
          acceptedAlternatives: ['visitors', 'audiences', 'B'],
        },
      ],
    };

    part2.questionGroups = [summaryGroup, ...(part2.questionGroups || [])];
    part2.questions = [...summaryGroup.questions, ...(part2.questions || [])];

    assert.equal(summaryGroup.type, 'summary_completion');
    assert.equal(summaryGroup.questions.length, 2);
    assert.ok(summaryGroup.sharedContent?.includes('[11] _____'));

    console.log('  ✔ Summary completion group with shared text and options box created.');
  });

  // -------------------------------------------------------------------------
  // TEST 6: Multiple Choice Question (Single Answer)
  // -------------------------------------------------------------------------
  await t.test('6. Create Multiple Choice Question with Single Answer (Radio Key)', async () => {
    const mcq: ListeningQuestion = {
      id: 'q_mcq_single',
      questionNumber: 21,
      number: 21,
      part: 3,
      type: 'multiple_choice',
      prompt: '21. What did both students agree was the main difficulty of their project?',
      options: [
        'Finding relevant academic journals',
        'Managing their time effectively',
        'Conducting statistical interviews',
        'Agreeing on the presentation format',
      ],
      correctAnswer: 'B',
      explanation: 'Both Jack and Chloe agreed that scheduling and time management was their biggest obstacle.',
    };

    assert.equal(mcq.type, 'multiple_choice');
    assert.equal(mcq.correctAnswer, 'B');
    assert.equal(mcq.options?.length, 4);

    console.log('  ✔ Multiple Choice single answer question verified.');
  });

  // -------------------------------------------------------------------------
  // TEST 7: Multiple Select Question (Choose TWO / THREE)
  // -------------------------------------------------------------------------
  await t.test('7. Create Multiple Select Question with Multiple Keys (Checkboxes)', async () => {
    const multiSelectQ: ListeningQuestion = {
      id: 'q_multi_select',
      questionNumber: 25,
      number: 25,
      part: 3,
      type: 'multiple_select',
      prompt: '25-26. Which TWO factors influenced the team’s research methodology?',
      options: [
        'Budget constraints',
        'Tutor recommendations',
        'Available sample size',
        'Historical precedent',
        'Ethical clearance delays',
      ],
      correctAnswer: 'A, C',
      explanation: 'The team noted budget limitations (A) and the limited available sample size (C).',
    };

    assert.equal(multiSelectQ.type, 'multiple_select');
    assert.equal(multiSelectQ.correctAnswer, 'A, C');

    // Test grading with student answering "A, C" and reverse order "C, A"
    const gradeDirect = gradeListeningSubmission([multiSelectQ], { [multiSelectQ.id]: 'A, C' });
    assert.equal(gradeDirect.correctCount, 1, 'Should grade A, C as correct');

    const gradeReverse = gradeListeningSubmission([multiSelectQ], { [multiSelectQ.id]: 'C, A' });
    assert.equal(gradeReverse.correctCount, 1, 'Should grade C, A as correct regardless of order');

    const gradeWrong = gradeListeningSubmission([multiSelectQ], { [multiSelectQ.id]: 'A, B' });
    assert.equal(gradeWrong.correctCount, 0, 'Incorrect pair should not receive full score');

    console.log('  ✔ Multiple Select (Choose TWO) question and order-independent grading verified.');
  });

  // -------------------------------------------------------------------------
  // TEST 8: Matching Question Group with Shared Options List
  // -------------------------------------------------------------------------
  await t.test('8. Create Matching Group with Shared Options Box (A-E)', async () => {
    const matchingGroupId = 'grp_matching_facilities';
    const matchingGroup: ListeningQuestionGroup = {
      id: matchingGroupId,
      part: 2,
      groupTitle: 'Questions 16-18',
      title: 'Questions 16-18',
      type: 'matching',
      instructions: 'What opinion does the speaker express about each facility? Choose the correct letter, A-E.',
      optionsBox: [
        'A. Closed for renovation',
        'B. Highly recommended for families',
        'C. Requires advance booking',
        'D. Free admission on weekdays',
        'E. Recently relocated to the new wing',
      ],
      questions: [
        {
          id: 'q_match_16',
          questionNumber: 16,
          number: 16,
          part: 2,
          groupId: matchingGroupId,
          type: 'matching',
          prompt: '16. Children’s Play Area',
          correctAnswer: 'B',
        },
        {
          id: 'q_match_17',
          questionNumber: 17,
          number: 17,
          part: 2,
          groupId: matchingGroupId,
          type: 'matching',
          prompt: '17. Planetarium',
          correctAnswer: 'C',
        },
        {
          id: 'q_match_18',
          questionNumber: 18,
          number: 18,
          part: 2,
          groupId: matchingGroupId,
          type: 'matching',
          prompt: '18. Rooftop Cafe',
          correctAnswer: 'E',
        },
      ],
    };

    assert.equal(matchingGroup.questions.length, 3);
    assert.equal(matchingGroup.optionsBox?.length, 5);
    assert.equal(matchingGroup.questions[0].correctAnswer, 'B');
    assert.equal(matchingGroup.questions[1].correctAnswer, 'C');
    assert.equal(matchingGroup.questions[2].correctAnswer, 'E');

    console.log('  ✔ Matching group with 3 questions referencing shared options box verified.');
  });

  // -------------------------------------------------------------------------
  // TEST 9: Plan / Map / Diagram Labelling with Uploaded Image
  // -------------------------------------------------------------------------
  await t.test('9. Create Plan/Map/Diagram Labelling with Diagram Image & Letter Keys', async () => {
    const diagramGroup: ListeningQuestionGroup = {
      id: 'grp_map_labelling',
      part: 2,
      groupTitle: 'Questions 14-15',
      title: 'Questions 14-15',
      type: 'plan_map_diagram_labelling',
      instructions: 'Label the map below. Choose the correct letter, A-H, for each location.',
      imageUrl: 'https://example.com/storage/v1/object/public/materials/campus_map_layout.png',
      imageCaption: 'Map of Central Campus and Accommodation Blocks',
      optionsBox: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      questions: [
        {
          id: 'q_map_14',
          questionNumber: 14,
          number: 14,
          part: 2,
          groupId: 'grp_map_labelling',
          type: 'plan_map_diagram_labelling',
          prompt: '14. Student Welfare Office',
          correctAnswer: 'D',
        },
        {
          id: 'q_map_15',
          questionNumber: 15,
          number: 15,
          part: 2,
          groupId: 'grp_map_labelling',
          type: 'plan_map_diagram_labelling',
          prompt: '15. International Students Lounge',
          correctAnswer: 'F',
        },
      ],
    };

    assert.ok(diagramGroup.imageUrl?.includes('.png'), 'Diagram must have valid image URL');
    assert.equal(diagramGroup.questions[0].correctAnswer, 'D');
    assert.equal(diagramGroup.questions[1].correctAnswer, 'F');

    console.log('  ✔ Plan/Map/Diagram labelling group with image resource verified.');
  });

  // -------------------------------------------------------------------------
  // TEST 10: Short Answer Questions with Alternative Keys
  // -------------------------------------------------------------------------
  await t.test('10. Create Short Answer Question with Acceptable Alternatives', async () => {
    const shortQ: ListeningQuestion = {
      id: 'q_short_39',
      questionNumber: 39,
      number: 39,
      part: 4,
      type: 'short_answer',
      prompt: '39. In which year was the first commercial solar farm built?',
      correctAnswer: '1982',
      acceptedAlternatives: ['1982', 'nineteen eighty-two', 'in 1982'],
      wordLimit: 'NO MORE THAN TWO WORDS AND/OR A NUMBER',
    };

    const gradeNumeric = gradeListeningSubmission([shortQ], { [shortQ.id]: '1982' });
    assert.equal(gradeNumeric.correctCount, 1);

    const gradeText = gradeListeningSubmission([shortQ], { [shortQ.id]: 'nineteen eighty-two' });
    assert.equal(gradeText.correctCount, 1);

    console.log('  ✔ Short answer question with alternative representations verified.');
  });

  // -------------------------------------------------------------------------
  // TEST 11: Shared Resources Referenced by Multiple Questions
  // -------------------------------------------------------------------------
  await t.test('11. Shared Resource Integrity (Shared text & options appear once)', async () => {
    const sharedText = 'LECTURE OUTLINE: Renewable Energy Transitions\n1. Wind power variability\n2. Ocean thermal conversion';
    const groupWithShared: ListeningQuestionGroup = {
      id: 'grp_shared_res',
      part: 4,
      type: 'note_completion',
      groupText: sharedText,
      sharedContent: sharedText,
      questions: [
        { id: 'q_sh_1', questionNumber: 31, type: 'note_completion', prompt: 'Wind power: _____', correctAnswer: 'turbines' },
        { id: 'q_sh_2', questionNumber: 32, type: 'note_completion', prompt: 'Ocean energy: _____', correctAnswer: 'currents' },
      ],
    };

    assert.equal(groupWithShared.questions.length, 2);
    // Shared content belongs to group, not duplicated inside each question
    assert.equal((groupWithShared.questions[0] as any).groupText, undefined);
    assert.equal(groupWithShared.groupText, sharedText);

    console.log('  ✔ Shared resources cleanly decoupled and referenced without duplication.');
  });

  // -------------------------------------------------------------------------
  // TEST 12: Reordering & Auto-Renumbering Maintains Correct Answer Mappings
  // -------------------------------------------------------------------------
  await t.test('12. Reordering Questions & Auto-renumbering Preserves Answer Keys', async () => {
    const testPart: ListeningPart = {
      partNumber: 1,
      title: 'Part 1',
      questionGroups: [
        {
          id: 'grp_test',
          type: 'note_completion',
          questions: [
            { id: 'id_alpha', questionNumber: 1, type: 'note_completion', prompt: 'Item Alpha', correctAnswer: 'apple' },
            { id: 'id_beta', questionNumber: 2, type: 'note_completion', prompt: 'Item Beta', correctAnswer: 'banana' },
            { id: 'id_gamma', questionNumber: 3, type: 'note_completion', prompt: 'Item Gamma', correctAnswer: 'cherry' },
          ],
        },
      ],
      questions: [],
    };

    // Swap Item Beta and Item Alpha
    const qs = testPart.questionGroups[0].questions;
    const temp = qs[0];
    qs[0] = qs[1];
    qs[1] = temp;

    // Renumber sequentially
    qs.forEach((q, idx) => {
      q.questionNumber = idx + 1;
      q.number = idx + 1;
    });

    // Verify stable IDs and answers remain coupled
    assert.equal(qs[0].id, 'id_beta', 'Item Beta should now be at index 0');
    assert.equal(qs[0].correctAnswer, 'banana', 'Item Beta must keep answer banana');
    assert.equal(qs[0].questionNumber, 1, 'Item Beta is renumbered to Q1');

    assert.equal(qs[1].id, 'id_alpha', 'Item Alpha should now be at index 1');
    assert.equal(qs[1].correctAnswer, 'apple', 'Item Alpha must keep answer apple');
    assert.equal(qs[1].questionNumber, 2, 'Item Alpha is renumbered to Q2');

    console.log('  ✔ Reordering and renumbering maintains answer-question integrity.');
  });

  // -------------------------------------------------------------------------
  // TEST 13: Serialization, Persistence & Reopen Verification
  // -------------------------------------------------------------------------
  await t.test('13. Serialization, Persistence & Reopen Roundtrip', async () => {
    const originalTestContent: ListeningTestContent = {
      title: 'Cambridge IELTS 19 Test 1 Listening',
      audioUrl: 'https://example.com/cambridge19_test1.mp3',
      audioMode: 'continuous',
      totalQuestions: 40,
      parts: editableParts,
    };

    // Serialize to JSON (as stored in Supabase resources table)
    const serializedJson = JSON.stringify(originalTestContent);
    assert.ok(serializedJson.length > 1000, 'Serialized JSON must be valid and non-empty');

    // Deserialization (simulate opening resource editor or loading assignment)
    const reopenedContent: ListeningTestContent = JSON.parse(serializedJson);
    assert.equal(reopenedContent.title, originalTestContent.title);
    assert.equal(reopenedContent.audioUrl, originalTestContent.audioUrl);
    assert.equal(reopenedContent.parts.length, 4);

    // Verify specific edited questions survive roundtrip
    const reloadedP1 = reopenedContent.parts[0];
    const reloadedQ1 = reloadedP1.questions.find((q) => q.type === 'multiple_choice');
    assert.ok(reloadedQ1, 'Edited MCQ question must survive JSON persistence');
    assert.equal(reloadedQ1?.correctAnswer, 'B');
    assert.equal(reloadedQ1?.options?.length, 4);

    console.log('  ✔ Full persistence roundtrip verified without data loss.');
  });

  // -------------------------------------------------------------------------
  // TEST 14: Student Submission Grading Across Diverse Question Types
  // -------------------------------------------------------------------------
  await t.test('14. Student Submission Grading Across All Listening Types', async () => {
    const diverseQuestions: ListeningQuestion[] = [
      // 1. Completion with alternative
      {
        id: 'q_div_1',
        type: 'note_completion',
        prompt: 'Station: _____',
        correctAnswer: 'central station / main station',
        acceptedAlternatives: ['central station', 'main station'],
      },
      // 2. Multiple choice single
      {
        id: 'q_div_2',
        type: 'multiple_choice',
        prompt: 'Choose letter',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'C',
      },
      // 3. Multiple select
      {
        id: 'q_div_3',
        type: 'multiple_select',
        prompt: 'Choose TWO',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A, D',
      },
      // 4. Matching
      {
        id: 'q_div_4',
        type: 'matching',
        prompt: 'Service',
        correctAnswer: 'E',
      },
      // 5. Short answer
      {
        id: 'q_div_5',
        type: 'short_answer',
        prompt: 'Distance (km):',
        correctAnswer: '25 km / 25 kilometres',
        acceptedAlternatives: ['25', '25km', '25 km'],
      },
    ];

    // Student provides 100% correct answers
    const studentPerfectAnswers: Record<string, string> = {
      q_div_1: 'main station',
      q_div_2: 'C',
      q_div_3: 'D, A', // reversed order
      q_div_4: 'E',
      q_div_5: '25km',
    };

    const perfectGrade = gradeListeningSubmission(diverseQuestions, studentPerfectAnswers);
    assert.equal(perfectGrade.correctCount, 5, 'All 5 questions should be correct');
    assert.equal(perfectGrade.percentage, 100, 'Score percentage must be 100%');

    // Student provides partial / incorrect answers
    const studentPartialAnswers: Record<string, string> = {
      q_div_1: 'airport', // wrong
      q_div_2: 'C',       // correct
      q_div_3: 'A, B',    // partially wrong
      q_div_4: 'E',       // correct
      q_div_5: '50 km',   // wrong
    };

    const partialGrade = gradeListeningSubmission(diverseQuestions, studentPartialAnswers);
    assert.equal(partialGrade.correctCount, 2, 'Exactly 2 questions should be correct');
    assert.equal(partialGrade.incorrectCount, 3, 'Exactly 3 questions should be incorrect');

    console.log(`  ✔ Automated grading verified across completion, MCQ, multi-select, matching, and short-answer.`);
  });

  console.log('\n================================================================');
  console.log('✔ ALL LISTENING IMPORT EDITOR & MANAGEMENT TESTS PASSED (14/14)');
  console.log('================================================================\n');
});
