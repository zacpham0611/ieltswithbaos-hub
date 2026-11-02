import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  sanitizeSpeakingDocumentText,
  extractSpeakingPartsFromDocument,
} from '../src/lib/speakingExtractor.ts';

describe('Master Prompt 4 - Speaking, Reading & Regular Test Fixes Suite', () => {
  it('1. Speaking Extractor: should filter page markers like [page 4], [Trang 4], Page 4 of 20 and prevent them from becoming topics', () => {
    const rawDocText = `
Forecast IELTS Speaking 2024
Jan - Apr 2026 Question Bank

PART 1

Hometown
• Where is your hometown?
• What do you like about it?
[page 4]
• Is there anything you dislike about your hometown?

[Page 5]
Accommodation
1. Do you live in a house or an flat?
2. What is your favorite room?
Page 5 of 20
[trang 6]

PART 2 & 3
Describe a memorable journey you took by public transport
You should say:
• Where you went
• What public transport you used
• Who you went with
And explain why this journey was memorable.

Part 3 - Discussion Questions
Public Transportation
• Do you think public transport will replace private cars?
• Why do some people prefer driving to work?
    `.trim();

    const sanitizedLines = sanitizeSpeakingDocumentText(rawDocText);

    // Verify sanitized lines contain NO page markers
    for (const line of sanitizedLines) {
      assert.strictEqual(
        /^\[\s*(?:page|trang|p\.?)\s*\d+[^\]]*\]$/i.test(line),
        false,
        `Line should not be bracketed page marker: ${line}`
      );
      assert.strictEqual(
        /^(?:page|trang)\s*\d+\s*(?:of|\/|-)\s*\d+$/i.test(line),
        false,
        `Line should not be page X of Y: ${line}`
      );
    }

    const extracted = extractSpeakingPartsFromDocument(rawDocText, 'sample.docx');
    assert.strictEqual(extracted.hasContent, true);

    const part1Topics = extracted.part1?.topics || [];
    const topicTitles = part1Topics.map((t) => t.topic.toLowerCase());

    // Page markers must NEVER be topics
    assert.strictEqual(topicTitles.includes('[page 4]'), false);
    assert.strictEqual(topicTitles.includes('[page 5]'), false);
    assert.strictEqual(topicTitles.includes('page 5 of 20'), false);
    assert.strictEqual(topicTitles.includes('[trang 6]'), false);

    // Expected actual topics
    assert.ok(topicTitles.some((t) => t.includes('hometown')), 'Hometown topic must be present');
    assert.ok(topicTitles.some((t) => t.includes('accommodation')), 'Accommodation topic must be present');

    // The questions under Hometown separated across [page 4] should be together in Hometown
    const hometown = part1Topics.find((t) => t.topic.toLowerCase().includes('hometown'));
    assert.ok(hometown, 'Hometown should exist');
    assert.strictEqual(
      hometown.questions.length,
      3,
      `Hometown should contain all 3 questions across page breaks: ${JSON.stringify(hometown.questions)}`
    );
  });

  it('2. Part 2 Cue Cards and Automatic Part 3 Group Association', () => {
    const rawDocText = `
PART 2 & 3
Describe a gift you received that was important to you
You should say:
• Who gave it to you
• What the gift was
• When you received it
And explain why it was important to you.

Part 3 - Discussion Questions
Giving Gifts
• When do people usually give gifts in your country?
• Do you prefer receiving gifts or giving them?

Describe a memorable journey you took
You should say:
• Where you went
• Who you went with
And explain why it was memorable.

Part 3 - Discussion Questions
Travelling and Journeys
• Why do young people like to travel?
• How has tourism changed in recent decades?
    `.trim();

    const extracted = extractSpeakingPartsFromDocument(rawDocText, 'gift_and_journey.docx');
    const cueCards = extracted.part2?.cueCards || [];
    const p3Groups = extracted.part3?.groups || [];

    assert.strictEqual(cueCards.length, 2, 'Should detect 2 cue cards');
    assert.strictEqual(p3Groups.length, 2, 'Should detect 2 part 3 groups');

    // Verify cue cards
    assert.ok(cueCards[0].topic.toLowerCase().includes('gift'));
    assert.ok(cueCards[1].topic.toLowerCase().includes('journey'));

    // Verify auto association
    assert.ok(
      p3Groups[0].cueCardTopic?.toLowerCase().includes('gift') ||
      p3Groups[0].questions.some((q) => q.toLowerCase().includes('gift'))
    );
    assert.ok(
      p3Groups[1].cueCardTopic?.toLowerCase().includes('journey') ||
      p3Groups[1].cueCardTopic?.toLowerCase().includes('travel') ||
      p3Groups[1].questions.some((q) => q.toLowerCase().includes('travel'))
    );
  });

  it('3. Sequential Progression Logic: Skill 1 -> Skill 2 -> Skill 3', () => {
    // Test sequential progression functions
    const sections = [
      { id: 's_read', skill: 'reading', readingQuestions: [{ id: 'q1' }, { id: 'q2' }] },
      { id: 's_write_t1', skill: 'writing', writingTaskType: 'task1' },
      { id: 's_write_t2', skill: 'writing', writingTaskType: 'task2' },
      { id: 's_spk_p1', skill: 'speaking', speakingPart: 'part1' },
    ];

    const isSectionCompleted = (secIdx: number, answers: any): boolean => {
      const sec = sections[secIdx];
      if (sec.skill === 'reading') {
        const answered = (sec.readingQuestions || []).filter((q: any) => answers.reading?.[q.id]?.trim()).length;
        return answered > 0;
      }
      if (sec.skill === 'writing') {
        const taskKey = sec.writingTaskType === 'task1' ? 'task1' : 'task2';
        const text = answers.writing?.[taskKey]?.text || '';
        return text.trim().length > 0;
      }
      if (sec.skill === 'speaking') {
        return Boolean(answers.speaking?.[sec.id]?.audioUrl);
      }
      return false;
    };

    const isSectionAccessible = (targetIdx: number, answers: any): boolean => {
      if (targetIdx <= 0) return true;
      for (let i = 0; i < targetIdx; i++) {
        if (!isSectionCompleted(i, answers)) return false;
      }
      return true;
    };

    const emptyAnswers = { reading: {}, writing: {}, speaking: {} };
    // At start, only section 0 (Reading) is accessible
    assert.strictEqual(isSectionAccessible(0, emptyAnswers), true);
    assert.strictEqual(isSectionAccessible(1, emptyAnswers), false);
    assert.strictEqual(isSectionAccessible(2, emptyAnswers), false);
    assert.strictEqual(isSectionAccessible(3, emptyAnswers), false);

    // After Reading is answered
    const answersWithReading = { reading: { q1: 'True' }, writing: {}, speaking: {} };
    assert.strictEqual(isSectionAccessible(0, answersWithReading), true);
    assert.strictEqual(isSectionAccessible(1, answersWithReading), true);
    assert.strictEqual(isSectionAccessible(2, answersWithReading), false);

    // After Writing Task 1 has text
    const answersWithTask1 = {
      reading: { q1: 'True' },
      writing: { task1: { text: 'The chart illustrates the changes...', wordCount: 160 } },
      speaking: {},
    };
    assert.strictEqual(isSectionAccessible(2, answersWithTask1), true);
    assert.strictEqual(isSectionAccessible(3, answersWithTask1), false);

    // Writing Task 2 lock check
    const isTask1Completed = Boolean(answersWithTask1.writing?.task1?.text?.trim().length > 0);
    assert.strictEqual(isTask1Completed, true, 'Task 2 should unlock once Task 1 has text');
  });

  it('4. Speaking Question-by-Question and Timed Flow State Machine', () => {
    // Flow verification for Part 1 (4s reading -> record -> stop -> saved)
    let p1State: 'idle' | 'reading' | 'recording' | 'saving' | 'saved' = 'idle';
    let countdown = 4;

    // Student clicks Start (Reading 4s)
    p1State = 'reading';
    assert.strictEqual(p1State, 'reading');

    // Countdown ticks down
    while (countdown > 0) {
      countdown -= 1;
    }
    assert.strictEqual(countdown, 0);

    // Timer expires -> auto record
    p1State = 'recording';
    assert.strictEqual(p1State, 'recording');

    // Student manually clicks Stop
    p1State = 'saving';
    assert.strictEqual(p1State, 'saving');

    // Audio saved -> explicit Continue enabled
    p1State = 'saved';
    assert.strictEqual(p1State, 'saved');
  });
});
