import assert from 'node:assert';
import {
  roundIeltsComponentScore,
  calculateIeltsOverallBand,
  calculateReadingBand,
} from '../src/lib/ieltsScoring.ts';

console.log('--- RUNNING IELTS SCORING & ROUNDING TESTS ---');

// 1. Component-score rounding rule (Prompt section 6.2 examples)
const componentRoundingCases = [
  { input: 7.125, expected: 7.0, label: '7.125 -> 7.0' },
  { input: 7.25, expected: 7.0, label: '7.25 -> 7.0' },
  { input: 7.375, expected: 7.5, label: '7.375 -> 7.5' },
  { input: 7.625, expected: 7.5, label: '7.625 -> 7.5' },
  { input: 7.75, expected: 8.0, label: '7.75 -> 8.0' },
  { input: 7.825, expected: 8.0, label: '7.825 -> 8.0' },
  { input: 6.75, expected: 7.0, label: '6.75 -> 7.0' },
  { input: 6.5, expected: 6.5, label: '6.5 -> 6.5' },

  // Boundary cases around 0.25 and 0.75
  { input: 6.749, expected: 6.5, label: '6.749 -> 6.5 (just below 0.75)' },
  { input: 6.75, expected: 7.0, label: '6.750 -> 7.0 (exact 0.75)' },
  { input: 7.249, expected: 7.0, label: '7.249 -> 7.0 (just below 0.25)' },
  { input: 7.25, expected: 7.0, label: '7.250 -> 7.0 (below 0.75)' },
  { input: 7.374, expected: 7.0, label: '7.374 -> 7.0 (below 0.75)' },
  { input: 7.375, expected: 7.5, label: '7.375 -> 7.5 (in [0.25, 0.75))' },
  { input: 7.749, expected: 7.5, label: '7.749 -> 7.5 (just below 0.75)' },
  { input: 7.75, expected: 8.0, label: '7.750 -> 8.0 (exact 0.75)' },
  { input: 7.751, expected: 8.0, label: '7.751 -> 8.0 (above 0.75)' },
];

for (const { input, expected, label } of componentRoundingCases) {
  const actual = roundIeltsComponentScore(input);
  assert.strictEqual(
    actual,
    expected,
    `FAILED: ${label}. Expected ${expected}, got ${actual}`
  );
  console.log(`✓ Passed: ${label}`);
}

// 2. Overall IELTS Band Calculation (Standard IELTS averaging & half-band rounding)
const overallBandCases = [
  { scores: [6.0, 6.0, 6.0, 6.5], expected: 6.0, label: 'avg 6.125 -> 6.0' },
  { scores: [6.0, 6.0, 6.5, 6.5], expected: 6.5, label: 'avg 6.250 -> 6.5' },
  { scores: [6.0, 6.5, 6.5, 6.5], expected: 6.5, label: 'avg 6.375 -> 6.5' },
  { scores: [6.5, 6.5, 6.5, 6.5], expected: 6.5, label: 'avg 6.500 -> 6.5' },
  { scores: [6.5, 6.5, 6.5, 7.0], expected: 6.5, label: 'avg 6.625 -> 6.5' },
  { scores: [6.5, 6.5, 7.0, 7.0], expected: 7.0, label: 'avg 6.750 -> 7.0' },
  { scores: [6.5, 7.0, 7.0, 7.0], expected: 7.0, label: 'avg 6.875 -> 7.0' },
  { scores: [8.5, 8.0, 8.5, 9.0], expected: 8.5, label: 'avg 8.500 -> 8.5' },
  { scores: [8.0, 8.5, 8.5, 8.5], expected: 8.5, label: 'avg 8.375 -> 8.5' },
];

for (const { scores, expected, label } of overallBandCases) {
  const actual = calculateIeltsOverallBand(scores);
  assert.strictEqual(
    actual,
    expected,
    `FAILED: ${label}. Expected ${expected}, got ${actual}`
  );
  console.log(`✓ Passed: Overall band ${label}`);
}

// 3. Academic Reading Band Conversion (All 40 Score Thresholds)
const academicTestCases = [
  { raw: 40, expectedBand: 9.0 },
  { raw: 39, expectedBand: 9.0 },
  { raw: 38, expectedBand: 8.5 },
  { raw: 37, expectedBand: 8.5 },
  { raw: 36, expectedBand: 8.0 },
  { raw: 35, expectedBand: 8.0 },
  { raw: 34, expectedBand: 7.5 },
  { raw: 33, expectedBand: 7.5 },
  { raw: 32, expectedBand: 7.0 },
  { raw: 31, expectedBand: 7.0 },
  { raw: 30, expectedBand: 7.0 }, // Prompt example: 30/40 -> Band 7.0
  { raw: 29, expectedBand: 6.5 },
  { raw: 28, expectedBand: 6.5 },
  { raw: 27, expectedBand: 6.5 },
  { raw: 26, expectedBand: 6.0 },
  { raw: 23, expectedBand: 6.0 },
  { raw: 22, expectedBand: 5.5 },
  { raw: 19, expectedBand: 5.5 },
  { raw: 18, expectedBand: 5.0 },
  { raw: 15, expectedBand: 5.0 },
  { raw: 14, expectedBand: 4.5 },
  { raw: 13, expectedBand: 4.5 },
  { raw: 12, expectedBand: 4.0 },
  { raw: 10, expectedBand: 4.0 },
  { raw: 9, expectedBand: 3.5 },
  { raw: 8, expectedBand: 3.5 },
  { raw: 7, expectedBand: 3.0 },
  { raw: 6, expectedBand: 3.0 },
  { raw: 5, expectedBand: 2.5 },
  { raw: 4, expectedBand: 2.5 },
  { raw: 3, expectedBand: 2.0 },
  { raw: 0, expectedBand: 2.0 },
];

for (const { raw, expectedBand } of academicTestCases) {
  const result = calculateReadingBand(raw, 'academic', 40);
  assert.strictEqual(
    result.band,
    expectedBand,
    `FAILED: Academic raw ${raw}/40. Expected Band ${expectedBand}, got ${result.band}`
  );
  assert.strictEqual(result.isOfficialScale, true);
}
console.log(`✓ Passed: All ${academicTestCases.length} Academic Reading score thresholds verified.`);

// 4. General Training Reading Band Conversion
const generalTestCases = [
  { raw: 40, expectedBand: 9.0 },
  { raw: 39, expectedBand: 8.5 },
  { raw: 38, expectedBand: 8.0 },
  { raw: 37, expectedBand: 8.0 },
  { raw: 36, expectedBand: 7.5 },
  { raw: 35, expectedBand: 7.0 },
  { raw: 34, expectedBand: 7.0 },
  { raw: 33, expectedBand: 6.5 },
  { raw: 32, expectedBand: 6.5 },
  { raw: 31, expectedBand: 6.0 },
  { raw: 30, expectedBand: 6.0 },
  { raw: 29, expectedBand: 5.5 },
  { raw: 27, expectedBand: 5.5 },
  { raw: 26, expectedBand: 5.0 },
  { raw: 23, expectedBand: 5.0 },
  { raw: 22, expectedBand: 4.5 },
  { raw: 19, expectedBand: 4.5 },
  { raw: 18, expectedBand: 4.0 },
  { raw: 15, expectedBand: 4.0 },
  { raw: 14, expectedBand: 3.5 },
  { raw: 12, expectedBand: 3.5 },
  { raw: 11, expectedBand: 3.0 },
  { raw: 9, expectedBand: 3.0 },
  { raw: 8, expectedBand: 2.5 },
  { raw: 6, expectedBand: 2.5 },
  { raw: 5, expectedBand: 2.0 },
  { raw: 0, expectedBand: 2.0 },
];

for (const { raw, expectedBand } of generalTestCases) {
  const result = calculateReadingBand(raw, 'general', 40);
  assert.strictEqual(
    result.band,
    expectedBand,
    `FAILED: General Training raw ${raw}/40. Expected Band ${expectedBand}, got ${result.band}`
  );
  assert.strictEqual(result.isOfficialScale, true);
}
console.log(`✓ Passed: All ${generalTestCases.length} General Training Reading score thresholds verified.`);

// 5. Nonstandard test length validation
const nonstandardResult = calculateReadingBand(7, 'academic', 10);
assert.strictEqual(nonstandardResult.isOfficialScale, false);
assert.strictEqual(nonstandardResult.rawScore, 7);
assert.strictEqual(nonstandardResult.totalQuestions, 10);
assert.strictEqual(nonstandardResult.band, 6.5); // 7/10 -> 28/40 -> Band 6.5
console.log('✓ Passed: Nonstandard test length scaling and official scale flag validation.');

console.log('ALL IELTS SCORING & BAND TESTS PASSED SUCCESSFULLY! 🎉');
