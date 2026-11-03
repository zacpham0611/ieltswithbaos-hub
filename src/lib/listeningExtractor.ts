import type {
  ListeningTestContent,
  ListeningPart,
  ListeningQuestionGroup,
  ListeningQuestion,
  ListeningQuestionType,
} from '../types/index.ts';

/**
 * Strips raw HTML entities, escaped characters, and SVG artifacts from listening text
 */
export function cleanListeningText(text?: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/svgFlag/gi, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

/**
 * Extracts questions, groups, and parts from raw listening test text (PDF / DOCX transcript / test papers).
 */

/**
 * Converts HTML table elements into standard Markdown tables with preserved column structure
 * and formatted gap markers [1], [2], etc.
 */
export function convertHtmlTablesToMarkdown(html: string): string {
  if (!html) return html;
  return html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_match, tableBody) => {
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rMatch: RegExpExecArray | null;
    const rows: string[][] = [];

    while ((rMatch = rowRegex.exec(tableBody)) !== null) {
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cMatch: RegExpExecArray | null;
      const cells: string[] = [];

      while ((cMatch = cellRegex.exec(rMatch[1])) !== null) {
        let cellText = cMatch[1]
          .replace(/<strong[^>]*>([0-9]{1,2})<\/strong>\s*[\u2026\.]{2,}/gi, '[$1]')
          .replace(/<strong[^>]*>([0-9]{1,2})<\/strong>/gi, '$1')
          .replace(/\b([0-9]{1,2})\s*[\u2026\.]{2,}/g, '[$1]')
          .replace(/\b([0-9]{1,2})\s*_{2,}/g, '[$1]')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();
        cells.push(cellText);
      }
      if (cells.some((c) => c.length > 0)) {
        rows.push(cells);
      }
    }

    if (rows.length === 0) return '';
    const maxCols = Math.max(...rows.map((r) => r.length));
    const normalizedRows = rows.map((r) => {
      while (r.length < maxCols) r.push('');
      return '| ' + r.join(' | ') + ' |';
    });
    const headerSep = '| ' + Array(maxCols).fill('---').join(' | ') + ' |';
    normalizedRows.splice(1, 0, headerSep);
    return '\n\n' + normalizedRows.join('\n') + '\n\n';
  });
}

/**
 * Transforms DOCX HTML output into clean text with structured Markdown tables
 */
export function htmlToListeningText(html: string): string {
  let text = convertHtmlTablesToMarkdown(html);
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n• $1\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n\n$1\n\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  return text;
}

export function parseListeningDocument(
  rawText: string,
  fileName: string = 'IELTS Listening Practice',
  htmlContent?: string
): ListeningTestContent {
  const sourceText = htmlContent && htmlContent.includes('<table') ? htmlToListeningText(htmlContent) : (rawText || '');
  const cleanText = sourceText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const allLines = cleanText.split('\n').map((l) => l.trim());

  // Extract detected answer keys if an ANSWER KEY section exists
  const detectedAnswerKey = extractListeningAnswerKey(cleanText);

  // Strip Answer Key section from test body lines to prevent Answer Key polluting the final section
  let contentLines = allLines;
  const akHeaderIdx = allLines.findIndex((l) => /^(?:Answer\s+key|Answers|Listening\s+Answers)\b/i.test(l));
  if (akHeaderIdx !== -1) {
    contentLines = allLines.slice(0, akHeaderIdx);
  }

  // Part markers regex: PART 1, SECTION 1, PART 2, etc.
  const partHeaderRegex = /^(?:PART|SECTION)\s+([1-4])\b/i;

  const rawParts: { partNumber: number; title: string; lines: string[] }[] = [];
  let currentPartIndex = 1;
  let currentPartLines: string[] = [];
  let hasFoundFirstPart = false;

  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i];
    const match = line.match(partHeaderRegex);
    if (match) {
      if (hasFoundFirstPart && currentPartLines.some((l) => l.trim().length > 0)) {
        rawParts.push({
          partNumber: currentPartIndex,
          title: `Part ${currentPartIndex}`,
          lines: currentPartLines,
        });
      }
      hasFoundFirstPart = true;
      currentPartLines = [];
      currentPartIndex = parseInt(match[1], 10);
    } else {
      currentPartLines.push(line);
    }
  }

  if (currentPartLines.some((l) => l.trim().length > 0)) {
    rawParts.push({
      partNumber: currentPartIndex,
      title: `Part ${currentPartIndex}`,
      lines: currentPartLines,
    });
  }

  // If no parts were explicitly detected, create Part 1 with all lines
  if (rawParts.length === 0) {
    rawParts.push({
      partNumber: 1,
      title: 'Part 1',
      lines: contentLines,
    });
  }

  // Process each part into question groups and questions
  const parts: ListeningPart[] = rawParts.map((rp) => {
    return processListeningPart(rp.partNumber, rp.title, rp.lines);
  });

  // Apply answer keys to questions
  for (const p of parts) {
    for (const q of p.questions) {
      const qNum = String(q.questionNumber || q.number || '');
      if (detectedAnswerKey[qNum]) {
        q.correctAnswer = detectedAnswerKey[qNum];
      }
    }
    for (const g of p.questionGroups) {
      for (const q of g.questions) {
        const qNum = String(q.questionNumber || q.number || '');
        if (detectedAnswerKey[qNum]) {
          q.correctAnswer = detectedAnswerKey[qNum];
        }
      }
    }
  }

  const totalQuestions = parts.reduce((sum, p) => sum + p.questions.length, 0);

  return {
    title: fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
    audioUrl: '',
    parts,
    totalQuestions: totalQuestions > 0 ? totalQuestions : 40,
  };
}

/**
 * Parses lines inside a single Listening part into structured question groups and questions.
 */
function processListeningPart(
  partNumber: number,
  title: string,
  lines: string[]
): ListeningPart {
  const questionGroups: ListeningQuestionGroup[] = [];
  const allQuestions: ListeningQuestion[] = [];

  // Group boundary regex: "Questions 1-5", "Questions 11 and 12", "Questions 6 - 10", etc.
  const groupRangeRegex = /^(?:Questions?)\s+([0-9]{1,2})\s*(?:[-–—to]+|\band\b|\&)\s*([0-9]{1,2})[\.\:\)]?\s*(.*)$/i;
  // Word limit regex: "Write NO MORE THAN TWO WORDS..."
  const wordLimitRegex = /(?:(?:Write\s+)?(?:NO MORE THAN\s+(?:ONE|TWO|THREE|FOUR|[1-4])\s+WORDS?|ONE\s+WORD\s+ONLY)(?:\s+AND\/OR\s+A\s+NUMBER)?)/i;

  let currentGroupId = `group_p${partNumber}_1`;
  let currentGroupTitle = '';
  let currentInstructions = '';
  let currentWordLimit = '';
  let currentType: ListeningQuestionType = inferQuestionTypeFromPart(partNumber);
  let currentGroupQuestions: ListeningQuestion[] = [];
  let currentGroupText = '';
  let currentGroupOptions: string[] = [];
  let currentExpectedRange: [number, number] | null = null;

  const finalizeGroup = () => {
    if (currentGroupQuestions.length > 0) {
      currentGroupQuestions.sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0));
      const firstNum = currentGroupQuestions[0]?.questionNumber || currentGroupQuestions[0]?.number || 1;
      const lastNum = currentGroupQuestions[currentGroupQuestions.length - 1]?.questionNumber || currentGroupQuestions[currentGroupQuestions.length - 1]?.number || currentGroupQuestions.length;
      
      const groupOpts = currentGroupOptions.length > 0 ? [...currentGroupOptions] : undefined;

      questionGroups.push({
        id: currentGroupId,
        part: partNumber as any,
        type: currentType,
        groupTitle: currentGroupTitle || `Questions ${firstNum} - ${lastNum}`,
        title: currentGroupTitle || `Questions ${firstNum} - ${lastNum}`,
        instructions: currentInstructions,
        wordLimit: currentWordLimit,
        options: groupOpts,
        questions: [...currentGroupQuestions],
        groupText: currentGroupText.trim() || undefined,
      });
      allQuestions.push(...currentGroupQuestions);
      currentGroupQuestions = [];
      currentGroupText = '';
      currentGroupOptions = [];
      currentExpectedRange = null;
    }
  };

  const isBlankPattern = /(?:[0-9]{1,2})\s*(?:[…\.]{2,}|_{2,}|\.{3,}|…+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Check for Question Group Header (e.g. Questions 1-5)
    const rangeMatch = line.match(groupRangeRegex);
    if (rangeMatch) {
      finalizeGroup();
      const startNum = parseInt(rangeMatch[1], 10);
      const endNum = parseInt(rangeMatch[2], 10);
      currentExpectedRange = [startNum, endNum];
      currentGroupId = `group_p${partNumber}_${startNum}_${endNum}`;
      currentGroupTitle = `Questions ${startNum}–${endNum}`;
      
      const restOfLine = rangeMatch[3] || '';
      currentInstructions = restOfLine.trim();

      const wlMatchInLine = line.match(wordLimitRegex);
      if (wlMatchInLine) {
        currentWordLimit = wlMatchInLine[0].toUpperCase();
      }

      currentType = inferQuestionTypeFromInstruction(line);

      // Check next line for instructions & word limit
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const wlMatch = nextLine.match(wordLimitRegex);
        if (wlMatch && !currentWordLimit) {
          currentWordLimit = wlMatch[0].toUpperCase();
        }
        if (/^(?:Complete|Choose|Write|Write NO MORE|How did)\b/i.test(nextLine)) {
          currentInstructions = (currentInstructions ? currentInstructions + ' ' : '') + nextLine;
          currentType = inferQuestionTypeFromInstruction(nextLine);
          i++; // skip next line as instruction
        }
      }
      continue;
    }

    // Check for word limit inside line if not yet found
    const wlMatch = line.match(wordLimitRegex);
    if (wlMatch && !currentWordLimit) {
      currentWordLimit = wlMatch[0].toUpperCase();
      currentInstructions = (currentInstructions ? currentInstructions + ' ' : '') + line;
      currentType = inferQuestionTypeFromInstruction(line);
      continue;
    }

    // Check for Shared Options for matching or multiple choice: "A They gave higher marks."
    const sharedOptMatch = line.match(/^([A-G])[\.\)\:\s\-]\s+(.*)$/i);
    if (sharedOptMatch && !line.includes('|') && !isBlankPattern.test(line)) {
      currentGroupOptions.push(`${sharedOptMatch[1].toUpperCase()}. ${sharedOptMatch[2].trim()}`);
      continue;
    }

    // Check for Multi-Select questions (e.g. Questions 18-20: Choose THREE letters, A-G)
    if (currentType === 'multiple_select' && currentExpectedRange) {
      const [startN, endN] = currentExpectedRange;
      const count = endN - startN + 1;
      if (/^(?:Which|What|Who|Where|When)\b/i.test(line)) {
        const multiPrompt = line.trim();
        const opts: string[] = [];
        let j = i + 1;
        while (j < lines.length) {
          const optL = lines[j];
          const om = optL.match(/^([A-G])[\.\)\:\s\-]\s*(.*)$/i);
          if (om) {
            opts.push(`${om[1].toUpperCase()}. ${om[2].trim()}`);
            j++;
          } else if (optL.startsWith('(')) {
            j++;
          } else {
            break;
          }
        }
        i = j - 1;

        for (let k = 0; k < count; k++) {
          const qNum = startN + k;
          currentGroupQuestions.push({
            id: `q_p${partNumber}_${qNum}`,
            number: qNum,
            questionNumber: qNum,
            part: partNumber as any,
            type: 'multiple_select',
            prompt: multiPrompt,
            options: opts,
            allowNumbers: false,
          });
        }
        continue;
      }
    }

    // Check for Standard Question: "1. Name of caller" or "11 Approximately how many passengers..."
    const standardQMatch = line.match(/^(?:(Question\s+)?([0-9]{1,2}))([\.\)\:\-]\s*|\s+)(.*)$/i);
    if (standardQMatch && !line.includes('|') && !isBlankPattern.test(line)) {
      const isExplicitQ = Boolean(standardQMatch[1]);
      const qNum = parseInt(standardQMatch[2], 10);
      const sep = standardQMatch[3];
      const hasPunctuation = /[\.\)\:\-]/.test(sep);
      let prompt = standardQMatch[4].trim();

      // Look ahead for multiple choice options (A, B, C...)
      const options: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const optLine = lines[j].trim();
        if (!optLine) {
          j++;
          continue;
        }
        const optMatch = optLine.match(/^([A-E])(?:[\.\)\:\-]\s*|\s+)(.*)$/i);
        if (optMatch) {
          options.push(`${optMatch[1].toUpperCase()}. ${optMatch[2].trim()}`);
          j++;
        } else {
          break;
        }
      }

      // If it doesn't have explicit "Question", doesn't have punctuation, and doesn't have MC options,
      // check if it's just a time of day like "7 p.m." or too short
      const isTimeOrShortUnit = /^(?:a\.?m\.?|p\.?m\.?|am|pm)$/i.test(prompt) || prompt.length < 3;
      if (!isExplicitQ && !hasPunctuation && options.length < 2 && isTimeOrShortUnit) {
        // Skip treating as a standard question
      } else {
        let qType = currentType;
        if (options.length >= 2) {
          qType = 'multiple_choice';
          currentType = 'multiple_choice';
          i = j - 1; // advance index
        }

        currentGroupQuestions.push({
          id: `q_p${partNumber}_${qNum}`,
          number: qNum,
          questionNumber: qNum,
          part: partNumber as any,
          type: qType,
          prompt: prompt || `Question ${qNum}`,
          options: options.length > 0 ? options : undefined,
          maxWords: parseWordCount(currentWordLimit),
          allowNumbers: !currentWordLimit.toLowerCase().includes('only words'),
        });
        continue;
      }
    }

    // Check for Table Rows: lines with |
    if (line.includes('|')) {
      // Clean blank markers in table cells so the table displays visual badges [1], [2], etc.
      const formattedTableLine = line.replace(
        /(?:<strong[^>]*>([0-9]{1,2})<\/strong>\s*[\u2026\.]{2,}|\b([0-9]{1,2})\s*(?:[…\.]{2,}|_{2,}|\.{3,}|…+))/g,
        '[$1$2]'
      );
      currentGroupText += (currentGroupText ? '\n' : '') + formattedTableLine;

      // Table matching row: | 25 male students marking female presenters | |
      const matchRow = line.match(/^\|\s*([0-9]{1,2})\s+([^|]+)\|/);
      if (matchRow) {
        const qNum = parseInt(matchRow[1], 10);
        const prompt = matchRow[2].trim();
        currentType = 'matching';
        currentGroupQuestions.push({
          id: `q_p${partNumber}_${qNum}`,
          number: qNum,
          questionNumber: qNum,
          part: partNumber as any,
          type: 'matching',
          prompt,
          options: currentGroupOptions.length > 0 ? currentGroupOptions : undefined,
        });
        continue;
      }

      // Table completion cells with blanks: e.g. | the 1 ………… | or | [1] | or | 31 ………… languages |
      const cellMatches = Array.from(line.matchAll(/(?:\[([0-9]{1,2})\]|\b([0-9]{1,2})\s*(?:[…\.]{2,}|_{2,}|\.{3,}|…+))/g));
      if (cellMatches.length > 0) {
        currentType = 'table_completion';
        for (const cm of cellMatches) {
          const qNum = parseInt(cm[1] || cm[2], 10);
          currentGroupQuestions.push({
            id: `q_p${partNumber}_${qNum}`,
            number: qNum,
            questionNumber: qNum,
            part: partNumber as any,
            type: 'table_completion',
            prompt: `Question ${qNum}`,
            maxWords: parseWordCount(currentWordLimit),
            allowNumbers: !currentWordLimit.toLowerCase().includes('only words'),
          });
        }
        continue;
      }

      continue;
    }

    // Check for Sentences or Notes with inline blanks: e.g. "This year, activities end by 7 ………… p.m."
    const inlineBlankMatch = line.match(/^(.*?)\b([0-9]{1,2})\s*(?:[…\.]{2,}|_{2,}|\.{3,}|…+)(.*?)$/);
    if (inlineBlankMatch) {
      const qNum = parseInt(inlineBlankMatch[2], 10);
      const prefix = inlineBlankMatch[1].replace(/^[•\-\*\s]+/, '').trim();
      const suffix = inlineBlankMatch[3].trim();
      const prompt = `${prefix ? prefix + ' ' : ''}_____${suffix ? ' ' + suffix : ''}`.trim();

      currentGroupQuestions.push({
        id: `q_p${partNumber}_${qNum}`,
        number: qNum,
        questionNumber: qNum,
        part: partNumber as any,
        type: currentType === 'form_completion' ? 'form_completion' : 'note_completion',
        prompt,
        maxWords: parseWordCount(currentWordLimit),
        allowNumbers: !currentWordLimit.toLowerCase().includes('only words'),
      });
      continue;
    }

    // Accumulate text into group context / layout
    if (line.length > 3 && !line.toLowerCase().startsWith('answer key')) {
      currentGroupText += (currentGroupText ? '\n' : '') + line;
    }
  }

  finalizeGroup();

  // If no questions were parsed, create a default set based on standard part sizing (10 questions per part)
  if (allQuestions.length === 0) {
    const startNum = (partNumber - 1) * 10 + 1;
    const defaultQs: ListeningQuestion[] = [];
    for (let k = 0; k < 10; k++) {
      const qNum = startNum + k;
      defaultQs.push({
        id: `q_p${partNumber}_${qNum}`,
        number: qNum,
        questionNumber: qNum,
        part: partNumber as any,
        type: inferQuestionTypeFromPart(partNumber),
        prompt: `Question ${qNum}`,
        maxWords: 2,
        allowNumbers: true,
      });
    }
    const defaultGroup: ListeningQuestionGroup = {
      id: `group_p${partNumber}_auto`,
      part: partNumber as any,
      type: inferQuestionTypeFromPart(partNumber),
      title: `Questions ${startNum} - ${startNum + 9}`,
      instructions: 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
      wordLimit: 'NO MORE THAN TWO WORDS AND/OR A NUMBER',
      questions: defaultQs,
    };
    return {
      partNumber: partNumber as any,
      title: title || `Section ${partNumber}`,
      audioUrl: '',
      questions: defaultQs,
      questionGroups: [defaultGroup],
    };
  }

  return {
    partNumber: partNumber as any,
    title: title || `Section ${partNumber}`,
    audioUrl: '',
    questions: allQuestions,
    questionGroups,
  };
}

/**
 * Informs standard IELTS listening question types according to official part specifications:
 * - Part 1: Form / Note completion (Everyday social dialogue)
 * - Part 2: Multiple choice / Map / Plan labelling (Monologue in social context)
 * - Part 3: Multiple choice / Matching (Discussion between up to 4 people in educational context)
 * - Part 4: Note / Summary / Flow-chart completion (Academic lecture monologue)
 */
function inferQuestionTypeFromPart(partNumber: number): ListeningQuestionType {
  switch (partNumber) {
    case 1:
      return 'form_completion';
    case 2:
      return 'multiple_choice';
    case 3:
      return 'multiple_choice';
    case 4:
      return 'note_completion';
    default:
      return 'note_completion';
  }
}

function inferQuestionTypeFromInstruction(instruction: string): ListeningQuestionType {
  const lower = instruction.toLowerCase();
  if (
    lower.includes('choose two') ||
    lower.includes('choose 2') ||
    lower.includes('choose three') ||
    lower.includes('choose 3') ||
    lower.includes('choose four') ||
    lower.includes('two letters') ||
    lower.includes('three letters') ||
    lower.includes('four letters') ||
    lower.includes('chọn hai') ||
    lower.includes('chọn ba') ||
    lower.includes('chọn 2') ||
    lower.includes('chọn 3') ||
    lower.includes('multiple select')
  ) {
    return 'multiple_select';
  }
  if (
    lower.includes('choose the correct letter') ||
    lower.includes('multiple choice') ||
    lower.includes('chọn đáp án đúng')
  ) {
    return 'multiple_choice';
  }
  if (
    lower.includes('map') ||
    lower.includes('plan') ||
    lower.includes('diagram') ||
    lower.includes('label') ||
    lower.includes('sơ đồ') ||
    lower.includes('bản đồ')
  ) {
    return 'plan_map_diagram_labelling';
  }
  if (lower.includes('flow-chart') || lower.includes('flowchart') || lower.includes('lưu đồ')) {
    return 'flowchart_completion';
  }
  if (lower.includes('table') || lower.includes('bảng')) {
    return 'table_completion';
  }
  if (lower.includes('form') || lower.includes('biểu mẫu') || lower.includes('đơn vị')) {
    return 'form_completion';
  }
  if (lower.includes('summary') || lower.includes('tóm tắt')) {
    return 'summary_completion';
  }
  if (lower.includes('matching') || lower.includes('match') || lower.includes('nối')) {
    return 'matching';
  }
  if (lower.includes('sentence') || lower.includes('câu')) {
    return 'sentence_completion';
  }
  if (lower.includes('short answer') || lower.includes('câu hỏi ngắn')) {
    return 'short_answer';
  }
  return 'note_completion';
}

function parseWordCount(wordLimitStr: string): number | undefined {
  if (!wordLimitStr) return undefined;
  const lower = wordLimitStr.toLowerCase();
  if (lower.includes('one word') || lower.includes('1 word')) return 1;
  if (lower.includes('two words') || lower.includes('2 words')) return 2;
  if (lower.includes('three words') || lower.includes('3 words')) return 3;
  return undefined;
}

/**
 * Extracts answer keys from text sections like "ANSWER KEY", "Listening Answers", etc.
 */
export function extractListeningAnswerKey(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lower = text.toLowerCase();
  const keyIndex = lower.indexOf('answer key');
  const targetText = keyIndex !== -1 ? text.substring(keyIndex) : text;
  const lines = targetText.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. Check for range in text: "Questions 18–20 are A, F and G in any order"
  const rangeRegex = /(?:Questions?|Q)?\s*([0-9]{1,2})\s*[-–—to]+\s*([0-9]{1,2})\s+are\s+([A-G,\s]+(?:\s+and\s+[A-G])?)\s+in\s+any\s+order/gi;
  let rangeMatch;
  while ((rangeMatch = rangeRegex.exec(targetText)) !== null) {
    const startQ = parseInt(rangeMatch[1], 10);
    const endQ = parseInt(rangeMatch[2], 10);
    const rawTokens = rangeMatch[3].replace(/\band\b/gi, ',').split(',').map((s) => s.trim()).filter(Boolean);
    const count = endQ - startQ + 1;
    for (let k = 0; k < count; k++) {
      const qNum = String(startQ + k);
      if (rawTokens[k]) {
        result[qNum] = rawTokens[k];
      } else if (rawTokens.length > 0) {
        result[qNum] = rawTokens.join(', ');
      }
    }
  }

  // 2. Check for Markdown / Pipe-separated Table rows: | 1 | theatre | 11 | C |
  for (const line of lines) {
    if (line.includes('|')) {
      const cells = line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (/^[0-9]{1,2}$/.test(cell)) {
          const qNum = cell;
          const nextCell = cells[i + 1];
          if (nextCell && !/^[0-9]{1,2}$/.test(nextCell) && !/^(?:Section|Part|Q|Questions?)\b/i.test(nextCell)) {
            result[qNum] = nextCell;
            i++; // skip next cell
          }
        }
      }
    }
  }

  // 3. Fallback for standard line patterns: "1. theatre", "1) theatre", "1: theatre"
  // Note: negative lookahead \.(?![0-9]) prevents matching decimal numbers / times like 4.30 or 11.15 as Q4 / Q11
  const lineRegex = /(?:^|\n)\s*([0-9]{1,2})\s*(?:[\)\:\-]|\.(?![0-9]))\s*([^\n\r|]+)/g;
  let match;
  while ((match = lineRegex.exec(targetText)) !== null) {
    const qNum = match[1].trim();
    let ans = match[2].trim();
    ans = ans.replace(/\s*\(.*?\)\s*$/, '').trim();
    if (ans && !result[qNum] && !/^(?:Section|Part|Questions?)\b/i.test(ans)) {
      result[qNum] = ans;
    }
  }

  // 4. Sequential raw text tokens from document tables without pipes:
  // e.g. "1 \n theatre \n 11 \n C \n 2 \n 4.30"
  if (Object.keys(result).length < 35) {
    for (let i = 0; i < lines.length - 1; i++) {
      const cell = lines[i];
      if (/^[0-9]{1,2}$/.test(cell)) {
        const qNum = parseInt(cell, 10);
        if (qNum >= 1 && qNum <= 40 && !result[String(qNum)]) {
          const nextCell = lines[i + 1];
          if (
            nextCell &&
            !/^[0-9]{1,2}$/.test(nextCell) &&
            !/^(?:Section|Part|Q|Questions?)\b/i.test(nextCell) &&
            nextCell.length < 100
          ) {
            result[String(qNum)] = nextCell;
          }
        }
      }
    }
  }

  return result;
}
