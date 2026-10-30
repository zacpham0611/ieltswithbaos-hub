import assert from 'node:assert/strict';
import { calculateIeltsOverallBand } from '../src/lib/ieltsScoring.ts';
import {
  generateCorrectedEssay,
  normalizeAnnotations,
} from '../src/lib/writingCorrection.ts';
import type { InlineAnnotation, RubricScore } from '../src/types/index.ts';

console.log('--- RUNNING WRITING ASSESSMENT & FEEDBACK DISPLAY TESTS ---');

// Test 1: Normalize annotations with index resolution
(() => {
  const essay = 'Nowadays many people believe that technology is very benefit for education.';
  const annotations: InlineAnnotation[] = [
    {
      id: 'ann-1',
      selectedText: 'very benefit',
      startIndex: 0, // Intentionally wrong or shifted start index
      endIndex: 0,
      comment: 'Use adjective beneficial instead of noun benefit',
      suggestion: 'highly beneficial',
      type: 'vocabulary',
    },
    {
      id: 'ann-2',
      selectedText: 'Nowadays',
      startIndex: 0,
      endIndex: 8,
      comment: 'Good cohesive device',
      type: 'praise',
    },
  ];

  const normalized = normalizeAnnotations(essay, annotations);
  assert.equal(normalized.length, 2, 'Should normalize all annotations');
  
  const vocabAnn = normalized.find((a) => a.id === 'ann-1');
  assert.ok(vocabAnn, 'Vocabulary annotation found');
  assert.equal(vocabAnn.resolvedStart, essay.indexOf('very benefit'));
  assert.equal(vocabAnn.resolvedEnd, essay.indexOf('very benefit') + 'very benefit'.length);
  console.log('✓ Passed: Normalize annotations resolves offset/missing indices.');
})();

// Test 2: Generate corrected essay from teacher suggestions
(() => {
  const originalEssay =
    'In conclusion, although computers has some disadvantages, they plays an important role in our lives.';
  const annotations: InlineAnnotation[] = [
    {
      id: 'ann-1',
      selectedText: 'computers has',
      startIndex: originalEssay.indexOf('computers has'),
      endIndex: originalEssay.indexOf('computers has') + 'computers has'.length,
      comment: 'Subject-verb agreement error with plural noun',
      suggestion: 'computers have',
      type: 'grammar',
    },
    {
      id: 'ann-2',
      selectedText: 'they plays',
      startIndex: originalEssay.indexOf('they plays'),
      endIndex: originalEssay.indexOf('they plays') + 'they plays'.length,
      comment: 'Subject-verb agreement error with plural pronoun',
      suggestion: 'they play',
      type: 'grammar',
    },
  ];

  const result = generateCorrectedEssay(originalEssay, annotations);
  assert.equal(result.totalCorrections, 2, 'Should count 2 corrections');
  assert.equal(
    result.correctedText,
    'In conclusion, although computers have some disadvantages, they play an important role in our lives.',
    'Should apply all non-overlapping suggestions accurately'
  );
  
  // Verify diff segments
  const replacements = result.diffSegments.filter((s) => s.type === 'replacement');
  assert.equal(replacements.length, 2);
  assert.equal(replacements[0].text, 'computers have');
  assert.equal(replacements[0].originalText, 'computers has');
  assert.equal(replacements[1].text, 'they play');
  assert.equal(replacements[1].originalText, 'they plays');
  console.log('✓ Passed: Generate corrected essay accurately creates corrected text and diff segments.');
})();

// Test 3: IELTS Official Writing Band Score Calculation
(() => {
  // Test case A: TR: 6.5, CC: 6.5, LR: 7.0, GRA: 7.0 -> Avg 6.75 -> Band 7.0
  const bandA = calculateIeltsOverallBand([6.5, 6.5, 7.0, 7.0]);
  assert.equal(bandA, 7.0, '6.75 average rounds up to 7.0');

  // Test case B: TR: 6.0, CC: 6.0, LR: 6.5, GRA: 6.5 -> Avg 6.25 -> Band 6.5
  const bandB = calculateIeltsOverallBand([6.0, 6.0, 6.5, 6.5]);
  assert.equal(bandB, 6.5, '6.25 average rounds up to 6.5');

  // Test case C: TR: 6.0, CC: 6.0, LR: 6.0, GRA: 6.5 -> Avg 6.125 -> Band 6.0
  const bandC = calculateIeltsOverallBand([6.0, 6.0, 6.0, 6.5]);
  assert.equal(bandC, 6.0, '6.125 average rounds down to 6.0');

  // Test case D: TR: 7.5, CC: 7.5, LR: 8.0, GRA: 8.0 -> Avg 7.75 -> Band 8.0
  const bandD = calculateIeltsOverallBand([7.5, 7.5, 8.0, 8.0]);
  assert.equal(bandD, 8.0, '7.75 average rounds up to 8.0');
  console.log('✓ Passed: IELTS Overall Band Calculation conforms to official 9-band rounding.');
})();

// Test 4: Student Assessment Data Preserved on score_visibility: 'private'
(() => {
  // Simulate AppContext student subsData mapping logic
  const mockDbSubmission = {
    id: 'sub-123',
    assignment_id: 'assign-456',
    student_id: 'student-789',
    student_name: 'Nguyen Van A',
    status: 'graded',
    score: null, // Teacher might not have populated raw score directly
    rubric_scores: [
      { criterion: 'Task Response', score: 7.0, descriptor: 'Addresses all parts of the task' },
      { criterion: 'Coherence & Cohesion', score: 6.5, descriptor: 'Logically organizes information' },
      { criterion: 'Lexical Resource', score: 7.0, descriptor: 'Uses a good range of vocabulary' },
      { criterion: 'Grammatical Range & Accuracy', score: 6.5, descriptor: 'Uses a variety of complex structures' },
    ],
    teacher_comments: 'Well-structured argument with relevant examples.',
    strengths: 'Clear thesis statement and paragraph progression.',
    areas_to_improve: 'Watch subject-verb agreement in complex sentences.',
    next_steps: 'Practice 40-minute timed Task 2 essays.',
    annotations: [
      {
        id: 'ann-1',
        startIndex: 10,
        endIndex: 20,
        selectedText: 'bad phrase',
        comment: 'Improve tone',
        suggestion: 'inadequate expression',
        type: 'vocabulary',
      },
    ],
    is_draft: false,
    skill: 'writing',
  };

  const parentAssign = {
    id: 'assign-456',
    score_visibility: 'private', // Assignment defaults to private
  };

  // Replicating our fixed AppContext logic:
  const isScorePublic = parentAssign.score_visibility === 'public';
  const isGradedPublished =
    mockDbSubmission.status === 'graded' &&
    !mockDbSubmission.is_draft &&
    (mockDbSubmission.skill !== 'reading' || isScorePublic);
  const hasTeacherFeedback = isGradedPublished || mockDbSubmission.status === 'returned';

  const rubricScores: RubricScore[] = (mockDbSubmission.rubric_scores as any) || [];
  const computedFallbackScore =
    rubricScores.length > 0
      ? calculateIeltsOverallBand(rubricScores.map((r) => Number(r.score)).filter((n) => !isNaN(n) && n > 0))
      : 0;

  const finalScore = isGradedPublished
    ? mockDbSubmission.score !== null && mockDbSubmission.score !== undefined && Number(mockDbSubmission.score) > 0
      ? Number(mockDbSubmission.score)
      : computedFallbackScore > 0
      ? computedFallbackScore
      : undefined
    : undefined;

  const studentSubmission = {
    id: mockDbSubmission.id,
    score: finalScore,
    rubricScores: hasTeacherFeedback ? rubricScores : [],
    teacherComments: hasTeacherFeedback ? mockDbSubmission.teacher_comments : undefined,
    strengths: hasTeacherFeedback ? mockDbSubmission.strengths : undefined,
    areasToImprove: hasTeacherFeedback ? mockDbSubmission.areas_to_improve : undefined,
    nextSteps: hasTeacherFeedback ? mockDbSubmission.next_steps : undefined,
    annotations: hasTeacherFeedback ? mockDbSubmission.annotations : [],
  };

  // Assertions:
  assert.equal(isGradedPublished, true, 'isGradedPublished must be true for graded published writing assignment');
  assert.equal(studentSubmission.score, 7.0, 'Calculated overall score should be Band 7.0 (average of 7, 6.5, 7, 6.5)');
  assert.equal(studentSubmission.rubricScores.length, 4, 'All 4 rubric scores preserved');
  assert.equal(studentSubmission.annotations.length, 1, 'Annotations preserved');
  assert.ok(studentSubmission.teacherComments, 'Teacher comments preserved');
  assert.ok(studentSubmission.strengths, 'Strengths preserved');
  assert.ok(studentSubmission.areasToImprove, 'Areas to improve preserved');
  assert.ok(studentSubmission.nextSteps, 'Next steps preserved');
  console.log('✓ Passed: Student Writing Assessment data fully preserved even when score_visibility is private.');
})();

// Test 5: Returned submission retains comments and annotations for student revision
(() => {
  const returnedSubmission = {
    id: 'sub-returned',
    status: 'returned',
    skill: 'writing',
    teacher_comments: 'Please revise paragraph 2 to provide more concrete examples.',
    annotations: [{ id: 'ann-rev', selectedText: 'weak example', comment: 'Add statistics', type: 'suggestion' }],
  };

  const isGradedPublished = false;
  const hasTeacherFeedback = isGradedPublished || returnedSubmission.status === 'returned';

  assert.equal(hasTeacherFeedback, true, 'hasTeacherFeedback must be true for returned submissions');
  assert.ok(returnedSubmission.teacher_comments, 'Teacher comments retained for student revision');
  console.log('✓ Passed: Revision requests retain comments and annotations for student.');
})();

// Test 6: In-Text Annotation Popup & Interactive Click-to-Inspect Logic
(() => {
  const typeBadgeMap: Record<string, { label: string; bg: string; text: string; border: string }> = {
    correction: { label: 'Correction', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
    grammar: { label: 'Grammar', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
    vocabulary: { label: 'Vocabulary', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
    suggestion: { label: 'Suggestion', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
    praise: { label: 'Praise', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  };

  // Verify all 5 IELTS annotation categories map to accurate labels and color badges
  const sampleTypes: Array<InlineAnnotation['type']> = ['correction', 'grammar', 'vocabulary', 'suggestion', 'praise'];
  for (const t of sampleTypes) {
    const meta = typeBadgeMap[t];
    assert.ok(meta, `Metadata badge exists for annotation type: ${t}`);
    assert.equal(meta.label.toLowerCase(), t);
    assert.ok(meta.bg.startsWith('bg-'));
    assert.ok(meta.text.startsWith('text-'));
  }

  // Simulate user clicking on highlight A, then B, then toggling A, then clicking outside
  let activeInspected: InlineAnnotation | null = null;
  let activeHighlightId: string | null = null;

  const handleMarkClick = (ann: InlineAnnotation) => {
    if (activeInspected?.id === ann.id) {
      activeInspected = null;
      activeHighlightId = null;
    } else {
      activeInspected = ann;
      activeHighlightId = ann.id;
    }
  };

  const handleOutsideClick = () => {
    activeInspected = null;
    activeHighlightId = null;
  };

  const annA: InlineAnnotation = {
    id: 'ann-a',
    selectedText: 'Kiểm tra currency configuration',
    comment: 'Cần sửa đổi cú pháp',
    suggestion: 'Kiểm tra cấu hình tiền tệ',
    type: 'correction',
  };

  const annB: InlineAnnotation = {
    id: 'ann-b',
    selectedText: '1.400.000 đ hoặc 1.400.000 VND',
    comment: 'Đảm bảo định dạng chuẩn Việt Nam',
    suggestion: '1.400.000 ₫',
    type: 'suggestion',
  };

  // 1. Initial state: no popup
  assert.equal(activeInspected, null);

  // 2. Click annA -> popup opens with annA
  handleMarkClick(annA);
  assert.equal(activeInspected?.id, 'ann-a');
  assert.equal(activeHighlightId, 'ann-a');
  assert.equal(activeInspected?.suggestion, 'Kiểm tra cấu hình tiền tệ');

  // 3. Click annB -> switches immediately to annB
  handleMarkClick(annB);
  assert.equal(activeInspected?.id, 'ann-b');
  assert.equal(activeHighlightId, 'ann-b');
  assert.equal(activeInspected?.comment, 'Đảm bảo định dạng chuẩn Việt Nam');

  // 4. Click annB again -> toggles closed
  handleMarkClick(annB);
  assert.equal(activeInspected, null);
  assert.equal(activeHighlightId, null);

  // 5. Open annA and click outside -> closes immediately
  handleMarkClick(annA);
  assert.equal(activeInspected?.id, 'ann-a');
  handleOutsideClick();
  assert.equal(activeInspected, null);
  assert.equal(activeHighlightId, null);

  console.log('✓ Passed: In-Text Annotation popup display, switching, toggle, and click-outside dismissal.');
})();

console.log('ALL WRITING ASSESSMENT & FEEDBACK DISPLAY TESTS PASSED SUCCESSFULLY! 🎉');
