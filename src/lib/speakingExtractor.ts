import type {
  SpeakingTopic,
  SpeakingCueCard,
  SpeakingPart1LibraryContent,
  SpeakingPart2LibraryContent,
  SpeakingPart3LibraryContent,
} from '../types/index.ts';

export interface ExtractedSpeakingPart1 {
  topics: SpeakingTopic[];
  confidence: number;
}

export interface ExtractedSpeakingPart2CueCard {
  id: string;
  topic: string;
  instructions: string;
  points: string[];
  prepTimeSeconds: number;
  speakTimeSeconds: number;
}

export interface ExtractedSpeakingPart2 {
  cueCards: ExtractedSpeakingPart2CueCard[];
  confidence: number;
}

export interface ExtractedSpeakingPart3Group {
  id: string;
  cueCardTopic?: string;
  cueCardId?: string;
  questions: string[];
}

export interface ExtractedSpeakingPart3 {
  questions: string[];
  groups: ExtractedSpeakingPart3Group[];
  confidence: number;
}

export interface ExtractedSpeakingDocument {
  sourceFileName: string;
  part1: ExtractedSpeakingPart1 | null;
  part2: ExtractedSpeakingPart2 | null;
  part3: ExtractedSpeakingPart3 | null;
  hasContent: boolean;
  rawTextPreview: string;
}

/**
 * Strips forecast periods, quarters, dates, and page artifacts without touching speaking content
 */
function sanitizeSpeakingDocumentText(rawText: string): string {
  if (!rawText) return '';

  return rawText
    // Remove Page numbers and headers/footers: "Page 1 of 12", "Trang 3/10", etc.
    .replace(/(?:^|\n)\s*(?:Page|Trang)\s*\d+(?:\s*(?:of|\/)\s*\d+)?\s*(?=\n|$)/gi, '\n')
    // Remove forecast headings like: "IELTS Speaking Forecast Q1-Q4 2026", "Dự đoán đề thi Speaking Quý 1/2026", "Forecast Jan - Apr 2026", etc.
    .replace(/(?:^|\n)\s*(?:IELTS\s+)?(?:Speaking\s+)?(?:Forecast|Dự đoán|Bộ đề|Question Bank)\s*(?:Q[1-4]|Quý\s*[1-4]|\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|[\-\/,\s])*\s*(?=\n|$)/gi, '\n')
    // Remove standalone dates/years on lines like "2026 - 2027", "Tháng 1 - Tháng 4"
    .replace(/(?:^|\n)\s*(?:(?:19|20)\d{2}\s*[\-\/]\s*(?:19|20)\d{2}|Q[1-4]\s*(?:19|20)\d{2})\s*(?=\n|$)/gi, '\n')
    // Normalize unicode spaces and dashes
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    // Fix multiple empty lines
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Dedicated, isolated IELTS Speaking parser for Smart Document Import.
 * Pure isolated logic: Never modifies or depends on Reading recognition.
 */
export function extractSpeakingPartsFromDocument(
  rawText: string,
  sourceFileName: string = 'Speaking_Document'
): ExtractedSpeakingDocument {
  const sanitized = sanitizeSpeakingDocumentText(rawText);

  // Divide document into Part 1, Part 2, and Part 3 sections
  const lines = sanitized.split('\n').map((l) => l.trim()).filter(Boolean);

  let currentSection: 'header' | 'part1' | 'part2' | 'part3' = 'header';
  const part1Lines: string[] = [];
  const part2Lines: string[] = [];
  const part3Lines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Check section boundaries
    if (
      /(?:^|\b)(?:part\s*3|phần\s*3|speaking\s*part\s*3|part\s*three)\b/i.test(lower) ||
      (/^(?:discussion\s*(?:topics|questions)?|follow[\s-]up\s*questions)\b/i.test(lower) && currentSection !== 'part3')
    ) {
      currentSection = 'part3';
      continue;
    }

    if (
      /(?:^|\b)(?:part\s*1|phần\s*1|speaking\s*part\s*1|part\s*one)\b/i.test(lower) &&
      !lower.includes('part 2') &&
      !lower.includes('part 3')
    ) {
      currentSection = 'part1';
      continue;
    }

    if (
      /(?:^|\b)(?:part\s*2|phần\s*2|speaking\s*part\s*2|part\s*two|cue\s*card)\b/i.test(lower) &&
      !lower.includes('part 3')
    ) {
      currentSection = 'part2';
      continue;
    }

    if (currentSection !== 'part3' && /^describe\s+a(?:n)?\b/i.test(lower)) {
      currentSection = 'part2';
      part2Lines.push(line);
      continue;
    }

    // Accumulate lines according to current section
    if (currentSection === 'part1') {
      part1Lines.push(line);
    } else if (currentSection === 'part2') {
      // Check if Part 3 begins inside without explicit header (e.g. "Discussion questions:")
      if (/^(?:discussion\s*questions|part\s*3|follow[\s-]up):?/i.test(line)) {
        currentSection = 'part3';
        continue;
      }
      part2Lines.push(line);
    } else if (currentSection === 'part3') {
      part3Lines.push(line);
    } else {
      // Before explicit section header: check if it looks like Part 1 topic or Part 2 cue card
      if (/^describe\s+a/i.test(line)) {
        currentSection = 'part2';
        part2Lines.push(line);
      } else if (/\?$/.test(line) || /^\d+[\.\)]\s*/.test(line)) {
        // Questions before any header: default to part 1
        currentSection = 'part1';
        part1Lines.push(line);
      }
    }
  }

  // 1. Parse Part 1 (Topic-based with questions)
  const part1Result = parsePart1Content(part1Lines);

  // 2. Parse Part 2 (Cue Cards with topic, instructions, points)
  const part2Result = parsePart2Content(part2Lines);

  // 3. Parse Part 3 (Discussion questions grouped under corresponding Part 2 Cue Cards)
  const part3Result = parsePart3Content(part3Lines, part2Result?.cueCards);

  const hasContent = Boolean(
    (part1Result && part1Result.topics.length > 0) ||
    (part2Result && part2Result.cueCards.length > 0) ||
    (part3Result && part3Result.questions.length > 0)
  );

  return {
    sourceFileName,
    part1: part1Result && part1Result.topics.length > 0 ? part1Result : null,
    part2: part2Result && part2Result.cueCards.length > 0 ? part2Result : null,
    part3: part3Result && part3Result.questions.length > 0 ? part3Result : null,
    hasContent,
    rawTextPreview: sanitized.slice(0, 500),
  };
}

/**
 * Parses Part 1 content into Topics, associating each topic with its questions.
 * Accurately recognizes multiple topics across various document formats:
 * - Numbered/labeled topics (e.g., "Topic 1: Names", "1. Study or Work", "Chủ đề 2: Hometown")
 * - Standalone topic headings (e.g., "NAMES", "HOMETOWN", "Reading books")
 * - Groups each question strictly under its respective topic.
 */
function parsePart1Content(lines: string[]): ExtractedSpeakingPart1 | null {
  if (lines.length === 0) return null;

  const topics: SpeakingTopic[] = [];
  let currentTopic: SpeakingTopic | null = null;
  let topicCounter = 1;

  const isQuestionLine = (str: string): boolean => {
    const trimmed = str.trim();
    if (trimmed.endsWith('?')) return true;
    return /^(?:do|did|does|have|has|had|what|where|when|why|how|can|could|would|should|are|is|was|were|who|whom|which|will|if|tell\s+me\s+about|describe)\b/i.test(trimmed);
  };

  const isExplicitTopicHeader = (str: string): { match: boolean; title: string } => {
    const trimmed = str.trim();
    // Pattern 1: Topic 1: ... or Topic: ... or Chủ đề 1: ...
    const m1 = trimmed.match(/^(?:topic\s*(?:\d+)?[:\.\-\s]+|chủ\s*đề\s*(?:\d+)?[:\.\-\s]+|part\s*1\s*[-–:]\s*)([A-Za-z0-9\s,\-_'/&]{2,60})$/i);
    if (m1) {
      return { match: true, title: m1[1].trim() };
    }
    // Pattern 2: Numbered title without question mark, e.g. "1. Work or Studies", "2. Hometown"
    const m2 = trimmed.match(/^\b\d+[\.\)]\s+([A-Z][a-zA-Z0-9\s,\-_'/&]{1,40})$/);
    if (m2 && !isQuestionLine(trimmed)) {
      return { match: true, title: m2[1].trim() };
    }
    return { match: false, title: '' };
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isQ = isQuestionLine(line);
    const explicitHeader = isExplicitTopicHeader(line);

    // 1. Explicit topic header detection (e.g. "Topic 1: Names", "1. Study or Work")
    if (explicitHeader.match && !isQ) {
      if (currentTopic && currentTopic.questions.length > 0) {
        topics.push(currentTopic);
      }
      currentTopic = {
        id: `topic_${topicCounter++}`,
        topic: explicitHeader.title,
        title: explicitHeader.title,
        questions: [],
      };
      continue;
    }

    // 2. Standalone topic title (short, title-case or upper, no question mark, not starting with question word)
    // Triggers when:
    // a) currentTopic has not been created yet, OR
    // b) currentTopic already has at least 1 question and this line is not a question,
    //    and the next line is a question or line is short title.
    if (!isQ && line.length <= 45 && !line.includes('?') && !line.startsWith('-') && !line.startsWith('*')) {
      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
      const looksLikeHeader =
        !currentTopic ||
        (currentTopic.questions.length > 0 &&
          (isQuestionLine(nextLine) || /^[A-Z\s0-9&/'-]{2,45}$/.test(line) || /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(line)));

      if (looksLikeHeader) {
        const cleanTitle = line
          .replace(/^(?:topic\s*(?:\d+)?[:\.\-\s]+|\b\d+[\.\)]\s*)/i, '')
          .trim();

        if (cleanTitle.length >= 2) {
          if (currentTopic && currentTopic.questions.length > 0) {
            topics.push(currentTopic);
          }
          currentTopic = {
            id: `topic_${topicCounter++}`,
            topic: cleanTitle,
            title: cleanTitle,
            questions: [],
          };
          continue;
        }
      }
    }

    // 3. Question extraction
    const cleanQ = line
      .replace(/^(?:q(?:uestion)?\s*\d*[:\.\-\s]+|\d+[\.\)]\s*|[\-\*\•]\s*)/i, '')
      .trim();

    if (cleanQ.length > 5) {
      if (!currentTopic) {
        currentTopic = {
          id: `topic_${topicCounter++}`,
          topic: 'General Questions',
          title: 'General Questions',
          questions: [],
        };
      }
      currentTopic.questions.push(cleanQ);
    }
  }

  if (currentTopic && currentTopic.questions.length > 0) {
    topics.push(currentTopic);
  }

  return {
    topics,
    confidence: topics.length > 0 ? 0.95 : 0,
  };
}

/**
 * Parses Part 2 content into Cue Cards with prompt, 'You should say:' instructions, and bullet points
 */
function parsePart2Content(lines: string[]): ExtractedSpeakingPart2 | null {
  if (lines.length === 0) return null;

  const cueCards: ExtractedSpeakingPart2CueCard[] = [];
  let currentCard: ExtractedSpeakingPart2CueCard | null = null;
  let cardCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Detect start of a Cue Card: "Describe a...", "Talk about a...", "Cue Card 1: Describe...", etc.
    const isCueCardStart =
      /^(?:cue\s*card(?:\s*\d+)?[:\.\-\s]+)?(?:describe|talk\s*about|discuss)\s+a/i.test(line) ||
      /^describe\s+/i.test(line);

    if (isCueCardStart) {
      if (currentCard && (currentCard.topic || currentCard.points.length > 0)) {
        cueCards.push(currentCard);
      }

      const promptText = line.replace(/^cue\s*card(?:\s*\d+)?[:\.\-\s]+/i, '').trim();
      currentCard = {
        id: `cue_card_${cardCounter++}`,
        topic: promptText,
        instructions: 'You should say:',
        points: [],
        prepTimeSeconds: 60,
        speakTimeSeconds: 120,
      };
      continue;
    }

    if (currentCard) {
      // Check for "You should say:"
      if (/you\s*should\s*say/i.test(lower)) {
        currentCard.instructions = line;
        continue;
      }

      // Check for bullet points: "-", "*", "•", "What...", "Where...", "When...", "Why..."
      const bulletMatch = line.match(/^(?:[\-\*\•\+]|\d+[\.\)]|[a-d][\.\)])\s*(.+)$/);
      if (bulletMatch) {
        currentCard.points.push(bulletMatch[1].trim());
      } else if (
        /^(?:what|where|when|who|why|how|and\s+explain)\b/i.test(line) ||
        line.startsWith('-')
      ) {
        currentCard.points.push(line.replace(/^[\-\*\•\+]\s*/, '').trim());
      } else if (currentCard.points.length === 0 && !currentCard.topic.includes(line)) {
        // Could be continuing the prompt
        currentCard.topic += ' ' + line;
      }
    }
  }

  if (currentCard && (currentCard.topic || currentCard.points.length > 0)) {
    cueCards.push(currentCard);
  }

  // Fallback: If no explicit "Describe a..." was found but lines exist in Part 2, construct one
  if (cueCards.length === 0 && lines.length > 0) {
    const firstLine = lines[0];
    const points = lines.slice(1).filter((l) => !/you\s*should\s*say/i.test(l));
    cueCards.push({
      id: `cue_card_${cardCounter++}`,
      topic: firstLine,
      instructions: 'You should say:',
      points: points.length > 0 ? points : ['What it was', 'When it happened', 'Why it mattered'],
      prepTimeSeconds: 60,
      speakTimeSeconds: 120,
    });
  }

  return {
    cueCards,
    confidence: cueCards.length > 0 ? 0.95 : 0,
  };
}

/**
 * Parses Part 3 content into discussion questions, grouping them under corresponding
 * Part 2 Cue Cards as parent groups. Supports standalone Part 3 questions when no Cue Cards are present.
 */
function parsePart3Content(
  lines: string[],
  part2CueCards?: ExtractedSpeakingPart2CueCard[]
): ExtractedSpeakingPart3 | null {
  if (lines.length === 0) return null;

  const groups: ExtractedSpeakingPart3Group[] = [];
  const allQuestions: string[] = [];
  let currentGroup: ExtractedSpeakingPart3Group | null = null;
  let groupCounter = 1;
  const cards = part2CueCards || [];

  const isQuestionLine = (str: string): boolean => {
    const trimmed = str.trim();
    if (trimmed.endsWith('?')) return true;
    return /^(?:do|did|does|have|has|had|what|where|when|why|how|can|could|would|should|are|is|was|were|who|whom|which|will|if)\b/i.test(trimmed);
  };

  const isGroupHeader = (str: string): { match: boolean; topic: string } => {
    const trimmed = str.trim();
    // Pattern: "Topic 1: ...", "Part 3 - ...", "Discussion topics related to: ...", "Cue card 1 discussion"
    const m1 = trimmed.match(
      /^(?:(?:part\s*3\s*[-–:]\s*)?(?:discussion\s*(?:topics|questions)?\s*(?:related\s*to)?[:\.\-\s]+|topic\s*(?:\d+)?[:\.\-\s]+|chủ\s*đề\s*(?:\d+)?[:\.\-\s]+))([A-Za-z0-9\s,\-_'/&]{2,80})$/i
    );
    if (m1) {
      return { match: true, topic: m1[1].trim() };
    }

    // Pattern: short heading without question mark if questions follow
    if (!isQuestionLine(trimmed) && trimmed.length <= 50 && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
      const isCardTopicMatch = cards.some((c) =>
        trimmed.toLowerCase().includes(c.topic.toLowerCase().slice(0, 20))
      );
      if (isCardTopicMatch || /^(?:[A-Z\s0-9&/'-]{2,50}|\d+[\.\)]\s+[A-Z][a-zA-Z0-9\s&/'-]+)$/.test(trimmed)) {
        return { match: true, topic: trimmed.replace(/^\d+[\.\)]\s*/, '').trim() };
      }
    }

    return { match: false, topic: '' };
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isQ = isQuestionLine(line);
    const groupHead = isGroupHeader(line);

    if (groupHead.match && !isQ) {
      if (currentGroup && currentGroup.questions.length > 0) {
        groups.push(currentGroup);
      }

      // Check if this group corresponds to a specific Cue Card
      const matchedCard =
        cards.find(
          (c) =>
            groupHead.topic.toLowerCase().includes(c.topic.toLowerCase().slice(0, 15)) ||
            c.topic.toLowerCase().includes(groupHead.topic.toLowerCase().slice(0, 15))
        ) || cards[groups.length] || null;

      currentGroup = {
        id: `p3_group_${groupCounter++}`,
        cueCardTopic: matchedCard ? matchedCard.topic : groupHead.topic || `Discussion Topic ${groupCounter}`,
        cueCardId: matchedCard?.id,
        questions: [],
      };
      continue;
    }

    // Clean question text
    const cleanQ = line
      .replace(/^(?:q(?:uestion)?\s*\d*[:\.\-\s]+|\d+[\.\)]\s*|[\-\*\•]\s*)/i, '')
      .trim();

    if (cleanQ.length > 5) {
      if (!currentGroup) {
        // Associate with first Part 2 cue card or default to General Discussion
        const initialCard = cards[0] || null;
        currentGroup = {
          id: `p3_group_${groupCounter++}`,
          cueCardTopic: initialCard ? initialCard.topic : 'General Discussion',
          cueCardId: initialCard?.id,
          questions: [],
        };
      }
      currentGroup.questions.push(cleanQ);
      allQuestions.push(cleanQ);
    }
  }

  if (currentGroup && currentGroup.questions.length > 0) {
    groups.push(currentGroup);
  }

  // If no groups formed but lines exist, create default group
  if (groups.length === 0 && allQuestions.length > 0) {
    const initialCard = cards[0] || null;
    groups.push({
      id: `p3_group_1`,
      cueCardTopic: initialCard ? initialCard.topic : 'General Discussion',
      cueCardId: initialCard?.id,
      questions: allQuestions,
    });
  }

  return {
    questions: allQuestions,
    groups,
    confidence: allQuestions.length > 0 ? 0.95 : 0,
  };
}
