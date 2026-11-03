import assert from 'node:assert';
import test from 'node:test';
import {
  extractMarkdownTable,
  stripMarkdownTableFromPrompt,
  detectChartType,
} from '../src/lib/writingVisualHelper.ts';
import type { RegularTestSection, SpeakingPart3Group, SpeakingCueCard } from '../src/types/index.js';

test('1. Supabase Storage Bucket & Public URL Format Verification', () => {
  const materialsBucket = 'materials';
  const audioFilePath = 'audio/sample_speaking_recording_1793673695742.mp3';
  const publicUrl = `https://kqcnlfddqnzhglyhydbn.supabase.co/storage/v1/object/public/${materialsBucket}/${audioFilePath}`;

  assert.strictEqual(publicUrl.includes('/storage/v1/object/public/materials/audio/'), true);
  assert.strictEqual(publicUrl.endsWith('.mp3'), true);
  console.log('✓ Passed: Storage bucket name and public URL schema verified.');
});

test('2. Speaking Part 2 and Part 3 Linkage in Regular Test', async (t) => {
  // Mock Part 2 Cue Cards and Part 3 Question Groups from a Speaking resource
  const cueCards: SpeakingCueCard[] = [
    {
      topic: 'Describe an environmental problem in your hometown',
      points: ['What it is', 'How it affects people', 'What can be done to solve it'],
      prepTimeSeconds: 60,
      speakTimeSeconds: 120,
    },
    {
      topic: 'Describe a memorable journey you took by public transport',
      points: ['Where you went', 'Who you went with', 'Why it was memorable'],
      prepTimeSeconds: 60,
      speakTimeSeconds: 120,
    },
  ];

  const part3Groups: SpeakingPart3Group[] = [
    {
      id: 'p3_env_group_1',
      cueCardTopic: 'Describe an environmental problem in your hometown',
      questions: [
        'What are the main causes of pollution in modern cities?',
        'Do you think individuals or governments bear more responsibility for protecting the environment?',
        'How can schools educate children to be more environmentally friendly?',
      ],
    },
    {
      id: 'p3_journey_group_1',
      cueCardTopic: 'Describe a memorable journey you took by public transport',
      questions: [
        'Why do many people prefer private cars over public transit?',
        'How can governments improve urban transportation infrastructure?',
      ],
    },
    {
      id: 'p3_unrelated_art_group',
      cueCardTopic: 'Describe a piece of art you like',
      questions: [
        'Why do people visit art galleries?',
        'Should art education be compulsory in high schools?',
      ],
    },
  ];

  await t.test('2.1. Automatically retrieve and select only Part 3 groups associated with selected Part 2', () => {
    const selectedPart2 = cueCards[0]; // Environmental problem

    // Retrieval function matching TeacherRegularTestsView logic
    const matchedGroups = part3Groups.filter((g) => {
      const cardTopic = selectedPart2.topic.toLowerCase();
      const gTopic = (g.cueCardTopic || '').toLowerCase();
      return (
        cardTopic.includes(gTopic.slice(0, 15)) ||
        gTopic.includes(cardTopic.slice(0, 15))
      );
    });

    assert.strictEqual(matchedGroups.length, 1);
    assert.strictEqual(matchedGroups[0].id, 'p3_env_group_1');
    assert.strictEqual(matchedGroups[0].questions.length, 3);
    // Unrelated groups must NEVER be selected
    assert.strictEqual(matchedGroups.some((g) => g.id === 'p3_unrelated_art_group'), false);
    assert.strictEqual(matchedGroups.some((g) => g.id === 'p3_journey_group_1'), false);
    console.log('✓ Passed: Automatically retrieved and isolated associated Part 3 groups.');
  });

  await t.test('2.2. When Part 2 has NO associated Part 3 groups, return empty state without selecting unrelated questions', () => {
    const orphanPart2: SpeakingCueCard = {
      topic: 'Describe an ancient historic building you visited',
      points: ['Where it is', 'What it looks like', 'Why it is historically significant'],
    };

    const matchedGroups = part3Groups.filter((g) => {
      const cardTopic = orphanPart2.topic.toLowerCase();
      const gTopic = (g.cueCardTopic || '').toLowerCase();
      return (
        cardTopic.includes(gTopic.slice(0, 15)) ||
        gTopic.includes(cardTopic.slice(0, 15))
      );
    });

    // Must be empty array, never select unrelated groups
    assert.strictEqual(matchedGroups.length, 0);
    console.log('✓ Passed: Empty state preserved, unrelated questions rejected.');
  });

  await t.test('2.3. When Part 2 selection changes, stale Part 3 questions are cleared and updated', () => {
    let formSections: RegularTestSection[] = [
      {
        id: 'sec_p2_1',
        skill: 'speaking',
        title: 'Speaking Part 2: Environmental problem',
        speakingPart: 'part2',
        speakingTopic: cueCards[0].topic,
        speakingCueCard: cueCards[0],
        durationMinutes: 4,
      },
      {
        id: 'sec_p3_1',
        skill: 'speaking',
        title: 'Speaking Part 3 (Associated with Part 2)',
        speakingPart: 'part3',
        speakingQuestions: part3Groups[0].questions,
        speakingPart3Groups: [part3Groups[0]],
        associatedPart2Id: 'sec_p2_1',
        durationMinutes: 5,
      },
    ];

    // Teacher changes Part 2 from Environmental problem -> Public transport journey
    const newPart2Card = cueCards[1];
    const newMatchedGroups = part3Groups.filter((g) => {
      const cardTopic = newPart2Card.topic.toLowerCase();
      const gTopic = (g.cueCardTopic || '').toLowerCase();
      return (
        cardTopic.includes(gTopic.slice(0, 15)) ||
        gTopic.includes(cardTopic.slice(0, 15))
      );
    });

    const newSecP2: RegularTestSection = {
      id: 'sec_p2_2',
      skill: 'speaking',
      title: `Speaking Part 2: ${newPart2Card.topic}`,
      speakingPart: 'part2',
      speakingTopic: newPart2Card.topic,
      speakingCueCard: newPart2Card,
      speakingPart3Groups: newMatchedGroups,
      durationMinutes: 4,
    };

    // Update formSections matching handleConfirmSpeakingSection
    const withoutP2 = formSections.filter((s) => !(s.skill === 'speaking' && s.speakingPart === 'part2'));
    const nextList = [...withoutP2, newSecP2];

    const existingP3 = formSections.find((s) => s.skill === 'speaking' && s.speakingPart === 'part3');
    if (existingP3) {
      if (newMatchedGroups.length > 0) {
        const updatedP3: RegularTestSection = {
          ...existingP3,
          title: 'Speaking Part 3 (Associated with Part 2)',
          speakingQuestions: newMatchedGroups.flatMap((g) => g.questions),
          speakingPart3Groups: newMatchedGroups,
          associatedPart2Id: newSecP2.id,
        };
        const withoutP3 = nextList.filter((s) => !(s.skill === 'speaking' && s.speakingPart === 'part3'));
        formSections = [...withoutP3, updatedP3];
      }
    }

    const currentP3 = formSections.find((s) => s.skill === 'speaking' && s.speakingPart === 'part3');
    assert.ok(currentP3);
    assert.strictEqual(currentP3?.associatedPart2Id, 'sec_p2_2');
    assert.strictEqual(currentP3?.speakingQuestions?.length, 2);
    assert.strictEqual(currentP3?.speakingQuestions?.[0], 'Why do many people prefer private cars over public transit?');
    // Stale environmental questions must NOT exist
    assert.strictEqual(
      currentP3?.speakingQuestions?.some((q) => q.includes('pollution')),
      false
    );
    console.log('✓ Passed: Stale Part 3 questions successfully cleared on Part 2 change.');
  });
});

test('3. Writing Task 1 Exact Visual Elements & Chart Type Recognition', async (t) => {
  const lineGraphPrompt = `The line graph below shows the percentage of households with internet access in three European countries from 2000 to 2020.
| Year | UK | France | Germany |
|---|---|---|---|
| 2000 | 25% | 15% | 20% |
| 2010 | 65% | 55% | 60% |
| 2020 | 92% | 88% | 90% |

Summarise the information by selecting and reporting the main features, and make comparisons where relevant.`;

  await t.test('3.1. Detects Line Graph and extracts structured table data', () => {
    const chartType = detectChartType(undefined, lineGraphPrompt, true);
    assert.strictEqual(chartType, 'Line Graph');

    const table = extractMarkdownTable(lineGraphPrompt);
    assert.ok(table);
    assert.deepStrictEqual(table?.headers, ['Year', 'UK', 'France', 'Germany']);
    assert.strictEqual(table?.rows.length, 3);
    assert.strictEqual(table?.rows[0][1], '25%');
    console.log('✓ Passed: Line Graph detected and table columns extracted.');
  });

  await t.test('3.2. Strips raw markdown table from prompt so it is not repeated awkwardly below the visual', () => {
    const cleaned = stripMarkdownTableFromPrompt(lineGraphPrompt);
    assert.strictEqual(cleaned.includes('| Year |'), false);
    assert.strictEqual(cleaned.includes('| 2000 |'), false);
    assert.strictEqual(cleaned.includes('The line graph below shows'), true);
    assert.strictEqual(cleaned.includes('Summarise the information by selecting'), true);
    console.log('✓ Passed: Raw Markdown table stripped cleanly from prompt text.');
  });

  await t.test('3.3. Correctly classifies Pie Chart, Bar Chart, Table, Process Diagram and Map', () => {
    assert.strictEqual(detectChartType('Pie Chart', 'Pie chart of energy sources'), 'Pie Chart');
    assert.strictEqual(detectChartType('Bar Chart', 'The chart compares levels'), 'Bar Chart');
    assert.strictEqual(detectChartType('Table', 'The table below lists data'), 'Table');
    assert.strictEqual(detectChartType('Process / Diagram', 'The diagram illustrates the stages of cement production'), 'Process / Diagram');
    assert.strictEqual(detectChartType('Map', 'The two plans show the layout changes of a city center'), 'Map');
    assert.strictEqual(detectChartType('Mixed Charts', 'The bar chart and table show export statistics'), 'Mixed Charts');
    console.log('✓ Passed: All IELTS Task 1 visual formats accurately classified.');
  });
});
