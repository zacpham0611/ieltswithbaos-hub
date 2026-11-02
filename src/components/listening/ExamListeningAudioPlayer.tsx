import React, { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Headphones,
  Play,
} from 'lucide-react';
import type { ListeningPart } from '../../types';

export interface ExamPlaybackState {
  currentPartIndex: number;
  status: 'not_started' | 'playing' | 'part_ended' | 'completed';
  completedPartIndices: number[];
  hasStarted: boolean;
}

interface ExamListeningAudioPlayerProps {
  /** Test or attempt ID to isolate persistence */
  attemptId: string;
  /** Section ID */
  sectionId?: string;
  /** Audio URL if single audio file */
  audioUrl?: string;
  /** Audio parts if multi-part test */
  parts?: ListeningPart[];
  /** Current active part index */
  activePartIndex: number;
  /** Callback when part changes or advances */
  onPartChange?: (index: number) => void;
  /** Callback when all audio completes */
  onAudioComplete?: () => void;
  /** External sync of playback state */
  playbackState?: ExamPlaybackState;
  onStateUpdate?: (newState: ExamPlaybackState) => void;
  className?: string;
}

export const ExamListeningAudioPlayer: React.FC<ExamListeningAudioPlayerProps> = ({
  attemptId,
  sectionId = 'listening',
  audioUrl,
  parts = [],
  activePartIndex,
  onPartChange,
  onAudioComplete,
  playbackState: controlledState,
  onStateUpdate,
  className = '',
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Storage key for state persistence across browser reload/disconnection
  const storageKey = `exam_listening_playback_${attemptId}_${sectionId}`;

  // Initial internal state loaded from localStorage if not controlled
  const [internalState, setInternalState] = useState<ExamPlaybackState>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return {
      currentPartIndex: 0,
      status: 'not_started',
      completedPartIndices: [],
      hasStarted: false,
    };
  });

  const state = controlledState || internalState;

  const updateState = (updater: (prev: ExamPlaybackState) => ExamPlaybackState) => {
    const next = updater(state);
    if (!controlledState) {
      setInternalState(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
    }
    onStateUpdate?.(next);
  };

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);

  // Active track URL
  const currentAudioUrl =
    parts.length > 0 && parts[activePartIndex]?.audioUrl
      ? parts[activePartIndex].audioUrl
      : audioUrl || '';

  const isCurrentPartCompleted = state.completedPartIndices.includes(activePartIndex);
  const isAllCompleted =
    state.status === 'completed' ||
    (parts.length > 0 && state.completedPartIndices.length >= parts.length);

  // Ensure volume and 1.0x playback rate at all times (official IELTS rule: no speed altering)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = 1.0;
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted, currentAudioUrl]);

  // Audio event listeners
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration || 0);
  };

  const handleEnded = () => {
    const nextCompleted = Array.from(new Set([...state.completedPartIndices, activePartIndex]));
    const isLastPart = parts.length <= 1 || activePartIndex >= parts.length - 1;

    if (isLastPart) {
      updateState((prev) => ({
        ...prev,
        status: 'completed',
        completedPartIndices: nextCompleted,
      }));
      onAudioComplete?.();
    } else {
      updateState((prev) => ({
        ...prev,
        status: 'part_ended',
        completedPartIndices: nextCompleted,
      }));
    }
  };

  // Start exam audio (user initiated or auto on exam entry)
  const startExamPlayback = () => {
    if (!audioRef.current) return;
    setAutoplayBlocked(false);
    audioRef.current.playbackRate = 1.0;
    audioRef.current
      .play()
      .then(() => {
        updateState((prev) => ({
          ...prev,
          status: 'playing',
          hasStarted: true,
          currentPartIndex: activePartIndex,
        }));
      })
      .catch((err) => {
        console.warn('Exam playback autoplay blocked by browser:', err);
        setAutoplayBlocked(true);
      });
  };

  const advanceToNextPart = () => {
    if (activePartIndex < parts.length - 1) {
      const nextIndex = activePartIndex + 1;
      onPartChange?.(nextIndex);
      updateState((prev) => ({
        ...prev,
        currentPartIndex: nextIndex,
        status: 'not_started',
      }));
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`bg-slate-900 border border-slate-800 text-white rounded-xl shadow-md p-4 transition-all ${className}`}
    >
      <audio
        ref={audioRef}
        src={isCurrentPartCompleted ? undefined : currentAudioUrl}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Part status indicator bar */}
      {parts.length > 1 && (
        <div className="flex items-center gap-1.5 mb-3 pb-2.5 border-b border-slate-800 overflow-x-auto">
          {parts.map((p, idx) => {
            const isDone = state.completedPartIndices.includes(idx);
            const isActive = activePartIndex === idx;
            return (
              <div
                key={idx}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg select-none ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : isDone
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <span>Part {idx + 1}</span>
                )}
                {isDone && <span>Part {idx + 1} (Finished)</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Header and official exam rules badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Headphones className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white tracking-wide">
                IELTS Listening Exam Audio
              </h4>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <Lock className="w-3 h-3" /> Play Once Only
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isAllCompleted
                ? 'Listening audio track completed. Please review your answers.'
                : isCurrentPartCompleted
                ? `Part ${activePartIndex + 1} audio has ended.`
                : state.status === 'playing'
                ? `Playing Part ${activePartIndex + 1} of ${Math.max(1, parts.length)}. Answer questions as you listen.`
                : 'Click "Start Audio" to begin listening. Audio cannot be paused or replayed.'}
            </p>
          </div>
        </div>

        {/* Volume slider (permitted in exam) */}
        <div className="flex items-center gap-2 self-end sm:self-center bg-slate-800/80 px-2.5 py-1 rounded-lg">
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="text-slate-300 hover:text-white transition"
            title={isMuted ? 'Bật âm' : 'Tắt âm'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              if (isMuted && val > 0) setIsMuted(false);
            }}
            className="w-16 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
          />
        </div>
      </div>

      {/* Non-seekable Progress Bar */}
      <div className="space-y-1 mb-3">
        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`absolute top-0 left-0 bottom-0 transition-all duration-200 ${
              isCurrentPartCompleted ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
            style={{ width: `${isCurrentPartCompleted ? 100 : progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <span className="text-slate-500 font-sans text-[11px]">
            {isCurrentPartCompleted
              ? 'Audio finished'
              : state.status === 'playing'
              ? 'Playing (1.0x - locked)'
              : 'Ready'}
          </span>
          <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="flex items-center justify-between pt-1">
        <div>
          {state.status === 'playing' && (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Audio is streaming live. Answer questions concurrently.</span>
            </div>
          )}

          {isCurrentPartCompleted && activePartIndex < parts.length - 1 && (
            <button
              type="button"
              onClick={advanceToNextPart}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
            >
              Tiếp tục sang Part {activePartIndex + 2} &rarr;
            </button>
          )}

          {isAllCompleted && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Toàn bộ audio Listening đã hoàn tất. Thí sinh có thể kiểm tra lại các đáp án.</span>
            </div>
          )}
        </div>

        {/* Start button if not started and not finished */}
        {!isCurrentPartCompleted && state.status !== 'playing' && (
          <button
            type="button"
            onClick={startExamPlayback}
            disabled={!currentAudioUrl}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Bắt đầu phát Audio Part {activePartIndex + 1}</span>
          </button>
        )}
      </div>

      {/* Warning Alert Banner for Audio Strictness */}
      {autoplayBlocked && (
        <div className="mt-2.5 p-2 bg-amber-950/60 border border-amber-800/80 rounded-lg flex items-center gap-2 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Trình duyệt chặn tự động phát. Vui lòng bấm &quot;Bắt đầu phát Audio&quot; để nghe bài thi.
          </span>
        </div>
      )}
    </div>
  );
};
