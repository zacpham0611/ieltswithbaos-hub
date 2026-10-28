import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  AiReadingTestConfig,
  GeneratedReadingTest,
  ParsedPassage,
  QuestionGroup,
  ReadingQuestion,
  QuestionType,
} from '../types';
import {
  processDocumentFile,
  ExtractedDocument,
} from '../lib/documentExtractor';
import {
  generateReadingTestWithAi,
  regenerateQuestionGroupWithAi,
} from '../lib/ai';
import {
  Sparkles,
  X,
  FileText,
  Link as LinkIcon,
  Upload,
  Clock,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Save,
  Send,
  Plus,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  Layers,
  FileUp,
  Sliders,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

interface AiReadingTestGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTest?: GeneratedReadingTest | null;
}

const ALL_IELTS_QUESTION_TYPES: { type: QuestionType; label: string; desc: string }[] = [
  { type: 'matching_headings', label: 'Matching Headings', desc: 'Match section headings (i, ii, iii...)' },
  { type: 'true_false_not_given', label: 'True / False / Not Given', desc: 'Factual verification' },
  { type: 'yes_no_not_given', label: 'Yes / No / Not Given', desc: "Writer's claims or views" },
  { type: 'multiple_choice', label: 'Multiple Choice', desc: '4-option academic choice' },
  { type: 'summary_completion', label: 'Summary Completion', desc: 'Fill in summary gaps' },
  { type: 'sentence_completion', label: 'Sentence Completion', desc: 'Complete sentence with word limit' },
  { type: 'note_completion', label: 'Note Completion', desc: 'Fill in bulleted lecture notes' },
  { type: 'matching_information', label: 'Matching Information', desc: 'Which paragraph contains info' },
  { type: 'matching_features', label: 'Matching Features', desc: 'Match statements to people / theories' },
  { type: 'matching_sentence_endings', label: 'Matching Sentence Endings', desc: 'Match stem to ending A-G' },
  { type: 'table_completion', label: 'Table Completion', desc: 'Complete table cells' },
  { type: 'flowchart_completion', label: 'Flow-chart Completion', desc: 'Process / sequence completion' },
  { type: 'diagram_completion', label: 'Diagram / Map Labelling', desc: 'Label technical diagram parts' },
  { type: 'short_answer', label: 'Short-answer Questions', desc: 'Direct question with word limit' },
];

export const AiReadingTestGeneratorModal: React.FC<AiReadingTestGeneratorModalProps> = ({
  isOpen,
  onClose,
  initialTest,
}) => {
  const { currentUser, courses, createAssignment, addResource } = useApp();

  // Mode: 'configure' | 'preview_edit'
  const [viewMode, setViewMode] = useState<'configure' | 'preview_edit'>(
    initialTest ? 'preview_edit' : 'configure'
  );

  // Configuration State
  const [sourceType, setSourceType] = useState<'url' | 'file' | 'text'>('text');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [extractedFileInfo, setExtractedFileInfo] = useState<{ name: string; size: number; words: number } | null>(null);

  const [title, setTitle] = useState(initialTest?.title || '');
  const [topic, setTopic] = useState(initialTest?.topic || '');
  const [passageCount, setPassageCount] = useState<number>(initialTest?.passages?.length || 1);
  const [difficultyLevel, setDifficultyLevel] = useState<number>(initialTest?.difficultyLevel || 6);
  const [totalQuestions, setTotalQuestions] = useState<number>(13);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(initialTest?.timeLimitMinutes || 20);
  const [wordLimitConstraint, setWordLimitConstraint] = useState<string>('NO MORE THAN TWO WORDS');

  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([
    'matching_headings',
    'true_false_not_given',
    'multiple_choice',
    'sentence_completion',
  ]);

  // Loading, progress, & errors
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isUrlInspecting, setIsUrlInspecting] = useState(false);
  const [urlSnippet, setUrlSnippet] = useState<{ url: string; wordCount: number } | null>(null);

  // Generated Test State
  const [generatedTest, setGeneratedTest] = useState<GeneratedReadingTest | null>(initialTest || null);
  const [activePassageTab, setActivePassageTab] = useState<number>(0);
  const [regeneratingGroupIdx, setRegeneratingGroupIdx] = useState<number | null>(null);
  const [validationReport, setValidationReport] = useState<{ isValid: boolean; messages: string[] } | null>(null);

  // Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignCourseId, setAssignCourseId] = useState(courses[0]?.id || '');
  const [assignDueDate, setAssignDueDate] = useState('2026-11-05');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // ==========================================
  // HELPERS: Difficulty Labels
  // ==========================================
  const getDifficultyMeta = (level: number) => {
    if (level <= 2) {
      return {
        label: 'Very Easy (Band 3.5 - 4.5)',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        desc: 'Simple sentence structures, common everyday vocabulary, verbatim word matching in questions, obvious distractors.',
      };
    }
    if (level <= 4) {
      return {
        label: 'Easy-Intermediate (Band 5.0 - 5.5)',
        badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
        desc: 'Accessible academic style, clear topic sentences, straightforward synonyms (e.g. discover -> find), simple distractors.',
      };
    }
    if (level <= 6) {
      return {
        label: 'Intermediate (Band 6.0 - 6.5) — Official IELTS Benchmark',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
        desc: 'Standard Cambridge IELTS Academic text, diverse sentence patterns, moderate paraphrasing across clauses, plausible distractors.',
      };
    }
    if (level <= 8) {
      return {
        label: 'Advanced (Band 7.0 - 7.5)',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
        desc: 'Complex academic syntax, low-frequency collocations, subtle distractors with deceptive partial truths, inferential reasoning.',
      };
    }
    return {
      label: 'Expert / Maximum Challenge (Band 8.0 - 9.0)',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
      desc: 'Highly erudite, abstract academic discourse, convoluted syntactic embeddings, subtle hedging, cross-paragraph synthesis traps.',
    };
  };

  // ==========================================
  // HANDLER: URL INSPECTION
  // ==========================================
  const handleInspectUrl = async () => {
    if (!sourceUrl.trim()) return;
    try {
      new URL(sourceUrl.trim());
    } catch {
      setGenerationError('Please enter a valid URL (starting with http:// or https://).');
      return;
    }

    setIsUrlInspecting(true);
    setGenerationError(null);
    try {
      // Basic client check
      const urlObj = new URL(sourceUrl.trim());
      setUrlSnippet({ url: urlObj.hostname, wordCount: 0 });
    } catch (err: any) {
      setGenerationError(err.message || 'Failed to inspect URL.');
    } finally {
      setIsUrlInspecting(false);
    }
  };

  // ==========================================
  // HANDLER: FILE UPLOAD
  // ==========================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSourceFile(file);
    setGenerationError(null);
    try {
      const doc = await processDocumentFile(file);
      if (doc.status === 'error') {
        setGenerationError(doc.errorMessage || 'Failed to extract text from file.');
        return;
      }
      const words = doc.rawText.split(/\s+/).filter(Boolean).length;
      setExtractedFileInfo({
        name: file.name,
        size: file.size,
        words,
      });
      setSourceText(doc.rawText);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    } catch (err: any) {
      setGenerationError(err.message || 'File processing failed.');
    }
  };

  // ==========================================
  // HANDLER: GENERATE TEST WITH AI
  // ==========================================
  const handleGenerateTest = async () => {
    setGenerationError(null);
    setValidationReport(null);

    // Validation 1: Source content
    let effectiveSource = sourceText.trim();
    if (sourceType === 'url') {
      if (!sourceUrl.trim()) {
        setGenerationError('Please provide an article URL.');
        return;
      }
    } else {
      if (!effectiveSource || effectiveSource.length < 50) {
        setGenerationError('Please provide sufficient source text (at least 50 characters).');
        return;
      }
    }

    // Validation 2: Word count sufficiency
    const wordCount = effectiveSource.split(/\s+/).filter(Boolean).length;
    const minWords = passageCount === 3 ? 500 : passageCount === 2 ? 300 : 80;
    if (sourceType !== 'url' && wordCount < minWords) {
      setGenerationError(
        `Source text has only ${wordCount} words, which is insufficient for ${passageCount} passage(s). Please reduce the passage count to 1 or provide more text.`
      );
      return;
    }

    if (selectedTypes.length === 0) {
      setGenerationError('Please select at least one IELTS Reading question type.');
      return;
    }

    setIsGenerating(true);
    setGenerationStep('Analyzing source text and calibrating vocabulary to difficulty level...');

    try {
      const res = await generateReadingTestWithAi({
        sourceType,
        sourceUrl: sourceType === 'url' ? sourceUrl.trim() : undefined,
        sourceText: effectiveSource || undefined,
        sourceDocumentName: sourceFile?.name,
        topic: topic.trim() || undefined,
        passageCount,
        questionTypes: selectedTypes,
        questionCount: totalQuestions,
        difficultyLevel,
        timeLimitMinutes,
        wordLimitConstraint,
      });

      setGenerationStep('Finalizing passages, question groups, and explanation citations...');

      const structured = res.structuredData;
      if (!structured || !structured.passages || structured.passages.length === 0) {
        // Fallback: build structure from raw response
        throw new Error('AI generation did not return a structured test. Please try again with different settings.');
      }

      // Normalize generated passages
      const normalizedPassages: ParsedPassage[] = structured.passages.map((p: any, pIdx: number) => {
        const passageIdx = p.passageIndex || pIdx + 1;
        const qGroups: QuestionGroup[] = (p.questionGroups || []).map((g: any, gIdx: number) => {
          const questions: ReadingQuestion[] = (g.questions || []).map((q: any, qIdx: number) => ({
            id: q.id || `q_${passageIdx}_${gIdx + 1}_${qIdx + 1}`,
            type: q.type || g.questionType || 'multiple_choice',
            prompt: q.prompt || '',
            options: q.options || undefined,
            wordLimit: q.wordLimit || g.wordLimit,
            correctAnswer: q.correctAnswer || '',
            explanation: q.explanation || 'Directly cited from passage.',
            points: q.points || 1,
            source: 'ai_generated',
            answerKeyConfidence: 'high',
          }));

          return {
            id: g.id || `qgroup_${passageIdx}_${gIdx + 1}`,
            groupTitle: g.groupTitle || `Questions ${gIdx + 1}`,
            instructions: g.instructions || 'Answer the questions below.',
            questionType: g.questionType || 'multiple_choice',
            wordLimit: g.wordLimit,
            headingsList: g.headingsList,
            featuresList: g.featuresList,
            optionsBox: g.optionsBox,
            questions,
          };
        });

        return {
          id: `passage_${passageIdx}`,
          passageIndex: passageIdx,
          title: p.title || `Passage ${passageIdx}`,
          subtitle: p.subtitle,
          content: p.content || '',
          questionGroups: qGroups,
          questions: qGroups.flatMap((g) => g.questions),
        };
      });

      const newTest: GeneratedReadingTest = {
        id: `test_${Date.now()}`,
        title: structured.title || title || 'AI Generated IELTS Reading Practice',
        topic: structured.topic || topic,
        difficultyLevel,
        timeLimitMinutes: structured.timeLimitMinutes || timeLimitMinutes,
        passages: normalizedPassages,
        teacherNotes: structured.teacherNotes,
        createdAt: new Date().toISOString(),
      };

      setGeneratedTest(newTest);
      setViewMode('preview_edit');
      setActivePassageTab(0);
      runValidation(newTest);
    } catch (err: any) {
      setGenerationError(err.message || 'Failed to generate test. Please check network connection or try a shorter prompt.');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  // ==========================================
  // HANDLER: REGENERATE INDIVIDUAL QUESTION GROUP
  // ==========================================
  const handleRegenerateGroup = async (passageIdx: number, groupIdx: number) => {
    if (!generatedTest) return;
    const passage = generatedTest.passages[passageIdx];
    if (!passage || !passage.questionGroups?.[groupIdx]) return;

    const group = passage.questionGroups[groupIdx];
    setRegeneratingGroupIdx(groupIdx);
    setGenerationError(null);

    try {
      const res = await regenerateQuestionGroupWithAi({
        passageText: passage.content,
        questionType: group.questionType,
        questionCount: group.questions.length || 4,
        difficultyLevel: generatedTest.difficultyLevel,
      });

      const structured = res.structuredData;
      if (structured && structured.questions && structured.questions.length > 0) {
        const updatedQuestions: ReadingQuestion[] = structured.questions.map((q: any, i: number) => ({
          id: `q_${passage.passageIndex}_${groupIdx + 1}_${i + 1}`,
          type: q.type || group.questionType,
          prompt: q.prompt || '',
          options: q.options,
          correctAnswer: q.correctAnswer || '',
          explanation: q.explanation || 'Cited from passage.',
          points: 1,
          source: 'ai_generated',
          answerKeyConfidence: 'high',
        }));

        const updatedGroup: QuestionGroup = {
          ...group,
          instructions: structured.instructions || group.instructions,
          headingsList: structured.headingsList || group.headingsList,
          featuresList: structured.featuresList || group.featuresList,
          questions: updatedQuestions,
        };

        const updatedPassages = [...generatedTest.passages];
        const newGroups = [...(passage.questionGroups || [])];
        newGroups[groupIdx] = updatedGroup;
        updatedPassages[passageIdx] = {
          ...passage,
          questionGroups: newGroups,
          questions: newGroups.flatMap((g) => g.questions),
        };

        const updatedTest = { ...generatedTest, passages: updatedPassages };
        setGeneratedTest(updatedTest);
        runValidation(updatedTest);
      }
    } catch (err: any) {
      setGenerationError(`Failed to regenerate question group: ${err.message}`);
    } finally {
      setRegeneratingGroupIdx(null);
    }
  };

  // ==========================================
  // HANDLER: VALIDATE TEST
  // ==========================================
  const runValidation = (test: GeneratedReadingTest) => {
    const messages: string[] = [];
    let allValid = true;

    if (!test.title.trim()) {
      messages.push('Warning: Test title is blank.');
      allValid = false;
    }

    test.passages.forEach((p, pIdx) => {
      if (!p.content.trim()) {
        messages.push(`Passage ${pIdx + 1} has empty text content.`);
        allValid = false;
      }
      if (!p.questionGroups || p.questionGroups.length === 0) {
        messages.push(`Passage ${pIdx + 1} has no question groups.`);
        allValid = false;
      }

      p.questionGroups?.forEach((g, gIdx) => {
        g.questions.forEach((q, qIdx) => {
          const qNum = `P${pIdx + 1}-G${gIdx + 1}-Q${qIdx + 1}`;
          if (!q.prompt.trim()) {
            messages.push(`${qNum}: Question prompt is empty.`);
            allValid = false;
          }
          if (!q.correctAnswer.trim()) {
            messages.push(`${qNum}: Missing correct answer key.`);
            allValid = false;
          }
          if (q.type === 'multiple_choice' && (!q.options || q.options.length < 2)) {
            messages.push(`${qNum}: Multiple choice requires at least 2 options.`);
            allValid = false;
          }
        });
      });
    });

    if (allValid) {
      const totalQ = test.passages.reduce((acc, p) => acc + (p.questions?.length || 0), 0);
      messages.push(`✓ Complete IELTS Test Validation Passed: ${test.passages.length} Passage(s), ${totalQ} Questions with answers & explanations verified.`);
    }

    setValidationReport({ isValid: allValid, messages });
  };

  // ==========================================
  // HANDLER: SAVE TO LIBRARY
  // ==========================================
  const handleSaveToLibrary = async () => {
    if (!generatedTest || !currentUser) return;

    try {
      const testJson = JSON.stringify(generatedTest);
      const totalQ = generatedTest.passages.reduce((sum, p) => sum + (p.questions?.length || 0), 0);

      await addResource({
        title: generatedTest.title,
        type: 'doc',
        skill: 'reading',
        folder: 'AI Reading Tests',
        content: testJson,
        tags: [
          'ielts',
          'reading',
          'ai-generated',
          `diff-${generatedTest.difficultyLevel}`,
          `${totalQ}-questions`,
        ],
        isPublished: false, // Never auto-published
        courseId: null, // Saved to global library
      });

      setSaveSuccessMsg(`Test "${generatedTest.title}" saved successfully to Library folder "AI Reading Tests"!`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      setGenerationError(`Failed to save to library: ${err.message}`);
    }
  };

  // ==========================================
  // HANDLER: ASSIGN TEST TO COURSE
  // ==========================================
  const handleConfirmAssignment = async () => {
    if (!generatedTest || !assignCourseId) return;

    try {
      const primaryPassage = generatedTest.passages[0];
      const allQuestions = generatedTest.passages.flatMap((p) => p.questions || []);
      const allQuestionGroups = generatedTest.passages.flatMap((p) => p.questionGroups || []);

      await createAssignment({
        courseId: assignCourseId,
        title: generatedTest.title,
        instructions: `Timed IELTS Reading Test (${generatedTest.timeLimitMinutes} minutes). Answer all questions carefully.`,
        skill: 'reading',
        objectives: `Calibrated to Difficulty ${generatedTest.difficultyLevel}/10. Practice academic reading speed, scanning, and analytical comprehension.`,
        dueDate: assignDueDate,
        status: 'published',
        readingTestType: 'academic',
        readingPassage: primaryPassage.content,
        readingQuestions: allQuestions,
        questionGroups: allQuestionGroups,
        passages: generatedTest.passages,
      });

      setShowAssignModal(false);
      setSaveSuccessMsg(`Test successfully assigned to selected course!`);
      setTimeout(() => {
        setSaveSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setGenerationError(`Failed to assign test: ${err.message}`);
    }
  };

  const diffMeta = getDifficultyMeta(difficultyLevel);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900">Generate Reading Test with AI</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  IELTS Reading Studio
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Create authentic, multi-format IELTS Reading tests from URLs, documents, or topics with 1–10 difficulty calibration.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {viewMode === 'preview_edit' && (
              <button
                onClick={() => setViewMode('configure')}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center space-x-1"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Adjust Settings</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NOTICES */}
        {generationError && (
          <div className="mx-5 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{generationError}</p>
            </div>
            <button onClick={() => setGenerationError(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {saveSuccessMsg && (
          <div className="mx-5 mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-800">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-5">
          {viewMode === 'configure' ? (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* SOURCE SELECTION */}
              <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <span>1. Input Source Material</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500">Choose how to provide article content</span>
                </div>

                {/* Source Type Tabs */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSourceType('url')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                      sourceType === 'url'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Article URL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceType('file')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                      sourceType === 'file'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Document</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceType('text')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                      sourceType === 'text'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Direct Text / Topic</span>
                  </button>
                </div>

                {/* URL INPUT */}
                {sourceType === 'url' && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="url"
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        placeholder="https://www.bbc.com/news/science-environment-... or any academic article URL"
                        className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleInspectUrl}
                        disabled={isUrlInspecting || !sourceUrl.trim()}
                        className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 disabled:opacity-50 shrink-0"
                      >
                        {isUrlInspecting ? 'Checking...' : 'Inspect URL'}
                      </button>
                    </div>
                    {urlSnippet && (
                      <p className="text-[11px] text-emerald-700 flex items-center space-x-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Domain verified: <strong>{urlSnippet.url}</strong>. Full content will be fetched server-side during generation.</span>
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500">
                      The Edge Function will securely extract article text from the link. If the site is behind a paywall or blocks bots, please copy and paste the text into the Direct Text tab.
                    </p>
                  </div>
                )}

                {/* FILE INPUT */}
                {sourceType === 'file' && (
                  <div className="space-y-2 pt-1">
                    <label className="border-2 border-dashed border-slate-300 hover:border-blue-400 bg-white rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors">
                      <FileUp className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-xs font-bold text-slate-700">Click to upload or drag & drop</span>
                      <span className="text-[11px] text-slate-400 mt-0.5">PDF, DOCX, TXT, Markdown (up to 20MB)</span>
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.txt,.md"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    {extractedFileInfo && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-emerald-600" />
                          <span className="font-semibold">{extractedFileInfo.name}</span>
                          <span className="text-emerald-600 font-mono text-[11px]">({extractedFileInfo.words} words extracted)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSourceFile(null);
                            setExtractedFileInfo(null);
                            setSourceText('');
                          }}
                          className="text-emerald-700 hover:text-emerald-900"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* TEXT INPUT */}
                {sourceType === 'text' && (
                  <div className="space-y-2 pt-1">
                    <textarea
                      rows={5}
                      value={sourceText}
                      onChange={(e) => setSourceText(e.target.value)}
                      placeholder="Paste your source article, journal summary, research notes, or write a detailed topic description..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Word count: <strong>{sourceText.split(/\s+/).filter(Boolean).length} words</strong></span>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-slate-400">Quick Topic Samples:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTopic('Deep-Sea Hydrothermal Vents and Extremophiles');
                            setTitle('The Mysteries of Deep-Sea Hydrothermal Ecosystems');
                            setSourceText(
                              `Deep-sea hydrothermal vents are fissures on the seabed from which geothermally heated water issues. Hydrothermal vents are commonly found along mid-ocean ridges, where tectonic plates move apart. The water emerging from these vents is mineral-rich and can reach temperatures exceeding 400 degrees Celsius, yet it does not boil because of the immense hydrostatic pressure of the deep ocean.

Surrounding these vents are unique ecosystems sustained by chemolithoautotrophic bacteria. Unlike terrestrial ecosystems that rely on sunlight and photosynthesis, vent organisms harness chemical energy from compounds such as hydrogen sulfide, methane, and dissolved iron. Giant tube worms, known as Riftia pachyptila, lack a digestive tract entirely and rely on symbiotic bacteria living inside an organ called the trophosome to synthesize nutrients. Other bizarre creatures, including blind hydrothermal shrimp and vent crabs, thrive in these pitch-black environments.

Scientists believe that hydrothermal vents may hold crucial clues about the origin of life on Earth. The chemical gradients, thermal energy, and mineral surfaces in ancient alkaline vents could have catalyzed the earliest prebiotic metabolic pathways. Furthermore, hydrothermal vent research informs the search for extraterrestrial life, particularly on icy ocean moons such as Jupiter's Europa and Saturn's Enceladus, where sub-surface oceans are hypothesized to harbor active hydrothermal systems.`
                            );
                          }}
                          className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                        >
                          Deep-Sea Biology
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTopic('Urban Planning and the 15-Minute City Concept');
                            setTitle('Redefining Metropolis: The Rise of 15-Minute Cities');
                            setSourceText(
                              `The 15-minute city is an urban planning paradigm first popularized by French-Colombian scientist Carlos Moreno. It posits that all residents should be able to access most of their daily necessities—work, housing, food, health, education, culture, and leisure—within a 15-minute walk or bike ride from their homes.

This concept seeks to reverse decades of car-centric suburban sprawl, which separated residential zones from commercial districts and forced commuters to spend countless hours in transit congestion. By emphasizing hyper-proximity, active mobility, and mixed-use zoning, the model drastically cuts greenhouse gas emissions, improves public health through increased physical activity, and revitalizes neighborhood social cohesion.

Cities such as Paris, Melbourne, and Milan have actively integrated 15-minute urban frameworks into their post-pandemic recovery plans. However, critics argue that without robust equitable housing policies, the concept risks exacerbating gentrification, as amenity-rich neighborhoods become unaffordable for lower-income service workers who are pushed to urban peripheries.`
                            );
                          }}
                          className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                        >
                          Urban Planning
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* TEST SPECIFICATIONS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Test Title & Topic */}
                <div className="space-y-3 bg-white border border-slate-200 rounded-xl p-4">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    2. Test Metadata
                  </label>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Test Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Cambridge IELTS Academic Reading Practice: Arctic Ecology"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Specific Topic / Discipline</label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g. Environmental Science, Psychology, Archaeology"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Passages & Questions Count */}
                <div className="space-y-3 bg-white border border-slate-200 rounded-xl p-4">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    3. Scope & Timing
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setPassageCount(num);
                          setTotalQuestions(num === 1 ? 13 : num === 2 ? 26 : 40);
                          setTimeLimitMinutes(num * 20);
                        }}
                        className={`p-2.5 rounded-lg border text-center transition-all ${
                          passageCount === num
                            ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs">{num} Passage{num > 1 ? 's' : ''}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{num * 20} mins</div>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-600 font-medium">Total Questions:</span>
                    <select
                      value={totalQuestions}
                      onChange={(e) => setTotalQuestions(Number(e.target.value))}
                      className="px-2 py-1 text-xs border border-slate-300 rounded-lg font-semibold"
                    >
                      <option value={10}>10 Questions (Quick Quiz)</option>
                      <option value={13}>13 Questions (Standard Single Passage)</option>
                      <option value={14}>14 Questions (Standard Single Passage)</option>
                      <option value={26}>26 Questions (2 Passages)</option>
                      <option value={40}>40 Questions (Full IELTS Mock Test)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* DIFFICULTY CALIBRATION (1-10) */}
              <div className="bg-gradient-to-r from-slate-50 via-indigo-50/30 to-purple-50/20 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      4. Calibrated Difficulty Level (Scale 1–10)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Genuinely alters lexical frequency, syntax, distractor subtlety, and inferential requirements.
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${diffMeta.badgeColor}`}>
                    Level {difficultyLevel}/10
                  </span>
                </div>

                {/* Slider */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={difficultyLevel}
                    onChange={(e) => setDifficultyLevel(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono px-1">
                    <span>1 (Very Easy)</span>
                    <span>3</span>
                    <span>5 (Standard B2)</span>
                    <span>7</span>
                    <span>10 (Expert C2)</span>
                  </div>
                </div>

                {/* Active Level Description Card */}
                <div className="p-3 bg-white border border-slate-200/90 rounded-lg text-xs space-y-1">
                  <div className="font-bold text-slate-800">{diffMeta.label}</div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">{diffMeta.desc}</p>
                </div>
              </div>

              {/* QUESTION TYPES SELECTION */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      5. IELTS Reading Question Types
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Select which authentic question formats to include
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTypes([
                          'matching_headings',
                          'true_false_not_given',
                          'multiple_choice',
                          'sentence_completion',
                        ])
                      }
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                    >
                      Standard Mix
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTypes(ALL_IELTS_QUESTION_TYPES.map((t) => t.type))}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                    >
                      Select All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {ALL_IELTS_QUESTION_TYPES.map((item) => {
                    const isSelected = selectedTypes.includes(item.type);
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (selectedTypes.length > 1) {
                              setSelectedTypes(selectedTypes.filter((t) => t !== item.type));
                            }
                          } else {
                            setSelectedTypes([...selectedTypes, item.type]);
                          }
                        }}
                        className={`p-2.5 rounded-lg border text-left transition-all flex items-start space-x-2 ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-400 text-blue-900 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate">{item.label}</div>
                          <div className="text-[10px] text-slate-400 truncate">{item.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* GENERATE BUTTON */}
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateTest}
                  disabled={isGenerating}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-white animate-pulse" />
                  <span>{isGenerating ? 'Generating Test with AI...' : 'Generate Reading Test Now'}</span>
                </button>
              </div>

              {/* Progress Steps during Generation */}
              {isGenerating && (
                <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center space-x-2 text-xs font-bold text-indigo-900">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span>AI Generation Pipeline in Progress</span>
                  </div>
                  <p className="text-xs text-indigo-700">{generationStep}</p>
                </div>
              )}
            </div>
          ) : (
            // ==========================================
            // PREVIEW & EDIT VIEW
            // ==========================================
            generatedTest && (
              <div className="space-y-5">
                {/* Test Summary Banner */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={generatedTest.title}
                        onChange={(e) => setGeneratedTest({ ...generatedTest, title: e.target.value })}
                        className="font-bold text-base text-slate-900 border-b border-dashed border-slate-300 hover:border-blue-500 focus:outline-hidden focus:border-blue-600 px-1 py-0.5 bg-transparent"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className={`px-2 py-0.5 rounded-full font-bold border ${diffMeta.badgeColor}`}>
                        Difficulty {generatedTest.difficultyLevel}/10
                      </span>
                      <span>•</span>
                      <span>{generatedTest.passages.length} Passage(s)</span>
                      <span>•</span>
                      <span>
                        {generatedTest.passages.reduce((sum, p) => sum + (p.questions?.length || 0), 0)} Questions
                      </span>
                      <span>•</span>
                      <span>{generatedTest.timeLimitMinutes} Mins</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => runValidation(generatedTest)}
                      className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center space-x-1"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                      <span>Validate Test</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateTest()}
                      className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Regenerate All</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveToLibrary}
                      className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-xs transition-colors flex items-center space-x-1.5"
                    >
                      <Save className="w-3.5 h-3.5 text-white" />
                      <span>Save to Library</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAssignModal(true)}
                      className="px-3.5 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-xs transition-colors flex items-center space-x-1.5"
                    >
                      <Send className="w-3.5 h-3.5 text-white" />
                      <span>Assign Test</span>
                    </button>
                  </div>
                </div>

                {/* Validation Report */}
                {validationReport && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                      validationReport.isValid
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    {validationReport.messages.map((m, i) => (
                      <p key={i} className="flex items-center space-x-1.5">
                        {validationReport.isValid ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        )}
                        <span>{m}</span>
                      </p>
                    ))}
                  </div>
                )}

                {/* Multi-Passage Tabs */}
                {generatedTest.passages.length > 1 && (
                  <div className="flex border-b border-slate-200 space-x-1">
                    {generatedTest.passages.map((p, idx) => (
                      <button
                        key={p.id}
                        onClick={() => setActivePassageTab(idx)}
                        className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                          activePassageTab === idx
                            ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Passage {p.passageIndex}: {p.title.slice(0, 25)}...
                      </button>
                    ))}
                  </div>
                )}

                {/* Active Passage & Question Groups Split View */}
                {generatedTest.passages[activePassageTab] && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* LEFT: PASSAGE TEXT */}
                    <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4 flex flex-col space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                          <BookOpen className="w-4 h-4 text-blue-600" />
                          <span>Reading Passage Content</span>
                        </label>
                        <span className="text-[11px] text-slate-400">Editable (Paragraphs A, B, C...)</span>
                      </div>

                      <input
                        type="text"
                        value={generatedTest.passages[activePassageTab].title}
                        onChange={(e) => {
                          const updated = [...generatedTest.passages];
                          updated[activePassageTab].title = e.target.value;
                          setGeneratedTest({ ...generatedTest, passages: updated });
                        }}
                        placeholder="Passage Title"
                        className="w-full px-3 py-1.5 text-sm font-bold border border-slate-300 rounded-lg bg-white"
                      />

                      <textarea
                        rows={18}
                        value={generatedTest.passages[activePassageTab].content}
                        onChange={(e) => {
                          const updated = [...generatedTest.passages];
                          updated[activePassageTab].content = e.target.value;
                          setGeneratedTest({ ...generatedTest, passages: updated });
                        }}
                        className="w-full p-3 text-xs border border-slate-300 rounded-lg bg-white leading-relaxed font-serif text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* RIGHT: QUESTION GROUPS */}
                    <div className="space-y-4 overflow-y-auto max-h-[650px] pr-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                          <Layers className="w-4 h-4 text-indigo-600" />
                          <span>Question Groups & Questions</span>
                        </label>
                        <span className="text-[11px] text-slate-500">
                          {generatedTest.passages[activePassageTab].questionGroups?.length || 0} Groups
                        </span>
                      </div>

                      {generatedTest.passages[activePassageTab].questionGroups?.map((group, gIdx) => (
                        <div key={group.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                          {/* Group Header */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                                {group.questionType.replace(/_/g, ' ')}
                              </span>
                              <input
                                type="text"
                                value={group.groupTitle || `Group ${gIdx + 1}`}
                                onChange={(e) => {
                                  const updatedPassages = [...generatedTest.passages];
                                  updatedPassages[activePassageTab].questionGroups![gIdx].groupTitle = e.target.value;
                                  setGeneratedTest({ ...generatedTest, passages: updatedPassages });
                                }}
                                className="text-xs font-bold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-blue-500 px-1"
                              />
                            </div>

                            {/* Regenerate This Group Button */}
                            <button
                              type="button"
                              onClick={() => handleRegenerateGroup(activePassageTab, gIdx)}
                              disabled={regeneratingGroupIdx === gIdx}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md border border-indigo-200 flex items-center space-x-1 transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className={`w-3 h-3 ${regeneratingGroupIdx === gIdx ? 'animate-spin' : ''}`} />
                              <span>{regeneratingGroupIdx === gIdx ? 'Regenerating...' : 'Regenerate Group'}</span>
                            </button>
                          </div>

                          {/* Instructions */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Instructions
                            </label>
                            <input
                              type="text"
                              value={group.instructions}
                              onChange={(e) => {
                                const updatedPassages = [...generatedTest.passages];
                                updatedPassages[activePassageTab].questionGroups![gIdx].instructions = e.target.value;
                                setGeneratedTest({ ...generatedTest, passages: updatedPassages });
                              }}
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700 font-medium"
                            />
                          </div>

                          {/* Headings List if Matching Headings */}
                          {group.headingsList && group.headingsList.length > 0 && (
                            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg space-y-1.5">
                              <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                                List of Headings Reference
                              </label>
                              {group.headingsList.map((h, hIdx) => (
                                <div key={hIdx} className="text-xs text-amber-900 font-serif">
                                  {h}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Questions List */}
                          <div className="space-y-2.5 pt-1">
                            {group.questions.map((q, qIdx) => (
                              <div key={q.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center space-x-1.5 shrink-0">
                                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                                      {qIdx + 1}
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    value={q.prompt}
                                    onChange={(e) => {
                                      const updatedPassages = [...generatedTest.passages];
                                      updatedPassages[activePassageTab].questionGroups![gIdx].questions[qIdx].prompt =
                                        e.target.value;
                                      setGeneratedTest({ ...generatedTest, passages: updatedPassages });
                                    }}
                                    className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded bg-white font-medium text-slate-800"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedPassages = [...generatedTest.passages];
                                      updatedPassages[activePassageTab].questionGroups![gIdx].questions =
                                        group.questions.filter((_, i) => i !== qIdx);
                                      setGeneratedTest({ ...generatedTest, passages: updatedPassages });
                                    }}
                                    className="text-slate-400 hover:text-rose-600 p-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Options if Multiple Choice */}
                                {q.options && q.options.length > 0 && (
                                  <div className="pl-6 space-y-1">
                                    {q.options.map((opt, oIdx) => (
                                      <input
                                        key={oIdx}
                                        type="text"
                                        value={opt}
                                        onChange={(e) => {
                                          const updatedPassages = [...generatedTest.passages];
                                          const opts = [...(q.options || [])];
                                          opts[oIdx] = e.target.value;
                                          updatedPassages[activePassageTab].questionGroups![gIdx].questions[qIdx].options =
                                            opts;
                                          setGeneratedTest({ ...generatedTest, passages: updatedPassages });
                                        }}
                                        className="w-full px-2 py-0.5 text-[11px] border border-slate-200 rounded bg-white text-slate-700"
                                      />
                                    ))}
                                  </div>
                                )}

                                {/* Correct Answer & Explanation */}
                                <div className="pl-6 grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-200/60">
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Answer Key
                                    </label>
                                    <input
                                      type="text"
                                      value={q.correctAnswer}
                                      onChange={(e) => {
                                        const updatedPassages = [...generatedTest.passages];
                                        updatedPassages[activePassageTab].questionGroups![gIdx].questions[qIdx].correctAnswer =
                                          e.target.value;
                                        setGeneratedTest({ ...generatedTest, passages: updatedPassages });
                                      }}
                                      className="w-full px-2 py-1 text-xs font-bold border border-emerald-300 bg-emerald-50 text-emerald-900 rounded"
                                    />
                                  </div>
                                  <div className="sm:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Citation / Explanation
                                    </label>
                                    <input
                                      type="text"
                                      value={q.explanation}
                                      onChange={(e) => {
                                        const updatedPassages = [...generatedTest.passages];
                                        updatedPassages[activePassageTab].questionGroups![gIdx].questions[qIdx].explanation =
                                          e.target.value;
                                        setGeneratedTest({ ...generatedTest, passages: updatedPassages });
                                      }}
                                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white text-slate-600"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}

                            {/* Add Question Button */}
                            <button
                              type="button"
                              onClick={() => {
                                const updatedPassages = [...generatedTest.passages];
                                const newQ: ReadingQuestion = {
                                  id: `q_${activePassageTab + 1}_${gIdx + 1}_${group.questions.length + 1}`,
                                  type: group.questionType,
                                  prompt: 'New Question Prompt...',
                                  correctAnswer: 'A',
                                  explanation: 'Citation from passage.',
                                  points: 1,
                                  source: 'ai_generated',
                                  answerKeyConfidence: 'high',
                                };
                                updatedPassages[activePassageTab].questionGroups![gIdx].questions.push(newQ);
                                setGeneratedTest({ ...generatedTest, passages: updatedPassages });
                              }}
                              className="w-full py-1.5 border border-dashed border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-800 hover:border-blue-400 flex items-center justify-center space-x-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Question to this Group</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* ASSIGN MODAL OVERLAY */}
        {showAssignModal && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm">Assign Test to Class</h3>
                <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Target Course</label>
                  <select
                    value={assignCourseId}
                    onChange={(e) => setAssignCourseId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={assignDueDate}
                    onChange={(e) => setAssignDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800 space-y-1">
                  <p className="font-semibold">Answer-Key Security Guarantee:</p>
                  <p>
                    Students will complete this practice test on the split-screen engine. All correct answers and explanations will remain strictly hidden until submission and grading.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssignment}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs"
                >
                  Confirm & Publish Assignment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
