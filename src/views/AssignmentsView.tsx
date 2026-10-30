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
} from '../types';
import { parseDocumentStructure } from '../lib/documentExtractor';
import { gradeAssignmentSubmission, parseMaxWordsFromLimit } from '../lib/assignmentGrader';
import {
  extractAllNormalizedQuestions,
  resolveQuestionPrompt,
  extractParagraphLabelsFromPassage,
  buildQuestionRenderGroups,
  type QuestionRenderGroup,
} from '../lib/questionNormalizer';
import {
  calculateIeltsOverallBand,
  roundIeltsComponentScore,
  calculateReadingBand,
} from '../lib/ieltsScoring';
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
} from 'lucide-react';

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
  const [studentWritingTab, setStudentWritingTab] = useState<'submission' | 'model_answer'>('submission');
  const [activeHighlightedAnnotationId, setActiveHighlightedAnnotationId] = useState<string | null>(null);

  // Student active taking state
  const [readingAnswers, setReadingAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [writingDraft, setWritingDraft] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioRecorded, setAudioRecorded] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Reading Timer & Layout state
  const [timerSeconds, setTimerSeconds] = useState<number>(60 * 60); // 60 minutes default
  const [timerRunning, setTimerRunning] = useState<boolean>(true);
  const [passageFontSize, setPassageFontSize] = useState<'normal' | 'large'>('normal');

  // Split-Screen Drag state
  const [splitWidth, setSplitWidth] = useState<number>(50); // percentage for left pane
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Passage Highlighting state
  interface TextHighlight {
    id: string;
    text: string;
    color: 'yellow' | 'green' | 'pink';
  }
  const [passageHighlights, setPassageHighlights] = useState<TextHighlight[]>([]);
  const [floatingToolbarPos, setFloatingToolbarPos] = useState<{ x: number; y: number; text: string } | null>(null);

  // Multi-Passage Tab state
  const [activePassageTab, setActivePassageTab] = useState<number>(0);

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

  // Filtered assignments
  const filteredAssignments = assignments.filter((a) => {
    if (selectedSkillFilter === 'all') return true;
    return a.skill === selectedSkillFilter;
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

      // Load highlights
      const hlKey = `ielts_reading_highlights_${activeAssignment.id}_${currentUser.id}`;
      const savedHl = localStorage.getItem(hlKey);
      if (savedHl) {
        try {
          const parsedHl = JSON.parse(savedHl);
          if (Array.isArray(parsedHl)) setPassageHighlights(parsedHl);
        } catch {}
      } else {
        setPassageHighlights([]);
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

  // Passage Highlighting Handlers
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
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setFloatingToolbarPos({
      x: rect.left + rect.width / 2,
      y: Math.max(10, rect.top - 42),
      text,
    });
  };

  const handleApplyHighlight = (color: 'yellow' | 'green' | 'pink') => {
    if (!floatingToolbarPos || !activeAssignment) return;
    const newHighlight: TextHighlight = {
      id: `hl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: floatingToolbarPos.text,
      color,
    };
    const updated = [...passageHighlights, newHighlight];
    setPassageHighlights(updated);
    localStorage.setItem(
      `ielts_reading_highlights_${activeAssignment.id}_${currentUser.id}`,
      JSON.stringify(updated)
    );
    setFloatingToolbarPos(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleRemoveHighlight = (id: string) => {
    if (!activeAssignment) return;
    const updated = passageHighlights.filter((h) => h.id !== id);
    setPassageHighlights(updated);
    localStorage.setItem(
      `ielts_reading_highlights_${activeAssignment.id}_${currentUser.id}`,
      JSON.stringify(updated)
    );
  };

  const handleClearAllHighlights = () => {
    if (!activeAssignment) return;
    setPassageHighlights([]);
    localStorage.removeItem(`ielts_reading_highlights_${activeAssignment.id}_${currentUser.id}`);
  };

  // Safe highlighted passage text renderer
  const renderHighlightedPassage = (text: string) => {
    if (!passageHighlights || passageHighlights.length === 0) {
      return text;
    }

    const sorted = [...passageHighlights].sort((a, b) => b.text.length - a.text.length);
    let parts: (string | React.ReactNode)[] = [text];

    sorted.forEach((hl) => {
      const nextParts: (string | React.ReactNode)[] = [];
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
          const colorClass =
            hl.color === 'green'
              ? 'bg-emerald-200 text-emerald-950 hover:bg-emerald-300'
              : hl.color === 'pink'
              ? 'bg-pink-200 text-pink-950 hover:bg-pink-300'
              : 'bg-amber-200 text-amber-950 hover:bg-amber-300';
          nextParts.push(
            <mark
              key={`${hl.id}_${idx}`}
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveHighlight(hl.id);
              }}
              className={`${colorClass} rounded-xs px-0.5 cursor-pointer transition-colors font-medium`}
              title="Click to remove highlight"
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

      // 2. If readingQuestions is empty and this is reading, parse document structure from text
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

  // Teacher Annotation Selection Handlers
  const handleTextMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const selectedText = selection.toString().trim();
    if (selectedText.length < 2) return;

    const fullText = currentSubmission?.writingText || '';
    const startIndex = fullText.indexOf(selectedText);
    if (startIndex !== -1) {
      setActiveSelection({
        text: selectedText,
        startIndex,
        endIndex: startIndex + selectedText.length,
      });
    }
  };

  const handleAddAnnotation = () => {
    if (!activeSelection || !newAnnotationComment.trim()) return;

    const newAnnot: InlineAnnotation = {
      id: `annot-${Date.now()}`,
      startIndex: activeSelection.startIndex,
      endIndex: activeSelection.endIndex,
      selectedText: activeSelection.text,
      type: newAnnotationType,
      comment: newAnnotationComment.trim(),
      suggestion: newAnnotationSuggestion.trim() || undefined,
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
  };

  // Safe highlighted text renderer for annotations
  const renderAnnotatedText = (
    text: string,
    annots: InlineAnnotation[] = [],
    interactive = false
  ) => {
    if (!annots || annots.length === 0) {
      return <span>{text}</span>;
    }

    const valid = [...annots]
      .filter((a) => a.startIndex >= 0 && a.endIndex <= text.length && a.startIndex < a.endIndex)
      .sort((a, b) => a.startIndex - b.startIndex);

    const nonOverlapping: InlineAnnotation[] = [];
    let lastEnd = 0;
    for (const a of valid) {
      if (a.startIndex >= lastEnd) {
        nonOverlapping.push(a);
        lastEnd = a.endIndex;
      }
    }

    const parts: React.ReactNode[] = [];
    let cursor = 0;

    const typeHighlightMap: Record<InlineAnnotation['type'], string> = {
      correction: 'bg-red-100 text-red-900 border-b-2 border-red-500 hover:bg-red-200',
      grammar: 'bg-amber-100 text-amber-900 border-b-2 border-amber-500 hover:bg-amber-200',
      vocabulary: 'bg-purple-100 text-purple-900 border-b-2 border-purple-500 hover:bg-purple-200',
      suggestion: 'bg-blue-100 text-blue-900 border-b-2 border-blue-500 hover:bg-blue-200',
      praise: 'bg-emerald-100 text-emerald-900 border-b-2 border-emerald-500 hover:bg-emerald-200',
    };

    nonOverlapping.forEach((a, idx) => {
      if (a.startIndex > cursor) {
        parts.push(<span key={`text-${cursor}`}>{text.substring(cursor, a.startIndex)}</span>);
      }

      parts.push(
        <mark
          key={`annot-${a.id || idx}`}
          id={`annotation_${a.id}`}
          onClick={(e) => {
            e.stopPropagation();
            if (interactive) setActiveInspectedAnnotation(a);
          }}
          className={`px-1 py-0.5 rounded-xs transition-colors font-medium cursor-pointer ${
            typeHighlightMap[a.type] || typeHighlightMap.correction
          } ${activeInspectedAnnotation?.id === a.id || activeHighlightedAnnotationId === a.id ? 'ring-2 ring-blue-600 scale-105 inline-block shadow-xs' : ''}`}
          title={`${a.type.toUpperCase()}: ${a.comment}${a.suggestion ? ` (Suggestion: ${a.suggestion})` : ''}`}
        >
          {text.substring(a.startIndex, a.endIndex)}
        </mark>
      );

      cursor = a.endIndex;
    });

    if (cursor < text.length) {
      parts.push(<span key="text-tail">{text.substring(cursor)}</span>);
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
    setFormSpeakingTopic('');
    setFormSpeakingPoints('');
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
    setFormSpeakingTopic(a.speakingCueCard?.topic || '');
    setFormSpeakingPoints(a.speakingCueCard?.points?.join('\n') || '');
    setShowCreateEditModal(true);
  };

  // Submit Create or Update
  const handleSaveAssignmentForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCourseId || !formTitle.trim()) return;

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
        modelAnswerReleaseCondition: formModelAnswerReleaseCondition,
        scoreVisibility: formScoreVisibility,
        readingTestType: formSkill === 'reading' ? formReadingTestType : undefined,
        readingPassage: formSkill === 'reading' ? formReadingPassage : undefined,
        speakingPart: formSkill === 'speaking' ? 'part2' : undefined,
        speakingCueCard:
          formSkill === 'speaking'
            ? {
                topic: formSpeakingTopic.trim() || 'Describe an experience that taught you something valuable.',
                points: formSpeakingPoints
                  ? formSpeakingPoints.split('\n').map((p) => p.trim()).filter(Boolean)
                  : ['What the experience was', 'When it happened', 'What you learned from it'],
                prepTimeSeconds: 60,
                speakTimeSeconds: 120,
              }
            : undefined,
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
        score: gradeSummary.hasOpenEnded ? undefined : gradeSummary.bandEstimate,
        status: gradeSummary.finalStatus,
      });

      // Clear local storage draft
      localStorage.removeItem(`ielts_reading_draft_${activeAssignment.id}_${currentUser.id}`);

      const isScorePublic = activeAssignment.scoreVisibility === 'public';
      setSubmissionSuccessModal({
        title: 'Nộp bài thi Reading thành công!',
        message:
          isScorePublic && !gradeSummary.hasOpenEnded
            ? `Bạn đã hoàn thành bài thi với kết quả: ${gradeSummary.earnedScore}/${gradeSummary.maxScore} câu đúng (Band ${gradeSummary.bandEstimate}).`
            : 'Bài làm của bạn đã được ghi nhận thành công và chuyển đến giáo viên xét duyệt.',
        actionText: 'Xem chi tiết bài làm',
        onAction: () => setSubmissionSuccessModal(null),
      });
    } catch (err: any) {
      alert(err?.message || 'Có lỗi khi nộp bài thi Reading. Vui lòng kiểm tra và thử lại.');
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

    setIsSubmittingStudentWork(true);
    try {
      await submitAssignment(activeAssignment.id, {
        speakingAudioUrl: 'https://example.com/audio/student_speaking_recording.mp3',
        speakingDuration: recordingSeconds || 85,
        speakingTranscript: 'Audio recorded by student. Verified speech transcript available for teacher review.',
        status: 'submitted',
      });
      setAudioRecorded(false);

      setSubmissionSuccessModal({
        title: 'Nộp bài Speaking thành công!',
        message: 'Bản ghi âm bài nói của bạn đã được gửi đến giáo viên để đánh giá và chấm điểm.',
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
              {/* If Task 1 Academic diagram exists, show image alongside text */}
              {parentAssignment?.task1ImageUrl && (
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
              )}

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
                onMouseUp={handleTextMouseUp}
                className="bg-slate-50 p-5 rounded-lg border border-slate-200 text-base text-slate-800 font-sans leading-relaxed whitespace-pre-wrap select-text cursor-text"
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
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        {t('assignments.annotationComment')} *
                      </label>
                      <input
                        type="text"
                        value={newAnnotationComment}
                        onChange={(e) => setNewAnnotationComment(e.target.value)}
                        placeholder="e.g. Inappropriate collocation; refine to academic register."
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      {t('assignments.annotationSuggestion')}
                    </label>
                    <input
                      type="text"
                      value={newAnnotationSuggestion}
                      onChange={(e) => setNewAnnotationSuggestion(e.target.value)}
                      placeholder="e.g. substantial growth"
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={() => setActiveSelection(null)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      {t('assignments.cancelAnnotation')}
                    </button>
                    <button
                      onClick={handleAddAnnotation}
                      disabled={!newAnnotationComment.trim()}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs"
                    >
                      {t('assignments.addAnnotationBtn')}
                    </button>
                  </div>
                </div>
              )}

              {/* List of existing annotations */}
              {annotations.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-sm font-bold text-slate-700 flex items-center space-x-1.5">
                    <MessageSquare className="w-4 h-4 text-slate-500" />
                    <span>{t('assignments.inlineAnnotationsTitle')} ({annotations.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {annotations.map((annot) => (
                      <div
                        key={annot.id}
                        onClick={() => setActiveInspectedAnnotation(annot)}
                        className={`p-3 rounded-lg border text-sm transition-all cursor-pointer ${
                          activeInspectedAnnotation?.id === annot.id
                            ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                              annot.type === 'correction'
                                ? 'bg-red-100 text-red-800'
                                : annot.type === 'grammar'
                                ? 'bg-amber-100 text-amber-800'
                                : annot.type === 'vocabulary'
                                ? 'bg-purple-100 text-purple-800'
                                : annot.type === 'praise'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {annot.type}
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
            <div className="space-y-3">
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Volume2 className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="text-sm font-bold text-blue-900">{t('assignments.recordTitle')}</p>
                    <p className="text-xs text-blue-600">{t('assignments.audioVerified')}: {currentSubmission.speakingDuration}s</p>
                  </div>
                </div>
                <button className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold flex items-center space-x-1.5">
                  <Play className="w-4 h-4" />
                  <span>{t('assignments.playAudio')}</span>
                </button>
              </div>

              {currentSubmission.speakingTranscript && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
                  <span className="font-bold text-slate-700 block mb-1">{t('assignments.verifiedTranscript')}:</span>
                  <p className="text-slate-600 leading-relaxed italic">
                    "{currentSubmission.speakingTranscript}"
                  </p>
                </div>
              )}
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
                  {teacherGeneralComments && (
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
                  <input
                    type="text"
                    value={r.descriptor}
                    onChange={(e) => {
                      const newRubrics = [...gradingRubrics];
                      newRubrics[idx].descriptor = e.target.value;
                      setGradingRubrics(newRubrics);
                    }}
                    className="w-full p-2 border border-slate-300 rounded text-xs bg-white outline-hidden"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Feedback Sections: Strengths, Areas to improve, Next Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block font-semibold text-emerald-800 mb-1">{t('assignments.keyStrengths')}</label>
              <textarea
                rows={3}
                value={teacherStrengths}
                onChange={(e) => setTeacherStrengths(e.target.value)}
                placeholder="What did the student do particularly well?"
                className="w-full p-2.5 border border-emerald-300 rounded-lg outline-hidden bg-emerald-50/20 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-amber-800 mb-1">{t('assignments.improvements')}</label>
              <textarea
                rows={3}
                value={teacherAreasToImprove}
                onChange={(e) => setTeacherAreasToImprove(e.target.value)}
                placeholder="Specific linguistic or structural gaps..."
                className="w-full p-2.5 border border-amber-300 rounded-lg outline-hidden bg-amber-50/20 text-sm"
              />
            </div>
          </div>

          <div className="text-sm">
            <label className="block font-semibold text-slate-700 mb-1">{t('assignments.teacherProfComments')}</label>
            <textarea
              rows={2}
              value={teacherGeneralComments}
              onChange={(e) => setTeacherGeneralComments(e.target.value)}
              placeholder="Final encouraging and constructive feedback..."
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden text-sm"
            />
          </div>

          <div className="text-sm">
            <label className="block font-semibold text-slate-700 mb-1">{t('assignments.recommendedNextSteps')}</label>
            <input
              type="text"
              value={teacherNextSteps}
              onChange={(e) => setTeacherNextSteps(e.target.value)}
              placeholder="e.g. Redo paragraph 3 with counter-argument concession; practice 10-minute speed outline."
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden text-sm"
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
    const extractedData = extractAllNormalizedQuestions(activeAssignment);
    const questions = extractedData.questions;
    const passageMap = extractedData.passageMap;

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

    const questionRenderGroups = buildQuestionRenderGroups(questions);

    return (
      <div className={`space-y-6 ${isReading ? 'max-w-7xl mx-auto' : 'max-w-5xl mx-auto'}`}>
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
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
              <h1 className="text-2xl font-bold text-slate-900">{activeAssignment.title}</h1>
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

        {/* Instructions Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            {t('assignments.instructionsTitle')}
          </h3>
          <p className="text-sm text-slate-700 leading-relaxed">{activeAssignment.instructions}</p>
          {activeAssignment.objectives && (
            <p className="text-xs text-slate-400 mt-1 italic">{activeAssignment.objectives}</p>
          )}
        </div>

        {/* =========================================================================
            1. READING SPLIT-SCREEN WORKFLOW
        ========================================================================= */}
        {isReading && (
          <div className="space-y-6">
            {/* If Graded, Show Full Performance & Question-by-Question Breakdown Card */}
            {mySub?.status === 'graded' && mySub.readingScore && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-200/60 pb-4">
                  <div>
                    <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider block">
                      Official IELTS Reading Assessment Report
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 mt-1">
                      Final Score: {mySub.readingScore.correct} / {mySub.readingScore.total} Correct ({mySub.readingScore.percentage}%)
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Scale applied: {mySub.readingScore.testType === 'general' ? 'General Training 40-Item Scale' : 'Academic 40-Item Official Cambridge Scale'}
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <span className="text-xs text-slate-500 font-semibold block">{t('assignments.officialEstimatedBand')}</span>
                      <span className="text-3xl font-extrabold text-emerald-700">
                        Band {mySub.readingScore.estimatedBand?.toFixed(1) || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {mySub.readingScore.bandNotes && (
                  <p className="text-xs text-emerald-900 font-medium bg-white/70 p-3 rounded-lg border border-emerald-200/50">
                    {mySub.readingScore.bandNotes}
                  </p>
                )}
              </div>
            )}

            {/* Floating Highlight Toolbar */}
            {floatingToolbarPos && (
              <div
                className="fixed z-50 bg-slate-900 text-white shadow-xl rounded-xl px-2.5 py-1.5 flex items-center space-x-2 text-xs -translate-x-1/2 -translate-y-full border border-slate-700 animate-in fade-in zoom-in-95 duration-100"
                style={{ left: floatingToolbarPos.x, top: floatingToolbarPos.y }}
              >
                <span className="text-[11px] text-slate-400 font-semibold">{t('assignments.highlightText')}:</span>
                <button
                  type="button"
                  onClick={() => handleApplyHighlight('yellow')}
                  className="w-5 h-5 rounded-full bg-amber-300 hover:ring-2 hover:ring-amber-500 shadow-xs transition-transform hover:scale-110"
                  title="Yellow highlight"
                />
                <button
                  type="button"
                  onClick={() => handleApplyHighlight('green')}
                  className="w-5 h-5 rounded-full bg-emerald-400 hover:ring-2 hover:ring-emerald-600 shadow-xs transition-transform hover:scale-110"
                  title="Green highlight"
                />
                <button
                  type="button"
                  onClick={() => handleApplyHighlight('pink')}
                  className="w-5 h-5 rounded-full bg-pink-400 hover:ring-2 hover:ring-pink-600 shadow-xs transition-transform hover:scale-110"
                  title="Pink highlight"
                />
                <button
                  type="button"
                  onClick={() => setFloatingToolbarPos(null)}
                  className="p-0.5 text-slate-400 hover:text-white rounded ml-1"
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
                className="bg-white p-6 h-[calc(100vh-220px)] min-h-[550px] overflow-y-auto space-y-4 shrink-0 transition-[width] duration-75"
              >
                {/* Passage Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      {activeAssignment.passages && activeAssignment.passages.length > 1
                        ? activeAssignment.passages[safePassageIndex]?.title || `Passage ${safePassageIndex + 1}`
                        : t('assignments.readingPassageTitle')}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {passageHighlights.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllHighlights}
                        className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1 bg-red-50 hover:bg-red-100 rounded"
                      >
                        Clear Highlights ({passageHighlights.length})
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setPassageFontSize(passageFontSize === 'normal' ? 'large' : 'normal')}
                      className="text-xs text-slate-600 font-semibold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded"
                    >
                      Font: {passageFontSize === 'normal' ? '17px' : '19px'}
                    </button>

                    <span className="text-xs text-slate-400 font-mono">
                      {((activeAssignment.passages && activeAssignment.passages[safePassageIndex]?.content) || activeAssignment.readingPassage || '')
                        .split(/\s+/)
                        .filter(Boolean).length}{' '}
                      words
                    </span>
                  </div>
                </div>

                {/* Multi-Passage Tabs (If test contains multiple passages) */}
                {activeAssignment.passages && activeAssignment.passages.length > 1 && (
                  <div className="flex items-center space-x-1.5 border-b border-slate-100 pb-2 overflow-x-auto">
                    {activeAssignment.passages.map((p, pIdx) => (
                      <button
                        key={p.id || pIdx}
                        type="button"
                        onClick={() => setActivePassageTab(pIdx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 ${
                          activePassageTab === pIdx
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <span>{p.title || `Passage ${pIdx + 1}`}</span>
                        {p.questions && (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                              activePassageTab === pIdx ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {p.questions.length} Qs
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Passage Text with Highlighting */}
                <div
                  onMouseUp={handlePassageMouseUp}
                  className={`font-serif whitespace-pre-wrap text-slate-800 select-text text-justify leading-[1.7] ${
                    passageFontSize === 'normal' ? 'text-[17px]' : 'text-[19px]'
                  }`}
                >
                  {renderHighlightedPassage(
                    (activeAssignment.passages && activeAssignment.passages[safePassageIndex]?.content) ||
                      activeAssignment.readingPassage ||
                      'No reading passage text provided.'
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
                <div className="shrink-0 px-6 py-3.5 bg-white border-b border-slate-200 shadow-xs space-y-2 z-10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Question Navigator ({answeredCount} / {questions.length} Answered)
                    </span>
                    <span className="text-xs text-slate-500 font-mono font-semibold">
                      {Math.round((answeredCount / (questions.length || 1)) * 100)}% Complete
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {questions.map((q, idx) => {
                      const isAns = Boolean(readingAnswers[q.id]?.trim());
                      const isFlag = Boolean(flaggedQuestions[q.id]);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            if (passageMap[q.id] !== undefined && passageMap[q.id] !== activePassageTab) {
                              setActivePassageTab(passageMap[q.id]);
                            }
                            const el = document.getElementById(`q_${q.id}`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className={`w-7 h-7 rounded-md text-xs font-bold flex items-center justify-center transition-all ${
                            isFlag
                              ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-500'
                              : isAns
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title={`Question ${idx + 1}${isFlag ? ' (Flagged)' : isAns ? ' (Answered)' : ' (Unanswered)'}`}
                        >
                          {idx + 1}
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
                      {questionRenderGroups.map((group) => (
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

                            {group.instructions && (
                              <p className="text-xs text-slate-700 italic leading-relaxed">
                                {group.instructions}
                              </p>
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
                          </div>

                          {/* Questions in this group */}
                          <div className="space-y-4">
                            {group.questions.map(({ q, idx }) => {
                              const answer = readingAnswers[q.id] || (mySub?.readingAnswers && mySub.readingAnswers[q.id]) || '';
                              const isReadOnly = isTeacher || Boolean(mySub && mySub.status !== 'returned');
                              const result = mySub?.readingErrorAnalysis?.find((e) => e.questionId === q.id);
                              const isFlag = Boolean(flaggedQuestions[q.id]);
                              const maxWords = q.maxWords || parseMaxWordsFromLimit(q.wordLimit);
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

                                  <p className="font-semibold text-slate-800 text-sm leading-relaxed">{displayPrompt}</p>

                                  {/* Word limit note if applicable */}
                                  {maxWords && !group.wordLimit && (
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs text-amber-800 font-semibold bg-amber-50 px-2.5 py-1 rounded border border-amber-200 inline-block">
                                        Limit: NO MORE THAN {maxWords} WORD{maxWords > 1 ? 'S' : ''}
                                      </span>
                                      {isOverWordLimit && (
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
                                    <div className="space-y-2 pt-1">
                                      <div className="text-xs text-amber-900 bg-amber-50/80 border border-amber-200 px-2.5 py-1.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                        <span className="font-semibold">Which paragraph contains this information?</span>
                                        <span className="text-[11px] font-mono font-medium text-amber-800">
                                          NB: Letters may be used more than once
                                        </span>
                                      </div>

                                      <div className="flex flex-wrap gap-1.5 pt-1">
                                        {(q.options && q.options.length > 0 ? q.options : paragraphLabels).map((label) => {
                                          const letter = label.match(/([A-Za-z])/i)?.[1]?.toUpperCase() || label;
                                          const isSelected =
                                            answer.toUpperCase() === letter || answer.toUpperCase() === label.toUpperCase();
                                          return (
                                            <button
                                              key={label}
                                              type="button"
                                              disabled={isReadOnly}
                                              onClick={() => handleAnswerChange(q.id, letter)}
                                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                                isSelected
                                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                              }`}
                                            >
                                              Paragraph {letter}
                                            </button>
                                          );
                                        })}
                                      </div>

                                      <div className="pt-1">
                                        <select
                                          disabled={isReadOnly}
                                          value={answer}
                                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                          className="w-full sm:w-72 p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                        >
                                          <option value="">-- Or select paragraph from dropdown --</option>
                                          {(q.options && q.options.length > 0 ? q.options : paragraphLabels).map((label) => {
                                            const letter = label.match(/([A-Za-z])/i)?.[1]?.toUpperCase() || label;
                                            return (
                                              <option key={label} value={letter}>
                                                Paragraph {letter}
                                              </option>
                                            );
                                          })}
                                        </select>
                                      </div>
                                    </div>
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
                                      {q.options.map((opt) => {
                                        const selectedList = answer ? answer.split(',').map((s) => s.trim()) : [];
                                        const isChecked = selectedList.includes(opt);
                                        return (
                                          <label
                                            key={opt}
                                            className={`flex items-center space-x-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                                              isChecked
                                                ? 'bg-blue-50 border border-blue-300 text-blue-900 font-semibold'
                                                : 'hover:bg-slate-100'
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              disabled={isReadOnly}
                                              checked={isChecked}
                                              onChange={(e) => {
                                                let updated = [...selectedList];
                                                if (e.target.checked) {
                                                  updated.push(opt);
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
                      ))}
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
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border border-indigo-200 rounded-2xl p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-200/70 pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Award className="w-5 h-5 text-indigo-600" />
                      <span className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider">
                        Official IELTS Writing Assessment & Band Score Report
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mt-1">
                      {mySub.status === 'graded' ? 'Teacher Assessment Published' : 'Teacher Revision Requested'}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {mySub.status === 'graded'
                        ? 'Evaluation strictly based on official IELTS 9-band criteria.'
                        : 'Your teacher has reviewed your essay and provided notes for revision.'}
                    </p>
                  </div>

                  <div className="text-right bg-white px-5 py-3 rounded-xl border border-indigo-100 shadow-xs">
                    <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Overall Band Score</span>
                    <span className="text-3xl font-black text-indigo-600">
                      Band {mySub.score ? Number(mySub.score).toFixed(1) : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* 4 Official IELTS Criteria Rubrics Breakdown */}
                {mySub.rubricScores && mySub.rubricScores.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Official IELTS Criteria Breakdown
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {mySub.rubricScores.map((rubric) => (
                        <div key={rubric.criterion} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">{rubric.criterion}</span>
                            <span className="text-xs font-extrabold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
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

                {/* Strengths & Areas to Improve Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mySub.strengths && (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center space-x-1.5 text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold uppercase tracking-wider">Key Strengths</span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{mySub.strengths}</p>
                    </div>
                  )}

                  {mySub.areasToImprove && (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center space-x-1.5 text-amber-800">
                        <TrendingUp className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-bold uppercase tracking-wider">Areas for Improvement</span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{mySub.areasToImprove}</p>
                    </div>
                  )}
                </div>

                {/* Detailed Teacher Comments */}
                {mySub.teacherComments && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-2xs">
                    <div className="flex items-center space-x-1.5 text-slate-800">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold uppercase tracking-wider">Teacher's Detailed Feedback</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{mySub.teacherComments}</p>
                  </div>
                )}

                {/* Next Steps & Recommended Practice */}
                {mySub.nextSteps && (
                  <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-xl p-4 space-y-2">
                    <div className="flex items-center space-x-1.5 text-indigo-900">
                      <Lightbulb className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold uppercase tracking-wider">Next Steps & Targeted Action</span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{mySub.nextSteps}</p>
                  </div>
                )}

                {/* Teacher In-line Annotations on Essay */}
                {mySub.annotations && mySub.annotations.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                        Teacher In-Text Annotations ({mySub.annotations.length})
                      </span>
                      <span className="text-[11px] text-blue-600 font-medium">
                        Click vào thẻ nhận xét để cuộn đến đoạn văn tương ứng
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {mySub.annotations.map((ann, aIdx) => (
                        <div
                          key={ann.id || aIdx}
                          onClick={() => handleAnnotationClick(ann.id)}
                          className="text-xs p-3 rounded-xl bg-amber-50/70 border border-amber-200 hover:border-amber-400 hover:bg-amber-100/50 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3 shadow-2xs group"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center space-x-1.5 text-slate-500 font-medium text-[11px]">
                              <Eye className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
                              <span>Đoạn văn được nhận xét:</span>
                            </div>
                            <div className="font-serif italic text-slate-800 bg-white/80 p-2 rounded border border-amber-100 leading-relaxed">
                              "{ann.selectedText || (ann as any).highlightedText}"
                            </div>
                            <div className="font-sans font-semibold text-amber-950 mt-1">
                              {ann.comment}
                            </div>
                            {ann.suggestion && (
                              <div className="text-emerald-800 font-medium bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 mt-1 text-[11px]">
                                <strong className="text-emerald-900">Gợi ý sửa:</strong> {ann.suggestion}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-200/80 text-amber-900">
                              {ann.type || (ann as any).category || 'Feedback'}
                            </span>
                            <span className="text-[11px] text-blue-600 font-bold group-hover:underline flex items-center space-x-0.5">
                              <span>Xem trên bài</span>
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
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

              {/* Task 1 Diagram Image */}
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
            </div>

            {/* Tabs: Student Submission vs Model Answer */}
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
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
                <span>Bài nộp của bạn {mySub ? '(Đã ghi nhận)' : ''}</span>
              </button>

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
                  <Sparkles className="w-3.5 h-3.5" />
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

            {/* View B: Student Submission Tab */}
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
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
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

                {/* Detailed Teacher Comments */}
                {mySub.teacherComments && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-2xs">
                    <div className="flex items-center space-x-1.5 text-slate-800">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold uppercase tracking-wider">Teacher's Comprehensive Feedback</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{mySub.teacherComments}</p>
                  </div>
                )}

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

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {t('assignments.cueCardTitle')} ({activeAssignment.speakingPart?.toUpperCase() || 'PART 2'})
              </h3>

              {activeAssignment.speakingCueCard && (
                <div className="p-5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-3">
                  <p className="text-base font-bold text-slate-900">
                    {activeAssignment.speakingCueCard.topic}
                  </p>
                  <p className="text-xs font-semibold text-slate-600">{t('assignments.youShouldSay')}</p>
                  <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                    {activeAssignment.speakingCueCard.points.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                  <div className="pt-2 text-xs text-slate-500 flex space-x-4">
                    <span>{t('assignments.prepTime')}: {activeAssignment.speakingCueCard.prepTimeSeconds}s</span>
                    <span>{t('assignments.speakingTime')}: 1-2 minutes</span>
                  </div>
                </div>
              )}

              {/* Audio Recorder Simulation */}
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto text-2xl">
                  <Mic className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Simulate Audio Submission</h4>
                  <p className="text-xs text-slate-500">Record speaking response for teacher feedback and band scoring.</p>
                </div>

                <div className="flex justify-center space-x-3">
                  <button
                    onClick={() => {
                      setAudioRecorded(true);
                      setRecordingSeconds(92);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                  >
                    Simulate Complete Recording (92s)
                  </button>
                  <button
                    onClick={handleSpeakingSubmit}
                    disabled={!audioRecorded}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Submit Audio
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

                {/* =========================================================================
            4. GENERAL ASSIGNMENT FALLBACK WORKFLOW
        ========================================================================= */}
        {!isReading && !isWriting && !isSpeaking && (
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

      {/* Filter Tabs */}
      <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg border border-slate-200 text-sm w-fit">
        {(['all', 'reading', 'writing', 'speaking'] as const).map((skill) => (
          <button
            key={skill}
            onClick={() => setSelectedSkillFilter(skill)}
            className={`px-3 py-1.5 rounded-md capitalize font-medium transition-all ${
              selectedSkillFilter === skill
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {skill === 'all' ? t('skills.all') : t(`skills.${skill}` as any)}
          </button>
        ))}
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
            {isTeacher
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
                    <option value="writing">{t('skills.writing')}</option>
                    <option value="reading">{t('skills.reading')}</option>
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
                <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200 space-y-3">
                  <label className="block font-bold text-purple-900">{t('assignments.cueCardTitle')} - Topic</label>
                  <input
                    type="text"
                    placeholder="e.g. Describe an ambition that you have had for a long time."
                    value={formSpeakingTopic}
                    onChange={(e) => setFormSpeakingTopic(e.target.value)}
                    className="w-full p-2.5 border border-purple-300 rounded-lg text-sm bg-white outline-hidden"
                  />
                  <label className="block font-bold text-purple-900">Cue Card Bullet Points (One per line)</label>
                  <textarea
                    rows={3}
                    placeholder="What it is&#10;What you need to do to achieve it&#10;Why this ambition is important"
                    value={formSpeakingPoints}
                    onChange={(e) => setFormSpeakingPoints(e.target.value)}
                    className="w-full p-2.5 border border-purple-300 rounded-lg text-sm bg-white outline-hidden"
                  />
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

              {/* Search Input */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search library resources by title, skill, or tag..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Resources List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
                {resources
                  .filter((r) => {
                    if (!librarySearch) return true;
                    const q = librarySearch.toLowerCase();
                    return (
                      r.title.toLowerCase().includes(q) ||
                      (r.tags && r.tags.some((t) => t.toLowerCase().includes(q))) ||
                      (r.skill && r.skill.toLowerCase().includes(q))
                    );
                  })
                  .map((res) => (
                    <div
                      key={res.id}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 transition-all flex items-center justify-between"
                    >
                      <div className="space-y-0.5 max-w-[70%]">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-slate-900 truncate">{res.title}</span>
                          {res.skill && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {res.skill}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {res.content ? `${res.content.slice(0, 100)}...` : res.url || 'Library study material'}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isImportingFromLibrary}
                        onClick={() => handleImportResourceToAssignment(res)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors shrink-0"
                      >
                        {isImportingFromLibrary ? 'Assigning...' : 'Assign to Course'}
                      </button>
                    </div>
                  ))}

                {resources.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    No materials found in your resource library yet. You can upload documents via Smart Import.
                  </div>
                )}
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
