import assert from 'node:assert';
import {
  extractSpeakingPartsFromDocument,
} from '../src/lib/speakingExtractor.ts';
import {
  extractSpeakingAssignmentDetails,
  unpackSpeakingSubmission,
  packSpeakingSubmission,
  transcribeAndTranslateAudio,
} from '../src/lib/speakingService.ts';
import type { Assignment, SpeakingTopic, SpeakingPart3Group } from '../src/types/index.ts';

console.log('--- RUNNING SPEAKING MODULE FIXES & IMPROVEMENTS TESTS ---');

// =========================================================================
// 1. Part 1 Multi-Topic Recognition Test
// =========================================================================
console.log('Test 1: Part 1 - Multi-topic recognition (Numbered, labeled, and standalone)');
{
  const multiTopicDoc = `
IELTS SPEAKING PRACTICE 2026

PART 1

Topic 1: Crowded Places
1. What places in your city are usually crowded?
2. How do you feel when you are in a crowded place?
3. When was the last time you visited a crowded place?

Topic 2: Public Transportation
1. Do you frequently use public transport?
2. What are the advantages of traveling by bus or subway?
3. How could public transport in your hometown be improved?

Hometown
1. Where is your hometown located?
2. What do you like most about living there?
3. Has your hometown changed much over the last ten years?

Work or Studies
1. Do you work or are you a student?
2. What is the most challenging aspect of your job?
`;

  const extracted = extractSpeakingPartsFromDocument(multiTopicDoc, 'IELTS_Speaking_De1.docx');
  assert.ok(extracted.part1 !== null, 'Part 1 must be extracted');
  assert.strictEqual(extracted.part1.topics.length, 4, 'Must extract all 4 distinct topics');

  // Verify Topic 1
  assert.strictEqual(extracted.part1.topics[0].topic, 'Crowded Places');
  assert.strictEqual(extracted.part1.topics[0].questions.length, 3);
  assert.strictEqual(extracted.part1.topics[0].questions[0], 'What places in your city are usually crowded?');

  // Verify Topic 2
  assert.strictEqual(extracted.part1.topics[1].topic, 'Public Transportation');
  assert.strictEqual(extracted.part1.topics[1].questions.length, 3);

  // Verify Standalone Title Topic 3 (Hometown)
  assert.strictEqual(extracted.part1.topics[2].topic, 'Hometown');
  assert.strictEqual(extracted.part1.topics[2].questions.length, 3);
  assert.strictEqual(extracted.part1.topics[2].questions[1], 'What do you like most about living there?');

  // Verify Standalone Title Topic 4 (Work or Studies)
  assert.strictEqual(extracted.part1.topics[3].topic, 'Work or Studies');
  assert.strictEqual(extracted.part1.topics[3].questions.length, 2);

  // Stable IDs
  assert.ok(extracted.part1.topics.every((t) => typeof t.id === 'string' && t.id.startsWith('topic_')));
  console.log('✓ Passed: Part 1 multi-topic recognition with distinct topic grouping.');
}

// =========================================================================
// 2. Part 2 Cue Card Recognition & Preservation Test
// =========================================================================
console.log('Test 2: Part 2 - Cue Cards recognition and preservation');
{
  const part2Doc = `
PART 2

Describe a memorable journey you have made.
You should say:
- Where you went
- Who you went with
- What you did during the trip
And explain why this journey was so memorable to you.

Describe a person you admire.
You should say:
* Who this person is
* What they have achieved
* Why you admire them
And explain how this person has influenced your life.
`;

  const extracted = extractSpeakingPartsFromDocument(part2Doc, 'Speaking_Part2.docx');
  assert.ok(extracted.part2 !== null, 'Part 2 must be detected');
  assert.strictEqual(extracted.part2.cueCards.length, 2, 'Must extract 2 cue cards');
  assert.ok(extracted.part2.cueCards[0].topic.includes('memorable journey'));
  assert.strictEqual(extracted.part2.cueCards[0].points.length, 4);
  assert.strictEqual(extracted.part2.cueCards[0].prepTimeSeconds, 60);
  assert.strictEqual(extracted.part2.cueCards[0].speakTimeSeconds, 120);

  assert.ok(extracted.part2.cueCards[1].topic.includes('person you admire'));
  assert.strictEqual(extracted.part2.cueCards[1].points.length, 4);
  console.log('✓ Passed: Part 2 Cue Cards recognition.');
}

// =========================================================================
// 3. Part 3 Grouping under Corresponding Part 2 Cue Cards Test
// =========================================================================
console.log('Test 3: Part 3 - Grouping under Part 2 Cue Cards and standalone questions');
{
  const fullSpeakingDoc = `
PART 2
Describe an ambition that you have had for a long time.
You should say:
- What this ambition is
- When you first had it
- Why it is important to you

Describe a memorable journey you made by public transport.
You should say:
- Where you went
- Who you traveled with
- Why you chose public transport

PART 3
Discussion topics related to: Describe an ambition that you have had for a long time
1. Why do you think some people have more ambitions than others?
2. Is it always healthy for young children to be highly ambitious?
3. How do ambitions change as people grow older?

Discussion topics related to: Describe a memorable journey you made by public transport
1. How has public transportation changed in your country over recent decades?
2. Why do many people prefer private cars over public buses?
3. In what ways can governments encourage more citizens to use public transit?
`;

  const extracted = extractSpeakingPartsFromDocument(fullSpeakingDoc, 'Full_Speaking_Test.docx');
  assert.ok(extracted.part2 !== null, 'Part 2 extracted');
  assert.ok(extracted.part3 !== null, 'Part 3 extracted');
  assert.strictEqual(extracted.part2.cueCards.length, 2, '2 cue cards in Part 2');

  // Verify Part 3 groups
  assert.strictEqual(extracted.part3.groups.length, 2, 'Part 3 must form exactly 2 groups');
  assert.ok(extracted.part3.groups[0].cueCardTopic?.includes('ambition'), 'Group 1 relates to ambition');
  assert.strictEqual(extracted.part3.groups[0].questions.length, 3, 'Group 1 has 3 questions');

  assert.ok(extracted.part3.groups[1].cueCardTopic?.includes('memorable journey'), 'Group 2 relates to journey');
  assert.strictEqual(extracted.part3.groups[1].questions.length, 3, 'Group 2 has 3 questions');

  // Verify flat questions compatibility
  assert.strictEqual(extracted.part3.questions.length, 6, 'Flat questions list contains all 6 questions');
  console.log('✓ Passed: Part 3 grouping under corresponding Part 2 Cue Cards.');
}

// Standalone Part 3 Test
{
  const standalonePart3Doc = `
PART 3 - Discussion Questions
1. How does modern technology affect daily communication?
2. Will artificial intelligence replace teachers in future classrooms?
`;

  const extracted = extractSpeakingPartsFromDocument(standalonePart3Doc, 'Part3_Only.docx');
  assert.ok(extracted.part3 !== null, 'Part 3 extracted');
  assert.strictEqual(extracted.part3.groups.length, 1, '1 group created for standalone Part 3');
  assert.strictEqual(extracted.part3.groups[0].questions.length, 2);
  assert.strictEqual(extracted.part3.questions.length, 2);
  console.log('✓ Passed: Standalone Part 3 questions without Part 2 cue cards.');
}

// =========================================================================
// 4. Individual Exercise Selection & Student-side Filtering Test
// =========================================================================
console.log('Test 4: Individual Exercise Selection & Student-side Presentation');
{
  const allTopics: SpeakingTopic[] = [
    { id: 'top_1', topic: 'Hometown', questions: ['Where are you from?', 'Do you like your city?'] },
    { id: 'top_2', topic: 'Music', questions: ['What genres do you enjoy?'] },
    { id: 'top_3', topic: 'Cooking', questions: ['Can you cook traditional dishes?'] },
  ];

  // Teacher selects ONLY top_1 and top_3
  const assignment: Partial<Assignment> = {
    skill: 'speaking',
    speakingPart: 'part1',
    speakingTopics: allTopics,
    selectedSpeakingExerciseIds: ['top_1', 'top_3'],
  };

  const studentDetails = extractSpeakingAssignmentDetails(assignment);
  assert.strictEqual(studentDetails.topics.length, 2, 'Student should ONLY receive the 2 explicitly selected topics');
  assert.strictEqual(studentDetails.topics[0].id, 'top_1');
  assert.strictEqual(studentDetails.topics[1].id, 'top_3');
  console.log('✓ Passed: Student-side individual exercise selection filtering.');
}

// =========================================================================
// 5. Assigned Exercise Status Detection Test (Đã giao / Chưa giao)
// =========================================================================
console.log('Test 5: Assigned Exercise Tracking & Duplicate Detection');
{
  const existingAssignments: Assignment[] = [
    {
      id: 'assign_101',
      courseId: 'course_ielts_7',
      title: 'Speaking Homework Week 1',
      instructions: 'Record responses',
      skill: 'speaking',
      objectives: 'Band 7.0 fluency',
      dueDate: '2026-11-10',
      status: 'published',
      speakingPart: 'part1',
      selectedSpeakingExerciseIds: ['top_hometown', 'top_daily_routine'],
      speakingTopics: [
        { id: 'top_hometown', topic: 'Hometown', questions: ['Where are you from?'] },
        { id: 'top_daily_routine', topic: 'Daily Routine', questions: ['When do you wake up?'] },
      ],
    },
    {
      id: 'assign_102',
      courseId: 'course_ielts_7',
      title: 'Speaking Mock Test Part 2',
      instructions: 'Record 2 min monologue',
      skill: 'speaking',
      objectives: 'Band 7.0 cohesion',
      dueDate: '2026-11-15',
      status: 'published',
      speakingPart: 'part2',
      speakingCueCard: {
        topic: 'Describe an ambition you have had for a long time',
        points: ['What it is', 'Why it matters'],
      },
    },
  ];

  // Helper matching the checkAssigned logic in AssignmentsView
  const checkAssigned = (id: string, topic: string, courseId: string) => {
    const normId = id.toLowerCase().trim();
    const normTopic = topic.toLowerCase().trim();
    const found = existingAssignments.find((a) => {
      if (a.courseId !== courseId || a.skill !== 'speaking') return false;
      if (a.selectedSpeakingExerciseIds?.some((item) => {
        const n = item.toLowerCase().trim();
        return n === normId || n === normTopic;
      })) return true;
      if (a.speakingTopics?.some((t) => t.id?.toLowerCase().trim() === normId || t.topic?.toLowerCase().trim() === normTopic)) return true;
      if (a.speakingCueCard?.topic && a.speakingCueCard.topic.toLowerCase().trim() === normTopic) return true;
      return false;
    });

    return {
      isAssigned: Boolean(found),
      assignmentTitle: found?.title || '',
      dueDate: found?.dueDate || '',
    };
  };

  // Case A: Topic is already assigned
  const check1 = checkAssigned('top_hometown', 'Hometown', 'course_ielts_7');
  assert.strictEqual(check1.isAssigned, true, 'Hometown must be recognized as Đã giao');
  assert.strictEqual(check1.assignmentTitle, 'Speaking Homework Week 1');

  // Case B: Cue Card is already assigned
  const check2 = checkAssigned('cue_ambition', 'Describe an ambition you have had for a long time', 'course_ielts_7');
  assert.strictEqual(check2.isAssigned, true, 'Ambition cue card must be recognized as Đã giao');
  assert.strictEqual(check2.assignmentTitle, 'Speaking Mock Test Part 2');

  // Case C: Unassigned topic
  const check3 = checkAssigned('top_technology', 'Technology and AI', 'course_ielts_7');
  assert.strictEqual(check3.isAssigned, false, 'Technology and AI must be Chưa giao');

  // Case D: Different course (scoped isolation)
  const check4 = checkAssigned('top_hometown', 'Hometown', 'course_ielts_8');
  assert.strictEqual(check4.isAssigned, false, 'Hometown must be Chưa giao in course_ielts_8');

  console.log('✓ Passed: Assigned exercise tracking (Đã giao / Chưa giao) with course scoping.');
}

// =========================================================================
// 6. Transcript-Free Submission & Safe Persistence Test
// =========================================================================
console.log('Test 6: Transcript-Free Submission & Audio Playback Preservation');
{
  // 1. transcribeAndTranslateAudio stub test
  const stubRes = await transcribeAndTranslateAudio({
    audioUrl: 'https://example.com/audio.webm',
    promptContext: 'Describe an experience',
    speakingPart: 'part2',
  });
  assert.strictEqual(stubRes.transcript, '', 'Transcript must be empty string without speech-to-text API call');
  assert.strictEqual(stubRes.translation, '', 'Translation must be empty string without AI translation call');

  // 2. Transcript-free packing
  const modernSubmissionPacked = packSpeakingSubmission({
    responses: {
      p2_cue: {
        questionId: 'p2_cue',
        audioUrl: 'https://storage.supabase.co/speaking/student_1_p2.webm',
        duration: 114,
        status: 'completed',
        recordedAt: '2026-11-02T10:00:00Z',
      },
    },
  });

  const parsed = JSON.parse(modernSubmissionPacked);
  assert.strictEqual(parsed.transcript, '', 'No transcript overhead');
  assert.strictEqual(parsed.translation, '', 'No translation overhead');
  assert.strictEqual(parsed.responses.p2_cue.duration, 114, 'Audio duration intact');
  assert.strictEqual(parsed.responses.p2_cue.audioUrl, 'https://storage.supabase.co/speaking/student_1_p2.webm');

  // 3. Unpacking without data loss
  const unpacked = unpackSpeakingSubmission(modernSubmissionPacked, null);
  assert.ok(unpacked.responses.p2_cue !== undefined, 'Unpacked responses has p2_cue');
  assert.strictEqual(unpacked.responses.p2_cue.duration, 114);

  // 4. Backward compatibility with historical submissions containing transcripts
  const historicalPacked = JSON.stringify({
    transcript: 'Historical student speech transcript',
    translation: 'Bản dịch lịch sử',
    responses: {
      q1: {
        audioUrl: 'https://storage.supabase.co/speaking/hist_q1.webm',
        duration: 40,
        transcript: 'Historical student speech transcript',
      },
    },
  });
  const unpackedHistorical = unpackSpeakingSubmission(historicalPacked, null);
  assert.strictEqual(unpackedHistorical.responses.q1.audioUrl, 'https://storage.supabase.co/speaking/hist_q1.webm');
  assert.strictEqual(unpackedHistorical.responses.q1.duration, 40);

  console.log('✓ Passed: Transcript-free submission & audio playback preservation.');
}

console.log('\n======================================================');
console.log('ALL SPEAKING MODULE FIXES & TESTS PASSED SUCCESSFULLY! 🎯');
console.log('======================================================\n');
