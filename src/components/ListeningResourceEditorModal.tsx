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

  // Update a field in the active part
  const updateActivePart = (updates: Partial<ListeningPart>) => {
    setParts((prev) =>
      prev.map((p, idx) => (idx === activePartIndex ? { ...p, ...updates } : p))
    );
  };

  // Add question to active part
  const handleAddQuestionToActivePart = (groupIdx?: number) => {
    const allQuestionsInPart = activePart.questions || [];
    const nextQNum = allQuestionsInPart.length > 0
      ? Math.max(...allQuestionsInPart.map((q) => q.questionNumber || 0)) + 1
      : activePartIndex * 10 + 1;

    const newQuestion: ListeningQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      questionNumber: nextQNum,
      type: 'note_completion',
      prompt: '',
      correctAnswer: '',
      explanation: '',
    };

    if (groupIdx !== undefined && activePart.questionGroups?.[groupIdx]) {
      const updatedGroups = [...(activePart.questionGroups || [])];
      updatedGroups[groupIdx] = {
        ...updatedGroups[groupIdx],
        questions: [...(updatedGroups[groupIdx].questions || []), newQuestion],
      };
      updateActivePart({
        questionGroups: updatedGroups,
        questions: [...(activePart.questions || []), newQuestion],
      });
    } else {
      updateActivePart({
        questions: [...(activePart.questions || []), newQuestion],
      });
    }
  };

  // Delete question from active part
  const handleDeleteQuestion = (qId: string) => {
    const updatedQuestions = (activePart.questions || []).filter((q) => q.id !== qId);
    const updatedGroups = (activePart.questionGroups || []).map((g) => ({
      ...g,
      questions: (g.questions || []).filter((q) => q.id !== qId),
    }));
    updateActivePart({
      questions: updatedQuestions,
      questionGroups: updatedGroups,
    });
  };

  // Update question
  const handleUpdateQuestion = (qId: string, updates: Partial<ListeningQuestion>) => {
    const updatedQuestions = (activePart.questions || []).map((q) =>
      q.id === qId ? { ...q, ...updates } : q
    );
    const updatedGroups = (activePart.questionGroups || []).map((g) => ({
      ...g,
      questions: (g.questions || []).map((q) => (q.id === qId ? { ...q, ...updates } : q)),
    }));
    updateActivePart({
      questions: updatedQuestions,
      questionGroups: updatedGroups,
    });
  };

  // Add a new question group
  const handleAddQuestionGroup = () => {
    const newGroup: ListeningQuestionGroup = {
      id: `grp_${Date.now()}`,
      title: `Questions ${activePart.questions?.length ? activePart.questions.length + 1 : 1}–${(activePart.questions?.length || 0) + 5}`,
      type: 'note_completion',
      instructions: 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER.',
      wordLimit: 'NO MORE THAN TWO WORDS AND/OR A NUMBER',
      questions: [],
    };
    updateActivePart({
      questionGroups: [...(activePart.questionGroups || []), newGroup],
    });
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

          {/* PART TABS */}
          <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 shrink-0 gap-1 overflow-x-auto">
            {parts.map((p, idx) => {
              const qCount =
                p.questions?.length ||
                (p.questionGroups || []).reduce((acc, g) => acc + (g.questions?.length || 0), 0);
              const isActive = idx === activePartIndex;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePartIndex(idx)}
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Part {p.partNumber || idx + 1}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {qCount} Qs
                  </span>
                </button>
              );
            })}
          </div>

          {/* PART CONTENT BODY */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
            {/* Part Settings */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Cấu hình Part {activePart.partNumber || activePartIndex + 1}
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddQuestionGroup}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Thêm Nhóm câu hỏi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddQuestionToActivePart()}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Thêm câu hỏi</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Tiêu đề phần nghe
                  </label>
                  <input
                    type="text"
                    value={activePart.title || ''}
                    onChange={(e) => updateActivePart({ title: e.target.value })}
                    placeholder={`Part ${activePartIndex + 1}: Conversation / Monologue...`}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:bg-white focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Audio riêng cho Part {activePartIndex + 1} (Nếu có)
                  </label>
                  <input
                    type="text"
                    value={activePart.audioUrl || ''}
                    onChange={(e) => updateActivePart({ audioUrl: e.target.value })}
                    placeholder="URL file audio riêng của Part này..."
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:bg-white focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Question Groups & Questions */}
            {activePart.questionGroups && activePart.questionGroups.length > 0 ? (
              <div className="space-y-4">
                {activePart.questionGroups.map((grp, gIdx) => (
                  <div
                    key={grp.id || gIdx}
                    className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center">
                          {gIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={grp.title || ''}
                          onChange={(e) => {
                            const updatedGroups = [...(activePart.questionGroups || [])];
                            updatedGroups[gIdx] = { ...updatedGroups[gIdx], title: e.target.value };
                            updateActivePart({ questionGroups: updatedGroups });
                          }}
                          placeholder="Tiêu đề nhóm (VD: Questions 1-5)"
                          className="font-bold text-xs text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-emerald-500 outline-hidden px-1"
                        />
                        <span className="text-[10px] font-mono text-slate-400">
                          ({grp.type || 'completion'})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddQuestionToActivePart(gIdx)}
                          className="px-2 py-0.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Thêm câu vào nhóm</span>
                        </button>
                      </div>
                    </div>

                    {/* Group Instructions */}
                    <input
                      type="text"
                      value={grp.instructions || ''}
                      onChange={(e) => {
                        const updatedGroups = [...(activePart.questionGroups || [])];
                        updatedGroups[gIdx] = { ...updatedGroups[gIdx], instructions: e.target.value };
                        updateActivePart({ questionGroups: updatedGroups });
                      }}
                      placeholder="Hướng dẫn nhóm (VD: Complete the table below. Write NO MORE THAN TWO WORDS...)"
                      className="w-full text-xs text-slate-600 italic bg-slate-50 px-2 py-1 rounded border border-slate-200 outline-hidden"
                    />

                    {/* Questions in group */}
                    <div className="space-y-2 pt-1">
                      {(grp.questions || []).map((q) => (
                        <div
                          key={q.id}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 hover:border-emerald-300 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="w-6 h-6 rounded-md bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                                {q.questionNumber || q.number || 'Q'}
                              </span>
                            </div>
                            <input
                              type="text"
                              value={q.prompt || ''}
                              onChange={(e) => handleUpdateQuestion(q.id, { prompt: e.target.value })}
                              placeholder="Nội dung câu hỏi / Câu có chỗ trống..."
                              className="flex-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded outline-hidden focus:border-emerald-500 font-medium text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition cursor-pointer"
                              title="Xóa câu hỏi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-8">
                            <div>
                              <label className="block text-[10px] font-bold text-emerald-800 mb-0.5">
                                Đáp án chính xác *
                              </label>
                              <input
                                type="text"
                                value={q.correctAnswer || ''}
                                onChange={(e) =>
                                  handleUpdateQuestion(q.id, { correctAnswer: e.target.value })
                                }
                                placeholder="Đáp án đúng (VD: library / B)"
                                className="w-full px-2 py-1 text-xs bg-emerald-50/70 border border-emerald-300 rounded outline-hidden text-emerald-950 font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                Giải thích / Audio script
                              </label>
                              <input
                                type="text"
                                value={q.explanation || ''}
                                onChange={(e) =>
                                  handleUpdateQuestion(q.id, { explanation: e.target.value })
                                }
                                placeholder="Đoạn thoại trích dẫn giải thích đáp án..."
                                className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded outline-hidden text-slate-700"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Standalone questions if no groups */
              <div className="space-y-2">
                {(activePart.questions || []).map((q) => (
                  <div
                    key={q.id}
                    className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="w-6 h-6 rounded-md bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {q.questionNumber || q.number || 'Q'}
                      </span>
                      <input
                        type="text"
                        value={q.prompt || ''}
                        onChange={(e) => handleUpdateQuestion(q.id, { prompt: e.target.value })}
                        placeholder="Nội dung câu hỏi..."
                        className="flex-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded outline-hidden focus:border-emerald-500 font-medium text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pl-8">
                      <div>
                        <input
                          type="text"
                          value={q.correctAnswer || ''}
                          onChange={(e) =>
                            handleUpdateQuestion(q.id, { correctAnswer: e.target.value })
                          }
                          placeholder="Đáp án chính xác"
                          className="w-full px-2 py-1 text-xs bg-emerald-50/70 border border-emerald-300 rounded outline-hidden text-emerald-950 font-semibold"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={q.explanation || ''}
                          onChange={(e) =>
                            handleUpdateQuestion(q.id, { explanation: e.target.value })
                          }
                          placeholder="Giải thích / Audio script"
                          className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded outline-hidden text-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {(!activePart.questions || activePart.questions.length === 0) && (
                  <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300 space-y-2">
                    <Headphones className="w-8 h-8 text-slate-300 mx-auto" />
                    <div className="text-xs font-bold text-slate-700">Chưa có câu hỏi trong Part này</div>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Nhấn nút &quot;Thêm câu hỏi&quot; hoặc &quot;Thêm Nhóm câu hỏi&quot; ở trên để tạo câu hỏi cho phần nghe này.
                    </p>
                  </div>
                )}
              </div>
            )}
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
