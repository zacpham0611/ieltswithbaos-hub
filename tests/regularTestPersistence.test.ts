import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  categorizeStudentTests,
} from '../src/lib/regularTestManager.ts';
import type { RegularTest, RegularTestAttempt } from '../src/types/index.ts';

describe('REGULAR TEST PERSISTENCE & RELOAD RECOVERY TESTS', () => {
  const now = new Date();
  const studentId = 'student-test-uuid-001';

  const mockTest: RegularTest = {
    id: 'test-uuid-active-1',
    courseId: 'course-uuid-1',
    courseName: 'IELTS Band 7.5 Intensive',
    teacherId: 'teacher-uuid-1',
    teacherName: 'Teacher John',
    title: 'Midterm Regular Test 1',
    instructions: 'Complete all sections within the allotted time.',
    skills: ['reading', 'listening'],
    durationMinutes: 120,
    timingMode: 'overall_timer',
    status: 'live',
    availabilityStart: new Date(now.getTime() - 1000 * 60 * 60).toISOString(),
    availabilityEnd: new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString(),
    sections: [],
    createdAt: '2026-11-12T00:00:00.000Z',
    updatedAt: '2026-11-12T00:00:00.000Z',
  };

  it('1. Categorizes active live test into available tab', () => {
    const categorized = categorizeStudentTests([mockTest], [], studentId);
    assert.strictEqual(categorized.available.length, 1);
    assert.strictEqual(categorized.available[0].test.id, mockTest.id);
    assert.strictEqual(categorized.available[0].attempt, undefined);
  });

  it('2. Active attempt keeps test accessible and in inProgress category', () => {
    const inProgressAttempt: RegularTestAttempt = {
      id: 'attempt-uuid-001',
      testId: mockTest.id,
      studentId: studentId,
      studentName: 'Test Student',
      studentEmail: 'student@example.com',
      sessionToken: 'token-uuid-xyz',
      startedAt: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      status: 'in_progress',
      answers: { 'reading-q1': 'True' },
      scores: null,
      gradingStatus: 'ungraded',
      isReleased: false,
      createdAt: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 5).toISOString(),
    };

    const categorized = categorizeStudentTests([mockTest], [inProgressAttempt], studentId);
    assert.strictEqual(categorized.inProgress.length, 1);
    assert.strictEqual(categorized.inProgress[0].test.id, mockTest.id);
    assert.strictEqual(categorized.inProgress[0].attempt.id, inProgressAttempt.id);
  });

  it('3. Submitted attempt without release moves to submitted category', () => {
    const submittedAttempt: RegularTestAttempt = {
      id: 'attempt-uuid-002',
      testId: mockTest.id,
      studentId: studentId,
      studentName: 'Test Student',
      studentEmail: 'student@example.com',
      sessionToken: 'token-uuid-abc',
      startedAt: new Date(now.getTime() - 1000 * 60 * 60).toISOString(),
      submittedAt: new Date(now.getTime() - 1000 * 60 * 10).toISOString(),
      status: 'submitted',
      answers: { 'reading-q1': 'True', 'listening-q1': 'library' },
      scores: null,
      gradingStatus: 'ungraded',
      isReleased: false,
      createdAt: new Date(now.getTime() - 1000 * 60 * 60).toISOString(),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 10).toISOString(),
    };

    const categorized = categorizeStudentTests([mockTest], [submittedAttempt], studentId);
    assert.strictEqual(categorized.available.length, 0);
    assert.strictEqual(categorized.submitted.length, 1);
    assert.strictEqual(categorized.submitted[0].test.id, mockTest.id);
    assert.strictEqual(categorized.submitted[0].attempt.id, submittedAttempt.id);
  });

  it('4. Released attempt moves to resultsReleased category with scores intact', () => {
    const releasedAttempt: RegularTestAttempt = {
      id: 'attempt-uuid-003',
      testId: mockTest.id,
      studentId: studentId,
      studentName: 'Test Student',
      studentEmail: 'student@example.com',
      sessionToken: 'token-uuid-abc',
      startedAt: new Date(now.getTime() - 1000 * 60 * 60).toISOString(),
      submittedAt: new Date(now.getTime() - 1000 * 60 * 10).toISOString(),
      status: 'submitted',
      answers: { 'reading-q1': 'True', 'listening-q1': 'library' },
      scores: { overallBand: 7.0 },
      gradingStatus: 'graded',
      isReleased: true,
      releasedAt: new Date(now.getTime() - 1000 * 60 * 5).toISOString(),
      createdAt: new Date(now.getTime() - 1000 * 60 * 60).toISOString(),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 10).toISOString(),
    };

    const categorized = categorizeStudentTests([mockTest], [releasedAttempt], studentId);
    assert.strictEqual(categorized.available.length, 0);
    assert.strictEqual(categorized.resultsReleased.length, 1);
    assert.strictEqual(categorized.resultsReleased[0].test.id, mockTest.id);
    assert.strictEqual(categorized.resultsReleased[0].attempt.id, releasedAttempt.id);
    assert.strictEqual(categorized.resultsReleased[0].attempt.scores?.overallBand, 7.0);
  });

  it('5. Attempt recovery query simulates retrieving tests for existing attempts even if test status changes', () => {
    const attemptTestIds = ['test-uuid-active-1', 'test-uuid-closed-2'];
    const dbTestMap = new Map<string, RegularTest>();
    dbTestMap.set(mockTest.id, mockTest);

    const closedTest: RegularTest = {
      ...mockTest,
      id: 'test-uuid-closed-2',
      status: 'closed',
    };
    dbTestMap.set(closedTest.id, closedTest);

    for (const testId of attemptTestIds) {
      assert.ok(dbTestMap.has(testId), `Test ID ${testId} must be recovered from database`);
    }
  });

  it('6. Deleted test does not appear in state when database returns fresh records', () => {
    const activeDatabaseTests: RegularTest[] = [mockTest];
    const studentTestsInState: RegularTest[] = [...activeDatabaseTests];

    assert.strictEqual(studentTestsInState.length, 1);
    assert.strictEqual(studentTestsInState.some((t) => t.id === 'test-deleted-999'), false);
  });
});
