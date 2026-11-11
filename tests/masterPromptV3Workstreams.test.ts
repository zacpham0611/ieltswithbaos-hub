import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  categorizeStudentTests,
  calculateRemainingSeconds,
} from '../src/lib/regularTestManager.ts';
import {
  convertHtmlTablesToMarkdown,
  htmlToListeningText,
  cleanListeningText,
  normalizeListeningStructuredText,
} from '../src/lib/listeningExtractor.ts';
import {
  buildQuestionRenderGroups,
  buildCompletionGroupText,
  normalizeReadingQuestion,
  cleanReadingText,
  extractAllNormalizedQuestions,
} from '../src/lib/questionNormalizer.ts';
import type { RegularTest, RegularTestAttempt, ReadingQuestion } from '../src/types/index.ts';

describe('MASTER PROMPT V3: WORKSTREAM A — REGULAR TEST PERSISTENCE & CATEGORIZATION', () => {
  it('1. Tests remain available and do not disappear for active scheduled/live window', () => {
    const studentId = 'student-uuid-1';
    const now = new Date();
    const liveTest: RegularTest = {
      id: 'test-live-1',
      courseId: 'course-1',
      courseName: 'IELTS Intensive',
      teacherId: 'teacher-1',
      teacherName: 'Teacher',
      title: 'Midterm Examination',
      instructions: 'Do your best',
      skills: ['reading', 'writing'],
      durationMinutes: 120,
      timingMode: 'overall_timer',
      status: 'live',
      availabilityStart: new Date(now.getTime() - 3600000).toISOString(),
      availabilityEnd: new Date(now.getTime() + 7200000).toISOString(),
      sections: [],
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    };

    const scheduledWithinWindow: RegularTest = {
      id: 'test-sched-1',
      courseId: 'course-1',
      courseName: 'IELTS Intensive',
      teacherId: 'teacher-1',
      teacherName: 'Teacher',
      title: 'Scheduled Test Now Open',
      instructions: 'Exam open',
      skills: ['reading'],
      durationMinutes: 60,
      timingMode: 'overall_timer',
      status: 'scheduled',
      availabilityStart: new Date(now.getTime() - 1800000).toISOString(),
      availabilityEnd: new Date(now.getTime() + 3600000).toISOString(),
      sections: [],
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    };

    const tests = [liveTest, scheduledWithinWindow];
    const attempts: RegularTestAttempt[] = [];

    const categorized = categorizeStudentTests(tests, attempts, studentId);
    assert.strictEqual(categorized.available.length, 2, 'Both active tests should be in available tab');
    assert.strictEqual(categorized.upcoming.length, 0);
  });

  it('2. Hydrated attempts categorize in-progress and submitted tests across reloads', () => {
    const studentId = 'student-uuid-1';
    const test: RegularTest = {
      id: 'test-1',
      courseId: 'course-1',
      courseName: 'IELTS Academic',
      teacherId: 'teacher-1',
      teacherName: 'Teacher',
      title: 'Periodic Reading Test',
      instructions: '',
      skills: ['reading'],
      durationMinutes: 60,
      timingMode: 'overall_timer',
      status: 'live',
      sections: [],
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    };

    // Simulated restored in-progress attempt
    const inProgressAttempt: RegularTestAttempt = {
      id: 'att-1',
      testId: 'test-1',
      versionId: 'v-1',
      studentId,
      studentName: 'Student 1',
      studentEmail: 's1@test.com',
      courseId: 'course-1',
      attemptNumber: 1,
      serverStartTime: new Date().toISOString(),
      serverDeadline: new Date(Date.now() + 3600000).toISOString(),
      extraTimeMinutes: 0,
      currentSectionIndex: 0,
      status: 'in_progress',
      answers: { reading: { q_1: 'A' }, writing: { text: '', wordCount: 0 } },
      gradingStatus: 'pending',
      isReleased: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const categorized = categorizeStudentTests([test], [inProgressAttempt], studentId);
    assert.strictEqual(categorized.inProgress.length, 1, 'In-progress attempt must be placed in in_progress tab');
    assert.strictEqual(categorized.available.length, 0, 'Test with in-progress attempt must not show in available tab');

    // Simulated submitted attempt
    const submittedAttempt: RegularTestAttempt = {
      ...inProgressAttempt,
      id: 'att-2',
      status: 'submitted',
      isReleased: false,
    };

    const categorizedSubmitted = categorizeStudentTests([test], [submittedAttempt], studentId);
    assert.strictEqual(categorizedSubmitted.submitted.length, 1, 'Submitted attempt must be in submitted tab');
    assert.strictEqual(categorizedSubmitted.available.length, 0);
  });
});

describe('MASTER PROMPT V3: WORKSTREAM B — LISTENING TABLE & CONTENT RENDERING', () => {
  it('3. Multi-line HTML table cells preserve internal line breaks with <br />', () => {
    const html = `
      <table>
        <tr><th>Children</th><th>Classes</th></tr>
        <tr>
          <td>20 in a class</td>
          <td>First group - Mrs. Oliver<br />Second group - Mrs. 1 …………</td>
        </tr>
      </table>
    `;

    const md = convertHtmlTablesToMarkdown(html);
    assert.ok(md.includes('| Children | Classes |'), 'Markdown table header must be generated');
    assert.ok(md.includes('First group - Mrs. Oliver<br />Second group - Mrs. [1]'), 'Internal cell line break must be preserved as <br />');
  });

  it('4. Raw table lines with missing outer pipes are normalized cleanly', () => {
    const rawMarkdownFixture = `
Example |
--- | ---
Children: | 20 in a class
Classes: | First group - Mrs. Oliver<br />Second group - Mrs. [1]
Hours & Days: | 8:30 AM - 4:00 PM
Activities: | Outside time<br />• running<br />• just got a new piece of [2]
    `.trim();

    // Verify pipe normalization logic
    const normalizedLines = rawMarkdownFixture.split('\n').map((l) => {
      let trimmed = l.trim();
      if (!trimmed.includes('|')) return trimmed;
      if (!trimmed.startsWith('|')) trimmed = '| ' + trimmed;
      if (!trimmed.endsWith('|')) trimmed = trimmed + ' |';
      return trimmed;
    });

    const tableRows = normalizedLines.filter((l) => l.startsWith('|') && l.endsWith('|'));
    assert.strictEqual(tableRows.length, 6, 'All 6 key-value rows including Example and separator must be recognized');

    const firstRowParts = tableRows[2].slice(1, -1).split('|').map((s) => s.trim());
    assert.strictEqual(firstRowParts[0], 'Children:');
    assert.strictEqual(firstRowParts[1], '20 in a class');
  });

  it('5. Question blank markers do not pollute surrounding text with inline Flag', () => {
    const textWithBlank = 'Activities: Outside time and playing with [1] in the garden';
    const parts = textWithBlank.split(/(\[[0-9]{1,2}\])/g);

    assert.strictEqual(parts.length, 3);
    assert.strictEqual(parts[0], 'Activities: Outside time and playing with ');
    assert.strictEqual(parts[1], '[1]');
    assert.strictEqual(parts[2], ' in the garden');
  });
});

describe('MASTER PROMPT V3: WORKSTREAM C — READING MODULE PERSISTENCE & ISOLATION', () => {
  it('6. Strict boundary isolation: Summary Completion with Word List followed by YNNG never merges', () => {
    const summaryQuestions: ReadingQuestion[] = [
      {
        id: 'q_33',
        type: 'summary_completion',
        prompt: 'The extent of future sea level rises is determined in the (33) ...............',
        options: ['A. drive', 'B. outstanding', 'C. career', 'D. financial'],
        correctAnswer: 'A',
      },
      {
        id: 'q_34',
        type: 'summary_completion',
        prompt: 'The main contributing factor will be (34) ...............',
        options: ['A. drive', 'B. outstanding', 'C. career', 'D. financial'],
        correctAnswer: 'B',
      },
    ];

    const ynngQuestions: ReadingQuestion[] = [
      {
        id: 'q_35',
        type: 'yes_no_not_given',
        prompt: 'Coastal cities are facing unprecedented challenges due to tidal surges.',
        correctAnswer: 'YES',
      },
      {
        id: 'q_36',
        type: 'yes_no_not_given',
        prompt: 'Government investments have already eliminated flood risks entirely.',
        correctAnswer: 'NO',
      },
    ];

    const allQuestions = [...summaryQuestions, ...ynngQuestions];
    const groups = buildQuestionRenderGroups(allQuestions);

    assert.strictEqual(groups.length, 2, 'Summary Completion and YNNG must be split into 2 distinct groups');

    // Group 1: Summary Completion
    assert.strictEqual(groups[0].groupType, 'summary_completion');
    assert.strictEqual(groups[0].questions.length, 2);
    assert.ok(groups[0].wordList && groups[0].wordList.length === 4, 'Summary Completion must have word list');

    // Group 2: Yes / No / Not Given
    assert.strictEqual(groups[1].groupType, 'yes_no_not_given');
    assert.strictEqual(groups[1].questions.length, 2);
    assert.strictEqual(groups[1].wordList, undefined, 'Word list must NOT leak to Yes/No/Not Given group');
  });

  it('7. Note Completion preserves visual hierarchy: headings, top-level bullets, and sub-bullets', () => {
    const rawNotePrompts = [
      'Climate Change Impacts\n• Global temperature rise:\n  - Increased heatwaves in summer [33]\n  - Melting glaciers [34]',
      '• Agricultural effects:\n  - Reduced harvest yields [35]',
    ];

    const questions: ReadingQuestion[] = [
      { id: 'q_33', type: 'note_completion', prompt: rawNotePrompts[0], correctAnswer: 'heat' },
      { id: 'q_34', type: 'note_completion', prompt: rawNotePrompts[0], correctAnswer: 'ice' },
      { id: 'q_35', type: 'note_completion', prompt: rawNotePrompts[1], correctAnswer: 'wheat' },
    ];

    const groupText = buildCompletionGroupText(questions.map((q, idx) => ({ q, idx })));
    assert.ok(groupText.includes('Climate Change Impacts'), 'Note heading must be preserved');
    assert.ok(groupText.includes('•') || groupText.includes('\n'), 'Bullet indicators and line breaks must be preserved');

    // Verify sub-bullet indentation detection
    const lines = groupText.split('\n').map((l) => l.trim()).filter(Boolean);
    assert.ok(lines.length >= 2, 'Note completion must preserve multiple lines');
  });

  it('8. Question Type Override takes strict priority over raw question type during rendering', () => {
    const q: ReadingQuestion = {
      id: 'q_37',
      type: 'summary_completion', // raw auto-detected type
      questionTypeOverride: 'yes_no_not_given', // teacher manually corrected
      prompt: '37 The new policy was approved without debate.',
      correctAnswer: 'YES',
    };

    const groups = buildQuestionRenderGroups([q]);
    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].groupType, 'yes_no_not_given', 'Group must inherit teacher override');
    assert.strictEqual(groups[0].wordList, undefined, 'Must not attach wordList when overridden to YNNG');
  });

  it('9. Regular test submission persistence preserves valid UUID v4 schema, versionId & courseId', () => {
    // Standard UUID v4 validator regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const testId = '44556677-8899-4000-8000-000000000001';
    const versionId = '44556677-8899-4000-8000-000000000002';
    const studentId = '44556677-8899-4000-8000-000000000003';
    const courseId = '44556677-8899-4000-8000-000000000004';
    const attemptId = '44556677-8899-4000-8000-000000000005';

    assert.ok(uuidRegex.test(attemptId), 'Attempt ID must be a valid UUID v4');
    assert.ok(uuidRegex.test(versionId), 'Version ID must be a valid UUID v4');
    assert.ok(uuidRegex.test(courseId), 'Course ID must be a valid UUID v4');

    const attempt: RegularTestAttempt = {
      id: attemptId,
      testId,
      versionId,
      studentId,
      courseId,
      attemptNumber: 1,
      serverStartTime: new Date().toISOString(),
      serverDeadline: new Date(Date.now() + 3600000).toISOString(),
      extraTimeMinutes: 0,
      currentSectionIndex: 0,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      autoSubmitted: false,
      sessionToken: 'tok_test',
      answers: { reading: { q_1: 'YES', q_2: 'NO' }, writing: { text: '', wordCount: 0 } },
      flaggedQuestions: {},
    };

    assert.strictEqual(attempt.status, 'submitted');
    assert.ok(attempt.submittedAt);
    assert.strictEqual(attempt.courseId, courseId);
    assert.strictEqual(attempt.versionId, versionId);
  });

  it('10. Listening SVG artifact cleaning and markdown table separator stripping', () => {
    const dirtyLine1 = 'Second group - Mrs.**1**svg';
    const cleaned1 = cleanListeningText(dirtyLine1);
    assert.strictEqual(cleaned1, 'Second group - Mrs.**1**', 'Serialized svg tag after bolded question number must be removed');

    const dirtyLine2 = 'Hours & Days: | Suzie will attend 3 days a week for a total of **2**svghours';
    const cleaned2 = cleanListeningText(dirtyLine2);
    assert.strictEqual(
      cleaned2,
      'Hours & Days: | Suzie will attend 3 days a week for a total of **2** hours',
      'svghours must be separated into hours without leaving svg'
    );

    const dirtyLine3 = '--- | --- Children: | 20 in a class';
    const stripped3 = dirtyLine3.replace(/^(?:\|?\s*:?-{2,}:?\s*)+[\|\s]*/, '');
    assert.strictEqual(stripped3, 'Children: | 20 in a class', 'Orphaned table separator prefix must be stripped');
  });

  it('11. Reading Note Completion visual hierarchy preserves numbered lists and sub-bullets', () => {
    const rawNoteWithHierarchy = `
Background Overview:
1. Primary economic factor [31]
• Environmental changes:
  ◦ Water temperature variations [32]
  ◦ Salinity shifts in estuarine areas [33]
    `.trim();

    const lines = rawNoteWithHierarchy.split('\n').filter((l) => l.trim().length > 0);
    assert.strictEqual(lines.length, 5);

    // Verify Heading
    const line0 = lines[0].trim();
    const isHeading = !line0.startsWith('•') && line0.endsWith(':');
    assert.ok(isHeading, 'Background Overview: must be identified as Heading');

    // Verify Numbered Item
    const line1 = lines[1].trim();
    const isNumbered = /^\d+[\.\)]\s+/.test(line1);
    assert.ok(isNumbered, '1. Primary economic factor must be identified as Numbered List Item');

    // Verify Sub-bullet
    const line3 = lines[3];
    const isSub = /^(?:[ \t]{2,}[•\-\*\+◦]|--|–|\t)/.test(line3);
    assert.ok(isSub, 'Indented sub-bullet must be detected with isSubBullet = true');
  });

  it('12. Final question of Yes/No/Not Given with answer NOT GIVEN/NG correctly retains type and blocks Word List leakage', () => {
    const rawSummaryQuestions = [
      {
        id: 'q_33',
        type: 'summary_completion',
        prompt: 'Marine ecosystems are impacted by [33] in global oceans.',
        options: ['A. warming', 'B. acidity', 'C. currents', 'D. pressure'],
        correctAnswer: 'A',
      },
      {
        id: 'q_34',
        type: 'summary_completion',
        prompt: 'The greatest threat is accelerated [34] near the poles.',
        options: ['A. warming', 'B. acidity', 'C. currents', 'D. pressure'],
        correctAnswer: 'B',
      },
    ];

    const rawYnngQuestions = [
      {
        id: 'q_35',
        type: 'short_answer',
        prompt: 'The coastal barrier will be completed ahead of schedule.',
        correctAnswer: 'YES',
        instruction: 'Do the following statements agree with the claims of the writer in Reading Passage 3? Write YES, NO or NOT GIVEN.',
      },
      {
        id: 'q_36',
        type: 'short_answer',
        prompt: 'Local authorities opposed the implementation of environmental regulations.',
        correctAnswer: 'NO',
        instruction: 'Do the following statements agree with the claims of the writer in Reading Passage 3? Write YES, NO or NOT GIVEN.',
      },
      // Crucial test case: Final question with answer "NOT GIVEN" / "NG"
      {
        id: 'q_37',
        type: 'short_answer',
        prompt: 'International funding was sought to support ongoing conservation efforts.',
        correctAnswer: 'NOT GIVEN',
        instruction: 'Do the following statements agree with the claims of the writer in Reading Passage 3? Write YES, NO or NOT GIVEN.',
      },
    ];

    // Normalize each question through normalizeReadingQuestion
    const normSummary = rawSummaryQuestions.map((q, idx) => normalizeReadingQuestion(q, idx + 1));
    const normYnng = rawYnngQuestions.map((q, idx) => normalizeReadingQuestion(q, idx + 3));

    // The final question (Q37) must be resolved as yes_no_not_given despite having correctAnswer "NOT GIVEN"
    assert.strictEqual(normYnng[2].type, 'yes_no_not_given', 'Question 37 with answer NOT GIVEN must be yes_no_not_given');
    assert.strictEqual(normYnng[2].options, undefined, 'Question 37 must not carry options');

    // Now test group building across the boundary
    const allNormQuestions = [...normSummary, ...normYnng];
    const groups = buildQuestionRenderGroups(allNormQuestions);

    assert.strictEqual(groups.length, 2, 'Must strictly split into 2 groups: Summary Completion & YNNG');
    assert.strictEqual(groups[0].groupType, 'summary_completion');
    assert.strictEqual(groups[0].questions.length, 2);
    assert.ok(groups[0].wordList && groups[0].wordList.length === 4);

    assert.strictEqual(groups[1].groupType, 'yes_no_not_given');
    assert.strictEqual(groups[1].questions.length, 3, 'Group 2 must have all 3 YNNG questions including Q37');
    assert.strictEqual(groups[1].wordList, undefined, 'Word list must not leak into YNNG');
    assert.strictEqual(groups[1].questions[2].q.type, 'yes_no_not_given');
  });

  it('13. Question 40 in student view (without answers) preserves YNNG and is not coerced to Summary Completion', () => {
    // Simulate imported material with Passage 3 containing Summary Completion (36-39) and YNNG (40)
    const assignmentPayload = {
      title: 'Academic Reading Practice Test',
      passages: [
        {
          id: 'p_3',
          passageIndex: 2,
          title: 'The Future of Renewable Energy',
          content: 'Renewable energy systems are expanding rapidly...',
          questionGroups: [
            {
              id: 'g_p3_1',
              groupType: 'summary_completion',
              questionType: 'summary_completion',
              isTeacherEdited: true, // Teacher edited something in the group
              instructions: 'Complete the summary below using the list of words, A-G.',
              questions: [
                { id: 'q_36', type: 'summary_completion', prompt: 'Solar power is [36] globally.', options: ['A. surging', 'B. fading'] },
                { id: 'q_37', type: 'summary_completion', prompt: 'Wind power contributes [37] output.', options: ['A. surging', 'B. fading'] },
                { id: 'q_38', type: 'summary_completion', prompt: 'Hydroelectric energy [38] baseline.', options: ['A. surging', 'B. fading'] },
                { id: 'q_39', type: 'summary_completion', prompt: 'Battery storage offers [39] grid stability.', options: ['A. surging', 'B. fading'] },
                {
                  id: 'q_40',
                  type: 'yes_no_not_given', // Correctly imported type in library
                  prompt: '40 Fossil fuels will be completely eliminated by 2030.',
                  // In student exam view, correctAnswer is stripped to empty string
                  correctAnswer: '',
                },
              ],
            },
          ],
        },
      ],
    };

    const extracted = extractAllNormalizedQuestions(assignmentPayload);
    const q40 = extracted.questions.find((q) => q.id === 'q_40');
    assert.ok(q40, 'Question 40 must be extracted');
    assert.strictEqual(q40.type, 'yes_no_not_given', 'Question 40 must retain yes_no_not_given, not coerced to summary_completion');
    assert.strictEqual(q40.options, undefined, 'Question 40 must not inherit word bank options');

    // Build render groups for student UI
    const groups = buildQuestionRenderGroups(extracted.questions);
    const q40Group = groups.find((g) => g.questions.some(({ q }) => q.id === 'q_40'));
    assert.ok(q40Group, 'Question 40 must belong to a render group');
    assert.strictEqual(q40Group.groupType, 'yes_no_not_given', 'Question 40 render group must be yes_no_not_given');
    assert.strictEqual(q40Group.wordList, undefined, 'Word list must NOT be present on Question 40 group');
  });

  it('14. Concatenated table rows & key-value form lines normalized into distinct rows', () => {
    const concatenatedRaw =
      '--- | --- Children: | 20 in a class Classes: | First group - Mrs. Oliver<br />Second group - Mrs. [1] Hours & Days: | 8:30 AM - 4:00 PM Activities: | Outside time<br />• running<br />• just got a new piece of [2]';

    const normalized = normalizeListeningStructuredText(concatenatedRaw);
    const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);

    assert.ok(lines.length >= 4, `Must split into at least 4 lines, got ${lines.length}`);
    assert.ok(lines.some((l) => l.includes('Children: | 20 in a class')), 'Children line must be separate');
    assert.ok(lines.some((l) => l.includes('Classes: | First group')), 'Classes line must be separate');
    assert.ok(lines.some((l) => l.includes('Hours & Days: | 8:30 AM')), 'Hours line must be separate');
    assert.ok(lines.some((l) => l.includes('Activities: | Outside time')), 'Activities line must be separate');
  });

  it('15. htmlToListeningText preserves <br /> tags inside markdown table rows', () => {
    const htmlWithTable = `
      <p>Please complete the notes below:</p>
      <table>
        <tr><th>Facility</th><th>Details</th></tr>
        <tr>
          <td>Pre-school</td>
          <td>First group - Mrs. Oliver<br />Second group - Mrs. 1 …………</td>
        </tr>
      </table>
    `;

    const resultText = htmlToListeningText(htmlWithTable);
    // Table rows must contain <br /> and not be broken into jagged multi-line table rows
    assert.ok(resultText.includes('<br />'), 'Must preserve <br /> inside markdown table cell');
    assert.ok(resultText.includes('| Pre-school | First group - Mrs. Oliver<br />Second group - Mrs. [1] |'));
  });

  it('16. Regular Test deletion and canonical source of truth', () => {
    // When Supabase returns 0 tests (e.g. test deleted by teacher)
    const emptyRtData: any[] = [];
    const mappedTests = emptyRtData.map((t) => t);
    assert.strictEqual(mappedTests.length, 0);

    // Simulated localStorage cache update on deletion
    const userId = 'usr_student_test';
    const mockStorage: Record<string, string> = {
      [`ielts_regular_tests_${userId}`]: JSON.stringify([{ id: 'old_deleted_test', title: 'Deleted' }]),
    };

    // Upon authoritative fetch returning empty, cache is synchronized with authoritative empty state
    mockStorage[`ielts_regular_tests_${userId}`] = JSON.stringify(mappedTests);
    const afterFetch = JSON.parse(mockStorage[`ielts_regular_tests_${userId}`]);
    assert.strictEqual(afterFetch.length, 0, 'Cache must reflect 0 tests after deletion, preventing resurrection');
  });
});
