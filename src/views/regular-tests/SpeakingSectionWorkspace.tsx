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
  // For Part 1 & 3: 'reading' (4s) -> 'recording' -> 'saving' -> 'saved'
  // For Part 2: 'p2_ready' -> 'p2_reading' (10s) -> 'p2_prep' (60s) -> 'p2_transition' (5s) -> 'p2_recording' (120s) -> 'p2_saved'
  const isSectionAlreadyDone = Boolean(savedData?.isLocked && savedData?.audioUrl);

  const [part13State, setPart13State] = useState<'idle' | 'reading' | 'recording' | 'saving' | 'saved'>(
    isSectionAlreadyDone ? 'saved' : 'idle'
  );
  const [countdownSeconds, setCountdownSeconds] = useState<number>(4);

  // Part 2 states
  const [part2State, setPart2State] = useState<
    'p2_ready' | 'p2_reading' | 'p2_prep' | 'p2_transition' | 'p2_recording' | 'p2_saving' | 'p2_saved'
  >(isSectionAlreadyDone ? 'p2_saved' : 'p2_ready');
  const [part2Timer, setPart2Timer] = useState<number>(10);
  const [scratchpadNotes, setScratchpadNotes] = useState<string>('');

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

  // Start 4-second reading timer for active question
  const handleStartQuestionFlow = () => {
    setMicError(null);
    setPart13State('reading');
    setCountdownSeconds(4);

    let left = 4;
    const interval = window.setInterval(async () => {
      left -= 1;
      setCountdownSeconds(left);
      if (left <= 0) {
        clearInterval(interval);
        // Automatic recording starts
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

  // Explicit Continue to Next Question
  const handleNextQuestion = () => {
    if (currentQIndex < questionItems.length - 1) {
      setCurrentQIndex((prev) => prev + 1);
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

  // Step 1 -> Step 2: "I'm ready" -> 10s reading timer
  const handleStartPart2Reading = () => {
    setPart2State('p2_reading');
    setPart2Timer(10);
    let left = 10;
    const interval = window.setInterval(() => {
      left -= 1;
      setPart2Timer(left);
      if (left <= 0) {
        clearInterval(interval);
        // Transition to 60s prep
        handleStartPart2Prep();
      }
    }, 1000);
  };

  // Step 2 -> Step 3: 60s prep timer
  const handleStartPart2Prep = () => {
    setPart2State('p2_prep');
    setPart2Timer(60);
    let left = 60;
    const interval = window.setInterval(() => {
      left -= 1;
      setPart2Timer(left);
      if (left <= 0) {
        clearInterval(interval);
        // Transition to 5s warning before auto record
        handleStartPart2Transition();
      }
    }, 1000);
  };

  // Step 3 -> Step 4: 5s transition countdown
  const handleStartPart2Transition = () => {
    setPart2State('p2_transition');
    setPart2Timer(5);
    let left = 5;
    const interval = window.setInterval(async () => {
      left -= 1;
      setPart2Timer(left);
      if (left <= 0) {
        clearInterval(interval);
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

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* LEFT COLUMN: Prompt / Cue Card / Topic Context */}
      <div className="w-1/2 border-r border-slate-300 bg-white p-6 overflow-y-auto space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-purple-600" />
            {isPart1 ? 'IELTS Speaking Part 1' : isPart2 ? 'IELTS Speaking Part 2' : 'IELTS Speaking Part 3'}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
            Chỉ ghi âm 1 lần duy nhất
          </span>
        </div>

        {/* Mic Permission Error Banner */}
        {micError && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Lỗi Microphone: </span>
              {micError}
            </div>
          </div>
        )}

        {/* PART 1 / PART 3 PROMPT VIEW */}
        {(isPart1 || isPart3) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-wider text-purple-950">
                {isPart1 ? 'Part 1: Topic-based Interview' : 'Part 3: In-depth Discussion'}
              </h4>
              <span className="text-xs font-bold text-slate-500 font-mono">
                Câu hỏi {currentQIndex + 1} / {questionItems.length}
              </span>
            </div>

            {/* Active Question Highlight Card */}
            {activeQuestion ? (
              <div className="p-5 bg-gradient-to-br from-purple-50/80 to-indigo-50/40 rounded-2xl border-2 border-purple-200 space-y-3 shadow-2xs">
                {activeQuestion.topicTitle && (
                  <span className="text-[11px] font-bold uppercase text-purple-700 tracking-wider bg-purple-100 px-2 py-0.5 rounded">
                    Chủ đề: {activeQuestion.topicTitle}
                  </span>
                )}
                <div className="text-base md:text-lg font-bold text-slate-900 leading-snug">
                  {activeQuestion.questionText}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Không tìm thấy câu hỏi Speaking nào.</p>
            )}

            {/* Questions Progress Map */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-600">Tiến độ câu hỏi phần này:</div>
              <div className="flex flex-wrap gap-2">
                {questionItems.map((q, idx) => {
                  const isDone = Boolean(recordedResponses[q.id]?.audioUrl);
                  const isCurrent = idx === currentQIndex;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      disabled={!isDone && !isCurrent}
                      onClick={() => setCurrentQIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-purple-600 text-white shadow-xs ring-2 ring-purple-300'
                          : isDone
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-400 opacity-60'
                      }`}
                    >
                      {isDone && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                      <span>Câu {idx + 1}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PART 2 CUE CARD VIEW */}
        {isPart2 && (
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-purple-950">
              Part 2: Candidate Task Card
            </h4>
            <div className="p-5 bg-gradient-to-br from-purple-50/80 to-indigo-50/40 rounded-2xl border-2 border-purple-200 space-y-3.5 shadow-2xs">
              <div className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                Candidate Task Card
              </div>
              <div className="text-lg font-black text-slate-900">{cueCard.topic}</div>
              <div className="text-xs font-bold text-slate-700">You should say:</div>
              <ul className="space-y-2 text-sm text-slate-800 list-disc list-inside pl-2 leading-relaxed">
                {(cueCard.points || []).map((point, pIdx) => (
                  <li key={pIdx} className="leading-snug">{point}</li>
                ))}
              </ul>
              <div className="pt-2 border-t border-purple-200 flex items-center justify-between text-xs text-purple-800 font-semibold">
                <span>⏱ Chuẩn bị: 1 phút</span>
                <span>⏱ Thời gian nói: 1 – 2 phút</span>
              </div>
            </div>

            {/* Note-Taking Scratchpad during prep */}
            {(part2State === 'p2_prep' || scratchpadNotes.trim().length > 0) && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  📝 Ghi chú nháp của bạn (Digital Scratchpad):
                </label>
                <textarea
                  value={scratchpadNotes}
                  onChange={(e) => setScratchpadNotes(e.target.value)}
                  placeholder="Ghi nhanh các ý tưởng chính, từ vựng hay trong 1 phút chuẩn bị..."
                  rows={4}
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Interactive Timer & Single Recording Workspace */}
      <div className="w-1/2 bg-slate-50 flex flex-col overflow-hidden">
        <div className="h-10 bg-slate-100 border-b border-slate-200 px-4 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-purple-600" />
            Speaking Recording Station
          </span>
          <div>
            {(isPart1 || isPart3) && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                {Object.keys(recordedResponses).length} / {questionItems.length} câu hoàn thành
              </span>
            )}
            {isPart2 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                part2State === 'p2_saved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {part2State === 'p2_saved' ? 'Đã hoàn thành Part 2' : 'Chưa hoàn thành'}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 p-6 flex flex-col items-center justify-center max-w-md mx-auto w-full text-center space-y-6">
          {/* PART 1 & 3 FLOW */}
          {(isPart1 || isPart3) && (
            <>
              {/* IDLE: Prompt to begin question */}
              {part13State === 'idle' && (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center mx-auto text-purple-700">
                    <Mic className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Sẵn sàng trả lời Câu hỏi {currentQIndex + 1}?
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                    Sau khi bấm nút, bạn có <strong>4 giây để đọc câu hỏi</strong>. Hệ thống sẽ tự động bắt đầu ghi âm ngay khi hết 4 giây.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartQuestionFlow}
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 mx-auto cursor-pointer"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Bắt đầu (4s đọc câu hỏi)</span>
                  </button>
                </div>
              )}

              {/* READING: 4-Second Countdown */}
              {part13State === 'reading' && (
                <div className="space-y-4 animate-scale-in">
                  <div className="w-20 h-20 rounded-full border-4 border-purple-600 bg-purple-50 flex items-center justify-center mx-auto shadow-inner">
                    <span className="text-3xl font-black text-purple-700 animate-pulse">
                      {countdownSeconds}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Thời gian đọc câu hỏi (Reading Countdown)
                  </h3>
                  <p className="text-xs text-purple-700 font-semibold">
                    Hệ thống sẽ tự động bật Microphone sau {countdownSeconds} giây...
                  </p>
                </div>
              )}

              {/* RECORDING: Active MediaRecorder */}
              {part13State === 'recording' && (
                <div className="space-y-5 animate-fade-in w-full">
                  <div className="flex items-center justify-center gap-2 text-rose-600 font-bold text-sm">
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-600 animate-ping inline-block" />
                    <span>ĐANG GHI ÂM (RECORDING)...</span>
                  </div>

                  <div className="text-4xl font-black font-mono text-slate-900">
                    {formatTimerDisplay(recordingSeconds)}
                  </div>

                  <p className="text-xs text-slate-500">
                    Hãy trả lời câu hỏi tự nhiên theo nhịp điệu của bạn. Bấm nút dưới đây khi hoàn thành câu trả lời:
                  </p>

                  <button
                    type="button"
                    onClick={handleStopQuestionRecording}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    <span>Dừng ghi âm & Lưu bài (Stop Recording)</span>
                  </button>
                </div>
              )}

              {/* SAVING */}
              {part13State === 'saving' && (
                <div className="space-y-3">
                  <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Đang lưu file âm thanh vào hệ thống...</p>
                </div>
              )}

              {/* SAVED: Playback preview & Explicit Continue button */}
              {part13State === 'saved' && (
                <div className="space-y-5 animate-fade-in w-full">
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
                        ? `Tiếp tục: Câu hỏi ${currentQIndex + 2} →`
                        : 'Hoàn thành phần thi này ✓'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}

          {/* PART 2 FLOW */}
          {isPart2 && (
            <>
              {/* STEP 1: READY PROMPT */}
              {part2State === 'p2_ready' && (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center mx-auto text-purple-700">
                    <Clock className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Bạn đã sẵn sàng bắt đầu Speaking Part 2?
                  </h3>
                  <div className="p-3 bg-slate-100 rounded-xl text-left text-xs text-slate-600 space-y-1 leading-relaxed">
                    <div>1. <strong>10 giây</strong> đọc đề Cue Card.</div>
                    <div>2. <strong>60 giây</strong> chuẩn bị ý tưởng & ghi chú.</div>
                    <div>3. Tự động chuyển sang ghi âm trong tối đa <strong>2 phút</strong>.</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartPart2Reading}
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 mx-auto cursor-pointer"
                  >
                    <span>Tôi đã sẵn sàng (I'm ready)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* STEP 2: 10s READING TIMER */}
              {part2State === 'p2_reading' && (
                <div className="space-y-4 animate-scale-in">
                  <div className="w-20 h-20 rounded-full border-4 border-purple-600 bg-purple-50 flex items-center justify-center mx-auto">
                    <span className="text-3xl font-black text-purple-700 animate-pulse">
                      {part2Timer}s
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Thời gian đọc đề Cue Card (10s)
                  </h3>
                  <p className="text-xs text-purple-700 font-semibold">
                    Đang chuyển sang 1 phút chuẩn bị sau {part2Timer} giây...
                  </p>
                </div>
              )}

              {/* STEP 3: 60s PREP TIMER */}
              {part2State === 'p2_prep' && (
                <div className="space-y-4 animate-scale-in w-full">
                  <div className="w-20 h-20 rounded-full border-4 border-indigo-600 bg-indigo-50 flex items-center justify-center mx-auto">
                    <span className="text-2xl font-black text-indigo-700 font-mono">
                      {formatTimerDisplay(part2Timer)}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Thời gian chuẩn bị (1 Minute Preparation)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hãy xem lại các gợi ý trên Cue Card và ghi chú ý chính vào khung nháp bên trái.
                  </p>
                </div>
              )}

              {/* STEP 4: 5s TRANSITION COUNTDOWN */}
              {part2State === 'p2_transition' && (
                <div className="space-y-4 animate-scale-in">
                  <div className="w-20 h-20 rounded-full border-4 border-rose-600 bg-rose-50 flex items-center justify-center mx-auto">
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
                <div className="space-y-5 animate-fade-in w-full">
                  <div className="flex items-center justify-center gap-2 text-rose-600 font-bold text-sm">
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-600 animate-ping inline-block" />
                    <span>ĐANG GHI ÂM PART 2 (TỐI ĐA 2 PHÚT)</span>
                  </div>

                  <div className="text-4xl font-black font-mono text-slate-900">
                    {formatTimerDisplay(recordingSeconds)} / 02:00
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Trình bày bài nói Part 2 của bạn rõ ràng. Bạn có thể bấm nút dừng khi hoàn thành hoặc hệ thống sẽ tự động dừng sau 2 phút:
                  </p>

                  <button
                    type="button"
                    onClick={handleStopPart2Recording}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    <span>Dừng ghi âm & Nộp bài Part 2</span>
                  </button>
                </div>
              )}

              {/* STEP 6: SAVING */}
              {part2State === 'p2_saving' && (
                <div className="space-y-3">
                  <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Đang lưu file âm thanh Part 2...</p>
                </div>
              )}

              {/* STEP 7: SAVED */}
              {part2State === 'p2_saved' && (
                <div className="space-y-5 animate-fade-in w-full">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};
