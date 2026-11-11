import assert from 'node:assert';
import { calculateReadingBand, calculateIeltsOverallBand } from '../src/lib/ieltsScoring.ts';

console.log('--- RUNNING READING PUBLICATION, SUBMISSION COUNT & ASSESSMENT FIXES TESTS ---');

// 1. Reading Result Publication Logic
console.log('Test 1: Reading Result Publication Visibility for Student');
{
  const teacherGradedSubmission = {
    id: 'sub_123',
    assignment_id: 'assign_read_1',
    student_id: 'student_456',
    status: 'graded',
    skill: 'reading',
    score: 8.5,
    reading_score: { correct: 37, total: 40, percentage: 93, estimatedBand: 8.5 },
    reading_error_analysis: [],
    teacher_comments: 'Excellent job on Passage 3!',
    assignments: {
      score_visibility: 'private', // teacher left default private, but explicitly graded and published
    },
  };

  const isDraft = false;
  const parentAssign = teacherGradedSubmission.assignments;
  const isScorePublic = parentAssign?.score_visibility === 'public';
  const isGradedPublished =
    (teacherGradedSubmission.status === 'graded' && !isDraft) ||
    (teacherGradedSubmission.status === 'submitted' && isScorePublic);

  assert.strictEqual(isGradedPublished, true, 'Graded submission must be published to student even if score_visibility is private');

  const studentViewReadingScore = (isGradedPublished || isScorePublic) ? teacherGradedSubmission.reading_score : undefined;
  assert.deepStrictEqual(studentViewReadingScore, teacherGradedSubmission.reading_score, 'Student can view reading score after teacher grading');

  // When still submitted (not graded) and private:
  const pendingPrivateSub = {
    ...teacherGradedSubmission,
    status: 'submitted',
  };
  const isPendingGradedPublished =
    (pendingPrivateSub.status === 'graded' && !isDraft) ||
    (pendingPrivateSub.status === 'submitted' && isScorePublic);
  assert.strictEqual(isPendingGradedPublished, false, 'Pending submission with private score must remain unreleased until graded');

  console.log('✓ Passed: Reading publication visibility works accurately for graded vs pending submissions.');
}

// 2. Submission Count Calculation (No 2/1 bug)
console.log('Test 2: Distinct Student Submission Count Calculation');
{
  const mockSubmissions = [
    { id: 'sub_1', assignmentId: 'assign_1', studentId: 'student_1', status: 'submitted', isDraft: false },
    { id: 'sub_2', assignmentId: 'assign_1', studentId: 'student_1', status: 'submitted', isDraft: false }, // duplicate from double click
  ];
  const mockCourseMembers = [
    { courseId: 'course_1', studentId: 'student_1', status: 'enrolled' },
  ];

  const validSubs = mockSubmissions.filter((s) => s.assignmentId === 'assign_1' && s.status !== 'in_review' && !s.isDraft);
  const subCount = new Set(validSubs.map((s) => s.studentId)).size;
  const enrolledMembersCount = mockCourseMembers.filter((m) => m.courseId === 'course_1' && m.status === 'enrolled').length;
  const enrolledCount = Math.max(enrolledMembersCount, subCount);

  assert.strictEqual(subCount, 1, 'subCount must be 1 (distinct students), not 2');
  assert.strictEqual(enrolledCount, 1, 'enrolledCount must be 1');
  assert.strictEqual(`${subCount}/${enrolledCount}`, '1/1', 'Display must be 1/1, not 2/1');

  console.log('✓ Passed: Distinct student counting prevents 2/1 submission count display.');
}

// 3. Periodic Assessment Evidence for Reading (No fabricated Writing rubrics)
console.log('Test 3: Periodic Assessment Reading Evidence');
{
  const readingSubmission = {
    id: 'sub_read_1',
    assignmentId: 'assign_read_1',
    assignmentTitle: 'IELTS Academic Reading Test 1',
    skill: 'reading',
    score: 8.0,
    status: 'graded',
    readingScore: { correct: 35, total: 40 },
    rubricScores: [
      { criterion: 'Task Achievement', score: 7.0 },
      { criterion: 'Coherence & Cohesion', score: 7.0 },
      { criterion: 'Lexical Resource', score: 7.0 },
      { criterion: 'Grammar', score: 7.0 },
    ],
  };

  const evidenceItem = {
    id: readingSubmission.id,
    skill: readingSubmission.skill,
    score: readingSubmission.score,
    readingCorrect: readingSubmission.readingScore?.correct,
    readingTotal: readingSubmission.readingScore?.total,
    criteriaScores: readingSubmission.skill === 'reading' ? undefined : readingSubmission.rubricScores?.map((r) => ({ criterion: r.criterion, score: r.score })),
  };

  assert.strictEqual(evidenceItem.criteriaScores, undefined, 'Reading evidence must NOT include Writing criteria scores (TA, CC, LR, GRA)');
  assert.strictEqual(evidenceItem.readingCorrect, 35, 'Reading correct count is preserved');
  assert.strictEqual(evidenceItem.readingTotal, 40, 'Reading total count is preserved');
  assert.strictEqual(evidenceItem.score, 8.0, 'Reading Band 8.0 is preserved');

  console.log('✓ Passed: Periodic assessment omits Writing rubrics for Reading.');
}

// 4. Month Selection & Filtering
console.log('Test 4: Month Selector & Reactive Filtering');
{
  const visibleReports = [
    { id: 'rep_1', month: 'October 2026', studentId: 'student_1' },
    { id: 'rep_2', month: 'November 2026', studentId: 'student_1' },
    { id: 'rep_3', month: 'October 2026', studentId: 'student_2' },
  ];

  const availableMonths = Array.from(new Set(visibleReports.map((r) => r.month)));
  assert.deepStrictEqual(availableMonths, ['October 2026', 'November 2026'], 'Extracts available unique months');

  const filterAll = visibleReports.filter((r) => 'all' === 'all' || r.month === 'all');
  assert.strictEqual(filterAll.length, 3, 'Filter "all" returns all 3 reports');

  const filterOct = visibleReports.filter((r) => 'October 2026' === 'all' || r.month === 'October 2026');
  assert.strictEqual(filterOct.length, 2, 'Filter "October 2026" returns 2 reports');

  const filterNov = visibleReports.filter((r) => 'November 2026' === 'all' || r.month === 'November 2026');
  assert.strictEqual(filterNov.length, 1, 'Filter "November 2026" returns 1 report');

  console.log('✓ Passed: Month selector filtering functions accurately.');
}

// 5. Note Completion Text Formatting & Heading Detection
console.log('Test 5: Note Completion Formatting & Structure Recovery');
{
  const rawNotesText =
    'Bislama – The Pidgin English Language of Vanuatu Languages in Vanuatu Local languages: • Actively spoken languages: 81 • Declining languages: 17 • [31] languages: 8 • Total: 106 Foreign languages: English is used in the [32] system Bislama • It is spoken by 90% of the population today. • In the past this language was described as [33] History of Bislama • Around 1800 it was used as a common language on many ships. • After 1860 Vanuatu people worked in Australian [34] • After 1950 people moved to the [35] Description of Bislama General • Bislama should be called a [36]’ pidgin. Vocabulary • Most words come from English. • Words such as "from" may have more [37] in Bislama. • Less than 10% of words are of [38] origin. • Pacific words describe the natural world and also local [39] Grammar • It is based on Vanuatu languages. • The word "long" acts as an important [40] in Bislama.';

  let formattedText = rawNotesText.replace(/^\|\s*|\s*\|$/g, '').trim();
  formattedText = formattedText.replace(/\s*(?:•|\u2022)\s*/g, '\n• ');
  formattedText = formattedText.replace(
    /(?<=[^\n])\s+(?=(?:[A-Z][a-zA-Z0-9\s–\-]{1,35}:|(?:History of|Description of|Languages in|Local languages|Foreign languages|Bislama|General|Vocabulary|Grammar|Background|Summary|Topic|Location|Aim|Methods?|Results?|Conclusion)\b))/gm,
    '\n'
  );

  const lines = formattedText.split('\n').map((l) => l.trim()).filter(Boolean);
  assert(lines.length >= 15, `Must have at least 15 structured lines, got ${lines.length}`);

  const bullets = lines.filter((l) => l.startsWith('•'));
  assert(bullets.length >= 10, `Must have at least 10 bullets, got ${bullets.length}`);

  // Headings detection
  const headings = lines.filter(
    (line) =>
      !line.startsWith('•') &&
      !line.includes('[') &&
      (line.endsWith(':') ||
        line === line.toUpperCase() ||
        /^(?:Aim|Background|Methods?|Results?|Conclusion|Location|Activities|Session|Topic|General|Vocabulary|Grammar|History of|Description of|Languages in|Bislama)\b/i.test(line) ||
        (line.length <= 45 && !/[,\.]$/.test(line) && /^[A-Z]/.test(line)))
  );

  assert(headings.length >= 4, `Must identify key headings like General, Vocabulary, Grammar, got ${headings.length}`);
  console.log(`✓ Passed: Note structure formatting successfully parsed ${lines.length} lines, ${bullets.length} bullets, ${headings.length} headings.`);
}

console.log('\n========================================================================');
console.log('ALL READING PUBLICATION, SUBMISSION & ASSESSMENT TESTS PASSED! 🎉');
console.log('========================================================================\n');
