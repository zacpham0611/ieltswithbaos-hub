import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit3,
  HelpCircle,
  Upload,
  Hash,
  ListOrdered,
  FileText,
  Volume2,
  Split,
  CheckSquare,
  Square,
  FolderPlus,
  ArrowRightLeft,
  X,
} from 'lucide-react';
import type {
  ListeningPart,
  ListeningQuestionGroup,
  ListeningQuestion,
  ListeningQuestionType,
} from '../../types';
import { ListeningQuestionRenderer } from './ListeningQuestionRenderer';
import { uploadMediaFile } from '../../lib/mediaStorage';

export const LISTENING_QUESTION_TYPES: Array<{
  value: ListeningQuestionType;
  label: string;
  category: string;
}> = [
  // Completion
  { value: 'note_completion', label: 'Note Completion', category: 'Completion' },
  { value: 'form_completion', label: 'Form Completion', category: 'Completion' },
  { value: 'table_completion', label: 'Table Completion', category: 'Completion' },
  { value: 'sentence_completion', label: 'Sentence Completion', category: 'Completion' },
  { value: 'summary_completion', label: 'Summary Completion', category: 'Completion' },
  { value: 'flowchart_completion', label: 'Flow-chart Completion', category: 'Completion' },
  // Multiple Choice
  { value: 'multiple_choice', label: 'Multiple Choice (Single Answer)', category: 'Choice' },
  { value: 'multiple_select', label: 'Multiple Select (Choose TWO/THREE)', category: 'Choice' },
  // Matching & Labelling
  { value: 'matching', label: 'Matching (Features / Information / Classification)', category: 'Matching' },
  { value: 'plan_map_diagram_labelling', label: 'Plan / Map / Diagram Labelling', category: 'Labelling' },
  // Short Answer
  { value: 'short_answer', label: 'Short Answer Questions', category: 'Short Answer' },
];

export const QUICK_WORD_LIMITS = [
  'NO MORE THAN ONE WORD',
  'NO MORE THAN TWO WORDS',
  'NO MORE THAN TWO WORDS AND/OR A NUMBER',
  'NO MORE THAN THREE WORDS',
  'ONE WORD ONLY',
  'ONE WORD AND/OR A NUMBER',
];

interface ListeningQuestionEditorProps {
  parts: ListeningPart[];
  onChange: (updatedParts: ListeningPart[]) => void;
  activePartIndex?: number;
  onActivePartIndexChange?: (index: number) => void;
  isReadOnly?: boolean;
}

export const ListeningQuestionEditor: React.FC<ListeningQuestionEditorProps> = ({
  parts,
  onChange,
  activePartIndex: controlledPartIndex,
  onActivePartIndexChange,
  isReadOnly = false,
}) => {
  const [internalPartIndex, setInternalPartIndex] = useState(0);
  const activePartIndex = controlledPartIndex !== undefined ? controlledPartIndex : internalPartIndex;

  const setActivePartIndex = (idx: number) => {
    if (onActivePartIndexChange) {
      onActivePartIndexChange(idx);
    } else {
      setInternalPartIndex(idx);
    }
  };

  const [previewMode, setPreviewMode] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});
  const [uploadingImageGroupId, setUploadingImageGroupId] = useState<string | null>(null);

  // Multi-select questions state for shared resource grouping
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupConfig, setGroupConfig] = useState<{
    groupTitle: string;
    instructions: string;
    audioUrl: string;
    groupText: string;
    imageUrl: string;
    imageCaption: string;
    type: ListeningQuestionType;
    wordLimit: string;
  }>({
    groupTitle: '',
    instructions: 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
    audioUrl: '',
    groupText: '',
    imageUrl: '',
    imageCaption: '',
    type: 'note_completion',
    wordLimit: 'NO MORE THAN TWO WORDS AND/OR A NUMBER',
  });

  const handleToggleSelectQuestion = (qId: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const handleSelectAllInPart = () => {
    const allIds = (activePart.questions || []).map((q) => q.id);
    if (selectedQuestionIds.size === allIds.length && allIds.length > 0) {
      setSelectedQuestionIds(new Set());
    } else {
      setSelectedQuestionIds(new Set(allIds));
    }
  };

  const handleClearSelection = () => {
    setSelectedQuestionIds(new Set());
  };

  const handleOpenGroupModal = () => {
    if (selectedQuestionIds.size === 0) return;
    const selectedQuestions = (activePart.questions || []).filter((q) => selectedQuestionIds.has(q.id));
    const nums = selectedQuestions.map((q) => q.questionNumber || q.number || 0).sort((a, b) => a - b);
    const firstNum = nums[0] || 1;
    const lastNum = nums[nums.length - 1] || nums.length;
    const defaultType = selectedQuestions[0]?.type || 'note_completion';

    setGroupConfig({
      groupTitle: `Questions ${firstNum}–${lastNum}`,
      instructions: selectedQuestions[0]?.instruction || 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
      audioUrl: activePart.audioUrl || '',
      groupText: '',
      imageUrl: '',
      imageCaption: '',
      type: defaultType,
      wordLimit: 'NO MORE THAN TWO WORDS AND/OR A NUMBER',
    });
    setShowGroupModal(true);
  };

  const handleConfirmCreateGroup = () => {
    if (selectedQuestionIds.size === 0) return;

    const allPartQuestions = activePart.questions || [];
    const questionsToGroup = allPartQuestions
      .filter((q) => selectedQuestionIds.has(q.id))
      .map((q) => ({
        ...q,
        type: groupConfig.type,
      }));

    const newGroupId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    questionsToGroup.forEach((q) => {
      q.groupId = newGroupId;
    });

    const newGroup: ListeningQuestionGroup = {
      id: newGroupId,
      part: activePart.partNumber || activePartIndex + 1,
      groupTitle: groupConfig.groupTitle,
      title: groupConfig.groupTitle,
      instructions: groupConfig.instructions,
      wordLimit: groupConfig.wordLimit,
      type: groupConfig.type,
      audioUrl: groupConfig.audioUrl.trim() || undefined,
      imageUrl: groupConfig.imageUrl.trim() || undefined,
      imageCaption: groupConfig.imageCaption.trim() || undefined,
      groupText: groupConfig.groupText.trim() || undefined,
      sharedContent: groupConfig.groupText.trim() || undefined,
      questions: questionsToGroup,
    };

    // Remove selected questions from existing groups
    const updatedGroups = (activePart.questionGroups || [])
      .map((grp) => ({
        ...grp,
        questions: (grp.questions || []).filter((q) => !selectedQuestionIds.has(q.id)),
      }))
      .filter((grp) => grp.questions && grp.questions.length > 0);

    updatedGroups.push(newGroup);

    const allFlat = updatedGroups.flatMap((g) => g.questions || []);
    updateActivePart({
      questionGroups: updatedGroups,
      questions: allFlat,
    });

    setSelectedQuestionIds(new Set());
    setShowGroupModal(false);
  };

  const handleUngroupQuestions = (qIdsToUngroup?: string[]) => {
    const targetIds = new Set(qIdsToUngroup || Array.from(selectedQuestionIds));
    if (targetIds.size === 0) return;

    const remainingGroups: ListeningQuestionGroup[] = [];
    const newIndependentGroups: ListeningQuestionGroup[] = [];

    (activePart.questionGroups || []).forEach((grp) => {
      const keptQuestions = (grp.questions || []).filter((q) => !targetIds.has(q.id));
      const extractedQuestions = (grp.questions || []).filter((q) => targetIds.has(q.id));

      if (keptQuestions.length > 0) {
        remainingGroups.push({
          ...grp,
          questions: keptQuestions,
        });
      }

      extractedQuestions.forEach((q) => {
        const indepId = `grp_indep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const qNum = q.questionNumber || q.number || 1;
        newIndependentGroups.push({
          id: indepId,
          part: activePart.partNumber || activePartIndex + 1,
          groupTitle: `Question ${qNum}`,
          title: `Question ${qNum}`,
          instructions: '',
          type: q.type,
          questions: [{ ...q, groupId: indepId }],
        });
      });
    });

    const finalGroups = [...remainingGroups, ...newIndependentGroups];
    const allFlat = finalGroups.flatMap((g) => g.questions || []);

    updateActivePart({
      questionGroups: finalGroups,
      questions: allFlat,
    });

    setSelectedQuestionIds(new Set());
  };

  const handleMoveQuestionsToGroup = (qIds: string[], targetGroupId: string) => {
    const targetIds = new Set(qIds);
    let movingQuestions: ListeningQuestion[] = [];

    const updatedGroups = (activePart.questionGroups || [])
      .map((grp) => {
        const moving = (grp.questions || []).filter((q) => targetIds.has(q.id));
        movingQuestions.push(...moving);
        return {
          ...grp,
          questions: (grp.questions || []).filter((q) => !targetIds.has(q.id)),
        };
      })
      .filter((grp) => grp.questions.length > 0 || grp.id === targetGroupId);

    const targetGroup = updatedGroups.find((g) => g.id === targetGroupId);
    if (targetGroup) {
      movingQuestions.forEach((q) => {
        q.groupId = targetGroupId;
      });
      targetGroup.questions = [...(targetGroup.questions || []), ...movingQuestions];
    }

    const allFlat = updatedGroups.flatMap((g) => g.questions || []);
    updateActivePart({
      questionGroups: updatedGroups,
      questions: allFlat,
    });

    setSelectedQuestionIds(new Set());
  };

  const activePart = parts[activePartIndex] || {
    partNumber: activePartIndex + 1,
    title: `Part ${activePartIndex + 1}`,
    questionGroups: [],
    questions: [],
  };

  // Helper to update active part
  const updateActivePart = (updates: Partial<ListeningPart>) => {
    const updated = parts.map((p, idx) => (idx === activePartIndex ? { ...p, ...updates } : p));
    onChange(updated);
  };

  // =========================================================================
  // GROUP MANAGEMENT
  // =========================================================================

  const handleAddQuestionGroup = () => {
    const allQuestionsInPart = activePart.questions || [];
    const nextQNum = allQuestionsInPart.length > 0
      ? Math.max(...allQuestionsInPart.map((q) => q.questionNumber || q.number || 0)) + 1
      : activePartIndex * 10 + 1;

    const newGroupId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newQuestion: ListeningQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      questionNumber: nextQNum,
      number: nextQNum,
      part: activePart.partNumber || activePartIndex + 1,
      groupId: newGroupId,
      type: 'note_completion',
      prompt: `${nextQNum}. Nhập nội dung câu hỏi hoặc điền khuyết...`,
      correctAnswer: '',
      explanation: '',
    };

    const newGroup: ListeningQuestionGroup = {
      id: newGroupId,
      part: activePart.partNumber || activePartIndex + 1,
      groupTitle: `Questions ${nextQNum}-${nextQNum}`,
      title: `Questions ${nextQNum}-${nextQNum}`,
      type: 'note_completion',
      instructions: 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
      wordLimit: 'NO MORE THAN TWO WORDS AND/OR A NUMBER',
      questions: [newQuestion],
    };

    const updatedGroups = [...(activePart.questionGroups || []), newGroup];
    const updatedQuestions = [...(activePart.questions || []), newQuestion];

    updateActivePart({
      questionGroups: updatedGroups,
      questions: updatedQuestions,
    });
  };

  const handleUpdateGroup = (groupIdx: number, updates: Partial<ListeningQuestionGroup>) => {
    const updatedGroups = [...(activePart.questionGroups || [])];
    const currentGroup = updatedGroups[groupIdx];
    if (!currentGroup) return;

    // If group questionType changed, optionally propagate to questions in group if desired
    let updatedQuestions = currentGroup.questions || [];
    if (updates.type && updates.type !== currentGroup.type) {
      updatedQuestions = updatedQuestions.map((q) => ({
        ...q,
        type: updates.type!,
        options:
          updates.type === 'multiple_choice' || updates.type === 'multiple_select'
            ? q.options && q.options.length > 0
              ? q.options
              : ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D']
            : q.options,
      }));
    }

    updatedGroups[groupIdx] = {
      ...currentGroup,
      ...updates,
      questions: updatedQuestions,
    };

    // Resynchronize flat questions
    const allFlatQuestions = updatedGroups.flatMap((g) => g.questions || []);
    updateActivePart({
      questionGroups: updatedGroups,
      questions: allFlatQuestions,
    });
  };

  const handleDeleteGroup = (groupIdx: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa nhóm câu hỏi này?')) return;
    const targetGroup = activePart.questionGroups?.[groupIdx];
    if (!targetGroup) return;

    const remainingGroups = (activePart.questionGroups || []).filter((_, idx) => idx !== groupIdx);
    const targetQIds = new Set((targetGroup.questions || []).map((q) => q.id));
    const remainingQuestions = (activePart.questions || []).filter((q) => !targetQIds.has(q.id));

    updateActivePart({
      questionGroups: remainingGroups,
      questions: remainingQuestions,
    });
  };

  // =========================================================================
  // QUESTION MANAGEMENT
  // =========================================================================

  const handleAddQuestionToGroup = (groupIdx: number) => {
    const targetGroup = activePart.questionGroups?.[groupIdx];
    if (!targetGroup) return;

    // Calculate next question number
    const allQuestionsInPart = activePart.questions || [];
    const nextQNum = allQuestionsInPart.length > 0
      ? Math.max(...allQuestionsInPart.map((q) => q.questionNumber || q.number || 0)) + 1
      : activePartIndex * 10 + 1;

    const groupType = targetGroup.type || 'note_completion';

    const newQ: ListeningQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      questionNumber: nextQNum,
      number: nextQNum,
      part: activePart.partNumber || activePartIndex + 1,
      groupId: targetGroup.id,
      type: groupType,
      prompt: `${nextQNum}. `,
      correctAnswer: '',
      explanation: '',
      options:
        groupType === 'multiple_choice' || groupType === 'multiple_select'
          ? ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D']
          : undefined,
    };

    const updatedGroups = [...(activePart.questionGroups || [])];
    const groupQs = [...(targetGroup.questions || []), newQ];
    updatedGroups[groupIdx] = { ...targetGroup, questions: groupQs };

    // Update group title range if standard format
    const firstNum = groupQs[0]?.questionNumber || groupQs[0]?.number || 1;
    const lastNum = groupQs[groupQs.length - 1]?.questionNumber || groupQs[groupQs.length - 1]?.number || groupQs.length;
    if (targetGroup.groupTitle?.startsWith('Questions ') || targetGroup.title?.startsWith('Questions ')) {
      updatedGroups[groupIdx].groupTitle = `Questions ${firstNum}-${lastNum}`;
      updatedGroups[groupIdx].title = `Questions ${firstNum}-${lastNum}`;
    }

    const allFlatQuestions = updatedGroups.flatMap((g) => g.questions || []);
    updateActivePart({
      questionGroups: updatedGroups,
      questions: allFlatQuestions,
    });
  };

  const handleUpdateQuestion = (qId: string, updates: Partial<ListeningQuestion>) => {
    const updatedGroups = (activePart.questionGroups || []).map((grp) => ({
      ...grp,
      questions: (grp.questions || []).map((q) => {
        if (q.id === qId) {
          const updatedQ = { ...q, ...updates };
          // If changing to multiple choice and no options exist, initialize standard options
          if (
            (updates.type === 'multiple_choice' || updates.type === 'multiple_select') &&
            (!updatedQ.options || updatedQ.options.length === 0)
          ) {
            updatedQ.options = ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'];
          }
          return updatedQ;
        }
        return q;
      }),
    }));

    const allFlatQuestions = updatedGroups.flatMap((g) => g.questions || []);
    updateActivePart({
      questionGroups: updatedGroups,
      questions: allFlatQuestions,
    });
  };

  const handleDeleteQuestion = (qId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) return;
    const updatedGroups = (activePart.questionGroups || []).map((grp) => ({
      ...grp,
      questions: (grp.questions || []).filter((q) => q.id !== qId),
    }));

    const allFlatQuestions = updatedGroups.flatMap((g) => g.questions || []);
    updateActivePart({
      questionGroups: updatedGroups,
      questions: allFlatQuestions,
    });
  };

  const handleDuplicateQuestion = (qId: string) => {
    let duplicatedQ: ListeningQuestion | null = null;
    let targetGroupIndex = -1;

    activePart.questionGroups?.forEach((grp, gIdx) => {
      const found = grp.questions?.find((q) => q.id === qId);
      if (found) {
        duplicatedQ = {
          ...found,
          id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          prompt: `${found.prompt} (Bản sao)`,
          options: found.options ? [...found.options] : undefined,
          acceptedAlternatives: found.acceptedAlternatives ? [...found.acceptedAlternatives] : undefined,
        };
        targetGroupIndex = gIdx;
      }
    });

    if (!duplicatedQ || targetGroupIndex === -1) return;

    const updatedGroups = [...(activePart.questionGroups || [])];
    const grp = updatedGroups[targetGroupIndex];
    const grpQs = [...(grp.questions || [])];
    const srcIndex = grpQs.findIndex((q) => q.id === qId);
    grpQs.splice(srcIndex + 1, 0, duplicatedQ);
    updatedGroups[targetGroupIndex] = { ...grp, questions: grpQs };

    const allFlatQuestions = updatedGroups.flatMap((g) => g.questions || []);
    updateActivePart({
      questionGroups: updatedGroups,
      questions: allFlatQuestions,
    });
  };

  const handleMoveQuestion = (qId: string, direction: 'up' | 'down') => {
    const updatedGroups = [...(activePart.questionGroups || [])];
    for (let gIdx = 0; gIdx < updatedGroups.length; gIdx++) {
      const grp = updatedGroups[gIdx];
      const qs = [...(grp.questions || [])];
      const qIdx = qs.findIndex((q) => q.id === qId);

      if (qIdx !== -1) {
        if (direction === 'up' && qIdx > 0) {
          const temp = qs[qIdx - 1];
          qs[qIdx - 1] = qs[qIdx];
          qs[qIdx] = temp;
          updatedGroups[gIdx] = { ...grp, questions: qs };
          break;
        } else if (direction === 'down' && qIdx < qs.length - 1) {
          const temp = qs[qIdx + 1];
          qs[qIdx + 1] = qs[qIdx];
          qs[qIdx] = temp;
          updatedGroups[gIdx] = { ...grp, questions: qs };
          break;
        }
      }
    }

    const allFlatQuestions = updatedGroups.flatMap((g) => g.questions || []);
    updateActivePart({
      questionGroups: updatedGroups,
      questions: allFlatQuestions,
    });
  };

  // Auto-renumber all questions sequentially from 1 to N across all parts
  const handleRenumberAllQuestions = () => {
    let runningCounter = 1;
    const updatedParts = parts.map((part) => {
      const updatedGroups = (part.questionGroups || []).map((grp) => {
        const updatedQs = (grp.questions || []).map((q) => {
          const qNum = runningCounter++;
          return {
            ...q,
            questionNumber: qNum,
            number: qNum,
          };
        });

        const firstNum = updatedQs[0]?.questionNumber || 1;
        const lastNum = updatedQs[updatedQs.length - 1]?.questionNumber || updatedQs.length;
        const newTitle = `Questions ${firstNum}-${lastNum}`;

        return {
          ...grp,
          groupTitle: grp.groupTitle?.startsWith('Questions ') ? newTitle : grp.groupTitle,
          title: grp.title?.startsWith('Questions ') ? newTitle : grp.title,
          questions: updatedQs,
        };
      });

      const allFlatQuestions = updatedGroups.flatMap((g) => g.questions || []);
      return {
        ...part,
        questionGroups: updatedGroups,
        questions: allFlatQuestions,
      };
    });

    onChange(updatedParts);
  };

  // Image upload handler for group diagram / map
  const handleGroupImageUpload = async (groupIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const grp = activePart.questionGroups?.[groupIdx];
    if (!grp) return;

    setUploadingImageGroupId(grp.id);
    try {
      const imageUrl = await uploadMediaFile(file, 'images', `listening_diagram_${Date.now()}_${file.name}`);
      handleUpdateGroup(groupIdx, { imageUrl });
    } catch (err: any) {
      alert(`Không thể tải ảnh sơ đồ lên: ${err.message}`);
    } finally {
      setUploadingImageGroupId(null);
    }
  };

  // =========================================================================
  // RENDER QUESTION-TYPE-SPECIFIC EDITORS
  // =========================================================================

  const renderQuestionTypeEditor = (q: ListeningQuestion, grp: ListeningQuestionGroup) => {
    const qType = q.type || grp.type || 'note_completion';

    // 1. COMPLETION QUESTIONS (Note, Form, Table, Summary, Sentence, Flow-chart)
    if (
      qType === 'note_completion' ||
      qType === 'form_completion' ||
      qType === 'table_completion' ||
      qType === 'sentence_completion' ||
      qType === 'summary_completion' ||
      qType === 'flowchart_completion'
    ) {
      return (
        <div className="space-y-3 pt-2">
          {/* Prompt with insert blank shortcut */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700">
                Nội dung câu hỏi / Câu chứa chỗ trống:
              </label>
              <button
                type="button"
                onClick={() => {
                  const currentPrompt = q.prompt || '';
                  handleUpdateQuestion(q.id, {
                    prompt: currentPrompt.includes('_____') ? currentPrompt : `${currentPrompt} _____`,
                  });
                }}
                className="text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded border border-purple-200 transition flex items-center gap-1 cursor-pointer"
              >
                <span>+ Chèn chỗ trống</span>
                <code className="text-[10px] font-mono bg-purple-200/60 px-1 rounded">_____</code>
              </button>
            </div>
            <textarea
              rows={2}
              value={q.prompt || ''}
              onChange={(e) => handleUpdateQuestion(q.id, { prompt: e.target.value })}
              placeholder="VD: The candidate needs to bring their _____ to the interview."
              className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg outline-hidden focus:border-purple-500 font-medium text-slate-800"
            />
          </div>

          {/* Answer Key & Acceptable Alternatives */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-emerald-800 mb-1">
                Đáp án chính xác *
              </label>
              <input
                type="text"
                value={q.correctAnswer || ''}
                onChange={(e) => handleUpdateQuestion(q.id, { correctAnswer: e.target.value })}
                placeholder="VD: passport / passport ID"
                className="w-full px-2.5 py-1.5 text-xs bg-emerald-50/70 border border-emerald-300 rounded-lg outline-hidden text-emerald-950 font-bold focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Mẹo: Dùng dấu gạch chéo <code className="font-mono text-emerald-700">/</code> để thêm đáp án tương đương.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Đáp án thay thế được chấp nhận (Alternatives)
              </label>
              <input
                type="text"
                value={(q.acceptedAlternatives || []).join(', ')}
                onChange={(e) =>
                  handleUpdateQuestion(q.id, {
                    acceptedAlternatives: e.target.value
                      .split(/[,/]+/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="VD: identification, valid passport"
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-hidden text-slate-800 focus:bg-white focus:border-purple-500"
              />
            </div>
          </div>

          {/* Explanation / Audio Script */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
              Giải thích / Trích dẫn đoạn băng nghe (Audio Script Quote):
            </label>
            <input
              type="text"
              value={q.explanation || ''}
              onChange={(e) => handleUpdateQuestion(q.id, { explanation: e.target.value })}
              placeholder="Đoạn trích từ Audio làm căn cứ cho đáp án..."
              className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden text-slate-700 focus:bg-white focus:border-purple-500"
            />
          </div>
        </div>
      );
    }

    // 2. MULTIPLE CHOICE (Single Answer)
    if (qType === 'multiple_choice') {
      const options = q.options && q.options.length > 0 ? q.options : ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'];
      const currentAnswer = (q.correctAnswer || '').trim().toUpperCase();

      return (
        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Câu hỏi (Question Prompt):
            </label>
            <textarea
              rows={2}
              value={q.prompt || ''}
              onChange={(e) => handleUpdateQuestion(q.id, { prompt: e.target.value })}
              placeholder="VD: What is the main reason why the speaker chose this university?"
              className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg outline-hidden focus:border-purple-500 font-medium text-slate-800"
            />
          </div>

          {/* Options List with Radio selection for Correct Answer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase">
                Danh sách lựa chọn (Chọn 1 đáp án đúng):
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextLetter = String.fromCharCode(65 + options.length);
                  handleUpdateQuestion(q.id, {
                    options: [...options, `Lựa chọn ${nextLetter}`],
                  });
                }}
                className="text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded border border-purple-200 transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Thêm lựa chọn</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {options.map((opt, oIdx) => {
                const letter = String.fromCharCode(65 + oIdx);
                const isSelected = currentAnswer === letter || currentAnswer === opt.trim().toUpperCase();

                return (
                  <div
                    key={oIdx}
                    className={`flex items-center gap-2 p-1.5 rounded-lg border transition ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <label className="flex items-center gap-1.5 cursor-pointer shrink-0 px-1">
                      <input
                        type="radio"
                        name={`correct_mcq_${q.id}`}
                        checked={isSelected}
                        onChange={() => handleUpdateQuestion(q.id, { correctAnswer: letter })}
                        className="text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                      />
                      <span className="font-bold text-xs w-4">{letter}.</span>
                    </label>

                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...options];
                        newOpts[oIdx] = e.target.value;
                        handleUpdateQuestion(q.id, { options: newOpts });
                      }}
                      placeholder={`Nội dung lựa chọn ${letter}...`}
                      className="flex-1 px-2 py-1 text-xs bg-transparent border-0 outline-hidden font-medium text-slate-800"
                    />

                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newOpts = options.filter((_, idx) => idx !== oIdx);
                          handleUpdateQuestion(q.id, { options: newOpts });
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 transition"
                        title="Xóa lựa chọn này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Answer Key Badge */}
            <div className="flex items-center gap-2 text-xs pt-1">
              <span className="font-bold text-emerald-800">Đáp án chính xác:</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold font-mono">
                {currentAnswer || 'Chưa chọn'}
              </span>
            </div>
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
              Giải thích / Audio script quote:
            </label>
            <input
              type="text"
              value={q.explanation || ''}
              onChange={(e) => handleUpdateQuestion(q.id, { explanation: e.target.value })}
              placeholder="Giải thích câu trả lời đúng..."
              className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden text-slate-700 focus:bg-white focus:border-purple-500"
            />
          </div>
        </div>
      );
    }

    // 3. MULTIPLE SELECT (Choose TWO / THREE)
    if (qType === 'multiple_select') {
      const options = q.options && q.options.length > 0 ? q.options : ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D', 'Lựa chọn E'];
      const rawAns = q.correctAnswer || '';
      const selectedLetters = new Set(
        rawAns
          .split(/[,\s;/]+/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      );

      const toggleLetter = (letter: string) => {
        const next = new Set(selectedLetters);
        if (next.has(letter)) {
          next.delete(letter);
        } else {
          next.add(letter);
        }
        const sorted = Array.from(next).sort().join(', ');
        handleUpdateQuestion(q.id, { correctAnswer: sorted });
      };

      return (
        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Câu hỏi (Question Prompt):
            </label>
            <textarea
              rows={2}
              value={q.prompt || ''}
              onChange={(e) => handleUpdateQuestion(q.id, { prompt: e.target.value })}
              placeholder="VD: Which TWO activities are available at the sports centre on weekends?"
              className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg outline-hidden focus:border-purple-500 font-medium text-slate-800"
            />
          </div>

          {/* Options List with Checkboxes for Multi-Select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase">
                Danh sách lựa chọn (Tích chọn các đáp án đúng):
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextLetter = String.fromCharCode(65 + options.length);
                  handleUpdateQuestion(q.id, {
                    options: [...options, `Lựa chọn ${nextLetter}`],
                  });
                }}
                className="text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded border border-purple-200 transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Thêm lựa chọn</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {options.map((opt, oIdx) => {
                const letter = String.fromCharCode(65 + oIdx);
                const isChecked = selectedLetters.has(letter);

                return (
                  <div
                    key={oIdx}
                    className={`flex items-center gap-2 p-1.5 rounded-lg border transition ${
                      isChecked
                        ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 font-medium'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <label className="flex items-center gap-1.5 cursor-pointer shrink-0 px-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleLetter(letter)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                      />
                      <span className="font-bold text-xs w-4">{letter}.</span>
                    </label>

                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...options];
                        newOpts[oIdx] = e.target.value;
                        handleUpdateQuestion(q.id, { options: newOpts });
                      }}
                      placeholder={`Nội dung lựa chọn ${letter}...`}
                      className="flex-1 px-2 py-1 text-xs bg-transparent border-0 outline-hidden font-medium text-slate-800"
                    />

                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newOpts = options.filter((_, idx) => idx !== oIdx);
                          handleUpdateQuestion(q.id, { options: newOpts });
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 transition"
                        title="Xóa lựa chọn này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Answer Key Display */}
            <div className="flex items-center gap-2 text-xs pt-1">
              <span className="font-bold text-emerald-800">Các đáp án đúng:</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold font-mono">
                {rawAns || 'Chưa chọn đáp án nào'}
              </span>
            </div>
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
              Giải thích / Audio script quote:
            </label>
            <input
              type="text"
              value={q.explanation || ''}
              onChange={(e) => handleUpdateQuestion(q.id, { explanation: e.target.value })}
              placeholder="Giải thích câu trả lời đúng..."
              className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden text-slate-700 focus:bg-white focus:border-purple-500"
            />
          </div>
        </div>
      );
    }

    // 4. MATCHING
    if (qType === 'matching') {
      const groupOptions = grp.optionsBox || grp.options || [];

      return (
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Mục cần nối (Item to match - Question):
              </label>
              <input
                type="text"
                value={q.prompt || ''}
                onChange={(e) => handleUpdateQuestion(q.id, { prompt: e.target.value })}
                placeholder="VD: 1. City Library"
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-hidden font-medium text-slate-800 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-emerald-800 mb-1">
                Đáp án nối đúng (Match):
              </label>
              {groupOptions.length > 0 ? (
                <select
                  value={q.correctAnswer || ''}
                  onChange={(e) => handleUpdateQuestion(q.id, { correctAnswer: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-emerald-50 border border-emerald-300 rounded-lg outline-hidden text-emerald-950 font-bold focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">-- Chọn đáp án --</option>
                  {groupOptions.map((opt, oIdx) => {
                    const letter = opt.length <= 2 ? opt : String.fromCharCode(65 + oIdx);
                    return (
                      <option key={oIdx} value={letter}>
                        {letter}. {opt.replace(/^[A-Za-z][\.\:\)]\s*/, '')}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  type="text"
                  value={q.correctAnswer || ''}
                  onChange={(e) => handleUpdateQuestion(q.id, { correctAnswer: e.target.value.toUpperCase() })}
                  placeholder="Chữ cái (A, B, C...)"
                  className="w-full px-2.5 py-1.5 text-xs bg-emerald-50 border border-emerald-300 rounded-lg outline-hidden text-emerald-950 font-bold uppercase focus:ring-1 focus:ring-emerald-500"
                />
              )}
            </div>
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
              Giải thích / Audio script quote:
            </label>
            <input
              type="text"
              value={q.explanation || ''}
              onChange={(e) => handleUpdateQuestion(q.id, { explanation: e.target.value })}
              placeholder="Đoạn thoại thể hiện mối liên kết nối..."
              className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden text-slate-700 focus:bg-white focus:border-purple-500"
            />
          </div>
        </div>
      );
    }

    // 5. PLAN / MAP / DIAGRAM LABELLING
    if (qType === 'plan_map_diagram_labelling') {
      const groupOptions = grp.optionsBox || grp.options || [];

      return (
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Tên vị trí / Đối tượng cần dán nhãn (Location / Label name):
              </label>
              <input
                type="text"
                value={q.prompt || ''}
                onChange={(e) => handleUpdateQuestion(q.id, { prompt: e.target.value })}
                placeholder="VD: 15. Pharmacy"
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-hidden font-medium text-slate-800 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-emerald-800 mb-1">
                Ký hiệu vị trí đúng:
              </label>
              {groupOptions.length > 0 ? (
                <select
                  value={q.correctAnswer || ''}
                  onChange={(e) => handleUpdateQuestion(q.id, { correctAnswer: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-emerald-50 border border-emerald-300 rounded-lg outline-hidden text-emerald-950 font-bold focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">-- Chọn chữ cái --</option>
                  {groupOptions.map((opt, oIdx) => {
                    const letter = opt.length <= 2 ? opt : String.fromCharCode(65 + oIdx);
                    return (
                      <option key={oIdx} value={letter}>
                        {letter}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  type="text"
                  value={q.correctAnswer || ''}
                  onChange={(e) => handleUpdateQuestion(q.id, { correctAnswer: e.target.value.toUpperCase() })}
                  placeholder="Ký hiệu (A, B, C...)"
                  className="w-full px-2.5 py-1.5 text-xs bg-emerald-50 border border-emerald-300 rounded-lg outline-hidden text-emerald-950 font-bold uppercase focus:ring-1 focus:ring-emerald-500"
                />
              )}
            </div>
          </div>

          {/* Optional Question-specific image if not using group image */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
              Ảnh sơ đồ riêng cho câu này (Nếu không dùng sơ đồ chung của nhóm):
            </label>
            <input
              type="text"
              value={q.imageUrl || ''}
              onChange={(e) => handleUpdateQuestion(q.id, { imageUrl: e.target.value })}
              placeholder="https://.../map_detail.png"
              className="w-full px-2.5 py-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-hidden text-slate-700"
            />
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
              Giải thích / Chỉ đường trong Audio (Transcript guide):
            </label>
            <input
              type="text"
              value={q.explanation || ''}
              onChange={(e) => handleUpdateQuestion(q.id, { explanation: e.target.value })}
              placeholder="Chỉ dẫn vị trí từ bài nghe..."
              className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden text-slate-700 focus:bg-white focus:border-purple-500"
            />
          </div>
        </div>
      );
    }

    // 6. SHORT ANSWER QUESTIONS
    if (qType === 'short_answer') {
      return (
        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Câu hỏi ngắn (Short Question):
            </label>
            <input
              type="text"
              value={q.prompt || ''}
              onChange={(e) => handleUpdateQuestion(q.id, { prompt: e.target.value })}
              placeholder="VD: What time does the festival parade begin?"
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-hidden font-medium text-slate-800 focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-emerald-800 mb-1">
                Đáp án ngắn chính xác *
              </label>
              <input
                type="text"
                value={q.correctAnswer || ''}
                onChange={(e) => handleUpdateQuestion(q.id, { correctAnswer: e.target.value })}
                placeholder="VD: 10:30 am / 10.30am"
                className="w-full px-2.5 py-1.5 text-xs bg-emerald-50/70 border border-emerald-300 rounded-lg outline-hidden text-emerald-950 font-bold focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Các phương án thay thế (Alternatives)
              </label>
              <input
                type="text"
                value={(q.acceptedAlternatives || []).join(', ')}
                onChange={(e) =>
                  handleUpdateQuestion(q.id, {
                    acceptedAlternatives: e.target.value
                      .split(/[,/]+/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="VD: 10:30, half past ten"
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-hidden text-slate-800 focus:bg-white focus:border-purple-500"
              />
            </div>
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
              Giải thích / Audio script quote:
            </label>
            <input
              type="text"
              value={q.explanation || ''}
              onChange={(e) => handleUpdateQuestion(q.id, { explanation: e.target.value })}
              placeholder="Trích dẫn giải thích từ Audio script..."
              className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden text-slate-700 focus:bg-white focus:border-purple-500"
            />
          </div>
        </div>
      );
    }

    return null;
  };

  // =========================================================================
  // MAIN RENDER
  // =========================================================================

  return (
    <div className="space-y-6">
      {/* Top Bar: Section/Part Tabs + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {parts.map((p, idx) => {
            const isActive = idx === activePartIndex;
            const qCount = p.questions?.length || 0;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActivePartIndex(idx)}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Part {p.partNumber || idx + 1}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive ? 'bg-purple-800 text-purple-100' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {qCount} Qs
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleRenumberAllQuestions}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Tự động sắp xếp và đánh số lại câu hỏi từ 1 đến hết"
          >
            <ListOrdered className="w-3.5 h-3.5 text-purple-600" />
            <span>Đánh số lại (1-40)</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              previewMode
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{previewMode ? 'Thoát xem trước' : 'Xem trước bài thi'}</span>
          </button>
        </div>
      </div>

      {/* PREVIEW MODE */}
      {previewMode ? (
        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                Chế độ xem trước giao diện học sinh
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                {activePart.title || `Part ${activePart.partNumber || activePartIndex + 1}`}
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {activePart.questions?.length || 0} câu hỏi
            </span>
          </div>

          {activePart.questionGroups && activePart.questionGroups.length > 0 ? (
            activePart.questionGroups.map((grp) => (
              <ListeningQuestionRenderer
                key={grp.id}
                questionGroup={grp}
                answers={previewAnswers}
                onAnswerChange={(qId, ans) =>
                  setPreviewAnswers((prev) => ({ ...prev, [qId]: ans }))
                }
                showCorrectAnswers={true}
              />
            ))
          ) : (
            <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-400 text-xs">
              Chưa có nhóm câu hỏi nào trong Part này để xem trước.
            </div>
          )}
        </div>
      ) : (
        /* EDITING MODE */
        <div className="space-y-6">
          {/* Part Level Settings */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-purple-600" />
                <span>Cấu hình Part {activePart.partNumber || activePartIndex + 1}</span>
              </h4>
              <button
                type="button"
                onClick={handleAddQuestionGroup}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm nhóm câu hỏi</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Tiêu đề phần nghe (Part Title):
                </label>
                <input
                  type="text"
                  value={activePart.title || ''}
                  onChange={(e) => updateActivePart({ title: e.target.value })}
                  placeholder={`VD: Part ${activePartIndex + 1}: Conversation between agent and tourist`}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:bg-white focus:border-purple-500 font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Audio riêng cho Part này (URL hoặc Supabase Storage):
                </label>
                <input
                  type="text"
                  value={activePart.audioUrl || ''}
                  onChange={(e) => updateActivePart({ audioUrl: e.target.value })}
                  placeholder="Để trống nếu dùng Audio toàn bài thi..."
                  className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:bg-white focus:border-purple-500 text-slate-700"
                />
              </div>
            </div>
          </div>

          {/* BATCH SELECTION & SHARED RESOURCE GROUPING TOOLBAR */}
          <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectAllInPart}
                className="flex items-center gap-1.5 text-xs font-bold text-purple-900 hover:text-purple-700 cursor-pointer"
              >
                {selectedQuestionIds.size === (activePart.questions?.length || 0) && (activePart.questions?.length || 0) > 0 ? (
                  <CheckSquare className="w-4 h-4 text-purple-700" />
                ) : (
                  <Square className="w-4 h-4 text-purple-400" />
                )}
                <span>
                  {selectedQuestionIds.size === (activePart.questions?.length || 0) && (activePart.questions?.length || 0) > 0
                    ? 'Bỏ chọn tất cả'
                    : 'Chọn tất cả câu hỏi'}
                </span>
              </button>

              {selectedQuestionIds.size > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-600 text-white shadow-2xs">
                  Đã chọn {selectedQuestionIds.size} câu
                </span>
              )}
            </div>

            {selectedQuestionIds.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenGroupModal}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                  title="Gộp các câu hỏi đã chọn vào một nhóm tài nguyên chung"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Tạo nhóm tài nguyên dùng chung ({selectedQuestionIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUngroupQuestions()}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="Tách các câu hỏi đã chọn thành từng câu độc lập"
                >
                  <Split className="w-4 h-4 text-slate-600" />
                  <span>Tách độc lập ({selectedQuestionIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
                  title="Bỏ chọn"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <span className="text-xs text-purple-700 font-medium italic">
                💡 Chọn các câu hỏi bằng ô vuông (checkbox) để gộp nhóm tài nguyên dùng chung (audio, bảng biểu, ảnh, hướng dẫn).
              </span>
            )}
          </div>

          {/* GROUP CREATION MODAL OVERLAY */}
          {showGroupModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <FolderPlus className="w-5 h-5 text-purple-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Tạo nhóm tài nguyên dùng chung (Group Questions / Share Resource)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGroupModal(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-600">
                  Gộp <strong>{selectedQuestionIds.size} câu hỏi</strong> đã chọn vào một nhóm. Tất cả câu hỏi trong nhóm sẽ dùng chung tài nguyên bên dưới và hiển thị cùng nhau cho học sinh.
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tiêu đề nhóm (Group Title):</label>
                    <input
                      type="text"
                      value={groupConfig.groupTitle}
                      onChange={(e) => setGroupConfig({ ...groupConfig, groupTitle: e.target.value })}
                      placeholder="VD: Questions 1–5"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:bg-white focus:border-purple-500 font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Dạng câu hỏi của nhóm:</label>
                      <select
                        value={groupConfig.type}
                        onChange={(e) =>
                          setGroupConfig({ ...groupConfig, type: e.target.value as ListeningQuestionType })
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:bg-white focus:border-purple-500 font-semibold"
                      >
                        {LISTENING_QUESTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Giới hạn từ (Word limit):</label>
                      <input
                        type="text"
                        value={groupConfig.wordLimit}
                        onChange={(e) => setGroupConfig({ ...groupConfig, wordLimit: e.target.value })}
                        placeholder="NO MORE THAN TWO WORDS"
                        className="w-full px-3 py-1.5 bg-amber-50/50 border border-amber-200 rounded-lg outline-hidden font-semibold text-amber-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Hướng dẫn làm bài (Instructions):</label>
                    <input
                      type="text"
                      value={groupConfig.instructions}
                      onChange={(e) => setGroupConfig({ ...groupConfig, instructions: e.target.value })}
                      placeholder="VD: Complete the notes below. Write NO MORE THAN TWO WORDS..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-hidden italic"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-blue-900 mb-1 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Audio riêng cho nhóm này (Tùy chọn):</span>
                    </label>
                    <input
                      type="text"
                      value={groupConfig.audioUrl}
                      onChange={(e) => setGroupConfig({ ...groupConfig, audioUrl: e.target.value })}
                      placeholder="Dán URL mp3 nếu nhóm này có file audio riêng..."
                      className="w-full px-3 py-1.5 bg-blue-50/40 border border-blue-200 rounded-lg outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                      <span>URL Ảnh sơ đồ / Bản đồ / Biểu đồ dùng chung (Tùy chọn):</span>
                    </label>
                    <input
                      type="text"
                      value={groupConfig.imageUrl}
                      onChange={(e) => setGroupConfig({ ...groupConfig, imageUrl: e.target.value })}
                      placeholder="https://... ảnh sơ đồ / biểu đồ"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-600" />
                      <span>Nội dung ghi chú / Bảng biểu dùng chung (Group Text / Notes):</span>
                    </label>
                    <textarea
                      rows={3}
                      value={groupConfig.groupText}
                      onChange={(e) => setGroupConfig({ ...groupConfig, groupText: e.target.value })}
                      placeholder="Văn bản hoặc dàn ý bảng biểu hiển thị phía trên các câu hỏi..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-sans"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowGroupModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCreateGroup}
                    className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận tạo nhóm</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* QUESTION GROUPS LIST */}
          {activePart.questionGroups && activePart.questionGroups.length > 0 ? (
            <div className="space-y-6">
              {activePart.questionGroups.map((grp, gIdx) => (
                <div
                  key={grp.id || gIdx}
                  className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4 hover:border-purple-300 transition-colors"
                >
                  {/* Group Header Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          Tên nhóm câu hỏi:
                        </label>
                        <input
                          type="text"
                          value={grp.groupTitle || grp.title || ''}
                          onChange={(e) =>
                            handleUpdateGroup(gIdx, {
                              groupTitle: e.target.value,
                              title: e.target.value,
                            })
                          }
                          placeholder="VD: Questions 1-5"
                          className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:bg-white focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          Dạng câu hỏi IELTS Listening:
                        </label>
                        <select
                          value={grp.type || 'note_completion'}
                          onChange={(e) =>
                            handleUpdateGroup(gIdx, {
                              type: e.target.value as ListeningQuestionType,
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-bold text-purple-700 bg-purple-50/50 border border-purple-200 rounded-lg outline-hidden focus:bg-white focus:border-purple-500"
                        >
                          {LISTENING_QUESTION_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleAddQuestionToGroup(gIdx)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm câu hỏi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(gIdx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        title="Xóa nhóm này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Group Instructions & Word Limit */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Hướng dẫn làm bài (Instructions):
                      </label>
                      <input
                        type="text"
                        value={grp.instructions || ''}
                        onChange={(e) => handleUpdateGroup(gIdx, { instructions: e.target.value })}
                        placeholder="VD: Complete the notes below. Write NO MORE THAN TWO WORDS..."
                        className="w-full px-2.5 py-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:bg-white focus:border-purple-500 italic"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Giới hạn từ (Word limit):
                      </label>
                      <input
                        type="text"
                        value={grp.wordLimit || ''}
                        onChange={(e) => handleUpdateGroup(gIdx, { wordLimit: e.target.value })}
                        placeholder="NO MORE THAN TWO WORDS"
                        className="w-full px-2.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50/50 border border-amber-200 rounded-lg outline-hidden focus:bg-white focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Quick word limits pill shortcuts */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">
                      Chọn nhanh giới hạn:
                    </span>
                    {QUICK_WORD_LIMITS.map((lim, lIdx) => (
                      <button
                        key={lIdx}
                        type="button"
                        onClick={() => handleUpdateGroup(gIdx, { wordLimit: lim })}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition cursor-pointer ${
                          grp.wordLimit === lim
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                        }`}
                      >
                        {lim}
                      </button>
                    ))}
                  </div>

                  {/* Dedicated Audio Recording for Group (Shared Resource) */}
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>File Audio dùng riêng cho nhóm này (Tùy chọn)</span>
                      </span>
                      <span className="text-[10px] text-blue-600">
                        Học sinh sẽ nghe đoạn audio này riêng cho nhóm {grp.groupTitle || grp.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={grp.audioUrl || ''}
                        onChange={(e) => handleUpdateGroup(gIdx, { audioUrl: e.target.value })}
                        placeholder="Dán URL file mp3 dùng riêng cho nhóm này (https://...)"
                        className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-white border border-blue-200 rounded-lg outline-hidden text-slate-700 focus:border-blue-500"
                      />
                      {grp.audioUrl && (
                        <button
                          type="button"
                          onClick={() => handleUpdateGroup(gIdx, { audioUrl: undefined })}
                          className="text-xs text-rose-600 hover:underline px-2 shrink-0 cursor-pointer"
                        >
                          Xóa audio
                        </button>
                      )}
                    </div>
                    {grp.audioUrl && (
                      <audio controls src={grp.audioUrl} className="w-full h-8 mt-1" />
                    )}
                  </div>

                  {/* Shared Content / Group Outline (for notes outlines, table format, shared text) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">
                        Khung nội dung chung (Notes / Form / Table / Summary Outline):
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Hiển thị chung phía trên câu hỏi cho học sinh
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={grp.groupText || grp.sharedContent || ''}
                      onChange={(e) =>
                        handleUpdateGroup(gIdx, {
                          groupText: e.target.value,
                          sharedContent: e.target.value,
                        })
                      }
                      placeholder="Nhập tiêu đề mục, tiêu đề bảng hoặc khung ghi chú chung..."
                      className="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-hidden focus:bg-white focus:border-purple-500 text-slate-800 leading-relaxed whitespace-pre-wrap"
                    />
                  </div>

                  {/* If Matching or Labelling or Summary: Shared Options Box Manager */}
                  {(grp.type === 'matching' ||
                    grp.type === 'plan_map_diagram_labelling' ||
                    grp.type === 'summary_completion') && (
                    <div className="p-3 bg-purple-50/40 rounded-xl border border-purple-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                          <ListOrdered className="w-3.5 h-3.5 text-purple-600" />
                          <span>Danh sách lựa chọn chung (Options Box A - G)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const current = grp.optionsBox || grp.options || [];
                            const nextLetter = String.fromCharCode(65 + current.length);
                            const updated = [...current, `${nextLetter}. Lựa chọn mới`];
                            handleUpdateGroup(gIdx, { optionsBox: updated, options: updated });
                          }}
                          className="px-2 py-0.5 text-[11px] font-bold text-purple-700 bg-white hover:bg-purple-100 rounded border border-purple-200 flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Thêm lựa chọn</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(grp.optionsBox || grp.options || []).map((opt, oIdx) => {
                          const letter = opt.length <= 2 ? opt : String.fromCharCode(65 + oIdx);
                          const text = opt.replace(/^[A-Za-z][\.\:\)]\s*/, '');
                          return (
                            <div key={oIdx} className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-purple-100">
                              <span className="w-5 font-bold text-xs text-purple-700 text-center shrink-0">
                                {letter}.
                              </span>
                              <input
                                type="text"
                                value={text || opt}
                                onChange={(e) => {
                                  const current = [...(grp.optionsBox || grp.options || [])];
                                  current[oIdx] = `${letter}. ${e.target.value}`;
                                  handleUpdateGroup(gIdx, { optionsBox: current, options: current });
                                }}
                                className="flex-1 text-xs px-1.5 py-0.5 outline-hidden text-slate-800 font-medium"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const current = (grp.optionsBox || grp.options || []).filter((_, idx) => idx !== oIdx);
                                  handleUpdateGroup(gIdx, { optionsBox: current, options: current });
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Diagram / Map / Chart Image Upload (Available for labelling or any group sharing visual) */}
                  {(grp.type === 'plan_map_diagram_labelling' || grp.imageUrl !== undefined) ? (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                          <span>Ảnh sơ đồ / Bản đồ / Biểu đồ dùng chung</span>
                        </span>
                        <label className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{uploadingImageGroupId === grp.id ? 'Đang tải...' : 'Tải ảnh lên'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingImageGroupId === grp.id}
                            onChange={(e) => handleGroupImageUpload(gIdx, e)}
                          />
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={grp.imageUrl || ''}
                          onChange={(e) => handleUpdateGroup(gIdx, { imageUrl: e.target.value })}
                          placeholder="Hoặc dán URL ảnh (https://...)"
                          className="flex-1 px-2.5 py-1 text-xs font-mono bg-white border border-slate-300 rounded-lg outline-hidden text-slate-700"
                        />
                        {grp.imageUrl !== undefined && (
                          <button
                            type="button"
                            onClick={() => handleUpdateGroup(gIdx, { imageUrl: undefined })}
                            className="text-xs text-rose-600 hover:underline shrink-0 cursor-pointer"
                          >
                            Xóa ảnh
                          </button>
                        )}
                      </div>

                      {grp.imageUrl && (
                        <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                          <img
                            src={grp.imageUrl}
                            alt="Preview diagram"
                            className="max-h-48 w-auto mx-auto object-contain rounded"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => handleUpdateGroup(gIdx, { imageUrl: '' })}
                        className="text-xs text-purple-700 hover:text-purple-900 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>+ Thêm ảnh sơ đồ / biểu đồ / hình minh họa dùng chung</span>
                      </button>
                    </div>
                  )}

                  {/* QUESTIONS IN GROUP */}
                  <div className="space-y-3 pt-2">
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                      <span>Danh sách câu hỏi trong nhóm ({grp.questions?.length || 0}):</span>
                      <span className="text-slate-400 font-normal">
                        Kéo hoặc bấm mũi tên để đổi thứ tự câu
                      </span>
                    </div>

                    {grp.questions && grp.questions.length > 0 ? (
                      grp.questions.map((q, qIdx) => (
                        <div
                          key={q.id || qIdx}
                          className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2 hover:border-purple-300 transition-colors"
                        >
                          {/* Question Card Header */}
                          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                            <div className="flex items-center gap-2">
                              {/* Selection checkbox */}
                              <input
                                type="checkbox"
                                checked={selectedQuestionIds.has(q.id)}
                                onChange={() => handleToggleSelectQuestion(q.id)}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
                                title="Chọn câu hỏi này để gộp nhóm tài nguyên dùng chung"
                              />

                              {/* Question number badge & custom number input */}
                              <span className="w-7 h-7 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                                {q.questionNumber || q.number || qIdx + 1}
                              </span>

                              {/* Question Type Selector for this question */}
                              <select
                                value={q.type || grp.type || 'note_completion'}
                                onChange={(e) =>
                                  handleUpdateQuestion(q.id, {
                                    type: e.target.value as ListeningQuestionType,
                                  })
                                }
                                className="px-2 py-1 text-xs font-semibold text-purple-800 bg-white border border-purple-200 rounded-md outline-hidden focus:border-purple-500"
                              >
                                {LISTENING_QUESTION_TYPES.map((t) => (
                                  <option key={t.value} value={t.value}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Question Actions (Up, Down, Duplicate, Delete, Ungroup, Move) */}
                            <div className="flex items-center space-x-1">
                              {/* Ungroup button */}
                              {grp.questions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleUngroupQuestions([q.id])}
                                  className="px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:text-purple-700 bg-white border border-slate-200 rounded hover:bg-purple-50 transition cursor-pointer"
                                  title="Tách thành câu độc lập (Ungroup)"
                                >
                                  Tách
                                </button>
                              )}

                              {/* Move to another group selector */}
                              {activePart.questionGroups && activePart.questionGroups.length > 1 && (
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleMoveQuestionsToGroup([q.id], e.target.value);
                                    }
                                  }}
                                  className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 rounded outline-hidden hover:border-purple-300 cursor-pointer"
                                  title="Chuyển câu hỏi này sang nhóm khác"
                                >
                                  <option value="" disabled>Chuyển nhóm...</option>
                                  {activePart.questionGroups
                                    .filter((otherG) => otherG.id !== grp.id)
                                    .map((otherG, ogIdx) => (
                                      <option key={otherG.id} value={otherG.id}>
                                        {otherG.groupTitle || otherG.title || `Nhóm ${ogIdx + 1}`}
                                      </option>
                                    ))}
                                </select>
                              )}
                              <button
                                type="button"
                                onClick={() => handleMoveQuestion(q.id, 'up')}
                                disabled={qIdx === 0}
                                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200 transition cursor-pointer"
                                title="Di chuyển lên trên"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveQuestion(q.id, 'down')}
                                disabled={qIdx === (grp.questions?.length || 0) - 1}
                                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200 transition cursor-pointer"
                                title="Di chuyển xuống dưới"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateQuestion(q.id)}
                                className="p-1 text-slate-400 hover:text-purple-600 rounded hover:bg-purple-50 transition cursor-pointer"
                                title="Nhân bản câu hỏi này"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                                title="Xóa câu hỏi này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Question Type Specific Body */}
                          {renderQuestionTypeEditor(q, grp)}
                        </div>
                      ))
                    ) : (
                      <div className="p-4 bg-white rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                        Chưa có câu hỏi nào trong nhóm này. Bấm "+ Thêm câu hỏi" để tạo.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">
                Chưa có nhóm câu hỏi nào cho Part này.
              </p>
              <button
                type="button"
                onClick={handleAddQuestionGroup}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm nhóm câu hỏi mới</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
