import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../i18n/context';
import type { RegularTest, RegularTestAttempt } from '../../types';
import { categorizeStudentTests } from '../../lib/regularTestManager';
import { RegularTestExamView } from './RegularTestExamView';
import {
  ShieldCheck,
  Clock,
  Calendar,
  Lock,
  Play,
  Award,
  AlertTriangle,
  Monitor,
  CheckCircle,
  Eye,
  X,
  BookOpen,
  PenTool,
} from 'lucide-react';

export const StudentRegularTestsView: React.FC = () => {
  const {
    currentUser,
    regularTests,
    regularTestAttempts,
    activeExamAttempt,
    setActiveExamAttempt,
    startRegularTestAttempt,
  } = useApp();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<'available' | 'upcoming' | 'in_progress' | 'submitted' | 'results_released'>('available');

  // Pre-exam modal
  const [selectedTestForStart, setSelectedTestForStart] = useState<RegularTest | null>(null);
  const [accessCodeInput, setAccessCodeInput] = useState<string>('');
  const [consentChecked, setConsentChecked] = useState<boolean>(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState<boolean>(false);

  // Results view modal
  const [viewingResultAttempt, setViewingResultAttempt] = useState<{ test: RegularTest; attempt: RegularTestAttempt } | null>(null);

  if (!currentUser) return null;

  const categorized = categorizeStudentTests(regularTests, regularTestAttempts, currentUser.id);

  // If active attempt is in progress, render exam view full screen
  if (activeExamAttempt) {
    const test = regularTests.find((t) => t.id === activeExamAttempt.testId);
    if (test) {
      return (
        <RegularTestExamView
          test={test}
          attempt={activeExamAttempt}
          onExit={() => setActiveExamAttempt(null)}
        />
      );
    }
  }

  const handleStartExam = async () => {
    if (!selectedTestForStart) return;
    if (window.innerWidth < 1280) {
      setStartError('Regular Tests require a desktop or laptop device (screen width >= 1280px).');
      return;
    }
    if (selectedTestForStart.accessCodeEnabled && !accessCodeInput.trim()) {
      setStartError('Please enter the access code provided by your teacher.');
      return;
    }
    if (!consentChecked) {
      setStartError('Please acknowledge and agree to the exam rules.');
      return;
    }

    try {
      setStarting(true);
      setStartError(null);
      await startRegularTestAttempt(selectedTestForStart.id, accessCodeInput.trim(), {
        userAgent: navigator.userAgent,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
      });

      // Request fullscreen if supported
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }

      setSelectedTestForStart(null);
    } catch (err: any) {
      setStartError(err.message || 'Failed to start exam');
    } finally {
      setStarting(false);
    }
  };

  const getTabCount = (tab: typeof activeTab) => {
    switch (tab) {
      case 'available': return categorized.available.length;
      case 'upcoming': return categorized.upcoming.length;
      case 'in_progress': return categorized.inProgress.length;
      case 'submitted': return categorized.submitted.length;
      case 'results_released': return categorized.resultsReleased.length;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          {t('regularTests.studentPortal')}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Formal periodic examinations with timed sections and strict exam mode
        </p>
      </div>

      {/* 5 Tab Navigation */}
      <div className="flex border-b border-slate-200 space-x-1 overflow-x-auto text-xs">
        {[
          { id: 'available', label: t('regularTests.tabs.available') },
          { id: 'upcoming', label: t('regularTests.tabs.upcoming') },
          { id: 'in_progress', label: t('regularTests.tabs.inProgress') },
          { id: 'submitted', label: t('regularTests.tabs.submitted') },
          { id: 'results_released', label: t('regularTests.tabs.resultsReleased') },
        ].map((tab) => {
          const count = getTabCount(tab.id as any);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Cards */}
      <div className="space-y-4">
        {activeTab === 'available' && (
          categorized.available.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-xs">
              No tests currently available to take.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {categorized.available.map(({ test, attempt }) => (
                <div
                  key={test.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between space-y-4 hover:border-blue-400 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                        Available Now
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {test.durationMinutes} mins
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900">{test.title}</h3>
                    <p className="text-xs text-blue-600 font-medium">{test.courseName}</p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {test.skills.map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                          {s}
                        </span>
                      ))}
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                        {test.timingMode === 'per_section' ? 'Sequential Locking' : 'Overall Timer'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedTestForStart(test);
                      setAccessCodeInput('');
                      setConsentChecked(false);
                      setStartError(null);
                    }}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {t('regularTests.startExam')}
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'in_progress' && (
          categorized.inProgress.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-xs">
              No tests in progress.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {categorized.inProgress.map(({ test, attempt }) => (
                <div
                  key={test.id}
                  className="bg-white rounded-2xl border-2 border-blue-500 shadow-md p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase animate-pulse">
                      In Progress
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{test.title}</h3>
                    <p className="text-xs text-slate-500">
                      Started: {new Date(attempt.serverStartTime).toLocaleTimeString()}
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveExamAttempt(attempt)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {t('regularTests.continueExam')}
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'upcoming' && (
          categorized.upcoming.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-xs">
              No upcoming tests scheduled.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {categorized.upcoming.map(({ test }) => (
                <div key={test.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 opacity-80">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                    Upcoming
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">{test.title}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Starts: {test.availabilityStart ? new Date(test.availabilityStart).toLocaleString() : 'TBD'}
                  </p>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'submitted' && (
          categorized.submitted.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-xs">
              No tests pending grading.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {categorized.submitted.map(({ test, attempt }) => (
                <div key={attempt.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                      Submitted
                    </span>
                    <span className="text-[11px] text-slate-400">{attempt.submittedAt}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{test.title}</h3>
                  <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    Your answers have been submitted securely. Teacher review and grading in progress.
                  </p>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'results_released' && (
          categorized.resultsReleased.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-xs">
              No test results released yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {categorized.resultsReleased.map(({ test, attempt }) => (
                <div key={attempt.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                      Results Released
                    </span>
                    <div className="text-base font-black text-blue-600">
                      Band {attempt.scores?.overall ?? attempt.scores?.reading?.band ?? '—'}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{test.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{test.courseName}</p>
                  </div>

                  <button
                    onClick={() => setViewingResultAttempt({ test, attempt })}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Award className="w-4 h-4 text-blue-600" />
                    {t('regularTests.viewResults')}
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Pre-Exam Verification & Rules Modal */}
      {selectedTestForStart && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 animate-scale-in space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{t('regularTests.preExamTitle')}</h3>
                  <p className="text-xs text-slate-500">{selectedTestForStart.title}</p>
                </div>
              </div>
              <button onClick={() => setSelectedTestForStart(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {startError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                {startError}
              </div>
            )}

            {/* Device & Rules Notice */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <Monitor className="w-4 h-4 text-blue-600" />
                <span>Desktop Requirements & Anti-Cheating Policy</span>
              </div>
              <ul className="list-disc pl-5 text-slate-600 space-y-1 text-[11px] leading-relaxed">
                <li>Exam-taking requires a desktop screen of at least 1280px.</li>
                <li>Fullscreen mode is activated upon start. Do not switch tabs or exit fullscreen.</li>
                <li>All answers are automatically saved every few seconds.</li>
                <li>The exam timer is server-synchronized and cannot be paused.</li>
              </ul>
            </div>

            {/* Access Code Input if enabled */}
            {selectedTestForStart.accessCodeEnabled && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('regularTests.enterAccessCode')} *
                </label>
                <input
                  type="text"
                  value={accessCodeInput}
                  onChange={(e) => setAccessCodeInput(e.target.value)}
                  placeholder={t('regularTests.accessCodePlaceholder')}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 uppercase tracking-widest font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            )}

            {/* Consent Checkbox */}
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 pt-1">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded-sm mt-0.5"
              />
              <span className="font-medium leading-snug">
                {t('regularTests.consentAcknowledge')}
              </span>
            </label>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedTestForStart(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleStartExam}
                disabled={starting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50"
              >
                {starting ? 'Starting...' : t('regularTests.startExam')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results View Modal */}
      {viewingResultAttempt && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Exam Results: {viewingResultAttempt.test.title}</h3>
                <p className="text-xs text-slate-400">Submitted: {viewingResultAttempt.attempt.submittedAt}</p>
              </div>
              <button onClick={() => setViewingResultAttempt(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* Score Badges */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex items-center justify-around text-center">
                {viewingResultAttempt.attempt.scores?.reading && (
                  <div>
                    <div className="text-slate-500 font-semibold uppercase text-[10px]">Reading Band</div>
                    <div className="text-2xl font-black text-blue-700 mt-1">
                      {viewingResultAttempt.attempt.scores.reading.band}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {viewingResultAttempt.attempt.scores.reading.raw} / {viewingResultAttempt.attempt.scores.reading.max} correct
                    </div>
                  </div>
                )}
                {viewingResultAttempt.attempt.scores?.writing && (
                  <div>
                    <div className="text-slate-500 font-semibold uppercase text-[10px]">Writing Band</div>
                    <div className="text-2xl font-black text-indigo-700 mt-1">
                      {viewingResultAttempt.attempt.scores.writing.band}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-slate-500 font-semibold uppercase text-[10px]">Overall Band</div>
                  <div className="text-3xl font-black text-slate-900 mt-1">
                    {viewingResultAttempt.attempt.scores?.overall ?? viewingResultAttempt.attempt.scores?.reading?.band ?? '—'}
                  </div>
                </div>
              </div>

              {/* Writing Criteria Breakdown */}
              {viewingResultAttempt.attempt.scores?.writing?.rubricScores && (
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <h4 className="font-bold text-slate-800">Writing Criteria Breakdown</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {viewingResultAttempt.attempt.scores.writing.rubricScores.map((r, i) => (
                      <div key={i} className="p-2 bg-slate-50 rounded-lg flex justify-between">
                        <span className="text-slate-600">{r.criterion}:</span>
                        <span className="font-bold text-indigo-700">Band {r.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Qualitative Feedback */}
              {viewingResultAttempt.attempt.scores?.writing?.strengths && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-emerald-800">Điểm mạnh chính (Key Strengths)</h4>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {viewingResultAttempt.attempt.scores.writing.strengths}
                  </p>
                </div>
              )}
              {viewingResultAttempt.attempt.scores?.writing?.areasToImprove && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-amber-800">Các vấn đề cần khắc phục (Areas to Improve)</h4>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {viewingResultAttempt.attempt.scores.writing.areasToImprove}
                  </p>
                </div>
              )}
              {viewingResultAttempt.attempt.scores?.writing?.nextSteps && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                  <h4 className="font-bold text-blue-800">Định hướng rèn luyện tiếp theo (Next Steps)</h4>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {viewingResultAttempt.attempt.scores.writing.nextSteps}
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-white border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewingResultAttempt(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
