import type { ReadingQuestion, QuestionType, AssignmentSkill } from '../types/index.ts';

export interface CandidateTest {
  id: string;
  testIndex: number;
  title: string;
  passageText: string;
  instructions: string;
  questions: ReadingQuestion[];
  detectedAnswerKey: Record<string, string>;
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
  hasExistingQuestions: boolean;
  candidateTests: CandidateTest[];
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
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      
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
function extractWordLimitInfo(text: string): { limitStr?: string; maxWords?: number } {
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
function detectQuestionType(
  prompt: string,
  instructionContext: string,
  options?: string[]
): QuestionType {
  const combined = `${instructionContext} ${prompt}`.toLowerCase();

  // True / False / Not Given vs Yes / No / Not Given
  if (combined.includes('true') && combined.includes('false')) {
    return 'true_false_not_given';
  }
  if (combined.includes('yes') && combined.includes('no')) {
    return 'yes_no_not_given';
  }

  // Matching variations
  if (combined.includes('list of headings') || combined.includes('correct heading')) {
    return 'matching_headings';
  }
  if (combined.includes('which paragraph contains') || combined.includes('information to paragraph')) {
    return 'matching_information';
  }
  if (combined.includes('match each statement with the correct person') || combined.includes('list of researchers') || combined.includes('matching features')) {
    return 'matching_features';
  }
  if (combined.includes('sentence ending') || combined.includes('correct ending')) {
    return 'matching_sentence_endings';
  }

  // Completion variations
  if (combined.includes('complete the summary') || combined.includes('summary completion')) {
    return 'summary_completion';
  }
  if (combined.includes('complete the notes') || combined.includes('note completion')) {
    return 'note_completion';
  }
  if (combined.includes('complete the table') || combined.includes('table completion')) {
    return 'table_completion';
  }
  if (combined.includes('flow-chart') || combined.includes('flowchart')) {
    return 'flowchart_completion';
  }
  if (combined.includes('label the diagram') || combined.includes('diagram label')) {
    return 'diagram_completion';
  }
  if (combined.includes('complete the sentence')) {
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
 * Parses candidate test segments from text (separates multiple passages/tests)
 */
export function parseDocumentStructure(rawText: string, fallbackName: string): DocumentStructure {
  const cleanRaw = rawText.replace(/\r\n/g, '\n');
  const lines = cleanRaw.split('\n').map((l) => l.trim()).filter(Boolean);

  let title = fallbackName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  let detectedSkill: AssignmentSkill = 'reading';

  const lowerAll = rawText.toLowerCase();
  if (lowerAll.includes('listening section') || lowerAll.includes('audio track')) {
    detectedSkill = 'reading';
  } else if (lowerAll.includes('writing task 1') || lowerAll.includes('writing task 2')) {
    detectedSkill = 'writing';
  } else if (lowerAll.includes('speaking part 1') || lowerAll.includes('cue card')) {
    detectedSkill = 'speaking';
  }

  // 1. Detect and parse Global Answer Key if present at the end
  const detectedAnswerKey: Record<string, string> = {};
  let answerKeyStartIndex = -1;
  const answerKeyRegex = /^(?:answer\s*key|answers|dap\s*an|đáp\s*án)[:\s]*$/i;

  for (let i = 0; i < lines.length; i++) {
    if (answerKeyRegex.test(lines[i]) || lines[i].toLowerCase().startsWith('answer key:')) {
      answerKeyStartIndex = i;
      break;
    }
  }

  if (answerKeyStartIndex !== -1) {
    const keyLines = lines.slice(answerKeyStartIndex + 1);
    for (const kl of keyLines) {
      const match = kl.match(/^(\d+)[\.\:\-\s]+([A-Za-z0-9\s\/\-_]+)/);
      if (match) {
        const qNum = match[1];
        const val = match[2].trim();
        detectedAnswerKey[qNum] = val;
      }
    }
  }

  const contentText = answerKeyStartIndex !== -1
    ? lines.slice(0, answerKeyStartIndex).join('\n')
    : cleanRaw;

  // 2. Identify Section / Test Boundaries
  // Split on "READING PASSAGE 1", "PASSAGE 2", "SECTION 1", "PRACTICE TEST 1", etc.
  const sectionSplitterRegex =
    /(?:^|\n)(?=(?:READING\s+PASSAGE\s+\d+|PASSAGE\s+\d+|SECTION\s+\d+|PRACTICE\s+TEST\s+\d+|TEST\s+\d+)\b)/i;

  const rawSections = contentText.split(sectionSplitterRegex).filter((s) => s.trim().length > 50);

  const candidateTests: CandidateTest[] = [];

  const sectionsToParse = rawSections.length > 0 ? rawSections : [contentText];

  sectionsToParse.forEach((secText, idx) => {
    const secLines = secText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (secLines.length === 0) return;

    // Detect Section Title
    let secTitle = `Passage ${idx + 1}`;
    const headerMatch = secLines[0].match(
      /^(?:READING\s+PASSAGE\s+\d+|PASSAGE\s+\d+|SECTION\s+\d+|TEST\s+\d+)(?:\s*[\:\-\–]\s*(.*))?$/i
    );
    if (headerMatch) {
      if (headerMatch[1] && headerMatch[1].trim()) {
        secTitle = headerMatch[1].trim();
      } else if (secLines.length > 1 && secLines[1].length < 100 && !/^(questions?|\d+[\.\:\)])/i.test(secLines[1])) {
        secTitle = `${secLines[0]}: ${secLines[1]}`;
      } else {
        secTitle = secLines[0];
      }
    } else if (secLines[0].length < 100) {
      secTitle = secLines[0];
    }

    // Parse passage text, instructions, and questions for this section
    const secPassageLines: string[] = [];
    const secQuestions: ReadingQuestion[] = [];
    const questionNumberRegex = /^(?:Question\s+)?(\d+)[\.\:\)]\s+(.*)/i;

    let currentInstruction = 'Read the text and answer the questions below.';
    let activeWordLimitInfo: { limitStr?: string; maxWords?: number } = {};
    let currentQ: Partial<ReadingQuestion> | null = null;

    for (let i = 0; i < secLines.length; i++) {
      const line = secLines[i];

      // Check if line contains question instructions or word limits
      const lineWl = extractWordLimitInfo(line);
      if (lineWl.limitStr) {
        activeWordLimitInfo = lineWl;
        currentInstruction = line;
        continue;
      }

      if (/^questions?\s+\d+/i.test(line) || /choose\s+the\s+correct/i.test(line) || /do\s+the\s+following\s+statements/i.test(line)) {
        currentInstruction = line;
        continue;
      }

      const qMatch = line.match(questionNumberRegex);
      if (qMatch) {
        if (currentQ && currentQ.prompt) {
          finalizeParsedQuestion(currentQ, secQuestions, detectedAnswerKey, currentInstruction, activeWordLimitInfo);
        }

        const qNum = qMatch[1];
        const qPrompt = qMatch[2];

        // Check line for inline word limit
        const inlineWl = extractWordLimitInfo(qPrompt);
        const effectiveWl = inlineWl.limitStr ? inlineWl : activeWordLimitInfo;

        currentQ = {
          id: `q_${qNum}`,
          prompt: qPrompt,
          options: [],
          wordLimit: effectiveWl.limitStr,
          maxWords: effectiveWl.maxWords,
          correctAnswer: detectedAnswerKey[qNum] || '',
          points: 1,
          source: 'extracted_from_doc',
          answerKeyConfidence: detectedAnswerKey[qNum] ? 'high' : 'needs_teacher_review',
        };
        continue;
      }

      // If inside a question, check for options A-D
      if (currentQ) {
        const optMatch = line.match(/^([A-E])[\.\:\)]\s+(.*)/i);
        if (optMatch) {
          currentQ.options = currentQ.options || [];
          currentQ.options.push(`${optMatch[1].toUpperCase()}. ${optMatch[2]}`);
          continue;
        }

        // True / False / Not Given tokens
        if (/^(TRUE|FALSE|NOT GIVEN)$/i.test(line)) {
          currentQ.type = 'true_false_not_given';
          continue;
        }
        if (/^(YES|NO)$/i.test(line)) {
          currentQ.type = 'yes_no_not_given';
          continue;
        }

        // Additional prompt continuation line
        currentQ.prompt += ' ' + line;
      } else {
        secPassageLines.push(line);
      }
    }

    if (currentQ && currentQ.prompt) {
      finalizeParsedQuestion(currentQ, secQuestions, detectedAnswerKey, currentInstruction, activeWordLimitInfo);
    }

    const passageText = secPassageLines.join('\n\n');

    // Calculate candidate warnings
    const warnings: string[] = [];
    const missingKeys = secQuestions.filter((q) => !q.correctAnswer).map((q) => q.id.replace('q_', ''));
    if (missingKeys.length > 0) {
      warnings.push(`Missing answer keys for questions: ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? '...' : ''}`);
    }
    const uncertainTypes = secQuestions.filter((q) => q.needsReview).length;
    if (uncertainTypes > 0) {
      warnings.push(`${uncertainTypes} questions flagged for teacher verification.`);
    }

    const recognizedTypes = Array.from(new Set(secQuestions.map((q) => q.type)));

    candidateTests.push({
      id: `candidate_${idx + 1}`,
      testIndex: idx + 1,
      title: secTitle,
      passageText,
      instructions: currentInstruction,
      questions: secQuestions,
      detectedAnswerKey,
      hasAnswerKeys: secQuestions.some((q) => Boolean(q.correctAnswer)),
      questionCount: secQuestions.length,
      recognizedTypes,
      warnings,
    });
  });

  // Consolidated primary structure
  const primaryPassage = candidateTests.map((c) => c.passageText).filter(Boolean).join('\n\n---\n\n');
  const allQuestions = candidateTests.flatMap((c) => c.questions);

  return {
    title: candidateTests[0]?.title || title,
    detectedSkill,
    passageText: primaryPassage,
    instructions: candidateTests[0]?.instructions || 'Read the text and answer the questions that follow.',
    questions: allQuestions,
    detectedAnswerKey,
    hasExistingQuestions: allQuestions.length > 0,
    candidateTests,
  };
}

function finalizeParsedQuestion(
  q: Partial<ReadingQuestion>,
  questions: ReadingQuestion[],
  detectedAnswerKey: Record<string, string>,
  instructionContext: string,
  wordLimitInfo: { limitStr?: string; maxWords?: number }
) {
  const qNum = q.id?.replace('q_', '') || `${questions.length + 1}`;
  const options = q.options && q.options.length > 0 ? q.options : undefined;
  const qType = q.type || detectQuestionType(q.prompt || '', instructionContext, options);

  const key = q.correctAnswer || detectedAnswerKey[qNum] || '';
  const confidence = key ? 'high' : 'needs_teacher_review';

  questions.push({
    id: q.id || `q_${questions.length + 1}`,
    type: qType,
    prompt: (q.prompt || '').trim(),
    options,
    wordLimit: q.wordLimit || wordLimitInfo.limitStr,
    maxWords: q.maxWords || wordLimitInfo.maxWords,
    correctAnswer: key,
    explanation: q.explanation || 'Extracted from source document.',
    points: q.points || 1,
    source: 'extracted_from_doc',
    answerKeyConfidence: confidence,
    needsReview: !key || qType === 'short_answer',
  });
}
