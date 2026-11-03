import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Headphones,
  FileText,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Plus,
  Folder,
  ArrowRight,
  HelpCircle,
  Volume2,
  Loader2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { processDocumentFile } from '../lib/documentExtractor';
import { parseListeningDocument } from '../lib/listeningExtractor';
import { uploadMediaFile } from '../lib/mediaStorage';
import type { AudioUploadProgress } from '../lib/optimizedAudioUploader';
import { ListeningQuestionEditor } from './listening/ListeningQuestionEditor';
import { Portal } from './Portal';
import type { ListeningTestContent, ListeningPart, ListeningQuestion } from '../types/index.ts';

interface ListeningImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  targetFolderId?: string | null;
  targetFolderName?: string;
}

export const ListeningImportModal: React.FC<ListeningImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  targetFolderId,
  targetFolderName,
}) => {
  const { currentUser, courses, addResource, createAssignment } = useApp();

  // Wizard steps: 'upload' -> 'review'
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // File and extracted content
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [content, setContent] = useState<ListeningTestContent | null>(null);
  const [activePartIndex, setActivePartIndex] = useState(0);

  // Audio mode: 'single' (whole test) vs 'per-part'
  const [audioMode, setAudioMode] = useState<'single' | 'per_part'>('single');
  const [overallAudioUrl, setOverallAudioUrl] = useState<string>('');
  const [overallAudioName, setOverallAudioName] = useState<string>('');
  const [partAudios, setPartAudios] = useState<Record<number, { url: string; name: string }>>({});
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [audioUploadProgress, setAudioUploadProgress] = useState<AudioUploadProgress | null>(null);
  const [lastFailedAudio, setLastFailedAudio] = useState<{ file: File; isPart: boolean; partNum?: number } | null>(null);

  // Resource / Assignment metadata
  const [targetTitle, setTargetTitle] = useState('');
  const [targetFolder, setTargetFolder] = useState(targetFolderName || (targetFolderId ? '' : 'Listening Tests'));
  const [targetCourseId, setTargetCourseId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const partAudioInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadingPartNum, setCurrentUploadingPartNum] = useState<number | null>(null);

  if (!isOpen) return null;

  // Handle PDF / DOCX file drop or select
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setErrorMsg(null);
    setIsProcessing(true);
    setProcessStatus('Đang đọc nội dung tài liệu...');
    setFileName(file.name);

    try {
      const doc = await processDocumentFile(file);
      if (doc.status === 'error' || !doc.rawText) {
        throw new Error(doc.errorMessage || 'Không thể trích xuất văn bản từ tài liệu này.');
      }

      setRawText(doc.rawText);
      setProcessStatus('Đang phân tích Sections, câu hỏi và đáp án...');

      const parsed = parseListeningDocument(doc.rawText, file.name);
      setContent(parsed);
      setTargetTitle(parsed.title || file.name.replace(/\.[^/.]+$/, ''));
      setActivePartIndex(0);
      setStep('review');
    } catch (err: any) {
      console.error('Listening import error:', err);
      setErrorMsg(err.message || 'Lỗi khi trích xuất tài liệu Listening.');
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  const executeAudioUpload = async (file: File, isPart: boolean, partNum?: number) => {
    setIsUploadingAudio(true);
    setAudioUploadProgress({
      loaded: 0,
      total: file.size,
      percentage: 0,
      speedBytesPerSec: 0,
      status: 'uploading',
    });
    setErrorMsg(null);
    setLastFailedAudio(null);

    try {
      const fileName = isPart && partNum
        ? `listening_part${partNum}_${file.name}`
        : `listening_${Date.now()}_${file.name}`;

      const url = await uploadMediaFile(file, 'audio', fileName, {
        onProgress: (p) => setAudioUploadProgress(p),
      });

      if (isPart && partNum) {
        setPartAudios((prev) => ({
          ...prev,
          [partNum]: { url, name: file.name },
        }));

        if (content) {
          const updatedParts = content.parts.map((p) =>
            p.partNumber === partNum ? { ...p, audioUrl: url } : p
          );
          setContent({ ...content, parts: updatedParts });
        }
      } else {
        setOverallAudioUrl(url);
        setOverallAudioName(file.name);
        if (content) {
          setContent({ ...content, audioUrl: url });
        }
      }
      setAudioUploadProgress(null);
    } catch (err: any) {
      console.error('Audio upload error:', err);
      setErrorMsg(`Lỗi tải lên audio: ${err.message}`);
      setLastFailedAudio({ file, isPart, partNum });
    } finally {
      setIsUploadingAudio(false);
      setCurrentUploadingPartNum(null);
      if (audioInputRef.current) audioInputRef.current.value = '';
      if (partAudioInputRef.current) partAudioInputRef.current.value = '';
    }
  };

  // Handle Test-wide Audio Upload
  const handleUploadOverallAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isUploadingAudio) return;
    await executeAudioUpload(file, false);
  };

  // Handle Per-part Audio Upload
  const handleUploadPartAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || currentUploadingPartNum === null || isUploadingAudio) return;
    await executeAudioUpload(file, true, currentUploadingPartNum);
  };

  const handleUpdateQuestionAnswer = (partIdx: number, qIdx: number, newAnswer: string) => {
    if (!content) return;
    const parts = [...content.parts];
    const targetPart = { ...parts[partIdx] };
    const questions = [...targetPart.questions];
    questions[qIdx] = { ...questions[qIdx], correctAnswer: newAnswer };
    targetPart.questions = questions;
    parts[partIdx] = targetPart;
    setContent({ ...content, parts });
  };

  const handleSaveToLibrary = async (createAsAssignment: boolean = false) => {
    if (!content || !currentUser) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      // Build final content with audio URLs
      const finalParts = content.parts.map((p) => ({
        ...p,
        audioUrl: audioMode === 'per_part' ? partAudios[p.partNumber]?.url || p.audioUrl : overallAudioUrl || content.audioUrl,
      }));

      const finalContent: ListeningTestContent = {
        ...content,
        title: targetTitle.trim() || content.title,
        audioUrl: audioMode === 'single' ? overallAudioUrl : undefined,
        parts: finalParts,
      };

      // Save as Resource
      await addResource({
        title: targetTitle.trim() || content.title || 'IELTS Listening Test',
        type: 'audio',
        skill: 'listening',
        url: overallAudioUrl || undefined,
        audioUrl: overallAudioUrl || undefined,
        content: JSON.stringify(finalContent),
        listeningContent: finalContent,
        folder: targetFolderName !== undefined ? (targetFolderName || undefined) : (targetFolder.trim() || undefined),
        folderId: targetFolderId || null,
        courseId: targetCourseId || null,
        tags: [],
        isPublished: true,
      });

      // Optionally also create an assignment
      if (createAsAssignment) {
        const allQuestions = finalParts.flatMap((p) => p.questions);
        await createAssignment({
          title: targetTitle.trim() || content.title || 'IELTS Listening Test',
          courseId: targetCourseId || courses[0]?.id || 'course_default',
          skill: 'listening',
          instructions: `Bài tập nghe IELTS Listening gồm ${finalParts.length} Sections (${allQuestions.length} câu hỏi).`,
          objectives: 'Luyện tập kỹ năng IELTS Listening theo cấu trúc chuẩn.',
          status: 'published',
          dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
          listeningContent: finalContent,
          listeningParts: finalParts,
          listeningAudioUrl: overallAudioUrl || undefined,
          questions: allQuestions.map((q, idx) => ({
            id: `lq_${idx + 1}`,
            number: q.questionNumber || idx + 1,
            questionNumber: q.questionNumber || idx + 1,
            type: q.type || 'multiple_choice',
            prompt: q.prompt || '',
            options: q.options || [],
            correctAnswer: q.correctAnswer || '',
            explanation: q.explanation || '',
          })),
        });
      }

      setSaveSuccessMsg(createAsAssignment ? 'Đã lưu vào Thư viện và tạo Bài tập Listening thành công!' : 'Đã lưu tài liệu Listening vào Thư viện thành công!');
      onSuccess?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Save listening resource error:', err);
      setErrorMsg(err.message || 'Không thể lưu tài liệu Listening.');
    } finally {
      setIsSaving(false);
    }
  };

  const activePart = content?.parts[activePartIndex];

  return (
    <Portal containerId="modal-root">
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-purple-50/60 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Import Tài liệu IELTS Listening
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 uppercase tracking-wider">
                  PDF & DOCX
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Tự động nhận diện Sections 1-4, câu hỏi, nhóm đề và đáp án. Gắn file âm thanh trực tiếp.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {saveSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span className="font-semibold">{saveSuccessMsg}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD FILE */}
          {step === 'upload' && (
            <div className="space-y-6 max-w-2xl mx-auto py-8">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-purple-300 hover:border-purple-500 rounded-2xl p-10 text-center bg-purple-50/20 hover:bg-purple-50/50 transition-all cursor-pointer group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  Chọn hoặc kéo thả đề Listening vào đây
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Hỗ trợ định dạng <strong>PDF</strong> hoặc <strong>DOCX</strong> (đề thi, transcript hoặc phiếu bài làm)
                </p>
                <span className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors">
                  Duyệt file từ máy tính
                </span>
              </div>

              {isProcessing && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center space-x-3 text-xs text-slate-700">
                  <RefreshCw className="w-4 h-4 text-purple-600 animate-spin" />
                  <span className="font-semibold">{processStatus}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: REVIEW & AUDIO ATTACHMENT */}
          {step === 'review' && content && (
            <div className="space-y-6">
              {/* Top Meta Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Tiêu đề bài nghe:</label>
                  <input
                    type="text"
                    value={targetTitle}
                    onChange={(e) => setTargetTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    placeholder="VD: Cambridge 18 Test 1 Listening"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Thư mục lưu trữ:</label>
                  <input
                    type="text"
                    value={targetFolder}
                    onChange={(e) => setTargetFolder(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-800 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    placeholder="Listening Tests"
                  />
                </div>
              </div>

              {/* AUDIO CONFIGURATION PANEL */}
              <div className="p-5 bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-slate-50 rounded-2xl border border-purple-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-200/80">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-purple-600" />
                      Tải lên file âm thanh (Listening Audio)
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Đính kèm file âm thanh thực tế cho học sinh nghe. Hỗ trợ MP3, WAV, M4A, WEBM.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 bg-white p-1 rounded-xl border border-purple-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setAudioMode('single')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        audioMode === 'single'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Toàn bài (1 Audio)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioMode('per_part')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        audioMode === 'per_part'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Từng Section riêng
                    </button>
                  </div>
                </div>

                {/* Hidden File Inputs */}
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac"
                  className="hidden"
                  onChange={handleUploadOverallAudio}
                />
                <input
                  ref={partAudioInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac"
                  className="hidden"
                  onChange={handleUploadPartAudio}
                />

                {/* Single Audio Mode */}
                {audioMode === 'single' && (
                  <div className="space-y-3">
                    {overallAudioUrl ? (
                      <div className="p-4 bg-white rounded-xl border border-purple-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                            <span className="text-xs font-bold text-slate-900">
                              {overallAudioName || 'Audio bài nghe chung'}
                            </span>
                          </div>
                          <audio controls src={overallAudioUrl} className="w-full h-8" />
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => audioInputRef.current?.click()}
                            disabled={isUploadingAudio}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Thay thế</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOverallAudioUrl('');
                              setOverallAudioName('');
                              if (content) setContent({ ...content, audioUrl: '' });
                            }}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-dashed border-purple-300">
                        <span className="text-xs text-slate-600">
                          Chưa có file âm thanh cho bài thi này.
                        </span>
                        <button
                          type="button"
                          onClick={() => audioInputRef.current?.click()}
                          disabled={isUploadingAudio}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                        >
                          <Upload className="w-4 h-4" />
                          <span>{isUploadingAudio ? 'Đang tải lên...' : 'Tải lên Audio toàn bài'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Per-Part Audio Mode */}
                {audioMode === 'per_part' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {content.parts.map((p) => {
                      const partAudio = partAudios[p.partNumber]?.url || p.audioUrl;
                      const partName = partAudios[p.partNumber]?.name;
                      return (
                        <div key={p.partNumber} className="p-3 bg-white rounded-xl border border-purple-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">
                              Part / Section {p.partNumber}
                            </span>
                            {partAudio && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPartAudios((prev) => {
                                    const next = { ...prev };
                                    delete next[p.partNumber];
                                    return next;
                                  });
                                  const updatedParts = content.parts.map((part) =>
                                    part.partNumber === p.partNumber ? { ...part, audioUrl: undefined } : part
                                  );
                                  setContent({ ...content, parts: updatedParts });
                                }}
                                className="text-[11px] text-rose-600 hover:underline"
                              >
                                Xóa
                              </button>
                            )}
                          </div>

                          {partAudio ? (
                            <audio controls src={partAudio} className="w-full h-8" />
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentUploadingPartNum(p.partNumber);
                                partAudioInputRef.current?.click();
                              }}
                              disabled={isUploadingAudio}
                              className="w-full py-2 border border-dashed border-purple-300 hover:border-purple-500 rounded-lg text-xs font-semibold text-purple-700 hover:bg-purple-50/50 flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Tải audio cho Part {p.partNumber}</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Audio Upload Realtime Progress */}
                {isUploadingAudio && audioUploadProgress && (
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-2">
                    <div className="flex items-center justify-between text-xs text-purple-900 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                        {audioUploadProgress.status === 'processing'
                          ? 'Đang hoàn tất lưu trữ Supabase Storage...'
                          : audioUploadProgress.status === 'retrying'
                          ? 'Đang tự động thử lại kết nối...'
                          : 'Đang tải lên Supabase Storage...'}
                      </span>
                      <span className="font-mono">{audioUploadProgress.percentage}%</span>
                    </div>
                    <div className="w-full bg-purple-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all duration-200"
                        style={{ width: `${audioUploadProgress.percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-purple-600 font-mono">
                      <span>
                        {(audioUploadProgress.loaded / (1024 * 1024)).toFixed(1)} MB / {(audioUploadProgress.total / (1024 * 1024)).toFixed(1)} MB
                      </span>
                      {(audioUploadProgress.speedBytesPerSec ?? 0) > 0 && (
                        <span>{((audioUploadProgress.speedBytesPerSec ?? 0) / 1024).toFixed(0)} KB/s</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Audio Upload Retry Banner */}
                {lastFailedAudio && !isUploadingAudio && (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex items-center justify-between gap-3">
                    <div className="text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>
                        Tải lên thất bại: <strong className="font-semibold">{lastFailedAudio.file.name}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => executeAudioUpload(lastFailedAudio.file, lastFailedAudio.isPart, lastFailedAudio.partNum)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Thử lại ngay</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Question-Type-Specific Interactive Editor & Review */}
              <ListeningQuestionEditor
                parts={content.parts}
                activePartIndex={activePartIndex}
                onActivePartIndexChange={setActivePartIndex}
                onChange={(updatedParts) => {
                  setContent({
                    ...content,
                    parts: updatedParts,
                    totalQuestions: updatedParts.reduce((sum, p) => sum + (p.questions?.length || 0), 0),
                  });
                }}
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          {step === 'review' ? (
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Quay lại chọn file
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Hủy
            </button>

            {step === 'review' && (
              <>
                <button
                  type="button"
                  onClick={() => handleSaveToLibrary(false)}
                  disabled={isSaving}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu vào Thư viện'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveToLibrary(true)}
                  disabled={isSaving}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <span>Lưu & Tạo bài tập online</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  </Portal>
);
};
