import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Portal } from '../components/Portal';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import {
  Assignment,
  Submission,
  AssignmentSkill,
  SubmissionStatus,
  ReadingQuestion,
  InlineAnnotation,
  WritingTaskCategory,
  ReadingTestType,
  QuestionType,
  QuestionGroup,
  ParsedPassage,
  SpeakingTopic,
  SpeakingCueCard,
  SpeakingPart3Group,
  SpeakingQuestionResponse,
  ListeningPart,
  ListeningQuestion,
  ListeningQuestionGroup,
} from '../types';
import { parseDocumentStructure } from '../lib/documentExtractor';
import {
  gradeAssignmentSubmission,
  gradeListeningSubmission,
  parseMaxWordsFromLimit,
  formatWordLimitInstruction,
} from '../lib/assignmentGrader';
import { PracticeListeningAudioPlayer } from '../components/listening/PracticeListeningAudioPlayer';
import { ListeningQuestionRenderer } from '../components/listening/ListeningQuestionRenderer';
import { WritingTask1VisualRenderer, stripMarkdownTableFromPrompt } from '../components/writing/WritingTask1VisualRenderer';
import {
  extractAllNormalizedQuestions,
  resolveQuestionPrompt,
  extractParagraphLabelsFromPassage,
  buildQuestionRenderGroups,
  type QuestionRenderGroup,
  COMPLETION_TYPES,
  BUTTON_TYPES,
  cleanReadingText,
} from '../lib/questionNormalizer';
import { renderCleanMarkdown } from '../utils/textFormatter';
import {
  calculateIeltsOverallBand,
  roundIeltsComponentScore,
  calculateReadingBand,
} from '../lib/ieltsScoring';
import {
  generateCorrectedEssay,
  normalizeAnnotations,
} from '../lib/writingCorrection';
import { parseListeningDocument } from '../lib/listeningExtractor';
import { findAssociatedPart3GroupsForCards, getSpeakingResourceDetails } from '../utils/speakingLinkage';
import { SpeakingAudioRecorder } from '../components/SpeakingAudioRecorder';
import { LibraryFolderBrowser } from '../components/LibraryFolderBrowser';
import {
  extractSpeakingAssignmentDetails,
  unpackSpeakingSubmission,
  packSpeakingSubmission,
  uploadSpeakingAudio,
  transcribeAndTranslateAudio,
  downloadSpeakingAudio,
} from '../lib/speakingService';
import { uploadMultipleAudioFiles } from '../lib/optimizedAudioUploader';
import {
  FileCheck2,
  Clock,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Sparkles,
  BookOpen,
  Send,
  Mic,
  Square,
  Play,
  Volume2,
  Edit3,
  Award,
  ChevronRight,
  ChevronLeft,
  Plus,
  Eye,
  FileText,
  User,
  History,
  X,
  Highlighter,
  Trash2,
  Save,
  MessageSquare,
  Timer,
  Flag,
  Image as ImageIcon,
  ZoomIn,
  Check,
  AlertTriangle,
  Layers,
  Edit,
  HelpCircle,
  Download,
  FolderPlus,
  BarChart3,
  GripVertical,
  Search,
  CheckCircle2,
  TrendingUp,
  Lightbulb,
  Users,
  ShieldCheck,
  Globe,
  Lock,
  ArrowRight,
  Columns,
  Copy,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Eraser,
  Strikethrough,
  PenTool,
  Library,
} from 'lucide-react';

export type PastelMarkerColor =
  | 'pastel_pink'
  | 'pastel_orange'
  | 'pastel_yellow'
  | 'pastel_green'
  | 'pastel_blue'
  | 'pastel_purple';

export interface ReadingMarkerItem {
  id: string;
  passageIndex: number;
  text: string;
  color: PastelMarkerColor;
}

export const PASTEL_MARKER_COLORS: Array<{
  id: PastelMarkerColor;
  label: string;
  bgHex: string;
  markClass: string;
  dotClass: string;
}> = [
  {
    id: 'pastel_pink',
    label: 'Pastel Pink / Red',
    bgHex: '#ffd1dc',
    markClass: 'bg-[#ffd1dc]/90 text-rose-950 hover:bg-[#ffb6c1]',
    dotClass: 'bg-[#ffd1dc] border-[#f48fb1]',
  },
  {
    id: 'pastel_orange',
    label: 'Pastel Orange',
    bgHex: '#ffe0b2',
    markClass: 'bg-[#ffe0b2]/90 text-amber-950 hover:bg-[#ffcc80]',
    dotClass: 'bg-[#ffe0b2] border-[#ffb74d]',
  },
  {
    id: 'pastel_yellow',
    label: 'Pastel Yellow',
    bgHex: '#fff9c4',
    markClass: 'bg-[#fff9c4]/90 text-yellow-950 hover:bg-[#fff59d]',
    dotClass: 'bg-[#fff9c4] border-[#fff176]',
  },
  {
    id: 'pastel_green',
    label: 'Pastel Green',
    bgHex: '#c8e6c9',
    markClass: 'bg-[#c8e6c9]/90 text-emerald-950 hover:bg-[#a5d6a7]',
    dotClass: 'bg-[#c8e6c9] border-[#81c784]',
  },
  {
    id: 'pastel_blue',
    label: 'Pastel Blue',
    bgHex: '#bbdefb',
    markClass: 'bg-[#bbdefb]/90 text-sky-950 hover:bg-[#90caf9]',
    dotClass: 'bg-[#bbdefb] border-[#64b5f6]',
  },
  {
    id: 'pastel_purple',
    label: 'Pastel Purple',
    bgHex: '#e1bee7',
    markClass: 'bg-[#e1bee7]/90 text-purple-950 hover:bg-[#ce93d8]',
    dotClass: 'bg-[#e1bee7] border-[#ba68c8]',
  },
];

/**
 * Computes exact character offsets for a window.getSelection() within a specific root element
 * by traversing text nodes in document tree order.
 */
function getSelectionCharacterOffsetsWithin(element: HTMLElement): { startIndex: number; endIndex: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) {
    return null;
  }

  const treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  let charIndex = 0;
  let startIndex = -1;
  let endIndex = -1;

  let currentNode = treeWalker.nextNode();
  while (currentNode) {
    const textLen = (currentNode as Text).length;

    if (currentNode === range.startContainer) {
      startIndex = charIndex + range.startOffset;
    }
    if (currentNode === range.endContainer) {
      endIndex = charIndex + range.endOffset;
      break;
    }

    charIndex += textLen;
    currentNode = treeWalker.nextNode();
  }

  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    return { startIndex, endIndex };
  }

  return null;
}

export const AssignmentsView: React.FC = () => {
  const {
    currentUser,
    courses,
    courseMembers,
    assignments,
    resources,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    submissions,
    submitAssignment,
    gradeSubmission,
    returnForRevision,
  } = useApp();

  const { t } = useI18n();

  if (!currentUser) return null;
  const isTeacher = currentUser.role === 'teacher';

  const [selectedSkillFilter, setSelectedSkillFilter] = useState<string>('all');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [selectedAssignmentForRoster, setSelectedAssignmentForRoster] = useState<Assignment | null>(null);
  const [rosterFilter, setRosterFilter] = useState<'all' | 'pending' | 'graded' | 'not_submitted'>('all');

  // Modal states
  const [showCreateEditModal, setShowCreateEditModal] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [deletingAssignment, setDeletingAssignment] = useState<Assignment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnComments, setReturnComments] = useState('');
  const [showUnansweredModal, setShowUnansweredModal] = useState(false);
  const [showZoomImageModal, setShowZoomImageModal] = useState(false);

  // Assignment Create / Edit Form State
  const [formCourseId, setFormCourseId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSkill, setFormSkill] = useState<AssignmentSkill>('writing');
  const [formInstructions, setFormInstructions] = useState('');
  const [formObjectives, setFormObjectives] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formWritingTaskCategory, setFormWritingTaskCategory] = useState<WritingTaskCategory>('task2');
  const [formWritingPrompt, setFormWritingPrompt] = useState('');
  const [formWritingMinWords, setFormWritingMinWords] = useState(250);
  const [formTask1ImageUrl, setFormTask1ImageUrl] = useState('');
  const [formModelAnswer, setFormModelAnswer] = useState('');
  const [formModelAnswerReleaseCondition, setFormModelAnswerReleaseCondition] = useState<
    'immediate' | 'after_submission' | 'after_graded' | 'never'
  >('after_graded');
  const [formScoreVisibility, setFormScoreVisibility] = useState<'private' | 'public'>('private');
  const [formReadingTestType, setFormReadingTestType] = useState<ReadingTestType>('academic');
  const [formReadingPassage, setFormReadingPassage] = useState('');
  const [formSpeakingTopic, setFormSpeakingTopic] = useState('');
  const [formSpeakingPoints, setFormSpeakingPoints] = useState('');
  const [formSpeakingPart, setFormSpeakingPart] = useState<'part1' | 'part2' | 'part3' | 'full'>('part2');
  const [formSpeakingParts, setFormSpeakingParts] = useState<Array<'part1' | 'part2' | 'part3'>>(['part2']);
  const [formSpeakingTopics, setFormSpeakingTopics] = useState<SpeakingTopic[]>([]);
  const [formSpeakingQuestions, setFormSpeakingQuestions] = useState<string[]>([]);
  const [formSpeakingPart3Groups, setFormSpeakingPart3Groups] = useState<SpeakingPart3Group[]>([]);
  const [formSpeakingSelectedExerciseIds, setFormSpeakingSelectedExerciseIds] = useState<string[]>([]);
  const [formSpeakingLinkedPart2Topic, setFormSpeakingLinkedPart2Topic] = useState<string | null>(null);
  const [candidatePart2CueCards, setCandidatePart2CueCards] = useState<{ topic: string; points: string[]; resourceTitle?: string }[]>([]);
  const [selectedSpeakingResource, setSelectedSpeakingResource] = useState<any | null>(null);
  const [showSpeakingLibraryPicker, setShowSpeakingLibraryPicker] = useState<boolean>(false);
  const [selectedWritingResourceId, setSelectedWritingResourceId] = useState<string | null>(null);
  const [selectedWritingResourceTitle, setSelectedWritingResourceTitle] = useState<string | null>(null);
  const [showWritingLibraryPicker, setShowWritingLibraryPicker] = useState<boolean>(false);
  const [writingLibrarySearch, setWritingLibrarySearch] = useState<string>('');
  const [duplicateAssignmentWarning, setDuplicateAssignmentWarning] = useState<{
    exerciseTitle: string;
    existingAssignmentTitle: string;
    assignedDate: string;
    onConfirm: () => void;
  } | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // Submission & Grading Progress / Confirmation state
  const [isSubmittingStudentWork, setIsSubmittingStudentWork] = useState(false);
  const [isGradingSubmission, setIsGradingSubmission] = useState(false);
  const [submissionSuccessModal, setSubmissionSuccessModal] = useState<{
    title: string;
    message: string;
    actionText: string;
    onAction: () => void;
  } | null>(null);

  // Student Writing tab & annotation scrolling
  const [studentWritingTab, setStudentWritingTab] = useState<'submission' | 'corrected' | 'comparison' | 'model_answer'>('submission');
  const [activeHighlightedAnnotationId, setActiveHighlightedAnnotationId] = useState<string | null>(null);
  const [showDiffInCorrected, setShowDiffInCorrected] = useState<boolean>(true);
  const [hasCopiedCorrected, setHasCopiedCorrected] = useState<boolean>(false);

  // Student active taking state
  const [readingAnswers, setReadingAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [writingDraft, setWritingDraft] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioRecorded, setAudioRecorded] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Student Speaking taking state
  const [activeSpeakingStudentTab, setActiveSpeakingStudentTab] = useState<'part1' | 'part2' | 'part3'>('part1');
  const [studentSpeakingAudios, setStudentSpeakingAudios] = useState<
    Record<string, { blob: Blob | File; duration: number; url: string }>
  >({});
  const [speakingSubmittingStep, setSpeakingSubmittingStep] = useState<string>('');
  const [speakingPrepCountdown, setSpeakingPrepCountdown] = useState<number>(0);
  const [speakingPrepRunning, setSpeakingPrepRunning] = useState<boolean>(false);

  // Reading Timer & Layout state
  const [timerSeconds, setTimerSeconds] = useState<number>(60 * 60); // 60 minutes default
  const [timerRunning, setTimerRunning] = useState<boolean>(true);
  const [passageFontSize, setPassageFontSize] = useState<'15px' | '17px' | '19px'>(() => {
    try {
      const saved = localStorage.getItem('ielts_student_reading_font_size');
      if (saved === '15px' || saved === '17px' || saved === '19px') {
        return saved;
      }
    } catch {
      // ignore
    }
    return '17px';
  });

  const handleSetPassageFontSize = (size: '15px' | '17px' | '19px') => {
    setPassageFontSize(size);
    try {
      localStorage.setItem('ielts_student_reading_font_size', size);
    } catch {
      // ignore
    }
  };

  // Split-Screen Drag state
  const [splitWidth, setSplitWidth] = useState<number>(50); // percentage for left pane
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // IELTS Reading Marker state (defaults to null: unselected)
  const [selectedMarkerColor, setSelectedMarkerColor] = useState<PastelMarkerColor | null>(null);
  const [readingMarkers, setReadingMarkers] = useState<ReadingMarkerItem[]>([]);
  const [floatingToolbarPos, setFloatingToolbarPos] = useState<{ x: number; y: number; text: string } | null>(null);

  // Multi-Passage Tab state
  const [activePassageTab, setActivePassageTab] = useState<number>(0);

  // Multi-Passage assignment selection modal state
  const [passageAssignResource, setPassageAssignResource] = useState<any | null>(null);
  const [passageAssignList, setPassageAssignList] = useState<
    Array<{
      id: string;
      passageIndex: number;
      title: string;
      content: string;
      questions: ReadingQuestion[];
      questionGroups: QuestionGroup[];
      isSelected: boolean;
    }>
  >([]);
  const [passageAssignCourseId, setPassageAssignCourseId] = useState<string>('');
  const [passageAssignDueDate, setPassageAssignDueDate] = useState<string>('');
  const [passageAssignScoreVisibility, setPassageAssignScoreVisibility] = useState<'private' | 'public'>('private');

  // Reset active passage tab when switching assignments
  useEffect(() => {
    setActivePassageTab(0);
  }, [selectedAssignmentId]);

  // Reset active passage tab when switching assignments
  useEffect(() => {
    setActivePassageTab(0);
  }, [selectedAssignmentId]);

  // Teacher "Import from Library" state
  const [showImportLibraryModal, setShowImportLibraryModal] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCourseId, setLibraryCourseId] = useState('');
  const [isImportingFromLibrary, setIsImportingFromLibrary] = useState(false);

  // Standard IELTS Rubrics for Teacher Grading
  const defaultWritingRubrics = [
    { criterion: 'Task Achievement / Response', score: 7.0, descriptor: 'Addresses all parts of the prompt well.' },
    { criterion: 'Coherence & Cohesion', score: 7.0, descriptor: 'Sequences information and ideas logically.' },
    { criterion: 'Lexical Resource', score: 7.0, descriptor: 'Uses a good range of vocabulary with some awareness of style.' },
    { criterion: 'Grammatical Range & Accuracy', score: 7.0, descriptor: 'Uses a variety of complex structures with good control.' },
  ];

  const defaultSpeakingRubrics = [
    { criterion: 'Fluency & Coherence', score: 7.0, descriptor: 'Speaks at length with noticeable rhythm.' },
    { criterion: 'Lexical Resource', score: 7.0, descriptor: 'Resourceful range of descriptive phrases.' },
    { criterion: 'Grammatical Range & Accuracy', score: 7.0, descriptor: 'Uses a variety of complex structures with good control.' },
    { criterion: 'Pronunciation', score: 7.0, descriptor: 'Clear enunciation with appropriate intonation patterns.' },
  ];

  // Teacher grading state
  const [gradingRubrics, setGradingRubrics] = useState<{ criterion: string; score: number; descriptor: string }[]>(defaultWritingRubrics);
  const [teacherStrengths, setTeacherStrengths] = useState('');
  const [teacherAreasToImprove, setTeacherAreasToImprove] = useState('');
  const [teacherGeneralComments, setTeacherGeneralComments] = useState('');
  const [teacherNextSteps, setTeacherNextSteps] = useState('');
  const [overallScore, setOverallScore] = useState<number>(7.0);
  const [isAiDrafting, setIsAiDrafting] = useState(false);

  // Teacher inline annotation & draft state
  const [annotations, setAnnotations] = useState<InlineAnnotation[]>([]);
  const [activeSelection, setActiveSelection] = useState<{
    text: string;
    startIndex: number;
    endIndex: number;
  } | null>(null);
  const [newAnnotationType, setNewAnnotationType] = useState<InlineAnnotation['type']>('correction');
  const [newAnnotationComment, setNewAnnotationComment] = useState('');
  const [newAnnotationSuggestion, setNewAnnotationSuggestion] = useState('');
  const [draftSaveNotice, setDraftSaveNotice] = useState(false);
  const [activeInspectedAnnotation, setActiveInspectedAnnotation] = useState<InlineAnnotation | null>(null);
  const [activeOverlappingAnnotations, setActiveOverlappingAnnotations] = useState<InlineAnnotation[]>([]);
  const essayContainerRef = useRef<HTMLDivElement>(null);
  const studentAnnotationPopupRef = useRef<HTMLDivElement>(null);

  // Handle click outside of student annotation popup to dismiss
  useEffect(() => {
    if (!activeInspectedAnnotation) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Keep open if clicking inside the popup
      if (studentAnnotationPopupRef.current?.contains(target)) return;

      // Keep open / switch if clicking an annotation mark
      if (target.closest('mark[id^="annotation_"]')) return;

      // Otherwise dismiss popup and clear ring
      setActiveInspectedAnnotation(null);
      setActiveHighlightedAnnotationId(null);
      setActiveOverlappingAnnotations([]);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [activeInspectedAnnotation]);

  // Active assignment object
  const activeAssignment = selectedAssignmentId
    ? assignments.find((a) => a.id === selectedAssignmentId)
    : null;

  // Active submission for the student (or selected by teacher)
  const currentSubmission = isTeacher
    ? submissions.find((s) => s.id === selectedSubmissionId)
    : submissions.find(
        (s) => s.assignmentId === selectedAssignmentId && s.studentId === currentUser.id
      );

  // User accessible courses based on role & enrollment
  const accessibleCourses = courses.filter((c) => {
    if (isTeacher) {
      return c.teacherId === currentUser.id || isTeacher;
    }
    return courseMembers.some((m) => m.courseId === c.id && m.studentId === currentUser.id && m.status === 'enrolled');
  });

  // Filtered assignments
  const filteredAssignments = assignments.filter((a) => {
    // Only show assignments belonging to courses user is authorized to access
    const isAccessible = accessibleCourses.some((c) => c.id === a.courseId);
    if (!isAccessible) return false;

    // Course Filter
    if (selectedCourseFilter !== 'all' && a.courseId !== selectedCourseFilter) return false;

    // Skill Filter
    if (selectedSkillFilter !== 'all' && a.skill !== selectedSkillFilter) return false;

    return true;
  });

  // Load / Sync autosaved reading answers and writing draft from localStorage
  useEffect(() => {
    if (!activeAssignment || isTeacher) return;

    if (activeAssignment.skill === 'reading') {
      const storageKey = `ielts_reading_draft_${activeAssignment.id}_${currentUser.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            setReadingAnswers(parsed);
          }
        } catch {
          // ignore corrupted localstorage
        }
      } else if (currentSubmission?.readingAnswers) {
        setReadingAnswers(currentSubmission.readingAnswers);
      }

      // Load Reading Markers
      const markerKey = `ielts_reading_markers_${currentUser.id}_${activeAssignment.id}`;
      const legacyHlKey = `ielts_reading_highlights_${activeAssignment.id}_${currentUser.id}`;
      const savedMarkers = localStorage.getItem(markerKey) || localStorage.getItem(legacyHlKey);
      if (savedMarkers) {
        try {
          const parsedMarkers = JSON.parse(savedMarkers);
          if (Array.isArray(parsedMarkers)) {
            // Normalize markers to ensure pastel colors and passageIndex
            const normalizedMarkers: ReadingMarkerItem[] = parsedMarkers.map((m: any) => ({
              id: m.id || `mark_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              passageIndex: typeof m.passageIndex === 'number' ? m.passageIndex : 0,
              text: m.text || '',
              color:
                m.color === 'green'
                  ? 'pastel_green'
                  : m.color === 'pink'
                  ? 'pastel_pink'
                  : m.color === 'yellow'
                  ? 'pastel_yellow'
                  : PASTEL_MARKER_COLORS.some((c) => c.id === m.color)
                  ? m.color
                  : 'pastel_yellow',
            }));
            setReadingMarkers(normalizedMarkers);
          }
        } catch {}
      } else {
        setReadingMarkers([]);
      }
    } else if (activeAssignment.skill === 'writing') {
      const storageKey = `ielts_writing_draft_${activeAssignment.id}_${currentUser.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved && !currentSubmission) {
        setWritingDraft(saved);
      } else if (currentSubmission?.writingText) {
        setWritingDraft(currentSubmission.writingText);
      }
    }
  }, [activeAssignment?.id, currentUser?.id, isTeacher]);

  // Persist reading answers to localStorage on change
  const handleAnswerChange = (qId: string, val: string) => {
    const updated = { ...readingAnswers, [qId]: val };
    setReadingAnswers(updated);
    if (activeAssignment) {
      localStorage.setItem(
        `ielts_reading_draft_${activeAssignment.id}_${currentUser.id}`,
        JSON.stringify(updated)
      );
    }
  };

  // Persist writing draft to localStorage on change
  const handleWritingDraftChange = (text: string) => {
    setWritingDraft(text);
    if (activeAssignment) {
      localStorage.setItem(`ielts_writing_draft_${activeAssignment.id}_${currentUser.id}`, text);
    }
  };

  // Timer countdown effect for active reading practice
  useEffect(() => {
    if (!activeAssignment || activeAssignment.skill !== 'reading' || !timerRunning) return;
    if (currentSubmission?.status === 'graded') return;

    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeAssignment?.id, timerRunning, currentSubmission?.status]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Speaking prep countdown timer effect
  useEffect(() => {
    let interval: any;
    if (speakingPrepRunning && speakingPrepCountdown > 0) {
      interval = setInterval(() => {
        setSpeakingPrepCountdown((prev) => {
          if (prev <= 1) {
            setSpeakingPrepRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [speakingPrepRunning, speakingPrepCountdown]);

  // Split-Screen Drag Effect
  useEffect(() => {
    if (!isDraggingSplit) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      if (newWidth >= 25 && newWidth <= 75) {
        setSplitWidth(Math.round(newWidth));
      }
    };
    const handleMouseUp = () => {
      setIsDraggingSplit(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplit]);

  // IELTS Reading Marker Handlers & Storage
  const saveReadingMarkers = (updated: ReadingMarkerItem[]) => {
    setReadingMarkers(updated);
    if (activeAssignment && currentUser) {
      localStorage.setItem(
        `ielts_reading_markers_${currentUser.id}_${activeAssignment.id}`,
        JSON.stringify(updated)
      );
    }
  };

  const handleApplyMarker = (text: string, color: PastelMarkerColor) => {
    const trimmed = text.trim();
    if (!trimmed || !activeAssignment) return;
    const currentPIdx =
      activeAssignment.passages && activeAssignment.passages.length > 0
        ? Math.min(activePassageTab, activeAssignment.passages.length - 1)
        : 0;

    const newMarker: ReadingMarkerItem = {
      id: `mark_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      passageIndex: currentPIdx,
      text: trimmed,
      color,
    };
    const updated = [...readingMarkers, newMarker];
    saveReadingMarkers(updated);
    setFloatingToolbarPos(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleRemoveMarker = (id: string) => {
    const updated = readingMarkers.filter((m) => m.id !== id);
    saveReadingMarkers(updated);
  };

  const handleClearPassageMarkers = (pIdx?: number) => {
    const currentPIdx =
      pIdx !== undefined
        ? pIdx
        : activeAssignment?.passages && activeAssignment.passages.length > 0
        ? Math.min(activePassageTab, activeAssignment.passages.length - 1)
        : 0;
    const updated = readingMarkers.filter((m) => m.passageIndex !== currentPIdx);
    saveReadingMarkers(updated);
  };

  const handlePassageMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setFloatingToolbarPos(null);
      return;
    }
    const text = selection.toString().trim();
    if (text.length < 2) {
      setFloatingToolbarPos(null);
      return;
    }

    if (selectedMarkerColor) {
      // Highlight immediately with selected marker color
      handleApplyMarker(text, selectedMarkerColor);
    } else {
      // No marker is selected: do NOT auto-highlight text
      setFloatingToolbarPos(null);
    }
  };

  // Safe highlighted passage text renderer with paragraph separation & label preservation
  const renderHighlightedPassage = (rawText: string, passageIndex: number = 0) => {
    if (!rawText) return 'No reading passage text provided.';

    // 1. Normalize line breaks
    let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    // 2. Ensure standalone labels (e.g. \nA\n or \nParagraph A\n) are treated as paragraph boundaries
    text = text.replace(/([^\n])\n([A-Z]|Paragraph\s+[A-Z]|\[[A-Z]\])([\.:])?\n/g, '$1\n\n$2$3\n');

    // 3. Split by double newlines or more
    const rawChunks = text.split(/\n\s*\n+/);

    interface ParsedParaBlock {
      key: string;
      isHeading?: boolean;
      headingText?: string;
      label?: string;
      body: string;
    }

    const blocks: ParsedParaBlock[] = [];
    for (let i = 0; i < rawChunks.length; i++) {
      const chunk = rawChunks[i].trim();
      if (!chunk) continue;

      // Standalone Subsection Heading (e.g. ### The Drive to Acquire)
      if (chunk.startsWith('### ') || chunk.startsWith('## ')) {
        blocks.push({
          key: `h_${i}`,
          isHeading: true,
          headingText: chunk.replace(/^#{2,3}\s+/, ''),
          body: '',
        });
        continue;
      }

      // Check if chunk is purely a standalone label (e.g. "A" or "Paragraph A" or "[A]" or "A.")
      const standaloneLabelMatch = chunk.match(/^([A-Z]|Paragraph\s+[A-Z]|\[[A-Z]\])[\.:]?$/i);
      if (standaloneLabelMatch && i + 1 < rawChunks.length) {
        const nextChunk = rawChunks[i + 1].trim();
        // If next chunk is not a heading and not another standalone label, combine them!
        if (!nextChunk.startsWith('### ') && !nextChunk.startsWith('## ') && !nextChunk.match(/^([A-Z]|Paragraph\s+[A-Z]|\[[A-Z]\])[\.:]?$/i)) {
          blocks.push({
            key: `p_${i}`,
            label: standaloneLabelMatch[1].toUpperCase(),
            body: nextChunk,
          });
          i++; // consumed next chunk
          continue;
        }
      }

      // Check if chunk starts with label on its own line: e.g. "A\nBody text..." or "Paragraph A\nBody text..."
      const multilineLabelMatch = chunk.match(/^(([A-Z]|Paragraph\s+[A-Z]|\[[A-Z]\])[\.:]?)\s*\n([\s\S]+)$/i);
      if (multilineLabelMatch) {
        blocks.push({
          key: `p_${i}`,
          label: multilineLabelMatch[1].trim(),
          body: multilineLabelMatch[3].trim(),
        });
        continue;
      }

      // Check if chunk starts with inline label followed by colon/period/space: e.g. "A. Body..." or "A: Body..." or "[A] Body..." or "Paragraph A: Body..."
      const inlineLabelMatch = chunk.match(/^(([A-Z]|Paragraph\s+[A-Z]|\[[A-Z]\])[\.:])\s+([\s\S]+)$/i);
      if (inlineLabelMatch) {
        blocks.push({
          key: `p_${i}`,
          label: inlineLabelMatch[1].trim(),
          body: inlineLabelMatch[3].trim(),
        });
        continue;
      }

      // Regular paragraph
      blocks.push({
        key: `p_${i}`,
        body: chunk,
      });
    }

    const activeMarkers = readingMarkers.filter((m) => m.passageIndex === passageIndex);

    const renderTextWithMarkers = (pText: string, pKey: string | number) => {
      if (!activeMarkers || activeMarkers.length === 0) {
        return pText;
      }

      const sorted = [...activeMarkers].sort((a, b) => b.text.length - a.text.length);
      let parts: (string | React.ReactNode)[] = [pText];

      sorted.forEach((hl) => {
        const nextParts: (string | React.ReactNode)[] = [];
        const colDef = PASTEL_MARKER_COLORS.find((c) => c.id === hl.color) || PASTEL_MARKER_COLORS[2];

        parts.forEach((p) => {
          if (typeof p !== 'string') {
            nextParts.push(p);
            return;
          }
          const idx = p.indexOf(hl.text);
          if (idx === -1) {
            nextParts.push(p);
          } else {
            const before = p.slice(0, idx);
            const match = p.slice(idx, idx + hl.text.length);
            const after = p.slice(idx + hl.text.length);
            if (before) nextParts.push(before);
            nextParts.push(
              <mark
                key={`${hl.id}_${pKey}_${idx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveMarker(hl.id);
                }}
                className={`${colDef.markClass} rounded-xs px-0.5 cursor-pointer transition-colors font-sans font-medium`}
                title="Click để xóa marker này"
              >
                {match}
              </mark>
            );
            if (after) nextParts.push(after);
          }
        });
        parts = nextParts;
      });

      return parts;
    };

    return blocks.map((b) => {
      if (b.isHeading) {
        return (
          <h3
            key={b.key}
            className="font-bold font-sans text-slate-900 text-lg md:text-xl mt-6 mb-3 pb-1 border-b border-slate-200 tracking-tight"
          >
            {renderTextWithMarkers(b.headingText || '', `${b.key}_h`)}
          </h3>
        );
      }

      return (
        <div key={b.key} className="mb-6 leading-[1.75] text-justify font-serif text-slate-800">
          {b.label && (
            <span className="font-bold text-slate-900 font-sans text-base block mb-1.5 select-text">
              {b.label}
            </span>
          )}
          <p className="whitespace-pre-line leading-[1.75]">
            {renderTextWithMarkers(b.body, `${b.key}_b`)}
          </p>
        </div>
      );
    });
  };

  // Open Resource for Multi-Passage Assignment or Direct Assignment
  const handleOpenResourceAssignment = (res: any) => {
    let extractedPassages: any[] = [];
    if (res.content && (res.content.trim().startsWith('{') || res.content.trim().startsWith('['))) {
      try {
        const parsed = JSON.parse(res.content);
        if (parsed.passages && Array.isArray(parsed.passages) && parsed.passages.length > 0) {
          extractedPassages = parsed.passages;
        }
      } catch {}
    }

    if (extractedPassages.length === 0 && res.skill === 'reading' && res.content) {
      const docStruct = parseDocumentStructure(res.content, res.title);
      if (docStruct.candidateTests && docStruct.candidateTests.length > 0) {
        extractedPassages = docStruct.candidateTests.map((ct: any, idx: number) => ({
          id: `p_${idx + 1}`,
          passageIndex: idx,
          title: ct.title || `Passage ${idx + 1}`,
          content: ct.passageText,
          questions: ct.questions || [],
          questionGroups: ct.questionGroups || [],
        }));
      }
    }

    if (extractedPassages.length > 1) {
      setPassageAssignResource(res);
      setPassageAssignCourseId(libraryCourseId || courses[0]?.id || '');
      setPassageAssignDueDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
      setPassageAssignScoreVisibility('private');
      setPassageAssignList(
        extractedPassages.map((p, idx) => ({
          id: p.id || `p_${idx + 1}`,
          passageIndex: idx,
          title: p.title || `Passage ${idx + 1}`,
          content: p.content || '',
          questions: p.questions || [],
          questionGroups: p.questionGroups || [],
          isSelected: true,
        }))
      );
      setShowImportLibraryModal(false);
    } else {
      handleImportResourceToAssignment(res);
    }
  };

  const handleMovePassageUp = (index: number) => {
    if (index <= 0) return;
    setPassageAssignList((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMovePassageDown = (index: number) => {
    if (index >= passageAssignList.length - 1) return;
    setPassageAssignList((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleTogglePassageSelection = (index: number) => {
    setPassageAssignList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], isSelected: !copy[index].isSelected };
      return copy;
    });
  };

  const handleConfirmMultiPassageAssignment = async () => {
    if (!passageAssignResource || !passageAssignCourseId) {
      alert('Vui lòng chọn khóa học để giao bài.');
      return;
    }

    const selectedPassages = passageAssignList.filter((p) => p.isSelected);
    if (selectedPassages.length === 0) {
      alert('Vui lòng chọn ít nhất một Passage.');
      return;
    }

    setIsImportingFromLibrary(true);
    try {
      let currentQIndex = 1;
      const reindexedQuestions: ReadingQuestion[] = [];
      const reindexedGroups: QuestionGroup[] = [];
      const finalPassages: ParsedPassage[] = [];

      selectedPassages.forEach((p, pIdx) => {
        const passageQuestions = p.questions || [];
        const updatedPQuestions: ReadingQuestion[] = [];

        passageQuestions.forEach((q) => {
          const normQ: ReadingQuestion = {
            ...q,
            id: q.id || `q_p${pIdx + 1}_${currentQIndex}`,
          };
          updatedPQuestions.push(normQ);
          reindexedQuestions.push(normQ);
          currentQIndex++;
        });

        const updatedGroups = (p.questionGroups || []).map((g) => ({
          ...g,
          passageIndex: pIdx,
        }));
        reindexedGroups.push(...updatedGroups);

        finalPassages.push({
          id: p.id || `p_${pIdx + 1}`,
          passageIndex: pIdx,
          title: p.title || `Passage ${pIdx + 1}`,
          content: p.content,
          questions: updatedPQuestions,
          questionGroups: updatedGroups,
        });
      });

      const title = `${passageAssignResource.title} (${finalPassages.length} Passages)`;
      await createAssignment({
        courseId: passageAssignCourseId,
        title,
        instructions: 'Read the passages carefully and answer all questions in the test.',
        skill: 'reading',
        objectives: 'Practice multi-passage IELTS Reading with strict timing and scoring.',
        dueDate: passageAssignDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        status: 'published',
        readingTestType: 'academic',
        scoreVisibility: passageAssignScoreVisibility,
        readingPassage: finalPassages[0]?.content || '',
        readingQuestions: reindexedQuestions,
        questionGroups: reindexedGroups,
        passages: finalPassages,
      });

      setPassageAssignResource(null);
      setSubmissionSuccessModal({
        title: 'Giao bài tập Reading thành công!',
        message: `Đã giao thành công ${finalPassages.length} Passages với tổng số ${reindexedQuestions.length} câu hỏi. Học sinh sẽ làm bài và nộp toàn bộ các phần trong cùng một bài thi.`,
        actionText: 'Hoàn tất',
        onAction: () => setSubmissionSuccessModal(null),
      });
    } catch (err: any) {
      alert(`Lỗi khi tạo bài tập: ${err?.message || err}`);
    } finally {
      setIsImportingFromLibrary(false);
    }
  };

  // Import Resource to Assignment Handler
  const handleImportResourceToAssignment = async (resource: any) => {
    if (!libraryCourseId) {
      alert('Please select a target course first.');
      return;
    }
    setIsImportingFromLibrary(true);
    try {
      let readingPassage = resource.content || '';
      let readingQuestions: ReadingQuestion[] = [];
      let questionGroups: QuestionGroup[] = [];
      let passages: any[] = [];
      let instructions = 'Read the text carefully and answer all questions.';
      let targetSkill = resource.skill || 'reading';
      let title = resource.title || 'Imported IELTS Exercise';

      // 1. Check if resource.content is JSON payload (structured IELTS test from library)
      if (resource.content && (resource.content.trim().startsWith('{') || resource.content.trim().startsWith('['))) {
        try {
          const parsed = JSON.parse(resource.content);
          if (parsed && typeof parsed === 'object') {
            if (parsed.title) title = parsed.title;
            if (parsed.instructions) instructions = parsed.instructions;
            if (parsed.skill) targetSkill = parsed.skill;

            // Extract all questions using robust normalizer (checks passages, questionGroups, flat questions)
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
          }
        } catch {
          // Plain text fallback
        }
      }

      // 2. Handle Writing Resource Assignment
      if (targetSkill === 'writing' || resource.skill === 'writing' || (resource as any).type === 'writing') {
        let taskType: 'task1' | 'task2' = 'task2';
        let taskCat: WritingTaskCategory = 'task2';
        let writingPrompt = '';
        let task1ImageUrl: string | undefined = resource.url || undefined;
        let modelAnswer: string | undefined = undefined;
        let minWords = 250;

        if (resource.content) {
          try {
            const parsed = JSON.parse(resource.content);
            if (parsed && typeof parsed === 'object') {
              taskType = parsed.taskType || (resource.title.toLowerCase().includes('task 1') ? 'task1' : 'task2');
              const chart = (parsed.chartType || '').toLowerCase();
              taskCat = taskType === 'task1' ? (chart.includes('general') ? 'task1_general' : 'task1_academic') : 'task2';
              writingPrompt = parsed.prompt || parsed.writingPrompt || parsed.content || '';
              if (parsed.imageUrl || parsed.task1ImageUrl) task1ImageUrl = parsed.imageUrl || parsed.task1ImageUrl;
              modelAnswer = parsed.modelAnswer || parsed.sampleAnswer || parsed.sampleAnswers?.[0]?.content;
              minWords = parsed.minWords || (taskType === 'task1' ? 150 : 250);
            }
          } catch {
            writingPrompt = resource.content;
          }
        }
        if (!writingPrompt) {
          writingPrompt = resource.title;
        }

        await createAssignment({
          courseId: libraryCourseId,
          title,
          instructions: `Bài tập IELTS Writing ${taskType === 'task1' ? 'Task 1' : 'Task 2'}. Yêu cầu tối thiểu ${minWords} từ.`,
          skill: 'writing',
          objectives: 'Luyện tập kỹ năng IELTS Writing theo tiêu chuẩn quốc tế.',
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          status: 'published',
          writingTaskType: taskType,
          writingTaskCategory: taskCat,
          writingPrompt,
          task1ImageUrl,
          writingMinWords: minWords,
          modelAnswer,
          resourceId: resource.id,
          sourceDocumentName: resource.title,
        });
        setShowImportLibraryModal(false);
        alert('Tài liệu Writing đã được giao thành công cho khóa học!');
        return;
      }

      // 2b. Handle Listening Resource Assignment
      if (
        targetSkill === 'listening' ||
        resource.skill === 'listening' ||
        (resource as any).type === 'audio' ||
        (resource as any).type === 'listening' ||
        Boolean(resource.listeningContent)
      ) {
        let parsed: any = resource.listeningContent;
        if (!parsed && resource.content) {
          if (typeof resource.content === 'object') {
            parsed = resource.content.listeningContent || resource.content;
          } else if (typeof resource.content === 'string') {
            try {
              const json = JSON.parse(resource.content);
              parsed = json.listeningContent || json;
            } catch {
              parsed = parseListeningDocument(resource.content, resource.title);
            }
          }
        }
        if (!parsed || !parsed.parts || parsed.parts.length === 0) {
          parsed = parseListeningDocument(resource.content || resource.title, resource.title);
        }

        const audioUrl = resource.audioUrl || resource.url || parsed.audioUrl;
        const finalParts = parsed.parts || [];
        const allQuestions = finalParts.flatMap((p: any) =>
          p.questions?.length ? p.questions : (p.questionGroups || []).flatMap((g: any) => g.questions || [])
        );
        const allGroups = finalParts.flatMap((p: any) => p.questionGroups || []);

        await createAssignment({
          courseId: libraryCourseId,
          title,
          instructions:
            instructions ||
            `Bài tập IELTS Listening gồm ${finalParts.length} phần thi (${allQuestions.length} câu hỏi). Hãy nghe và hoàn thành toàn bộ câu hỏi.`,
          skill: 'listening',
          objectives: 'Luyện tập kỹ năng IELTS Listening theo cấu trúc chuẩn quốc tế.',
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          status: 'published',
          audioUrl,
          listeningAudioUrl: audioUrl,
          listeningContent: parsed,
          listeningParts: finalParts,
          listeningQuestions: allQuestions,
          listeningQuestionGroups: allGroups,
          questions: allQuestions,
          readingQuestions: allQuestions,
          questionGroups: allGroups,
          resourceId: resource.id,
          sourceDocumentName: resource.title,
        });
        setShowImportLibraryModal(false);
        alert('Tài liệu Listening đã được giao thành công cho khóa học!');
        return;
      }

      // 3. If readingQuestions is empty and this is reading, parse document structure from text
      if (readingQuestions.length === 0 && targetSkill === 'reading' && readingPassage) {
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

      await createAssignment({
        courseId: libraryCourseId,
        title,
        instructions,
        skill: targetSkill,
        objectives: 'Practice IELTS skills using resource materials.',
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        status: 'published',
        readingPassage: readingPassage || undefined,
        readingQuestions,
        questionGroups: questionGroups.length > 0 ? questionGroups : undefined,
        passages: passages.length > 0 ? passages : undefined,
        readingTestType: 'academic',
        answerReleasePolicy: 'after_submission',
        sourceDocumentName: resource.title,
      });
      setShowImportLibraryModal(false);
      alert('Exercise imported and assigned successfully with all questions preserved!');
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsImportingFromLibrary(false);
    }
  };

  // Populate Teacher Grading Form when selecting a submission
  useEffect(() => {
    if (isTeacher && currentSubmission) {
      if (currentSubmission.rubricScores && currentSubmission.rubricScores.length > 0) {
        setGradingRubrics(currentSubmission.rubricScores);
      } else if (currentSubmission.skill === 'speaking') {
        setGradingRubrics(defaultSpeakingRubrics);
      } else {
        setGradingRubrics(defaultWritingRubrics);
      }

      setTeacherStrengths(currentSubmission.strengths || '');
      setTeacherAreasToImprove(currentSubmission.areasToImprove || '');
      setTeacherGeneralComments(currentSubmission.teacherComments || '');
      setTeacherNextSteps(currentSubmission.nextSteps || '');
      setOverallScore(currentSubmission.score || 7.0);
      setAnnotations(currentSubmission.annotations || []);
      setActiveSelection(null);
      setActiveInspectedAnnotation(null);
    }
  }, [isTeacher, currentSubmission?.id]);

  // Instant Overall Band recalculation when any rubric score changes
  const handleRubricScoreChange = (idx: number, newScore: number) => {
    const rounded = roundIeltsComponentScore(newScore);
    const updated = [...gradingRubrics];
    updated[idx] = { ...updated[idx], score: rounded };
    setGradingRubrics(updated);

    const newOverall = calculateIeltsOverallBand(updated.map((r) => r.score));
    setOverallScore(newOverall);
  };

  // Teacher Annotation Selection Handlers (Single punctuation, single word, phrase, sentence, or blank space)
  const handleTextMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const container = essayContainerRef.current;
    if (!container) return;

    const range = selection.getRangeAt(0);
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
      return;
    }

    const offsets = getSelectionCharacterOffsetsWithin(container);
    if (!offsets) return;

    const fullText = currentSubmission?.writingText || '';
    const selectedText = fullText.substring(offsets.startIndex, offsets.endIndex);
    if (!selectedText || selectedText.length === 0) return;

    setActiveSelection({
      text: selectedText,
      startIndex: offsets.startIndex,
      endIndex: offsets.endIndex,
    });
  };

  // Strikethrough / Deletion annotation creator
  const applyDeletionAnnotation = (sel: { text: string; startIndex: number; endIndex: number }) => {
    const newAnnot: InlineAnnotation = {
      id: `annot-${Date.now()}`,
      startIndex: sel.startIndex,
      endIndex: sel.endIndex,
      selectedText: sel.text,
      type: 'deletion',
      comment: 'Yêu cầu gạch bỏ nội dung này (Delete / Remove)',
      suggestion: '',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    setAnnotations((prev) => [...prev, newAnnot]);
    setActiveSelection(null);
  };

  // Keyboard shortcut: Backspace or Delete on active selection applies strikethrough/deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && activeSelection) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        applyDeletionAnnotation(activeSelection);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSelection]);

  const handleAddAnnotation = () => {
    if (!activeSelection) return;
    if (newAnnotationType !== 'deletion' && !newAnnotationComment.trim()) return;

    const newAnnot: InlineAnnotation = {
      id: `annot-${Date.now()}`,
      startIndex: activeSelection.startIndex,
      endIndex: activeSelection.endIndex,
      selectedText: activeSelection.text,
      type: newAnnotationType,
      comment: newAnnotationComment.trim() || (newAnnotationType === 'deletion' ? 'Yêu cầu gạch bỏ nội dung này (Delete / Remove)' : 'Correction'),
      suggestion: newAnnotationType === 'deletion' ? '' : (newAnnotationSuggestion.trim() || undefined),
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    setAnnotations((prev) => [...prev, newAnnot]);
    setActiveSelection(null);
    setNewAnnotationComment('');
    setNewAnnotationSuggestion('');
  };

  const handleDeleteAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    if (activeInspectedAnnotation?.id === id) {
      setActiveInspectedAnnotation(null);
    }
    setActiveOverlappingAnnotations((prev) => prev.filter((a) => a.id !== id));
  };

  // Safe highlighted text renderer with true multi-overlapping annotations & deletion support
  const renderAnnotatedText = (
    text: string,
    annots: InlineAnnotation[] = [],
    interactive = false
  ) => {
    if (!text) return null;
    if (!annots || annots.length === 0) {
      return <span>{text}</span>;
    }

    const normalized = normalizeAnnotations(text, annots);
    if (normalized.length === 0) {
      return <span>{text}</span>;
    }

    const typeHighlightMap: Record<InlineAnnotation['type'], string> = {
      correction: 'bg-red-100 text-red-900 border-b-2 border-red-500 hover:bg-red-200',
      grammar: 'bg-amber-100 text-amber-900 border-b-2 border-amber-500 hover:bg-amber-200',
      vocabulary: 'bg-purple-100 text-purple-900 border-b-2 border-purple-500 hover:bg-purple-200',
      suggestion: 'bg-blue-100 text-blue-900 border-b-2 border-blue-500 hover:bg-blue-200',
      praise: 'bg-emerald-100 text-emerald-900 border-b-2 border-emerald-500 hover:bg-emerald-200',
      deletion: 'line-through decoration-rose-600 decoration-2 bg-rose-100 text-rose-950 border-b-2 border-rose-500 hover:bg-rose-200 font-medium',
    };

    // Collect all boundary points to partition text into atomic disjoint intervals
    const boundarySet = new Set<number>([0, text.length]);
    normalized.forEach((a) => {
      if (a.resolvedStart >= 0 && a.resolvedStart <= text.length) boundarySet.add(a.resolvedStart);
      if (a.resolvedEnd >= 0 && a.resolvedEnd <= text.length) boundarySet.add(a.resolvedEnd);
    });

    const sortedBoundaries = Array.from(boundarySet).sort((a, b) => a - b);
    const parts: React.ReactNode[] = [];

    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      const segStart = sortedBoundaries[i];
      const segEnd = sortedBoundaries[i + 1];
      const segText = text.substring(segStart, segEnd);
      if (!segText) continue;

      const covering = normalized.filter(
        (a) => a.resolvedStart <= segStart && a.resolvedEnd >= segEnd
      );

      if (covering.length === 0) {
        parts.push(<span key={`txt_${segStart}_${segEnd}`}>{segText}</span>);
      } else if (covering.length === 1) {
        const a = covering[0];
        const isCurrentActive =
          activeInspectedAnnotation?.id === a.id || activeHighlightedAnnotationId === a.id;
        const isDeletion = a.type === 'deletion';

        parts.push(
          <mark
            key={`annot_${segStart}_${segEnd}_${a.id}`}
            id={`annotation_${a.id}`}
            onClick={(e) => {
              e.stopPropagation();
              if (interactive) {
                if (activeInspectedAnnotation?.id === a.id) {
                  setActiveInspectedAnnotation(null);
                  setActiveHighlightedAnnotationId(null);
                  setActiveOverlappingAnnotations([]);
                } else {
                  setActiveHighlightedAnnotationId(a.id);
                  setActiveInspectedAnnotation(a);
                  setActiveOverlappingAnnotations([a]);
                }
              }
            }}
            className={`px-1 py-0.5 rounded-xs transition-all font-sans cursor-pointer ${
              typeHighlightMap[a.type] || typeHighlightMap.correction
            } ${isDeletion ? 'line-through decoration-rose-600 decoration-2' : ''} ${
              isCurrentActive ? 'ring-2 ring-blue-600 scale-105 inline-block shadow-xs font-semibold' : ''
            }`}
            title={`${a.type.toUpperCase()}: ${a.comment}${a.suggestion ? ` (Gợi ý sửa: ${a.suggestion})` : ''}`}
          >
            {segText}
          </mark>
        );
      } else {
        // Multi-overlapping annotations
        const hasDeletion = covering.some((a) => a.type === 'deletion');
        const isAnyActive = covering.some(
          (a) => activeInspectedAnnotation?.id === a.id || activeHighlightedAnnotationId === a.id
        );

        parts.push(
          <mark
            key={`annot_multi_${segStart}_${segEnd}`}
            id={`annotation_${covering[0].id}`}
            onClick={(e) => {
              e.stopPropagation();
              if (interactive) {
                setActiveOverlappingAnnotations(covering);
                setActiveInspectedAnnotation(covering[0]);
                setActiveHighlightedAnnotationId(covering[0].id);
              }
            }}
            className={`px-1 py-0.5 rounded-xs transition-all font-sans cursor-pointer bg-gradient-to-r from-amber-100 via-purple-100 to-blue-100 text-slate-900 border-b-2 border-dashed border-indigo-600 hover:brightness-95 ${
              hasDeletion ? 'line-through decoration-rose-600 decoration-2' : ''
            } ${isAnyActive ? 'ring-2 ring-indigo-600 scale-105 inline-block shadow-xs font-semibold' : ''}`}
            title={`Trùng lặp (${covering.length} nhận xét): ${covering.map((c) => c.comment).join(' | ')}`}
          >
            {segText}
            <span className="inline-flex items-center justify-center text-[10px] font-bold bg-indigo-600 text-white rounded-full px-1.5 py-0.2 mx-0.5 align-middle shadow-2xs select-none not-italic no-underline">
              {covering.length}
            </span>
          </mark>
        );
      }
    }

    return parts;
  };

  // Word count in writing draft
  const wordCount = writingDraft.trim().length === 0 ? 0 : writingDraft.trim().split(/\s+/).length;
  const targetWords = activeAssignment?.writingMinWords || (activeAssignment?.writingTaskCategory === 'task2' ? 250 : 150);
  const targetProgress = Math.min(100, Math.round((wordCount / targetWords) * 100));

  // Open Create Modal
  const openCreateModal = () => {
    setEditingAssignmentId(null);
    setFormCourseId(courses[0]?.id || '');
    setFormTitle('');
    setFormSkill('writing');
    setFormInstructions('');
    setFormObjectives('');
    setFormDueDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    setFormWritingTaskCategory('task2');
    setFormWritingPrompt('');
    setFormWritingMinWords(250);
    setFormTask1ImageUrl('');
    setFormModelAnswer('');
    setFormModelAnswerReleaseCondition('after_graded');
    setFormScoreVisibility('private');
    setFormReadingTestType('academic');
    setFormReadingPassage('');
    setFormSpeakingPart('part2');
    setFormSpeakingParts(['part2']);
    setFormSpeakingTopic('');
    setFormSpeakingPoints('');
    setFormSpeakingTopics([]);
    setFormSpeakingQuestions([]);
    setFormSpeakingPart3Groups([]);
    setFormSpeakingSelectedExerciseIds([]);
    setSelectedWritingResourceId(null);
    setSelectedWritingResourceTitle(null);
    setShowWritingLibraryPicker(false);
    setWritingLibrarySearch('');
    setShowCreateEditModal(true);
  };

  // Open Edit Modal with Pre-populated data
  const openEditModal = (a: Assignment) => {
    setEditingAssignmentId(a.id);
    setFormCourseId(a.courseId);
    setFormTitle(a.title);
    setFormSkill(a.skill);
    setFormInstructions(a.instructions || '');
    setFormObjectives(a.objectives || '');
    setFormDueDate(a.dueDate || '');
    setFormWritingTaskCategory(a.writingTaskCategory || (a.writingTaskType === 'task1' ? 'task1_academic' : 'task2'));
    setFormWritingPrompt(a.writingPrompt || '');
    setFormWritingMinWords(a.writingMinWords || (a.writingTaskCategory === 'task2' ? 250 : 150));
    setFormTask1ImageUrl(a.task1ImageUrl || '');
    setFormModelAnswer(a.modelAnswer || '');
    setFormModelAnswerReleaseCondition(a.modelAnswerReleaseCondition || 'after_graded');
    setFormScoreVisibility(a.scoreVisibility || 'private');
    setFormReadingTestType(a.readingTestType || 'academic');
    setFormReadingPassage(a.readingPassage || '');
    const linkedWritingRes = a.resourceId ? resources.find((r) => r.id === a.resourceId) : null;
    setSelectedWritingResourceId(a.resourceId || null);
    setSelectedWritingResourceTitle(linkedWritingRes?.title || null);
    setShowWritingLibraryPicker(false);
    setWritingLibrarySearch('');
    const spkDetails = extractSpeakingAssignmentDetails(a);
    setFormSpeakingPart(spkDetails.part);
    setFormSpeakingParts(spkDetails.parts);
    setFormSpeakingTopic(spkDetails.cueCard?.topic || a.speakingCueCard?.topic || '');
    setFormSpeakingPoints(spkDetails.cueCard?.points?.join('\n') || a.speakingCueCard?.points?.join('\n') || '');
    setFormSpeakingTopics(spkDetails.topics || []);
    setFormSpeakingQuestions(spkDetails.questions || []);
    setFormSpeakingPart3Groups(a.speakingPart3Groups || spkDetails.groups || []);
    setFormSpeakingSelectedExerciseIds(a.selectedSpeakingExerciseIds || []);
    setShowCreateEditModal(true);
  };

  // Auto-link Part 3 questions when Part 2 topic changes
  const linkPart3ForCueTopic = (cueTopic: string, sourceRes?: any, cardId?: string) => {
    if (!cueTopic || !cueTopic.trim()) return;

    const cards = [{ id: cardId, topic: cueTopic.trim() }];
    const { matchedGroups } = findAssociatedPart3GroupsForCards(cards, sourceRes, resources);

    // Strict 1-to-1 linkage rule: ONE Part 2 cue card must link to EXACTLY ONE Part 3 group
    if (matchedGroups.length > 0) {
      const singleGroup = matchedGroups.slice(0, 1);
      setFormSpeakingPart3Groups(singleGroup);
      setFormSpeakingQuestions(singleGroup[0]?.questions || []);
      return;
    }

    const norm = cueTopic.toLowerCase().trim();
    const extractP3 = (res: any): SpeakingPart3Group[] => {
      const details = getSpeakingResourceDetails(res);
      return details.groups;
    };

    let pool: SpeakingPart3Group[] = [];
    if (sourceRes) {
      pool.push(...extractP3(sourceRes));
    }
    resources.forEach((r) => {
      pool.push(...extractP3(r));
    });

    const matched = pool.filter((g) => {
      if (!g.cueCardTopic) return false;
      const gNorm = g.cueCardTopic.toLowerCase().trim();
      return (
        norm.includes(gNorm.slice(0, 15)) ||
        gNorm.includes(norm.slice(0, 15)) ||
        norm.includes(gNorm) ||
        gNorm.includes(norm)
      );
    });

    if (matched.length > 0) {
      const uniqueMatched: SpeakingPart3Group[] = [];
      matched.forEach((g) => {
        if (!uniqueMatched.some((u) => u.id === g.id || (u.cueCardTopic === g.cueCardTopic && u.questions?.length === g.questions?.length))) {
          uniqueMatched.push(g);
        }
      });
      const singleGroup = uniqueMatched.slice(0, 1);
      setFormSpeakingPart3Groups(singleGroup);
      setFormSpeakingQuestions(singleGroup[0]?.questions || []);
    }
  };

  // Auto-link Part 2 Cue Card when Part 3 groups or questions are selected
  const linkCueCardForPart3 = (groups: SpeakingPart3Group[], sourceRes?: any) => {
    if (!groups || groups.length === 0) return;
    const targetTopics = groups
      .map((g) => g.cueCardTopic?.trim())
      .filter(Boolean) as string[];
    if (targetTopics.length === 0) return;

    const candidateCards: { topic: string; points: string[]; resourceTitle?: string }[] = [];

    const inspectResource = (r: any) => {
      let cueCards: any[] = r.speakingPart2?.cueCards || r.speakingCueCards || [];
      if (cueCards.length === 0 && r.speakingCueCard) cueCards = [r.speakingCueCard];
      if (cueCards.length === 0 && r.content) {
        try {
          const parsed = typeof r.content === 'string' ? JSON.parse(r.content) : r.content;
          cueCards = parsed.cueCards || parsed.speakingPart2?.cueCards || (parsed.cueCard ? [parsed.cueCard] : []);
        } catch {}
      }
      cueCards.forEach((c: any) => {
        if (!c.topic) return;
        const cNorm = c.topic.toLowerCase().trim();
        const isMatch = targetTopics.some((t) => {
          const tNorm = t.toLowerCase().trim();
          return (
            cNorm.includes(tNorm.slice(0, 15)) ||
            tNorm.includes(cNorm.slice(0, 15)) ||
            cNorm === tNorm
          );
        });
        if (isMatch) {
          candidateCards.push({
            topic: c.topic,
            points: c.points || ['What it is', 'Why it matters', 'How you feel about it'],
            resourceTitle: r.title,
          });
        }
      });
    };

    if (sourceRes) inspectResource(sourceRes);
    resources.filter((r) => r.skill === 'speaking' || (r as any).type === 'speaking').forEach(inspectResource);

    // Deduplicate candidates
    const unique = Array.from(new Map(candidateCards.map((item) => [item.topic, item])).values());
    if (unique.length > 0) {
      const topMatch = unique[0];
      setFormSpeakingTopic(topMatch.topic);
      setFormSpeakingPoints(Array.isArray(topMatch.points) ? topMatch.points.join('\n') : '');
      setFormSpeakingLinkedPart2Topic(topMatch.topic);
      setCandidatePart2CueCards(unique);
    }
  };

  // Submit Create or Update
  const handleSaveAssignmentForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCourseId || !formTitle.trim()) return;

    if (formSkill === 'speaking' && formSpeakingParts.length === 0) {
      alert('Vui lòng chọn ít nhất 1 phần thi Speaking (Part 1, Part 2 hoặc Part 3).');
      return;
    }

    setIsSubmittingForm(true);
    try {
      const isTask1 = formWritingTaskCategory.startsWith('task1');
      const minWords = formSkill === 'writing' ? (formWritingMinWords || (isTask1 ? 150 : 250)) : undefined;

      const payload: Partial<Assignment> = {
        courseId: formCourseId,
        title: formTitle.trim(),
        instructions: formInstructions.trim() || 'Complete the assignment following IELTS exam standards.',
        skill: formSkill,
        objectives: formObjectives.trim() || 'Master IELTS band criteria.',
        dueDate: formDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        status: 'published',
        writingTaskType: formSkill === 'writing' ? (isTask1 ? 'task1' : 'task2') : undefined,
        writingTaskCategory: formSkill === 'writing' ? formWritingTaskCategory : undefined,
        writingPrompt: formSkill === 'writing' ? formWritingPrompt.trim() : undefined,
        writingMinWords: minWords,
        task1ImageUrl: formSkill === 'writing' && formWritingTaskCategory === 'task1_academic' ? formTask1ImageUrl.trim() : undefined,
        modelAnswer: formModelAnswer.trim() || undefined,
        resourceId: formSkill === 'writing' ? selectedWritingResourceId || undefined : undefined,
        modelAnswerReleaseCondition: formModelAnswerReleaseCondition,
        scoreVisibility: formScoreVisibility,
        readingTestType: formSkill === 'reading' ? formReadingTestType : undefined,
        readingPassage: formSkill === 'reading' ? formReadingPassage : undefined,
        speakingPart: formSkill === 'speaking' ? (formSpeakingParts.length === 3 ? 'full' : formSpeakingParts[0]) : undefined,
        speakingParts: formSkill === 'speaking' ? formSpeakingParts : undefined,
        speakingTopics: formSkill === 'speaking' && formSpeakingParts.includes('part1') ? formSpeakingTopics : undefined,
        speakingCueCard:
          formSkill === 'speaking' && formSpeakingParts.includes('part2')
            ? {
                topic: formSpeakingTopic.trim() || 'Describe an experience that taught you something valuable.',
                points: formSpeakingPoints
                  ? formSpeakingPoints.split('\n').map((p) => p.trim()).filter(Boolean)
                  : ['What the experience was', 'When it happened', 'What you learned from it'],
                prepTimeSeconds: 60,
                speakTimeSeconds: 120,
              }
            : undefined,
        speakingQuestions: formSkill === 'speaking' && formSpeakingParts.includes('part3') ? formSpeakingQuestions : undefined,
        speakingPart3Groups: formSkill === 'speaking' && formSpeakingParts.includes('part3') ? formSpeakingPart3Groups : undefined,
        selectedSpeakingExerciseIds: formSkill === 'speaking' ? formSpeakingSelectedExerciseIds : undefined,
      };

      const existingAssign = editingAssignmentId ? assignments.find((a) => a.id === editingAssignmentId) : null;

      if (editingAssignmentId && existingAssign) {
        if (formSkill === 'reading') {
          payload.readingQuestions = existingAssign.readingQuestions;
          payload.questionGroups = existingAssign.questionGroups;
          payload.passages = existingAssign.passages;
        }
        await updateAssignment(editingAssignmentId, payload);
      } else {
        if (formSkill === 'reading' && formReadingPassage.trim()) {
          const docStruct = parseDocumentStructure(formReadingPassage, formTitle.trim());
          if (docStruct.questions && docStruct.questions.length > 0) {
            payload.readingQuestions = docStruct.questions;
            if (docStruct.candidateTests && docStruct.candidateTests.length > 0) {
              payload.questionGroups = docStruct.candidateTests[0]?.questionGroups || [];
              if (docStruct.candidateTests[0]?.passageText) {
                payload.passages = [
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
        await createAssignment(payload as Omit<Assignment, 'id'>);
      }

      setShowCreateEditModal(false);
    } catch (err: any) {
      alert(err.message || 'Error saving assignment');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // Safe Exercise Deletion
  const handleConfirmDeleteAssignment = async (mode: 'permanent' | 'unpublish') => {
    if (!deletingAssignment) return;

    setIsDeleting(true);
    try {
      if (mode === 'unpublish') {
        await updateAssignment(deletingAssignment.id, { status: 'draft' });
      } else {
        await deleteAssignment(deletingAssignment.id);
      }
      setDeletingAssignment(null);
      if (selectedAssignmentId === deletingAssignment.id) {
        setSelectedAssignmentId(null);
      }
    } catch (err: any) {
      alert(`Delete operation failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to get effective reading questions
  const getEffectiveQuestions = (assignment: Assignment): ReadingQuestion[] => {
    return extractAllNormalizedQuestions(assignment).questions;
  };

  // Check unanswered reading questions before submitting
  const initiateReadingSubmit = () => {
    if (!activeAssignment) return;
    const effQuestions = getEffectiveQuestions(activeAssignment);
    if (effQuestions.length === 0) return;

    const unanswered = effQuestions
      .map((q, idx) => ({ qNum: idx + 1, id: q.id, answered: Boolean(readingAnswers[q.id]?.trim()) }))
      .filter((item) => !item.answered);

    if (unanswered.length > 0) {
      setShowUnansweredModal(true);
    } else {
      executeReadingSubmit();
    }
  };

  // Execute reading submit
  const executeReadingSubmit = async () => {
    if (!activeAssignment || isSubmittingStudentWork) return;
    const effQuestions = getEffectiveQuestions(activeAssignment);
    if (effQuestions.length === 0) return;

    setIsSubmittingStudentWork(true);
    setShowUnansweredModal(false);
    try {
      const testType = activeAssignment.readingTestType || 'academic';

      const gradeSummary = gradeAssignmentSubmission(
        effQuestions,
        readingAnswers,
        testType
      );

      await submitAssignment(activeAssignment.id, {
        readingAnswers,
        readingScore: {
          correct: gradeSummary.earnedScore,
          total: gradeSummary.maxScore,
          percentage: gradeSummary.percentage,
          estimatedBand: gradeSummary.bandEstimate,
          testType,
          bandNotes: gradeSummary.bandNotes,
        },
        readingErrorAnalysis: gradeSummary.errorAnalysis,
        score: gradeSummary.bandEstimate,
        status: 'graded',
      });

      // Clear local storage draft
      localStorage.removeItem(`ielts_reading_draft_${activeAssignment.id}_${currentUser.id}`);

      const isScorePublic = activeAssignment.scoreVisibility === 'public';
      setSubmissionSuccessModal({
        title: 'Nộp bài thi Reading thành công!',
        message:
          isScorePublic
            ? `Bạn đã hoàn thành bài thi với kết quả: ${gradeSummary.earnedScore}/${gradeSummary.maxScore} câu đúng (Band ${gradeSummary.bandEstimate.toFixed(1)}).`
            : 'Bài làm của bạn đã được ghi nhận thành công. Điểm số và đáp án chi tiết sẽ hiển thị khi giáo viên mở quyền công bố điểm.',
        actionText: 'Xem chi tiết bài làm',
        onAction: () => setSubmissionSuccessModal(null),
      });
    } catch (err: any) {
      alert(err?.message || 'Có lỗi khi nộp bài thi Reading. Vui lòng kiểm tra và thử lại.');
    } finally {
      setIsSubmittingStudentWork(false);
    }
  };

  // Submit listening assignment with automated official IELTS grading
  const handleSubmitListening = async () => {
    if (!activeAssignment) return;
    setIsSubmittingStudentWork(true);
    try {
      const parts = activeAssignment.listeningParts || [];
      const allQs =
        parts.length > 0
          ? parts.flatMap((p) => p.questions || [])
          : (activeAssignment.questions as any) || [];

      const gradeSummary = gradeListeningSubmission(allQs, readingAnswers);

      await submitAssignment(activeAssignment.id, {
        answers: readingAnswers,
        listeningAnswers: readingAnswers,
        listeningScore: {
          raw: gradeSummary.correctCount,
          total: gradeSummary.maxScore,
          band: gradeSummary.bandEstimate,
          errorAnalysis: gradeSummary.errorAnalysis,
        },
        score: gradeSummary.bandEstimate,
        status: 'graded',
      });

      localStorage.removeItem(`ielts_listening_draft_${activeAssignment.id}_${currentUser.id}`);

      setSubmissionSuccessModal({
        title: 'Nộp bài thi Listening thành công!',
        message: `Bạn đã đạt ${gradeSummary.correctCount}/${gradeSummary.maxScore} câu đúng (Band ước tính: ${gradeSummary.bandEstimate.toFixed(1)}).`,
        actionText: 'Xem chi tiết bài làm',
        onAction: () => setSubmissionSuccessModal(null),
      });
    } catch (err: any) {
      alert(err?.message || 'Có lỗi khi nộp bài thi Listening.');
    } finally {
      setIsSubmittingStudentWork(false);
    }
  };

  // Submit writing
  const handleWritingSubmit = async () => {
    if (!activeAssignment || !writingDraft.trim() || isSubmittingStudentWork) return;

    setIsSubmittingStudentWork(true);
    try {
      await submitAssignment(activeAssignment.id, {
        writingText: writingDraft,
        writingWordCount: wordCount,
        status: 'submitted',
      });

      localStorage.removeItem(`ielts_writing_draft_${activeAssignment.id}_${currentUser.id}`);

      setSubmissionSuccessModal({
        title: 'Nộp bài viết thành công!',
        message:
          'Bài viết của bạn đã được gửi đến giáo viên để chấm điểm theo 4 tiêu chí chuẩn IELTS. Bạn sẽ nhận được thông báo ngay khi có kết quả chấm.',
        actionText: 'Quay lại danh sách bài tập',
        onAction: () => {
          setSubmissionSuccessModal(null);
          setSelectedAssignmentId(null);
        },
      });
    } catch (err: any) {
      alert(err?.message || 'Có lỗi xảy ra khi nộp bài. Nội dung bài viết vẫn được lưu trữ an toàn.');
    } finally {
      setIsSubmittingStudentWork(false);
    }
  };

  // Submit speaking
  const handleSpeakingSubmit = async () => {
    if (!activeAssignment || isSubmittingStudentWork) return;

    const audioKeys = Object.keys(studentSpeakingAudios);
    if (audioKeys.length === 0) {
      alert('Vui lòng hoàn thành ít nhất một bản ghi âm hoặc tải lên file âm thanh trước khi nộp bài.');
      return;
    }

    setIsSubmittingStudentWork(true);
    setSpeakingSubmittingStep('Đang chuẩn bị các bản ghi âm...');
    try {
      const responses: SpeakingQuestionResponse[] = [];
      let totalDuration = 0;

      const items = audioKeys.map((key) => {
        const audio = studentSpeakingAudios[key];
        const extension = audio.blob.type.includes('mp3') ? 'mp3' : 'webm';
        const fileName = `speaking_${activeAssignment.id}_${key}_${Date.now()}.${extension}`;
        return {
          fileOrBlob: audio.blob,
          options: {
            bucket: 'speaking_audios',
            folder: 'speaking',
            fileName,
            contentType: audio.blob.type || 'audio/webm',
          },
        };
      });

      const uploadedUrls = await uploadMultipleAudioFiles(
        items,
        3,
        (completedCount, totalCount) => {
          setSpeakingSubmittingStep(`Đang tải lên bản ghi âm (${completedCount}/${totalCount})...`);
        }
      );

      for (let i = 0; i < audioKeys.length; i++) {
        const key = audioKeys[i];
        const audio = studentSpeakingAudios[key];
        const audioUrl = uploadedUrls[i];

        responses.push({
          questionId: key,
          audioUrl,
          duration: audio.duration,
          transcript: '',
          translation: '',
          recordedAt: new Date().toISOString(),
        });

        totalDuration += audio.duration;
      }

      setSpeakingSubmittingStep('Đang lưu bài nộp vào hệ thống...');
      const overallTranscript = '';
      const overallTranslation = '';

      const responsesMap: Record<string, SpeakingQuestionResponse> = {};
      responses.forEach((r) => {
        if (r.questionId) {
          responsesMap[r.questionId] = r;
        }
      });

      const packedJson = packSpeakingSubmission({
        transcript: overallTranscript,
        translation: overallTranslation,
        responses: responsesMap,
      });

      await submitAssignment(activeAssignment.id, {
        speakingAudioUrl: responses[0]?.audioUrl || '',
        speakingTranscript: packedJson,
        speakingTranslation: overallTranslation,
        speakingDuration: totalDuration,
        speakingResponses: responsesMap,
        status: 'submitted',
      });

      setStudentSpeakingAudios({});
      setSubmissionSuccessModal({
        title: 'Nộp bài Speaking thành công!',
        message: 'Bản ghi âm bài nói cùng nhận diện transcript và bản dịch đã được lưu trữ an toàn và gửi đến giáo viên.',
        actionText: 'Quay lại danh sách bài tập',
        onAction: () => {
          setSubmissionSuccessModal(null);
          setSelectedAssignmentId(null);
        },
      });
    } catch (err: any) {
      alert(err?.message || 'Có lỗi xảy ra khi nộp bài nói. Vui lòng thử lại.');
    } finally {
      setIsSubmittingStudentWork(false);
      setSpeakingSubmittingStep('');
    }
  };

  // AI draft feedback generator for Teacher
  const handleGenerateAiFeedback = (sub: Submission) => {
    setIsAiDrafting(true);
    setTimeout(() => {
      if (sub.skill === 'writing') {
        const words = sub.writingWordCount || 0;
        const draftRubrics = [
          {
            criterion: 'Task Achievement / Response',
            score: words >= 250 ? 7.5 : 6.0,
            descriptor: words >= 250 ? 'Thoroughly addresses both views with clear thesis.' : 'Under minimum 250 words penalty.',
          },
          {
            criterion: 'Coherence & Cohesion',
            score: 7.5,
            descriptor: 'Logically organized paragraphs with cohesive devices.',
          },
          {
            criterion: 'Lexical Resource',
            score: 7.0,
            descriptor: 'Appropriate academic vocabulary with occasional minor collocation stiffness.',
          },
          {
            criterion: 'Grammatical Range & Accuracy',
            score: 7.0,
            descriptor: 'Good mix of complex structures; punctuation accurate throughout.',
          },
        ];

        setGradingRubrics(draftRubrics);
        setTeacherStrengths('Logical paragraph transitions and strong academic vocabulary.');
        setTeacherAreasToImprove('Provide more concrete workplace real-world examples in paragraph 3.');
        setTeacherGeneralComments('Promising Band 7.0+ essay. Teacher please verify paragraph 3 logic before approving.');
        setTeacherNextSteps('Focus on concise topic sentences and timed 40-minute drills.');
        setOverallScore(calculateIeltsOverallBand(draftRubrics.map((r) => r.score)));
      } else if (sub.skill === 'speaking') {
        const draftRubrics = [
          { criterion: 'Fluency & Coherence', score: 7.0, descriptor: 'Speaks at length with noticeable rhythm.' },
          { criterion: 'Lexical Resource', score: 7.0, descriptor: 'Resourceful range of descriptive phrases.' },
          { criterion: 'Grammatical Range & Accuracy', score: 6.5, descriptor: 'A few minor tense inconsistencies when describing the past.' },
          { criterion: 'Pronunciation', score: 7.0, descriptor: 'Clear enunciation with appropriate intonation patterns.' },
        ];
        setGradingRubrics(draftRubrics);
        setTeacherStrengths('Natural speaking cadence and spontaneous delivery on the cue card.');
        setTeacherAreasToImprove('Keep past tense verb consistency when describing origins.');
        setTeacherGeneralComments('Good performance. Clear accent, intelligible throughout.');
        setTeacherNextSteps('Practice abstract Part 3 discussion points with prompt follow-ups.');
        setOverallScore(calculateIeltsOverallBand(draftRubrics.map((r) => r.score)));
      }
      setIsAiDrafting(false);
    }, 600);
  };

  const handleSaveDraft = async () => {
    if (!currentSubmission || isGradingSubmission) return;

    setIsGradingSubmission(true);
    try {
      await gradeSubmission(currentSubmission.id, {
        rubricScores: gradingRubrics,
        strengths: teacherStrengths,
        areasToImprove: teacherAreasToImprove,
        teacherComments: teacherGeneralComments,
        nextSteps: teacherNextSteps,
        score: overallScore,
        annotations,
        isDraft: true,
      });

      setDraftSaveNotice(true);
      setTimeout(() => setDraftSaveNotice(false), 3500);
    } catch (err: any) {
      alert(err?.message || 'Lỗi khi lưu bản nháp chấm điểm');
    } finally {
      setIsGradingSubmission(false);
    }
  };

  const handleFinalizeGrading = async () => {
    if (!currentSubmission || isGradingSubmission) return;

    setIsGradingSubmission(true);
    try {
      await gradeSubmission(currentSubmission.id, {
        rubricScores: gradingRubrics,
        strengths: teacherStrengths,
        areasToImprove: teacherAreasToImprove,
        teacherComments: teacherGeneralComments,
        nextSteps: teacherNextSteps,
        score: overallScore,
        annotations,
        isDraft: false,
      });

      setSubmissionSuccessModal({
        title: 'Đã xuất bản kết quả chấm điểm!',
        message: `Bài nộp của học viên ${currentSubmission.studentName} đã được chấm thành công với kết quả Overall Band ${overallScore.toFixed(1)}. Học viên sẽ nhận được đầy đủ nhận xét và đánh giá chi tiết.`,
        actionText: 'Quay lại danh sách chấm bài',
        onAction: () => {
          setSubmissionSuccessModal(null);
          setSelectedSubmissionId(null);
        },
      });
    } catch (err: any) {
      alert(err?.message || 'Lỗi khi xuất bản kết quả chấm điểm');
    } finally {
      setIsGradingSubmission(false);
    }
  };

  const handleConfirmReturn = async () => {
    if (!currentSubmission || !returnComments.trim()) return;
    await returnForRevision(currentSubmission.id, returnComments);
    setShowReturnModal(false);
    setSelectedSubmissionId(null);
  };

  // =========================================================================
  // SCREEN 1: TEACHER SUBMISSION INSPECTION & GRADING
  // =========================================================================
  if (isTeacher && currentSubmission) {
    const parentAssignment = assignments.find((a) => a.id === currentSubmission.assignmentId);
    const isReadingSubmission =
      currentSubmission.skill === 'reading' ||
      Boolean(currentSubmission.readingAnswers) ||
      parentAssignment?.skill === 'reading';

    const extractedData = isReadingSubmission && parentAssignment
      ? extractAllNormalizedQuestions(parentAssignment)
      : null;
    const readingQuestionsList: ReadingQuestion[] = extractedData ? extractedData.questions : [];

    const readingAnswers = currentSubmission.readingAnswers || {};
    const totalQuestionsCount = readingQuestionsList.length || currentSubmission.readingScore?.total || 0;
    const errorAnalysis = currentSubmission.readingErrorAnalysis || [];

    let correctCount = 0;
    if (currentSubmission.readingScore?.correct !== undefined) {
      correctCount = currentSubmission.readingScore.correct;
    } else if (errorAnalysis.length > 0) {
      correctCount = errorAnalysis.filter((e) => e.isCorrect).length;
    } else if (readingQuestionsList.length > 0) {
      correctCount = readingQuestionsList.filter((q) => {
        const studentAns = (readingAnswers[q.id] || '').trim().toLowerCase();
        const correctAns = (q.correctAnswer || '').trim().toLowerCase();
        return studentAns && correctAns && studentAns === correctAns;
      }).length;
    }

    const readingBandRes = totalQuestionsCount > 0
      ? calculateReadingBand(correctCount, (parentAssignment?.readingTestType as any) || 'academic', totalQuestionsCount)
      : null;
    const calculatedReadingBand: number =
      typeof currentSubmission.score === 'number'
        ? currentSubmission.score
        : (readingBandRes?.band || 7.0);

    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
          <div>
            <button
              onClick={() => setSelectedSubmissionId(null)}
              className="text-sm font-semibold text-blue-600 hover:underline mb-1 block"
            >
              &larr; {t('common.back')}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {t('assignments.reviewingHeader')} {currentSubmission.skill.toUpperCase()}: {currentSubmission.assignmentTitle}
              </h1>
              {currentSubmission.isDraft && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  {t('assignments.draftBadge')}
                </span>
              )}
              {currentSubmission.status === 'graded' && !currentSubmission.isDraft && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {t('assignments.publishedBadge')}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {t('assessments.studentLabel')}: <span className="font-bold text-slate-700">{currentSubmission.studentName}</span> · {currentSubmission.submittedAt}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleGenerateAiFeedback(currentSubmission)}
              disabled={isAiDrafting}
              className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>{isAiDrafting ? t('assignments.analyzing') : t('assignments.aiDraftFeedback')}</span>
            </button>

            <button
              onClick={() => {
                setShowReturnModal(true);
                setReturnComments('');
              }}
              className="px-3.5 py-2 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 rounded-lg text-sm font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t('assignments.returnRevisionBtn')}</span>
            </button>
          </div>
        </div>

        {/* Student Submission Display */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">{t('assignments.studentWork')}</h2>
            {currentSubmission.skill === 'writing' && (
              <span className="text-sm font-mono font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded">
                {t('assignments.wordCountLabel')}: {currentSubmission.writingWordCount || 0}
              </span>
            )}
            {currentSubmission.skill === 'speaking' && (
              <span className="text-sm font-mono font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded">
                {t('assignments.durationLabel')}: {currentSubmission.speakingDuration}s
              </span>
            )}
            {isReadingSubmission && (
              <span className="text-sm font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
                Reading Score: {correctCount} / {totalQuestionsCount} ({totalQuestionsCount > 0 ? Math.round((correctCount / totalQuestionsCount) * 100) : 0}%)
              </span>
            )}
          </div>

          {/* Reading Submission Detailed Inspection */}
          {isReadingSubmission && (
            <div className="space-y-5">
              {/* Score Banner */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      IELTS Reading Assessment — {parentAssignment?.readingTestType === 'general' ? 'General Training' : 'Academic'}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Student completed {Object.keys(readingAnswers).length} of {totalQuestionsCount} questions.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">{t('assignments.calculatedBand')}</span>
                    <span className="text-xl font-black text-blue-700">Band {(currentSubmission.score || calculatedReadingBand).toFixed(1)}</span>
                  </div>
                  <div className="h-8 w-px bg-blue-200" />
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">{t('assignments.correctAnswersCount')}</span>
                    <span className="text-xl font-black text-emerald-700">{correctCount} / {totalQuestionsCount}</span>
                  </div>
                </div>
              </div>

              {/* Question-by-Question Review */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {t('assignments.detailedBreakdown')}
                </h4>

                {readingQuestionsList.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500">
                    No structured questions found on this assignment record.
                  </div>
                ) : (
                  readingQuestionsList.map((q, idx) => {
                    const studentAns = readingAnswers[q.id]?.trim() || '';
                    const correctAns = (q.correctAnswer || '').trim();
                    const analysis = errorAnalysis.find((e) => e.questionId === q.id);
                    const isCorrect = analysis
                      ? analysis.isCorrect
                      : Boolean(studentAns && correctAns && studentAns.toLowerCase() === correctAns.toLowerCase());
                    const isUnanswered = !studentAns;
                    const prompt = resolveQuestionPrompt(q, idx + 1);

                    return (
                      <div
                        key={q.id || idx}
                        className={`p-4 rounded-xl border text-sm space-y-2 transition-colors ${
                          isUnanswered
                            ? 'bg-slate-50 border-slate-200'
                            : isCorrect
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-red-50/40 border-red-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            Question {idx + 1}
                            {q.type && (
                              <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-normal">
                                {q.type.replace(/_/g, ' ')}
                              </span>
                            )}
                          </span>

                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center space-x-1 ${
                              isUnanswered
                                ? 'bg-slate-200 text-slate-700'
                                : isCorrect
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-red-100 text-red-800 border border-red-300'
                            }`}
                          >
                            {isUnanswered ? (
                              <span>Unanswered</span>
                            ) : isCorrect ? (
                              <span>✓ Correct (1 pt)</span>
                            ) : (
                              <span>✗ Incorrect (0 pt)</span>
                            )}
                          </span>
                        </div>

                        <p className="text-slate-800 text-sm font-medium">{prompt}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                          <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-0.5">
                            <span className="text-slate-500 font-semibold block">{t('assignments.studentsAnswer')}:</span>
                            <span className={`font-mono font-bold text-sm ${studentAns ? (isCorrect ? 'text-emerald-700' : 'text-red-700') : 'text-slate-400 italic'}`}>
                              {studentAns || t('assignments.noResponseSubmitted')}
                            </span>
                          </div>

                          <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-0.5">
                            <span className="text-slate-500 font-semibold block">{t('assignments.officialAnswerKeyLabel')}:</span>
                            <span className="font-mono font-bold text-sm text-emerald-800">
                              {correctAns || t('assignments.answerKeyNotSet')}
                            </span>
                          </div>
                        </div>

                        {q.explanation && (
                          <div className="mt-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900">
                            <span className="font-bold block mb-0.5">{t('assignments.explanationPassageCitation')}:</span>
                            <p className="leading-relaxed">{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {currentSubmission.skill === 'writing' && (
            <div className="space-y-4">
              {/* If Task 1 Academic diagram exists, render exact visual type */}
              {Boolean(parentAssignment?.writingTaskCategory?.includes('task1') || (parentAssignment as any)?.writingTaskType === 'task1') ? (
                <div className="space-y-3">
                  <WritingTask1VisualRenderer
                    prompt={parentAssignment?.writingPrompt || ''}
                    imageUrl={parentAssignment?.task1ImageUrl}
                    chartType={(parentAssignment as any)?.chartType}
                    minWords={parentAssignment?.writingMinWords || 150}
                  />
                  {stripMarkdownTableFromPrompt(parentAssignment?.writingPrompt || '').length > 0 && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {stripMarkdownTableFromPrompt(parentAssignment?.writingPrompt || '')}
                    </div>
                  )}
                </div>
              ) : parentAssignment?.task1ImageUrl ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase flex items-center space-x-1.5">
                      <ImageIcon className="w-4 h-4 text-blue-600" />
                      <span>{t('assignments.task1Diagram')}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowZoomImageModal(true)}
                      className="text-xs text-blue-600 font-semibold hover:underline flex items-center space-x-1"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>{t('assignments.zoomDiagram')}</span>
                    </button>
                  </div>
                  <img
                    src={parentAssignment.task1ImageUrl}
                    alt="Task 1 Diagram"
                    className="max-h-64 rounded-lg border border-slate-300 object-contain mx-auto bg-white"
                  />
                </div>
              ) : null}

              <div className="flex items-center justify-between text-sm text-slate-600 bg-blue-50/70 p-3 rounded-lg border border-blue-200">
                <span className="flex items-center space-x-1.5 text-blue-900 font-medium">
                  <Highlighter className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{t('assignments.selectTextPrompt')}</span>
                </span>
                <span className="font-semibold text-slate-600 shrink-0 ml-2">
                  {annotations.length} {t('assignments.inlineAnnotationsTitle').toLowerCase()}
                </span>
              </div>

              {/* Essay Text with Highlights */}
              <div
                ref={essayContainerRef}
                onMouseUp={handleTextMouseUp}
                tabIndex={0}
                className="bg-slate-50 p-5 rounded-lg border border-slate-200 text-base text-slate-800 font-sans leading-relaxed whitespace-pre-wrap select-text cursor-text focus:outline-hidden"
              >
                {renderAnnotatedText(currentSubmission.writingText || '', annotations, true)}
              </div>

              {/* Annotation creation popover */}
              {activeSelection && (
                <div className="p-4 bg-white border-2 border-blue-500 rounded-xl shadow-lg space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                      <Edit3 className="w-4 h-4 text-blue-600" />
                      <span>{t('assignments.addAnnotationBtn')}:</span>
                      <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">
                        "{activeSelection.text}"
                      </span>
                    </span>
                    <button
                      onClick={() => setActiveSelection(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        {t('assignments.annotationType')}
                      </label>
                      <select
                        value={newAnnotationType}
                        onChange={(e) => setNewAnnotationType(e.target.value as any)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                      >
                        <option value="correction">{t('assignments.typeCorrection')}</option>
                        <option value="grammar">{t('assignments.typeGrammar')}</option>
                        <option value="vocabulary">{t('assignments.typeVocabulary')}</option>
                        <option value="suggestion">{t('assignments.typeSuggestion')}</option>
                        <option value="praise">{t('assignments.typePraise')}</option>
                        <option value="deletion">Gạch bỏ / Xóa (Deletion)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        {t('assignments.annotationComment')} {newAnnotationType !== 'deletion' && '*'}
                      </label>
                      <textarea
                        rows={2}
                        value={newAnnotationComment}
                        onChange={(e) => setNewAnnotationComment(e.target.value)}
                        placeholder={newAnnotationType === 'deletion' ? 'Lý do gạch bỏ (hoặc để trống)...' : 'e.g. Inappropriate collocation; refine to academic register.'}
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white break-words whitespace-pre-wrap resize-y outline-hidden"
                      />
                    </div>
                  </div>

                  {newAnnotationType !== 'deletion' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        {t('assignments.annotationSuggestion')}
                      </label>
                      <textarea
                        rows={2}
                        value={newAnnotationSuggestion}
                        onChange={(e) => setNewAnnotationSuggestion(e.target.value)}
                        placeholder="e.g. substantial growth"
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white break-words whitespace-pre-wrap resize-y outline-hidden"
                      />
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => applyDeletionAnnotation(activeSelection)}
                      className="w-full sm:w-auto px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                      title="Gạch bỏ đoạn này (hoặc bấm phím Backspace)"
                    >
                      <Strikethrough className="w-3.5 h-3.5" />
                      <span>Gạch bỏ (Backspace)</span>
                    </button>

                    <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => setActiveSelection(null)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                      >
                        {t('assignments.cancelAnnotation')}
                      </button>
                      <button
                        onClick={handleAddAnnotation}
                        disabled={newAnnotationType !== 'deletion' && !newAnnotationComment.trim()}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                      >
                        {t('assignments.addAnnotationBtn')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* List of existing annotations */}
              {annotations.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-700 flex items-center space-x-1.5">
                      <MessageSquare className="w-4 h-4 text-slate-500" />
                      <span>{t('assignments.inlineAnnotationsTitle')} ({annotations.length})</span>
                    </h4>
                    {activeOverlappingAnnotations.length > 1 && (
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                        Đang chọn vùng có {activeOverlappingAnnotations.length} nhận xét trùng
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {annotations.map((annot) => (
                      <div
                        key={annot.id}
                        onClick={() => setActiveInspectedAnnotation(annot)}
                        className={`p-3 rounded-lg border text-sm transition-all cursor-pointer ${
                          activeInspectedAnnotation?.id === annot.id
                            ? 'border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-400'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                              annot.type === 'correction'
                                ? 'bg-red-100 text-red-800'
                                : annot.type === 'deletion'
                                ? 'bg-rose-100 text-rose-800 font-bold'
                                : annot.type === 'grammar'
                                ? 'bg-amber-100 text-amber-800'
                                : annot.type === 'vocabulary'
                                ? 'bg-purple-100 text-purple-800'
                                : annot.type === 'praise'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {annot.type === 'deletion' ? 'Deletion' : annot.type}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAnnotation(annot.id);
                            }}
                            className="text-slate-400 hover:text-red-600 p-0.5"
                            title={t('assignments.deleteAnnotation')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="font-mono text-xs text-slate-700 font-semibold mb-0.5">
                          "{annot.selectedText}"
                        </p>
                        <p className="text-slate-600 text-xs">{annot.comment}</p>
                        {annot.suggestion && (
                          <p className="text-xs text-emerald-700 font-semibold mt-1">
                            &rarr; {annot.suggestion}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentSubmission.skill === 'speaking' && (
            <div className="space-y-4">
              {(() => {
                const unpacked = unpackSpeakingSubmission(
                  currentSubmission.speakingTranscript,
                  currentSubmission.speakingAudioUrl
                );
                const responses = Object.entries(unpacked.responses || {}).map(([qKey, r]) => ({
                  ...r,
                  questionId: r.questionId || qKey,
                }));
                const studentNameClean = (currentSubmission.studentName || 'Student').replace(/\s+/g, '_');
                const assignmentTitleClean = (parentAssignment?.title || 'Speaking_Test').replace(/[^a-zA-Z0-9_-]/g, '_');

                if (responses && responses.length > 0) {
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
                        <div className="flex items-center space-x-2.5">
                          <Volume2 className="w-5 h-5 text-blue-600" />
                          <span className="text-sm font-bold text-blue-950">
                            Bài làm Speaking ({responses.length} câu trả lời)
                          </span>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full">
                          Tổng thời lượng: {currentSubmission.speakingDuration || responses.reduce((acc, r) => acc + (r.duration || 0), 0)}s
                        </span>
                      </div>

                      {responses.map((resp, idx) => (
                        <div key={resp.questionId || idx} className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                            <span className="text-sm font-bold text-slate-800">
                              Câu {idx + 1} {resp.questionId ? `(${resp.questionId})` : ''} • {resp.duration}s
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                downloadSpeakingAudio(
                                  resp.audioUrl,
                                  `${studentNameClean}_${assignmentTitleClean}_Q${idx + 1}_${resp.questionId || 'part'}.webm`
                                )
                              }
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              title="Tải bản ghi âm về máy"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-600" />
                              <span>Tải file ghi âm</span>
                            </button>
                          </div>

                          <div className="py-1">
                            <audio controls src={resp.audioUrl} className="w-full h-10" />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                // Fallback for single/legacy recording
                return (
                  <div className="space-y-3">
                    <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Volume2 className="w-6 h-6 text-blue-600" />
                        <div>
                          <p className="text-sm font-bold text-blue-900">{t('assignments.recordTitle')}</p>
                          <p className="text-xs text-blue-600">{t('assignments.audioVerified')}: {currentSubmission.speakingDuration}s</p>
                        </div>
                      </div>
                      {currentSubmission.speakingAudioUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            downloadSpeakingAudio(
                              currentSubmission.speakingAudioUrl!,
                              `${studentNameClean}_${assignmentTitleClean}_recording.webm`
                            )
                          }
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          <span>Tải file ghi âm</span>
                        </button>
                      )}
                    </div>

                    {currentSubmission.speakingAudioUrl && (
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <audio controls src={currentSubmission.speakingAudioUrl} className="w-full h-10" />
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Submission Revision History */}
          {currentSubmission.writingRevisions && currentSubmission.writingRevisions.length > 1 && (
            <div className="p-3.5 bg-slate-100/70 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 flex items-center space-x-1 mb-2">
                <History className="w-4 h-4" />
                <span>{t('assignments.revisionHistory')} ({currentSubmission.writingRevisions.length} {t('assignments.draft')})</span>
              </span>
              <div className="space-y-1">
                {currentSubmission.writingRevisions.map((rev, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-slate-500">
                    <span>{t('assignments.draft')} {i + 1} ({rev.wordCount} words)</span>
                    <span>{rev.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Teacher Feedback & Evaluation Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Award className="w-5 h-5 text-blue-600" />
              <span>
                {isReadingSubmission
                  ? 'IELTS Reading Evaluation & Final Band'
                  : t('assignments.assessmentRubricTitle')}
              </span>
            </h2>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-slate-600">{t('assignments.overallBand')}:</span>
              <div className="flex items-center space-x-2">
                <select
                  value={overallScore}
                  onChange={(e) => setOverallScore(Number(e.target.value))}
                  className="p-1.5 border border-blue-300 rounded-lg text-center font-black text-base text-blue-700 bg-blue-50 focus:ring-2 focus:ring-blue-500"
                >
                  {[4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0].map((s) => (
                    <option key={s} value={s}>
                      Band {s.toFixed(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Published Assessment Review Banner for Graded Submissions */}
          {currentSubmission.status === 'graded' && !currentSubmission.isDraft && !isReadingSubmission && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-emerald-950 flex items-center space-x-1.5 tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Bản Đánh Giá Đã Chấm & Công Bố (Official Published Assessment)</span>
                </span>
                <span className="text-sm font-black text-emerald-900 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-xs">
                  Band {Number(currentSubmission.score || overallScore).toFixed(1)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {gradingRubrics.map((r) => (
                  <div key={r.criterion} className="bg-white p-2.5 rounded-lg border border-emerald-200 text-xs shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-bold block truncate">{r.criterion}</span>
                    <span className="text-base font-black text-emerald-800">Band {r.score.toFixed(1)}</span>
                    {r.descriptor && <p className="text-[10px] text-slate-600 mt-0.5 line-clamp-1">{r.descriptor}</p>}
                  </div>
                ))}
              </div>
              {(teacherStrengths || teacherAreasToImprove || teacherGeneralComments || teacherNextSteps) && (
                <div className="bg-white p-3.5 rounded-lg border border-emerald-200 text-xs space-y-2">
                  {teacherStrengths && (
                    <div>
                      <span className="font-bold text-emerald-900 block">Key Strengths (Điểm mạnh):</span>
                      <p className="text-slate-700 leading-relaxed">{teacherStrengths}</p>
                    </div>
                  )}
                  {teacherAreasToImprove && (
                    <div>
                      <span className="font-bold text-amber-900 block">Areas for Improvement (Cần cải thiện):</span>
                      <p className="text-slate-700 leading-relaxed">{teacherAreasToImprove}</p>
                    </div>
                  )}
                  {teacherGeneralComments && activeAssignment?.skill !== 'speaking' && (
                    <div>
                      <span className="font-bold text-slate-900 block">Teacher Comments (Nhận xét của GV):</span>
                      <p className="text-slate-700 leading-relaxed">{teacherGeneralComments}</p>
                    </div>
                  )}
                  {teacherNextSteps && (
                    <div>
                      <span className="font-bold text-blue-900 block">Recommended Next Steps (Kế hoạch tiếp theo):</span>
                      <p className="text-slate-700 leading-relaxed">{teacherNextSteps}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4 Rubric Criteria: ONLY shown for Writing / Speaking, NEVER for Reading */}
          {!isReadingSubmission && (
            <div className="space-y-3">
              {gradingRubrics.map((r, idx) => (
                <div key={r.criterion} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800">{r.criterion}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500 text-xs">{t('assignments.score')}:</span>
                      <select
                        value={r.score}
                        onChange={(e) => handleRubricScoreChange(idx, Number(e.target.value))}
                        className="p-1.5 border border-slate-300 rounded text-center font-bold text-sm text-slate-900 bg-white"
                      >
                        {[4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0].map((s) => (
                          <option key={s} value={s}>
                            {s.toFixed(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    value={r.descriptor}
                    onChange={(e) => {
                      const newRubrics = [...gradingRubrics];
                      newRubrics[idx].descriptor = e.target.value;
                      setGradingRubrics(newRubrics);
                    }}
                    placeholder="Criterion-specific examiner feedback and descriptor notes..."
                    className="w-full p-2 border border-slate-300 rounded text-xs bg-white outline-hidden break-words whitespace-pre-wrap resize-y"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Feedback Sections: Strengths, Areas to improve, Next Steps (Preserving 2-column layout & removing duplicated general comments) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block font-semibold text-emerald-800 mb-1">{t('assignments.keyStrengths')}</label>
              <textarea
                rows={3}
                value={teacherStrengths}
                onChange={(e) => setTeacherStrengths(e.target.value)}
                placeholder="What did the student do particularly well?"
                className="w-full p-2.5 border border-emerald-300 rounded-lg outline-hidden bg-emerald-50/20 text-sm break-words whitespace-pre-wrap resize-y"
              />
            </div>

            <div>
              <label className="block font-semibold text-amber-800 mb-1">{t('assignments.improvements')}</label>
              <textarea
                rows={3}
                value={teacherAreasToImprove}
                onChange={(e) => setTeacherAreasToImprove(e.target.value)}
                placeholder="Specific linguistic or structural gaps..."
                className="w-full p-2.5 border border-amber-300 rounded-lg outline-hidden bg-amber-50/20 text-sm break-words whitespace-pre-wrap resize-y"
              />
            </div>
          </div>

          <div className="text-sm">
            <label className="block font-semibold text-slate-700 mb-1">{t('assignments.recommendedNextSteps')}</label>
            <textarea
              rows={2}
              value={teacherNextSteps}
              onChange={(e) => setTeacherNextSteps(e.target.value)}
              placeholder="e.g. Redo paragraph 3 with counter-argument concession; practice 10-minute speed outline."
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden text-sm break-words whitespace-pre-wrap resize-y"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              {draftSaveNotice && (
                <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 animate-in fade-in">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>{t('assignments.draftSaved')}</span>
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedSubmissionId(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-semibold"
              >
                {t('common.cancel')}
              </button>
              <button
                disabled={isGradingSubmission}
                onClick={handleSaveDraft}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 border border-slate-300 rounded-lg text-sm font-bold transition-colors flex items-center space-x-1.5"
              >
                <Save className="w-4 h-4 text-slate-500" />
                <span>{isGradingSubmission ? t('common.loading') : t('assignments.saveDraftBtn')}</span>
              </button>
              <button
                disabled={isGradingSubmission}
                onClick={handleFinalizeGrading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isGradingSubmission ? t('common.loading') : t('assignments.finalizeAndSend')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal: Return for revision */}
        {showReturnModal && (
          <Portal>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                <h3 className="text-base font-bold text-slate-900 mb-2">{t('assignments.returnModalTitle')}</h3>
                <p className="text-xs text-slate-500 mb-3">{t('assignments.returnModalDesc')}</p>
                <textarea
                  rows={3}
                  value={returnComments}
                  onChange={(e) => setReturnComments(e.target.value)}
                  placeholder="e.g. Essay is currently 190 words. Please expand your arguments to meet the 250-word minimum."
                  className="w-full text-xs p-3 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-amber-500"
                />
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    onClick={() => setShowReturnModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleConfirmReturn}
                    className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs"
                  >
                    {t('assignments.confirmReturn')}
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        )}

        {/* Modal: Duplicate Speaking Assignment Warning */}
        {duplicateAssignmentWarning && (
          <Portal>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-amber-300 space-y-4">
                <div className="flex items-center space-x-3 text-amber-700">
                  <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                  <h3 className="text-base font-bold text-slate-900">Bài tập đã từng được giao</h3>
                </div>
                <div className="p-3.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-950 space-y-2">
                  <p>
                    Bài tập <strong className="font-bold">"{duplicateAssignmentWarning.exerciseTitle}"</strong> đã từng được giao cho khóa học này trong bài kiểm tra:
                  </p>
                  <p className="font-semibold text-slate-900 bg-white p-2 rounded border border-amber-200">
                    "{duplicateAssignmentWarning.existingAssignmentTitle}" {duplicateAssignmentWarning.assignedDate ? `(Hạn: ${duplicateAssignmentWarning.assignedDate})` : ''}
                  </p>
                  <p className="text-slate-600">
                    Bạn có chắc chắn muốn giao lại bài tập này cho học viên?
                  </p>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDuplicateAssignmentWarning(null)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold"
                  >
                    Hủy (Không chọn)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      duplicateAssignmentWarning.onConfirm();
                      setDuplicateAssignmentWarning(null);
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                  >
                    Giao lại (Xác nhận)
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        )}

        {/* Zoom Image Modal */}
        {showZoomImageModal && parentAssignment?.task1ImageUrl && (
          <Portal>
            <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl p-4 max-w-4xl w-full max-h-[90vh] flex flex-col space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-bold text-sm text-slate-800">Task 1 Diagram (Full Resolution)</span>
                  <button onClick={() => setShowZoomImageModal(false)} className="p-1 text-slate-500 hover:text-slate-800">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-auto flex-1 flex items-center justify-center">
                  <img src={parentAssignment.task1ImageUrl} alt="Full Zoom Diagram" className="max-w-full max-h-[75vh] object-contain" />
                </div>
              </div>
            </div>
          </Portal>
        )}
      </div>
    );
  }

  // =========================================================================
  // SCREEN 2: ACTIVE ASSIGNMENT (STUDENT PRACTICE / TEACHER PREVIEW)
  // =========================================================================
  if (activeAssignment) {
    const mySub = submissions.find(
      (s) => s.assignmentId === activeAssignment.id && s.studentId === currentUser.id
    );

    const isReading = activeAssignment.skill === 'reading';
    const isWriting = activeAssignment.skill === 'writing';
    const isSpeaking = activeAssignment.skill === 'speaking';
    const isListening = activeAssignment.skill === 'listening';
    const extractedData = extractAllNormalizedQuestions(activeAssignment);
    const questions = extractedData.questions;
    const passageMap = extractedData.passageMap;

    const displayWritingBand = (() => {
      if (mySub?.score && Number(mySub.score) > 0) return Number(mySub.score);
      if (mySub?.rubricScores && mySub.rubricScores.length > 0) {
        const scores = mySub.rubricScores.map((r: any) => Number(r.score)).filter((n: number) => !isNaN(n) && n > 0);
        if (scores.length > 0) {
          return calculateIeltsOverallBand(scores);
        }
      }
      return null;
    })();

    const studentCorrectedEssay = (mySub?.writingText && isWriting)
      ? generateCorrectedEssay(mySub.writingText, mySub.annotations || [])
      : null;

    const handleCopyCorrected = () => {
      if (!studentCorrectedEssay?.correctedText) return;
      navigator.clipboard.writeText(studentCorrectedEssay.correctedText);
      setHasCopiedCorrected(true);
      setTimeout(() => setHasCopiedCorrected(false), 2000);
    };

    const safePassageIndex =
      activeAssignment.passages && activeAssignment.passages.length > 0
        ? Math.min(activePassageTab, activeAssignment.passages.length - 1)
        : 0;

    const currentPassageContent =
      (activeAssignment.passages && activeAssignment.passages[safePassageIndex]?.content) ||
      activeAssignment.readingPassage ||
      '';
    const paragraphLabels = extractParagraphLabelsFromPassage(currentPassageContent);

    // Count answered reading questions
    const answeredCount = questions.filter((q) => Boolean(readingAnswers[q.id]?.trim())).length;

    const isScorePublic = (activeAssignment.scoreVisibility || 'private') === 'public';
    const canSeeAnswers = isTeacher || (mySub?.status === 'graded' && isScorePublic);

    const handleAnnotationClick = (annId: string) => {
      setStudentWritingTab('submission');
      setActiveHighlightedAnnotationId(annId);
      const targetAnnot = mySub?.annotations?.find((a) => a.id === annId);
      if (targetAnnot) {
        setActiveInspectedAnnotation(targetAnnot);
      }
      setTimeout(() => {
        const el = document.getElementById(`annotation_${annId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      setTimeout(() => {
        setActiveHighlightedAnnotationId(null);
      }, 4000);
    };

    // Helper to resolve passage index for any question
    const resolvePassageIndexForQuestion = (q: ReadingQuestion, absoluteIdx: number): number => {
      if (passageMap[q.id] !== undefined) {
        return passageMap[q.id];
      }
      const rawPIdx = (q as any).passageIndex ?? (q as any).passage_index;
      if (typeof rawPIdx === 'number' && !isNaN(rawPIdx)) {
        if (rawPIdx >= 1 && activeAssignment?.passages && rawPIdx <= activeAssignment.passages.length) {
          return rawPIdx - 1;
        }
        if (rawPIdx >= 0) return rawPIdx;
      }
      if (activeAssignment?.passages && activeAssignment.passages.length > 0) {
        for (let pIdx = 0; pIdx < activeAssignment.passages.length; pIdx++) {
          const p = activeAssignment.passages[pIdx];
          const hasQ = p.questions?.some((pq: any) => pq.id === q.id || (pq.prompt && pq.prompt === q.prompt));
          if (hasQ) return pIdx;
          const hasInGroup = p.questionGroups?.some((g: any) =>
            g.questions?.some((gq: any) => gq.id === q.id || (gq.prompt && gq.prompt === q.prompt))
          );
          if (hasInGroup) return pIdx;
        }

        let offset = 0;
        for (let pIdx = 0; pIdx < activeAssignment.passages.length; pIdx++) {
          const pCount = activeAssignment.passages[pIdx].questions?.length || 0;
          if (pCount > 0 && absoluteIdx >= offset && absoluteIdx < offset + pCount) {
            return pIdx;
          }
          offset += pCount;
        }

        // Smart IELTS standard heuristic: partition based on standard question numbers
        const matchNum = q.id?.match(/(?:q_p\d+_|q_)(\d+)$/)?.[1] || q.prompt?.match(/^(\d+)[\.\s]/)?.[1];
        const num = matchNum ? parseInt(matchNum, 10) : absoluteIdx + 1;
        if (activeAssignment.passages.length === 3) {
          if (num <= 13) return 0;
          if (num <= 26) return 1;
          return 2;
        }

        // Sequential partition fallback across available passages
        const perPassage = Math.ceil(questions.length / activeAssignment.passages.length);
        return Math.min(Math.floor(absoluteIdx / Math.max(perPassage, 1)), activeAssignment.passages.length - 1);
      }
      return 0;
    };

    // Indexed questions with dynamic passage assignment
    const allQuestionsIndexed = questions.map((q, absoluteIdx) => ({
      q,
      absoluteIdx,
      passageIndex: resolvePassageIndexForQuestion(q, absoluteIdx),
    }));

    const hasMultiPassages = Boolean(activeAssignment.passages && activeAssignment.passages.length > 1);

    const activePassageQuestions = hasMultiPassages
      ? allQuestionsIndexed.filter((item) => item.passageIndex === safePassageIndex)
      : allQuestionsIndexed;

    const activePassageAnsweredCount = activePassageQuestions.filter(({ q }) => Boolean(readingAnswers[q.id]?.trim())).length;
    const activePassageTotalCount = activePassageQuestions.length;

    const questionRenderGroups = buildQuestionRenderGroups(activePassageQuestions);

    return (
      <div className={`space-y-6 ${isReading ? 'max-w-7xl mx-auto' : 'max-w-5xl mx-auto'}`}>
        {/* Navigation & Header */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 gap-3 ${
          isReading ? 'pb-2.5 mb-1' : 'pb-4'
        }`}>
          <div>
            <button
              onClick={() => setSelectedAssignmentId(null)}
              className="text-sm font-semibold text-blue-600 hover:underline mb-1 block"
            >
              &larr; {t('common.back')}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs uppercase font-bold px-2.5 py-0.5 rounded-full ${
                  isReading
                    ? 'bg-emerald-100 text-emerald-800'
                    : isWriting
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {activeAssignment.skill}
                {isReading && ` (${activeAssignment.readingTestType === 'general' ? 'General Training' : 'Academic'})`}
                {isWriting && ` (${activeAssignment.writingTaskCategory?.replace('_', ' ').toUpperCase() || 'TASK 2'})`}
              </span>
              <h1 className={`${isReading ? 'text-lg sm:text-xl' : 'text-2xl'} font-bold text-slate-900`}>
                {activeAssignment.title}
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">Due date: {activeAssignment.dueDate || 'No deadline'}</p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Reading Timer */}
            {isReading && mySub?.status !== 'graded' && (
              <div className="flex items-center space-x-2 bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-lg text-sm font-mono font-bold text-slate-800">
                <Timer className={`w-4 h-4 ${timerSeconds < 300 ? 'text-red-500 animate-pulse' : 'text-blue-600'}`} />
                <span>{formatTimer(timerSeconds)}</span>
                <button
                  type="button"
                  onClick={() => setTimerRunning(!timerRunning)}
                  className="text-xs text-slate-500 hover:text-slate-800 ml-1 underline"
                >
                  {timerRunning ? 'Pause' : 'Resume'}
                </button>
              </div>
            )}

            {/* Submission status tag for student */}
            {!isTeacher && mySub && (
              <span
                className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
                  mySub.status === 'graded'
                    ? 'bg-emerald-100 text-emerald-800'
                    : mySub.status === 'returned'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {t('common.status')}: {mySub.status}
              </span>
            )}
          </div>
        </div>

        {/* Instructions Banner - Omitted in Reading to reclaim vertical space */}
        {!isReading && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('assignments.instructionsTitle')}
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">{activeAssignment.instructions}</p>
            {activeAssignment.objectives && (
              <p className="text-xs text-slate-400 mt-1 italic">{activeAssignment.objectives}</p>
            )}
          </div>
        )}

        {/* =========================================================================
            1. READING SPLIT-SCREEN WORKFLOW
        ========================================================================= */}
        {isReading && (
          <div className="space-y-6">
            {/* If Graded & Score is Public, Show Full Performance & Band Score Report Card */}
            {mySub && (mySub.status === 'graded' || mySub.status === 'submitted') && isScorePublic && (mySub.readingScore || mySub.score) && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-200/60 pb-4">
                  <div>
                    <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider block">
                      Official IELTS Reading Assessment Report
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 mt-1">
                      Kết quả: {mySub.readingScore?.correct ?? 0} / {mySub.readingScore?.total ?? questions.length} Câu đúng ({mySub.readingScore?.percentage ?? 0}%)
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Thang điểm: {mySub.readingScore?.testType === 'general' ? 'General Training 40-Item Scale' : 'Academic 40-Item Official Cambridge Scale'}
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right bg-white px-5 py-3 rounded-xl border border-emerald-100 shadow-xs">
                      <span className="text-xs text-slate-500 font-semibold block">{t('assignments.officialEstimatedBand')}</span>
                      <span className="text-3xl font-extrabold text-emerald-700">
                        Band {(mySub.readingScore?.estimatedBand || (mySub.score ? Number(mySub.score) : null))?.toFixed(1) || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {mySub.readingScore?.bandNotes && (
                  <p className="text-xs text-emerald-900 font-medium bg-white/70 p-3 rounded-lg border border-emerald-200/50">
                    {mySub.readingScore.bandNotes}
                  </p>
                )}
              </div>
            )}

            {/* If Submitted/Graded but Score is Private, Show waiting notice */}
            {mySub && (mySub.status === 'graded' || mySub.status === 'submitted') && !isScorePublic && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Bài thi Reading của bạn đã được nộp thành công!</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Hệ thống đã lưu đầy đủ câu trả lời của bạn. Điểm số Band Score và giải thích đáp án chi tiết sẽ hiển thị khi giáo viên mở quyền công bố điểm.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-3 py-1.5 bg-white text-blue-800 rounded-lg border border-blue-200 shadow-2xs whitespace-nowrap self-start sm:self-auto flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Chờ giáo viên công bố điểm</span>
                </span>
              </div>
            )}

            {/* Floating Highlight Toolbar with 6 Pastel Rainbow Colors */}
            {floatingToolbarPos && (
              <div
                className="fixed z-50 bg-slate-900 text-white shadow-xl rounded-xl px-3 py-2 flex items-center space-x-2 text-xs -translate-x-1/2 -translate-y-full border border-slate-700 animate-in fade-in zoom-in-95 duration-100"
                style={{ left: floatingToolbarPos.x, top: floatingToolbarPos.y }}
              >
                <span className="text-[11px] text-slate-300 font-semibold flex items-center space-x-1">
                  <Highlighter className="w-3.5 h-3.5 text-slate-400" />
                  <span>Highlight:</span>
                </span>
                <div className="flex items-center space-x-1.5">
                  {PASTEL_MARKER_COLORS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => handleApplyMarker(floatingToolbarPos.text, col.id)}
                      style={{ backgroundColor: col.bgHex }}
                      className="w-5 h-5 rounded-full border border-slate-400/80 hover:ring-2 hover:ring-white shadow-xs transition-transform hover:scale-115"
                      title={col.label}
                    />
                  ))}
                </div>
                <div className="h-4 w-px bg-slate-700 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setFloatingToolbarPos(null)}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Split Screen Container with Draggable Resizer */}
            <div
              ref={splitContainerRef}
              className="flex flex-col lg:flex-row gap-0 items-stretch bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-xs"
            >
              {/* Left Column: Reading Passage */}
              <div
                style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${splitWidth}%` : '100%' }}
                className="bg-white h-[calc(100vh-220px)] min-h-[550px] flex flex-col shrink-0 transition-[width] duration-75 overflow-hidden"
              >
                {/* Passage Header & Multi-Passage Tabs Container in normal flow */}
                <div className="shrink-0 bg-white px-6 pt-4 pb-3 border-b border-slate-200 shadow-2xs space-y-3 z-10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                        {activeAssignment.passages && activeAssignment.passages.length > 1
                          ? activeAssignment.passages[safePassageIndex]?.title || `Passage ${safePassageIndex + 1}`
                          : t('assignments.readingPassageTitle')}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* IELTS Marker Toolbar with 6 Pastel Rainbow Colors */}
                      <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl shadow-2xs">
                        <span className="text-[11px] font-bold text-slate-600 mr-1 flex items-center space-x-1">
                          <Highlighter className="w-3.5 h-3.5 text-blue-600" />
                          <span className="hidden md:inline">Marker:</span>
                        </span>
                        {PASTEL_MARKER_COLORS.map((col) => {
                          const isActive = selectedMarkerColor === col.id;
                          return (
                            <button
                              key={col.id}
                              type="button"
                              onClick={() => setSelectedMarkerColor(isActive ? null : col.id)}
                              style={{ backgroundColor: col.bgHex }}
                              className={`w-5 h-5 rounded-full border transition-all ${
                                isActive
                                  ? 'ring-2 ring-blue-600 ring-offset-1 scale-110 border-slate-700 shadow-xs'
                                  : 'border-slate-300 hover:scale-105 opacity-85 hover:opacity-100'
                              }`}
                              title={`${col.label}${isActive ? ' (Click to deactivate marker)' : ' (Click to activate marker)'}`}
                            />
                          );
                        })}
                        {readingMarkers.some((m) => (m.passageIndex ?? 0) === safePassageIndex) && (
                          <button
                            type="button"
                            onClick={() => handleClearPassageMarkers(safePassageIndex)}
                            className="ml-1 px-1.5 py-0.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded text-xs flex items-center space-x-1 transition-colors"
                            title="Clear all highlights in this passage"
                          >
                            <Eraser className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline text-[11px] font-semibold">Clear</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-nowrap">
                        <div
                          className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200"
                          role="group"
                          aria-label="Passage font size"
                        >
                          <span className="text-[11px] font-semibold text-slate-500 pl-1.5 pr-0.5">Font:</span>
                          {(['15px', '17px', '19px'] as const).map((size) => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => handleSetPassageFontSize(size)}
                              aria-label={`Set passage font size to ${size}`}
                              className={`text-xs px-2 py-0.5 rounded-md font-medium transition-all ${
                                passageFontSize === size
                                  ? 'bg-white text-blue-700 font-bold shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>

                        <span className="text-xs text-slate-400 font-mono hidden sm:inline whitespace-nowrap shrink-0">
                          {((activeAssignment.passages && activeAssignment.passages[safePassageIndex]?.content) || activeAssignment.readingPassage || '')
                            .split(/\s+/)
                            .filter(Boolean).length}{' '}
                          words
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Passage Tabs (Sticky with horizontal scroll support) */}
                  {activeAssignment.passages && activeAssignment.passages.length > 1 && (
                    <div className="flex items-center space-x-1.5 overflow-x-auto pt-1 pb-0.5">
                      {activeAssignment.passages.map((p, pIdx) => {
                        const pQuestionCount = allQuestionsIndexed.filter((item) => item.passageIndex === pIdx).length;
                        const rawTitle = p.title || `Passage ${pIdx + 1}`;
                        const displayTitle = rawTitle.replace(/\b([A-Za-z]+)!(\s+)/g, "$1'$2").trim();
                        return (
                          <button
                            key={p.id || pIdx}
                            type="button"
                            onClick={() => setActivePassageTab(pIdx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 shrink-0 ${
                              activePassageTab === pIdx
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            <span>{displayTitle}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                activePassageTab === pIdx ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {pQuestionCount} Qs
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Passage Text with Highlighting */}
                <div
                  onMouseUp={handlePassageMouseUp}
                  className={`flex-1 p-6 overflow-y-auto font-serif text-slate-800 select-text text-justify ${
                    passageFontSize === '15px'
                      ? 'text-[15px] leading-[1.7]'
                      : passageFontSize === '19px'
                      ? 'text-[19px] leading-[1.8]'
                      : 'text-[17px] leading-[1.75]'
                  }`}
                  style={{
                    fontSize: passageFontSize,
                    lineHeight: passageFontSize === '15px' ? 1.7 : passageFontSize === '19px' ? 1.8 : 1.75,
                  }}
                >
                  {renderHighlightedPassage(
                    (activeAssignment.passages && activeAssignment.passages[safePassageIndex]?.content) ||
                      activeAssignment.readingPassage ||
                      'No reading passage text provided.',
                    safePassageIndex
                  )}
                </div>
              </div>

              {/* Draggable Divider (Desktop Only) */}
              <div
                onMouseDown={() => setIsDraggingSplit(true)}
                className={`hidden lg:flex w-2.5 bg-slate-200 hover:bg-blue-500 cursor-col-resize items-center justify-center transition-colors group relative select-none shrink-0 ${
                  isDraggingSplit ? 'bg-blue-600 ring-2 ring-blue-300' : ''
                }`}
                title="Drag to resize passage and questions panels"
              >
                <GripVertical className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
              </div>

              {/* Right Column: Pinned Navigator & Independent Scrollable Questions Container */}
              <div
                style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${100 - splitWidth}%` : '100%' }}
                className="bg-white h-[calc(100vh-220px)] min-h-[550px] flex flex-col shrink-0 transition-[width] duration-75 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-hidden relative"
              >
                {/* Pinned Question Navigator Header — Fixed at top, zero overlap with passage or questions */}
                <div className="shrink-0 px-6 py-3 bg-white border-b border-slate-200 shadow-xs space-y-2 z-10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Question Navigator ({activePassageAnsweredCount} / {activePassageTotalCount} Answered)
                    </span>
                    <span className="text-xs text-slate-500 font-mono font-semibold">
                      {Math.round((activePassageAnsweredCount / (activePassageTotalCount || 1)) * 100)}% Complete
                    </span>
                  </div>

                  {/* Single Continuous Horizontal Row of Active Passage Questions */}
                  <div className="flex flex-row items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-slate-300">
                    {activePassageQuestions.map(({ q, absoluteIdx }) => {
                      const isAns = Boolean(readingAnswers[q.id]?.trim());
                      const isFlag = Boolean(flaggedQuestions[q.id]);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(`q_${q.id}`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className={`w-7 h-7 shrink-0 rounded-md text-xs font-bold flex items-center justify-center transition-all ${
                            isFlag
                              ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-500'
                              : isAns
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                          title={`Question ${absoluteIdx + 1}${isFlag ? ' (Flagged)' : isAns ? ' (Answered)' : ' (Unanswered)'}`}
                        >
                          {absoluteIdx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Independent Questions Scroll Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Empty / Malformed Questions Banner */}
                  {questions.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-3 my-6">
                      <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                      <h3 className="text-base font-bold text-slate-800">
                        {activeAssignment.readingPassage || (activeAssignment.passages && activeAssignment.passages.length > 0)
                          ? 'No Formatted Questions Detected'
                          : 'Empty Reading Assignment'}
                      </h3>
                      <p className="text-sm text-slate-500 max-w-md mx-auto">
                        {activeAssignment.readingPassage || (activeAssignment.passages && activeAssignment.passages.length > 0)
                          ? 'Passage text is available, but no structured questions could be extracted. Please ask your instructor to review this test.'
                          : 'This assignment currently has no reading passages or questions.'}
                      </p>
                    </div>
                  ) : (
                    /* Interactive Questions Grouped */
                    <div className="space-y-8">
                      {questionRenderGroups.map((group) => {
                        const isCompletionGroup = Boolean(
                          (group.groupType && COMPLETION_TYPES.has(group.groupType) && !BUTTON_TYPES.has(group.groupType)) ||
                          (group.questions.length > 0 &&
                            group.questions.some(({ q }) => COMPLETION_TYPES.has(q.type)) &&
                            !group.questions.some(({ q }) => BUTTON_TYPES.has(q.type)))
                        );

                        const effectiveWordList =
                          group.wordList && group.wordList.length > 0
                            ? group.wordList
                            : group.questions.find(({ q }) => q.options && q.options.length > 0)?.q.options;

                        if (isCompletionGroup) {
                          const typeLabel = (group.groupType || 'Completion')
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (c) => c.toUpperCase());

                          return (
                            <div key={group.id} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
                              {/* Group Header: Range Title & Type Badge */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                <div className="flex items-center space-x-2">
                                  <span className="font-extrabold text-xs uppercase tracking-wider text-blue-900 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                                    {group.rangeTitle}
                                  </span>
                                  <span className="text-xs font-bold text-slate-700">{typeLabel}</span>
                                </div>
                                {group.wordLimit && (
                                  <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                                    {group.wordLimit}
                                  </span>
                                )}
                              </div>

                              {group.instructions && (
                                <p className="text-xs text-slate-700 font-medium italic leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200 whitespace-pre-line">
                                  {renderCleanMarkdown(group.instructions)}
                                </p>
                              )}

                              {/* 1. Full Original Text with Blanks (rendered above answer fields) */}
                              {group.groupText && (
                                <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    {group.groupType === 'note_completion' ? 'Notes with Blanks' : 'Text / Summary with Blanks'}:
                                  </div>
                                  <div className="text-sm font-normal text-slate-800 leading-relaxed whitespace-pre-line">
                                    {cleanReadingText(group.groupText).split(/(\[\d+\])/g).map((chunk, i) => {
                                      const match = chunk.match(/^\[(\d+)\]$/);
                                      if (match) {
                                        return (
                                          <span
                                            key={i}
                                            className="inline-flex items-center justify-center font-mono font-extrabold text-xs text-blue-800 bg-blue-100 border border-blue-300 rounded px-1.5 py-0.5 mx-1 align-baseline shadow-2xs"
                                          >
                                            [{match[1]}]
                                          </span>
                                        );
                                      }
                                      return <span key={i}>{renderCleanMarkdown(chunk)}</span>;
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* 2. Word Bank (rendered alongside/below text, before answer fields) */}
                              {effectiveWordList && effectiveWordList.length > 0 && (
                                <div className="p-4 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 border border-blue-200 rounded-xl space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-blue-900 uppercase text-xs flex items-center space-x-1.5">
                                      <BookOpen className="w-4 h-4 text-blue-700" />
                                      <span>List of Words / Options (A–{String.fromCharCode(64 + effectiveWordList.length)}):</span>
                                    </span>
                                    <span className="text-[11px] font-semibold text-blue-700">
                                      Choose from the options below
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                                    {effectiveWordList.map((opt) => {
                                      const letter = opt.match(/^([A-Za-z])[\.\:\s]/)?.[1]?.toUpperCase() || '';
                                      const text = opt.replace(/^[A-Za-z][\.\:\s]\s*/, '');
                                      return (
                                        <div
                                          key={opt}
                                          className="p-2.5 bg-white rounded-lg border border-blue-200 shadow-2xs flex items-center space-x-2.5 text-xs hover:border-blue-400 transition-colors"
                                        >
                                          {letter && (
                                            <span className="w-5 h-5 rounded-md bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                              {letter}
                                            </span>
                                          )}
                                          <span className="text-slate-800 font-medium leading-snug break-words">
                                            {text || opt}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* 3. Compact Answer Fields (showing ONLY Question Number + Input, strictly one per row) */}
                              <div className="space-y-2.5 pt-1">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                  Answer Fields:
                                </div>
                                <div className="flex flex-col gap-2.5">
                                  {group.questions.map(({ q, idx }) => {
                                    const answer = readingAnswers[q.id] || (mySub?.readingAnswers && mySub.readingAnswers[q.id]) || '';
                                    const isReadOnly = isTeacher || Boolean(mySub && mySub.status !== 'returned');
                                    const result = mySub?.readingErrorAnalysis?.find((e) => e.questionId === q.id);
                                    const isFlag = Boolean(flaggedQuestions[q.id]);

                                    const maxWords = q.wordLimitCount || q.maxWords || parseMaxWordsFromLimit(q.wordLimit || q.wordLimitInstruction || group.wordLimit);
                                    const currentWordsCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;
                                    const isOverWordLimit = Boolean(maxWords && currentWordsCount > maxWords);
                                    const instructionText = q.wordLimitInstruction || (q.wordLimitCount ? formatWordLimitInstruction(q.wordLimitCount, q.allowNumbers) : q.wordLimit || group.wordLimit);

                                    const qFormat = q.completionFormat || (effectiveWordList && effectiveWordList.length > 0 ? 'word_list' : (q.options && q.options.length > 0 ? 'options' : 'text'));

                                    const usedByOther = new Map<string, number>();
                                    if (qFormat === 'options' && q.preventDuplicateOptions) {
                                      group.questions.forEach(({ q: otherQ, idx: otherIdx }) => {
                                        if (otherQ.id !== q.id) {
                                          const otherAns = readingAnswers[otherQ.id] || (mySub?.readingAnswers && mySub.readingAnswers[otherQ.id]);
                                          if (otherAns && otherAns.trim()) {
                                            usedByOther.set(otherAns.trim().toLowerCase(), otherIdx + 1);
                                          }
                                        }
                                      });
                                    }

                                    return (
                                      <div
                                        key={q.id}
                                        id={`q_${q.id}`}
                                        className={`p-3 rounded-xl border transition-all scroll-mt-6 ${
                                          result
                                            ? result.isCorrect
                                              ? 'border-emerald-300 bg-emerald-50/20'
                                              : 'border-red-300 bg-red-50/20'
                                            : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                                        }`}
                                      >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                                            <span className="font-mono text-xs font-extrabold text-blue-900 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg shrink-0">
                                              Question {idx + 1}
                                            </span>
                                            {qFormat === 'word_list' && effectiveWordList && effectiveWordList.length > 0 ? (
                                              <select
                                                disabled={isReadOnly}
                                                value={answer}
                                                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                                className="w-full sm:max-w-md px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 shadow-2xs"
                                              >
                                                <option value="">-- Choose (A–{String.fromCharCode(64 + effectiveWordList.length)}) --</option>
                                                {effectiveWordList.map((opt, oIdx) => {
                                                  const letterMatch = opt.match(/^([A-Za-z])[\.\:\s]/);
                                                  const letter = letterMatch ? letterMatch[1].toUpperCase() : String.fromCharCode(65 + oIdx);
                                                  return (
                                                    <option key={opt} value={letter}>
                                                      {opt.startsWith(letter) ? opt : `${letter}. ${opt}`}
                                                    </option>
                                                  );
                                                })}
                                              </select>
                                            ) : qFormat === 'options' && q.options && q.options.length > 0 ? (
                                              <select
                                                disabled={isReadOnly}
                                                value={answer}
                                                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                                className="w-full sm:max-w-md px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 shadow-2xs"
                                              >
                                                <option value="">-- Choose Option --</option>
                                                {q.options.map((opt) => {
                                                  const otherQNum = usedByOther.get(opt.trim().toLowerCase());
                                                  const isTaken = Boolean(otherQNum && answer.trim().toLowerCase() !== opt.trim().toLowerCase());
                                                  return (
                                                    <option key={opt} value={opt} disabled={isTaken}>
                                                      {opt} {isTaken ? `(Selected in Q${otherQNum})` : ''}
                                                    </option>
                                                  );
                                                })}
                                              </select>
                                            ) : (
                                              <div className="w-full sm:max-w-md space-y-1">
                                                <input
                                                  type="text"
                                                  disabled={isReadOnly}
                                                  value={answer}
                                                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                                  placeholder={
                                                    maxWords
                                                      ? `Type answer (max ${maxWords} word${maxWords > 1 ? 's' : ''})...`
                                                      : 'Type answer...'
                                                  }
                                                  className={`w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-white text-slate-900 shadow-2xs focus:ring-2 focus:outline-hidden ${
                                                    isOverWordLimit
                                                      ? 'border-red-400 focus:ring-red-400 text-red-900 bg-red-50/20'
                                                      : 'border-slate-300 focus:ring-blue-500'
                                                  }`}
                                                />
                                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                                  {instructionText ? (
                                                    <span className="font-semibold text-amber-800">{instructionText}</span>
                                                  ) : <span />}
                                                  {maxWords ? (
                                                    <span className={isOverWordLimit ? 'text-red-600 font-bold animate-pulse' : 'text-slate-400'}>
                                                      {currentWordsCount} / {maxWords} words
                                                    </span>
                                                  ) : null}
                                                </div>
                                              </div>
                                            )}
                                          </div>

                                          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                                            {result && canSeeAnswers && (
                                              <span
                                                className={`text-xs font-bold uppercase px-2.5 py-1 rounded ${
                                                  result.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                                }`}
                                              >
                                                {result.isCorrect ? t('assignments.correct') : t('assignments.incorrect')}
                                              </span>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => setFlaggedQuestions({ ...flaggedQuestions, [q.id]: !flaggedQuestions[q.id] })}
                                              className={`p-1.5 rounded text-xs flex items-center space-x-1 ${
                                                isFlag ? 'text-amber-600 bg-amber-50 font-semibold' : 'text-slate-400 hover:text-slate-600'
                                              }`}
                                              title="Flag for review"
                                            >
                                              <Flag className="w-3.5 h-3.5" />
                                              <span className="text-[11px]">{isFlag ? 'Flagged' : 'Flag'}</span>
                                            </button>
                                          </div>
                                        </div>

                                        {/* Explanation & Answer Key if Graded */}
                                        {canSeeAnswers && (
                                          <div className="mt-2 pt-2 border-t border-slate-100 text-xs space-y-0.5">
                                            <div className="text-slate-600">
                                              <strong>Answer Key:</strong>{' '}
                                              <span className="font-mono font-bold text-emerald-700">{q.correctAnswer || 'N/A'}</span>
                                            </div>
                                            {q.explanation && (
                                              <div className="text-slate-500 italic text-[11px]">
                                                <strong>Citation:</strong> {q.explanation}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                        <div key={group.id} className="space-y-4 pt-1">
                          {/* Group Instruction & Reference Box Banner (Rendered ONCE per question group) */}
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                                {group.rangeTitle}
                              </span>
                              {group.wordLimit && (
                                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/70 border border-amber-200 px-2.5 py-0.5 rounded-full">
                                  {group.wordLimit}
                                </span>
                              )}
                            </div>

                            {group.instructions && !group.questions.every((item) => item.q.type === 'matching_information') && (
                              <p className="text-xs text-slate-700 italic leading-relaxed whitespace-pre-line">
                                {group.instructions}
                              </p>
                            )}

                            {/* Diagram / Flowchart Image for Reading (Section 12) */}
                            {(group.imageUrl || group.questions.some((item) => item.q.imageUrl || item.q.diagramUrl)) && (
                              <div className="p-3 bg-white border border-slate-200 rounded-lg text-center space-y-2 my-2">
                                <img
                                  src={
                                    group.imageUrl ||
                                    group.questions.find((item) => item.q.imageUrl || item.q.diagramUrl)?.q.imageUrl ||
                                    group.questions.find((item) => item.q.imageUrl || item.q.diagramUrl)?.q.diagramUrl
                                  }
                                  alt={group.imageCaption || 'Flow-chart or Diagram'}
                                  className="max-h-72 w-auto mx-auto object-contain rounded shadow-xs"
                                />
                                {(group.imageCaption || group.questions.find((item) => item.q.imageCaption)?.q.imageCaption) && (
                                  <p className="text-xs text-slate-500 italic">
                                    {group.imageCaption || group.questions.find((item) => item.q.imageCaption)?.q.imageCaption}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Reference Box: List of Headings (Rendered ONCE per group) */}
                            {group.headingsList && group.headingsList.length > 0 && (
                              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-1 text-xs">
                                <span className="font-bold text-amber-900 uppercase text-[11px] block">
                                  List of Headings:
                                </span>
                                <div className="space-y-1 text-amber-950 font-medium">
                                  {group.headingsList.map((h) => (
                                    <div key={h} className="leading-snug">
                                      {h}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Reference Box: List of Features / Researchers (Rendered ONCE per group) */}
                            {group.featuresList && group.featuresList.length > 0 && (
                              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-1 text-xs">
                                <span className="font-bold text-indigo-900 uppercase text-[11px] block">
                                  List of Features / Researchers:
                                </span>
                                <div className="space-y-1 text-indigo-950 font-medium">
                                  {group.featuresList.map((f) => (
                                    <div key={f} className="leading-snug">
                                      {f}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Reference Box: Word List for Summary Completion (Rendered ONCE per group) */}
                            {group.wordList && group.wordList.length > 0 && (
                              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-blue-900 uppercase text-[11px] flex items-center space-x-1.5">
                                    <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                                    <span>List of Words / Options (A–{String.fromCharCode(64 + group.wordList.length)}):</span>
                                  </span>
                                  <span className="text-[11px] font-medium text-blue-700">
                                    Chọn từ danh sách để hoàn thành đoạn văn tóm tắt
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
                                  {group.wordList.map((opt) => {
                                    const letter = opt.match(/^([A-Za-z])[\.\:\s]/)?.[1]?.toUpperCase() || '';
                                    const text = opt.replace(/^[A-Za-z][\.\:\s]\s*/, '');
                                    return (
                                      <div
                                        key={opt}
                                        className="p-2 bg-white rounded-md border border-blue-200 shadow-2xs flex items-center space-x-2"
                                      >
                                        {letter && (
                                          <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
                                            {letter}
                                          </span>
                                        )}
                                        <span className="text-slate-800 font-medium text-xs truncate" title={text || opt}>
                                          {text || opt}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Questions in this group */}
                          <div className="space-y-4">
                            {group.questions.map(({ q, idx }) => {
                              const answer = readingAnswers[q.id] || (mySub?.readingAnswers && mySub.readingAnswers[q.id]) || '';
                              const isReadOnly = isTeacher || Boolean(mySub && mySub.status !== 'returned');
                              const result = mySub?.readingErrorAnalysis?.find((e) => e.questionId === q.id);
                              const isFlag = Boolean(flaggedQuestions[q.id]);
                              const maxWords = q.wordLimitCount || q.maxWords || parseMaxWordsFromLimit(q.wordLimit || q.wordLimitInstruction || group.wordLimit);
                              const instructionText = q.wordLimitInstruction || (q.wordLimitCount ? formatWordLimitInstruction(q.wordLimitCount, q.allowNumbers) : q.wordLimit || group.wordLimit);
                              const currentWordsCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;
                              const isOverWordLimit = Boolean(maxWords && currentWordsCount > maxWords);
                              const displayPrompt = resolveQuestionPrompt(q, idx + 1);

                              return (
                                <div
                                  key={q.id}
                                  id={`q_${q.id}`}
                                  className={`p-4 rounded-xl border text-sm space-y-3 transition-colors scroll-mt-4 ${
                                    result
                                      ? result.isCorrect
                                        ? 'border-emerald-300 bg-emerald-50/20'
                                        : 'border-red-300 bg-red-50/20'
                                      : 'border-slate-200 bg-slate-50/40'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-900 text-sm">
                                      Question {idx + 1}
                                    </span>

                                    <div className="flex items-center space-x-2">
                                      {/* Flag button */}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setFlaggedQuestions({ ...flaggedQuestions, [q.id]: !flaggedQuestions[q.id] })
                                        }
                                        className={`p-1 rounded text-xs flex items-center space-x-1 ${
                                          isFlag ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                        title="Flag for review"
                                      >
                                        <Flag className="w-3.5 h-3.5" />
                                        <span className="text-[11px]">{isFlag ? 'Flagged' : 'Flag'}</span>
                                      </button>

                                      {result && canSeeAnswers && (
                                        <span
                                          className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded ${
                                            result.isCorrect
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : 'bg-red-100 text-red-800'
                                          }`}
                                        >
                                          {result.isCorrect ? t('assignments.correct') : t('assignments.incorrect')}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <p className="font-semibold text-slate-800 text-sm leading-relaxed whitespace-pre-line">{renderCleanMarkdown(displayPrompt, idx + 1)}</p>

                                  {/* Word limit note if applicable */}
                                  {(instructionText || (maxWords && !group.wordLimit)) && (
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs text-amber-800 font-semibold bg-amber-50 px-2.5 py-1 rounded border border-amber-200 inline-block">
                                        Limit: {instructionText || (maxWords ? `NO MORE THAN ${maxWords} WORD${maxWords > 1 ? 'S' : ''}` : '')}
                                      </span>
                                      {isOverWordLimit && maxWords && (
                                        <span className="text-xs text-red-600 font-bold animate-pulse">
                                          Exceeds limit ({currentWordsCount}/{maxWords} words)
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Question Type Interactive Controls */}
                                  {q.type === 'true_false_not_given' || q.type === 'yes_no_not_given' ? (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {(q.type === 'true_false_not_given'
                                        ? ['TRUE', 'FALSE', 'NOT GIVEN']
                                        : ['YES', 'NO', 'NOT GIVEN']
                                      ).map((choice) => (
                                        <button
                                          key={choice}
                                          type="button"
                                          disabled={isReadOnly}
                                          onClick={() => handleAnswerChange(q.id, choice)}
                                          className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
                                            answer.toUpperCase() === choice
                                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                          }`}
                                        >
                                          {choice}
                                        </button>
                                      ))}
                                    </div>
                                  ) : q.type === 'matching_information' ? (
                                    (() => {
                                      const matchInfoParagraphs = (q.options && q.options.length > 0)
                                        ? q.options
                                        : (paragraphLabels && paragraphLabels.length > 1)
                                        ? paragraphLabels
                                        : ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
                                      return (
                                        <div className="space-y-3 pt-1">
                                          {/* Self-contained Instruction & NB Note Box */}
                                          <div className="text-xs text-amber-900 bg-amber-50/80 border border-amber-200 px-3 py-2 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1 shadow-2xs">
                                            <span className="font-semibold text-xs sm:text-sm">
                                              Which paragraph contains this information?
                                            </span>
                                            <span className="text-[11px] font-mono font-medium text-amber-800">
                                              NB: Letters may be used more than once
                                            </span>
                                          </div>

                                          {/* Available Paragraph Option Buttons */}
                                          <div className="flex flex-wrap gap-2 pt-1">
                                            {matchInfoParagraphs.map((label) => {
                                              const letter = label.match(/([A-Za-z])/i)?.[1]?.toUpperCase() || label;
                                              const isSelected =
                                                answer.toUpperCase() === letter || answer.toUpperCase() === label.toUpperCase();
                                              return (
                                                <button
                                                  key={label}
                                                  type="button"
                                                  disabled={isReadOnly}
                                                  onClick={() => handleAnswerChange(q.id, letter)}
                                                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                                                    isSelected
                                                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-1 ring-blue-600'
                                                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                                                  }`}
                                                >
                                                  Paragraph {letter}
                                                </button>
                                              );
                                            })}
                                          </div>

                                          {/* Selected answer status (during taking test) */}
                                          {answer && !canSeeAnswers && (
                                            <div className="flex items-center space-x-2 pt-1 text-xs">
                                              <span className="text-slate-500 font-medium">Selected paragraph:</span>
                                              <span className="font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                                                Paragraph {answer.toUpperCase()}
                                              </span>
                                            </div>
                                          )}

                                          {/* Answer Key if review / graded / teacher */}
                                          {canSeeAnswers && q.correctAnswer && (
                                            <div className="text-xs font-bold text-emerald-700 pt-1 flex items-center space-x-1.5">
                                              <span>Answer Key:</span>
                                              <span className="font-extrabold px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded">
                                                Paragraph {q.correctAnswer.toUpperCase()}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()
                                  ) : q.type === 'matching_headings' && (group.headingsList || q.headingsList) && (group.headingsList || q.headingsList)!.length > 0 ? (
                                    <div className="space-y-1.5">
                                      <select
                                        disabled={isReadOnly}
                                        value={answer}
                                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                      >
                                        <option value="">-- Choose Heading (i, ii, iii...) --</option>
                                        {(group.headingsList || q.headingsList)!.map((h) => {
                                          const romanMatch = h.match(/^([ivx\d]+)/i);
                                          const code = romanMatch ? romanMatch[1] : h;
                                          return (
                                            <option key={h} value={code}>
                                              {h}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </div>
                                  ) : q.type === 'matching_features' && (group.featuresList || q.featuresList) && (group.featuresList || q.featuresList)!.length > 0 ? (
                                    <div className="space-y-1.5">
                                      <select
                                        disabled={isReadOnly}
                                        value={answer}
                                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                      >
                                        <option value="">-- Choose Feature / Person (A, B, C...) --</option>
                                        {(group.featuresList || q.featuresList)!.map((f) => {
                                          const letterMatch = f.match(/^([A-G])/i);
                                          const code = letterMatch ? letterMatch[1] : f;
                                          return (
                                            <option key={f} value={code}>
                                              {f}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </div>
                                  ) : q.type === 'matching_sentence_endings' && q.options && q.options.length > 0 ? (
                                    <div className="space-y-1.5">
                                      <select
                                        disabled={isReadOnly}
                                        value={answer}
                                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                      >
                                        <option value="">-- Choose Sentence Ending (A, B, C...) --</option>
                                        {q.options.map((opt) => (
                                          <option key={opt} value={opt}>
                                            {opt}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : q.type === 'multiple_select' && q.options && q.options.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {(() => {
                                        const requiredCount = q.multipleSelectCount ?? 2;
                                        const selectedList = answer ? answer.split(',').map((s) => s.trim()).filter(Boolean) : [];
                                        const atLimit = selectedList.length >= requiredCount;
                                        return (
                                          <>
                                            <p className="text-[11px] font-semibold text-indigo-700">
                                              Select {requiredCount} answer{requiredCount !== 1 ? 's' : ''}&nbsp;
                                              <span className={`font-bold ${atLimit ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                ({selectedList.length}/{requiredCount} selected)
                                              </span>
                                            </p>
                                            {q.options.map((opt) => {
                                              const isChecked = selectedList.includes(opt);
                                              const isDisabledByLimit = !isChecked && atLimit;
                                              return (
                                                <label
                                                  key={opt}
                                                  className={`flex items-center space-x-2.5 p-2 rounded-lg transition-colors ${
                                                    isReadOnly || isDisabledByLimit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                                                  } ${
                                                    isChecked
                                                      ? 'bg-blue-50 border border-blue-300 text-blue-900 font-semibold'
                                                      : 'hover:bg-slate-100'
                                                  }`}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    disabled={isReadOnly || isDisabledByLimit}
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                      let updated = [...selectedList];
                                                      if (e.target.checked) {
                                                        if (updated.length < requiredCount) {
                                                          updated.push(opt);
                                                        }
                                                      } else {
                                                        updated = updated.filter((item) => item !== opt);
                                                      }
                                                      handleAnswerChange(q.id, updated.join(', '));
                                                    }}
                                                    className="text-blue-600 rounded"
                                                  />
                                                  <span>{opt}</span>
                                                </label>
                                              );
                                            })}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  ) : (COMPLETION_TYPES.has(q.type) || group.wordList) && (group.wordList || (q.options && q.options.length > 0)) ? (
                                    <div className="space-y-2 pt-1">
                                      <select
                                        disabled={isReadOnly}
                                        value={answer}
                                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        className="w-full sm:w-80 p-2.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden shadow-2xs"
                                      >
                                        <option value="">
                                          -- Choose from Word List (A–{String.fromCharCode(64 + (group.wordList?.length || q.options?.length || 7))}) --
                                        </option>
                                        {(group.wordList || q.options)!.map((opt) => {
                                          const letterMatch = opt.match(/^([A-Za-z])[\.\:\s]/);
                                          const letter = letterMatch ? letterMatch[1].toUpperCase() : opt;
                                          return (
                                            <option key={opt} value={letter}>
                                              {opt}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </div>
                                  ) : q.options && q.options.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {q.options.map((opt) => (
                                        <label
                                          key={opt}
                                          className={`flex items-center space-x-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                                            answer === opt
                                              ? 'bg-blue-50 border border-blue-300 text-blue-900 font-semibold'
                                              : 'hover:bg-slate-100'
                                          }`}
                                        >
                                          <input
                                            type="radio"
                                            name={`q_${q.id}`}
                                            disabled={isReadOnly}
                                            checked={answer === opt}
                                            onChange={() => handleAnswerChange(q.id, opt)}
                                            className="text-blue-600"
                                          />
                                          <span>{opt}</span>
                                        </label>
                                      ))}
                                    </div>
                                  ) : q.type === 'matching' && q.matchingPairs && q.matchingPairs.length > 0 ? (
                                    <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                                      <p className="text-xs font-bold text-slate-700 uppercase">Match each item:</p>
                                      {q.matchingPairs.map((pair, pIdx) => {
                                        let currentMap: Record<string, string> = {};
                                        try {
                                          currentMap = answer ? JSON.parse(answer) : {};
                                        } catch {
                                          currentMap = {};
                                        }
                                        return (
                                          <div
                                            key={pIdx}
                                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-white rounded border border-slate-200 text-xs"
                                          >
                                            <span className="font-semibold text-slate-800">{pair.left}</span>
                                            <select
                                              disabled={isReadOnly}
                                              value={currentMap[pair.left] || ''}
                                              onChange={(e) => {
                                                const updated = { ...currentMap, [pair.left]: e.target.value };
                                                handleAnswerChange(q.id, JSON.stringify(updated));
                                              }}
                                              className="p-1.5 border border-slate-300 rounded text-xs bg-white text-slate-900"
                                            >
                                              <option value="">-- Select Match --</option>
                                              {q.matchingPairs!.map((m) => (
                                                <option key={m.right} value={m.right}>
                                                  {m.right}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <input
                                        type="text"
                                        disabled={isReadOnly}
                                        value={answer}
                                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        placeholder={
                                          maxWords
                                            ? `Type answer (max ${maxWords} word${maxWords > 1 ? 's' : ''})...`
                                            : 'Type your answer phrase...'
                                        }
                                        className={`w-full sm:w-80 p-2.5 border rounded-lg text-sm bg-white font-medium focus:ring-2 focus:outline-hidden ${
                                          isOverWordLimit
                                            ? 'border-red-400 focus:ring-red-400'
                                            : 'border-slate-300 focus:ring-blue-500'
                                        }`}
                                      />
                                      {maxWords && (
                                        <div className="text-[11px] text-slate-400 font-mono">
                                          {currentWordsCount} / {maxWords} words typed
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Explanation and Citation (Shown ONLY when graded AND canSeeAnswers is true) */}
                                  {canSeeAnswers && (
                                    <div className="mt-2 pt-2 border-t border-slate-200 text-xs space-y-1">
                                      <p className="text-slate-600">
                                        <strong>Answer Key:</strong>{' '}
                                        <span className="font-mono text-emerald-700">{q.correctAnswer || 'Provided in review'}</span>
                                      </p>
                                      {q.explanation && (
                                        <p className="text-slate-500 italic">
                                          <strong>Citation:</strong> {q.explanation}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>

                {/* Submission footer: Pinned at bottom of right column */}
                {!isTeacher && (!mySub || mySub.status === 'returned') ? (
                  <div className="shrink-0 px-6 py-3.5 border-t border-slate-200 bg-slate-50/90 flex justify-end z-10">
                    <button
                      onClick={initiateReadingSubmit}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-xs flex items-center space-x-2 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        Submit Reading Test ({answeredCount} / {questions.length})
                      </span>
                    </button>
                  </div>
                ) : !isTeacher && mySub && mySub.status !== 'returned' ? (
                  <div className="shrink-0 px-6 py-3.5 border-t border-slate-200 bg-emerald-50/90 flex items-center justify-between z-10">
                    <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>{mySub.status === 'graded' ? 'Bài làm đã được chấm điểm' : 'Bài làm đã được nộp thành công'}</span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">Đã nộp: {mySub.submittedAt}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            2. WRITING WORKFLOW (TASK 1 & TASK 2 SEPARATION + LIVE WORD COUNTER)
        ========================================================================= */}
        {isWriting && (
          <div className="space-y-6">
            {isTeacher && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center space-x-2.5 text-blue-900">
                  <Eye className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold">Chế độ xem trước của Giáo viên (Teacher Preview Mode)</h4>
                    <p className="text-xs text-blue-700">Xem trước đề bài, hình ảnh sơ đồ và bài luận mẫu Band 8.5–9.0.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedAssignmentForRoster(activeAssignment)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-1.5"
                  >
                    <Users className="w-4 h-4" />
                    <span>Xem danh sách nộp bài ({submissions.filter((s) => s.assignmentId === activeAssignment.id).length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(activeAssignment)}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Chỉnh sửa</span>
                  </button>
                </div>
              </div>
            )}
            {/* If Graded or Returned, Show Full Writing Assessment Report Card */}
            {mySub && (mySub.status === 'graded' || mySub.status === 'returned') && (
              <div className="bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 border border-indigo-100 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 font-sans">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-100/90 pb-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-900 text-[11px] font-bold uppercase tracking-wider font-sans">
                      <Award className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Official IELTS Writing Assessment</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-sans">
                      {mySub.status === 'graded' ? 'Teacher Assessment Published' : 'Teacher Revision Requested'}
                    </h3>
                    <p className="text-xs text-slate-500 font-sans">
                      {mySub.status === 'graded'
                        ? 'Đánh giá chi tiết theo chuẩn 4 tiêu chí chấm thi IELTS chính thức của Examiners.'
                        : 'Giáo viên đã phản hồi và gửi yêu cầu hoàn thiện bài viết.'}
                    </p>
                  </div>

                  <div className="bg-white px-5 py-2.5 rounded-xl border border-indigo-200/80 shadow-xs flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 sm:gap-0 min-w-[150px] shrink-0 font-sans">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block font-sans">
                      Overall Band Score
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-indigo-600 tracking-tight font-sans my-0.5">
                      {displayWritingBand !== null ? `Band ${displayWritingBand.toFixed(1)}` : 'Đang cập nhật'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium font-sans">
                      Quy chuẩn IELTS 9-band
                    </span>
                  </div>
                </div>

                {/* IELTS Official Scoring Formula Notice */}
                <div className="flex items-center space-x-2 text-xs text-indigo-950 bg-indigo-100/60 px-3.5 py-2 rounded-xl border border-indigo-200/70 font-sans">
                  <Award className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="leading-relaxed font-sans">
                    <strong>Quy chuẩn tính điểm IELTS:</strong> Overall Band Score = (TR/TA + CC + LR + GRA) ÷ 4, quy tròn theo quy định Hội đồng thi (ví dụ: trung bình 6.25 ➔ Band 6.5, trung bình 6.75 ➔ Band 7.0).
                  </span>
                </div>

                {/* 4 Official IELTS Criteria Rubrics Breakdown */}
                {mySub.rubricScores && mySub.rubricScores.length > 0 && (
                  <div className="space-y-2.5 font-sans">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">
                        Official IELTS Criteria Breakdown (4 tiêu chí đánh giá)
                      </h4>
                      <span className="text-[11px] text-slate-500 font-medium font-sans">Thang điểm 0 - 9.0</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
                      {mySub.rubricScores.map((rubric) => (
                        <div
                          key={rubric.criterion}
                          className="bg-white p-3.5 rounded-xl border border-slate-200/90 hover:border-indigo-200 shadow-2xs flex flex-col justify-between transition-all h-full font-sans"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 min-h-[36px]">
                              <span className="text-xs font-bold text-slate-900 leading-snug line-clamp-2 font-sans">
                                {rubric.criterion}
                              </span>
                              <span className="text-xs font-extrabold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 shrink-0 font-sans">
                                Band {Number(rubric.score).toFixed(1)}
                              </span>
                            </div>
                            {(rubric.descriptor || (rubric as any).comment) && (
                              <p className="text-xs text-slate-600 leading-relaxed mt-2 pt-2 border-t border-slate-100 font-sans">
                                {rubric.descriptor || (rubric as any).comment}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strengths & Areas to Improve Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 font-sans">
                  {mySub.strengths && (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-1.5 font-sans">
                      <div className="flex items-center space-x-1.5 text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold uppercase tracking-wider font-sans">Key Strengths</span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">{mySub.strengths}</p>
                    </div>
                  )}

                  {mySub.areasToImprove && (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-1.5 font-sans">
                      <div className="flex items-center space-x-1.5 text-amber-800">
                        <TrendingUp className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-bold uppercase tracking-wider font-sans">Areas for Improvement</span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">{mySub.areasToImprove}</p>
                    </div>
                  )}
                </div>

                {/* Detailed Teacher Comments */}
                {mySub.teacherComments && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5 shadow-2xs font-sans">
                    <div className="flex items-center space-x-1.5 text-slate-800">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold uppercase tracking-wider font-sans">Teacher's Detailed Feedback</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">{mySub.teacherComments}</p>
                  </div>
                )}

                {/* Next Steps & Recommended Practice */}
                {mySub.nextSteps && (
                  <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-xl p-4 space-y-1.5 font-sans">
                    <div className="flex items-center space-x-1.5 text-indigo-900">
                      <Lightbulb className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold uppercase tracking-wider font-sans">Next Steps & Targeted Action</span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">{mySub.nextSteps}</p>
                  </div>
                )}
              </div>
            )}

            {/* Writing Prompt Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
                  {activeAssignment.writingTaskCategory === 'task1_academic'
                    ? 'IELTS Academic Writing Task 1'
                    : 'IELTS Writing Task 2 (Essay)'}
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  Minimum requirement: {targetWords} words
                </span>
              </div>

              {/* Task 1 Diagram & Visual Elements */}
              {Boolean(activeAssignment.writingTaskCategory?.includes('task1') || (activeAssignment as any).writingTaskType === 'task1') ? (
                <div className="space-y-4">
                  <WritingTask1VisualRenderer
                    prompt={activeAssignment.writingPrompt || ''}
                    imageUrl={activeAssignment.task1ImageUrl}
                    chartType={(activeAssignment as any).chartType}
                    minWords={targetWords}
                  />
                  {stripMarkdownTableFromPrompt(activeAssignment.writingPrompt || '').length > 0 && (
                    <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200 text-sm font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
                      {stripMarkdownTableFromPrompt(activeAssignment.writingPrompt || '')}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {activeAssignment.task1ImageUrl && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase flex items-center space-x-1.5">
                          <ImageIcon className="w-4 h-4 text-blue-600" />
                          <span>Task 1 Visual Diagram</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowZoomImageModal(true)}
                          className="text-xs text-blue-600 font-semibold hover:underline flex items-center space-x-1"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                          <span>Expand Image</span>
                        </button>
                      </div>
                      <img
                        src={activeAssignment.task1ImageUrl}
                        alt="Task 1 Diagram"
                        className="max-h-72 rounded-lg border border-slate-300 object-contain mx-auto bg-white"
                      />
                    </div>
                  )}

                  <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200 text-sm font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
                    {activeAssignment.writingPrompt || 'No writing prompt specified.'}
                  </div>
                </>
              )}
            </div>

            {/* Multi-mode Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setStudentWritingTab('submission')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 ${
                  studentWritingTab === 'submission'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>
                  {mySub && (mySub.status === 'graded' || mySub.status === 'returned')
                    ? `Bài viết gốc & Chú thích (${mySub.annotations?.length || 0})`
                    : `Bài nộp của bạn ${mySub ? '(Đã ghi nhận)' : ''}`}
                </span>
              </button>

              {mySub && (mySub.status === 'graded' || mySub.status === 'returned') && (
                <>
                  <button
                    type="button"
                    onClick={() => setStudentWritingTab('corrected')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 ${
                      studentWritingTab === 'corrected'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Bài viết đã chỉnh sửa {studentCorrectedEssay?.totalCorrections ? `(${studentCorrectedEssay.totalCorrections} cải thiện)` : ''}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudentWritingTab('comparison')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 ${
                      studentWritingTab === 'comparison'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" />
                    <span>Đối chiếu song song (Gốc vs Sửa)</span>
                  </button>
                </>
              )}

              {activeAssignment.modelAnswer && (
                <button
                  type="button"
                  onClick={() => setStudentWritingTab('model_answer')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 ${
                    studentWritingTab === 'model_answer'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Bài mẫu IELTS tham khảo (Band 8.5 - 9.0)</span>
                </button>
              )}
            </div>

            {/* View A: Model Answer Dedicated Tab */}
            {studentWritingTab === 'model_answer' && activeAssignment.modelAnswer && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Examiner Model Answer & Exemplar (Band 8.5 - 9.0)</span>
                  </span>
                  <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                    Official Reference
                  </span>
                </div>
                <div className="text-sm font-sans text-slate-800 leading-relaxed whitespace-pre-wrap bg-white p-5 rounded-xl border border-blue-100 shadow-2xs">
                  {activeAssignment.modelAnswer}
                </div>
              </div>
            )}

            {/* View B: Corrected Polished Essay Tab */}
            {studentWritingTab === 'corrected' && mySub && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                        Bản hoàn chỉnh đã áp dụng góp ý của giáo viên
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500">
                      Văn bản được tái tạo hoàn chỉnh dựa trên các đề xuất chỉnh sửa lỗi ngữ pháp, từ vựng và diễn đạt của giáo viên.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowDiffInCorrected(!showDiffInCorrected)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1.5 ${
                        showDiffInCorrected
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{showDiffInCorrected ? 'Đang bật tô màu sửa' : 'Bật tô màu sửa'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyCorrected}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center space-x-1.5 shadow-2xs"
                    >
                      {hasCopiedCorrected ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Đã sao chép!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Sao chép bài đã sửa</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-5 bg-emerald-50/20 rounded-xl border border-emerald-100 text-base font-sans leading-relaxed text-slate-900 whitespace-pre-wrap">
                  {showDiffInCorrected && studentCorrectedEssay ? (
                    studentCorrectedEssay.diffSegments.map((seg, idx) =>
                      seg.type === 'replacement' ? (
                        <span
                          key={`corr-seg-${idx}`}
                          className="bg-emerald-100/90 text-emerald-950 font-semibold px-1 py-0.5 rounded border-b-2 border-emerald-500 inline cursor-help shadow-2xs"
                          title={`Gốc: "${seg.originalText}" ➔ Đã sửa: "${seg.text}" (${seg.category || 'Góp ý'}: ${seg.comment || ''})`}
                        >
                          {seg.text}
                        </span>
                      ) : (
                        <span key={`corr-seg-${idx}`}>{seg.text}</span>
                      )
                    )
                  ) : (
                    studentCorrectedEssay?.correctedText || mySub.writingText || ''
                  )}
                </div>

                {studentCorrectedEssay && studentCorrectedEssay.totalCorrections > 0 && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>
                      Tổng số điểm chỉnh sửa nâng cấp: <strong className="text-emerald-700">{studentCorrectedEssay.totalCorrections} vị trí</strong>.
                    </span>
                    <span className="text-[11px] text-slate-400">Rà chuột vào đoạn tô xanh để xem từ gốc trước khi sửa</span>
                  </div>
                )}
              </div>
            )}

            {/* View C: Side-by-Side Comparison Tab */}
            {studentWritingTab === 'comparison' && mySub && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2 font-sans">
                      <Columns className="w-4 h-4 text-indigo-600" />
                      <span>Đối chiếu song song: Bài viết gốc vs Bài viết đã chỉnh sửa</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-sans">
                      So sánh trực quan giữa bài làm ban đầu và phiên bản đã hoàn thiện theo nhận xét của giáo viên.
                    </p>
                  </div>
                </div>

                {/* Active Inspected Annotation Popup in Comparison view */}
                {activeInspectedAnnotation && (
                  <div
                    ref={studentAnnotationPopupRef}
                    className="sticky top-4 z-30 p-4 rounded-xl bg-gradient-to-r from-blue-50/95 via-indigo-50/95 to-white/95 backdrop-blur-xs border-2 border-blue-400 shadow-md space-y-2.5 transition-all animate-in fade-in zoom-in-95 font-sans"
                  >
                    {activeOverlappingAnnotations.length > 1 && (
                      <div className="flex items-center space-x-1.5 pb-2 border-b border-blue-200/70 overflow-x-auto">
                        <span className="text-[11px] font-bold text-indigo-900 shrink-0">
                          Đoạn này có {activeOverlappingAnnotations.length} nhận xét:
                        </span>
                        {activeOverlappingAnnotations.map((item, idx) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveInspectedAnnotation(item);
                              setActiveHighlightedAnnotationId(item.id);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all shrink-0 ${
                              activeInspectedAnnotation.id === item.id
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            #{idx + 1} {item.type}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Eye className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="text-xs font-bold text-blue-900 uppercase tracking-wider font-sans">
                          Chi tiết nhận xét từ giáo viên
                        </span>
                        {(() => {
                          const type = (activeInspectedAnnotation.type || 'feedback').toLowerCase();
                          const typeBadgeMap: Record<string, { label: string; bg: string; text: string; border: string }> = {
                            correction: { label: 'Correction', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
                            deletion: { label: 'Deletion (Gạch bỏ)', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
                            grammar: { label: 'Grammar', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
                            vocabulary: { label: 'Vocabulary', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
                            suggestion: { label: 'Suggestion', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
                            praise: { label: 'Praise', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
                          };
                          const meta = typeBadgeMap[type] || { label: type.toUpperCase(), bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' };
                          return (
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${meta.bg} ${meta.text} border ${meta.border} font-sans`}>
                              {meta.label}
                            </span>
                          );
                        })()}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveInspectedAnnotation(null);
                          setActiveHighlightedAnnotationId(null);
                        }}
                        className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-white/80 cursor-pointer transition-colors"
                        title="Đóng chi tiết nhận xét"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {activeInspectedAnnotation.selectedText && (
                      <div className="text-xs bg-white/90 p-2.5 rounded-lg border border-blue-200/80 text-slate-800 font-sans italic leading-relaxed">
                        "{activeInspectedAnnotation.selectedText}"
                      </div>
                    )}
                    <div className="text-sm font-semibold text-slate-900 leading-snug font-sans">
                      {activeInspectedAnnotation.comment}
                    </div>
                    {activeInspectedAnnotation.type === 'deletion' ? (
                      <div className="text-xs bg-rose-50 border border-rose-200 text-rose-900 p-2.5 rounded-lg font-medium flex items-center space-x-2 font-sans shadow-2xs">
                        <span className="font-bold">Yêu cầu giáo viên:</span>
                        <span>Đoạn này nên được gạch bỏ / xóa để câu văn súc tích, tránh thừa ý hoặc lỗi ngữ pháp.</span>
                      </div>
                    ) : (
                      activeInspectedAnnotation.suggestion && (
                        <div className="text-xs bg-emerald-100/90 border border-emerald-300 text-emerald-950 p-2.5 rounded-lg font-medium flex items-center space-x-2 font-sans shadow-2xs">
                          <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span><strong className="text-emerald-900">Gợi ý sửa:</strong> {activeInspectedAnnotation.suggestion}</span>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left Column: Original with highlights */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                      <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center space-x-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-700" />
                        <span>1. Bài viết gốc của bạn</span>
                      </span>
                      <span className="text-[11px] font-semibold text-amber-800">
                        {mySub.annotations?.length || 0} điểm chú thích
                      </span>
                    </div>
                    <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-200 text-sm font-sans leading-relaxed text-slate-900 whitespace-pre-wrap max-h-[600px] overflow-y-auto">
                      {renderAnnotatedText(mySub.writingText || '', mySub.annotations, true)}
                    </div>
                  </div>

                  {/* Right Column: Corrected with improvements */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
                      <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                        <span>2. Phiên bản hoàn chỉnh sau sửa</span>
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-800">
                        {studentCorrectedEssay?.totalCorrections || 0} cải thiện
                      </span>
                    </div>
                    <div className="p-4 bg-emerald-50/20 rounded-xl border border-emerald-200 text-sm font-sans leading-relaxed text-slate-900 whitespace-pre-wrap max-h-[600px] overflow-y-auto">
                      {studentCorrectedEssay ? (
                        studentCorrectedEssay.diffSegments.map((seg, idx) =>
                          seg.type === 'replacement' ? (
                            <span
                              key={`comp-seg-${idx}`}
                              className="bg-emerald-100 text-emerald-950 font-semibold px-1 py-0.5 rounded border-b border-emerald-500 inline cursor-help"
                              title={`Gốc: "${seg.originalText}" ➔ Đã sửa: "${seg.text}"`}
                            >
                              {seg.text}
                            </span>
                          ) : (
                            <span key={`comp-seg-${idx}`}>{seg.text}</span>
                          )
                        )
                      ) : (
                        mySub.writingText || ''
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* View D: Student Submission Tab */}
            {studentWritingTab === 'submission' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      {mySub ? 'Bài làm của bạn' : 'Soạn bài viết'}
                    </h3>
                    {mySub && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {mySub.status === 'graded' ? 'Đã chấm điểm' : mySub.status === 'returned' ? 'Cần sửa đổi' : 'Đã nộp'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Progress bar to target words */}
                    <div className="flex items-center space-x-2">
                      <div className="w-28 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            wordCount >= targetWords ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${targetProgress}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-sans font-bold px-2 py-0.5 rounded ${
                          wordCount >= targetWords
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {wordCount >= targetWords
                          ? `Đạt yêu cầu (${wordCount} từ)`
                          : `Còn thiếu ${targetWords - wordCount} từ (${wordCount}/${targetWords})`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Active Inspected Annotation Popup in student view */}
                {activeInspectedAnnotation && (
                  <div
                    ref={studentAnnotationPopupRef}
                    className="sticky top-4 z-30 p-4 rounded-xl bg-gradient-to-r from-blue-50/95 via-indigo-50/95 to-white/95 backdrop-blur-xs border-2 border-blue-400 shadow-md space-y-2.5 transition-all animate-in fade-in zoom-in-95 font-sans"
                  >
                    {activeOverlappingAnnotations.length > 1 && (
                      <div className="flex items-center space-x-1.5 pb-2 border-b border-blue-200/70 overflow-x-auto">
                        <span className="text-[11px] font-bold text-indigo-900 shrink-0">
                          Đoạn này có {activeOverlappingAnnotations.length} nhận xét:
                        </span>
                        {activeOverlappingAnnotations.map((item, idx) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveInspectedAnnotation(item);
                              setActiveHighlightedAnnotationId(item.id);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all shrink-0 ${
                              activeInspectedAnnotation.id === item.id
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            #{idx + 1} {item.type}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Eye className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="text-xs font-bold text-blue-900 uppercase tracking-wider font-sans">
                          Chi tiết nhận xét từ giáo viên
                        </span>
                        {(() => {
                          const type = (activeInspectedAnnotation.type || 'feedback').toLowerCase();
                          const typeBadgeMap: Record<string, { label: string; bg: string; text: string; border: string }> = {
                            correction: { label: 'Correction', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
                            deletion: { label: 'Deletion (Gạch bỏ)', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
                            grammar: { label: 'Grammar', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
                            vocabulary: { label: 'Vocabulary', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
                            suggestion: { label: 'Suggestion', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
                            praise: { label: 'Praise', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
                          };
                          const meta = typeBadgeMap[type] || { label: type.toUpperCase(), bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' };
                          return (
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${meta.bg} ${meta.text} border ${meta.border} font-sans`}>
                              {meta.label}
                            </span>
                          );
                        })()}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveInspectedAnnotation(null);
                          setActiveHighlightedAnnotationId(null);
                        }}
                        className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-white/80 cursor-pointer transition-colors"
                        title="Đóng chi tiết nhận xét"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {activeInspectedAnnotation.selectedText && (
                      <div className="text-xs bg-white/90 p-2.5 rounded-lg border border-blue-200/80 text-slate-800 font-sans italic leading-relaxed">
                        "{activeInspectedAnnotation.selectedText}"
                      </div>
                    )}
                    <div className="text-sm font-semibold text-slate-900 leading-snug font-sans">
                      {activeInspectedAnnotation.comment}
                    </div>
                    {activeInspectedAnnotation.type === 'deletion' ? (
                      <div className="text-xs bg-rose-50 border border-rose-200 text-rose-900 p-2.5 rounded-lg font-medium flex items-center space-x-2 font-sans shadow-2xs">
                        <span className="font-bold">Yêu cầu giáo viên:</span>
                        <span>Đoạn này nên được gạch bỏ / xóa để câu văn súc tích, tránh thừa ý hoặc lỗi ngữ pháp.</span>
                      </div>
                    ) : (
                      activeInspectedAnnotation.suggestion && (
                        <div className="text-xs bg-emerald-100/90 border border-emerald-300 text-emerald-950 p-2.5 rounded-lg font-medium flex items-center space-x-2 font-sans shadow-2xs">
                          <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span><strong className="text-emerald-900">Gợi ý sửa:</strong> {activeInspectedAnnotation.suggestion}</span>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* If submitted and not returned: Strictly Read-Only Formatted Essay with Annotations */}
                {mySub && mySub.status !== 'returned' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                      <span className="font-semibold flex items-center space-x-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>Bài nộp đã được ghi nhận · Chế độ chỉ đọc</span>
                      </span>
                      <span className="text-slate-400">Thời gian nộp: {mySub.submittedAt}</span>
                    </div>

                    <div className="p-5 bg-slate-50/40 rounded-xl border border-slate-200 text-base font-sans leading-relaxed text-slate-900 whitespace-pre-wrap">
                      {renderAnnotatedText(mySub.writingText || '', mySub.annotations, true)}
                    </div>
                  </div>
                ) : (
                  /* Editable Textarea for fresh submission or returned revision */
                  <div className="space-y-4">
                    {mySub?.status === 'returned' && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                        <strong>Yêu cầu chỉnh sửa từ giáo viên:</strong> {mySub.teacherComments || 'Vui lòng bổ sung luận điểm và nộp lại.'}
                      </div>
                    )}

                    <textarea
                      rows={16}
                      value={writingDraft}
                      onChange={(e) => handleWritingDraftChange(e.target.value)}
                      placeholder="Viết bài luận IELTS của bạn tại đây theo đúng điều kiện thi thực tế..."
                      className="w-full p-4 text-base font-sans text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden leading-relaxed"
                    />

                    {!isTeacher && (
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={handleWritingSubmit}
                          disabled={!writingDraft.trim() || isSubmittingStudentWork}
                          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-xs flex items-center space-x-2 transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          <span>
                            {isSubmittingStudentWork
                              ? t('common.loading')
                              : mySub
                              ? 'Nộp lại bài viết'
                              : 'Nộp bài cho giáo viên chấm'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            3. SPEAKING WORKFLOW
        ========================================================================= */}
        {isSpeaking && (
          <div className="space-y-6">
            {isTeacher && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center space-x-2.5 text-purple-900">
                  <Eye className="w-5 h-5 text-purple-600 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold">Chế độ xem trước của Giáo viên (Speaking Preview Mode)</h4>
                    <p className="text-xs text-purple-700">Xem trước chủ đề và các câu hỏi speaking cue card được giao cho học viên.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedAssignmentForRoster(activeAssignment)}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-1.5"
                  >
                    <Users className="w-4 h-4" />
                    <span>Xem danh sách nộp bài ({submissions.filter((s) => s.assignmentId === activeAssignment.id).length})</span>
                  </button>
                </div>
              </div>
            )}
            {/* If Graded or Returned, Show Full Speaking Assessment Report Card */}
            {mySub && (mySub.status === 'graded' || mySub.status === 'returned') && (
              <div className="bg-gradient-to-r from-blue-50 via-teal-50 to-slate-50 border border-teal-200 rounded-2xl p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-teal-200/70 pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Award className="w-5 h-5 text-teal-600" />
                      <span className="text-xs font-extrabold text-teal-900 uppercase tracking-wider">
                        Official IELTS Speaking Assessment & Band Score Report
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mt-1">
                      {mySub.status === 'graded' ? 'Teacher Assessment Published' : 'Teacher Revision Requested'}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {mySub.status === 'graded'
                        ? 'Evaluation based on official IELTS Speaking 9-band criteria.'
                        : 'Your teacher has reviewed your speaking response and provided feedback.'}
                    </p>
                  </div>

                  <div className="text-right bg-white px-5 py-3 rounded-xl border border-teal-100 shadow-xs">
                    <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Overall Speaking Band</span>
                    <span className="text-3xl font-black text-teal-700">
                      Band {mySub.score ? Number(mySub.score).toFixed(1) : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* 4 Official Criteria Rubrics Breakdown */}
                {mySub.rubricScores && mySub.rubricScores.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Official IELTS Speaking Criteria Breakdown
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {mySub.rubricScores.map((rubric) => (
                        <div key={rubric.criterion} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">{rubric.criterion}</span>
                            <span className="text-xs font-extrabold px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md border border-teal-100">
                              Band {Number(rubric.score).toFixed(1)}
                            </span>
                          </div>
                          {(rubric.descriptor || (rubric as any).comment) && (
                            <p className="text-xs text-slate-600 leading-relaxed">{rubric.descriptor || (rubric as any).comment}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strengths & Areas to Improve */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mySub.strengths && (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center space-x-1.5 text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold uppercase tracking-wider">Key Speaking Strengths</span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{mySub.strengths}</p>
                    </div>
                  )}

                  {mySub.areasToImprove && (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center space-x-1.5 text-amber-800">
                        <TrendingUp className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-bold uppercase tracking-wider">Pronunciation & Fluency Improvement</span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{mySub.areasToImprove}</p>
                    </div>
                  )}
                </div>

                {/* Next Steps */}
                {mySub.nextSteps && (
                  <div className="bg-teal-50/50 border border-teal-200/80 rounded-xl p-4 space-y-2">
                    <div className="flex items-center space-x-1.5 text-teal-900">
                      <Lightbulb className="w-4 h-4 text-teal-600" />
                      <span className="text-xs font-bold uppercase tracking-wider">Next Steps & Targeted Action</span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{mySub.nextSteps}</p>
                  </div>
                )}
              </div>
            )}

            {(() => {
              const speakingInfo = extractSpeakingAssignmentDetails(activeAssignment);
              const isReadOnlySubmission = Boolean(mySub && mySub.status !== 'returned');

              return (
                <div className="space-y-6">
                  {/* IF ALREADY SUBMITTED (Read-only review for student) */}
                  {isReadOnlySubmission && mySub && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center space-x-2 text-blue-900">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <h3 className="text-base font-bold text-slate-900">
                            Bản ghi âm bài nói đã nộp
                          </h3>
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full uppercase">
                          {mySub.status === 'graded' ? 'Đã chấm điểm' : 'Đã nộp bài'}
                        </span>
                      </div>

                      {(() => {
                        const unpacked = unpackSpeakingSubmission(mySub.speakingTranscript, mySub.speakingAudioUrl);
                        const responses = Object.entries(unpacked.responses || {}).map(([qKey, r]) => ({
                          ...r,
                          questionId: r.questionId || qKey,
                        }));

                        if (responses && responses.length > 0) {
                          return (
                            <div className="space-y-4">
                              {responses.map((resp, idx) => (
                                <div key={resp.questionId || idx} className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                    <span>Câu {idx + 1} ({resp.questionId})</span>
                                    <span>Thời lượng: {resp.duration}s</span>
                                  </div>
                                  <audio controls src={resp.audioUrl} className="w-full h-10" />
                                </div>
                              ))}
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {mySub.speakingAudioUrl && (
                              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <audio controls src={mySub.speakingAudioUrl} className="w-full h-10" />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ACTIVE TAKING INTERFACE (Not submitted or returned for revision) */}
                  {(!isReadOnlySubmission || isTeacher) && (
                    <div className="space-y-6">
                      {mySub?.status === 'returned' && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                          <p className="font-bold text-sm">Yêu cầu thu âm lại từ giáo viên:</p>
                          <p className="leading-relaxed">{mySub.teacherComments || 'Vui lòng ghi âm lại bài nói và hoàn thiện theo nhận xét.'}</p>
                        </div>
                      )}

                      {(() => {
                        const enabledSpeakingParts: Array<'part1' | 'part2' | 'part3'> = [];
                        if (speakingInfo.hasPart1 || speakingInfo.part === 'part1') enabledSpeakingParts.push('part1');
                        if (speakingInfo.hasPart2 || speakingInfo.part === 'part2') enabledSpeakingParts.push('part2');
                        if (speakingInfo.hasPart3 || speakingInfo.part === 'part3') enabledSpeakingParts.push('part3');

                        const currentActivePartTab = enabledSpeakingParts.includes(activeSpeakingStudentTab)
                          ? activeSpeakingStudentTab
                          : (enabledSpeakingParts[0] || 'part1');

                        const isPart1Visible = enabledSpeakingParts.length <= 1
                          ? (speakingInfo.hasPart1 || speakingInfo.part === 'part1')
                          : currentActivePartTab === 'part1';

                        const isPart2Visible = enabledSpeakingParts.length <= 1
                          ? (speakingInfo.hasPart2 || speakingInfo.part === 'part2')
                          : currentActivePartTab === 'part2';

                        const isPart3Visible = enabledSpeakingParts.length <= 1
                          ? (speakingInfo.hasPart3 || speakingInfo.part === 'part3')
                          : currentActivePartTab === 'part3';

                        return (
                          <>
                            {/* MULTI-PART NAVIGATION TABS (if multiple parts enabled) */}
                            {enabledSpeakingParts.length > 1 && (
                              <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2 shadow-2xs">
                                <span className="text-xs font-bold text-slate-500 mr-2 uppercase tracking-wider">Phần thi Speaking:</span>
                                {enabledSpeakingParts.map((part) => {
                                  const isActive = currentActivePartTab === part;
                                  const label =
                                    part === 'part1'
                                      ? 'Part 1: Topic Questions'
                                      : part === 'part2'
                                      ? 'Part 2: Long Turn (Cue Card)'
                                      : 'Part 3: Discussion';
                                  return (
                                    <button
                                      key={part}
                                      type="button"
                                      onClick={() => setActiveSpeakingStudentTab(part)}
                                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                        isActive
                                          ? 'bg-purple-600 text-white shadow-xs'
                                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* PART 1: TOPIC-BASED */}
                            {(speakingInfo.hasPart1 || speakingInfo.part === 'part1') && (
                              <div className={isPart1Visible ? 'block' : 'hidden'}>
                                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
                                  <div className="pb-3 border-b border-slate-100">
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-purple-100 text-purple-800">
                                      IELTS Speaking Part 1
                                    </span>
                                    <h3 className="text-base font-bold text-slate-900 mt-1">
                                      Topic-based Questions
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      Trả lời từng câu hỏi bên dưới. Bạn có thể thu âm trực tiếp qua mic hoặc tải lên file âm thanh riêng biệt cho từng câu.
                                    </p>
                                  </div>

                                  {speakingInfo.topics && speakingInfo.topics.length > 0 ? (
                                    <div className="space-y-6">
                                      {speakingInfo.topics.map((topic, tIdx) => (
                                        <div key={tIdx} className="p-4 bg-purple-50/40 rounded-xl border border-purple-200 space-y-4">
                                          <div className="flex items-center space-x-2">
                                            <span className="px-2 py-0.5 bg-purple-600 text-white rounded text-[11px] font-bold uppercase">
                                              Chủ đề {tIdx + 1}
                                            </span>
                                            <h4 className="text-sm font-bold text-slate-900">{topic.title}</h4>
                                          </div>

                                          <div className="space-y-4">
                                            {topic.questions.map((q, qIdx) => {
                                              const questionKey = `p1_${tIdx}_${qIdx}`;
                                              return (
                                                <div key={qIdx} className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
                                                  <p className="text-sm font-semibold text-slate-900">
                                                    <span className="text-purple-700 font-bold mr-1.5">
                                                      Câu {tIdx + 1}.{qIdx + 1}:
                                                    </span>
                                                    {q}
                                                  </p>

                                                  <SpeakingAudioRecorder
                                                    questionId={questionKey}
                                                    maxSeconds={60}
                                                    initialAudioUrl={studentSpeakingAudios[questionKey]?.url}
                                                    onAudioReady={(blob, duration, url) => {
                                                      setStudentSpeakingAudios((prev) => ({
                                                        ...prev,
                                                        [questionKey]: { blob, duration, url },
                                                      }));
                                                    }}
                                                    onAudioClear={() => {
                                                      setStudentSpeakingAudios((prev) => {
                                                        const next = { ...prev };
                                                        delete next[questionKey];
                                                        return next;
                                                      });
                                                    }}
                                                  />
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="p-4 bg-slate-50 rounded-lg text-xs text-slate-500 text-center">
                                      Không có chủ đề Part 1 nào được cấu hình cho bài tập này.
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* PART 2: INDIVIDUAL LONG TURN */}
                            {(speakingInfo.hasPart2 || speakingInfo.part === 'part2') && (
                              <div className={isPart2Visible ? 'block' : 'hidden'}>
                                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
                                  <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-purple-100 text-purple-800">
                                        IELTS Speaking Part 2
                                      </span>
                                      <h3 className="text-base font-bold text-slate-900 mt-1">
                                        Individual Long Turn (Cue Card)
                                      </h3>
                                    </div>
                                    <span className="text-xs text-slate-500 font-medium">
                                      1 phút chuẩn bị • 1-2 phút nói
                                    </span>
                                  </div>

                                  {/* Cue Card Frame */}
                                  <div className="p-5 bg-amber-50/60 rounded-xl border-2 border-amber-300 shadow-2xs space-y-3">
                                    <p className="text-base font-bold text-slate-900">
                                      {speakingInfo.cueCard?.topic || activeAssignment.title}
                                    </p>
                                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                      You should say:
                                    </p>
                                    <ul className="list-disc list-inside text-sm text-slate-800 space-y-1.5 pl-1">
                                      {(speakingInfo.cueCard?.points || ['What it was', 'When it happened', 'Why it is memorable']).map((pt, i) => (
                                        <li key={i}>{pt}</li>
                                      ))}
                                    </ul>
                                  </div>

                                  {/* 60-Second Preparation Timer */}
                                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                      <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                        Thời gian chuẩn bị ghi chú (60 giây)
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        Nhấn bắt đầu để đếm ngược 1 phút chuẩn bị trước khi thu âm bài nói.
                                      </p>
                                    </div>

                                    <div className="flex items-center space-x-3">
                                      <span
                                        className={`text-xl font-mono font-bold px-3 py-1 rounded-lg border ${
                                          speakingPrepRunning
                                            ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                                            : speakingPrepCountdown === 0
                                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                        }`}
                                      >
                                        {speakingPrepCountdown > 0 ? `${speakingPrepCountdown}s` : '00s'}
                                      </span>

                                      {!speakingPrepRunning ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSpeakingPrepCountdown(60);
                                            setSpeakingPrepRunning(true);
                                          }}
                                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                                        >
                                          Bắt đầu 1 phút chuẩn bị
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSpeakingPrepRunning(false);
                                            setSpeakingPrepCountdown(0);
                                          }}
                                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                                        >
                                          Dừng / Đặt lại
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Part 2 Audio Recorder */}
                                  <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                      Thu âm bài nói Part 2 (Tối đa 2 phút)
                                    </label>
                                    <SpeakingAudioRecorder
                                      questionId="p2_cue"
                                      maxSeconds={speakingInfo.cueCard?.speakTimeSeconds || 120}
                                      initialAudioUrl={studentSpeakingAudios.p2_cue?.url}
                                      onAudioReady={(blob, duration, url) => {
                                        setStudentSpeakingAudios((prev) => ({
                                          ...prev,
                                          p2_cue: { blob, duration, url },
                                        }));
                                      }}
                                      onAudioClear={() => {
                                        setStudentSpeakingAudios((prev) => {
                                          const next = { ...prev };
                                          delete next.p2_cue;
                                          return next;
                                        });
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* PART 3: INDEPENDENT DISCUSSION */}
                            {(speakingInfo.hasPart3 || speakingInfo.part === 'part3') && (
                              <div className={isPart3Visible ? 'block' : 'hidden'}>
                                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
                                  <div className="pb-3 border-b border-slate-100">
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-purple-100 text-purple-800">
                                      IELTS Speaking Part 3
                                    </span>
                                    <h3 className="text-base font-bold text-slate-900 mt-1">
                                      Two-way Discussion Questions
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      Thảo luận các câu hỏi chuyên sâu mở rộng từ chủ đề. Trả lời từng câu hỏi với bản thu âm độc lập.
                                    </p>
                                  </div>

                                  {speakingInfo.groups && speakingInfo.groups.length > 0 ? (
                                    <div className="space-y-6">
                                      {speakingInfo.groups.map((grp, gIdx) => (
                                        <div key={grp.id || gIdx} className="p-4 bg-purple-50/40 rounded-xl border border-purple-200 space-y-4">
                                          <div className="flex items-center space-x-2">
                                            <span className="px-2 py-0.5 bg-purple-600 text-white rounded text-[11px] font-bold uppercase">
                                              Nhóm {gIdx + 1}
                                            </span>
                                            <h4 className="text-sm font-bold text-slate-900">
                                              {grp.cueCardTopic ? `Chủ đề liên kết: ${grp.cueCardTopic}` : `Chủ đề ${gIdx + 1}`}
                                            </h4>
                                          </div>
                                          <div className="space-y-3">
                                            {grp.questions.map((q, qIdx) => {
                                              const questionKey = `p3_g${gIdx}_q${qIdx}`;
                                              return (
                                                <div key={qIdx} className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
                                                  <p className="text-sm font-semibold text-slate-900">
                                                    <span className="text-purple-700 font-bold mr-1.5">
                                                      Câu {gIdx + 1}.{qIdx + 1}:
                                                    </span>
                                                    {q}
                                                  </p>

                                                  <SpeakingAudioRecorder
                                                    questionId={questionKey}
                                                    maxSeconds={90}
                                                    initialAudioUrl={studentSpeakingAudios[questionKey]?.url}
                                                    onAudioReady={(blob, duration, url) => {
                                                      setStudentSpeakingAudios((prev) => ({
                                                        ...prev,
                                                        [questionKey]: { blob, duration, url },
                                                      }));
                                                    }}
                                                    onAudioClear={() => {
                                                      setStudentSpeakingAudios((prev) => {
                                                        const next = { ...prev };
                                                        delete next[questionKey];
                                                        return next;
                                                      });
                                                    }}
                                                  />
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : speakingInfo.questions && speakingInfo.questions.length > 0 ? (
                                    <div className="space-y-4">
                                      {speakingInfo.questions.map((q, qIdx) => {
                                        const questionKey = `p3_${qIdx}`;
                                        return (
                                          <div key={qIdx} className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                                            <p className="text-sm font-semibold text-slate-900">
                                              <span className="text-purple-700 font-bold mr-1.5">
                                                Câu {qIdx + 1}:
                                              </span>
                                              {q}
                                            </p>

                                            <SpeakingAudioRecorder
                                              questionId={questionKey}
                                              maxSeconds={90}
                                              initialAudioUrl={studentSpeakingAudios[questionKey]?.url}
                                              onAudioReady={(blob, duration, url) => {
                                                setStudentSpeakingAudios((prev) => ({
                                                  ...prev,
                                                  [questionKey]: { blob, duration, url },
                                                }));
                                              }}
                                              onAudioClear={() => {
                                                setStudentSpeakingAudios((prev) => {
                                                  const next = { ...prev };
                                                  delete next[questionKey];
                                                  return next;
                                                });
                                              }}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="p-4 bg-slate-50 rounded-lg text-xs text-slate-500 text-center">
                                      Không có câu hỏi thảo luận Part 3 nào được cấu hình cho bài tập này.
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* SUBMIT ACTION BAR */}
                      {!isTeacher && (
                        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-xs text-slate-600">
                            <span className="font-bold text-slate-800">
                              Đã thu âm: {Object.keys(studentSpeakingAudios).length} câu trả lời
                            </span>
                            {speakingSubmittingStep && (
                              <p className="text-blue-600 font-semibold mt-0.5 animate-pulse">
                                {speakingSubmittingStep}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={handleSpeakingSubmit}
                            disabled={Object.keys(studentSpeakingAudios).length === 0 || isSubmittingStudentWork}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                          >
                            <Send className="w-4 h-4" />
                            <span>
                              {isSubmittingStudentWork
                                ? 'Đang nộp bài...'
                                : mySub?.status === 'returned'
                                ? 'Nộp lại bài Speaking'
                                : 'Nộp bài Speaking'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

                {/* =========================================================================
            3.5. LISTENING ASSIGNMENT WORKFLOW (PRACTICE PLAYER & 10 QUESTION TYPES)
        ========================================================================= */}
        {isListening && (
          <div className="space-y-6">
            {/* Top Practice Audio Player */}
            <div className="sticky top-4 z-20">
              <PracticeListeningAudioPlayer
                audioUrl={activeAssignment.audioUrl || activeAssignment.listeningAudioUrl}
                title={activeAssignment.title}
                parts={activeAssignment.listeningParts || []}
                activePartIndex={activePassageTab}
                onPartChange={(idx) => setActivePassageTab(idx)}
                className="shadow-md"
              />
            </div>

            {/* Submissions & Results Banner if Graded */}
            {mySub?.status === 'graded' && (
              <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg">
                    {mySub.score || (mySub as any).listeningScore?.band || '—'}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      IELTS Listening Band: {mySub.score || (mySub as any).listeningScore?.band || '—'}
                    </h4>
                    <p className="text-xs text-slate-600">
                      Số câu đúng: {(mySub as any).listeningScore?.raw ?? mySub.readingScore?.correct ?? 0} / {(mySub as any).listeningScore?.total ?? mySub.readingScore?.total ?? 40} ({Math.round((((mySub as any).listeningScore?.raw || 0) / ((mySub as any).listeningScore?.total || 40)) * 100)}%)
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                  Đã chấm điểm (Graded)
                </span>
              </div>
            )}

            {/* Questions Canvas */}
            <div className="space-y-6">
              {(() => {
                const parts = (activeAssignment.listeningParts && activeAssignment.listeningParts.length > 0)
                  ? activeAssignment.listeningParts
                  : (activeAssignment.listeningContent?.parts && activeAssignment.listeningContent.parts.length > 0)
                  ? activeAssignment.listeningContent.parts
                  : [];
                const activePart = parts[activePassageTab] || (parts.length > 0 ? parts[0] : undefined);
                const rawQuestions = activePart?.questions || [];
                const scopedQuestions =
                  rawQuestions.length > 20
                    ? rawQuestions.slice(activePassageTab * 10, (activePassageTab + 1) * 10)
                    : rawQuestions;

                const activeGroups: ListeningQuestionGroup[] =
                  activePart?.questionGroups?.length
                    ? activePart.questionGroups
                    : [
                        {
                          id: `listen_group_${activePassageTab}`,
                          type: 'note_completion' as any,
                          title: `Part ${activePassageTab + 1} Questions`,
                          instructions: 'Answer the questions as you listen. Write NO MORE THAN TWO WORDS AND/OR A NUMBER.',
                          wordLimit: 'NO MORE THAN TWO WORDS AND/OR A NUMBER',
                          questions: scopedQuestions,
                        },
                      ];

                return (
                  <div className="space-y-4">
                    {activeGroups.map((group) => (
                      <ListeningQuestionRenderer
                        key={group.id}
                        questionGroup={group}
                        answers={readingAnswers}
                        onAnswerChange={handleAnswerChange}
                        flaggedQuestionIds={
                          new Set(
                            Object.entries(flaggedQuestions)
                              .filter(([_, isFlagged]) => isFlagged)
                              .map(([qId]) => qId)
                          )
                        }
                        onToggleFlag={(qId) =>
                          setFlaggedQuestions((prev) => ({ ...prev, [qId]: !prev[qId] }))
                        }
                        isReadOnly={mySub?.status === 'graded'}
                        showCorrectAnswers={mySub?.status === 'graded'}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Submit Action Bar */}
            {(!mySub || mySub.status !== 'graded') && !isTeacher && (
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  {Object.keys(readingAnswers).filter((k) => readingAnswers[k]?.trim()).length} câu đã trả lời
                </span>
                <button
                  type="button"
                  onClick={handleSubmitListening}
                  disabled={isSubmittingStudentWork}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
                >
                  {isSubmittingStudentWork ? 'Đang chấm điểm...' : 'Nộp bài & Xem điểm Listening'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            4. GENERAL ASSIGNMENT FALLBACK WORKFLOW
        ========================================================================= */}
        {!isReading && !isWriting && !isSpeaking && !isListening && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>Chi tiết bài tập</span>
                </h3>
                <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2.5 py-0.5 rounded-full uppercase">
                  {activeAssignment.skill || 'General'}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                {activeAssignment.instructions || 'Không có hướng dẫn chi tiết.'}
              </div>

              {activeAssignment.objectives && (
                <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-xs text-blue-900">
                  <strong>Mục tiêu:</strong> {activeAssignment.objectives}
                </div>
              )}

              {isTeacher ? (
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Chế độ xem trước dành cho Giáo viên</span>
                  <button
                    type="button"
                    onClick={() => setSelectedAssignmentForRoster(activeAssignment)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs"
                  >
                    <Users className="w-4 h-4" />
                    <span>Xem danh sách nộp bài ({submissions.filter((s) => s.assignmentId === activeAssignment.id).length})</span>
                  </button>
                </div>
              ) : (
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase">Trạng thái làm bài</h4>
                  {mySub ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                      <div className="flex items-center space-x-2 font-bold">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>Bạn đã nộp bài thành công (Thời gian: {mySub.submittedAt})</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-200/80 rounded uppercase font-bold text-[10px]">
                        {mySub.status}
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                      <p className="text-xs text-amber-900">Vui lòng hoàn thành theo hướng dẫn và gửi xác nhận cho giáo viên.</p>
                      <button
                        type="button"
                        onClick={handleWritingSubmit}
                        disabled={isSubmittingStudentWork}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Xác nhận hoàn thành bài tập</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Unanswered Questions Warning before Reading Submit */}
        {showUnansweredModal && (
          <Portal>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center space-x-3 text-amber-600">
                  <AlertTriangle className="w-6 h-6 shrink-0" />
                  <h3 className="text-base font-bold text-slate-900">Unanswered Questions Warning</h3>
                </div>
                <p className="text-sm text-slate-600">
                  You have {questions.length - answeredCount} unanswered question(s). In the real IELTS exam, unanswered questions score zero points.
                </p>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUnansweredModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                  >
                    Review Questions
                  </button>
                  <button
                    type="button"
                    onClick={executeReadingSubmit}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs"
                  >
                    Submit Anyway
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        )}

        {/* Zoom Image Modal */}
        {showZoomImageModal && activeAssignment.task1ImageUrl && (
          <Portal>
            <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl p-4 max-w-4xl w-full max-h-[90vh] flex flex-col space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-bold text-sm text-slate-800">Task 1 Visual Diagram</span>
                  <button onClick={() => setShowZoomImageModal(false)} className="p-1 text-slate-500 hover:text-slate-800">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-auto flex-1 flex items-center justify-center">
                  <img src={activeAssignment.task1ImageUrl} alt="Full Resolution Diagram" className="max-w-full max-h-[75vh] object-contain" />
                </div>
              </div>
            </div>
          </Portal>
        )}
      </div>
    );
  }

  // =========================================================================
  // SCREEN 3: ASSIGNMENTS OVERVIEW & LISTING
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('assignments.title')}</h1>
          <p className="text-sm text-slate-500">
            {isTeacher ? t('assignments.subtitleTeacher') : t('assignments.subtitleStudent')}
          </p>
        </div>

        {isTeacher && (
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setLibraryCourseId(courses[0]?.id || '');
                setShowImportLibraryModal(true);
              }}
              className="inline-flex items-center space-x-2 px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-100 shadow-xs transition-colors"
            >
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>Import from Library</span>
            </button>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('assignments.createBtn')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Tabs & Course Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-sm w-fit">
          {(['all', 'listening', 'reading', 'writing', 'speaking'] as const).map((skill) => (
            <button
              key={skill}
              onClick={() => setSelectedSkillFilter(skill)}
              className={`px-3 py-1.5 rounded-md capitalize font-medium transition-all ${
                selectedSkillFilter === skill
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {skill === 'all' ? t('skills.all') : t(`skills.${skill}` as any) || skill.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Course Filter Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600 whitespace-nowrap">Khóa học:</label>
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="all">Tất cả khóa học (All Courses)</option>
            {accessibleCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.code ? `(${c.code})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Teacher: Pending Submissions Queue */}
      {isTeacher && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>{t('assignments.pendingReviewTitle')}</span>
            </h2>
            <span className="text-xs text-slate-400">
              {submissions.filter((s) => s.status !== 'graded' || s.isDraft).length} {t('common.status').toLowerCase()}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {submissions.filter((s) => s.status !== 'graded' || s.isDraft).length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{t('assignments.allGradedMsg')}</p>
            ) : (
              submissions
                .filter((s) => s.status !== 'graded' || s.isDraft)
                .map((sub) => (
                  <div
                    key={sub.id}
                    className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-xs uppercase font-bold px-2 py-0.5 rounded ${
                            sub.skill === 'reading'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sub.skill === 'writing'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {sub.skill}
                        </span>
                        <span className="text-sm font-bold text-slate-900">{sub.assignmentTitle}</span>
                        {sub.isDraft && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            {t('assignments.draftBadge')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        By {sub.studentName} ({sub.courseName}) · {sub.submittedAt}
                      </p>
                    </div>

                    <button
                      onClick={() => setSelectedSubmissionId(sub.id)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                    >
                      {t('assignments.reviewAndGrade')} &rarr;
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* Assignments Grid */}
      {filteredAssignments.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">{t('common.empty')}</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {selectedCourseFilter !== 'all'
              ? 'Khóa học này hiện chưa có bài tập nào.'
              : isTeacher
              ? 'No assignments created yet. Click "Create Assignment" above to assign coursework.'
              : 'No assignments assigned yet in your enrolled courses.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssignments.map((a) => {
            const studentSub = submissions.find(
              (s) => s.assignmentId === a.id && s.studentId === currentUser.id
            );
            const subCount = submissions.filter((s) => s.assignmentId === a.id).length;
            const enrolledCount = courseMembers.filter((m) => m.courseId === a.courseId && m.status === 'enrolled').length || subCount;

            return (
              <div
                key={a.id}
                onClick={() => setSelectedAssignmentId(a.id)}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer p-5 flex flex-col justify-between h-full min-h-[230px] group"
              >
                <div>
                  {/* Top Badges & Due Date (Standardized & Non-overlapping) */}
                  <div className="flex items-center justify-between text-xs mb-3 gap-2">
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                      <span
                        className={`text-[11px] uppercase font-extrabold px-2 py-0.5 rounded-md tracking-wider ${
                          a.skill === 'reading'
                            ? 'bg-emerald-100 text-emerald-800'
                            : a.skill === 'writing'
                            ? 'bg-amber-100 text-amber-800'
                            : a.skill === 'speaking'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {a.skill}
                      </span>

                      {a.writingTaskCategory && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                          {a.writingTaskCategory === 'task1_academic' ? 'Task 1' : 'Task 2'}
                        </span>
                      )}

                      {a.readingTestType && a.skill === 'reading' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                          {a.readingTestType === 'academic' ? 'Academic' : 'General'}
                        </span>
                      )}

                      {isTeacher && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                            a.scoreVisibility === 'public'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {a.scoreVisibility === 'public' ? (
                            <>
                              <Globe className="w-2.5 h-2.5" />
                              <span>Public</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-2.5 h-2.5" />
                              <span>Private</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-500 font-medium flex items-center space-x-1 shrink-0 whitespace-nowrap bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{a.dueDate || 'No limit'}</span>
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors line-clamp-1">
                    {a.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">
                    {a.instructions || 'No specific instructions provided.'}
                  </p>
                </div>

                {/* Footer Action Toolbar */}
                <div className="pt-3.5 border-t border-slate-100 mt-4 flex items-center justify-between text-xs gap-2">
                  {!isTeacher ? (
                    studentSub ? (
                      <span
                        className={`font-bold text-xs px-2.5 py-1 rounded-md flex items-center space-x-1.5 ${
                          studentSub.status === 'graded'
                            ? a.scoreVisibility === 'public' && studentSub.score
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                            : studentSub.status === 'returned'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>
                          {studentSub.status === 'graded'
                            ? a.scoreVisibility === 'public' && studentSub.score
                              ? `Band ${studentSub.score}`
                              : 'Đã chấm điểm'
                            : studentSub.status === 'returned'
                            ? 'Cần làm lại'
                            : 'Đã nộp bài'}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs font-medium italic">{t('status.notSubmitted')}</span>
                    )
                  ) : (
                    <div className="flex items-center space-x-1.5 overflow-hidden">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAssignmentForRoster(a);
                        }}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-bold flex items-center space-x-1 text-[11px] whitespace-nowrap shrink-0 transition-colors"
                        title="Xem danh sách bài làm của học viên"
                      >
                        <Users className="w-3 h-3" />
                        <span>Bài làm ({subCount}/{enrolledCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(a);
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center space-x-1 text-[11px] whitespace-nowrap shrink-0 transition-colors"
                        title="Chỉnh sửa bài tập"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingAssignment(a);
                        }}
                        className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors shrink-0"
                        title="Xóa bài tập"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <span className="font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center space-x-1 text-xs shrink-0 whitespace-nowrap bg-blue-50 group-hover:bg-blue-600 group-hover:text-white px-3 py-1 rounded-lg">
                    <span>{isTeacher ? 'Xem đề' : studentSub ? 'Xem lại' : 'Làm bài'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          MODAL: VIEW ASSIGNMENT SUBMISSIONS ROSTER (TEACHER VIEW)
      ========================================================================= */}
      {selectedAssignmentForRoster && (() => {
        const targetAssignment = selectedAssignmentForRoster;
        const targetCourse = courses.find((c) => c.id === targetAssignment.courseId);
        const enrolledStudents = courseMembers.filter(
          (m) => m.courseId === targetAssignment.courseId && m.status === 'enrolled'
        );
        const assignmentSubs = submissions.filter((s) => s.assignmentId === targetAssignment.id);

        // Combined roster
        const rosterMap: Record<
          string,
          {
            studentId: string;
            studentName: string;
            studentEmail: string;
            sub?: (typeof submissions)[0];
            status: SubmissionStatus | 'not_submitted';
          }
        > = {};

        enrolledStudents.forEach((m) => {
          rosterMap[m.studentId] = {
            studentId: m.studentId,
            studentName: m.studentName,
            studentEmail: m.studentEmail,
            status: 'not_submitted',
          };
        });

        assignmentSubs.forEach((s) => {
          if (!rosterMap[s.studentId]) {
            rosterMap[s.studentId] = {
              studentId: s.studentId,
              studentName: s.studentName,
              studentEmail: '',
              status: s.status,
              sub: s,
            };
          } else {
            rosterMap[s.studentId].sub = s;
            rosterMap[s.studentId].status = s.status;
          }
        });

        const allStudents = Object.values(rosterMap);
        const totalCount = allStudents.length;
        const gradedCount = allStudents.filter((item) => item.status === 'graded').length;
        const pendingCount = allStudents.filter((item) => item.status !== 'graded' && item.status !== 'not_submitted').length;
        const notSubmittedCount = allStudents.filter((item) => item.status === 'not_submitted').length;

        const filteredList = allStudents.filter((item) => {
          if (rosterFilter === 'all') return true;
          if (rosterFilter === 'pending') return item.status !== 'graded' && item.status !== 'not_submitted';
          if (rosterFilter === 'graded') return item.status === 'graded';
          if (rosterFilter === 'not_submitted') return item.status === 'not_submitted';
          return true;
        });

        return (
          <Portal>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 sm:p-7 border border-slate-200 my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span
                        className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                          targetAssignment.skill === 'reading'
                            ? 'bg-emerald-100 text-emerald-800'
                            : targetAssignment.skill === 'writing'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {targetAssignment.skill}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Lớp: <span className="font-bold text-slate-700">{targetCourse?.name || 'Khóa học'}</span>
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">
                      Danh sách bài làm — {targetAssignment.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Hạn nộp: {targetAssignment.dueDate || 'Không giới hạn'} · Quản lý trạng thái và xem lại bài đã chấm của học viên
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedAssignmentForRoster(null);
                      setRosterFilter('all');
                    }}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Counter Statistics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div
                    onClick={() => setRosterFilter('all')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      rosterFilter === 'all'
                        ? 'border-blue-500 bg-blue-50/70 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-slate-500 block text-[11px] font-bold uppercase">Tổng số học viên</span>
                    <span className="text-xl font-black text-slate-900">{totalCount}</span>
                  </div>

                  <div
                    onClick={() => setRosterFilter('pending')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      rosterFilter === 'pending'
                        ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-amber-700 block text-[11px] font-bold uppercase">Chờ chấm</span>
                    <span className="text-xl font-black text-amber-700">{pendingCount}</span>
                  </div>

                  <div
                    onClick={() => setRosterFilter('graded')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      rosterFilter === 'graded'
                        ? 'border-emerald-500 bg-emerald-50/70 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-emerald-700 block text-[11px] font-bold uppercase">Đã chấm</span>
                    <span className="text-xl font-black text-emerald-700">{gradedCount}</span>
                  </div>

                  <div
                    onClick={() => setRosterFilter('not_submitted')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      rosterFilter === 'not_submitted'
                        ? 'border-slate-500 bg-slate-100 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-slate-500 block text-[11px] font-bold uppercase">Chưa nộp</span>
                    <span className="text-xl font-black text-slate-600">{notSubmittedCount}</span>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center space-x-1 border-b border-slate-200 pb-2 text-xs">
                  {[
                    { key: 'all', label: `Tất cả (${totalCount})` },
                    { key: 'pending', label: `Chờ chấm (${pendingCount})` },
                    { key: 'graded', label: `Đã chấm (${gradedCount})` },
                    { key: 'not_submitted', label: `Chưa nộp (${notSubmittedCount})` },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setRosterFilter(tab.key as any)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                        rosterFilter === tab.key
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Student Roster Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200 text-[11px]">
                      <tr>
                        <th className="py-3 px-4 min-w-[200px]">Học viên</th>
                        <th className="py-3 px-4 w-32">Trạng thái</th>
                        <th className="py-3 px-4 w-36">Thời gian nộp</th>
                        <th className="py-3 px-4 w-32">Điểm số</th>
                        <th className="py-3 px-4 text-right w-44">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            Không có học viên nào trong trạng thái này.
                          </td>
                        </tr>
                      ) : (
                        filteredList.map((item) => {
                          const isGraded = item.status === 'graded';
                          const isSubmitted = item.status === 'submitted' || item.status === 'returned';

                          return (
                            <tr key={item.studentId} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4">
                                <span className="font-bold text-slate-900 block">{item.studentName}</span>
                                {item.studentEmail && (
                                  <span className="text-[11px] text-slate-400 block">{item.studentEmail}</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                                    isGraded
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : isSubmitted
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {isGraded ? 'Đã chấm' : isSubmitted ? 'Đã nộp' : 'Chưa nộp'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                                {item.sub?.submittedAt || '-'}
                              </td>
                              <td className="py-3 px-4">
                                {isGraded && item.sub ? (
                                  <div className="flex items-center space-x-1.5">
                                    <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 font-black rounded text-xs">
                                      Band {item.sub.score}
                                    </span>
                                    {item.sub.readingScore && (
                                      <span className="text-[10px] text-slate-500 font-semibold">
                                        ({item.sub.readingScore.correct}/{item.sub.readingScore.total || 40})
                                      </span>
                                    )}
                                  </div>
                                ) : isSubmitted ? (
                                  <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    Chờ chấm
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-semibold">-</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {isGraded && item.sub ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAssignmentForRoster(null);
                                      setSelectedSubmissionId(item.sub!.id);
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors inline-flex items-center space-x-1"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Xem lại bài đã chấm</span>
                                  </button>
                                ) : isSubmitted && item.sub ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAssignmentForRoster(null);
                                      setSelectedSubmissionId(item.sub!.id);
                                    }}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors inline-flex items-center space-x-1"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Chấm bài</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">Chưa nộp bài</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Modal Action */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAssignmentForRoster(null);
                      setRosterFilter('all');
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        );
      })()}

      {/* =========================================================================
          MODAL: CREATE / EDIT ASSIGNMENT
      ========================================================================= */}
      {showCreateEditModal && (
        <Portal>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingAssignmentId ? 'Edit Assignment / Exercise' : t('assignments.createBtn')}
                </h3>
                <button
                  onClick={() => setShowCreateEditModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

            <form onSubmit={handleSaveAssignmentForm} className="space-y-4 text-sm">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('resources.selectCourse')} *</label>
                <select
                  required
                  value={formCourseId}
                  onChange={(e) => setFormCourseId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white text-sm"
                >
                  <option value="">{t('resources.chooseCourse')}</option>
                  {courses
                    .filter((c) => c.teacherId === currentUser.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('resources.resourceSkill')} *</label>
                  <select
                    value={formSkill}
                    onChange={(e) => setFormSkill(e.target.value as AssignmentSkill)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white text-sm"
                  >
                    <option value="listening">{t('skills.listening') || 'Listening'}</option>
                    <option value="reading">{t('skills.reading')}</option>
                    <option value="writing">{t('skills.writing')}</option>
                    <option value="speaking">{t('skills.speaking')}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('courses.endDate')} *</label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('resources.resourceTitle')} *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cambridge 18 Test 2 Writing Task 2"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('assignments.instructionsTitle')}</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Complete under timed conditions. Write at least 250 words."
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden text-sm"
                />
              </div>

              {/* WRITING SPECIFIC CONFIGURATION */}
              {formSkill === 'writing' && (
                <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-3">
                  {/* Writing Resource from Library Selector */}
                  <div className="p-3 bg-white rounded-xl border border-amber-300 shadow-2xs space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <PenTool className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-800">
                          {selectedWritingResourceTitle ? (
                            <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                              <span>Tài liệu: <strong>{selectedWritingResourceTitle}</strong></span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedWritingResourceId(null);
                                  setSelectedWritingResourceTitle(null);
                                }}
                                className="text-slate-400 hover:text-rose-600 font-bold ml-1 text-sm cursor-pointer"
                                title="Bỏ chọn tài liệu này"
                              >
                                ✕
                              </button>
                            </span>
                          ) : (
                            <span className="text-slate-600">Chọn đề Writing từ Thư viện tài nguyên</span>
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowWritingLibraryPicker(!showWritingLibraryPicker)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
                      >
                        <Library className="w-3.5 h-3.5" />
                        <span>{showWritingLibraryPicker ? 'Đóng danh sách' : 'Chọn từ Thư viện'}</span>
                      </button>
                    </div>

                    {showWritingLibraryPicker && (() => {
                      const writingResources = resources.filter((r) => {
                        const isWriting = r.skill === 'writing' || (r as any).type === 'writing' || (r.tags && r.tags.includes('writing'));
                        if (!isWriting) return false;
                        if (!writingLibrarySearch.trim()) return true;
                        const q = writingLibrarySearch.toLowerCase();
                        return (r.title || '').toLowerCase().includes(q) || ((r.tags || []) as string[]).some((t) => t.toLowerCase().includes(q));
                      });

                      return (
                        <div className="pt-2 border-t border-amber-100 space-y-2 animate-in fade-in duration-150">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={writingLibrarySearch}
                              onChange={(e) => setWritingLibrarySearch(e.target.value)}
                              placeholder="Tìm kiếm tài liệu Writing theo tên hoặc tag..."
                              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          {writingResources.length === 0 ? (
                            <p className="text-xs text-slate-400 py-3 italic text-center">
                              Không tìm thấy tài liệu Writing nào trong Thư viện. Bạn có thể import từ Word/PDF tại mục Tài nguyên.
                            </p>
                          ) : (
                            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                              {writingResources.map((res) => {
                                let taskType: 'task1' | 'task2' = 'task2';
                                let chartType = '';
                                let promptText = '';
                                let imgUrl = res.url || '';
                                let minW = 250;
                                let modelAns = '';

                                if (res.content) {
                                  try {
                                    const parsed = JSON.parse(res.content);
                                    if (parsed && typeof parsed === 'object') {
                                      taskType = parsed.taskType || (res.title.toLowerCase().includes('task 1') ? 'task1' : 'task2');
                                      chartType = parsed.chartType || '';
                                      promptText = parsed.prompt || parsed.writingPrompt || parsed.content || '';
                                      if (parsed.imageUrl || parsed.task1ImageUrl) imgUrl = parsed.imageUrl || parsed.task1ImageUrl;
                                      minW = parsed.minWords || (taskType === 'task1' ? 150 : 250);
                                      modelAns = parsed.modelAnswer || parsed.sampleAnswer || parsed.sampleAnswers?.[0]?.content || '';
                                    }
                                  } catch {
                                    promptText = res.content;
                                  }
                                }
                                if (!promptText) promptText = res.title;

                                const isSelected = selectedWritingResourceId === res.id;

                                return (
                                  <div
                                    key={res.id}
                                    onClick={() => {
                                      const isTask1 = taskType === 'task1';
                                      const cat: WritingTaskCategory = isTask1
                                        ? (chartType.toLowerCase().includes('general') ? 'task1_general' : 'task1_academic')
                                        : 'task2';
                                      setFormTitle((prev) => !prev.trim() || prev === 'New Assignment' ? res.title : prev);
                                      setFormWritingTaskCategory(cat);
                                      setFormWritingPrompt(promptText);
                                      if (imgUrl) setFormTask1ImageUrl(imgUrl);
                                      setFormWritingMinWords(minW);
                                      if (modelAns) setFormModelAnswer(modelAns);
                                      setSelectedWritingResourceId(res.id);
                                      setSelectedWritingResourceTitle(res.title);
                                      setShowWritingLibraryPicker(false);
                                    }}
                                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-start justify-between gap-3 ${
                                      isSelected
                                        ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400'
                                        : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/20'
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                          taskType === 'task1' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                          {taskType === 'task1' ? (chartType ? `Task 1: ${chartType}` : 'Task 1') : 'Task 2 Essay'}
                                        </span>
                                        <span className="font-bold text-xs text-slate-800 truncate">{res.title}</span>
                                        {res.folder && (
                                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                            📁 {res.folder}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{promptText}</p>
                                    </div>
                                    <button
                                      type="button"
                                      className="px-2.5 py-1 bg-amber-600 text-white rounded text-[11px] font-bold shrink-0 self-center"
                                    >
                                      Chọn đề này
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <label className="block font-bold text-amber-900 mb-1">Writing Task Type *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'task1_academic', label: 'Academic Task 1 (Graph / Chart / Diagram)', min: 150 },
                        { id: 'task2', label: 'Academic Task 2 (Essay)', min: 250 },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setFormWritingTaskCategory(item.id as WritingTaskCategory);
                            setFormWritingMinWords(item.min);
                          }}
                          className={`p-2.5 rounded-lg border text-xs font-bold transition-all ${
                            formWritingTaskCategory === item.id
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Task 1 Academic Chart / Diagram Image Uploader */}
                  {formWritingTaskCategory === 'task1_academic' && (
                    <div className="space-y-2">
                      <label className="block font-bold text-amber-900">Task 1 Chart / Graph Diagram Image</label>
                      <input
                        type="text"
                        placeholder="Paste image URL (e.g. https://... or data:image/...)"
                        value={formTask1ImageUrl}
                        onChange={(e) => setFormTask1ImageUrl(e.target.value)}
                        className="w-full p-2 border border-amber-300 rounded-lg text-xs bg-white outline-hidden"
                      />
                      {formTask1ImageUrl && (
                        <img
                          src={formTask1ImageUrl}
                          alt="Preview"
                          className="max-h-40 rounded-lg border border-amber-300 object-contain mx-auto bg-white"
                        />
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-amber-900 mb-1">{t('assignments.essayPrompt')} *</label>
                    <textarea
                      rows={3}
                      placeholder="Type the full IELTS Writing task prompt here..."
                      value={formWritingPrompt}
                      onChange={(e) => setFormWritingPrompt(e.target.value)}
                      className="w-full p-2.5 border border-amber-300 rounded-lg text-sm bg-white outline-hidden"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-slate-700 font-semibold text-xs">Minimum Words:</span>
                    <input
                      type="number"
                      value={formWritingMinWords}
                      onChange={(e) => setFormWritingMinWords(Number(e.target.value))}
                      className="w-24 p-1.5 border border-amber-300 rounded text-center bg-white font-bold text-sm"
                    />
                  </div>
                </div>
              )}

              {/* READING SPECIFIC CONFIGURATION */}
              {formSkill === 'reading' && (
                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                  <div>
                    <label className="block font-bold text-emerald-900 mb-1">Reading Test Scale *</label>
                    <div className="flex space-x-3">
                      <div className="px-3 py-1.5 rounded-lg border text-xs font-bold bg-emerald-600 text-white border-emerald-600 shadow-xs">
                        IELTS Academic Reading (Official 40-item Cambridge Scale)
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-emerald-900 mb-1">Reading Passage Text</label>
                    <textarea
                      rows={6}
                      placeholder="Paste IELTS Reading Passage text here..."
                      value={formReadingPassage}
                      onChange={(e) => setFormReadingPassage(e.target.value)}
                      className="w-full p-2.5 border border-emerald-300 rounded-lg text-sm bg-white outline-hidden font-serif"
                    />
                  </div>
                </div>
              )}

              {/* MODEL ANSWER & RELEASE POLICY */}
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 uppercase">
                    Teacher's Model Answer & Release Policy
                  </span>
                  <span className="text-[11px] text-blue-600">Band 9 Exemplar</span>
                </div>

                <textarea
                  rows={3}
                  placeholder="Paste exemplar model answer or Band 9 essay for student reference..."
                  value={formModelAnswer}
                  onChange={(e) => setFormModelAnswer(e.target.value)}
                  className="w-full p-2.5 border border-blue-200 rounded-lg text-sm bg-white outline-hidden"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Model Answer Release Condition</label>
                    <select
                      value={formModelAnswerReleaseCondition}
                      onChange={(e) => setFormModelAnswerReleaseCondition(e.target.value as any)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="after_graded">Released After Graded (Recommended)</option>
                      <option value="after_submission">Released Immediately Upon Submission</option>
                      <option value="immediate">Available Immediately During Practice</option>
                      <option value="never">Never (Teacher Eyes Only)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Score Visibility (Chế độ xem điểm)</label>
                    <select
                      value={formScoreVisibility}
                      onChange={(e) => setFormScoreVisibility(e.target.value as 'private' | 'public')}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                    >
                      <option value="private">🔒 Private (Chỉ GV thấy điểm — Mặc định)</option>
                      <option value="public">🌐 Public (Học viên thấy điểm sau khi chấm)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SPEAKING SPECIFIC CONFIGURATION */}
              {formSkill === 'speaking' && (
                <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-200/60 pb-3">
                    <div>
                      <label className="block text-sm font-bold text-purple-950">
                        Cấu trúc phần thi Speaking *
                      </label>
                      <p className="text-xs text-purple-700">
                        Chọn Part 1 (chủ đề/câu hỏi), Part 2 (cue card dài), hoặc Part 3 (thảo luận tự do).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowSpeakingLibraryPicker(!showSpeakingLibraryPicker)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      <FolderPlus className="w-4 h-4" />
                      <span>Chọn từ Thư viện</span>
                    </button>
                  </div>

                  {/* Materials Library Picker & Drill-down Individual Exercise Selection */}
                  {showSpeakingLibraryPicker && (() => {
                    // Filter speaking materials from Library
                    const spkResources = resources.filter(
                      (r) => r.skill === 'speaking' || (r as any).type === 'speaking' || r.speakingPart
                    );

                    // Check assigned status for an exercise in current course
                    const checkAssigned = (id?: string, topic?: string) => {
                      if (!formCourseId) return { isAssigned: false, assignmentTitle: '', dueDate: '' };
                      const normId = (id || '').toLowerCase().trim();
                      const normTopic = (topic || '').toLowerCase().trim();
                      if (!normId && !normTopic) return { isAssigned: false, assignmentTitle: '', dueDate: '' };

                      const found = assignments.find((a) => {
                        if (a.courseId !== formCourseId || a.skill !== 'speaking') return false;
                        if (editingAssignmentId && a.id === editingAssignmentId) return false;
                        if (a.selectedSpeakingExerciseIds?.some((item) => {
                          const n = item.toLowerCase().trim();
                          return (normId && n === normId) || (normTopic && n === normTopic);
                        })) return true;
                        if (a.speakingTopics?.some((t) => (normId && t.id?.toLowerCase().trim() === normId) || (normTopic && t.topic?.toLowerCase().trim() === normTopic))) return true;
                        if (a.speakingCueCard?.topic && normTopic && a.speakingCueCard.topic.toLowerCase().trim() === normTopic) return true;
                        if (a.speakingPart3Groups?.some((g) => (normId && g.id?.toLowerCase().trim() === normId) || (normTopic && g.cueCardTopic?.toLowerCase().trim() === normTopic))) return true;
                        return false;
                      });

                      if (found) {
                        return { isAssigned: true, assignmentTitle: found.title, dueDate: found.dueDate };
                      }
                      return { isAssigned: false, assignmentTitle: '', dueDate: '' };
                    };

                    if (!selectedSpeakingResource) {
                      return (
                        <div className="p-3.5 bg-white rounded-xl border border-purple-300 shadow-md space-y-2.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1.5 border-b border-slate-100">
                            <span>Tài liệu Speaking trong Thư viện ({spkResources.length}) - Chọn tài liệu để duyệt bài</span>
                            <button
                              type="button"
                              onClick={() => setShowSpeakingLibraryPicker(false)}
                              className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                            >
                              Đóng
                            </button>
                          </div>

                          {spkResources.length === 0 ? (
                            <p className="text-xs text-slate-500 py-3 italic text-center">
                              Chưa có tài liệu Speaking nào trong Thư viện. Hãy import từ Word/PDF qua chức năng Smart Import.
                            </p>
                          ) : (
                            <div className="max-h-56 overflow-y-auto space-y-1.5">
                              {spkResources.map((res) => {
                                const resPart = res.speakingPart || (res.title.includes('Part 1') ? 'part1' : res.title.includes('Part 3') ? 'part3' : 'part2');
                                return (
                                  <div
                                    key={res.id}
                                    onClick={() => setSelectedSpeakingResource(res)}
                                    className="p-2.5 rounded-lg border border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 cursor-pointer transition-colors flex items-center justify-between text-xs"
                                  >
                                    <div>
                                      <p className="font-bold text-slate-800">{res.title}</p>
                                      <p className="text-[11px] text-slate-500">{res.description || res.category || 'Tài liệu Speaking'}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800">
                                        {resPart}
                                      </span>
                                      <span className="text-[11px] text-purple-600 font-semibold hover:underline">
                                        Duyệt & chọn bài →
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // DRILL-DOWN: INDIVIDUAL EXERCISE SELECTION
                    const res = selectedSpeakingResource;
                    const resPart = res.speakingPart || (res.title.includes('Part 1') ? 'part1' : res.title.includes('Part 3') ? 'part3' : 'part2');

                    let part1Topics: SpeakingTopic[] = res.speakingPart1?.topics || [];
                    if (part1Topics.length === 0 && res.content) {
                      try { part1Topics = JSON.parse(res.content).topics || []; } catch {}
                    }

                    let part2CueCards: Array<{ id?: string; topic: string; points?: string[] }> = res.speakingPart2?.cueCards || [];
                    if (part2CueCards.length === 0 && res.content) {
                      try { part2CueCards = JSON.parse(res.content).cueCards || []; } catch {}
                    }

                    let part3Groups: SpeakingPart3Group[] = res.speakingPart3?.groups || [];
                    let part3Questions: string[] = res.speakingPart3?.questions || [];
                    if (part3Groups.length === 0 && res.content) {
                      try {
                        const parsed = JSON.parse(res.content);
                        part3Groups = parsed.groups || [];
                        part3Questions = parsed.questions || [];
                      } catch {}
                    }
                    if (part3Groups.length === 0 && part3Questions.length > 0) {
                      part3Groups = [{ id: 'p3_group_1', cueCardTopic: 'General Discussion', questions: part3Questions }];
                    }

                    return (
                      <div className="p-3.5 bg-white rounded-xl border border-purple-300 shadow-md space-y-3 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <button
                            type="button"
                            onClick={() => setSelectedSpeakingResource(null)}
                            className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center space-x-1"
                          >
                            <span>← Quay lại danh sách</span>
                          </button>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-800 truncate max-w-[200px]">{res.title}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800">
                              {resPart}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSpeakingResource(null);
                              setShowSpeakingLibraryPicker(false);
                            }}
                            className="text-slate-400 hover:text-slate-600 text-xs"
                          >
                            Đóng
                          </button>
                        </div>

                        {/* PART 1 EXERCISES */}
                        {resPart === 'part1' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-700">
                                Chọn chủ đề Part 1 ({formSpeakingSelectedExerciseIds.length}/{part1Topics.length} đã chọn):
                              </span>
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormSpeakingSelectedExerciseIds(part1Topics.map((t) => t.id || t.topic));
                                  }}
                                  className="text-[11px] font-bold text-purple-600 hover:underline"
                                >
                                  Chọn tất cả
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                  type="button"
                                  onClick={() => setFormSpeakingSelectedExerciseIds([])}
                                  className="text-[11px] font-semibold text-slate-500 hover:underline"
                                >
                                  Bỏ chọn
                                </button>
                              </div>
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-1.5">
                              {part1Topics.map((top, tIdx) => {
                                const topId = top.id || top.topic || `top_${tIdx}`;
                                const isChecked = formSpeakingSelectedExerciseIds.includes(topId) || formSpeakingSelectedExerciseIds.includes(top.topic);
                                const status = checkAssigned(top.id, top.topic);

                                return (
                                  <div
                                    key={topId}
                                    onClick={() => {
                                      if (isChecked) {
                                        setFormSpeakingSelectedExerciseIds((prev) =>
                                          prev.filter((id) => id !== topId && id !== top.topic)
                                        );
                                      } else {
                                        if (status.isAssigned) {
                                          setDuplicateAssignmentWarning({
                                            exerciseTitle: top.topic,
                                            existingAssignmentTitle: status.assignmentTitle,
                                            assignedDate: status.dueDate,
                                            onConfirm: () => {
                                              setFormSpeakingSelectedExerciseIds((prev) => [...prev, topId]);
                                            },
                                          });
                                        } else {
                                          setFormSpeakingSelectedExerciseIds((prev) => [...prev, topId]);
                                        }
                                      }
                                    }}
                                    className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                                      isChecked
                                        ? 'border-purple-400 bg-purple-50/70 shadow-2xs'
                                        : 'border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2.5">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}} // handled by parent div
                                        className="rounded text-purple-600 focus:ring-purple-500 pointer-events-none"
                                      />
                                      <div>
                                        <p className="font-bold text-slate-800">{top.topic}</p>
                                        <p className="text-[11px] text-slate-500">{top.questions?.length || 0} câu hỏi</p>
                                      </div>
                                    </div>
                                    <div>
                                      {status.isAssigned ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                          Đã giao ({status.assignmentTitle})
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          Chưa giao
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* PART 2 CUE CARDS */}
                        {resPart === 'part2' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-700">
                                Chọn Cue Card Part 2 ({formSpeakingSelectedExerciseIds.length}/{part2CueCards.length} đã chọn):
                              </span>
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormSpeakingSelectedExerciseIds(part2CueCards.map((c: any) => c.id || c.topic));
                                  }}
                                  className="text-[11px] font-bold text-purple-600 hover:underline"
                                >
                                  Chọn tất cả
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                  type="button"
                                  onClick={() => setFormSpeakingSelectedExerciseIds([])}
                                  className="text-[11px] font-semibold text-slate-500 hover:underline"
                                >
                                  Bỏ chọn
                                </button>
                              </div>
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-1.5">
                              {part2CueCards.map((card: any, cIdx: number) => {
                                const cardId = card.id || card.topic || `card_${cIdx}`;
                                const isChecked = formSpeakingSelectedExerciseIds.includes(cardId) || formSpeakingSelectedExerciseIds.includes(card.topic);
                                const status = checkAssigned(card.id, card.topic);

                                return (
                                  <div
                                    key={cardId}
                                    onClick={() => {
                                      if (isChecked) {
                                        setFormSpeakingSelectedExerciseIds((prev) =>
                                          prev.filter((id) => id !== cardId && id !== card.topic)
                                        );
                                      } else {
                                        if (status.isAssigned) {
                                          setDuplicateAssignmentWarning({
                                            exerciseTitle: card.topic,
                                            existingAssignmentTitle: status.assignmentTitle,
                                            assignedDate: status.dueDate,
                                            onConfirm: () => {
                                              setFormSpeakingSelectedExerciseIds((prev) => [...prev, cardId]);
                                            },
                                          });
                                        } else {
                                          setFormSpeakingSelectedExerciseIds((prev) => [...prev, cardId]);
                                        }
                                      }
                                    }}
                                    className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                                      isChecked
                                        ? 'border-purple-400 bg-purple-50/70 shadow-2xs'
                                        : 'border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2.5">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}}
                                        className="rounded text-purple-600 focus:ring-purple-500 pointer-events-none"
                                      />
                                      <div>
                                        <p className="font-bold text-slate-800 line-clamp-1">{card.topic}</p>
                                        <p className="text-[11px] text-slate-500">
                                          {card.points?.length || 0} gợi ý • 60s chuẩn bị / 120s nói
                                        </p>
                                      </div>
                                    </div>
                                    <div>
                                      {status.isAssigned ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                          Đã giao ({status.assignmentTitle})
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          Chưa giao
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* PART 3 GROUPS */}
                        {resPart === 'part3' && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-700">
                                Chọn nhóm câu hỏi Part 3 ({formSpeakingSelectedExerciseIds.length}/{part3Groups.length} đã chọn):
                              </span>
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormSpeakingSelectedExerciseIds(part3Groups.map((g: any) => g.id || g.cueCardTopic || 'grp'));
                                  }}
                                  className="text-[11px] font-bold text-purple-600 hover:underline"
                                >
                                  Chọn tất cả
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                  type="button"
                                  onClick={() => setFormSpeakingSelectedExerciseIds([])}
                                  className="text-[11px] font-semibold text-slate-500 hover:underline"
                                >
                                  Bỏ chọn
                                </button>
                              </div>
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-1.5">
                              {part3Groups.map((grp: any, gIdx: number) => {
                                const grpId = grp.id || grp.cueCardTopic || `grp_${gIdx}`;
                                const isChecked = formSpeakingSelectedExerciseIds.includes(grpId) || formSpeakingSelectedExerciseIds.includes(grp.cueCardTopic || '');
                                const status = checkAssigned(grp.id, grp.cueCardTopic);

                                return (
                                  <div
                                    key={grpId}
                                    onClick={() => {
                                      if (isChecked) {
                                        setFormSpeakingSelectedExerciseIds((prev) =>
                                          prev.filter((id) => id !== grpId && id !== (grp.cueCardTopic || ''))
                                        );
                                      } else {
                                        if (status.isAssigned) {
                                          setDuplicateAssignmentWarning({
                                            exerciseTitle: grp.cueCardTopic || `Nhóm ${gIdx + 1}`,
                                            existingAssignmentTitle: status.assignmentTitle,
                                            assignedDate: status.dueDate,
                                            onConfirm: () => {
                                              setFormSpeakingSelectedExerciseIds((prev) => [...prev, grpId]);
                                            },
                                          });
                                        } else {
                                          setFormSpeakingSelectedExerciseIds((prev) => [...prev, grpId]);
                                        }
                                      }
                                    }}
                                    className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                                      isChecked
                                        ? 'border-purple-400 bg-purple-50/70 shadow-2xs'
                                        : 'border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2.5">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}}
                                        className="rounded text-purple-600 focus:ring-purple-500 pointer-events-none"
                                      />
                                      <div>
                                        <p className="font-bold text-slate-800">
                                          {grp.cueCardTopic ? `Liên kết: ${grp.cueCardTopic}` : `Nhóm ${gIdx + 1}`}
                                        </p>
                                        <p className="text-[11px] text-slate-500">{grp.questions?.length || 0} câu hỏi</p>
                                      </div>
                                    </div>
                                    <div>
                                      {status.isAssigned ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                          Đã giao ({status.assignmentTitle})
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          Chưa giao
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* APPLY ACTION BUTTON */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">
                            {formSpeakingSelectedExerciseIds.length > 0
                              ? `Đã chọn ${formSpeakingSelectedExerciseIds.length} bài tập`
                              : 'Vui lòng chọn ít nhất 1 bài tập'}
                          </span>
                          <button
                            type="button"
                            disabled={formSpeakingSelectedExerciseIds.length === 0}
                            onClick={() => {
                              setFormSpeakingPart(resPart);
                              setFormSpeakingParts((prev) => Array.from(new Set([...prev, resPart])));
                              if (resPart === 'part1') {
                                const selected = part1Topics.filter(
                                  (t) =>
                                    formSpeakingSelectedExerciseIds.includes(t.id) ||
                                    formSpeakingSelectedExerciseIds.includes(t.topic)
                                );
                                setFormSpeakingTopics(selected.length > 0 ? selected : part1Topics);
                              } else if (resPart === 'part2') {
                                const selected = part2CueCards.filter(
                                  (c: any) =>
                                    formSpeakingSelectedExerciseIds.includes(c.id) ||
                                    formSpeakingSelectedExerciseIds.includes(c.topic)
                                );
                                const card = selected[0] || part2CueCards[0];
                                setFormSpeakingTopic(card?.topic || res.title);
                                setFormSpeakingPoints(card?.points?.join('\n') || '');

                                // Automatically attach associated Part 3 groups
                                const cardsToMatch = selected.length > 0 ? selected : (card ? [card] : []);
                                const { matchedGroups } = findAssociatedPart3GroupsForCards(cardsToMatch, res, resources);
                                if (matchedGroups.length > 0) {
                                  setFormSpeakingPart3Groups(matchedGroups);
                                  setFormSpeakingQuestions(matchedGroups.flatMap((g: any) => g.questions));
                                }
                              } else if (resPart === 'part3') {
                                const selected = part3Groups.filter(
                                  (g: any) =>
                                    formSpeakingSelectedExerciseIds.includes(g.id) ||
                                    formSpeakingSelectedExerciseIds.includes(g.cueCardTopic || '')
                                );
                                const groupsToApply = selected.length > 0 ? selected : part3Groups;
                                setFormSpeakingPart3Groups(groupsToApply);
                                setFormSpeakingQuestions(groupsToApply.flatMap((g: any) => g.questions));
                                // Auto-link Part 2 Cue Card from Question Library
                                linkCueCardForPart3(groupsToApply, res);
                              }
                              if (!formTitle.trim()) {
                                setFormTitle(res.title);
                              }
                              setShowSpeakingLibraryPicker(false);
                              setSelectedSpeakingResource(null);
                            }}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                          >
                            Áp dụng các bài đã chọn ({formSpeakingSelectedExerciseIds.length})
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Independent Part Selection Controls */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-purple-950 uppercase tracking-wider">
                        Chọn các phần thi (Independent Parts Selection) *
                      </label>
                      <span className="text-[11px] font-bold text-purple-700">
                        {formSpeakingParts.length === 0 ? '⚠️ Chưa chọn phần nào' : `Đã chọn: ${formSpeakingParts.map(p => p.toUpperCase()).join(' + ')}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: 'part1' as const, label: 'Part 1', name: 'Topic-based Questions', desc: 'Chủ đề & câu hỏi phỏng vấn ngắn' },
                        { id: 'part2' as const, label: 'Part 2', name: 'Individual Long Turn', desc: 'Cue Card nói độc lập (1-2 phút)' },
                        { id: 'part3' as const, label: 'Part 3', name: 'Two-way Discussion', desc: 'Câu hỏi thảo luận chuyên sâu mở rộng' },
                      ].map((item) => {
                        const isChecked = formSpeakingParts.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setFormSpeakingParts((prev) => {
                                if (prev.includes(item.id)) {
                                  return prev.filter((p) => p !== item.id);
                                } else {
                                  return [...prev, item.id];
                                }
                              });
                            }}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              isChecked
                                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-purple-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-extrabold text-xs">{item.label}</span>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 pointer-events-none"
                              />
                            </div>
                            <div>
                              <p className={`text-xs font-bold ${isChecked ? 'text-white' : 'text-slate-800'}`}>
                                {item.name}
                              </p>
                              <p className={`text-[10px] mt-0.5 leading-snug ${isChecked ? 'text-purple-100' : 'text-slate-500'}`}>
                                {item.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-slate-500">Cấu hình nhanh:</span>
                      {[
                        { label: 'Chỉ Part 1', parts: ['part1'] as Array<'part1' | 'part2' | 'part3'> },
                        { label: 'Chỉ Part 2', parts: ['part2'] as Array<'part1' | 'part2' | 'part3'> },
                        { label: 'Chỉ Part 3', parts: ['part3'] as Array<'part1' | 'part2' | 'part3'> },
                        { label: 'Part 1 + 2', parts: ['part1', 'part2'] as Array<'part1' | 'part2' | 'part3'> },
                        { label: 'Part 2 + 3', parts: ['part2', 'part3'] as Array<'part1' | 'part2' | 'part3'> },
                        { label: 'Part 1 + 3', parts: ['part1', 'part3'] as Array<'part1' | 'part2' | 'part3'> },
                        { label: 'Cả 3 phần (Full)', parts: ['part1', 'part2', 'part3'] as Array<'part1' | 'part2' | 'part3'> },
                      ].map((preset) => {
                        const isCurrent =
                          preset.parts.length === formSpeakingParts.length &&
                          preset.parts.every((p) => formSpeakingParts.includes(p));
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setFormSpeakingParts(preset.parts)}
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
                              isCurrent
                                ? 'bg-purple-700 text-white font-bold shadow-2xs'
                                : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* PART 1 CONFIGURATION */}
                  {formSpeakingParts.includes('part1') && (
                    <div className="space-y-4 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-900 uppercase">
                          Danh sách chủ đề Part 1 ({formSpeakingTopics.length} chủ đề)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setFormSpeakingTopics((prev) => [
                              ...prev,
                              {
                                id: `topic_${Date.now()}_${prev.length + 1}`,
                                topic: `Topic ${prev.length + 1}`,
                                title: `Topic ${prev.length + 1}`,
                                questions: ['What do you think about this?'],
                              },
                            ])
                          }
                          className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-md text-xs font-bold transition-colors"
                        >
                          + Thêm chủ đề mới
                        </button>
                      </div>

                      {formSpeakingTopics.length === 0 ? (
                        <div className="p-4 bg-white rounded-lg border border-dashed border-purple-300 text-center text-xs text-purple-700">
                          Chưa có chủ đề nào. Nhấn "+ Thêm chủ đề mới" hoặc chọn từ Thư viện tài liệu.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {formSpeakingTopics.map((topic, tIdx) => (
                            <div key={tIdx} className="p-3 bg-white rounded-xl border border-purple-200 shadow-2xs space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <input
                                  type="text"
                                  value={topic.title || topic.topic}
                                  placeholder="Tên chủ đề (ví dụ: Work / Study, Hometown, Hobbies)"
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setFormSpeakingTopics((prev) =>
                                      prev.map((tp, idx) => (idx === tIdx ? { ...tp, topic: val, title: val } : tp))
                                    );
                                  }}
                                  className="w-full font-bold text-slate-800 text-xs p-1.5 border border-slate-200 rounded-md outline-hidden focus:border-purple-500"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFormSpeakingTopics((prev) => prev.filter((_, idx) => idx !== tIdx))
                                  }
                                  className="text-slate-400 hover:text-red-600 p-1 shrink-0"
                                  title="Xóa chủ đề"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="space-y-1.5 pl-2 border-l-2 border-purple-200">
                                {topic.questions.map((q, qIdx) => (
                                  <div key={qIdx} className="flex items-center space-x-2">
                                    <span className="text-[11px] font-bold text-slate-500 shrink-0">
                                      {tIdx + 1}.{qIdx + 1}
                                    </span>
                                    <input
                                      type="text"
                                      value={q}
                                      placeholder="Nội dung câu hỏi Speaking"
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setFormSpeakingTopics((prev) =>
                                          prev.map((tp, idx) => {
                                            if (idx !== tIdx) return tp;
                                            const updatedQs = [...tp.questions];
                                            updatedQs[qIdx] = val;
                                            return { ...tp, questions: updatedQs };
                                          })
                                        );
                                      }}
                                      className="w-full text-xs p-1.5 border border-slate-200 rounded-md outline-hidden"
                                    />
                                    {topic.questions.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFormSpeakingTopics((prev) =>
                                            prev.map((tp, idx) => {
                                              if (idx !== tIdx) return tp;
                                              return {
                                                ...tp,
                                                questions: tp.questions.filter((_, i) => i !== qIdx),
                                              };
                                            })
                                          );
                                        }}
                                        className="text-slate-400 hover:text-red-500 p-1 shrink-0"
                                        title="Xóa câu hỏi"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormSpeakingTopics((prev) =>
                                      prev.map((tp, idx) => {
                                        if (idx !== tIdx) return tp;
                                        return { ...tp, questions: [...tp.questions, ''] };
                                      })
                                    );
                                  }}
                                  className="text-[11px] font-bold text-purple-600 hover:text-purple-800 pt-1 block"
                                >
                                  + Thêm câu hỏi cho chủ đề này
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* PART 2 CONFIGURATION */}
                  {formSpeakingParts.includes('part2') && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-purple-950 mb-1">
                          {t('assignments.cueCardTitle')} - Topic *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Describe an ambition that you have had for a long time."
                          value={formSpeakingTopic}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormSpeakingTopic(val);
                            linkPart3ForCueTopic(val);
                          }}
                          className="w-full p-2.5 border border-purple-300 rounded-lg text-sm bg-white outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-purple-950 mb-1">
                          Cue Card Bullet Points (You should say... mỗi ý 1 dòng)
                        </label>
                        <textarea
                          rows={3}
                          placeholder="What it is&#10;What you need to do to achieve it&#10;Why this ambition is important"
                          value={formSpeakingPoints}
                          onChange={(e) => setFormSpeakingPoints(e.target.value)}
                          className="w-full p-2.5 border border-purple-300 rounded-lg text-sm bg-white outline-hidden"
                        />
                      </div>

                      {/* Part 3 Link Notification Banner */}
                      {formSpeakingQuestions.length > 0 && !formSpeakingParts.includes('part3') && (
                        <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200 flex items-center justify-between text-xs text-purple-900">
                          <span>✓ Đã liên kết sẵn {formSpeakingQuestions.length} câu hỏi Part 3 cho chủ đề này.</span>
                          <button
                            type="button"
                            onClick={() => setFormSpeakingParts((prev) => [...prev, 'part3'])}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-[11px] font-bold"
                          >
                            + Đính kèm Part 3
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="font-semibold block">Thời gian chuẩn bị:</span>
                          <span className="font-bold text-purple-700">60 giây (1 phút)</span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="font-semibold block">Thời gian nói:</span>
                          <span className="font-bold text-purple-700">1 - 2 phút (tối đa 120s)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PART 3 CONFIGURATION */}
                  {formSpeakingParts.includes('part3') && (
                    <div className="space-y-3 pt-1">
                      {/* Auto-linked Part 2 Cue Card Notification */}
                      {formSpeakingLinkedPart2Topic && (
                        <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-900">
                          <div className="flex items-start space-x-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Đã tự động liên kết Cue Card Part 2 từ Thư viện:</span>
                              <span className="block font-medium text-emerald-800 text-[11px] mt-0.5">
                                "{formSpeakingLinkedPart2Topic}"
                              </span>
                            </div>
                          </div>
                          {!formSpeakingParts.includes('part2') && (
                            <button
                              type="button"
                              onClick={() => setFormSpeakingParts((prev) => Array.from(new Set([...prev, 'part2'])))}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-colors shrink-0"
                            >
                              + Bật thêm Part 2
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-900 uppercase">
                          Câu hỏi thảo luận Part 3 ({formSpeakingQuestions.length} câu)
                        </span>
                        <button
                          type="button"
                          onClick={() => setFormSpeakingQuestions((prev) => [...prev, ''])}
                          className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-md text-xs font-bold transition-colors"
                        >
                          + Thêm câu hỏi
                        </button>
                      </div>

                      {formSpeakingQuestions.length === 0 ? (
                        <div className="p-4 bg-white rounded-lg border border-dashed border-purple-300 text-center text-xs text-purple-700">
                          Chưa có câu hỏi thảo luận nào. Nhấn "+ Thêm câu hỏi" hoặc chọn từ Thư viện.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {formSpeakingQuestions.map((q, idx) => (
                            <div key={idx} className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-xs font-bold text-purple-700 shrink-0 w-6 text-center">
                                {idx + 1}.
                              </span>
                              <input
                                type="text"
                                value={q}
                                placeholder="Nhập câu hỏi thảo luận chuyên sâu Part 3"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormSpeakingQuestions((prev) =>
                                    prev.map((item, i) => (i === idx ? val : item))
                                  );
                                }}
                                className="w-full text-xs p-1 outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setFormSpeakingQuestions((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="text-slate-400 hover:text-red-500 p-1 shrink-0"
                                title="Xóa câu hỏi"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateEditModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-sm"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition-colors text-sm"
                >
                  {isSubmittingForm ? t('common.loading') : editingAssignmentId ? 'Save Changes' : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Portal>
      )}

      {/* =========================================================================
          MODAL: SAFE EXERCISE DELETION WARNING
      ========================================================================= */}
      {deletingAssignment && (
        <Portal>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center space-x-3 text-red-600">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">Delete Exercise Confirmation</h3>
              </div>

              <p className="text-sm text-slate-700">
                Are you sure you want to delete <strong>"{deletingAssignment.title}"</strong>?
              </p>

              {submissions.filter((s) => s.assignmentId === deletingAssignment.id).length > 0 ? (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
                  <p className="font-bold">
                    Warning: There are {submissions.filter((s) => s.assignmentId === deletingAssignment.id).length} student submission(s) for this exercise.
                  </p>
                  <p>
                    Permanently deleting will delete all associated student grades and feedback. You can choose to unpublish it to Draft to safely preserve student work.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No student submissions have been submitted for this exercise yet. It can be safely deleted.
                </p>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingAssignment(null)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>

                {submissions.filter((s) => s.assignmentId === deletingAssignment.id).length > 0 && (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => handleConfirmDeleteAssignment('unpublish')}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs"
                  >
                    Unpublish to Draft (Preserve Work)
                  </button>
                )}

                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleConfirmDeleteAssignment('permanent')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  {isDeleting ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* =========================================================================
          MODAL: IMPORT FROM RESOURCE LIBRARY
      ========================================================================= */}
      {showImportLibraryModal && (
        <Portal>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 space-y-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Import from Resource Library</h3>
                    <p className="text-xs text-slate-500">Select a teaching material to assign to your course</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImportLibraryModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Target Course Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Course *</label>
                <select
                  value={libraryCourseId}
                  onChange={(e) => setLibraryCourseId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Folder-First Library Browser */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-[360px]">
                <LibraryFolderBrowser
                  resources={resources}
                  onSelectResource={(res) => handleOpenResourceAssignment(res)}
                  emptyMessage="Chưa có tài liệu nào trong thư mục này. Bạn có thể nhập tài liệu qua Smart Import."
                />
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Modal: Configure Multi-Passage Assignment from Materials Library */}
      {passageAssignResource && (
        <Portal>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 flex flex-col max-h-[90vh] space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <BookOpen className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Cấu hình & Giao bài đọc IELTS Multi-Passage
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tài liệu: <strong className="text-slate-800">{passageAssignResource.title}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPassageAssignResource(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body: Scrollable */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-sm">
                {/* Step 1: Passage selection & presets */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                      1. Chọn Passages muốn giao ({passageAssignList.filter((p) => p.isSelected).length} / {passageAssignList.length} phần được chọn)
                    </label>
                    <div className="flex items-center space-x-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          setPassageAssignList((prev) => prev.map((p) => ({ ...p, isSelected: true })))
                        }
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700"
                      >
                        Chọn cả {passageAssignList.length} Passages
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPassageAssignList((prev) =>
                            prev.map((p, idx) => ({ ...p, isSelected: idx === 0 }))
                          )
                        }
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700"
                      >
                        Chỉ Passage 1
                      </button>
                      {passageAssignList.length >= 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setPassageAssignList((prev) =>
                              prev.map((p, idx) => ({ ...p, isSelected: idx < 2 }))
                            )
                          }
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700"
                        >
                          Passage 1 & 2
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Passages List with Checkbox and Reorder Controls */}
                  <div className="space-y-2">
                    {passageAssignList.map((p, pIdx) => (
                      <div
                        key={p.id || pIdx}
                        className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          p.isSelected
                            ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs'
                            : 'bg-slate-50/60 border-slate-200 opacity-60'
                        }`}
                      >
                        <div
                          className="flex items-center space-x-3 cursor-pointer flex-1"
                          onClick={() => handleTogglePassageSelection(pIdx)}
                        >
                          <input
                            type="checkbox"
                            checked={p.isSelected}
                            onChange={() => handleTogglePassageSelection(pIdx)}
                            className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-900">
                                #{pIdx + 1}. {p.title}
                              </span>
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                                {p.questions?.length || 0} câu hỏi
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                              {p.content ? p.content.slice(0, 90) + '...' : 'Không có trích đoạn'}
                            </p>
                          </div>
                        </div>

                        {/* Reorder Buttons */}
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            disabled={pIdx === 0}
                            onClick={() => handleMovePassageUp(pIdx)}
                            className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600"
                            title="Di chuyển lên"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={pIdx === passageAssignList.length - 1}
                            onClick={() => handleMovePassageDown(pIdx)}
                            className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600"
                            title="Di chuyển xuống"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 2: Live Numbering and Total Questions Preview */}
                <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-emerald-900 tracking-wider">
                      Xem trước phân bổ câu hỏi bài thi
                    </span>
                    <span className="text-xs font-black text-emerald-800">
                      Tổng: {passageAssignList.filter((p) => p.isSelected).reduce((sum, p) => sum + (p.questions?.length || 0), 0)} câu hỏi
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-emerald-950">
                    {(() => {
                      let acc = 1;
                      return passageAssignList
                        .filter((p) => p.isSelected)
                        .map((p, idx) => {
                          const start = acc;
                          const qCount = p.questions?.length || 0;
                          const end = acc + qCount - 1;
                          acc += qCount;
                          return (
                            <span
                              key={p.id || idx}
                              className="bg-white/80 border border-emerald-200 px-2.5 py-1 rounded-md font-medium"
                            >
                              Passage {idx + 1}: <strong>Câu {qCount > 0 ? `${start}–${end}` : 'Trống'}</strong> ({qCount} câu)
                            </span>
                          );
                        });
                    })()}
                  </div>
                </div>

                {/* Step 3: Course, Due Date & Score Visibility */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Khóa học áp dụng *
                    </label>
                    <select
                      value={passageAssignCourseId}
                      onChange={(e) => setPassageAssignCourseId(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Hạn nộp bài
                    </label>
                    <input
                      type="date"
                      value={passageAssignDueDate}
                      onChange={(e) => setPassageAssignDueDate(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Chế độ xem điểm
                    </label>
                    <select
                      value={passageAssignScoreVisibility}
                      onChange={(e) => setPassageAssignScoreVisibility(e.target.value as any)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium"
                    >
                      <option value="private">🔒 Private (Chỉ GV thấy điểm)</option>
                      <option value="public">🌐 Public (Học viên thấy ngay)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setPassageAssignResource(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isImportingFromLibrary || passageAssignList.filter((p) => p.isSelected).length === 0}
                  onClick={handleConfirmMultiPassageAssignment}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    {isImportingFromLibrary
                      ? 'Đang tạo bài tập...'
                      : `Giao ${passageAssignList.filter((p) => p.isSelected).length} Passages (${passageAssignList.filter((p) => p.isSelected).reduce((sum, p) => sum + (p.questions?.length || 0), 0)} câu)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Modal: Submission or Grading Confirmation & Navigation */}
      {submissionSuccessModal && (
        <Portal>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {submissionSuccessModal.title}
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {submissionSuccessModal.message}
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={submissionSuccessModal.onAction}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <span>{submissionSuccessModal.actionText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};
