import type { ReadingQuestion, QuestionType, AssignmentSkill, QuestionGroup, ParsedPassage } from '../types/index.ts';

export interface ParsedTest {
  id: string;
  testIndex: number;
  title: string;
  pageStart?: number;
  pageEnd?: number;
  passages: ParsedPassage[];
  allQuestions: ReadingQuestion[];
  questionCount: number;
}

export interface ExtractedAnswerItem {
  qNum: string;
  answer: string;
  citation?: string;
  raw?: string;
}

export interface CandidateTest {
  id: string;
  testIndex: number;
  title: string;
  passageText: string;
  instructions: string;
  questions: ReadingQuestion[];
  questionGroups?: QuestionGroup[];
  detectedAnswerKey: Record<string, string>;
  detectedAnswerDetails?: Record<string, ExtractedAnswerItem>;
  hasAnswerKeys: boolean;
  questionCount: number;
  recognizedTypes: QuestionType[];
  warnings: string[];
}

export interface DocumentStructure {
  title: string;
  detectedSkill: AssignmentSkill;
  passageText: string;
  instructions: string;
  questions: ReadingQuestion[];
  detectedAnswerKey: Record<string, string>;
  detectedAnswerDetails?: Record<string, ExtractedAnswerItem>;
  hasExistingQuestions: boolean;
  candidateTests: CandidateTest[];
  tests?: ParsedTest[];
}

export interface ExtractedDocument {
  id: string;
  name: string;
  size: number;
  type: 'pdf' | 'docx' | 'txt' | 'md' | 'unknown';
  rawText: string;
  htmlContent?: string;
  pageCount?: number;
  isScanned?: boolean;
  status: 'idle' | 'parsing' | 'ready' | 'error';
  errorMessage?: string;
  detectedStructure?: DocumentStructure;
}

/**
 * Validates whether the file is an accepted document format
 */
export function validateDocumentFile(file: File): { valid: boolean; error?: string; type: ExtractedDocument['type'] } {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const maxSizeBytes = 25 * 1024 * 1024; // 25 MB

  if (file.size > maxSizeBytes) {
    return { valid: false, error: 'File size exceeds 25MB limit.', type: 'unknown' };
  }

  if (extension === 'pdf' || file.type === 'application/pdf') {
    return { valid: true, type: 'pdf' };
  }
  if (extension === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return { valid: true, type: 'docx' };
  }
  if (extension === 'txt' || file.type === 'text/plain') {
    return { valid: true, type: 'txt' };
  }
  if (extension === 'md' || extension === 'markdown') {
    return { valid: true, type: 'md' };
  }

  return {
    valid: false,
    error: `Unsupported format ".${extension || 'unknown'}". Please upload a PDF, DOCX, TXT, or Markdown document.`,
    type: 'unknown',
  };
}

/**
 * Extracts lines from PDF text items respecting multi-column layouts
 */
export function extractLinesFromPdfItems(items: any[]): string {
  const validItems = items
    .filter((it: any) => it.str && it.str.trim().length > 0)
    .map((it: any) => ({
      str: it.str,
      x: it.transform ? it.transform[4] : 0,
      y: it.transform ? it.transform[5] : 0,
      w: it.width || 0,
      h: it.height || 0,
    }));

  if (validItems.length === 0) return '';

  function groupLines(colItems: typeof validItems): string {
    const sorted = [...colItems].sort((a, b) => {
      const dy = b.y - a.y;
      if (Math.abs(dy) > 3) return dy;
      return a.x - b.x;
    });

    const lines: string[] = [];
    let currentLine: string[] = [];
    let currentY: number | null = null;

    for (const item of sorted) {
      if (currentY === null || Math.abs(currentY - item.y) <= 3) {
        currentLine.push(item.str);
        if (currentY === null) currentY = item.y;
      } else {
        lines.push(currentLine.join(' '));
        currentLine = [item.str];
        currentY = item.y;
      }
    }
    if (currentLine.length > 0) lines.push(currentLine.join(' '));
    return lines.join('\n');
  }

  const minX = Math.min(...validItems.map((i) => i.x));
  const maxX = Math.max(...validItems.map((i) => i.x + i.w));
  const midX = (minX + maxX) / 2;

  // Group items by physical line (y within 3) to accurately test column crossing
  const lineMap = new Map<number, typeof validItems>();
  validItems.forEach((it) => {
    const yKey = Math.round(it.y);
    let matchedKey: number | null = null;
    for (const k of lineMap.keys()) {
      if (Math.abs(k - yKey) <= 3) {
        matchedKey = k;
        break;
      }
    }
    if (matchedKey === null) {
      matchedKey = yKey;
      lineMap.set(matchedKey, []);
    }
    lineMap.get(matchedKey)!.push(it);
  });

  let crossingLines = 0;
  for (const lItems of lineMap.values()) {
    const lMin = Math.min(...lItems.map((i) => i.x));
    const lMax = Math.max(...lItems.map((i) => i.x + i.w));
    if (lMin < midX - 25 && lMax > midX + 25) {
      crossingLines++;
    }
  }

  const crossingRatio = lineMap.size > 0 ? crossingLines / lineMap.size : 1;
  const leftItems = validItems.filter((i) => i.x + i.w <= midX + 15);
  const rightItems = validItems.filter((i) => i.x >= midX - 15);

  // A genuine two-column layout requires very few lines crossing midX and substantial text in both columns
  const isTwoColumn =
    crossingRatio < 0.25 && leftItems.length > 20 && rightItems.length > 20;

  if (isTwoColumn) {
    const colTopY = Math.max(...leftItems.map((i) => i.y), ...rightItems.map((i) => i.y));
    const headerItems = validItems.filter((i) => i.y > colTopY + 15);
    const regularLeft = leftItems.filter((i) => !headerItems.includes(i));
    const regularRight = rightItems.filter((i) => !headerItems.includes(i));

    const headerText = headerItems.length > 0 ? groupLines(headerItems) + '\n\n' : '';
    const leftText = groupLines(regularLeft);
    const rightText = groupLines(regularRight);
    return (headerText + leftText + '\n\n' + rightText).trim();
  }

  return groupLines(validItems);
}

/**
 * Extracts plain text and metadata from PDF files using pdfjs-dist
 */
export async function extractPdfText(file: File): Promise<{ text: string; pageCount: number; isScanned: boolean }> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    if (typeof window !== 'undefined' && 'Worker' in window && !(pdfjsLib as any).GlobalWorkerOptions.workerSrc) {
      try {
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version || '3.11.174'}/pdf.worker.min.js`;
      } catch (workerErr) {
        console.warn('Could not set pdfjs workerSrc:', workerErr);
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = (pdfjsLib as any).getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    let fullText = '';
    let totalChars = 0;

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = extractLinesFromPdfItems(textContent.items);

      totalChars += pageText.trim().length;
      fullText += `\n[--- Page ${pageNum} ---]\n${pageText}\n`;
    }

    const isScanned = pageCount > 0 && totalChars < 40;

    return {
      text: fullText.trim(),
      pageCount,
      isScanned,
    };
  } catch (err: any) {
    throw new Error(`PDF extraction failed: ${err.message || 'Unknown error'}`);
  }
}

/**
 * Extracts raw text and HTML from DOCX files using mammoth
 */
export async function extractDocxText(file: File): Promise<{ text: string; html: string }> {
  try {
    const mammothModule = await import('mammoth');
    const mammoth = (mammothModule as any).default || mammothModule;
    const arrayBuffer = await file.arrayBuffer();
    const [rawResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ arrayBuffer }),
      mammoth.convertToHtml({ arrayBuffer }),
    ]);

    return {
      text: rawResult.value.trim(),
      html: htmlResult.value,
    };
  } catch (err: any) {
    throw new Error(`DOCX extraction failed: ${err.message || 'Unknown error'}`);
  }
}

/**
 * Extracts text from plain text and markdown files
 */
export async function extractPlainText(file: File): Promise<string> {
  try {
    return await file.text();
  } catch (err: any) {
    throw new Error(`Text reading failed: ${err.message || 'Unknown error'}`);
  }
}

/**
 * Processes an imported file and returns an ExtractedDocument object
 */
export async function processDocumentFile(file: File): Promise<ExtractedDocument> {
  const validation = validateDocumentFile(file);
  const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  if (!validation.valid) {
    return {
      id,
      name: file.name,
      size: file.size,
      type: validation.type,
      rawText: '',
      status: 'error',
      errorMessage: validation.error,
    };
  }

  try {
    let rawText = '';
    let htmlContent: string | undefined;
    let pageCount: number | undefined;
    let isScanned = false;

    if (validation.type === 'pdf') {
      const pdfRes = await extractPdfText(file);
      rawText = pdfRes.text;
      pageCount = pdfRes.pageCount;
      isScanned = pdfRes.isScanned;
    } else if (validation.type === 'docx') {
      const docxRes = await extractDocxText(file);
      rawText = docxRes.text;
      htmlContent = docxRes.html;
    } else {
      rawText = await extractPlainText(file);
    }

    if (isScanned) {
      return {
        id,
        name: file.name,
        size: file.size,
        type: validation.type,
        rawText: '',
        pageCount,
        isScanned: true,
        status: 'error',
        errorMessage: 'Scanned PDF detected without an embedded text layer. Please use a digital PDF or OCR-converted document.',
      };
    }

    const detectedStructure = parseDocumentStructure(rawText, file.name);

    return {
      id,
      name: file.name,
      size: file.size,
      type: validation.type,
      rawText,
      htmlContent,
      pageCount,
      isScanned: false,
      status: 'ready',
      detectedStructure,
    };
  } catch (err: any) {
    return {
      id,
      name: file.name,
      size: file.size,
      type: validation.type,
      rawText: '',
      status: 'error',
      errorMessage: err.message || 'Failed to process document.',
    };
  }
}

/**
 * Extracts word limit constraint from text
 */
export function extractWordLimitInfo(text: string): { limitStr?: string; maxWords?: number } {
  const match = text.match(
    /(?:choose|write|use)?\s*(NO\s+MORE\s+THAN\s+(?:ONE|TWO|THREE|FOUR|\d+)\s+WORDS?(?:\s+AND\/OR\s+A\s+NUMBER)?|ONLY\s+ONE\s+WORD)/i
  );
  if (match) {
    const limitStr = match[1].toUpperCase().trim();
    let maxWords = 1;
    if (limitStr.includes('TWO')) maxWords = 2;
    else if (limitStr.includes('THREE')) maxWords = 3;
    else if (limitStr.includes('FOUR')) maxWords = 4;
    else {
      const digitMatch = limitStr.match(/(\d+)/);
      if (digitMatch) maxWords = parseInt(digitMatch[1], 10);
    }
    return { limitStr, maxWords };
  }
  return {};
}

/**
 * Detects the specific question type from instruction and prompt context
 */
export function detectQuestionType(
  prompt: string,
  instructionContext: string,
  options?: string[]
): QuestionType {
  const combined = `${instructionContext} ${prompt}`.toLowerCase();

  // True / False / Not Given vs Yes / No / Not Given
  if (
    (combined.includes('true') && combined.includes('false')) ||
    combined.includes('agree with the information') ||
    combined.includes('agree with the statement')
  ) {
    return 'true_false_not_given';
  }
  if (
    (combined.includes('yes') && combined.includes('no')) ||
    combined.includes('claims of the writer') ||
    combined.includes('views of the writer')
  ) {
    return 'yes_no_not_given';
  }

  // Matching variations
  if (combined.includes('list of headings') || combined.includes('correct heading') || combined.includes('heading for each paragraph')) {
    return 'matching_headings';
  }
  if (
    combined.includes('which paragraph contains') ||
    combined.includes('which paragraph mentions') ||
    combined.includes('which paragraph gives') ||
    combined.includes('information to paragraph') ||
    combined.includes('paragraphs a-') ||
    combined.includes('paragraph a-') ||
    combined.includes('paragraphs a–') ||
    combined.includes('write the correct letter, a-') ||
    combined.includes('write the correct letter a-') ||
    combined.includes('write the correct letter, a–') ||
    combined.includes('write the correct letter in boxes') ||
    (combined.includes('in boxes') && combined.includes('on your answer sheet') && (combined.includes('a-') || combined.includes('a–'))) ||
    combined.includes('nb you may use any letter more than once') ||
    combined.includes('you may use any letter more than once') ||
    combined.includes('matching information')
  ) {
    return 'matching_information';
  }
  if (
    combined.includes('match each statement with the correct person') ||
    combined.includes('match each statement with the correct') ||
    combined.includes('list of researchers') ||
    combined.includes('list of people') ||
    combined.includes('matching features')
  ) {
    return 'matching_features';
  }
  if (combined.includes('sentence ending') || combined.includes('correct ending') || combined.includes('complete each sentence with the correct ending')) {
    return 'matching_sentence_endings';
  }

  // Completion variations
  if (combined.includes('complete the summary') || combined.includes('summary completion')) {
    return 'summary_completion';
  }
  if (combined.includes('complete the notes') || combined.includes('note completion') || combined.includes('notes below')) {
    return 'note_completion';
  }
  if (combined.includes('complete the table') || combined.includes('table completion') || combined.includes('table below')) {
    return 'table_completion';
  }
  if (combined.includes('flow-chart') || combined.includes('flowchart')) {
    return 'flowchart_completion';
  }
  if (combined.includes('label the diagram') || combined.includes('diagram label') || combined.includes('diagram below')) {
    return 'diagram_completion';
  }
  if (combined.includes('complete the sentence') || combined.includes('sentences below')) {
    return 'sentence_completion';
  }

  // Multiple Select vs Multiple Choice
  if (
    combined.includes('choose two') ||
    combined.includes('choose three') ||
    combined.includes('which two') ||
    combined.includes('which three')
  ) {
    return 'multiple_select';
  }

  if (options && options.length >= 2) {
    return 'multiple_choice';
  }

  if (combined.includes('fill in the blank') || combined.includes('blank')) {
    return 'sentence_completion';
  }

  return 'short_answer';
}

/**
 * Robustly parses multi-format answer keys from IELTS reading documents:
 * - Single item per line ("1. A", "2. TRUE", "3. NOT GIVEN")
 * - Multiple items per line ("1. FALSE 2. TRUE 3. NOT GIVEN", "1-B, 2-C, 3-A")
 * - Roman numerals for Matching Headings ("1. iv", "2. vii")
 * - Words, phrases, and slash alternatives for completion ("solar radiation / solar energy")
 * - Inline citations and explanations in brackets/parentheses or after dashes ("1. FALSE (Paragraph 2: ...)")
 */
export function parseAnswerText(text: string): Record<string, ExtractedAnswerItem> {
  const results: Record<string, ExtractedAnswerItem> = {};
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Mask parentheses and brackets so numbers inside them are not matched as question markers
    const maskedChars = line.split('');
    let depth = 0;
    for (let ci = 0; ci < maskedChars.length; ci++) {
      if (maskedChars[ci] === '(' || maskedChars[ci] === '[') {
        depth++;
      } else if (maskedChars[ci] === ')' || maskedChars[ci] === ']') {
        depth = Math.max(0, depth - 1);
      } else if (depth > 0) {
        maskedChars[ci] = '_';
      }
    }
    const maskedLine = maskedChars.join('');

    // Scan markers on maskedLine
    const markerRegex = /(?:^|\s+|,\s*)(?:(?:Question|Q)\s*)?(\d{1,2})[\.\:\)\-\s]+/gi;
    const markers: { qNum: string; index: number; markerEnd: number }[] = [];
    let match: RegExpExecArray | null;
    while ((match = markerRegex.exec(maskedLine)) !== null) {
      const qNum = parseInt(match[1], 10);
      if (qNum >= 1 && qNum <= 40) {
        const markerStartIndex = match.index + match[0].indexOf(match[1]);
        markers.push({
          qNum: match[1],
          index: markerStartIndex,
          markerEnd: match.index + match[0].length,
        });
      }
    }

    if (markers.length === 0) continue;

    for (let i = 0; i < markers.length; i++) {
      const current = markers[i];
      const next = markers[i + 1];
      const rawSegment = next
        ? line.substring(current.markerEnd, next.index).trim()
        : line.substring(current.markerEnd).trim();

      const cleanSegment = rawSegment.replace(/[,;]+$/, '').trim();
      if (!cleanSegment) continue;

      let answer = cleanSegment;
      let citation = '';

      // Pattern 1: Answer (Citation) or Answer [Citation]
      const bracketMatch = cleanSegment.match(/^([^\(\[\–\-]+?)\s*[\(\[]([^\)\]]+)[\)\]]$/);
      if (bracketMatch) {
        answer = bracketMatch[1].trim();
        citation = bracketMatch[2].trim();
      } else {
        // Pattern 2: Answer - Citation (if answer is concise, e.g. A, TRUE, etc.)
        const dashMatch = cleanSegment.match(/^([A-Za-z0-9\s\/\%]+?)\s+[\-\–]\s+(.*)$/);
        if (dashMatch && !['not given', 'true', 'false', 'yes', 'no'].includes(cleanSegment.toLowerCase())) {
          answer = dashMatch[1].trim();
          citation = dashMatch[2].trim();
        }
      }

      // Normalization of common IELTS answer formats
      const lower = answer.toLowerCase();
      if (lower === 't' || lower === 'true') answer = 'TRUE';
      else if (lower === 'f' || lower === 'false') answer = 'FALSE';
      else if (lower === 'ng' || lower === 'not given') answer = 'NOT GIVEN';
      else if (lower === 'y' || lower === 'yes') answer = 'YES';
      else if (lower === 'n' || lower === 'no') answer = 'NO';
      else if (/^[a-h]$/i.test(answer)) answer = answer.toUpperCase();

      results[current.qNum] = {
        qNum: current.qNum,
        answer,
        citation: citation || undefined,
        raw: cleanSegment,
      };
    }
  }

  return results;
}

/**
 * Parses candidate test segments and builds hierarchical structure:
 * Document -> Test[] -> Passage[] -> QuestionGroup[] -> Question[]
 */
export function parseDocumentStructure(rawText: string, fallbackName: string): DocumentStructure {
  const cleanRaw = rawText.replace(/\r\n/g, '\n');
  const lines = cleanRaw.split('\n').map((l) => l.trim()).filter(Boolean);

  const title = fallbackName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  let detectedSkill: AssignmentSkill = 'reading';

  const lowerAll = rawText.toLowerCase();
  if (lowerAll.includes('listening section') || lowerAll.includes('audio track')) {
    detectedSkill = 'reading';
  } else if (lowerAll.includes('writing task 1') || lowerAll.includes('writing task 2')) {
    detectedSkill = 'writing';
  } else if (lowerAll.includes('speaking part 1') || lowerAll.includes('cue card')) {
    detectedSkill = 'speaking';
  }

  // 1. Detect and parse Global / Per-test Answer Keys if present
  const detectedAnswerDetails: Record<string, ExtractedAnswerItem> = {};
  const detectedAnswerKey: Record<string, string> = {};
  let answerKeyStartIndex = -1;
  const answerKeyHeaderRegex =
    /^(?:#+\s*)?(?:(?:ielts\s+)?reading\s+)?(?:answer\s*keys?|answers?|correct\s*answers?|dap\s*an|đáp\s*án|key\s*\/?\s*answers?)(?:\s*(?:&|and|\+)\s*(?:explanations?|giải\s*thích|citations?))?[:\s]*$/i;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (
      answerKeyHeaderRegex.test(l) ||
      l.toLowerCase().startsWith('answer key:') ||
      l.toLowerCase().startsWith('đáp án:') ||
      l.toLowerCase().startsWith('answers:') ||
      l.toLowerCase().startsWith('correct answers:')
    ) {
      answerKeyStartIndex = i;
      break;
    }
  }

  if (answerKeyStartIndex !== -1) {
    const keyLines = lines.slice(answerKeyStartIndex + 1);
    const parsedKeyItems = parseAnswerText(keyLines.join('\n'));
    Object.assign(detectedAnswerDetails, parsedKeyItems);
    for (const [qNum, item] of Object.entries(parsedKeyItems)) {
      detectedAnswerKey[qNum] = item.answer;
    }
  }

  const contentText =
    answerKeyStartIndex !== -1 ? lines.slice(0, answerKeyStartIndex).join('\n') : cleanRaw;

  // 2. Identify Test Boundaries if multi-test document (e.g. TEST 1, TEST 2, etc.)
  const testSplitterRegex = /(?:^|\n)(?=(?:TEST\s+\d+|PRACTICE\s+TEST\s+\d+)\b)/i;
  const rawTestChunks = contentText.split(testSplitterRegex).filter((s) => s.trim().length > 50);

  const hasExplicitTests = rawTestChunks.length > 1;
  const testChunks = hasExplicitTests ? rawTestChunks : [contentText];

  const parsedTests: ParsedTest[] = [];
  const candidateTests: CandidateTest[] = [];

  testChunks.forEach((tChunk, tIdx) => {
    const testIndex = tIdx + 1;
    let testTitle = `Test ${testIndex}`;

    // Extract Test title from first line if available
    const firstLine = tChunk.trim().split('\n')[0] || '';
    if (/^(?:TEST\s+\d+|PRACTICE\s+TEST\s+\d+)/i.test(firstLine)) {
      testTitle = firstLine;
    }

    // Split on Passages within this Test
    const passageSplitterRegex =
      /(?:^|\n)(?=(?:READING\s+PASSAGE\s+\d+|PASSAGE\s+\d+|SECTION\s+\d+)\b)/i;
    const rawPassageChunks = tChunk.split(passageSplitterRegex).filter((p) => p.trim().length > 50);
    const passageChunks = rawPassageChunks.length > 0 ? rawPassageChunks : [tChunk];

    const testPassages: ParsedPassage[] = [];
    const testAllQuestions: ReadingQuestion[] = [];

    passageChunks.forEach((pChunk, pIdx) => {
      const passageIndex = pIdx + 1;
      const { passageTitle, passageContent, questionGroups, questions } = parseSinglePassage(
        pChunk,
        passageIndex,
        detectedAnswerKey,
        detectedAnswerDetails
      );

      // Skip empty fragments that have neither substantial content nor questions
      if (passageContent.trim().length < 40 && questions.length === 0) {
        return;
      }

      testPassages.push({
        id: `test_${testIndex}_passage_${passageIndex}`,
        passageIndex,
        title: passageTitle,
        content: passageContent,
        questionGroups,
        questions,
      });

      testAllQuestions.push(...questions);

      // Add to candidateTests list (per passage)
      const warnings: string[] = [];
      const missingKeys = questions
        .filter((q) => !q.correctAnswer)
        .map((q) => q.id.replace('q_', ''));
      if (missingKeys.length > 0) {
        warnings.push(
          `Missing answer keys for questions: ${missingKeys.slice(0, 5).join(', ')}${
            missingKeys.length > 5 ? '...' : ''
          }`
        );
      }
      const uncertainTypes = questions.filter((q) => q.needsReview).length;
      if (uncertainTypes > 0) {
        warnings.push(`${uncertainTypes} questions flagged for teacher review.`);
      }

      candidateTests.push({
        id: `candidate_${testIndex}_${passageIndex}`,
        testIndex: candidateTests.length + 1,
        title: passageTitle,
        passageText: passageContent,
        instructions: questionGroups[0]?.instructions || 'Read the text and answer the questions below.',
        questions,
        questionGroups,
        detectedAnswerKey,
        hasAnswerKeys: questions.some((q) => Boolean(q.correctAnswer)),
        questionCount: questions.length,
        recognizedTypes: Array.from(new Set(questions.map((q) => q.type))),
        warnings,
      });
    });

    if (testPassages.length === 0 && testAllQuestions.length === 0) {
      return;
    }

    const existingTest = parsedTests.find(
      (t) => t.title.toLowerCase().trim() === testTitle.toLowerCase().trim()
    );

    if (existingTest) {
      existingTest.passages.push(...testPassages);
      existingTest.passages.forEach((p, idx) => {
        p.passageIndex = idx + 1;
        p.id = `${existingTest.id}_passage_${idx + 1}`;
      });
      existingTest.allQuestions.push(...testAllQuestions);
      existingTest.questionCount = existingTest.allQuestions.length;
    } else {
      parsedTests.push({
        id: `test_${testIndex}`,
        testIndex: parsedTests.length + 1,
        title: testTitle,
        passages: testPassages,
        allQuestions: testAllQuestions,
        questionCount: testAllQuestions.length,
      });
    }
  });

  // Handle Answer-Key-Only files where no reading passage text was present
  if (candidateTests.length === 0 && Object.keys(detectedAnswerDetails).length > 0) {
    const synthQuestions: ReadingQuestion[] = Object.values(detectedAnswerDetails).map((item) => ({
      id: `q_${item.qNum}`,
      type: /^(TRUE|FALSE|NOT GIVEN)$/i.test(item.answer)
        ? 'true_false_not_given'
        : /^(YES|NO)$/i.test(item.answer)
        ? 'yes_no_not_given'
        : /^[A-H]$/i.test(item.answer)
        ? 'multiple_choice'
        : /^(?:[ivx]+)$/i.test(item.answer)
        ? 'matching_headings'
        : 'sentence_completion',
      prompt: `Question ${item.qNum}`,
      correctAnswer: item.answer,
      citation: item.citation,
      explanation: item.citation ? `Citation: ${item.citation}` : 'Extracted from Answer Key.',
      points: 1,
      source: 'answer_key_extracted',
      answerKeyConfidence: 'high',
      needsReview: false,
    }));

    candidateTests.push({
      id: 'candidate_answer_key_only',
      testIndex: 1,
      title: `${title} (Answer Key)`,
      passageText: 'Answer Key Document: No reading passage text detected.',
      instructions: 'Review extracted answer keys below.',
      questions: synthQuestions,
      detectedAnswerKey,
      detectedAnswerDetails,
      hasAnswerKeys: true,
      questionCount: synthQuestions.length,
      recognizedTypes: Array.from(new Set(synthQuestions.map((q) => q.type))),
      warnings: ['Document contains answer key data.'],
    });
  }

  const primaryPassage = candidateTests.map((c) => c.passageText).filter(Boolean).join('\n\n---\n\n');
  const allQuestions = candidateTests.flatMap((c) => c.questions);

  return {
    title: candidateTests[0]?.title || title,
    detectedSkill,
    passageText: primaryPassage,
    instructions: candidateTests[0]?.instructions || 'Read the text and answer the questions that follow.',
    questions: allQuestions,
    detectedAnswerKey,
    detectedAnswerDetails,
    hasExistingQuestions: allQuestions.length > 0,
    candidateTests,
    tests: parsedTests,
  };
}

/**
 * Parses a single passage chunk into title, text, question groups, and individual questions
 */
/**
 * Formats passage paragraphs strictly according to IELTS standard:
 * Labeled paragraph: label on its own line, content on next line, separated from next paragraph by exactly one empty line.
 */
export function formatPassageParagraphs(lines: string[]): { formattedText: string; detectedParagraphLabels: string[] } {
  if (lines.length === 0) return { formattedText: '', detectedParagraphLabels: [] };

  interface ParaBlock {
    label?: string;
    lines: string[];
  }

  const blocks: ParaBlock[] = [];
  let currentBlock: ParaBlock = { lines: [] };
  const detectedLabels = new Set<string>();

  const standaloneLabelRegex = /^(?:paragraph\s+|section\s+)?([A-J])[\.\:\)]?$/i;
  const inlineLabelRegex = /^(?:(?:paragraph|section)\s+([A-J])[\.\:\)]?|\[([A-J])\]|\(([A-J])\)|([A-J])[\.\:\)])\s+(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Check standalone label (e.g. "A" or "Paragraph A" on its own line)
    const standaloneMatch = rawLine.match(standaloneLabelRegex);
    if (standaloneMatch && rawLine.length <= 15) {
      const letter = standaloneMatch[1].toUpperCase();
      detectedLabels.add(letter);
      if (currentBlock.lines.length > 0 || currentBlock.label) {
        blocks.push(currentBlock);
      }
      currentBlock = { label: letter, lines: [] };
      continue;
    }

    // Check inline label (e.g. "A. In the early 19th century...")
    const inlineMatch = rawLine.match(inlineLabelRegex);
    if (inlineMatch) {
      const letter = (inlineMatch[1] || inlineMatch[2] || inlineMatch[3] || inlineMatch[4]).toUpperCase();
      const content = inlineMatch[5]?.trim() || '';
      detectedLabels.add(letter);
      if (currentBlock.lines.length > 0 || currentBlock.label) {
        blocks.push(currentBlock);
      }
      currentBlock = { label: letter, lines: content ? [content] : [] };
      continue;
    }

    currentBlock.lines.push(rawLine);
  }

  if (currentBlock.lines.length > 0 || currentBlock.label) {
    blocks.push(currentBlock);
  }

  const formattedParagraphs: string[] = [];
  for (const block of blocks) {
    const content = block.lines.join(' ').replace(/\s{2,}/g, ' ').trim();
    if (block.label) {
      if (content) {
        formattedParagraphs.push(`${block.label}\n${content}`);
      } else {
        formattedParagraphs.push(block.label);
      }
    } else if (content) {
      formattedParagraphs.push(content);
    }
  }

  return {
    formattedText: formattedParagraphs.join('\n\n'),
    detectedParagraphLabels: Array.from(detectedLabels).sort(),
  };
}

function parseSinglePassage(
  passageChunk: string,
  passageIndex: number,
  globalAnswerKeys: Record<string, string>,
  globalAnswerDetails?: Record<string, ExtractedAnswerItem>
): {
  passageTitle: string;
  passageContent: string;
  questionGroups: QuestionGroup[];
  questions: ReadingQuestion[];
} {
  const pLines = passageChunk.split('\n').map((l) => l.trim()).filter(Boolean);
  if (pLines.length === 0) {
    return {
      passageTitle: `Passage ${passageIndex}`,
      passageContent: '',
      questionGroups: [],
      questions: [],
    };
  }

  // 1. Detect Passage Title
  let passageTitle = `Passage ${passageIndex}`;
  let contentStartIndex = 0;

  const headerMatch = pLines[0].match(
    /^(?:READING\s+PASSAGE\s+\d+|PASSAGE\s+\d+|SECTION\s+\d+)(?:\s*[\:\-\–]\s*(.*))?$/i
  );
  if (headerMatch) {
    if (headerMatch[1] && headerMatch[1].trim()) {
      passageTitle = headerMatch[1].trim();
      contentStartIndex = 1;
    } else if (
      pLines.length > 1 &&
      pLines[1].length < 100 &&
      !/^(questions?|\d+[\.\:\)]|you\s+should\s+spend)/i.test(pLines[1])
    ) {
      passageTitle = pLines[1];
      contentStartIndex = 2;
    } else {
      contentStartIndex = 1;
    }
  } else if (pLines[0].length < 100) {
    passageTitle = pLines[0];
    contentStartIndex = 1;
  }

  // 1.5. Detect if passage has its own localized answer key block at end of passage
  const passageAnswerDetails: Record<string, ExtractedAnswerItem> = {};
  const passageKeyHeaderRegex =
    /^(?:#+\s*)?(?:(?:reading\s+)?passage\s+\d+\s+)?(?:answer\s*keys?|answers?|correct\s*answers?|dap\s*an|đáp\s*án)(?:\s*for\s+(?:reading\s+)?passage\s+\d+)?[:\s]*$/i;

  let passageKeyStartIdx = -1;
  for (let i = contentStartIndex; i < pLines.length; i++) {
    if (passageKeyHeaderRegex.test(pLines[i])) {
      passageKeyStartIdx = i;
      break;
    }
  }

  const effectivePassageLines = passageKeyStartIdx !== -1 ? pLines.slice(0, passageKeyStartIdx) : pLines;
  if (passageKeyStartIdx !== -1) {
    const keyLines = pLines.slice(passageKeyStartIdx + 1);
    Object.assign(passageAnswerDetails, parseAnswerText(keyLines.join('\n')));
  }

  const effectiveDetails: Record<string, ExtractedAnswerItem> = {
    ...(globalAnswerDetails || {}),
    ...passageAnswerDetails,
  };
  const effectiveAnswerKeys: Record<string, string> = {
    ...globalAnswerKeys,
  };
  for (const [k, item] of Object.entries(effectiveDetails)) {
    effectiveAnswerKeys[k] = item.answer;
  }

  // 2. Separate Passage Body from Questions Section
  // Questions start at first "Questions X-Y" or "Question 1."
  const passageBodyLines: string[] = [];
  const questionLines: string[] = [];
  let isInQuestionsSection = false;

  for (let i = contentStartIndex; i < effectivePassageLines.length; i++) {
    const line = effectivePassageLines[i];
    if (line.startsWith('[--- Page') || line.endsWith('---]')) {
      continue;
    }

    if (
      !isInQuestionsSection &&
      (/q\s*u\s*e\s*s\s*t\s*i\s*o\s*n\s*s?\s+\d+/i.test(line) ||
        /^(?:do\s+the\s+following\s+statements|complete\s+the\s+|choose\s+(?:the\s+correct|no\s+more|one|two)|write\s+(?:the\s+correct|your\s+answers?)|look\s+at\s+the\s+following|in\s+boxes\s+\d+|matching\s+headings)/i.test(
          line
        ))
    ) {
      isInQuestionsSection = true;
    }

    if (isInQuestionsSection) {
      questionLines.push(line);
    } else {
      // Filter out meta lines like "You should spend about 20 minutes on..."
      if (!/you\s+should\s+spend\s+about\s+\d+\s+minutes/i.test(line)) {
        passageBodyLines.push(line);
      }
    }
  }

  const { formattedText: passageContent, detectedParagraphLabels } = formatPassageParagraphs(passageBodyLines);

  // 3. Parse Question Groups & Questions
  const questionGroups: QuestionGroup[] = [];
  const allQuestions: ReadingQuestion[] = [];

  // Split questionLines into groups on "Questions X-Y"
  const groupRanges: { title: string; lines: string[] }[] = [];
  let currentGroupTitle = 'Questions';
  let currentGroupLines: string[] = [];

  for (const qLine of questionLines) {
    const qGroupMatch = qLine.match(/^(q\s*u\s*e\s*s\s*t\s*i\s*o\s*n\s*s?\s+\d+(?:[\s\-\–to]+\d+)?)/i);
    if (qGroupMatch) {
      if (currentGroupLines.length > 0) {
        groupRanges.push({ title: currentGroupTitle, lines: currentGroupLines });
      }
      currentGroupTitle = qGroupMatch[1];
      currentGroupLines = [];
    } else {
      currentGroupLines.push(qLine);
    }
  }
  if (currentGroupLines.length > 0) {
    groupRanges.push({ title: currentGroupTitle, lines: currentGroupLines });
  }

  // If no group header found, wrap all question lines
  if (groupRanges.length === 0 && questionLines.length > 0) {
    groupRanges.push({ title: 'Questions', lines: questionLines });
  }

  groupRanges.forEach((gRange, gIdx) => {
    const groupInstructions: string[] = [];
    const groupQuestions: ReadingQuestion[] = [];
    const headingsList: string[] = [];
    const featuresList: string[] = [];
    const optionsBox: string[] = [];

    let wordLimitInfo: { limitStr?: string; maxWords?: number } = {};
    let currentQ: Partial<ReadingQuestion> | null = null;
    let isInHeadings = false;
    let isInFeatures = false;
    let isInWordBox = false;

    const stdQRegex = /^(?:Question\s+)?(\d{1,2})(?:[\.\:\)]|\s+(?=[A-Za-z0-9\(\"\'\_\—\–\.\…]))\s*(.*)/i;
    const bulletQRegex = /(?:^|[•\-\–\*\s])(?:.*?)\b(\d{1,2})\b\s*[\.\_\–\-\…]{2,}(.*)/;

    for (let li = 0; li < gRange.lines.length; li++) {
      const line = gRange.lines[li];
      if (line.startsWith('[--- Page') || line.endsWith('---]')) {
        continue;
      }

      // Check for Word Limit in instruction
      const wl = extractWordLimitInfo(line);
      if (wl.limitStr) {
        wordLimitInfo = wl;
        groupInstructions.push(line);
        continue;
      }

      // Detect List of Headings header
      if (/list\s+of\s+headings/i.test(line)) {
        isInHeadings = true;
        isInFeatures = false;
        isInWordBox = false;
        continue;
      }

      // Detect List of Researchers / People header
      if (/list\s+of\s+(?:researchers|people|categories|features)/i.test(line)) {
        isInFeatures = true;
        isInHeadings = false;
        isInWordBox = false;
        continue;
      }

      // Collect Roman numeral headings (e.g. "i ...", "ii ...", "iv ...")
      if (isInHeadings) {
        if (/^(?:[ivx]+|\d+)\s+[\w\s\-\,\.\'\"]+$/i.test(line)) {
          headingsList.push(line);
          continue;
        } else if (/q\s*u\s*e\s*s\s*t\s*i\s*o\s*n\s*s?\s+\d+/i.test(line) || stdQRegex.test(line)) {
          isInHeadings = false;
        }
      }

      // Collect Features (e.g. "A Dr Smith", "B Prof Miller")
      if (isInFeatures) {
        if (/^[A-G]\s+[\w\s\-\,\.\'\"]+$/i.test(line)) {
          featuresList.push(line);
          continue;
        } else if (stdQRegex.test(line)) {
          isInFeatures = false;
        }
      }

      // Check for Question Number
      let qNum: string | null = null;
      let qPrompt = '';
      let embeddedAnswer: string | null = null;

      const stdMatch = line.match(stdQRegex);
      if (stdMatch) {
        const n = parseInt(stdMatch[1], 10);
        if (n >= 1 && n <= 40) {
          qNum = stdMatch[1];
          qPrompt = stdMatch[2] || line;
        }
      } else {
        const bulletMatch = line.match(bulletQRegex);
        if (bulletMatch) {
          const n = parseInt(bulletMatch[1], 10);
          if (n >= 1 && n <= 40) {
            qNum = bulletMatch[1];
            qPrompt = line;
          }
        }
      }

      // Check for embedded answers in prompt line, e.g. "The research began in 1990. [FALSE]"
      if (qNum) {
        const embeddedMatch =
          qPrompt.match(/\[(?:answer|ans|đáp án)?\s*[:\=]?\s*([A-Za-z0-9\s\/\-_%]+)\]/i) ||
          qPrompt.match(/\((?:answer|ans|đáp án)\s*[:\=]\s*([A-Za-z0-9\s\/\-_%]+)\)/i);
        if (embeddedMatch) {
          embeddedAnswer = embeddedMatch[1].trim();
          qPrompt = qPrompt.replace(embeddedMatch[0], '').trim();
        }

        if (currentQ && currentQ.prompt) {
          finalizeQuestion(
            currentQ,
            groupQuestions,
            effectiveAnswerKeys,
            groupInstructions.join(' '),
            wordLimitInfo,
            effectiveDetails
          );
        }

        const inlineWl = extractWordLimitInfo(qPrompt);
        const effectiveWl = inlineWl.limitStr ? inlineWl : wordLimitInfo;

        const detailItem = effectiveDetails[qNum];
        const assignedKey = embeddedAnswer || detailItem?.answer || effectiveAnswerKeys[qNum] || '';
        const assignedSource = embeddedAnswer
          ? 'source_extracted'
          : detailItem || effectiveAnswerKeys[qNum]
          ? 'answer_key_extracted'
          : 'extracted_from_doc';

        currentQ = {
          id: `q_${qNum}`,
          prompt: qPrompt,
          options: [],
          wordLimit: effectiveWl.limitStr,
          maxWords: effectiveWl.maxWords,
          correctAnswer: assignedKey,
          citation: detailItem?.citation,
          points: 1,
          source: assignedSource,
          answerKeyConfidence: assignedKey ? 'high' : 'needs_teacher_review',
        };
        continue;
      }

      // Option A-H for multiple choice
      if (currentQ) {
        const optMatch = line.match(/^([A-H])[\.\:\)]\s+(.*)/i);
        if (optMatch) {
          currentQ.options = currentQ.options || [];
          currentQ.options.push(`${optMatch[1].toUpperCase()}. ${optMatch[2]}`);
          continue;
        }

        if (/^(TRUE|FALSE|NOT GIVEN)$/i.test(line)) {
          currentQ.type = 'true_false_not_given';
          continue;
        }
        if (/^(YES|NO)$/i.test(line)) {
          currentQ.type = 'yes_no_not_given';
          continue;
        }

        currentQ.prompt += ' ' + line;
      } else {
        // Collect instruction lines before questions begin
        groupInstructions.push(line);
      }
    }

    if (currentQ && currentQ.prompt) {
      finalizeQuestion(
        currentQ,
        groupQuestions,
        effectiveAnswerKeys,
        groupInstructions.join(' '),
        wordLimitInfo,
        effectiveDetails
      );
    }

    const fullInstruction =
      groupInstructions.join(' ').trim() || 'Read the text and answer the questions below.';
    const instructionType = detectQuestionType('', fullInstruction);
    let primaryType =
      (instructionType !== 'short_answer' ? instructionType : null) ||
      groupQuestions.find((q) => q.type !== 'short_answer')?.type ||
      'short_answer';

    if (headingsList.length > 0) {
      primaryType = 'matching_headings';
    } else if (featuresList.length > 0) {
      primaryType = 'matching_features';
    }

    // Propagate primaryType to questions in the group that defaulted to short_answer
    if (primaryType !== 'short_answer') {
      groupQuestions.forEach((q) => {
        if (q.type === 'short_answer') {
          q.type = primaryType;
        }
      });
    }

    // Attach reference lists to questions if applicable
    if (headingsList.length > 0) {
      groupQuestions.forEach((q) => {
        q.headingsList = headingsList;
        q.type = 'matching_headings';
      });
    }
    if (featuresList.length > 0) {
      groupQuestions.forEach((q) => {
        q.featuresList = featuresList;
        q.type = 'matching_features';
      });
    }

    // Attach available paragraph letters to matching_information questions if options are empty
    if (primaryType === 'matching_information') {
      const fallbackLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
      const effectiveLetters = detectedParagraphLabels.length >= 2 ? detectedParagraphLabels : fallbackLetters;
      groupQuestions.forEach((q) => {
        if (!q.options || q.options.length === 0) {
          q.options = effectiveLetters;
        }
      });
    }

    const qGroup: QuestionGroup = {
      id: `qgroup_${passageIndex}_${gIdx + 1}`,
      groupTitle: gRange.title,
      instructions: fullInstruction,
      questionType: primaryType,
      wordLimit: wordLimitInfo.limitStr,
      maxWords: wordLimitInfo.maxWords,
      headingsList: headingsList.length > 0 ? headingsList : undefined,
      featuresList: featuresList.length > 0 ? featuresList : undefined,
      optionsBox: optionsBox.length > 0 ? optionsBox : undefined,
      questions: groupQuestions,
    };

    questionGroups.push(qGroup);
    allQuestions.push(...groupQuestions);
  });

  // Sequential fallback mapping (e.g. Passage 2 questions 14-26, but answer key is numbered 1-13)
  const unkeyed = allQuestions.filter((q) => !q.correctAnswer);
  if (unkeyed.length > 0 && effectiveDetails) {
    const numericKeys = Object.keys(effectiveDetails)
      .map((k) => parseInt(k, 10))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
    if (numericKeys.length >= allQuestions.length && numericKeys[0] === 1) {
      allQuestions.forEach((q, idx) => {
        if (!q.correctAnswer) {
          const item = effectiveDetails[String(idx + 1)];
          if (item) {
            q.correctAnswer = item.answer;
            q.citation = item.citation;
            q.source = 'answer_key_extracted';
            q.answerKeyConfidence = 'high';
            q.needsReview = false;
            if (item.citation && !q.explanation.includes('Citation:')) {
              q.explanation = `Citation: ${item.citation}`;
            }
          }
        }
      });
    }
  }

  return {
    passageTitle,
    passageContent,
    questionGroups,
    questions: allQuestions,
  };
}

function finalizeQuestion(
  q: Partial<ReadingQuestion>,
  questions: ReadingQuestion[],
  detectedAnswerKey: Record<string, string>,
  instructionContext: string,
  wordLimitInfo: { limitStr?: string; maxWords?: number },
  detectedAnswerDetails?: Record<string, ExtractedAnswerItem>
) {
  const qNum = q.id?.replace('q_', '') || `${questions.length + 1}`;
  const options = q.options && q.options.length > 0 ? q.options : undefined;
  const qType = q.type || detectQuestionType(q.prompt || '', instructionContext, options);

  const detailItem = detectedAnswerDetails ? detectedAnswerDetails[qNum] : undefined;
  const key = (q.correctAnswer || detailItem?.answer || detectedAnswerKey[qNum] || '').trim();
  const citation = q.citation || detailItem?.citation || undefined;

  let source: ReadingQuestion['source'] = q.source || 'extracted_from_doc';
  if (!q.source) {
    if (detailItem || detectedAnswerKey[qNum]) {
      source = 'answer_key_extracted';
    } else if (key) {
      source = 'source_extracted';
    }
  }

  const confidence: 'high' | 'needs_teacher_review' = key ? 'high' : 'needs_teacher_review';
  const requiresReview = !key || confidence === 'needs_teacher_review';

  let explanation = q.explanation;
  if (!explanation) {
    if (citation) {
      explanation = `Citation: ${citation}`;
    } else if (key) {
      explanation = source === 'answer_key_extracted' ? 'Extracted from Answer Key.' : 'Extracted from source document.';
    } else {
      explanation = 'Ungrounded answer key: requires teacher review.';
    }
  }

  questions.push({
    id: q.id || `q_${questions.length + 1}`,
    type: qType,
    prompt: (q.prompt || '').trim(),
    options,
    wordLimit: q.wordLimit || wordLimitInfo.limitStr,
    maxWords: q.maxWords || wordLimitInfo.maxWords,
    correctAnswer: key,
    citation,
    explanation,
    points: q.points || 1,
    source,
    answerKeyConfidence: confidence,
    needsReview: requiresReview,
    isTeacherEdited: q.isTeacherEdited || false,
  });
}
