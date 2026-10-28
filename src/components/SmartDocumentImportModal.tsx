import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import { ReadingQuestion, QuestionType, AssignmentSkill } from '../types';
import {
  processDocumentFile,
  ExtractedDocument,
  DocumentStructure,
} from '../lib/documentExtractor';
import {
  generateDocxBlob,
  downloadDocxBlob,
  blobToDataUrl,
} from '../lib/docxGenerator';
import { convertDocumentToAssignment } from '../lib/ai';
import { Portal } from './Portal';
import {
  FileUp,
  FileText,
  FileSpreadsheet,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Download,
  Save,
  Plus,
  Trash2,
  Edit3,
  Eye,
  BookOpen,
  FileCheck2,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Clock,
  Layers,
  GraduationCap,
  HelpCircle,
} from 'lucide-react';

interface SmartDocumentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssignmentCreated?: () => void;
  onResourceCreated?: () => void;
}

type WizardStep = 'upload' | 'preview' | 'choose_output' | 'config_word' | 'config_assignment' | 'review_assignment';

export const SmartDocumentImportModal: React.FC<SmartDocumentImportModalProps> = ({
  isOpen,
  onClose,
  onAssignmentCreated,
  onResourceCreated,
}) => {
  const { currentUser, courses, createAssignment, addResource } = useApp();
  const { t } = useI18n();

  // Wizard Navigation
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<ExtractedDocument[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  // Active Document Extracted & Edited Content
  const [editedTitle, setEditedTitle] = useState('');
  const [editedRawText, setEditedRawText] = useState('');
  const [editedPassage, setEditedPassage] = useState('');
  const [previewTab, setPreviewTab] = useState<'structured' | 'raw'>('structured');
  const [selectedCandidateTestId, setSelectedCandidateTestId] = useState<string | 'combined'>('combined');

  // Hierarchical Tree View State
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedPassageId, setSelectedPassageId] = useState<string | null>(null);
  const [expandedTestIds, setExpandedTestIds] = useState<Record<string, boolean>>({});
  const [editableQuestions, setEditableQuestions] = useState<ReadingQuestion[]>([]);

  // Word Configuration State
  const [wordTemplateStyle, setWordTemplateStyle] = useState<'academic' | 'clean'>('academic');
  const [wordCourseTitle, setWordCourseTitle] = useState('');
  const [wordTeacherName, setWordTeacherName] = useState(currentUser?.name || 'IELTS Instructor');
  const [wordTargetBand, setWordTargetBand] = useState('Band 7.0+');
  const [wordIncludeKey, setWordIncludeKey] = useState(true);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [docxSuccessNotice, setDocxSuccessNotice] = useState<string | null>(null);

  // Interactive Assignment Configuration State
  const [assignCourseId, setAssignCourseId] = useState(courses[0]?.id || '');
  const [assignSkill, setAssignSkill] = useState<AssignmentSkill>('reading');
  const [assignConversionMode, setAssignConversionMode] = useState<'preserve_questions' | 'generate_new' | 'mixed'>('preserve_questions');
  const [assignTargetBand, setAssignTargetBand] = useState('6.5 - 7.5');
  const [assignDueDate, setAssignDueDate] = useState('2026-10-30');
  const [assignInstructions, setAssignInstructions] = useState('Read the text carefully and answer all questions.');
  const [assignReleasePolicy, setAssignReleasePolicy] = useState<'after_submission' | 'immediate' | 'never'>('after_submission');

  // Enabled Question Types
  const [enabledQuestionTypes, setEnabledQuestionTypes] = useState<QuestionType[]>([
    'multiple_choice',
    'true_false_not_given',
    'matching',
    'sentence_completion',
  ]);

  // AI & Assignment Review State
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiProcessingStage, setAiProcessingStage] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiGeneratedResult, setIsAiGeneratedResult] = useState(false);
  const [reviewedTitle, setReviewedTitle] = useState('');
  const [reviewedInstructions, setReviewedInstructions] = useState('');
  const [reviewedPassage, setReviewedPassage] = useState('');
  const [reviewedQuestions, setReviewedQuestions] = useState<ReadingQuestion[]>([]);
  const [teacherNotes, setTeacherNotes] = useState('');
  const [isStudentPreview, setIsStudentPreview] = useState(false);
  const [previewStudentAnswers, setPreviewStudentAnswers] = useState<Record<string, string>>({});
  const [isPublishingAssignment, setIsPublishingAssignment] = useState(false);

  if (!isOpen) return null;

  const activeDoc = uploadedFiles.find((f) => f.id === activeFileId) || uploadedFiles[0];

  // ==========================================
  // HANDLERS: FILE UPLOAD
  // ==========================================
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFiles(true);
    const newDocs: ExtractedDocument[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const doc = await processDocumentFile(file);
        newDocs.push(doc);
      } catch (err: any) {
        newDocs.push({
          id: `doc_${Date.now()}_${i}`,
          name: file.name,
          size: file.size,
          type: 'unknown',
          rawText: '',
          status: 'error',
          errorMessage: err.message || 'Extraction failed.',
        });
      }
    }

    setUploadedFiles((prev) => [...prev, ...newDocs]);
    setIsProcessingFiles(false);

    // Set first successfully parsed doc as active
    const firstReady = newDocs.find((d) => d.status === 'ready');
    if (firstReady) {
      selectActiveDocument(firstReady);
    }
  };

  const selectActiveDocument = (doc: ExtractedDocument) => {
    setActiveFileId(doc.id);
    const candidateTests = doc.detectedStructure?.candidateTests || [];
    const tests = doc.detectedStructure?.tests || [];

    if (tests.length > 0) {
      const firstTest = tests[0];
      const firstPassage = firstTest.passages[0];
      setSelectedTestId(firstTest.id);
      setExpandedTestIds({ [firstTest.id]: true });
      if (firstPassage) {
        setSelectedPassageId(firstPassage.id);
        setEditedTitle(firstPassage.title || `${doc.name} - Passage 1`);
        setEditedPassage(firstPassage.content);
        setEditableQuestions(firstPassage.questions || []);
      } else {
        setEditableQuestions(firstTest.allQuestions || []);
      }
    } else if (candidateTests.length > 1) {
      setSelectedCandidateTestId(candidateTests[0].id);
      setEditedTitle(candidateTests[0].title || doc.name.replace(/\.[^/.]+$/, ''));
      setEditedPassage(candidateTests[0].passageText);
      setAssignInstructions(candidateTests[0].instructions || 'Read the text carefully and answer all questions.');
      setEditableQuestions(candidateTests[0].questions || []);
    } else {
      setSelectedCandidateTestId('combined');
      setEditedTitle(doc.detectedStructure?.title || doc.name.replace(/\.[^/.]+$/, ''));
      setEditedPassage(doc.detectedStructure?.passageText || doc.rawText);
      setAssignInstructions(doc.detectedStructure?.instructions || 'Read the text carefully and answer all questions.');
      setEditableQuestions(doc.detectedStructure?.questions || []);
    }
    setEditedRawText(doc.rawText);
    setAssignSkill(doc.detectedStructure?.detectedSkill || 'reading');
  };

  const handleToggleExpandTest = (testId: string) => {
    setExpandedTestIds((prev) => ({ ...prev, [testId]: !prev[testId] }));
  };

  const handleSelectPassageFromTree = (testId: string, passageId: string) => {
    setSelectedTestId(testId);
    setSelectedPassageId(passageId);
    if (!activeDoc?.detectedStructure) return;

    const testMatch = activeDoc.detectedStructure.tests?.find((t) => t.id === testId);
    const passageMatch = testMatch?.passages.find((p) => p.id === passageId);
    if (passageMatch) {
      setEditedTitle(passageMatch.title);
      setEditedPassage(passageMatch.content);
      setEditableQuestions(passageMatch.questions || []);
    }
  };

  const handleSelectCandidateTest = (candidateId: string | 'combined') => {
    setSelectedCandidateTestId(candidateId);
    if (!activeDoc?.detectedStructure) return;
    const tests = activeDoc.detectedStructure.candidateTests || [];
    if (candidateId === 'combined') {
      setEditedTitle(activeDoc.detectedStructure.title || activeDoc.name.replace(/\.[^/.]+$/, ''));
      setEditedPassage(activeDoc.detectedStructure.passageText || activeDoc.rawText);
      setAssignInstructions(activeDoc.detectedStructure.instructions || 'Read the text carefully and answer all questions.');
      setEditableQuestions(activeDoc.detectedStructure.questions || []);
    } else {
      const match = tests.find((t) => t.id === candidateId);
      if (match) {
        setEditedTitle(match.title);
        setEditedPassage(match.passageText);
        setAssignInstructions(match.instructions || 'Read the text carefully and answer all questions.');
        setEditableQuestions(match.questions || []);
      }
    }
  };

  const handleAssignCurrentPassageDirectly = async () => {
    if (!assignCourseId) {
      alert('Please select a course first.');
      return;
    }
    setIsPublishingAssignment(true);
    try {
      await createAssignment({
        courseId: assignCourseId,
        title: editedTitle || `${activeDoc?.name} - Reading Practice`,
        instructions: assignInstructions,
        skill: assignSkill,
        objectives: `Master Band ${assignTargetBand} through reading practice.`,
        dueDate: assignDueDate,
        status: 'published',
        readingPassage: editedPassage,
        readingQuestions: editableQuestions,
        readingTestType: 'academic',
        answerReleasePolicy: assignReleasePolicy,
        sourceDocumentName: activeDoc?.name,
      });
      alert('Passage assigned to course successfully!');
      onAssignmentCreated?.();
      onClose();
    } catch (err: any) {
      alert(`Assignment creation failed: ${err.message}`);
    } finally {
      setIsPublishingAssignment(false);
    }
  };

  const handleBatchSaveAllTestsToLibrary = async () => {
    if (!activeDoc || !currentUser) return;
    setIsPublishingAssignment(true);
    try {
      const tests = activeDoc.detectedStructure?.tests || [];
      if (tests.length > 0) {
        for (const t of tests) {
          for (const p of t.passages) {
            await addResource({
              title: `${t.title}: ${p.title}`,
              type: 'doc',
              content: p.content,
              tags: ['smart-import', 'reading', t.title],
              skill: 'reading',
              folder: t.title,
              courseId: assignCourseId || null,
              isPublished: true,
            });
          }
        }
      } else {
        const cTests = activeDoc.detectedStructure?.candidateTests || [];
        for (const ct of cTests) {
          await addResource({
            title: ct.title,
            type: 'doc',
            content: ct.passageText,
            tags: ['smart-import', 'reading'],
            skill: 'reading',
            folder: 'Imported Tests',
            courseId: assignCourseId || null,
            isPublished: true,
          });
        }
      }
      alert('All tests saved to Resource Library!');
      onResourceCreated?.();
    } catch (err: any) {
      alert(`Failed to save to library: ${err.message}`);
    } finally {
      setIsPublishingAssignment(false);
    }
  };

  const handleSaveAllCandidateTestsAsSeparate = async (status: 'draft' | 'published') => {
    if (!activeDoc?.detectedStructure?.candidateTests?.length || !assignCourseId) {
      alert('Please select a course.');
      return;
    }

    setIsPublishingAssignment(true);
    try {
      const tests = activeDoc.detectedStructure.candidateTests;
      for (const t of tests) {
        await createAssignment({
          courseId: assignCourseId,
          title: t.title || `${editedTitle} - Passage ${t.testIndex}`,
          instructions: t.instructions || assignInstructions,
          skill: assignSkill,
          objectives: `Master Band ${assignTargetBand} through interactive ${assignSkill} practice.`,
          dueDate: assignDueDate,
          status,
          readingPassage: t.passageText,
          readingQuestions: t.questions,
          readingTestType: 'academic',
          answerReleasePolicy: assignReleasePolicy,
          sourceDocumentName: activeDoc.name,
        });
      }

      alert(`Successfully saved ${tests.length} separate assignments!`);
      onAssignmentCreated?.();
      onClose();
    } catch (err: any) {
      alert(`Failed to save separate assignments: ${err.message}`);
    } finally {
      setIsPublishingAssignment(false);
    }
  };

  // ==========================================
  // HANDLERS: WORD CONVERSION
  // ==========================================
  const handleDownloadWord = async () => {
    if (!activeDoc) return;
    setIsGeneratingDocx(true);
    try {
      const blob = await generateDocxBlob({
        title: editedTitle || activeDoc.name,
        courseTitle: wordCourseTitle || courses.find((c) => c.id === assignCourseId)?.name || 'IELTS Preparation Course',
        teacherName: wordTeacherName,
        targetBand: wordTargetBand,
        instructions: assignInstructions,
        passage: editedPassage,
        questions: activeDoc.detectedStructure?.questions || [],
        rawText: editedRawText,
        templateStyle: wordTemplateStyle,
        includeAnswerKey: wordIncludeKey,
      });

      downloadDocxBlob(blob, `${editedTitle || 'IELTS_Document'}.docx`);
      setDocxSuccessNotice('Word document downloaded successfully!');
      setTimeout(() => setDocxSuccessNotice(null), 4000);
    } catch (err: any) {
      alert(`Word generation failed: ${err.message}`);
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  const handleSaveWordToResources = async () => {
    if (!activeDoc || !currentUser) return;
    setIsGeneratingDocx(true);
    try {
      const blob = await generateDocxBlob({
        title: editedTitle || activeDoc.name,
        courseTitle: wordCourseTitle || courses.find((c) => c.id === assignCourseId)?.name,
        teacherName: wordTeacherName,
        targetBand: wordTargetBand,
        instructions: assignInstructions,
        passage: editedPassage,
        questions: activeDoc.detectedStructure?.questions || [],
        rawText: editedRawText,
        templateStyle: wordTemplateStyle,
        includeAnswerKey: wordIncludeKey,
      });

      const dataUrl = await blobToDataUrl(blob);

      await addResource({
        title: `${editedTitle} (DOCX)`,
        type: 'doc',
        url: dataUrl,
        content: editedRawText.slice(0, 5000),
        tags: ['converted-docx', assignSkill, 'smart-import'],
        skill: assignSkill,
        folder: 'Converted Documents',
        courseId: assignCourseId || null,
        isPublished: true,
      });

      setDocxSuccessNotice('Saved to Resource Library!');
      onResourceCreated?.();
      setTimeout(() => setDocxSuccessNotice(null), 4000);
    } catch (err: any) {
      alert(`Failed to save to resources: ${err.message}`);
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  // ==========================================
  // HANDLERS: INTERACTIVE ASSIGNMENT AI GENERATION
  // ==========================================
  const handleStartAiConversion = async () => {
    if (!activeDoc) return;
    setIsAiProcessing(true);
    setAiError(null);
    setAiProcessingStage('Analyzing document structure and IELTS criteria with Gemini...');

    try {
      const targetCourse = courses.find((c) => c.id === assignCourseId);

      const response = await convertDocumentToAssignment({
        documentText: editedRawText || activeDoc.rawText,
        sourceDocumentName: activeDoc.name,
        conversionMode: assignConversionMode,
        skill: assignSkill,
        targetBand: assignTargetBand,
        courseName: targetCourse?.name,
      });

      setAiProcessingStage('Formatting interactive questions and answer keys...');

      let questions: ReadingQuestion[] = [];
      let title = editedTitle;
      let passage = editedPassage;
      let instructions = assignInstructions;

      if (response.structuredData) {
        setIsAiGeneratedResult(true);
        const data = response.structuredData;
        title = data.title || title;
        passage = data.readingPassage || passage;
        instructions = data.instructions || instructions;
        setTeacherNotes(data.teacherNotes || '');

        if (Array.isArray(data.questions)) {
          questions = data.questions.map((q: any, idx: number) => ({
            id: q.id || `q_${idx + 1}`,
            type: q.type || 'multiple_choice',
            prompt: q.prompt || `Question ${idx + 1}`,
            options: Array.isArray(q.options) ? q.options : undefined,
            matchingPairs: Array.isArray(q.matchingPairs) ? q.matchingPairs : undefined,
            correctAnswer: q.correctAnswer || '',
            explanation: q.explanation || 'Verified from source document.',
            points: Number(q.points) || 1,
            source: q.source || (assignConversionMode === 'generate_new' ? 'ai_generated' : 'extracted_from_doc'),
            answerKeyConfidence: q.answerKeyConfidence || 'needs_teacher_review',
            needsReview: q.answerKeyConfidence === 'needs_teacher_review' || !q.correctAnswer,
          }));
        }
      } else {
        // Fallback to local heuristic questions
        setIsAiGeneratedResult(false);
        const match = selectedCandidateTestId !== 'combined'
          ? activeDoc.detectedStructure?.candidateTests?.find((t) => t.id === selectedCandidateTestId)
          : null;
        questions = match ? match.questions : (activeDoc.detectedStructure?.questions || []);
      }

      setReviewedTitle(title);
      setReviewedPassage(passage);
      setReviewedInstructions(instructions);
      setReviewedQuestions(questions);

      setCurrentStep('review_assignment');
    } catch (err: any) {
      console.error('AI conversion error:', err);
      setIsAiGeneratedResult(false);
      setAiError(err.message || 'Gemini conversion failed. You can review locally extracted questions.');
      const match = selectedCandidateTestId !== 'combined'
        ? activeDoc.detectedStructure?.candidateTests?.find((t) => t.id === selectedCandidateTestId)
        : null;
      const fallbackQuestions = match ? match.questions : (activeDoc.detectedStructure?.questions || []);
      setReviewedTitle(editedTitle);
      setReviewedPassage(editedPassage);
      setReviewedInstructions(assignInstructions);
      setReviewedQuestions(fallbackQuestions);
      setCurrentStep('review_assignment');
    } finally {
      setIsAiProcessing(false);
      setAiProcessingStage('');
    }
  };

  const handleSaveOriginalToResources = async () => {
    if (!activeDoc || !currentUser) return;
    try {
      await addResource({
        title: `${editedTitle || activeDoc.name} (Source Document)`,
        type: activeDoc.type === 'pdf' ? 'pdf' : activeDoc.type === 'docx' ? 'doc' : 'note',
        content: editedRawText,
        tags: ['original-source', assignSkill, 'smart-import'],
        skill: assignSkill,
        folder: 'Imported Materials',
        courseId: assignCourseId || null,
        isPublished: false,
      });

      setDocxSuccessNotice('Original document saved to Resource Library!');
      onResourceCreated?.();
      setTimeout(() => setDocxSuccessNotice(null), 4000);
    } catch (err: any) {
      alert(`Failed to save original to resources: ${err.message}`);
    }
  };

  // ==========================================
  // HANDLERS: ASSIGNMENT PUBLICATION
  // ==========================================
  const handleSaveAssignment = async (status: 'draft' | 'published') => {
    if (!reviewedTitle.trim() || !assignCourseId) {
      alert('Please provide an assignment title and select a course.');
      return;
    }

    setIsPublishingAssignment(true);
    try {
      await createAssignment({
        courseId: assignCourseId,
        title: reviewedTitle.trim(),
        instructions: reviewedInstructions.trim(),
        skill: assignSkill,
        objectives: `Master Band ${assignTargetBand} through interactive ${assignSkill} document practice.`,
        dueDate: assignDueDate,
        status,
        readingPassage: reviewedPassage,
        readingQuestions: reviewedQuestions,
        writingPrompt: assignSkill === 'writing' ? reviewedPassage : undefined,
        answerReleasePolicy: assignReleasePolicy,
        sourceDocumentName: activeDoc?.name,
      });

      alert(
        status === 'published'
          ? 'Assignment published! Enrolled students have been notified.'
          : 'Assignment draft saved successfully.'
      );

      onAssignmentCreated?.();
      onClose();
    } catch (err: any) {
      alert(`Failed to save assignment: ${err.message}`);
    } finally {
      setIsPublishingAssignment(false);
    }
  };

  // Question editing helpers
  const handleUpdateQuestion = (index: number, updates: Partial<ReadingQuestion>) => {
    setReviewedQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleRemoveQuestion = (index: number) => {
    setReviewedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddQuestion = () => {
    const newQ: ReadingQuestion = {
      id: `q_custom_${Date.now()}`,
      type: 'multiple_choice',
      prompt: 'New Question Prompt',
      options: ['A. Option 1', 'B. Option 2', 'C. Option 3', 'D. Option 4'],
      correctAnswer: 'A',
      explanation: 'Teacher provided explanation.',
      points: 1,
      source: 'extracted_from_doc',
      answerKeyConfidence: 'high',
      needsReview: false,
    };
    setReviewedQuestions((prev) => [...prev, newQ]);
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* ==========================================
            MODAL HEADER & STEP PROGRESS
        ========================================== */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center space-x-2">
                <span>Smart Document Import & Converter</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded border border-blue-400/30">
                  AI-Powered
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Import PDF, DOCX, TXT → Editable Word Document or Interactive Student Assignment
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-500 overflow-x-auto">
          <div className="flex items-center space-x-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                currentStep === 'upload' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              1
            </span>
            <span className={currentStep === 'upload' ? 'text-blue-600 font-bold' : ''}>Upload</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 mx-1 shrink-0" />

          <div className="flex items-center space-x-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                currentStep === 'preview' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              2
            </span>
            <span className={currentStep === 'preview' ? 'text-blue-600 font-bold' : ''}>Preview & Edit</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 mx-1 shrink-0" />

          <div className="flex items-center space-x-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                currentStep === 'choose_output' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              3
            </span>
            <span className={currentStep === 'choose_output' ? 'text-blue-600 font-bold' : ''}>Select Output</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 mx-1 shrink-0" />

          <div className="flex items-center space-x-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                ['config_word', 'config_assignment'].includes(currentStep)
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              4
            </span>
            <span className={['config_word', 'config_assignment'].includes(currentStep) ? 'text-blue-600 font-bold' : ''}>
              Configure
            </span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 mx-1 shrink-0" />

          <div className="flex items-center space-x-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                currentStep === 'review_assignment' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              5
            </span>
            <span className={currentStep === 'review_assignment' ? 'text-blue-600 font-bold' : ''}>
              Review & Publish
            </span>
          </div>
        </div>

        {/* ==========================================
            MODAL BODY CONTENT BY STEP
        ========================================== */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* --------------------------------------
              STEP 1: UPLOAD
          --------------------------------------- */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              {/* Drag & Drop Upload Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md"
                  onChange={handleFilesSelected}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                  <FileUp className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Click to browse or drop your IELTS practice documents here
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports text-based PDF, DOCX (Word), TXT, and Markdown up to 20MB
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-[11px] font-semibold text-slate-500">
                  <span className="px-2 py-0.5 bg-slate-100 rounded">PDF</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded">DOCX</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded">TXT</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded">Markdown</span>
                </div>
              </div>

              {isProcessingFiles && (
                <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-blue-600 p-4 bg-blue-50 rounded-xl">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Extracting text, questions, and structures...</span>
                </div>
              )}

              {/* Uploaded Files Queue */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Imported Documents ({uploadedFiles.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-2.5">
                    {uploadedFiles.map((doc) => {
                      const isSelected = doc.id === (activeFileId || uploadedFiles[0]?.id);
                      return (
                        <div
                          key={doc.id}
                          onClick={() => doc.status === 'ready' && selectActiveDocument(doc)}
                          className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                              {doc.type === 'pdf' ? (
                                <FileText className="w-5 h-5 text-red-500" />
                              ) : doc.type === 'docx' ? (
                                <FileSpreadsheet className="w-5 h-5 text-blue-500" />
                              ) : (
                                <FileText className="w-5 h-5 text-emerald-500" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <p className="text-xs font-bold text-slate-900">{doc.name}</p>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase">
                                  {(doc.size / 1024).toFixed(1)} KB
                                </span>
                              </div>
                              {doc.status === 'ready' && doc.detectedStructure && (
                                <p className="text-[11px] text-slate-500">
                                  {doc.detectedStructure.questions.length > 0 ? (
                                    <span className="text-emerald-600 font-semibold">
                                      Detected {doc.detectedStructure.questions.length} questions
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">Reading passage / study text</span>
                                  )}
                                  {doc.pageCount ? ` • ${doc.pageCount} pages` : ''}
                                </p>
                              )}
                              {doc.status === 'error' && (
                                <p className="text-[11px] text-red-600 font-semibold flex items-center space-x-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>{doc.errorMessage}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {doc.status === 'ready' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectActiveDocument(doc);
                                  setCurrentStep('preview');
                                }}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center space-x-1"
                              >
                                <span>Preview & Convert</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setUploadedFiles((prev) => prev.filter((d) => d.id !== doc.id));
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --------------------------------------
              STEP 2: PREVIEW & EDIT EXTRACTED TEXT
          --------------------------------------- */}
          {currentStep === 'preview' && activeDoc && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Previewing: {activeDoc.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Review or correct extracted headings, passages, and questions before proceeding.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="bg-slate-100 p-0.5 rounded-lg flex text-xs font-semibold">
                    <button
                      onClick={() => setPreviewTab('structured')}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        previewTab === 'structured' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-slate-600'
                      }`}
                    >
                      Structured View
                    </button>
                    <button
                      onClick={() => setPreviewTab('raw')}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        previewTab === 'raw' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-slate-600'
                      }`}
                    >
                      Raw Text Editor
                    </button>
                  </div>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Document / Assignment Title
                </label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {previewTab === 'structured' ? (
                <div className="space-y-4">
                  {/* Overall Document Statistics Header */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-slate-400 font-semibold uppercase">Total Pages</span>
                      <p className="font-mono font-bold text-slate-800 text-sm">{activeDoc.pageCount || 1}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-slate-400 font-semibold uppercase">Tests Detected</span>
                      <p className="font-mono font-bold text-blue-600 text-sm">
                        {activeDoc.detectedStructure?.tests?.length || 1}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-slate-400 font-semibold uppercase">Total Passages</span>
                      <p className="font-mono font-bold text-indigo-600 text-sm">
                        {activeDoc.detectedStructure?.tests?.reduce((s, t) => s + t.passages.length, 0) ||
                          activeDoc.detectedStructure?.candidateTests?.length ||
                          1}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-slate-400 font-semibold uppercase">Total Questions</span>
                      <p className="font-mono font-bold text-emerald-600 text-sm">
                        {activeDoc.detectedStructure?.questions.length || 0}
                      </p>
                    </div>
                  </div>

                  {/* Hierarchical Document Tree View */}
                  {activeDoc.detectedStructure?.tests && activeDoc.detectedStructure.tests.length > 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                          <Layers className="w-4 h-4 text-blue-600" />
                          <span>Hierarchical Document Structure (Click passage to edit/assign)</span>
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={handleBatchSaveAllTestsToLibrary}
                            disabled={isPublishingAssignment}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 transition-colors"
                          >
                            Save All to Library
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {activeDoc.detectedStructure.tests.map((test) => {
                          const isExpanded = Boolean(expandedTestIds[test.id]);
                          return (
                            <div key={test.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                              <div
                                onClick={() => handleToggleExpandTest(test.id)}
                                className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                              >
                                <div className="flex items-center space-x-2">
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-slate-500" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-500" />
                                  )}
                                  <span className="text-xs font-bold text-slate-900">{test.title}</span>
                                </div>
                                <span className="text-[11px] font-mono font-semibold text-slate-500">
                                  {test.passages.length} Passages • {test.questionCount} Questions
                                </span>
                              </div>

                              {isExpanded && (
                                <div className="p-2 pt-0 space-y-1.5 pl-6 bg-white border-t border-slate-100">
                                  {test.passages.map((p) => {
                                    const isSelected = selectedPassageId === p.id;
                                    return (
                                      <div
                                        key={p.id}
                                        onClick={() => handleSelectPassageFromTree(test.id, p.id)}
                                        className={`p-2 rounded-lg cursor-pointer transition-all flex items-center justify-between text-xs ${
                                          isSelected
                                            ? 'bg-blue-50 border border-blue-300 text-blue-900 font-bold'
                                            : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                      >
                                        <div className="flex items-center space-x-2">
                                          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                                          <span className="truncate">{p.title}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          {p.questionGroups && p.questionGroups.length > 0 && (
                                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                                              {p.questionGroups.length} Groups
                                            </span>
                                          )}
                                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-mono font-bold">
                                            {p.questions?.length || 0} Qs
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : activeDoc.detectedStructure?.candidateTests && activeDoc.detectedStructure.candidateTests.length > 1 ? (
                    <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-900 flex items-center space-x-1.5">
                          <Layers className="w-4 h-4 text-blue-600" />
                          <span>
                            Multiple Candidate Tests Detected ({activeDoc.detectedStructure.candidateTests.length} sections)
                          </span>
                        </span>
                        <span className="text-[11px] text-blue-700 font-medium">Select a section to preview/edit:</span>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {activeDoc.detectedStructure.candidateTests.map((ct) => (
                          <button
                            key={ct.id}
                            type="button"
                            onClick={() => handleSelectCandidateTest(ct.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center space-x-1.5 ${
                              selectedCandidateTestId === ct.id
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            <span>{ct.title}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                selectedCandidateTestId === ct.id ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {ct.questionCount} Qs
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Passage Preview */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                        <BookOpen className="w-4 h-4 text-blue-600" />
                        <span>Reading Passage Text</span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold font-mono">
                        {editedPassage.split(/\s+/).filter(Boolean).length} words
                      </span>
                    </div>
                    <textarea
                      rows={6}
                      value={editedPassage}
                      onChange={(e) => setEditedPassage(e.target.value)}
                      className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      placeholder="Passage text will appear here..."
                    />
                  </div>

                  {/* In-Place Editable Questions Summary */}
                  <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                        <HelpCircle className="w-4 h-4 text-indigo-600" />
                        <span>Interactive Questions ({editableQuestions.length})</span>
                      </span>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newQ: ReadingQuestion = {
                              id: `q_${editableQuestions.length + 1}`,
                              type: 'sentence_completion',
                              prompt: `New Question ${editableQuestions.length + 1}`,
                              correctAnswer: '',
                              explanation: 'Teacher verified.',
                              points: 1,
                              source: 'extracted_from_doc',
                              answerKeyConfidence: 'high',
                            };
                            setEditableQuestions([...editableQuestions, newQ]);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center space-x-1 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Question</span>
                        </button>
                      </div>
                    </div>

                    {editableQuestions.length > 0 ? (
                      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                        {editableQuestions.map((q, idx) => (
                          <div
                            key={q.id || idx}
                            className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-slate-800">#{idx + 1}</span>
                                <select
                                  value={q.type}
                                  onChange={(e) => {
                                    const updated = [...editableQuestions];
                                    updated[idx] = { ...updated[idx], type: e.target.value as QuestionType };
                                    setEditableQuestions(updated);
                                  }}
                                  className="p-1 border border-slate-300 rounded text-xs bg-white text-slate-900 font-semibold"
                                >
                                  <option value="multiple_choice">Multiple Choice</option>
                                  <option value="multiple_select">Multiple Select</option>
                                  <option value="true_false_not_given">True / False / Not Given</option>
                                  <option value="yes_no_not_given">Yes / No / Not Given</option>
                                  <option value="matching_headings">Matching Headings</option>
                                  <option value="matching_features">Matching Features</option>
                                  <option value="matching_sentence_endings">Matching Sentence Endings</option>
                                  <option value="sentence_completion">Sentence Completion</option>
                                  <option value="summary_completion">Summary Completion</option>
                                  <option value="note_completion">Note Completion</option>
                                  <option value="table_completion">Table Completion</option>
                                  <option value="short_answer">Short Answer</option>
                                </select>
                              </div>

                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  placeholder="Answer Key"
                                  value={q.correctAnswer || ''}
                                  onChange={(e) => {
                                    const updated = [...editableQuestions];
                                    updated[idx] = { ...updated[idx], correctAnswer: e.target.value };
                                    setEditableQuestions(updated);
                                  }}
                                  className="p-1 border border-emerald-300 rounded text-xs font-mono font-bold text-emerald-800 w-28 bg-emerald-50/40"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditableQuestions(editableQuestions.filter((_, i) => i !== idx));
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-500 rounded"
                                  title="Delete question"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <input
                              type="text"
                              value={q.prompt}
                              onChange={(e) => {
                                const updated = [...editableQuestions];
                                updated[idx] = { ...updated[idx], prompt: e.target.value };
                                setEditableQuestions(updated);
                              }}
                              className="w-full p-2 border border-slate-200 rounded text-xs font-medium text-slate-800 bg-white"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                        No questions in this section. You can add questions manually or let AI generate them in the next step.
                      </p>
                    )}
                  </div>

                  {/* Quick Action Footer in Preview Step */}
                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-blue-900">Target Course:</span>
                      <select
                        value={assignCourseId}
                        onChange={(e) => setAssignCourseId(e.target.value)}
                        className="p-1.5 border border-blue-200 rounded-lg bg-white text-xs font-semibold"
                      >
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        disabled={isPublishingAssignment}
                        onClick={handleAssignCurrentPassageDirectly}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition-colors flex items-center space-x-1"
                      >
                        <span>Assign This Passage Now</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Raw Document Text (Full Content)
                  </label>
                  <textarea
                    rows={12}
                    value={editedRawText}
                    onChange={(e) => setEditedRawText(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              )}
            </div>
          )}

          {/* --------------------------------------
              STEP 3: CHOOSE OUTPUT CONVERSION
          --------------------------------------- */}
          {currentStep === 'choose_output' && (
            <div className="space-y-5">
              <div className="text-center max-w-xl mx-auto space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Select Output for: "{editedTitle}"
                </h3>
                <p className="text-xs text-slate-500">
                  Choose an output action below. You can generate a Word document and an interactive assignment from the same imported source without re-uploading.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* Option A: Convert to Word */}
                <div
                  onClick={() => setCurrentStep('config_word')}
                  className="p-5 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/20 bg-white cursor-pointer transition-all flex flex-col justify-between space-y-4 shadow-xs group"
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        Convert to Word (.docx)
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Generate an academic or minimal Microsoft Word file with headers, formatted questions, tables, and confidential answer keys.
                      </p>
                    </div>
                  </div>
                  <button className="w-full py-2 bg-blue-50 text-blue-700 font-bold text-xs rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors flex items-center justify-center space-x-1.5">
                    <span>Configure Word Export</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Option B: Interactive Assignment */}
                <div
                  onClick={() => setCurrentStep('config_assignment')}
                  className="p-5 rounded-2xl border-2 border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50/20 bg-white cursor-pointer transition-all flex flex-col justify-between space-y-4 shadow-xs group ring-1 ring-indigo-500/20"
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          Interactive Assignment
                        </h4>
                        <span className="text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.2 rounded">
                          Recommended
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Use Gemini AI to structure questions, multiple choice, matching, or generate new IELTS questions for direct student completion.
                      </p>
                    </div>
                  </div>
                  <button className="w-full py-2 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-1.5 shadow-xs">
                    <span>Generate Online Assignment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Option C: Save to Resource Library */}
                <div
                  onClick={handleSaveWordToResources}
                  className="p-5 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 bg-white cursor-pointer transition-all flex flex-col justify-between space-y-4 shadow-xs group"
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Save className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                        Save to Library
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Save original document content and metadata directly into your persistent teacher Resource Library for future use.
                      </p>
                    </div>
                  </div>
                  <button className="w-full py-2 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors flex items-center justify-center space-x-1.5">
                    <span>Save to Library</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------
              STEP 4A: CONFIGURE WORD (.DOCX)
          --------------------------------------- */}
          {currentStep === 'config_word' && (
            <div className="space-y-5">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Configure Word (.docx) Export
                  </h3>
                  <p className="text-xs text-slate-500">
                    Customize academic layout, headers, and answer key inclusion before downloading.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentStep('choose_output')}
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  ← Back to options
                </button>
              </div>

              {docxSuccessNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>{docxSuccessNotice}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Document Template Style
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setWordTemplateStyle('academic')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        wordTemplateStyle === 'academic'
                          ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-900">IELTS Academic Formal</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Official header, metadata table, serif passage</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWordTemplateStyle('clean')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        wordTemplateStyle === 'clean'
                          ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-900">Clean Minimal</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Modern simple layout, minimal framing</p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Course Name
                  </label>
                  <input
                    type="text"
                    value={wordCourseTitle}
                    placeholder="e.g. IELTS Master Writing & Reading 7.5+"
                    onChange={(e) => setWordCourseTitle(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Instructor Name
                  </label>
                  <input
                    type="text"
                    value={wordTeacherName}
                    onChange={(e) => setWordTeacherName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Target Band
                  </label>
                  <input
                    type="text"
                    value={wordTargetBand}
                    onChange={(e) => setWordTargetBand(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Include Teacher Answer Key & Explanations on Separate Page
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Appends a confidential reference table on a new page break with citations and pedagogical notes.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={wordIncludeKey}
                  onChange={(e) => setWordIncludeKey(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
                <button
                  onClick={handleSaveWordToResources}
                  disabled={isGeneratingDocx}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors flex items-center justify-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save to Resource Library</span>
                </button>
                <button
                  onClick={handleDownloadWord}
                  disabled={isGeneratingDocx}
                  className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{isGeneratingDocx ? 'Generating Word File...' : 'Download .docx Document'}</span>
                </button>
              </div>
            </div>
          )}

          {/* --------------------------------------
              STEP 4B: CONFIGURE INTERACTIVE ASSIGNMENT
          --------------------------------------- */}
          {currentStep === 'config_assignment' && (
            <div className="space-y-5">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Configure Interactive Assignment Conversion
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure target course, conversion mode, and question types for Gemini AI analysis.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentStep('choose_output')}
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  ← Back to options
                </button>
              </div>

              {aiError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Assign to Course
                  </label>
                  <select
                    value={assignCourseId}
                    onChange={(e) => setAssignCourseId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.skills.join(', ')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    IELTS Skill
                  </label>
                  <select
                    value={assignSkill}
                    onChange={(e) => setAssignSkill(e.target.value as AssignmentSkill)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                  >
                    <option value="reading">Reading (Passage + Comprehension Questions)</option>
                    <option value="writing">Writing (Task 1 or Task 2 Prompt)</option>
                    <option value="listening">Listening (Audio Script + Questions)</option>
                    <option value="speaking">Speaking (Cue Card + Discussion Questions)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Conversion Mode
                  </label>
                  <div className="space-y-1.5">
                    <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="convMode"
                        checked={assignConversionMode === 'preserve_questions'}
                        onChange={() => setAssignConversionMode('preserve_questions')}
                        className="text-blue-600"
                      />
                      <span>Preserve existing questions faithfully from document</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="convMode"
                        checked={assignConversionMode === 'generate_new'}
                        onChange={() => setAssignConversionMode('generate_new')}
                        className="text-blue-600"
                      />
                      <span>Generate new authentic IELTS questions from source text</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="convMode"
                        checked={assignConversionMode === 'mixed'}
                        onChange={() => setAssignConversionMode('mixed')}
                        className="text-blue-600"
                      />
                      <span>Mixed (Keep existing questions & augment with new ones)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Target Band & Due Date
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={assignTargetBand}
                      onChange={(e) => setAssignTargetBand(e.target.value)}
                      placeholder="Band 6.5 - 7.5"
                      className="p-2 border border-slate-300 rounded-lg text-xs"
                    />
                    <input
                      type="date"
                      value={assignDueDate}
                      onChange={(e) => setAssignDueDate(e.target.value)}
                      className="p-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Supported Question Types Checklist */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Supported Interactive Question Types to Include
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { type: 'multiple_choice', label: 'Multiple Choice (4 options)' },
                    { type: 'multiple_select', label: 'Multiple Select (2+ letters)' },
                    { type: 'true_false_not_given', label: 'True / False / Not Given' },
                    { type: 'yes_no_not_given', label: 'Yes / No / Not Given' },
                    { type: 'matching', label: 'Matching Headings / Features' },
                    { type: 'fill_in_the_blank', label: 'Fill in the Blank' },
                    { type: 'sentence_completion', label: 'Sentence Completion' },
                    { type: 'short_answer', label: 'Short Answer (Direct)' },
                    { type: 'essay', label: 'Essay / Extended Response' },
                  ].map((item) => {
                    const isChecked = enabledQuestionTypes.includes(item.type as QuestionType);
                    return (
                      <label
                        key={item.type}
                        className={`p-2.5 rounded-lg border text-xs flex items-center space-x-2 cursor-pointer transition-colors ${
                          isChecked ? 'border-blue-400 bg-blue-50/50 text-blue-900 font-semibold' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEnabledQuestionTypes([...enabledQuestionTypes, item.type as QuestionType]);
                            } else {
                              setEnabledQuestionTypes(enabledQuestionTypes.filter((t) => t !== item.type));
                            }
                          }}
                          className="rounded text-blue-600"
                        />
                        <span className="truncate">{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Answer Key Release Policy */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Answer Key & Explanation Release Policy
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { value: 'after_submission', title: 'After Submission', desc: 'Answers released once student submits' },
                    { value: 'immediate', title: 'Immediate Review', desc: 'Explanations available instantly' },
                    { value: 'never', title: 'Strict Exam Mode', desc: 'Answers kept strictly hidden' },
                  ].map((pol) => (
                    <label
                      key={pol.value}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        assignReleasePolicy === pol.value
                          ? 'border-blue-600 bg-white ring-1 ring-blue-600'
                          : 'border-slate-200 bg-white/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="releasePol"
                        checked={assignReleasePolicy === pol.value}
                        onChange={() => setAssignReleasePolicy(pol.value as any)}
                        className="hidden"
                      />
                      <p className="text-xs font-bold text-slate-900">{pol.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{pol.desc}</p>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleStartAiConversion}
                  disabled={isAiProcessing}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isAiProcessing ? 'Converting with Gemini...' : 'Analyze & Generate Interactive Assignment'}</span>
                </button>
              </div>

              {isAiProcessing && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center space-x-3 text-xs text-indigo-900">
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                  <div>
                    <p className="font-bold">Gemini AI is processing your document</p>
                    <p className="text-[11px] text-indigo-700 mt-0.5">{aiProcessingStage}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --------------------------------------
              STEP 5: TEACHER REVIEW & PUBLICATION SCREEN
          --------------------------------------- */}
          {currentStep === 'review_assignment' && (
            <div className="space-y-6">
              {/* Review Header Banner */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      Teacher Review Mode
                    </span>
                    {isAiGeneratedResult ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 flex items-center space-x-1 border border-indigo-200">
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        <span>Gemini AI Structured</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center space-x-1 border border-amber-200">
                        <FileText className="w-3 h-3 text-amber-600" />
                        <span>Local Heuristic Parser (Offline Fallback)</span>
                      </span>
                    )}
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500 font-semibold">
                      Nothing is published automatically until you confirm.
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{reviewedTitle}</h3>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsStudentPreview(!isStudentPreview)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1.5 ${
                      isStudentPreview
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    <span>{isStudentPreview ? 'Exit Student Preview' : 'Preview Student View'}</span>
                  </button>
                </div>
              </div>

              {/* Teacher Notes Banner if AI provided observations */}
              {teacherNotes && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
                  <span className="font-bold flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Pedagogical Verification Note</span>
                  </span>
                  <p className="text-[11px] text-amber-800">{teacherNotes}</p>
                </div>
              )}

              {/* Editable Assignment Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Assignment Title
                  </label>
                  <input
                    type="text"
                    value={reviewedTitle}
                    onChange={(e) => setReviewedTitle(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Student Instructions
                  </label>
                  <input
                    type="text"
                    value={reviewedInstructions}
                    onChange={(e) => setReviewedInstructions(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Passage Section */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>Reading Passage / Task Prompt</span>
                </span>
                <textarea
                  rows={6}
                  value={reviewedPassage}
                  onChange={(e) => setReviewedPassage(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 leading-relaxed"
                />
              </div>

              {/* Questions Review / Interactive Editor */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Interactive Questions ({reviewedQuestions.length})
                  </h4>
                  <button
                    onClick={handleAddQuestion}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>
                </div>

                {isStudentPreview ? (
                  // Student Interactive Simulation
                  <div className="p-6 bg-slate-50 border border-indigo-200 rounded-2xl space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                        Student View Preview Mode
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Test interactive inputs as a student would experience them.
                      </span>
                    </div>

                    {reviewedQuestions.map((q, idx) => {
                      const answer = previewStudentAnswers[q.id] || '';
                      return (
                        <div key={q.id} className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                          <span className="text-xs font-bold text-slate-900">
                            Question {idx + 1} ({q.type.replace(/_/g, ' ')})
                          </span>
                          <p className="text-xs font-medium text-slate-800">{q.prompt}</p>

                          {q.options && q.options.length > 0 ? (
                            <div className="space-y-1.5">
                              {q.options.map((opt) => (
                                <label
                                  key={opt}
                                  className={`flex items-center space-x-2.5 p-2 rounded-lg cursor-pointer text-xs ${
                                    answer === opt ? 'bg-blue-50 border border-blue-300 font-semibold' : 'hover:bg-slate-100'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`prev_${q.id}`}
                                    checked={answer === opt}
                                    onChange={() => setPreviewStudentAnswers({ ...previewStudentAnswers, [q.id]: opt })}
                                    className="text-blue-600"
                                  />
                                  <span>{opt}</span>
                                </label>
                              ))}
                            </div>
                          ) : q.type === 'true_false_not_given' || q.type === 'yes_no_not_given' ? (
                            <div className="flex space-x-2">
                              {(q.type === 'true_false_not_given'
                                ? ['TRUE', 'FALSE', 'NOT GIVEN']
                                : ['YES', 'NO', 'NOT GIVEN']
                              ).map((choice) => (
                                <button
                                  key={choice}
                                  type="button"
                                  onClick={() => setPreviewStudentAnswers({ ...previewStudentAnswers, [q.id]: choice })}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                    answer === choice
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  {choice}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={answer}
                              onChange={(e) => setPreviewStudentAnswers({ ...previewStudentAnswers, [q.id]: e.target.value })}
                              placeholder="Type your answer here..."
                              className="w-full sm:w-80 p-2 border border-slate-300 rounded-lg text-xs"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Teacher Editing Screen
                  <div className="space-y-3">
                    {reviewedQuestions.map((q, idx) => (
                      <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-slate-900">Q{idx + 1}</span>
                            <span className="text-[10px] font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700 uppercase">
                              {q.type.replace(/_/g, ' ')}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                q.source === 'extracted_from_doc'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {q.source === 'extracted_from_doc' ? 'Source Extracted' : 'AI Generated'}
                            </span>
                            {q.needsReview && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                                Review Key Needed
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleRemoveQuestion(idx)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Prompt Input */}
                        <div>
                          <input
                            type="text"
                            value={q.prompt}
                            onChange={(e) => handleUpdateQuestion(idx, { prompt: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
                            placeholder="Question text..."
                          />
                        </div>

                        {/* Options Editor for Multiple Choice */}
                        {q.options && q.options.length > 0 && (
                          <div className="space-y-1.5 pl-2 border-l-2 border-blue-200">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Answer Choices:</span>
                            {q.options.map((opt, optIdx) => (
                              <input
                                key={optIdx}
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const newOptions = [...q.options!];
                                  newOptions[optIdx] = e.target.value;
                                  handleUpdateQuestion(idx, { options: newOptions });
                                }}
                                className="w-full p-1.5 border border-slate-200 rounded text-xs"
                              />
                            ))}
                          </div>
                        )}

                        {/* Correct Answer & Explanation */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                              Correct Answer Key:
                            </label>
                            <input
                              type="text"
                              value={q.correctAnswer}
                              onChange={(e) =>
                                handleUpdateQuestion(idx, {
                                  correctAnswer: e.target.value,
                                  needsReview: false,
                                  answerKeyConfidence: 'high',
                                })
                              }
                              placeholder="e.g. A, TRUE, or answer phrase"
                              className="w-full p-1.5 border border-slate-300 rounded text-xs font-bold text-emerald-700 bg-emerald-50/20"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                              Citation / Explanation:
                            </label>
                            <input
                              type="text"
                              value={q.explanation}
                              onChange={(e) => handleUpdateQuestion(idx, { explanation: e.target.value })}
                              placeholder="Citation from passage..."
                              className="w-full p-1.5 border border-slate-300 rounded text-xs text-slate-700"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons for Saving / Publishing */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  onClick={() => setCurrentStep('choose_output')}
                  className="text-xs text-slate-600 font-bold hover:underline"
                >
                  ← Back to Output Options
                </button>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {activeDoc?.detectedStructure?.candidateTests && activeDoc.detectedStructure.candidateTests.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleSaveAllCandidateTestsAsSeparate('published')}
                      disabled={isPublishingAssignment}
                      className="w-full sm:w-auto px-4 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <Layers className="w-4 h-4" />
                      <span>Publish All {activeDoc.detectedStructure.candidateTests.length} Tests Separately</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleSaveAssignment('draft')}
                    disabled={isPublishingAssignment}
                    className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 text-slate-800 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors flex items-center justify-center space-x-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save as Draft</span>
                  </button>

                  <button
                    onClick={() => handleSaveAssignment('published')}
                    disabled={isPublishingAssignment}
                    className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{isPublishingAssignment ? 'Publishing...' : 'Publish to Students'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Back/Next Controls */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
          <div>
            {currentStep !== 'upload' && currentStep !== 'review_assignment' && (
              <button
                onClick={() => {
                  if (currentStep === 'preview') setCurrentStep('upload');
                  else if (currentStep === 'choose_output') setCurrentStep('preview');
                  else if (currentStep === 'config_word' || currentStep === 'config_assignment') {
                    setCurrentStep('choose_output');
                  }
                }}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {currentStep === 'upload' && uploadedFiles.some((d) => d.status === 'ready') && (
              <button
                onClick={() => setCurrentStep('preview')}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center space-x-1.5"
              >
                <span>Preview Document</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 'preview' && (
              <button
                onClick={() => setCurrentStep('choose_output')}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center space-x-1.5"
              >
                <span>Continue to Output Options</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
};
