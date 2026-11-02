import React, { useState, useEffect } from 'react';
import { Resource, MaterialFolder, QuestionGroup, ReadingQuestion, QuestionType } from '../types';
import { Portal } from './Portal';
import {
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  FileText,
  ListFilter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Tag,
  Folder,
  Layers,
} from 'lucide-react';

interface ReadingResourceEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: Resource | null;
  folders: MaterialFolder[];
  onSaveSuccess: () => void;
  updateResource: (id: string, updates: Partial<Resource>) => Promise<any>;
}

interface EditablePassage {
  id: string;
  passageIndex: number;
  title: string;
  content: string;
  questionGroups: QuestionGroup[];
  questions: ReadingQuestion[];
}

const ALL_QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'note_completion', label: 'Note Completion' },
  { value: 'summary_completion', label: 'Summary Completion' },
  { value: 'sentence_completion', label: 'Sentence Completion' },
  { value: 'table_completion', label: 'Table Completion' },
  { value: 'flowchart_completion', label: 'Flow-chart Completion' },
  { value: 'diagram_completion', label: 'Diagram Labelling' },
  { value: 'form_completion', label: 'Form Completion' },
  { value: 'true_false_not_given', label: 'True / False / Not Given' },
  { value: 'yes_no_not_given', label: 'Yes / No / Not Given' },
  { value: 'multiple_choice', label: 'Multiple Choice (Single Answer)' },
  { value: 'multiple_select', label: 'Multiple Select (Choose TWO/THREE)' },
  { value: 'matching_headings', label: 'Matching Headings' },
  { value: 'matching_features', label: 'Matching Features / People' },
  { value: 'matching_information', label: 'Matching Information (Paragraphs A-G)' },
  { value: 'matching_sentence_endings', label: 'Matching Sentence Endings' },
  { value: 'short_answer', label: 'Short Answer Questions' },
];

export const ReadingResourceEditorModal: React.FC<ReadingResourceEditorModalProps> = ({
  isOpen,
  onClose,
  resource,
  folders,
  onSaveSuccess,
  updateResource,
}) => {
  const [activeTab, setActiveTab] = useState<'passages' | 'questions' | 'general'>('passages');
  const [activePassageIdx, setActivePassageIdx] = useState(0);

  const [resTitle, setResTitle] = useState('');
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [resTags, setResTags] = useState('');
  const [passages, setPassages] = useState<EditablePassage[]>([]);

  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && resource) {
      setResTitle(resource.title || '');
      setTargetFolderId(resource.folderId || null);
      setResTags((resource.tags || []).join(', '));
      setIsDirty(false);
      setErrorMessage(null);
      setActivePassageIdx(0);
      setActiveTab('passages');

      try {
        const parsed = resource.content ? JSON.parse(resource.content) : {};
        if (parsed.passages && Array.isArray(parsed.passages) && parsed.passages.length > 0) {
          setPassages(
            parsed.passages.map((p: any, idx: number) => ({
              id: p.id || `passage_${idx + 1}`,
              passageIndex: p.passageIndex || idx + 1,
              title: p.title || `Passage ${idx + 1}`,
              content: p.content || '',
              questionGroups: p.questionGroups || [],
              questions: p.questions || [],
            }))
          );
        } else {
          // Single passage material
          const pContent = parsed.readingPassage || parsed.content || '';
          setPassages([
            {
              id: 'passage_1',
              passageIndex: 1,
              title: parsed.title || resource.title || 'Passage 1',
              content: pContent,
              questionGroups: parsed.questionGroups || [],
              questions: parsed.questions || [],
            },
          ]);
        }
      } catch (e) {
        setPassages([
          {
            id: 'passage_1',
            passageIndex: 1,
            title: resource.title || 'Passage 1',
            content: resource.content || '',
            questionGroups: [],
            questions: [],
          },
        ]);
      }
    }
  }, [isOpen, resource]);

  if (!isOpen || !resource) return null;

  const currentPassage = passages[activePassageIdx] || passages[0];

  const handleClose = () => {
    if (isDirty) {
      if (!confirm('Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn đóng mà không lưu không?')) {
        return;
      }
    }
    onClose();
  };

  const updateCurrentPassage = (updates: Partial<EditablePassage>) => {
    setIsDirty(true);
    setPassages((prev) => {
      const next = [...prev];
      if (next[activePassageIdx]) {
        next[activePassageIdx] = { ...next[activePassageIdx], ...updates };
      }
      return next;
    });
  };

  const handleUpdateGroup = (groupIndex: number, updates: Partial<QuestionGroup>) => {
    if (!currentPassage) return;
    setIsDirty(true);
    const updatedGroups = [...currentPassage.questionGroups];
    updatedGroups[groupIndex] = { ...updatedGroups[groupIndex], ...updates };
    updateCurrentPassage({ questionGroups: updatedGroups });
  };

  const handleUpdateQuestion = (
    groupIndex: number,
    questionIndex: number,
    updates: Partial<ReadingQuestion>
  ) => {
    if (!currentPassage) return;
    setIsDirty(true);
    const updatedGroups = [...currentPassage.questionGroups];
    const targetGroup = { ...updatedGroups[groupIndex] };
    const groupQuestions = [...targetGroup.questions];

    groupQuestions[questionIndex] = {
      ...groupQuestions[questionIndex],
      ...updates,
      isTeacherEdited: true,
    };
    targetGroup.questions = groupQuestions;
    updatedGroups[groupIndex] = targetGroup;

    // Synchronize passage-level flat questions list
    const allPassageQs = updatedGroups.flatMap((g) => g.questions);
    updateCurrentPassage({
      questionGroups: updatedGroups,
      questions: allPassageQs,
    });
  };

  const handleDeleteQuestion = (groupIndex: number, questionIndex: number) => {
    if (!currentPassage) return;
    if (!confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) return;
    setIsDirty(true);

    const updatedGroups = [...currentPassage.questionGroups];
    const targetGroup = { ...updatedGroups[groupIndex] };
    targetGroup.questions = targetGroup.questions.filter((_, idx) => idx !== questionIndex);
    updatedGroups[groupIndex] = targetGroup;

    const allPassageQs = updatedGroups.flatMap((g) => g.questions);
    updateCurrentPassage({
      questionGroups: updatedGroups,
      questions: allPassageQs,
    });
  };

  const handleAddQuestionToGroup = (groupIndex: number) => {
    if (!currentPassage) return;
    setIsDirty(true);

    const updatedGroups = [...currentPassage.questionGroups];
    const targetGroup = { ...updatedGroups[groupIndex] };
    const allQs = updatedGroups.flatMap((g) => g.questions);
    const nextQNum = allQs.length + 1;

    const newQ: ReadingQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: targetGroup.questionType,
      prompt: `${nextQNum}. Nhập nội dung câu hỏi hoặc điền khuyết...`,
      correctAnswer: '',
      explanation: '',
      isTeacherEdited: true,
      options:
        targetGroup.questionType === 'multiple_choice' || targetGroup.questionType === 'multiple_select'
          ? ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D']
          : undefined,
    };

    targetGroup.questions = [...targetGroup.questions, newQ];
    updatedGroups[groupIndex] = targetGroup;

    const allPassageQs = updatedGroups.flatMap((g) => g.questions);
    updateCurrentPassage({
      questionGroups: updatedGroups,
      questions: allPassageQs,
    });
  };

  const handleAddGroup = () => {
    if (!currentPassage) return;
    setIsDirty(true);

    const newGroup: QuestionGroup = {
      id: `group_${Date.now()}`,
      groupTitle: `Nhóm câu hỏi ${currentPassage.questionGroups.length + 1}`,
      instructions: 'Đọc kỹ đoạn văn và hoàn thành các câu hỏi bên dưới.',
      questionType: 'note_completion',
      questions: [],
    };

    updateCurrentPassage({
      questionGroups: [...currentPassage.questionGroups, newGroup],
    });
  };

  const handleDeleteGroup = (groupIndex: number) => {
    if (!currentPassage) return;
    if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ nhóm câu hỏi này?')) return;
    setIsDirty(true);

    const updatedGroups = currentPassage.questionGroups.filter((_, idx) => idx !== groupIndex);
    const allPassageQs = updatedGroups.flatMap((g) => g.questions);
    updateCurrentPassage({
      questionGroups: updatedGroups,
      questions: allPassageQs,
    });
  };

  const handleSaveAll = async () => {
    if (!resTitle.trim()) {
      setErrorMessage('Tiêu đề tài liệu không được để trống.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const targetFolder = targetFolderId ? folders.find((f) => f.id === targetFolderId) : null;
      let existingPayload: any = {};
      try {
        existingPayload = resource.content ? JSON.parse(resource.content) : {};
      } catch {}

      const allCombinedQs = passages.flatMap((p) => p.questions);
      const allCombinedGroups = passages.flatMap((p) => p.questionGroups);

      const isMulti = passages.length > 1;
      const updatedPayload = {
        ...existingPayload,
        title: resTitle.trim(),
        skill: 'reading',
        readingPassage: passages[0]?.content || '',
        content: passages[0]?.content || '',
        passages: passages,
        questionGroups: allCombinedGroups,
        questions: allCombinedQs,
        metadata: {
          ...(existingPayload.metadata || {}),
          lastEditedAt: new Date().toISOString(),
          passageCount: passages.length,
          questionCount: allCombinedQs.length,
        },
      };

      const tagsArray = resTags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // Save directly back to the SAME Resource ID in-place
      await updateResource(resource.id, {
        title: resTitle.trim(),
        folder: targetFolder ? targetFolder.name : undefined,
        folderId: targetFolderId || null,
        tags: tagsArray.length > 0 ? tagsArray : resource.tags,
        content: JSON.stringify(updatedPayload),
      });

      setIsDirty(false);
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update reading resource:', err);
      setErrorMessage(err.message || 'Lỗi khi lưu tài liệu Reading.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0 bg-slate-50/70 rounded-t-2xl">
            <div className="flex items-center space-x-3">
              <span className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                <Edit className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Chỉnh sửa tài liệu Reading</span>
                  {isDirty && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      Chưa lưu
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 truncate max-w-lg">
                  {resource.title} • {passages.length} Passage(s) •{' '}
                  {passages.reduce((sum, p) => sum + p.questions.length, 0)} Câu hỏi
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="m-4 mb-0 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-2 px-6 pt-3 border-b border-slate-200 bg-white shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('passages')}
              className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-colors ${
                activeTab === 'passages'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Nội dung Passage ({passages.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('questions')}
              className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-colors ${
                activeTab === 'questions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ListFilter className="w-4 h-4" />
              <span>
                Nhóm câu hỏi & Đáp án (
                {passages.reduce((sum, p) => sum + p.questions.length, 0)})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center space-x-1.5 transition-colors ${
                activeTab === 'general'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>Thông tin chung & Thư mục</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
            {/* Passage Selector Pills if > 1 Passage */}
            {passages.length > 1 && (
              <div className="flex items-center space-x-2 p-1.5 bg-slate-100 rounded-xl w-fit">
                {passages.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActivePassageIdx(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      activePassageIdx === idx
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Passage {idx + 1}: {p.title || `Passage ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}

            {/* TAB 1: PASSAGES */}
            {activeTab === 'passages' && currentPassage && (
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tiêu đề Passage:
                  </label>
                  <input
                    type="text"
                    value={currentPassage.title}
                    onChange={(e) => updateCurrentPassage({ title: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden"
                    placeholder="Tiêu đề bài đọc..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      Nội dung bài đọc (Đoạn văn, tiêu đề phụ, danh sách):
                    </label>
                    <span className="text-[11px] text-slate-400 font-semibold">
                      ~{currentPassage.content.split(/\s+/).filter(Boolean).length} từ •{' '}
                      {currentPassage.content.split('\n').filter(Boolean).length} dòng
                    </span>
                  </div>
                  <textarea
                    rows={16}
                    value={currentPassage.content}
                    onChange={(e) => updateCurrentPassage({ content: e.target.value })}
                    className="w-full p-3.5 border border-slate-300 rounded-xl font-mono text-xs text-slate-800 leading-relaxed focus:ring-2 focus:ring-blue-500 outline-hidden whitespace-pre-wrap"
                    placeholder="Nhập hoặc chỉnh sửa toàn bộ nội dung bài đọc tại đây..."
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Mẹo: Giữ nhãn đoạn văn (A, B, C...) ở đầu dòng để hệ thống tự động gán nhãn cho dạng câu hỏi Matching Information / Matching Headings.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: QUESTIONS & ANSWER KEYS */}
            {activeTab === 'questions' && currentPassage && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      Các nhóm câu hỏi của {currentPassage.title}
                    </h4>
                    <p className="text-slate-500 text-[11px]">
                      Chỉnh sửa dạng bài, hướng dẫn, nội dung câu hỏi, ô trống và đáp án chính xác.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddGroup}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold flex items-center space-x-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Thêm nhóm câu hỏi</span>
                  </button>
                </div>

                {currentPassage.questionGroups.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-400">
                    Chưa có nhóm câu hỏi nào cho bài đọc này. Bấm "+ Thêm nhóm câu hỏi" để tạo.
                  </div>
                ) : (
                  currentPassage.questionGroups.map((group, gIdx) => (
                    <div
                      key={group.id || gIdx}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 shadow-xs"
                    >
                      {/* Group Header Controls */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">
                              Tên nhóm:
                            </label>
                            <input
                              type="text"
                              value={group.groupTitle || ''}
                              onChange={(e) =>
                                handleUpdateGroup(gIdx, { groupTitle: e.target.value })
                              }
                              placeholder="Ví dụ: Questions 1-7"
                              className="w-full p-1.5 border border-slate-300 rounded-lg font-bold text-xs text-slate-800 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">
                              Dạng câu hỏi IELTS:
                            </label>
                            <select
                              value={group.questionType}
                              onChange={(e) =>
                                handleUpdateGroup(gIdx, {
                                  questionType: e.target.value as QuestionType,
                                })
                              }
                              className="w-full p-1.5 border border-slate-300 rounded-lg font-bold text-xs text-blue-700 bg-white"
                            >
                              {ALL_QUESTION_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAddQuestionToGroup(gIdx)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm câu hỏi</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(gIdx)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Xóa nhóm này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Instructions */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          Hướng dẫn làm bài (Instructions):
                        </label>
                        <input
                          type="text"
                          value={group.instructions || ''}
                          onChange={(e) =>
                            handleUpdateGroup(gIdx, { instructions: e.target.value })
                          }
                          placeholder="Ví dụ: Complete the notes below. Choose ONE WORD ONLY from the passage..."
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs text-slate-800 bg-white"
                        />
                      </div>

                      {/* Questions in Group */}
                      <div className="space-y-2.5 pt-1">
                        <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          Danh sách câu hỏi ({group.questions.length}):
                        </div>

                        {group.questions.map((q, qIdx) => (
                          <div
                            key={q.id || qIdx}
                            className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 hover:border-slate-300 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 font-extrabold text-[11px] flex items-center justify-center shrink-0">
                                    {qIdx + 1}
                                  </span>
                                  <input
                                    type="text"
                                    value={q.prompt}
                                    onChange={(e) =>
                                      handleUpdateQuestion(gIdx, qIdx, {
                                        prompt: e.target.value,
                                      })
                                    }
                                    placeholder="Nội dung câu hỏi / Điền từ..."
                                    className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:border-blue-500 outline-hidden"
                                  />
                                </div>

                                {/* Options for Multiple Choice */}
                                {(q.type === 'multiple_choice' ||
                                  q.type === 'multiple_select' ||
                                  group.questionType === 'multiple_choice' ||
                                  group.questionType === 'multiple_select') && (
                                  <div className="pl-8 space-y-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                      Các phương án lựa chọn:
                                    </span>
                                    {(q.options || ['A', 'B', 'C', 'D']).map((opt, optIdx) => (
                                      <div key={optIdx} className="flex items-center space-x-1.5">
                                        <span className="w-5 text-[11px] font-bold text-slate-500">
                                          {String.fromCharCode(65 + optIdx)}.
                                        </span>
                                        <input
                                          type="text"
                                          value={opt}
                                          onChange={(e) => {
                                            const newOpts = [...(q.options || ['A', 'B', 'C', 'D'])];
                                            newOpts[optIdx] = e.target.value;
                                            handleUpdateQuestion(gIdx, qIdx, {
                                              options: newOpts,
                                            });
                                          }}
                                          className="flex-1 p-1 border border-slate-200 rounded text-xs bg-slate-50/50"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Correct Answer & Citation */}
                                <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                  <div>
                                    <label className="block text-[10px] font-bold text-emerald-700 uppercase">
                                      Đáp án chính xác (Correct Answer):
                                    </label>
                                    <input
                                      type="text"
                                      value={q.correctAnswer || ''}
                                      onChange={(e) =>
                                        handleUpdateQuestion(gIdx, qIdx, {
                                          correctAnswer: e.target.value,
                                        })
                                      }
                                      placeholder="Đáp án (ví dụ: TRUE, C, 1990...)"
                                      className="w-full p-1.5 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50/40 focus:ring-1 focus:ring-emerald-500 outline-hidden"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">
                                      Giải thích / Trích dẫn (Citation):
                                    </label>
                                    <input
                                      type="text"
                                      value={q.citation || q.explanation || ''}
                                      onChange={(e) =>
                                        handleUpdateQuestion(gIdx, qIdx, {
                                          citation: e.target.value,
                                          explanation: e.target.value,
                                        })
                                      }
                                      placeholder="Vị trí câu trích dẫn trong bài đọc..."
                                      className="w-full p-1.5 border border-slate-200 rounded-lg text-xs text-slate-600"
                                    />
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteQuestion(gIdx, qIdx)}
                                className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-50 transition-colors"
                                title="Xóa câu hỏi"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 3: GENERAL INFO & FOLDERS */}
            {activeTab === 'general' && (
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tên tài liệu trong thư viện:
                  </label>
                  <input
                    type="text"
                    value={resTitle}
                    onChange={(e) => {
                      setIsDirty(true);
                      setResTitle(e.target.value);
                    }}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Thư mục lưu trữ:
                  </label>
                  <select
                    value={targetFolderId || ''}
                    onChange={(e) => {
                      setIsDirty(true);
                      setTargetFolderId(e.target.value || null);
                    }}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  >
                    <option value="">📁 Thư viện gốc (Không phân thư mục)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tags (phân cách bằng dấu phẩy):
                  </label>
                  <input
                    type="text"
                    value={resTags}
                    onChange={(e) => {
                      setIsDirty(true);
                      setResTags(e.target.value);
                    }}
                    placeholder="ví dụ: cambridge, mock test, reading"
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50/70 rounded-b-2xl shrink-0 text-xs">
            <span className="text-slate-500 text-[11px]">
              Tài liệu được cập nhật trực tiếp vào ID: <code className="font-mono text-slate-700">{resource.id}</code>
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSubmitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};
