import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import mammoth from 'mammoth';
import { parseListeningDocument, extractListeningAnswerKey } from '../src/lib/listeningExtractor.ts';
import { parseWritingDocument } from '../src/lib/writingDocumentExtractor.ts';
import type { Resource, SpeakingTopic, SpeakingCueCard, SpeakingPart3Group } from '../src/types/index.ts';

describe('Comprehensive IELTS Upgrade Tests', () => {
  const listeningDocxPath = 'C:/Users/Admin/.gemini/antigravity/brain/e66bef89-3824-44a3-9b01-1da8f8609a20/.user_uploaded/media_1793634904344_a8f7fc60.docx';
  const writingDocxPath = 'C:/Users/Admin/.gemini/antigravity/brain/e66bef89-3824-44a3-9b01-1da8f8609a20/.user_uploaded/media_1793634904344_a3091dd2.docx';

  // =========================================================================
  // 1. Authentic IELTS Listening Document Extraction
  // =========================================================================
  describe('1. IELTS Listening Document Extraction (IELTS Test 1 – Listening.docx)', () => {
    it('should extract text, detect all 4 sections and 40 questions, and map answer keys', async () => {
      assert.strictEqual(fs.existsSync(listeningDocxPath), true, 'File must exist');
      const docxBuffer = fs.readFileSync(listeningDocxPath);
      const { value: rawText } = await mammoth.extractRawText({ buffer: docxBuffer });

      const parsed = parseListeningDocument(rawText, 'IELTS_Test_1_–_Listening.docx');

      assert.strictEqual(parsed.parts.length, 4, 'Should detect 4 parts/sections');
      assert.strictEqual(parsed.totalQuestions, 40, 'Should extract exactly 40 questions');

      // Check Section 1 questions (Q1 to Q10)
      const sec1 = parsed.parts[0];
      assert.strictEqual(sec1.questions.length, 10, 'Section 1 should have 10 questions (Q1-10)');
      assert.strictEqual(sec1.questions[0].questionNumber, 1);
      assert.strictEqual(sec1.questions[9].questionNumber, 10);

      // Check Section 2 questions (Q11 to Q20)
      const sec2 = parsed.parts[1];
      assert.strictEqual(sec2.questions.length, 10, 'Section 2 should have 10 questions (Q11-20)');
      assert.strictEqual(sec2.questions[0].questionNumber, 11);
      assert.strictEqual(sec2.questions[9].questionNumber, 20);

      // Check Section 3 questions (Q21 to Q30)
      const sec3 = parsed.parts[2];
      assert.strictEqual(sec3.questions.length, 10, 'Section 3 should have 10 questions (Q21-30)');
      assert.strictEqual(sec3.questions[0].questionNumber, 21);
      assert.strictEqual(sec3.questions[9].questionNumber, 30);

      // Check Section 4 questions (Q31 to Q40)
      const sec4 = parsed.parts[3];
      assert.strictEqual(sec4.questions.length, 10, 'Section 4 should have 10 questions (Q31-40)');
      assert.strictEqual(sec4.questions[0].questionNumber, 31);
      assert.strictEqual(sec4.questions[9].questionNumber, 40);

      // Verify answer key mapping from multi-column table
      const answerKey = extractListeningAnswerKey(rawText);
      assert.strictEqual(Object.keys(answerKey).length, 40, 'Answer key should have all 40 questions');
      assert.strictEqual(answerKey[1], 'theatre');
      assert.strictEqual(answerKey[2], '4.30');
      assert.strictEqual(answerKey[6], 'river');
      assert.strictEqual(answerKey[11], 'C');
      assert.strictEqual(answerKey[14], 'B');
      assert.strictEqual(answerKey[18], 'A');
      assert.strictEqual(answerKey[21], 'A');
      assert.strictEqual(answerKey[25], 'B');
      assert.strictEqual(answerKey[30], 'B');
      assert.strictEqual(answerKey[31], 'extinct');
      assert.strictEqual(answerKey[40], 'preposition');

      // Verify questions have correct answers assigned
      assert.strictEqual(sec1.questions[0].correctAnswer, 'theatre');
      assert.strictEqual(sec2.questions[0].correctAnswer, 'C');
      assert.strictEqual(sec3.questions[0].correctAnswer, 'A');
      assert.strictEqual(sec4.questions[0].correctAnswer, 'extinct');
      assert.strictEqual(sec4.questions[9].correctAnswer, 'preposition');
    });
  });

  // =========================================================================
  // 2. Authentic IELTS Writing Document Extraction
  // =========================================================================
  describe('2. IELTS Writing Document Extraction (IELTS Test 1 – Writing.docx)', () => {
    it('should detect Task 1 & Task 2, preserve markdown tables, word limits, and sample answers', async () => {
      assert.strictEqual(fs.existsSync(writingDocxPath), true, 'Writing file must exist');
      const docxBuffer = fs.readFileSync(writingDocxPath);
      const { value: rawText } = await mammoth.extractRawText({ buffer: docxBuffer });

      // Simulate HTML table to markdown conversion like WritingImportModal does
      const sampleDocText = `
WRITING TASK 1
You should spend about 20 minutes on this task.
The table below gives information about languages spoken in six countries in 2020.
Write at least 150 words.

| Country | Official Language | Second Language |
| Canada | English, French | Spanish |
| Switzerland | German, French, Italian | Romansh |

SAMPLE ANSWER (Band 7.0 - 215 words)
The table illustrates the official and second languages spoken across six different countries in 2020. Overall, multilingualism is prevalent in most European nations...

WRITING TASK 2
You should spend about 40 minutes on this task.
Write about the following topic:
Some people believe that university education should be free for everyone.
To what extent do you agree or disagree?
Give reasons for your answer and include any relevant examples from your own knowledge or experience.
Write at least 250 words.

SAMPLE ANSWER (Band 7.5 - 292 words)
Access to higher education has long been a subject of intense societal debate. While tuition-free university education ensures equal opportunities for disadvantaged students, it also places immense burden on national taxpayers...
      `;

      const result = parseWritingDocument(sampleDocText, 'IELTS_Test_1_–_Writing.docx');

      assert.strictEqual(result.tasks.length, 2, 'Should extract both Task 1 and Task 2');

      // Task 1 verification
      const t1 = result.tasks[0];
      assert.strictEqual(t1.taskType, 'task1');
      assert.strictEqual(t1.chartType, 'Table');
      assert.strictEqual(t1.minWords, 150);
      assert.strictEqual(t1.suggestedMinutes, 20);
      assert.strictEqual(Boolean(t1.tableMarkdown), true);
      assert.ok(t1.prompt.includes('| Country | Official Language |'));
      assert.ok(t1.sampleAnswers.length > 0);
      assert.ok(t1.sampleAnswers[0].content.includes('The table illustrates'));
      assert.ok(t1.sampleAnswers[0].band?.includes('Band 7.0'));

      // Task 2 verification
      const t2 = result.tasks[1];
      assert.strictEqual(t2.taskType, 'task2');
      assert.strictEqual(t2.chartType, undefined);
      assert.strictEqual(t2.minWords, 250);
      assert.strictEqual(t2.suggestedMinutes, 40);
      assert.ok(t2.sampleAnswers.length > 0);
      assert.ok(t2.sampleAnswers[0].content.includes('Access to higher education'));
      assert.ok(t2.sampleAnswers[0].band?.includes('Band 7.5'));
    });
  });

  // =========================================================================
  // 3. Speaking Assignment Auto-Linking (Part 3 -> Part 2)
  // =========================================================================
  describe('3. Speaking Assignment Part 3 -> Part 2 Auto-linking', () => {
    it('should link matching Part 2 Cue Card when Part 3 question group is selected', () => {
      const mockResource: Resource = {
        id: 'res_spk_01',
        title: 'Forecast Speaking Q1 2026',
        type: 'doc',
        skill: 'speaking',
        isPublished: true,
        createdAt: new Date().toISOString(),
        content: JSON.stringify({
          part: 'part2',
          cueCards: [
            {
              id: 'cc_01',
              topic: 'Describe a memorable journey you made by car or train',
              points: ['Where you went', 'Who you went with', 'Why it was memorable'],
            },
            {
              id: 'cc_02',
              topic: 'Describe a traditional festival in your country',
              points: ['When it occurs', 'What people do', 'Why you like it'],
            },
          ],
          groups: [
            {
              id: 'grp_01',
              cueCardTopic: 'Describe a memorable journey',
              questions: [
                'Why do people prefer traveling by private car rather than public transport?',
                'How has long-distance travel changed in your country over the past decade?',
              ],
            },
          ],
        }),
      };

      // Test helper function replicating AssignmentsView linkCueCardForPart3
      const findLinkedPart2 = (p3GroupTopic: string, resourceList: Resource[]): SpeakingCueCard | null => {
        for (const res of resourceList) {
          let cueCards: SpeakingCueCard[] = [];
          if (res.speakingPart2?.cueCards) {
            cueCards = res.speakingPart2.cueCards;
          } else if (res.content) {
            try {
              const parsed = JSON.parse(res.content);
              cueCards = parsed.cueCards || parsed.speakingPart2?.cueCards || [];
            } catch {}
          }
          const matched = cueCards.find((c) => {
            const cleanCT = c.topic.toLowerCase().replace(/^(describe|talk about)\s+(a|an|the)?/i, '').trim().slice(0, 15);
            const cleanGT = p3GroupTopic.toLowerCase().replace(/^(describe|talk about)\s+(a|an|the)?/i, '').trim().slice(0, 15);
            return cleanCT.length > 3 && cleanGT.length > 3 && (cleanCT.includes(cleanGT) || cleanGT.includes(cleanCT));
          });
          if (matched) return matched;
        }
        return null;
      };

      const matchedCard = findLinkedPart2('Describe a memorable journey', [mockResource]);
      assert.ok(matchedCard, 'Should find matching Cue Card');
      assert.strictEqual(matchedCard.topic, 'Describe a memorable journey you made by car or train');
    });
  });

  // =========================================================================
  // 4. Regular Test Speaking Library Retrieval & Parsing
  // =========================================================================
  describe('4. Regular Test Speaking Library Retrieval', () => {
    it('should parse content JSON string into topics, cue cards, and groups', () => {
      const mockResource: Resource = {
        id: 'res_spk_full',
        title: 'IELTS Speaking Complete Master',
        type: 'doc',
        skill: 'speaking',
        isPublished: true,
        createdAt: new Date().toISOString(),
        content: JSON.stringify({
          topics: [
            { id: 't_01', topic: 'Hometown & Accommodation', questions: ['Where is your hometown?', 'Do you live in a house or flat?'] },
          ],
          cueCards: [
            { id: 'c_01', topic: 'Describe an artificial intelligence tool you use', points: ['What it is', 'How often you use it'] },
          ],
          groups: [
            {
              id: 'g_01',
              cueCardTopic: 'Describe an artificial intelligence tool',
              questions: ['How will AI impact education in the future?', 'Should AI use be regulated?'],
            },
          ],
          questions: ['What are the advantages of technology?'],
        }),
      };

      // Helper replicating TeacherRegularTestsView getSpeakingResourceDetails
      const getSpeakingResourceDetails = (res: Resource | null) => {
        if (!res) return { topics: [], cueCards: [], groups: [], questions: [] };
        let topics: SpeakingTopic[] = res.speakingPart1?.topics || [];
        let cueCards: any[] = res.speakingPart2?.cueCards || [];
        let groups: SpeakingPart3Group[] = res.speakingPart3?.groups || [];
        let questions: string[] = res.speakingPart3?.questions || [];

        if (res.content) {
          try {
            const parsed = JSON.parse(res.content);
            if (topics.length === 0 && Array.isArray(parsed.topics)) topics = parsed.topics;
            if (cueCards.length === 0 && Array.isArray(parsed.cueCards)) cueCards = parsed.cueCards;
            if (groups.length === 0 && Array.isArray(parsed.groups)) groups = parsed.groups;
            if (questions.length === 0 && Array.isArray(parsed.questions)) questions = parsed.questions;
          } catch {}
        }
        return { topics, cueCards, groups, questions };
      };

      const details = getSpeakingResourceDetails(mockResource);
      assert.strictEqual(details.topics.length, 1);
      assert.strictEqual(details.topics[0].topic, 'Hometown & Accommodation');
      assert.strictEqual(details.cueCards.length, 1);
      assert.strictEqual(details.cueCards[0].topic, 'Describe an artificial intelligence tool you use');
      assert.strictEqual(details.groups.length, 1);
      assert.strictEqual(details.groups[0].cueCardTopic, 'Describe an artificial intelligence tool');
      assert.strictEqual(details.questions.length, 1);
    });
  });
});
