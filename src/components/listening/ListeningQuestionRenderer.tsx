import React from 'react';
import { Flag, AlertCircle, Volume2, ChevronDown } from 'lucide-react';
import type { ListeningQuestion, ListeningQuestionGroup } from '../../types';
import { cleanListeningText, normalizeListeningStructuredText } from '../../lib/listeningExtractor';

export { cleanListeningText, normalizeListeningStructuredText };

interface ListeningQuestionRendererProps {
  questionGroup: ListeningQuestionGroup;
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, answer: string) => void;
  flaggedQuestionIds?: Set<string>;
  onToggleFlag?: (questionId: string) => void;
  isReadOnly?: boolean;
  showCorrectAnswers?: boolean;
}

// Utility to parse options from text if missing on question objects
const extractOptionsFromText = (text?: string): string[] => {
  if (!text) return [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const opts: string[] = [];
  for (const line of lines) {
    const match = line.match(/^[•\-\*\s\u2022]*([A-Za-z])(?:[\.\)\:\-]\s*|\s+)(.*)$/i);
    if (match) {
      opts.push(`${match[1].toUpperCase()}. ${match[2].trim()}`);
    }
  }
  return opts;
};

export const ListeningQuestionRenderer: React.FC<ListeningQuestionRendererProps> = ({
  questionGroup,
  answers,
  onAnswerChange,
  flaggedQuestionIds = new Set(),
  onToggleFlag,
  isReadOnly = false,
  showCorrectAnswers = false,
}) => {
  const {
    id: _groupId,
    type,
    title,
    instructions,
    wordLimit,
    allowNumbers = true,
    groupText,
    imageUrl,
    imageCaption,
    questions,
  } = questionGroup;

  const safeQuestions = questions || [];

  // Parse potential question range from title, e.g. "Questions 31-40" or "Part 4 (31 - 40)"
  const titleRangeMatch = (title || '').match(/(?:Questions?|Part|Section)?\s*([0-9]{1,2})\s*[-–—to]+\s*([0-9]{1,2})/i);
  const titleStartNum = titleRangeMatch ? parseInt(titleRangeMatch[1], 10) : undefined;
  const titleEndNum = titleRangeMatch ? parseInt(titleRangeMatch[2], 10) : undefined;

  const firstQNum =
    safeQuestions[0]?.questionNumber ||
    safeQuestions[0]?.number ||
    titleStartNum ||
    1;
  const lastQNum =
    safeQuestions[safeQuestions.length - 1]?.questionNumber ||
    safeQuestions[safeQuestions.length - 1]?.number ||
    titleEndNum ||
    (firstQNum + Math.max(0, safeQuestions.length - 1));

  // Set of question IDs whose inputs are directly embedded inside structured content (tables, forms, notes, flowcharts)
  const embeddedQuestionIds = new Set<string>();

  // Extract all blank numbers [31], [32], etc. inside structured group text for reliable index mapping
  const rawGroupContent = groupText || questionGroup.sharedContent || '';
  const effectiveGroupContent = React.useMemo(() => {
    return normalizeListeningStructuredText(rawGroupContent);
  }, [rawGroupContent]);
  const embeddedBlankNumbers = React.useMemo(() => {
    if (!effectiveGroupContent) return [];
    let norm = effectiveGroupContent.replace(
      /((?:[…\.]{2,}|_{2,}|\.{3,}|…+))([\s\S]*?)(?:\([Qq]?\s*([0-9]{1,2})\)|\[([0-9]{1,2})\])/gi,
      (_m, _blank, middle, g3, g4) => `[${g3 || g4}]${middle}`
    );
    norm = norm.replace(
      /((?:by|in|at|to|for|is|are|on|of|^|[•\-\*\s]+)\s*)([0-9]{1,2})[\.\:\)]\s*(?:[…\.]{2,}|_{2,}|\.{3,}|…+)/gi,
      '$1[$2]'
    );
    norm = norm.replace(
      /(?:<strong[^>]*>([0-9]{1,2})<\/strong>\s*[\u2026\.]{2,}|\b([0-9]{1,2})\s*(?:[…\.]{2,}|_{2,}|\.{3,}|…+)|\(([0-9]{1,2})\)\s*(?:[…\.]{2,}|_{2,}|\.{3,}|…+))/g,
      '[$1$2$3]'
    );
    const matches = Array.from(norm.matchAll(/\[([0-9]{1,2})\]/g)).map((m) => parseInt(m[1], 10));
    return Array.from(new Set(matches));
  }, [effectiveGroupContent]);

  // Render question flag button
  const renderFlagButton = (questionId: string) => {
    const isFlagged = flaggedQuestionIds.has(questionId);
    return (
      <button
        type="button"
        onClick={() => onToggleFlag?.(questionId)}
        className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-md transition-colors ${
          isFlagged
            ? 'bg-amber-100 text-amber-800 font-semibold border border-amber-300'
            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
        }`}
        title={isFlagged ? 'Bỏ đánh dấu (Unflag)' : 'Đánh dấu xem lại (Flag)'}
      >
        <Flag className={`w-3.5 h-3.5 ${isFlagged ? 'fill-amber-500 text-amber-500' : ''}`} />
        <span>{isFlagged ? 'Flagged' : 'Flag'}</span>
      </button>
    );
  };

  // Helper to resolve options for Multiple Choice
  const getMultipleChoiceOptions = (q: ListeningQuestion, qIdx: number) => {
    if (q.options && q.options.length >= 2) return q.options;
    if (questionGroup.options && questionGroup.options.length >= 2) return questionGroup.options;

    const rawOpts = extractOptionsFromText(groupText || questionGroup.sharedContent);
    if (rawOpts.length >= 2) {
      const perQ = Math.max(2, Math.floor(rawOpts.length / Math.max(1, safeQuestions.length)));
      const sliced = rawOpts.slice(qIdx * perQ, (qIdx + 1) * perQ);
      if (sliced.length >= 2) return sliced;
      return rawOpts;
    }
    return [];
  };

  // Render Multiple Choice question (Single Answer: Radio buttons)
  const renderMultipleChoice = (q: ListeningQuestion, qIdx: number) => {
    const userVal = (answers[q.id] || '').trim();
    const options = getMultipleChoiceOptions(q, qIdx);
    const qNum = q.questionNumber || q.number || 1;
    const cleanPrompt = cleanListeningText(q.prompt);

    return (
      <div key={q.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-baseline gap-2.5">
            <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 text-blue-800 text-xs sm:text-sm font-bold shrink-0">
              {qNum}
            </span>
            <p className="text-base sm:text-[17px] font-semibold text-slate-900 leading-relaxed">{cleanPrompt}</p>
          </div>
          {renderFlagButton(q.id)}
        </div>

        {options.length > 0 ? (
          <div className="space-y-2.5 pt-1 pl-2 sm:pl-9">
            {options.map((opt, optIdx) => {
              const letterMatch = opt.match(/^([A-Za-z])[\.\:\)]/i);
              const letter = letterMatch ? letterMatch[1].toUpperCase() : String.fromCharCode(65 + optIdx);
              const cleanOpt = cleanListeningText(opt.replace(/^[A-Za-z][\.\:\)]\s*/i, ''));
              const isSelected =
                userVal.toUpperCase() === letter ||
                userVal.toUpperCase() === opt.toUpperCase() ||
                userVal.toUpperCase() === cleanOpt.toUpperCase();

              return (
                <label
                  key={optIdx}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border text-base font-medium cursor-pointer transition ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-400 text-blue-900 ring-1 ring-blue-300'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                  } ${isReadOnly ? 'pointer-events-none' : ''}`}
                >
                  <input
                    type="radio"
                    name={`listening_mc_${q.id}`}
                    value={letter}
                    checked={isSelected}
                    disabled={isReadOnly}
                    onChange={() => onAnswerChange(q.id, letter)}
                    className="mt-1 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                  />
                  <span className="font-bold text-slate-700 w-5 shrink-0 text-base">{letter}.</span>
                  <span className="flex-1 leading-relaxed text-base">{cleanOpt || opt}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="pl-2 sm:pl-9 pt-1">
            <input
              type="text"
              value={userVal}
              disabled={isReadOnly}
              placeholder="Nhập đáp án (A, B, C...)"
              onChange={(e) => onAnswerChange(q.id, e.target.value.toUpperCase())}
              className="w-48 px-3.5 py-2 text-base bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium uppercase"
            />
          </div>
        )}

        {showCorrectAnswers && q.correctAnswer && (
          <div className="pl-2 sm:pl-9 pt-1 text-sm text-emerald-700 font-medium">
            Đáp án đúng: <span className="font-bold">{cleanListeningText(q.correctAnswer)}</span>
          </div>
        )}
      </div>
    );
  };

  // Helper to resolve options for Multiple Select
  const getMultipleSelectOptions = () => {
    if (questionGroup.options && questionGroup.options.length >= 2) return questionGroup.options;
    if (questionGroup.optionsBox && questionGroup.optionsBox.length >= 2) return questionGroup.optionsBox;
    if (safeQuestions[0]?.options && safeQuestions[0].options.length >= 2) return safeQuestions[0].options;
    return extractOptionsFromText(groupText || questionGroup.sharedContent);
  };

  // Render Unified Multiple Select Group (e.g. Questions 18-20: Choose THREE letters, A-G)
  const renderUnifiedMultipleSelect = () => {
    let maxChoices = safeQuestions.length;
    const instr = (instructions || '').toLowerCase();
    if (instr.includes('choose two') || instr.includes('two letters')) maxChoices = 2;
    else if (instr.includes('choose three') || instr.includes('three letters')) maxChoices = 3;
    else if (instr.includes('choose four')) maxChoices = 4;

    const currentSelections: string[] = [];
    safeQuestions.forEach((q) => {
      const val = (answers[q.id] || '').trim().toUpperCase();
      if (val) currentSelections.push(val);
    });
    const selectedSet = new Set(currentSelections);

    const options = getMultipleSelectOptions();
    const sharedPrompt = cleanListeningText(
      safeQuestions[0]?.prompt || questionGroup.title || 'Choose the correct letters'
    );

    const handleToggleOption = (letter: string) => {
      if (isReadOnly) return;
      const nextList = [...currentSelections];
      const existingIdx = nextList.indexOf(letter);

      if (existingIdx >= 0) {
        nextList.splice(existingIdx, 1);
      } else {
        if (nextList.length >= maxChoices) {
          nextList.shift();
        }
        nextList.push(letter);
      }
      nextList.sort();

      safeQuestions.forEach((q, idx) => {
        const assignedLetter = nextList[idx] || '';
        onAnswerChange(q.id, assignedLetter);
      });
    };

    return (
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-800 text-sm font-bold">
                Questions {firstQNum} - {lastQNum}
              </span>
              <span className="text-sm font-semibold text-amber-700">
                (Chọn tối đa {maxChoices} đáp án)
              </span>
            </div>
            <p className="text-base sm:text-[17px] font-semibold text-slate-900 leading-relaxed">{sharedPrompt}</p>
          </div>
          <div className="flex items-center gap-1">
            {safeQuestions.map((q) => (
              <span key={q.id}>{renderFlagButton(q.id)}</span>
            ))}
          </div>
        </div>

        {/* Checkbox Options */}
        <div className="space-y-2.5 pt-1 pl-1 sm:pl-2">
          {options.map((opt, optIdx) => {
            const letterMatch = opt.match(/^([A-Za-z])[\.\:\)]/i);
            const letter = letterMatch ? letterMatch[1].toUpperCase() : String.fromCharCode(65 + optIdx);
            const cleanOpt = cleanListeningText(opt.replace(/^[A-Za-z][\.\:\)]\s*/i, ''));
            const isChecked = selectedSet.has(letter);

            return (
              <label
                key={optIdx}
                className={`flex items-start gap-3 p-3.5 rounded-xl border text-base font-medium cursor-pointer transition ${
                  isChecked
                    ? 'bg-blue-50/90 border-blue-400 text-blue-900 ring-1 ring-blue-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                } ${isReadOnly ? 'pointer-events-none' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isReadOnly}
                  onChange={() => handleToggleOption(letter)}
                  className="mt-1 text-blue-600 rounded focus:ring-blue-500 accent-blue-600 cursor-pointer"
                />
                <span className="font-bold text-slate-700 w-5 shrink-0 text-base">{letter}.</span>
                <span className="flex-1 leading-relaxed text-base">{cleanOpt || opt}</span>
              </label>
            );
          })}
        </div>

        {/* Selected answers display mapped to questions */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-sm">
          {safeQuestions.map((q, idx) => {
            const qNum = q.questionNumber || q.number || firstQNum + idx;
            const currentVal = answers[q.id] || '';
            return (
              <div key={q.id} className="flex items-center gap-2 font-medium">
                <span className="font-bold text-slate-700">Câu {qNum}:</span>
                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg font-bold font-mono text-sm">
                  {currentVal || '---'}
                </span>
                {showCorrectAnswers && q.correctAnswer && (
                  <span className="text-emerald-700 font-bold ml-1">[{q.correctAnswer}]</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Helper to resolve options for Matching
  const getMatchingOptions = (q: ListeningQuestion) => {
    if (q.options && q.options.length >= 2) return q.options;
    if (questionGroup.optionsBox && questionGroup.optionsBox.length >= 2) return questionGroup.optionsBox;
    if (questionGroup.options && questionGroup.options.length >= 2) return questionGroup.options;
    return extractOptionsFromText(groupText || questionGroup.sharedContent);
  };

  // Render Matching or Labelling
  const renderMatchingOrLabelling = (q: ListeningQuestion) => {
    const userVal = (answers[q.id] || '').trim().toUpperCase();
    const options = getMatchingOptions(q);
    const qNum = q.questionNumber || q.number || 1;
    const cleanPrompt = cleanListeningText(q.prompt);

    return (
      <div
        key={q.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition shadow-2xs"
      >
        <div className="flex items-center gap-3 min-w-[200px] flex-1">
          <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 text-blue-800 text-xs sm:text-sm font-bold shrink-0">
            {qNum}
          </span>
          <span className="text-base sm:text-[17px] font-semibold text-slate-800 leading-snug">{cleanPrompt}</span>
          {renderFlagButton(q.id)}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {options.length > 0 ? (
            <select
              value={userVal}
              disabled={isReadOnly}
              onChange={(e) => onAnswerChange(q.id, e.target.value.toUpperCase())}
              className="px-3.5 py-2 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium max-w-[320px]"
            >
              <option value="">-- Chọn đáp án --</option>
              {options.map((opt: string, idx: number) => {
                const letterMatch = opt.match(/^([A-Za-z])[\.\:\)]/i);
                const optLetter = letterMatch ? letterMatch[1].toUpperCase() : String.fromCharCode(65 + idx);
                const optText = cleanListeningText(opt.replace(/^[A-Za-z][\.\:\)]\s*/i, ''));
                return (
                  <option key={idx} value={optLetter}>
                    {optLetter}. {optText || opt}
                  </option>
                );
              })}
            </select>
          ) : (
            <input
              type="text"
              value={userVal}
              disabled={isReadOnly}
              placeholder="Nhập chữ cái (A, B...)"
              onChange={(e) => onAnswerChange(q.id, e.target.value.toUpperCase())}
              className="w-40 px-3.5 py-2 text-base bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium uppercase"
            />
          )}

          {showCorrectAnswers && q.correctAnswer && (
            <span className="text-sm text-emerald-700 font-bold ml-2">
              [{cleanListeningText(q.correctAnswer)}]
            </span>
          )}
        </div>
      </div>
    );
  };

  // Render an inline interactive input for a question embedded within structured content
  const renderInlineQuestionInput = (qNum: number, keyPrefix: string) => {
    const blankIdx = embeddedBlankNumbers.indexOf(qNum);
    const targetQ = safeQuestions.find(
      (q, idx) =>
        Number(q.questionNumber || q.number) === qNum ||
        q.id.endsWith(`_${qNum}`) ||
        q.id === `q_${qNum}` ||
        q.prompt === `Question ${qNum}` ||
        (q.prompt && (q.prompt.startsWith(`${qNum}.`) || q.prompt.startsWith(`Question ${qNum}`))) ||
        (blankIdx !== -1 && idx === blankIdx) ||
        (safeQuestions.length > 0 && firstQNum <= qNum && qNum <= lastQNum && idx === qNum - firstQNum)
    );

    const effectiveId = targetQ ? targetQ.id : `q_${qNum}`;
    embeddedQuestionIds.add(effectiveId);
    if (targetQ) {
      embeddedQuestionIds.add(targetQ.id);
    }
    const userVal = answers[effectiveId] || (targetQ ? answers[targetQ.id] : '') || '';

    return (
      <span
        key={`${keyPrefix}-q${qNum}`}
        className="inline-flex items-center gap-1.5 align-middle mx-1.5 my-0.5 whitespace-nowrap flex-nowrap"
      >
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold text-xs sm:text-sm border border-blue-300 shrink-0">
          {qNum}
        </span>
        <input
          type="text"
          value={userVal}
          disabled={isReadOnly}
          placeholder={`[${qNum}]`}
          onChange={(e) => onAnswerChange(effectiveId, e.target.value)}
          className="px-3 py-1 text-sm sm:text-base bg-blue-50/70 hover:bg-blue-50 focus:bg-white border border-blue-400 focus:border-blue-600 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold text-blue-900 min-w-[105px] max-w-[190px] transition-colors"
        />
        {targetQ && onToggleFlag && (
          <button
            type="button"
            onClick={() => onToggleFlag(targetQ.id)}
            className={`p-1 rounded-md transition-colors shrink-0 ${
              flaggedQuestionIds.has(targetQ.id)
                ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
            }`}
            title={flaggedQuestionIds.has(targetQ.id) ? 'Bỏ đánh dấu (Unflag)' : 'Đánh dấu xem lại (Flag)'}
          >
            <Flag className={`w-3.5 h-3.5 ${flaggedQuestionIds.has(targetQ.id) ? 'fill-amber-500 text-amber-500' : ''}`} />
          </button>
        )}
        {showCorrectAnswers && targetQ?.correctAnswer && (
          <span className="text-xs sm:text-sm text-emerald-700 font-bold whitespace-nowrap">
            [{cleanListeningText(targetQ.correctAnswer)}]
          </span>
        )}
      </span>
    );
  };

  // Helper to render text with Markdown bold (**text**) as <strong>
  const renderFormattedText = (rawText: string, keyPrefix: string) => {
    const clean = cleanListeningText(rawText);
    if (!clean.includes('**')) {
      return <span key={keyPrefix}>{clean}</span>;
    }
    const chunks = clean.split(/(\*\*.*?\*\*)/g);
    return (
      <span key={keyPrefix}>
        {chunks.map((chunk, cIdx) => {
          if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length >= 4) {
            return (
              <strong key={`${keyPrefix}-b${cIdx}`} className="font-bold text-slate-900">
                {chunk.slice(2, -2)}
              </strong>
            );
          }
          return <React.Fragment key={`${keyPrefix}-t${cIdx}`}>{chunk}</React.Fragment>;
        })}
      </span>
    );
  };

  // Helper to parse text with embedded gap markers [1], [2], etc., or inline blanks like 1 …………
  const renderTextWithEmbeddedInputs = (rawText: string, keyPrefix: string) => {
    // 0. Pre-clean text, strip orphaned markdown table separator fragments, and normalize <br /> tags
    let normalized = cleanListeningText(rawText);
    normalized = normalized.replace(/<br\s*\/?>/gi, '\n');
    normalized = normalized.replace(/^\s*\|?(?:\s*:?-{2,}:?\s*\|?)+\s*$/gm, '');
    normalized = normalized.replace(/^(?:\|?\s*:?-{2,}:?\s*)+[\|\s]*/gm, '');
    normalized = normalized.replace(/(?:\|?\s*:?-{2,}:?\s*)+[\|\s]*/g, '');

    // 1. Normalize blanks followed anywhere by (Q<num>) or (<num>) or [<num>]
    // e.g. "- The main cause of the problem is ______ (Q31)."
    // e.g. "- The process usually takes ______ days (Q32)."
    normalized = normalized.replace(
      /((?:[…\.]{2,}|_{2,}|\.{3,}|…+))([\s\S]*?)(?:\([Qq]?\s*([0-9]{1,2})\)|\[([0-9]{1,2})\])/gi,
      (_m, _blank, middle, g3, g4) => {
        const n = g3 || g4;
        return `[${n}]${middle.replace(/\s+$/, '')}`;
      }
    );

    // 2. Normalize numbers before blank, e.g. "34. ______" or "• 34. Cost: ______"
    normalized = normalized.replace(
      /((?:by|in|at|to|for|is|are|on|of|^|[•\-\*\s]+)\s*)([0-9]{1,2})[\.\:\)]\s*(?:[…\.]{2,}|_{2,}|\.{3,}|…+)/gi,
      '$1[$2]'
    );

    // 3. Normalize any 1 …………, 1 _____, (1) ………… into [1]
    normalized = normalized.replace(
      /(?:<strong[^>]*>([0-9]{1,2})<\/strong>\s*[\u2026\.]{2,}|\b([0-9]{1,2})\s*(?:[…\.]{2,}|_{2,}|\.{3,}|…+)|\(([0-9]{1,2})\)\s*(?:[…\.]{2,}|_{2,}|\.{3,}|…+))/g,
      '[$1$2$3]'
    );

    // 4. Normalize bolded question numbers that denote blanks (e.g. "**1**", "**2**", "<b>1</b>", "<strong>1</strong>")
    normalized = normalized.replace(
      /(?:\*\*([0-9]{1,2})\*\*|<strong[^>]*>([0-9]{1,2})<\/strong>|<b>([0-9]{1,2})<\/b>)/g,
      '[$1$2$3]'
    );

    const parts = normalized.split(/(\[[0-9]{1,2}\])/g);
    return parts.map((part, pIdx) => {
      const match = part.match(/^\[([0-9]{1,2})\]$/);
      if (match) {
        const qNum = parseInt(match[1], 10);
        return renderInlineQuestionInput(qNum, `${keyPrefix}-p${pIdx}`);
      }
      return renderFormattedText(part, `${keyPrefix}-t${pIdx}`);
    });
  };

  // Helper to render table cell content with multi-bullet and multiline vertical spacing
  const renderTableCellContent = (cellText: string, keyPrefix: string) => {
    const rawClean = cellText.replace(/<br\s*\/?>/gi, '\n');
    const hasBullets = /(?:^|\s+)(?:[•\u2022]|\*\s+)/.test(rawClean);
    const hasNewlines = rawClean.includes('\n');
    if (hasBullets || hasNewlines) {
      const normalized = rawClean
        .replace(/(?:^|\s+)(?:[•\u2022]|\*\s+)/g, '\n• ')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      if (normalized.length > 1) {
        return (
          <div className="space-y-1.5 py-0.5">
            {normalized.map((line, lIdx) => {
              const isBullet = line.startsWith('•');
              const cleanLine = line.replace(/^[•\s]+/, '');
              return (
                <div key={lIdx} className="flex items-start gap-2 text-slate-700 leading-relaxed">
                  {isBullet && (
                    <span className="text-blue-500 font-bold shrink-0 mt-0.5">•</span>
                  )}
                  <div className="flex-1">
                    {renderTextWithEmbeddedInputs(cleanLine, `${keyPrefix}-l${lIdx}`)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
    }
    return renderTextWithEmbeddedInputs(rawClean, keyPrefix);
  };

  // 1. Render Markdown Table with INTERACTIVE in-cell answer inputs
  const renderStructuredTable = (tableMarkdown: string) => {
    const lines = tableMarkdown
      .split('\n')
      .map((l) => {
        let trimmed = l.trim();
        if (trimmed.includes('|')) {
          if (!trimmed.startsWith('|')) trimmed = '| ' + trimmed;
          if (!trimmed.endsWith('|')) trimmed = trimmed + ' |';
        }
        return trimmed;
      })
      .filter((l) => l.startsWith('|') && l.endsWith('|'));

    if (lines.length < 2) return null;

    const isSep = (l: string) => /^\|(?:\s*:?-+:?\s*\|)+$/.test(l);
    const dataLines = lines.filter((l) => !isSep(l));
    if (dataLines.length === 0) return null;

    const headerCells = dataLines[0]
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim());
    const bodyRows = dataLines.slice(1).map((l) =>
      l
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
    );

    // Identify designated Answer column (e.g. "Answer", "Letters", "Choice", or second column if empty)
    const answerColIdx = headerCells.findIndex((h) =>
      /^(?:answer|answers|option|options|choice|choices|letter|letters|đáp án)\b/i.test(cleanListeningText(h))
    );

    return (
      <div className="overflow-x-auto my-3 rounded-xl border border-slate-200 shadow-2xs bg-white">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              {headerCells.map((h, hIdx) => (
                <th
                  key={hIdx}
                  className="px-4 py-2.5 font-bold text-slate-800 border-r last:border-r-0 border-slate-200 tracking-wide"
                >
                  {cleanListeningText(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bodyRows.map((row, rIdx) => {
              const rowFullText = row.join(' ');
              const numMatch = rowFullText.match(/(?:\[([0-9]{1,2})\]|^([0-9]{1,2})[\.\:\)\s]|\b([0-9]{1,2})\s+[a-zA-Z])/);
              const rowQNum = numMatch ? parseInt(numMatch[1] || numMatch[2] || numMatch[3], 10) : NaN;
              const matchedQ = !isNaN(rowQNum)
                ? safeQuestions.find((q) => (q.questionNumber || q.number) === rowQNum)
                : safeQuestions.find((q, idx) => idx === rIdx && (q.type === 'matching' || type === 'matching'));

              if (matchedQ) {
                embeddedQuestionIds.add(matchedQ.id);
              }

              return (
                <tr
                  key={rIdx}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                  }`}
                >
                  {row.map((cell, cIdx) => {
                    const isAnswerCell =
                      (answerColIdx >= 0 && cIdx === answerColIdx) ||
                      (headerCells.length === 2 && cIdx === 1 && !cell.trim() && Boolean(matchedQ));

                    if (isAnswerCell && matchedQ) {
                      const isMatching = matchedQ.type === 'matching' || type === 'matching';
                      if (isMatching) {
                        const matchingOpts = getMatchingOptions(matchedQ);
                        const userVal = (answers[matchedQ.id] || '').trim().toUpperCase();

                        return (
                          <td
                            key={cIdx}
                            className="px-4 py-2.5 text-slate-700 border-r last:border-r-0 border-slate-200 align-middle"
                          >
                            <div className="flex items-center gap-2">
                              {matchingOpts.length > 0 ? (
                                <select
                                  value={userVal}
                                  disabled={isReadOnly}
                                  onChange={(e) => onAnswerChange(matchedQ.id, e.target.value.toUpperCase())}
                                  className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-bold text-slate-800"
                                >
                                  <option value="">-- Chọn --</option>
                                  {matchingOpts.map((opt: string, optIdx: number) => {
                                    const letterMatch = opt.match(/^([A-Za-z])[\.\:\)]/i);
                                    const optLetter = letterMatch ? letterMatch[1].toUpperCase() : String.fromCharCode(65 + optIdx);
                                    return (
                                      <option key={optIdx} value={optLetter}>
                                        {optLetter}
                                      </option>
                                    );
                                  })}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={userVal}
                                  disabled={isReadOnly}
                                  placeholder="A, B..."
                                  onChange={(e) => onAnswerChange(matchedQ.id, e.target.value.toUpperCase())}
                                  className="w-16 px-2 py-1 text-xs text-center font-bold bg-slate-50 border border-slate-300 rounded-lg uppercase"
                                />
                              )}
                              {renderFlagButton(matchedQ.id)}
                              {showCorrectAnswers && matchedQ.correctAnswer && (
                                <span className="text-xs text-emerald-700 font-bold whitespace-nowrap ml-1">
                                  [{cleanListeningText(matchedQ.correctAnswer)}]
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={cIdx}
                          className="px-4 py-2.5 text-slate-700 border-r last:border-r-0 border-slate-200 align-middle"
                        >
                          {renderInlineQuestionInput(
                            matchedQ.questionNumber || matchedQ.number || rowQNum || rIdx + 1,
                            `table-ans-${rIdx}-${cIdx}`
                          )}
                        </td>
                      );
                    }

                    if (cIdx === 0 && matchedQ) {
                      const statementClean = cell.replace(/^[0-9]{1,2}[\.\:\)\s]+/, '').trim();
                      const displayNum = matchedQ.questionNumber || matchedQ.number || rowQNum;

                      return (
                        <td
                          key={cIdx}
                          className="px-4 py-2.5 text-slate-700 border-r last:border-r-0 border-slate-200 leading-relaxed font-normal align-middle"
                        >
                          <div className="flex items-baseline gap-2">
                            {displayNum && (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold shrink-0">
                                {displayNum}
                              </span>
                            )}
                            <span className="text-slate-800 font-medium">
                              {cleanListeningText(statementClean || cell)}
                            </span>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={cIdx}
                        className="px-4 py-2.5 text-slate-700 border-r last:border-r-0 border-slate-200 leading-relaxed font-normal align-top"
                      >
                        {renderTableCellContent(cell, `table-${rIdx}-${cIdx}`)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // 2. Render Structured Flow-chart Completion
  const renderStructuredFlowchart = (flowchartText: string) => {
    // Split into steps using arrow indicators or blank lines
    const rawSteps = flowchartText
      .split(/(?:\n\s*(?:[↓▼]|-->|->)\s*\n|\n{2,})/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (rawSteps.length === 0) return null;

    return (
      <div className="flex flex-col items-center gap-2 my-2 w-full">
        {rawSteps.map((stepText, sIdx) => {
          const isLast = sIdx === rawSteps.length - 1;
          const lines = stepText.split('\n').map((l) => l.trim()).filter(Boolean);
          const firstLine = lines[0] || '';
          const isStepHeader = /^(?:Step|Stage|Phase)\s+[0-9]+/i.test(firstLine);

          return (
            <React.Fragment key={sIdx}>
              <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition">
                {isStepHeader ? (
                  <div>
                    <span className="inline-block px-2 py-0.5 mb-1.5 rounded bg-blue-100 text-blue-800 text-[11px] font-bold">
                      {cleanListeningText(firstLine)}
                    </span>
                    <div className="text-xs text-slate-800 leading-relaxed">
                      {lines.slice(1).map((line, lIdx) => (
                        <div key={lIdx} className="my-1">
                          {renderTextWithEmbeddedInputs(line, `fc-${sIdx}-${lIdx}`)}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-800 leading-relaxed">
                    {lines.map((line, lIdx) => (
                      <div key={lIdx} className="my-1">
                        {renderTextWithEmbeddedInputs(line, `fc-${sIdx}-${lIdx}`)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!isLast && (
                <div className="flex flex-col items-center -my-1 text-slate-400">
                  <div className="w-0.5 h-3 bg-slate-200" />
                  <ChevronDown className="w-4 h-4 text-blue-500" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // 3. Render Structured Form Completion
  const renderStructuredForm = (formText: string) => {
    // Normalize multi-row text and remove markdown table separator lines like | --- | --- |
    const normalizedFormText = normalizeListeningStructuredText(formText);
    const rawLines = normalizedFormText
      .split('\n')
      .map((l) => {
        let trimmed = cleanListeningText(l);
        // Strip orphaned leading table separator artifacts like "--- | --- Children: | 20 in a class"
        trimmed = trimmed.replace(/^(?:\|?\s*:?-{2,}:?\s*)+[\|\s]*/, '');
        if (trimmed.includes('|')) {
          if (!trimmed.startsWith('|')) trimmed = '| ' + trimmed;
          if (!trimmed.endsWith('|')) trimmed = trimmed + ' |';
        }
        return trimmed;
      })
      .filter((l) => Boolean(l) && !/^\|?(?:\s*:?-{2,}:?\s*\|?)+$/.test(l));

    return (
      <div className="space-y-1 my-2">
        {rawLines.map((line, lIdx) => {
          // If line is a markdown table row e.g. | Name: | Susan Smith |
          if (line.startsWith('|') && line.endsWith('|')) {
            const rawCells = line.slice(1, -1).split('|').map((c) => c.trim());
            const firstCell = rawCells[0] || '';
            const restCells = rawCells.slice(1);
            const secondCell = restCells.join(' ').trim();

            // Detect Example row
            if (/^example\b/i.test(firstCell)) {
              const exLabel = restCells.length > 0 && secondCell ? secondCell : '';
              return (
                <div
                  key={lIdx}
                  className="flex items-center gap-3 p-3 my-2 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs"
                >
                  <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                    Example
                  </span>
                  {exLabel && <span className="font-semibold text-slate-800">{cleanListeningText(exLabel)}</span>}
                </div>
              );
            }

            // Normal form row | Label: | Value |
            const label = cleanListeningText(firstCell.replace(/:$/, '').trim());
            const cleanVal = cleanListeningText(secondCell.trim());

            // If the label is empty or just whitespace, render value directly
            if (!label) {
              return (
                <div key={lIdx} className="text-xs text-slate-800 py-1 px-3">
                  {renderTextWithEmbeddedInputs(cleanVal, `form-txt-${lIdx}`)}
                </div>
              );
            }

            // Check if val contains multiple bullet points or multiline cell entries
            const valNormalized = cleanVal.replace(/<br\s*\/?>/gi, '\n');
            const hasBullets = /(?:^|\s+)(?:[•\u2022]|\*\s+)/.test(valNormalized);
            const valLines = (hasBullets || valNormalized.includes('\n'))
              ? valNormalized
                  .replace(/(?:^|\s+)(?:[•\u2022]|\*\s+)/g, '\n• ')
                  .split('\n')
                  .map((b) => b.trim())
                  .filter(Boolean)
              : [valNormalized];

            return (
              <div
                key={lIdx}
                className="flex flex-col sm:flex-row sm:items-baseline gap-2 py-2.5 px-3 rounded-lg border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors"
              >
                <span className="text-xs font-bold text-slate-700 min-w-[140px] max-w-[240px] shrink-0">
                  {label}:
                </span>
                <div className="flex-1 text-xs text-slate-800 leading-relaxed">
                  {valLines.length > 1 ? (
                    <div className="space-y-1.5 pt-0.5">
                      {valLines.map((b, bIdx) => {
                        const isBullet = b.startsWith('•');
                        const lineText = b.replace(/^[•\s]+/, '');
                        return (
                          <div key={bIdx} className="flex items-start gap-2">
                            {isBullet && (
                              <span className="text-blue-500 font-bold shrink-0 mt-0.5">•</span>
                            )}
                            <div className="flex-1 text-xs text-slate-800 leading-relaxed">
                              {renderTextWithEmbeddedInputs(lineText, `form-${lIdx}-b${bIdx}`)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    renderTextWithEmbeddedInputs(cleanVal, `form-${lIdx}`)
                  )}
                </div>
              </div>
            );
          }

          const colonIdx = line.indexOf(':');
          const isHeader =
            colonIdx === -1 &&
            (line.startsWith('#') ||
              line === line.toUpperCase() ||
              /^(?:Part|Section|Details|Applicant|Patient|Customer|Vehicle|Booking|Enquiry|Rental Property Application Form)\b/i.test(
                line
              ));

          if (isHeader) {
            return (
              <div
                key={lIdx}
                className="pt-3 pb-1.5 px-3 mb-1 text-xs font-bold uppercase tracking-wider text-purple-950 bg-purple-50/70 rounded-lg border border-purple-200"
              >
                {cleanListeningText(line.replace(/^#+\s*/, ''))}
              </div>
            );
          }

          if (colonIdx !== -1) {
            const label = line.slice(0, colonIdx).trim();
            const val = line.slice(colonIdx + 1).trim();

            const hasBullets = /(?:^|\s+)(?:[•\u2022]|\*\s+)/.test(val);
            const bulletItems = hasBullets
              ? val
                  .split(/(?:^|\s+)(?:[•\u2022]|\*\s+)/)
                  .map((b) => b.trim())
                  .filter(Boolean)
              : [];

            return (
              <div
                key={lIdx}
                className="flex flex-col sm:flex-row sm:items-baseline gap-2 py-2 px-3 rounded-lg border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors"
              >
                <span className="text-xs font-bold text-slate-700 min-w-[140px] max-w-[240px] shrink-0">
                  {cleanListeningText(label)}:
                </span>
                <div className="flex-1 text-xs text-slate-800 leading-relaxed">
                  {bulletItems.length > 1 ? (
                    <div className="space-y-1.5 pt-0.5">
                      {bulletItems.map((b, bIdx) => (
                        <div key={bIdx} className="flex items-start gap-2">
                          <span className="text-blue-500 font-bold shrink-0 mt-0.5">•</span>
                          <div className="flex-1 text-xs text-slate-800 leading-relaxed">
                            {renderTextWithEmbeddedInputs(b, `form-${lIdx}-b${bIdx}`)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    renderTextWithEmbeddedInputs(val, `form-${lIdx}`)
                  )}
                </div>
              </div>
            );
          }

          return (
            <div key={lIdx} className="text-xs text-slate-800 py-1 px-3">
              {renderTextWithEmbeddedInputs(line, `form-txt-${lIdx}`)}
            </div>
          );
        })}
      </div>
    );
  };

  // 4. Render Structured Notes, Summaries, or Sentences
  const renderStructuredNotesOrSummary = (notesText: string) => {
    // 1. Normalize multi-row lines and remove orphaned table dividers (| ---, |:---|) and table syntax remnants
    let formattedText = normalizeListeningStructuredText(notesText);
    formattedText = formattedText.replace(/<br\s*\/?>/gi, '\n');
    formattedText = formattedText.replace(/^\s*\|?\s*:?-{2,}:?\s*\|?\s*$/gm, '');
    formattedText = formattedText.replace(/^(?:\|?\s*:?-{2,}:?\s*)+[\|\s]*/gm, '');
    formattedText = formattedText.replace(/(?:\|?\s*:?-{2,}:?\s*)+[\|\s]*/g, '');
    // Clean up mid-line pipe delimiters (e.g. "Label: | Value" -> "Label: Value")
    formattedText = formattedText.replace(/:\s*\|\s*/g, ': ');
    // Remove leading and trailing pipe characters per line
    formattedText = formattedText.replace(/^\s*\|\s*/gm, '').replace(/\s*\|\s*$/gm, '');
    formattedText = formattedText.replace(/\s*\|\s*/g, ' - ');
    // Normalize bullets to separate lines
    formattedText = formattedText.replace(/\s*(?:•|\u2022)\s*/g, '\n• ');
    // Join isolated bullet lines with the next line (e.g. "•\nActively spoken languages: 81" -> "• Actively spoken languages: 81")
    formattedText = formattedText.replace(/^[•\-\*\+]\s*\n(?=[A-Za-z0-9\[])/gm, '• ');
    // Remove standalone empty bullet lines
    formattedText = formattedText.replace(/^[•\-\*\+◦▪▫]\s*$/gm, '');
    // Normalize excessive line breaks
    formattedText = formattedText.replace(/\n{3,}/g, '\n\n').trim();

    // Preserve authentic line breaks; only merge lines that are clear mid-sentence wraps (e.g. starting with lowercase after a trailing connector)
    const rawLines = formattedText.split('\n').filter((l) => l.trim().length > 0);
    const lines: string[] = [];
    for (let i = 0; i < rawLines.length; i++) {
      const cur = rawLines[i];
      const trimmedCur = cur.trim();
      const prevLine = lines[lines.length - 1];
      const prevTrimmed = prevLine ? prevLine.trim() : '';

      const isPrevEndingConnector = prevTrimmed && /(?:,|and|or|of|in|to|for|with|from|by|-|–)$/i.test(prevTrimmed);
      const isCurStartingLower = trimmedCur && /^[a-z]/.test(trimmedCur);
      const isCurBullet = /^[•\-\*\+◦▪▫]/.test(trimmedCur);
      const isPrevBullet = prevTrimmed && /^[•\-\*\+◦▪▫]/.test(prevTrimmed);

      if (
        lines.length > 0 &&
        !isCurBullet &&
        !trimmedCur.endsWith(':') &&
        isCurStartingLower &&
        isPrevEndingConnector &&
        isPrevBullet &&
        !prevTrimmed.includes('[')
      ) {
        // True mid-sentence line wrap continuation
        lines[lines.length - 1] += ' ' + trimmedCur;
      } else {
        lines.push(cur);
      }
    }

    return (
      <div className="space-y-3 my-3">
        {lines.map((line, lIdx) => {
          const trimmedLine = line.trim();
          const isBullet = /^[•\-\*\+◦▪▫]\s*/.test(trimmedLine);
          const isSubBullet = /^(?:[ \t]{2,}[•\-\*\+◦▪▫]|--|–|\t)/.test(line) || (/^[•\-\*\+◦▪▫]/.test(trimmedLine) && line.startsWith('  '));
          const isHeading =
            !isBullet &&
            !trimmedLine.includes('[') &&
            (trimmedLine.endsWith(':') ||
              trimmedLine === trimmedLine.toUpperCase() ||
              /^(?:Aim|Background|Methods?|Results?|Conclusion|Location|Activities|Session|Topic|General|Vocabulary|Grammar)\b/i.test(trimmedLine) ||
              (trimmedLine.length <= 45 && !/[,\.]$/.test(trimmedLine) && /^[A-Z]/.test(trimmedLine)));

          if (isHeading) {
            return (
              <div
                key={lIdx}
                className="pt-4 pb-1.5 text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200"
              >
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block shrink-0" />
                <span>{renderFormattedText(trimmedLine, `hd-${lIdx}`)}</span>
              </div>
            );
          }

          if (isBullet) {
            const cleanBulletText = trimmedLine.replace(/^[•\-\*\+\s◦▪▫]+/, '').trim();
            if (!cleanBulletText) return null; // Never render empty bullet point
            return (
              <div key={lIdx} className={`flex items-start gap-3 py-1.5 ${isSubBullet ? 'pl-8' : 'pl-4'}`}>
                <span className={`text-blue-500 font-bold shrink-0 mt-0.5 ${isSubBullet ? 'text-sm' : 'text-base sm:text-lg'}`}>
                  {isSubBullet ? '◦' : '•'}
                </span>
                <div className="flex-1 text-base text-slate-800 leading-[1.7]">
                  {renderTextWithEmbeddedInputs(cleanBulletText, `note-${lIdx}`)}
                </div>
              </div>
            );
          }

          return (
            <p key={lIdx} className="text-base text-slate-800 leading-[1.7] my-2">
              {renderTextWithEmbeddedInputs(trimmedLine, `para-${lIdx}`)}
            </p>
          );
        })}
      </div>
    );
  };

  // Render Completion / Form / Note / Sentence Questions (Full prompt preserved with inline blank)
  const renderGapFillQuestion = (q: ListeningQuestion) => {
    const userVal = answers[q.id] || '';
    const qNum = q.questionNumber || q.number || 1;
    const cleanPrompt = cleanListeningText(q.prompt);

    // If prompt is literally just "Question 31", render simple labeled input
    if (/^Question\s+[0-9]+$/i.test(cleanPrompt.trim())) {
      return (
        <div
          key={q.id}
          className="flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition"
        >
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 text-blue-800 text-xs sm:text-sm font-bold shrink-0">
              {qNum}
            </span>
            <input
              type="text"
              value={userVal}
              disabled={isReadOnly}
              placeholder={`Nhập đáp án câu ${qNum}...`}
              onChange={(e) => onAnswerChange(q.id, e.target.value)}
              className="w-full max-w-lg px-4 py-2 text-base bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {renderFlagButton(q.id)}
            {showCorrectAnswers && q.correctAnswer && (
              <span className="text-sm text-emerald-700 font-semibold whitespace-nowrap">
                Đáp án: <span className="font-bold">{cleanListeningText(q.correctAnswer)}</span>
              </span>
            )}
          </div>
        </div>
      );
    }

    const hasBlank = cleanPrompt.includes('_____');
    const isBullet = /^[•\-\*\+]\s+/.test(cleanPrompt);

    if (isBullet) {
      const bulletContent = cleanPrompt.replace(/^[•\-\*\+\s]+/, '');
      return (
        <div
          key={q.id}
          className="flex items-start gap-3 py-2.5 px-4 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition"
        >
          <span className="text-blue-500 font-bold shrink-0 mt-1 text-base sm:text-lg">•</span>
          <div className="text-base text-slate-800 font-medium leading-relaxed flex-1">
            {hasBlank ? (
              <span>
                {bulletContent.split('_____')[0]}
                <span className="inline-flex items-center gap-1.5 align-middle mx-1.5 my-1">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs sm:text-sm font-bold border border-blue-300 shrink-0">
                    {qNum}
                  </span>
                  <input
                    type="text"
                    value={userVal}
                    disabled={isReadOnly}
                    placeholder={`[${qNum}]`}
                    onChange={(e) => onAnswerChange(q.id, e.target.value)}
                    className="px-3 py-1 text-sm sm:text-base bg-blue-50/70 hover:bg-blue-50 focus:bg-white border border-blue-400 focus:border-blue-600 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold text-blue-900 min-w-[105px] max-w-[190px]"
                  />
                </span>
                {bulletContent.split('_____')[1]}
              </span>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <span>{bulletContent}</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs sm:text-sm font-bold shrink-0">
                    {qNum}
                  </span>
                  <input
                    type="text"
                    value={userVal}
                    disabled={isReadOnly}
                    placeholder={`[${qNum}]`}
                    onChange={(e) => onAnswerChange(q.id, e.target.value)}
                    className="px-3 py-1 text-sm sm:text-base bg-blue-50/70 border border-blue-400 rounded-lg font-semibold text-blue-900 min-w-[105px]"
                  />
                </span>
              </div>
            )}
          </div>
          {renderFlagButton(q.id)}
          {showCorrectAnswers && q.correctAnswer && (
            <span className="text-sm text-emerald-700 font-bold ml-2 shrink-0">
              [{cleanListeningText(q.correctAnswer)}]
            </span>
          )}
        </div>
      );
    }

    return (
      <div
        key={q.id}
        className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-baseline gap-3 flex-1">
            <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 text-blue-800 text-xs sm:text-sm font-bold shrink-0">
              {qNum}
            </span>
            <div className="text-base sm:text-[17px] text-slate-800 font-medium leading-relaxed flex-1">
              {hasBlank ? (
                <span>
                  {cleanPrompt.split('_____')[0]}
                  <input
                    type="text"
                    value={userVal}
                    disabled={isReadOnly}
                    placeholder={`[${qNum}]`}
                    onChange={(e) => onAnswerChange(q.id, e.target.value)}
                    className="inline-block mx-2 px-3 py-1 text-sm sm:text-base bg-blue-50/60 border border-blue-400 focus:border-blue-600 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold text-blue-900 min-w-[130px]"
                  />
                  {cleanPrompt.split('_____')[1]}
                </span>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <span className="leading-snug">{cleanPrompt}</span>
                  <input
                    type="text"
                    value={userVal}
                    disabled={isReadOnly}
                    placeholder={`[${qNum}]`}
                    onChange={(e) => onAnswerChange(q.id, e.target.value)}
                    className="px-3.5 py-1.5 text-base bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium min-w-[180px]"
                  />
                </div>
              )}
            </div>
          </div>
          {renderFlagButton(q.id)}
        </div>

        {showCorrectAnswers && q.correctAnswer && (
          <div className="pl-2 sm:pl-10 pt-1 text-sm text-emerald-700 font-semibold">
            Đáp án: <span className="font-bold">{cleanListeningText(q.correctAnswer)}</span>
          </div>
        )}
      </div>
    );
  };

  const isGroupMultiSelect = type === 'multiple_select';

  // Filter raw option lines from displayed groupText so options are not duplicated visually
  const getDisplayGroupText = (rawText: string) => {
    return rawText
      .split('\n')
      .filter((line) => {
        const isOptLine = /^[•\-\*\s\u2022]*([A-Za-z])(?:[\.\)\:\-]\s*|\s+)/i.test(line.trim());
        return !isOptLine;
      })
      .join('\n')
      .trim();
  };

  // Render Structured Content (Tables, Flow-charts, Forms, Notes, Summaries) with embedded inputs
  const renderStructuredContent = () => {
    if (!effectiveGroupContent) return null;

    const isFormType =
      type === 'form_completion' ||
      (questionGroup as any).groupType === 'form_completion';

    const isExplicitTableType =
      type === 'table_completion' ||
      (questionGroup as any).groupType === 'table_completion';

    // 1. Table Completion: pipe-separated Markdown table (must have at least 2 rows and at least 2 columns)
    const normalizedLines = effectiveGroupContent.split('\n').map((l) => {
      let trimmed = l.trim();
      if (!trimmed.includes('|')) return trimmed;
      if (!trimmed.startsWith('|')) trimmed = '| ' + trimmed;
      if (!trimmed.endsWith('|')) trimmed = trimmed + ' |';
      return trimmed;
    });

    const rawTableLines = normalizedLines.filter((l) => l.startsWith('|') && l.endsWith('|'));
    const isAuthenticTable =
      rawTableLines.length >= 2 &&
      rawTableLines.some((l) => l.slice(1, -1).split('|').length >= 2);

    // Check if table rows are actually key-value form lines (e.g. Riverdale Pre-school or Application Form)
    const isKeyValueFormTable =
      !isExplicitTableType &&
      rawTableLines.length >= 2 &&
      rawTableLines.every((l) => {
        const parts = l.slice(1, -1).split('|');
        return parts.length <= 2;
      }) &&
      rawTableLines.some((l) => {
        const parts = l.slice(1, -1).split('|');
        const first = parts[0]?.trim() || '';
        return (
          first.endsWith(':') ||
          /^(?:Name|Phone|Email|Address|Employer|Occupation|Date|Rent|Location|Price|Cost|Age|Example|Children|Classes|Hours|Activities|Fees|Sessions)\b/i.test(first)
        );
      });

    if (isAuthenticTable && !isFormType && !isKeyValueFormTable) {
      const nonTableText = effectiveGroupContent
        .split('\n')
        .filter((l) => !l.trim().startsWith('|'))
        .join(' ')
        .trim();

      const headerLine = rawTableLines[0] || '';
      const tableHeaders = headerLine
        .slice(1, -1)
        .split('|')
        .map((c) => cleanListeningText(c).toLowerCase());

      const cleanNonTable = cleanListeningText(nonTableText).toLowerCase();
      const isRedundantHeading =
        !cleanNonTable ||
        tableHeaders.some((h) => h === cleanNonTable) ||
        cleanListeningText(instructions || '').toLowerCase().includes(cleanNonTable) ||
        cleanListeningText(title || '').toLowerCase().includes(cleanNonTable);

      return (
        <div className="my-2 space-y-2">
          {!isRedundantHeading && (
            <p className="text-xs font-semibold text-slate-800 mb-1.5">
              {cleanListeningText(nonTableText)}
            </p>
          )}
          {renderStructuredTable(effectiveGroupContent)}
        </div>
      );
    }

    // 2. Flow-chart Completion
    const hasFlowchartMarkers =
      /[↓▼]|-->|->/i.test(effectiveGroupContent) ||
      /^(?:Step|Stage)\s+[0-9]+/im.test(effectiveGroupContent);
    if (type === 'flowchart_completion' || hasFlowchartMarkers) {
      return (
        <div className="my-2 p-4 bg-slate-50/50 rounded-xl border border-slate-200 shadow-2xs">
          {renderStructuredFlowchart(effectiveGroupContent)}
        </div>
      );
    }

    // 3. Form Completion
    const lines = effectiveGroupContent.split('\n').map((l) => l.trim()).filter(Boolean);
    const colonCount = lines.filter((l) => l.includes(':')).length;
    const isNoteOrSummaryType =
      type === 'note_completion' ||
      type === 'summary_completion' ||
      type === 'sentence_completion';

    const isFormLike =
      !isNoteOrSummaryType &&
      (isFormType ||
        isKeyValueFormTable ||
        (colonCount >= 2 && lines.length >= 3 && colonCount >= lines.length * 0.4));

    if (isFormLike) {
      return (
        <div className="my-2 p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          {renderStructuredForm(effectiveGroupContent)}
        </div>
      );
    }

    // 4. Note Completion / Summary Completion / Sentence Completion
    return (
      <div className="my-2 p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
        {renderStructuredNotesOrSummary(effectiveGroupContent)}
      </div>
    );
  };

  const isSingleIndependent =
    !instructions &&
    !imageUrl &&
    !groupText &&
    !questionGroup.sharedContent &&
    !questionGroup.audioUrl &&
    !questionGroup.optionsBox?.length &&
    safeQuestions.length === 1;

  // Pre-render structured content to collect all embedded question IDs
  const renderedStructuredContent = effectiveGroupContent ? renderStructuredContent() : null;

  // Filter out questions already rendered in embedded structured content
  const remainingQuestionsToRender = safeQuestions.filter(
    (q) => !embeddedQuestionIds.has(q.id)
  );

  return (
    <div className="space-y-4 mb-6">
      {/* Group Header: Title, Instruction, Word Limit badge, Shared Audio/Image/Text */}
      {!isSingleIndependent && (
        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h4 className="text-lg sm:text-xl font-bold text-slate-900">
              {cleanListeningText(title) || `Questions ${firstQNum} - ${lastQNum}`}
            </h4>
            {wordLimit && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                <AlertCircle className="w-4 h-4" />
                {cleanListeningText(wordLimit)}
              </span>
            )}
          </div>

          {instructions && (
            <p className="text-[15px] sm:text-base text-slate-700 italic font-medium mb-3 leading-relaxed">
              {cleanListeningText(instructions)}
            </p>
          )}

          {/* Shared group audio recording */}
          {questionGroup.audioUrl && (
            <div className="my-3 p-3.5 bg-blue-50/80 rounded-xl border border-blue-200 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-blue-900 shrink-0">
                <Volume2 className="w-4 h-4 text-blue-700" />
                <span>Audio dùng chung cho nhóm ({firstQNum}–{lastQNum}):</span>
              </div>
              <audio
                controls
                src={questionGroup.audioUrl}
                className="w-full h-9 rounded-lg"
                controlsList="nodownload"
              />
            </div>
          )}

          {/* Optional shared group diagram / image */}
          {imageUrl && (
            <div className="my-3 p-2 bg-white rounded-lg border border-slate-200 max-w-xl mx-auto text-center">
              <img
                src={imageUrl}
                alt={imageCaption || 'Listening diagram or map'}
                className="max-h-72 w-auto mx-auto object-contain rounded"
              />
              {imageCaption && (
                <p className="text-sm text-slate-600 mt-1.5 italic">{cleanListeningText(imageCaption)}</p>
              )}
            </div>
          )}

          {/* Options Box (for Matching / Labelling / Completion) formatted clearly */}
          {(() => {
            const displayOpts =
              (questionGroup.optionsBox && questionGroup.optionsBox.length > 0)
                ? questionGroup.optionsBox
                : (questionGroup.options && questionGroup.options.length > 0)
                ? questionGroup.options
                : (type === 'matching' || type === 'plan_map_diagram_labelling')
                ? extractOptionsFromText(groupText || questionGroup.sharedContent)
                : [];

            if (displayOpts.length === 0) return null;

            return (
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 my-2.5 shadow-2xs">
                <span className="text-sm font-bold text-slate-700 block mb-2 uppercase tracking-wide">
                  Danh sách lựa chọn (Options):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {displayOpts.map((opt, oIdx) => {
                    const letterMatch = opt.match(/^([A-Za-z])[\.\:\)]/i);
                    const letter = letterMatch ? letterMatch[1].toUpperCase() : String.fromCharCode(65 + oIdx);
                    const text = cleanListeningText(opt.replace(/^[A-Za-z][\.\:\)]\s*/i, ''));
                    return (
                      <div
                        key={oIdx}
                        className="text-base text-slate-800 flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <span className="font-bold text-blue-700 shrink-0 w-5 text-base">{letter}.</span>
                        <span className="flex-1 leading-relaxed text-base">{text || opt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Structured group text with embedded answer fields */}
          {renderedStructuredContent && (
            <div className="my-2">
              {renderedStructuredContent}
            </div>
          )}
        </div>
      )}

      {/* Render Questions */}
      <div className="space-y-3">
        {remainingQuestionsToRender.length === 0 && embeddedQuestionIds.size === 0 ? (
          <div className="p-4 bg-white rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
            Không có câu hỏi trong phần này.
          </div>
        ) : isGroupMultiSelect ? (
          renderUnifiedMultipleSelect()
        ) : (
          remainingQuestionsToRender.map((q, qIdx) => {
            const qType = q.type || type;
            if (qType === 'multiple_choice') return renderMultipleChoice(q, qIdx);
            if (qType === 'multiple_select') return renderUnifiedMultipleSelect();
            if (qType === 'matching' || qType === 'plan_map_diagram_labelling')
              return renderMatchingOrLabelling(q);
            return renderGapFillQuestion(q);
          })
        )}
      </div>
    </div>
  );
};
