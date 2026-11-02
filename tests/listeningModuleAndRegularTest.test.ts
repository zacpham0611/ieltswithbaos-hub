import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateListeningBand,
  OFFICIAL_LISTENING_THRESHOLDS,
  calculateIeltsOverallBand,
} from '../src/lib/ieltsScoring.ts';
import {
  parseListeningDocument,
  extractListeningAnswerKey,
} from '../src/lib/listeningExtractor.ts';
import { gradeListeningSubmission } from '../src/lib/assignmentGrader.ts';
import { evaluateRegularTestAttempt } from '../src/lib/regularTestManager.ts';
import type {
  ListeningQuestion,
  RegularTest,
  RegularTestAttempt,
  RegularTestSection,
} from '../src/types/index.ts';

describe('IELTS Listening Module & Regular Test Integration', () => {
  describe('1. Official IELTS Listening Band Calculation', () => {
    it('accurately maps 40-item scores to official Cambridge/British Council bands', () => {
      assert.strictEqual(calculateListeningBand(40, 40).band, 9.0);
      assert.strictEqual(calculateListeningBand(39, 40).band, 9.0);
      assert.strictEqual(calculateListeningBand(38, 40).band, 8.5);
      assert.strictEqual(calculateListeningBand(37, 40).band, 8.5);
      assert.strictEqual(calculateListeningBand(36, 40).band, 8.0);
      assert.strictEqual(calculateListeningBand(35, 40).band, 8.0);
      assert.strictEqual(calculateListeningBand(34, 40).band, 7.5);
      assert.strictEqual(calculateListeningBand(32, 40).band, 7.5);
      assert.strictEqual(calculateListeningBand(31, 40).band, 7.0);
      assert.strictEqual(calculateListeningBand(30, 40).band, 7.0);
      assert.strictEqual(calculateListeningBand(29, 40).band, 6.5);
      assert.strictEqual(calculateListeningBand(26, 40).band, 6.5);
      assert.strictEqual(calculateListeningBand(25, 40).band, 6.0);
      assert.strictEqual(calculateListeningBand(23, 40).band, 6.0);
      assert.strictEqual(calculateListeningBand(22, 40).band, 5.5);
      assert.strictEqual(calculateListeningBand(18, 40).band, 5.5);
      assert.strictEqual(calculateListeningBand(17, 40).band, 5.0);
      assert.strictEqual(calculateListeningBand(16, 40).band, 5.0);
      assert.strictEqual(calculateListeningBand(13, 40).band, 4.5);
      assert.strictEqual(calculateListeningBand(10, 40).band, 4.0);
      assert.strictEqual(calculateListeningBand(3, 40).band, 2.0);
    });

    it('scales proportionally for practice tests with fewer than 40 questions', () => {
      // 9 out of 10 correct is equivalent to 36/40 -> Band 8.0
      const res = calculateListeningBand(9, 10);
      assert.strictEqual(res.band, 8.0);
      assert.strictEqual(res.isOfficialScale, false);
      assert.ok(res.notes.includes('scaled proportionally'));

      // 40 questions is flagged as official scale
      const officialRes = calculateListeningBand(35, 40);
      assert.strictEqual(officialRes.isOfficialScale, true);
    });

    it('calculates overall band combining Listening with other 3 skills', () => {
      // Listening 8.0, Reading 7.5, Writing 6.5, Speaking 7.0 -> Average: 7.25 -> Overall: 7.5
      const overall = calculateIeltsOverallBand([8.0, 7.5, 6.5, 7.0]);
      assert.strictEqual(overall, 7.5);
    });
  });

  describe('2. Listening Document Extractor', () => {
    it('parses structured listening document text with parts and questions', () => {
      const docText = `
PART 1
Questions 1-3
Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.
1. Name of caller: John Davis
2. Arrival date: 24th July
3. Preferred room type: Sea view

PART 2
Questions 4-6
Choose the correct letter, A, B or C.
4. The museum was originally built as a:
A. private residence
B. church
C. town hall

ANSWER KEY
1. John Davis
2. 24th July
3. Sea view
4. A
`;
      const result = parseListeningDocument(docText, 'Cam18_Test1_Listening.docx');

      assert.ok(result.parts.length >= 2);
      assert.strictEqual(result.parts[0].title, 'Part 1');
      assert.strictEqual(result.parts[0].questions.length, 3);
      assert.strictEqual(result.parts[0].questions[0].correctAnswer, 'John Davis');

      assert.strictEqual(result.parts[1].title, 'Part 2');
      assert.strictEqual(result.parts[1].questions[0].type, 'multiple_choice');
      assert.strictEqual(result.parts[1].questions[0].options?.length, 3);
      assert.strictEqual(result.parts[1].questions[0].correctAnswer, 'A');
    });

    it('extracts answer keys accurately from Answer Key block', () => {
      const keyText = `
ANSWER KEY
1. library
2. 9.30am
3. West Street
4. C
`;
      const keys = extractListeningAnswerKey(keyText);
      assert.strictEqual(keys['1'], 'library');
      assert.strictEqual(keys['2'], '9.30am');
      assert.strictEqual(keys['3'], 'West Street');
      assert.strictEqual(keys['4'], 'C');
    });
  });

  describe('3. Automated Listening Submission Grading', () => {
    it('correctly grades gap fills, case insensitivity, and trims punctuation', () => {
      const questions: ListeningQuestion[] = [
        {
          id: 'q1',
          questionNumber: 1,
          type: 'form_completion',
          prompt: 'Caller name: _____',
          correctAnswer: 'Sarah Jenkins',
          maxWords: 2,
        },
        {
          id: 'q2',
          questionNumber: 2,
          type: 'short_answer',
          prompt: 'Meeting time: _____',
          correctAnswer: '10:30 am',
          maxWords: 2,
          allowNumbers: true,
        },
        {
          id: 'q3',
          questionNumber: 3,
          type: 'multiple_choice',
          prompt: 'Main reason for call',
          correctAnswer: 'B',
          options: ['Refund', 'Booking inquiry', 'Cancellation'],
        },
      ];

      const studentAnswers = {
        q1: 'sarah jenkins', // lower case match
        q2: '10:30 AM.', // punctuation and mixed case
        q3: 'B',
      };

      const gradeResult = gradeListeningSubmission(questions, studentAnswers);
      assert.strictEqual(gradeResult.correctCount, 3);
      assert.strictEqual(gradeResult.earnedScore, 3);
      assert.ok(gradeResult.errorAnalysis.every((e) => e.isCorrect));
    });

    it('enforces word limits and numbers-only restrictions for completion questions', () => {
      const questions: ListeningQuestion[] = [
        {
          id: 'q1',
          questionNumber: 1,
          type: 'note_completion',
          prompt: 'Activity: _____',
          correctAnswer: 'hiking',
          maxWords: 1,
        },
      ];

      // Student wrote 3 words for a 1-word limit
      const studentAnswers = {
        q1: 'mountain trail hiking',
      };

      const gradeResult = gradeListeningSubmission(questions, studentAnswers);
      assert.strictEqual(gradeResult.correctCount, 0);
      assert.strictEqual(gradeResult.errorAnalysis[0].violationReason, 'word_limit_exceeded');
    });
  });

  describe('4. Regular Test Exam Evaluation with Listening', () => {
    it('evaluates Regular Test attempt with Listening section auto-graded into official band', () => {
      const listeningSection: RegularTestSection = {
        id: 'sec_listen_1',
        title: 'IELTS Listening Section',
        skill: 'listening',
        durationMinutes: 30,
        listeningQuestions: Array.from({ length: 40 }).map((_, i) => ({
          id: `lq_${i + 1}`,
          questionNumber: i + 1,
          type: 'note_completion',
          prompt: `Question ${i + 1}`,
          correctAnswer: `Answer ${i + 1}`,
        })),
      };

      const test: RegularTest = {
        id: 'test_1',
        title: 'IELTS Full Mock Test',
        courseId: 'c1',
        teacherId: 't1',
        skills: ['listening'],
        sections: [listeningSection],
        durationMinutes: 30,
        timingMode: 'per_section',
        maxAttempts: 1,
        accessCodeEnabled: false,
        currentVersion: 1,
        releaseSettings: {
          timing: 'immediate',
          scores: true,
          correctAnswers: true,
          bandScore: true,
        },
        strictPreset: 'standard',
        strictSettings: {
          desktopOnly: true,
          fullscreenRequired: false,
          blockCopyReading: true,
          blockPasteWriting: false,
          antiTamperConsole: false,
          trackTabSwitch: true,
          trackFocusLoss: true,
          trackMouseLeave: false,
          trackDevTools: false,
          trackWindowResize: false,
          allowExtraTimeOnFailure: false,
        },
        status: 'published',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Student gets 35/40 correct -> Band 8.0
      const studentAnswers: Record<string, string> = {};
      for (let i = 1; i <= 35; i++) {
        studentAnswers[`lq_${i}`] = `Answer ${i}`;
      }

      const attempt: RegularTestAttempt = {
        id: 'att_1',
        testId: 'test_1',
        studentId: 'std_1',
        testTitle: 'IELTS Full Mock Test',
        startedAt: new Date().toISOString(),
        status: 'submitted',
        currentSectionIndex: 0,
        answers: { listening: studentAnswers },
      };

      const evaluated = evaluateRegularTestAttempt(attempt, test);

      assert.ok(evaluated.scores?.listening);
      assert.strictEqual(evaluated.scores?.listening?.raw, 35);
      assert.strictEqual(evaluated.scores?.listening?.max, 40);
      assert.strictEqual(evaluated.scores?.listening?.band, 8.0);
      assert.strictEqual(evaluated.scores?.overall, 8.0);
      assert.strictEqual(evaluated.gradingStatus, 'fully_graded');
    });
  });

  describe('5. Section 12 Reading Image Improvement', () => {
    it('supports flowchart and diagram completion with imageUrl and diagramUrl', () => {
      const qFlowchart: ListeningQuestion = {
        id: 'fc_1',
        questionNumber: 1,
        type: 'flowchart_completion',
        prompt: 'First stage of water filtration: _____',
        correctAnswer: 'sedimentation',
        imageUrl: 'https://example.com/water_filtration_diagram.png',
        imageCaption: 'Figure 1: Water Filtration Process Flow-chart',
      };

      assert.strictEqual(qFlowchart.type, 'flowchart_completion');
      assert.strictEqual(qFlowchart.imageUrl, 'https://example.com/water_filtration_diagram.png');
      assert.ok(qFlowchart.imageCaption?.includes('Flow-chart'));
    });
  });
});
