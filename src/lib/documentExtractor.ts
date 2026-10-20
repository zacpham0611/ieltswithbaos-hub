import { ReadingQuestion, QuestionType, AssignmentSkill } from '../types';

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

export interface DocumentStructure {
  title: string;
  detectedSkill: AssignmentSkill;
  passageText: string;
  instructions: string;
  questions: ReadingQuestion[];
  detectedAnswerKey: Record<string, string>;
  hasExistingQuestions: boolean;
}

/**
 * Validates whether the file is an accepted document format
 */
export function validateDocumentFile(file: File): { valid: boolean; error?: string; type: ExtractedDocument['type'] } {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const maxSizeBytes = 20 * 1024 * 1024; // 20 MB

  if (file.size > maxSizeBytes) {
    return { valid: false, error: 'File size exceeds 20MB limit.', type: 'unknown' };
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

    // A multi-page document with virtually zero extracted characters is a scanned image
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
 * Heuristic parser that analyzes the document structure, identifying
 * reading passages, instructions, numbered questions, answer choices, and answer keys.
 */
export function parseDocumentStructure(rawText: string, fallbackName: string): DocumentStructure {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  let title = fallbackName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  let detectedSkill: AssignmentSkill = 'reading';
  let instructions = 'Read the text and answer the questions that follow.';
  let passageText = '';
  const questions: ReadingQuestion[] = [];
  const detectedAnswerKey: Record<string, string> = {};

  // Detect skill keywords
  const lowerAll = rawText.toLowerCase();
  if (lowerAll.includes('listening section') || lowerAll.includes('audio track')) {
    detectedSkill = 'reading'; // IELTS Hub assigns listening with reading-style questions
  } else if (lowerAll.includes('writing task 1') || lowerAll.includes('writing task 2')) {
    detectedSkill = 'writing';
  } else if (lowerAll.includes('speaking part 1') || lowerAll.includes('cue card')) {
    detectedSkill = 'speaking';
  }

  // Detect Answer Key section
  let answerKeyStartIndex = -1;
  const answerKeyRegex = /^(answer\s*key|answers|dap\s*an|đáp\s*án)[:\s]*$/i;
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

  // Detect Questions vs Passage
  const contentLines = answerKeyStartIndex !== -1 ? lines.slice(0, answerKeyStartIndex) : lines;
  const questionNumberRegex = /^(?:Question\s+)?(\d+)[\.\:\)]\s+(.*)/i;

  let currentQuestion: Partial<ReadingQuestion> | null = null;
  const passageLines: string[] = [];

  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i];

    // Check if line is the start of a question
    const qMatch = line.match(questionNumberRegex);
    if (qMatch) {
      if (currentQuestion && currentQuestion.prompt) {
        finalizeQuestion(currentQuestion, questions, detectedAnswerKey);
      }

      const qNum = qMatch[1];
      const qText = qMatch[2];

      currentQuestion = {
        id: `q_${qNum}`,
        prompt: qText,
        options: [],
        type: 'multiple_choice',
        correctAnswer: detectedAnswerKey[qNum] || '',
        explanation: 'Extracted from source document.',
        source: 'extracted_from_doc',
        answerKeyConfidence: detectedAnswerKey[qNum] ? 'high' : 'needs_teacher_review',
        points: 1,
      };
      continue;
    }

    // If inside a question, check for options (A, B, C, D)
    if (currentQuestion) {
      const optMatch = line.match(/^([A-D])[\.\:\)]\s+(.*)/i);
      if (optMatch) {
        currentQuestion.options = currentQuestion.options || [];
        currentQuestion.options.push(`${optMatch[1].toUpperCase()}. ${optMatch[2]}`);
        continue;
      }

      // True / False / Not Given detection
      if (/^(TRUE|FALSE|NOT GIVEN|YES|NO)$/i.test(line)) {
        if (line.toUpperCase() === 'YES' || line.toUpperCase() === 'NO') {
          currentQuestion.type = 'yes_no_not_given';
        } else {
          currentQuestion.type = 'true_false_not_given';
        }
        continue;
      }

      // Append additional prompt text
      currentQuestion.prompt += ' ' + line;
    } else {
      // Accumulate passage text before the first question
      passageLines.push(line);
    }
  }

  if (currentQuestion && currentQuestion.prompt) {
    finalizeQuestion(currentQuestion, questions, detectedAnswerKey);
  }

  passageText = passageLines.join('\n\n');

  // If title was in the first line, refine
  if (passageLines.length > 0 && passageLines[0].length < 100) {
    title = passageLines[0];
  }

  return {
    title,
    detectedSkill,
    passageText,
    instructions,
    questions,
    detectedAnswerKey,
    hasExistingQuestions: questions.length > 0,
  };
}

function finalizeQuestion(
  q: Partial<ReadingQuestion>,
  questions: ReadingQuestion[],
  detectedAnswerKey: Record<string, string>
) {
  const qNum = q.id?.replace('q_', '') || `${questions.length + 1}`;
  let qType: QuestionType = q.type || 'multiple_choice';

  if (!q.options || q.options.length === 0) {
    const promptLower = (q.prompt || '').toLowerCase();
    if (promptLower.includes('true') || promptLower.includes('false')) {
      qType = 'true_false_not_given';
    } else if (promptLower.includes('yes') || promptLower.includes('no')) {
      qType = 'yes_no_not_given';
    } else if (promptLower.includes('complete the sentence') || promptLower.includes('fill')) {
      qType = 'sentence_completion';
    } else {
      qType = 'short_answer';
    }
  }

  questions.push({
    id: q.id || `q_${questions.length + 1}`,
    type: qType,
    prompt: (q.prompt || '').trim(),
    options: q.options && q.options.length > 0 ? q.options : undefined,
    correctAnswer: q.correctAnswer || detectedAnswerKey[qNum] || '',
    explanation: q.explanation || 'Extracted from source document.',
    points: q.points || 1,
    source: 'extracted_from_doc',
    answerKeyConfidence: detectedAnswerKey[qNum] ? 'high' : 'needs_teacher_review',
    needsReview: !detectedAnswerKey[qNum],
  });
}
