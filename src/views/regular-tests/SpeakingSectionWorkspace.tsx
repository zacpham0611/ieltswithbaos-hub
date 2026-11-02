import React, { useState, useEffect, useRef } from 'react';
import type { RegularTestSection } from '../../types';
import {
  Mic,
  Square,
  Play,
  Pause,
  CheckCircle,
  AlertTriangle,
  Volume2,
  Clock,
  ArrowRight,
  ShieldAlert,
  RotateCcw,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

interface SpeakingSectionWorkspaceProps {
  section: RegularTestSection;
  attemptId: string;
  savedData?: {
    audioUrl?: string;
    duration?: number;
    isLocked?: boolean;
    responses?: Record<string, { audioUrl: string; duration: number; questionText?: string }>;
  };
  onSaveAnswer: (
    audioUrl: string,
    durationSec: number,
    responses: Record<string, { audioUrl: string; duration: number; questionText?: string }>
  ) => void;
  onNextSection?: () => void;
  hasNextSection?: boolean;
}

export const SpeakingSectionWorkspace: React.FC<SpeakingSectionWorkspaceProps> = ({
  section,
  savedData,
  onSaveAnswer,
  onNextSection,
  hasNextSection,
}) => {
  const isPart1 = section.speakingPart === 'part1';
  const isPart2 = section.speakingPart === 'part2';
  const isPart3 = section.speakingPart === 'part3';

  // Part 1 & Part 3 Questions List
  const questionItems: Array<{ id: string; questionText: string; topicTitle?: string }> = React.useMemo(() => {
    if (isPart1) {
      const items: Array<{ id: string; questionText: string; topicTitle?: string }> = [];
      const topics = section.speakingTopics || [];
      const topicLimit = section.speakingTopicCount || topics.length;
      topics.slice(0, topicLimit).forEach((tp, tIdx) => {
        (tp.questions || []).forEach((q, qIdx) => {
          items.push({
            id: `p1_q_${tIdx}_${qIdx}`,
            questionText: q,
            topicTitle: tp.topic || (tp as any).title || `Topic ${tIdx + 1}`,
          });
        });
      });
      if (items.length === 0 && section.speakingQuestions && section.speakingQuestions.length > 0) {
        section.speakingQuestions.forEach((q, qIdx) => {
          items.push({ id: `p1_q_${qIdx}`, questionText: q, topicTitle: 'General Questions' });
        });
      }
      return items;
    }

    if (isPart3) {
      const items: Array<{ id: string; questionText: string; topicTitle?: string }> = [];
      if (section.speakingPart3Groups && section.speakingPart3Groups.length > 0) {
        section.speakingPart3Groups.forEach((grp, gIdx) => {
          (grp.questions || []).forEach((q, qIdx) => {
            items.push({
              id: `p3_q_${gIdx}_${qIdx}`,
              questionText: q,
              topicTitle: grp.cueCardTopic || `Group ${gIdx + 1}`,
            });
          });
        });
      } else if (section.speakingQuestions && section.speakingQuestions.length > 0) {
        section.speakingQuestions.forEach((q, qIdx) => {
          items.push({ id: `p3_q_${qIdx}`, questionText: q, topicTitle: 'Discussion Questions' });
        });
      }
      return items;
    }

    return [];
  }, [isPart1, isPart3, section]);

  // Persisted question-level responses
  const [recordedResponses, setRecordedResponses] = useState<
    Record<string, { audioUrl: string; duration: number; questionText?: string }>
  >(savedData?.responses || {});

  // Current Question Index for Part 1 & Part 3
  const [currentQIndex, setCurrentQIndex] = useState<number>(() => {
    if (isPart1 || isPart3) {
      const existing = savedData?.responses || {};
      const firstUnanswered = questionItems.findIndex((q) => !existing[q.id]?.audioUrl);
      return firstUnanswered !== -1 ? firstUnanswered : Math.max(0, questionItems.length - 1);
    }
    return 0;
  });

  // Flow State Machine
  // For Part 1 & 3: 'idle' -> 'reading' (3s) -> 'recording' -> 'saving' -> 'saved'
  // For Part 2: 'p2_ready' -> 'p2_reading' (3s) -> 'p2_prep' (60s) -> 'p2_transition' (5s) -> 'p2_recording' (120s) -> 'p2_saved'
  const isSectionAlreadyDone = Boolean(savedData?.isLocked && savedData?.audioUrl);

  const [part13State, setPart13State] = useState<'idle' | 'reading' | 'recording' | 'saving' | 'saved'>(
    isSectionAlreadyDone ? 'saved' : 'idle'
  );
  const [countdownSeconds, setCountdownSeconds] = useState<number>(3);

  // Question 1 manual reveal vs Question 2+ automatic reveal
  const [isQuestionRevealed, setIsQuestionRevealed] = useState<boolean>(() => {
    if (isSectionAlreadyDone) return true;
    const existing = savedData?.responses || {};
    // If first question is already answered or we're on question > 0, consider it revealed
    const firstQ = questionItems[0];
    if (firstQ && existing[firstQ.id]?.audioUrl) return true;
    return false;
  });

  // Part 2 states
  const [part2State, setPart2State] = useState<
    'p2_ready' | 'p2_reading' | 'p2_prep' | 'p2_transition' | 'p2_recording' | 'p2_saving' | 'p2_saved'
  >(isSectionAlreadyDone ? 'p2_saved' : 'p2_ready');
  const [part2Timer, setPart2Timer] = useState<number>(7);
  const [scratchpadNotes, setScratchpadNotes] = useState<string>('');
  const part2IntervalRef = useRef<number | null>(null);

  // MediaRecorder & Recording state
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Audio Playback Preview State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (part2IntervalRef.current) clearInterval(part2IntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Sync savedData if loaded after mount
  useEffect(() => {
    if (savedData?.responses) {
      setRecordedResponses(savedData.responses);
    }
  }, [savedData]);

  // Clean Audio Recording Starter
  const startAudioRecording = async (maxDuration: number, onAutoStop: () => void) => {
    setMicError(null);
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt của bạn không hỗ trợ ghi âm trực tiếp.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      let selectedMime = '';
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const options = selectedMime ? { mimeType: selectedMime } : undefined;
      const mr = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mr.start(250);

      // Start elapsed timer
      let elapsed = 0;
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = window.setInterval(() => {
        elapsed += 1;
        setRecordingSeconds(elapsed);
        if (elapsed >= maxDuration) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          onAutoStop();
        }
      }, 1000);
    } catch (err: any) {
      const msg =
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Không thể truy cập Microphone. Vui lòng cấp quyền Microphone trên trình duyệt để tiếp tục làm bài thi.'
          : err.message || 'Lỗi microphone khi bắt đầu ghi âm.';
      setMicError(msg);
      throw err;
    }
  };

  // Stop Audio Recording & Return Blob
  const stopAudioRecording = (): Promise<{ blob: Blob; duration: number; url: string }> => {
    return new Promise((resolve) => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      const mr = mediaRecorderRef.current;
      const dur = recordingSeconds;

      if (!mr || mr.state === 'inactive') {
        const dummyBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(dummyBlob);
        resolve({ blob: dummyBlob, duration: dur, url });
        return;
      }

      mr.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const finalUrl = URL.createObjectURL(finalBlob);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        resolve({ blob: finalBlob, duration: dur, url: finalUrl });
      };

      mr.stop();
    });
  };

  // ---------------------------------------------------------------------------
  // PART 1 & PART 3: QUESTION-BY-QUESTION FLOW
  // ---------------------------------------------------------------------------
  const activeQuestion = questionItems[currentQIndex];
  const isCurrentQAnswered = Boolean(activeQuestion && recordedResponses[activeQuestion.id]?.audioUrl);

  // If active question is already answered, show saved state
  useEffect(() => {
    if (isPart1 || isPart3) {
      if (activeQuestion && recordedResponses[activeQuestion.id]?.audioUrl) {
        setPart13State('saved');
      } else {
        setPart13State('idle');
      }
    }
  }, [currentQIndex, activeQuestion, isPart1, isPart3, recordedResponses]);

  // Countdown timer ref to avoid duplicates
  const readingIntervalRef = useRef<number | null>(null);

  // Clean 3-Second Reading Countdown Starter
  const startReadingCountdown = () => {
    setMicError(null);
    if (readingIntervalRef.current) {
      clearInterval(readingIntervalRef.current);
      readingIntervalRef.current = null;
    }
    setPart13State('reading');
    setCountdownSeconds(3);

    let left = 3;
    readingIntervalRef.current = window.setInterval(async () => {
      left -= 1;
      setCountdownSeconds(left);
      if (left <= 0) {
        if (readingIntervalRef.current) {
          clearInterval(readingIntervalRef.current);
          readingIntervalRef.current = null;
        }
        // Automatic recording starts immediately after 3s
        setPart13State('recording');
        try {
          await startAudioRecording(90, () => {
            handleStopQuestionRecording();
          });
        } catch {
          setPart13State('idle');
        }
      }
    }, 1000);
  };

  // Question 1: Manual Reveal upon button click
  const handleRevealQuestion1 = () => {
    if (isQuestionRevealed) return;
    setIsQuestionRevealed(true);
    startReadingCountdown();
  };

  // Manual "Stop Recording" by student
  const handleStopQuestionRecording = async () => {
    if (part13State !== 'recording') return;
    setPart13State('saving');

    const result = await stopAudioRecording();
    if (activeQuestion) {
      const updated = {
        ...recordedResponses,
        [activeQuestion.id]: {
          audioUrl: result.url,
          duration: result.duration || 1,
          questionText: activeQuestion.questionText,
        },
      };
      setRecordedResponses(updated);
      setPart13State('saved');

      // Check if all questions are answered
      const allDone = questionItems.every((q) => Boolean(updated[q.id]?.audioUrl));
      if (allDone) {
        const totalDuration = Object.values(updated).reduce((acc, curr) => acc + curr.duration, 0);
        const mainUrl = updated[questionItems[0]?.id]?.audioUrl || result.url;
        onSaveAnswer(mainUrl, totalDuration, updated);
      }
    }
  };

  // Move to Next Question: Question 2 onward automatically reveals and starts 3s countdown!
  const handleNextQuestion = () => {
    if (currentQIndex < questionItems.length - 1) {
      const nextIdx = currentQIndex + 1;
      setCurrentQIndex(nextIdx);
      setIsQuestionRevealed(true);
      // Immediately start 3-second reading countdown for next question
      setTimeout(() => {
        startReadingCountdown();
      }, 50);
    } else {
      // Last question finished
      if (hasNextSection && onNextSection) {
        onNextSection();
      }
    }
  };

  // ---------------------------------------------------------------------------
  // PART 2: TIMED PREPARATION & 2-MINUTE RECORDING FLOW
  // ---------------------------------------------------------------------------
  const cueCard =
    section.speakingCueCards?.[0] ||
    section.speakingCueCard || {
      topic: section.speakingTopic || section.title,
      points: section.speakingPoints || ['What it is', 'When and where', 'Why it matters'],
    };

  // Step 1: Reveal Cue Card & start 3s reading timer
  const handleRevealPart2 = () => {
    if (isQuestionRevealed) return;
    setIsQuestionRevealed(true);
    handleStartPart2Reading();
  };

  const handleStartPart2Reading = () => {
    if (part2IntervalRef.current) clearInterval(part2IntervalRef.current);
    setPart2State('p2_reading');
    setPart2Timer(7);
    let left = 7;
    part2IntervalRef.current = window.setInterval(() => {
      left -= 1;
      setPart2Timer(left);
      if (left <= 0) {
        if (part2IntervalRef.current) clearInterval(part2IntervalRef.current);
        // Transition to 60s prep
        handleStartPart2Prep();
      }
    }, 1000);
  };

  // Step 2 -> Step 3: 60s prep timer
  const handleStartPart2Prep = () => {
    if (part2IntervalRef.current) clearInterval(part2IntervalRef.current);
    setPart2State('p2_prep');
    setPart2Timer(60);
    let left = 60;
    part2IntervalRef.current = window.setInterval(() => {
      left -= 1;
      setPart2Timer(left);
      if (left <= 0) {
        if (part2IntervalRef.current) clearInterval(part2IntervalRef.current);
        // Transition to 5s warning before auto record
        handleStartPart2Transition();
      }
    }, 1000);
  };

  // Step 3 -> Step 4: 5s transition countdown
  const handleStartPart2Transition = () => {
    if (part2IntervalRef.current) clearInterval(part2IntervalRef.current);
    setPart2State('p2_transition');
    setPart2Timer(5);
    let left = 5;
    part2IntervalRef.current = window.setInterval(async () => {
      left -= 1;
      setPart2Timer(left);
      if (left <= 0) {
        if (part2IntervalRef.current) clearInterval(part2IntervalRef.current);
        // Automatic 2-minute recording starts!
        setPart2State('p2_recording');
        try {
          await startAudioRecording(120, () => {
            handleStopPart2Recording();
          });
        } catch {
          setPart2State('p2_ready');
        }
      }
    }, 1000);
  };

  // Manual Stop or Auto Stop for Part 2 (120s limit)
  const handleStopPart2Recording = async () => {
    if (part2State !== 'p2_recording') return;
    setPart2State('p2_saving');

    const result = await stopAudioRecording();
    const updated = {
      part2: {
        audioUrl: result.url,
        duration: result.duration || 1,
        questionText: cueCard.topic,
      },
    };
    setRecordedResponses(updated);
    setPart2State('p2_saved');
    onSaveAnswer(result.url, result.duration || 1, updated);
  };

  const formatTimerDisplay = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const answeredCount = questionItems.filter((q) => Boolean(recordedResponses[q.id]?.audioUrl)).length;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 md:p-8 flex flex-col items-center justify-start">
      <div className="w-full max-w-3xl space-y-6 animate-fade-in">
        {/* Top Header & Status Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 px-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-purple-600" />
              {isPart1 ? 'IELTS Speaking Part 1' : isPart2 ? 'IELTS Speaking Part 2' : 'IELTS Speaking Part 3'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              Ghi âm 1 lần duy nhất
            </span>
          </div>

          {/* Minimal progress indicator without question numbers */}
          {(isPart1 || isPart3) && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Tiến độ:</span>
              <div className="flex items-center gap-1.5">
                {questionItems.map((q, idx) => {
                  const isDone = Boolean(recordedResponses[q.id]?.audioUrl);
                  const isCurrent = idx === currentQIndex;
                  return (
                    <div
                      key={q.id}
                      className={`h-2.5 rounded-full transition-all ${
                        isCurrent
                          ? 'w-6 bg-purple-600'
                          : isDone
                          ? 'w-2.5 bg-emerald-500'
                          : 'w-2.5 bg-slate-200'
                      }`}
                      title={isDone ? 'Đã hoàn thành' : isCurrent ? 'Đang thực hiện' : 'Chưa thực hiện'}
                    />
                  );
                })}
              </div>
              <span className="text-slate-600 font-bold ml-1 font-mono">
                {answeredCount}/{questionItems.length}
              </span>
            </div>
          )}

          {isPart2 && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              part2State === 'p2_saved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {part2State === 'p2_saved' ? 'Đã hoàn thành Part 2 ✓' : 'Đang thực hiện Part 2'}
            </span>
          )}
        </div>

        {/* Mic Permission Error Banner */}
        {micError && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-800 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Lỗi Microphone: </span>
              {micError}
            </div>
          </div>
        )}

        {/* UNIFIED QUESTION WORKSPACE (No split-screen columns) */}
        {(isPart1 || isPart3) && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6 text-center">
            {/* CONCEALED QUESTION (Question 1 before explicit click) */}
            {!isQuestionRevealed && (
              <div className="p-8 bg-slate-50/80 border-2 border-dashed border-slate-300 rounded-2xl space-y-4 max-w-lg mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
                  <EyeOff className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-800">Nội dung câu hỏi đang được ẩn</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Bấm nút bên dưới để xem câu hỏi. Bạn sẽ có <strong>3 giây đọc đề</strong> trước khi hệ thống tự động bật microphone để ghi âm.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRevealQuestion1}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 mx-auto cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Xem câu hỏi (View Question)</span>
                </button>
              </div>
            )}

            {/* REVEALED QUESTION */}
            {isQuestionRevealed && (
              <div className="space-y-6 animate-fade-in">
                {/* Topic context without question numbers */}
                {activeQuestion?.topicTitle && (
                  <div>
                    <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-bold uppercase tracking-wider">
                      Chủ đề: {activeQuestion.topicTitle}
                    </span>
                  </div>
                )}

                {/* Question Prompt */}
                <div className="p-6 bg-gradient-to-br from-purple-50/60 to-indigo-50/30 rounded-2xl border border-purple-200/80">
                  <div className="text-lg md:text-xl font-bold text-slate-900 leading-snug">
                    {activeQuestion?.questionText}
                  </div>
                </div>

                {/* Flow State: Reading 3s Countdown */}
                {part13State === 'reading' && (
                  <div className="py-4 space-y-3 animate-scale-in">
                    <div className="w-16 h-16 rounded-full border-4 border-purple-600 bg-purple-50 flex items-center justify-center mx-auto shadow-inner">
                      <span className="text-3xl font-black text-purple-700 animate-pulse">
                        {countdownSeconds}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-bold text-slate-800">Thời gian đọc câu hỏi (3 giây)</h4>
                      <p className="text-xs text-purple-700 font-semibold">
                        Microphone sẽ tự động bật để ghi âm sau {countdownSeconds} giây...
                      </p>
                    </div>
                  </div>
                )}

                {/* Flow State: Recording */}
                {part13State === 'recording' && (
                  <div className="py-4 space-y-5 animate-fade-in">
                    <div className="flex items-center justify-center gap-2 text-rose-600 font-bold text-sm">
                      <span className="w-3.5 h-3.5 rounded-full bg-rose-600 animate-ping inline-block" />
                      <span>ĐANG GHI ÂM (RECORDING)...</span>
                    </div>

                    <div className="text-4xl font-black font-mono text-slate-900">
                      {formatTimerDisplay(recordingSeconds)}
                    </div>

                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Hãy trả lời câu hỏi tự nhiên theo nhịp điệu của bạn. Bấm nút dưới đây khi hoàn thành:
                    </p>

                    <button
                      type="button"
                      onClick={handleStopQuestionRecording}
                      className="px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-white" />
                      <span>Dừng ghi âm & Lưu bài (Stop Recording)</span>
                    </button>
                  </div>
                )}

                {/* Flow State: Saving */}
                {part13State === 'saving' && (
                  <div className="py-6 space-y-3">
                    <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-bold text-slate-700">Đang lưu file âm thanh vào hệ thống...</p>
                  </div>
                )}

                {/* Flow State: Saved */}
                {part13State === 'saved' && (
                  <div className="py-4 space-y-5 animate-fade-in max-w-md mx-auto">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-left">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>Bản ghi âm đã được lưu thành công</span>
                      </div>
                      {recordedResponses[activeQuestion?.id || '']?.audioUrl && (
                        <audio
                          controls
                          src={recordedResponses[activeQuestion?.id || '']?.audioUrl}
                          className="w-full h-9 rounded-lg mt-2"
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>
                        {currentQIndex < questionItems.length - 1
                          ? 'Tiếp tục câu hỏi tiếp theo →'
                          : 'Hoàn thành phần thi này ✓'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PART 2 UNIFIED WORKSPACE */}
        {isPart2 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6 text-center">
            {/* CONCEALED PART 2 CUE CARD */}
            {!isQuestionRevealed && (
              <div className="p-8 bg-slate-50/80 border-2 border-dashed border-slate-300 rounded-2xl space-y-4 max-w-lg mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
                  <EyeOff className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-800">Đề bài Cue Card đang được ẩn</h3>
                  <div className="p-3 bg-slate-100 rounded-xl text-left text-xs text-slate-600 space-y-1 leading-relaxed">
                    <div>1. <strong>3 giây</strong> đọc đề Cue Card.</div>
                    <div>2. <strong>60 giây</strong> chuẩn bị ý tưởng & ghi chú nháp.</div>
                    <div>3. Tự động chuyển sang ghi âm trong tối đa <strong>2 phút</strong>.</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRevealPart2}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 mx-auto cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Xem Cue Card & Bắt đầu (View Question)</span>
                </button>
              </div>
            )}

            {/* REVEALED PART 2 WORKSPACE */}
            {isQuestionRevealed && (
              <div className="space-y-6 animate-fade-in">
                {/* Candidate Task Card (Cue Card) */}
                <div className="p-6 bg-gradient-to-br from-purple-50/70 to-indigo-50/40 rounded-2xl border-2 border-purple-200 space-y-3.5 text-left shadow-2xs">
                  <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
                    <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                      Candidate Task Card
                    </span>
                    <span className="text-xs text-purple-800 font-semibold">
                      ⏱ 1 phút chuẩn bị • 1 – 2 phút nói
                    </span>
                  </div>
                  <div className="text-lg font-black text-slate-900">{cueCard.topic}</div>
                  <div className="text-xs font-bold text-slate-700 uppercase">You should say:</div>
                  <ul className="space-y-2 text-sm text-slate-800 list-disc list-inside pl-2 leading-relaxed">
                    {(cueCard.points || []).map((point, pIdx) => (
                      <li key={pIdx} className="leading-snug">{point}</li>
                    ))}
                  </ul>
                </div>

                {/* STEP 2: 3s READING TIMER */}
                {part2State === 'p2_reading' && (
                  <div className="py-4 space-y-3 animate-scale-in">
                    <div className="w-16 h-16 rounded-full border-4 border-purple-600 bg-purple-50 flex items-center justify-center mx-auto shadow-inner">
                      <span className="text-3xl font-black text-purple-700 animate-pulse">
                        {part2Timer}s
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-bold text-slate-800">Thời gian đọc đề Cue Card (7s)</h4>
                      <p className="text-xs text-purple-700 font-semibold">
                        Đang chuyển sang 1 phút chuẩn bị sau {part2Timer} giây...
                      </p>
                    </div>
                  </div>
                )}

                {/* STEP 3: 60s PREP TIMER & DIGITAL SCRATCHPAD */}
                {part2State === 'p2_prep' && (
                  <div className="space-y-4 animate-scale-in text-left">
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-indigo-950">Thời gian chuẩn bị (1 Minute Preparation)</h4>
                        <p className="text-xs text-indigo-700">Xem lại các gợi ý và ghi nhanh ý chính vào khung nháp dưới đây:</p>
                      </div>
                      <div className="text-2xl font-black text-indigo-700 font-mono px-3 py-1 bg-white border border-indigo-300 rounded-xl">
                        {formatTimerDisplay(part2Timer)}
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <label className="text-xs font-bold text-slate-700 block">
                        📝 Ghi chú nháp của bạn (Digital Scratchpad):
                      </label>
                      <textarea
                        value={scratchpadNotes}
                        onChange={(e) => setScratchpadNotes(e.target.value)}
                        placeholder="Ghi nhanh các ý tưởng chính, từ vựng hay trong 1 phút chuẩn bị..."
                        rows={3}
                        className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:outline-hidden bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 4: 5s TRANSITION COUNTDOWN */}
                {part2State === 'p2_transition' && (
                  <div className="py-4 space-y-3 animate-scale-in">
                    <div className="w-16 h-16 rounded-full border-4 border-rose-600 bg-rose-50 flex items-center justify-center mx-auto">
                      <span className="text-3xl font-black text-rose-700 animate-pulse">
                        {part2Timer}s
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-rose-700">
                      Chuẩn bị bắt đầu nói! Microphone tự động bật sau {part2Timer}s...
                    </h3>
                  </div>
                )}

                {/* STEP 5: 120s RECORDING */}
                {part2State === 'p2_recording' && (
                  <div className="py-4 space-y-5 animate-fade-in">
                    <div className="flex items-center justify-center gap-2 text-rose-600 font-bold text-sm">
                      <span className="w-3.5 h-3.5 rounded-full bg-rose-600 animate-ping inline-block" />
                      <span>ĐANG GHI ÂM PART 2 (TỐI ĐA 2 PHÚT)</span>
                    </div>

                    <div className="text-4xl font-black font-mono text-slate-900">
                      {formatTimerDisplay(recordingSeconds)} / 02:00
                    </div>

                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Trình bày bài nói Part 2 của bạn rõ ràng. Bấm nút dừng khi hoàn thành hoặc hệ thống sẽ tự động lưu sau 2 phút:
                    </p>

                    <button
                      type="button"
                      onClick={handleStopPart2Recording}
                      className="px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-white" />
                      <span>Dừng ghi âm & Nộp bài Part 2</span>
                    </button>
                  </div>
                )}

                {/* STEP 6: SAVING */}
                {part2State === 'p2_saving' && (
                  <div className="py-6 space-y-3">
                    <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-bold text-slate-700">Đang lưu file âm thanh Part 2...</p>
                  </div>
                )}

                {/* STEP 7: SAVED */}
                {part2State === 'p2_saved' && (
                  <div className="py-4 space-y-5 animate-fade-in max-w-md mx-auto">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-left">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>Bài nói Part 2 đã được ghi âm & lưu thành công</span>
                      </div>
                      {recordedResponses.part2?.audioUrl && (
                        <audio controls src={recordedResponses.part2.audioUrl} className="w-full h-9 rounded-lg mt-2" />
                      )}
                    </div>

                    {hasNextSection && onNextSection && (
                      <button
                        type="button"
                        onClick={onNextSection}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Tiếp tục phần thi tiếp theo →</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
