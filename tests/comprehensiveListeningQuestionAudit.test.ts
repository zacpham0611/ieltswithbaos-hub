import assert from 'node:assert';
import {
  parseListeningDocument,
  htmlToListeningText,
  convertHtmlTablesToMarkdown,
  cleanListeningText,
  extractListeningAnswerKey,
} from '../src/lib/listeningExtractor.ts';
import { gradeListeningSubmission } from '../src/lib/assignmentGrader.ts';
import { evaluateRegularTestAttempt } from '../src/lib/regularTestManager.ts';
import type { ListeningTestContent, RegularTest, RegularTestAttempt } from '../src/types/index.ts';

console.log('=== COMPREHENSIVE LISTENING 11 QUESTION-TYPES AUDIT & TEST SUITE ===');

// =========================================================================
// 1. FORM COMPLETION
// =========================================================================
console.log('Testing 1. Form Completion (PDF/Raw Text & DOCX HTML)...');
const formDocText = `
SECTION 1
Questions 1-5
Complete the form below.
Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.

Car Rental Booking Form
Customer Name: 1. ______
Pickup Location: 2. ______
Rental Duration: 3. ______ days
Vehicle Type: 4. ______
Insurance Package: 5. ______
`;

const formParsed = parseListeningDocument(formDocText, 'Form Test');
assert.strictEqual(formParsed.parts.length, 1);
const formGroup = formParsed.parts[0].questionGroups[0];
assert.strictEqual(formGroup.type, 'form_completion');
assert.strictEqual(formGroup.questions.length, 5);
assert.strictEqual(formGroup.questions[0].questionNumber, 1);
assert.strictEqual(formGroup.questions[4].questionNumber, 5);
console.log('✓ Form Completion extracted correctly.');

// =========================================================================
// 2. NOTE COMPLETION
// =========================================================================
console.log('Testing 2. Note Completion (Bulleted blanks with tags and trailing units)...');
const noteDocText = `
SECTION 4
Questions 31-35
Complete the notes below.
Write NO MORE THAN TWO WORDS for each answer.

Climate Change Research
- The main contributor to emissions is ______ (Q31).
- Average temperature increase recorded: ______ degrees (Q32).
- Coastal erosion monitored by ______ (Q33).
- Additional data contributed by 34. ______
- Funding provided by the 35. ______
`;

const noteParsed = parseListeningDocument(noteDocText, 'Note Test');
const noteGroup = noteParsed.parts[0].questionGroups[0];
assert.strictEqual(noteGroup.type, 'note_completion');
assert.strictEqual(noteGroup.questions.length, 5);
assert.strictEqual(noteGroup.questions[0].questionNumber, 31);
assert.strictEqual(noteGroup.questions[4].questionNumber, 35);
assert.ok(noteGroup.groupText?.includes('[31]'));
assert.ok(noteGroup.groupText?.includes('[32] degrees'));
console.log('✓ Note Completion embedded fields and bullets extracted correctly.');

// =========================================================================
// 3. TABLE COMPLETION
// =========================================================================
console.log('Testing 3. Table Completion (Markdown table & DOCX HTML table)...');
const tableHtml = `
<p>SECTION 1</p>
<p>Questions 6-10</p>
<p>Complete the table below.</p>
<table>
  <tr><th>Destination</th><th>Departure</th><th>Fare</th></tr>
  <tr><td>Airport Express</td><td>Every 15 mins</td><td>6. $______</td></tr>
  <tr><td>Metro Line</td><td>7. Every ______ mins</td><td>$5</td></tr>
  <tr><td>City Shuttle</td><td>Hourly</td><td>8. $______</td></tr>
  <tr><td>Harbor Ferry</td><td>9. ______ a.m.</td><td>$12</td></tr>
  <tr><td>Night Coach</td><td>Midnight</td><td>10. $______</td></tr>
</table>
`;

const tableParsed = parseListeningDocument('', 'Table Test', tableHtml);
const tableGroup = tableParsed.parts[0].questionGroups[0];
assert.strictEqual(tableGroup.type, 'table_completion');
assert.strictEqual(tableGroup.questions.length, 5);
assert.strictEqual(tableGroup.questions[0].questionNumber, 6);
assert.strictEqual(tableGroup.questions[4].questionNumber, 10);
assert.ok(tableGroup.groupText?.includes('|'));
console.log('✓ Table Completion HTML to Markdown parsed correctly.');

// =========================================================================
// 4. SENTENCE COMPLETION
// =========================================================================
console.log('Testing 4. Sentence Completion...');
const sentenceDocText = `
SECTION 4
Questions 36-40
Complete the sentences below.
Write NO MORE THAN ONE WORD for each answer.

36. The project was initiated in the year ______ .
37. Researchers collected over five hundred ______ .
38. The primary habitat of the species is ______ forests.
39. Changes in climate caused a decrease in ______ supply.
40. The team received international recognition for their ______ .
`;

const sentenceParsed = parseListeningDocument(sentenceDocText, 'Sentence Test');
const sentenceGroup = sentenceParsed.parts[0].questionGroups[0];
assert.strictEqual(sentenceGroup.type, 'sentence_completion');
assert.strictEqual(sentenceGroup.questions.length, 5);
assert.strictEqual(sentenceGroup.questions[0].questionNumber, 36);
assert.strictEqual(sentenceGroup.questions[4].questionNumber, 40);
console.log('✓ Sentence Completion parsed correctly.');

// =========================================================================
// 5. SUMMARY COMPLETION
// =========================================================================
console.log('Testing 5. Summary Completion...');
const summaryDocText = `
SECTION 3
Questions 26-30
Complete the summary below.
Write NO MORE THAN TWO WORDS for each answer.

Educational Psychology Study
The study investigated the impact of peer feedback on university students. Early findings showed that 26. ______ played a crucial role in student engagement. Most participants indicated that feedback received from 27. ______ was more actionable than formal instructor marks. Furthermore, regular 28. ______ sessions improved overall task completion rates. The authors concluded that implementing 29. ______ learning environments creates significant long-term academic benefits, especially in 30. ______ disciplines.
`;

const summaryParsed = parseListeningDocument(summaryDocText, 'Summary Test');
const summaryGroup = summaryParsed.parts[0].questionGroups[0];
assert.strictEqual(summaryGroup.type, 'summary_completion');
assert.strictEqual(summaryGroup.questions.length, 5);
assert.strictEqual(summaryGroup.questions[0].questionNumber, 26);
assert.strictEqual(summaryGroup.questions[4].questionNumber, 30);
console.log('✓ Summary Completion parsed correctly.');

// =========================================================================
// 6. FLOWCHART COMPLETION
// =========================================================================
console.log('Testing 6. Flowchart Completion...');
const flowchartDocText = `
SECTION 2
Questions 16-20
Complete the flow-chart below.
Write NO MORE THAN TWO WORDS for each answer.

Recycling Process
Stage 1: Collection of waste materials
↓
Stage 2: Sorting at the 16. ______ facility
↓
Stage 3: Cleaning with pressurized 17. ______
↓
Stage 4: Crushing into small 18. ______
↓
Stage 5: Melting at high 19. ______
↓
Stage 6: Moulding into new 20. ______
`;

const flowchartParsed = parseListeningDocument(flowchartDocText, 'Flowchart Test');
const flowchartGroup = flowchartParsed.parts[0].questionGroups[0];
assert.strictEqual(flowchartGroup.type, 'flowchart_completion');
assert.strictEqual(flowchartGroup.questions.length, 5);
assert.strictEqual(flowchartGroup.questions[0].questionNumber, 16);
assert.strictEqual(flowchartGroup.questions[4].questionNumber, 20);
console.log('✓ Flowchart Completion parsed correctly.');

// =========================================================================
// 7. MULTIPLE CHOICE (Single Answer with multi-line prompt)
// =========================================================================
console.log('Testing 7. Multiple Choice with multi-line prompt support...');
const mcDocText = `
SECTION 2
Questions 11-13
Choose the correct letter, A, B or C.

11. What is the primary purpose of the newly constructed
community wellness facility?
A To offer specialized sports training
B To provide low-cost healthcare consultations
C To encourage social interaction among local residents

12. Who is eligible for the discounted membership fee?
A Senior citizens and university students
B Full-time healthcare workers
C Local business owners

13. The outdoor tennis courts are open until
A 8:00 p.m.
B 9:30 p.m.
C 11:00 p.m.
`;

const mcParsed = parseListeningDocument(mcDocText, 'MC Test');
const mcGroup = mcParsed.parts[0].questionGroups[0];
assert.strictEqual(mcGroup.type, 'multiple_choice');
assert.strictEqual(mcGroup.questions.length, 3);
assert.strictEqual(mcGroup.questions[0].questionNumber, 11);
assert.ok(mcGroup.questions[0].prompt.includes('newly constructed community wellness facility'));
assert.strictEqual(mcGroup.questions[0].options?.length, 3);
console.log('✓ Multiple Choice parsed with preserved multi-line prompt and options.');

// =========================================================================
// 8. MULTIPLE SELECT (Choose TWO/THREE)
// =========================================================================
console.log('Testing 8. Multiple Select (Alternative phrasings & options A-G)...');
const msDocText = `
SECTION 3
Questions 21 and 22
Choose TWO letters, A-E.
Which TWO factors contributed most to the project success?
A Thorough preliminary research
B Effective communication among team members
C Generous sponsorship funding
D High-grade lab equipment
E Expert guidance from the supervisor
`;

const msParsed = parseListeningDocument(msDocText, 'MS Test');
const msGroup = msParsed.parts[0].questionGroups[0];
assert.strictEqual(msGroup.type, 'multiple_select');
assert.strictEqual(msGroup.questions.length, 2);
assert.strictEqual(msGroup.questions[0].questionNumber, 21);
assert.strictEqual(msGroup.questions[1].questionNumber, 22);
assert.strictEqual(msGroup.questions[0].options?.length, 5);
console.log('✓ Multiple Select parsed correctly.');

// =========================================================================
// 9. MATCHING (Options exceeding G, up to H, I, J)
// =========================================================================
console.log('Testing 9. Matching with Options Box A through H...');
const matchingDocText = `
SECTION 3
Questions 23-28
What opinion do the speakers have about each presentation topic?
Choose SIX answers from the box and write the correct letter, A-H, next to Questions 23-28.

A Highly original approach
B Too theoretical
C Exceeded the time limit
D Well supported by visual aids
E Needs deeper methodology
F Excellent delivery
G Weak conclusions
H Good engagement with the audience

23. Artificial Intelligence in Agriculture
24. Renewable Energy Grids
25. Deep Sea Exploration Robotics
26. Urban Vertical Farming
27. Quantum Computing Algorithms
28. Bio-degradable Packaging
`;

const matchingParsed = parseListeningDocument(matchingDocText, 'Matching Test');
const matchingGroup = matchingParsed.parts[0].questionGroups[0];
assert.strictEqual(matchingGroup.type, 'matching');
assert.strictEqual(matchingGroup.questions.length, 6);
assert.strictEqual(matchingGroup.questions[0].questionNumber, 23);
assert.strictEqual(matchingGroup.questions[5].questionNumber, 28);
assert.ok(matchingGroup.options && matchingGroup.options.length === 8, `Expected 8 options A-H, got ${matchingGroup.options?.length}`);
assert.ok(matchingGroup.options?.some((o) => o.startsWith('H.')), 'Option H must be extracted');
assert.ok(matchingGroup.questions[0].options?.some((o) => o.startsWith('H.')), 'Question options must inherit H');
console.log('✓ Matching with 8 options (A-H) parsed correctly.');

// =========================================================================
// 10. PLAN / MAP / DIAGRAM LABELLING
// =========================================================================
console.log('Testing 10. Plan / Map / Diagram Labelling with Options Box...');
const mapDocText = `
SECTION 2
Questions 14-18
Label the map below.
Write the correct letter, A-H, next to Questions 14-18.

A Information Desk
B Souvenir Gift Shop
C Public Restrooms
D Modern Art Exhibition
E Coffee Bar
F Audio-visual Theatre
G Research Archives
H Sculpture Courtyard

14. Main Entrance Hall
15. Western Wing
16. Central Rotunda
17. Upper Mezzanine
18. Garden Terrace
`;

const mapParsed = parseListeningDocument(mapDocText, 'Map Test');
const mapGroup = mapParsed.parts[0].questionGroups[0];
assert.strictEqual(mapGroup.type, 'plan_map_diagram_labelling');
assert.strictEqual(mapGroup.questions.length, 5);
assert.strictEqual(mapGroup.questions[0].questionNumber, 14);
assert.strictEqual(mapGroup.questions[4].questionNumber, 18);
assert.ok(mapGroup.options && mapGroup.options.length === 8);
assert.ok(mapGroup.questions[0].options && mapGroup.questions[0].options.length === 8);
console.log('✓ Plan/Map/Diagram Labelling with options A-H parsed correctly.');

// =========================================================================
// 11. SHORT ANSWER
// =========================================================================
console.log('Testing 11. Short Answer Questions...');
const saDocText = `
SECTION 2
Questions 11-13
Answer the questions below.
Write NO MORE THAN THREE WORDS AND/OR A NUMBER for each answer.

11. What is the maximum group size for the guided tour?
12. How much does an individual ticket cost?
13. Where should visitors leave their heavy luggage?
`;

const saParsed = parseListeningDocument(saDocText, 'Short Answer Test');
const saGroup = saParsed.parts[0].questionGroups[0];
assert.strictEqual(saGroup.type, 'short_answer');
assert.strictEqual(saGroup.questions.length, 3);
assert.strictEqual(saGroup.questions[0].questionNumber, 11);
assert.strictEqual(saGroup.questions[0].type, 'short_answer');
console.log('✓ Short Answer questions recognized and parsed correctly.');

// =========================================================================
// 12. FULL 4-SECTION TEST WITH DIVERSE QUESTION TYPES & ANSWER KEY
// =========================================================================
console.log('Testing Full 4-Section IELTS Listening Test with 40 Questions & Answer Key...');
const fullTestDoc = `
SECTION 1
Questions 1-10
Complete the notes below.
Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.
1. Customer phone: ______
2. Date of move: ______
3. Moving to: ______
4. Items to transport: ______
5. Special handling for: ______
6. Delivery address: ______
7. Floor number: ______
8. Access gate code: ______
9. Payment method: ______
10. Estimated cost: £______

SECTION 2
Questions 11-15
Choose the correct letter, A, B or C.
11. The local museum was founded by
A a wealthy merchant
B the city council
C a community group
12. The newest exhibition focuses on
A maritime trade
B agricultural tools
C textile manufacturing
13. Guided tours start at
A 10:00 a.m.
B 11:30 a.m.
C 2:00 p.m.
14. Free admission is offered on
A Mondays
B Wednesdays
C First Sunday of each month
15. Photography is permitted in
A all permanent galleries
B the outdoor courtyard only
C nowhere in the museum

Questions 16-20
Label the plan below.
Write the correct letter, A-E, next to Questions 16-20.
A Gift Shop
B Cafe
C Cloakroom
D Lecture Hall
E Workshop
16. North entrance
17. East corridor
18. Central atrium
19. West pavilion
20. South gallery

SECTION 3
Questions 21-25
Choose the correct letter, A, B or C.
21. What did students find most challenging?
A Data collection
B Statistical analysis
C Writing the literature review
22. How did they solve the scheduling conflict?
A Meeting online
B Working weekends
C Re-allocating responsibilities
23. The tutor recommended revising
A the hypothesis
B the sample size
C the conclusion
24. Equipment was booked through
A university portal
B departmental secretary
C lab technician
25. Final submission date is set for
A May 15
B May 22
C June 1

Questions 26-30
What action was taken for each stage?
Choose FIVE answers from the box and write the correct letter, A-F, next to Questions 26-30.
A Consulted supervisor
B Re-tested samples
C Replaced components
D Conducted survey
E Published findings
F Archived raw data
26. Stage 1
27. Stage 2
28. Stage 3
29. Stage 4
30. Stage 5

SECTION 4
Questions 31-40
Complete the notes below.
Write NO MORE THAN TWO WORDS for each answer.
Marine Biology Lecture
31. The organism thrives in ______ waters.
32. Its primary defence mechanism is ______ .
33. Average lifespan estimated at ______ years.
34. Population monitored through ______ tags.
35. Greatest threat comes from ______ pollution.
36. Reproduction takes place during the ______ season.
37. Juvenile specimens feed on ______ .
38. Migration patterns affected by water ______ .
39. Conservation status listed as ______ .
40. Further research funded by the ______ institute.

ANSWER KEY
1. 07700900123
2. 14 June
3. Bristol
4. furniture
5. piano
6. 12 High Street
7. third
8. 4821
9. credit card
10. 450
11. A
12. C
13. B
14. C
15. B
16. A
17. C
18. B
19. D
20. E
21. B
22. A
23. B
24. C
25. B
26. D
27. A
28. B
29. C
30. F
31. shallow
32. camouflage
33. 15
34. acoustic
35. plastic
36. spring
37. plankton
38. temperature
39. vulnerable
40. oceanographic
`;

const fullParsed = parseListeningDocument(fullTestDoc, 'Full IELTS Test 1');
assert.strictEqual(fullParsed.parts.length, 4, 'Should have exactly 4 sections');
assert.strictEqual(fullParsed.parts[0].questions.length, 10, 'Part 1 should have 10 questions');
assert.strictEqual(fullParsed.parts[1].questions.length, 10, 'Part 2 should have 10 questions');
assert.strictEqual(fullParsed.parts[2].questions.length, 10, 'Part 3 should have 10 questions');
assert.strictEqual(fullParsed.parts[3].questions.length, 10, 'Part 4 should have 10 questions');

// Verify Answer Key was mapped to every single question 1-40
for (let partIdx = 0; partIdx < 4; partIdx++) {
  const p = fullParsed.parts[partIdx];
  for (const q of p.questions) {
    assert.ok(q.correctAnswer, `Question ${q.questionNumber} must have correct answer assigned from answer key`);
  }
}

// Verify Question 1 and Question 40 answers
assert.strictEqual(fullParsed.parts[0].questions[0].correctAnswer, '07700900123');
assert.strictEqual(fullParsed.parts[3].questions[9].correctAnswer, 'oceanographic');
console.log('✓ Full 40-question IELTS Listening Test with Answer Key validated.');

// =========================================================================
// 13. GRADING INTEGRITY (gradeListeningSubmission)
// =========================================================================
console.log('Testing Grading Integrity across extracted questions...');
const sampleQuestions = [
  fullParsed.parts[0].questions[0], // Q1: '07700900123'
  fullParsed.parts[1].questions[0], // Q11: 'A'
  fullParsed.parts[1].questions[5], // Q16: 'A' (Map Labelling)
  fullParsed.parts[2].questions[5], // Q26: 'D' (Matching)
  fullParsed.parts[3].questions[0], // Q31: 'shallow'
];

const mockAnswers: Record<string, string> = {
  [sampleQuestions[0].id]: '07700900123',
  [sampleQuestions[1].id]: 'a', // lowercase check
  [sampleQuestions[2].id]: 'A',
  [sampleQuestions[3].id]: 'd',
  [sampleQuestions[4].id]: 'shallow',
};

const gradeSummary = gradeListeningSubmission(sampleQuestions, mockAnswers);
assert.strictEqual(gradeSummary.earnedScore, 5, 'All 5 questions should be marked correct');
assert.strictEqual(gradeSummary.correctCount, 5);
assert.strictEqual(gradeSummary.incorrectCount, 0);
console.log('✓ Grading engine accurately graded multiple-choice, matching, labelling, and completion.');

// =========================================================================
// 14. REGULAR TEST EVALUATION PIPELINE
// =========================================================================
console.log('Testing Regular Test persistence & auto-grading pipeline...');
const mockRegularTest: RegularTest = {
  id: 'reg_test_1',
  title: 'Mock Regular Test with Listening',
  description: 'Regular test',
  durationMinutes: 40,
  passingScore: 6.0,
  skills: ['listening'],
  status: 'published',
  timingMode: 'total',
  strictPreset: 'off',
  strictSettings: {
    enforceFullscreen: false,
    trackTabSwitch: false,
    maxTabSwitches: 5,
    preventCopyPaste: false,
    blockDevTools: false,
    webcamMonitoring: false,
  },
  sections: [
    {
      id: 'sec_1',
      skill: 'listening',
      title: 'Listening Section',
      durationMinutes: 30,
      listeningParts: fullParsed.parts,
      listeningQuestions: fullParsed.parts.flatMap((p) => p.questions),
    },
  ],
  createdAt: new Date().toISOString(),
  createdBy: 'teacher_1',
};

const mockAttempt: RegularTestAttempt = {
  id: 'att_1',
  testId: 'reg_test_1',
  studentId: 'student_1',
  courseId: 'course_1',
  status: 'submitted',
  attemptNumber: 1,
  answers: {
    listening: {
      [fullParsed.parts[0].questions[0].id]: '07700900123',
      [fullParsed.parts[1].questions[0].id]: 'A',
      [fullParsed.parts[3].questions[9].id]: 'oceanographic',
    },
  },
  startedAt: new Date().toISOString(),
  submittedAt: new Date().toISOString(),
};

const evalResult = evaluateRegularTestAttempt(mockAttempt, mockRegularTest);
assert.ok(evalResult.scores.listening, 'Listening score must be evaluated');
assert.strictEqual(evalResult.scores.listening?.raw, 3, 'Should score 3 correct points');
assert.strictEqual(evalResult.scores.listening?.max, 40, 'Max score should be 40');
console.log('✓ Regular Test auto-grades listening pipeline with full score summary.');

console.log('\n=== ALL 14 AUDIT AND REGRESSION TESTS PASSED CLEANLY! ===');
