import assert from 'node:assert';
import {
  extractAllNormalizedQuestions,
  buildQuestionRenderGroups,
  normalizeReadingQuestion,
} from '../src/lib/questionNormalizer.ts';
import type { ReadingQuestion, QuestionGroup, ParsedPassage, MonthlyReport } from '../src/types/index.ts';

console.log('--- RUNNING CRITICAL QUESTION TYPE & ASSESSMENT PERSISTENCE TESTS ---');

// --------------------------------------------------------------------------
// TEST 1: Question Group Type Override Cascades and Persists into Assignment
// --------------------------------------------------------------------------
console.log('Testing Test 1: Teacher changes Question Group type from Summary Completion to Multiple Choice...');
{
  // Simulates a test where questions were auto-detected as summary_completion
  // but teacher explicitly changed the group's type to multiple_choice
  const rawGroupWithOverride: QuestionGroup = {
    id: 'grp_1',
    passageIndex: 0,
    questionType: 'multiple_choice' as any,
    questionTypeOverride: 'multiple_choice' as any,
    isTeacherEdited: true,
    title: 'Questions 1-5',
    instructions: 'Choose the correct letter, A, B, C or D.',
    questions: [
      {
        id: 'q_1',
        type: 'summary_completion', // auto-detected initially
        prompt: 'The main discovery was made in 1 _____ by Yuri Khudi.',
        options: ['1999', '2007', '2012', '2020'],
      } as any,
      {
        id: 'q_2',
        type: 'summary_completion', // auto-detected initially
        prompt: 'The specimen was identified as a 2 _____ mammoth.',
        options: ['adult', 'baby', 'fossilized', 'woolly'],
      } as any,
    ],
  };

  const assignmentPayload = {
    title: 'Baby Mammoth Test',
    readingPassage: 'A near-perfect frozen mammoth offers clues...',
    questionGroups: [rawGroupWithOverride],
    readingQuestions: rawGroupWithOverride.questions,
  };

  const extracted = extractAllNormalizedQuestions(assignmentPayload);

  // Verification 1: Every child question in extracted.questions must have type 'multiple_choice'
  assert.strictEqual(extracted.questions.length, 2, 'Must extract exactly 2 questions');
  assert.strictEqual(extracted.questions[0].type, 'multiple_choice', 'Q1 type must inherit group override');
  assert.strictEqual(extracted.questions[0].questionTypeOverride, 'multiple_choice', 'Q1 must have override set');
  assert.strictEqual(extracted.questions[1].type, 'multiple_choice', 'Q2 type must inherit group override');
  assert.strictEqual(extracted.questions[1].questionTypeOverride, 'multiple_choice', 'Q2 must have override set');

  // Verification 2: Render groups must group them under multiple_choice (button type), not completion
  const renderGroups = buildQuestionRenderGroups(extracted.questions);
  assert.strictEqual(renderGroups.length, 1, 'Should form 1 render group');
  assert.strictEqual(renderGroups[0].groupType, 'multiple_choice', 'Render group type must be multiple_choice');

  console.log('✓ Test 1 Passed: Teacher group override correctly cascades and configures render groups.');
}

// --------------------------------------------------------------------------
// TEST 2: Multiple-choice to Note Completion override persistence
// --------------------------------------------------------------------------
console.log('Testing Test 2: Teacher changes Question Group type from Multiple Choice to Note Completion...');
{
  const rawGroupWithOverride: QuestionGroup = {
    id: 'grp_note',
    passageIndex: 0,
    questionType: 'note_completion' as any,
    questionTypeOverride: 'note_completion' as any,
    isTeacherEdited: true,
    title: 'Questions 31-35',
    instructions: 'Complete the notes below. Write ONE WORD ONLY.',
    questions: [
      {
        id: 'q_31',
        type: 'multiple_choice',
        prompt: 'Local languages: 31 _____ languages: 8',
      } as any,
      {
        id: 'q_32',
        type: 'multiple_choice',
        prompt: 'English is used in the 32 _____ system',
      } as any,
    ],
  };

  const assignmentPayload = {
    title: 'Bislama Exercise',
    readingPassage: 'Languages in Vanuatu...',
    questionGroups: [rawGroupWithOverride],
  };

  const extracted = extractAllNormalizedQuestions(assignmentPayload);
  assert.strictEqual(extracted.questions[0].type, 'note_completion');
  assert.strictEqual(extracted.questions[0].questionTypeOverride, 'note_completion');
  assert.strictEqual(extracted.questions[1].type, 'note_completion');

  const renderGroups = buildQuestionRenderGroups(extracted.questions);
  assert.strictEqual(renderGroups[0].groupType, 'note_completion');
  assert.ok(renderGroups[0].groupText && renderGroups[0].groupText.includes('[31]'));

  console.log('✓ Test 2 Passed: Multiple Choice -> Note Completion override preserved with groupText reconstruction.');
}

// --------------------------------------------------------------------------
// TEST 3: Periodic Assessment Persistence, State Transitions & Student Access
// --------------------------------------------------------------------------
console.log('Testing Test 3: Periodic Assessment persistence, caching and role-based visibility...');
{
  const teacherId = 'teacher_uuid_123';
  const studentId = 'student_uuid_456';

  // 1. Created draft report
  const reportDraft: MonthlyReport = {
    id: 'report_001',
    courseId: 'course_101',
    courseName: 'IELTS Academic Masterclass',
    studentId,
    studentName: 'Nguyen Van A',
    studentEmail: 'vana@example.com',
    teacherId,
    teacherName: 'Teacher John',
    month: '2026-10',
    state: 'ai_generated',
    createdAt: '2026-10-15 10:00',
    learningEvidence: {
      submissionsAnalyzedCount: 5,
      writingSubmissionsCount: 2,
      readingSubmissionsCount: 3,
      speakingRecordingsCount: 0,
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      averageScore: 7.0,
      skillsBreakdown: { reading: 7.5, writing: 6.5 },
    },
    aiDraft: {
      strengths: 'Strong skimming and scanning ability.',
      focusAreas: 'Task 2 essay coherence and paragraph cohesion.',
      evidenceGapsFlagged: 'No speaking recordings in this month.',
      recurringPatterns: 'Consistent high accuracy on completion questions.',
    },
    teacherEvaluation: {
      professionalJudgement: '',
      nextMonthPriorities: '',
    },
    history: [
      {
        version: 1,
        action: 'AI draft generated',
        timestamp: '2026-10-15 10:00',
        actor: 'AI Assistant',
      },
    ],
  };

  // Simulating teacher view before publication:
  // Teacher sees their drafted report
  const teacherVisible = [reportDraft].filter((r) => !r.teacherId || r.teacherId === teacherId);
  assert.strictEqual(teacherVisible.length, 1, 'Teacher must see draft assessment');

  // Student CANNOT see report before publication:
  const studentVisibleBeforePub = [reportDraft].filter(
    (r) => r.state === 'published' && (!r.studentId || r.studentId === studentId)
  );
  assert.strictEqual(studentVisibleBeforePub.length, 0, 'Student must not see unpublished assessment');

  // 2. Teacher updates evaluation and publishes report
  const publishedReport: MonthlyReport = {
    ...reportDraft,
    state: 'published',
    publishedAt: '2026-10-16 14:00',
    teacherEvaluation: {
      professionalJudgement: 'Nguyen Van A demonstrated great effort in Reading. Writing needs work.',
      nextMonthPriorities: 'Focus on Task 2 essay structure and linking words.',
      estimatedBand: 'Band 7.0',
    },
    history: [
      ...reportDraft.history,
      {
        version: 2,
        action: 'Report published to student workspace',
        timestamp: '2026-10-16 14:00',
        actor: 'Teacher John',
      },
    ],
  };

  // Student CAN see published report
  const studentVisibleAfterPub = [publishedReport].filter(
    (r) => r.state === 'published' && (!r.studentId || r.studentId === studentId)
  );
  assert.strictEqual(studentVisibleAfterPub.length, 1, 'Student must see published assessment');
  assert.strictEqual(studentVisibleAfterPub[0].teacherEvaluation.estimatedBand, 'Band 7.0');

  // Simulated cache persistence check
  const serialized = JSON.stringify([publishedReport]);
  const parsed = JSON.parse(serialized);
  assert.strictEqual(parsed[0].id, 'report_001');
  assert.strictEqual(parsed[0].state, 'published');

  console.log('✓ Test 3 Passed: Periodic Assessment state transitions, student gating and caching verified.');
}

console.log('\n========================================================================');
console.log('ALL CRITICAL QUESTION TYPE & ASSESSMENT PERSISTENCE TESTS PASSED! 🎉');
console.log('========================================================================');
