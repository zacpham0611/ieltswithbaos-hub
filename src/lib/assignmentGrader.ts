import type { ReadingQuestion, SubmissionStatus } from '../types/index.ts';
import { calculateReadingBand, type IeltsTestType } from './ieltsScoring.ts';

export interface QuestionGradeResult {
  questionId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  isPendingReview: boolean;
  earnedPoints: number;
  maxPoints: number;
  explanation: string;
  violationReason?: string;
}

export interface AssignmentGradeSummary {
  errorAnalysis: QuestionGradeResult[];
  earnedScore: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  bandEstimate: number;
  hasOpenEnded: boolean;
  finalStatus: SubmissionStatus;
  testType: IeltsTestType;
  isOfficialScale: boolean;
  bandNotes: string;
}

/**
 * Normalizes answer text by lowercasing, trimming, and collapsing whitespace.
 * Strips outer punctuation while preserving hyphens and apostrophes.
 */
export function normalizeAnswerText(text: string): string {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/^[.,;:!?"'()\[\]{}]+|[.,;:!?"'()\[\]{}]+$/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Strips leading grammatical articles (a, an, the)
 */
export function stripLeadingArticles(text: string): string {
  return text.replace(/^(?:the|a|an)\s+/i, '').trim();
}

/**
 * Extracts a single choice letter (A-Z) or Roman numeral (i-x) from text
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
 * Normalizes Roman numerals (e.g. "iii", "IV", "vii")
 */
export function normalizeRomanNumeral(text: string): string {
  return (text || '').trim().toLowerCase().replace(/[^ivxldcm]/gi, '');
}

/**
 * Parses word limit string into numeric word count (e.g. "NO MORE THAN TWO WORDS" -> 2)
 */
export function parseMaxWordsFromLimit(wordLimit?: string): number | null {
  if (!wordLimit) return null;
  const lower = wordLimit.toLowerCase();
  if (lower.includes('one word') || lower.includes('1 word')) return 1;
  if (lower.includes('two words') || lower.includes('2 words')) return 2;
  if (lower.includes('three words') || lower.includes('3 words')) return 3;
  if (lower.includes('four words') || lower.includes('4 words')) return 4;
  const numMatch = lower.match(/no\s+more\s+than\s+(\d+)\s+words?/i);
  if (numMatch) return parseInt(numMatch[1], 10);
  return null;
}

/**
 * Counts words in a string, respecting standard English word boundaries
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Grades an individual IELTS Reading question with strict type-specific rules.
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

  // 2. Open-ended Essay / Question without Answer Key
  if (q.type === 'essay' || !key) {
    return {
      questionId: qId,
      userAnswer: userAns,
      correctAnswer: key || 'Pending Teacher Evaluation',
      isCorrect: false,
      isPendingReview: true,
      earnedPoints: 0,
      maxPoints,
      explanation: explanation || 'Subjective response requires teacher evaluation and rubric feedback.',
    };
  }

  // 3. Word Limit Validation (for text completion/short-answer types)
  const maxWords = q.maxWords || parseMaxWordsFromLimit(q.wordLimit);
  if (maxWords && maxWords > 0) {
    const userWordCount = countWords(userAns);
    if (userWordCount > maxWords) {
      return {
        questionId: qId,
        userAnswer: userAns,
        correctAnswer: key,
        isCorrect: false,
        isPendingReview: false,
        earnedPoints: 0,
        maxPoints,
        explanation: `${explanation ? explanation + ' ' : ''}Exceeded word limit: answered ${userWordCount} words (maximum allowed: ${maxWords}).`,
        violationReason: 'word_limit_exceeded',
      };
    }
  }

  // 4. Multiple Choice (Single answer)
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

  // 5. Multiple Select (Multiple answers, e.g. "Choose TWO letters")
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

  // 6. True / False / Not Given
  if (q.type === 'true_false_not_given') {
    const normUser = userAns.toUpperCase().replace(/[\s\-_]/g, '');
    const normKey = key.toUpperCase().replace(/[\s\-_]/g, '');

    // Strictly enforce T/F/NG options (YES/NO is not allowed on T/F/NG!)
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
      explanation: isCorrect
        ? explanation
        : validOptions.includes(normUser)
        ? explanation
        : 'Must answer TRUE, FALSE, or NOT GIVEN.',
    };
  }

  // 7. Yes / No / Not Given (Distinct from T/F/NG!)
  if (q.type === 'yes_no_not_given') {
    const normUser = userAns.toUpperCase().replace(/[\s\-_]/g, '');
    const normKey = key.toUpperCase().replace(/[\s\-_]/g, '');

    // Strictly enforce Y/N/NG options (TRUE/FALSE is not allowed on Y/N/NG!)
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
      explanation: isCorrect
        ? explanation
        : validOptions.includes(normUser)
        ? explanation
        : 'Must answer YES, NO, or NOT GIVEN.',
    };
  }

  // 8. Matching Headings (often Roman numerals i, ii, iii, iv, v, vi, vii, viii, ix, x)
  if (q.type === 'matching_headings') {
    const userRoman = normalizeRomanNumeral(userAns);
    const keyRoman = normalizeRomanNumeral(key);

    let isCorrect = false;
    if (userRoman && keyRoman) {
      isCorrect = userRoman === keyRoman;
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

  // 9. Matching Information / Matching Features / Matching Sentence Endings
  if (
    q.type === 'matching_information' ||
    q.type === 'matching_features' ||
    q.type === 'matching_sentence_endings'
  ) {
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

  // 10. Generic Matching (e.g. JSON map or text pair matching)
  if (q.type === 'matching') {
    const normUser = normalizeAnswerText(userAns);
    const normKey = normalizeAnswerText(key);

    let isCorrect = false;
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

  // 11. Completion & Short-Answer Question Types:
  // (sentence_completion, summary_completion, note_completion, table_completion,
  //  flowchart_completion, short_answer, diagram_completion, fill_in_the_blank)
  //
  // Strict IELTS rules:
  // - Support accepted alternatives separated by '/' or 'or'
  // - Case & whitespace normalized
  // - Optional leading articles (the, a, an)
  // - DO NOT award points if the answer is merely a substring of the key!
  const normUser = normalizeAnswerText(userAns);
  const strippedUser = stripLeadingArticles(normUser);

  const rawAlternatives = key.split(/\s*(?:\/|\bor\b)\s*/i);
  const alternatives = rawAlternatives
    .map((alt) => normalizeAnswerText(alt))
    .filter(Boolean);

  let isCorrect = false;
  for (const alt of alternatives) {
    const strippedAlt = stripLeadingArticles(alt);
    if (normUser === alt || strippedUser === strippedAlt) {
      isCorrect = true;
      break;
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

/**
 * Computes full assignment score, point weighting, error analysis, and estimated IELTS Band.
 */
export function gradeAssignmentSubmission(
  questions: ReadingQuestion[],
  studentAnswers: Record<string, string>,
  testType: IeltsTestType = 'academic'
): AssignmentGradeSummary {
  let earnedScore = 0;
  let maxScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  let hasOpenEnded = false;

  const errorAnalysis: QuestionGradeResult[] = questions.map((q) => {
    const userAns = studentAnswers[q.id];
    const result = gradeSingleQuestion(q, userAns);

    maxScore += result.maxPoints;
    earnedScore += result.earnedPoints;

    if (!userAns || !userAns.trim()) {
      unansweredCount++;
    } else if (result.isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }

    if (result.isPendingReview) {
      hasOpenEnded = true;
    }
    return result;
  });

  const percentage = maxScore > 0 ? Math.round((earnedScore / maxScore) * 100) : 0;

  // Use the official IELTS Reading conversion scale
  const bandResult = calculateReadingBand(correctCount, testType, questions.length);

  return {
    errorAnalysis,
    earnedScore,
    maxScore,
    percentage,
    correctCount,
    incorrectCount,
    unansweredCount,
    bandEstimate: bandResult.band,
    hasOpenEnded,
    finalStatus: hasOpenEnded ? 'submitted' : 'graded',
    testType,
    isOfficialScale: bandResult.isOfficialScale,
    bandNotes: bandResult.notes,
  };
}
