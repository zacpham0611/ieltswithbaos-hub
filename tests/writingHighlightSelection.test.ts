import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  toCanonicalEssayText,
  findClosestOccurrence,
  normalizeAnnotations,
  generateCorrectedEssay,
} from '../src/lib/writingCorrection.ts';
import type { InlineAnnotation } from '../src/types/index.ts';

describe('IELTS WRITING HIGHLIGHT SELECTION & OFFSET INTEGRITY', () => {
  const sampleEssay = `The provided bar chart illustrates how much electricity was produced in France from 2010 to 2020.

Overall, nuclear power accounted for the vast majority of total energy output throughout the entire period. In addition, renewable energy sources experienced substantial growth, while fossil fuels witnessed a downward trend.

In 2010, nuclear energy accounted for approximately 75% of the total electricity generated, which was significantly higher than any other sector. By contrast, solar and wind power accounted for merely 5% in the initial year.

Đoạn văn kết luận: Nhìn chung, năng lượng tái tạo đã được coi là một giải pháp bền vững cho tương lai.`;

  test('1. Selects the first and last character of a single word with exact [start, end) boundaries', () => {
    const canonical = toCanonicalEssayText(sampleEssay);

    // Let's select the word "Overall"
    const word = 'Overall';
    const expectedStart = canonical.indexOf('Overall');
    assert.ok(expectedStart !== -1, 'Word must exist in canonical essay');
    const expectedEnd = expectedStart + word.length;

    // Verify boundary slice matches character-for-character
    const sliced = canonical.substring(expectedStart, expectedEnd);
    assert.equal(sliced, 'Overall');
    assert.equal(sliced[0], 'O', 'First character must be exact');
    assert.equal(sliced[sliced.length - 1], 'l', 'Last character must be exact');

    // Simulate creation of annotation
    const annot: InlineAnnotation = {
      id: 'annot-1',
      startIndex: expectedStart,
      endIndex: expectedEnd,
      selectedText: sliced,
      type: 'vocabulary',
      comment: 'Good cohesive device',
    };

    const normalized = normalizeAnnotations(canonical, [annot]);
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].resolvedStart, expectedStart);
    assert.equal(normalized[0].resolvedEnd, expectedEnd);
    assert.equal(canonical.substring(normalized[0].resolvedStart, normalized[0].resolvedEnd), 'Overall');
  });

  test('2. Selects "accounted for" without trailing whitespace, avoiding collision with earlier occurrences', () => {
    const canonical = toCanonicalEssayText(sampleEssay);

    // "accounted for" appears 3 times in the essay:
    // 1st: paragraph 2 ("nuclear power accounted for the vast...")
    // 2nd: paragraph 3 ("nuclear energy accounted for approximately...")
    // 3rd: paragraph 3 ("solar and wind power accounted for merely...")
    const occurrences: number[] = [];
    let idx = canonical.indexOf('accounted for');
    while (idx !== -1) {
      occurrences.push(idx);
      idx = canonical.indexOf('accounted for', idx + 1);
    }
    assert.equal(occurrences.length, 3, 'Must have 3 occurrences in sample text');

    // Teacher selects the SECOND occurrence (in paragraph 3)
    const targetPhrase = 'accounted for'; // Note: NO trailing whitespace
    const secondOccurrenceStart = occurrences[1];
    const secondOccurrenceEnd = secondOccurrenceStart + targetPhrase.length;

    assert.equal(
      canonical.substring(secondOccurrenceStart, secondOccurrenceEnd),
      'accounted for',
      'Exact second occurrence text match'
    );
    // Verify character before and after
    assert.equal(canonical[secondOccurrenceStart - 1], ' ', 'Preceding character is space');
    assert.equal(canonical[secondOccurrenceEnd], ' ', 'Succeeding character is space');

    // Suppose an existing annotation or client had a slight offset (e.g. +2 chars off due to line breaks)
    const slightlyDriftedIndex = secondOccurrenceStart + 2;
    const match = findClosestOccurrence(canonical, targetPhrase, slightlyDriftedIndex);
    assert.ok(match, 'Must find closest match');
    assert.equal(
      match.start,
      secondOccurrenceStart,
      'Must resolve to the second occurrence in paragraph 3, NOT the first occurrence in paragraph 2'
    );
    assert.equal(match.end, secondOccurrenceEnd);
    assert.equal(canonical.substring(match.start, match.end), 'accounted for');
  });

  test('3. Selects sentences containing punctuation, spaces and line breaks (with CRLF normalization)', () => {
    // Original raw text containing CRLF \r\n line breaks
    const rawTextWithCRLF = "First paragraph sentence.\r\n\r\nSecond paragraph begins here with a complex sentence, containing commas, semicolons; and details!\r\n\r\nThird paragraph.";
    const canonical = toCanonicalEssayText(rawTextWithCRLF);

    // Ensure all CRLF are converted to LF
    assert.equal(canonical.includes('\r'), false, 'Canonical text must have zero carriage returns');

    // Select text across the paragraph boundary: "sentence.\n\nSecond paragraph"
    const crossParagraphSnippet = "sentence.\n\nSecond paragraph";
    const foundStart = canonical.indexOf(crossParagraphSnippet);
    assert.ok(foundStart !== -1, 'Cross-paragraph snippet must be found in canonical text');
    const foundEnd = foundStart + crossParagraphSnippet.length;

    const annot: InlineAnnotation = {
      id: 'annot-crlf-1',
      startIndex: foundStart,
      endIndex: foundEnd,
      selectedText: crossParagraphSnippet,
      type: 'grammar',
      comment: 'Check paragraph transition',
    };

    const normalized = normalizeAnnotations(canonical, [annot]);
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].resolvedStart, foundStart);
    assert.equal(normalized[0].resolvedEnd, foundEnd);
    assert.equal(
      canonical.substring(normalized[0].resolvedStart, normalized[0].resolvedEnd),
      crossParagraphSnippet,
      'Rendered highlight text must match selectedText across line breaks and punctuation'
    );
  });

  test('4. Selects Vietnamese accented text and special Unicode characters accurately', () => {
    const canonical = toCanonicalEssayText(sampleEssay);
    const vnSnippet = 'năng lượng tái tạo đã được coi là một giải pháp bền vững cho tương lai';

    const start = canonical.indexOf(vnSnippet);
    assert.ok(start !== -1, 'Vietnamese phrase must exist in canonical text');
    const end = start + vnSnippet.length;

    const annot: InlineAnnotation = {
      id: 'annot-vn',
      startIndex: start,
      endIndex: end,
      selectedText: vnSnippet,
      type: 'suggestion',
      comment: 'Văn phong học thuật rất tốt',
      suggestion: 'năng lượng tái tạo đã được nhìn nhận là một giải pháp bền vững',
    };

    const normalized = normalizeAnnotations(canonical, [annot]);
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].resolvedStart, start);
    assert.equal(normalized[0].resolvedEnd, end);
    assert.equal(canonical.substring(normalized[0].resolvedStart, normalized[0].resolvedEnd), vnSnippet);

    // Test generateCorrectedEssay with Vietnamese suggestion
    const corrected = generateCorrectedEssay(canonical, [annot]);
    assert.equal(corrected.totalCorrections, 1);
    assert.ok(
      corrected.correctedText.includes('năng lượng tái tạo đã được nhìn nhận là một giải pháp bền vững'),
      'Replacement chunk correctly inserted into essay'
    );
    assert.ok(
      !corrected.correctedText.includes('năng lượng tái tạo đã được coi là một giải pháp bền vững'),
      'Original text cleanly replaced without leftover characters'
    );
  });

  test('5. Multiple annotations in the same paragraph do not cause offset drift', () => {
    const canonical = toCanonicalEssayText(sampleEssay);

    // Paragraph 2 has:
    // Annot 1: "nuclear power"
    // Annot 2: "vast majority"
    // Annot 3: "substantial growth"
    // Annot 4: "fossil fuels"
    const targets = [
      { text: 'nuclear power', type: 'vocabulary' as const, comment: 'Collocation' },
      { text: 'vast majority', type: 'praise' as const, comment: 'Strong academic phrase' },
      { text: 'substantial growth', type: 'correction' as const, comment: 'Specify data' },
      { text: 'fossil fuels', type: 'grammar' as const, comment: 'Clarify energy source' },
    ];

    const annots: InlineAnnotation[] = targets.map((t, idx) => {
      const start = canonical.indexOf(t.text);
      assert.ok(start !== -1, `Target ${t.text} must exist`);
      return {
        id: `annot-p2-${idx + 1}`,
        startIndex: start,
        endIndex: start + t.text.length,
        selectedText: t.text,
        type: t.type,
        comment: t.comment,
      };
    });

    const normalized = normalizeAnnotations(canonical, annots);
    assert.equal(normalized.length, 4, 'All 4 annotations must be normalized');

    // Verify each annotation resolvedStart and resolvedEnd matches its selectedText exactly
    for (let i = 0; i < normalized.length; i++) {
      const a = normalized[i];
      const actualHighlightedText = canonical.substring(a.resolvedStart, a.resolvedEnd);
      assert.equal(
        actualHighlightedText,
        a.selectedText,
        `Annotation ${a.id} must highlight exact text without any character drift`
      );
    }
  });

  test('6. Stale or offset-drifted annotations heal automatically upon reload', () => {
    const canonical = toCanonicalEssayText(sampleEssay);

    const targetPhrase = 'downward trend';
    const trueStart = canonical.indexOf(targetPhrase);
    const trueEnd = trueStart + targetPhrase.length;

    // Simulate an annotation saved from a previous buggy session where startIndex was off by +5 chars
    const corruptedAnnot: InlineAnnotation = {
      id: 'annot-corrupt',
      startIndex: trueStart + 5, // Offset by 5 characters
      endIndex: trueEnd + 5,
      selectedText: targetPhrase,
      type: 'correction',
      comment: 'Review trend phrasing',
    };

    const normalized = normalizeAnnotations(canonical, [corruptedAnnot]);
    assert.equal(normalized.length, 1);
    assert.equal(
      normalized[0].resolvedStart,
      trueStart,
      'normalizeAnnotations must heal the offset and resolve to exact trueStart'
    );
    assert.equal(normalized[0].resolvedEnd, trueEnd);
    assert.equal(canonical.substring(normalized[0].resolvedStart, normalized[0].resolvedEnd), targetPhrase);
  });

  test('7. Rendered highlighted text matches the text displayed in "Đoạn chọn" in all cases', () => {
    const canonical = toCanonicalEssayText(sampleEssay);

    const testPhrases = [
      'The provided bar chart',
      '2010 to 2020',
      'nuclear power',
      'approximately 75%',
      'solar and wind power',
      'tương lai.',
    ];

    testPhrases.forEach((phrase, idx) => {
      const start = canonical.indexOf(phrase);
      assert.ok(start !== -1);
      const end = start + phrase.length;

      const annot: InlineAnnotation = {
        id: `test-annot-${idx}`,
        startIndex: start,
        endIndex: end,
        selectedText: phrase,
        type: 'correction',
        comment: `Comment for ${phrase}`,
      };

      const normalized = normalizeAnnotations(canonical, [annot]);
      const res = normalized[0];
      const renderedHighlight = canonical.substring(res.resolvedStart, res.resolvedEnd);

      assert.equal(
        renderedHighlight,
        annot.selectedText,
        `Rendered highlight for "${phrase}" must exactly match "Đoạn chọn" display`
      );
    });
  });
});
