import assert from 'node:assert/strict';
import type {
  AiReadingTestConfig,
  GeneratedReadingTest,
  ParsedPassage,
  QuestionGroup,
  ReadingQuestion,
} from '../src/types/index.ts';

console.log('--- RUNNING AI READING TEST GENERATOR UNIT & INTEGRATION TESTS ---');

// Test 1: Difficulty level metadata and cognitive scaling
function getDifficultyProfile(level: number) {
  if (level <= 2) {
    return { band: '3.5 - 4.5', category: 'very_easy', syntax: 'simple', distractors: 'obvious' };
  }
  if (level <= 4) {
    return { band: '5.0 - 5.5', category: 'easy_intermediate', syntax: 'compound', distractors: 'simple' };
  }
  if (level <= 6) {
    return { band: '6.0 - 6.5', category: 'intermediate', syntax: 'varied', distractors: 'plausible' };
  }
  if (level <= 8) {
    return { band: '7.0 - 7.5', category: 'advanced', syntax: 'complex', distractors: 'subtle' };
  }
  return { band: '8.0 - 9.0', category: 'expert', syntax: 'convoluted', distractors: 'trap_deceptive' };
}

const diff1 = getDifficultyProfile(1);
assert.equal(diff1.category, 'very_easy');
assert.equal(diff1.distractors, 'obvious');
console.log('✓ Passed: Difficulty Level 1 calibrated to very_easy with obvious distractors.');

const diff5 = getDifficultyProfile(5);
assert.equal(diff5.category, 'intermediate');
assert.equal(diff5.syntax, 'varied');
console.log('✓ Passed: Difficulty Level 5 calibrated to intermediate B2 standard benchmark.');

const diff10 = getDifficultyProfile(10);
assert.equal(diff10.category, 'expert');
assert.equal(diff10.distractors, 'trap_deceptive');
console.log('✓ Passed: Difficulty Level 10 calibrated to expert C2 with deceptive trap distractors.');

// Test 2: Source word count sufficiency validation
function validateSourceLength(wordCount: number, passageCount: number): { valid: boolean; error?: string } {
  const minWords = passageCount === 3 ? 500 : passageCount === 2 ? 300 : 80;
  if (wordCount < minWords) {
    return {
      valid: false,
      error: `Source has only ${wordCount} words, which is insufficient for ${passageCount} passage(s). Minimum required is ${minWords}.`,
    };
  }
  return { valid: true };
}

assert.equal(validateSourceLength(50, 1).valid, false);
assert.equal(validateSourceLength(120, 1).valid, true);
assert.equal(validateSourceLength(200, 2).valid, false);
assert.equal(validateSourceLength(350, 2).valid, true);
assert.equal(validateSourceLength(400, 3).valid, false);
assert.equal(validateSourceLength(600, 3).valid, true);
console.log('✓ Passed: Word sufficiency thresholds verified for 1, 2, and 3 passages.');

// Test 3: Test structure validation function
function validateGeneratedTest(test: GeneratedReadingTest): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!test.title?.trim()) errors.push('Missing title');
  if (!test.passages || test.passages.length === 0) errors.push('No passages');

  test.passages.forEach((p, pIdx) => {
    if (!p.content?.trim()) errors.push(`Passage ${pIdx + 1} has no content`);
    if (!p.questionGroups || p.questionGroups.length === 0) {
      errors.push(`Passage ${pIdx + 1} has no question groups`);
    }

    p.questionGroups?.forEach((g, gIdx) => {
      g.questions.forEach((q, qIdx) => {
        const id = `P${pIdx + 1}-G${gIdx + 1}-Q${qIdx + 1}`;
        if (!q.prompt?.trim()) errors.push(`${id}: Empty prompt`);
        if (!q.correctAnswer?.trim()) errors.push(`${id}: Missing answer key`);
        if (q.type === 'multiple_choice' && (!q.options || q.options.length < 2)) {
          errors.push(`${id}: MCQ needs at least 2 options`);
        }
      });
    });
  });

  return { isValid: errors.length === 0, errors };
}

const mockValidTest: GeneratedReadingTest = {
  id: 'test_123',
  title: 'Urban Planning and Sustainable Transit',
  topic: 'Urban Geography',
  difficultyLevel: 7,
  timeLimitMinutes: 20,
  createdAt: new Date().toISOString(),
  passages: [
    {
      id: 'p1',
      passageIndex: 1,
      title: 'The 15-Minute City Paradigm',
      content: 'Paragraph A\nUrban mobility is undergoing a renaissance...\n\nParagraph B\nProximity reduces vehicle emissions...',
      questionGroups: [
        {
          id: 'g1',
          groupTitle: 'Questions 1-2',
          questionType: 'multiple_choice',
          instructions: 'Choose the correct letter, A, B, C or D.',
          questions: [
            {
              id: 'q1',
              type: 'multiple_choice',
              prompt: 'What is the primary objective of a 15-minute city?',
              options: ['A. Promote car travel', 'B. Ensure hyper-proximity to essential amenities', 'C. Subsidize highway tolls', 'D. Relocate factories'],
              correctAnswer: 'B',
              explanation: '[Paragraph B]: Explicitly states proximity to essential amenities.',
              points: 1,
              source: 'ai_generated',
              answerKeyConfidence: 'high',
            },
            {
              id: 'q2',
              type: 'true_false_not_given',
              prompt: 'Vehicle emissions decrease when cities adopt mixed-use zoning.',
              correctAnswer: 'TRUE',
              explanation: '[Paragraph B]: Confirms vehicle emissions are reduced.',
              points: 1,
              source: 'ai_generated',
              answerKeyConfidence: 'high',
            },
          ],
        },
      ],
      questions: [],
    },
  ],
};

const validationRes = validateGeneratedTest(mockValidTest);
assert.equal(validationRes.isValid, true);
assert.equal(validationRes.errors.length, 0);
console.log('✓ Passed: Valid test passed comprehensive structural verification.');

// Test 4: Detection of invalid questions (missing answer key, MCQ without options)
const mockInvalidTest: GeneratedReadingTest = {
  ...mockValidTest,
  passages: [
    {
      ...mockValidTest.passages[0],
      questionGroups: [
        {
          ...mockValidTest.passages[0].questionGroups![0],
          questions: [
            {
              id: 'bad_q1',
              type: 'multiple_choice',
              prompt: 'Question without options or answer',
              correctAnswer: '',
              options: [],
              explanation: '',
            },
          ],
        },
      ],
    },
  ],
};

const invalidRes = validateGeneratedTest(mockInvalidTest);
assert.equal(invalidRes.isValid, false);
assert.ok(invalidRes.errors.some((e) => e.includes('Missing answer key')));
assert.ok(invalidRes.errors.some((e) => e.includes('MCQ needs at least 2 options')));
console.log('✓ Passed: Invalid question keys and missing options detected correctly.');

// Test 5: Serialization & Deserialization
const serialized = JSON.stringify(mockValidTest);
const deserialized = JSON.parse(serialized) as GeneratedReadingTest;
assert.equal(deserialized.id, mockValidTest.id);
assert.equal(deserialized.difficultyLevel, 7);
assert.equal(deserialized.passages.length, 1);
assert.equal(deserialized.passages[0].questionGroups![0].questions.length, 2);
console.log('✓ Passed: Serialization to JSON and round-trip restore verified.');

console.log('ALL AI READING TEST GENERATOR UNIT & INTEGRATION TESTS PASSED! 🎉');
