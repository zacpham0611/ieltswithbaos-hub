import fs from 'node:fs';
import path from 'node:path';
import { extractLinesFromPdfItems, parseDocumentStructure } from '../src/lib/documentExtractor.ts';

// Dynamic import pdfjs
async function runVerification() {
  console.log('=== STARTING 161-PAGE PDF EXTRACTION VERIFICATION ===');
  const pdfPath = 'C:/Users/Admin/.gemini/antigravity/brain/e66bef89-3824-44a3-9b01-1da8f8609a20/.user_uploaded/media_1792586345814_8b34901e.pdf';

  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found at ${pdfPath}`);
    process.exit(1);
  }

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
  const arrayBuffer = fs.readFileSync(pdfPath);
  const pdf = await (pdfjsLib as any).getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const numPages = pdf.numPages;
  console.log(`Loaded PDF: Total Pages = ${numPages}`);

  let fullText = '';
  let totalExtractedChars = 0;
  const startTime = Date.now();

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = extractLinesFromPdfItems(content.items);
    totalExtractedChars += pageText.trim().length;
    fullText += `\n[--- Page ${pageNum} ---]\n${pageText}\n`;
    if (pageNum % 40 === 0 || pageNum === numPages) {
      console.log(`Extracted page ${pageNum}/${numPages}...`);
    }
  }

  const extractDurationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Extraction complete in ${extractDurationSec}s. Total characters: ${totalExtractedChars}`);

  console.log('\n=== PARSING DOCUMENT STRUCTURE ===');
  const parsed = parseDocumentStructure(fullText, '2024 IELTS READING MOCK TESTS.pdf');

  console.log(`Detected Skill: ${parsed.detectedSkill}`);
  console.log(`Total ParsedTests (level 1): ${parsed.tests?.length || 0}`);
  console.log(`Total CandidateTests (Passages): ${parsed.candidateTests.length}`);
  console.log(`Total Questions Extracted: ${parsed.questions.length}`);
  console.log(`Answer Keys Mapped: ${Object.keys(parsed.detectedAnswerKey).length}`);

  let totalQuestionGroups = 0;
  if (parsed.tests && parsed.tests.length > 0) {
    parsed.tests.forEach((t) => {
      console.log(`\n--- ${t.title} ---`);
      console.log(`  Passages: ${t.passages.length}`);
      console.log(`  Questions in test: ${t.allQuestions.length}`);
      t.passages.forEach((p, pIdx) => {
        totalQuestionGroups += p.questionGroups?.length || 0;
        console.log(`    Passage ${p.passageIndex}: "${p.title.slice(0, 40)}" | Qs: ${p.questions?.length || 0} | Groups: ${p.questionGroups?.length || 0}`);
      });
    });
  }

  console.log(`\nTotal Question Groups: ${totalQuestionGroups}`);

  // Breakdown of Question Types
  const typeCounts: Record<string, number> = {};
  parsed.questions.forEach((q) => {
    typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
  });
  console.log('\nQuestion Types Breakdown:');
  console.table(typeCounts);

  // Missing or Unhandled analysis
  const missingKeys = parsed.questions.filter((q) => !q.correctAnswer).length;
  console.log(`Questions with answer key: ${parsed.questions.length - missingKeys} / ${parsed.questions.length}`);
  console.log(`Questions needing review: ${parsed.questions.filter((q) => q.needsReview).length}`);

  console.log('\n=== VERIFICATION FINISHED SUCCESSFULLY ===');
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
