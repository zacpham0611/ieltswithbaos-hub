import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Upload,
  CheckCircle,
  AlertCircle,
  Volume2,
  FileAudio,
} from 'lucide-react';

interface SpeakingAudioRecorderProps {
  questionId: string;
  initialAudioUrl?: string;
  onAudioReady: (audioBlob: Blob | File, durationSeconds: number, audioUrl: string) => void;
  onAudioClear?: () => void;
  disabled?: boolean;
  label?: string;
  maxSeconds?: number;
}

export const SpeakingAudioRecorder: React.FC<SpeakingAudioRecorderProps> = ({
  questionId,
  initialAudioUrl,
  onAudioReady,
  onAudioClear,
  disabled = false,
  label,
  maxSeconds = 180,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudioUrl || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync if initialAudioUrl changes
  useEffect(() => {
    if (initialAudioUrl && initialAudioUrl !== audioUrl) {
      setAudioUrl(initialAudioUrl);
    }
  }, [initialAudioUrl]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Start Browser Audio Recording
  const startRecording = async () => {
    if (disabled) return;
    setErrorMessage(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt của bạn không hỗ trợ ghi âm trực tiếp. Vui lòng sử dụng tính năng tải lên tệp âm thanh.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Detect supported mimeType
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/aac',
        '',
      ];
      const selectedMime = mimeTypes.find((type) => !type || MediaRecorder.isTypeSupported(type)) || '';

      const recorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, {
          type: selectedMime || 'audio/webm',
        });
        const newUrl = URL.createObjectURL(finalBlob);
        setAudioUrl(newUrl);
        setIsRecording(false);
        setIsPaused(false);

        // Notify parent
        onAudioReady(finalBlob, recordingSeconds, newUrl);

        // Stop all audio tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      recorder.start(250); // Emit chunks every 250ms
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);

      // Start timer
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev + 1 >= maxSeconds) {
            stopRecording();
            return maxSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Quyền truy cập Microphone bị từ chối. Vui lòng cho phép quyền micro trong cài đặt trình duyệt để tiếp tục ghi âm.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('Không tìm thấy thiết bị Microphone trên máy tính của bạn.');
      } else {
        setErrorMessage(err.message || 'Không thể bắt đầu ghi âm. Vui lòng thử tải lên tệp âm thanh.');
      }
    }
  };

  // Pause / Resume Recording
  const togglePauseResume = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Re-record / Discard Audio
  const handleResetAudio = () => {
    if (disabled) return;
    if (audioUrl && audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setRecordingSeconds(0);
    setIsPlaying(false);
    setErrorMessage(null);
    if (onAudioClear) {
      onAudioClear();
    }
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    const newUrl = URL.createObjectURL(file);
    setAudioUrl(newUrl);

    // Get duration via Audio element
    const tempAudio = new Audio(newUrl);
    tempAudio.onloadedmetadata = () => {
      const dur = Math.round(tempAudio.duration) || 60;
      setRecordingSeconds(dur);
      onAudioReady(file, dur, newUrl);
    };
  };

  // Custom Audio Player controls
  const togglePlayPreview = () => {
    if (!audioPlayerRef.current) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
      {label && (
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <span>{label}</span>
          {audioUrl && (
            <span className="flex items-center space-x-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Đã có bản ghi âm</span>
            </span>
          )}
        </div>
      )}

      {/* Hidden File Input for Audio Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
        className="hidden"
        disabled={disabled || isRecording}
      />

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}

      {/* State A: Recording In Progress */}
      {isRecording ? (
        <div className="p-4 bg-red-50/70 border border-red-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center space-x-3">
            <span className="w-4 h-4 rounded-full bg-red-600 animate-ping shrink-0" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-red-900">
                {isPaused ? 'Tạm dừng ghi âm' : 'Đang ghi âm bài nói...'}
              </div>
              <div className="text-xl font-mono font-extrabold text-red-700">
                {formatTime(recordingSeconds)} <span className="text-xs text-slate-500 font-normal">/ {formatTime(maxSeconds)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={togglePauseResume}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-2xs"
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-blue-600" /> : <Pause className="w-3.5 h-3.5 text-amber-600" />}
              <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Hoàn thành ghi âm</span>
            </button>
          </div>
        </div>
      ) : audioUrl ? (
        /* State B: Audio Ready for Preview & Replacement */
        <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
          <audio
            ref={audioPlayerRef}
            src={audioUrl}
            onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
            onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={togglePlayPreview}
                className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-xs transition-colors shrink-0"
                title={isPlaying ? 'Pause' : 'Play preview'}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <div>
                <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bản ghi âm đã sẵn sàng ({formatTime(duration || recordingSeconds)})</span>
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  {formatTime(currentTime)} / {formatTime(duration || recordingSeconds)}
                </div>
              </div>
            </div>

            {!disabled && (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleResetAudio}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Ghi âm lại</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5 text-purple-600" />
                  <span>Đổi tệp</span>
                </button>
              </div>
            )}
          </div>

          {/* Scrubber progress */}
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-100"
              style={{
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      ) : (
        /* State C: Ready to Record or Upload */
        <div className="p-4 bg-slate-50/50 border border-dashed border-slate-300 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3 text-left">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Ghi âm trực tiếp hoặc tải tệp âm thanh</div>
              <div className="text-[11px] text-slate-500">Hỗ trợ microphone trình duyệt hoặc tệp .mp3, .m4a, .wav</div>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={disabled}
              onClick={startRecording}
              className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
            >
              <Mic className="w-4 h-4" />
              <span>Bắt đầu ghi âm</span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-2xs transition-colors"
            >
              <FileAudio className="w-4 h-4 text-purple-600" />
              <span>Tải tệp</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
