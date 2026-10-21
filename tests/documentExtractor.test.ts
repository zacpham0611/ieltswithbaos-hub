import assert from 'node:assert';
import { parseDocumentStructure } from '../src/lib/documentExtractor.ts';

console.log('--- RUNNING DOCUMENT EXTRACTOR MULTI-TEST TESTS ---');

const multiTestDocument = `
READING PASSAGE 1: The Australian Megafauna
Long ago, giant marsupials roamed the Australian interior.
These giant beasts survived for thousands of years until human arrival.

Questions 1-3
Do the following statements agree with the information?
1. Giant marsupials lived in Australia.
TRUE
2. Climate change was the sole cause of extinction.
FALSE
3. Megafauna are still alive today.
NOT GIVEN

READING PASSAGE 2: The History of Tea
Tea was discovered in ancient China when leaves fell into boiling water.
It soon became a ceremonial drink.

Questions 4-6
Choose the correct letter, A, B, or C.
4. Who discovered tea?
A. Emperor Shennong
B. A peasant farmer
C. A visiting monk

5. What was tea initially used for?
A. Trade
B. Medicine
C. Ceremony

Questions 7-8
Write NO MORE THAN TWO WORDS.
7. Where did tea cultivation spread next?
8. What ingredient was added in England?

Answer Key:
1. TRUE
2. FALSE
3. NOT GIVEN
4. A
5. C
7. Japan
8. milk
`;

const parsed = parseDocumentStructure(multiTestDocument, 'ielts_cambridge_mock.txt');

// 1. Verify candidate tests separation
assert.strictEqual(parsed.candidateTests.length, 2, 'Should detect exactly 2 candidate passages');
console.log('✓ Passed: Multi-test document identified 2 separate candidate tests.');

const test1 = parsed.candidateTests[0];
assert.strictEqual(test1.title, 'The Australian Megafauna');
assert.strictEqual(test1.questions.length, 3);
assert.strictEqual(test1.questions[0].type, 'true_false_not_given');
assert.strictEqual(test1.questions[0].correctAnswer, 'TRUE');
console.log('✓ Passed: Passage 1 questions and T/F/NG types recognized.');

const test2 = parsed.candidateTests[1];
assert.strictEqual(test2.title, 'The History of Tea');
assert.strictEqual(test2.questions.length, 4); // Questions 4, 5, 7, 8
assert.strictEqual(test2.questions[0].type, 'multiple_choice');
assert.strictEqual(test2.questions[0].options?.length, 3);
assert.strictEqual(test2.questions[0].correctAnswer, 'A');

// Word limit check on question 7
const q7 = test2.questions[2];
assert.strictEqual(q7.maxWords, 2);
assert.strictEqual(q7.wordLimit, 'NO MORE THAN TWO WORDS');
assert.strictEqual(q7.correctAnswer, 'Japan');
console.log('✓ Passed: Passage 2 MCQ, word limits, and answer keys correctly mapped.');

console.log('ALL DOCUMENT EXTRACTOR TESTS PASSED! 🎉');
