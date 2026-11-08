import fs from 'fs';
import { parseListeningDocument } from '../src/lib/listeningExtractor.ts';

const text = fs.readFileSync('tests/fixtures/listening_6_core_groups_benchmark.txt', 'utf-8');
const doc = parseListeningDocument(text, 'IELTS Listening 6 Core Groups Benchmark');

console.log('Parts count:', doc.parts.length);
doc.parts.forEach((p, pIdx) => {
  console.log(`\n=== Part ${p.partNumber} (${p.title}) ===`);
  console.log('Question groups:', p.questionGroups.length);
  p.questionGroups.forEach((g, gIdx) => {
    console.log(`\nGroup ${gIdx + 1}: [${g.groupTitle}] Type: ${g.type}`);
    console.log(`  Instructions: ${g.instructions}`);
    console.log(`  Options: ${g.options ? g.options.join(', ') : 'none'}`);
    console.log(`  Questions count: ${g.questions.length}`);
    g.questions.forEach((q) => {
      console.log(`    Q${q.questionNumber || q.number} (${q.type}): "${q.prompt}"`);
      if (q.options) console.log(`       Options: ${q.options.join(' | ')}`);
    });
  });
});
