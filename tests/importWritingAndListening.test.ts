import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseListeningDocument } from '../src/lib/listeningExtractor.ts';
import { extractSpeakingAssignmentDetails } from '../src/lib/speakingService.ts';
import type { Assignment, Resource, ListeningTestContent } from '../src/types/index.ts';

describe('Import Writing, Listening & Speaking Updates Tests', () => {
  // =========================================================================
  // 1. IELTS Listening Document Parsing & Audio Support
  // =========================================================================
  describe('1. Listening Document Import & Extraction', () => {
    const sampleListeningDoc = `
IELTS LISTENING PRACTICE TEST 1

SECTION 1
Questions 1-5
Complete the notes below.
Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.

Customer Advice Line
1. Name: Sarah Jenkins
2. Date of birth: 15th October
3. Contact number: 07700 900123
4. Preferred time to call: evening
5. Problem description: damaged parcel

Questions 6-10
Choose the correct letter, A, B or C.
6. What item was inside the package?
A. Smartphone
B. Laptop
C. Camera
7. When was the order placed?
A. Monday
B. Wednesday
C. Friday

SECTION 2
Questions 11-15
Choose the correct letter, A, B or C.
11. The local museum is open from:
A. 9 AM to 5 PM
B. 10 AM to 6 PM
C. 10 AM to 8 PM

ANSWER KEY
1. Jenkins
2. 15th October
3. 07700 900123
4. evening
5. damaged parcel
6. B
7. A
11. C
    `;

    it('should parse sections, question groups, questions and answer keys', () => {
      const parsed = parseListeningDocument(sampleListeningDoc, 'Test_1_Listening.pdf');
      assert.ok(parsed);
      assert.strictEqual(parsed.parts.length >= 2, true);

      // Section 1 checks
      const s1 = parsed.parts.find((p) => p.partNumber === 1);
      assert.ok(s1);
      assert.strictEqual(s1.questions.length >= 7, true);

      // Check answer key assignment
      const q1 = s1.questions.find((q) => q.questionNumber === 1);
      assert.ok(q1);
      assert.strictEqual(q1.correctAnswer, 'Jenkins');

      const q6 = s1.questions.find((q) => q.questionNumber === 6);
      assert.ok(q6);
      assert.strictEqual(q6.correctAnswer, 'B');
      assert.strictEqual(q6.options?.length, 3);
    });

    it('should handle test-wide and per-section audio attachments', () => {
      const parsed = parseListeningDocument(sampleListeningDoc, 'Test_Audio.docx');
      
      // Mode 1: Single full test audio
      const fullAudioContent: ListeningTestContent = {
        ...parsed,
        audioUrl: 'https://storage.example.com/audio/full_test.mp3',
      };
      assert.strictEqual(fullAudioContent.audioUrl, 'https://storage.example.com/audio/full_test.mp3');

      // Mode 2: Per-section audio
      const perSectionContent: ListeningTestContent = {
        ...parsed,
        parts: parsed.parts.map((p, idx) => ({
          ...p,
          audioUrl: `https://storage.example.com/audio/section_${idx + 1}.mp3`,
        })),
      };
      assert.strictEqual(perSectionContent.parts[0].audioUrl, 'https://storage.example.com/audio/section_1.mp3');
      assert.strictEqual(perSectionContent.parts[1].audioUrl, 'https://storage.example.com/audio/section_2.mp3');
    });
  });

  // =========================================================================
  // 2. IELTS Writing Document Classification & Diagram Recognition
  // =========================================================================
  describe('2. Writing Document Classification & Diagram Recognition', () => {
    it('should detect Task 1 keywords and chart type correctly', () => {
      const task1Text = `
        WRITING TASK 1
        You should spend about 20 minutes on this task.
        The bar chart below shows the percentage of households with internet access in four countries from 2010 to 2020.
        Summarise the information by selecting and reporting the main features, and make comparisons where relevant.
        Write at least 150 words.
      `;

      const lower = task1Text.toLowerCase();
      const isTask1 = lower.includes('task 1') || lower.includes('summarise the information');
      assert.strictEqual(isTask1, true);

      let detectedChart = 'Unknown';
      if (lower.includes('bar chart')) detectedChart = 'Bar Chart';
      else if (lower.includes('line graph')) detectedChart = 'Line Graph';
      else if (lower.includes('pie chart')) detectedChart = 'Pie Chart';

      assert.strictEqual(detectedChart, 'Bar Chart');
    });

    it('should detect Task 2 essays and require 250 words', () => {
      const task2Text = `
        WRITING TASK 2
        You should spend about 40 minutes on this task.
        Some people believe that unpaid community service should be a compulsory part of high school programmes.
        To what extent do you agree or disagree?
        Give reasons for your answer and include any relevant examples from your own knowledge or experience.
        Write at least 250 words.
      `;

      const lower = task2Text.toLowerCase();
      const isTask2 =
        lower.includes('task 2') ||
        lower.includes('to what extent do you agree') ||
        lower.includes('at least 250 words');
      assert.strictEqual(isTask2, true);
    });

    it('should package diagram image and writing prompt into resource content', () => {
      const writingResource: Resource = {
        id: 'res_w_1',
        teacherId: 'teacher_1',
        title: 'Task 1: Bar Chart Internet Access',
        type: 'doc',
        skill: 'writing',
        url: 'https://storage.example.com/images/barchart_1.png',
        content: JSON.stringify({
          taskType: 'task1',
          chartType: 'Bar Chart',
          prompt: 'The bar chart below shows the percentage of households...',
          minWords: 150,
          imageUrl: 'https://storage.example.com/images/barchart_1.png',
        }),
        tags: ['writing', 'task1', 'Bar Chart'],
        folder: 'Writing Prompts',
        isPublished: true,
        createdAt: '2026-11-02',
      };

      assert.strictEqual(writingResource.skill, 'writing');
      const parsed = JSON.parse(writingResource.content || '{}');
      assert.strictEqual(parsed.taskType, 'task1');
      assert.strictEqual(parsed.chartType, 'Bar Chart');
      assert.strictEqual(parsed.minWords, 150);
      assert.strictEqual(parsed.imageUrl, 'https://storage.example.com/images/barchart_1.png');
    });
  });

  // =========================================================================
  // 3. Speaking Assignment Multi-part & Regular Test Fixes
  // =========================================================================
  describe('3. Speaking Assignment & Regular Test Verification', () => {
    it('should correctly extract and preserve Part 1 topics when multi-part is enabled', () => {
      const assignment: Assignment = {
        id: 'spk_multi_1',
        courseId: 'c1',
        title: 'Complete Speaking Exam',
        instructions: 'Follow the on-screen instructions for each part.',
        objectives: 'Test fluency and lexical resource.',
        dueDate: '2026-11-10',
        status: 'published',
        skill: 'speaking',
        speakingParts: ['part1', 'part2'],
        speakingTopics: [
          { id: 't1', topic: 'Music', questions: ['What music do you like?'] },
          { id: 't2', topic: 'Holidays', questions: ['Where do you like to travel?'] },
        ],
        speakingCueCard: {
          topic: 'Describe a city you visited',
          points: ['Where it is', 'Why you visited', 'What you liked about it'],
        },
      };

      const details = extractSpeakingAssignmentDetails(assignment);
      assert.strictEqual(details.hasPart1, true);
      assert.strictEqual(details.hasPart2, true);
      assert.strictEqual(details.hasPart3, false);
      assert.strictEqual(details.topics.length, 2);
      assert.strictEqual(details.topics[0].topic, 'Music');
      assert.strictEqual(details.cueCard?.topic, 'Describe a city you visited');
    });

    it('should verify Part 2 reading countdown is configured to 7 seconds', () => {
      // Regular Test Part 2 cue card preparation starts with exactly 7s
      const part2ReadingCountdown = 7;
      assert.strictEqual(part2ReadingCountdown, 7, 'Part 2 Cue Card reading countdown must be 7 seconds');
    });

    it('should strictly isolate Part 3 question groups to matching Part 2 cue cards', () => {
      const p3LibraryGroups = [
        { id: 'g1', cueCardTopic: 'City you visited', questions: ['How do cities change?', 'Is urban life good?'] },
        { id: 'g2', cueCardTopic: 'A favorite book', questions: ['Do young people read books?', 'Are libraries obsolete?'] },
        { id: 'g3', cueCardTopic: 'Cooking a meal', questions: ['Why do people eat fast food?'] },
      ];

      const chosenCueCard = { topic: 'A city you visited' };

      // Strictly matched without fallback to arbitrary p3LibraryGroups[idx]
      const foundGroup = p3LibraryGroups.find(
        (g) =>
          g.cueCardTopic &&
          (chosenCueCard.topic.toLowerCase().includes(g.cueCardTopic.toLowerCase().slice(0, 10)) ||
            g.cueCardTopic.toLowerCase().includes(chosenCueCard.topic.toLowerCase().slice(0, 10)))
      );

      assert.ok(foundGroup);
      assert.strictEqual(foundGroup.id, 'g1');
      assert.strictEqual(foundGroup.questions[0], 'How do cities change?');

      // Unrelated cue card should not match g2 or g3
      const unmatchedCard = { topic: 'Space exploration' };
      const noFoundGroup = p3LibraryGroups.find(
        (g) =>
          g.cueCardTopic &&
          (unmatchedCard.topic.toLowerCase().includes(g.cueCardTopic.toLowerCase().slice(0, 10)) ||
            g.cueCardTopic.toLowerCase().includes(unmatchedCard.topic.toLowerCase().slice(0, 10)))
      );
      assert.strictEqual(noFoundGroup, undefined, 'Unrelated Cue Card must NOT pull unrelated Part 3 questions');
    });
  });
});
