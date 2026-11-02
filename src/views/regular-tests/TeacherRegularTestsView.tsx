import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../i18n/context';
import type {
  RegularTest,
  RegularTestSection,
  RegularTestTimingMode,
  StrictExamPreset,
  WritingTaskCategory,
  SpeakingTopic,
  SpeakingCueCard,
  SpeakingPart3Group,
  ReadingQuestion,
  QuestionGroup,
} from '../../types';
import { TeacherLiveDashboardModal } from './TeacherLiveDashboardModal';
import { TeacherGradingModal } from './TeacherGradingModal';
import { Portal } from '../../components/Portal';
import { extractAllNormalizedQuestions } from '../../lib/questionNormalizer';
import { parseDocumentStructure } from '../../lib/documentExtractor';
import { parseListeningDocument } from '../../lib/listeningExtractor';
import {
  ShieldCheck,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Lock,
  Archive,
  Radio,
  BookOpen,
  PenTool,
  Clock,
  Calendar,
  Users,
  Award,
  AlertCircle,
  CheckCircle,
  X,
  Library,
  Mic,
  Headphones,
  ArrowUp,
  ArrowDown,
  FileText,
  Image as ImageIcon,
  Check,
  ChevronRight,
  HelpCircle,
  Info,
  Maximize2,
  FolderPlus,
  Sparkles,
  Bold,
  Italic,
  Upload,
  FileUp,
} from 'lucide-react';
import { parseFormattedPrompt } from '../../lib/regularTestManager';
import { extractWritingFromFile, type ExtractedWritingTask } from '../../lib/writingDocumentExtractor';

export const TeacherRegularTestsView: React.FC = () => {
  const {
    courses,
    resources,
    regularTests,
    regularTestAttempts,
    createRegularTest,
    updateRegularTest,
    publishRegularTest,
    closeRegularTest,
    archiveRegularTest,
    deleteRegularTest,
  } = useApp();
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [showCreatorModal, setShowCreatorModal] = useState<boolean>(false);
  const [editingTest, setEditingTest] = useState<RegularTest | null>(null);
  const [liveDashboardTest, setLiveDashboardTest] = useState<RegularTest | null>(null);
  const [gradingAttemptData, setGradingAttemptData] = useState<{ test: RegularTest; attempt: any } | null>(null);
  const [attemptsListTest, setAttemptsListTest] = useState<RegularTest | null>(null);

  // Form State for Test Creator
  const [formTitle, setFormTitle] = useState<string>('');
  const [formInstructions, setFormInstructions] = useState<string>('');
  const [formCourseId, setFormCourseId] = useState<string>(courses[0]?.id || '');
  const [formSkills, setFormSkills] = useState<('listening' | 'reading' | 'writing' | 'speaking')[]>(['reading', 'writing']);
  const [formSkillDurations, setFormSkillDurations] = useState<{ listening: number; reading: number; writing: number; speaking: number }>({
    listening: 30,
    reading: 60,
    writing: 60,
    speaking: 15,
  });
  const [formDuration, setFormDuration] = useState<number>(60);
  const [formTimingMode, setFormTimingMode] = useState<RegularTestTimingMode>('overall_timer');
  const [formAvailabilityStart, setFormAvailabilityStart] = useState<string>('');
  const [formAvailabilityEnd, setFormAvailabilityEnd] = useState<string>('');
  const [formHardDeadline, setFormHardDeadline] = useState<string>('');
  const [formMaxAttempts, setFormMaxAttempts] = useState<number>(1);
  const [formStrictPreset, setFormStrictPreset] = useState<StrictExamPreset>('standard');
  const [formAccessCodeEnabled, setFormAccessCodeEnabled] = useState<boolean>(false);
  const [formAccessCode, setFormAccessCode] = useState<string>('');
  const [formSections, setFormSections] = useState<RegularTestSection[]>([]);
  const [savingTest, setSavingTest] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sub-Modals for Section Creation & Preview
  const [showListeningPicker, setShowListeningPicker] = useState<boolean>(false);
  const [listeningPickerSearch, setListeningPickerSearch] = useState<string>('');
  const [showListeningModal, setShowListeningModal] = useState<boolean>(false);
  const [listeningAudioUrl, setListeningAudioUrl] = useState<string>('');
  const [listeningTitle, setListeningTitle] = useState<string>('');
  const [listeningRawText, setListeningRawText] = useState<string>('');

  const [showReadingPicker, setShowReadingPicker] = useState<boolean>(false);
  const [readingPickerSearch, setReadingPickerSearch] = useState<string>('');
  const [previewReadingSection, setPreviewReadingSection] = useState<RegularTestSection | null>(null);
  const [previewActivePassageTab, setPreviewActivePassageTab] = useState<number>(0);

  // Writing Manual Modal
  const [showWritingModal, setShowWritingModal] = useState<boolean>(false);
  const [editingWritingSecId, setEditingWritingSecId] = useState<string | null>(null);
  const [writingTaskCategory, setWritingTaskCategory] = useState<WritingTaskCategory>('task2');
  const [writingPrompt, setWritingPrompt] = useState<string>('');
  const [writingMinWords, setWritingMinWords] = useState<number>(250);
  const [writingImageUrl, setWritingImageUrl] = useState<string>('');
  const [writingModelAnswer, setWritingModelAnswer] = useState<string>('');
  const [writingSectionDuration, setWritingSectionDuration] = useState<number>(40);
  const writingPromptRef = React.useRef<HTMLTextAreaElement>(null);

  // Writing Library Picker & File Import states
  const [showWritingPicker, setShowWritingPicker] = useState<boolean>(false);
  const [writingPickerSearch, setWritingPickerSearch] = useState<string>('');
  const writingFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isProcessingWritingFile, setIsProcessingWritingFile] = useState<boolean>(false);
  const [writingImportStatus, setWritingImportStatus] = useState<string>('');
  const [showWritingImportModal, setShowWritingImportModal] = useState<boolean>(false);
  const [importedWritingTasks, setImportedWritingTasks] = useState<ExtractedWritingTask[]>([]);
  const [importedWritingDocTitle, setImportedWritingDocTitle] = useState<string>('');

  const applyWritingFormatting = (fmt: 'bold' | 'italic') => {
    const el = writingPromptRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = writingPrompt.slice(start, end);
    const wrap = fmt === 'bold' ? '**' : '*';
    const rep = sel ? `${wrap}${sel}${wrap}` : `${wrap}nội dung${wrap}`;
    const nextVal = writingPrompt.slice(0, start) + rep + writingPrompt.slice(end);
    setWritingPrompt(nextVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + wrap.length, start + rep.length - wrap.length);
    }, 40);
  };

  // Speaking Part Pickers
  const [speakingPickerPart, setSpeakingPickerPart] = useState<'part1' | 'part2' | 'part3' | null>(null);
  const [selectedSpeakingResource, setSelectedSpeakingResource] = useState<any | null>(null);
  const [speakingSearchQuery, setSpeakingSearchQuery] = useState<string>('');
  const [selectedPart1TopicIds, setSelectedPart1TopicIds] = useState<Record<string, boolean>>({});
  const [part1TopicCount, setPart1TopicCount] = useState<number>(3);
  const [selectedCueCardIndex, setSelectedCueCardIndex] = useState<number>(0);
  const [selectedCueCardIndices, setSelectedCueCardIndices] = useState<Record<number, boolean>>({});
  const [includeAssociatedPart3, setIncludeAssociatedPart3] = useState<boolean>(false);
  const [selectedPart3QuestionIndices, setSelectedPart3QuestionIndices] = useState<Record<number, boolean>>({});

  const getSpeakingResourceDetails = (res: any) => {
    if (!res) return { topics: [] as SpeakingTopic[], cueCards: [] as any[], groups: [] as SpeakingPart3Group[], questions: [] as string[] };
    let parsedContent: any = {};
    if (res.content && typeof res.content === 'string') {
      try { parsedContent = JSON.parse(res.content); } catch {}
    } else if (res.content && typeof res.content === 'object') {
      parsedContent = res.content;
    }

    const topics: SpeakingTopic[] = res.speakingPart1?.topics || parsedContent.topics || parsedContent.speakingPart1?.topics || [];
    const cueCards: any[] = res.speakingPart2?.cueCards || parsedContent.cueCards || parsedContent.speakingPart2?.cueCards || [];
    const groups: SpeakingPart3Group[] = res.speakingPart3?.groups || parsedContent.groups || parsedContent.speakingPart3?.groups || [];
    const questions: string[] = res.speakingPart3?.questions || parsedContent.questions || parsedContent.speakingPart3?.questions || groups.flatMap((g: any) => g.questions || []);

    return { topics, cueCards, groups, questions };
  };

  // Filtered Tests
  const filteredTests = regularTests.filter((test) => {
    if (selectedCourseFilter !== 'all' && test.courseId !== selectedCourseFilter) return false;
    if (statusFilter !== 'all' && test.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return test.title.toLowerCase().includes(q) || (test.courseName || '').toLowerCase().includes(q);
    }
    return true;
  });

  const resetForm = () => {
    setFormTitle('');
    setFormInstructions('');
    setFormCourseId(courses[0]?.id || '');
    setFormSkills(['reading']);
    setFormDuration(60);
    setFormTimingMode('overall_timer');
    setFormAvailabilityStart('');
    setFormAvailabilityEnd('');
    setFormHardDeadline('');
    setFormMaxAttempts(1);
    setFormStrictPreset('standard');
    setFormAccessCodeEnabled(false);
    setFormAccessCode('');
    setFormSections([]);
    setFormError(null);
    setEditingTest(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreatorModal(true);
  };

  const openEditModal = (test: RegularTest) => {
    setEditingTest(test);
    setFormTitle(test.title);
    setFormInstructions(test.instructions);
    setFormCourseId(test.courseId);
    setFormSkills(test.skills || ['reading']);
    setFormDuration(test.durationMinutes);
    setFormTimingMode(test.timingMode);
    setFormAvailabilityStart(test.availabilityStart || '');
    setFormAvailabilityEnd(test.availabilityEnd || '');
    setFormHardDeadline(test.hardDeadline || '');
    setFormMaxAttempts(test.maxAttempts);
    setFormStrictPreset(test.strictPreset);
    setFormAccessCodeEnabled(test.accessCodeEnabled);
    setFormAccessCode(test.accessCodeHash ? '******' : '');
    setFormSections(test.sections || []);
    setShowCreatorModal(true);
  };

  const handleSaveTest = async () => {
    if (!formTitle.trim()) {
      setFormError('Vui lòng nhập tiêu đề bài kiểm tra (Test title is required)');
      return;
    }
    if (!formCourseId) {
      setFormError('Vui lòng chọn khóa học áp dụng');
      return;
    }
    if (formSections.length === 0) {
      setFormError('Vui lòng thêm ít nhất một phần thi (Reading, Writing hoặc Speaking)');
      return;
    }

    try {
      setSavingTest(true);
      setFormError(null);

      // Auto derive skills from added sections
      const activeSkills: ('listening' | 'reading' | 'writing' | 'speaking')[] = Array.from(
        new Set(formSections.map((s) => s.skill))
      );

      if (editingTest) {
        await updateRegularTest(editingTest.id, {
          title: formTitle.trim(),
          instructions: formInstructions.trim(),
          courseId: formCourseId,
          skills: activeSkills.length > 0 ? activeSkills : formSkills,
          durationMinutes: formDuration,
          timingMode: formTimingMode,
          availabilityStart: formAvailabilityStart || undefined,
          availabilityEnd: formAvailabilityEnd || undefined,
          hardDeadline: formHardDeadline || undefined,
          maxAttempts: formMaxAttempts,
          strictPreset: formStrictPreset,
          accessCodeEnabled: formAccessCodeEnabled,
          accessCodeHash: formAccessCode && formAccessCode !== '******' ? formAccessCode : undefined,
          sections: formSections,
        });
      } else {
        await createRegularTest({
          title: formTitle.trim(),
          instructions: formInstructions.trim(),
          courseId: formCourseId,
          skills: activeSkills.length > 0 ? activeSkills : formSkills,
          durationMinutes: formDuration,
          timingMode: formTimingMode,
          availabilityStart: formAvailabilityStart || undefined,
          availabilityEnd: formAvailabilityEnd || undefined,
          hardDeadline: formHardDeadline || undefined,
          maxAttempts: formMaxAttempts,
          strictPreset: formStrictPreset,
          accessCodeEnabled: formAccessCodeEnabled,
          accessCodeHash: formAccessCode || undefined,
          sections: formSections,
        });
      }

      setShowCreatorModal(false);
      resetForm();
    } catch (err: any) {
      setFormError(err.message || 'Không thể lưu bài kiểm tra');
    } finally {
      setSavingTest(false);
    }
  };

  // Section Reordering
  const moveSectionUp = (idx: number) => {
    if (idx === 0) return;
    setFormSections((prev) => {
      const copy = [...prev];
      const temp = copy[idx - 1];
      copy[idx - 1] = copy[idx];
      copy[idx] = temp;
      return copy;
    });
  };

  const moveSectionDown = (idx: number) => {
    if (idx === formSections.length - 1) return;
    setFormSections((prev) => {
      const copy = [...prev];
      const temp = copy[idx + 1];
      copy[idx + 1] = copy[idx];
      copy[idx] = temp;
      return copy;
    });
  };

  const removeSection = (idx: number) => {
    setFormSections((prev) => prev.filter((_, i) => i !== idx));
  };

  // 1. Reading Import from Materials Library
  const handleImportReadingResource = (resource: any) => {
    let readingPassage = resource.content || '';
    let readingQuestions: ReadingQuestion[] = [];
    let questionGroups: QuestionGroup[] = [];
    let passages: any[] = [];
    let title = resource.title || 'IELTS Reading Section';

    if (resource.content && (resource.content.trim().startsWith('{') || resource.content.trim().startsWith('['))) {
      try {
        const parsed = JSON.parse(resource.content);
        if (parsed.title) title = parsed.title;
        const extracted = extractAllNormalizedQuestions(parsed);
        if (extracted.questions && extracted.questions.length > 0) {
          readingQuestions = extracted.questions;
          questionGroups = extracted.questionGroups;
          passages = extracted.passages;
        }

        if (parsed.passages && Array.isArray(parsed.passages) && parsed.passages.length > 0) {
          passages = parsed.passages;
          readingPassage = parsed.passages[0]?.content || '';
        } else if (parsed.readingPassage || parsed.passageText || parsed.content) {
          readingPassage = parsed.readingPassage || parsed.passageText || parsed.content || '';
        }
      } catch {
        // Plain text fallback
      }
    }

    if (readingQuestions.length === 0 && readingPassage) {
      const docStruct = parseDocumentStructure(readingPassage, title);
      if (docStruct.questions && docStruct.questions.length > 0) {
        readingQuestions = docStruct.questions;
        if (docStruct.candidateTests && docStruct.candidateTests.length > 0) {
          questionGroups = docStruct.candidateTests[0]?.questionGroups || [];
          if (passages.length === 0 && docStruct.candidateTests[0]?.passageText) {
            passages = [
              {
                id: 'p_1',
                passageIndex: 0,
                title: docStruct.candidateTests[0].title || 'Passage 1',
                content: docStruct.candidateTests[0].passageText,
                questions: docStruct.candidateTests[0].questions || [],
                questionGroups: docStruct.candidateTests[0].questionGroups || [],
              },
            ];
          }
        }
      }
    }

    const newSec: RegularTestSection = {
      id: `sec_${Date.now()}_reading`,
      skill: 'reading',
      title,
      resourceId: resource.id,
      durationMinutes: 60,
      readingPassage,
      readingQuestions,
      questionGroups,
      passages: passages.length > 0 ? passages : undefined,
      readingTestType: 'academic',
    };

    setFormSections((prev) => [...prev, newSec]);
    if (!formSkills.includes('reading')) {
      setFormSkills((prev) => [...prev, 'reading']);
    }
    setShowReadingPicker(false);
  };

  const handlePreviewLibraryResource = (resource: any) => {
    let readingPassage = resource.content || '';
    let readingQuestions: ReadingQuestion[] = [];
    let questionGroups: QuestionGroup[] = [];
    let passages: any[] = [];
    let title = resource.title || 'IELTS Reading Section';

    if (resource.content && (resource.content.trim().startsWith('{') || resource.content.trim().startsWith('['))) {
      try {
        const parsed = JSON.parse(resource.content);
        if (parsed.title) title = parsed.title;
        const extracted = extractAllNormalizedQuestions(parsed);
        if (extracted.questions && extracted.questions.length > 0) {
          readingQuestions = extracted.questions;
          questionGroups = extracted.questionGroups;
          passages = extracted.passages;
        }

        if (parsed.passages && Array.isArray(parsed.passages) && parsed.passages.length > 0) {
          passages = parsed.passages;
          readingPassage = parsed.passages[0]?.content || '';
        } else if (parsed.readingPassage || parsed.passageText || parsed.content) {
          readingPassage = parsed.readingPassage || parsed.passageText || parsed.content || '';
        }
      } catch {}
    }

    if (readingQuestions.length === 0 && readingPassage) {
      const docStruct = parseDocumentStructure(readingPassage, title);
      if (docStruct.questions && docStruct.questions.length > 0) {
        readingQuestions = docStruct.questions;
        if (docStruct.candidateTests && docStruct.candidateTests.length > 0) {
          questionGroups = docStruct.candidateTests[0]?.questionGroups || [];
          if (passages.length === 0 && docStruct.candidateTests[0]?.passageText) {
            passages = [
              {
                id: 'p_1',
                passageIndex: 0,
                title: docStruct.candidateTests[0].title || 'Passage 1',
                content: docStruct.candidateTests[0].passageText,
                questions: docStruct.candidateTests[0].questions || [],
                questionGroups: docStruct.candidateTests[0].questionGroups || [],
              },
            ];
          }
        }
      }
    }

    setPreviewReadingSection({
      id: `preview_${Date.now()}`,
      skill: 'reading',
      title,
      durationMinutes: 60,
      readingPassage,
      readingQuestions,
      questionGroups,
      passages: passages.length > 0 ? passages : undefined,
      readingTestType: 'academic',
    });
    setPreviewActivePassageTab(0);
  };


  // 2. Writing Manual Creator
  const openCreateWritingModal = (existingSec?: RegularTestSection) => {
    if (existingSec) {
      setEditingWritingSecId(existingSec.id);
      setWritingTaskCategory(existingSec.writingTaskCategory || 'task2');
      setWritingPrompt(existingSec.writingPrompt || '');
      setWritingMinWords(existingSec.writingMinWords || (existingSec.writingTaskType === 'task1' ? 150 : 250));
      setWritingImageUrl(existingSec.task1ImageUrl || '');
      setWritingModelAnswer(existingSec.modelAnswer || '');
      setWritingSectionDuration(existingSec.durationMinutes || (existingSec.writingTaskType === 'task1' ? 20 : 40));
    } else {
      setEditingWritingSecId(null);
      setWritingTaskCategory('task2');
      setWritingPrompt('');
      setWritingMinWords(250);
      setWritingImageUrl('');
      setWritingModelAnswer('');
      setWritingSectionDuration(40);
    }
    setShowWritingModal(true);
  };

  const handleSaveWritingSection = () => {
    if (!writingPrompt.trim()) {
      alert('Vui lòng nhập đề bài Writing (Writing Prompt is required)');
      return;
    }

    const isTask1 = writingTaskCategory.startsWith('task1');
    const taskTitle = isTask1
      ? 'Writing Task 1 (Academic Graph / Chart / Diagram)'
      : 'Writing Task 2 (Academic Essay)';

    if (editingWritingSecId) {
      setFormSections((prev) =>
        prev.map((s) =>
          s.id === editingWritingSecId
            ? {
                ...s,
                title: taskTitle,
                writingTaskType: isTask1 ? 'task1' : 'task2',
                writingTaskCategory,
                writingPrompt: writingPrompt.trim(),
                writingMinWords,
                task1ImageUrl: isTask1 ? writingImageUrl.trim() : undefined,
                modelAnswer: writingModelAnswer.trim() || undefined,
                durationMinutes: writingSectionDuration,
              }
            : s
        )
      );
    } else {
      const newSec: RegularTestSection = {
        id: `sec_${Date.now()}_writing`,
        skill: 'writing',
        title: taskTitle,
        writingTaskType: isTask1 ? 'task1' : 'task2',
        writingTaskCategory,
        writingPrompt: writingPrompt.trim(),
        writingMinWords,
        task1ImageUrl: isTask1 ? writingImageUrl.trim() : undefined,
        modelAnswer: writingModelAnswer.trim() || undefined,
        durationMinutes: writingSectionDuration,
      };
      setFormSections((prev) => [...prev, newSec]);
      if (!formSkills.includes('writing')) {
        setFormSkills((prev) => [...prev, 'writing']);
      }
    }

    setShowWritingModal(false);
  };

  const handleSelectWritingFromLibrary = (resource: any) => {
    let taskType: 'task1' | 'task2' = 'task2';
    let taskCat: WritingTaskCategory = 'task2';
    let prompt = '';
    let imgUrl: string | undefined = resource.url || undefined;
    let modelAns: string | undefined = undefined;
    let minWords = 250;
    let duration = 40;

    if (resource.content) {
      try {
        const parsed = JSON.parse(resource.content);
        if (parsed && typeof parsed === 'object') {
          taskType = parsed.taskType || (resource.title?.toLowerCase().includes('task 1') ? 'task1' : 'task2');
          const chart = (parsed.chartType || '').toLowerCase();
          taskCat = taskType === 'task1' ? (chart.includes('general') ? 'task1_general' : 'task1_academic') : 'task2';
          prompt = parsed.prompt || parsed.writingPrompt || parsed.content || '';
          if (parsed.imageUrl || parsed.task1ImageUrl) imgUrl = parsed.imageUrl || parsed.task1ImageUrl;
          modelAns = parsed.modelAnswer || parsed.sampleAnswer || parsed.sampleAnswers?.[0]?.content;
          minWords = parsed.minWords || (taskType === 'task1' ? 150 : 250);
          duration = taskType === 'task1' ? 20 : 40;
        }
      } catch {
        prompt = resource.content;
      }
    }
    if (!prompt) prompt = resource.title || '';

    const isTask1 = taskType === 'task1';
    const newSec: RegularTestSection = {
      id: `sec_${Date.now()}_writing_${Math.random().toString(36).slice(2, 6)}`,
      skill: 'writing',
      title: isTask1 ? 'Writing Task 1 (Academic Graph / Chart / Diagram)' : 'Writing Task 2 (Academic Essay)',
      writingTaskType: taskType,
      writingTaskCategory: taskCat,
      writingPrompt: prompt.trim(),
      writingMinWords: minWords,
      task1ImageUrl: isTask1 ? imgUrl : undefined,
      modelAnswer: modelAns?.trim() || undefined,
      durationMinutes: duration,
    };
    setFormSections((prev) => [...prev, newSec]);
    if (!formSkills.includes('writing')) {
      setFormSkills((prev) => [...prev, 'writing']);
    }
    setShowWritingPicker(false);
  };

  const handleWritingFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingWritingFile(true);
    setWritingImportStatus('Đang đọc và phân tích tài liệu Writing...');
    try {
      const { doc } = await extractWritingFromFile(file);
      if (!doc.tasks || doc.tasks.length === 0) {
        alert('Không tìm thấy câu hỏi Writing (Task 1 / Task 2) trong file.');
        return;
      }
      setImportedWritingTasks(doc.tasks);
      setImportedWritingDocTitle(doc.title || file.name.replace(/\.[^/.]+$/, ''));
      setShowWritingImportModal(true);
    } catch (err: any) {
      alert(`Lỗi phân tích file Writing: ${err.message || 'Không thể trích xuất file'}`);
    } finally {
      setIsProcessingWritingFile(false);
      setWritingImportStatus('');
      if (writingFileInputRef.current) writingFileInputRef.current.value = '';
    }
  };

  const handleConfirmImportedWritingTasks = (selectedTasks: ExtractedWritingTask[]) => {
    if (!selectedTasks || selectedTasks.length === 0) {
      alert('Vui lòng chọn ít nhất 1 bài Writing.');
      return;
    }
    selectedTasks.forEach((t) => {
      const isTask1 = t.taskType === 'task1';
      const newSec: RegularTestSection = {
        id: `sec_${Date.now()}_writing_${Math.random().toString(36).slice(2, 6)}`,
        skill: 'writing',
        title: isTask1 ? 'Writing Task 1 (Academic Graph / Chart / Diagram)' : 'Writing Task 2 (Academic Essay)',
        writingTaskType: t.taskType,
        writingTaskCategory: t.taskCategory,
        writingPrompt: t.prompt,
        writingMinWords: t.minWords,
        task1ImageUrl: isTask1 ? t.imageUrl : undefined,
        modelAnswer: t.sampleAnswers?.[0]?.content,
        durationMinutes: isTask1 ? 20 : 40,
      };
      setFormSections((prev) => [...prev, newSec]);
    });
    if (!formSkills.includes('writing')) {
      setFormSkills((prev) => [...prev, 'writing']);
    }
    setShowWritingImportModal(false);
  };

  // 3. Speaking Independent Selection
  const openSpeakingPicker = (part: 'part1' | 'part2' | 'part3') => {
    setSpeakingPickerPart(part);
    setSelectedSpeakingResource(null);
    setSelectedPart1TopicIds({});
    setPart1TopicCount(3);
    setSelectedCueCardIndex(0);
    setSelectedCueCardIndices({});
    setIncludeAssociatedPart3(false);
    setSelectedPart3QuestionIndices({});
  };

  const handleConfirmSpeakingSection = () => {
    if (!selectedSpeakingResource) return;
    const details = getSpeakingResourceDetails(selectedSpeakingResource);

    if (speakingPickerPart === 'part1') {
      const topics: SpeakingTopic[] = details.topics;
      const chosenTopics = topics.filter((tp) => selectedPart1TopicIds[tp.id]);
      if (chosenTopics.length === 0) {
        alert('Vui lòng chọn ít nhất 1 chủ đề Part 1.');
        return;
      }
      const finalTopics = chosenTopics;

      const newSec: RegularTestSection = {
        id: `sec_${Date.now()}_spk1`,
        skill: 'speaking',
        title: `Speaking Part 1: ${selectedSpeakingResource.title} (${finalTopics.length} chủ đề)`,
        resourceId: selectedSpeakingResource.id,
        speakingPart: 'part1',
        speakingTopics: finalTopics,
        speakingTopicCount: finalTopics.length,
        durationMinutes: 5,
      };

      setFormSections((prev) => [...prev, newSec]);
    } else if (speakingPickerPart === 'part2') {
      const cueCards: Array<{ id?: string; topic: string; points: string[] }> = details.cueCards;

      const selectedIndices = Object.keys(selectedCueCardIndices)
        .filter((k) => selectedCueCardIndices[Number(k)])
        .map(Number);

      if (selectedIndices.length === 0 && cueCards.length > 0) {
        alert('Vui lòng chọn ít nhất 1 Cue Card Part 2.');
        return;
      }

      const chosenCards: SpeakingCueCard[] = (
        selectedIndices.length > 0
          ? selectedIndices.map((i) => cueCards[i])
          : [cueCards[selectedCueCardIndex]]
      )
        .filter(Boolean)
        .map((c) => ({
          topic: c.topic || selectedSpeakingResource.title,
          points: c.points || ['What it is', 'Why it matters', 'How you feel about it'],
          prepTimeSeconds: 60,
          speakTimeSeconds: 120,
        }));

      // Automatically retrieve question groups associated with selected cue cards
      const p3Groups: SpeakingPart3Group[] = details.groups;

      const matchedGroups: SpeakingPart3Group[] = [];
      chosenCards.forEach((card, idx) => {
        const found =
          p3Groups.find(
            (g) =>
              (g.cueCardTopic &&
                (card.topic.toLowerCase().includes(g.cueCardTopic.toLowerCase().slice(0, 15)) ||
                  g.cueCardTopic.toLowerCase().includes(card.topic.toLowerCase().slice(0, 15)))) ||
              (g.cueCardId && g.cueCardId === (card as any).id)
          );
        if (found && found.questions && found.questions.length > 0) {
          matchedGroups.push({
            id: found.id || `p3_g_${idx + 1}`,
            cueCardTopic: card.topic,
            questions: found.questions,
          });
        }
      });

      const newSec: RegularTestSection = {
        id: `sec_${Date.now()}_spk2`,
        skill: 'speaking',
        title:
          chosenCards.length === 1
            ? `Speaking Part 2: ${chosenCards[0].topic}`
            : `Speaking Part 2 (${chosenCards.length} Cue Cards)`,
        resourceId: selectedSpeakingResource.id,
        speakingPart: 'part2',
        speakingCueCard: chosenCards[0],
        speakingCueCards: chosenCards,
        speakingTopic: chosenCards[0]?.topic,
        speakingPoints: chosenCards[0]?.points,
        speakingPart3Groups: matchedGroups,
        durationMinutes: 4 * Math.max(1, chosenCards.length),
      };

      setFormSections((prev) => [...prev, newSec]);

      // Add associated Part 3 discussion section ONLY if explicitly opted in
      if (includeAssociatedPart3 && matchedGroups.length > 0) {
        const allP3Questions = matchedGroups.flatMap((g) => g.questions);
        const p3Sec: RegularTestSection = {
          id: `sec_${Date.now() + 1}_spk3`,
          skill: 'speaking',
          title: `Speaking Part 3 (Associated with Part 2)`,
          resourceId: selectedSpeakingResource.id,
          speakingPart: 'part3',
          speakingQuestions: allP3Questions,
          speakingPart3Groups: matchedGroups,
          durationMinutes: 5,
        };
        setFormSections((prev) => [...prev, p3Sec]);
      }
    } else if (speakingPickerPart === 'part3') {
      const questions: string[] = details.questions;
      const groups: SpeakingPart3Group[] = details.groups;

      const selectedIdxs = Object.keys(selectedPart3QuestionIndices)
        .map(Number)
        .filter((i) => selectedPart3QuestionIndices[i]);

      const finalQuestions =
        selectedIdxs.length > 0
          ? selectedIdxs.map((i) => questions[i]).filter(Boolean)
          : questions;

      const filteredGroups = groups
        .map((g) => ({
          ...g,
          questions: g.questions.filter((q) => finalQuestions.includes(q)),
        }))
        .filter((g) => g.questions.length > 0);

      const finalGroups =
        filteredGroups.length > 0
          ? filteredGroups
          : finalQuestions.length > 0
          ? [{ id: 'p3_custom_grp', cueCardTopic: selectedSpeakingResource.title, questions: finalQuestions }]
          : [];

      const newSec: RegularTestSection = {
        id: `sec_${Date.now()}_spk3`,
        skill: 'speaking',
        title: `Speaking Part 3: ${selectedSpeakingResource.title}`,
        resourceId: selectedSpeakingResource.id,
        speakingPart: 'part3',
        speakingQuestions: finalQuestions,
        speakingPart3Groups: finalGroups,
        durationMinutes: 5,
      };

      setFormSections((prev) => [...prev, newSec]);
    }

    if (!formSkills.includes('speaking')) {
      setFormSkills((prev) => [...prev, 'speaking']);
    }

    setSpeakingPickerPart(null);
  };

  const handleDeleteTest = async (testId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài kiểm tra định kỳ này? Thao tác này không thể hoàn tác.')) return;
    const res = await deleteRegularTest(testId);
    if (!res.success) {
      alert(res.message);
    }
  };

  // FULL-PAGE DEDICATED GRADING WORKSPACE (Replaces main page content completely)
  if (gradingAttemptData) {
    return (
      <TeacherGradingModal
        test={gradingAttemptData.test}
        attempt={gradingAttemptData.attempt}
        onClose={() => setGradingAttemptData(null)}
      />
    );
  }

  // FULL-SCREEN DEDICATED WORKSPACE FOR CREATE / EDIT REGULAR TEST
  if (showCreatorModal) {
    const listeningSections = formSections.filter((s) => s.skill === 'listening');
    const readingSections = formSections.filter((s) => s.skill === 'reading');
    const writingSections = formSections.filter((s) => s.skill === 'writing');
    const speakingSections = formSections.filter((s) => s.skill === 'speaking');
    const filteredListeningResources = resources.filter((r) => {
      const isListening = r.skill === 'listening' || (r as any).type === 'listening' || Boolean(r.listeningContent);
      if (!isListening) return false;
      if (!listeningPickerSearch.trim()) return true;
      const q = listeningPickerSearch.toLowerCase();
      return (
        (r.title || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q) ||
        ((r.tags || []) as string[]).some((tag) => tag.toLowerCase().includes(q))
      );
    });
    const filteredReadingResources = resources.filter((r) => {
      const isReading = r.skill === 'reading' || (r as any).type === 'reading';
      if (!isReading) return false;
      if (!readingPickerSearch.trim()) return true;
      const q = readingPickerSearch.toLowerCase();
      return (
        (r.title || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q) ||
        ((r.tags || []) as string[]).some((tag) => tag.toLowerCase().includes(q))
      );
    });

    return (
      <div className="-m-4 md:-m-8 h-[calc(100vh-4rem)] flex flex-col bg-slate-100 overflow-hidden font-sans select-none animate-in fade-in duration-150">
        {/* Top Header */}
        <header className="h-14 bg-slate-900 text-white flex items-center justify-between px-6 shrink-0 z-20 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold flex items-center gap-2">
                {editingTest ? 'Chỉnh sửa bài kiểm tra định kỳ' : 'Tạo mới bài kiểm tra định kỳ (Create Regular Test)'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Cấu hình kỹ năng Listening, Reading, Writing & Speaking chuẩn IELTS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCreatorModal(false)}
              className="px-3.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors font-medium"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSaveTest}
              disabled={savingTest}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {savingTest ? 'Đang lưu...' : editingTest ? 'Cập nhật bài thi' : 'Lưu bản nháp bài thi'}
            </button>
          </div>
        </header>

        {/* Two-Column Workspace Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Column: General Info, Class, Instructions, Skills Selection, Timing, Exam Settings */}
          <div className="w-full lg:w-[420px] shrink-0 bg-white border-r border-slate-200 overflow-y-auto p-6 space-y-6 shadow-xs">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-start gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Thông tin chung bài kiểm tra
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tiêu đề bài kiểm tra *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="VD: Kiểm tra định kỳ giữa kỳ IELTS Band 6.5+"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lớp học áp dụng *
                </label>
                <select
                  value={formCourseId}
                  onChange={(e) => setFormCourseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hướng dẫn chung cho thí sinh
                </label>
                <textarea
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  rows={2}
                  placeholder="Quy chế phòng thi, thời gian làm bài, lưu ý chống gian lận..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Skills to be tested */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Kỹ năng kiểm tra (Skills to be tested) *
                </span>
                <span className="text-[10px] font-normal text-slate-500">Tùy chọn bất kỳ kỹ năng (Listening, Reading, Writing, Speaking)</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Listening Card */}
                <div
                  onClick={() => {
                    setFormSkills((prev) =>
                      prev.includes('listening') ? prev.filter((s) => s !== 'listening') : [...prev, 'listening']
                    );
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    formSkills.includes('listening')
                      ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-100 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${formSkills.includes('listening') ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <Headphones className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="checkbox"
                      checked={formSkills.includes('listening')}
                      readOnly
                      className="w-4 h-4 text-emerald-600 rounded-sm pointer-events-none"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Listening</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {listeningSections.length > 0 ? `${listeningSections.length} bài thi` : 'Chưa cấu hình'}
                    </div>
                  </div>
                </div>

                {/* Reading Card */}
                <div
                  onClick={() => {
                    setFormSkills((prev) =>
                      prev.includes('reading') ? prev.filter((s) => s !== 'reading') : [...prev, 'reading']
                    );
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    formSkills.includes('reading')
                      ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-100 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${formSkills.includes('reading') ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="checkbox"
                      checked={formSkills.includes('reading')}
                      readOnly
                      className="w-4 h-4 text-blue-600 rounded-sm pointer-events-none"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Reading</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {readingSections.length > 0 ? `${readingSections.length} bài đọc` : 'Chưa cấu hình'}
                    </div>
                  </div>
                </div>

                {/* Writing Card */}
                <div
                  onClick={() => {
                    setFormSkills((prev) =>
                      prev.includes('writing') ? prev.filter((s) => s !== 'writing') : [...prev, 'writing']
                    );
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    formSkills.includes('writing')
                      ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-100 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${formSkills.includes('writing') ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <PenTool className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="checkbox"
                      checked={formSkills.includes('writing')}
                      readOnly
                      className="w-4 h-4 text-indigo-600 rounded-sm pointer-events-none"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Writing</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {writingSections.length > 0 ? `${writingSections.length} tasks` : 'Chưa cấu hình'}
                    </div>
                  </div>
                </div>

                {/* Speaking Card */}
                <div
                  onClick={() => {
                    setFormSkills((prev) =>
                      prev.includes('speaking') ? prev.filter((s) => s !== 'speaking') : [...prev, 'speaking']
                    );
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    formSkills.includes('speaking')
                      ? 'bg-purple-50/70 border-purple-500 ring-2 ring-purple-100 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${formSkills.includes('speaking') ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <Mic className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="checkbox"
                      checked={formSkills.includes('speaking')}
                      readOnly
                      className="w-4 h-4 text-purple-600 rounded-sm pointer-events-none"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Speaking</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {speakingSections.length > 0 ? `${speakingSections.length} phần` : 'Chưa cấu hình'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timing & Exam Settings */}
            <div className="space-y-4 pt-3 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Thời gian & Chế độ làm bài
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chế độ đồng hồ (Timing Mode)
                </label>
                <select
                  value={formTimingMode}
                  onChange={(e) => setFormTimingMode(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
                >
                  <option value="overall_timer">Overall timer (Một đồng hồ đếm ngược chung cho toàn bài thi)</option>
                  <option value="per_section">Individual Skill Timers (Đồng hồ đếm ngược riêng từng kỹ năng)</option>
                </select>
              </div>

              {formTimingMode === 'overall_timer' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tổng thời gian (phút) *
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={240}
                      value={formDuration}
                      onChange={(e) => setFormDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Số lần làm bài
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={formMaxAttempts}
                      onChange={(e) => setFormMaxAttempts(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100">
                  <div className="text-xs font-bold text-indigo-950 flex items-center justify-between">
                    <span>Thời gian từng kỹ năng (phút)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                      Tổng: {formSkills.reduce((sum, s) => sum + (formSkillDurations[s] || 0), 0)} phút
                    </span>
                  </div>

                  {formSkills.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">Vui lòng chọn kỹ năng ở trên để cài đặt thời gian.</div>
                  ) : (
                    <div className="space-y-2">
                      {formSkills.includes('listening') && (
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                            <Headphones className="w-3.5 h-3.5 text-emerald-600" />
                            Listening:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={180}
                              value={formSkillDurations.listening}
                              onChange={(e) =>
                                setFormSkillDurations((prev) => ({ ...prev, listening: Number(e.target.value) }))
                              }
                              className="w-20 px-2.5 py-1 text-xs rounded-lg border border-slate-300 text-center font-bold"
                            />
                            <span className="text-slate-500 text-[11px]">phút</span>
                          </div>
                        </div>
                      )}

                      {formSkills.includes('reading') && (
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                            Reading:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={180}
                              value={formSkillDurations.reading}
                              onChange={(e) =>
                                setFormSkillDurations((prev) => ({ ...prev, reading: Number(e.target.value) }))
                              }
                              className="w-20 px-2.5 py-1 text-xs rounded-lg border border-slate-300 text-center font-bold"
                            />
                            <span className="text-slate-500 text-[11px]">phút</span>
                          </div>
                        </div>
                      )}

                      {formSkills.includes('writing') && (
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                            <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                            Writing:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={180}
                              value={formSkillDurations.writing}
                              onChange={(e) =>
                                setFormSkillDurations((prev) => ({ ...prev, writing: Number(e.target.value) }))
                              }
                              className="w-20 px-2.5 py-1 text-xs rounded-lg border border-slate-300 text-center font-bold"
                            />
                            <span className="text-slate-500 text-[11px]">phút</span>
                          </div>
                        </div>
                      )}

                      {formSkills.includes('speaking') && (
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                            <Mic className="w-3.5 h-3.5 text-purple-600" />
                            Speaking:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={60}
                              value={formSkillDurations.speaking}
                              onChange={(e) =>
                                setFormSkillDurations((prev) => ({ ...prev, speaking: Number(e.target.value) }))
                              }
                              className="w-20 px-2.5 py-1 text-xs rounded-lg border border-slate-300 text-center font-bold"
                            />
                            <span className="text-slate-500 text-[11px]">phút</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2 border-t border-indigo-100 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Số lần làm bài:</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={formMaxAttempts}
                      onChange={(e) => setFormMaxAttempts(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-xs rounded-lg border border-slate-300 text-center font-bold"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chế độ giám sát (Strict Exam Mode)
                </label>
                <select
                  value={formStrictPreset}
                  onChange={(e) => setFormStrictPreset(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium"
                >
                  <option value="standard">Standard (Ghi nhận tab switch, cảnh báo paste)</option>
                  <option value="strict">Strict (Bắt buộc Fullscreen toàn màn hình)</option>
                  <option value="off">Off (Tự do ôn luyện thông thường)</option>
                </select>
              </div>

              {/* Access Code */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAccessCodeEnabled}
                    onChange={(e) => setFormAccessCodeEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-sm"
                  />
                  Yêu cầu Access Code để vào thi
                </label>
                {formAccessCodeEnabled && (
                  <input
                    type="text"
                    value={formAccessCode}
                    onChange={(e) => setFormAccessCode(e.target.value)}
                    placeholder="VD: EXAM2026"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 uppercase tracking-widest font-mono font-bold"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Configuration panels ONLY for selected skills */}
          <div className="flex-1 min-h-0 bg-slate-50 overflow-y-auto p-6 space-y-6">
            {formSkills.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border-2 border-dashed border-amber-300 space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">Chưa chọn kỹ năng kiểm tra</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Vui lòng tích chọn ít nhất một kỹ năng (Listening, Reading, Writing hoặc Speaking) ở cột thông tin bên trái để cấu hình nội dung bài thi.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 0. LISTENING PANEL */}
                {formSkills.includes('listening') && (
                  <div className="bg-white rounded-2xl border border-emerald-200 shadow-2xs overflow-hidden">
                    <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50/30 border-b border-emerald-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                          <Headphones className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            Phần thi IELTS Listening
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              {listeningSections.length > 0 ? `${listeningSections.length} bài thi đã thêm` : 'Chưa có đề'}
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Tiêu chuẩn 4 Parts (40 câu hỏi) • Audio phát 1 lần duy nhất trong kỳ thi
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowListeningPicker(true)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                        >
                          <Library className="w-3.5 h-3.5" />
                          + Thêm Listening từ Library
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setListeningTitle('IELTS Listening Practice Test');
                            setListeningAudioUrl('');
                            setListeningRawText('');
                            setShowListeningModal(true);
                          }}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          + Cấu hình Listening
                        </button>
                      </div>
                    </div>

                    <div className="p-4">
                      {listeningSections.length === 0 ? (
                        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                          <Headphones className="w-8 h-8 text-slate-300 mx-auto" />
                          <div className="text-xs font-semibold text-slate-600">Chưa có phần thi Listening nào trong đề thi</div>
                          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                            Nhấn nút &quot;+ Thêm Listening từ Library&quot; hoặc &quot;+ Cấu hình Listening&quot; ở trên để thiết lập audio và bộ câu hỏi.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {listeningSections.map((sec, idx) => (
                            <div
                              key={sec.id}
                              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <h5 className="font-bold text-xs text-slate-900 truncate">{sec.title}</h5>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 pl-7 flex items-center gap-3 flex-wrap">
                                  <span>{sec.listeningParts?.length || 4} Parts</span>
                                  <span>•</span>
                                  <span>{sec.listeningQuestions?.length || 40} Questions</span>
                                  {sec.audioUrl && (
                                    <>
                                      <span>•</span>
                                      <span className="text-emerald-700 font-mono font-medium truncate max-w-xs">
                                        Audio: {sec.audioUrl}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pl-7 md:pl-0 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setFormSections(formSections.filter((s) => s.id !== sec.id))}
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                                  title="Xóa phần thi này"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 1. READING PANEL */}
                {formSkills.includes('reading') && (
                  <div className="bg-white rounded-2xl border border-blue-200 shadow-2xs overflow-hidden">
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50/30 border-b border-blue-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            Phần thi IELTS Reading
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              {readingSections.length > 0 ? `${readingSections.length} bài đọc đã thêm` : 'Chưa có đề'}
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Học thuật 3 Passages (40 câu hỏi) hoặc bài đọc đơn lẻ
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowReadingPicker(true)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Library className="w-3.5 h-3.5" />
                        + Thêm Reading từ Library
                      </button>
                    </div>

                    <div className="p-4">
                      {readingSections.length === 0 ? (
                        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                          <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                          <div className="text-xs font-semibold text-slate-600">Chưa có bài đọc Reading nào trong đề thi</div>
                          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                            Nhấn nút &quot;+ Thêm Reading từ Library&quot; ở trên để chọn đề bài có sẵn từ Thư viện tài liệu.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {readingSections.map((sec, idx) => (
                            <div
                              key={sec.id}
                              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <h5 className="font-bold text-xs text-slate-900 truncate">{sec.title}</h5>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 pl-7 flex items-center gap-3">
                                  <span>{sec.passages?.length || 1} Passage(s)</span>
                                  <span>•</span>
                                  <span>{sec.readingQuestions?.length || 0} Questions</span>
                                  <span>•</span>
                                  <span>{sec.questionGroups?.length || 0} Groups</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pl-7 md:pl-0 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewReadingSection(sec);
                                    setPreviewActivePassageTab(0);
                                  }}
                                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Xem trước toàn bộ đề
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormSections((prev) => prev.filter((s) => s.id !== sec.id))}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Xóa bài đọc này"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. WRITING PANEL */}
                {formSkills.includes('writing') && (
                  <div className="bg-white rounded-2xl border border-indigo-200 shadow-2xs overflow-hidden">
                    <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50/30 border-b border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                          <PenTool className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            Phần thi IELTS Writing
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                              {writingSections.length > 0 ? `${writingSections.length} tasks đã thêm` : 'Chưa có đề'}
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Task 1 (Academic Graph / Map) & Task 2 (Discursive Essay)
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={writingFileInputRef}
                          type="file"
                          accept=".docx,.pdf"
                          className="hidden"
                          onChange={handleWritingFileSelect}
                        />
                        <button
                          type="button"
                          onClick={() => setShowWritingPicker(true)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Library className="w-3.5 h-3.5 text-indigo-600" />
                          + Thêm Writing từ Library
                        </button>
                        <button
                          type="button"
                          disabled={isProcessingWritingFile}
                          onClick={() => writingFileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-indigo-200"
                        >
                          <Upload className="w-3.5 h-3.5 text-indigo-600" />
                          {isProcessingWritingFile ? 'Đang xử lý...' : '+ Import Writing từ file'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openCreateWritingModal()}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          + Soạn thủ công
                        </button>
                      </div>
                    </div>

                    <div className="p-4">
                      {writingSections.length === 0 ? (
                        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                          <PenTool className="w-8 h-8 text-slate-300 mx-auto" />
                          <div className="text-xs font-semibold text-slate-600">Chưa có đề bài Writing nào trong đề thi</div>
                          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                            Nhấn nút &quot;+ Soạn Writing (Task 1 / 2)&quot; để nhập đề bài Task 1 biểu đồ hoặc Task 2 nghị luận.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {writingSections.map((sec, idx) => (
                            <div
                              key={sec.id}
                              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase">
                                    {sec.writingTaskType === 'task1' ? 'Task 1' : 'Task 2'}
                                  </span>
                                  <h5 className="font-bold text-xs text-slate-900 truncate">{sec.title}</h5>
                                </div>
                                <div className="text-[11px] text-slate-600 mt-1 pl-7 line-clamp-2">
                                  {sec.writingPrompt}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1 pl-7 flex items-center gap-3">
                                  <span>Tối thiểu {sec.writingMinWords || (sec.writingTaskType === 'task1' ? 150 : 250)} từ</span>
                                  {sec.task1ImageUrl && <span className="text-indigo-600 font-semibold">• Có hình ảnh biểu đồ</span>}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pl-7 md:pl-0 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openCreateWritingModal(sec)}
                                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  Chỉnh sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormSections((prev) => prev.filter((s) => s.id !== sec.id))}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Xóa task này"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. SPEAKING PANEL */}
                {formSkills.includes('speaking') && (
                  <div className="bg-white rounded-2xl border border-purple-200 shadow-2xs overflow-hidden">
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50/30 border-b border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                          <Mic className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            Phần thi IELTS Speaking
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                              {speakingSections.length > 0 ? `${speakingSections.length} phần đã thêm` : 'Chưa có đề'}
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Part 1 (Phỏng vấn) • Part 2 (Cue Card) • Part 3 (Thảo luận)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openSpeakingPicker('part1')}
                          className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg text-xs font-bold transition-colors border border-purple-200"
                        >
                          + Part 1
                        </button>
                        <button
                          type="button"
                          onClick={() => openSpeakingPicker('part2')}
                          className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg text-xs font-bold transition-colors border border-purple-200"
                        >
                          + Part 2
                        </button>
                        <button
                          type="button"
                          onClick={() => openSpeakingPicker('part3')}
                          className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg text-xs font-bold transition-colors border border-purple-200"
                        >
                          + Part 3
                        </button>
                      </div>
                    </div>

                    <div className="p-4">
                      {speakingSections.length === 0 ? (
                        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                          <Mic className="w-8 h-8 text-slate-300 mx-auto" />
                          <div className="text-xs font-semibold text-slate-600">Chưa có phần Speaking nào trong đề thi</div>
                          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                            Nhấn các nút &quot;+ Part 1&quot;, &quot;+ Part 2&quot; hoặc &quot;+ Part 3&quot; để chọn nội dung phỏng vấn từ Thư viện.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {speakingSections.map((sec, idx) => (
                            <div
                              key={sec.id}
                              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 uppercase">
                                    {sec.speakingPart ? sec.speakingPart.toUpperCase() : 'Speaking'}
                                  </span>
                                  <h5 className="font-bold text-xs text-slate-900 truncate">{sec.title}</h5>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 pl-7 flex items-center gap-3">
                                  <span>Chỉ ghi âm 1 lần duy nhất</span>
                                  {sec.speakingTopics && <span>• {sec.speakingTopics.length} chủ đề</span>}
                                  {sec.speakingQuestions && <span>• {sec.speakingQuestions.length} câu hỏi</span>}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pl-7 md:pl-0 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setFormSections((prev) => prev.filter((s) => s.id !== sec.id))}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Xóa phần Speaking này"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            SUB-MODALS (PORTAL MOUNTED - ESCAPING CONTAINING BLOCKS)
        ========================================================================= */}

        {/* SUB-MODAL 0: LISTENING LIBRARY PICKER */}
        {showListeningPicker && (
          <Portal containerId="modal-root">
            <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Headphones className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="font-bold text-sm">Chọn bài Listening từ Thư viện tài liệu</h3>
                      <p className="text-[11px] text-slate-400">Chọn đề thi Listening có sẵn từ Thư viện</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowListeningPicker(false)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm tài liệu Listening theo tiêu đề, danh mục..."
                      value={listeningPickerSearch}
                      onChange={(e) => setListeningPickerSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
                  {filteredListeningResources.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs space-y-1">
                      <Headphones className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <div>Không tìm thấy tài liệu Listening trong Thư viện.</div>
                      <p className="text-[11px] text-slate-500">
                        Bạn có thể sử dụng nút &quot;+ Cấu hình Listening&quot; để tạo đề nhanh với file audio và bộ câu hỏi.
                      </p>
                    </div>
                  ) : (
                    filteredListeningResources.map((res) => (
                      <div
                        key={res.id}
                        className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <h5 className="font-bold text-slate-900 truncate">{res.title}</h5>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold uppercase text-[9px]">
                              {res.category || 'Listening'}
                            </span>
                            {res.audioUrl && <span>• Audio available</span>}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const parsed = res.listeningContent || parseListeningDocument(res.description || res.title || '', res.title);
                            const newSec: RegularTestSection = {
                              id: `sec_listening_${Date.now()}`,
                              title: res.title,
                              skill: 'listening',
                              durationMinutes: 30,
                              audioUrl: res.audioUrl || res.url || parsed.audioUrl || '',
                              listeningAudioUrl: res.audioUrl || res.url || parsed.audioUrl || '',
                              listeningParts: parsed.parts || [],
                              listeningQuestions: parsed.parts?.flatMap((p) => p.questions || []) || [],
                              listeningQuestionGroups: parsed.parts?.flatMap((p) => p.questionGroups || []) || [],
                            };
                            setFormSections((prev) => [newSec, ...prev.filter((s) => s.skill !== 'listening')]);
                            setShowListeningPicker(false);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition whitespace-nowrap"
                        >
                          Chọn vào đề thi
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Portal>
        )}

        {/* SUB-MODAL 0.5: LISTENING CREATOR & AUDIO CONFIG */}
        {showListeningModal && (
          <Portal containerId="modal-root">
            <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Headphones className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="font-bold text-sm">Cấu hình đề thi Listening</h3>
                      <p className="text-[11px] text-slate-400">Thiết lập Audio track và bộ câu hỏi 4 Parts</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowListeningModal(false)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tiêu đề bài thi Listening *</label>
                    <input
                      type="text"
                      value={listeningTitle}
                      onChange={(e) => setListeningTitle(e.target.value)}
                      placeholder="VD: IELTS Academic Listening Test 1"
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Audio URL (Đường dẫn âm thanh trực tuyến) *</label>
                    <input
                      type="text"
                      value={listeningAudioUrl}
                      onChange={(e) => setListeningAudioUrl(e.target.value.trim())}
                      placeholder="https://example.com/ielts_listening_audio.mp3"
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono font-medium"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Hoặc dán link Google Drive (public link), Cloudinary, S3, hoặc CDN audio.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Nội dung câu hỏi / Transcript (Tự động nhận diện Parts & Questions)
                    </label>
                    <textarea
                      rows={8}
                      value={listeningRawText}
                      onChange={(e) => setListeningRawText(e.target.value)}
                      placeholder="Dán nội dung đề Listening (PART 1, Questions 1-5, Questions 6-10...) hoặc để trống để tạo 40 câu hỏi mặc định."
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono leading-relaxed"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowListeningModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = parseListeningDocument(listeningRawText || 'PART 1\nPART 2\nPART 3\nPART 4', listeningTitle);
                      const newSec: RegularTestSection = {
                        id: `sec_listening_${Date.now()}`,
                        title: listeningTitle || 'IELTS Listening Practice Test',
                        skill: 'listening',
                        durationMinutes: 30,
                        audioUrl: listeningAudioUrl,
                        listeningAudioUrl: listeningAudioUrl,
                        listeningParts: parsed.parts || [],
                        listeningQuestions: parsed.parts?.flatMap((p) => p.questions || []) || [],
                        listeningQuestionGroups: parsed.parts?.flatMap((p) => p.questionGroups || []) || [],
                      };
                      setFormSections((prev) => [newSec, ...prev.filter((s) => s.skill !== 'listening')]);
                      setShowListeningModal(false);
                    }}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs"
                  >
                    Lưu vào đề thi
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        )}

        {/* SUB-MODAL 1: READING LIBRARY PICKER */}
        {showReadingPicker && (
          <Portal containerId="modal-root">
            <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                    <div>
                      <h3 className="font-bold text-sm">Chọn bài Reading từ Thư viện tài liệu (Materials Library)</h3>
                      <p className="text-[11px] text-slate-400">Xem trước hoặc nhập trực tiếp đề thi Reading</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReadingPicker(false)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm tài liệu Reading theo tiêu đề, danh mục, từ khóa..."
                      value={readingPickerSearch}
                      onChange={(e) => setReadingPickerSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
                  {filteredReadingResources.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs space-y-1">
                      <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <div>Không tìm thấy tài liệu Reading phù hợp.</div>
                      <p className="text-[11px] text-slate-500">Hãy thêm tài liệu tại trang Materials Library hoặc thử từ khóa khác.</p>
                    </div>
                  ) : (
                    filteredReadingResources.map((res) => (
                      <div
                        key={res.id}
                        className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1 pr-3 min-w-0">
                          <div className="font-bold text-slate-800 text-xs truncate">
                            {res.title}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold">{res.category || 'Reading Material'}</span>
                            {res.tags && res.tags.length > 0 && <span>• {res.tags.join(', ')}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePreviewLibraryResource(res)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Xem trước
                          </button>
                          <button
                            type="button"
                            onClick={() => handleImportReadingResource(res)}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Chọn đề này
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Portal>
        )}

        {/* SUB-MODAL 2: FULL READING TEST PREVIEW */}
        {previewReadingSection && (
          <Portal containerId="modal-root">
            <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 md:p-6">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                    <div>
                      <h3 className="font-bold text-sm">Xem trước toàn bộ bài Reading (Full Test Preview)</h3>
                      <p className="text-[11px] text-slate-400">{previewReadingSection.title}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewReadingSection(null)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
                  {/* Left Pane: Passage */}
                  <div className="w-full md:w-1/2 border-r border-slate-300 bg-white flex flex-col overflow-hidden">
                    {previewReadingSection.passages && previewReadingSection.passages.length > 1 && (
                      <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
                        {previewReadingSection.passages.map((p, pIdx) => (
                          <button
                            key={p.id || pIdx}
                            type="button"
                            onClick={() => setPreviewActivePassageTab(pIdx)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                              previewActivePassageTab === pIdx
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'bg-white text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {p.title || `Passage ${pIdx + 1}`}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex-1 p-6 overflow-y-auto font-serif text-xs md:text-sm leading-relaxed text-slate-800">
                      <div className="max-w-prose mx-auto whitespace-pre-wrap">
                        {previewReadingSection.passages && previewReadingSection.passages.length > 0
                          ? previewReadingSection.passages[previewActivePassageTab]?.content ||
                            previewReadingSection.readingPassage ||
                            'Chưa có nội dung đoạn văn.'
                          : previewReadingSection.readingPassage || 'Chưa có nội dung đoạn văn.'}
                      </div>
                    </div>
                  </div>

                  {/* Right Pane: Questions & Answer Keys */}
                  <div className="w-full md:w-1/2 bg-slate-50 flex flex-col overflow-hidden">
                    <div className="h-10 bg-slate-100 border-b border-slate-200 px-4 flex items-center justify-between text-xs text-slate-700 shrink-0">
                      <span className="font-bold uppercase tracking-wider text-[11px]">
                        Questions ({previewReadingSection.readingQuestions?.length || 0} câu hỏi & đáp án)
                      </span>
                      <span className="text-[11px] text-emerald-700 font-bold">✓ Đã nạp đáp án chuẩn</span>
                    </div>

                    <div className="flex-1 p-5 overflow-y-auto space-y-4">
                      {(previewReadingSection.readingQuestions || []).length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          Không tìm thấy câu hỏi nào trong đề đọc này.
                        </div>
                      ) : (
                        (previewReadingSection.readingQuestions || []).map((q, idx) => (
                          <div
                            key={q.id || idx}
                            className="p-4 bg-white rounded-xl border border-slate-200 space-y-2 text-xs shadow-2xs"
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div className="flex-1 font-semibold text-slate-900 leading-snug">
                                {q.prompt || (q as any).question || (q as any).questionText}
                              </div>
                            </div>

                            {q.options && q.options.length > 0 && (
                              <div className="space-y-1 pl-8">
                                {q.options.map((opt, oIdx) => {
                                  const ansKey = String(q.correctAnswer || (q as any).answer || '').trim();
                                  const isKey =
                                    ansKey.toLowerCase() === opt.trim().toLowerCase() ||
                                    ansKey === String.fromCharCode(65 + oIdx);

                                  return (
                                    <div
                                      key={oIdx}
                                      className={`p-2 rounded-lg border flex items-center justify-between ${
                                        isKey
                                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                                          : 'bg-white border-slate-200 text-slate-700'
                                      }`}
                                    >
                                      <span>{opt}</span>
                                      {isKey && (
                                        <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold uppercase">
                                          Đáp án đúng
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {(!q.options || q.options.length === 0) && (q.correctAnswer || (q as any).answer) && (
                              <div className="pl-8 pt-1 flex items-center gap-2">
                                <span className="text-slate-500 font-medium">Đáp án chuẩn:</span>
                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md font-bold text-xs">
                                  {q.correctAnswer || (q as any).answer}
                                </span>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-3 bg-white border-t border-slate-200 flex justify-end shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewReadingSection(null)}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Đóng xem trước
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        )}

        {/* SUB-MODAL 3: WRITING MANUAL CREATOR & EDITOR */}
        {showWritingModal && (
          <Portal containerId="modal-root">
            <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-bold text-sm">
                      {editingWritingSecId ? 'Chỉnh sửa phần thi Writing' : 'Soạn trực tiếp phần thi Writing (Task 1 hoặc Task 2)'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWritingModal(false)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1.5">Loại bài Writing (Task Category) *</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setWritingTaskCategory('task1_academic');
                          setWritingMinWords(150);
                          setWritingSectionDuration(20);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          writingTaskCategory === 'task1_academic'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-xs">Academic Task 1</div>
                        <div className={`text-[11px] mt-0.5 ${writingTaskCategory === 'task1_academic' ? 'text-indigo-100' : 'text-slate-500'}`}>
                          Báo cáo biểu đồ, bảng số liệu, bản đồ (Min 150 từ)
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setWritingTaskCategory('task2');
                          setWritingMinWords(250);
                          setWritingSectionDuration(40);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          writingTaskCategory === 'task2'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-xs">Academic Task 2</div>
                        <div className={`text-[11px] mt-0.5 ${writingTaskCategory === 'task2' ? 'text-indigo-100' : 'text-slate-500'}`}>
                          Bài luận nghị luận xã hội (Min 250 từ)
                        </div>
                      </button>
                    </div>
                  </div>

                  {writingTaskCategory === 'task1_academic' && (
                    <div className="space-y-2 p-3 bg-indigo-50/50 rounded-xl border border-indigo-200">
                      <label className="block font-bold text-indigo-950">Hình ảnh biểu đồ / Bản đồ Task 1 (Image URL)</label>
                      <input
                        type="text"
                        placeholder="Dán URL hình ảnh biểu đồ (https://... hoặc data:image/...)"
                        value={writingImageUrl}
                        onChange={(e) => setWritingImageUrl(e.target.value)}
                        className="w-full p-2 border border-indigo-300 rounded-lg text-xs bg-white outline-hidden"
                      />
                      {writingImageUrl && (
                        <div className="rounded-lg border border-indigo-200 overflow-hidden bg-white p-2">
                          <img
                            src={writingImageUrl}
                            alt="Task 1 preview"
                            className="max-h-48 object-contain mx-auto rounded"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block font-bold text-slate-800 text-xs">Đề bài Writing (Prompt & Instructions) *</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => applyWritingFormatting('bold')}
                          className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[11px] font-bold text-slate-700 flex items-center gap-1 transition-colors"
                          title="Bold (**text**)"
                        >
                          <Bold className="w-3 h-3 text-slate-700" /> In đậm
                        </button>
                        <button
                          type="button"
                          onClick={() => applyWritingFormatting('italic')}
                          className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[11px] italic text-slate-700 flex items-center gap-1 transition-colors"
                          title="Italic (*text*)"
                        >
                          <Italic className="w-3 h-3 text-slate-700" /> Nghiêng
                        </button>
                      </div>
                    </div>
                    <textarea
                      ref={writingPromptRef}
                      rows={4}
                      placeholder="Nhập nội dung đề bài IELTS Writing chi tiết tại đây (hỗ trợ **in đậm** và *in nghiêng*)..."
                      value={writingPrompt}
                      onChange={(e) => setWritingPrompt(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-white outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans"
                    />
                    {writingPrompt.includes('*') && (
                      <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Xem trước định dạng:</span>
                        <div className="whitespace-pre-wrap">
                          {parseFormattedPrompt(writingPrompt).map((s, idx) => {
                            if (s.bold) return <strong key={idx} className="font-bold text-slate-900">{s.text}</strong>;
                            if (s.italic) return <em key={idx} className="italic text-slate-800">{s.text}</em>;
                            return <span key={idx}>{s.text}</span>;
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Số từ tối thiểu (Minimum Words)</label>
                      <input
                        type="number"
                        value={writingMinWords}
                        onChange={(e) => setWritingMinWords(Number(e.target.value))}
                        className="w-full p-2 border border-slate-300 rounded-xl font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Thời lượng khuyến nghị (phút)</label>
                      <input
                        type="number"
                        value={writingSectionDuration}
                        onChange={(e) => setWritingSectionDuration(Number(e.target.value))}
                        className="w-full p-2 border border-slate-300 rounded-xl font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Bài viết mẫu tham khảo (Band 8-9 Model Answer)</label>
                    <textarea
                      rows={3}
                      placeholder="Dán bài mẫu để học viên đối chiếu sau khi chấm điểm..."
                      value={writingModelAnswer}
                      onChange={(e) => setWritingModelAnswer(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-white outline-hidden"
                    />
                  </div>
                </div>

                <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowWritingModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveWritingSection}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs"
                  >
                    {editingWritingSecId ? 'Cập nhật Writing' : 'Thêm vào bài thi'}
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        )}

        {/* SUB-MODAL 3B: WRITING LIBRARY PICKER */}
        {showWritingPicker && (
          <Portal containerId="modal-root">
            <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-bold text-sm">Chọn đề bài Writing từ Thư viện Resources</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWritingPicker(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm theo tên đề bài Writing, Task 1, Task 2..."
                      value={writingPickerSearch}
                      onChange={(e) => setWritingPickerSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-3">
                  {(() => {
                    const writingResources = resources.filter((r) => {
                      const isWriting = r.skill === 'writing' || (r as any).type === 'writing' || (r.title && r.title.toLowerCase().includes('writing'));
                      if (!isWriting) return false;
                      if (!writingPickerSearch.trim()) return true;
                      const q = writingPickerSearch.toLowerCase();
                      return (
                        r.title.toLowerCase().includes(q) ||
                        (r.description || '').toLowerCase().includes(q) ||
                        (r.content || '').toLowerCase().includes(q)
                      );
                    });

                    if (writingResources.length === 0) {
                      return (
                        <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                          <PenTool className="w-8 h-8 text-slate-300 mx-auto" />
                          <div className="text-xs font-semibold text-slate-600">Không tìm thấy tài liệu Writing nào trong Thư viện</div>
                          <p className="text-[11px] text-slate-400">Vui lòng import thêm đề Writing vào Resources hoặc soạn thủ công.</p>
                        </div>
                      );
                    }

                    return writingResources.map((res) => {
                      let promptPreview = res.description || res.title;
                      let taskCat = 'Task 2';
                      if (res.content) {
                        try {
                          const p = JSON.parse(res.content);
                          if (p.prompt) promptPreview = p.prompt.slice(0, 140) + '...';
                          if (p.taskType === 'task1') taskCat = 'Task 1';
                        } catch {}
                      }
                      return (
                        <div
                          key={res.id}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all flex items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase">
                                {taskCat}
                              </span>
                              <h4 className="font-bold text-xs text-slate-800 truncate">{res.title}</h4>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{promptPreview}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectWritingFromLibrary(res)}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-2xs"
                          >
                            Chọn bài này
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowWritingPicker(false)}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        )}

        {/* SUB-MODAL 3C: EXTERNAL WRITING FILE IMPORT PREVIEW MODAL */}
        {showWritingImportModal && (
          <Portal containerId="modal-root">
            <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <FileUp className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h3 className="font-bold text-sm">Import Đề Writing từ File</h3>
                      <p className="text-[11px] text-slate-400 truncate max-w-md">{importedWritingDocTitle}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWritingImportModal(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 flex items-center justify-between text-xs text-indigo-900 font-semibold">
                    <span>Đã nhận diện thành công {importedWritingTasks.length} bài Writing trong file.</span>
                    <span className="text-[11px] text-indigo-700">Chọn các bài bạn muốn thêm vào đề thi:</span>
                  </div>

                  <div className="space-y-4">
                    {importedWritingTasks.map((task, idx) => (
                      <div key={task.id || idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white uppercase">
                              {task.taskType === 'task1' ? 'Task 1' : 'Task 2'}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {task.taskType === 'task1' ? 'Academic Graph / Chart' : 'Academic Essay'}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono font-semibold text-slate-500">
                            Tối thiểu {task.minWords} từ • {task.taskType === 'task1' ? '20' : '40'} phút
                          </span>
                        </div>

                        {task.imageUrl && (
                          <div className="bg-white p-2 border border-slate-200 rounded-lg inline-block max-w-xs">
                            <img src={task.imageUrl} alt="Task Diagram" className="max-h-40 object-contain rounded" />
                          </div>
                        )}

                        <div className="bg-white p-3 border border-slate-200 rounded-lg">
                          <p className="text-xs text-slate-800 font-medium whitespace-pre-line leading-relaxed">
                            {task.prompt}
                          </p>
                        </div>

                        {task.sampleAnswers && task.sampleAnswers.length > 0 && (
                          <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            Đã kèm bài viết mẫu ({task.sampleAnswers[0].band ? 'Band ' + task.sampleAnswers[0].band : 'Sample Answer'})
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowWritingImportModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmImportedWritingTasks(importedWritingTasks)}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm {importedWritingTasks.length} bài vào đề thi
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        )}

        {/* SUB-MODAL 4: SPEAKING INDEPENDENT PART SELECTOR */}
        {speakingPickerPart && (
          <Portal containerId="modal-root">
            <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Mic className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-sm">
                      Chọn phần thi Speaking từ Thư viện: {speakingPickerPart.toUpperCase()}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSpeakingPickerPart(null)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                  {!selectedSpeakingResource ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={speakingSearchQuery}
                          onChange={(e) => setSpeakingSearchQuery(e.target.value)}
                          placeholder="Tìm kiếm tài liệu Speaking..."
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        />
                      </div>
                      <p className="text-slate-600 font-medium">
                        Chọn một bộ tài liệu Speaking có sẵn trong Thư viện:
                      </p>
                      {resources.filter((r) => r.skill === 'speaking' || (r as any).type === 'speaking' || r.speakingPart).length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          Không có tài liệu Speaking nào trong Thư viện.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {resources
                            .filter((r) => r.skill === 'speaking' || (r as any).type === 'speaking' || r.speakingPart)
                            .filter((r) => {
                              if (!speakingSearchQuery.trim()) return true;
                              const q = speakingSearchQuery.toLowerCase();
                              return (r.title || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q);
                            })
                            .map((res) => (
                              <div
                                key={res.id}
                                onClick={() => {
                                  setSelectedSpeakingResource(res);
                                  const details = getSpeakingResourceDetails(res);
                                  if (speakingPickerPart === 'part1') {
                                    const tps = details.topics;
                                    const initMap: Record<string, boolean> = {};
                                    tps.forEach((tp: SpeakingTopic) => {
                                      initMap[tp.id] = true;
                                    });
                                    setSelectedPart1TopicIds(initMap);
                                  }
                                }}
                                className="p-3 bg-white rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/40 cursor-pointer transition-all flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-bold text-slate-900">{res.title}</div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    {res.description || res.category || 'Tài liệu Speaking'}
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-purple-600" />
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : (() => {
                    const details = getSpeakingResourceDetails(selectedSpeakingResource);
                    return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl border border-purple-200">
                        <div>
                          <span className="text-[10px] font-bold text-purple-600 uppercase">Tài liệu đã chọn:</span>
                          <div className="font-bold text-purple-950 text-xs">{selectedSpeakingResource.title}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedSpeakingResource(null)}
                          className="text-xs text-purple-700 hover:underline font-bold"
                        >
                          Đổi tài liệu
                        </button>
                      </div>

                      {/* PART 1 SELECTION */}
                      {speakingPickerPart === 'part1' && (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="font-bold text-slate-800">
                              Chọn các chủ đề Part 1 cần đưa vào bài thi:
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const allMap: Record<string, boolean> = {};
                                  details.topics.forEach((tp: SpeakingTopic) => {
                                    allMap[tp.id] = true;
                                  });
                                  setSelectedPart1TopicIds(allMap);
                                }}
                                className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 transition-colors"
                              >
                                Chọn tất cả
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedPart1TopicIds({})}
                                className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 transition-colors"
                              >
                                Bỏ chọn tất cả
                              </button>
                              <span className="text-[11px] text-purple-700 font-bold ml-1">
                                {Object.values(selectedPart1TopicIds).filter(Boolean).length} đã chọn
                              </span>
                            </div>
                          </div>

                          {details.topics.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                              Không tìm thấy chủ đề Part 1 trong tài liệu này.
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {details.topics.map((tp: SpeakingTopic, tIdx: number) => (
                                <label
                                  key={tp.id || tIdx}
                                  className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                                    selectedPart1TopicIds[tp.id]
                                      ? 'bg-purple-50/50 border-purple-400'
                                      : 'bg-white border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={Boolean(selectedPart1TopicIds[tp.id])}
                                    onChange={(e) =>
                                      setSelectedPart1TopicIds((prev) => ({
                                        ...prev,
                                        [tp.id]: e.target.checked,
                                      }))
                                    }
                                    className="w-4 h-4 text-purple-600 rounded-sm mt-0.5"
                                  />
                                  <div className="flex-1">
                                    <span className="font-bold text-slate-900 block">{tp.topic || (tp as any).title}</span>
                                    <div className="text-[11px] text-slate-500 mt-1">
                                      {tp.questions?.length || 0} câu hỏi ngắn
                                    </div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* PART 2 SELECTION */}
                      {speakingPickerPart === 'part2' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="font-bold text-slate-800 block">
                              Chọn Cue Card Part 2 (có thể chọn nhiều Cue Card):
                            </label>
                            <span className="text-[11px] text-purple-700 font-bold">
                              {Object.values(selectedCueCardIndices).filter(Boolean).length} đã chọn
                            </span>
                          </div>
                          {details.cueCards.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                              Không tìm thấy Cue Card Part 2 trong tài liệu này.
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {details.cueCards.map((card: any, cIdx: number) => {
                                const isChecked = Boolean(selectedCueCardIndices[cIdx]);
                                const hasP3 = details.groups.some(
                                  (g: any) =>
                                    (g.cueCardTopic &&
                                      (card.topic.toLowerCase().includes(g.cueCardTopic.toLowerCase().slice(0, 15)) ||
                                        g.cueCardTopic.toLowerCase().includes(card.topic.toLowerCase().slice(0, 15)))) ||
                                    (g.cueCardId && g.cueCardId === card.id)
                                );

                                return (
                                  <label
                                    key={cIdx}
                                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                                      isChecked
                                        ? 'bg-purple-50/70 border-purple-500 ring-1 ring-purple-300'
                                        : 'bg-white border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) =>
                                        setSelectedCueCardIndices((prev) => ({
                                          ...prev,
                                          [cIdx]: e.target.checked,
                                        }))
                                      }
                                      className="w-4 h-4 text-purple-600 rounded-sm mt-0.5"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-slate-900">{card.topic}</span>
                                        {hasP3 ? (
                                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                                            ✓ Có Part 3 liên kết
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded shrink-0">
                                            ⚠️ Độc lập (Chưa có Part 3)
                                          </span>
                                        )}
                                      </div>
                                      <ul className="mt-1 list-disc list-inside text-[11px] text-slate-600 pl-1">
                                        {card.points?.map((p: string, pIdx: number) => (
                                          <li key={pIdx}>{p}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {/* Opt-in associated Part 3 */}
                          <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 space-y-2 mt-2">
                            <label className="flex items-start gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={includeAssociatedPart3}
                                onChange={(e) => setIncludeAssociatedPart3(e.target.checked)}
                                className="w-4 h-4 text-purple-600 rounded-sm mt-0.5"
                              />
                              <div>
                                <span className="font-bold text-slate-900 text-xs block">
                                  Tự động thêm phần thi Speaking Part 3 liên kết với Cue Card đã chọn
                                </span>
                                <span className="text-[11px] text-slate-500 block">
                                  Nếu bỏ chọn, hệ thống sẽ chỉ thêm phần thi Part 2 độc lập vào đề kiểm tra mà không tự động tạo thêm phần thi Part 3.
                                </span>
                              </div>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* PART 3 SELECTION */}
                      {speakingPickerPart === 'part3' && (
                        <div className="space-y-3">
                          <label className="font-bold text-slate-800 block">
                            Nhóm câu hỏi thảo luận chuyên sâu Part 3:
                          </label>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {details.groups.length > 0 ? (
                              details.groups.map((grp: any, gIdx: number) => (
                                <div key={gIdx} className="p-3 bg-purple-50/40 rounded-xl border border-purple-200 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-purple-950 text-xs block">
                                      {grp.cueCardTopic ? `Chủ đề liên kết: ${grp.cueCardTopic}` : `Nhóm ${gIdx + 1}`}
                                    </span>
                                    {grp.cueCardTopic ? (
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                                        🔗 Liên kết Part 2
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded shrink-0">
                                        Độc lập
                                      </span>
                                    )}
                                  </div>
                                  <ul className="list-disc list-inside text-[11px] text-slate-700 pl-1 space-y-1">
                                    {(grp.questions || []).map((q: string, qIdx: number) => (
                                      <li key={qIdx}>{q}</li>
                                    ))}
                                  </ul>
                                </div>
                              ))
                            ) : details.questions.length > 0 ? (
                              details.questions.map((q: string, qIdx: number) => (
                                <label
                                  key={qIdx}
                                  className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                                    selectedPart3QuestionIndices[qIdx]
                                      ? 'bg-purple-50/50 border-purple-400'
                                      : 'bg-white border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={Boolean(selectedPart3QuestionIndices[qIdx])}
                                    onChange={(e) =>
                                      setSelectedPart3QuestionIndices((prev) => ({
                                        ...prev,
                                        [qIdx]: e.target.checked,
                                      }))
                                    }
                                    className="w-4 h-4 text-purple-600 rounded-sm mt-0.5"
                                  />
                                  <span className="text-slate-800 font-medium">{q}</span>
                                </label>
                              ))
                            ) : (
                              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                Không tìm thấy câu hỏi Part 3 trong tài liệu này.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })()}
                </div>

                <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSpeakingPickerPart(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                  >
                    Hủy
                  </button>
                  {selectedSpeakingResource && (
                    <button
                      type="button"
                      onClick={handleConfirmSpeakingSection}
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs"
                    >
                      Xác nhận thêm phần thi này
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Portal>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            {t('regularTests.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">{t('regularTests.subtitle')}</p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          {t('regularTests.createTest')}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t('regularTests.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700"
          >
            <option value="all">{t('regularTests.allCourses')}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="draft">Bản nháp (Draft)</option>
            <option value="live">Đang mở thi (Live)</option>
            <option value="closed">Đã đóng (Closed)</option>
            <option value="archived">Lưu trữ (Archived)</option>
          </select>
        </div>
      </div>

      {/* Tests Grid */}
      {filteredTests.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">Chưa có bài kiểm tra định kỳ nào</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Bấm nút Tạo bài kiểm tra định kỳ ở góc trên để tạo bài thi Reading, Writing hoặc Speaking chuẩn IELTS.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTests.map((test) => {
            const attempts = regularTestAttempts.filter((a) => a.testId === test.id);
            const inProgressCount = attempts.filter((a) => a.status === 'in_progress').length;
            const submittedCount = attempts.filter((a) => a.status === 'submitted' || a.status === 'auto_submitted').length;

            return (
              <div
                key={test.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Status Bar */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      test.status === 'live'
                        ? 'bg-emerald-100 text-emerald-800'
                        : test.status === 'draft'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {test.status}
                  </span>

                  <span className="text-[10px] font-semibold text-slate-400">
                    Strict: <strong className="text-slate-700 uppercase">{test.strictPreset}</strong>
                  </span>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{test.title}</h3>
                    <p className="text-xs text-blue-600 font-medium mt-0.5">{test.courseName}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {test.skills.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 uppercase"
                      >
                        {s}
                      </span>
                    ))}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-700">
                      {test.durationMinutes} mins
                    </span>
                  </div>

                  {test.availabilityStart && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Starts: {new Date(test.availabilityStart).toLocaleDateString()}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="text-slate-500">
                      In progress: <strong className="text-blue-600">{inProgressCount}</strong>
                    </div>
                    <div className="text-slate-500">
                      Submitted: <strong className="text-emerald-600">{submittedCount}</strong>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    {test.status === 'draft' && (
                      <button
                        onClick={() => publishRegularTest(test.id)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition-colors"
                      >
                        Publish
                      </button>
                    )}

                    {test.status === 'live' && (
                      <button
                        onClick={() => setLiveDashboardTest(test)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors"
                      >
                        <Radio className="w-3 h-3 animate-pulse" />
                        Live Monitor
                      </button>
                    )}

                    <button
                      onClick={() => setAttemptsListTest(test)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-semibold text-[11px] flex items-center gap-1 transition-colors"
                    >
                      <Users className="w-3 h-3" />
                      Grading ({attempts.length})
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {test.status === 'draft' && (
                      <button
                        onClick={() => openEditModal(test)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-white"
                        title="Edit test"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {test.status === 'live' && (
                      <button
                        onClick={() => closeRegularTest(test.id)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 rounded-md hover:bg-white"
                        title="Close test"
                      >
                        <Lock className="w-4 h-4" />
                      </button>
                    )}
                    {test.status === 'closed' && (
                      <button
                        onClick={() => archiveRegularTest(test.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-white"
                        title="Archive test"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteTest(test.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-white"
                      title="Delete test"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Monitoring Dashboard Modal */}
      {liveDashboardTest && (
        <TeacherLiveDashboardModal
          test={liveDashboardTest}
          onClose={() => setLiveDashboardTest(null)}
        />
      )}

      {/* Attempts List / Grading Selector Modal */}
      {attemptsListTest && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Danh sách bài nộp: {attemptsListTest.title}</h3>
                <p className="text-xs text-slate-400">{attemptsListTest.courseName}</p>
              </div>
              <button onClick={() => setAttemptsListTest(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {regularTestAttempts.filter((a) => a.testId === attemptsListTest.id).length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Chưa có thí sinh nào nộp bài kiểm tra này.
                </div>
              ) : (
                regularTestAttempts
                  .filter((a) => a.testId === attemptsListTest.id)
                  .map((attempt) => (
                    <div
                      key={attempt.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs hover:border-slate-300"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{attempt.studentName}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Status: <span className="font-semibold text-slate-700 uppercase">{attempt.status}</span>
                          {attempt.submittedAt && ` • Nộp lúc: ${attempt.submittedAt}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-black text-blue-600">
                            Band {attempt.scores?.overall ?? attempt.scores?.reading?.band ?? '—'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {attempt.isReleased ? 'Đã công bố' : 'Riêng tư'}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setGradingAttemptData({ test: attemptsListTest, attempt });
                            setAttemptsListTest(null);
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-2xs"
                        >
                          Chấm điểm / Đánh giá
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
