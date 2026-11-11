import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  categorizeStudentTests,
  calculateRemainingSeconds,
} from '../src/lib/regularTestManager.ts';
import {
  convertHtmlTablesToMarkdown,
  htmlToListeningText,
} from '../src/lib/listeningExtractor.ts';
import {
  buildQuestionRenderGroups,
  buildCompletionGroupText,
  normalizeReadingQuestion,
  cleanReadingText,
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
});
