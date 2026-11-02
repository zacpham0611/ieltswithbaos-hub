import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Gauge,
  FastForward,
  Rewind,
  Music,
} from 'lucide-react';
import type { ListeningPart } from '../../types';

interface PracticeListeningAudioPlayerProps {
  /** Single audio URL or track */
  audioUrl?: string;
  /** Audio title/name */
  title?: string;
  /** Multi-part listening structure */
  parts?: ListeningPart[];
  /** Active part index when in multi-part mode */
  activePartIndex?: number;
  /** Callback when user changes part */
  onPartChange?: (index: number) => void;
  /** Optional class name */
  className?: string;
}

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export const PracticeListeningAudioPlayer: React.FC<PracticeListeningAudioPlayerProps> = ({
  audioUrl,
  title,
  parts = [],
  activePartIndex = 0,
  onPartChange,
  className = '',
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isSpeedOpen, setIsSpeedOpen] = useState<boolean>(false);

  // Active audio URL depends on multi-part or single url
  const currentAudioUrl =
    parts.length > 0 && parts[activePartIndex]?.audioUrl
      ? parts[activePartIndex].audioUrl
      : audioUrl || '';

  const currentPartTitle =
    parts.length > 0 && parts[activePartIndex]
      ? parts[activePartIndex].title || `Part ${activePartIndex + 1}`
      : title || 'Listening Audio Track';

  // Load new audio source when URL changes
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = playbackRate;
    audioRef.current.volume = isMuted ? 0 : volume;
    // reset playback state
    setIsPlaying(false);
    setCurrentTime(0);
  }, [currentAudioUrl]);

  // Sync playback rate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Sync volume / mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Audio play prevented or failed:', err);
          setIsPlaying(false);
        });
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (!audioRef.current || isDragging) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration || 0);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const restartTrack = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  const skipSeconds = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Timeline seeking
  const handleSeekFromClientX = (clientX: number) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = pos * duration;
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleSeekFromClientX(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      handleSeekFromClientX(moveEvent.clientX);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
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
      className={`bg-white border border-slate-200 rounded-xl shadow-sm p-4 text-slate-800 transition-all ${className}`}
    >
      <audio
        ref={audioRef}
        src={currentAudioUrl}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Optional Multi-part Tabs */}
      {parts.length > 1 && (
        <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-slate-100 overflow-x-auto">
          {parts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onPartChange?.(idx)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activePartIndex === idx
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Part {idx + 1}
              {p.questions?.length ? ` (${p.questions.length} Qs)` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Title & Mode badge */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 truncate">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Music className="w-4 h-4" />
          </div>
          <div className="truncate">
            <h4 className="text-sm font-semibold text-slate-800 truncate leading-tight">
              {currentPartTitle}
            </h4>
            <span className="text-[11px] text-slate-500">
              Practice Audio Mode • Full playback controls
            </span>
          </div>
        </div>

        {/* Speed Control */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsSpeedOpen(!isSpeedOpen)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            title="Adjust playback speed"
          >
            <Gauge className="w-3.5 h-3.5 text-slate-500" />
            <span>{playbackRate}x</span>
          </button>
          {isSpeedOpen && (
            <div className="absolute right-0 mt-1 py-1 w-24 bg-white border border-slate-200 rounded-lg shadow-lg z-20">
              {SPEED_OPTIONS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => {
                    setPlaybackRate(spd);
                    setIsSpeedOpen(false);
                  }}
                  className={`w-full px-3 py-1 text-xs text-left hover:bg-blue-50 hover:text-blue-600 transition ${
                    playbackRate === spd ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'
                  }`}
                >
                  {spd}x {spd === 1.0 ? '(Normal)' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Timeline Bar (Click and Drag to Seek) */}
      <div className="space-y-1 mb-3">
        <div
          ref={progressBarRef}
          onMouseDown={handleProgressMouseDown}
          className="relative h-2.5 bg-slate-100 hover:bg-slate-200 rounded-full cursor-pointer overflow-hidden transition group"
        >
          <div
            className="absolute top-0 left-0 bottom-0 bg-blue-600 group-hover:bg-blue-700 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>{formatTime(currentTime)}</span>
          <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
        </div>
      </div>

      {/* Action Controls: Replay, Rewind 5s, Play/Pause, Forward 5s, Volume */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          {/* Replay full track */}
          <button
            type="button"
            onClick={restartTrack}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
            title="Replay from start"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Rewind 5s */}
          <button
            type="button"
            onClick={() => skipSeconds(-5)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
            title="Rewind 5 seconds"
          >
            <Rewind className="w-4 h-4" />
          </button>

          {/* Play / Pause Primary */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={!currentAudioUrl}
            className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition disabled:opacity-50"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          {/* Forward 5s */}
          <button
            type="button"
            onClick={() => skipSeconds(5)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
            title="Forward 5 seconds"
          >
            <FastForward className="w-4 h-4" />
          </button>
        </div>

        {/* Volume controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-500" />
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
            className="w-16 sm:w-20 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
          />
        </div>
      </div>
    </div>
  );
};
