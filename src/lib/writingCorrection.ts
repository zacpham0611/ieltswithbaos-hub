import type { InlineAnnotation } from '../types/index.ts';

export interface CorrectedSegment {
  type: 'plain' | 'replacement';
  text: string;
  originalText?: string;
  comment?: string;
  category?: string;
  annotationId?: string;
}

export interface CorrectedEssayResult {
  correctedText: string;
  diffSegments: CorrectedSegment[];
  totalCorrections: number;
}

/**
 * Canonicalizes essay text to LF newlines and Unicode NFC normalization.
 */
export function toCanonicalEssayText(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .normalize('NFC');
}

/**
 * Finds the occurrence of `needle` in `haystack` that is closest to `preferredIndex`.
 * Operates in canonical LF normalized coordinate space.
 */
export function findClosestOccurrence(
  haystack: string,
  needle: string,
  preferredIndex: number
): { start: number; end: number } | null {
  if (!needle || !haystack) return null;

  const h = toCanonicalEssayText(haystack);
  const n = toCanonicalEssayText(needle);
  const needleLen = n.length;

  if (needleLen === 0) return null;

  // 1. Direct match at preferredIndex
  if (
    preferredIndex >= 0 &&
    preferredIndex + needleLen <= h.length &&
    h.substring(preferredIndex, preferredIndex + needleLen) === n
  ) {
    return { start: preferredIndex, end: preferredIndex + needleLen };
  }

  // 2. Check localized search window around preferredIndex (within radius of 120 chars or 2x needleLen)
  const windowRadius = Math.max(120, needleLen * 2);
  const winStart = Math.max(0, preferredIndex - windowRadius);
  const winEnd = Math.min(h.length, preferredIndex + needleLen + windowRadius);
  const windowSub = h.substring(winStart, winEnd);

  let bestOffset = -1;
  let minDiff = Infinity;

  let localIdx = windowSub.indexOf(n);
  while (localIdx !== -1) {
    const globalIdx = winStart + localIdx;
    const diff = Math.abs(globalIdx - preferredIndex);
    if (diff < minDiff) {
      minDiff = diff;
      bestOffset = globalIdx;
    }
    localIdx = windowSub.indexOf(n, localIdx + 1);
  }

  if (bestOffset !== -1) {
    return { start: bestOffset, end: bestOffset + needleLen };
  }

  // 3. Fallback: Search globally across entire haystack for the closest occurrence
  let globalIdx = h.indexOf(n);
  while (globalIdx !== -1) {
    const diff = Math.abs(globalIdx - preferredIndex);
    if (diff < minDiff) {
      minDiff = diff;
      bestOffset = globalIdx;
    }
    globalIdx = h.indexOf(n, globalIdx + 1);
  }

  if (bestOffset !== -1) {
    return { start: bestOffset, end: bestOffset + needleLen };
  }

  // 4. Try trimmed needle if untrimmed failed
  const trimmed = n.trim();
  if (trimmed.length > 0 && trimmed.length !== n.length) {
    const trimmedMatch = findClosestOccurrence(h, trimmed, preferredIndex);
    if (trimmedMatch) return trimmedMatch;
  }

  // 5. Case-insensitive fallback in localized window
  const hLower = h.toLowerCase();
  const nLower = n.toLowerCase();
  const winSubLower = hLower.substring(winStart, winEnd);
  let localLowerIdx = winSubLower.indexOf(nLower);
  while (localLowerIdx !== -1) {
    const globalIdx = winStart + localLowerIdx;
    const diff = Math.abs(globalIdx - preferredIndex);
    if (diff < minDiff) {
      minDiff = diff;
      bestOffset = globalIdx;
    }
    localLowerIdx = winSubLower.indexOf(nLower, localLowerIdx + 1);
  }

  if (bestOffset !== -1) {
    return { start: bestOffset, end: bestOffset + needleLen };
  }

  return null;
}

/**
 * Normalizes annotation index positions within canonical essay text.
 * Resolves offsets consistently using the closest occurrence to prevent offset drift.
 */
export function normalizeAnnotations(
  text: string,
  annotations: InlineAnnotation[] = []
): (InlineAnnotation & { resolvedStart: number; resolvedEnd: number })[] {
  if (!text || !annotations || annotations.length === 0) return [];

  const canonicalText = toCanonicalEssayText(text);
  const resolved: (InlineAnnotation & { resolvedStart: number; resolvedEnd: number })[] = [];

  for (const ann of annotations) {
    let start = Number(ann.startIndex);
    let end = Number(ann.endIndex);
    const target = toCanonicalEssayText(ann.selectedText || '');

    // Case 1: Exact match at [start, end)
    if (
      !isNaN(start) &&
      !isNaN(end) &&
      start >= 0 &&
      end <= canonicalText.length &&
      start < end &&
      canonicalText.substring(start, end) === target
    ) {
      resolved.push({
        ...ann,
        resolvedStart: start,
        resolvedEnd: end,
      });
      continue;
    }

    // Case 2: Match closest occurrence to start
    if (target.length > 0) {
      const match = findClosestOccurrence(canonicalText, target, !isNaN(start) ? start : 0);
      if (match) {
        resolved.push({
          ...ann,
          resolvedStart: match.start,
          resolvedEnd: match.end,
        });
        continue;
      }
    }

    // Case 3: Valid numeric bounds fallback
    if (!isNaN(start) && !isNaN(end) && start >= 0 && end <= canonicalText.length && start < end) {
      resolved.push({
        ...ann,
        resolvedStart: start,
        resolvedEnd: end,
      });
    }
  }

  // Sort by start index ascending
  return resolved.sort((a, b) => a.resolvedStart - b.resolvedStart);
}

/**
 * Generates the polished, corrected essay text by applying teacher suggestions/corrections
 * onto the student's original essay.
 */
export function generateCorrectedEssay(
  originalText: string,
  annotations: InlineAnnotation[] = []
): CorrectedEssayResult {
  if (!originalText || !originalText.trim()) {
    return { correctedText: '', diffSegments: [], totalCorrections: 0 };
  }

  const canonicalText = toCanonicalEssayText(originalText);
  const validAnnots = normalizeAnnotations(canonicalText, annotations);
  const withSuggestions = validAnnots.filter(
    (a) =>
      a.type === 'deletion' ||
      (a.suggestion && a.suggestion.trim().length > 0 && a.suggestion.trim() !== a.selectedText.trim())
  );

  if (withSuggestions.length === 0) {
    return {
      correctedText: canonicalText,
      diffSegments: [{ type: 'plain', text: canonicalText }],
      totalCorrections: 0,
    };
  }

  // Filter non-overlapping suggestions
  const nonOverlapping: typeof withSuggestions = [];
  let lastEnd = 0;
  for (const a of withSuggestions) {
    if (a.resolvedStart >= lastEnd) {
      nonOverlapping.push(a);
      lastEnd = a.resolvedEnd;
    }
  }

  const diffSegments: CorrectedSegment[] = [];
  let cursor = 0;
  let fullCorrected = '';

  for (const a of nonOverlapping) {
    if (a.resolvedStart > cursor) {
      const plainChunk = canonicalText.substring(cursor, a.resolvedStart);
      diffSegments.push({ type: 'plain', text: plainChunk });
      fullCorrected += plainChunk;
    }

    const correctedChunk = a.type === 'deletion' ? '' : (a.suggestion ? a.suggestion.trim() : '');
    const originalChunk = canonicalText.substring(a.resolvedStart, a.resolvedEnd);

    diffSegments.push({
      type: 'replacement',
      text: correctedChunk,
      originalText: originalChunk,
      comment: a.comment,
      category: a.type,
      annotationId: a.id,
    });
    fullCorrected += correctedChunk;

    cursor = a.resolvedEnd;
  }

  if (cursor < canonicalText.length) {
    const trailingChunk = canonicalText.substring(cursor);
    diffSegments.push({ type: 'plain', text: trailingChunk });
    fullCorrected += trailingChunk;
  }

  return {
    correctedText: fullCorrected,
    diffSegments,
    totalCorrections: nonOverlapping.length,
  };
}
