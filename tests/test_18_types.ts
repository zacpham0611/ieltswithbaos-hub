import fs from 'fs';
import { parseDocumentStructure } from '../src/lib/documentExtractor';

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

console.log('\n--- All Question IDs ---');
console.log(doc.questions.map(q => `${q.id} (${q.type})`).join(', '));
