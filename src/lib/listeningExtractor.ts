import type {
  ListeningTestContent,
  ListeningPart,
  ListeningQuestionGroup,
  ListeningQuestion,
  ListeningQuestionType,
} from '../types/index.ts';

/**
 * Extracts questions, groups, and parts from raw listening test text (PDF / DOCX transcript / test papers).
 */
export function parseListeningDocument(
  rawText: string,
  fileName: string = 'IELTS Listening Practice'
): ListeningTestContent {
  const cleanText = (rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n').map((l) => l.trim());

  // Part markers regex: PART 1, SECTION 1, PART 2, etc.
  const partHeaderRegex = /^(?:PART|SECTION)\s+([1-4])\b/i;

  const rawParts: { partNumber: number; title: string; lines: string[] }[] = [];
  let currentPartIndex = 1;
  let currentPartLines: string[] = [];
  let hasFoundFirstPart = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
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
      lines: lines,
    });
  }

  // Process each part into question groups and questions
  const parts: ListeningPart[] = rawParts.map((rp) => {
    return processListeningPart(rp.partNumber, rp.title, rp.lines);
  });

  // Extract detected answer keys if an ANSWER KEY section exists
  const detectedAnswerKey = extractListeningAnswerKey(cleanText);

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

  // Group boundary regex: "Questions 1-5", "Questions 6 - 10", etc.
  const groupRangeRegex = /^(?:Questions?)\s+([0-9]{1,2})\s*[-–—to]+\s*([0-9]{1,2})/i;
  // Word limit regex: "Write NO MORE THAN TWO WORDS..."
  const wordLimitRegex = /(?:NO MORE THAN\s+(?:ONE|TWO|THREE|FOUR|[1-4])\s+WORDS?(?:\s+AND\/OR\s+A\s+NUMBER)?)/i;

  let currentGroupId = `group_p${partNumber}_1`;
  let currentGroupTitle = '';
  let currentInstructions = '';
  let currentWordLimit = '';
  let currentType: ListeningQuestionType = inferQuestionTypeFromPart(partNumber);
  let currentGroupQuestions: ListeningQuestion[] = [];
  let currentGroupText = '';

  const finalizeGroup = () => {
    if (currentGroupQuestions.length > 0) {
      const firstNum = currentGroupQuestions[0]?.questionNumber || currentGroupQuestions[0]?.number || 1;
      const lastNum = currentGroupQuestions[currentGroupQuestions.length - 1]?.questionNumber || currentGroupQuestions[currentGroupQuestions.length - 1]?.number || currentGroupQuestions.length;
      questionGroups.push({
        id: currentGroupId,
        part: partNumber as any,
        type: currentType,
        groupTitle: currentGroupTitle || `Questions ${firstNum} - ${lastNum}`,
        title: currentGroupTitle || `Questions ${firstNum} - ${lastNum}`,
        instructions: currentInstructions,
        wordLimit: currentWordLimit,
        questions: [...currentGroupQuestions],
        groupText: currentGroupText.trim() || undefined,
      });
      allQuestions.push(...currentGroupQuestions);
      currentGroupQuestions = [];
      currentGroupText = '';
    }
  };

  // Question line regex: "1. Name of caller", "1 )", "Question 1:", etc.
  const questionLineRegex = /^(?:Question\s+)?([0-9]{1,2})[\.\)\:\-]\s*(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Check for Question Group Header (e.g. Questions 1-5)
    const rangeMatch = line.match(groupRangeRegex);
    if (rangeMatch) {
      finalizeGroup();
      currentGroupId = `group_p${partNumber}_${rangeMatch[1]}_${rangeMatch[2]}`;
      currentGroupTitle = line;
      currentInstructions = '';
      currentWordLimit = '';

      // Check next line for instructions & word limit
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const wlMatch = nextLine.match(wordLimitRegex);
        if (wlMatch) {
          currentWordLimit = wlMatch[0].toUpperCase();
          currentInstructions = nextLine;
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
      currentInstructions = line;
      currentType = inferQuestionTypeFromInstruction(line);
      continue;
    }

    // Check if this line is a question
    const qMatch = line.match(questionLineRegex);
    if (qMatch) {
      const qNum = parseInt(qMatch[1], 10);
      let prompt = qMatch[2].trim();

      // Look ahead for multiple choice options (A, B, C...)
      const options: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const optLine = lines[j];
        const optMatch = optLine.match(/^([A-E])[\.\)\:\-]\s*(.*)$/i);
        if (optMatch) {
          options.push(optMatch[2].trim() || optLine);
          j++;
        } else {
          break;
        }
      }

      if (options.length >= 2) {
        currentType = 'multiple_choice';
        i = j - 1; // advance index
      }

      const questionObj: ListeningQuestion = {
        id: `q_p${partNumber}_${qNum}`,
        number: qNum,
        questionNumber: qNum,
        part: partNumber as any,
        type: currentType,
        prompt: prompt || `Question ${qNum}`,
        options: options.length > 0 ? options : undefined,
        maxWords: parseWordCount(currentWordLimit),
        allowNumbers: !currentWordLimit.toLowerCase().includes('only words'),
      };

      currentGroupQuestions.push(questionObj);
    } else {
      // Accumulate text into group context / layout
      if (line.length > 3 && !line.toLowerCase().startsWith('answer key')) {
        currentGroupText += (currentGroupText ? '\n' : '') + line;
      }
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
      title: title || `Part ${partNumber}`,
      audioUrl: '',
      questions: defaultQs,
      questionGroups: [defaultGroup],
    };
  }

  return {
    partNumber: partNumber as any,
    title: title || `Part ${partNumber}`,
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
  if (lower.includes('choose two') || lower.includes('choose 2') || lower.includes('choose three')) {
    return 'multiple_select';
  }
  if (lower.includes('choose the correct letter') || lower.includes('multiple choice')) {
    return 'multiple_choice';
  }
  if (lower.includes('map') || lower.includes('plan') || lower.includes('diagram') || lower.includes('label')) {
    return 'plan_map_diagram_labelling';
  }
  if (lower.includes('flow-chart') || lower.includes('flowchart')) {
    return 'flowchart_completion';
  }
  if (lower.includes('table')) {
    return 'table_completion';
  }
  if (lower.includes('form')) {
    return 'form_completion';
  }
  if (lower.includes('summary')) {
    return 'summary_completion';
  }
  if (lower.includes('matching') || lower.includes('match')) {
    return 'matching';
  }
  if (lower.includes('sentence')) {
    return 'sentence_completion';
  }
  if (lower.includes('short answer')) {
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

  // Patterns: "1. A", "1) library", "1: 9.30am", "1 - 25 March"
  const lineRegex = /(?:^|\n)\s*([0-9]{1,2})\s*[\.\)\:\-]\s*([^\n\r]+)/g;
  let match;
  while ((match = lineRegex.exec(targetText)) !== null) {
    const qNum = match[1].trim();
    let ans = match[2].trim();
    // remove citation or trailing notes if any
    ans = ans.replace(/\s*\(.*?\)\s*$/, '').trim();
    if (ans && !result[qNum]) {
      result[qNum] = ans;
    }
  }

  return result;
}
