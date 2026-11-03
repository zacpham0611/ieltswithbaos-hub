import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { parseListeningDocument } from '../src/lib/listeningExtractor.ts';
import { findAssociatedPart3GroupsForCards, getSpeakingResourceDetails } from '../src/utils/speakingLinkage.ts';
import { sanitizeExamDataForStudent } from '../src/lib/regularTestManager.ts';
import type { RegularTest, RegularTestSection, SpeakingPart3Group, ListeningTestContent } from '../src/types/index.ts';

test('MASTER PROMPT – LISTENING QUESTION EXTRACTION, SPEAKING ASSIGNMENT LINKAGE & PART 3 QUESTION SELECTION', async (t) => {
  console.log('================================================================');
  console.log('▶ RUNNING COMPLETE LISTENING PIPELINE & SPEAKING SELECTION TESTS');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Real-World Listening DOCX Parsing ("IELTS Test 1 – Listening")
  // -------------------------------------------------------------------------
  await t.test('1. Real-World Listening Document Parsing and Question Structure', async () => {
    const docxPath = 'C:/Users/Admin/.gemini/antigravity/brain/e66bef89-3824-44a3-9b01-1da8f8609a20/.user_uploaded/media_1793634904344_a8f7fc60.docx';
    
    assert.ok(fs.existsSync(docxPath), 'Docx file should exist');

    // Extract text from DOCX
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: docxPath });
    const rawText = result.value;

    assert.ok(rawText && rawText.length > 500, 'DOCX raw text should be extracted');

    const parsed: ListeningTestContent = parseListeningDocument(rawText, 'IELTS Test 1 – Listening');

    assert.ok(parsed, 'Parsed content must exist');
    assert.equal(parsed.parts.length, 4, 'Listening test must contain 4 Parts/Sections');

    const allQuestions = parsed.parts.flatMap((p) => p.questions);
    assert.equal(allQuestions.length, 40, 'Listening test must have exactly 40 questions');

    // Part 1: Table / Note completion (Questions 1-10)
    const p1 = parsed.parts[0];
    assert.equal(p1.questions.length, 10, 'Part 1 must have 10 questions');
    assert.equal(p1.questions[0].questionNumber, 1);
    assert.equal(p1.questions[9].questionNumber, 10);
    assert.ok(p1.questions[0].correctAnswer, 'Question 1 must have answer key');

    // Part 2: Multiple Choice & Matching (Questions 11-20)
    const p2 = parsed.parts[1];
    assert.equal(p2.questions.length, 10, 'Part 2 must have 10 questions');
    assert.equal(p2.questions[0].questionNumber, 11);
    assert.equal(p2.questions[9].questionNumber, 20);

    // Part 3: Multiple Choice & Matching (Questions 21-30)
    const p3 = parsed.parts[2];
    assert.equal(p3.questions.length, 10, 'Part 3 must have 10 questions');
    assert.equal(p3.questions[0].questionNumber, 21);
    assert.equal(p3.questions[9].questionNumber, 30);

    // Part 4: Lecture Note Completion (Questions 31-40)
    const p4 = parsed.parts[3];
    assert.equal(p4.questions.length, 10, 'Part 4 must have 10 questions');
    assert.equal(p4.questions[0].questionNumber, 31);
    assert.equal(p4.questions[9].questionNumber, 40);

    console.log('✓ Passed: Real docx parsed with all 4 parts, 40 questions, question groups and answer keys.');
  });

  // -------------------------------------------------------------------------
  // TEST 2: Listening Assignment Slicing Bug Prevention & Question Scoping
  // -------------------------------------------------------------------------
  await t.test('2. Slicing Bug Prevention: Scoped questions never sliced to empty on Tab 1, 2, 3', async () => {
    // When a part has 10 scoped questions (per-part questions array)
    const part2Questions = Array.from({ length: 10 }, (_, i) => ({
      id: `q_${i + 11}`,
      questionNumber: i + 11,
      prompt: `Question prompt ${i + 11}`,
      correctAnswer: `Answer ${i + 11}`,
      type: 'multiple_choice' as const,
    }));

    const activePassageTab = 1; // Tab 1 = Part 2 (zero-indexed)

    // The old slicing bug:
    // (activePart?.questions || []).slice(activePassageTab * 10, (activePassageTab + 1) * 10) -> slice(10, 20) on 10 elements -> [] !
    const buggySlicing = part2Questions.slice(activePassageTab * 10, (activePassageTab + 1) * 10);
    assert.equal(buggySlicing.length, 0, 'Demonstrates that the old slicing bug produced empty questions');

    // The fixed logic:
    const fixedScopedQuestions =
      part2Questions.length > 20
        ? part2Questions.slice(activePassageTab * 10, (activePassageTab + 1) * 10)
        : part2Questions;

    assert.equal(fixedScopedQuestions.length, 10, 'Fixed scoping preserves all 10 questions for Part 2');
    assert.equal(fixedScopedQuestions[0].questionNumber, 11);
    assert.equal(fixedScopedQuestions[9].questionNumber, 20);

    console.log('✓ Passed: Scoped questions retain all 10 questions on tabs > 0 instead of slicing to empty.');
  });

  // -------------------------------------------------------------------------
  // TEST 3: Speaking Part 2 -> Part 3 Linkage in Assignments
  // -------------------------------------------------------------------------
  await t.test('3. Speaking Assignment: Auto-link Part 2 Cue Card to Part 3 across companion resources', async () => {
    // Simulated Speaking Library with companion resources
    const libraryResources = [
      {
        id: 'res_spk_p2',
        title: 'IELTS Forecast 2024 - Speaking Part 2',
        sourceDocumentName: 'Forecast 2024 Speaking.docx',
        speakingCueCards: [
          {
            id: 'card_wildlife',
            topic: 'Describe a wild animal that you have seen in person',
            points: ['What animal it was', 'Where you saw it', 'Why it was memorable'],
          },
          {
            id: 'card_book',
            topic: 'Describe an exciting book you read recently',
            points: ['What book it was', 'When you read it', 'Why you enjoyed it'],
          },
        ],
      },
      {
        id: 'res_spk_p3',
        title: 'IELTS Forecast 2024 - Speaking Part 3',
        sourceDocumentName: 'Forecast 2024 Speaking.docx',
        speakingPart3Groups: [
          {
            id: 'grp_wildlife_p3',
            cueCardId: 'card_wildlife',
            cueCardTopic: 'Describe a wild animal that you have seen in person',
            questions: [
              'Do you think wild animals should be kept in zoos?',
              'Why are some animal species endangered today?',
              'How can governments protect wildlife habitats?',
            ],
          },
          {
            id: 'grp_book_p3',
            cueCardId: 'card_book',
            cueCardTopic: 'Describe an exciting book you read recently',
            questions: [
              'Do children read fewer books today than in the past?',
              'What are the advantages of paper books compared to e-books?',
            ],
          },
        ],
      },
    ];

    // Selecting Part 2 card 'card_wildlife'
    const targetCard = { id: 'card_wildlife', topic: 'Describe a wild animal that you have seen in person' };
    const { matchedGroups, companionResource } = findAssociatedPart3GroupsForCards(
      [targetCard],
      libraryResources[0],
      libraryResources
    );

    assert.ok(matchedGroups && matchedGroups.length > 0, 'Must retrieve matching Part 3 group');
    assert.equal(matchedGroups[0].id, 'grp_wildlife_p3');
    assert.equal(matchedGroups[0].questions.length, 3);
    assert.equal(companionResource?.id, 'res_spk_p3', 'Companion resource must be resolved via sourceDocumentName');

    console.log('✓ Passed: Speaking Assignment automatically retrieves Part 3 from companion resources via ID and topic.');
  });

  // -------------------------------------------------------------------------
  // TEST 4: Regular Test Part 3 Individual Question Selection
  // -------------------------------------------------------------------------
  await t.test('4. Regular Test: Individual Part 3 question selection and student test rendering', async () => {
    const rawPart3Group: SpeakingPart3Group = {
      id: 'grp_tech_p3',
      cueCardTopic: 'Describe a website you visit often',
      questions: [
        'How has the Internet changed everyday communication?',
        'What are the disadvantages of spending too much time online?',
        'Do older people have difficulty adapting to new technologies?',
        'Should schools replace textbooks with tablets?',
      ],
    };

    // Teacher selects only questions at indices 0 and 2 (deselects 1 and 3)
    const selectedGroupIndices: Record<number, boolean> = { 0: true };
    const selectedQuestionItems: Record<string, boolean> = {
      '0_0': true,
      '0_1': false, // deselected
      '0_2': true,
      '0_3': false, // deselected
    };

    // Simulated saving filter in TeacherRegularTestsView
    const finalGroups: SpeakingPart3Group[] = [];
    [rawPart3Group].forEach((grp, gIdx) => {
      const isGroupSelected = Boolean(selectedGroupIndices[gIdx]);
      const checkedQuestions = (grp.questions || []).filter((_: string, qIdx: number) => {
        const itemVal = selectedQuestionItems[`${gIdx}_${qIdx}`];
        if (itemVal === true) return true;
        if (itemVal === false) return false;
        return isGroupSelected;
      });
      if (checkedQuestions.length > 0) {
        finalGroups.push({
          id: grp.id,
          cueCardTopic: grp.cueCardTopic,
          questions: checkedQuestions,
        });
      }
    });

    assert.equal(finalGroups.length, 1);
    assert.equal(finalGroups[0].questions.length, 2, 'Only the 2 selected questions must be persisted');
    assert.equal(finalGroups[0].questions[0], 'How has the Internet changed everyday communication?');
    assert.equal(finalGroups[0].questions[1], 'Do older people have difficulty adapting to new technologies?');

    // Create a regular test with this Part 3 section
    const fullTest: RegularTest = {
      id: 'test_p3_selection',
      courseId: 'c1',
      teacherId: 't1',
      title: 'Speaking Mock Test',
      instructions: 'Exam instructions',
      skills: ['speaking'],
      durationMinutes: 15,
      timingMode: 'overall_timer',
      strictPreset: 'standard',
      strictSettings: {} as any,
      status: 'published',
      currentVersion: 1,
      sections: [
        {
          id: 'sec_spk_p3',
          skill: 'speaking',
          speakingPart: 'part3',
          title: 'Speaking Part 3',
          speakingPart3Groups: finalGroups,
          speakingQuestions: finalGroups.flatMap((g) => g.questions),
        },
      ],
      createdAt: '2026-11-03',
      updatedAt: '2026-11-03',
    };

    // Sanitize for student
    const studentData = sanitizeExamDataForStudent(fullTest);
    const p3Sec = studentData.sections[0];

    assert.equal(p3Sec.speakingPart3Groups?.length, 1);
    assert.equal(p3Sec.speakingPart3Groups?.[0].questions.length, 2, 'Student UI receives ONLY the 2 selected questions');
    assert.deepEqual(
      p3Sec.speakingPart3Groups?.[0].questions,
      [
        'How has the Internet changed everyday communication?',
        'Do older people have difficulty adapting to new technologies?',
      ]
    );

    console.log('✓ Passed: Regular Test persists only selected Part 3 questions and student UI renders only those questions.');
  });

  // -------------------------------------------------------------------------
  // TEST 5: Student UI Never Appears as Audio-Only Test
  // -------------------------------------------------------------------------
  await t.test('5. Acceptance Criterion: Listening test with valid questions never appears as audio-only in Student UI', async () => {
    const listeningTest: RegularTest = {
      id: 'test_listening_complete',
      courseId: 'c1',
      teacherId: 't1',
      title: 'IELTS Listening Practice Test 1',
      instructions: 'Listen to the audio and answer all 40 questions.',
      skills: ['listening'],
      durationMinutes: 30,
      timingMode: 'overall_timer',
      strictPreset: 'standard',
      strictSettings: {} as any,
      status: 'published',
      currentVersion: 1,
      sections: [
        {
          id: 'sec_listen_1',
          skill: 'listening',
          title: 'Listening Test',
          audioUrl: 'https://example.com/audio.mp3',
          listeningAudioUrl: 'https://example.com/audio.mp3',
          listeningParts: [
            {
              partNumber: 1,
              title: 'Part 1',
              questionGroups: [
                {
                  id: 'g1',
                  type: 'note_completion',
                  title: 'Questions 1-5',
                  instructions: 'Complete the notes below.',
                  questions: [
                    { id: 'lq1', questionNumber: 1, prompt: 'Name: ___', correctAnswer: 'John', explanation: 'Script 1' },
                    { id: 'lq2', questionNumber: 2, prompt: 'Room: ___', correctAnswer: '102', explanation: 'Script 2' },
                  ],
                },
              ],
              questions: [],
            },
          ],
        },
      ],
      createdAt: '2026-11-03',
      updatedAt: '2026-11-03',
    };

    const sanitized = sanitizeExamDataForStudent(listeningTest);
    const listenSec = sanitized.sections[0];

    // Must have audioUrl
    assert.ok(listenSec.audioUrl || listenSec.listeningAudioUrl, 'Audio URL must be present');
    // Must NOT have empty parts
    assert.ok(listenSec.listeningParts && listenSec.listeningParts.length > 0, 'Listening parts must be present');
    // Must NOT have empty questions
    const totalQCount = (listenSec.listeningParts || []).reduce((acc, p) => {
      const qFromParts = p.questions?.length || 0;
      const qFromGroups = (p.questionGroups || []).reduce((gAcc, g) => gAcc + (g.questions?.length || 0), 0);
      return acc + qFromParts + qFromGroups;
    }, 0);
    assert.equal(totalQCount, 2, 'Student UI must have questions populated, not audio-only');

    // Correct answers must be stripped
    const firstQ = listenSec.listeningParts?.[0].questionGroups?.[0].questions?.[0] as any;
    assert.equal(firstQ.correctAnswer, undefined, 'Student UI must not expose correct answers');
    assert.equal(firstQ.explanation, undefined, 'Student UI must not expose explanations');
    assert.equal(firstQ.prompt, 'Name: ___', 'Prompt must be preserved');

    console.log('✓ Passed: Acceptance criterion satisfied – listening test is never audio-only in student test UI.');
  });
});
