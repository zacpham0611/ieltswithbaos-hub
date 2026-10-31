import type {
  RegularTest,
  RegularTestAttempt,
  RegularTestSection,
  RegularTestEvent,
  StrictExamSettings,
  StrictExamPreset,
} from '../types/index.ts';
import { gradeAssignmentSubmission } from './assignmentGrader.ts';
import { calculateIeltsOverallBand } from './ieltsScoring.ts';

/**
 * Computes a salted SHA-256 hash for access codes.
 */
export async function hashAccessCode(code: string, salt: string = 'ielts_hub_salt_2026'): Promise<string> {
  const normalized = (code || '').trim().toUpperCase();
  if (!normalized) return '';
  const data = new TextEncoder().encode(`${salt}:${normalized}`);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns default strict exam settings based on chosen preset.
 */
export function getStrictSettingsForPreset(preset: StrictExamPreset): StrictExamSettings {
  switch (preset) {
    case 'strict':
      return {
        desktopOnly: true,
        fullscreenRequired: true,
        blockCopyReading: true,
        blockPasteWriting: true,
        readingInactivitySeconds: 60,
        disableSpellcheck: true,
        watermark: true,
        preventDevTools: true,
        sessionPolicy: 'takeover',
      };
    case 'standard':
      return {
        desktopOnly: true,
        fullscreenRequired: true,
        blockCopyReading: true,
        blockPasteWriting: true,
        readingInactivitySeconds: 90,
        disableSpellcheck: true,
        watermark: false,
        preventDevTools: true,
        sessionPolicy: 'takeover',
      };
    case 'off':
    default:
      return {
        desktopOnly: false,
        fullscreenRequired: false,
        blockCopyReading: false,
        blockPasteWriting: false,
        readingInactivitySeconds: 120,
        disableSpellcheck: false,
        watermark: false,
        preventDevTools: false,
        sessionPolicy: 'takeover',
      };
  }
}

/**
 * Sanitizes a test object or sections for a student, completely stripping
 * correct answers, explanations, and secret keys from the DOM.
 */
export function sanitizeExamDataForStudent(test: RegularTest): {
  id: string;
  title: string;
  instructions: string;
  skills: ('reading' | 'writing')[];
  durationMinutes: number;
  timingMode: RegularTest['timingMode'];
  sectionTimers?: Record<string, number>;
  strictPreset: StrictExamPreset;
  strictSettings: StrictExamSettings;
  sections: RegularTestSection[];
} {
  const sanitizedSections: RegularTestSection[] = (test.sections || []).map((sec, idx) => {
    if (sec.skill === 'reading') {
      const sanitizedQuestions = (sec.readingQuestions || []).map((q) => {
        const {
          correctAnswer,
          correctAnswers,
          explanation,
          citation,
          modelAnswer,
          ...cleanQ
        } = q as any;
        return cleanQ;
      });

      return {
        id: sec.id || `sec_reading_${idx}`,
        title: sec.title || `Reading Section ${idx + 1}`,
        skill: 'reading',
        durationMinutes: sec.durationMinutes || 60,
        readingPassage: sec.readingPassage || '',
        passages: sec.passages || [],
        readingQuestions: sanitizedQuestions,
        questionGroups: sec.questionGroups || [],
      };
    } else {
      return {
        id: sec.id || `sec_writing_${idx}`,
        title: sec.title || `Writing Section ${idx + 1}`,
        skill: 'writing',
        durationMinutes: sec.durationMinutes || 60,
        writingPrompt: sec.writingPrompt || '',
        writingTaskType: sec.writingTaskType || 'task2',
        writingMinWords: sec.writingMinWords || 250,
        task1ImageUrl: sec.task1ImageUrl,
      };
    }
  });

  return {
    id: test.id,
    title: test.title,
    instructions: test.instructions,
    skills: test.skills,
    durationMinutes: test.durationMinutes,
    timingMode: test.timingMode,
    sectionTimers: test.sectionTimers,
    strictPreset: test.strictPreset,
    strictSettings: test.strictSettings,
    sections: sanitizedSections,
  };
}

/**
 * Computes the remaining time in seconds based on server start time, duration, extra time, and hard deadline.
 * Client device clock changes have zero effect if nowMs is derived or synchronized with server offset.
 */
export function calculateRemainingSeconds(params: {
  serverStartTime: string;
  durationMinutes: number;
  extraTimeMinutes?: number;
  hardDeadline?: string;
  serverNow?: string;
  clientNow?: number;
  serverClockOffsetMs?: number;
}): {
  remainingSeconds: number;
  isExpired: boolean;
  effectiveDeadline: Date;
} {
  const start = new Date(params.serverStartTime).getTime();
  const extraMs = (params.extraTimeMinutes || 0) * 60 * 1000;
  const durationMs = params.durationMinutes * 60 * 1000;

  let deadlineMs = start + durationMs + extraMs;

  if (params.hardDeadline) {
    const hardLimitMs = new Date(params.hardDeadline).getTime();
    if (hardLimitMs < deadlineMs) {
      deadlineMs = hardLimitMs;
    }
  }

  // Adjusted now
  const nowMs = params.serverNow
    ? new Date(params.serverNow).getTime()
    : (params.clientNow || Date.now()) + (params.serverClockOffsetMs || 0);

  const diffSec = Math.floor((deadlineMs - nowMs) / 1000);
  const remainingSeconds = Math.max(0, diffSec);

  return {
    remainingSeconds,
    isExpired: remainingSeconds <= 0,
    effectiveDeadline: new Date(deadlineMs),
  };
}

/**
 * Grades the entire attempt (Reading auto-graded, Writing preserves teacher rubric).
 */
export function evaluateRegularTestAttempt(
  attempt: RegularTestAttempt,
  test: RegularTest
): {
  scores: RegularTestAttempt['scores'];
  gradingStatus: RegularTestAttempt['gradingStatus'];
} {
  const currentScores: RegularTestAttempt['scores'] = { ...(attempt.scores || {}) };
  const readingSections = (test.sections || []).filter((s) => s.skill === 'reading');
  const hasWriting = (test.sections || []).some((s) => s.skill === 'writing');

  // Grade Reading if reading sections exist
  if (readingSections.length > 0) {
    const allReadingQuestions = readingSections.flatMap((s) => s.readingQuestions || []);
    const studentReadingAnswers = attempt.answers?.reading || {};

    if (allReadingQuestions.length > 0) {
      const summary = gradeAssignmentSubmission(allReadingQuestions, studentReadingAnswers, 'academic');
      currentScores.reading = {
        raw: summary.earnedScore,
        max: summary.gradableMaxScore || summary.maxScore || allReadingQuestions.length,
        band: summary.bandEstimate,
        errorAnalysis: summary.errorAnalysis.map((err) => ({
          questionId: err.questionId,
          userAnswer: err.userAnswer,
          correctAnswer: err.correctAnswer,
          isCorrect: err.isCorrect,
          explanation: err.explanation,
        })),
      };
    }
  }

  // Calculate overall if Writing is also graded or if Reading-only
  let gradingStatus: RegularTestAttempt['gradingStatus'] = 'pending';
  if (!hasWriting && currentScores.reading) {
    currentScores.overall = currentScores.reading.band;
    gradingStatus = 'fully_graded';
  } else if (hasWriting) {
    if (currentScores.writing?.band && currentScores.reading?.band) {
      currentScores.overall = calculateIeltsOverallBand([
        currentScores.reading.band,
        currentScores.writing.band,
      ]);
      gradingStatus = 'fully_graded';
    } else if (currentScores.writing?.band && !currentScores.reading) {
      currentScores.overall = currentScores.writing.band;
      gradingStatus = 'fully_graded';
    } else {
      gradingStatus = currentScores.reading ? 'pending_manual' : 'pending';
    }
  }

  return {
    scores: currentScores,
    gradingStatus,
  };
}

/**
 * Rates the cheating risk level based on logged anti-cheating events.
 */
export function computeRiskLevel(events: RegularTestEvent[]): 'low' | 'medium' | 'high' {
  if (!events || events.length === 0) return 'low';

  let blurCount = 0;
  let totalBlurSeconds = 0;
  let fullscreenExitCount = 0;
  let largePasteCount = 0;

  for (const e of events) {
    if (e.eventType === 'tab_switch' || e.eventType === 'window_blur') {
      blurCount++;
      totalBlurSeconds += e.durationSeconds || 0;
    } else if (e.eventType === 'fullscreen_exit') {
      fullscreenExitCount++;
    } else if (e.eventType === 'large_paste') {
      largePasteCount++;
    }
  }

  if (totalBlurSeconds > 60 || blurCount >= 5 || largePasteCount >= 3 || fullscreenExitCount >= 4) {
    return 'high';
  }
  if (totalBlurSeconds > 15 || blurCount >= 2 || largePasteCount >= 1 || fullscreenExitCount >= 2) {
    return 'medium';
  }
  return 'low';
}

/**
 * Categorizes tests for the Student Portal into 5 tabs:
 * 'available' | 'upcoming' | 'in_progress' | 'submitted' | 'results_released'
 */
export function categorizeStudentTests(
  tests: RegularTest[],
  attempts: RegularTestAttempt[],
  studentId: string
): {
  available: Array<{ test: RegularTest; attempt?: RegularTestAttempt }>;
  upcoming: Array<{ test: RegularTest; attempt?: RegularTestAttempt }>;
  inProgress: Array<{ test: RegularTest; attempt: RegularTestAttempt }>;
  submitted: Array<{ test: RegularTest; attempt: RegularTestAttempt }>;
  resultsReleased: Array<{ test: RegularTest; attempt: RegularTestAttempt }>;
} {
  const now = new Date();
  const available: Array<{ test: RegularTest; attempt?: RegularTestAttempt }> = [];
  const upcoming: Array<{ test: RegularTest; attempt?: RegularTestAttempt }> = [];
  const inProgress: Array<{ test: RegularTest; attempt: RegularTestAttempt }> = [];
  const submitted: Array<{ test: RegularTest; attempt: RegularTestAttempt }> = [];
  const resultsReleased: Array<{ test: RegularTest; attempt: RegularTestAttempt }> = [];

  for (const test of tests) {
    if (test.status === 'draft' || test.status === 'archived') {
      continue;
    }

    // Check eligible students if specified
    if (test.eligibleStudentIds && test.eligibleStudentIds.length > 0) {
      if (!test.eligibleStudentIds.includes(studentId)) {
        continue;
      }
    }

    const studentAttempts = attempts.filter((a) => a.testId === test.id && a.studentId === studentId);
    const latestAttempt = studentAttempts[0]; // assuming sorted by attemptNumber desc or created desc

    if (latestAttempt) {
      if (latestAttempt.status === 'in_progress') {
        inProgress.push({ test, attempt: latestAttempt });
        continue;
      }

      if (latestAttempt.status === 'submitted' || latestAttempt.status === 'auto_submitted') {
        if (latestAttempt.isReleased) {
          resultsReleased.push({ test, attempt: latestAttempt });
        } else {
          submitted.push({ test, attempt: latestAttempt });
        }
        continue;
      }
    }

    // Check timing window
    const startTime = test.availabilityStart ? new Date(test.availabilityStart) : null;
    const endTime = test.availabilityEnd ? new Date(test.availabilityEnd) : null;
    const hardDeadline = test.hardDeadline ? new Date(test.hardDeadline) : null;

    if (startTime && now < startTime) {
      upcoming.push({ test, attempt: latestAttempt });
      continue;
    }

    const isPastEnd = endTime && now > endTime;
    const isPastHard = hardDeadline && now > hardDeadline;

    if (!isPastEnd && !isPastHard && test.status === 'live') {
      available.push({ test, attempt: latestAttempt });
    } else {
      // If closed and student never took it
      if (test.status === 'closed') {
        // past closed
      }
    }
  }

  return {
    available,
    upcoming,
    inProgress,
    submitted,
    resultsReleased,
  };
}
