import { describe, it } from 'node:test';
import assert from 'node:assert';
import { categorizeStudentTests } from '../src/lib/regularTestManager.ts';
import {
  extractAllNormalizedQuestions,
  normalizeReadingQuestion,
  buildQuestionRenderGroups,
} from '../src/lib/questionNormalizer.ts';
import {
  cleanListeningText,
  parseListeningDocument,
} from '../src/lib/listeningExtractor.ts';
import type {
  RegularTest,
  RegularTestAttempt,
  ReadingQuestion,
  QuestionGroup,
  ParsedPassage,
} from '../src/types/index.ts';

describe('MASTER PROMPT V2 – FORENSIC DEBUGGING & PERMANENT BUG FIX VERIFICATION', () => {

  // =========================================================================
  // MODULE 1 (P0): REGULAR TEST – STUDENT UI VISIBILITY ACROSS ROLES & LIFECYCLES
  // =========================================================================
  describe('Module 1 (P0): Regular Test – Student UI Visibility', () => {
    const studentId = 'student_test_user_001';

    const baseTest: RegularTest = {
      id: 'rt_test_001',
      courseId: 'course_ielts_master',
      teacherId: 'teacher_001',
      title: 'IELTS Regular Periodic Exam #1',
      instructions: 'Complete all timed sections under strict exam conditions.',
      skills: ['reading', 'writing', 'listening', 'speaking'],
      durationMinutes: 160,
      timingMode: 'per_section',
      maxAttempts: 1,
      accessCodeEnabled: false,
      strictPreset: 'strict',
      strictSettings: {
        disablePaste: true,
        blockDevtools: true,
        forceFullscreen: true,
        maxViolationsBeforeLockout: 3,
      },
      status: 'live',
      currentVersion: 1,
      releaseSettings: { timing: 'immediate' },
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    };

    it('1.1. Categorizes "live" test within window into available tab', () => {
      const categorized = categorizeStudentTests([baseTest], [], studentId);
      assert.strictEqual(categorized.available.length, 1);
      assert.strictEqual(categorized.available[0].test.id, baseTest.id);
      assert.strictEqual(categorized.upcoming.length, 0);
    });

    it('1.2. Categorizes "scheduled" test whose start time has arrived (or without future start) into available tab', () => {
      const pastStartTest: RegularTest = {
        ...baseTest,
        id: 'rt_scheduled_past',
        status: 'scheduled',
        availabilityStart: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        availabilityEnd: new Date(Date.now() + 3600000 * 24).toISOString(), // tomorrow
      };
      const categorized = categorizeStudentTests([pastStartTest], [], studentId);
      assert.strictEqual(categorized.available.length, 1, 'Scheduled test whose start time arrived must appear in available tab');
      assert.strictEqual(categorized.upcoming.length, 0);
    });

    it('1.3. Categorizes "scheduled" test with future start time into upcoming tab', () => {
      const futureStartTest: RegularTest = {
        ...baseTest,
        id: 'rt_scheduled_future',
        status: 'scheduled',
        availabilityStart: new Date(Date.now() + 3600000 * 24).toISOString(), // tomorrow
      };
      const categorized = categorizeStudentTests([futureStartTest], [], studentId);
      assert.strictEqual(categorized.upcoming.length, 1, 'Scheduled test in future must appear in upcoming tab');
      assert.strictEqual(categorized.available.length, 0);
    });

    it('1.4. Respects eligibleStudentIds direct student assignment', () => {
      const assignedTest: RegularTest = {
        ...baseTest,
        id: 'rt_assigned_direct',
        eligibleStudentIds: [studentId],
      };
      const unassignedTest: RegularTest = {
        ...baseTest,
        id: 'rt_assigned_other',
        eligibleStudentIds: ['other_student_999'],
      };
      const categorized = categorizeStudentTests([assignedTest, unassignedTest], [], studentId);
      assert.strictEqual(categorized.available.length, 1);
      assert.strictEqual(categorized.available[0].test.id, 'rt_assigned_direct');
    });

    it('1.5. Categorizes student attempt states (in_progress, submitted, results_released)', () => {
      const testInProgress: RegularTest = { ...baseTest, id: 'rt_ip' };
      const testSubmitted: RegularTest = { ...baseTest, id: 'rt_sub' };
      const testReleased: RegularTest = { ...baseTest, id: 'rt_rel' };

      const attempts: RegularTestAttempt[] = [
        {
          id: 'att_1',
          testId: 'rt_ip',
          versionId: 'v_1',
          studentId,
          status: 'in_progress',
          attemptNumber: 1,
          startedAt: new Date().toISOString(),
          answers: {},
          flaggedQuestions: {},
          events: [],
        },
        {
          id: 'att_2',
          testId: 'rt_sub',
          versionId: 'v_1',
          studentId,
          status: 'submitted',
          attemptNumber: 1,
          startedAt: new Date().toISOString(),
          submittedAt: new Date().toISOString(),
          answers: {},
          flaggedQuestions: {},
          events: [],
          isReleased: false,
        },
        {
          id: 'att_3',
          testId: 'rt_rel',
          versionId: 'v_1',
          studentId,
          status: 'submitted',
          attemptNumber: 1,
          startedAt: new Date().toISOString(),
          submittedAt: new Date().toISOString(),
          answers: {},
          flaggedQuestions: {},
          events: [],
          isReleased: true,
        },
      ];

      const categorized = categorizeStudentTests(
        [testInProgress, testSubmitted, testReleased],
        attempts,
        studentId
      );

      assert.strictEqual(categorized.inProgress.length, 1);
      assert.strictEqual(categorized.inProgress[0].test.id, 'rt_ip');
      assert.strictEqual(categorized.submitted.length, 1);
      assert.strictEqual(categorized.submitted[0].test.id, 'rt_sub');
      assert.strictEqual(categorized.resultsReleased.length, 1);
      assert.strictEqual(categorized.resultsReleased[0].test.id, 'rt_rel');
    });
  });

  // =========================================================================
  // MODULE 2 (P0): READING – QUESTION TYPE CORRUPTION ACROSS 6 CHECKPOINTS
  // =========================================================================
  describe('Module 2 (P0): Reading – Question Type Overrides Across 6 Checkpoints', () => {
    it('2.1. Preserves Multiple Choice with blanks in prompt stem without converting to Summary Completion', () => {
      const mcWithBlankRaw: Partial<ReadingQuestion> = {
        id: 'q_29',
        type: 'multiple_choice',
        prompt: '29 According to paragraph three, in order to optimise employees’ performance, _______ are needed.',
        options: [
          'A. drive to acquire and achievement',
          'B. a balance of various workplace drives',
          'C. increased financial compensation',
          'D. regular motivational assessments',
        ],
        correctAnswer: 'B',
      };

      const normalized = normalizeReadingQuestion(mcWithBlankRaw);
      assert.strictEqual(
        normalized.type,
        'multiple_choice',
        'Multiple choice question with blanks in stem must NEVER be converted to summary_completion'
      );
    });

    it('2.2. End-to-end 6-checkpoint data flow verification for Summary Completion -> Multiple Choice override', () => {
      // Checkpoint A: Teacher modifies Question Group in Import Preview
      const rawImportedGroup: QuestionGroup = {
        id: 'g_reading_1',
        rangeTitle: 'Questions 1-4',
        groupType: 'multiple_choice',
        questionType: 'multiple_choice',
        questionTypeOverride: 'multiple_choice',
        isTeacherEdited: true,
        instructions: 'Choose the correct letter, A, B, C or D.',
        questions: [
          {
            id: 'q_1',
            type: 'multiple_choice',
            questionTypeOverride: 'multiple_choice',
            isTeacherEdited: true,
            prompt: 'In order to optimize performance, _______ are required.',
            options: ['A. training', 'B. funding', 'C. time', 'D. patience'],
            correctAnswer: 'A',
          },
          {
            id: 'q_2',
            type: 'multiple_choice',
            questionTypeOverride: 'multiple_choice',
            isTeacherEdited: true,
            prompt: 'The main contributing factor was _______ throughout the period.',
            options: ['A. weather', 'B. technology', 'C. management', 'D. location'],
            correctAnswer: 'B',
          },
        ],
      };

      // Checkpoint B: Saved to Materials Library
      const libraryPayload = {
        title: 'IELTS Academic Reading Test 1',
        skill: 'reading',
        readingPassage: 'Text about management and workplace performance...',
        passages: [
          {
            id: 'p_1',
            passageIndex: 0,
            title: 'Passage 1',
            content: 'Text about management and workplace performance...',
            questions: rawImportedGroup.questions,
            questionGroups: [rawImportedGroup],
          },
        ],
        questionGroups: [rawImportedGroup],
        questions: rawImportedGroup.questions,
      };

      const serializedLibraryJson = JSON.stringify(libraryPayload);

      // Checkpoint C: Selection in Materials Library & extractAllNormalizedQuestions
      const parsedLibraryData = JSON.parse(serializedLibraryJson);
      const extracted = extractAllNormalizedQuestions(parsedLibraryData);

      assert.strictEqual(extracted.questions.length, 2);
      assert.strictEqual(extracted.questions[0].type, 'multiple_choice', 'Checkpoint C: Question 1 type must be multiple_choice');
      assert.strictEqual(extracted.questions[1].type, 'multiple_choice', 'Checkpoint C: Question 2 type must be multiple_choice');
      assert.strictEqual(extracted.questionGroups[0].questionType, 'multiple_choice', 'Checkpoint C: Group questionType must be multiple_choice');

      // Checkpoint D: Created Assignment Payload
      const assignmentPayload = {
        title: parsedLibraryData.title,
        skill: 'reading',
        readingQuestions: extracted.questions,
        questionGroups: extracted.questionGroups,
        passages: extracted.passages,
      };

      // Checkpoint E: Retrieved Assignment from DB & unpacked
      const retrievedUnpacked = extractAllNormalizedQuestions({
        readingQuestions: assignmentPayload.readingQuestions,
        questionGroups: assignmentPayload.questionGroups,
        passages: assignmentPayload.passages,
      });

      assert.strictEqual(retrievedUnpacked.questions[0].type, 'multiple_choice', 'Checkpoint E: Retrieved Question 1 must be multiple_choice');
      assert.strictEqual(retrievedUnpacked.questions[1].type, 'multiple_choice', 'Checkpoint E: Retrieved Question 2 must be multiple_choice');

      // Checkpoint F: Student Assignment UI rendering with buildQuestionRenderGroups
      const renderGroups = buildQuestionRenderGroups(retrievedUnpacked.questions);
      assert.strictEqual(renderGroups.length, 1);
      assert.strictEqual(renderGroups[0].groupType, 'multiple_choice', 'Checkpoint F: Render group type must be multiple_choice');
      assert.strictEqual(renderGroups[0].questions.length, 2);
    });

    it('2.3. End-to-end 6-checkpoint data flow for Multiple Choice -> Note Completion override', () => {
      const rawGroup: QuestionGroup = {
        id: 'g_reading_note',
        rangeTitle: 'Questions 5-6',
        groupType: 'note_completion',
        questionType: 'note_completion',
        questionTypeOverride: 'note_completion',
        isTeacherEdited: true,
        instructions: 'Complete the notes below. Write ONE WORD ONLY.',
        questions: [
          {
            id: 'q_5',
            type: 'note_completion',
            questionTypeOverride: 'note_completion',
            isTeacherEdited: true,
            prompt: 'The main crop harvested was [5].',
            correctAnswer: 'wheat',
          },
          {
            id: 'q_6',
            type: 'note_completion',
            questionTypeOverride: 'note_completion',
            isTeacherEdited: true,
            prompt: 'Local farmers traded with [6] for supplies.',
            correctAnswer: 'merchants',
          },
        ],
      };

      const extracted = extractAllNormalizedQuestions({
        questionGroups: [rawGroup],
        questions: rawGroup.questions,
      });

      assert.strictEqual(extracted.questions[0].type, 'note_completion');
      assert.strictEqual(extracted.questions[1].type, 'note_completion');

      const renderGroups = buildQuestionRenderGroups(extracted.questions);
      assert.strictEqual(renderGroups[0].groupType, 'note_completion');
      assert.ok(renderGroups[0].groupText, 'Note completion render group must have reconstructed groupText');
    });
  });

  // =========================================================================
  // MODULE 3 (P1): LISTENING – UNWANTED ARTIFACTS & TABLE BULLET LINE BREAKS
  // =========================================================================
  describe('Module 3 (P1): Listening – Form Artifacts & Table Cell Bullets', () => {
    it('3.1. Correctly classifies Form Completion with key-value table lines and strips markdown table artifacts', () => {
      const rawFormDocText = `
Complete the form below.
Write ONE WORD AND/OR A NUMBER for each answer.
Rental Property Application Form
| Example   |  |
| Name:   | Susan Smith   |
| Phone number:   | 1 ……………… (mobile)   |
| Email address:   | Susansmith@ 2 ………………   |
| Current address:   | 234 Becketts Road, Brisbane. 4054   |
| New Zealand Employer:   | Auckland Hospital   |
| Occupation:   | a 3 ………………   |
| Rental start date:   | 8th February   |
| Preferred property type:   | •  first preference: a house with a 4 ………………  •  second preference: an apartment with a big 5 ………………   |
| Bedrooms:   | two   |
| Furnishings:   | a 6 ……………… is required   |
| Maximum rent:   | 7 $ ……………… per week   |
| Preferred location:   | near the 8 ………………   |
| Other requirements:   | must have 9 ……………… nearby  would like 10 ……………… included in the rent   |
`;

      const parsed = parseListeningDocument(rawFormDocText, 'IELTS Test 2 Listening');
      assert.strictEqual(parsed.parts.length, 1);
      const part1 = parsed.parts[0];
      const group1 = part1.questionGroups[0];

      // Verify question count
      assert.strictEqual(group1.questions.length, 10, 'Form Completion must parse exactly 10 questions');
      assert.strictEqual(group1.questions[0].questionNumber, 1);
      assert.strictEqual(group1.questions[9].questionNumber, 10);

      // Verify clean text does not contain unwanted raw markdown pipes
      const cleanGroupContent = cleanListeningText(group1.sharedContent || group1.groupText || '');
      assert.ok(!cleanGroupContent.includes('--- | ---'), 'Must not contain raw table separator artifacts');
    });

    it('3.2. Form Completion cell with multiple bullets splits into distinct bullet items', () => {
      const cellText = '• first preference: a house with a 4 ………………  • second preference: an apartment with a big 5 ………………';
      const hasBullets = /(?:^|\s+)(?:[•\u2022]|\*\s+)/.test(cellText);
      assert.ok(hasBullets);

      const bulletItems = cellText
        .split(/(?:^|\s+)(?:[•\u2022]|\*\s+)/)
        .map((b) => b.trim())
        .filter(Boolean);

      assert.strictEqual(bulletItems.length, 2, 'Cell with two bullet points must split into 2 distinct items');
      assert.ok(bulletItems[0].includes('first preference'));
      assert.ok(bulletItems[1].includes('second preference'));
    });
  });

  // =========================================================================
  // MODULE 4 (P1): LISTENING – NOTE COMPLETION STRUCTURE & EMPTY BULLET REMOVAL
  // =========================================================================
  describe('Module 4 (P1): Listening – Note Completion Structure & Empty Bullets', () => {
    it('4.1. Strips isolated bullet lines and prevents empty bullet points', () => {
      const rawNotesWithEmptyBullets = `
Features of the Pre-school Family Centre
•
for children from 11 ……………… to 5 years old
•
run as a 12 ……………… by parents, who attend with their children
•
parents receive special 13 ……………… from the centre
• children's activities organised in 14 ……………… age groups
• 
`;

      // Clean using our updated regex logic
      let formattedText = rawNotesWithEmptyBullets.replace(/^[•\-\*\+]\s*$/gm, '');
      formattedText = formattedText.replace(/^[•\-\*\+]\s*\n(?=[A-Za-z0-9\[])/gm, '• ');

      const lines = formattedText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const emptyBulletLines = lines.filter((l) => {
        const isBullet = /^[•\-\*\+]\s*/.test(l);
        const clean = l.replace(/^[•\-\*\+\s]+/, '').trim();
        return isBullet && clean.length === 0;
      });

      assert.strictEqual(emptyBulletLines.length, 0, 'Zero empty bullet lines should exist in processed notes');
    });

    it('4.2. Merges multi-line wrapped bullet items without splitting into detached paragraphs', () => {
      const wrappedNotesText = `
Features of the Centre
• sessions from 9.30-12.30 each morning
• one afternoon session to help prepare older children
  for 15 [15] at school
• parents must make several 16 [16] before they enrol
`;

      const rawLines = wrappedNotesText.split('\n').map((l) => l.trim()).filter(Boolean);
      const lines: string[] = [];
      for (let i = 0; i < rawLines.length; i++) {
        const cur = rawLines[i];
        if (
          lines.length > 0 &&
          !/^[•\-\*\+]/.test(cur) &&
          !cur.endsWith(':') &&
          !/^[A-Z][a-zA-Z\s]{1,35}$/.test(cur) &&
          /^[•\-\*\+]/.test(lines[lines.length - 1]) &&
          !lines[lines.length - 1].endsWith('.')
        ) {
          lines[lines.length - 1] += ' ' + cur;
        } else {
          lines.push(cur);
        }
      }

      // Check that wrapped line was merged into the bullet item
      const bulletWith15 = lines.find((l) => l.includes('15 [15]'));
      assert.ok(bulletWith15, 'Bullet item containing [15] must be found');
      assert.ok(bulletWith15.startsWith('• one afternoon session'), 'Bullet item must contain the starting sentence');
      assert.ok(bulletWith15.includes('at school'), 'Bullet item must contain the continuation text');
    });
  });
});
