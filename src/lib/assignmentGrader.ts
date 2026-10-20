import { ReadingQuestion, SubmissionStatus } from '../types';

export interface QuestionGradeResult {
  questionId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  isPendingReview: boolean;
  earnedPoints: number;
  maxPoints: number;
  explanation: string;
}

export interface AssignmentGradeSummary {
  errorAnalysis: QuestionGradeResult[];
  earnedScore: number;
  maxScore: number;
  percentage: number;
  bandEstimate: number;
  hasOpenEnded: boolean;
  finalStatus: SubmissionStatus;
}

/**
 * Normalizes text by trimming, lowercasing, and collapsing multiple spaces
 */
export function normalizeAnswerText(text: string): string {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/[.,;:!?]+$/, '') // remove trailing punctuation
    .replace(/\s+/g, ' '); // collapse whitespace
}

/**
 * Extracts the primary choice letter (A, B, C, D, etc.) if applicable
 */
export function extractChoiceLetter(text: string): string | null {
  const trimmed = (text || '').trim();
  const match = trimmed.match(/^([A-Za-z])(?:[\.\)\:\s]|$)/);
  if (match) {
    return match[1].toUpperCase();
  }
  return null;
}

/**
 * Grades an individual IELTS question with strict type-specific rules
 */
export function gradeSingleQuestion(
  q: ReadingQuestion,
  rawAnswer: string | undefined
): QuestionGradeResult {
  const qId = q.id;
  const maxPoints = Number(q.points) > 0 ? Number(q.points) : 1;
  const userAns = (rawAnswer || '').trim();
  const key = (q.correctAnswer || '').trim();
  const explanation = q.explanation || '';

  // 1. Unanswered Question
  if (!userAns) {
    return {
      questionId: qId,
      userAnswer: '(Unanswered)',
      correctAnswer: key || 'Pending Teacher Evaluation',
      isCorrect: false,
      isPendingReview: q.type === 'essay' || !key,
      earnedPoints: 0,
      maxPoints,
      explanation,
    };
  }

  // 2. Open-ended Essay / Missing Key
  if (q.type === 'essay' || !key) {
    return {
      questionId: qId,
      userAnswer: userAns,
      correctAnswer: key || 'Pending Teacher Evaluation',
      isCorrect: false,
      isPendingReview: true,
      earnedPoints: 0,
      maxPoints,
      explanation: explanation || 'Subjective essay response requires teacher review and rubric grading.',
    };
  }

  // 3. Multiple Choice (Strict letter matching)
  if (q.type === 'multiple_choice') {
    const userLetter = extractChoiceLetter(userAns);
    const keyLetter = extractChoiceLetter(key);

    let isCorrect = false;
    if (userLetter && keyLetter) {
      isCorrect = userLetter === keyLetter;
    } else {
      isCorrect = normalizeAnswerText(userAns) === normalizeAnswerText(key);
    }

    return {
      questionId: qId,
      userAnswer: userAns,
      correctAnswer: key,
      isCorrect,
      isPendingReview: false,
      earnedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      explanation,
    };
  }

  // 4. Multiple Select (Strict Set Comparison)
  if (q.type === 'multiple_select') {
    const parseTokens = (str: string): Set<string> => {
      const tokens = str
        .split(/[,\s;/]+/)
        .map((s) => {
          const letter = extractChoiceLetter(s);
          return letter || normalizeAnswerText(s);
        })
        .filter(Boolean);
      return new Set(tokens);
    };

    const userSet = parseTokens(userAns);
    const keySet = parseTokens(key);

    let isCorrect = false;
    if (userSet.size === keySet.size && userSet.size > 0) {
      isCorrect = true;
      for (const item of userSet) {
        if (!keySet.has(item)) {
          isCorrect = false;
          break;
        }
      }
    }

    return {
      questionId: qId,
      userAnswer: userAns,
      correctAnswer: key,
      isCorrect,
      isPendingReview: false,
      earnedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      explanation,
    };
  }

  // 5. True / False / Not Given
  if (q.type === 'true_false_not_given') {
    const normUser = userAns.toUpperCase().replace(/[\s\-_]/g, '');
    const normKey = key.toUpperCase().replace(/[\s\-_]/g, '');

    const validOptions = ['TRUE', 'FALSE', 'NOTGIVEN'];
    const isCorrect = validOptions.includes(normUser) && normUser === normKey;

    return {
      questionId: qId,
      userAnswer: userAns,
      correctAnswer: key,
      isCorrect,
      isPendingReview: false,
      earnedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      explanation,
    };
  }

  // 6. Yes / No / Not Given
  if (q.type === 'yes_no_not_given') {
    const normUser = userAns.toUpperCase().replace(/[\s\-_]/g, '');
    const normKey = key.toUpperCase().replace(/[\s\-_]/g, '');

    const validOptions = ['YES', 'NO', 'NOTGIVEN'];
    const isCorrect = validOptions.includes(normUser) && normUser === normKey;

    return {
      questionId: qId,
      userAnswer: userAns,
      correctAnswer: key,
      isCorrect,
      isPendingReview: false,
      earnedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      explanation,
    };
  }

  // 7. Matching Questions
  if (q.type === 'matching') {
    const normUser = normalizeAnswerText(userAns);
    const normKey = normalizeAnswerText(key);

    let isCorrect = false;
    // Attempt JSON comparison if user answered matching map
    try {
      if (userAns.startsWith('{') && key.startsWith('{')) {
        const userObj = JSON.parse(userAns);
        const keyObj = JSON.parse(key);
        isCorrect = Object.keys(keyObj).every(
          (k) => normalizeAnswerText(userObj[k] || '') === normalizeAnswerText(keyObj[k] || '')
        );
      } else {
        isCorrect = normUser === normKey;
      }
    } catch {
      isCorrect = normUser === normKey;
    }

    return {
      questionId: qId,
      userAnswer: userAns,
      correctAnswer: key,
      isCorrect,
      isPendingReview: false,
      earnedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      explanation,
    };
  }

  // 8. Fill in the Blank, Sentence Completion, Short Answer
  // Allow alternative answers separated by '/' or 'or'
  const normUser = normalizeAnswerText(userAns);
  const alternatives = key
    .split(/\s*(?:\/|\bor\b)\s*/i)
    .map((alt) => normalizeAnswerText(alt))
    .filter(Boolean);

  const isCorrect = alternatives.some((alt) => {
    if (alt === normUser) return true;
    // Optional article matching: e.g. "rainfall" matches "(the) rainfall"
    const strippedAlt = alt.replace(/^(?:the|a|an)\s+/i, '');
    const strippedUser = normUser.replace(/^(?:the|a|an)\s+/i, '');
    return strippedAlt === strippedUser;
  });

  return {
    questionId: qId,
    userAnswer: userAns,
    correctAnswer: key,
    isCorrect,
    isPendingReview: false,
    earnedPoints: isCorrect ? maxPoints : 0,
    maxPoints,
    explanation,
  };
}

/**
 * Computes full assignment score, point weighting, and status
 */
export function gradeAssignmentSubmission(
  questions: ReadingQuestion[],
  studentAnswers: Record<string, string>
): AssignmentGradeSummary {
  let earnedScore = 0;
  let maxScore = 0;
  let hasOpenEnded = false;

  const errorAnalysis: QuestionGradeResult[] = questions.map((q) => {
    const result = gradeSingleQuestion(q, studentAnswers[q.id]);
    maxScore += result.maxPoints;
    earnedScore += result.earnedPoints;
    if (result.isPendingReview) {
      hasOpenEnded = true;
    }
    return result;
  });

  const percentage = maxScore > 0 ? Math.round((earnedScore / maxScore) * 100) : 0;

  // Authentic IELTS Band conversion for objective questions
  let bandEstimate = 4.0;
  if (percentage >= 90) bandEstimate = 9.0;
  else if (percentage >= 82) bandEstimate = 8.5;
  else if (percentage >= 75) bandEstimate = 8.0;
  else if (percentage >= 68) bandEstimate = 7.5;
  else if (percentage >= 60) bandEstimate = 7.0;
  else if (percentage >= 52) bandEstimate = 6.5;
  else if (percentage >= 45) bandEstimate = 6.0;
  else if (percentage >= 38) bandEstimate = 5.5;
  else if (percentage >= 30) bandEstimate = 5.0;

  return {
    errorAnalysis,
    earnedScore,
    maxScore,
    percentage,
    bandEstimate,
    hasOpenEnded,
    finalStatus: hasOpenEnded ? 'submitted' : 'graded',
  };
}
