import type { QuestionType, ReadingQuestion, QuestionGroup, ParsedPassage } from '../types/index.ts';
import { parseMaxWordsFromLimit } from './assignmentGrader.ts';

/**
 * Normalizes question type aliases from various document parsers, AI generators,
 * and legacy database records to canonical IELTS QuestionType values.
 */
export function normalizeQuestionType(rawType: any): QuestionType {
  if (!rawType || typeof rawType !== 'string') {
    return 'short_answer';
  }

  const clean = rawType.toLowerCase().trim().replace(/[-\s]/g, '_');

  // True / False / Not Given
  if (
    clean === 'true_false_not_given' ||
    clean === 'tfng' ||
    clean === 'true_false' ||
    clean === 't_f_ng'
  ) {
    return 'true_false_not_given';
  }

  // Yes / No / Not Given
  if (
    clean === 'yes_no_not_given' ||
    clean === 'ynng' ||
    clean === 'yes_no' ||
    clean === 'y_n_ng'
  ) {
    return 'yes_no_not_given';
  }

  // Multiple Choice (Single)
  if (
    clean === 'multiple_choice' ||
    clean === 'mcq' ||
    clean === 'single_choice' ||
    clean === 'choice'
  ) {
    return 'multiple_choice';
  }

  // Multiple Select
  if (
    clean === 'multiple_select' ||
    clean === 'multi_select' ||
    clean === 'multiple_choice_multi' ||
    clean === 'choose_two' ||
    clean === 'choose_three'
  ) {
    return 'multiple_select';
  }

  // Matching Information (Which paragraph contains...)
  if (
    clean === 'matching_information' ||
    clean === 'matching_info' ||
    clean === 'which_paragraph' ||
    clean === 'paragraph_matching' ||
    clean === 'information_matching'
  ) {
    return 'matching_information';
  }

  // Matching Headings
  if (
    clean === 'matching_headings' ||
    clean === 'headings' ||
    clean === 'heading_matching' ||
    clean === 'list_of_headings'
  ) {
    return 'matching_headings';
  }

  // Matching Features / Researchers
  if (
    clean === 'matching_features' ||
    clean === 'features' ||
    clean === 'feature_matching' ||
    clean === 'researchers'
  ) {
    return 'matching_features';
  }

  // Matching Sentence Endings
  if (
    clean === 'matching_sentence_endings' ||
    clean === 'sentence_endings' ||
    clean === 'matching_endings'
  ) {
    return 'matching_sentence_endings';
  }

  // Sentence Completion
  if (
    clean === 'sentence_completion' ||
    clean === 'complete_sentence' ||
    clean === 'sentence_complete'
  ) {
    return 'sentence_completion';
  }

  // Summary Completion
  if (
    clean === 'summary_completion' ||
    clean === 'summary' ||
    clean === 'summary_with_box' ||
    clean === 'summary_from_passage'
  ) {
    return 'summary_completion';
  }

  // Note Completion
  if (clean === 'note_completion' || clean === 'notes_completion' || clean === 'notes') {
    return 'note_completion';
  }

  // Table Completion
  if (clean === 'table_completion' || clean === 'table') {
    return 'table_completion';
  }

  // Flow-chart Completion
  if (
    clean === 'flowchart_completion' ||
    clean === 'flow_chart_completion' ||
    clean === 'flowchart' ||
    clean === 'flow_chart'
  ) {
    return 'flowchart_completion';
  }

  // Short Answer
  if (clean === 'short_answer' || clean === 'short_answer_questions') {
    return 'short_answer';
  }

  // Diagram / Map / Plan Labelling
  if (
    clean === 'diagram_completion' ||
    clean === 'diagram_labelling' ||
    clean === 'diagram' ||
    clean === 'plan_labelling' ||
    clean === 'map_labelling'
  ) {
    return 'diagram_completion';
  }

  // Generic Matching
  if (clean === 'matching' || clean === 'match_pairs') {
    return 'matching';
  }

  // Fill in the blank
  if (clean === 'fill_in_the_blank' || clean === 'gap_fill' || clean === 'blank') {
    return 'fill_in_the_blank';
  }

  if (clean === 'essay') {
    return 'essay';
  }

  return 'short_answer';
}

/**
 * Normalizes options from various formats (string[], object arrays, comma/newline-delimited text).
 */
export function normalizeOptions(rawOptions: any): string[] | undefined {
  if (!rawOptions) return undefined;

  if (Array.isArray(rawOptions)) {
    const list: string[] = [];
    for (const opt of rawOptions) {
      if (typeof opt === 'string') {
        const trimmed = opt.trim();
        if (trimmed) list.push(trimmed);
      } else if (opt && typeof opt === 'object') {
        const label = opt.label || opt.key || opt.letter || '';
        const text = opt.text || opt.value || opt.content || opt.statement || '';
        if (label && text) {
          list.push(`${label}. ${text}`);
        } else if (text) {
          list.push(String(text));
        } else if (label) {
          list.push(String(label));
        }
      }
    }
    return list.length > 0 ? list : undefined;
  }

  if (typeof rawOptions === 'string') {
    const lines = rawOptions
      .split(/\r?\n|;/)
      .map((s) => s.trim())
      .filter(Boolean);
    return lines.length > 0 ? lines : [rawOptions.trim()];
  }

  if (typeof rawOptions === 'object') {
    const entries = Object.entries(rawOptions);
    if (entries.length > 0) {
      return entries.map(([k, v]) => `${k}. ${v}`);
    }
  }

  return undefined;
}

/**
 * Safely resolves the display prompt from divergent field names (prompt, questionText, text, etc.)
 */
export function resolveQuestionPrompt(raw: any, fallbackIndex?: number): string {
  if (!raw) return `Question ${fallbackIndex ?? 1}`;

  const candidates = [
    raw.prompt,
    raw.questionText,
    raw.question_text,
    raw.text,
    raw.question,
    raw.statement,
    raw.stem,
    raw.title,
    raw.description,
  ];

  for (const cand of candidates) {
    if (typeof cand === 'string' && cand.trim().length > 0) {
      let cleaned = cand.trim();
      // Format numbered blanks like "33 ........" to "(33) ........"
      cleaned = cleaned.replace(/(?:^|\s)(?!\()(\d+)\s*([\.]{3,}|_{3,})/g, ' ($1) $2');
      return cleaned.trim();
    }
  }

  return `Question ${fallbackIndex ?? 1}`;
}

/**
 * Normalizes an individual reading question, ensuring required fields are non-empty
 * and preventing any blank rendering in the UI.
 */
export function normalizeReadingQuestion(
  raw: any,
  index?: number,
  passageIndex?: number
): ReadingQuestion {
  if (!raw || typeof raw !== 'object') {
    const id = `q_gen_${index ?? 1}_${Math.random().toString(36).slice(2, 7)}`;
    return {
      id,
      type: 'short_answer',
      prompt: `Question ${index ?? 1}`,
      correctAnswer: '',
      explanation: '',
      points: 1,
    };
  }

  const prompt = resolveQuestionPrompt(raw, index);
  const type = normalizeQuestionType(raw.type || raw.questionType || raw.question_type);
  const options = normalizeOptions(raw.options || raw.choices || raw.answers || raw.alternatives);
  const wordLimit = raw.wordLimit || raw.word_limit || raw.limit;
  const maxWords =
    typeof raw.maxWords === 'number'
      ? raw.maxWords
      : parseMaxWordsFromLimit(wordLimit) || undefined;

  const id = String(raw.id || raw._id || `q_${index ?? 1}_${Date.now()}`);

  const correctAnswer = String(
    raw.correctAnswer ??
      raw.correct_answer ??
      raw.answer ??
      raw.key ??
      ''
  ).trim();

  const explanation = String(
    raw.explanation ??
      raw.citation ??
      raw.rationale ??
      raw.justification ??
      ''
  ).trim();

  const headingsList = Array.isArray(raw.headingsList)
    ? raw.headingsList
    : Array.isArray(raw.headings)
    ? raw.headings
    : undefined;

  const featuresList = Array.isArray(raw.featuresList)
    ? raw.featuresList
    : Array.isArray(raw.features)
    ? raw.features
    : undefined;

  const matchingPairs = Array.isArray(raw.matchingPairs)
    ? raw.matchingPairs
    : Array.isArray(raw.pairs)
    ? raw.pairs
    : undefined;

  const normalized: ReadingQuestion & { passageIndex?: number } = {
    id,
    type,
    prompt,
    correctAnswer,
    explanation,
    points: Number(raw.points) > 0 ? Number(raw.points) : 1,
  };

  if (options) normalized.options = options;
  if (wordLimit) normalized.wordLimit = wordLimit;
  if (maxWords) normalized.maxWords = maxWords;
  if (headingsList) normalized.headingsList = headingsList;
  if (featuresList) normalized.featuresList = featuresList;
  if (matchingPairs) normalized.matchingPairs = matchingPairs;
  if (raw.diagramUrl || raw.diagram_url) normalized.diagramUrl = raw.diagramUrl || raw.diagram_url;
  if (raw.source) normalized.source = raw.source;
  if (raw.answerKeyConfidence) normalized.answerKeyConfidence = raw.answerKeyConfidence;
  if (raw.needsReview !== undefined) normalized.needsReview = Boolean(raw.needsReview);
  if (passageIndex !== undefined) normalized.passageIndex = passageIndex;

  return normalized;
}

/**
 * Extracts paragraph labels (e.g. ['A', 'B', 'C', 'D', 'E', 'F']) from an IELTS reading passage.
 * Used to populate matching_information dropdowns.
 */
export function extractParagraphLabelsFromPassage(content?: string): string[] {
  if (!content) return ['A', 'B', 'C', 'D', 'E', 'F'];

  const labels = new Set<string>();

  // Matches "Paragraph A", "[A]", "A.", "(A)", or "A \n" at line starts
  const matches = content.matchAll(
    /(?:(?:^|\n\s*)(?:Paragraph\s+|\[|\()?([A-Z])(?:\.|\:|\]|\)|\s*\n))/gi
  );
  for (const m of matches) {
    if (m[1]) {
      labels.add(m[1].toUpperCase());
    }
  }

  // Fallback if no explicit labels are found
  if (labels.size < 2) {
    const paragraphs = content
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 40);
    const count = Math.min(Math.max(paragraphs.length, 4), 10);
    const standardLetters = 'ABCDEFGHIJ'.slice(0, count).split('');
    return standardLetters;
  }

  return Array.from(labels).sort();
}

export interface ExtractedAssignmentQuestions {
  questions: ReadingQuestion[];
  questionGroups: QuestionGroup[];
  passages: ParsedPassage[];
  passageMap: Record<string, number>; // maps question.id -> passageIndex (0-based)
  totalCount: number;
}

/**
 * Robustly extracts and normalizes all reading questions from an assignment.
 * Checks readingQuestions, questionGroups, and multi-passage structures (passages.questions and passages.questionGroups).
 * Eliminates the "0 / 0 Answered" bug and guarantees that questions never render blank.
 */
export function extractAllNormalizedQuestions(assignment: any): ExtractedAssignmentQuestions {
  const resultQuestions: ReadingQuestion[] = [];
  const passageMap: Record<string, number> = {};
  const seenIds = new Set<string>();

  if (!assignment) {
    return {
      questions: [],
      questionGroups: [],
      passages: [],
      passageMap: {},
      totalCount: 0,
    };
  }

  const passages: ParsedPassage[] = Array.isArray(assignment.passages) ? assignment.passages : [];
  const questionGroups: QuestionGroup[] = Array.isArray(assignment.questionGroups)
    ? assignment.questionGroups
    : [];

  // Helper to add a question safely without duplication
  const addQuestion = (rawQ: any, pIdx?: number) => {
    if (!rawQ) return;
    const norm = normalizeReadingQuestion(rawQ, resultQuestions.length + 1, pIdx);
    if (!seenIds.has(norm.id)) {
      seenIds.add(norm.id);
      if (pIdx !== undefined) {
        passageMap[norm.id] = pIdx;
      }
      resultQuestions.push(norm);
    }
  };

  // 1. Process passages if present
  if (passages.length > 0) {
    passages.forEach((p, pIdx) => {
      // Questions directly on passage
      if (Array.isArray(p.questions)) {
        p.questions.forEach((q) => addQuestion(q, pIdx));
      }
      // Questions nested in question groups of passage
      if (Array.isArray(p.questionGroups)) {
        p.questionGroups.forEach((g) => {
          if (Array.isArray(g.questions)) {
            g.questions.forEach((q) => addQuestion(q, pIdx));
          }
        });
      }
    });
  }

  // 2. Process top-level question groups
  if (questionGroups.length > 0) {
    questionGroups.forEach((g) => {
      if (Array.isArray(g.questions)) {
        g.questions.forEach((q) => addQuestion(q, undefined));
      }
    });
  }

  // 3. Process top-level readingQuestions
  if (Array.isArray(assignment.readingQuestions)) {
    assignment.readingQuestions.forEach((q: any) => addQuestion(q, undefined));
  }

  return {
    questions: resultQuestions,
    questionGroups,
    passages,
    passageMap,
    totalCount: resultQuestions.length,
  };
}

/**
 * Sanitizes questions for student view when answer release policy does not permit viewing.
 * Strips correctAnswer, explanation, citation, and grading criteria.
 */
export function sanitizeQuestionsForStudent(
  questions: ReadingQuestion[],
  allowAnswers: boolean
): ReadingQuestion[] {
  return questions.map((q) => {
    if (allowAnswers) return q;
    const { correctAnswer, explanation, ...safeQ } = q;
    return {
      ...safeQ,
      correctAnswer: '',
      explanation: '',
    };
  });
}

export interface QuestionRenderGroup {
  id: string;
  rangeTitle: string;
  instructions?: string;
  headingsList?: string[];
  featuresList?: string[];
  wordList?: string[];
  wordLimit?: string;
  questions: Array<{ q: ReadingQuestion; idx: number }>;
}

export type QuestionInputItem =
  | ReadingQuestion
  | { q: ReadingQuestion; idx?: number; absoluteIdx?: number; [key: string]: any };

export function buildQuestionRenderGroups(
  questions: QuestionInputItem[]
): QuestionRenderGroup[] {
  if (!questions || questions.length === 0) return [];

  const groups: QuestionRenderGroup[] = [];
  let currentGroup: QuestionRenderGroup | null = null;

  for (let i = 0; i < questions.length; i++) {
    const rawItem = questions[i];
    const q: ReadingQuestion =
      rawItem && typeof rawItem === 'object' && 'q' in rawItem && (rawItem as any).q
        ? (rawItem as any).q
        : (rawItem as ReadingQuestion);

    const idx =
      rawItem && typeof rawItem === 'object' && typeof (rawItem as any).absoluteIdx === 'number'
        ? (rawItem as any).absoluteIdx
        : rawItem && typeof rawItem === 'object' && typeof (rawItem as any).idx === 'number'
        ? (rawItem as any).idx
        : i;

    const headingsKey = q.headingsList && q.headingsList.length > 0 ? q.headingsList.join('|') : '';
    const featuresKey = q.featuresList && q.featuresList.length > 0 ? q.featuresList.join('|') : '';
    const qWordList = (q.type === 'summary_completion' && q.options && q.options.length > 0)
      ? q.options
      : (q as any).wordList && (q as any).wordList.length > 0
      ? (q as any).wordList
      : undefined;
    const wordListKey = qWordList ? qWordList.join('|') : '';
    const wordLimit = q.wordLimit || (q.maxWords ? `NO MORE THAN ${q.maxWords} WORD${q.maxWords > 1 ? 'S' : ''}` : undefined);
    const instruction = (q as any).instruction || (q as any).groupInstruction || (q as any).instructions || '';

    const sameHeadings = (currentGroup?.headingsList?.join('|') || '') === headingsKey;
    const sameFeatures = (currentGroup?.featuresList?.join('|') || '') === featuresKey;
    const sameWordList = (currentGroup?.wordList?.join('|') || '') === wordListKey;
    const sameInstruction = (currentGroup?.instructions || '') === instruction;
    const sameWordLimit = (currentGroup?.wordLimit || '') === (wordLimit || '');

    const shouldContinueGroup = Boolean(
      currentGroup &&
      (headingsKey ? sameHeadings : true) &&
      (featuresKey ? sameFeatures : true) &&
      (wordListKey ? sameWordList : true) &&
      (instruction ? sameInstruction : true) &&
      (!headingsKey && !featuresKey && !wordListKey && !instruction ? sameWordLimit : true)
    );

    if (shouldContinueGroup && currentGroup) {
      currentGroup.questions.push({ q, idx });
    } else {
      if (currentGroup) {
        const firstIdx = currentGroup.questions[0].idx + 1;
        const lastIdx = currentGroup.questions[currentGroup.questions.length - 1].idx + 1;
        currentGroup.rangeTitle = firstIdx === lastIdx ? `Question ${firstIdx}` : `Questions ${firstIdx}–${lastIdx}`;
        groups.push(currentGroup);
      }

      currentGroup = {
        id: `g_${idx}`,
        rangeTitle: `Question ${idx + 1}`,
        instructions: instruction || undefined,
        headingsList: q.headingsList && q.headingsList.length > 0 ? q.headingsList : undefined,
        featuresList: q.featuresList && q.featuresList.length > 0 ? q.featuresList : undefined,
        wordList: qWordList,
        wordLimit,
        questions: [{ q, idx }],
      };
    }
  }

  if (currentGroup) {
    const cg: QuestionRenderGroup = currentGroup;
    const firstIdx = cg.questions[0].idx + 1;
    const lastIdx = cg.questions[cg.questions.length - 1].idx + 1;
    cg.rangeTitle = firstIdx === lastIdx ? `Question ${firstIdx}` : `Questions ${firstIdx}–${lastIdx}`;
    groups.push(cg);
  }

  return groups;
}

