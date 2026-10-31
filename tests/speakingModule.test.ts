import assert from 'node:assert';
import {
  extractSpeakingPartsFromDocument,
} from '../src/lib/speakingExtractor.ts';
import {
  extractSpeakingAssignmentDetails,
  unpackSpeakingSubmission,
  packSpeakingSubmission,
} from '../src/lib/speakingService.ts';

console.log('--- RUNNING SPEAKING MODULE & EXTRACTION TESTS ---');

// -------------------------------------------------------------
// Test 1: Part 1 Topic-based Extraction with Associated Questions
// -------------------------------------------------------------
console.log('Test 1: Part 1 Topic-based Extraction');
{
  const sampleDoc = `
IELTS Speaking Forecast Q1-Q4 2026
Page 1 of 15

PART 1

Topic 1: Crowded place
1. What places in your city are usually crowded?
2. How do you feel when you are in a crowded place?
3. When was the last time you were in a crowded place?

Topic 2: Singing
1. Do you like singing?
2. Did you learn singing when you were a child?
3. Is singing popular in your country?
`;

  const extracted = extractSpeakingPartsFromDocument(sampleDoc, 'Forecast_2026.docx');
  assert.ok(extracted.part1 !== null, 'Part 1 must be detected');
  assert.strictEqual(extracted.part1.topics.length, 2, 'Must extract exactly 2 topics');
  assert.strictEqual(extracted.part1.topics[0].topic, 'Crowded place', 'First topic name is Crowded place');
  assert.strictEqual(extracted.part1.topics[0].questions.length, 3, 'First topic has 3 questions');
  assert.strictEqual(extracted.part1.topics[1].topic, 'Singing', 'Second topic name is Singing');
  assert.strictEqual(extracted.part1.topics[1].questions.length, 3, 'Second topic has 3 questions');
  console.log('✓ Passed: Part 1 topic-based extraction.');
}

// -------------------------------------------------------------
// Test 2: Part 2 Cue Card Extraction with Bullet Points
// -------------------------------------------------------------
console.log('Test 2: Part 2 Cue Card Extraction');
{
  const sampleDoc = `
PART 2

Describe an ambition that you have had for a long time.
You should say:
- What this ambition is
- When and why you first had it
- What you need to do to achieve it
And explain how you will feel when you achieve this ambition.

Describe a person who taught you something important.
You should say:
* Who this person was
* What they taught you
* How they taught you
And explain why this lesson was important.
`;

  const extracted = extractSpeakingPartsFromDocument(sampleDoc, 'Speaking_Part2.docx');
  assert.ok(extracted.part2 !== null, 'Part 2 must be detected');
  assert.strictEqual(extracted.part2.cueCards.length, 2, 'Must extract 2 cue cards');
  assert.ok(extracted.part2.cueCards[0].topic.includes('ambition'), 'First cue card topic contains ambition');
  assert.ok(extracted.part2.cueCards[0].points.length >= 3, 'First cue card has bullet points');
  assert.ok(extracted.part2.cueCards[1].topic.includes('person who taught you'), 'Second cue card topic contains person');
  console.log('✓ Passed: Part 2 cue card extraction.');
}

// -------------------------------------------------------------
// Test 3: Part 3 Independent Discussion Questions Extraction
// -------------------------------------------------------------
console.log('Test 3: Part 3 Independent Discussion Questions Extraction');
{
  const sampleDoc = `
PART 3 - Discussion Questions

1. Why do you think some people have more ambitions than others?
2. Is it always good for children to have high ambitions?
3. How have ambitions of young people changed compared to older generations?
4. Do you think success always comes from working hard?
`;

  const extracted = extractSpeakingPartsFromDocument(sampleDoc, 'Part3_Questions.docx');
  assert.ok(extracted.part3 !== null, 'Part 3 must be detected');
  assert.strictEqual(extracted.part3.questions.length, 4, 'Must extract 4 independent discussion questions');
  assert.ok(extracted.part3.questions[0].includes('ambitions'), 'First question is about ambitions');
  console.log('✓ Passed: Part 3 independent discussion questions extraction.');
}

// -------------------------------------------------------------
// Test 4: Stripping Forecast Metadata & Dates (Non-Regression)
// -------------------------------------------------------------
console.log('Test 4: Forecast and Page Artifacts Sanitization');
{
  const rawTextWithNoise = `
IELTS Speaking Forecast Q1-Q4 2026
Jan - Apr 2026 Question Bank
Page 3 of 20
2026 - 2027

PART 1
Topic: Money
1. Do you save money?
`;

  const extracted = extractSpeakingPartsFromDocument(rawTextWithNoise, 'IELTS_Forecast.pdf');
  assert.ok(extracted.part1 !== null, 'Part 1 extracted');
  assert.strictEqual(extracted.part1.topics[0].topic, 'Money', 'Topic is Money, not forecast date');
  console.log('✓ Passed: Forecast and page artifacts sanitization.');
}

// -------------------------------------------------------------
// Test 5: Speaking Assignment Structure Parsing (Part 1, 2, 3)
// -------------------------------------------------------------
console.log('Test 5: Speaking Assignment Structure Normalization');
{
  // Part 1 Assignment
  const p1Assign = extractSpeakingAssignmentDetails({
    speakingPart: 'part1',
    speakingTopics: [
      { id: 't1', topic: 'Daily Routine', questions: ['When do you wake up?'] },
    ],
  });
  assert.strictEqual(p1Assign.part, 'part1', 'Part 1 normalized');
  assert.strictEqual(p1Assign.topics.length, 1, '1 topic found');

  // Part 2 Assignment (preserving legacy cueCard)
  const p2Assign = extractSpeakingAssignmentDetails({
    speakingPart: 'part2',
    speakingCueCard: {
      topic: 'Describe a memorable journey.',
      points: ['Where you went', 'Who you went with'],
      prepTimeSeconds: 60,
      speakTimeSeconds: 120,
    },
  });
  assert.strictEqual(p2Assign.part, 'part2', 'Part 2 normalized');
  assert.ok(p2Assign.cueCard !== null, 'Cue card present');
  assert.strictEqual(p2Assign.cueCard?.prepTimeSeconds, 60, 'Prep time preserved');

  // Part 3 Assignment
  const p3Assign = extractSpeakingAssignmentDetails({
    speakingPart: 'part3',
    speakingQuestions: ['How has transportation changed?'],
  });
  assert.strictEqual(p3Assign.part, 'part3', 'Part 3 normalized');
  assert.strictEqual(p3Assign.questions.length, 1, '1 question found');
  console.log('✓ Passed: Speaking assignment structure normalization.');
}

// -------------------------------------------------------------
// Test 6: Speaking Submission Multi-Audio Packing & Unpacking
// -------------------------------------------------------------
console.log('Test 6: Speaking Submission Multi-Audio Packing & Unpacking');
{
  const packed = packSpeakingSubmission({
    transcript: 'English transcript sample',
    translation: 'Bản dịch tiếng Việt mẫu',
    responses: {
      q1: {
        audioUrl: 'https://storage.supabase.com/speaking/q1.webm',
        transcript: 'Answer for question 1',
        translation: 'Câu trả lời 1',
        duration: 35,
        status: 'completed',
      },
      q2: {
        audioUrl: 'https://storage.supabase.com/speaking/q2.webm',
        transcript: 'Answer for question 2',
        translation: 'Câu trả lời 2',
        duration: 42,
        status: 'completed',
      },
    },
  });

  const unpacked = unpackSpeakingSubmission(packed, 'https://storage.supabase.com/speaking/q1.webm');
  assert.strictEqual(unpacked.transcript, 'English transcript sample', 'Transcript preserved');
  assert.strictEqual(unpacked.translation, 'Bản dịch tiếng Việt mẫu', 'Translation preserved');
  assert.strictEqual(Object.keys(unpacked.responses).length, 2, '2 question responses unpacked');
  assert.strictEqual(unpacked.responses.q1.duration, 35, 'Duration preserved');

  // Legacy single audio fallback
  const legacyUnpacked = unpackSpeakingSubmission('Simple transcript string', 'https://example.com/audio.mp3');
  assert.strictEqual(legacyUnpacked.transcript, 'Simple transcript string', 'Legacy plain text transcript preserved');
  assert.ok(legacyUnpacked.responses.default?.audioUrl === 'https://example.com/audio.mp3', 'Legacy audio url preserved');
  console.log('✓ Passed: Speaking submission multi-audio packing & unpacking.');
}

console.log('\n========================================');
console.log('ALL SPEAKING TESTS PASSED SUCCESSFULLY! 🎉');
console.log('========================================\n');
