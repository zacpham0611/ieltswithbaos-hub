import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../i18n/context';
import type { RegularTest, RegularTestAttempt, RegularTestSection, ReadingQuestion } from '../../types';
import { calculateRemainingSeconds, parseFormattedPrompt } from '../../lib/regularTestManager';
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
  Mic,
  Lock,
  Volume2,
  Highlighter,
  Eraser,
} from 'lucide-react';
import { SpeakingAudioRecorder } from '../../components/SpeakingAudioRecorder';

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

  // Timing Mode
  const isPerSection = test.timingMode === 'per_section';

  // Synced Timer State (Overall Timer mode)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    const res = calculateRemainingSeconds({
      serverStartTime: attempt.serverStartTime,
      durationMinutes: test.durationMinutes,
      extraTimeMinutes: attempt.extraTimeMinutes,
      hardDeadline: test.hardDeadline,
    });
    return res.remainingSeconds;
  });

  // Individual Skill Timers (per_section mode)
  const [skillRemainingSeconds, setSkillRemainingSeconds] = useState<Record<string, number>>(() => {
    if (attempt.answers?._skillTimers && typeof attempt.answers._skillTimers === 'object') {
      return { ...attempt.answers._skillTimers };
    }
    const initial: Record<string, number> = {};
    const testSkills = test.skills && test.skills.length > 0 ? test.skills : ['reading'];
    testSkills.forEach((s) => {
      if (test.sectionTimers && test.sectionTimers[s]) {
        initial[s] = test.sectionTimers[s] * 60;
      } else {
        const sec = sections.find((x) => x.skill === s);
        initial[s] = (sec?.durationMinutes || (s === 'speaking' ? 15 : 60)) * 60;
      }
    });
    return initial;
  });

  const [lockedSkills, setLockedSkills] = useState<Record<string, boolean>>(() => {
    const initialLocked: Record<string, boolean> = {};
    if (attempt.answers?._lockedSkills && typeof attempt.answers._lockedSkills === 'object') {
      return { ...attempt.answers._lockedSkills };
    }
    if (attempt.answers?._skillTimers) {
      Object.entries(attempt.answers._skillTimers).forEach(([s, sec]) => {
        if ((sec as number) <= 0) initialLocked[s] = true;
      });
    }
    return initialLocked;
  });

  // Strict mode alerts
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(Boolean(document.fullscreenElement));
  const [largePasteWarning, setLargePasteWarning] = useState<boolean>(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Reading font size
  const [passageFontSize, setPassageFontSize] = useState<'normal' | 'large' | 'xl'>('normal');

  // Multi-Passage Reading Tabs & Marker state
  const [activeReadingPassageTab, setActiveReadingPassageTab] = useState<number>(0);
  const [selectedMarkerColor, setSelectedMarkerColor] = useState<string | null>(null);
  const [readingMarkers, setReadingMarkers] = useState<Record<number, Array<{ id: string; text: string; color: string }>>>({});

  const REGULAR_TEST_MARKER_COLORS = [
    { id: 'pastel_pink', label: 'Pastel Pink', bgHex: '#ffd1dc' },
    { id: 'pastel_orange', label: 'Pastel Orange', bgHex: '#ffe0b2' },
    { id: 'pastel_yellow', label: 'Pastel Yellow', bgHex: '#fff9c4' },
    { id: 'pastel_green', label: 'Pastel Green', bgHex: '#c8e6c9' },
    { id: 'pastel_blue', label: 'Pastel Blue', bgHex: '#bbdefb' },
    { id: 'pastel_purple', label: 'Pastel Purple', bgHex: '#e1bee7' },
  ];

  const handleApplyMarker = (text: string, color: string) => {
    if (!text || text.length < 2) return;
    setReadingMarkers((prev) => {
      const list = prev[activeReadingPassageTab] || [];
      if (list.some((m) => m.text === text && m.color === color)) return prev;
      return {
        ...prev,
        [activeReadingPassageTab]: [
          ...list,
          { id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, text, color },
        ],
      };
    });
  };

  const handleClearPassageMarkers = (passageIdx: number) => {
    setReadingMarkers((prev) => ({
      ...prev,
      [passageIdx]: [],
    }));
  };

  const handlePassageMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (text.length < 2) return;

    if (selectedMarkerColor) {
      handleApplyMarker(text, selectedMarkerColor);
    }
  };

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
    if (isPerSection) {
      const activeSkill = currentSection?.skill;
      if (!activeSkill || lockedSkills[activeSkill] || submitting) return;

      const timer = setInterval(() => {
        setSkillRemainingSeconds((prev) => {
          const currentRemaining = prev[activeSkill] ?? 0;
          if (currentRemaining <= 1) {
            const nextRemaining = { ...prev, [activeSkill]: 0 };
            const nextLocked = { ...lockedSkills, [activeSkill]: true };
            setLockedSkills(nextLocked);

            const testSkills = test.skills && test.skills.length > 0 ? test.skills : ['reading'];
            const allLocked = testSkills.every((s) => nextLocked[s] || (nextRemaining[s] ?? 0) <= 0);

            if (allLocked) {
              if (!submitting) {
                handleFinalSubmit(true);
              }
            } else {
              const nextSecIdx = sections.findIndex(
                (sec) => !nextLocked[sec.skill] && (nextRemaining[sec.skill] ?? 1) > 0
              );
              if (nextSecIdx !== -1) {
                alert(`Thời gian làm bài cho phần thi ${activeSkill.toUpperCase()} đã hết. Hệ thống chuyển sang phần thi tiếp theo.`);
                setCurrentSectionIndex(nextSecIdx);
              }
            }

            const updatedAnswers = {
              ...answersRef.current,
              _skillTimers: nextRemaining,
              _lockedSkills: nextLocked,
            };
            answersRef.current = updatedAnswers;
            setAnswers(updatedAnswers);
            triggerAutosave(updatedAnswers);

            return nextRemaining;
          }

          const nextRemaining = { ...prev, [activeSkill]: currentRemaining - 1 };

          if (currentRemaining % 10 === 0) {
            const updatedAnswers = {
              ...answersRef.current,
              _skillTimers: nextRemaining,
            };
            answersRef.current = updatedAnswers;
            triggerAutosave(updatedAnswers);
          }

          return nextRemaining;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
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
    }
  }, [
    isPerSection,
    currentSection?.skill,
    lockedSkills,
    submitting,
    sections,
    test.skills,
    attempt.serverStartTime,
    attempt.extraTimeMinutes,
    test.durationMinutes,
    test.hardDeadline,
    triggerAutosave,
  ]);

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
    if (isPerSection && lockedSkills[currentSection?.skill || '']) return;
    const updatedReading = {
      ...(answers.reading || {}),
      [questionId]: value,
    };
    const newAnswers = { ...answers, reading: updatedReading };
    setAnswers(newAnswers);
    triggerAutosave(newAnswers);
    lastActivityRef.current = Date.now();
  };

  // Writing Text Change Handler (scoped per Task 1 / Task 2)
  const currentWritingTaskKey = currentSection?.writingTaskType === 'task1' ? 'task1' : 'task2';

  const handleWritingTextChange = (text: string) => {
    if (isPerSection && lockedSkills[currentSection?.skill || '']) return;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const prevWriting = answers.writing || { text: '', wordCount: 0 };
    const otherTaskKey = currentWritingTaskKey === 'task1' ? 'task2' : 'task1';
    const otherTask = prevWriting[otherTaskKey];
    const otherWords = otherTask?.wordCount || 0;

    const newAnswers = {
      ...answers,
      writing: {
        ...prevWriting,
        [currentWritingTaskKey]: { text, wordCount: words },
        // Root text backwards compatibility: if task2, use task2, else task1
        text: currentWritingTaskKey === 'task2' || !prevWriting.task2 ? text : (prevWriting.task2?.text || text),
        wordCount: words + otherWords,
      },
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

  const handleSpeakingAudioReady = (secId: string, durationSec: number, audioUrl: string) => {
    const nextAnswers = {
      ...answers,
      speaking: {
        ...(answers.speaking || {}),
        [secId]: {
          audioUrl,
          duration: durationSec,
          submittedAt: new Date().toISOString(),
          isLocked: true,
          part: currentSection?.speakingPart,
        },
      },
    };
    setAnswers(nextAnswers);
    triggerAutosave(nextAnswers);
    lastActivityRef.current = Date.now();
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

  const readingPassagesList =
    currentSection?.passages && currentSection.passages.length > 0
      ? currentSection.passages
      : null;

  // Map each question to its passage index (0-based)
  const questionPassageIndexMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    if (!readingPassagesList || readingPassagesList.length <= 1) {
      allReadingQuestions.forEach((q) => {
        map[q.id] = 0;
      });
      return map;
    }
    readingPassagesList.forEach((p, pIdx) => {
      (p.questions || []).forEach((q: any) => {
        if (q?.id) map[q.id] = pIdx;
      });
    });
    const unmapped = allReadingQuestions.filter((q) => map[q.id] === undefined);
    if (unmapped.length > 0) {
      const perPassage = Math.ceil(allReadingQuestions.length / readingPassagesList.length);
      allReadingQuestions.forEach((q, idx) => {
        if (map[q.id] === undefined) {
          const pIdx = Math.min(Math.floor(idx / perPassage), readingPassagesList.length - 1);
          map[q.id] = pIdx;
        }
      });
    }
    return map;
  }, [readingPassagesList, allReadingQuestions]);

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
          {isPerSection ? (
            <div
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono font-bold tracking-wider ${
                (skillRemainingSeconds[currentSection?.skill || 'reading'] ?? 0) < 60
                  ? 'bg-rose-950 text-rose-300 border-rose-700 animate-pulse'
                  : (skillRemainingSeconds[currentSection?.skill || 'reading'] ?? 0) < 300
                  ? 'bg-amber-950 text-amber-300 border-amber-700'
                  : 'bg-slate-800 text-blue-300 border-slate-700'
              }`}
            >
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] text-blue-400 uppercase font-sans mr-0.5">
                {currentSection?.skill}:
              </span>
              <span>{formatTime(skillRemainingSeconds[currentSection?.skill || 'reading'] ?? 0)}</span>
            </div>
          ) : (
            <div
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono font-bold tracking-wider ${
                remainingSeconds < 60
                  ? 'bg-rose-950 text-rose-300 border-rose-700 animate-pulse'
                  : remainingSeconds < 300
                  ? 'bg-amber-950 text-amber-300 border-amber-700'
                  : 'bg-slate-800 text-blue-300 border-slate-700'
              }`}
            >
              <Clock className="w-4 h-4 text-blue-400" />
              <span>{formatTime(remainingSeconds)}</span>
            </div>
          )}

          <div className="text-[11px] text-slate-400 flex items-center gap-1 font-medium px-2">
            <Save className={`w-3.5 h-3.5 ${saveStatus === 'saving' ? 'text-amber-400 animate-spin' : 'text-emerald-400'}`} />
            <span>{saveStatus === 'saving' ? t('regularTests.autosaveSaving') : t('regularTests.autosaveSaved')}</span>
          </div>
        </div>

        {/* Right: Section Switcher & Finish Button */}
        <div className="flex items-center space-x-3">
          {sections.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg">
              {sections.map((sec, idx) => {
                const isSecLocked = isPerSection && Boolean(lockedSkills[sec.skill]);
                return (
                  <button
                    key={sec.id}
                    onClick={() => {
                      if (isPerSection) {
                        if (lockedSkills[sec.skill]) {
                          alert(`Phần thi ${sec.skill.toUpperCase()} đã hết thời gian làm bài và đã bị khóa.`);
                          return;
                        }
                        const updatedAnswers = {
                          ...answers,
                          _skillTimers: skillRemainingSeconds,
                        };
                        setAnswers(updatedAnswers);
                        triggerAutosave(updatedAnswers);
                      }
                      setCurrentSectionIndex(idx);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors flex items-center gap-1 ${
                      idx === currentSectionIndex
                        ? 'bg-blue-600 text-white shadow-xs'
                        : isSecLocked
                        ? 'text-slate-500 hover:text-slate-400 opacity-60'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {isSecLocked && <Lock className="w-3 h-3 text-rose-400" />}
                    <span>{sec.skill === 'reading' ? 'Reading' : sec.skill === 'writing' ? 'Writing' : 'Speaking'}</span>
                  </button>
                );
              })}
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

      {/* Per Section Lock Warning Banner */}
      {isPerSection && lockedSkills[currentSection?.skill || ''] && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-sm shrink-0">
          <Lock className="w-4 h-4" />
          <span>
            Phần thi {currentSection?.skill?.toUpperCase()} đã hết thời gian làm bài và đã bị khóa. Vui lòng chuyển sang phần thi khác hoặc bấm Kết thúc & Nộp bài.
          </span>
        </div>
      )}

      {/* Main Exam Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* READING SECTION CANVAS */}
        {currentSection?.skill === 'reading' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Reading Passage */}
            {(() => {
              const readingPassagesList =
                currentSection.passages && currentSection.passages.length > 0
                  ? currentSection.passages
                  : null;
              const activePassageContent = readingPassagesList
                ? readingPassagesList[activeReadingPassageTab]?.content || ''
                : currentSection.readingPassage || '';
              const wordCount = activePassageContent.split(/\s+/).filter(Boolean).length;
              const currentMarkers = readingMarkers[activeReadingPassageTab] || [];

              return (
                <div
                  className="w-1/2 border-r border-slate-300 bg-white flex flex-col overflow-hidden"
                  onCopy={(e) => {
                    if (test.strictSettings?.blockCopyReading || test.strictPreset === 'strict') {
                      e.preventDefault();
                    }
                  }}
                >
                  {/* Passage Controls & Pastel Marker Toolbar */}
                  <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 shrink-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold uppercase tracking-wider text-[11px] text-slate-800">
                        {readingPassagesList && readingPassagesList.length > 1
                          ? readingPassagesList[activeReadingPassageTab]?.title || `Passage ${activeReadingPassageTab + 1}`
                          : 'Reading Passage'}
                      </span>

                      {/* Marker Toolbar */}
                      <div className="flex items-center space-x-1 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-600 mr-0.5 flex items-center space-x-1">
                          <Highlighter className="w-3 h-3 text-blue-600" />
                          <span className="hidden sm:inline">Marker:</span>
                        </span>
                        {REGULAR_TEST_MARKER_COLORS.map((col) => {
                          const isActive = selectedMarkerColor === col.id;
                          return (
                            <button
                              key={col.id}
                              type="button"
                              onClick={() => setSelectedMarkerColor(isActive ? null : col.id)}
                              style={{ backgroundColor: col.bgHex }}
                              className={`w-4 h-4 rounded-full border transition-all ${
                                isActive
                                  ? 'ring-2 ring-blue-600 ring-offset-1 scale-110 border-slate-700 shadow-xs'
                                  : 'border-slate-300 hover:scale-105 opacity-85 hover:opacity-100'
                              }`}
                              title={`${col.label}${isActive ? ' (Click to deactivate marker)' : ' (Click to activate marker)'}`}
                            />
                          );
                        })}
                        {currentMarkers.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleClearPassageMarkers(activeReadingPassageTab)}
                            className="ml-1 px-1 py-0.5 text-slate-500 hover:text-red-600 rounded text-[10px] flex items-center space-x-0.5"
                            title="Clear highlights in this passage"
                          >
                            <Eraser className="w-3 h-3" />
                            <span className="hidden sm:inline font-semibold">Clear</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
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
                      <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                        {wordCount} words
                      </span>
                    </div>
                  </div>

                  {/* Multi-Passage Sticky Tab Bar */}
                  {readingPassagesList && readingPassagesList.length > 1 && (
                    <div className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0 shadow-2xs">
                      {readingPassagesList.map((p, pIdx) => (
                        <button
                          key={p.id || pIdx}
                          type="button"
                          onClick={() => setActiveReadingPassageTab(pIdx)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 shrink-0 ${
                            activeReadingPassageTab === pIdx
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          <span>{p.title || `Passage ${pIdx + 1}`}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Passage Content */}
                  <div
                    onMouseUp={handlePassageMouseUp}
                    className={`flex-1 p-6 md:p-8 overflow-y-auto leading-[1.85] select-text font-serif text-slate-900 ${
                      passageFontSize === 'xl' ? 'text-xl md:text-[21px]' : passageFontSize === 'large' ? 'text-lg md:text-[19px]' : 'text-base md:text-[17px]'
                    }`}
                  >
                    <div className="max-w-prose mx-auto whitespace-pre-wrap">
                      {activePassageContent || 'No reading passage content provided.'}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Right: Questions Pane */}
            <div className="w-1/2 bg-slate-50 flex flex-col overflow-hidden">
              {/* Question Navigator Header */}
              <div className="bg-white border-b border-slate-200 px-5 py-3 shrink-0 shadow-2xs space-y-2.5 z-10">
                <div className="flex items-center justify-between">
                  <span className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Question Navigator ({answeredReadingCount} / {allReadingQuestions.length} Answered)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-mono font-semibold">
                      {Math.round((answeredReadingCount / (allReadingQuestions.length || 1)) * 100)}% Complete
                    </span>
                    {flaggedCount > 0 && (
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        {flaggedCount} flagged
                      </span>
                    )}
                  </div>
                </div>

                {/* Navigator Rows */}
                {readingPassagesList && readingPassagesList.length > 1 ? (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {readingPassagesList.map((p, pIdx) => {
                      const pQuestions = allReadingQuestions.filter(
                        (q) => (questionPassageIndexMap[q.id] ?? 0) === pIdx
                      );
                      const pAnsCount = pQuestions.filter((q) => answers.reading?.[q.id]?.trim()).length;
                      return (
                        <div key={p.id || pIdx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-blue-900 truncate max-w-[280px]">
                              {p.title || `Passage ${pIdx + 1}`} ({pAnsCount}/{pQuestions.length})
                            </span>
                            {activeReadingPassageTab !== pIdx && (
                              <button
                                type="button"
                                onClick={() => setActiveReadingPassageTab(pIdx)}
                                className="text-blue-600 hover:text-blue-800 font-semibold text-[11px] underline"
                              >
                                Go to passage
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {pQuestions.map((q) => {
                              const globalIdx = allReadingQuestions.findIndex((item) => item.id === q.id);
                              const qNum = globalIdx >= 0 ? globalIdx + 1 : 1;
                              const isAns = Boolean(answers.reading?.[q.id]?.trim());
                              const isFlag = Boolean(flaggedQuestions[q.id]);
                              return (
                                <button
                                  key={q.id}
                                  type="button"
                                  onClick={() => {
                                    if (activeReadingPassageTab !== pIdx) {
                                      setActiveReadingPassageTab(pIdx);
                                    }
                                    setTimeout(() => {
                                      const el = document.getElementById(`q_${q.id}`);
                                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }, 60);
                                  }}
                                  className={`w-7 h-7 md:w-8 md:h-8 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center transition-all ${
                                    isFlag
                                      ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-500'
                                      : isAns
                                      ? 'bg-blue-600 text-white shadow-xs'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  }`}
                                  title={`Question ${qNum}${isFlag ? ' (Flagged)' : isAns ? ' (Answered)' : ' (Unanswered)'}`}
                                >
                                  {qNum}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5 max-h-28 overflow-y-auto py-1">
                    {allReadingQuestions.map((q, idx) => {
                      const qNum = idx + 1;
                      const isAns = Boolean(answers.reading?.[q.id]?.trim());
                      const isFlag = Boolean(flaggedQuestions[q.id]);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(`q_${q.id}`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className={`w-7 h-7 md:w-8 md:h-8 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center transition-all ${
                            isFlag
                              ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-500'
                              : isAns
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                          title={`Question ${qNum}${isFlag ? ' (Flagged)' : isAns ? ' (Answered)' : ' (Unanswered)'}`}
                        >
                          {qNum}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Scrollable Questions Body */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {(readingPassagesList && readingPassagesList.length > 1
                  ? allReadingQuestions.filter((q) => (questionPassageIndexMap[q.id] ?? 0) === activeReadingPassageTab)
                  : allReadingQuestions
                ).map((q) => {
                  const globalIdx = allReadingQuestions.findIndex((item) => item.id === q.id);
                  const qNum = globalIdx >= 0 ? globalIdx + 1 : 1;
                  const isFlagged = Boolean(flaggedQuestions[q.id]);
                  const studentAns = answers.reading?.[q.id] || '';

                  return (
                    <div
                      key={q.id}
                      id={`q_${q.id}`}
                      className={`p-5 bg-white rounded-2xl border transition-all ${
                        isFlagged
                          ? 'border-amber-400 ring-2 ring-amber-100 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 font-bold text-sm flex items-center justify-center shrink-0">
                            {qNum}
                          </span>
                          <span className="text-sm md:text-base font-semibold text-slate-900 leading-snug">
                            {q.prompt || (q as any).question || (q as any).questionText}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleFlagQuestion(q.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isFlagged ? 'text-amber-600 bg-amber-50' : 'text-slate-300 hover:text-slate-500'
                          }`}
                          title="Flag for review"
                        >
                          <Flag className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Matching Information Question Layout */}
                      {(q.type === 'matching_information' ||
                        q.type === 'matching_features' ||
                        q.type === 'matching_sentence_endings') && (
                        <div className="mt-3 pl-2 sm:pl-8 space-y-3">
                          {q.type === 'matching_information' && (
                            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-xs md:text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                              <span className="font-semibold">Which paragraph contains this information?</span>
                              <span className="font-mono text-[11px] text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md font-bold">
                                NB: Letters may be used more than once
                              </span>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {(q.options && q.options.length > 0
                              ? q.options.map((opt) => opt.replace(/^Paragraph\s+/i, '').trim())
                              : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
                            ).map((letter) => (
                              <button
                                key={letter}
                                type="button"
                                onClick={() => handleReadingAnswerChange(q.id, letter)}
                                className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold border transition-all ${
                                  studentAns === letter
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                }`}
                              >
                                Paragraph {letter}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Multiple Choice Question Layout */}
                      {q.type === 'multiple_choice' && q.options && (
                        <div className="space-y-2 mt-3 pl-2 sm:pl-8">
                          {q.options.map((opt, oIdx) => (
                            <label
                              key={oIdx}
                              className={`flex items-center gap-3 p-3 rounded-xl border text-xs md:text-sm cursor-pointer transition-all ${
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

                      {/* Multiple Select Question Layout */}
                      {q.type === 'multiple_select' && q.options && (
                        <div className="space-y-2 mt-3 pl-2 sm:pl-8">
                          {q.options.map((opt, oIdx) => {
                            const selectedArr: string[] = studentAns
                              ? studentAns.split(',').map((s: string) => s.trim())
                              : [];
                            const isChecked = selectedArr.includes(opt);
                            return (
                              <label
                                key={oIdx}
                                className={`flex items-center gap-3 p-3 rounded-xl border text-xs md:text-sm cursor-pointer transition-all ${
                                  isChecked
                                    ? 'bg-blue-50 border-blue-400 text-blue-900 font-medium'
                                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const next = isChecked
                                      ? selectedArr.filter((s: string) => s !== opt)
                                      : [...selectedArr, opt];
                                    handleReadingAnswerChange(q.id, next.sort().join(', '));
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {/* True/False/Not Given & Yes/No/Not Given */}
                      {(q.type === 'true_false_not_given' || q.type === 'yes_no_not_given') && (
                        <div className="flex items-center gap-2.5 mt-3 pl-2 sm:pl-8">
                          {(q.type === 'true_false_not_given'
                            ? ['TRUE', 'FALSE', 'NOT GIVEN']
                            : ['YES', 'NO', 'NOT GIVEN']
                          ).map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleReadingAnswerChange(q.id, val)}
                              className={`px-3.5 py-2 rounded-xl border text-xs md:text-sm font-bold transition-all ${
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

                      {/* Completion Answer Fields */}
                      {(q.type === 'sentence_completion' ||
                        q.type === 'summary_completion' ||
                        q.type === 'note_completion' ||
                        q.type === 'table_completion' ||
                        q.type === 'flowchart_completion' ||
                        q.type === 'fill_in_the_blank' ||
                        q.type === 'short_answer') && (
                        <div className="mt-3 pl-2 sm:pl-8 flex flex-wrap items-center gap-3">
                          <span className="text-xs md:text-sm font-bold text-slate-700">Answer:</span>
                          <input
                            type="text"
                            value={studentAns}
                            onChange={(e) => handleReadingAnswerChange(q.id, e.target.value)}
                            placeholder="Type answer here..."
                            className="px-3.5 py-2 text-xs md:text-sm rounded-xl border border-slate-300 w-full sm:w-72 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium bg-white text-slate-900 shadow-2xs"
                          />
                        </div>
                      )}

                      {/* Matching Headings */}
                      {q.type === 'matching_headings' && q.options && (
                        <div className="mt-3 pl-2 sm:pl-8">
                          <select
                            value={studentAns}
                            onChange={(e) => handleReadingAnswerChange(q.id, e.target.value)}
                            className="w-full max-w-sm px-3.5 py-2 text-xs md:text-sm rounded-xl border border-slate-300 bg-white font-medium"
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

              <div className="text-sm md:text-base text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                {currentSection.writingPrompt ? (
                  parseFormattedPrompt(currentSection.writingPrompt).map((s, idx) => {
                    if (s.bold) return <strong key={idx} className="font-bold text-slate-900">{s.text}</strong>;
                    if (s.italic) return <em key={idx} className="italic text-slate-800">{s.text}</em>;
                    return <span key={idx}>{s.text}</span>;
                  })
                ) : (
                  'No writing prompt specified.'
                )}
              </div>
            </div>

            {/* Right: Writing Area with Word Count & Spellcheck Off */}
            {(() => {
              const currentTaskText =
                answers.writing?.[currentWritingTaskKey]?.text ??
                (currentWritingTaskKey === 'task1' && !answers.writing?.task2
                  ? answers.writing?.text || ''
                  : currentWritingTaskKey === 'task2' && !answers.writing?.task1
                  ? answers.writing?.text || ''
                  : '');
              const currentTaskWordCount = currentTaskText.trim() ? currentTaskText.trim().split(/\s+/).length : 0;
              const minWords = currentSection.writingMinWords || (currentWritingTaskKey === 'task1' ? 150 : 250);

              return (
                <div className="w-1/2 bg-slate-50 flex flex-col overflow-hidden">
                  <div className="h-10 bg-slate-100 border-b border-slate-200 px-4 flex items-center justify-between text-xs text-slate-600 shrink-0">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                      Your Response ({currentWritingTaskKey.toUpperCase()})
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">
                        Word count: <span className="text-indigo-600 font-bold">{currentTaskWordCount}</span>
                      </span>
                      {currentTaskWordCount >= minWords ? (
                        <span className="text-[10px] text-emerald-600 font-bold">✓ Target reached</span>
                      ) : (
                        <span className="text-[10px] text-amber-600 font-bold">
                          {minWords - currentTaskWordCount} words left
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 p-5 flex flex-col">
                    <textarea
                      value={currentTaskText}
                      onChange={(e) => handleWritingTextChange(e.target.value)}
                      onPaste={handleWritingPaste}
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="off"
                      placeholder="Type your response here..."
                      className="flex-1 w-full p-4 text-sm md:text-base font-sans text-slate-900 bg-white rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed shadow-2xs"
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* SPEAKING SECTION CANVAS */}
        {currentSection?.skill === 'speaking' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Speaking Task / Questions / Cue Card */}
            <div className="w-1/2 border-r border-slate-300 bg-white p-6 overflow-y-auto space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" />
                  {currentSection.speakingPart
                    ? `IELTS Speaking ${currentSection.speakingPart.toUpperCase()}`
                    : 'IELTS Speaking Section'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Chỉ ghi âm 1 lần duy nhất
                </span>
              </div>

              {/* Strict Notice Banner */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Quy chế kiểm tra định kỳ:</span> Mỗi thí sinh chỉ được phép ghi âm <strong>một lần duy nhất</strong>. Sau khi hoàn thành ghi âm, bản ghi âm sẽ được lưu tự động lên hệ thống và khóa lại. Không thể ghi âm lại hoặc thay đổi file.
                </div>
              </div>

              {/* Part 1 Content */}
              {currentSection.speakingPart === 'part1' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-purple-900">
                    Part 1: Topic-based Interview
                  </h4>
                  {currentSection.speakingTopics && currentSection.speakingTopics.length > 0 ? (
                    <div className="space-y-3">
                      {currentSection.speakingTopics
                        .slice(0, currentSection.speakingTopicCount || currentSection.speakingTopics.length)
                        .map((tp, tIdx) => (
                          <div key={tp.id || tIdx} className="p-4 bg-purple-50/50 rounded-xl border border-purple-200 space-y-2">
                            <span className="font-bold text-purple-950 text-sm">
                              Chủ đề {tIdx + 1}: {tp.topic || (tp as any).title}
                            </span>
                            <ul className="space-y-2 list-disc list-inside text-sm text-slate-800 pl-1 leading-relaxed">
                              {tp.questions?.map((q, qIdx) => (
                                <li key={qIdx} className="leading-snug">
                                  {q}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {currentSection.instructions || 'Answer the examiner questions clearly and fluently.'}
                    </div>
                  )}
                </div>
              )}

              {/* Part 2 Content */}
              {currentSection.speakingPart === 'part2' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-purple-900">
                    Part 2: Individual Long Turn (Cue Card)
                  </h4>
                  <div className="p-5 bg-purple-50/60 rounded-xl border-2 border-purple-200 space-y-3">
                    <div className="text-xs font-bold text-purple-950 uppercase tracking-wide">
                      Candidate Task Card
                    </div>
                    <div className="text-base font-black text-slate-900">
                      {currentSection.speakingCueCard?.topic || currentSection.speakingTopic || currentSection.title}
                    </div>
                    <div className="text-sm text-slate-700 font-semibold">You should say:</div>
                    <ul className="space-y-2 text-sm text-slate-800 list-disc list-inside pl-2 leading-relaxed">
                      {(
                        currentSection.speakingCueCard?.points ||
                        currentSection.speakingPoints || [
                          'What it is',
                          'When and where it took place',
                          'Who was involved',
                          'And explain why it was memorable or important to you',
                        ]
                      ).map((point, pIdx) => (
                        <li key={pIdx}>{point}</li>
                      ))}
                    </ul>
                    <div className="pt-2 border-t border-purple-200/80 flex items-center justify-between text-xs text-purple-800 font-semibold">
                      <span>⏱ Chuẩn bị: 1 phút</span>
                      <span>⏱ Thời gian nói: 1 - 2 phút</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Part 3 Content */}
              {currentSection.speakingPart === 'part3' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-purple-900">
                    Part 3: Two-way Discussion
                  </h4>
                  {currentSection.speakingQuestions && currentSection.speakingQuestions.length > 0 ? (
                    <div className="space-y-2.5">
                      {currentSection.speakingQuestions.map((q, qIdx) => (
                        <div key={qIdx} className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-start gap-3 text-sm">
                          <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {qIdx + 1}
                          </span>
                          <span className="text-slate-800 leading-snug font-medium">{q}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {currentSection.instructions || 'Discuss the topic questions in depth with full justification.'}
                    </div>
                  )}
                </div>
              )}

              {/* General / Combined Speaking */}
              {(!currentSection.speakingPart || currentSection.speakingPart === 'combined' || currentSection.speakingPart === 'full') && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900">
                    Speaking Prompt & Instructions
                  </h4>
                  <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {currentSection.instructions || currentSection.title}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Audio Recorder with Single Recording Lock */}
            <div className="w-1/2 bg-slate-50 flex flex-col overflow-hidden">
              <div className="h-10 bg-slate-100 border-b border-slate-200 px-4 flex items-center justify-between text-xs text-slate-600 shrink-0">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-purple-600" />
                  Recording Workspace
                </span>
                <div>
                  {answers.speaking?.[currentSection.id]?.audioUrl ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Đã nộp bản ghi âm
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      Chưa ghi âm
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 p-6 flex flex-col justify-center max-w-xl mx-auto w-full">
                <SpeakingAudioRecorder
                  questionId={currentSection.id}
                  initialAudioUrl={answers.speaking?.[currentSection.id]?.audioUrl}
                  isLocked={Boolean(answers.speaking?.[currentSection.id]?.isLocked || answers.speaking?.[currentSection.id]?.audioUrl)}
                  allowReRecord={false}
                  maxSeconds={currentSection.durationMinutes ? currentSection.durationMinutes * 60 : 180}
                  label={`Bản ghi âm chính thức - ${currentSection.title}`}
                  onAudioReady={(blob, dur, url) => handleSpeakingAudioReady(currentSection.id, dur, url)}
                />

                {answers.speaking?.[currentSection.id]?.audioUrl && (
                  <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Bài nói của bạn đã được ghi âm thành công và khóa theo quy định kiểm tra định kỳ.</span>
                  </div>
                )}
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
              {answers.speaking && Object.keys(answers.speaking).length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Speaking Recordings</span>
                  <span className="font-bold text-purple-700">{Object.keys(answers.speaking).length} recordings</span>
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
