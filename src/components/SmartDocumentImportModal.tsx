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
import { formatWordLimitInstruction } from '../lib/assignmentGrader';
import {
  extractSpeakingPartsFromDocument,
  type ExtractedSpeakingDocument,
  type ExtractedSpeakingPart1,
  type ExtractedSpeakingPart2,
  type ExtractedSpeakingPart2CueCard,
  type ExtractedSpeakingPart3,
} from '../lib/speakingExtractor';
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
  Check,
  AlertCircle,
  Mic,
  Volume2,
  FolderPlus,
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
  const [libraryMaterialName, setLibraryMaterialName] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [editedRawText, setEditedRawText] = useState('');
  const [editedPassage, setEditedPassage] = useState('');
  const [previewTab, setPreviewTab] = useState<'structured' | 'raw'>('structured');
  const [selectedCandidateTestId, setSelectedCandidateTestId] = useState<string | 'combined'>('combined');

  // Hierarchical Tree View State
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedPassageId, setSelectedPassageId] = useState<string | null>(null);
  const [expandedTestIds, setExpandedTestIds] = useState<Record<string, boolean>>({});
  const [isPassageBuilderExpanded, setIsPassageBuilderExpanded] = useState(false);
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

  // Document Type Selection: Reading vs Speaking
  const [importSkillType, setImportSkillType] = useState<'reading' | 'speaking'>('reading');

  // Speaking Smart Import State
  const [extractedSpeakingDoc, setExtractedSpeakingDoc] = useState<ExtractedSpeakingDocument | null>(null);
  const [editedSpeakingPart1, setEditedSpeakingPart1] = useState<ExtractedSpeakingPart1 | null>(null);
  const [editedSpeakingPart2, setEditedSpeakingPart2] = useState<ExtractedSpeakingPart2 | null>(null);
  const [editedSpeakingPart3, setEditedSpeakingPart3] = useState<ExtractedSpeakingPart3 | null>(null);
  const [speakingActiveTab, setSpeakingActiveTab] = useState<'part1' | 'part2' | 'part3'>('part1');
  const [savePart1, setSavePart1] = useState(true);
  const [savePart2, setSavePart2] = useState(true);
  const [savePart3, setSavePart3] = useState(true);
  const [isSavingSpeakingResources, setIsSavingSpeakingResources] = useState(false);
  const [speakingSaveSuccessNotice, setSpeakingSaveSuccessNotice] = useState<string | null>(null);

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

        if (importSkillType === 'speaking' && doc.rawText) {
          const spk = extractSpeakingPartsFromDocument(doc.rawText, file.name);
          setExtractedSpeakingDoc(spk);
          setEditedSpeakingPart1(spk.part1 ? JSON.parse(JSON.stringify(spk.part1)) : null);
          setEditedSpeakingPart2(spk.part2 ? JSON.parse(JSON.stringify(spk.part2)) : null);
          setEditedSpeakingPart3(spk.part3 ? JSON.parse(JSON.stringify(spk.part3)) : null);
          setSavePart1(Boolean(spk.part1));
          setSavePart2(Boolean(spk.part2));
          setSavePart3(Boolean(spk.part3));
          if (spk.part1) setSpeakingActiveTab('part1');
          else if (spk.part2) setSpeakingActiveTab('part2');
          else if (spk.part3) setSpeakingActiveTab('part3');
        }
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
      if (importSkillType === 'speaking') {
        setCurrentStep('preview');
      }
    }
  };

  const handleSaveSpeakingToLibrary = async () => {
    if (!activeDoc && !extractedSpeakingDoc) return;
    setIsSavingSpeakingResources(true);
    setSpeakingSaveSuccessNotice(null);

    try {
      const sourceName = activeDoc?.name || extractedSpeakingDoc?.sourceFileName || 'Speaking Practice';
      const cleanBaseName = sourceName.replace(/\.[^/.]+$/, '');
      let savedCount = 0;

      // 1. Save Part 1 (if selected and present)
      if (savePart1 && editedSpeakingPart1 && editedSpeakingPart1.topics.length > 0) {
        await addResource({
          title: `${cleanBaseName} - Speaking Part 1 (Topics)`,
          type: 'doc',
          skill: 'speaking',
          folder: 'IELTS Speaking',
          tags: ['speaking', 'part1', 'smart-import'],
          content: JSON.stringify({
            part: 'part1',
            topics: editedSpeakingPart1.topics,
            sourceDocumentName: sourceName,
          }),
          isPublished: true,
        });
        savedCount++;
      }

      // 2. Save Part 2 (if selected and present)
      if (savePart2 && editedSpeakingPart2 && editedSpeakingPart2.cueCards.length > 0) {
        await addResource({
          title: `${cleanBaseName} - Speaking Part 2 (Cue Cards)`,
          type: 'doc',
          skill: 'speaking',
          folder: 'IELTS Speaking',
          tags: ['speaking', 'part2', 'smart-import'],
          content: JSON.stringify({
            part: 'part2',
            cueCards: editedSpeakingPart2.cueCards,
            sourceDocumentName: sourceName,
          }),
          isPublished: true,
        });
        savedCount++;
      }

      // 3. Save Part 3 (if selected and present)
      if (savePart3 && editedSpeakingPart3 && editedSpeakingPart3.questions.length > 0) {
        await addResource({
          title: `${cleanBaseName} - Speaking Part 3 (Discussion)`,
          type: 'doc',
          skill: 'speaking',
          folder: 'IELTS Speaking',
          tags: ['speaking', 'part3', 'smart-import'],
          content: JSON.stringify({
            part: 'part3',
            questions: editedSpeakingPart3.questions,
            groups: editedSpeakingPart3.groups || [],
            sourceDocumentName: sourceName,
          }),
          isPublished: true,
        });
        savedCount++;
      }

      setSpeakingSaveSuccessNotice(`Đã tách và lưu thành công ${savedCount} tài nguyên Speaking vào Thư viện tài liệu!`);
      onResourceCreated?.();
    } catch (err: any) {
      alert(err?.message || 'Có lỗi khi lưu tài liệu Speaking vào Thư viện.');
    } finally {
      setIsSavingSpeakingResources(false);
    }
  };

  const selectActiveDocument = (doc: ExtractedDocument) => {
    setActiveFileId(doc.id);
    const candidateTests = doc.detectedStructure?.candidateTests || [];
    const tests = doc.detectedStructure?.tests || [];
    const defaultLibName = doc.name.replace(/\.[^/.]+$/, '');
    setLibraryMaterialName(defaultLibName);

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


  // Multi-Passage Test Builder Actions
  const handleMovePassage = (testId: string, pIdx: number, direction: 'up' | 'down') => {
    if (!activeDoc?.detectedStructure?.tests) return;
    const targetIdx = direction === 'up' ? pIdx - 1 : pIdx + 1;
    const tests = [...activeDoc.detectedStructure.tests];
    const test = tests.find((t) => t.id === testId);
    if (!test || targetIdx < 0 || targetIdx >= test.passages.length) return;

    const passages = [...test.passages];
    const temp = passages[pIdx];
    passages[pIdx] = passages[targetIdx];
    passages[targetIdx] = temp;

    // Update passage indices
    passages.forEach((p, idx) => {
      p.passageIndex = idx + 1;
    });

    test.passages = passages;
    activeDoc.detectedStructure.tests = tests;
    setUploadedFiles([...uploadedFiles]);
  };

  const handleRenumberTestContinuous = (testId: string) => {
    if (!activeDoc?.detectedStructure?.tests) return;
    const test = activeDoc.detectedStructure.tests.find((t) => t.id === testId);
    if (!test) return;

    let counter = 1;
    test.passages.forEach((p) => {
      if (p.questions) {
        p.questions.forEach((q) => {
          q.id = `q_${counter}`;
          // Update prompt if starts with old question number
          q.prompt = q.prompt.replace(/^(?:Question|Q|Câu)?\s*\d{1,2}[.:\)\-\s]+/i, `${counter}. `);
          counter++;
        });
      }
    });

    test.allQuestions = test.passages.flatMap((p) => p.questions || []);
    test.questionCount = test.allQuestions.length;

    // Refresh currently open passage view if affected
    if (selectedTestId === testId && selectedPassageId) {
      const currentPassage = test.passages.find((p) => p.id === selectedPassageId);
      if (currentPassage) {
        setEditableQuestions([...(currentPassage.questions || [])]);
      }
    }
    setUploadedFiles([...uploadedFiles]);
    alert(`Đã đánh số liên tục thành công cho ${counter - 1} câu hỏi (Passages 1–${test.passages.length})!`);
  };

  const handleGroupCandidateTestsIntoFullTest = () => {
    if (!activeDoc?.detectedStructure?.candidateTests?.length) return;
    const cTests = activeDoc.detectedStructure.candidateTests;
    const fullTestPassages = cTests.map((ct, idx) => ({
      id: `passage_${idx + 1}`,
      passageIndex: idx + 1,
      title: ct.title || `Passage ${idx + 1}`,
      content: ct.passageText,
      questionGroups: ct.questionGroups || [],
      questions: ct.questions || [],
    }));

    const fullTest = {
      id: `test_${Date.now()}`,
      testIndex: 1,
      title: editedTitle || `Full IELTS Reading Test (3 Passages)`,
      passages: fullTestPassages,
      allQuestions: fullTestPassages.flatMap((p) => p.questions || []),
      questionCount: fullTestPassages.reduce((sum, p) => sum + (p.questions?.length || 0), 0),
    };

    activeDoc.detectedStructure.tests = [fullTest];
    (activeDoc.detectedStructure as any).candidateTests = undefined;
    setSelectedTestId(fullTest.id);
    setSelectedPassageId(fullTestPassages[0].id);
    setEditedTitle(fullTestPassages[0].title);
    setEditedPassage(fullTestPassages[0].content);
    setEditableQuestions(fullTestPassages[0].questions || []);
    setExpandedTestIds({ [fullTest.id]: true });
    setUploadedFiles([...uploadedFiles]);
    alert('Đã gộp tất cả các đoạn văn thành 1 bài kiểm tra IELTS Reading hoàn chỉnh!');
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

  const handleBatchSaveAllTestsToLibrary = async (): Promise<boolean> => {
    if (!activeDoc || !currentUser || isPublishingAssignment) return false;
    setIsPublishingAssignment(true);
    try {
      const tests = activeDoc.detectedStructure?.tests || [];
      if (tests.length > 0) {
        for (const t of tests) {
          const testTitleToSave = tests.length === 1
            ? (libraryMaterialName.trim() || t.title)
            : (libraryMaterialName.trim() ? `${libraryMaterialName.trim()} - ${t.title}` : t.title);
          // Save combined multi-passage full test
          const allQs = t.allQuestions?.length ? t.allQuestions : t.passages.flatMap((p) => p.questions || []);
          const structuredPayload = {
            title: testTitleToSave,
            skill: 'reading',
            readingPassage: t.passages[0]?.content || '',
            content: t.passages[0]?.content || '',
            passages: t.passages,
            questionGroups: t.passages.flatMap((p) => p.questionGroups || []),
            questions: allQs,
            readingTestType: 'academic',
            metadata: {
              sourceDocumentName: activeDoc.name,
              passageCount: t.passages.length,
              questionCount: allQs.length,
            },
          };
          await addResource({
            title: testTitleToSave,
            type: 'doc',
            content: JSON.stringify(structuredPayload),
            tags: ['smart-import', 'reading', 'full-test', testTitleToSave],
            skill: 'reading',
            folder: 'IELTS Full Tests',
            courseId: assignCourseId || null,
            isPublished: true,
          });
        }
      } else {
        const cTests = activeDoc.detectedStructure?.candidateTests || [];
        for (const ct of cTests) {
          const testTitleToSave = cTests.length === 1
            ? (libraryMaterialName.trim() || ct.title)
            : (libraryMaterialName.trim() ? `${libraryMaterialName.trim()} - ${ct.title}` : ct.title);
          const structuredPayload = {
            title: testTitleToSave,
            skill: 'reading',
            readingPassage: ct.passageText,
            content: ct.passageText,
            questionGroups: ct.questionGroups || [],
            questions: ct.questions || [],
          };
          await addResource({
            title: testTitleToSave,
            type: 'doc',
            content: JSON.stringify(structuredPayload),
            tags: ['smart-import', 'reading'],
            skill: 'reading',
            folder: 'Imported Tests',
            courseId: assignCourseId || null,
            isPublished: true,
          });
        }
      }
      alert('Tất cả các bài kiểm tra đã được lưu vào Thư viện tài nguyên thành công!');
      onResourceCreated?.();
      return true;
    } catch (err: any) {
      alert(`Lỗi khi lưu vào thư viện: ${err.message || 'Vui lòng thử lại.'}`);
      return false;
    } finally {
      setIsPublishingAssignment(false);
    }
  };

  const handleSaveCurrentTestToLibrary = async (): Promise<boolean> => {
    if (!activeDoc || !currentUser || isPublishingAssignment) return false;
    setIsPublishingAssignment(true);
    try {
      const struct = activeDoc.detectedStructure as any;
      const questionsToSave =
        editableQuestions.length > 0
          ? editableQuestions
          : reviewedQuestions.length > 0
          ? reviewedQuestions
          : struct?.questions || [];
      const questionGroupsToSave = struct?.questionGroups || [];
      const passageToSave =
        editedPassage || reviewedPassage || struct?.passageText || editedRawText;
      const titleToSave = (
        libraryMaterialName ||
        editedTitle ||
        reviewedTitle ||
        struct?.title ||
        activeDoc.name
      ).trim();

      const passagesToSave = struct?.passages?.length
        ? struct.passages.map((p: any) =>
            p.id === selectedPassageId
              ? { ...p, title: titleToSave, content: passageToSave, questions: questionsToSave }
              : p
          )
        : [
            {
              id: 'p_1',
              title: titleToSave,
              content: passageToSave,
              questions: questionsToSave,
              questionGroups: questionGroupsToSave,
            },
          ];

      const structuredPayload = {
        title: titleToSave,
        skill: assignSkill || 'reading',
        readingPassage: passageToSave,
        content: passageToSave,
        passages: passagesToSave,
        questionGroups: questionGroupsToSave,
        questions: questionsToSave,
        readingTestType: 'academic',
        metadata: {
          sourceDocumentName: activeDoc.name,
          difficultyLevel: struct?.difficultyLevel || 7,
          targetBand: assignTargetBand || '7.0',
        },
      };

      await addResource({
        title: titleToSave,
        type: 'doc',
        content: JSON.stringify(structuredPayload),
        tags: ['smart-import', assignSkill || 'reading', 'interactive-test'],
        skill: assignSkill || 'reading',
        folder: 'Imported Library Tests',
        courseId: assignCourseId || null,
        isPublished: true,
      });

      alert('Đã lưu bài tập vào Thư viện tài nguyên với đầy đủ câu hỏi, đáp án và cấu trúc!');
      onResourceCreated?.();
      return true;
    } catch (err: any) {
      alert(`Lỗi khi lưu vào thư viện: ${err.message || 'Vui lòng thử lại.'}`);
      return false;
    } finally {
      setIsPublishingAssignment(false);
    }
  };

  const handleStep3SaveToLibrary = async () => {
    if (isPublishingAssignment) return;
    const tests = activeDoc?.detectedStructure?.tests || [];
    const cTests = activeDoc?.detectedStructure?.candidateTests || [];
    let success = false;
    if (tests.length > 0 || cTests.length > 1) {
      success = await handleBatchSaveAllTestsToLibrary();
    } else {
      success = await handleSaveCurrentTestToLibrary();
    }
    if (success) {
      onClose();
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
        title: `${libraryMaterialName.trim() || editedTitle || activeDoc.name} (DOCX)`,
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
          questions = data.questions.map((q: any, idx: number) => {
            const prevTeacherEdited =
              reviewedQuestions.find((r, rIdx) => (r.id === q.id || rIdx === idx) && r.isTeacherEdited) ||
              editableQuestions.find((r, rIdx) => (r.id === q.id || rIdx === idx) && r.isTeacherEdited);

            if (prevTeacherEdited) {
              return {
                id: q.id || `q_${idx + 1}`,
                type: q.type || 'multiple_choice',
                prompt: q.prompt || `Question ${idx + 1}`,
                options: Array.isArray(q.options) ? q.options : undefined,
                matchingPairs: Array.isArray(q.matchingPairs) ? q.matchingPairs : undefined,
                correctAnswer: prevTeacherEdited.correctAnswer,
                citation: prevTeacherEdited.citation || q.citation,
                explanation: prevTeacherEdited.explanation || q.explanation || 'Teacher edited answer.',
                points: Number(q.points) || 1,
                source: prevTeacherEdited.source || 'answer_key_extracted',
                answerKeyConfidence: 'high',
                needsReview: false,
                isTeacherEdited: true,
              };
            }

            return {
              id: q.id || `q_${idx + 1}`,
              type: q.type || 'multiple_choice',
              prompt: q.prompt || `Question ${idx + 1}`,
              options: Array.isArray(q.options) ? q.options : undefined,
              matchingPairs: Array.isArray(q.matchingPairs) ? q.matchingPairs : undefined,
              correctAnswer: q.correctAnswer || '',
              citation: q.citation,
              explanation: q.explanation || 'Verified from source document.',
              points: Number(q.points) || 1,
              source: q.source || (assignConversionMode === 'generate_new' ? 'ai_generated' : 'extracted_from_doc'),
              answerKeyConfidence: q.answerKeyConfidence || (q.correctAnswer ? 'high' : 'needs_teacher_review'),
              needsReview: q.answerKeyConfidence === 'needs_teacher_review' || !q.correctAnswer,
            };
          });
        }
      } else {
        // Fallback to local heuristic questions
        setIsAiGeneratedResult(false);
        const match = selectedCandidateTestId !== 'combined'
          ? activeDoc.detectedStructure?.candidateTests?.find((t) => t.id === selectedCandidateTestId)
          : null;
        const candidateBase = match ? match.questions : (activeDoc.detectedStructure?.questions || []);
        // Preserve any teacher manual edits if user re-triggered
        questions = candidateBase.map((q, idx) => {
          const prev =
            reviewedQuestions.find((r, rIdx) => (r.id === q.id || rIdx === idx) && r.isTeacherEdited) ||
            editableQuestions.find((r, rIdx) => (r.id === q.id || rIdx === idx) && r.isTeacherEdited);
          if (prev) {
            return {
              ...q,
              correctAnswer: prev.correctAnswer,
              explanation: prev.explanation || q.explanation,
              isTeacherEdited: true,
              answerKeyConfidence: 'high',
              needsReview: false,
            };
          }
          return q;
        });
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
        title: `${libraryMaterialName.trim() || editedTitle || activeDoc.name} (Source Document)`,
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
      <div className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center ${currentStep === 'preview' ? 'p-0' : 'p-4 overflow-y-auto'}`}>
      <div className={`relative z-10 bg-white border border-slate-200 w-full flex flex-col overflow-hidden ${currentStep === 'preview' ? 'h-full rounded-none shadow-none' : 'rounded-2xl shadow-2xl max-w-5xl my-8 max-h-[90vh]'}`}>
        {/* ==========================================
            MODAL HEADER & STEP PROGRESS
        ========================================== */}
        <div className={`bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0 ${currentStep === 'preview' ? 'px-4 py-2' : 'p-5'}`}>
          <div className="flex items-center space-x-2.5">
            <div className={`rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 ${currentStep === 'preview' ? 'w-7 h-7' : 'w-9 h-9'}`}>
              <FileUp className={currentStep === 'preview' ? 'w-4 h-4' : 'w-5 h-5'} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center space-x-2">
                <span>Smart Document Import & Converter</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded border border-blue-400/30">
                  AI-Powered
                </span>
              </h2>
              {currentStep !== 'preview' && (
                <p className="text-xs text-slate-400">
                  Import PDF, DOCX, TXT → Editable Word Document or Interactive Student Assignment
                </p>
              )}
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
        <div className={`bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-500 overflow-x-auto shrink-0 ${currentStep === 'preview' ? 'px-4 py-1.5' : 'px-6 py-2.5'}`}>
          <div className="flex items-center space-x-2 whitespace-nowrap shrink-0">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                currentStep === 'upload' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              1
            </span>
            <span className={currentStep === 'upload' ? 'text-blue-600 font-bold' : ''}>{t('importModal.stepUpload')}</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 mx-1 shrink-0" />

          <div className="flex items-center space-x-2 whitespace-nowrap shrink-0">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                currentStep === 'preview' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              2
            </span>
            <span className={currentStep === 'preview' ? 'text-blue-600 font-bold' : ''}>{t('importModal.stepPreview')}</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 mx-1 shrink-0" />

          <div className="flex items-center space-x-2 whitespace-nowrap shrink-0">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                currentStep === 'choose_output' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              3
            </span>
            <span className={currentStep === 'choose_output' ? 'text-blue-600 font-bold' : ''}>{t('importModal.stepOutput')}</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 mx-1 shrink-0" />

          <div className="flex items-center space-x-2 whitespace-nowrap shrink-0">
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
              {t('importModal.stepConfig')}
            </span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 mx-1 shrink-0" />

          <div className="flex items-center space-x-2 whitespace-nowrap shrink-0">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                currentStep === 'review_assignment' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              5
            </span>
            <span className={currentStep === 'review_assignment' ? 'text-blue-600 font-bold' : ''}>
              {t('importModal.stepReview')}
            </span>
          </div>
        </div>

        {/* ==========================================
            MODAL BODY CONTENT BY STEP
        ========================================== */}
        <div className={`flex-1 overflow-y-auto min-h-0 ${currentStep === 'preview' && importSkillType !== 'speaking' ? 'p-0 flex flex-col' : 'p-6 space-y-6'}`}>
          {/* --------------------------------------
              STEP 1: UPLOAD
          --------------------------------------- */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              {/* Document Type Selector (Reading vs Speaking) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Chọn loại tài liệu Smart Import:</span>
                  <span className="text-[11px] text-slate-500">Hệ thống áp dụng pipeline nhận diện chuyên biệt độc lập cho từng kỹ năng.</span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setImportSkillType('reading')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                      importSkillType === 'reading'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>IELTS Reading (Đọc)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportSkillType('speaking')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                      importSkillType === 'speaking'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>IELTS Speaking (Nói Part 1-2-3)</span>
                  </button>
                </div>
              </div>

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
                    {t('importModal.dropTitle')}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {t('importModal.dropSubtitle')}
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
          {currentStep === 'preview' && activeDoc && importSkillType === 'speaking' && (
            <div className="space-y-5">
              {speakingSaveSuccessNotice && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 font-bold">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span>{speakingSaveSuccessNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold text-xs"
                  >
                    Đóng cửa sổ
                  </button>
                </div>
              )}

              {/* Speaking Header & Recognition Summary */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[11px] font-extrabold uppercase">
                      Speaking Recognition
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{activeDoc.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Nhận diện độc lập các phần Speaking. Chọn các phần cần lưu vào Thư viện tài liệu (không tự động tạo bài tập).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {editedSpeakingPart1 && (
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-800 rounded-lg border border-blue-200 font-semibold">
                      Part 1: {editedSpeakingPart1.topics.length} Topics
                    </span>
                  )}
                  {editedSpeakingPart2 && (
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 font-semibold">
                      Part 2: {editedSpeakingPart2.cueCards.length} Cue Cards
                    </span>
                  )}
                  {editedSpeakingPart3 && (
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 font-semibold">
                      Part 3: {editedSpeakingPart3.questions.length} Questions
                    </span>
                  )}
                </div>
              </div>

              {/* Checkboxes: Which parts to split & save */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-purple-50/50 border border-purple-200 rounded-xl">
                <label className="flex items-center space-x-2.5 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={savePart1}
                    onChange={(e) => setSavePart1(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Lưu Part 1 ({editedSpeakingPart1?.topics.length || 0} Topics)</span>
                </label>
                <label className="flex items-center space-x-2.5 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={savePart2}
                    onChange={(e) => setSavePart2(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Lưu Part 2 ({editedSpeakingPart2?.cueCards.length || 0} Cue Cards)</span>
                </label>
                <label className="flex items-center space-x-2.5 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={savePart3}
                    onChange={(e) => setSavePart3(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Lưu Part 3 ({editedSpeakingPart3?.questions.length || 0} Questions)</span>
                </label>
              </div>

              {/* Speaking Navigation Tabs */}
              <div className="flex border-b border-slate-200 space-x-2">
                <button
                  type="button"
                  onClick={() => setSpeakingActiveTab('part1')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                    speakingActiveTab === 'part1'
                      ? 'border-purple-600 text-purple-900 bg-purple-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Part 1: Topic-based ({editedSpeakingPart1?.topics.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setSpeakingActiveTab('part2')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                    speakingActiveTab === 'part2'
                      ? 'border-purple-600 text-purple-900 bg-purple-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Part 2: Cue Cards ({editedSpeakingPart2?.cueCards.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setSpeakingActiveTab('part3')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                    speakingActiveTab === 'part3'
                      ? 'border-purple-600 text-purple-900 bg-purple-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Part 3: Discussion ({editedSpeakingPart3?.questions.length || 0})
                </button>
              </div>

              {/* Tab 1: Part 1 Topics & Questions Editor */}
              {speakingActiveTab === 'part1' && (
                <div className="space-y-4">
                  {editedSpeakingPart1 && editedSpeakingPart1.topics.length > 0 ? (
                    editedSpeakingPart1.topics.map((top, tIdx) => (
                      <div key={top.id || tIdx} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2 flex-1">
                            <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center shrink-0">
                              {tIdx + 1}
                            </span>
                            <input
                              type="text"
                              value={top.topic}
                              onChange={(e) => {
                                const newTopics = [...editedSpeakingPart1.topics];
                                newTopics[tIdx].topic = e.target.value;
                                setEditedSpeakingPart1({ ...editedSpeakingPart1, topics: newTopics });
                              }}
                              placeholder="Topic Name (e.g. Crowded place, Singing)"
                              className="font-bold text-sm text-slate-900 border border-slate-300 rounded-lg px-2.5 py-1 flex-1"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newTopics = editedSpeakingPart1.topics.filter((_, i) => i !== tIdx);
                              setEditedSpeakingPart1({ ...editedSpeakingPart1, topics: newTopics });
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100"
                            title="Xóa chủ đề này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2 pl-8">
                          <label className="text-[11px] font-bold text-slate-600 block">Questions under this topic:</label>
                          {top.questions.map((q, qIdx) => (
                            <div key={qIdx} className="flex items-center space-x-2">
                              <span className="text-xs text-slate-400 font-mono w-4">{qIdx + 1}.</span>
                              <input
                                type="text"
                                value={q}
                                onChange={(e) => {
                                  const newTopics = [...editedSpeakingPart1.topics];
                                  newTopics[tIdx].questions[qIdx] = e.target.value;
                                  setEditedSpeakingPart1({ ...editedSpeakingPart1, topics: newTopics });
                                }}
                                className="flex-1 p-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newTopics = [...editedSpeakingPart1.topics];
                                  newTopics[tIdx].questions = newTopics[tIdx].questions.filter((_, i) => i !== qIdx);
                                  setEditedSpeakingPart1({ ...editedSpeakingPart1, topics: newTopics });
                                }}
                                className="p-1 text-slate-400 hover:text-red-500 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const newTopics = [...editedSpeakingPart1.topics];
                              newTopics[tIdx].questions.push('New question?');
                              setEditedSpeakingPart1({ ...editedSpeakingPart1, topics: newTopics });
                            }}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 pt-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Thêm câu hỏi cho chủ đề này</span>
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      Không tìm thấy câu hỏi Part 1 trong tài liệu này.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const prevTopics = editedSpeakingPart1?.topics || [];
                      const newT = {
                        id: `topic_${prevTopics.length + 1}`,
                        topic: 'New Topic',
                        questions: ['What is your opinion?'],
                      };
                      setEditedSpeakingPart1({ topics: [...prevTopics, newT], confidence: 1 });
                    }}
                    className="w-full py-2.5 border border-dashed border-blue-300 text-blue-700 bg-blue-50/50 hover:bg-blue-50 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm chủ đề Part 1 mới</span>
                  </button>
                </div>
              )}

              {/* Tab 2: Part 2 Cue Cards Editor */}
              {speakingActiveTab === 'part2' && (
                <div className="space-y-4">
                  {editedSpeakingPart2 && editedSpeakingPart2.cueCards.length > 0 ? (
                    editedSpeakingPart2.cueCards.map((card, cIdx) => (
                      <div key={card.id || cIdx} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <span className="font-extrabold text-xs uppercase tracking-wider text-amber-900 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                            Cue Card {cIdx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const newCards = editedSpeakingPart2.cueCards.filter((_, i) => i !== cIdx);
                              setEditedSpeakingPart2({ ...editedSpeakingPart2, cueCards: newCards });
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100"
                            title="Xóa cue card này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-800 block">Topic / Prompt:</label>
                          <input
                            type="text"
                            value={card.topic}
                            onChange={(e) => {
                              const newCards = [...editedSpeakingPart2.cueCards];
                              newCards[cIdx].topic = e.target.value;
                              setEditedSpeakingPart2({ ...editedSpeakingPart2, cueCards: newCards });
                            }}
                            className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-800 block">Instructions & Bullet Points:</label>
                          <input
                            type="text"
                            value={card.instructions}
                            onChange={(e) => {
                              const newCards = [...editedSpeakingPart2.cueCards];
                              newCards[cIdx].instructions = e.target.value;
                              setEditedSpeakingPart2({ ...editedSpeakingPart2, cueCards: newCards });
                            }}
                            className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 italic"
                          />
                          <div className="space-y-1.5 pl-4 border-l-2 border-amber-300">
                            {card.points.map((pt, ptIdx) => (
                              <div key={ptIdx} className="flex items-center space-x-2">
                                <span className="text-slate-400 text-xs">•</span>
                                <input
                                  type="text"
                                  value={pt}
                                  onChange={(e) => {
                                    const newCards = [...editedSpeakingPart2.cueCards];
                                    newCards[cIdx].points[ptIdx] = e.target.value;
                                    setEditedSpeakingPart2({ ...editedSpeakingPart2, cueCards: newCards });
                                  }}
                                  className="flex-1 p-1.5 border border-slate-200 rounded-md text-xs text-slate-800"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newCards = [...editedSpeakingPart2.cueCards];
                                    newCards[cIdx].points = newCards[cIdx].points.filter((_, i) => i !== ptIdx);
                                    setEditedSpeakingPart2({ ...editedSpeakingPart2, cueCards: newCards });
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-500 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const newCards = [...editedSpeakingPart2.cueCards];
                                newCards[cIdx].points.push('And explain why...');
                                setEditedSpeakingPart2({ ...editedSpeakingPart2, cueCards: newCards });
                              }}
                              className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center space-x-1 pt-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Thêm ý gợi ý (bullet point)</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      Không tìm thấy Cue Card Part 2 trong tài liệu này.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const prevCards = editedSpeakingPart2?.cueCards || [];
                      const newC: ExtractedSpeakingPart2CueCard = {
                        id: `cue_card_${prevCards.length + 1}`,
                        topic: 'Describe an experience that changed your perspective.',
                        instructions: 'You should say:',
                        points: ['What the experience was', 'When and where it happened', 'What you learned'],
                        prepTimeSeconds: 60,
                        speakTimeSeconds: 120,
                      };
                      setEditedSpeakingPart2({ cueCards: [...prevCards, newC], confidence: 1 });
                    }}
                    className="w-full py-2.5 border border-dashed border-amber-300 text-amber-800 bg-amber-50/50 hover:bg-amber-50 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm Cue Card Part 2 mới</span>
                  </button>
                </div>
              )}

              {/* Tab 3: Part 3 Discussion Questions Editor (Grouped by Cue Card) */}
              {speakingActiveTab === 'part3' && (
                <div className="space-y-4">
                  {editedSpeakingPart3 && (editedSpeakingPart3.groups?.length > 0 || editedSpeakingPart3.questions.length > 0) ? (
                    <div className="space-y-4">
                      {(editedSpeakingPart3.groups || []).map((grp, gIdx) => (
                        <div key={grp.id || gIdx} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div className="flex items-center space-x-2">
                              <span className="font-extrabold text-xs uppercase tracking-wider text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                Nhóm {gIdx + 1}: Liên kết Cue Card
                              </span>
                              <input
                                type="text"
                                value={grp.cueCardTopic || ''}
                                placeholder="Chủ đề Cue Card liên kết (e.g. Describe a gift, Describe a journey...)"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updatedGroups = [...editedSpeakingPart3.groups];
                                  updatedGroups[gIdx] = { ...updatedGroups[gIdx], cueCardTopic: val };
                                  setEditedSpeakingPart3({
                                    ...editedSpeakingPart3,
                                    groups: updatedGroups,
                                  });
                                }}
                                className="font-bold text-xs text-slate-800 p-1 border border-slate-200 rounded-md focus:border-emerald-500"
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-slate-500 font-semibold">
                                {grp.questions.length} câu hỏi
                              </span>
                              {editedSpeakingPart3.groups.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedGroups = editedSpeakingPart3.groups.filter((_, i) => i !== gIdx);
                                    const updatedQs = updatedGroups.flatMap((g) => g.questions);
                                    setEditedSpeakingPart3({
                                      ...editedSpeakingPart3,
                                      groups: updatedGroups,
                                      questions: updatedQs,
                                    });
                                  }}
                                  className="text-slate-400 hover:text-red-500 p-1"
                                  title="Xóa nhóm này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            {grp.questions.map((q, qIdx) => (
                              <div key={qIdx} className="flex items-center space-x-2">
                                <span className="text-xs text-slate-400 font-mono w-8 text-right">
                                  {gIdx + 1}.{qIdx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={q}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updatedGroups = [...editedSpeakingPart3.groups];
                                    const updatedGroupQs = [...updatedGroups[gIdx].questions];
                                    updatedGroupQs[qIdx] = val;
                                    updatedGroups[gIdx] = { ...updatedGroups[gIdx], questions: updatedGroupQs };
                                    const allQs = updatedGroups.flatMap((g) => g.questions);
                                    setEditedSpeakingPart3({
                                      ...editedSpeakingPart3,
                                      groups: updatedGroups,
                                      questions: allQs,
                                    });
                                  }}
                                  className="flex-1 p-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedGroups = [...editedSpeakingPart3.groups];
                                    const updatedGroupQs = updatedGroups[gIdx].questions.filter((_, i) => i !== qIdx);
                                    updatedGroups[gIdx] = { ...updatedGroups[gIdx], questions: updatedGroupQs };
                                    const allQs = updatedGroups.flatMap((g) => g.questions);
                                    setEditedSpeakingPart3({
                                      ...editedSpeakingPart3,
                                      groups: updatedGroups,
                                      questions: allQs,
                                    });
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-500 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const updatedGroups = [...editedSpeakingPart3.groups];
                              const updatedGroupQs = [...updatedGroups[gIdx].questions, 'Why do you think this happens?'];
                              updatedGroups[gIdx] = { ...updatedGroups[gIdx], questions: updatedGroupQs };
                              const allQs = updatedGroups.flatMap((g) => g.questions);
                              setEditedSpeakingPart3({
                                ...editedSpeakingPart3,
                                groups: updatedGroups,
                                questions: allQs,
                              });
                            }}
                            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center space-x-1 pt-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Thêm câu hỏi vào nhóm này</span>
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          const currentGroups = editedSpeakingPart3?.groups || [];
                          const newGroupId = `p3_group_${currentGroups.length + 1}`;
                          const newGroup = {
                            id: newGroupId,
                            cueCardTopic: `Chủ đề thảo luận ${currentGroups.length + 1}`,
                            questions: ['How will this topic develop in the future?'],
                          };
                          const updatedGroups = [...currentGroups, newGroup];
                          const allQs = updatedGroups.flatMap((g) => g.questions);
                          setEditedSpeakingPart3({
                            ...editedSpeakingPart3,
                            groups: updatedGroups,
                            questions: allQs,
                            confidence: 1,
                          });
                        }}
                        className="w-full py-2.5 border border-dashed border-emerald-300 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Thêm nhóm câu hỏi Part 3 mới</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        Không tìm thấy câu hỏi Part 3 trong tài liệu này.
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newGroup = {
                            id: 'p3_group_1',
                            cueCardTopic: 'General Discussion',
                            questions: ['How will this issue evolve in the future?'],
                          };
                          setEditedSpeakingPart3({
                            questions: newGroup.questions,
                            groups: [newGroup],
                            confidence: 1,
                          });
                        }}
                        className="w-full py-2.5 border border-dashed border-emerald-300 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Thêm nhóm câu hỏi Part 3</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* --------------------------------------
              STEP 2: PREVIEW & EDIT EXTRACTED TEXT (READING)
          --------------------------------------- */}
          {currentStep === 'preview' && activeDoc && importSkillType !== 'speaking' && (
            <div className="flex-1 min-h-0 flex flex-col p-3 sm:p-4 space-y-2.5">
              {/* Compact Toolbar row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2 shrink-0">
                <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                  <span className="text-xs font-bold text-slate-800 shrink-0">
                    Previewing:
                  </span>
                  <span className="text-xs font-medium text-slate-500 truncate max-w-[160px]" title={activeDoc.name}>
                    {activeDoc.name}
                  </span>
                  <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
                    <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">Tên tài liệu:</span>
                    <input
                      type="text"
                      value={libraryMaterialName}
                      onChange={(e) => setLibraryMaterialName(e.target.value)}
                      className="p-1 px-2 border border-slate-300 rounded-md text-xs font-bold text-blue-700 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden w-52 sm:w-64"
                      placeholder="Tên tài liệu thư viện..."
                      title="Tên tài liệu sẽ lưu vào Thư viện tài nguyên"
                    />
                  </div>
                  {editedTitle && (
                    <div className="hidden md:flex items-center space-x-1 text-slate-400 text-xs">
                      <span className="text-[11px] font-medium">Passage:</span>
                      <span className="font-semibold text-slate-700 truncate max-w-[140px]">{editedTitle}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <div className="bg-slate-100 p-0.5 rounded-lg flex text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setPreviewTab('structured')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${previewTab === 'structured' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-slate-600'}`}
                    >
                      Structured View
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('raw')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${previewTab === 'raw' ? 'bg-white shadow-xs text-blue-600 font-bold' : 'text-slate-600'}`}
                    >
                      Raw Text Editor
                    </button>
                  </div>
                </div>
              </div>

              {/* Compact Stats Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs shrink-0">
                <div className="flex items-center space-x-3 text-slate-600 font-medium">
                  <span>Pages: <strong className="text-slate-800 font-mono">{activeDoc.pageCount || 1}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>Tests: <strong className="text-blue-600 font-mono">{activeDoc.detectedStructure?.tests?.length || 1}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>Passages: <strong className="text-indigo-600 font-mono">{activeDoc.detectedStructure?.tests?.reduce((s, t) => s + t.passages.length, 0) || activeDoc.detectedStructure?.candidateTests?.length || 1}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>Questions: <strong className="text-emerald-600 font-mono">{activeDoc.detectedStructure?.questions.length || 0}</strong></span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
                  IELTS Academic / General Training
                </div>
              </div>

              {previewTab === 'structured' ? (
                <div className="flex-1 min-h-0 flex flex-col space-y-2.5">
                  {/* Multi-passage quick switcher & builder */}
                  {(() => {
                    const firstTest = activeDoc.detectedStructure?.tests?.[0];
                    if (!firstTest) return null;
                    const totalPassages = firstTest.passages.length;

                    return (
                      <div className="bg-white rounded-xl border border-slate-200 p-2.5 space-y-2 shrink-0 shadow-2xs">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5 shrink-0">
                              <Layers className="w-3.5 h-3.5 text-blue-600" />
                              <span>Passages ({totalPassages}):</span>
                            </span>

                            {/* Quick Passage Navigation Pills */}
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              {firstTest.passages.map((p, pIdx) => {
                                const isSelected = selectedPassageId === p.id;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleSelectPassageFromTree(firstTest.id, p.id)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                                      isSelected
                                        ? 'bg-blue-600 text-white shadow-xs font-bold'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                  >
                                    <BookOpen className="w-3 h-3" />
                                    <span className="max-w-[150px] truncate">{p.title || `Passage ${pIdx + 1}`}</span>
                                    <span className={`text-[10px] px-1 rounded font-mono ${isSelected ? 'bg-blue-700 text-white' : 'bg-white text-slate-600'}`}>
                                      {p.questions?.length || 0} Qs
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRenumberTestContinuous(firstTest.id)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-md text-[11px] font-bold border border-amber-200 transition-colors"
                              title="Đánh số lại câu hỏi liên tục 1–40 trên toàn bộ các passage"
                            >
                              Đánh số 1–40
                            </button>
                            <button
                              type="button"
                              onClick={handleBatchSaveAllTestsToLibrary}
                              disabled={isPublishingAssignment}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-[11px] font-bold border border-indigo-200 transition-colors"
                            >
                              Save Full Test
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsPassageBuilderExpanded(!isPassageBuilderExpanded)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition-colors flex items-center space-x-1"
                              title="Mở rộng / Thu gọn công cụ đổi thứ tự passage"
                            >
                              <span>{isPassageBuilderExpanded ? 'Thu gọn' : 'Reorder'}</span>
                              {isPassageBuilderExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>

                        {/* Expandable Reorder List */}
                        {isPassageBuilderExpanded && (
                          <div className="pt-2 border-t border-slate-100 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {firstTest.passages.map((p, pIdx) => {
                              const isSelected = selectedPassageId === p.id;
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => handleSelectPassageFromTree(firstTest.id, p.id)}
                                  className={`p-1.5 px-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between text-xs ${
                                    isSelected ? 'bg-blue-50 border border-blue-300 text-blue-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2">
                                    <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                                    <span className="truncate">{p.title}</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className="flex items-center space-x-0.5 bg-slate-100 rounded px-1">
                                      <button
                                        type="button"
                                        disabled={pIdx === 0}
                                        onClick={(e) => { e.stopPropagation(); handleMovePassage(firstTest.id, pIdx, 'up'); }}
                                        className="p-0.5 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                                      >▲</button>
                                      <button
                                        type="button"
                                        disabled={pIdx === totalPassages - 1}
                                        onClick={(e) => { e.stopPropagation(); handleMovePassage(firstTest.id, pIdx, 'down'); }}
                                        className="p-0.5 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                                      >▼</button>
                                    </div>
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
                  })()}
                  {activeDoc.detectedStructure?.candidateTests && activeDoc.detectedStructure.candidateTests.length > 1 && (
                    <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5 space-y-2 shrink-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-bold text-blue-900 flex items-center space-x-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                          <span>Detected {activeDoc.detectedStructure.candidateTests.length} Reading Passages</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleGroupCandidateTestsIntoFullTest}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                        >
                          Gộp thành 1 đề Full Test (Passages 1–{activeDoc.detectedStructure.candidateTests.length})
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {activeDoc.detectedStructure.candidateTests.map((ct) => (
                          <button
                            key={ct.id}
                            type="button"
                            onClick={() => handleSelectCandidateTest(ct.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center space-x-1.5 ${
                              selectedCandidateTestId === ct.id
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            <span>{ct.title}</span>
                            <span className={`text-[10px] px-1 rounded font-mono ${selectedCandidateTestId === ct.id ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              {ct.questionCount} Qs
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── TWO-PANEL WORKSPACE (Passage Text + Question Editor) ── */}
                  <div className="flex-1 min-h-[420px] flex flex-col md:flex-row border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    {/* LEFT PANEL: Passage Text */}
                    <div className="w-full md:w-2/5 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/40 min-h-[200px] md:min-h-0">
                      <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-200 bg-white shrink-0">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                          <span>Reading Passage Text</span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold font-mono">
                          {editedPassage.split(/\s+/).filter(Boolean).length} words
                        </span>
                      </div>
                      <textarea
                        value={editedPassage}
                        onChange={(e) => setEditedPassage(e.target.value)}
                        className="flex-1 p-3 bg-transparent border-0 text-xs font-mono text-slate-800 leading-relaxed focus:ring-0 focus:outline-hidden resize-none overflow-y-auto"
                        placeholder="Passage text will appear here…"
                      />
                    </div>

                    {/* RIGHT PANEL: Question Editor */}
                    <div className="flex-1 min-w-0 flex flex-col bg-white min-h-[280px] md:min-h-0">
                      {/* Header */}
                      <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-200 shrink-0">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Questions ({editableQuestions.length})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const newQ: ReadingQuestion = {
                              id: `q_new_${Date.now()}`,
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

                      {/* Question list – independently scrollable */}
                      <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {editableQuestions.length > 0 ? (
                          editableQuestions.map((q, idx) => {
                            const updateQ = (patch: Partial<ReadingQuestion>) => {
                              const updated = [...editableQuestions];
                              const targetQ = { ...updated[idx], ...patch, isTeacherEdited: true };
                              updated[idx] = targetQ;

                              // If this question shares resources, sync wordList, options, completionFormat to sibling questions
                              if (targetQ.sharedResourceId && (patch.wordList || patch.options || patch.completionFormat)) {
                                for (let i = 0; i < updated.length; i++) {
                                  if (i !== idx && updated[i].sharedResourceId === targetQ.sharedResourceId) {
                                    updated[i] = {
                                      ...updated[i],
                                      ...(patch.wordList ? { wordList: [...patch.wordList] } : {}),
                                      ...(patch.options ? { options: [...patch.options] } : {}),
                                      ...(patch.completionFormat ? { completionFormat: patch.completionFormat } : {}),
                                      isTeacherEdited: true,
                                    };
                                  }
                                }
                              }

                              setEditableQuestions(updated);
                            };
                            const updateOption = (optIdx: number, val: string) => {
                              const opts = [...(q.options || [])];
                              opts[optIdx] = val;
                              updateQ({ options: opts });
                            };
                            const addOption = () => updateQ({ options: [...(q.options || []), ''] });
                            const removeOption = (optIdx: number) => updateQ({ options: (q.options || []).filter((_, i) => i !== optIdx) });
                            const isMC = q.type === 'multiple_choice' || q.type === 'multiple_select';
                            const isTFNG = q.type === 'true_false_not_given' || q.type === 'yes_no_not_given';
                            const isCompletion = [
                              'sentence_completion',
                              'summary_completion',
                              'note_completion',
                              'table_completion',
                              'flowchart_completion',
                              'diagram_completion',
                              'fill_in_the_blank',
                            ].includes(q.type);
                            const isMatchingQ = ['matching_headings', 'matching_features', 'matching_information', 'matching_sentence_endings'].includes(q.type);

                            return (
                              <div key={q.id || idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 text-xs space-y-2.5">
                                {/* Row 1: num / type / badge / answer key / delete */}
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                    <span className="font-bold text-slate-800 shrink-0">#{idx + 1}</span>
                                    <select
                                      value={q.type}
                                      onChange={(e) => updateQ({ type: e.target.value as QuestionType })}
                                      className="p-1 border border-slate-300 rounded text-xs bg-white text-slate-900 font-semibold"
                                    >
                                      <option value="multiple_choice">Multiple Choice (Single)</option>
                                      <option value="multiple_select">Multiple Select (Choose N)</option>
                                      <option value="true_false_not_given">True / False / Not Given</option>
                                      <option value="yes_no_not_given">Yes / No / Not Given</option>
                                      <option value="matching_information">Matching Information</option>
                                      <option value="matching_headings">Matching Headings</option>
                                      <option value="matching_features">Matching Features</option>
                                      <option value="matching_sentence_endings">Matching Sentence Endings</option>
                                      <option value="sentence_completion">Sentence Completion</option>
                                      <option value="summary_completion">Summary Completion</option>
                                      <option value="note_completion">Note Completion</option>
                                      <option value="table_completion">Table Completion</option>
                                      <option value="short_answer">Short Answer</option>
                                    </select>
                                    {q.isTeacherEdited ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">Teacher Edited</span>
                                    ) : q.source === 'source_extracted' ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">Source Extracted</span>
                                    ) : q.correctAnswer && (q.source === 'answer_key_extracted' || q.answerKeyConfidence === 'high') ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center space-x-1"><Check className="w-3 h-3 text-emerald-600" /><span>Answer Key Extracted</span></span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center space-x-1"><AlertCircle className="w-3 h-3 text-amber-600" /><span>Review Key Needed</span></span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2 shrink-0">
                                    {q.type === 'multiple_select' && (
                                      <label className="flex items-center space-x-1 text-[10px] font-semibold text-slate-600">
                                        <span>Select</span>
                                        <input type="number" min={1} max={q.options?.length || 6} value={q.multipleSelectCount ?? 2} onChange={(e) => updateQ({ multipleSelectCount: Math.max(1, parseInt(e.target.value) || 2) })} className="w-10 p-0.5 border border-indigo-300 rounded text-center text-xs font-bold bg-indigo-50" />
                                        <span>answers</span>
                                      </label>
                                    )}
                                    <input type="text" placeholder="Answer Key" value={q.correctAnswer || ''} onChange={(e) => updateQ({ correctAnswer: e.target.value, answerKeyConfidence: 'high', needsReview: false })} className="p-1 border border-emerald-300 rounded text-xs font-mono font-bold text-emerald-800 w-28 bg-emerald-50/40" />
                                    <button type="button" onClick={() => setEditableQuestions(editableQuestions.filter((_, i) => i !== idx))} className="p-1 text-slate-400 hover:text-red-500 rounded" title="Delete question"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>

                                {q.citation && <p className="text-[10px] text-slate-500 italic">Citation: {q.citation}</p>}

                                {/* Prompt */}
                                <input type="text" value={q.prompt} onChange={(e) => updateQ({ prompt: e.target.value })} className="w-full p-2 border border-slate-200 rounded text-xs font-medium text-slate-800 bg-white" placeholder="Question prompt / statement…" />

                                {/* TYPE-SPECIFIC CONTROLS */}

                                {/* MC / Multiple Select: options */}
                                {isMC && (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Answer Options</span>
                                      <button type="button" onClick={addOption} className="text-[10px] px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-bold">+ Add Option</button>
                                    </div>
                                    {(q.options || []).map((opt, optIdx) => (
                                      <div key={optIdx} className="flex items-center space-x-1">
                                        <span className="text-[10px] font-bold text-slate-400 w-5 shrink-0">{String.fromCharCode(65 + optIdx)}.</span>
                                        <input type="text" value={opt} onChange={(e) => updateOption(optIdx, e.target.value)} className="flex-1 p-1 border border-slate-200 rounded text-xs bg-white" placeholder={`Option ${String.fromCharCode(65 + optIdx)}…`} />
                                        <button type="button" onClick={() => removeOption(optIdx)} className="text-slate-300 hover:text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                                      </div>
                                    ))}
                                    {(!q.options || q.options.length === 0) && <p className="text-[10px] text-slate-400 italic pl-1">No options yet — click &ldquo;+ Add Option&rdquo; above.</p>}
                                  </div>
                                )}

                                {/* T/F/NG */}
                                {isTFNG && (
                                  <div className="bg-slate-50 rounded p-2 text-[10px] text-slate-500">
                                    <span className="font-bold text-slate-600">Accepted answers: </span>{q.type === 'true_false_not_given' ? 'TRUE, FALSE, NOT GIVEN' : 'YES, NO, NOT GIVEN'}
                                  </div>
                                )}

                                 {/* Completion: Word Limit, Answer Input Format & Shared Resources */}
                                {isCompletion && (
                                  <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-lg space-y-3">
                                    <div className="flex items-center justify-between pb-1 border-b border-indigo-100 flex-wrap gap-2">
                                      <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-wide">
                                        Completion Settings
                                      </span>
                                      {/* Format Selector Tabs */}
                                      <div className="flex items-center bg-white rounded-md border border-indigo-200 p-0.5 text-[10px]">
                                        <button
                                          type="button"
                                          onClick={() => updateQ({ completionFormat: 'text' })}
                                          className={`px-2 py-0.5 rounded font-bold transition-colors ${
                                            (!q.completionFormat || q.completionFormat === 'text')
                                              ? 'bg-indigo-600 text-white shadow-2xs'
                                              : 'text-indigo-900 hover:bg-indigo-50'
                                          }`}
                                        >
                                          Text Input
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateQ({ completionFormat: 'options' })}
                                          className={`px-2 py-0.5 rounded font-bold transition-colors ${
                                            q.completionFormat === 'options'
                                              ? 'bg-indigo-600 text-white shadow-2xs'
                                              : 'text-indigo-900 hover:bg-indigo-50'
                                          }`}
                                        >
                                          Choose from Options
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateQ({ completionFormat: 'word_list' })}
                                          className={`px-2 py-0.5 rounded font-bold transition-colors ${
                                            q.completionFormat === 'word_list'
                                              ? 'bg-indigo-600 text-white shadow-2xs'
                                              : 'text-indigo-900 hover:bg-indigo-50'
                                          }`}
                                        >
                                          Word List (A-Z)
                                        </button>
                                      </div>
                                    </div>

                                    {/* Word Limit Section */}
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between flex-wrap gap-2 text-[11px]">
                                        <span className="font-semibold text-slate-700">Word Limit:</span>
                                        <div className="flex items-center space-x-2">
                                          <label className="flex items-center space-x-1">
                                            <span className="text-[10px] text-slate-500">Max Words:</span>
                                            <select
                                              value={q.wordLimitCount || q.maxWords || 0}
                                              onChange={(e) => {
                                                const count = parseInt(e.target.value) || 0;
                                                const allowNum = q.allowNumbers ?? false;
                                                const instr = count > 0 ? formatWordLimitInstruction(count, allowNum) : '';
                                                updateQ({
                                                  wordLimitCount: count > 0 ? count : undefined,
                                                  maxWords: count > 0 ? count : undefined,
                                                  wordLimit: instr || undefined,
                                                  wordLimitInstruction: instr || undefined,
                                                });
                                              }}
                                              className="p-1 border border-indigo-200 rounded text-xs bg-white text-slate-800 font-semibold"
                                            >
                                              <option value="0">No limit</option>
                                              <option value="1">1 word (ONE WORD)</option>
                                              <option value="2">2 words (TWO WORDS)</option>
                                              <option value="3">3 words (THREE WORDS)</option>
                                              <option value="4">4 words (FOUR WORDS)</option>
                                            </select>
                                          </label>

                                          {(q.wordLimitCount || q.maxWords) ? (
                                            <label className="flex items-center space-x-1 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={q.allowNumbers ?? false}
                                                onChange={(e) => {
                                                  const allowNum = e.target.checked;
                                                  const count = q.wordLimitCount || q.maxWords || 1;
                                                  const instr = formatWordLimitInstruction(count, allowNum);
                                                  updateQ({
                                                    allowNumbers: allowNum,
                                                    wordLimit: instr,
                                                    wordLimitInstruction: instr,
                                                  });
                                                }}
                                                className="text-indigo-600 rounded text-xs"
                                              />
                                              <span className="text-[10px] font-semibold text-indigo-900">+ AND/OR A NUMBER</span>
                                            </label>
                                          ) : null}
                                        </div>
                                      </div>

                                      {(q.wordLimitInstruction || q.wordLimit) && (
                                        <div className="text-[10px] font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                          Instruction: {q.wordLimitInstruction || q.wordLimit}
                                        </div>
                                      )}
                                    </div>

                                    {/* Format A: Text Input */}
                                    {(!q.completionFormat || q.completionFormat === 'text') && (
                                      <div className="p-2 bg-white rounded border border-indigo-100 text-[10px] text-slate-500">
                                        Students will type their answer directly into a text input. The system will enforce the configured word limit and validate against the answer key.
                                      </div>
                                    )}

                                    {/* Format B: Choose from Options */}
                                    {q.completionFormat === 'options' && (
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Available Answer Options</span>
                                          <button
                                            type="button"
                                            onClick={addOption}
                                            className="text-[10px] px-1.5 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded font-bold"
                                          >
                                            + Add Option
                                          </button>
                                        </div>

                                        <div className="space-y-1">
                                          {(q.options || []).map((opt, optIdx) => (
                                            <div key={optIdx} className="flex items-center space-x-1">
                                              <span className="text-[10px] font-bold text-slate-400 w-5 shrink-0">{String.fromCharCode(65 + optIdx)}.</span>
                                              <input
                                                type="text"
                                                value={opt}
                                                onChange={(e) => updateOption(optIdx, e.target.value)}
                                                className="flex-1 p-1 border border-slate-200 rounded text-xs bg-white"
                                                placeholder={`Option ${String.fromCharCode(65 + optIdx)}…`}
                                              />
                                              <button
                                                type="button"
                                                onClick={() => removeOption(optIdx)}
                                                className="text-slate-300 hover:text-red-500 p-0.5"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          ))}
                                          {(!q.options || q.options.length === 0) && (
                                            <p className="text-[10px] text-slate-400 italic pl-1">No options yet — click &ldquo;+ Add Option&rdquo; above.</p>
                                          )}
                                        </div>

                                        <label className="flex items-center space-x-1.5 text-[11px] text-slate-700 font-medium cursor-pointer pt-1">
                                          <input
                                            type="checkbox"
                                            checked={q.preventDuplicateOptions ?? false}
                                            onChange={(e) => updateQ({ preventDuplicateOptions: e.target.checked })}
                                            className="text-indigo-600 rounded text-xs"
                                          />
                                          <span>Ngăn học sinh chọn trùng lặp giữa các câu hỏi (Prevent duplicate selection)</span>
                                        </label>
                                      </div>
                                    )}

                                    {/* Format C: Choose from Word List (A-Z) */}
                                    {q.completionFormat === 'word_list' && (
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Word Bank (A-Z)</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const currentList = q.wordList || q.options || [];
                                              updateQ({ wordList: [...currentList, ''], options: [...currentList, ''] });
                                            }}
                                            className="text-[10px] px-1.5 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded font-bold"
                                          >
                                            + Add Word
                                          </button>
                                        </div>

                                        <div className="space-y-1">
                                          {((q.wordList && q.wordList.length > 0) ? q.wordList : (q.options || [])).map((w, wIdx) => {
                                            const letter = String.fromCharCode(65 + wIdx);
                                            return (
                                              <div key={wIdx} className="flex items-center space-x-1">
                                                <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                                                  {letter}
                                                </span>
                                                <input
                                                  type="text"
                                                  value={w}
                                                  onChange={(e) => {
                                                    const currentList = [...((q.wordList && q.wordList.length > 0) ? q.wordList : (q.options || []))];
                                                    currentList[wIdx] = e.target.value;
                                                    updateQ({ wordList: currentList, options: currentList });
                                                  }}
                                                  className="flex-1 p-1 border border-slate-200 rounded text-xs bg-white"
                                                  placeholder={`Word / phrase for letter ${letter}…`}
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const currentList = ((q.wordList && q.wordList.length > 0) ? q.wordList : (q.options || [])).filter((_, i) => i !== wIdx);
                                                    updateQ({ wordList: currentList, options: currentList });
                                                  }}
                                                  className="text-slate-300 hover:text-red-500 p-0.5"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </button>
                                              </div>
                                            );
                                          })}
                                          {(!q.wordList || q.wordList.length === 0) && (!q.options || q.options.length === 0) && (
                                            <p className="text-[10px] text-slate-400 italic pl-1">No words in Word Bank — click &ldquo;+ Add Word&rdquo; above.</p>
                                          )}
                                        </div>

                                        <p className="text-[10px] text-slate-500 italic">
                                          Tip: Set Answer Key above to the letter corresponding to this blank (e.g. A, B, C...).
                                        </p>
                                      </div>
                                    )}

                                    {/* Shared Resources Across Questions */}
                                    <div className="pt-2 border-t border-indigo-100 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <label className="flex items-center space-x-1.5 text-[11px] font-bold text-indigo-900 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(q.sharedResourceId)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                const sId = `res_shared_${Date.now()}`;
                                                updateQ({ sharedResourceId: sId });
                                              } else {
                                                updateQ({ sharedResourceId: undefined });
                                              }
                                            }}
                                            className="text-indigo-600 rounded text-xs"
                                          />
                                          <span>Chia sẻ tài nguyên này với các câu hỏi khác (Share across questions)</span>
                                        </label>
                                      </div>

                                      {q.sharedResourceId && (
                                        <div className="p-2 bg-indigo-100/60 rounded text-[10px] space-y-1 text-indigo-950">
                                          <p className="font-semibold">Chọn các câu hỏi dùng chung Word Bank / Options này:</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {editableQuestions.map((otherQ, otherIdx) => {
                                              if (otherIdx === idx) return null;
                                              const isLinked = otherQ.sharedResourceId === q.sharedResourceId;
                                              return (
                                                <button
                                                  key={otherQ.id || otherIdx}
                                                  type="button"
                                                  onClick={() => {
                                                    const updated = [...editableQuestions];
                                                    if (isLinked) {
                                                      updated[otherIdx] = { ...updated[otherIdx], sharedResourceId: undefined, isTeacherEdited: true };
                                                    } else {
                                                      updated[otherIdx] = {
                                                        ...updated[otherIdx],
                                                        sharedResourceId: q.sharedResourceId,
                                                        completionFormat: q.completionFormat,
                                                        wordList: q.wordList ? [...q.wordList] : undefined,
                                                        options: q.options ? [...q.options] : undefined,
                                                        isTeacherEdited: true,
                                                      };
                                                    }
                                                    setEditableQuestions(updated);
                                                  }}
                                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                                    isLinked
                                                      ? 'bg-indigo-600 text-white border-indigo-600'
                                                      : 'bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-50'
                                                  }`}
                                                >
                                                  #{otherIdx + 1} {isLinked ? '✓' : '+'}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Matching */}
                                {isMatchingQ && (
                                  <div className="space-y-1.5">
                                    {q.type === 'matching_headings' && (
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Headings List</span>
                                          <button type="button" onClick={() => updateQ({ headingsList: [...(q.headingsList || []), ''] })} className="text-[10px] px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-bold">+ Add Heading</button>
                                        </div>
                                        {(q.headingsList || []).map((h, hIdx) => (
                                          <div key={hIdx} className="flex items-center space-x-1">
                                            <span className="text-[10px] text-slate-400 font-bold w-5 shrink-0">{hIdx + 1}.</span>
                                            <input type="text" value={h} onChange={(e) => { const list = [...(q.headingsList || [])]; list[hIdx] = e.target.value; updateQ({ headingsList: list }); }} className="flex-1 p-1 border border-slate-200 rounded text-xs bg-white" />
                                            <button type="button" onClick={() => updateQ({ headingsList: (q.headingsList || []).filter((_, i) => i !== hIdx) })} className="text-slate-300 hover:text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {q.type === 'matching_features' && (
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Features List</span>
                                          <button type="button" onClick={() => updateQ({ featuresList: [...(q.featuresList || []), ''] })} className="text-[10px] px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-bold">+ Add Feature</button>
                                        </div>
                                        {(q.featuresList || []).map((f, fIdx) => (
                                          <div key={fIdx} className="flex items-center space-x-1">
                                            <span className="text-[10px] text-slate-400 font-bold w-5 shrink-0">{String.fromCharCode(65 + fIdx)}.</span>
                                            <input type="text" value={f} onChange={(e) => { const list = [...(q.featuresList || [])]; list[fIdx] = e.target.value; updateQ({ featuresList: list }); }} className="flex-1 p-1 border border-slate-200 rounded text-xs bg-white" />
                                            <button type="button" onClick={() => updateQ({ featuresList: (q.featuresList || []).filter((_, i) => i !== fIdx) })} className="text-slate-300 hover:text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {(q.type === 'matching_information' || q.type === 'matching_sentence_endings') && (
                                      <div className="bg-slate-50 rounded p-2 text-[10px] text-slate-500">
                                        <span className="font-bold text-slate-600">Answer key format: </span>{q.type === 'matching_information' ? 'Paragraph letter (e.g. A, B, C…)' : 'Sentence ending label (e.g. A, B, C…)'}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Short answer */}
                                {q.type === 'short_answer' && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Accepted Answers (comma-separated)</span>
                                    <input type="text" value={q.correctAnswer || ''} onChange={(e) => updateQ({ correctAnswer: e.target.value, answerKeyConfidence: 'high', needsReview: false })} className="w-full p-1.5 border border-emerald-300 rounded text-xs font-mono bg-emerald-50/40 text-emerald-800 font-bold" placeholder="answer1, answer2, …" />
                                    {q.wordLimit && <p className="text-[10px] text-slate-400 italic">Word limit: {q.wordLimit}</p>}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">No questions in this section. Add questions manually or let AI generate them in the next step.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Raw Text Editor */
                <div className="flex-1 min-h-[400px] overflow-y-auto">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Raw Document Text (Full Content)</label>
                  <textarea rows={20} value={editedRawText} onChange={(e) => setEditedRawText(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
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
                  onClick={() => {
                    setReviewedTitle(editedTitle || activeDoc?.detectedStructure?.title || activeDoc?.name || '');
                    setReviewedInstructions(assignInstructions || 'Read the text carefully and answer all questions.');
                    setReviewedPassage(editedPassage || activeDoc?.detectedStructure?.passageText || activeDoc?.rawText || '');
                    if (editableQuestions.length > 0) {
                      setReviewedQuestions(editableQuestions);
                    }
                    setCurrentStep('config_assignment');
                  }}
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
                  onClick={handleStep3SaveToLibrary}
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
                        Save all structured passages, questions, options, and answer keys directly into your persistent teacher Resource Library for future use.
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

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                {editableQuestions.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setReviewedTitle(editedTitle || activeDoc?.detectedStructure?.title || activeDoc?.name || 'IELTS Reading Assignment');
                      setReviewedInstructions(assignInstructions || 'Read the text carefully and answer all questions.');
                      setReviewedPassage(editedPassage || activeDoc?.detectedStructure?.passageText || activeDoc?.rawText || '');
                      setReviewedQuestions(editableQuestions);
                      setCurrentStep('review_assignment');
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center justify-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Proceed Directly to Review & Assign ({editableQuestions.length} Questions Ready)</span>
                  </button>
                ) : (
                  <div />
                )}

                <button
                  type="button"
                  onClick={handleStartAiConversion}
                  disabled={isAiProcessing}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isAiProcessing ? 'Converting with Gemini...' : editableQuestions.length > 0 ? 'Re-analyze with Gemini AI' : 'Analyze & Generate Interactive Assignment'}</span>
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
                          <div className="flex items-center space-x-2 flex-wrap gap-1">
                            <span className="font-bold text-xs text-slate-900">Q{idx + 1}</span>
                            <span className="text-[10px] font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700 uppercase">
                              {q.type.replace(/_/g, ' ')}
                            </span>
                            {q.isTeacherEdited ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                                Teacher Edited
                              </span>
                            ) : q.source === 'source_extracted' ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                Source Extracted
                              </span>
                            ) : q.correctAnswer && (q.source === 'answer_key_extracted' || q.answerKeyConfidence === 'high') ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center space-x-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Answer Key Extracted</span>
                              </span>
                            ) : q.source === 'ai_generated' ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                                AI Generated
                              </span>
                            ) : null}
                            {(!q.correctAnswer || q.answerKeyConfidence === 'needs_teacher_review' || q.needsReview) && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center space-x-1">
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                <span>Review Key Needed</span>
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
                                  isTeacherEdited: true,
                                })
                              }
                              placeholder="e.g. A, TRUE, or answer phrase"
                              className="w-full p-1.5 border border-slate-300 rounded text-xs font-bold text-emerald-700 bg-emerald-50/20"
                            />
                            {q.citation && (
                              <p className="text-[10px] text-slate-500 italic mt-1">Citation: {q.citation}</p>
                            )}
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
                    type="button"
                    onClick={handleSaveCurrentTestToLibrary}
                    disabled={isPublishingAssignment}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center space-x-1.5"
                    title="Lưu toàn bộ bài tập và câu hỏi đã chỉnh sửa vào Thư viện tài nguyên"
                  >
                    <Save className="w-4 h-4 text-emerald-600" />
                    <span>Lưu vào Thư viện</span>
                  </button>

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
        <div className={`bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 ${currentStep === 'preview' ? 'px-4 py-2' : 'px-6 py-3'}`}>
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

            {currentStep === 'preview' && importSkillType === 'speaking' && (
              <button
                type="button"
                disabled={isSavingSpeakingResources || (!savePart1 && !savePart2 && !savePart3)}
                onClick={handleSaveSpeakingToLibrary}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                <span>{isSavingSpeakingResources ? 'Đang lưu vào Thư viện...' : 'Lưu các phần đã chọn vào Thư viện tài liệu'}</span>
              </button>
            )}

            {currentStep === 'preview' && importSkillType !== 'speaking' && (
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Course:</span>
                  <select
                    value={assignCourseId}
                    onChange={(e) => setAssignCourseId(e.target.value)}
                    className="p-1 border border-slate-300 rounded text-xs bg-white text-slate-800 font-semibold max-w-[140px] truncate"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={isPublishingAssignment}
                  onClick={handleAssignCurrentPassageDirectly}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1 border border-blue-200"
                  title="Assign only the currently selected passage directly to the course"
                >
                  <span>Assign This Passage</span>
                </button>
                <button
                  onClick={() => setCurrentStep('choose_output')}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center space-x-1.5 shadow-xs"
                >
                  <span>Continue to Output Options</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
};
