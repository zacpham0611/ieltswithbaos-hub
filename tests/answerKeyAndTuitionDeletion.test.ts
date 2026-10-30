import assert from 'node:assert';
import { parseAnswerText, parseDocumentStructure } from '../src/lib/documentExtractor.ts';

console.log('--- RUNNING ANSWER KEY RECOGNITION & TUITION DELETION TESTS ---');

// 1. Answer Key parsing: Multi-item single lines
const multiItemLine = '1. FALSE 2. TRUE 3. NOT GIVEN 4. TRUE';
const parsedMulti = parseAnswerText(multiItemLine);
assert.equal(parsedMulti['1']?.answer, 'FALSE');
assert.equal(parsedMulti['2']?.answer, 'TRUE');
assert.equal(parsedMulti['3']?.answer, 'NOT GIVEN');
assert.equal(parsedMulti['4']?.answer, 'TRUE');
console.log('✓ Passed: Multi-item single line answer keys parsed accurately.');

// 2. Answer Key parsing: Roman Numerals for Matching Headings & MCQs
const headingsAndMCQ = '1: iv  2: vii  3: ii  4: vi 5: A 6: C';
const parsedHeadings = parseAnswerText(headingsAndMCQ);
assert.equal(parsedHeadings['1']?.answer, 'iv');
assert.equal(parsedHeadings['2']?.answer, 'vii');
assert.equal(parsedHeadings['3']?.answer, 'ii');
assert.equal(parsedHeadings['4']?.answer, 'vi');
assert.equal(parsedHeadings['5']?.answer, 'A');
assert.equal(parsedHeadings['6']?.answer, 'C');
console.log('✓ Passed: Roman numerals and MCQ letters extracted correctly.');

// 3. Answer Key parsing: Words/Phrases with slashes and inline citations
const phraseAndCitation = `1. FALSE (Paragraph 2: "...never proved...")
2. TRUE - see section B line 4
3. NOT GIVEN
4. solar radiation / solar energy [Para C]`;
const parsedPhrases = parseAnswerText(phraseAndCitation);
assert.equal(parsedPhrases['1']?.answer, 'FALSE');
assert.equal(parsedPhrases['1']?.citation, 'Paragraph 2: "...never proved..."');
assert.equal(parsedPhrases['2']?.answer, 'TRUE');
assert.equal(parsedPhrases['2']?.citation, 'see section B line 4');
assert.equal(parsedPhrases['3']?.answer, 'NOT GIVEN');
assert.equal(parsedPhrases['4']?.answer, 'solar radiation / solar energy');
assert.equal(parsedPhrases['4']?.citation, 'Para C');
console.log('✓ Passed: Phrases with slashes and citations in brackets/dashes cleanly extracted.');

// 4. Full document parsing: Passage with Global Answer Key
const fullDoc = `READING PASSAGE 1: Renewable Energy
Paragraph A
Solar energy is one of the most promising renewable resources available today.

Paragraph B
Recent advancements in photovoltaic technology have significantly reduced installation costs.

Questions 1-3
Do the following statements agree with the information given in Reading Passage 1?
In boxes 1-3 on your answer sheet, write:
TRUE if the statement agrees with the information
FALSE if the statement contradicts the information
NOT GIVEN if there is no information on this

1. Solar energy is completely cost-free to harness.
2. Advancements in photovoltaics have lowered the price of installation.
3. Wind power is more efficient than solar power in coastal areas.

Questions 4-5
Choose the correct letter, A, B, C or D.
4. According to Paragraph B, recent tech improvements have:
A. Increased production costs
B. Reduced installation costs
C. Replaced all fossil fuels
D. Delayed grid integration

ANSWER KEY & CITATIONS
1. FALSE (Paragraph A: costs exist)
2. TRUE (Paragraph B: reduced installation costs)
3. NOT GIVEN
4. B (Paragraph B)`;

const parsedDoc = parseDocumentStructure(fullDoc, 'Test Document.pdf');
assert.equal(parsedDoc.questions.length >= 4, true);
assert.equal(parsedDoc.detectedAnswerKey['1'], 'FALSE');
assert.equal(parsedDoc.detectedAnswerKey['2'], 'TRUE');
assert.equal(parsedDoc.detectedAnswerKey['3'], 'NOT GIVEN');
assert.equal(parsedDoc.detectedAnswerKey['4'], 'B');
assert.equal(parsedDoc.questions[0].correctAnswer, 'FALSE');
assert.equal(parsedDoc.questions[0].source, 'answer_key_extracted');
assert.equal(parsedDoc.questions[0].answerKeyConfidence, 'high');
assert.equal(parsedDoc.questions[1].correctAnswer, 'TRUE');
assert.equal(parsedDoc.questions[3].correctAnswer, 'B');
console.log('✓ Passed: End-of-document Answer Key mapped to questions without contaminating passage text.');

// 5. Answer-key-only document handling
const answerKeyOnlyDoc = `READING ANSWER KEY
1. FALSE
2. TRUE
3. NOT GIVEN
4. A
5. solar radiation (Para 3)`;
const parsedKeyOnly = parseDocumentStructure(answerKeyOnlyDoc, 'Cam 18 Answers.txt');
assert.equal(parsedKeyOnly.hasExistingQuestions, true);
assert.equal(parsedKeyOnly.questions.length, 5);
assert.equal(parsedKeyOnly.questions[0].correctAnswer, 'FALSE');
assert.equal(parsedKeyOnly.questions[4].correctAnswer, 'solar radiation');
assert.equal(parsedKeyOnly.questions[4].citation, 'Para 3');
console.log('✓ Passed: Answer-key-only documents cleanly parsed into questions with keys.');

// 6. Embedded answers in question text
const embeddedAnswerDoc = `READING PASSAGE 1: Study Skills
Questions 1-2
1. The survey took place in 2020. [FALSE]
2. Most students prefer online study. (Answer: TRUE)`;
const parsedEmbedded = parseDocumentStructure(embeddedAnswerDoc, 'Embedded.txt');
assert.equal(parsedEmbedded.questions[0].correctAnswer, 'FALSE');
assert.equal(parsedEmbedded.questions[0].source, 'source_extracted');
assert.equal(parsedEmbedded.questions[1].correctAnswer, 'TRUE');
assert.equal(parsedEmbedded.questions[1].source, 'source_extracted');
console.log('✓ Passed: Embedded answers extracted and stripped from question prompts.');

console.log('ALL ANSWER KEY & TUITION TESTS PASSED! 🎉');
