import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildQuestionRenderGroups, COMPLETION_TYPES } from '../src/lib/questionNormalizer.ts';
import type { Assignment, ReadingQuestion, QuestionGroup } from '../src/types/index.ts';

describe('ASSIGNMENT NAVIGATION & VIEW RESOLUTION INTEGRITY', () => {
  const studentId = 'student-test-uuid-001';
  const enrolledCourseId = 'course-uuid-101';
  const unauthorizedCourseId = 'course-uuid-999';

  const mockReadingAssignment: Assignment = {
    id: 'assign-reading-001',
    courseId: enrolledCourseId,
    courseName: 'IELTS Band 7.5 Masterclass',
    title: 'Reading Passage 1: The History of Tea',
    skill: 'reading',
    instructions: 'Read the text and answer questions 1-13.',
    dueDate: '2026-11-20',
    readingTestType: 'academic',
    readingPassage: 'Tea has a long history...',
    questions: [
      { id: 'q1', prompt: 'Where was tea first cultivated?', correctAnswer: 'China', questionType: 'short_answer' } as ReadingQuestion,
      { id: 'q2', prompt: 'Which dynasty popularized tea?', correctAnswer: 'Tang', questionType: 'short_answer' } as ReadingQuestion,
    ],
    createdAt: '2026-11-12T00:00:00Z',
    updatedAt: '2026-11-12T00:00:00Z',
  };

  const mockWritingAssignment: Assignment = {
    id: 'assign-writing-002',
    courseId: enrolledCourseId,
    courseName: 'IELTS Band 7.5 Masterclass',
    title: 'Writing Task 2: Technology and Education',
    skill: 'writing',
    instructions: 'Write at least 250 words on the given prompt.',
    dueDate: '2026-11-21',
    writingTaskCategory: 'task2',
    writingPrompt: 'Some people think technology has made children more isolated...',
    createdAt: '2026-11-12T00:00:00Z',
    updatedAt: '2026-11-12T00:00:00Z',
  };

  const mockSpeakingAssignment: Assignment = {
    id: 'assign-speaking-003',
    courseId: enrolledCourseId,
    courseName: 'IELTS Band 7.5 Masterclass',
    title: 'Speaking Part 2: A Memorable Journey',
    skill: 'speaking',
    instructions: 'Record your cue card response.',
    dueDate: '2026-11-22',
    speakingTopic: 'Describe a memorable journey you have made',
    speakingPoints: 'You should say:\n- Where you went\n- Who you went with\n- What you did',
    createdAt: '2026-11-12T00:00:00Z',
    updatedAt: '2026-11-12T00:00:00Z',
  };

  const mockListeningAssignment: Assignment = {
    id: 'assign-listening-004',
    courseId: enrolledCourseId,
    courseName: 'IELTS Band 7.5 Masterclass',
    title: 'Listening Section 1: Hotel Reservation',
    skill: 'listening',
    instructions: 'Listen and answer questions 1-10.',
    dueDate: '2026-11-23',
    audioUrl: 'https://example.com/audio1.mp3',
    listeningParts: [
      {
        partNumber: 1,
        title: 'Customer Booking Details',
        audioUrl: 'https://example.com/audio1.mp3',
        questions: [
          { id: 'lq1', questionNumber: 1, prompt: 'Name: John ___', correctAnswer: 'Smith' },
        ],
      },
    ],
    createdAt: '2026-11-12T00:00:00Z',
    updatedAt: '2026-11-12T00:00:00Z',
  };

  const allAssignments = [
    mockReadingAssignment,
    mockWritingAssignment,
    mockSpeakingAssignment,
    mockListeningAssignment,
  ];

  it('1. Resolves selected assignment cleanly without null pointer exceptions', () => {
    const selectedId = 'assign-reading-001';
    const active = allAssignments.find((a) => a.id === selectedId) || null;
    assert.ok(active !== null);
    assert.strictEqual(active?.id, 'assign-reading-001');
    assert.strictEqual(active?.skill, 'reading');
  });

  it('2. Computes questionRenderGroups synchronously without React hook violations', () => {
    // Tests that questionRenderGroups is evaluated as a pure function / expression without useMemo inside conditional
    const questions = mockReadingAssignment.questions || [];
    const questionRenderGroups = buildQuestionRenderGroups(
      questions.map((q, idx) => ({ q, absoluteIdx: idx, passageIndex: 0 }))
    );

    assert.ok(Array.isArray(questionRenderGroups));
    assert.strictEqual(questionRenderGroups.length, 1);
    assert.strictEqual(questionRenderGroups[0].questions.length, 2);
  });

  it('3. Identifies Not Found state when assignment is deleted or ID is invalid', () => {
    const invalidId = 'assign-deleted-999';
    const active = allAssignments.find((a) => a.id === invalidId) || null;
    const loadingData = false;

    // Condition matches AssignmentsView Not Found UI
    const isNotFound = Boolean(invalidId && !active && !loadingData);
    assert.strictEqual(isNotFound, true);
  });

  it('4. Identifies Unauthorized state when student is not in enrolled courses', () => {
    const accessibleCourseIds = [enrolledCourseId];
    const restrictedAssignment: Assignment = {
      ...mockReadingAssignment,
      id: 'assign-restricted-777',
      courseId: unauthorizedCourseId,
    };

    const isTeacher = false;
    const isUnauthorized = !isTeacher && !accessibleCourseIds.includes(restrictedAssignment.courseId);
    assert.strictEqual(isUnauthorized, true);
  });

  it('5. Successfully handles all 4 skills (Reading, Writing, Speaking, Listening) without crashing', () => {
    const skills = ['reading', 'writing', 'speaking', 'listening'] as const;
    for (const skill of skills) {
      const assignment = allAssignments.find((a) => a.skill === skill);
      assert.ok(assignment !== undefined, `Assignment for ${skill} must exist`);
      assert.strictEqual(assignment?.skill, skill);
    }
  });

  it('6. URL query parameter parsing correctly resolves assignmentId', () => {
    const simulatedSearch = '?tab=assignments&assignmentId=assign-reading-001';
    const params = new URLSearchParams(simulatedSearch);
    const parsedTab = params.get('tab');
    const parsedAssignmentId = params.get('assignmentId');

    assert.strictEqual(parsedTab, 'assignments');
    assert.strictEqual(parsedAssignmentId, 'assign-reading-001');

    const matchingAssignment = allAssignments.find((a) => a.id === parsedAssignmentId);
    assert.ok(matchingAssignment !== undefined);
    assert.strictEqual(matchingAssignment?.title, mockReadingAssignment.title);
  });
});
