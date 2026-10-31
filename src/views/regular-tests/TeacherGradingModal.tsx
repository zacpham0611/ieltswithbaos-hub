import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../i18n/context';
import type { RegularTest, RegularTestAttempt } from '../../types';
import { calculateIeltsOverallBand } from '../../lib/ieltsScoring';
import {
  X,
  CheckCircle,
  Award,
  BookOpen,
  PenTool,
  Save,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface TeacherGradingModalProps {
  test: RegularTest;
  attempt: RegularTestAttempt;
  onClose: () => void;
}

export const TeacherGradingModal: React.FC<TeacherGradingModalProps> = ({ test, attempt, onClose }) => {
  const { gradeRegularTestAttempt } = useApp();
  const { t } = useI18n();

  const hasWriting = (test.sections || []).some((s) => s.skill === 'writing');
  const hasReading = (test.sections || []).some((s) => s.skill === 'reading');

  // Rubric state
  const existingRubrics = attempt.scores?.writing?.rubricScores || [];
  const getInitialScore = (crit: string) => {
    const found = existingRubrics.find((r) => r.criterion === crit);
    return found ? found.score : 6.0;
  };

  const [taskScore, setTaskScore] = useState<number>(getInitialScore('Task Response'));
  const [coherenceScore, setCoherenceScore] = useState<number>(getInitialScore('Coherence & Cohesion'));
  const [lexicalScore, setLexicalScore] = useState<number>(getInitialScore('Lexical Resource'));
  const [grammarScore, setGrammarScore] = useState<number>(getInitialScore('Grammatical Range & Accuracy'));

  const [strengths, setStrengths] = useState<string>(attempt.scores?.writing?.strengths || '');
  const [areasToImprove, setAreasToImprove] = useState<string>(attempt.scores?.writing?.areasToImprove || '');
  const [nextSteps, setNextSteps] = useState<string>(attempt.scores?.writing?.nextSteps || '');

  const [isReleased, setIsReleased] = useState<boolean>(attempt.isReleased || false);
  const [showErrorAnalysis, setShowErrorAnalysis] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Derived bands
  const calculatedWritingBand = calculateIeltsOverallBand([
    taskScore,
    coherenceScore,
    lexicalScore,
    grammarScore,
  ]);

  const readingBand = attempt.scores?.reading?.band;
  const overallBand = readingBand
    ? calculateIeltsOverallBand([readingBand, calculatedWritingBand])
    : calculatedWritingBand;

  const bandOptions = [4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0];

  const handleSaveGrading = async () => {
    try {
      setSaving(true);
      const writingScores = hasWriting
        ? {
            band: calculatedWritingBand,
            rubricScores: [
              { criterion: 'Task Response', score: taskScore, descriptor: 'Task Response' },
              { criterion: 'Coherence & Cohesion', score: coherenceScore, descriptor: 'Coherence & Cohesion' },
              { criterion: 'Lexical Resource', score: lexicalScore, descriptor: 'Lexical Resource' },
              { criterion: 'Grammatical Range & Accuracy', score: grammarScore, descriptor: 'Grammatical Range' },
            ],
            strengths: strengths.trim(),
            areasToImprove: areasToImprove.trim(),
            nextSteps: nextSteps.trim(),
          }
        : undefined;

      await gradeRegularTestAttempt(attempt.id, {
        writingScores,
        isReleased,
        gradingStatus: 'fully_graded',
      });

      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      alert(err.message || 'Failed to save grading');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <Award className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                {t('regularTests.gradingAndRelease')}
              </h2>
              <p className="text-xs text-slate-400">
                {attempt.studentName} • {test.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Score Summary Banner */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex items-center justify-around text-center">
            {hasReading && (
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Reading Band</div>
                <div className="text-2xl font-black text-blue-700 mt-1">
                  {attempt.scores?.reading?.band ?? '—'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {attempt.scores?.reading?.raw ?? 0} / {attempt.scores?.reading?.max ?? 0} correct
                </div>
              </div>
            )}

            {hasWriting && (
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Writing Band</div>
                <div className="text-2xl font-black text-indigo-700 mt-1">
                  {calculatedWritingBand}
                </div>
                <div className="text-[11px] text-slate-500">
                  {attempt.answers?.writing?.wordCount || 0} words
                </div>
              </div>
            )}

            <div>
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Overall Band</div>
              <div className="text-3xl font-black text-slate-900 mt-1">
                {overallBand}
              </div>
              <div className="text-[11px] text-slate-500">IELTS Official Rounding</div>
            </div>
          </div>

          {/* Reading Auto-Grade Review */}
          {hasReading && attempt.scores?.reading && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Reading: {attempt.scores.reading.raw} / {attempt.scores.reading.max} Correct (Band {attempt.scores.reading.band})
                  </h3>
                </div>
                <button
                  onClick={() => setShowErrorAnalysis(!showErrorAnalysis)}
                  className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:text-blue-800"
                >
                  {showErrorAnalysis ? 'Hide' : 'View'} Error Analysis
                  {showErrorAnalysis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {showErrorAnalysis && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 max-h-56 overflow-y-auto">
                  {attempt.scores.reading.errorAnalysis?.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg text-xs border ${
                        item.isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                      }`}
                    >
                      <div className="flex justify-between font-medium">
                        <span>Question {idx + 1}</span>
                        <span className={item.isCorrect ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                          {item.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                        </span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
                        <div>Student: <span className="font-semibold">{item.userAnswer || '(blank)'}</span></div>
                        <div>Correct: <span className="font-semibold text-emerald-800">{item.correctAnswer}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Writing Grading & Rubric */}
          {hasWriting && (
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-5">
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Writing Assessment (Official 4 Criteria)</h3>
              </div>

              {/* Student Essay Submission */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student Submission ({attempt.answers?.writing?.wordCount || 0} words)
                </label>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans leading-relaxed">
                  {attempt.answers?.writing?.text || '(No text submitted)'}
                </div>
              </div>

              {/* Rubric Selectors */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Task Achievement / Response
                  </label>
                  <select
                    value={taskScore}
                    onChange={(e) => setTaskScore(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 font-bold text-slate-900 bg-white"
                  >
                    {bandOptions.map((b) => (
                      <option key={b} value={b}>Band {b.toFixed(1)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Coherence & Cohesion
                  </label>
                  <select
                    value={coherenceScore}
                    onChange={(e) => setCoherenceScore(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 font-bold text-slate-900 bg-white"
                  >
                    {bandOptions.map((b) => (
                      <option key={b} value={b}>Band {b.toFixed(1)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Lexical Resource
                  </label>
                  <select
                    value={lexicalScore}
                    onChange={(e) => setLexicalScore(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 font-bold text-slate-900 bg-white"
                  >
                    {bandOptions.map((b) => (
                      <option key={b} value={b}>Band {b.toFixed(1)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Grammatical Range
                  </label>
                  <select
                    value={grammarScore}
                    onChange={(e) => setGrammarScore(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 font-bold text-slate-900 bg-white"
                  >
                    {bandOptions.map((b) => (
                      <option key={b} value={b}>Band {b.toFixed(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3 Feedback Categories */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1">
                    Điểm mạnh chính (Key Strengths)
                  </label>
                  <textarea
                    value={strengths}
                    onChange={(e) => setStrengths(e.target.value)}
                    rows={2}
                    placeholder="Nhận xét về những điểm làm tốt nhất trong bài thi..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-800 mb-1">
                    Các vấn đề cần khắc phục (Areas to Improve)
                  </label>
                  <textarea
                    value={areasToImprove}
                    onChange={(e) => setAreasToImprove(e.target.value)}
                    rows={2}
                    placeholder="Chỉ ra các lỗi ngữ pháp, dùng từ, hoặc cách triển khai ý..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-blue-800 mb-1">
                    Định hướng rèn luyện tiếp theo (Action Plan & Next Steps)
                  </label>
                  <textarea
                    value={nextSteps}
                    onChange={(e) => setNextSteps(e.target.value)}
                    rows={2}
                    placeholder="Gợi ý bài tập, chiến thuật làm bài cần áp dụng cho các bài tới..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Release Settings Checkbox */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800">Công bố kết quả cho học viên (Release to Student)</div>
              <div className="text-[11px] text-slate-500">
                Khi bật, học viên có thể xem điểm và nhận xét chi tiết trong danh mục "Đã công bố điểm".
              </div>
            </div>
            <input
              type="checkbox"
              checked={isReleased}
              onChange={(e) => setIsReleased(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {savedSuccess && <span className="text-emerald-600 font-semibold flex items-center gap-1"><Check className="w-4 h-4" /> Saved successfully</span>}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSaveGrading}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save & Publish Scores'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
