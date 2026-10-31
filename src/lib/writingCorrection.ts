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
 * Normalizes annotation index positions within original text.
 * Falls back to finding selectedText if indices are offset.
 */
export function normalizeAnnotations(
  text: string,
  annotations: InlineAnnotation[] = []
): (InlineAnnotation & { resolvedStart: number; resolvedEnd: number })[] {
  if (!text || !annotations || annotations.length === 0) return [];

  const resolved: (InlineAnnotation & { resolvedStart: number; resolvedEnd: number })[] = [];

  for (const ann of annotations) {
    let start = Number(ann.startIndex);
    let end = Number(ann.endIndex);

    const isExactMatch =
      !isNaN(start) &&
      !isNaN(end) &&
      start >= 0 &&
      end <= text.length &&
      start < end &&
      text.substring(start, end) === ann.selectedText;

    const isTrimmedMatch =
      !isExactMatch &&
      !isNaN(start) &&
      !isNaN(end) &&
      start >= 0 &&
      end <= text.length &&
      start < end &&
      text.substring(start, end).trim().toLowerCase() === (ann.selectedText || '').trim().toLowerCase();

    const isDirectMatch = isExactMatch || isTrimmedMatch;

    if (!isDirectMatch && ann.selectedText && ann.selectedText.length > 0) {
      const target = ann.selectedText;
      const foundIdx = text.indexOf(target);
      if (foundIdx !== -1) {
        start = foundIdx;
        end = foundIdx + target.length;
      } else {
        const foundTrimmed = text.toLowerCase().indexOf(target.trim().toLowerCase());
        if (foundTrimmed !== -1) {
          start = foundTrimmed;
          end = foundTrimmed + target.trim().length;
        }
      }
    }

    if (!isNaN(start) && !isNaN(end) && start >= 0 && end <= text.length && start < end) {
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

  const validAnnots = normalizeAnnotations(originalText, annotations);
  const withSuggestions = validAnnots.filter(
    (a) =>
      a.type === 'deletion' ||
      (a.suggestion && a.suggestion.trim().length > 0 && a.suggestion.trim() !== a.selectedText.trim())
  );

  if (withSuggestions.length === 0) {
    return {
      correctedText: originalText,
      diffSegments: [{ type: 'plain', text: originalText }],
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
      const plainChunk = originalText.substring(cursor, a.resolvedStart);
      diffSegments.push({ type: 'plain', text: plainChunk });
      fullCorrected += plainChunk;
    }

    const correctedChunk = a.type === 'deletion' ? '' : (a.suggestion ? a.suggestion.trim() : '');
    const originalChunk = originalText.substring(a.resolvedStart, a.resolvedEnd);

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

  if (cursor < originalText.length) {
    const trailingChunk = originalText.substring(cursor);
    diffSegments.push({ type: 'plain', text: trailingChunk });
    fullCorrected += trailingChunk;
  }

  return {
    correctedText: fullCorrected,
    diffSegments,
    totalCorrections: nonOverlapping.length,
  };
}
