import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../i18n/context';
import type { RegularTest, RegularTestAttempt, RegularTestSection, ReadingQuestion } from '../../types';
import { calculateRemainingSeconds } from '../../lib/regularTestManager';
import {
  Clock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Flag,
  Send,
  Maximize2,
  Minimize2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Save,
  PenTool,
  BookOpen,
} from 'lucide-react';

interface RegularTestExamViewProps {
  test: RegularTest;
  attempt: RegularTestAttempt;
  onExit: () => void;
}

export const RegularTestExamView: React.FC<RegularTestExamViewProps> = ({
  test,
  attempt,
  onExit,
}) => {
  const {
    saveRegularTestAnswers,
    submitRegularTestAttempt,
    logRegularTestEvents,
  } = useApp();
  const { t } = useI18n();

  // Desktop screen check
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sections = test.sections || [];
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(attempt.currentSectionIndex || 0);
  const currentSection: RegularTestSection | undefined = sections[currentSectionIndex];

  // Answers state
  const [answers, setAnswers] = useState<Record<string, any>>(attempt.answers || { reading: {}, writing: { text: '', wordCount: 0 } });
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>(attempt.flaggedQuestions || {});
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [saveRevisionSeq, setSaveRevisionSeq] = useState<number>(attempt.saveRevisionSequence || 0);

  // Synced Timer State
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    const res = calculateRemainingSeconds({
      serverStartTime: attempt.serverStartTime,
      durationMinutes: test.durationMinutes,
      extraTimeMinutes: attempt.extraTimeMinutes,
      hardDeadline: test.hardDeadline,
    });
    return res.remainingSeconds;
  });

  // Strict mode alerts
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(Boolean(document.fullscreenElement));
  const [largePasteWarning, setLargePasteWarning] = useState<boolean>(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Reading font size
  const [passageFontSize, setPassageFontSize] = useState<'normal' | 'large' | 'xl'>('normal');

  // Anti-cheating tracking refs
  const blurStartRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Debounced Autosave
  const autosaveTimerRef = useRef<any>(null);
  const triggerAutosave = useCallback(
    (newAnswers: Record<string, any>, newFlags?: Record<string, boolean>) => {
      setSaveStatus('saving');
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

      autosaveTimerRef.current = setTimeout(async () => {
        try {
          const nextSeq = saveRevisionSeq + 1;
          setSaveRevisionSeq(nextSeq);
          await saveRegularTestAnswers(
            attempt.id,
            attempt.sessionToken,
            newAnswers,
            newFlags || flaggedQuestions,
            nextSeq
          );
          setSaveStatus('saved');
        } catch (err) {
          console.warn('Autosave warning:', err);
        }
      }, 1000);
    },
    [attempt.id, attempt.sessionToken, flaggedQuestions, saveRegularTestAnswers, saveRevisionSeq]
  );

  // Server Countdown Timer Tick
  useEffect(() => {
    const timer = setInterval(() => {
      const res = calculateRemainingSeconds({
        serverStartTime: attempt.serverStartTime,
        durationMinutes: test.durationMinutes,
        extraTimeMinutes: attempt.extraTimeMinutes,
        hardDeadline: test.hardDeadline,
      });

      setRemainingSeconds(res.remainingSeconds);

      // Auto-submit when time expires
      if (res.isExpired && !submitting) {
        clearInterval(timer);
        handleFinalSubmit(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [attempt.serverStartTime, attempt.extraTimeMinutes, test.durationMinutes, test.hardDeadline, submitting]);

  // Anti-cheating: Fullscreen & Tab Switch Tracking
  useEffect(() => {
    if (test.strictPreset === 'off') return;

    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);

      if (!active && (test.strictSettings?.fullscreenRequired || test.strictPreset === 'strict')) {
        setShowFullscreenOverlay(true);
        logRegularTestEvents(attempt.id, [
          {
            attemptId: attempt.id,
            testId: test.id,
            studentId: attempt.studentId,
            eventType: 'fullscreen_exit',
            category: 'indicator',
            severity: 'medium',
            serverTimestamp: new Date().toISOString(),
            durationSeconds: 0,
            metadata: { section: currentSectionIndex },
            reviewStatus: 'unreviewed',
          },
        ]);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        blurStartRef.current = Date.now();
      } else if (blurStartRef.current) {
        const awaySec = Math.round((Date.now() - blurStartRef.current) / 1000);
        blurStartRef.current = null;

        if (awaySec >= 3) {
          logRegularTestEvents(attempt.id, [
            {
              attemptId: attempt.id,
              testId: test.id,
              studentId: attempt.studentId,
              eventType: 'tab_switch',
              category: 'indicator',
              severity: awaySec > 15 ? 'high' : 'medium',
              serverTimestamp: new Date().toISOString(),
              durationSeconds: awaySec,
              metadata: { awaySeconds: awaySec, section: currentSectionIndex },
              reviewStatus: 'unreviewed',
            },
          ]);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [test.strictPreset, test.strictSettings, attempt.id, test.id, attempt.studentId, currentSectionIndex, logRegularTestEvents]);

  // Request fullscreen entry helper
  const enterFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    setShowFullscreenOverlay(false);
  };

  // Format countdown mm:ss
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Reading Answer Change Handler
  const handleReadingAnswerChange = (questionId: string, value: string) => {
    const updatedReading = {
      ...(answers.reading || {}),
      [questionId]: value,
    };
    const newAnswers = { ...answers, reading: updatedReading };
    setAnswers(newAnswers);
    triggerAutosave(newAnswers);
    lastActivityRef.current = Date.now();
  };

  // Writing Text Change Handler
  const handleWritingTextChange = (text: string) => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const newAnswers = {
      ...answers,
      writing: { text, wordCount: words },
    };
    setAnswers(newAnswers);
    triggerAutosave(newAnswers);
    lastActivityRef.current = Date.now();
  };

  // Large Paste Detector
  const handleWritingPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text') || '';
    if (pastedText.length > 80 && (test.strictPreset === 'strict' || test.strictPreset === 'standard')) {
      setLargePasteWarning(true);
      setTimeout(() => setLargePasteWarning(false), 5000);

      logRegularTestEvents(attempt.id, [
        {
          attemptId: attempt.id,
          testId: test.id,
          studentId: attempt.studentId,
          eventType: 'large_paste',
          category: 'indicator',
          severity: 'medium',
          serverTimestamp: new Date().toISOString(),
          durationSeconds: 0,
          metadata: { pasteLength: pastedText.length, sample: pastedText.substring(0, 40) },
          reviewStatus: 'unreviewed',
        },
      ]);
    }
  };

  // Toggle Flag Question
  const toggleFlagQuestion = (qId: string) => {
    const nextFlags = {
      ...flaggedQuestions,
      [qId]: !flaggedQuestions[qId],
    };
    setFlaggedQuestions(nextFlags);
    triggerAutosave(answers, nextFlags);
  };

  // Final Submit Handler
  const handleFinalSubmit = async (isAuto: boolean = false) => {
    try {
      setSubmitting(true);
      await submitRegularTestAttempt(attempt.id, answers, isAuto);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      onExit();
    } catch (err: any) {
      alert(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Question counts for summary
  const allReadingQuestions = currentSection?.skill === 'reading' ? currentSection.readingQuestions || [] : [];
  const answeredReadingCount = allReadingQuestions.filter((q) => answers.reading?.[q.id]?.trim()).length;
  const flaggedCount = Object.values(flaggedQuestions).filter(Boolean).length;

  // BLOCK NON-DESKTOP DEVICES (< 1280px)
  if (windowWidth < 1280) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-5">
          <Monitor className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold tracking-tight mb-2">
          {t('regularTests.desktopRequired')}
        </h2>
        <p className="text-xs text-slate-300 max-w-md leading-relaxed mb-6">
          {t('regularTests.desktopNotice')}
        </p>
        <div className="text-[11px] text-slate-500 font-mono bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
          Current width: {windowWidth}px (Minimum required: 1280px)
        </div>
        <button
          onClick={onExit}
          className="mt-6 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col select-none overflow-hidden font-sans">
      {/* Exam Header */}
      <header className="h-14 bg-slate-900 text-white px-6 flex items-center justify-between border-b border-slate-800 shrink-0">
        {/* Left: Test Title & Section */}
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold">
            {currentSectionIndex + 1}
          </div>
          <div>
            <h1 className="text-xs font-bold text-white tracking-wide truncate max-w-md">
              {test.title}
            </h1>
            <p className="text-[10px] text-slate-400">
              Section {currentSectionIndex + 1} of {sections.length}: {currentSection?.title}
            </p>
          </div>
        </div>

        {/* Center: Synced Timer */}
        <div className="flex items-center space-x-2">
          <div
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono font-bold tracking-wider ${
              remainingSeconds < 60
                ? 'bg-rose-950 text-rose-300 border-rose-700 animate-pulse'
                : remainingSeconds < 300
                ? 'bg-amber-950 text-amber-300 border-amber-700'
                : 'bg-slate-800 text-blue-300 border-slate-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{formatTime(remainingSeconds)}</span>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1 font-medium px-2">
            <Save className={`w-3.5 h-3.5 ${saveStatus === 'saving' ? 'text-amber-400 animate-spin' : 'text-emerald-400'}`} />
            <span>{saveStatus === 'saving' ? t('regularTests.autosaveSaving') : t('regularTests.autosaveSaved')}</span>
          </div>
        </div>

        {/* Right: Section Switcher & Finish Button */}
        <div className="flex items-center space-x-3">
          {sections.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg">
              {sections.map((sec, idx) => (
                <button
                  key={sec.id}
                  onClick={() => {
                    if (test.timingMode === 'per_section' && idx !== currentSectionIndex) {
                      alert('Sequential section lock is active. You cannot return to or skip sections.');
                      return;
                    }
                    setCurrentSectionIndex(idx);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                    idx === currentSectionIndex
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sec.skill === 'reading' ? 'Reading' : 'Writing'}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            {t('regularTests.finishAndSubmit')}
          </button>
        </div>
      </header>

      {/* Large Paste Warning Toast */}
      {largePasteWarning && (
        <div className="bg-amber-500 text-slate-900 px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 animate-fade-in shadow-md">
          <AlertTriangle className="w-4 h-4" />
          {t('regularTests.writingLargePasteWarning')}
        </div>
      )}

      {/* Main Exam Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* READING SECTION CANVAS */}
        {currentSection?.skill === 'reading' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Reading Passage */}
            <div
              className="w-1/2 border-r border-slate-300 bg-white flex flex-col overflow-hidden"
              onCopy={(e) => {
                if (test.strictSettings?.blockCopyReading || test.strictPreset === 'strict') {
                  e.preventDefault();
                }
              }}
            >
              {/* Passage Controls */}
              <div className="h-10 bg-slate-100 border-b border-slate-200 px-4 flex items-center justify-between text-xs text-slate-600 shrink-0">
                <span className="font-bold uppercase tracking-wider text-[11px]">Reading Passage</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 mr-1">Text size:</span>
                  <button
                    onClick={() => setPassageFontSize('normal')}
                    className={`px-2 py-0.5 rounded text-[11px] ${passageFontSize === 'normal' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-200'}`}
                  >
                    A
                  </button>
                  <button
                    onClick={() => setPassageFontSize('large')}
                    className={`px-2 py-0.5 rounded text-[12px] font-semibold ${passageFontSize === 'large' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-200'}`}
                  >
                    A+
                  </button>
                  <button
                    onClick={() => setPassageFontSize('xl')}
                    className={`px-2 py-0.5 rounded text-[13px] font-bold ${passageFontSize === 'xl' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-200'}`}
                  >
                    A++
                  </button>
                </div>
              </div>

              {/* Passage Content */}
              <div
                className={`flex-1 p-6 overflow-y-auto leading-relaxed select-text font-serif text-slate-800 ${
                  passageFontSize === 'xl' ? 'text-base' : passageFontSize === 'large' ? 'text-sm' : 'text-xs'
                }`}
              >
                <div className="max-w-prose mx-auto whitespace-pre-wrap">
                  {currentSection.readingPassage || 'No reading passage content provided.'}
                </div>
              </div>
            </div>

            {/* Right: Questions Pane */}
            <div className="w-1/2 bg-slate-50 flex flex-col overflow-hidden">
              <div className="h-10 bg-slate-100 border-b border-slate-200 px-4 flex items-center justify-between text-xs text-slate-600 shrink-0">
                <span className="font-bold uppercase tracking-wider text-[11px]">
                  Questions ({answeredReadingCount}/{allReadingQuestions.length} answered)
                </span>
                <span className="text-[11px] text-slate-400">
                  {flaggedCount > 0 && <span className="text-amber-600 font-semibold">{flaggedCount} flagged</span>}
                </span>
              </div>

              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {allReadingQuestions.map((q, idx) => {
                  const qNum = idx + 1;
                  const isFlagged = Boolean(flaggedQuestions[q.id]);
                  const studentAns = answers.reading?.[q.id] || '';

                  return (
                    <div
                      key={q.id}
                      className={`p-4 bg-white rounded-xl border transition-all ${
                        isFlagged
                          ? 'border-amber-400 ring-2 ring-amber-100 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
                            {qNum}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 leading-snug">
                            {q.prompt || (q as any).question || (q as any).questionText}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleFlagQuestion(q.id)}
                          className={`p-1 rounded-md transition-colors ${
                            isFlagged ? 'text-amber-600 bg-amber-50' : 'text-slate-300 hover:text-slate-500'
                          }`}
                          title="Flag for review"
                        >
                          <Flag className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Question Answer Inputs */}
                      {q.type === 'multiple_choice' && q.options && (
                        <div className="space-y-1.5 mt-3 pl-8">
                          {q.options.map((opt, oIdx) => (
                            <label
                              key={oIdx}
                              className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                studentAns === opt
                                  ? 'bg-blue-50 border-blue-400 text-blue-900 font-medium'
                                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q_${q.id}`}
                                value={opt}
                                checked={studentAns === opt}
                                onChange={(e) => handleReadingAnswerChange(q.id, e.target.value)}
                                className="w-4 h-4 text-blue-600"
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {(q.type === 'true_false_not_given' || q.type === 'yes_no_not_given') && (
                        <div className="flex items-center gap-2 mt-3 pl-8">
                          {(q.type === 'true_false_not_given'
                            ? ['TRUE', 'FALSE', 'NOT GIVEN']
                            : ['YES', 'NO', 'NOT GIVEN']
                          ).map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleReadingAnswerChange(q.id, val)}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                                studentAns === val
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Single-row Completion Answer Fields */}
                      {(q.type === 'sentence_completion' ||
                        q.type === 'summary_completion' ||
                        q.type === 'note_completion' ||
                        q.type === 'table_completion' ||
                        q.type === 'flowchart_completion' ||
                        q.type === 'fill_in_the_blank' ||
                        q.type === 'short_answer') && (
                        <div className="mt-3 pl-8 flex items-center gap-3">
                          <span className="text-xs font-semibold text-slate-500">Answer:</span>
                          <input
                            type="text"
                            value={studentAns}
                            onChange={(e) => handleReadingAnswerChange(q.id, e.target.value)}
                            placeholder="Type answer here..."
                            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 w-64 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                          />
                        </div>
                      )}

                      {q.type === 'matching_headings' && q.options && (
                        <div className="mt-3 pl-8">
                          <select
                            value={studentAns}
                            onChange={(e) => handleReadingAnswerChange(q.id, e.target.value)}
                            className="w-full max-w-sm px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                          >
                            <option value="">-- Select Heading --</option>
                            {q.options.map((opt, oIdx) => (
                              <option key={oIdx} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* WRITING SECTION CANVAS */}
        {currentSection?.skill === 'writing' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Prompt & Image */}
            <div className="w-1/2 border-r border-slate-300 bg-white p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-800 uppercase tracking-wider">
                  {currentSection.writingTaskType === 'task1' ? 'Task 1 (Academic/GT)' : 'Task 2 (Essay)'}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Minimum: {currentSection.writingMinWords || 250} words
                </span>
              </div>

              {currentSection.task1ImageUrl && (
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <img
                    src={currentSection.task1ImageUrl}
                    alt="Task graphic"
                    className="w-full object-contain max-h-72 bg-slate-50"
                  />
                </div>
              )}

              <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                {currentSection.writingPrompt || 'No writing prompt specified.'}
              </div>
            </div>

            {/* Right: Writing Area with Word Count & Spellcheck Off */}
            <div className="w-1/2 bg-slate-50 flex flex-col overflow-hidden">
              <div className="h-10 bg-slate-100 border-b border-slate-200 px-4 flex items-center justify-between text-xs text-slate-600 shrink-0">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                  Your Response
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">
                    Word count: <span className="text-indigo-600">{answers.writing?.wordCount || 0}</span>
                  </span>
                  {answers.writing?.wordCount >= (currentSection.writingMinWords || 250) ? (
                    <span className="text-[10px] text-emerald-600 font-bold">✓ Target reached</span>
                  ) : (
                    <span className="text-[10px] text-amber-600 font-bold">
                      {(currentSection.writingMinWords || 250) - (answers.writing?.wordCount || 0)} words left
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 p-5 flex flex-col">
                <textarea
                  value={answers.writing?.text || ''}
                  onChange={(e) => handleWritingTextChange(e.target.value)}
                  onPaste={handleWritingPaste}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  placeholder="Type your response here..."
                  className="flex-1 w-full p-4 text-xs font-sans text-slate-900 bg-white rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed shadow-2xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Overlay Blocker */}
      {showFullscreenOverlay && (
        <div className="fixed inset-0 z-70 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">
            {t('regularTests.fullscreenWarning')}
          </h2>
          <p className="text-xs text-slate-300 max-w-md mb-6 leading-relaxed">
            Strict exam monitoring requires fullscreen mode. Exiting fullscreen is recorded in the proctoring log.
          </p>
          <button
            onClick={enterFullscreen}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
          >
            {t('regularTests.reenterFullscreen')}
          </button>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-80 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 w-full max-w-md animate-scale-in space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {t('regularTests.submitConfirmTitle')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('regularTests.submitConfirmMessage')}
                </p>
              </div>
            </div>

            {/* Answer Summary */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              {currentSection?.skill === 'reading' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('regularTests.answeredCount')}</span>
                    <span className="font-bold text-emerald-700">{answeredReadingCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('regularTests.unansweredCount')}</span>
                    <span className="font-bold text-rose-700">{allReadingQuestions.length - answeredReadingCount}</span>
                  </div>
                </>
              )}
              {flaggedCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('regularTests.flaggedCount')}</span>
                  <span className="font-bold text-amber-700">{flaggedCount}</span>
                </div>
              )}
              {answers.writing?.text && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Writing Word Count</span>
                  <span className="font-bold text-indigo-700">{answers.writing.wordCount} words</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleFinalSubmit(false)}
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Yes, Submit Exam'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
