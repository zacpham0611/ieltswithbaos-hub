import React, { useState, useEffect } from 'react';
import { Resource, MaterialFolder } from '../types';
import { Portal } from './Portal';
import {
  Sparkles,
  ArrowUp,
  ArrowDown,
  BookOpen,
  Folder,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
} from 'lucide-react';

interface MergePassagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPassageIds: string[];
  resources: Resource[];
  folders: MaterialFolder[];
  currentFolderId: string | null;
  onMergeSuccess: (newResourceId: string) => void;
  addResource: (data: Omit<Resource, 'id' | 'teacherId' | 'createdAt'>) => Promise<any>;
  updateResource: (id: string, updates: Partial<Resource>) => Promise<any>;
}

export const MergePassagesModal: React.FC<MergePassagesModalProps> = ({
  isOpen,
  onClose,
  selectedPassageIds,
  resources,
  folders,
  currentFolderId,
  onMergeSuccess,
  addResource,
  updateResource,
}) => {
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [testTitle, setTestTitle] = useState('');
  const [targetFolderId, setTargetFolderId] = useState<string | null>(currentFolderId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setOrderedIds([...selectedPassageIds]);
      setTargetFolderId(currentFolderId);
      setErrorMsg(null);

      // Auto generate initial test title
      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      setTestTitle(`IELTS Academic Reading Full Test - ${dateStr}`);
    }
  }, [isOpen, selectedPassageIds, currentFolderId]);

  if (!isOpen) return null;

  const orderedResources = orderedIds
    .map((id) => resources.find((r) => r.id === id))
    .filter(Boolean) as Resource[];

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...orderedIds];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setOrderedIds(next);
  };

  const moveDown = (index: number) => {
    if (index >= orderedIds.length - 1) return;
    const next = [...orderedIds];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setOrderedIds(next);
  };

  const parseResourceSummary = (res: Resource) => {
    let qCount = 0;
    let title = res.title;
    let wordCount = 0;
    try {
      if (res.content) {
        const parsed = JSON.parse(res.content);
        if (parsed.questions && Array.isArray(parsed.questions)) {
          qCount = parsed.questions.length;
        }
        if (parsed.title) title = parsed.title;
        const text = parsed.readingPassage || parsed.content || '';
        wordCount = text.split(/\s+/).filter(Boolean).length;
      }
    } catch {}
    return { title, qCount, wordCount };
  };

  const totalQuestions = orderedResources.reduce((sum, res) => {
    return sum + parseResourceSummary(res).qCount;
  }, 0);

  const handleConfirmMerge = async () => {
    if (!testTitle.trim()) {
      setErrorMsg('Vui lòng nhập tên cho bài Reading Test mới.');
      return;
    }
    if (orderedResources.length !== 3) {
      setErrorMsg('Cần chọn chính xác 3 Passage để gộp thành Test hoàn chỉnh.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const mergedPassages = orderedResources.map((res, idx) => {
        const passageIdx = idx + 1;
        let parsed: any = {};
        try {
          parsed = JSON.parse(res.content || '{}');
        } catch {}

        const pContent = parsed.readingPassage || parsed.content || '';
        const pQuestions = (parsed.questions || []).map((q: any) => ({
          ...q,
          passageIndex: passageIdx,
        }));
        const pGroups = (parsed.questionGroups || []).map((g: any) => ({
          ...g,
          passageIndex: passageIdx,
          questions: (g.questions || []).map((q: any) => ({
            ...q,
            passageIndex: passageIdx,
          })),
        }));

        return {
          id: `passage_${passageIdx}`,
          passageIndex: passageIdx,
          title: parsed.title || res.title,
          content: pContent,
          questionGroups: pGroups,
          questions: pQuestions,
          labeledParagraphs: parsed.labeledParagraphs || [],
        };
      });

      const allCombinedQs = mergedPassages.flatMap((p) => p.questions);
      const allCombinedGroups = mergedPassages.flatMap((p) => p.questionGroups);

      const targetFolder = targetFolderId ? folders.find((f) => f.id === targetFolderId) : null;

      const fullTestPayload = {
        title: testTitle.trim(),
        skill: 'reading',
        readingPassage: mergedPassages[0]?.content || '',
        content: mergedPassages[0]?.content || '',
        passages: mergedPassages,
        questionGroups: allCombinedGroups,
        questions: allCombinedQs,
        readingTestType: 'academic',
        metadata: {
          isMergedTest: true,
          sourcePassageIds: orderedResources.map((r) => r.id),
          passageCount: 3,
          questionCount: allCombinedQs.length,
          createdAt: new Date().toISOString(),
        },
      };

      // 1. Create the new consolidated 3-passage Reading Test
      const newRes = await addResource({
        title: testTitle.trim(),
        type: 'doc',
        content: JSON.stringify(fullTestPayload),
        tags: ['reading', 'full-test', 'merged-test', 'academic'],
        skill: 'reading',
        folder: targetFolder ? targetFolder.name : undefined,
        folderId: targetFolderId || null,
        isPublished: true,
      });

      // 2. Mark source passages as archived to avoid library clutter while preserving records
      for (const sRes of orderedResources) {
        let parsed: any = {};
        try {
          parsed = JSON.parse(sRes.content || '{}');
        } catch {}

        await updateResource(sRes.id, {
          isArchived: true,
          mergedIntoTestId: newRes.id,
          content: JSON.stringify({
            ...parsed,
            isArchived: true,
            mergedIntoTestId: newRes.id,
          }),
        });
      }

      onMergeSuccess(newRes.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to merge passages into reading test:', err);
      setErrorMsg(err.message || 'Có lỗi xảy ra khi gộp passage thành test.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2.5">
              <span className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Gộp 3 Passage thành Reading Test mới
                </h3>
                <p className="text-xs text-slate-500">
                  Sắp xếp thứ tự và tạo một đề thi IELTS Reading hoàn chỉnh 3 Passages (
                  {totalQuestions} câu hỏi)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4 text-xs">
            {/* New Test Title */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Tên bài Reading Test mới <span className="text-red-500">*</span>:
              </label>
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="Ví dụ: IELTS Academic Reading Mock Test 1"
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-purple-500 outline-hidden"
              />
            </div>

            {/* Destination Folder */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Thư mục lưu trữ:
              </label>
              <select
                value={targetFolderId || ''}
                onChange={(e) => setTargetFolderId(e.target.value || null)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 bg-white focus:ring-2 focus:ring-purple-500 outline-hidden"
              >
                <option value="">📁 Thư viện gốc (Không phân thư mục)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Passage Order & Preview */}
            <div>
              <label className="block font-bold text-slate-700 mb-2">
                Thứ tự các Passage trong bài thi (Kéo hoặc bấm mũi tên để đổi):
              </label>
              <div className="space-y-2.5">
                {orderedResources.map((res, index) => {
                  const summary = parseResourceSummary(res);
                  const pNum = index + 1;
                  return (
                    <div
                      key={res.id}
                      className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-purple-300 transition-colors"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-purple-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                          {pNum}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate text-xs">
                            {summary.title}
                          </span>
                          <div className="flex items-center space-x-3 text-[11px] text-slate-500 mt-0.5">
                            <span className="flex items-center space-x-1">
                              <FileText className="w-3 h-3 text-slate-400" />
                              <span>{summary.qCount} câu hỏi</span>
                            </span>
                            {summary.wordCount > 0 && (
                              <span>~{summary.wordCount} từ</span>
                            )}
                            {res.folder && (
                              <span className="text-slate-400 truncate max-w-[150px]">
                                📁 {res.folder}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0 ml-3">
                        <button
                          type="button"
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-purple-600 hover:border-purple-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Di chuyển lên"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(index)}
                          disabled={index === orderedResources.length - 1}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-purple-600 hover:border-purple-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Di chuyển xuống"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Information Notice */}
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-[11px] text-purple-900 space-y-1">
              <span className="font-bold flex items-center gap-1 text-purple-950">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                Quy trình lưu trữ an toàn:
              </span>
              <p className="leading-relaxed">
                Đề thi mới sẽ được tạo hoàn chỉnh với đầy đủ 3 Passage, nhóm câu hỏi và đáp án gốc.
                3 Passage thành phần ban đầu sẽ được đánh dấu lưu trữ (archived) để tránh làm rác thư viện tài liệu của giáo viên.
              </p>
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 text-xs">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleConfirmMerge}
              disabled={isSubmitting}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang gộp...' : 'Xác nhận tạo Reading Test'}</span>
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};
