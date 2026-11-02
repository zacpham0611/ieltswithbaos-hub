import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../i18n/context';
import type { RegularTest, RegularTestAttempt } from '../../types';
import { calculateIeltsOverallBand } from '../../lib/ieltsScoring';
import { parseFormattedPrompt } from '../../lib/regularTestManager';
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
  Mic,
  Download,
  Volume2,
  ShieldAlert,
  Activity,
  FileText,
  AlertTriangle,
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
  const hasSpeaking = (test.sections || []).some((s) => s.skill === 'speaking');

  // Rubric state for Writing
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

  // Rubric state for Speaking
  const existingSpeakingRubrics = attempt.scores?.speaking?.rubricScores || [];
  const getInitialSpeakingScore = (crit: string) => {
    const found = existingSpeakingRubrics.find((r) => r.criterion === crit);
    return found ? found.score : 6.0;
  };

  const [fluencyScore, setFluencyScore] = useState<number>(getInitialSpeakingScore('Fluency & Coherence'));
  const [speakingLexicalScore, setSpeakingLexicalScore] = useState<number>(getInitialSpeakingScore('Lexical Resource'));
  const [speakingGrammarScore, setSpeakingGrammarScore] = useState<number>(getInitialSpeakingScore('Grammatical Range & Accuracy'));
  const [pronunciationScore, setPronunciationScore] = useState<number>(getInitialSpeakingScore('Pronunciation'));

  const [speakingStrengths, setSpeakingStrengths] = useState<string>(attempt.scores?.speaking?.strengths || '');
  const [speakingAreasToImprove, setSpeakingAreasToImprove] = useState<string>(attempt.scores?.speaking?.areasToImprove || '');
  const [speakingNextSteps, setSpeakingNextSteps] = useState<string>(attempt.scores?.speaking?.nextSteps || '');

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

  const calculatedSpeakingBand = calculateIeltsOverallBand([
    fluencyScore,
    speakingLexicalScore,
    speakingGrammarScore,
    pronunciationScore,
  ]);

  const readingBand = attempt.scores?.reading?.band;
  
  const evaluatedBands: number[] = [];
  if (hasReading && readingBand) evaluatedBands.push(readingBand);
  if (hasWriting) evaluatedBands.push(calculatedWritingBand);
  if (hasSpeaking) evaluatedBands.push(calculatedSpeakingBand);

  const overallBand = evaluatedBands.length > 0 ? calculateIeltsOverallBand(evaluatedBands) : 6.0;

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

      const speakingScores = hasSpeaking
        ? {
            band: calculatedSpeakingBand,
            rubricScores: [
              { criterion: 'Fluency & Coherence', score: fluencyScore, descriptor: 'Fluency & Coherence' },
              { criterion: 'Lexical Resource', score: speakingLexicalScore, descriptor: 'Lexical Resource' },
              { criterion: 'Grammatical Range & Accuracy', score: speakingGrammarScore, descriptor: 'Grammatical Range & Accuracy' },
              { criterion: 'Pronunciation', score: pronunciationScore, descriptor: 'Pronunciation' },
            ],
            strengths: speakingStrengths.trim(),
            areasToImprove: speakingAreasToImprove.trim(),
            nextSteps: speakingNextSteps.trim(),
          }
        : undefined;

      await gradeRegularTestAttempt(attempt.id, {
        writingScores,
        speakingScores,
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
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col w-screen h-screen overflow-hidden font-sans">
      <div className="bg-white flex flex-col w-full h-full overflow-hidden">
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

            {hasSpeaking && (
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Speaking Band</div>
                <div className="text-2xl font-black text-purple-700 mt-1">
                  {calculatedSpeakingBand}
                </div>
                <div className="text-[11px] text-slate-500">
                  Audio Recording
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

              {/* Student Essay Submission(s) */}
              {(() => {
                const writingSections = (test.sections || []).filter((s) => s.skill === 'writing');
                const task1Sec = writingSections.find((s) => s.writingTaskType === 'task1');
                const task2Sec = writingSections.find((s) => s.writingTaskType === 'task2');
                const hasTask1 = Boolean(task1Sec);
                const hasTask2 = Boolean(task2Sec);

                const task1Ans = attempt.answers?.writing?.task1?.text || (hasTask1 && !hasTask2 ? attempt.answers?.writing?.text : '');
                const task1Words = attempt.answers?.writing?.task1?.wordCount ?? (task1Ans ? task1Ans.trim().split(/\s+/).length : 0);

                const task2Ans = attempt.answers?.writing?.task2?.text || (hasTask2 && !hasTask1 ? attempt.answers?.writing?.text : (hasTask1 && hasTask2 ? attempt.answers?.writing?.task2?.text || '' : attempt.answers?.writing?.text || ''));
                const task2Words = attempt.answers?.writing?.task2?.wordCount ?? (task2Ans ? task2Ans.trim().split(/\s+/).length : 0);

                return (
                  <div className="space-y-4">
                    {hasTask1 && (
                      <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-800 uppercase tracking-wider">
                            Task 1 ({task1Words} words)
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">
                            Tối thiểu: {task1Sec?.writingMinWords || 150} từ
                          </span>
                        </div>
                        {task1Sec?.writingPrompt && (
                          <div className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Đề bài Task 1:</span>
                            <div className="whitespace-pre-wrap">
                              {parseFormattedPrompt(task1Sec.writingPrompt).map((s, idx) => {
                                if (s.bold) return <strong key={idx} className="font-bold text-slate-900">{s.text}</strong>;
                                if (s.italic) return <em key={idx} className="italic text-slate-800">{s.text}</em>;
                                return <span key={idx}>{s.text}</span>;
                              })}
                            </div>
                          </div>
                        )}
                        <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans leading-relaxed">
                          {task1Ans || '(Chưa có bài nộp cho Task 1)'}
                        </div>
                      </div>
                    )}

                    {(hasTask2 || !hasTask1) && (
                      <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-800 uppercase tracking-wider">
                            Task 2 ({task2Words} words)
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">
                            Tối thiểu: {task2Sec?.writingMinWords || 250} từ
                          </span>
                        </div>
                        {task2Sec?.writingPrompt && (
                          <div className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Đề bài Task 2:</span>
                            <div className="whitespace-pre-wrap">
                              {parseFormattedPrompt(task2Sec.writingPrompt).map((s, idx) => {
                                if (s.bold) return <strong key={idx} className="font-bold text-slate-900">{s.text}</strong>;
                                if (s.italic) return <em key={idx} className="italic text-slate-800">{s.text}</em>;
                                return <span key={idx}>{s.text}</span>;
                              })}
                            </div>
                          </div>
                        )}
                        <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans leading-relaxed">
                          {task2Ans || '(Chưa có bài nộp cho Task 2)'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

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

          {/* Speaking Grading & Rubric */}
          {hasSpeaking && (
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-slate-900">Speaking Assessment (Official 4 Criteria)</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                  Band {calculatedSpeakingBand.toFixed(1)}
                </span>
              </div>

              {/* Student Audio Recordings */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Bản ghi âm bài nói của học sinh (Student Recordings)
                </label>
                {attempt.answers?.speaking && Object.keys(attempt.answers.speaking).length > 0 ? (
                  Object.entries(attempt.answers.speaking).map(([secKey, spkData]: [string, any], idx) => (
                    <div key={secKey || idx} className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-purple-950 flex items-center gap-1.5">
                          <Volume2 className="w-4 h-4 text-purple-600" />
                          {spkData.part ? `Speaking ${spkData.part.toUpperCase()}` : `Phần ghi âm ${idx + 1}`}
                          {spkData.duration ? ` (${Math.round(spkData.duration)}s)` : ''}
                        </span>
                        {spkData.audioUrl && (
                          <a
                            href={spkData.audioUrl}
                            download={`speaking_attempt_${attempt.id}_part_${idx + 1}.webm`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-purple-300 hover:bg-purple-100 text-purple-800 rounded-lg text-[11px] font-bold shadow-2xs transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Tải về file ghi âm
                          </a>
                        )}
                      </div>
                      {spkData.audioUrl ? (
                        <audio controls src={spkData.audioUrl} className="w-full h-9 rounded-lg" />
                      ) : (
                        <p className="text-xs text-slate-500 italic">Không tìm thấy file ghi âm</p>
                      )}

                      {/* Question-level Audio Responses if recorded per question */}
                      {spkData.responses && Object.keys(spkData.responses).length > 0 && (
                        <div className="pt-2 border-t border-purple-200/80 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 block">
                            Chi tiết bản ghi âm từng câu hỏi:
                          </span>
                          <div className="space-y-1.5">
                            {Object.entries(spkData.responses).map(([qKey, qResp]: [string, any], qIdx) => (
                              <div
                                key={qKey || qIdx}
                                className="p-2 bg-white rounded-lg border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-start gap-1.5 flex-1">
                                  <span className="font-bold text-purple-800 shrink-0">Câu {qIdx + 1}:</span>
                                  <span className="text-slate-700 font-medium">
                                    {qResp.questionText || qKey}
                                  </span>
                                </div>
                                {qResp.audioUrl && (
                                  <audio controls src={qResp.audioUrl} className="h-7 w-48 shrink-0" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center text-xs text-slate-500 italic">
                    Chưa có bản ghi âm Speaking nào được nộp cho lượt làm bài này.
                  </div>
                )}
              </div>

              {/* Rubric Selectors */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Fluency & Coherence
                  </label>
                  <select
                    value={fluencyScore}
                    onChange={(e) => setFluencyScore(Number(e.target.value))}
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
                    value={speakingLexicalScore}
                    onChange={(e) => setSpeakingLexicalScore(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 font-bold text-slate-900 bg-white"
                  >
                    {bandOptions.map((b) => (
                      <option key={b} value={b}>Band {b.toFixed(1)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Grammatical Range & Accuracy
                  </label>
                  <select
                    value={speakingGrammarScore}
                    onChange={(e) => setSpeakingGrammarScore(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 font-bold text-slate-900 bg-white"
                  >
                    {bandOptions.map((b) => (
                      <option key={b} value={b}>Band {b.toFixed(1)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Pronunciation
                  </label>
                  <select
                    value={pronunciationScore}
                    onChange={(e) => setPronunciationScore(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 font-bold text-slate-900 bg-white"
                  >
                    {bandOptions.map((b) => (
                      <option key={b} value={b}>Band {b.toFixed(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3 Feedback Categories for Speaking */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1">
                    Điểm mạnh chính phần Speaking (Key Strengths)
                  </label>
                  <textarea
                    value={speakingStrengths}
                    onChange={(e) => setSpeakingStrengths(e.target.value)}
                    rows={2}
                    placeholder="Nhận xét về phát âm, độ lưu loát hoặc từ vựng dùng tốt..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-800 mb-1">
                    Các điểm cần cải thiện (Areas to Improve)
                  </label>
                  <textarea
                    value={speakingAreasToImprove}
                    onChange={(e) => setSpeakingAreasToImprove(e.target.value)}
                    rows={2}
                    placeholder="Chỉ ra ngập ngừng, phát âm chưa chuẩn, ngữ điệu hoặc lỗi ngữ pháp khi nói..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-purple-800 mb-1">
                    Định hướng rèn luyện tiếp theo (Action Plan & Next Steps)
                  </label>
                  <textarea
                    value={speakingNextSteps}
                    onChange={(e) => setSpeakingNextSteps(e.target.value)}
                    rows={2}
                    placeholder="Chiến thuật mở rộng câu trả lời, shadowing phát âm..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Exam Monitoring & Violations Timeline */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Nhật ký giám sát & Vi phạm (Exam Monitoring & Integrity History)
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Mức độ rủi ro:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                    attempt.riskLevel === 'high'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : attempt.riskLevel === 'medium'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  {attempt.riskLevel || 'low'}
                </span>
                <span className="text-slate-400">•</span>
                <span className="font-semibold text-slate-600">
                  {attempt.events?.length || attempt.eventCount || 0} sự kiện
                </span>
              </div>
            </div>

            {(!attempt.events || attempt.events.length === 0) ? (
              <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 border border-dashed border-slate-200">
                Không phát hiện vi phạm nào trong phiên thi (No security violations or abnormal events recorded).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Thời gian</th>
                      <th className="py-2 px-3">Loại sự kiện</th>
                      <th className="py-2 px-3">Mức độ</th>
                      <th className="py-2 px-3">Chi tiết & Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {attempt.events.map((evt, idx) => {
                      const timeStr = evt.serverTimestamp || evt.createdAt || '';
                      const dateObj = timeStr ? new Date(timeStr) : null;
                      const formattedTime = dateObj ? dateObj.toLocaleTimeString('vi-VN') : '—';
                      return (
                        <tr key={evt.id || idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {formattedTime}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-800">
                            {evt.eventType.replace(/_/g, ' ')}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                evt.severity === 'high'
                                  ? 'bg-rose-100 text-rose-800'
                                  : evt.severity === 'medium'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {evt.severity}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {evt.metadata ? (
                              <span className="font-mono text-[11px]">
                                {typeof evt.metadata === 'string'
                                  ? evt.metadata
                                  : Object.entries(evt.metadata)
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join(', ') || 'Đã ghi nhận'}
                              </span>
                            ) : (
                              'Đã ghi nhận sự kiện'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

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
