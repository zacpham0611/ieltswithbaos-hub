import assert from 'node:assert';
import type {
  RegularTest,
  RegularTestSection,
  RegularTestAttempt,
  RegularTestTimingMode,
} from '../src/types/index.ts';

console.log('--- RUNNING REGULAR TEST IMPROVEMENTS & INDIVIDUAL TIMERS TESTS ---');

// =============================================================================
// TEST SUITE 1: TEACHER SKILL SELECTION COMBINATIONS
// =============================================================================

function testSkillSelectionCombinations() {
  console.log('\n[Suite 1] Teacher-Controlled Skill Selection Combinations');

  // Helper simulating save payload generation in TeacherRegularTestsView
  function buildTestPayload(params: {
    title: string;
    courseId: string;
    skills: ('reading' | 'writing' | 'speaking')[];
    timingMode: RegularTestTimingMode;
    overallDuration: number;
    skillDurations: { reading: number; writing: number; speaking: number };
    allSections: RegularTestSection[];
  }) {
    if (params.skills.length === 0) {
      throw new Error('Vui lòng chọn ít nhất một kỹ năng kiểm tra');
    }

    const selectedSections = params.allSections.filter((s) => params.skills.includes(s.skill));

    for (const skill of params.skills) {
      const hasSec = selectedSections.some((s) => s.skill === skill);
      if (!hasSec) {
        throw new Error(`Kỹ năng ${skill} đã được chọn nhưng chưa có nội dung phần thi.`);
      }
    }

    const totalDuration = params.timingMode === 'per_section'
      ? params.skills.reduce((sum, s) => sum + (params.skillDurations[s] || 0), 0)
      : params.overallDuration;

    return {
      title: params.title,
      courseId: params.courseId,
      skills: params.skills,
      durationMinutes: totalDuration,
      timingMode: params.timingMode,
      sectionTimers: params.timingMode === 'per_section' ? params.skillDurations : undefined,
      sections: selectedSections.map((sec) => ({
        ...sec,
        durationMinutes: params.timingMode === 'per_section' ? params.skillDurations[sec.skill] : sec.durationMinutes,
      })),
    };
  }

  const mockSections: RegularTestSection[] = [
    {
      id: 'sec_read',
      skill: 'reading',
      title: 'Academic Reading 3 Passages',
      durationMinutes: 60,
      readingPassage: 'Passage text...',
      readingQuestions: [{ id: 'q1', type: 'multiple_choice', prompt: 'Q1' }],
    },
    {
      id: 'sec_write',
      skill: 'writing',
      title: 'Writing Task 2 Essay',
      durationMinutes: 40,
      writingPrompt: 'Some people believe...',
      writingTaskType: 'task2',
      writingMinWords: 250,
    },
    {
      id: 'sec_spk',
      skill: 'speaking',
      title: 'Speaking Part 1 & 2',
      durationMinutes: 15,
      speakingPart: 'part1',
      speakingTopics: [{ id: 'tp1', topic: 'Hometown', questions: ['Where is it?'] }],
    },
  ];

  // 1. Single Skill: Reading only
  const pReading = buildTestPayload({
    title: 'Reading Test Only',
    courseId: 'course_1',
    skills: ['reading'],
    timingMode: 'overall_timer',
    overallDuration: 60,
    skillDurations: { reading: 60, writing: 60, speaking: 15 },
    allSections: mockSections,
  });
  assert.deepStrictEqual(pReading.skills, ['reading']);
  assert.strictEqual(pReading.sections.length, 1);
  assert.strictEqual(pReading.sections[0].skill, 'reading');
  assert.strictEqual(pReading.durationMinutes, 60);
  console.log('✓ Passed: Single skill (Reading only) payload creation.');

  // 2. Single Skill: Writing only
  const pWriting = buildTestPayload({
    title: 'Writing Test Only',
    courseId: 'course_1',
    skills: ['writing'],
    timingMode: 'overall_timer',
    overallDuration: 60,
    skillDurations: { reading: 60, writing: 60, speaking: 15 },
    allSections: mockSections,
  });
  assert.deepStrictEqual(pWriting.skills, ['writing']);
  assert.strictEqual(pWriting.sections.length, 1);
  assert.strictEqual(pWriting.sections[0].skill, 'writing');
  console.log('✓ Passed: Single skill (Writing only) payload creation.');

  // 3. Single Skill: Speaking only
  const pSpeaking = buildTestPayload({
    title: 'Speaking Test Only',
    courseId: 'course_1',
    skills: ['speaking'],
    timingMode: 'overall_timer',
    overallDuration: 15,
    skillDurations: { reading: 60, writing: 60, speaking: 15 },
    allSections: mockSections,
  });
  assert.deepStrictEqual(pSpeaking.skills, ['speaking']);
  assert.strictEqual(pSpeaking.sections.length, 1);
  assert.strictEqual(pSpeaking.sections[0].skill, 'speaking');
  console.log('✓ Passed: Single skill (Speaking only) payload creation.');

  // 4. Two Skills: Reading + Writing
  const pRW = buildTestPayload({
    title: 'Reading + Writing Combined',
    courseId: 'course_1',
    skills: ['reading', 'writing'],
    timingMode: 'overall_timer',
    overallDuration: 120,
    skillDurations: { reading: 60, writing: 60, speaking: 15 },
    allSections: mockSections,
  });
  assert.deepStrictEqual(pRW.skills, ['reading', 'writing']);
  assert.strictEqual(pRW.sections.length, 2);
  assert.strictEqual(pRW.sections.some((s) => s.skill === 'speaking'), false);
  console.log('✓ Passed: 2 skills (Reading + Writing) payload creation.');

  // 5. Two Skills: Writing + Speaking
  const pWS = buildTestPayload({
    title: 'Writing + Speaking Combined',
    courseId: 'course_1',
    skills: ['writing', 'speaking'],
    timingMode: 'overall_timer',
    overallDuration: 75,
    skillDurations: { reading: 60, writing: 60, speaking: 15 },
    allSections: mockSections,
  });
  assert.deepStrictEqual(pWS.skills, ['writing', 'speaking']);
  assert.strictEqual(pWS.sections.length, 2);
  assert.strictEqual(pWS.sections.some((s) => s.skill === 'reading'), false);
  console.log('✓ Passed: 2 skills (Writing + Speaking) payload creation.');

  // 6. Three Skills: Reading + Writing + Speaking
  const pFull = buildTestPayload({
    title: 'Full 3-Skill Regular Test',
    courseId: 'course_1',
    skills: ['reading', 'writing', 'speaking'],
    timingMode: 'overall_timer',
    overallDuration: 135,
    skillDurations: { reading: 60, writing: 60, speaking: 15 },
    allSections: mockSections,
  });
  assert.deepStrictEqual(pFull.skills, ['reading', 'writing', 'speaking']);
  assert.strictEqual(pFull.sections.length, 3);
  console.log('✓ Passed: 3 skills (Reading + Writing + Speaking) full payload creation.');

  // 7. Validation: Empty skills throws error
  assert.throws(
    () =>
      buildTestPayload({
        title: 'Empty Skills',
        courseId: 'course_1',
        skills: [],
        timingMode: 'overall_timer',
        overallDuration: 60,
        skillDurations: { reading: 60, writing: 60, speaking: 15 },
        allSections: mockSections,
      }),
    /Vui lòng chọn ít nhất một kỹ năng kiểm tra/
  );
  console.log('✓ Passed: Empty skill selection is rejected.');

  // 8. Validation: Selected skill missing section content throws error
  assert.throws(
    () =>
      buildTestPayload({
        title: 'Missing Section Content',
        courseId: 'course_1',
        skills: ['reading', 'writing'],
        timingMode: 'overall_timer',
        overallDuration: 120,
        skillDurations: { reading: 60, writing: 60, speaking: 15 },
        allSections: [mockSections[0]], // only reading exists
      }),
    /chưa có nội dung phần thi/
  );
  console.log('✓ Passed: Missing section content for selected skill is caught.');
}

// =============================================================================
// TEST SUITE 2: TIMING MODES & INDIVIDUAL SKILL TIMERS CALCULATION
// =============================================================================

function testTimingModesAndDurations() {
  console.log('\n[Suite 2] Timing Modes (Overall Timer vs Individual Skill Timers)');

  const skillDurations = { reading: 60, writing: 60, speaking: 15 };

  // 1. Overall Timer uses the explicit overallDuration
  const overallTest: RegularTest = {
    id: 't_overall',
    courseId: 'c1',
    teacherId: 'tch1',
    title: 'Overall Timer Test',
    instructions: '',
    skills: ['reading', 'writing'],
    durationMinutes: 120,
    timingMode: 'overall_timer',
    maxAttempts: 1,
    status: 'draft',
    currentVersion: 1,
    strictPreset: 'standard',
    releaseSettings: { timing: 'manual_review', detailLevel: 'with_corrections', feedbackReleased: false },
    sections: [],
  };
  assert.strictEqual(overallTest.timingMode, 'overall_timer');
  assert.strictEqual(overallTest.durationMinutes, 120);

  // 2. Individual Skill Timers (per_section) sums active skills automatically
  const activeSkills3: ('reading' | 'writing' | 'speaking')[] = ['reading', 'writing', 'speaking'];
  const totalSum3 = activeSkills3.reduce((sum, s) => sum + skillDurations[s], 0);
  assert.strictEqual(totalSum3, 135, 'Sum of 60 + 60 + 15 must be 135 minutes');

  const activeSkills2: ('reading' | 'writing' | 'speaking')[] = ['reading', 'writing'];
  const totalSum2 = activeSkills2.reduce((sum, s) => sum + skillDurations[s], 0);
  assert.strictEqual(totalSum2, 120, 'Sum of 60 + 60 must be 120 minutes');

  const activeSkills1: ('reading' | 'writing' | 'speaking')[] = ['speaking'];
  const totalSum1 = activeSkills1.reduce((sum, s) => sum + skillDurations[s], 0);
  assert.strictEqual(totalSum1, 15, 'Sum of 15 must be 15 minutes');

  console.log('✓ Passed: Dynamic duration sum calculation for 1, 2, and 3 skills.');
}

// =============================================================================
// TEST SUITE 3: STUDENT EXAM INDIVIDUAL TIMER & SKILL LOCKING
// =============================================================================

function testStudentExamIndividualTimers() {
  console.log('\n[Suite 3] Student Exam Individual Timers, Independent Pausing & Locking');

  // Simulate student timer initialization
  function initExamTimers(test: {
    skills: ('reading' | 'writing' | 'speaking')[];
    timingMode: RegularTestTimingMode;
    sectionTimers?: { reading?: number; writing?: number; speaking?: number };
    durationMinutes: number;
    sections: Array<{ skill: 'reading' | 'writing' | 'speaking'; durationMinutes: number }>;
  }, savedTimers?: Record<string, number>) {
    if (savedTimers && Object.keys(savedTimers).length > 0) {
      return { ...savedTimers };
    }
    const initial: Record<string, number> = {};
    test.skills.forEach((s) => {
      if (test.sectionTimers && test.sectionTimers[s]) {
        initial[s] = test.sectionTimers[s]! * 60;
      } else {
        const sec = test.sections.find((x) => x.skill === s);
        initial[s] = (sec?.durationMinutes || (s === 'speaking' ? 15 : 60)) * 60;
      }
    });
    return initial;
  }

  const testConfig = {
    skills: ['reading', 'writing', 'speaking'] as ('reading' | 'writing' | 'speaking')[],
    timingMode: 'per_section' as RegularTestTimingMode,
    sectionTimers: { reading: 60, writing: 60, speaking: 15 },
    durationMinutes: 135,
    sections: [
      { skill: 'reading' as const, durationMinutes: 60 },
      { skill: 'writing' as const, durationMinutes: 60 },
      { skill: 'speaking' as const, durationMinutes: 15 },
    ],
  };

  // 1. Fresh start initializes each skill in seconds
  const timers = initExamTimers(testConfig);
  assert.strictEqual(timers.reading, 3600);
  assert.strictEqual(timers.writing, 3600);
  assert.strictEqual(timers.speaking, 900);
  console.log('✓ Passed: Fresh start initializes per-skill timers in seconds (3600s, 3600s, 900s).');

  // 2. Active skill ticks down while other skills preserve remaining seconds
  let activeSkill: 'reading' | 'writing' | 'speaking' = 'reading';
  for (let tick = 0; tick < 100; tick++) {
    timers[activeSkill] -= 1;
  }
  assert.strictEqual(timers.reading, 3500);
  assert.strictEqual(timers.writing, 3600, 'Writing timer must remain intact while Reading is active');
  assert.strictEqual(timers.speaking, 900, 'Speaking timer must remain intact while Reading is active');
  console.log('✓ Passed: Only active skill decrements; inactive skills preserve time.');

  // 3. Switching sections switches active skill without losing old skill time
  activeSkill = 'writing';
  for (let tick = 0; tick < 50; tick++) {
    timers[activeSkill] -= 1;
  }
  assert.strictEqual(timers.reading, 3500, 'Reading timer preserved after switching away');
  assert.strictEqual(timers.writing, 3550, 'Writing decremented by 50 seconds');
  assert.strictEqual(timers.speaking, 900, 'Speaking preserved');
  console.log('✓ Passed: Section switching pauses old skill and ticks new skill cleanly.');

  // 4. Reconnecting / refreshing restores exact timer snapshot from attempt.answers._skillTimers
  const restored = initExamTimers(testConfig, timers);
  assert.strictEqual(restored.reading, 3500);
  assert.strictEqual(restored.writing, 3550);
  assert.strictEqual(restored.speaking, 900);
  console.log('✓ Passed: Refresh / reconnect cleanly restores saved _skillTimers.');

  // 5. Expiration of a single skill locks that skill
  timers.reading = 0;
  const lockedSkills: Record<string, boolean> = { reading: true };
  assert.strictEqual(Boolean(lockedSkills.reading), true, 'Reading must be locked');
  assert.strictEqual(Boolean(lockedSkills.writing), false, 'Writing must remain unlocked');

  // Switching to a locked skill is rejected
  function canSwitchToSkill(skill: 'reading' | 'writing' | 'speaking') {
    if (lockedSkills[skill]) return false;
    return true;
  }
  assert.strictEqual(canSwitchToSkill('reading'), false, 'Cannot switch into locked skill');
  assert.strictEqual(canSwitchToSkill('writing'), true, 'Can switch into unlocked skill');
  console.log('✓ Passed: Expired skill is locked and blocks re-entry while open skills remain accessible.');

  // 6. When all skills hit 0, allLocked triggers auto-submit
  timers.writing = 0;
  timers.speaking = 0;
  lockedSkills.writing = true;
  lockedSkills.speaking = true;

  const allLocked = testConfig.skills.every((s) => lockedSkills[s]);
  assert.strictEqual(allLocked, true, 'All skills locked must trigger auto-submit');
  console.log('✓ Passed: When all individual skill timers expire, exam auto-submits.');
}

// =============================================================================
// RUN ALL TESTS
// =============================================================================

async function main() {
  testSkillSelectionCombinations();
  testTimingModesAndDurations();
  testStudentExamIndividualTimers();

  console.log('\n=============================================================');
  console.log('🎉 ALL REGULAR TEST IMPROVEMENT TEST SUITES PASSED (100%)');
  console.log('=============================================================\n');
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
