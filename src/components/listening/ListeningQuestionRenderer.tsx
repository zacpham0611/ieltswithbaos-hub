import React from 'react';
import { Flag, Info, Image as ImageIcon, AlertCircle, Volume2 } from 'lucide-react';
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
    id: groupId,
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

  // Render Multiple Choice question
  const renderMultipleChoice = (q: ListeningQuestion) => {
    const userVal = answers[q.id] || '';
    const options = q.options || [];
    const qNum = q.questionNumber || q.number || 1;
    const cleanPrompt = cleanListeningText(q.prompt);

    return (
      <div key={q.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
              {qNum}
            </span>
            <p className="text-sm font-medium text-slate-800 leading-snug">{cleanPrompt}</p>
          </div>
          {renderFlagButton(q.id)}
        </div>

        <div className="space-y-2 pt-1 pl-8">
          {options.map((opt, optIdx) => {
            const letter = String.fromCharCode(65 + optIdx);
            const cleanOpt = cleanListeningText(opt);
            const isSelected = userVal.trim().toUpperCase() === letter || userVal.trim() === cleanOpt.trim();
            return (
              <label
                key={optIdx}
                className={`flex items-start gap-3 p-2.5 rounded-lg border text-sm cursor-pointer transition ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-400 text-blue-900 font-medium'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                } ${isReadOnly ? 'pointer-events-none' : ''}`}
              >
                <input
                  type="radio"
                  name={`question_${q.id}`}
                  value={letter}
                  checked={isSelected}
                  disabled={isReadOnly}
                  onChange={() => onAnswerChange(q.id, letter)}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500 accent-blue-600"
                />
                <span className="font-semibold text-slate-500 w-4">{letter}.</span>
                <span className="flex-1">{cleanOpt}</span>
              </label>
            );
          })}
        </div>

        {showCorrectAnswers && q.correctAnswer && (
          <div className="pl-8 pt-1 text-xs text-emerald-700 font-medium">
            Đáp án đúng: <span className="font-bold">{cleanListeningText(q.correctAnswer)}</span>
          </div>
        )}
      </div>
    );
  };

  // Render Unified Multiple Select Group (e.g. Questions 11-12: Choose TWO letters)
  const renderUnifiedMultipleSelect = () => {
    // Determine max selectable count: from instructions ("Choose TWO" -> 2, "Choose THREE" -> 3) or number of questions
    let maxChoices = safeQuestions.length;
    const instr = (instructions || '').toLowerCase();
    if (instr.includes('choose two') || instr.includes('two letters')) maxChoices = 2;
    else if (instr.includes('choose three') || instr.includes('three letters')) maxChoices = 3;
    else if (instr.includes('choose four')) maxChoices = 4;

    // Collect all currently selected letters across questions in this group
    const currentSelections: string[] = [];
    safeQuestions.forEach((q) => {
      const val = (answers[q.id] || '').trim().toUpperCase();
      if (val) currentSelections.push(val);
    });
    const selectedSet = new Set(currentSelections);

    const options = questionGroup.options || safeQuestions[0]?.options || [];
    const sharedPrompt = cleanListeningText(safeQuestions[0]?.prompt || questionGroup.title || 'Choose the correct letters');

    const handleToggleOption = (letter: string) => {
      if (isReadOnly) return;
      const nextList = [...currentSelections];
      const existingIdx = nextList.indexOf(letter);

      if (existingIdx >= 0) {
        nextList.splice(existingIdx, 1);
      } else {
        if (nextList.length >= maxChoices) {
          // If at limit, replace oldest or block
          nextList.shift();
        }
        nextList.push(letter);
      }
      nextList.sort();

      // Distribute selected letters sequentially to each question in this group
      safeQuestions.forEach((q, idx) => {
        const assignedLetter = nextList[idx] || '';
        onAnswerChange(q.id, assignedLetter);
      });
    };

    return (
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
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
            <p className="text-sm font-semibold text-slate-800 leading-snug">{sharedPrompt}</p>
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
            const letter = String.fromCharCode(65 + optIdx);
            const cleanOpt = cleanListeningText(opt);
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
                  className="mt-0.5 text-blue-600 rounded focus:ring-blue-500 accent-blue-600"
                />
                <span className="font-bold text-slate-600 w-4">{letter}.</span>
                <span className="flex-1">{cleanOpt}</span>
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

  // Render Matching or Labelling
  const renderMatchingOrLabelling = (q: ListeningQuestion) => {
    const userVal = answers[q.id] || '';
    const options = questionGroup.optionsBox || questionGroup.options || q.options || [];
    const qNum = q.questionNumber || q.number || 1;
    const cleanPrompt = cleanListeningText(q.prompt);

    return (
      <div
        key={q.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition shadow-2xs"
      >
        <div className="flex items-center gap-2.5 min-w-[200px]">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
            {qNum}
          </span>
          <span className="text-sm font-medium text-slate-800">{cleanPrompt}</span>
          {renderFlagButton(q.id)}
        </div>

        <div className="flex items-center gap-2">
          {options.length > 0 ? (
            <select
              value={userVal}
              disabled={isReadOnly}
              onChange={(e) => onAnswerChange(q.id, e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium"
            >
              <option value="">-- Chọn đáp án --</option>
              {options.map((opt: string, idx: number) => {
                const optLetter = opt.length <= 2 ? opt : String.fromCharCode(65 + idx);
                const optText = cleanListeningText(opt.replace(/^[A-Za-z][\.\:\)]\s*/, ''));
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


  // Render Markdown Table as a styled responsive HTML table with embedded gap badges
  const renderStructuredTable = (tableMarkdown: string) => {
    const lines = tableMarkdown
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('|') && l.endsWith('|'));

    if (lines.length < 2) return null;

    const isSep = (l: string) => /^\|(?:s*:?-+:?s*\|)+$/.test(l);
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

    const renderCellWithBadges = (cellText: string) => {
      // Split on badges like [1], [2], or blanks
      const parts = cellText.split(/(\[[0-9]{1,2}\])/g);
      return parts.map((part, pIdx) => {
        const match = part.match(/^\[([0-9]{1,2})\]$/);
        if (match) {
          const qNum = match[1];
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
                    {renderCellWithBadges(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render clean separate answer row for completion questions (ONLY question number and input)
  const renderTableCompletionAnswerRow = (q: ListeningQuestion) => {
    const userVal = answers[q.id] || '';
    const qNum = q.questionNumber || q.number || 1;

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
  };

  // Render Gap-fill / Form / Note / Table / Completion
  const renderGapFillQuestion = (q: ListeningQuestion) => {
    const userVal = answers[q.id] || '';
    const qNum = q.questionNumber || q.number || 1;
    const cleanPrompt = cleanListeningText(q.prompt);

    // If part of a table or orphan fragment, render separate clean answer control without fragmented text
    const isTableGroup = type === 'table_completion' || Boolean(questionGroup.groupText?.includes('|'));
    const isFragment =
      /^(?:the\b|a\b|an\b|in\b|at\b|by\b|to\b|on\b|meet at\b)/i.test(cleanPrompt) ||
      /\bp\.?m\.?$/i.test(cleanPrompt) ||
      cleanPrompt.length < 15 ||
      /^Question\s+[0-9]+/i.test(cleanPrompt);

    if (isTableGroup || isFragment) {
      return renderTableCompletionAnswerRow(q);
    }

    // If prompt contains '_____', render inline completion
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
                <span>{cleanPrompt}</span>
              )}
            </div>
          </div>
          {renderFlagButton(q.id)}
        </div>

        {/* Separate answer row: ONLY Question Number and Input, without repeating sentence fragments */}
        {!hasBlank && (
          <div className="pl-8 pt-1 flex items-center gap-3">
            <input
              type="text"
              value={userVal}
              disabled={isReadOnly}
              placeholder={`Nhập đáp án câu ${qNum}...`}
              onChange={(e) => onAnswerChange(q.id, e.target.value)}
              className="w-full max-w-sm px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium"
            />
            {showCorrectAnswers && q.correctAnswer && (
              <span className="text-xs text-emerald-700 font-semibold whitespace-nowrap">
                Đáp án: <span className="font-bold">{cleanListeningText(q.correctAnswer)}</span>
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const effectiveGroupContent = groupText || questionGroup.sharedContent || '';
  const isGroupMultiSelect = type === 'multiple_select';

  const isSingleIndependent =
    !instructions &&
    !imageUrl &&
    !groupText &&
    !questionGroup.sharedContent &&
    !questionGroup.audioUrl &&
    !questionGroup.optionsBox?.length &&
    safeQuestions.length === 1;

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

          {/* Shared group audio recording (rendered ONCE for group) */}
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

          {/* Optional shared group diagram / image (rendered ONCE for group) */}
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
        {((questionGroup.optionsBox && questionGroup.optionsBox.length > 0) ||
          (questionGroup.options &&
            questionGroup.options.length > 0 &&
            (type === 'matching' ||
              type === 'plan_map_diagram_labelling' ||
              type === 'summary_completion'))) && (
          <div className="p-3 bg-white rounded-lg border border-slate-200 my-2">
            <span className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wide">
              Danh sách lựa chọn (Options):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {(questionGroup.optionsBox || questionGroup.options || []).map((opt, oIdx) => {
                const letter = opt.length <= 2 ? opt : String.fromCharCode(65 + oIdx);
                const text = cleanListeningText(opt.replace(/^[A-Za-z][\.\:\)]\s*/, ''));
                return (
                  <div
                    key={oIdx}
                    className="text-xs text-slate-800 flex items-start gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <span className="font-bold text-blue-700 shrink-0 w-4">{letter}.</span>
                    <span className="flex-1">{text || opt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
                {renderStructuredTable(effectiveGroupContent)}
              </>
            ) : (
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed shadow-2xs">
                {cleanListeningText(effectiveGroupContent)}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Render Questions */}
      <div className="space-y-3">
        {safeQuestions.length === 0 ? (
          <div className="p-4 bg-white rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
            Không có câu hỏi trong phần này.
          </div>
        ) : isGroupMultiSelect ? (
          renderUnifiedMultipleSelect()
        ) : (
          safeQuestions.map((q) => {
            const qType = q.type || type;
            if (qType === 'multiple_choice') return renderMultipleChoice(q);
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
