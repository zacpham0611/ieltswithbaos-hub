import React from 'react';
import { Flag, Info, Image as ImageIcon, AlertCircle } from 'lucide-react';
import type { ListeningQuestion, ListeningQuestionGroup } from '../../types';

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

    return (
      <div key={q.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
              {qNum}
            </span>
            <p className="text-sm font-medium text-slate-800 leading-snug">{q.prompt}</p>
          </div>
          {renderFlagButton(q.id)}
        </div>

        <div className="space-y-2 pt-1 pl-8">
          {options.map((opt, optIdx) => {
            const letter = String.fromCharCode(65 + optIdx);
            const isSelected = userVal.trim().toUpperCase() === letter || userVal.trim() === opt.trim();
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
                <span className="flex-1">{opt}</span>
              </label>
            );
          })}
        </div>

        {showCorrectAnswers && q.correctAnswer && (
          <div className="pl-8 pt-1 text-xs text-emerald-700 font-medium">
            Đáp án đúng: <span className="font-bold">{q.correctAnswer}</span>
          </div>
        )}
      </div>
    );
  };

  // Render Multiple Select question (e.g. Choose TWO letters)
  const renderMultipleSelect = (q: ListeningQuestion) => {
    const rawVal = answers[q.id] || '';
    const selectedTokens = new Set(
      rawVal
        .split(/[,\s;/]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    );
    const options = q.options || [];
    const qNum = q.questionNumber || q.number || 1;

    const handleCheckboxToggle = (letter: string) => {
      if (isReadOnly) return;
      const nextSet = new Set(selectedTokens);
      if (nextSet.has(letter)) {
        nextSet.delete(letter);
      } else {
        nextSet.add(letter);
      }
      onAnswerChange(q.id, Array.from(nextSet).sort().join(', '));
    };

    return (
      <div key={q.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
              {qNum}
            </span>
            <div>
              <p className="text-sm font-medium text-slate-800 leading-snug">{q.prompt}</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {instructions || 'Choose the correct letters'}
              </p>
            </div>
          </div>
          {renderFlagButton(q.id)}
        </div>

        <div className="space-y-2 pt-1 pl-8">
          {options.map((opt, optIdx) => {
            const letter = String.fromCharCode(65 + optIdx);
            const isChecked = selectedTokens.has(letter);
            return (
              <label
                key={optIdx}
                className={`flex items-start gap-3 p-2.5 rounded-lg border text-sm cursor-pointer transition ${
                  isChecked
                    ? 'bg-blue-50/80 border-blue-400 text-blue-900 font-medium'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                } ${isReadOnly ? 'pointer-events-none' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isReadOnly}
                  onChange={() => handleCheckboxToggle(letter)}
                  className="mt-0.5 text-blue-600 rounded focus:ring-blue-500 accent-blue-600"
                />
                <span className="font-semibold text-slate-500 w-4">{letter}.</span>
                <span className="flex-1">{opt}</span>
              </label>
            );
          })}
        </div>

        {showCorrectAnswers && q.correctAnswer && (
          <div className="pl-8 pt-1 text-xs text-emerald-700 font-medium">
            Đáp án đúng: <span className="font-bold">{q.correctAnswer}</span>
          </div>
        )}
      </div>
    );
  };

  // Render Matching or Labelling
  const renderMatchingOrLabelling = (q: ListeningQuestion) => {
    const userVal = answers[q.id] || '';
    const options = questionGroup.options || q.options || [];
    const qNum = q.questionNumber || q.number || 1;

    return (
      <div
        key={q.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition"
      >
        <div className="flex items-center gap-2.5 min-w-[200px]">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
            {qNum}
          </span>
          <span className="text-sm font-medium text-slate-800">{q.prompt}</span>
          {renderFlagButton(q.id)}
        </div>

        <div className="flex items-center gap-2">
          {options.length > 0 ? (
            <select
              value={userVal}
              disabled={isReadOnly}
              onChange={(e) => onAnswerChange(q.id, e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium"
            >
              <option value="">-- Chọn đáp án --</option>
              {options.map((opt: string, idx: number) => {
                const optLetter = opt.length <= 2 ? opt : String.fromCharCode(65 + idx);
                return (
                  <option key={idx} value={optLetter}>
                    {opt}
                  </option>
                );
              })}
            </select>
          ) : (
            <input
              type="text"
              value={userVal}
              disabled={isReadOnly}
              placeholder="Nhập chữ cái (A, B, C...)"
              onChange={(e) => onAnswerChange(q.id, e.target.value.toUpperCase())}
              className="w-36 px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium uppercase"
            />
          )}

          {showCorrectAnswers && q.correctAnswer && (
            <span className="text-xs text-emerald-700 font-bold ml-2">
              [{q.correctAnswer}]
            </span>
          )}
        </div>
      </div>
    );
  };

  // Render Gap-fill / Form / Note / Table / Flow-chart / Summary completion
  const renderGapFillQuestion = (q: ListeningQuestion) => {
    const userVal = answers[q.id] || '';
    const qNum = q.questionNumber || q.number || 1;

    return (
      <div
        key={q.id}
        className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-baseline gap-2 flex-1">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
              {qNum}
            </span>
            <div className="text-sm text-slate-800 font-medium leading-relaxed flex-1">
              {q.prompt.includes('_____') ? (
                <span>
                  {q.prompt.split('_____')[0]}
                  <input
                    type="text"
                    value={userVal}
                    disabled={isReadOnly}
                    placeholder={`[${qNum}]`}
                    onChange={(e) => onAnswerChange(q.id, e.target.value)}
                    className="inline-block mx-2 px-2.5 py-1 text-sm bg-blue-50/50 border border-blue-300 focus:border-blue-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-blue-900 min-w-[130px]"
                  />
                  {q.prompt.split('_____')[1]}
                </span>
              ) : (
                <span>{q.prompt}</span>
              )}
            </div>
          </div>
          {renderFlagButton(q.id)}
        </div>

        {!q.prompt.includes('_____') && (
          <div className="pl-8 pt-1 flex items-center gap-2">
            <input
              type="text"
              value={userVal}
              disabled={isReadOnly}
              placeholder={`Answer for question ${qNum}...`}
              onChange={(e) => onAnswerChange(q.id, e.target.value)}
              className="w-full max-w-sm px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium"
            />
            {showCorrectAnswers && q.correctAnswer && (
              <span className="text-xs text-emerald-700 font-semibold whitespace-nowrap">
                Đáp án: <span className="font-bold">{q.correctAnswer}</span>
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const safeQuestions = questions || [];
  const firstQNum = safeQuestions[0]?.questionNumber || safeQuestions[0]?.number || 1;
  const lastQNum = safeQuestions[safeQuestions.length - 1]?.questionNumber || safeQuestions[safeQuestions.length - 1]?.number || safeQuestions.length;

  // Render question dynamically based on question's own type or fallback to group type
  const renderQuestionItem = (q: ListeningQuestion) => {
    const qType = q.type || type;
    if (qType === 'multiple_choice') return renderMultipleChoice(q);
    if (qType === 'multiple_select') return renderMultipleSelect(q);
    if (qType === 'matching' || qType === 'plan_map_diagram_labelling') return renderMatchingOrLabelling(q);
    return renderGapFillQuestion(q);
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Group Header: Title, Instruction, Word Limit badge */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <h4 className="text-sm font-bold text-slate-900">
            {title || `Questions ${firstQNum} - ${lastQNum}`}
          </h4>
          {wordLimit && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
              <AlertCircle className="w-3.5 h-3.5" />
              {wordLimit}
            </span>
          )}
        </div>

        {instructions && (
          <p className="text-xs text-slate-600 italic font-medium mb-2">
            {instructions}
          </p>
        )}

        {/* Optional shared group diagram / image (Section 12 requirement for Map/Diagram/Flowchart) */}
        {imageUrl && (
          <div className="my-3 p-2 bg-white rounded-lg border border-slate-200 max-w-xl mx-auto text-center">
            <img
              src={imageUrl}
              alt={imageCaption || 'Listening diagram or map'}
              className="max-h-72 w-auto mx-auto object-contain rounded"
            />
            {imageCaption && (
              <p className="text-xs text-slate-500 mt-1 italic">{imageCaption}</p>
            )}
          </div>
        )}

        {/* Optional structured group text (e.g. form layout, note outlines, table) */}
        {groupText && (
          <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed my-2">
            {groupText}
          </div>
        )}
      </div>

      {/* Render Questions based on individual or group type */}
      <div className="space-y-3">
        {safeQuestions.length === 0 ? (
          <div className="p-4 bg-white rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
            Không có câu hỏi trong phần này.
          </div>
        ) : (
          safeQuestions.map(renderQuestionItem)
        )}
      </div>
    </div>
  );
};
