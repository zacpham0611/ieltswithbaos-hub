import type { ChartType, WritingTaskType } from '../components/WritingImportModal';

export interface ExtractedSampleAnswer {
  id: string;
  title: string;
  content: string;
  wordCount?: number;
  band?: string;
}

export interface ExtractedWritingTask {
  id: string;
  taskType: WritingTaskType;
  title: string;
  chartType?: ChartType;
  prompt: string;
  tableMarkdown?: string;
  minWords: number;
  suggestedMinutes: number;
  sampleAnswers: ExtractedSampleAnswer[];
}

export interface ExtractedWritingDocument {
  title: string;
  tasks: ExtractedWritingTask[];
  rawText: string;
}

/**
 * Extracts IELTS Writing tasks (Task 1 and/or Task 2) from raw document text,
 * recognizing prompts, visual tables, chart types, instructions, and sample answers.
 */
export function parseWritingDocument(
  rawText: string,
  fileName: string = 'IELTS Writing Prompt'
): ExtractedWritingDocument {
  const cleanText = (rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n');

  // Find task boundaries (Writing Task 1, Writing Task 2)
  const taskHeaderRegex = /^(?:WRITING\s+TASK\s+([12])|TASK\s+([12]))\b/i;

  const segments: { taskNum: number; lines: string[] }[] = [];
  let currentTaskNum: number | null = null;
  let currentSegmentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(taskHeaderRegex);
    if (match) {
      if (currentTaskNum !== null && currentSegmentLines.length > 0) {
        segments.push({
          taskNum: currentTaskNum,
          lines: currentSegmentLines,
        });
      }
      currentTaskNum = parseInt(match[1] || match[2], 10);
      currentSegmentLines = [];
    } else {
      if (currentTaskNum !== null) {
        currentSegmentLines.push(lines[i]);
      }
    }
  }

  if (currentTaskNum !== null && currentSegmentLines.length > 0) {
    segments.push({
      taskNum: currentTaskNum,
      lines: currentSegmentLines,
    });
  }

  // If no explicit "Writing Task 1/2" headers were found, classify the entire text
  if (segments.length === 0) {
    const lower = cleanText.toLowerCase();
    const isTask2 =
      lower.includes('task 2') ||
      lower.includes('to what extent do you agree') ||
      lower.includes('discuss both views') ||
      lower.includes('advantages and disadvantages') ||
      lower.includes('causes and solutions') ||
      lower.includes('at least 250 words') ||
      lower.includes('write an essay');

    segments.push({
      taskNum: isTask2 ? 2 : 1,
      lines: lines,
    });
  }

  const tasks: ExtractedWritingTask[] = segments.map((seg, idx) => {
    return processWritingSegment(seg.taskNum, seg.lines, fileName, idx);
  });

  return {
    title: fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
    tasks,
    rawText: cleanText,
  };
}

function processWritingSegment(
  taskNum: number,
  lines: string[],
  fileName: string,
  segIndex: number
): ExtractedWritingTask {
  const taskType: WritingTaskType = taskNum === 2 ? 'task2' : 'task1';
  const fullSegmentText = lines.join('\n');
  const lower = fullSegmentText.toLowerCase();

  // 1. Detect Sample Answers
  // Matches "Sample answer", "Sample answer (Band 7)", "Model answer", etc.
  const sampleHeaderRegex = /^(?:Sample\s+answer|Model\s+answer|Sample\s+essay|Model\s+essay)(?:\s*\(([^)]+)\))?:?/i;
  let promptLines: string[] = [];
  let sampleAnswerLines: string[] = [];
  let currentSampleBand = '';
  let inSample = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const sMatch = trimmed.match(sampleHeaderRegex);
    if (sMatch) {
      inSample = true;
      currentSampleBand = sMatch[1] ? sMatch[1].trim() : '';
      continue;
    }

    if (inSample) {
      sampleAnswerLines.push(line);
    } else {
      promptLines.push(line);
    }
  }

  // 2. Process Sample Answer
  const sampleAnswers: ExtractedSampleAnswer[] = [];
  if (sampleAnswerLines.length > 0) {
    let sampleContent = sampleAnswerLines.join('\n').trim();
    let wordCount: number | undefined;

    // Check for word count notation at the end, e.g. "(215 words)"
    const wcMatch = sampleContent.match(/\(([0-9]{2,4})\s*words?\)\s*$/i);
    if (wcMatch) {
      wordCount = parseInt(wcMatch[1], 10);
      sampleContent = sampleContent.replace(/\(([0-9]{2,4})\s*words?\)\s*$/i, '').trim();
    } else {
      wordCount = sampleContent.split(/\s+/).filter(Boolean).length;
    }

    sampleAnswers.push({
      id: `sample_${taskType}_${segIndex + 1}`,
      title: currentSampleBand ? `Sample Answer (${currentSampleBand})` : 'Sample Answer',
      content: sampleContent,
      wordCount,
      band: currentSampleBand || undefined,
    });
  }

  // 3. Process Prompt & Table data
  // Extract table lines if present
  const tableLines: string[] = [];
  const cleanPromptLines: string[] = [];

  for (const pLine of promptLines) {
    if (pLine.trim().startsWith('|') && pLine.trim().endsWith('|')) {
      tableLines.push(pLine);
    } else {
      cleanPromptLines.push(pLine);
    }
  }

  const tableMarkdown = tableLines.length > 0 ? tableLines.join('\n') : undefined;

  // Clean prompt text by removing common repetitive IELTS boilerplates
  let cleanPrompt = cleanPromptLines
    .join('\n')
    .replace(/^You\s+should\s+spend\s+about\s+\d+\s+minutes\s+on\s+this\s+task\.?/gim, '')
    .trim();

  // If table exists, keep table appended to the prompt for rendering context
  if (tableMarkdown) {
    cleanPrompt = (cleanPrompt ? cleanPrompt + '\n\n' : '') + tableMarkdown;
  }

  // 4. Detect Chart Type for Task 1
  let chartType: ChartType | undefined = undefined;
  if (taskType === 'task1') {
    if (tableMarkdown || lower.includes('table below') || lower.includes('the table')) {
      chartType = 'Table';
    } else if (lower.includes('pie chart')) {
      chartType = 'Pie Chart';
    } else if (lower.includes('line graph') || lower.includes('lines graph')) {
      chartType = 'Line Graph';
    } else if (lower.includes('bar chart') || lower.includes('column chart')) {
      chartType = 'Bar Chart';
    } else if (lower.includes('map') || lower.includes('maps') || lower.includes('plan')) {
      chartType = 'Map';
    } else if (lower.includes('process') || lower.includes('diagram') || lower.includes('cycle') || lower.includes('flow chart')) {
      chartType = 'Process / Diagram';
    } else if (lower.includes('chart') && lower.includes('table')) {
      chartType = 'Mixed Charts';
    } else {
      chartType = 'Bar Chart';
    }
  }

  // 5. Word limits and timing
  let minWords = taskType === 'task1' ? 150 : 250;
  const wlMatch = fullSegmentText.match(/at\s+least\s+([0-9]{2,3})\s+words/i);
  if (wlMatch) {
    minWords = parseInt(wlMatch[1], 10);
  }

  let suggestedMinutes = taskType === 'task1' ? 20 : 40;
  const timeMatch = fullSegmentText.match(/about\s+([0-9]{2})\s+minutes/i);
  if (timeMatch) {
    suggestedMinutes = parseInt(timeMatch[1], 10);
  }

  const taskTitle = taskType === 'task1'
    ? `Writing Task 1${chartType ? ` (${chartType})` : ''}`
    : 'Writing Task 2 (Essay)';

  return {
    id: `task_${taskType}_${segIndex + 1}`,
    taskType,
    title: taskTitle,
    chartType,
    prompt: cleanPrompt || fullSegmentText.slice(0, 400),
    tableMarkdown,
    minWords,
    suggestedMinutes,
    sampleAnswers,
  };
}
