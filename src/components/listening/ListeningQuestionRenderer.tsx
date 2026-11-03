import React from 'react';
import { Flag, AlertCircle, Volume2 } from 'lucide-react';
import type { ListeningQuestion, ListeningQuestionGroup } from '../../types';
import { cleanListeningText } from '../../lib/listeningExtractor';

export { cleanListeningText };

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
    const match = line.match(/^[•\-\*\s\u2022]*([A-G])(?:[\.\)\:\-]\s*|\s+)(.*)$/i);
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
  const firstQNum = safeQuestions[0]?.questionNumber || safeQuestions[0]?.number || 1;
  const lastQNum =
    safeQuestions[safeQuestions.length - 1]?.questionNumber ||
    safeQuestions[safeQuestions.length - 1]?.number ||
    safeQuestions.length;

  // Set of question IDs whose inputs are directly embedded inside table cells
  const tableEmbeddedQuestionIds = new Set<string>();

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
          <div className="flex items-baseline gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
              {qNum}
            </span>
            <p className="text-sm font-semibold text-slate-900 leading-snug">{cleanPrompt}</p>
          </div>
          {renderFlagButton(q.id)}
        </div>

        {options.length > 0 ? (
          <div className="space-y-2 pt-1 pl-8">
            {options.map((opt, optIdx) => {
              const letterMatch = opt.match(/^([A-G])[\.\:\)]/i);
              const letter = letterMatch ? letterMatch[1].toUpperCase() : String.fromCharCode(65 + optIdx);
              const cleanOpt = cleanListeningText(opt.replace(/^[A-G][\.\:\)]\s*/i, ''));
              const isSelected =
                userVal.toUpperCase() === letter ||
                userVal.toUpperCase() === opt.toUpperCase() ||
                userVal.toUpperCase() === cleanOpt.toUpperCase();

              return (
                <label
                  key={optIdx}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-sm cursor-pointer transition ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-400 text-blue-900 font-medium ring-1 ring-blue-300'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  } ${isReadOnly ? 'pointer-events-none' : ''}`}
                >
                  <input
                    type="radio"
                    name={`listening_mc_${q.id}`}
                    value={letter}
                    checked={isSelected}
                    disabled={isReadOnly}
                    onChange={() => onAnswerChange(q.id, letter)}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                  />
                  <span className="font-bold text-slate-600 w-4 shrink-0">{letter}.</span>
                  <span className="flex-1 leading-relaxed">{cleanOpt || opt}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="pl-8 pt-1">
            <input
              type="text"
              value={userVal}
              disabled={isReadOnly}
              placeholder="Nhập đáp án (A, B, C...)"
              onChange={(e) => onAnswerChange(q.id, e.target.value.toUpperCase())}
              className="w-44 px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium uppercase"
            />
          </div>
        )}

        {showCorrectAnswers && q.correctAnswer && (
          <div className="pl-8 pt-1 text-xs text-emerald-700 font-medium">
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
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold">
                Questions {firstQNum} - {lastQNum}
              </span>
              <span className="text-xs font-semibold text-amber-700">
                (Chọn tối đa {maxChoices} đáp án)
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900 leading-snug">{sharedPrompt}</p>
          </div>
          <div className="flex items-center gap-1">
            {safeQuestions.map((q) => (
              <span key={q.id}>{renderFlagButton(q.id)}</span>
            ))}
          </div>
        </div>

        {/* Checkbox Options */}
        <div className="space-y-2 pt-1 pl-2">
          {options.map((opt, optIdx) => {
            const letterMatch = opt.match(/^([A-G])[\.\:\)]/i);
            const letter = letterMatch ? letterMatch[1].toUpperCase() : String.fromCharCode(65 + optIdx);
            const cleanOpt = cleanListeningText(opt.replace(/^[A-G][\.\:\)]\s*/i, ''));
            const isChecked = selectedSet.has(letter);

            return (
              <label
                key={optIdx}
                className={`flex items-start gap-3 p-3 rounded-lg border text-sm cursor-pointer transition ${
                  isChecked
                    ? 'bg-blue-50/90 border-blue-400 text-blue-900 font-medium ring-1 ring-blue-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                } ${isReadOnly ? 'pointer-events-none' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isReadOnly}
                  onChange={() => handleToggleOption(letter)}
                  className="mt-0.5 text-blue-600 rounded focus:ring-blue-500 accent-blue-600 cursor-pointer"
                />
                <span className="font-bold text-slate-600 w-4 shrink-0">{letter}.</span>
                <span className="flex-1 leading-relaxed">{cleanOpt || opt}</span>
              </label>
            );
          })}
        </div>

        {/* Selected answers display mapped to questions */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
          {safeQuestions.map((q, idx) => {
            const qNum = q.questionNumber || q.number || firstQNum + idx;
            const currentVal = answers[q.id] || '';
            return (
              <div key={q.id} className="flex items-center gap-1.5 font-medium">
                <span className="font-bold text-slate-700">Câu {qNum}:</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold font-mono">
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
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition shadow-2xs"
      >
        <div className="flex items-center gap-2.5 min-w-[200px] flex-1">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
            {qNum}
          </span>
          <span className="text-sm font-semibold text-slate-800 leading-snug">{cleanPrompt}</span>
          {renderFlagButton(q.id)}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {options.length > 0 ? (
            <select
              value={userVal}
              disabled={isReadOnly}
              onChange={(e) => onAnswerChange(q.id, e.target.value.toUpperCase())}
              className="px-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium max-w-[280px]"
            >
              <option value="">-- Chọn đáp án --</option>
              {options.map((opt: string, idx: number) => {
                const letterMatch = opt.match(/^([A-G])[\.\:\)]/i);
                const optLetter = letterMatch ? letterMatch[1].toUpperCase() : String.fromCharCode(65 + idx);
                const optText = cleanListeningText(opt.replace(/^[A-G][\.\:\)]\s*/i, ''));
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
              className="w-36 px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium uppercase"
            />
          )}

          {showCorrectAnswers && q.correctAnswer && (
            <span className="text-xs text-emerald-700 font-bold ml-2">
              [{cleanListeningText(q.correctAnswer)}]
            </span>
          )}
        </div>
      </div>
    );
  };

  // Render Markdown Table with INTERACTIVE in-cell answer inputs (Preserves table layout and places inputs in cells)
  const renderStructuredTable = (tableMarkdown: string) => {
    const lines = tableMarkdown
      .split('\n')
      .map((l) => l.trim())
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

    const renderCellContentWithInputs = (cellText: string) => {
      const parts = cellText.split(/(\[[0-9]{1,2}\])/g);
      return parts.map((part, pIdx) => {
        const match = part.match(/^\[([0-9]{1,2})\]$/);
        if (match) {
          const qNum = parseInt(match[1], 10);
          const targetQ = safeQuestions.find(
            (q) => (q.questionNumber || q.number) === qNum
          );

          if (targetQ) {
            tableEmbeddedQuestionIds.add(targetQ.id);
            const userVal = answers[targetQ.id] || '';

            return (
              <div key={pIdx} className="inline-flex items-center gap-1.5 my-1 flex-wrap">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold text-xs border border-blue-300 shrink-0">
                  {qNum}
                </span>
                <input
                  type="text"
                  value={userVal}
                  disabled={isReadOnly}
                  placeholder={`[${qNum}]`}
                  onChange={(e) => onAnswerChange(targetQ.id, e.target.value)}
                  className="px-2.5 py-1 text-xs sm:text-sm bg-blue-50/80 border border-blue-400 focus:border-blue-600 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-semibold text-blue-900 min-w-[90px] max-w-[150px]"
                />
                {renderFlagButton(targetQ.id)}
                {showCorrectAnswers && targetQ.correctAnswer && (
                  <span className="text-[11px] text-emerald-700 font-bold whitespace-nowrap">
                    [{cleanListeningText(targetQ.correctAnswer)}]
                  </span>
                )}
              </div>
            );
          }

          return (
            <span
              key={pIdx}
              className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-xs border border-blue-300 mx-1 shadow-2xs"
            >
              [{qNum}]
            </span>
          );
        }
        return <span key={pIdx}>{cleanListeningText(part)}</span>;
      });
    };

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
            {bodyRows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className={`hover:bg-slate-50/80 transition-colors ${
                  rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                }`}
              >
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className="px-4 py-2.5 text-slate-700 border-r last:border-r-0 border-slate-200 leading-relaxed font-normal align-top"
                  >
                    {renderCellContentWithInputs(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
          className="flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
              {qNum}
            </span>
            <input
              type="text"
              value={userVal}
              disabled={isReadOnly}
              placeholder={`Nhập đáp án câu ${qNum}...`}
              onChange={(e) => onAnswerChange(q.id, e.target.value)}
              className="w-full max-w-md px-3.5 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {renderFlagButton(q.id)}
            {showCorrectAnswers && q.correctAnswer && (
              <span className="text-xs text-emerald-700 font-semibold whitespace-nowrap">
                Đáp án: <span className="font-bold">{cleanListeningText(q.correctAnswer)}</span>
              </span>
            )}
          </div>
        </div>
      );
    }

    const hasBlank = cleanPrompt.includes('_____');

    return (
      <div
        key={q.id}
        className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-baseline gap-2.5 flex-1">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
              {qNum}
            </span>
            <div className="text-sm text-slate-800 font-medium leading-relaxed flex-1">
              {hasBlank ? (
                <span>
                  {cleanPrompt.split('_____')[0]}
                  <input
                    type="text"
                    value={userVal}
                    disabled={isReadOnly}
                    placeholder={`[${qNum}]`}
                    onChange={(e) => onAnswerChange(q.id, e.target.value)}
                    className="inline-block mx-1.5 px-2.5 py-0.5 text-sm bg-blue-50/60 border border-blue-400 focus:border-blue-600 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-semibold text-blue-900 min-w-[120px]"
                  />
                  {cleanPrompt.split('_____')[1]}
                </span>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="leading-snug">{cleanPrompt}</span>
                  <input
                    type="text"
                    value={userVal}
                    disabled={isReadOnly}
                    placeholder={`[${qNum}]`}
                    onChange={(e) => onAnswerChange(q.id, e.target.value)}
                    className="px-3 py-1 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium min-w-[160px]"
                  />
                </div>
              )}
            </div>
          </div>
          {renderFlagButton(q.id)}
        </div>

        {showCorrectAnswers && q.correctAnswer && (
          <div className="pl-8 pt-1 text-xs text-emerald-700 font-semibold">
            Đáp án: <span className="font-bold">{cleanListeningText(q.correctAnswer)}</span>
          </div>
        )}
      </div>
    );
  };

  const effectiveGroupContent = groupText || questionGroup.sharedContent || '';
  const isGroupMultiSelect = type === 'multiple_select';

  // Filter raw option lines from displayed groupText so options are not duplicated visually
  const getDisplayGroupText = (rawText: string) => {
    return rawText
      .split('\n')
      .filter((line) => {
        const isOptLine = /^[•\-\*\s\u2022]*([A-G])(?:[\.\)\:\-]\s*|\s+)/i.test(line.trim());
        return !isOptLine;
      })
      .join('\n')
      .trim();
  };

  const isSingleIndependent =
    !instructions &&
    !imageUrl &&
    !groupText &&
    !questionGroup.sharedContent &&
    !questionGroup.audioUrl &&
    !questionGroup.optionsBox?.length &&
    safeQuestions.length === 1;

  // Pre-render table if present to collect embedded questions
  const renderedTable = effectiveGroupContent.includes('|')
    ? renderStructuredTable(effectiveGroupContent)
    : null;

  // Filter out questions already rendered in table cells
  const remainingQuestionsToRender = safeQuestions.filter(
    (q) => !tableEmbeddedQuestionIds.has(q.id)
  );

  return (
    <div className="space-y-4 mb-6">
      {/* Group Header: Title, Instruction, Word Limit badge, Shared Audio/Image/Text */}
      {!isSingleIndependent && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <h4 className="text-sm font-bold text-slate-900">
              {cleanListeningText(title) || `Questions ${firstQNum} - ${lastQNum}`}
            </h4>
            {wordLimit && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                <AlertCircle className="w-3.5 h-3.5" />
                {cleanListeningText(wordLimit)}
              </span>
            )}
          </div>

          {instructions && (
            <p className="text-xs text-slate-600 italic font-medium mb-2">
              {cleanListeningText(instructions)}
            </p>
          )}

          {/* Shared group audio recording */}
          {questionGroup.audioUrl && (
            <div className="my-3 p-3 bg-blue-50/80 rounded-xl border border-blue-200 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900 shrink-0">
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
                <p className="text-xs text-slate-500 mt-1 italic">{cleanListeningText(imageCaption)}</p>
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
              <div className="p-3 bg-white rounded-lg border border-slate-200 my-2 shadow-2xs">
                <span className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wide">
                  Danh sách lựa chọn (Options):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {displayOpts.map((opt, oIdx) => {
                    const letterMatch = opt.match(/^([A-G])[\.\:\)]/i);
                    const letter = letterMatch ? letterMatch[1].toUpperCase() : String.fromCharCode(65 + oIdx);
                    const text = cleanListeningText(opt.replace(/^[A-G][\.\:\)]\s*/i, ''));
                    return (
                      <div
                        key={oIdx}
                        className="text-xs text-slate-800 flex items-start gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <span className="font-bold text-blue-700 shrink-0 w-4">{letter}.</span>
                        <span className="flex-1 leading-relaxed">{text || opt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Structured group text or notes / tables */}
          {Boolean(effectiveGroupContent) && (
            <div className="my-2">
              {effectiveGroupContent.includes('|') ? (
                <>
                  {effectiveGroupContent
                    .split('\n')
                    .filter((l: string) => !l.trim().startsWith('|'))
                    .join(' ')
                    .trim() && (
                    <p className="text-xs font-semibold text-slate-800 mb-1.5">
                      {cleanListeningText(
                        effectiveGroupContent
                          .split('\n')
                          .filter((l: string) => !l.trim().startsWith('|'))
                          .join(' ')
                      )}
                    </p>
                  )}
                  {renderedTable}
                </>
              ) : (
                (() => {
                  const cleanedText = getDisplayGroupText(effectiveGroupContent);
                  if (!cleanedText) return null;
                  return (
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed shadow-2xs">
                      {cleanListeningText(cleanedText)}
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>
      )}

      {/* Render Questions */}
      <div className="space-y-3">
        {remainingQuestionsToRender.length === 0 && tableEmbeddedQuestionIds.size === 0 ? (
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
