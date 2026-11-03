import React, { useState, useEffect } from 'react';
import type { Resource, MaterialFolder, ListeningPart, ListeningQuestionGroup, ListeningQuestion, ListeningTestContent } from '../types';
import { Portal } from './Portal';
import {
  X,
  Save,
  Plus,
  Trash2,
  Headphones,
  Folder,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Music,
  Play,
  Layers,
  ChevronRight,
  Upload,
  Loader2,
} from 'lucide-react';
import { parseListeningDocument } from '../lib/listeningExtractor';
import { uploadMediaFile } from '../lib/mediaStorage';
import type { AudioUploadProgress } from '../lib/optimizedAudioUploader';
import { ListeningQuestionEditor } from './listening/ListeningQuestionEditor';

interface ListeningResourceEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: Resource | null;
  folders: MaterialFolder[];
  onSaveSuccess: () => void;
  updateResource: (id: string, updates: Partial<Resource>) => Promise<any>;
}

export const ListeningResourceEditorModal: React.FC<ListeningResourceEditorModalProps> = ({
  isOpen,
  onClose,
  resource,
  folders,
  onSaveSuccess,
  updateResource,
}) => {
  if (!isOpen || !resource) return null;

  const [title, setTitle] = useState(resource.title || '');
  const [folderId, setFolderId] = useState<string | null>(resource.folderId || null);
  const [audioUrl, setAudioUrl] = useState(resource.audioUrl || resource.url || '');
  const [activePartIndex, setActivePartIndex] = useState(0);
  const [parts, setParts] = useState<ListeningPart[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<AudioUploadProgress | null>(null);
  const audioInputRef = React.useRef<HTMLInputElement>(null);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isUploadingAudio) return;

    setIsUploadingAudio(true);
    setUploadProgress({
      loaded: 0,
      total: file.size,
      percentage: 0,
      speedBytesPerSec: 0,
      status: 'uploading',
    });
    setErrorMessage('');

    try {
      const url = await uploadMediaFile(file, 'audio', `listening_${Date.now()}_${file.name}`, {
        onProgress: (p) => setUploadProgress(p),
      });
      setAudioUrl(url);
      setUploadProgress(null);
    } catch (err: any) {
      console.error('Audio upload error:', err);
      setErrorMessage(`Lỗi tải lên audio: ${err.message}`);
    } finally {
      setIsUploadingAudio(false);
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  // Initialize parts from resource
  useEffect(() => {
    setTitle(resource.title || '');
    setFolderId(resource.folderId || null);
    setAudioUrl(resource.audioUrl || resource.url || '');
    setActivePartIndex(0);
    setSaveSuccess(false);
    setErrorMessage('');

    let parsedContent: ListeningTestContent | null = null;
    if (resource.listeningContent) {
      parsedContent = resource.listeningContent;
    } else if (resource.content) {
      if (typeof resource.content === 'object') {
        parsedContent = (resource.content as any).listeningContent || resource.content;
      } else if (typeof resource.content === 'string') {
        try {
          const json = JSON.parse(resource.content);
          parsedContent = json.listeningContent || json;
        } catch {
          // Parse plain text using parser
          parsedContent = parseListeningDocument(resource.content, resource.title);
        }
      }
    }

    if (parsedContent && Array.isArray(parsedContent.parts) && parsedContent.parts.length > 0) {
      setParts(parsedContent.parts);
      if (parsedContent.audioUrl && !resource.audioUrl && !resource.url) {
        setAudioUrl(parsedContent.audioUrl);
      }
    } else {
      // Fallback: 4 empty parts
      setParts([
        { partNumber: 1, title: 'Part 1: Conversation in Everyday Context', questionGroups: [], questions: [] },
        { partNumber: 2, title: 'Part 2: Monologue in Everyday Context', questionGroups: [], questions: [] },
        { partNumber: 3, title: 'Part 3: Discussion in Educational Context', questionGroups: [], questions: [] },
        { partNumber: 4, title: 'Part 4: Academic Lecture', questionGroups: [], questions: [] },
      ]);
    }
  }, [resource]);

  const activePart = parts[activePartIndex] || {
    partNumber: activePartIndex + 1,
    title: `Part ${activePartIndex + 1}`,
    questionGroups: [],
    questions: [],
  };

  // Save changes
  const handleSave = async () => {
    if (!title.trim()) {
      setErrorMessage('Tiêu đề tài liệu không được để trống.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const allExtractedQuestions = parts.flatMap((p) =>
        p.questions?.length ? p.questions : (p.questionGroups || []).flatMap((g) => g.questions || [])
      );

      const finalContent: ListeningTestContent = {
        title: title.trim(),
        audioUrl: audioUrl.trim() || undefined,
        parts: parts.map((p) => ({
          ...p,
          questions: p.questions?.length ? p.questions : (p.questionGroups || []).flatMap((g) => g.questions || []),
        })),
        totalQuestions: allExtractedQuestions.length,
      };

      const selectedFolder = folders.find((f) => f.id === folderId);

      await updateResource(resource.id, {
        title: title.trim(),
        audioUrl: audioUrl.trim() || undefined,
        url: audioUrl.trim() || resource.url,
        folderId: folderId || null,
        folder: selectedFolder?.name || undefined,
        listeningContent: finalContent,
        content: JSON.stringify(finalContent),
        skill: 'listening',
      });

      setSaveSuccess(true);
      setTimeout(() => {
        onSaveSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể lưu thay đổi.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalQuestions = parts.reduce(
    (acc, p) =>
      acc +
      (p.questions?.length ||
        (p.questionGroups || []).reduce((gAcc, g) => gAcc + (g.questions?.length || 0), 0)),
    0
  );

  return (
    <Portal containerId="modal-root">
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
          {/* HEADER */}
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs">
                <Headphones className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Chi tiết & Chỉnh sửa Tài liệu Listening</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/50 text-white border border-white/20">
                    {totalQuestions} Câu hỏi
                  </span>
                </h3>
                <p className="text-xs text-emerald-100">
                  Xem và cấu hình 4 Parts, nhóm câu hỏi, đáp án và file âm thanh
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* TOP METADATA BAR */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tiêu đề tài liệu *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Cambridge IELTS 18 Test 1 Listening"
                className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Music className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Link file Audio chung (URL / Supabase Storage)</span>
                </label>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac"
                  className="hidden"
                  onChange={handleAudioUpload}
                />
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  disabled={isUploadingAudio}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingAudio ? 'Đang tải...' : 'Tải file audio lên'}</span>
                </button>
              </div>
              <input
                type="text"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://.../audio.mp3"
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              {isUploadingAudio && uploadProgress && (
                <div className="mt-2 p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-emerald-900 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      {uploadProgress.status === 'processing'
                        ? 'Đang hoàn tất xử lý...'
                        : uploadProgress.status === 'retrying'
                        ? 'Đang tự động kết nối lại...'
                        : 'Đang tải lên Supabase Storage...'}
                    </span>
                    <span className="font-mono">{uploadProgress.percentage}%</span>
                  </div>
                  <div className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-1.5 rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress.percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-emerald-700 font-mono">
                    <span>
                      {(uploadProgress.loaded / (1024 * 1024)).toFixed(1)} MB / {(uploadProgress.total / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    {(uploadProgress.speedBytesPerSec ?? 0) > 0 && (
                      <span>{((uploadProgress.speedBytesPerSec ?? 0) / 1024).toFixed(0)} KB/s</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-amber-500" />
                <span>Thư mục lưu trữ</span>
              </label>
              <select
                value={folderId || ''}
                onChange={(e) => setFolderId(e.target.value || null)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Thư mục gốc (Root)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* AUDIO TEST PLAYER BANNER */}
          {(audioUrl || activePart.audioUrl) && (
            <div className="px-6 py-2 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2 text-xs text-emerald-900 font-semibold truncate">
                <Play className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Phát thử âm thanh:</span>
                <span className="font-mono text-[11px] text-emerald-700 truncate">
                  {activePart.audioUrl || audioUrl}
                </span>
              </div>
              <audio
                controls
                src={activePart.audioUrl || audioUrl}
                className="h-8 max-w-xs shrink-0"
              />
            </div>
          )}

          {/* QUESTION-TYPE-SPECIFIC LISTENING EDITOR */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            <ListeningQuestionEditor
              parts={parts}
              activePartIndex={activePartIndex}
              onActivePartIndexChange={setActivePartIndex}
              onChange={(updated) => setParts(updated)}
            />
          </div>

          {/* FOOTER */}
          <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
            <div>
              {errorMessage && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {saveSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Đã lưu tài liệu thành công!</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};
