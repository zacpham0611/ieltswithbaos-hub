import assert from 'node:assert';
import { isAiTransientError, formatAiErrorMessage } from '../src/lib/aiResilience.ts';
import { parseAiLessonPlan } from '../src/lib/lessonPlanParser.ts';

console.log('--- RUNNING AI RESILIENCE, LESSON PLANNER & OVERLAY TESTS ---');

// -----------------------------------------------------------------------------
// Test Group 1: AI Provider Resilience & Transient Error Detection
// -----------------------------------------------------------------------------
console.log('Test 1: HTTP 503 UNAVAILABLE & Model High Demand Detection');
const error503 = new Error(
  'AI provider error (HTTP 503 UNAVAILABLE): This model is currently experiencing high demand. Please try again later.'
);
assert.strictEqual(isAiTransientError(error503), true);
assert.strictEqual(isAiTransientError('HTTP 503 UNAVAILABLE'), true);
assert.strictEqual(isAiTransientError('Máy chủ AI hiện đang quá tải'), true);

const vietnamese503 = formatAiErrorMessage(error503);
assert.ok(vietnamese503.includes('503'));
assert.ok(vietnamese503.includes('lượng truy cập cao'));
assert.ok(vietnamese503.includes('Thử lại'));
console.log('✓ Passed: HTTP 503 and high demand correctly classified and formatted into polite Vietnamese.');

console.log('Test 2: HTTP 429 & Rate Limit Detection');
const error429 = new Error('HTTP 429: Resource has been exhausted (quota exceeded).');
assert.strictEqual(isAiTransientError(error429), true);
assert.strictEqual(isAiTransientError('RATE_LIMITED 429'), true);
const vietnamese429 = formatAiErrorMessage(error429);
assert.ok(vietnamese429.includes('hạn ngạch'));
console.log('✓ Passed: HTTP 429 rate limit correctly detected and formatted.');

console.log('Test 3: Timeouts & 504 Gateway Detection');
const error504 = new Error('AI request timed out after 45000ms (HTTP 504)');
assert.strictEqual(isAiTransientError(error504), true);
const vietnamese504 = formatAiErrorMessage(error504);
assert.ok(vietnamese504.includes('kết nối') || vietnamese504.includes('phản hồi'));
console.log('✓ Passed: Timeout errors correctly detected and formatted.');

console.log('Test 4: Non-transient client authentication and schema errors');
const authErr = new Error('Invalid authentication token or secret key');
assert.strictEqual(isAiTransientError(authErr), false);
const badPromptErr = new Error('Message cannot be empty or invalid schema');
assert.strictEqual(isAiTransientError(badPromptErr), false);
console.log('✓ Passed: Auth and schema errors correctly distinguished from transient infrastructure errors.');

// -----------------------------------------------------------------------------
// Test Group 2: AI Lesson Plan Markdown Decomposition
// -----------------------------------------------------------------------------
console.log('Test 5: Structured Gemini Markdown Lesson Plan Parsing');
const markdown = `# [AI ASSISTANT DRAFT — Teacher Review Required]
## IELTS Lesson Plan: Advanced Cohesion in Academic Writing Task 2 (Writing)
- **Target Band Progression:** Band 6.0 → Band 7.5
- **Duration:** 60 minutes
- **Primary Learning Objectives:** 
• Master 5 advanced cohesive devices without mechanical repetition.
• Eliminate comma splices and run-on sentences in body paragraphs.

### 1. Preparation & Materials Needed
Handout: 10 authentic Cambridge 18 band 8.0 essay samples; Whiteboard markers.

### 2. Detailed Timed Stages
- Warm-up (10m): Diagnostic error analysis of common Band 6.0 transitions.
- Guided Input (20m): Collocation mapping and sentence transition analysis.
- Controlled Drill (15m): Step-by-step thesis crafting and paragraph structuring.
- Free Production (15m): Independent sprint writing.

### 3. Concrete Classroom Drills & Activities
Drill 1: Reverse outline matching.
Drill 2: Peer error spotting sprint.

### 4. Formative Assessment Wrap-up & Homework Assignment
Homework: Complete full 250-word Task 2 essay and submit via student portal before Sunday 10 PM.`;

const parsed = parseAiLessonPlan(markdown, 'writing', 'Academic Writing Task 2');
assert.strictEqual(parsed.title, 'Advanced Cohesion in Academic Writing Task 2');
assert.strictEqual(parsed.skill, 'writing');
assert.ok(parsed.objectives.includes('Master 5 advanced cohesive devices'));
assert.ok(parsed.activities.includes('Warm-up (10m)'));
assert.ok(parsed.teacherNotes.includes('Handout: 10 authentic Cambridge 18'));
assert.ok(parsed.homework.includes('Complete full 250-word Task 2 essay'));
console.log('✓ Passed: Structured Gemini markdown cleanly decomposed into lesson form fields.');

console.log('Test 6: Fallback and Empty draft parsing');
const textDraft = `Title: Speaking Part 2 Fluent Storytelling Drill
Objectives: Enhance narrative fluency and discourse markers.
Activities: 1. Topic card deconstruction. 2. 1-minute prep simulation. 3. Paired recording.
Teacher Notes: Remind students not to pause longer than 3 seconds.
Homework: Record 2-minute response to 'A memorable journey' on portal.`;

const fallbackParsed = parseAiLessonPlan(textDraft, 'speaking', 'Speaking Part 2');
assert.strictEqual(fallbackParsed.title, 'Speaking Part 2 Fluent Storytelling Drill');
assert.strictEqual(fallbackParsed.objectives, 'Enhance narrative fluency and discourse markers.');
assert.ok(fallbackParsed.activities.includes('1. Topic card deconstruction'));
assert.ok(fallbackParsed.teacherNotes.includes('Remind students not to pause'));
assert.ok(fallbackParsed.homework.includes('Record 2-minute response'));

const emptyParsed = parseAiLessonPlan('', 'reading', 'Speed Skimming Drill');
assert.strictEqual(emptyParsed.title, 'Lesson: Speed Skimming Drill');
assert.strictEqual(emptyParsed.skill, 'reading');
assert.strictEqual(emptyParsed.activities, '');
console.log('✓ Passed: Fallback draft and empty inputs handled safely with sensible defaults.');

console.log('\n--- ALL AI RESILIENCE, LESSON PLANNER & OVERLAY TESTS PASSED (6/6) --- 🎉');
