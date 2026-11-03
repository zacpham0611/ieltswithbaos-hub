import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  FileAudio,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Portal } from './Portal';
import {
  uploadAudioOptimized,
  type AudioUploadProgress,
  type AudioUploadStatus,
} from '../lib/optimizedAudioUploader';

export interface BulkAudioItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: AudioUploadStatus;
  progress: number;
  speedBytesPerSec?: number;
  url?: string;
  error?: string;
}

interface BulkAudioUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder?: string;
  onUploadSuccess?: (results: Array<{ file: File; url: string; name: string }>) => void;
}

export const BulkAudioUploadModal: React.FC<BulkAudioUploadModalProps> = ({
  isOpen,
  onClose,
  folder = 'audio',
  onUploadSuccess,
}) => {
  const [queue, setQueue] = useState<BulkAudioItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: BulkAudioItem[] = Array.from(files).map((f) => ({
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      file: f,
      name: f.name,
      size: f.size,
      status: 'queued',
      progress: 0,
    }));
    setQueue((prev) => [...prev, ...newItems]);
  };

  const handleRemoveItem = (id: string) => {
    if (isProcessing) return;
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    if (isProcessing) return;
    setQueue([]);
  };

  const uploadItem = async (item: BulkAudioItem): Promise<string> => {
    setQueue((prev) =>
      prev.map((it) =>
        it.id === item.id ? { ...it, status: 'uploading', progress: 0, error: undefined } : it
      )
    );

    const url = await uploadAudioOptimized(item.file, {
      folder,
      preferredFileName: item.name,
      onProgress: (p: AudioUploadProgress) => {
        setQueue((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: p.status,
                  progress: p.percentage,
                  speedBytesPerSec: p.speedBytesPerSec,
                  error: p.error,
                }
              : it
          )
        );
      },
    });

    setQueue((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? { ...it, status: 'completed', progress: 100, url, error: undefined }
          : it
      )
    );

    return url;
  };

  const startBatchUpload = async (onlyFailed = false) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const candidates = queue.filter((it) =>
      onlyFailed ? it.status === 'failed' : it.status === 'queued' || it.status === 'failed'
    );

    const concurrency = 3;
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < candidates.length) {
        const item = candidates[nextIndex++];
        try {
          await uploadItem(item);
        } catch (err: any) {
          setQueue((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    status: 'failed',
                    error: err.message || 'Lỗi tải file',
                  }
                : it
            )
          );
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, candidates.length) }, () =>
      worker()
    );
    await Promise.all(workers);

    setIsProcessing(false);
  };

  const completedItems = queue.filter((it) => it.status === 'completed' && it.url);
  const failedItems = queue.filter((it) => it.status === 'failed');

  const handleDone = () => {
    if (completedItems.length > 0 && onUploadSuccess) {
      onUploadSuccess(
        completedItems.map((it) => ({
          file: it.file,
          url: it.url!,
          name: it.name,
        }))
      );
    }
    onClose();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Portal containerId="modal-root">
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <FileAudio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Tải lên hàng loạt file Audio (Bulk Audio Upload)
                </h3>
                <p className="text-xs text-slate-500">
                  Hỗ trợ tải song song có điều khiển, kiểm tra trạng thái và tự động phục hồi kết nối
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFilesSelected(e.dataTransfer.files);
              }}
              className="border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/40 hover:bg-purple-50/80 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
            >
              <Upload className="w-8 h-8 text-purple-600" />
              <div className="text-xs font-bold text-slate-800">
                Nhấn vào đây hoặc kéo thả nhiều file audio vào đây
              </div>
              <div className="text-[11px] text-slate-500">
                Hỗ trợ MP3, M4A, WAV, AAC, WebM (tối đa 50MB mỗi file)
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm,.aac"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />
            </div>

            {/* Queue List */}
            {queue.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1">
                  <span>
                    Danh sách hàng đợi ({queue.length} file - {completedItems.length} thành công)
                  </span>
                  {!isProcessing && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-slate-400 hover:text-rose-600 flex items-center gap-1 text-[11px] font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa tất cả
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {queue.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileAudio className="w-4 h-4 text-purple-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono shrink-0">
                            ({formatSize(item.size)})
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2 shrink-0">
                          {item.status === 'queued' && (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                              Đang chờ
                            </span>
                          )}
                          {item.status === 'uploading' && (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              {item.progress}%
                            </span>
                          )}
                          {item.status === 'finalizing' && (
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Đang hoàn tất...
                            </span>
                          )}
                          {item.status === 'retrying' && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                              Đang thử lại...
                            </span>
                          )}
                          {item.status === 'completed' && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Đã xong
                            </span>
                          )}
                          {item.status === 'failed' && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Lỗi
                            </span>
                          )}

                          {!isProcessing && item.status !== 'uploading' && item.status !== 'finalizing' && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Xóa khỏi hàng đợi"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {(item.status === 'uploading' ||
                        item.status === 'finalizing' ||
                        item.status === 'retrying') && (
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-purple-600 h-1.5 rounded-full transition-all duration-150"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      )}

                      {/* Speed & Error info */}
                      {item.error && (
                        <div className="text-[10px] text-rose-600 font-medium">{item.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50">
            <div className="text-xs text-slate-500">
              {failedItems.length > 0 && (
                <span className="text-rose-600 font-medium">
                  {failedItems.length} file tải lên thất bại.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {failedItems.length > 0 && !isProcessing && (
                <button
                  type="button"
                  onClick={() => startBatchUpload(true)}
                  className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Thử lại file lỗi
                </button>
              )}

              {queue.some((it) => it.status === 'queued') && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => startBatchUpload(false)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Đang tải lên...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Bắt đầu tải lên ({queue.filter((it) => it.status === 'queued').length})
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                disabled={isProcessing}
                onClick={handleDone}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};
