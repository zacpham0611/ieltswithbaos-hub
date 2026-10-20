import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import {
  Assignment,
  Submission,
  AssignmentSkill,
  SubmissionStatus,
  ReadingQuestion,
  InlineAnnotation,
} from '../types';
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
} from 'lucide-react';

export const AssignmentsView: React.FC = () => {
  const {
    currentUser,
    courses,
    courseMembers,
    assignments,
    createAssignment,
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
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Assignment Creation Form State
  const [newCourseId, setNewCourseId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newSkill, setNewSkill] = useState<AssignmentSkill>('writing');
  const [newInstructions, setNewInstructions] = useState('');
  const [newObjectives, setNewObjectives] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newWritingPrompt, setNewWritingPrompt] = useState('');
  const [newWritingMinWords, setNewWritingMinWords] = useState(250);
  const [newSpeakingTopic, setNewSpeakingTopic] = useState('');
  const [newSpeakingPoints, setNewSpeakingPoints] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Student active taking state
  const [readingAnswers, setReadingAnswers] = useState<Record<string, string>>({});
  const [writingDraft, setWritingDraft] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioRecorded, setAudioRecorded] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Standard IELTS Rubrics
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

  // Revision return prompt
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnComments, setReturnComments] = useState('');

  // Scoped assignments
  const visibleAssignments = isTeacher
    ? assignments.filter((a) => {
        const course = courses.find((c) => c.id === a.courseId);
        return course?.teacherId === currentUser.id;
      })
    : assignments.filter((a) => {
        const isEnrolled = courseMembers.some(
          (m) => m.courseId === a.courseId && m.studentId === currentUser.id && m.status === 'enrolled'
        );
        return isEnrolled && a.status === 'published';
      });

  const filteredAssignments = visibleAssignments.filter(
    (a) => selectedSkillFilter === 'all' || a.skill === selectedSkillFilter
  );

  const activeAssignment = selectedAssignmentId
    ? assignments.find((a) => a.id === selectedAssignmentId)
    : null;

  // Active submission for the student (or selected by teacher)
  const currentSubmission = isTeacher
    ? submissions.find((s) => s.id === selectedSubmissionId)
    : submissions.find(
        (s) => s.assignmentId === selectedAssignmentId && s.studentId === currentUser.id
      );

  // Synchronize grading form whenever currentSubmission changes
  React.useEffect(() => {
    if (!currentSubmission) return;

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
    setOverallScore(currentSubmission.score ?? 7.0);
    setAnnotations(currentSubmission.annotations || []);
    setActiveSelection(null);
    setActiveInspectedAnnotation(null);
  }, [currentSubmission?.id]);

  // Teacher text selection listener on student essay
  const handleTextMouseUp = () => {
    if (!isTeacher) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !currentSubmission?.writingText) {
      return;
    }

    const selectedStr = selection.toString().trim();
    if (!selectedStr) return;

    const rawText = currentSubmission.writingText;
    const matchIndex = rawText.indexOf(selectedStr);
    if (matchIndex !== -1) {
      setActiveSelection({
        text: selectedStr,
        startIndex: matchIndex,
        endIndex: matchIndex + selectedStr.length,
      });
      setNewAnnotationComment('');
      setNewAnnotationSuggestion('');
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
          onClick={(e) => {
            e.stopPropagation();
            if (interactive) setActiveInspectedAnnotation(a);
          }}
          className={`px-1 py-0.5 rounded-xs transition-colors font-medium cursor-pointer ${
            typeHighlightMap[a.type] || typeHighlightMap.correction
          } ${activeInspectedAnnotation?.id === a.id ? 'ring-2 ring-blue-600' : ''}`}
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

  // Count words in writing draft
  const wordCount = writingDraft.trim().length === 0 ? 0 : writingDraft.trim().split(/\s+/).length;

  // Teacher Create Assignment Handler
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseId || !newTitle.trim()) return;

    setIsSubmittingCreate(true);
    try {
      const assignmentData: Omit<Assignment, 'id'> = {
        courseId: newCourseId,
        title: newTitle.trim(),
        instructions: newInstructions.trim() || 'Complete the assignment following the guidelines.',
        skill: newSkill,
        objectives: newObjectives.trim() || 'Develop IELTS proficiency.',
        dueDate: newDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        status: 'published',
        writingTaskType: newSkill === 'writing' ? 'task2' : undefined,
        writingPrompt: newSkill === 'writing' ? newWritingPrompt.trim() : undefined,
        writingMinWords: newSkill === 'writing' ? newWritingMinWords : undefined,
        speakingPart: newSkill === 'speaking' ? 'part2' : undefined,
        speakingCueCard:
          newSkill === 'speaking'
            ? {
                topic: newSpeakingTopic.trim() || 'Describe an experience that taught you something valuable.',
                points: newSpeakingPoints
                  ? newSpeakingPoints.split('\n').filter((p) => p.trim())
                  : ['What the experience was', 'When it happened', 'What you learned from it'],
                prepTimeSeconds: 60,
                speakTimeSeconds: 120,
              }
            : undefined,
      };

      await createAssignment(assignmentData);
      setShowCreateModal(false);
      setNewTitle('');
      setNewInstructions('');
      setNewObjectives('');
      setNewWritingPrompt('');
      setNewSpeakingTopic('');
      setNewSpeakingPoints('');
    } catch (err: any) {
      alert(err.message || 'Error creating assignment');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Auto-scoring logic for reading
  const handleReadingSubmit = async () => {
    if (!activeAssignment || !activeAssignment.readingQuestions) return;

    const questions = activeAssignment.readingQuestions;
    let correctCount = 0;
    const errorAnalysis = questions.map((q) => {
      const userAns = (readingAnswers[q.id] || '').trim().toLowerCase();
      const correctAns = q.correctAnswer.trim().toLowerCase();
      const isCorrect = userAns === correctAns;
      if (isCorrect) correctCount++;
      return {
        questionId: q.id,
        userAnswer: readingAnswers[q.id] || '(No answer)',
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const percentage = Math.round((correctCount / questions.length) * 100);
    const bandEstimate = percentage >= 90 ? 9.0 : percentage >= 75 ? 7.5 : percentage >= 50 ? 6.0 : 4.5;

    await submitAssignment(activeAssignment.id, {
      readingAnswers,
      readingScore: { correct: correctCount, total: questions.length, percentage },
      readingErrorAnalysis: errorAnalysis,
      score: bandEstimate,
      status: 'graded',
    });
  };

  // Submit writing
  const handleWritingSubmit = async () => {
    if (!activeAssignment || !writingDraft.trim()) return;

    await submitAssignment(activeAssignment.id, {
      writingText: writingDraft,
      writingWordCount: wordCount,
      status: 'submitted',
    });
  };

  // Submit speaking
  const handleSpeakingSubmit = async () => {
    if (!activeAssignment) return;

    await submitAssignment(activeAssignment.id, {
      speakingAudioUrl: 'https://example.com/audio/student_speaking_recording.mp3',
      speakingDuration: recordingSeconds || 85,
      speakingTranscript: 'Audio recorded by student. Verified speech transcript available for teacher review.',
      status: 'submitted',
    });
    setAudioRecorded(false);
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
        setOverallScore(7.0);
      } else if (sub.skill === 'speaking') {
        setGradingRubrics([
          { criterion: 'Fluency & Coherence', score: 7.0, descriptor: 'Speaks at length with noticeable rhythm.' },
          { criterion: 'Lexical Resource', score: 7.0, descriptor: 'Resourceful range of descriptive phrases.' },
          { criterion: 'Grammar', score: 6.5, descriptor: 'A few minor tense inconsistencies when describing the past.' },
          { criterion: 'Pronunciation', score: 7.0, descriptor: 'Clear enunciation with appropriate intonation patterns.' },
        ]);
        setTeacherStrengths('Natural speaking cadence and spontaneous delivery on the cue card.');
        setTeacherAreasToImprove('Keep past tense verb consistency when describing origins.');
        setTeacherGeneralComments('Good performance. Clear accent, intelligible throughout.');
        setTeacherNextSteps('Practice abstract Part 3 discussion points with prompt follow-ups.');
        setOverallScore(7.0);
      }
      setIsAiDrafting(false);
    }, 600);
  };

  const handleSaveDraft = async () => {
    if (!currentSubmission) return;

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
  };

  const handleFinalizeGrading = async () => {
    if (!currentSubmission) return;

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

    setSelectedSubmissionId(null);
  };

  const handleConfirmReturn = async () => {
    if (!currentSubmission || !returnComments.trim()) return;
    await returnForRevision(currentSubmission.id, returnComments);
    setShowReturnModal(false);
    setSelectedSubmissionId(null);
  };

  // If a submission is being inspected/graded by the teacher
  if (isTeacher && currentSubmission) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
          <div>
            <button
              onClick={() => setSelectedSubmissionId(null)}
              className="text-xs font-semibold text-blue-600 hover:underline mb-1 block"
            >
              &larr; {t('common.back')}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {t('assignments.reviewingHeader')} {currentSubmission.skill.toUpperCase()}: {currentSubmission.assignmentTitle}
              </h1>
              {currentSubmission.isDraft && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  {t('assignments.draftBadge')}
                </span>
              )}
              {currentSubmission.status === 'graded' && !currentSubmission.isDraft && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {t('assignments.publishedBadge')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {t('assessments.studentLabel')}: <span className="font-bold text-slate-700">{currentSubmission.studentName}</span> · {currentSubmission.submittedAt}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleGenerateAiFeedback(currentSubmission)}
              disabled={isAiDrafting}
              className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>{isAiDrafting ? t('assignments.analyzing') : t('assignments.aiDraftFeedback')}</span>
            </button>

            <button
              onClick={() => {
                setShowReturnModal(true);
                setReturnComments('');
              }}
              className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('assignments.returnRevisionBtn')}</span>
            </button>
          </div>
        </div>

        {/* Student Submission Display & Inline Annotation Suite */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">{t('assignments.studentWork')}</h2>
            {currentSubmission.skill === 'writing' && (
              <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {t('assignments.wordCountLabel')}: {currentSubmission.writingWordCount || 0}
              </span>
            )}
            {currentSubmission.skill === 'speaking' && (
              <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {t('assignments.durationLabel')}: {currentSubmission.speakingDuration}s
              </span>
            )}
          </div>

          {currentSubmission.skill === 'writing' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600 bg-blue-50/70 p-2.5 rounded-lg border border-blue-200">
                <span className="flex items-center space-x-1.5 text-blue-900 font-medium">
                  <Highlighter className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{t('assignments.selectTextPrompt')}</span>
                </span>
                <span className="font-semibold text-slate-600 shrink-0 ml-2">
                  {annotations.length} {t('assignments.inlineAnnotationsTitle').toLowerCase()}
                </span>
              </div>

              {/* Essay Text with Highlights */}
              <div
                onMouseUp={handleTextMouseUp}
                className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs text-slate-800 font-sans leading-relaxed whitespace-pre-wrap select-text cursor-text"
              >
                {renderAnnotatedText(currentSubmission.writingText || '', annotations, true)}
              </div>

              {/* Annotation creation popover */}
              {activeSelection && (
                <div className="p-4 bg-white border-2 border-blue-500 rounded-xl shadow-lg space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t('assignments.addAnnotationBtn')}:</span>
                      <span className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
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
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {t('assignments.annotationType')}
                      </label>
                      <select
                        value={newAnnotationType}
                        onChange={(e) => setNewAnnotationType(e.target.value as any)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                      >
                        <option value="correction">{t('assignments.typeCorrection')}</option>
                        <option value="grammar">{t('assignments.typeGrammar')}</option>
                        <option value="vocabulary">{t('assignments.typeVocabulary')}</option>
                        <option value="suggestion">{t('assignments.typeSuggestion')}</option>
                        <option value="praise">{t('assignments.typePraise')}</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {t('assignments.annotationComment')} *
                      </label>
                      <input
                        type="text"
                        value={newAnnotationComment}
                        onChange={(e) => setNewAnnotationComment(e.target.value)}
                        placeholder="e.g. Inappropriate collocation; refine to academic register."
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {t('assignments.annotationSuggestion')}
                    </label>
                    <input
                      type="text"
                      value={newAnnotationSuggestion}
                      onChange={(e) => setNewAnnotationSuggestion(e.target.value)}
                      placeholder="e.g. substantial growth"
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
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
                  <h4 className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span>{t('assignments.inlineAnnotationsTitle')} ({annotations.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {annotations.map((annot) => (
                      <div
                        key={annot.id}
                        onClick={() => setActiveInspectedAnnotation(annot)}
                        className={`p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                          activeInspectedAnnotation?.id === annot.id
                            ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
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
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="font-mono text-[11px] text-slate-700 font-semibold mb-0.5">
                          "{annot.selectedText}"
                        </p>
                        <p className="text-slate-600">{annot.comment}</p>
                        {annot.suggestion && (
                          <p className="text-[11px] text-emerald-700 font-semibold mt-1">
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
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Volume2 className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-xs font-bold text-blue-900">{t('assignments.recordTitle')}</p>
                    <p className="text-[11px] text-blue-600">{t('assignments.audioVerified')}: {currentSubmission.speakingDuration}s</p>
                  </div>
                </div>
                <button className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold flex items-center space-x-1">
                  <Play className="w-3.5 h-3.5" />
                  <span>{t('assignments.playAudio')}</span>
                </button>
              </div>

              {currentSubmission.speakingTranscript && (
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
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
            <div className="p-3 bg-slate-100/70 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 flex items-center space-x-1 mb-2">
                <History className="w-3.5 h-3.5" />
                <span>{t('assignments.revisionHistory')} ({currentSubmission.writingRevisions.length} {t('assignments.draft')})</span>
              </span>
              <div className="space-y-1">
                {currentSubmission.writingRevisions.map((rev, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{t('assignments.draft')} {i + 1} ({rev.wordCount} words)</span>
                    <span>{rev.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Teacher Feedback & Rubric Grading Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Award className="w-4 h-4 text-blue-600" />
              <span>{t('assignments.assessmentRubricTitle')}</span>
            </h2>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-600">{t('assignments.overallBand')}:</span>
              <input
                type="number"
                step="0.5"
                min="1.0"
                max="9.0"
                value={overallScore}
                onChange={(e) => setOverallScore(Number(e.target.value))}
                className="w-16 p-1 border border-slate-300 rounded text-center font-bold text-sm text-blue-700"
              />
            </div>
          </div>

          {/* 4 Rubric Criteria */}
          <div className="space-y-3">
            {gradingRubrics.map((r, idx) => (
              <div key={r.criterion} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-800">{r.criterion}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500 text-[11px]">{t('assignments.score')}:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="1.0"
                      max="9.0"
                      value={r.score}
                      onChange={(e) => {
                        const newRubrics = [...gradingRubrics];
                        newRubrics[idx].score = Number(e.target.value);
                        setGradingRubrics(newRubrics);
                      }}
                      className="w-14 p-1 border border-slate-300 rounded text-center font-semibold text-slate-800 bg-white"
                    />
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
                  className="w-full p-1.5 border border-slate-300 rounded text-[11px] bg-white outline-hidden"
                />
              </div>
            ))}
          </div>

          {/* Feedback Sections: Strengths, Areas to improve, Next Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-emerald-800 mb-1">{t('assignments.keyStrengths')}</label>
              <textarea
                rows={3}
                value={teacherStrengths}
                onChange={(e) => setTeacherStrengths(e.target.value)}
                placeholder="What did the student do particularly well?"
                className="w-full p-2.5 border border-emerald-300 rounded-lg outline-hidden bg-emerald-50/20"
              />
            </div>

            <div>
              <label className="block font-semibold text-amber-800 mb-1">{t('assignments.improvements')}</label>
              <textarea
                rows={3}
                value={teacherAreasToImprove}
                onChange={(e) => setTeacherAreasToImprove(e.target.value)}
                placeholder="Specific linguistic or structural gaps..."
                className="w-full p-2.5 border border-amber-300 rounded-lg outline-hidden bg-amber-50/20"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">{t('assignments.teacherProfComments')}</label>
            <textarea
              rows={2}
              value={teacherGeneralComments}
              onChange={(e) => setTeacherGeneralComments(e.target.value)}
              placeholder="Final encouraging and constructive feedback..."
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
            />
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">{t('assignments.recommendedNextSteps')}</label>
            <input
              type="text"
              value={teacherNextSteps}
              onChange={(e) => setTeacherNextSteps(e.target.value)}
              placeholder="e.g. Redo paragraph 3 with counter-argument concession; practice 10-minute speed outline."
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              {draftSaveNotice && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 animate-in fade-in">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('assignments.draftSaved')}</span>
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedSubmissionId(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveDraft}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5"
              >
                <Save className="w-4 h-4 text-slate-500" />
                <span>{t('assignments.saveDraftBtn')}</span>
              </button>
              <button
                onClick={handleFinalizeGrading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{t('assignments.finalizeAndSend')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal: Return for revision */}
        {showReturnModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 mb-2">{t('assignments.returnModalTitle')}</h3>
              <p className="text-xs text-slate-500 mb-3">
                {t('assignments.returnModalDesc')}
              </p>
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
        )}
      </div>
    );
  }

  // Active Assignment View for Student or Teacher preview
  if (activeAssignment) {
    const mySub = submissions.find(
      (s) => s.assignmentId === activeAssignment.id && s.studentId === currentUser.id
    );

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <button
              onClick={() => setSelectedAssignmentId(null)}
              className="text-xs font-semibold text-blue-600 hover:underline mb-1 block"
            >
              &larr; {t('common.back')}
            </button>
            <div className="flex items-center space-x-2">
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                  activeAssignment.skill === 'reading'
                    ? 'bg-emerald-100 text-emerald-800'
                    : activeAssignment.skill === 'writing'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {activeAssignment.skill}
              </span>
              <h1 className="text-xl font-bold text-slate-900">{activeAssignment.title}</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">Due date: {activeAssignment.dueDate}</p>
          </div>

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

        {/* Instructions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            {t('assignments.instructionsTitle')}
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">{activeAssignment.instructions}</p>
          {activeAssignment.objectives && (
            <p className="text-xs text-slate-400 mt-1 italic">{activeAssignment.objectives}</p>
          )}
        </div>

        {/* 1. READING WORKFLOW */}
        {activeAssignment.skill === 'reading' && (
          <div className="space-y-6">
            {/* Reading Passage */}
            {activeAssignment.readingPassage && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  {t('assignments.readingPassageTitle')}
                </h3>
                <div className="text-xs text-slate-800 leading-relaxed font-serif whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-200">
                  {activeAssignment.readingPassage}
                </div>
              </div>
            )}

            {/* Reading Questions */}
            {activeAssignment.readingQuestions && activeAssignment.readingQuestions.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {t('assignments.comprehensionQuestions')}
                </h3>

                {activeAssignment.readingQuestions.map((q, idx) => {
                  const answer = readingAnswers[q.id] || '';
                  const result = mySub?.readingErrorAnalysis?.find((e) => e.questionId === q.id);

                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-xl border text-xs space-y-3 ${
                        result
                          ? result.isCorrect
                            ? 'border-emerald-300 bg-emerald-50/20'
                            : 'border-red-300 bg-red-50/20'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          {t('assignments.question')} {idx + 1} ({q.type.replace(/_/g, ' ')})
                        </span>
                        {result && (
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              result.isCorrect
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {result.isCorrect ? t('assignments.correct') : t('assignments.incorrect')}
                          </span>
                        )}
                      </div>

                      <p className="font-semibold text-slate-800">{q.prompt}</p>

                      {q.options && q.options.length > 0 ? (
                        <div className="space-y-1.5">
                          {q.options.map((opt) => (
                            <label
                              key={opt}
                              className={`flex items-center space-x-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                                answer === opt ? 'bg-blue-50 border border-blue-300 text-blue-900 font-semibold' : 'hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q_${q.id}`}
                                disabled={mySub?.status === 'graded'}
                                checked={answer === opt}
                                onChange={() => setReadingAnswers({ ...readingAnswers, [q.id]: opt })}
                                className="text-blue-600"
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div>
                          <input
                            type="text"
                            disabled={mySub?.status === 'graded'}
                            placeholder={t('assignments.typeAnswerPlaceholder')}
                            value={answer}
                            onChange={(e) => setReadingAnswers({ ...readingAnswers, [q.id]: e.target.value })}
                            className="w-full sm:w-64 p-2 border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                      )}

                      {(result || isTeacher) && (
                        <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                          <span className="font-bold text-slate-700">{t('assignments.answerKey')}: </span>
                          <span className="font-semibold text-emerald-700">{q.correctAnswer}</span>
                          <p className="mt-0.5 text-slate-500">
                            <span className="font-semibold">{t('assignments.explanation')}: </span>
                            {q.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!isTeacher && (!mySub || mySub.status === 'returned') && (
                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={handleReadingSubmit}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center space-x-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{t('assignments.submitAutoScore')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. WRITING WORKFLOW */}
        {activeAssignment.skill === 'writing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {t('assignments.essayPrompt')} ({activeAssignment.writingTaskType?.toUpperCase() || 'TASK 2'})
                </h3>
                <span className="text-xs text-slate-500">
                  {t('assignments.targetWords', { words: String(activeAssignment.writingMinWords || 250) })}
                </span>
              </div>
              {activeAssignment.writingPrompt && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 leading-relaxed">
                  {activeAssignment.writingPrompt}
                </div>
              )}

              {/* Text Editor with live word counter */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 text-xs">{t('assignments.academicResponse')}</label>
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                      wordCount >= (activeAssignment.writingMinWords || 250)
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {wordCount} / {activeAssignment.writingMinWords || 250} words
                  </span>
                </div>
                <textarea
                  rows={14}
                  value={writingDraft || mySub?.writingText || ''}
                  onChange={(e) => setWritingDraft(e.target.value)}
                  placeholder={t('assignments.typeEssayPlaceholder')}
                  className="w-full p-4 text-xs font-sans border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden leading-relaxed"
                />
              </div>

              {!isTeacher && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleWritingSubmit}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center space-x-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>{mySub ? t('assignments.resubmitRevision') : t('assignments.submitWriting')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Feedback Display if graded */}
            {mySub?.status === 'graded' && !mySub?.isDraft && (
              <div className="bg-white rounded-xl border border-emerald-200 p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-slate-900">{t('assignments.finalFeedbackTitle')}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {t('assignments.publishedBadge')}
                    </span>
                  </div>
                  <span className="text-lg font-extrabold text-blue-700">Band: {mySub.score}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {mySub.rubricScores?.map((r) => (
                    <div key={r.criterion} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex justify-between font-bold text-slate-800 mb-1">
                        <span>{r.criterion}</span>
                        <span className="text-blue-600">{r.score}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{r.descriptor}</p>
                    </div>
                  ))}
                </div>

                {/* Inline Annotations for Student Writing */}
                {mySub.writingText && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <Highlighter className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t('assignments.studentAnnotationsHeader')}</span>
                    </h4>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs text-slate-800 font-sans leading-relaxed whitespace-pre-wrap">
                      {renderAnnotatedText(mySub.writingText, mySub.annotations || [])}
                    </div>

                    {mySub.annotations && mySub.annotations.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {mySub.annotations.map((annot) => (
                          <div
                            key={annot.id}
                            className="p-3 rounded-lg border border-slate-200 bg-white text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
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
                            </div>
                            <p className="font-mono text-[11px] text-slate-700 font-semibold">
                              "{annot.selectedText}"
                            </p>
                            <p className="text-slate-600">{annot.comment}</p>
                            {annot.suggestion && (
                              <p className="text-[11px] text-emerald-700 font-semibold">
                                &rarr; {annot.suggestion}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">{t('assignments.noAnnotationsYet')}</p>
                    )}
                  </div>
                )}

                <div className="text-xs space-y-2 pt-2 border-t border-slate-100">
                  {mySub.strengths && (
                    <p className="text-emerald-800 font-semibold">{t('assignments.strengths')}: {mySub.strengths}</p>
                  )}
                  {mySub.areasToImprove && (
                    <p className="text-amber-800 font-semibold">{t('assignments.improvements')}: {mySub.areasToImprove}</p>
                  )}
                  {mySub.teacherComments && (
                    <p className="text-slate-700">{t('assignments.teacherRemarks')}: {mySub.teacherComments}</p>
                  )}
                  {mySub.nextSteps && (
                    <p className="text-blue-700 font-bold">{t('assignments.nextSteps')}: {mySub.nextSteps}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. SPEAKING WORKFLOW */}
        {activeAssignment.skill === 'speaking' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {t('assignments.cueCardTitle')} ({activeAssignment.speakingPart?.toUpperCase() || 'PART 2'})
              </h3>

              {activeAssignment.speakingCueCard && (
                <div className="p-5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-3">
                  <p className="text-sm font-bold text-slate-900">
                    {activeAssignment.speakingCueCard.topic}
                  </p>
                  <p className="text-xs font-semibold text-slate-600">{t('assignments.youShouldSay')}</p>
                  <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                    {activeAssignment.speakingCueCard.points.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                  <div className="pt-2 text-[11px] text-slate-500 flex space-x-4">
                    <span>{t('assignments.prepTime')}: {activeAssignment.speakingCueCard.prepTimeSeconds}s</span>
                    <span>{t('assignments.speakingTime')}: 1–2 minutes</span>
                  </div>
                </div>
              )}

              {/* Audio Recorder Simulation */}
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto text-2xl">
                  {isRecording ? <Mic className="w-8 h-8 text-red-600 animate-pulse" /> : <Mic className="w-8 h-8" />}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {isRecording
                      ? `${t('assignments.recordingInProgress')} (${recordingSeconds}s)`
                      : audioRecorded
                      ? t('assignments.recordedSuccess')
                      : t('assignments.recordTitle')}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {t('assignments.recordDesc')}
                  </p>
                </div>

                <div className="flex justify-center space-x-3">
                  {!isRecording ? (
                    <button
                      onClick={() => {
                        setIsRecording(true);
                        setRecordingSeconds(1);
                        const interval = setInterval(() => {
                          setRecordingSeconds((prev) => {
                            if (prev >= 115) {
                              clearInterval(interval);
                              setIsRecording(false);
                              setAudioRecorded(true);
                              return 115;
                            }
                            return prev + 1;
                          });
                        }, 1000);
                      }}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-2"
                    >
                      <Mic className="w-4 h-4" />
                      <span>{t('assignments.startRecording')}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setIsRecording(false);
                        setAudioRecorded(true);
                      }}
                      className="px-5 py-2.5 bg-slate-800 hover:bg-black text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-2"
                    >
                      <Square className="w-4 h-4" />
                      <span>{t('assignments.stopRecording')} ({recordingSeconds}s)</span>
                    </button>
                  )}
                </div>

                {audioRecorded && !isTeacher && (
                  <button
                    onClick={handleSpeakingSubmit}
                    className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-2 mx-auto"
                  >
                    <Send className="w-4 h-4" />
                    <span>{t('assignments.submitSpeaking')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Teacher Submissions Overview for this Assignment */}
        {isTeacher && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <FileCheck2 className="w-4 h-4 text-blue-600" />
                <span>Submissions for this Assignment</span>
              </h3>
              <span className="text-xs text-slate-500 font-semibold">
                {submissions.filter((s) => s.assignmentId === activeAssignment.id).length} submission(s)
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {submissions.filter((s) => s.assignmentId === activeAssignment.id).length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">
                  No student submissions received for this assignment yet.
                </p>
              ) : (
                submissions
                  .filter((s) => s.assignmentId === activeAssignment.id)
                  .map((sub) => (
                    <div
                      key={sub.id}
                      className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-900">{sub.studentName}</span>
                          {sub.status === 'graded' && !sub.isDraft && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Graded · Band {sub.score}
                            </span>
                          )}
                          {sub.isDraft && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              {t('assignments.draftBadge')}
                            </span>
                          )}
                          {(sub.status === 'submitted' || sub.status === 'resubmitted') && !sub.isDraft && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                              {sub.status}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Submitted: {sub.submittedAt}
                        </p>
                      </div>

                      <button
                        onClick={() => setSelectedSubmissionId(sub.id)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                      >
                        {sub.status === 'graded' && !sub.isDraft ? 'Review / Edit Feedback' : t('assignments.reviewAndGrade')} &rarr;
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Listing View
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
          <button
            onClick={() => {
              if (courses.length > 0 && !newCourseId) {
                setNewCourseId(courses[0].id);
              }
              setShowCreateModal(true);
            }}
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('assignments.createBtn')}</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs w-fit">
        {(['all', 'reading', 'writing', 'speaking'] as const).map((skill) => (
          <button
            key={skill}
            onClick={() => setSelectedSkillFilter(skill)}
            className={`px-3 py-1 rounded-md capitalize font-medium transition-all ${
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
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>{t('assignments.pendingReviewTitle')}</span>
            </h2>
            <span className="text-xs text-slate-400">
              {submissions.filter((s) => s.status !== 'graded' || s.isDraft).length} {t('common.status').toLowerCase()}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {submissions.filter((s) => s.status !== 'graded' || s.isDraft).length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">{t('assignments.allGradedMsg')}</p>
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
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            sub.skill === 'reading'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sub.skill === 'writing'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {sub.skill}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{sub.assignmentTitle}</span>
                        {sub.isDraft && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            {t('assignments.draftBadge')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        By {sub.studentName} ({sub.courseName}) · {sub.submittedAt}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedSubmissionId(sub.id);
                      }}
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
          <h3 className="text-sm font-bold text-slate-700">{t('common.empty')}</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
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

            return (
              <div
                key={a.id}
                onClick={() => setSelectedAssignmentId(a.id)}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer p-5 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        a.skill === 'reading'
                          ? 'bg-emerald-100 text-emerald-800'
                          : a.skill === 'writing'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {a.skill}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Due: {a.dueDate}</span>
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-1">
                    {a.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                    {a.instructions}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs">
                  {!isTeacher && studentSub ? (
                    <span
                      className={`font-semibold capitalize text-[11px] ${
                        studentSub.status === 'graded'
                          ? 'text-emerald-600'
                          : studentSub.status === 'returned'
                          ? 'text-red-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {studentSub.status === 'graded' ? `Graded: Band ${studentSub.score}` : studentSub.status}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[11px]">
                      {isTeacher ? t('common.manage') : t('status.notSubmitted')}
                    </span>
                  )}
                  <span className="font-semibold text-blue-600 group-hover:translate-x-1 transition-transform flex items-center">
                    <span>{t('common.enter')}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Teacher: Create Assignment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">{t('assignments.createBtn')}</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('resources.selectCourse')}</label>
                <select
                  required
                  value={newCourseId}
                  onChange={(e) => setNewCourseId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
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
                  <label className="block font-semibold text-slate-700 mb-1">{t('resources.resourceSkill')}</label>
                  <select
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value as AssignmentSkill)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
                  >
                    <option value="writing">{t('skills.writing')}</option>
                    <option value="speaking">{t('skills.speaking')}</option>
                    <option value="reading">{t('skills.reading')}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('courses.endDate')}</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('resources.resourceTitle')}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cambridge 18 Test 2 Writing Task 2"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('assignments.instructionsTitle')}</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Complete under timed conditions. Write at least 250 words."
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              {/* Skill specific prompts */}
              {newSkill === 'writing' && (
                <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200 space-y-2">
                  <label className="block font-bold text-amber-900">{t('assignments.essayPrompt')}</label>
                  <textarea
                    rows={3}
                    placeholder="Type the full IELTS Writing prompt here..."
                    value={newWritingPrompt}
                    onChange={(e) => setNewWritingPrompt(e.target.value)}
                    className="w-full p-2 border border-amber-300 rounded-lg text-xs bg-white outline-hidden"
                  />
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-600">Min words:</span>
                    <input
                      type="number"
                      value={newWritingMinWords}
                      onChange={(e) => setNewWritingMinWords(Number(e.target.value))}
                      className="w-20 p-1 border border-amber-300 rounded text-center bg-white"
                    />
                  </div>
                </div>
              )}

              {newSkill === 'speaking' && (
                <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-200 space-y-2">
                  <label className="block font-bold text-purple-900">{t('assignments.cueCardTitle')} - Topic</label>
                  <input
                    type="text"
                    placeholder="e.g. Describe an ambition that you have had for a long time."
                    value={newSpeakingTopic}
                    onChange={(e) => setNewSpeakingTopic(e.target.value)}
                    className="w-full p-2 border border-purple-300 rounded-lg text-xs bg-white outline-hidden"
                  />
                  <label className="block font-bold text-purple-900">Cue Card Bullet Points (One per line)</label>
                  <textarea
                    rows={3}
                    placeholder="What it is&#10;What you need to do to achieve it&#10;Why this ambition is important"
                    value={newSpeakingPoints}
                    onChange={(e) => setNewSpeakingPoints(e.target.value)}
                    className="w-full p-2 border border-purple-300 rounded-lg text-xs bg-white outline-hidden"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition-colors"
                >
                  {isSubmittingCreate ? t('common.loading') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
