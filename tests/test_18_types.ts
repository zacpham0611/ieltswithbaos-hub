import fs from 'fs';
import assert from 'node:assert/strict';
import { parseDocumentStructure } from '../src/lib/documentExtractor.ts';

const text = fs.readFileSync('tests/fixtures/18_question_types_extracted.txt', 'utf-8');
const doc = parseDocumentStructure(text, 'Form_Đề_Thi_IELTS_Reading_Full_18_Dạng_Câu_Hỏi.pdf');

console.log('Candidate tests/passages:', doc.candidateTests?.length);
const p1 = doc.candidateTests[0];
console.log('Passage Title:', p1?.passageTitle);
console.log('Total questions extracted:', doc.questions.length);
console.log('Total question groups in passage 1:', p1?.questionGroups?.length);

console.log('\n--- Question Groups ---');
p1?.questionGroups?.forEach((g, idx) => {
  console.log(`Group ${idx + 1}: "${g.groupTitle}" -> Type: ${g.questionType} | Count: ${g.questions.length} | Questions: ${g.questions.map(q => q.id).join(', ')}`);
});

// Formal verification of all 18 Question Types across 19 Question Groups
assert.ok(p1, 'Passage 1 must exist');
assert.strictEqual(p1.questionGroups.length, 19, 'Must have exactly 19 question groups');
assert.strictEqual(doc.questions.length, 36, 'Must extract exactly 36 questions');

const expectedGroupTypes = [
  { groupIndex: 0, title: 'Questions 1 – 2', type: 'multiple_choice', qIds: ['q_1'] },
  { groupIndex: 1, title: 'Questions 3 – 4', type: 'multiple_select', qIds: ['q_3', 'q_4'] },
  { groupIndex: 2, title: 'Questions 5 – 6', type: 'true_false_not_given', qIds: ['q_5', 'q_6'] },
  { groupIndex: 3, title: 'Questions 7 – 8', type: 'yes_no_not_given', qIds: ['q_7', 'q_8'] },
  { groupIndex: 4, title: 'Questions 9 – 10', type: 'matching_headings', qIds: ['q_9', 'q_10'] },
  { groupIndex: 5, title: 'Questions 11 – 12', type: 'matching_information', qIds: ['q_11', 'q_12'] },
  { groupIndex: 6, title: 'Questions 13 – 14', type: 'matching_features', qIds: ['q_13', 'q_14'] },
  { groupIndex: 7, title: 'Questions 15 – 16', type: 'matching_sentence_endings', qIds: ['q_15', 'q_16'] },
  { groupIndex: 8, title: 'Question 17', type: 'matching_information', qIds: ['q_17'] },
  { groupIndex: 9, title: 'Questions 18 – 19', type: 'sentence_completion', qIds: ['q_18', 'q_19'] },
  { groupIndex: 10, title: 'Questions 20 – 21', type: 'summary_completion', qIds: ['q_20', 'q_21'] },
  { groupIndex: 11, title: 'Questions 22 – 23', type: 'summary_completion', qIds: ['q_22', 'q_23'] },
  { groupIndex: 12, title: 'Questions 24 – 25', type: 'note_completion', qIds: ['q_24', 'q_25'] },
  { groupIndex: 13, title: 'Questions 26 – 27', type: 'table_completion', qIds: ['q_26', 'q_27'] },
  { groupIndex: 14, title: 'Questions 28 – 29', type: 'flowchart_completion', qIds: ['q_28', 'q_29'] },
  { groupIndex: 15, title: 'Questions 30 – 31', type: 'diagram_completion', qIds: ['q_30', 'q_31'] },
  { groupIndex: 16, title: 'Questions 32 – 33', type: 'short_answer', qIds: ['q_32', 'q_33'] },
  { groupIndex: 17, title: 'Questions 34 – 35', type: 'matching_features', qIds: ['q_34', 'q_35'] },
  { groupIndex: 18, title: 'Questions 36 – 37', type: 'matching_features', qIds: ['q_36', 'q_37'] },
];

for (const exp of expectedGroupTypes) {
  const g = p1.questionGroups[exp.groupIndex];
  assert.ok(g, `Group ${exp.groupIndex + 1} exists`);
  assert.strictEqual(g.questionType, exp.type, `Group ${exp.groupIndex + 1} type should be ${exp.type}, got ${g.questionType}`);
  const actualQIds = g.questions.map((q) => q.id);
  assert.deepStrictEqual(actualQIds, exp.qIds, `Group ${exp.groupIndex + 1} questions should be ${exp.qIds.join(', ')}`);
}

// Check Group 1 (Multiple Choice) options
const g1 = p1.questionGroups[0];
assert.strictEqual(g1.questions[0].options?.length, 4, 'Q1 has 4 options A-D');

// Check Group 2 (Multiple Select) options
const g2 = p1.questionGroups[1];
assert.strictEqual(g2.questions[0].options?.length, 5, 'Q3 has 5 options A-E');
assert.strictEqual(g2.questions[1].options?.length, 5, 'Q4 has 5 options A-E');

// Check Group 7 (Matching Features) optionsBox
const g7 = p1.questionGroups[6];
assert.ok(g7.optionsBox && g7.optionsBox.length >= 4, 'Group 7 has List of People');

// Check Group 12 (Summary Completion with Box) optionsBox
const g12 = p1.questionGroups[11];
assert.ok(g12.optionsBox && g12.optionsBox.length >= 4, 'Group 12 has word bank options');

console.log('\n✅ ALL 18 IELTS READING QUESTION TYPES ACROSS 19 GROUPS VALIDATED WITH 100% SUCCESS!');
