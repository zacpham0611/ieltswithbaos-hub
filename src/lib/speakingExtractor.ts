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
 * Filter noise, table of contents, recurring headers/footers, metadata,
 * references, and standalone page numbers from speaking documents.
 * Works universally across varied PDF/DOCX layouts.
 */
export function sanitizeSpeakingDocumentText(rawText: string): string[] {
  if (!rawText) return [];

  // Normalize quotes, dashes, line breaks
  let normalized = rawText
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Strip standalone forecast date banners: e.g. "2026 - 2027", "Jan - Apr 2026 Question Bank"
  normalized = normalized
    .replace(/(?:^|\n)\s*(?:(?:19|20)\d{2}\s*[\-\/]\s*(?:19|20)\d{2}|Q[1-4]\s*(?:19|20)\d{2})\s*(?=\n|$)/gi, '\n')
    .replace(/(?:^|\n)\s*(?:IELTS\s+)?(?:Speaking\s+)?(?:Forecast|Dự đoán|Bộ đề|Question Bank)\s*(?:Q[1-4]|Quý\s*[1-4]|\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|[\-\/,\s])*\s*(?=\n|$)/gi, '\n');

  const rawLines = normalized.split('\n').map((l) => l.trim());
  const cleaned: string[] = [];

  let inTOC = false;
  let inReferences = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line) continue;

    // Remove page markers (e.g. "--- PAGE 1 ---", "Page 1 of 12", "Trang 3/10")
    if (/^--- PAGE \d+ ---$/i.test(line)) continue;
    if (/^(?:page|trang)\s*\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(line)) continue;

    // Remove standalone page numbers (e.g. "1", "27")
    if (/^\d{1,3}$/.test(line)) continue;

    // Table of contents start detection
    if (/^(?:contents|mục\s*lục|table\s*of\s*contents)$/i.test(line)) {
      inTOC = true;
      continue;
    }

    if (inTOC) {
      // Check if line looks like a TOC line (has dot leaders, ends with page numbers)
      const isTocLine =
        /\.{2,}/.test(line) ||
        /\s+\d{1,3}$/.test(line) ||
        /^(?:\d+(?:\.\d+)*\s+)?(?:forecast|part|quý|unit|chapter)/i.test(line);

      const nextLine = i + 1 < rawLines.length ? rawLines[i + 1] : '';
      const isActualContent =
        nextLine.startsWith('•') ||
        nextLine.startsWith('-') ||
        /^(?:describe|talk\s*about)\b/i.test(line);

      if (!isTocLine || isActualContent) {
        inTOC = false;
      } else {
        continue;
      }
    }

    // References / Source Links at end of document detection
    if (/^(?:nguồn\s*tham\s*khảo|references|tài\s*liệu\s*tham\s*khảo|bibliography|sources)$/i.test(line)) {
      inReferences = true;
      continue;
    }

    if (inReferences) {
      // Skip reference lines, URLs, acknowledgments
      if (
        /https?:\/\/|\.(?:com|vn|org|edu)|the\s*ielts\s*workshop|bộ\s*đề\s*dự\s*đoán/i.test(line) ||
        /^[•\-\*]/.test(line)
      ) {
        continue;
      }
    }

    // Strip document cover page metadata and disclaimers
    if (
      /^(?:tổng\s*hợp(?:\s*từ\s*nguồn)?|bộ\s*đề\s*dự\s*đoán|ielts\s*speaking\s*\d{4}|tài\s*liệu\s*tổng\s*hợp\s*phục\s*vụ)/i.test(
        line
      )
    ) {
      continue;
    }

    // Strip standalone quarter summary lines on cover like "Quý 1/2024 (Tháng 1 – 4)"
    if (/^quý\s*\d.*\(tháng/i.test(line) || /^quý\s*1\s*–\s*quý/i.test(line)) {
      continue;
    }

    // Strip remaining dot leaders lines if any
    if (/\.{3,}/.test(line)) {
      continue;
    }

    cleaned.push(line);
  }

  // Line-wrapping reconstruction:
  // If a question or cue point wrapped across two lines without a bullet prefix on the 2nd line,
  // stitch them back together cleanly.
  const stitched: string[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const line = cleaned[i];
    const nextLine = i + 1 < cleaned.length ? cleaned[i + 1] : '';

    stitched.push(line);

    if (
      nextLine &&
      !/^[•\-\*\+]/.test(nextLine) &&
      !/^\d+[\.\)]/.test(nextLine) &&
      !/^(?:part\s*\d|describe|talk\s*about|you\s*should\s*say|you\s*should\s*include)/i.test(nextLine) &&
      !/^(?:topic|chủ\s*đề)\b/i.test(nextLine) &&
      !/^(?:what|where|when|who|why|how|and\s+explain)\b/i.test(nextLine) &&
      !line.endsWith('?') &&
      !line.endsWith('.') &&
      !line.endsWith(':') &&
      /^[•\-\*\+]/.test(line)
    ) {
      stitched[stitched.length - 1] = line + ' ' + nextLine;
      i++; // skip next line
    }
  }

  return stitched;
}

/**
 * Dedicated generalized IELTS Speaking parser for Smart Document Import.
 * Recognizes Part 1 (Topic headings + questions), Part 2 (Cue Cards), and Part 3 (Discussion groups linked to Cue Cards).
 * Handles multi-part forecasts, single tests, varied headings, and interleaved Part 2/3 structures.
 */
export function extractSpeakingPartsFromDocument(
  rawText: string,
  sourceFileName: string = 'Speaking_Document'
): ExtractedSpeakingDocument {
  const lines = sanitizeSpeakingDocumentText(rawText);

  const part1Topics: SpeakingTopic[] = [];
  const cueCards: ExtractedSpeakingPart2CueCard[] = [];
  const part3Groups: ExtractedSpeakingPart3Group[] = [];
  const allPart3Questions: string[] = [];

  let state: 'unknown' | 'part1' | 'part2_and_3' | 'cue_card' | 'part3' = 'unknown';
  let currentTopic: SpeakingTopic | null = null;
  let currentCard: ExtractedSpeakingPart2CueCard | null = null;
  let currentP3Group: ExtractedSpeakingPart3Group | null = null;

  const isQuestionLine = (str: string): boolean => {
    const trimmed = str.replace(/^(?:\d+[\.\)]|[•\-\*\+])\s*/, '').trim();
    if (trimmed.endsWith('?')) return true;
    return /^(?:do|did|does|have|has|had|what|where|when|why|how|can|could|would|should|are|is|was|were|who|whom|which|will|if|tell\s+me\s+about)\b/i.test(
      trimmed
    );
  };

  const isCueCardPromptStart = (str: string): { isMatch: boolean; prompt: string } => {
    const trimmed = str.trim();
    // Pattern 1: Starts with Describe or Talk about
    const m1 = trimmed.match(
      /^(?:(?:cue\s*card|topic|part\s*2)\s*(?:\d+)?[:\.\-\s]+)?((?:describe|talk\s*about|discuss)\s+.+)$/i
    );
    if (m1) {
      return { isMatch: true, prompt: m1[1].trim() };
    }
    // Pattern 2: Explicit "Cue Card 1: ..." or "Candidate Task Card:"
    const m2 = trimmed.match(
      /^(?:cue\s*card|candidate\s*task\s*card)\s*(?:\d+)?[:\.\-\s]+(.+)$/i
    );
    if (m2 && !m2[1].endsWith('?')) {
      return { isMatch: true, prompt: m2[1].trim() };
    }
    return { isMatch: false, prompt: '' };
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Check Part 1 Section Boundary
    if (
      /(?:forecast\s+)?part\s*1\b/i.test(line) &&
      !/\bpart\s*[23]\b/i.test(line) &&
      !/part\s*1\s*(?:&|and)\s*2/i.test(line)
    ) {
      state = 'part1';
      currentTopic = null;
      continue;
    }

    // 2. Check Part 2 & 3 Combined Boundary (e.g. "Forecast Part 2 & 3")
    if (/(?:forecast\s+)?part\s*2\s*(?:&|and|và)\s*3/i.test(line)) {
      state = 'part2_and_3';
      continue;
    }

    // 3. Check Part 3 Header (e.g. "Part 3", "PART 3: DISCUSSION", "Part 3 - Discussion Questions")
    if (
      /^(?:part\s*3\b|phần\s*3\b|speaking\s*part\s*3\b)(?:[\s\-–:]*(?:discussion(?:\s*(?:questions|topics|two[\s-]way))?|follow[\s-]up\s*questions|extended\s*questions)?)?$/i.test(
        line
      ) ||
      /^(?:discussion\s*questions|discussion\s*topics|follow[\s-]up\s*questions)$/i.test(line)
    ) {
      state = 'part3';
      currentP3Group = null;
      continue;
    }

    // 4. Check Cue Card Prompt Start (e.g. "Describe a party that you enjoyed")
    const cueMatch = isCueCardPromptStart(line);
    if (cueMatch.isMatch) {
      state = 'cue_card';
      currentCard = {
        id: `cue_card_${cueCards.length + 1}`,
        topic: cueMatch.prompt,
        instructions: 'You should say:',
        points: [],
        prepTimeSeconds: 60,
        speakTimeSeconds: 120,
      };
      cueCards.push(currentCard);
      continue;
    }

    // 5. Handling Cue Card Body
    if (state === 'cue_card' && currentCard) {
      // Check instructions
      if (/you\s*should\s*say|you\s*should\s*include|prompt:/i.test(line)) {
        currentCard.instructions = line;
        continue;
      }

      // Check bullet points / cues
      const isBullet =
        /^[•\-\*\+]/.test(line) ||
        /^\d+[\.\)]/.test(line) ||
        /^[a-d][\.\)]/.test(line) ||
        /^(?:what|where|when|who|why|how|and\s+explain)\b/i.test(line);

      if (isBullet) {
        currentCard.points.push(line.replace(/^(?:\d+[\.\)]|[a-d][\.\)]|[•\-\*\+])\s*/, '').trim());
        continue;
      }

      // Multi-line prompt continuation before bullet points
      if (currentCard.points.length === 0 && !/you\s*should\s*say/i.test(line)) {
        currentCard.topic += ' ' + line;
        continue;
      }
    }

    // 6. Handling Part 3 Questions
    if (state === 'part3') {
      // Check if line is a sub-group header within Part 3 (e.g. "Discussion topics related to: Describe...", "Topic 1: ...")
      const groupHeaderMatch = line.match(
        /^(?:discussion\s*(?:topics|questions)?\s*(?:related\s*to)?[:\.\-\s]+|topic\s*(?:\d+)?[:\.\-\s]+|chủ\s*đề\s*(?:\d+)?[:\.\-\s]+)(.+)$/i
      );
      const isCardTopicMatch =
        cueCards.length > 0 &&
        cueCards.some(
          (c) =>
            line.toLowerCase().includes(c.topic.toLowerCase().slice(0, 15)) ||
            c.topic.toLowerCase().includes(line.toLowerCase().slice(0, 15))
        );

      if ((groupHeaderMatch || (isCardTopicMatch && !isQuestionLine(line))) && !line.endsWith('?')) {
        const subTopic = groupHeaderMatch ? groupHeaderMatch[1].trim() : line.trim();
        const matchedCard =
          cueCards.find(
            (c) =>
              subTopic.toLowerCase().includes(c.topic.toLowerCase().slice(0, 15)) ||
              c.topic.toLowerCase().includes(subTopic.toLowerCase().slice(0, 15))
          ) || cueCards[part3Groups.filter((g) => g.questions.length > 0).length] || null;

        // If current group has no questions yet, re-use it
        if (currentP3Group && currentP3Group.questions.length === 0) {
          currentP3Group.cueCardTopic = matchedCard ? matchedCard.topic : subTopic;
          currentP3Group.cueCardId = matchedCard?.id;
        } else {
          currentP3Group = {
            id: `p3_group_${part3Groups.length + 1}`,
            cueCardTopic: matchedCard ? matchedCard.topic : subTopic,
            cueCardId: matchedCard?.id,
            questions: [],
          };
          part3Groups.push(currentP3Group);
        }
        continue;
      }

      const isQ = /^[•\-\*\+]/.test(line) || /^\d+[\.\)]/.test(line) || isQuestionLine(line);
      if (isQ) {
        const cleanQ = line.replace(/^(?:\d+[\.\)]|[•\-\*\+])\s*/, '').trim();
        if (cleanQ.length > 5) {
          if (!currentP3Group) {
            const defaultCard = currentCard || cueCards[part3Groups.length] || null;
            currentP3Group = {
              id: `p3_group_${part3Groups.length + 1}`,
              cueCardTopic: defaultCard ? defaultCard.topic : 'General Discussion',
              cueCardId: defaultCard?.id,
              questions: [],
            };
            part3Groups.push(currentP3Group);
          }
          currentP3Group.questions.push(cleanQ);
          allPart3Questions.push(cleanQ);
        }
        continue;
      }
    }

    // 7. Handling Part 1 Topics & Questions
    if (state === 'part1' || state === 'unknown') {
      const isExplicitTopic = /^(?:topic\s*(?:\d+)?[:\.\-\s]+|chủ\s*đề\s*(?:\d+)?[:\.\-\s]+)/i.test(line);
      const isQ =
        !isExplicitTopic &&
        (/^[•\-\*\+]/.test(line) || /^\d+[\.\)]\s+/.test(line) || isQuestionLine(line));

      if (isQ) {
        const cleanQ = line.replace(/^(?:\d+[\.\)]|[•\-\*\+])\s*/, '').trim();
        if (cleanQ.length > 5) {
          if (!currentTopic) {
            currentTopic = {
              id: `topic_${part1Topics.length + 1}`,
              topic: 'General Questions',
              title: 'General Questions',
              questions: [],
            };
            part1Topics.push(currentTopic);
          }
          currentTopic.questions.push(cleanQ);
        }
      } else {
        const cleanTitle = line
          .replace(/^(?:topic\s*(?:\d+)?[:\.\-\s]+|chủ\s*đề\s*(?:\d+)?[:\.\-\s]+|\d+[\.\)]\s*)/i, '')
          .trim();

        const looksLikeTopic =
          isExplicitTopic ||
          (line.length <= 60 && !line.includes('?') && !line.endsWith(':') && cleanTitle.length >= 2);

        if (looksLikeTopic) {
          currentTopic = {
            id: `topic_${part1Topics.length + 1}`,
            topic: cleanTitle,
            title: cleanTitle,
            questions: [],
          };
          part1Topics.push(currentTopic);
          state = 'part1';
        }
      }
    }
  }

  // Filter out any empty topics
  const validPart1Topics = part1Topics.filter((t) => t.questions.length > 0);

  // Filter out any empty cue cards
  const validCueCards = cueCards.filter((c) => c.topic.trim().length > 0);

  // Filter out any empty part 3 groups
  const validP3Groups = part3Groups.filter((g) => g.questions.length > 0);

  const hasContent = Boolean(
    validPart1Topics.length > 0 || validCueCards.length > 0 || allPart3Questions.length > 0
  );

  return {
    sourceFileName,
    part1:
      validPart1Topics.length > 0
        ? {
            topics: validPart1Topics,
            confidence: 0.95,
          }
        : null,
    part2:
      validCueCards.length > 0
        ? {
            cueCards: validCueCards,
            confidence: 0.95,
          }
        : null,
    part3:
      validP3Groups.length > 0 || allPart3Questions.length > 0
        ? {
            questions: allPart3Questions,
            groups: validP3Groups,
            confidence: 0.95,
          }
        : null,
    hasContent,
    rawTextPreview: lines.slice(0, 30).join('\n'),
  };
}
