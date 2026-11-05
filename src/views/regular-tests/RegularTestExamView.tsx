import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../i18n/context';
import type { RegularTest, RegularTestAttempt, RegularTestSection, ReadingQuestion, ListeningQuestionGroup } from '../../types';
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
  Headphones,
  Lock,
  Volume2,
  Highlighter,
  Eraser,
} from 'lucide-react';
import { SpeakingSectionWorkspace } from './SpeakingSectionWorkspace';
import { ExamListeningAudioPlayer } from '../../components/listening/ExamListeningAudioPlayer';
import { renderCleanMarkdown } from '../../utils/textFormatter';
import { ListeningQuestionRenderer } from '../../components/listening/ListeningQuestionRenderer';
import { WritingTask1VisualRenderer, stripMarkdownTableFromPrompt } from '../../components/writing/WritingTask1VisualRenderer';

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

  const handleSpeakingAudioReady = (
    secId: string,
    durationSec: number,
    audioUrl: string,
    responses?: Record<string, any>
  ) => {
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
          responses: responses || (answers.speaking?.[secId]?.responses || {}),
        },
      },
    };
    setAnswers(nextAnswers);
    triggerAutosave(nextAnswers);
    lastActivityRef.current = Date.now();
  };

  // Sequential progression & completion helpers
  const isWritingTask1Completed = Boolean(
    (answers.writing?.task1?.text && answers.writing.task1.text.trim().length > 0) ||
    !sections.some((s) => s.skill === 'writing' && s.writingTaskType === 'task1')
  );

  const isSectionCompleted = (secIdx: number): boolean => {
    if (secIdx < 0 || secIdx >= sections.length) return false;
    const sec = sections[secIdx];
    if (sec.skill === 'listening') {
      const answered = Object.values(answers.listening || {}).filter((v: any) => v && String(v).trim()).length;
      return answered > 0;
    }
    if (sec.skill === 'reading') {
      const answered = (sec.readingQuestions || []).filter((q) => answers.reading?.[q.id]?.trim()).length;
      return answered > 0;
    }
    if (sec.skill === 'writing') {
      const taskKey = sec.writingTaskType === 'task1' ? 'task1' : 'task2';
      const text =
        answers.writing?.[taskKey]?.text ||
        (taskKey === 'task1' && !answers.writing?.task2 ? answers.writing?.text : '') ||
        '';
      return text.trim().length > 0;
    }
    if (sec.skill === 'speaking') {
      const spkData = answers.speaking?.[sec.id];
      return Boolean(spkData?.audioUrl || spkData?.isLocked);
    }
    return false;
  };

  const isSectionAccessible = (targetIdx: number): boolean => {
    if (targetIdx <= 0) return true;
    for (let i = 0; i < targetIdx; i++) {
      if (!isSectionCompleted(i)) return false;
    }
    return true;
  };

  const getSectionLabel = (sec: RegularTestSection, idx: number) => {
    if (sec.skill === 'listening') return 'Listening';
    if (sec.skill === 'reading') return 'Reading';
    if (sec.skill === 'writing') {
      return sec.writingTaskType === 'task1' ? 'Task 1' : sec.writingTaskType === 'task2' ? 'Task 2' : 'Writing';
    }
    if (sec.skill === 'speaking') {
      if (sec.speakingPart === 'part1') return 'Part 1';
      if (sec.speakingPart === 'part2') return 'Part 2';
      if (sec.speakingPart === 'part3') return 'Part 3';
      return `Speaking P${idx + 1}`;
    }
    return sec.title || `Section ${idx + 1}`;
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

  // Listening state and handlers
  const [activeListeningPartTab, setActiveListeningPartTab] = useState<number>(0);
  const allListeningQuestions = (() => {
    if (currentSection?.skill !== 'listening') return [];
    if (currentSection.listeningQuestions && currentSection.listeningQuestions.length > 0) {
      return currentSection.listeningQuestions;
    }
    const fromParts = (currentSection.listeningParts || []).flatMap((p) => {
      if (p.questions && p.questions.length > 0) return p.questions;
      if (p.questionGroups && p.questionGroups.length > 0) return p.questionGroups.flatMap((g) => g.questions || []);
      return [];
    });
    if (fromParts.length > 0) return fromParts;
    const fromGroups = (currentSection.listeningQuestionGroups || currentSection.questionGroups || []).flatMap(
      (g: any) => g.questions || []
    );
    return fromGroups;
  })();
  const answeredListeningCount = allListeningQuestions.filter((q) => answers.listening?.[q.id]?.trim()).length;

  const handleListeningAnswerChange = (qId: string, val: string) => {
    const nextListening = { ...(answers.listening || {}), [qId]: val };
    const nextAnswers = { ...answers, listening: nextListening };
    setAnswers(nextAnswers);
    triggerAutosave(nextAnswers, flaggedQuestions);
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
                const isSecAccessible = isSectionAccessible(idx);
                const isSecDone = isSectionCompleted(idx);
                const isTimeLocked = isPerSection && Boolean(lockedSkills[sec.skill]);
                const isLocked = isTimeLocked || !isSecAccessible;

                return (
                  <button
                    key={sec.id}
                    onClick={() => {
                      if (!isSecAccessible) {
                        alert('Vui lòng hoàn thành các phần thi trước đó theo đúng trình tự (Please complete previous sections sequentially).');
                        return;
                      }
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
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors flex items-center gap-1.5 ${
                      idx === currentSectionIndex
                        ? 'bg-blue-600 text-white shadow-xs'
                        : isLocked
                        ? 'text-slate-500 hover:text-slate-400 opacity-60 cursor-not-allowed'
                        : isSecDone
                        ? 'text-emerald-400 hover:text-emerald-300'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title={
                      !isSecAccessible
                        ? 'Chưa mở khóa: Cần hoàn thành các phần trước đó'
                        : isTimeLocked
                        ? 'Đã hết giờ làm bài'
                        : isSecDone
                        ? 'Đã hoàn thành'
                        : 'Chưa làm'
                    }
                  >
                    {isLocked ? (
                      <Lock className="w-3 h-3 text-slate-400" />
                    ) : isSecDone ? (
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                    ) : null}
                    <span>{getSectionLabel(sec, idx)}</span>
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
        {/* LISTENING SECTION CANVAS */}
        {currentSection?.skill === 'listening' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
            {/* Dedicated Exam Listening Audio Player */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 shrink-0">
              <div className="max-w-5xl mx-auto">
                <ExamListeningAudioPlayer
                  attemptId={attempt.id}
                  sectionId={currentSection.id}
                  audioUrl={currentSection.audioUrl || currentSection.listeningAudioUrl}
                  parts={currentSection.listeningParts || []}
                  activePartIndex={activeListeningPartTab}
                  onPartChange={(idx) => setActiveListeningPartTab(idx)}
                />
              </div>
            </div>

            {/* Split: Question Navigator + Questions Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left / Main Question Area */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
                <div className="max-w-4xl mx-auto space-y-6">
                  {(() => {
                    const isSectionLocked = (isPerSection && lockedSkills[currentSection?.skill || '']) || submitting;
                    const parts = currentSection.listeningParts || [];
                    const activePart = parts[activeListeningPartTab];

                    let groupsToRender: ListeningQuestionGroup[] = [];
                    if (activePart?.questionGroups && activePart.questionGroups.length > 0) {
                      groupsToRender = activePart.questionGroups;
                    } else if (activePart?.questions && activePart.questions.length > 0) {
                      // If activePart has its own scoped questions (typically 10), DO NOT slice by tab index!
                      const scopedQuestions =
                        activePart.questions.length > 20
                          ? activePart.questions.slice(activeListeningPartTab * 10, (activeListeningPartTab + 1) * 10)
                          : activePart.questions;

                      groupsToRender = [
                        {
                          id: `listen_group_${activeListeningPartTab}`,
                          type: 'note_completion' as any,
                          title: activePart.title || `Part ${activeListeningPartTab + 1} Questions`,
                          instructions: activePart.instructions || 'Answer the questions as you listen.',
                          wordLimit: 'NO MORE THAN TWO WORDS AND/OR A NUMBER',
                          questions: scopedQuestions,
                        },
                      ];
                    } else {
                      // Check section-level question groups
                      const secGroups: ListeningQuestionGroup[] =
                        currentSection.listeningQuestionGroups?.length
                          ? currentSection.listeningQuestionGroups
                          : currentSection.questionGroups?.length
                          ? (currentSection.questionGroups as any)
                          : [];

                      if (secGroups.length > 0) {
                        // Try to filter groups matching this part
                        const matchedGroups = secGroups.filter((g: any) => {
                          if (g.partNumber === activeListeningPartTab + 1 || g.partIndex === activeListeningPartTab) {
                            return true;
                          }
                          // Match by question number range (e.g. 1-10 for part 1, 11-20 for part 2)
                          const minPartQ = activeListeningPartTab * 10 + 1;
                          const maxPartQ = (activeListeningPartTab + 1) * 10;
                          const gFirstQ = g.questions?.[0]?.questionNumber || g.questions?.[0]?.number;
                          if (typeof gFirstQ === 'number' && gFirstQ >= minPartQ && gFirstQ <= maxPartQ) {
                            return true;
                          }
                          return false;
                        });

                        if (matchedGroups.length > 0) {
                          groupsToRender = matchedGroups;
                        } else if (secGroups.length === 4 && secGroups[activeListeningPartTab]) {
                          groupsToRender = [secGroups[activeListeningPartTab]];
                        } else {
                          groupsToRender = secGroups;
                        }
                      }
                    }

                    // Ultimate fallback to sliced section questions
                    if (groupsToRender.length === 0) {
                      const questionsPool =
                        currentSection.listeningQuestions?.length
                          ? currentSection.listeningQuestions
                          : allListeningQuestions;
                      const sliced = questionsPool.slice(activeListeningPartTab * 10, (activeListeningPartTab + 1) * 10);
                      groupsToRender = [
                        {
                          id: `listen_group_${activeListeningPartTab}`,
                          type: 'note_completion' as any,
                          title: `Part ${activeListeningPartTab + 1} Questions`,
                          instructions: 'Answer the questions as you listen.',
                          wordLimit: 'NO MORE THAN TWO WORDS AND/OR A NUMBER',
                          questions: sliced.length > 0 ? sliced : questionsPool,
                        },
                      ];
                    }

                    return groupsToRender.map((group) => (
                      <ListeningQuestionRenderer
                        key={group.id}
                        questionGroup={group}
                        answers={answers.listening || {}}
                        onAnswerChange={handleListeningAnswerChange}
                        flaggedQuestionIds={
                          new Set(
                            Object.entries(flaggedQuestions)
                              .filter(([_, isFlagged]) => isFlagged)
                              .map(([qId]) => qId)
                          )
                        }
                        onToggleFlag={toggleFlagQuestion}
                        isReadOnly={isSectionLocked}
                      />
                    ));
                  })()}
                </div>
              </div>

              {/* Right Side: Question Navigator for Listening */}
              <div className="w-80 border-l border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden">
                <div className="p-3.5 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Question Navigator
                    </span>
                    <span className="text-xs font-mono font-bold text-blue-700">
                      {answeredListeningCount}/{allListeningQuestions.length || 40}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Click number to jump • Flag to review
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                  {(currentSection.listeningParts && currentSection.listeningParts.length > 0
                    ? currentSection.listeningParts
                    : [1, 2, 3, 4].map((pNum) => ({
                        partNumber: pNum,
                        title: `Part ${pNum}`,
                        questions: allListeningQuestions.slice((pNum - 1) * 10, pNum * 10),
                      }))
                  ).map((part: any, pIdx) => {
                    const pQuestions: any[] = (part.questions && part.questions.length > 0)
                      ? part.questions
                      : (part.questionGroups && part.questionGroups.length > 0)
                      ? part.questionGroups.flatMap((g: any) => g.questions || [])
                      : allListeningQuestions.slice(pIdx * 10, (pIdx + 1) * 10);
                    const pAnsCount = pQuestions.filter((q: any) => answers.listening?.[q.id]?.trim()).length;
                    const isActive = activeListeningPartTab === pIdx;

                    return (
                      <div key={pIdx} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setActiveListeningPartTab(pIdx)}
                            className={`text-xs font-bold text-left transition ${
                              isActive ? 'text-blue-600' : 'text-slate-700 hover:text-blue-600'
                            }`}
                          >
                            Part {pIdx + 1} ({pAnsCount}/{pQuestions.length})
                          </button>
                          {isActive && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-5 gap-1.5">
                          {pQuestions.map((q: any, qIndexInPart: number) => {
                            const globalNum = (part as any).partNumber
                              ? ((part as any).partNumber - 1) * 10 + qIndexInPart + 1
                              : pIdx * 10 + qIndexInPart + 1;
                            const isAns = Boolean(answers.listening?.[q.id]?.trim());
                            const isFlag = Boolean(flaggedQuestions[q.id]);

                            return (
                              <button
                                key={q.id}
                                type="button"
                                onClick={() => {
                                  if (activeListeningPartTab !== pIdx) {
                                    setActiveListeningPartTab(pIdx);
                                  }
                                }}
                                className={`h-8 rounded-lg text-xs font-bold transition flex flex-col items-center justify-center relative ${
                                  isFlag
                                    ? 'bg-amber-100 text-amber-900 border border-amber-400'
                                    : isAns
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                }`}
                              >
                                <span>{q.questionNumber || globalNum}</span>
                                {isFlag && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute top-1 right-1" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

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
                      {readingPassagesList.map((p, pIdx) => {
                        const pCount = allReadingQuestions.filter(
                          (q) => (questionPassageIndexMap[q.id] ?? 0) === pIdx
                        ).length;
                        const rawTitle = p.title || `Passage ${pIdx + 1}`;
                        const displayTitle = rawTitle.replace(/\b([A-Za-z]+)!(\s+)/g, "$1'$2").trim();
                        return (
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
                            <span>{displayTitle}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                activeReadingPassageTab === pIdx ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {pCount} Qs
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Passage Content */}
                  <div
                    onMouseUp={handlePassageMouseUp}
                    className={`flex-1 p-6 md:p-8 overflow-y-auto leading-[1.85] select-text font-serif text-slate-900 ${
                      passageFontSize === 'xl' ? 'text-xl md:text-[21px]' : passageFontSize === 'large' ? 'text-lg md:text-[19px]' : 'text-base md:text-[17px]'
                    }`}
                  >
                    <div className="max-w-prose mx-auto whitespace-pre-wrap text-justify">
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
                        <div className="flex items-center gap-2.5 flex-1 flex-wrap">
                          <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 font-bold text-sm flex items-center justify-center shrink-0">
                            {qNum}
                          </span>
                          <span className="text-sm md:text-base font-semibold text-slate-900 leading-snug whitespace-pre-line flex-1">
                            {(() => {
                              const rawPrompt = q.prompt || (q as any).question || (q as any).questionText || '';
                              const isCompletion =
                                q.type === 'sentence_completion' ||
                                q.type === 'summary_completion' ||
                                q.type === 'note_completion' ||
                                q.type === 'table_completion' ||
                                q.type === 'flowchart_completion' ||
                                q.type === 'fill_in_the_blank';
                              const blankRegex = /(\[\d+\]|\[blank\]|(?:\b\d{1,2}\s*)?[\.\_\…\–\-]{3,}|_{2,})/;
                              if (isCompletion && blankRegex.test(rawPrompt)) {
                                const parts = rawPrompt.split(blankRegex);
                                let blankRendered = false;
                                return parts.map((part: string, pIdx: number) => {
                                  if (!blankRendered && blankRegex.test(part)) {
                                    blankRendered = true;
                                    return (
                                      <input
                                        key={`input_${pIdx}`}
                                        type="text"
                                        value={studentAns}
                                        onChange={(e) => handleReadingAnswerChange(q.id, e.target.value)}
                                        placeholder={`Answer (${qNum})...`}
                                        className="inline-block mx-1.5 px-3 py-1 text-xs md:text-sm rounded-lg border-2 border-blue-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 outline-hidden font-bold bg-blue-50/50 text-blue-900 min-w-[130px] max-w-[200px] shadow-2xs"
                                      />
                                    );
                                  }
                                  return <React.Fragment key={pIdx}>{renderCleanMarkdown(part, qNum)}</React.Fragment>;
                                });
                              }
                              return renderCleanMarkdown(rawPrompt, qNum);
                            })()}
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
                      {q.type === 'matching_information' && (
                        <div className="mt-3 pl-2 sm:pl-8 space-y-3">
                          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-xs md:text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                            <span className="font-semibold">Which paragraph contains this information?</span>
                            <span className="font-mono text-[11px] text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md font-bold">
                              NB: Letters may be used more than once
                            </span>
                          </div>
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

                      {/* Matching Features Question Layout */}
                      {q.type === 'matching_features' && (
                        <div className="mt-3 pl-2 sm:pl-8 space-y-3">
                          <div className="text-xs font-semibold text-slate-600">
                            Select the matching feature:
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(q.options && q.options.length > 0
                              ? q.options
                              : (q as any).featuresList && (q as any).featuresList.length > 0
                              ? (q as any).featuresList
                              : ['A', 'B', 'C', 'D', 'E']
                            ).map((opt: string, oIdx: number) => {
                              const letterMatch = opt.match(/^([A-Za-z])[\.\:\)]?\s*(.*)$/);
                              const letter = letterMatch ? letterMatch[1].toUpperCase() : String.fromCharCode(65 + oIdx);
                              const isSelected = studentAns === letter || studentAns === opt;
                              return (
                                <button
                                  key={oIdx}
                                  type="button"
                                  onClick={() => handleReadingAnswerChange(q.id, letter)}
                                  className={`p-2.5 rounded-xl text-left text-xs md:text-sm font-medium border transition-all flex items-start gap-2.5 ${
                                    isSelected
                                      ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs ring-1 ring-blue-500'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${
                                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {letter}
                                  </span>
                                  <span className="flex-1">{letterMatch ? letterMatch[2] : opt}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Matching Sentence Endings Question Layout */}
                      {q.type === 'matching_sentence_endings' && (
                        <div className="mt-3 pl-2 sm:pl-8 space-y-3">
                          <div className="text-xs font-semibold text-slate-600">
                            Select the ending that completes this sentence:
                          </div>
                          <div className="space-y-2">
                            {(q.options && q.options.length > 0
                              ? q.options
                              : ['A', 'B', 'C', 'D', 'E', 'F']
                            ).map((opt: string, oIdx: number) => {
                              const letterMatch = opt.match(/^([A-Za-z])[\.\:\)]?\s*(.*)$/);
                              const letter = letterMatch ? letterMatch[1].toUpperCase() : String.fromCharCode(65 + oIdx);
                              const isSelected = studentAns === letter || studentAns === opt;
                              return (
                                <button
                                  key={oIdx}
                                  type="button"
                                  onClick={() => handleReadingAnswerChange(q.id, letter)}
                                  className={`w-full p-2.5 rounded-xl text-left text-xs md:text-sm font-medium border transition-all flex items-start gap-2.5 ${
                                    isSelected
                                      ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs ring-1 ring-blue-500'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${
                                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {letter}
                                  </span>
                                  <span className="flex-1">{letterMatch ? letterMatch[2] : opt}</span>
                                </button>
                              );
                            })}
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

                      {/* Completion Answer Fields (Rendered ONLY if not already rendered inline inside prompt) */}
                      {(q.type === 'sentence_completion' ||
                        q.type === 'summary_completion' ||
                        q.type === 'note_completion' ||
                        q.type === 'table_completion' ||
                        q.type === 'flowchart_completion' ||
                        q.type === 'fill_in_the_blank' ||
                        q.type === 'short_answer') &&
                        !/(\[\d+\]|\[blank\]|(?:\b\d{1,2}\s*)?[\.\_\…\–\-]{3,}|_{2,})/.test(q.prompt || (q as any).question || (q as any).questionText || '') && (
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

              {currentSection.writingTaskType === 'task1' ? (
                <div className="space-y-4">
                  <WritingTask1VisualRenderer
                    prompt={currentSection.writingPrompt || ''}
                    imageUrl={currentSection.task1ImageUrl}
                    chartType={(currentSection as any).chartType}
                    minWords={currentSection.writingMinWords || 150}
                  />
                  {stripMarkdownTableFromPrompt(currentSection.writingPrompt || '').length > 0 && (
                    <div className="text-sm md:text-base text-slate-800 leading-relaxed whitespace-pre-wrap font-sans p-3 bg-slate-50/70 rounded-xl border border-slate-200">
                      {parseFormattedPrompt(stripMarkdownTableFromPrompt(currentSection.writingPrompt || '')).map((s, idx) => {
                        if (s.bold) return <strong key={idx} className="font-bold text-slate-900">{s.text}</strong>;
                        if (s.italic) return <em key={idx} className="italic text-slate-800">{s.text}</em>;
                        return <span key={idx}>{s.text}</span>;
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <>
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
                </>
              )}
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
                    {currentWritingTaskKey === 'task2' && !isWritingTask1Completed ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white rounded-xl border border-dashed border-slate-300 text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                          <Lock className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">Writing Task 2 Đang Bị Khóa</h4>
                        <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                          Theo quy định kỳ thi IELTS, bạn cần hoàn thành và lưu bài viết cho <strong>Writing Task 1</strong> trước khi mở khóa viết Task 2.
                        </p>
                      </div>
                    ) : (
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
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* SPEAKING SECTION CANVAS (Dedicated Step-by-Step Flow) */}
        {currentSection?.skill === 'speaking' && (
          <SpeakingSectionWorkspace
            key={currentSection.id}
            section={currentSection}
            attemptId={attempt.id}
            savedData={answers.speaking?.[currentSection.id]}
            onSaveAnswer={(audioUrl, durationSec, responses) => {
              handleSpeakingAudioReady(currentSection.id, durationSec, audioUrl, responses);
            }}
            onNextSection={() => {
              if (currentSectionIndex < sections.length - 1) {
                setCurrentSectionIndex((prev) => prev + 1);
              }
            }}
            hasNextSection={currentSectionIndex < sections.length - 1}
          />
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
              {currentSection?.skill === 'listening' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Listening Questions Answered</span>
                    <span className="font-bold text-emerald-700">{answeredListeningCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('regularTests.unansweredCount')}</span>
                    <span className="font-bold text-rose-700">{(allListeningQuestions.length || 40) - answeredListeningCount}</span>
                  </div>
                </>
              )}
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
