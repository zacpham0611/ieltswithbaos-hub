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
    .replace(/<svg[^>]*>|<\/svg>/gi, '')
    .replace(/svgFlag/gi, '')
    // Fix serialized svg glued to question numbers, punctuation, or words
    .replace(/(?<=[0-9\*_\]\)])svg(?=[a-zA-Z])/gi, ' ')
    .replace(/(?<=[0-9\*_\]\)])svg(?=[^a-zA-Z0-9\s]|\b)/gi, '')
    .replace(/\bsvg\b/gi, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

/**
 * Normalizes multi-row listening structured text by restoring newlines between concatenated table rows / key-value lines
 */
export function normalizeListeningStructuredText(text: string): string {
  if (!text) return '';
  let cleaned = cleanListeningText(text);

  // 1. Separate table separator rows from following content if glued together
  // e.g. "--- | --- Children: | 20 in a class" -> "--- | ---\nChildren: | 20 in a class"
  cleaned = cleaned.replace(/(?:^|\s)(:?-{2,}:?(?:\s*\|\s*:?-{2,}:?)+\s*\|?)\s+(?=[A-Za-z0-9])/gi, '\n$1\n');

  // 2. Separate pipe table rows glued on the same line
  // Matches a capitalized label (1 to 5 words e.g. "Classes:", "Hours & Days:", "Activities:", "Example:") immediately preceding ': |'
  const labelBoundaryRegex = /(?<=\S)\s+((?:[A-Z][a-zA-Z0-9/&()\-–]*(?:\s+(?:&|and|of|in|for|[A-Z][a-zA-Z0-9/&()\-–]*)){0,4}|Example):)\s*\|/g;
  cleaned = cleaned.replace(labelBoundaryRegex, '\n$1 |');

  // 3. Separate pipe lines where closing pipe is glued to next pipe e.g. "| text | | next |" -> "| text |\n| next |"
  cleaned = cleaned.replace(/\|\s+(?=\|)/g, '|\n');

  return cleaned.trim();
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
        let cellHtml = cMatch[1]
          .replace(/<strong[^>]*>([0-9]{1,2})<\/strong>\s*[\u2026\.]{2,}/gi, '[$1]')
          .replace(/<strong[^>]*>([0-9]{1,2})<\/strong>/gi, '$1')
          .replace(/\b([0-9]{1,2})[\.\:\)]?\s*(?:[\$£€¥]|(?:every|in|at|by|for|the|a|an)\s+)*(?:[…\.]{2,}|_{2,}|\.{3,}|…+)/gi, '[$1]')
          .replace(/(?:[…\.]{2,}|_{2,}|\.{3,}|…+)\s*(?:\([Qq]?\s*([0-9]{1,2})\)|\[([0-9]{1,2})\]|\b([0-9]{1,2})\b)/gi, '[$1$2$3]')
          .replace(/\b([0-9]{1,2})\s*[\u2026\.]{2,}/g, '[$1]')
          .replace(/\b([0-9]{1,2})\s*_{2,}/g, '[$1]');

        let cellText = cellHtml
          .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n• $1\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim();

        cells.push(cellText);
      }
      if (cells.some((c) => c.length > 0)) {
        rows.push(cells);
      }
    }

    if (rows.length === 0) return '';
    const maxCols = Math.max(...rows.map((r) => r.length));

    // If table is 1x1 (a single-cell callout or notes container box), do not convert to Markdown table
    if (rows.length === 1 && maxCols === 1) {
      return '\n\n' + rows[0][0] + '\n\n';
    }

    const normalizedRows = rows.map((r) => {
      while (r.length < maxCols) r.push('');
      // In authentic multi-column tables, preserve multi-line cell content using <br />
      const cleanCells = r.map((c) =>
        c
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .join('<br />')
      );
      return '| ' + cleanCells.join(' | ') + ' |';
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
  // Protect <br /> tags inside markdown table rows so they do not break table rows
  text = text.replace(/\|([^\n]+)\|/g, (match) => {
    return match.replace(/<br\s*\/?>/gi, '___CELL_BR___');
  });
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
  text = text.replace(/___CELL_BR___/g, '<br />');
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
  const akHeaderIdx = allLines.findIndex((l) =>
    /^(?:#+\s*)?(?:answer\s*keys?|listening\s*answers?|\banswers(?:\s+for\s+listening)?\b|đáp\s*án(?:\s*[-–—:]\s*key\s*listening)?|key\s*listening)\b/i.test(l.trim())
  );
  if (akHeaderIdx !== -1) {
    contentLines = allLines.slice(0, akHeaderIdx);
  }

  // Part markers regex: PART 1, SECTION 1, Part 1:, Listening Section 2, etc.
  const partHeaderRegex = /(?:\b(?:PART|SECTION)\s*([1-4])\b|^([1-4])\b\s*(?:st|nd|rd|th)?\s*(?:Part|Section))/i;

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
      const parsedPartNum = parseInt(match[1] || match[2], 10);
      currentPartIndex = !isNaN(parsedPartNum) && parsedPartNum >= 1 && parsedPartNum <= 4 ? parsedPartNum : currentPartIndex;
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
 * Detects whether a line is an IELTS Listening question-type banner/header
 * (e.g. "GROUP 1: MULTIPLE CHOICE LISTENING-G1", "COMMENTS / OPINIONS", "QUY TẮC THUẬT TOÁN...")
 * so it is not treated as a question prompt or option.
 */
export function isListeningTypeBannerLine(line: string): boolean {
  const cleaned = line.replace(/^[\|\s]+|[\|\s]+$/g, '').trim();
  if (!cleaned) return false;
  if (/^GROUP\s+\d+\s*:/i.test(cleaned)) return true;
  if (/LISTENING-G\d+/i.test(cleaned)) return true;
  if (/^QUY\s+TẮC\s+THUẬT\s+TOÁN/i.test(cleaned)) return true;
  if (/^TYPE-\d+/i.test(cleaned)) return true;
  if (/^(?:DẠNG\s+CÂU\s+HỎI|QUESTION\s+TYPE)\s*[:\-]/i.test(cleaned)) return true;
  if (/^(?:COMMENTS?\s*\/\s*OPINIONS?|OPTIONS?|LIST\s+OF\s+OPTIONS?)\b/i.test(cleaned)) return true;
  return false;
}

/**
 * Robustly extracts single or multiple options from an option line in IELTS Listening.
 * Handles single option per line ("A To inquire about room availability")
 * as well as multi-option lines ("A Underground parking B High-speed internet").
 */
export function extractListeningOptionsFromLine(line: string): string[] {
  const clean = line.replace(/^\|\s*/, '').replace(/\s*\|$/, '').trim();
  if (!clean || isListeningTypeBannerLine(clean)) return [];

  // Guard against headers and map/diagram layout labels
  if (/^(?:PART|SECTION|GROUP|Questions?|COMMENTS?|OPINIONS?|LIST\s+OF|LOOK\s+AT)\b/i.test(clean)) {
    return [];
  }
  if (/Location\s*\[\s*[A-Z]\s*\]/i.test(clean) || /\[\s*[A-Z]\s*\]\s*Location/i.test(clean)) {
    return [];
  }

  // 1. Multiple options on the same line, e.g.:
  // "A Underground parking B High-speed internet"
  // "A Recently renovated B Overcrowded at weekends"
  const multiOptRegex = /(?:^|\s{2,}|\t|\s+)([A-H])(?:[\.\)\:\-]\s*|\s+)(.*?)(?=(?:\s{2,}|\t|\s+)[A-H](?:[\.\)\:\-]\s*|\s+)|\s*$)/g;
  const multiMatches = Array.from(clean.matchAll(multiOptRegex));
  if (multiMatches.length >= 2) {
    const opts = multiMatches
      .map((m) => `${m[1].toUpperCase()}. ${m[2].trim()}`)
      .filter((s) => s.length > 3 && !/^[A-H]\s*\]/.test(s));
    if (opts.length >= 2) return opts;
  }

  // 2. Single option on the line:
  // "A To inquire about room availability" or "A entry is free..." or "A. To inquire..."
  const singleOptMatch = clean.match(/^[•\-\*\s\u2022]*([A-H])(?:[\.\)\:\-]\s*|\s+)(.*)$/);
  if (singleOptMatch && singleOptMatch[2].trim().length > 1) {
    const letter = singleOptMatch[1].toUpperCase();
    const text = singleOptMatch[2].trim();
    const firstWord = clean.split(/\s+/)[0].toLowerCase();
    const isCommonWord = /^(?:at|in|on|to|by|is|it|as|an|all|and|are|do|for|he|his|her|how|if|no|not|or|so|the|we|who|why|when|where|with|what|you|your)$/i.test(firstWord);
    if (!isCommonWord || /^[A-H][\.\)\:\-]/.test(clean)) {
      return [`${letter}. ${text}`];
    }
  }

  return [];
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

  // Group boundary regex: "Questions 1-5", "Questions 11 and 12", "DẠNG CÂU HỎI: ... - Questions 1-6", etc.
  const groupRangeRegex = /(?:^|[-–—:|\s])Questions?\s+([0-9]{1,2})\s*(?:[-–—to]+|\band\b|\&)\s*([0-9]{1,2})(?:[\.\:\)]|\b)\s*(.*)$/i;
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
    // If multiple_select group had options collected but questions not yet created:
    if (
      currentType === 'multiple_select' &&
      currentGroupQuestions.length === 0 &&
      currentExpectedRange
    ) {
      const [startN, endN] = currentExpectedRange;
      const count = endN - startN + 1;
      const groupOpts = currentGroupOptions.length > 0 ? [...currentGroupOptions] : undefined;
      for (let k = 0; k < count; k++) {
        const qNum = startN + k;
        currentGroupQuestions.push({
          id: `q_p${partNumber}_${qNum}`,
          number: qNum,
          questionNumber: qNum,
          part: partNumber as any,
          type: 'multiple_select',
          prompt: currentInstructions || `Questions ${startN}-${endN}`,
          options: groupOpts,
          allowNumbers: false,
        });
      }
    }

    if (currentGroupQuestions.length > 0) {
      currentGroupQuestions.sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0));
      const firstNum = currentGroupQuestions[0]?.questionNumber || currentGroupQuestions[0]?.number || 1;
      const lastNum = currentGroupQuestions[currentGroupQuestions.length - 1]?.questionNumber || currentGroupQuestions[currentGroupQuestions.length - 1]?.number || currentGroupQuestions.length;
      
      let groupOpts = currentGroupOptions.length > 0 ? [...currentGroupOptions] : undefined;

      // Extract letter ranges from instructions if groupOpts is empty (e.g. "A–E" or "A to F")
      if (!groupOpts || groupOpts.length === 0) {
        const letterRangeMatch = currentInstructions.match(/\b([A-Z])\s*[-–—to]+\s*([A-Z])\b/i);
        if (letterRangeMatch) {
          const startChar = letterRangeMatch[1].toUpperCase().charCodeAt(0);
          const endChar = letterRangeMatch[2].toUpperCase().charCodeAt(0);
          if (endChar > startChar && endChar - startChar <= 10) {
            const generatedOpts: string[] = [];
            for (let c = startChar; c <= endChar; c++) {
              generatedOpts.push(String.fromCharCode(c));
            }
            groupOpts = generatedOpts;
          }
        }
      }

      // Assign matching/shared options to questions if missing
      if (groupOpts) {
        currentGroupQuestions.forEach((q) => {
          if (
            (q.type === 'matching' || q.type === 'plan_map_diagram_labelling' || currentType === 'matching' || currentType === 'plan_map_diagram_labelling') &&
            (!q.options || q.options.length === 0)
          ) {
            q.options = [...groupOpts];
          }
        });
      }

      // Clean trailing answer-sheet tags like [ 5 ], [ 8 ] or underscores
      currentGroupQuestions.forEach((q) => {
        if (q.prompt) {
          q.prompt = q.prompt.replace(/\[\s*\d{1,2}\s*\]\s*$/, '').trim();
          if (q.type === 'short_answer') {
            q.prompt = q.prompt.replace(/(?:[…\.]{2,}|_{2,}|\.{3,}|…+)\s*$/, '').trim();
          }
        }
      });

      const resolvedGroupType =
        currentGroupQuestions.length > 0 && currentGroupQuestions.every((q) => q.type === currentGroupQuestions[0].type)
          ? currentGroupQuestions[0].type
          : currentType;

      questionGroups.push({
        id: currentGroupId,
        part: partNumber as any,
        type: resolvedGroupType,
        groupTitle: currentGroupTitle || `Questions ${firstNum} - ${lastNum}`,
        title: currentGroupTitle || `Questions ${firstNum} - ${lastNum}`,
        instructions: currentInstructions,
        wordLimit: currentWordLimit,
        options: groupOpts,
        optionsBox: groupOpts,
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

    // Skip standalone question-type banner headers so they are never parsed as questions
    if (isListeningTypeBannerLine(line) && !groupRangeRegex.test(line)) {
      finalizeGroup();
      const bannerType = inferQuestionTypeFromInstruction(line);
      if (bannerType) {
        currentType = bannerType;
      }
      continue;
    }

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

      // Check next lines for instructions & word limit
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (!nextLine) {
          i++;
          continue;
        }
        if (isListeningTypeBannerLine(nextLine)) {
          break;
        }
        const wlMatch = nextLine.match(wordLimitRegex);
        if (wlMatch && !currentWordLimit) {
          currentWordLimit = wlMatch[0].toUpperCase();
        }
        if (
          /^(?:Complete|Choose|Write|Write NO MORE|How did|Look at|Label|Answer|In boxes|Questions?|What|Which|Who|Where)\b/i.test(nextLine) ||
          wordLimitRegex.test(nextLine)
        ) {
          currentInstructions = (currentInstructions ? currentInstructions + ' ' : '') + nextLine;
          i++; // skip next line as instruction
        } else {
          break;
        }
      }

      // Determine question type from the combined header + instruction lines
      const fullHeaderContext = `${line} ${currentInstructions}`.trim();
      currentType = inferQuestionTypeFromInstruction(fullHeaderContext);
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

    // Check for options table title row, e.g. "| Types of Products |"
    if (/^\|\s*(?:types\s+of|options|features|list\s+of|categories|reasons|statements|opinions|causes|effects|actions)\b/i.test(line)) {
      continue;
    }

    // Check for Shared Options for matching or multiple choice: "A They gave higher marks." or "| A They gave higher marks. |"
    const foundSharedOpts = extractListeningOptionsFromLine(line);
    if (foundSharedOpts.length > 0 && !isBlankPattern.test(line)) {
      foundSharedOpts.forEach((opt) => {
        if (!currentGroupOptions.some((o) => o.startsWith(opt.substring(0, 2)))) {
          currentGroupOptions.push(opt);
        }
      });
      continue;
    }

    // Check for Multi-Select questions (e.g. Questions 18-20: Choose THREE letters, A-G)
    if (currentType === 'multiple_select' && currentExpectedRange) {
      const [startN, endN] = currentExpectedRange;
      const count = endN - startN + 1;
      const inlineOpts = extractListeningOptionsFromLine(line);
      const isHeaderLine = /^(?:PART|SECTION|Questions?|GROUP)\b/i.test(line) || isListeningTypeBannerLine(line);
      if (inlineOpts.length === 0 && !isHeaderLine && currentGroupQuestions.length === 0) {
        let multiPrompt = line.trim();
        const opts: string[] = [];
        let j = i + 1;
        while (j < lines.length) {
          const optL = lines[j].trim();
          if (!optL) {
            j++;
            continue;
          }
          if (groupRangeRegex.test(optL) || isListeningTypeBannerLine(optL) || /^(?:PART|SECTION|GROUP|Questions?)\b/i.test(optL)) {
            break;
          }
          const found = extractListeningOptionsFromLine(optL);
          if (found.length > 0) {
            found.forEach((o) => {
              if (!opts.some((existing) => existing.startsWith(o.substring(0, 2)))) {
                opts.push(o);
              }
            });
            j++;
          } else if (opts.length === 0) {
            multiPrompt = `${multiPrompt} ${optL}`;
            j++;
          } else {
            break;
          }
        }
        i = j - 1;

        if (opts.length > 0) {
          currentGroupOptions = [...opts];
        }

        const cleanPrompt = multiPrompt.replace(/^(?:Questions?\s+)?\d{1,2}\s*[-–—to]+\s*\d{1,2}[\.\:\)]?\s*/i, '').trim();

        for (let k = 0; k < count; k++) {
          const qNum = startN + k;
          currentGroupQuestions.push({
            id: `q_p${partNumber}_${qNum}`,
            number: qNum,
            questionNumber: qNum,
            part: partNumber as any,
            type: 'multiple_select',
            prompt: cleanPrompt || currentInstructions || `Questions ${startN}-${endN}`,
            options: opts.length > 0 ? opts : undefined,
            allowNumbers: false,
            multipleSelectCount: count,
          } as any);
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

      // Accumulate continuation lines for multi-line prompts before options appear
      while (j < lines.length) {
        const nextL = lines[j].trim();
        if (!nextL) {
          j++;
          continue;
        }
        const isOpt = /^[•\-\*\s\u2022]*[A-Za-z](?:[\.\)\:\-]\s*|\s+)/i.test(nextL);
        if (isOpt) break;
        const isNextQ = /^(?:Question\s+)?[0-9]{1,2}[\.\)\:\-]/i.test(nextL);
        const isHeader = /^(?:PART|SECTION|Questions?)\b/i.test(nextL);
        if (isNextQ || isHeader || nextL.includes('|')) break;

        // Check if an option appears shortly after this line
        let hasOptionShortly = false;
        for (let lookK = j + 1; lookK <= Math.min(j + 3, lines.length - 1); lookK++) {
          if (/^[•\-\*\s\u2022]*[A-Ca-c](?:[\.\)\:\-]\s*|\s+)/i.test(lines[lookK].trim())) {
            hasOptionShortly = true;
            break;
          }
        }
        if (hasOptionShortly) {
          prompt = `${prompt} ${nextL}`;
          j++;
        } else {
          break;
        }
      }

      while (j < lines.length) {
        const optLine = lines[j].trim();
        if (!optLine) {
          j++;
          continue;
        }
        const found = extractListeningOptionsFromLine(optLine);
        if (found.length > 0) {
          options.push(...found);
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
        } else if (prompt.endsWith('?') && options.length === 0) {
          qType = 'short_answer';
        } else if (currentType === 'sentence_completion') {
          prompt = prompt.replace(/(?:[…\.]{2,}|_{2,}|\.{3,}|…+)/g, '_____');
        }

        // Clean answer sheet tags and trailing blanks
        prompt = prompt.replace(/\[\s*\d{1,2}\s*\]\s*$/, '').trim();
        if (qType === 'short_answer') {
          prompt = prompt.replace(/(?:[…\.]{2,}|_{2,}|\.{3,}|…+)\s*$/, '').trim();
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
      let formattedTableLine = line
        .replace(/(?:<strong[^>]*>([0-9]{1,2})<\/strong>\s*[\u2026\.]{2,}|\b([0-9]{1,2})\s*(?:[…\.]{2,}|_{2,}|\.{3,}|…+))/g, '[$1$2]')
        .replace(/((?:[…\.]{2,}|_{2,}|\.{3,}|…+))([\s\S]*?)(?:\([Qq]?\s*([0-9]{1,2})\)|\[([0-9]{1,2})\])/g, (_m, _b, mid, g3, g4) => `[${g3 || g4}]${mid}`)
        .replace(/(?:[…\.]{2,}|_{2,}|\.{3,}|…+)\s*\(([0-9]{1,2})\)/g, '[$1]');
      currentGroupText += (currentGroupText ? '\n' : '') + formattedTableLine;

      // Table matching row:
      // Format 1: | 25. Research design | [25] | or | 25) Research design | |
      // Format 2: | 25 | Research design | [25] | or | 25 | Research design | |
      const matchRowNumbered = line.match(/^\|\s*([0-9]{1,2})[\.\)\:\-]?\s+([^|]+)\|/);
      const matchRowColSplit = line.match(/^\|\s*([0-9]{1,2})\s*\|\s*([^|]+)\|/);
      const matchRow = matchRowNumbered || matchRowColSplit;

      if (matchRow) {
        const qNum = parseInt(matchRow[1], 10);
        const prompt = matchRow[2].trim();
        const isTableMatching =
          currentType === 'matching' ||
          currentType === 'plan_map_diagram_labelling' ||
          currentGroupOptions.length > 0;
        const qType = isTableMatching ? 'matching' : 'table_completion';
        if (isTableMatching) currentType = 'matching';

        currentGroupQuestions.push({
          id: `q_p${partNumber}_${qNum}`,
          number: qNum,
          questionNumber: qNum,
          part: partNumber as any,
          type: qType,
          prompt,
          options: currentGroupOptions.length > 0 ? currentGroupOptions : undefined,
          maxWords: parseWordCount(currentWordLimit),
          allowNumbers: !currentWordLimit.toLowerCase().includes('only words'),
        });
        continue;
      }

      // Extract question blanks from individual table cells:
      const cellsInLine = line.split('|').map((c) => c.trim()).filter(Boolean);
      for (const cell of cellsInLine) {
        if (/^[-:]+$/.test(cell)) continue; // ignore table header markdown line

        // Find ALL blanks within the cell using global matches
        const cellNums: number[] = [];

        // Pattern 1: [15]
        for (const m of cell.matchAll(/\[([0-9]{1,2})\]/g)) {
          const num = parseInt(m[1], 10);
          if (!isNaN(num) && !cellNums.includes(num)) cellNums.push(num);
        }

        // Pattern 2: 15 ……… or 15. ……… or 15: ………
        for (const m of cell.matchAll(/\b([0-9]{1,2})[\.\:\)]?\s*(?:[\$£€¥]|every|in|at|by|for|the|a|an|[^\w\s\n|])*\s*(?:_{2,}|[\u2026\.]{2,})/gi)) {
          const num = parseInt(m[1], 10);
          if (!isNaN(num) && !cellNums.includes(num)) cellNums.push(num);
        }

        // Pattern 3: ……… (15) or ……… 15 or ……… (Q15)
        for (const m of cell.matchAll(/(?:_{2,}|[\u2026\.]{2,})\s*(?:\([Qq]?\s*([0-9]{1,2})\)|\[([0-9]{1,2})\]|\b([0-9]{1,2})\b)/gi)) {
          const num = parseInt(m[1] || m[2] || m[3], 10);
          if (!isNaN(num) && !cellNums.includes(num)) cellNums.push(num);
        }

        for (const matchedNum of cellNums) {
          if (!currentGroupQuestions.some((q) => q.questionNumber === matchedNum)) {
            const qType = (currentType === 'form_completion' || currentType === 'note_completion') ? currentType : 'table_completion';
            if (currentType !== 'form_completion' && currentType !== 'note_completion') {
              currentType = 'table_completion';
            }

            currentGroupQuestions.push({
              id: `q_p${partNumber}_${matchedNum}`,
              number: matchedNum,
              questionNumber: matchedNum,
              part: partNumber as any,
              type: qType,
              prompt: `Question ${matchedNum}`,
              maxWords: parseWordCount(currentWordLimit),
              allowNumbers: !currentWordLimit.toLowerCase().includes('only words'),
            });
          }
        }
      }

      continue;
    }

    // Check for Sentences, Forms, or Notes with inline blanks:
    // Formats supported:
    // 1) "- The main cause of the problem is ______ (Q31)." or "- The process usually takes ______ days (Q32)."
    // 2) "- Additional support is provided by 34. ______" or "• 34. Cost: ______"
    // 3) "This year, activities end by 7 ………… p.m." or "• Address: 1 …………" or "[1]"
    if (!line.includes('|')) {
      let lineToProcess = line;
      const detectedQNums: number[] = [];

      // Pattern 1: Blank followed anywhere by (Q<num>) or (<num>) or [<num>]
      const blankThenTagRegex = /((?:[…\.]{2,}|_{2,}|\.{3,}|…+))([\s\S]*?)(?:\([Qq]?\s*([0-9]{1,2})\)|\[([0-9]{1,2})\])/g;
      let matchTag: RegExpExecArray | null;
      while ((matchTag = blankThenTagRegex.exec(line)) !== null) {
        const num = parseInt(matchTag[3] || matchTag[4], 10);
        if (!isNaN(num) && !detectedQNums.includes(num)) {
          detectedQNums.push(num);
        }
      }
      if (detectedQNums.length > 0) {
        lineToProcess = lineToProcess.replace(
          /((?:[…\.]{2,}|_{2,}|\.{3,}|…+))([\s\S]*?)(?:\([Qq]?\s*([0-9]{1,2})\)|\[([0-9]{1,2})\])/g,
          (_m, _blank, middle, g3, g4) => {
            const n = g3 || g4;
            return `[${n}]${middle.replace(/\s+$/, '')}`;
          }
        );
      }

      // Pattern 2: Number before blank, e.g. "34. ______" or "- Additional support is provided by 34. ______"
      const numBeforeBlankRegex = /(?:by|in|at|to|for|is|are|on|of|^|[•\-\*\s]+)\s*([0-9]{1,2})[\.\:\)]\s*(?:[…\.]{2,}|_{2,}|\.{3,}|…+)/g;
      let matchNumBefore: RegExpExecArray | null;
      while ((matchNumBefore = numBeforeBlankRegex.exec(lineToProcess)) !== null) {
        const num = parseInt(matchNumBefore[1], 10);
        if (!isNaN(num) && !detectedQNums.includes(num)) {
          detectedQNums.push(num);
        }
      }
      lineToProcess = lineToProcess.replace(
        /((?:by|in|at|to|for|is|are|on|of|^|[•\-\*\s]+)\s*)([0-9]{1,2})[\.\:\)]\s*(?:[…\.]{2,}|_{2,}|\.{3,}|…+)/g,
        '$1[$2]'
      );

      // Pattern 3: Standard inline number+blank, e.g. "1 …………" or "[1]"
      const standardBlankRegex = /(?:<strong[^>]*>([0-9]{1,2})<\/strong>\s*[\u2026\.]{2,}|\b([0-9]{1,2})\s*(?:[…\.]{2,}|_{2,}|\.{3,}|…+)|\(([0-9]{1,2})\)\s*(?:[…\.]{2,}|_{2,}|\.{3,}|…+)|\[([0-9]{1,2})\])/g;
      let matchStd: RegExpExecArray | null;
      while ((matchStd = standardBlankRegex.exec(lineToProcess)) !== null) {
        const num = parseInt(matchStd[1] || matchStd[2] || matchStd[3] || matchStd[4], 10);
        if (!isNaN(num) && !detectedQNums.includes(num)) {
          detectedQNums.push(num);
        }
      }
      lineToProcess = lineToProcess.replace(standardBlankRegex, (_m, g1, g2, g3, g4) => `[${g1 || g2 || g3 || g4}]`);

      if (detectedQNums.length > 0) {
        const resolvedType =
          currentType === 'form_completion'
            ? 'form_completion'
            : currentType === 'summary_completion'
            ? 'summary_completion'
            : currentType === 'flowchart_completion'
            ? 'flowchart_completion'
            : currentType === 'sentence_completion'
            ? 'sentence_completion'
            : currentType === 'table_completion'
            ? 'table_completion'
            : currentType === 'matching'
            ? 'matching'
            : currentType === 'plan_map_diagram_labelling'
            ? 'plan_map_diagram_labelling'
            : currentType === 'short_answer'
            ? 'short_answer'
            : 'note_completion';

        for (const qNum of detectedQNums) {
          let cleanPrompt = line
            .replace(/^[•\-\*\s]+/, '')
            .replace(/\([Qq]?\s*[0-9]{1,2}\)/gi, '')
            .trim();
          cleanPrompt = cleanPrompt.replace(/(?:[…\.]{2,}|_{2,}|\.{3,}|…+)/g, '_____');

          currentGroupQuestions.push({
            id: `q_p${partNumber}_${qNum}`,
            number: qNum,
            questionNumber: qNum,
            part: partNumber as any,
            type: resolvedType,
            prompt: cleanPrompt || `Question ${qNum}`,
            options: (resolvedType === 'matching' || resolvedType === 'plan_map_diagram_labelling') && currentGroupOptions.length > 0
              ? currentGroupOptions
              : undefined,
            maxWords: parseWordCount(currentWordLimit),
            allowNumbers: !currentWordLimit.toLowerCase().includes('only words'),
          });
        }

        currentGroupText += (currentGroupText ? '\n' : '') + lineToProcess;
        continue;
      }
    }

    // Accumulate text into group context / layout
    const trimmedLine = line.trim();
    if (
      trimmedLine.length > 0 &&
      !trimmedLine.toLowerCase().startsWith('answer key') &&
      !trimmedLine.toLowerCase().startsWith('listening answers')
    ) {
      currentGroupText += (currentGroupText ? '\n' : '') + trimmedLine;
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

  // 1. Map / diagram / plan labelling (checked first because map instructions often say "write the letter next to questions")
  if (
    lower.includes('map') ||
    lower.includes('plan') ||
    lower.includes('diagram') ||
    lower.includes('label the') ||
    lower.includes('labelling') ||
    lower.includes('sơ đồ') ||
    lower.includes('bản đồ')
  ) {
    return 'plan_map_diagram_labelling';
  }

  // 2. Explicit matching / box / list matching (checked before multi-select so "Choose FOUR from the box" is matching, not multi-select)
  if (
    lower.includes('matching') ||
    lower.includes('nối') ||
    lower.includes('next to question') ||
    lower.includes('from the box') ||
    lower.includes('from the list') ||
    lower.includes('box below') ||
    lower.includes('list below') ||
    lower.includes('say about each') ||
    lower.includes('which person') ||
    lower.includes('which speaker')
  ) {
    return 'matching';
  }

  // 3. Multi-select (choose 2, choose 3, etc.)
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
    lower.includes('which two') ||
    lower.includes('which three') ||
    lower.includes('multiple select')
  ) {
    return 'multiple_select';
  }

  // 4. Flowchart
  if (
    lower.includes('flow-chart') ||
    lower.includes('flowchart') ||
    lower.includes('flow chart') ||
    lower.includes('process') ||
    lower.includes('stages') ||
    lower.includes('lưu đồ') ||
    lower.includes('quy trình')
  ) {
    return 'flowchart_completion';
  }

  // 5. Table
  if (lower.includes('table') || lower.includes('bảng')) {
    return 'table_completion';
  }

  // 6. Form
  if (
    lower.includes('form') ||
    lower.includes('application') ||
    lower.includes('registration') ||
    lower.includes('details form') ||
    lower.includes('biểu mẫu') ||
    lower.includes('đơn vị')
  ) {
    return 'form_completion';
  }

  // 7. Note Completion (checked before sentence completion)
  if (
    lower.includes('complete the notes') ||
    lower.includes('note completion') ||
    lower.includes('notes below') ||
    lower.includes('ghi chú') ||
    lower.includes('điền vào ghi chú') ||
    lower.includes('complete the note')
  ) {
    return 'note_completion';
  }

  // 8. Summary
  if (lower.includes('summary') || lower.includes('tóm tắt')) {
    return 'summary_completion';
  }

  // 9. Sentence completion (guard against 'dạng câu hỏi' or 'câu hỏi' which means question)
  if (
    (lower.includes('sentence') ||
      lower.includes('hoàn thành câu') ||
      lower.includes('điền vào câu') ||
      /\bcâu\s+hoàn\s+thành\b/i.test(lower)) &&
    !lower.includes('choose the correct letter') &&
    !lower.includes('trắc nghiệm') &&
    !lower.includes('dạng câu hỏi')
  ) {
    return 'sentence_completion';
  }

  // 10. Short answer
  if (
    lower.includes('short answer') ||
    lower.includes('short-answer') ||
    lower.includes('câu hỏi ngắn') ||
    lower.includes('answer the questions below')
  ) {
    return 'short_answer';
  }

  // 10. Multiple choice
  if (
    lower.includes('choose the correct letter') ||
    lower.includes('multiple choice') ||
    lower.includes('chọn đáp án đúng') ||
    lower.includes('trắc nghiệm') ||
    lower.includes('a, b or c') ||
    lower.includes('a, b, c or d')
  ) {
    return 'multiple_choice';
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
  const headerMatch = text.match(/(?:^|\n)\s*(?:answer\s*keys?|listening\s*answers?|\banswers(?:\s+for\s+listening)?\b|đáp\s*án)\b/i);
  const targetText = headerMatch && headerMatch.index !== undefined ? text.substring(headerMatch.index) : text;
  const lines = targetText.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. Check for range in text: "Questions 18–20 are A, F and G in any order"
  const rangeRegex = /(?:Questions?|Q)?\s*([0-9]{1,2})\s*[-–—to]+\s*([0-9]{1,2})\s+are\s+([A-Za-z,\s]+(?:\s+and\s+[A-Za-z])?)\s+in\s+any\s+order/gi;
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
