/**
 * IELTS Scoring, Component Rounding, Overall Band Calculation,
 * and Official Reading Band Conversion Utilities.
 */

export type IeltsTestType = 'academic' | 'general';

/**
 * Component-Score Rounding Rule:
 * "Round down to the nearest whole or half band when the decimal part is below 0.75;
 *  round up to the next whole band when the decimal part is 0.75 or greater."
 *
 * Examples:
 * 7.125 -> 7.0
 * 7.25  -> 7.0
 * 7.375 -> 7.5
 * 7.625 -> 7.5
 * 7.75  -> 8.0
 * 7.825 -> 8.0
 * 6.75  -> 7.0
 * 6.5   -> 6.5
 *
 * Boundary tests:
 * 6.749 -> 6.5
 * 6.75  -> 7.0
 * 7.249 -> 7.0
 * 7.25  -> 7.0
 * 7.374 -> 7.0
 * 7.375 -> 7.5
 * 7.749 -> 7.5
 * 7.75  -> 8.0
 */
export function roundIeltsComponentScore(rawScore: number): number {
  if (isNaN(rawScore) || rawScore <= 0) return 0;
  if (rawScore >= 9.0) return 9.0;

  // Use integer millibands to avoid IEEE-754 floating point imprecision
  const totalMilli = Math.round(rawScore * 1000);
  const whole = Math.floor(totalMilli / 1000);
  const decimalMilli = totalMilli % 1000;

  // Rule:
  // decimal < 0.375 -> whole + 0.0 (e.g. 7.125 -> 7.0, 7.25 -> 7.0, 7.374 -> 7.0)
  // 0.375 <= decimal < 0.750 -> whole + 0.5 (e.g. 7.375 -> 7.5, 7.5 -> 7.5, 7.625 -> 7.5, 7.749 -> 7.5)
  // decimal >= 0.750 -> whole + 1.0 (e.g. 6.75 -> 7.0, 7.75 -> 8.0, 7.825 -> 8.0)
  if (decimalMilli >= 750) {
    return Math.min(9.0, whole + 1.0);
  } else if (decimalMilli >= 375) {
    return whole + 0.5;
  } else {
    return whole;
  }
}

/**
 * Standard IELTS Overall Band Calculation:
 * The overall band score is calculated as the average of the four component scores
 * (Listening, Reading, Writing, Speaking), rounded to the nearest half band:
 *
 * - If the average ends in .125 -> rounds down to the whole band (e.g. 6.125 -> 6.0)
 * - If the average ends in .25  -> rounds up to the half band (e.g. 6.25 -> 6.5)
 * - If the average ends in .375 -> rounds up to the half band (e.g. 6.375 -> 6.5)
 * - If the average ends in .625 -> rounds down to the half band (e.g. 6.625 -> 6.5)
 * - If the average ends in .75  -> rounds up to the next whole band (e.g. 6.75 -> 7.0)
 * - If the average ends in .875 -> rounds up to the next whole band (e.g. 6.875 -> 7.0)
 */
export function calculateIeltsOverallBand(scores: number[]): number {
  const validScores = scores.filter((s) => !isNaN(s) && s > 0);
  if (validScores.length === 0) return 0;

  const sum = validScores.reduce((acc, s) => acc + s, 0);
  const avg = sum / validScores.length;

  const totalMilli = Math.round(avg * 1000);
  const whole = Math.floor(totalMilli / 1000);
  const decimalMilli = totalMilli % 1000;

  if (decimalMilli >= 750) {
    return Math.min(9.0, whole + 1.0);
  } else if (decimalMilli >= 250) {
    return whole + 0.5;
  } else {
    return whole;
  }
}

/**
 * Official Cambridge / British Council IELTS Reading Band Conversion Tables (out of 40 questions).
 */
export interface ReadingBandResult {
  rawScore: number;
  totalQuestions: number;
  band: number;
  testType: IeltsTestType;
  isOfficialScale: boolean;
  notes: string;
}

// Academic Reading Scale (40 questions)
const ACADEMIC_READING_THRESHOLDS: Array<{ minScore: number; band: number }> = [
  { minScore: 39, band: 9.0 },
  { minScore: 37, band: 8.5 },
  { minScore: 35, band: 8.0 },
  { minScore: 33, band: 7.5 },
  { minScore: 30, band: 7.0 },
  { minScore: 27, band: 6.5 },
  { minScore: 23, band: 6.0 },
  { minScore: 19, band: 5.5 },
  { minScore: 15, band: 5.0 },
  { minScore: 13, band: 4.5 },
  { minScore: 10, band: 4.0 },
  { minScore: 8, band: 3.5 },
  { minScore: 6, band: 3.0 },
  { minScore: 4, band: 2.5 },
  { minScore: 0, band: 2.0 },
];

// General Training Reading Scale (40 questions)
const GENERAL_READING_THRESHOLDS: Array<{ minScore: number; band: number }> = [
  { minScore: 40, band: 9.0 },
  { minScore: 39, band: 8.5 },
  { minScore: 37, band: 8.0 },
  { minScore: 36, band: 7.5 },
  { minScore: 34, band: 7.0 },
  { minScore: 32, band: 6.5 },
  { minScore: 30, band: 6.0 },
  { minScore: 27, band: 5.5 },
  { minScore: 23, band: 5.0 },
  { minScore: 19, band: 4.5 },
  { minScore: 15, band: 4.0 },
  { minScore: 12, band: 3.5 },
  { minScore: 9, band: 3.0 },
  { minScore: 6, band: 2.5 },
  { minScore: 0, band: 2.0 },
];

/**
 * Converts a raw Reading score to an estimated IELTS Reading Band.
 * Supports both Academic and General Training.
 * Validates test length and marks non-40-question assessments appropriately.
 */
export function calculateReadingBand(
  rawScore: number,
  testType: IeltsTestType = 'academic',
  totalQuestions: number = 40
): ReadingBandResult {
  const safeRaw = Math.max(0, Math.round(rawScore));
  const isStandardLength = totalQuestions === 40;

  // If non-standard length (e.g. 10 or 13 questions in a single passage),
  // we scale proportionally to 40 for practice estimation and clearly flag it.
  const normalizedRaw = isStandardLength
    ? safeRaw
    : Math.min(40, Math.round((safeRaw / Math.max(1, totalQuestions)) * 40));

  const isGeneral = testType === 'general' || (testType as string) === 'general_training';
  const thresholds = isGeneral ? GENERAL_READING_THRESHOLDS : ACADEMIC_READING_THRESHOLDS;

  let band = 2.0;
  for (const entry of thresholds) {
    if (normalizedRaw >= entry.minScore) {
      band = entry.band;
      break;
    }
  }

  const notes = isStandardLength
    ? `Estimated practice band based on official IELTS ${testType === 'general' ? 'General Training' : 'Academic'} Reading 40-item scale.`
    : `Estimated practice band scaled proportionally from ${safeRaw}/${totalQuestions} to standard 40-question scale. Official IELTS bands require a complete 40-item test.`;

  return {
    rawScore: safeRaw,
    totalQuestions,
    band,
    testType,
    isOfficialScale: isStandardLength,
    notes,
  };
}
