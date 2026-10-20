import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import { CourseSkill } from '../types';
import {
  ChatMessage,
  sendGeminiChat,
  generateLessonPlan,
  generateWritingFeedback,
  generateSpeakingPractice,
  generateReadingListeningMaterials,
  generateVocabularyGrammar,
  generateAssignmentDraft,
} from '../lib/ai';
import {
  Sparkles,
  MessageSquare,
  Calendar,
  FileEdit,
  Mic,
  BookOpen,
  BookMarked,
  ClipboardList,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  Send,
  Info,
  Edit3,
  Eye,
  RefreshCw,
  Award,
  ChevronRight,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react';

type AssistantTab =
  | 'chat'
  | 'lesson_planner'
  | 'writing_feedback'
  | 'speaking_practice'
  | 'reading_listening'
  | 'vocab_grammar'
  | 'assignment_drafting';

export const AiAssistantView: React.FC = () => {
  const { currentUser, courses, courseMembers, submissions } = useApp();
  const { t, language } = useI18n();

  if (!currentUser) return null;

  // Active Workspace Mode
  const [activeTab, setActiveTab] = useState<AssistantTab>('chat');

  // Shared Teaching Context
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<CourseSkill | 'all'>('writing');

  // Global Status & Notification
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. CHAT MODE STATE
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // 2. SPECIALIZED WORKFLOW STATE
  // A. Lesson Planner
  const [lpSkill, setLpSkill] = useState<string>('Writing');
  const [lpCurrentBand, setLpCurrentBand] = useState('5.5');
  const [lpTargetBand, setLpTargetBand] = useState('7.0');
  const [lpDuration, setLpDuration] = useState('60 minutes');
  const [lpTopic, setLpTopic] = useState('Environmental Protection and Renewable Energy');
  const [lpObjectives, setLpObjectives] = useState('Master cohesive devices and paragraph structuring');
  const [lpConstraints, setLpConstraints] = useState('Interactive pair work with timed feedback');

  // B. Writing Feedback
  const [wfTaskType, setWfTaskType] = useState<'task1' | 'task2'>('task2');
  const [wfTestType, setWfTestType] = useState<'academic' | 'general'>('academic');
  const [wfTargetBand, setWfTargetBand] = useState('7.0');
  const [wfEssayText, setWfEssayText] = useState('');

  // C. Speaking Practice
  const [spPart, setSpPart] = useState<'part1' | 'part2' | 'part3'>('part2');
  const [spTopic, setSpTopic] = useState('A memorable technological innovation you use');
  const [spTargetBand, setSpTargetBand] = useState('7.5');

  // D. Reading & Listening
  const [rlSkill, setRlSkill] = useState<'reading' | 'listening'>('reading');
  const [rlTopic, setRlTopic] = useState('Urban Architecture and Sustainable Cities');
  const [rlTargetBand, setRlTargetBand] = useState('7.0');
  const [rlQuestionTypes, setRlQuestionTypes] = useState<string[]>([
    'Multiple Choice',
    'True / False / Not Given',
  ]);

  // E. Vocabulary & Grammar
  const [vgTopic, setVgTopic] = useState('Artificial Intelligence and the Future of Labor');
  const [vgTargetBand, setVgTargetBand] = useState('7.5');
  const [vgFocus, setVgFocus] = useState<'vocabulary' | 'grammar' | 'both'>('both');

  // F. Assignment Drafting
  const [adSkill, setAdSkill] = useState('Writing Task 2');
  const [adTopic, setAdTopic] = useState('Government Spending on Public Health vs Space Exploration');
  const [adTargetBand, setAdTargetBand] = useState('7.0');
  const [adInstructions, setAdInstructions] = useState('Write at least 250 words in 40 minutes under exam conditions.');

  // Generated Result for Tool Workflows
  const [workflowOutput, setWorkflowOutput] = useState<string | null>(null);
  const [workflowModel, setWorkflowModel] = useState<string>('gemini-3.8-flash');
  const [isEditingOutput, setIsEditingOutput] = useState(false);
  const [editableContent, setEditableContent] = useState('');

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isGenerating, activeTab]);

  // Context resolution
  const activeCourse = courses.find((c) => c.id === selectedCourseId);
  const activeStudent = courseMembers.find((m) => m.studentId === selectedStudentId);

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // -------------------------------------------------------------
  // CHAT HANDLER
  // -------------------------------------------------------------
  const handleSendChat = async (presetPrompt?: string) => {
    const textToSend = (presetPrompt || chatInput).trim();
    if (!textToSend || isGenerating) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!presetPrompt) setChatInput('');
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const history = chatMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await sendGeminiChat({
        message: textToSend,
        history,
        courseName: activeCourse?.name,
        studentName: activeStudent?.studentName,
        skill: selectedSkill,
      });

      const assistantMsg: ChatMessage = {
        id: 'msg-res-' + Date.now(),
        role: 'assistant',
        content: res.draft,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: res.model,
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gemini error');
    } finally {
      setIsGenerating(false);
    }
  };

  // -------------------------------------------------------------
  // SPECIALIZED TOOL WORKFLOW HANDLER
  // -------------------------------------------------------------
  const handleExecuteWorkflow = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setWorkflowOutput(null);
    setIsEditingOutput(false);

    try {
      let result;
      switch (activeTab) {
        case 'lesson_planner':
          result = await generateLessonPlan({
            skill: lpSkill,
            currentBand: lpCurrentBand,
            targetBand: lpTargetBand,
            duration: lpDuration,
            topic: lpTopic,
            objectives: lpObjectives,
            constraints: lpConstraints,
            courseName: activeCourse?.name,
          });
          break;

        case 'writing_feedback':
          result = await generateWritingFeedback({
            taskType: wfTaskType,
            testType: wfTestType,
            targetBand: wfTargetBand,
            essayText: wfEssayText,
            courseName: activeCourse?.name,
            studentName: activeStudent?.studentName,
          });
          break;

        case 'speaking_practice':
          result = await generateSpeakingPractice({
            speakingPart: spPart,
            topic: spTopic,
            targetBand: spTargetBand,
            courseName: activeCourse?.name,
          });
          break;

        case 'reading_listening':
          result = await generateReadingListeningMaterials({
            skill: rlSkill,
            topic: rlTopic,
            targetBand: rlTargetBand,
            questionTypes: rlQuestionTypes,
            courseName: activeCourse?.name,
          });
          break;

        case 'vocab_grammar':
          result = await generateVocabularyGrammar({
            topic: vgTopic,
            targetBand: vgTargetBand,
            focus: vgFocus,
            courseName: activeCourse?.name,
          });
          break;

        case 'assignment_drafting':
          result = await generateAssignmentDraft({
            skill: adSkill,
            topic: adTopic,
            targetBand: adTargetBand,
            instructions: adInstructions,
            courseName: activeCourse?.name,
          });
          break;

        default:
          throw new Error('Unsupported workflow');
      }

      setWorkflowOutput(result.draft);
      setEditableContent(result.draft);
      setWorkflowModel(result.model);
    } catch (err: any) {
      setErrorMessage(err.message || 'Workflow execution error');
    } finally {
      setIsGenerating(false);
    }
  };

  const navTabs = [
    { id: 'chat' as const, label: t('aiAssistant.tabChat'), icon: MessageSquare },
    { id: 'lesson_planner' as const, label: t('aiAssistant.tabLessonPlanner'), icon: Calendar },
    { id: 'writing_feedback' as const, label: t('aiAssistant.tabWritingFeedback'), icon: FileEdit },
    { id: 'speaking_practice' as const, label: t('aiAssistant.tabSpeakingPractice'), icon: Mic },
    { id: 'reading_listening' as const, label: t('aiAssistant.tabReadingListening'), icon: BookOpen },
    { id: 'vocab_grammar' as const, label: t('aiAssistant.tabVocabGrammar'), icon: BookMarked },
    { id: 'assignment_drafting' as const, label: t('aiAssistant.tabAssignmentDrafting'), icon: ClipboardList },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <span className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                <Sparkles className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {t('aiAssistant.title')}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Google Gemini
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              {t('aiAssistant.subtitle')}
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>gemini-3.8-flash</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Optional Teaching Context Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-700 font-semibold">
            <GraduationCap className="w-4 h-4 text-blue-600" />
            <span>{t('aiAssistant.scopeCourse')}:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 grow max-w-2xl">
            {/* Course select */}
            <select
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setSelectedStudentId('');
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="">{t('aiAssistant.allMyCourses')}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>

            {/* Student select */}
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="">{t('aiAssistant.wholeClass')}</option>
              {courseMembers
                .filter((m) => !selectedCourseId || m.courseId === selectedCourseId)
                .map((m) => (
                  <option key={m.studentId} value={m.studentId}>
                    {m.studentName}
                  </option>
                ))}
            </select>

            {/* Skill select */}
            <select
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value as any)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:ring-1 focus:ring-blue-500 capitalize"
            >
              <option value="all">{t('skills.all')}</option>
              <option value="writing">{t('skills.writing')}</option>
              <option value="speaking">{t('skills.speaking')}</option>
              <option value="reading">{t('skills.reading')}</option>
              <option value="listening">{t('skills.listening')}</option>
            </select>
          </div>
        </div>

        {courses.length === 0 && (
          <p className="text-[11px] text-slate-400 mt-2 flex items-center space-x-1.5">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>{t('aiAssistant.courseContextNotice')}</span>
          </p>
        )}
      </div>

      {/* 3. Navigation / Workflow Tabs */}
      <div className="border-b border-slate-200 flex space-x-1 overflow-x-auto text-xs font-semibold scrollbar-none pb-px">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setErrorMessage(null);
              }}
              className={`flex items-center space-x-2 py-3 px-4 border-b-2 transition-all whitespace-nowrap rounded-t-lg ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start justify-between text-xs text-red-900 shadow-xs">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">{t('aiAssistant.errorMessage')}</span>
              <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-600 font-bold p-1"
          >
            ×
          </button>
        </div>
      )}

      {/* 4. WORKFLOW VIEWS */}

      {/* TAB A: INTERACTIVE CHAT */}
      {activeTab === 'chat' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[650px] overflow-hidden">
          {/* Chat Top Controls */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between text-xs bg-slate-50/70">
            <div className="flex items-center space-x-2 text-slate-600">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span className="font-semibold">{t('aiAssistant.tabChat')}</span>
              <span className="text-[11px] text-slate-400">({chatMessages.length} messages)</span>
            </div>
            {chatMessages.length > 0 && (
              <button
                onClick={() => setChatMessages([])}
                className="inline-flex items-center space-x-1.5 text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-md hover:bg-slate-200/60 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('aiAssistant.newConversation')}</span>
              </button>
            )}
          </div>

          {/* Messages Area */}
          <div className="p-5 overflow-y-auto space-y-4 grow">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto text-xs text-slate-500 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">{t('aiAssistant.title')}</h3>
                  <p className="mt-1 text-slate-500 leading-relaxed">
                    {language === 'vi'
                      ? 'Trò chuyện trực tiếp cùng Gemini AI để nhận tư vấn giáo án, giải đáp thắc mắc phương pháp hoặc chuẩn bị bài tập.'
                      : 'Ask Gemini anything about IELTS exam strategies, lesson ideas, or grading tips.'}
                  </p>
                </div>

                {/* Sample Prompt Pills */}
                <div className="w-full text-left space-y-2 pt-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
                    {t('aiAssistant.quickTemplates')}
                  </span>
                  {[
                    t('aiAssistant.samplePrompt1'),
                    t('aiAssistant.samplePrompt2'),
                    t('aiAssistant.samplePrompt3'),
                    t('aiAssistant.samplePrompt4'),
                  ].map((p, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendChat(p)}
                      className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-700 hover:text-blue-700 transition-all flex items-center justify-between group"
                    >
                      <span className="line-clamp-1">{p}</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed space-y-2 shadow-xs ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 pb-1 border-b border-white/20 dark:border-slate-200">
                      <span className="font-bold text-[11px] opacity-80">
                        {msg.role === 'user' ? currentUser.name : 'Gemini AI Assistant'}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] opacity-70">{msg.timestamp}</span>
                        {msg.role === 'assistant' && (
                          <button
                            onClick={() => handleCopyText(msg.content, msg.id)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
                            title={t('common.copy')}
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
                  </div>
                </div>
              ))
            )}

            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 flex items-center space-x-2.5 shadow-xs">
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                  <span>{t('aiAssistant.geminiThinking')}</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Composer Footer */}
          <div className="p-4 border-t border-slate-100 bg-white">
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder={t('aiAssistant.chatPlaceholder')}
                className="grow p-3 text-xs border border-slate-300 rounded-xl outline-hidden focus:ring-2 focus:ring-blue-500 leading-relaxed resize-none"
              />
              <button
                onClick={() => handleSendChat()}
                disabled={!chatInput.trim() || isGenerating}
                className="px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center transition-colors shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB B: LESSON PLANNER */}
      {activeTab === 'lesson_planner' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">{t('aiAssistant.tabLessonPlanner')}</h2>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {language === 'vi' ? 'Thiết kế bài giảng có cấu trúc theo chuẩn IELTS' : 'Design timed lesson plans with band objectives'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.skill')}</label>
                <select
                  value={lpSkill}
                  onChange={(e) => setLpSkill(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-hidden"
                >
                  <option value="Writing">Writing</option>
                  <option value="Speaking">Speaking</option>
                  <option value="Reading">Reading</option>
                  <option value="Listening">Listening</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.durationLabel')}</label>
                <select
                  value={lpDuration}
                  onChange={(e) => setLpDuration(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-hidden"
                >
                  <option value="45 minutes">45 minutes</option>
                  <option value="60 minutes">60 minutes</option>
                  <option value="90 minutes">90 minutes</option>
                  <option value="120 minutes">120 minutes</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.currentBandLabel')}</label>
                <select
                  value={lpCurrentBand}
                  onChange={(e) => setLpCurrentBand(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-hidden"
                >
                  {['5.0', '5.5', '6.0', '6.5', '7.0'].map((b) => (
                    <option key={b} value={b}>Band {b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.targetBandLabel')}</label>
                <select
                  value={lpTargetBand}
                  onChange={(e) => setLpTargetBand(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-hidden"
                >
                  {['6.0', '6.5', '7.0', '7.5', '8.0+'].map((b) => (
                    <option key={b} value={b}>Band {b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.topicLabel')}</label>
              <input
                type="text"
                value={lpTopic}
                onChange={(e) => setLpTopic(e.target.value)}
                placeholder="e.g. Artificial Intelligence & Academic Ethics"
                className="w-full p-2.5 border border-slate-300 rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.objectivesLabel')}</label>
              <textarea
                rows={2}
                value={lpObjectives}
                onChange={(e) => setLpObjectives(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 leading-relaxed"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.constraintsLabel')}</label>
              <input
                type="text"
                value={lpConstraints}
                onChange={(e) => setLpConstraints(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl outline-hidden"
              />
            </div>

            <button
              onClick={handleExecuteWorkflow}
              disabled={isGenerating}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-xs flex items-center justify-center space-x-2"
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isGenerating ? t('aiAssistant.analyzingEvidence') : t('aiAssistant.generateAction')}</span>
            </button>
          </div>

          <div className="lg:col-span-7">
            <WorkflowResultCard
              output={workflowOutput}
              model={workflowModel}
              isGenerating={isGenerating}
              isEditing={isEditingOutput}
              editableContent={editableContent}
              onToggleEdit={() => setIsEditingOutput(!isEditingOutput)}
              onChangeEditable={(val) => setEditableContent(val)}
              onCopy={() => workflowOutput && handleCopyText(workflowOutput, 'workflow-result')}
              copied={copiedId === 'workflow-result'}
              t={t}
            />
          </div>
        </div>
      )}

      {/* TAB C: WRITING FEEDBACK */}
      {activeTab === 'writing_feedback' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">{t('aiAssistant.tabWritingFeedback')}</h2>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {language === 'vi' ? 'Đánh giá 4 tiêu chí chính thức của IELTS Writing' : 'Diagnostic criterion feedback (TR/TA, CC, LR, GRA)'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.taskTypeLabel')}</label>
                <select
                  value={wfTaskType}
                  onChange={(e) => setWfTaskType(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-hidden"
                >
                  <option value="task1">Task 1</option>
                  <option value="task2">Task 2</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.testTypeLabel')}</label>
                <select
                  value={wfTestType}
                  onChange={(e) => setWfTestType(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-hidden"
                >
                  <option value="academic">Academic</option>
                  <option value="general">General</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.targetBandLabel')}</label>
                <select
                  value={wfTargetBand}
                  onChange={(e) => setWfTargetBand(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-hidden"
                >
                  {['6.0', '6.5', '7.0', '7.5', '8.0+'].map((b) => (
                    <option key={b} value={b}>Band {b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {t('aiAssistant.essayPlaceholder')}
              </label>
              <textarea
                rows={10}
                value={wfEssayText}
                onChange={(e) => setWfEssayText(e.target.value)}
                placeholder="Paste the student's essay text here (minimum 30 characters)..."
                className="w-full p-3 border border-slate-300 rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 leading-relaxed font-sans"
              />
              <span className="text-[10px] text-slate-400">
                {wfEssayText.trim().split(/\s+/).filter(Boolean).length} words
              </span>
            </div>

            <button
              onClick={handleExecuteWorkflow}
              disabled={isGenerating || wfEssayText.trim().length < 30}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-xs flex items-center justify-center space-x-2"
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isGenerating ? t('aiAssistant.analyzingEvidence') : t('aiAssistant.generateAction')}</span>
            </button>
          </div>

          <div className="lg:col-span-7">
            <WorkflowResultCard
              output={workflowOutput}
              model={workflowModel}
              isGenerating={isGenerating}
              isEditing={isEditingOutput}
              editableContent={editableContent}
              onToggleEdit={() => setIsEditingOutput(!isEditingOutput)}
              onChangeEditable={(val) => setEditableContent(val)}
              onCopy={() => workflowOutput && handleCopyText(workflowOutput, 'workflow-result')}
              copied={copiedId === 'workflow-result'}
              t={t}
            />
          </div>
        </div>
      )}

      {/* TAB D: SPEAKING PRACTICE */}
      {activeTab === 'speaking_practice' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">{t('aiAssistant.tabSpeakingPractice')}</h2>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {language === 'vi' ? 'Biên soạn bộ câu hỏi, cue card và câu trả lời mẫu Band 8.0+' : 'Generate authentic interview questions, cue cards & model answers'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.speakingPartLabel')}</label>
                <select
                  value={spPart}
                  onChange={(e) => setSpPart(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-hidden"
                >
                  <option value="part1">Part 1: Interview</option>
                  <option value="part2">Part 2: Long Turn (Cue Card)</option>
                  <option value="part3">Part 3: Discussion</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.targetBandLabel')}</label>
                <select
                  value={spTargetBand}
                  onChange={(e) => setSpTargetBand(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-hidden"
                >
                  {['6.5', '7.0', '7.5', '8.0+'].map((b) => (
                    <option key={b} value={b}>Band {b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.topicLabel')}</label>
              <input
                type="text"
                value={spTopic}
                onChange={(e) => setSpTopic(e.target.value)}
                placeholder="e.g. Artificial Intelligence, Travel, Modern Art..."
                className="w-full p-2.5 border border-slate-300 rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleExecuteWorkflow}
              disabled={isGenerating || !spTopic.trim()}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-xs flex items-center justify-center space-x-2"
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isGenerating ? t('aiAssistant.analyzingEvidence') : t('aiAssistant.generateAction')}</span>
            </button>
          </div>

          <div className="lg:col-span-7">
            <WorkflowResultCard
              output={workflowOutput}
              model={workflowModel}
              isGenerating={isGenerating}
              isEditing={isEditingOutput}
              editableContent={editableContent}
              onToggleEdit={() => setIsEditingOutput(!isEditingOutput)}
              onChangeEditable={(val) => setEditableContent(val)}
              onCopy={() => workflowOutput && handleCopyText(workflowOutput, 'workflow-result')}
              copied={copiedId === 'workflow-result'}
              t={t}
            />
          </div>
        </div>
      )}

      {/* TAB E: READING & LISTENING */}
      {activeTab === 'reading_listening' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">{t('aiAssistant.tabReadingListening')}</h2>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {language === 'vi' ? 'Tạo bài đọc/nghe, câu hỏi và đáp án giải thích tách biệt' : 'Generate passages, question papers, and separated answer keys'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.skill')}</label>
                <select
                  value={rlSkill}
                  onChange={(e) => setRlSkill(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-hidden"
                >
                  <option value="reading">IELTS Reading</option>
                  <option value="listening">IELTS Listening (Audio Script)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.targetBandLabel')}</label>
                <select
                  value={rlTargetBand}
                  onChange={(e) => setRlTargetBand(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-hidden"
                >
                  {['6.5', '7.0', '7.5', '8.0+'].map((b) => (
                    <option key={b} value={b}>Band {b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.topicLabel')}</label>
              <input
                type="text"
                value={rlTopic}
                onChange={(e) => setRlTopic(e.target.value)}
                placeholder="e.g. Neuroscience and Memory Retention"
                className="w-full p-2.5 border border-slate-300 rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.questionTypesLabel')}</label>
              <div className="space-y-1.5 pt-1">
                {['Multiple Choice', 'True / False / Not Given', 'Sentence Completion', 'Matching Information'].map((qt) => {
                  const checked = rlQuestionTypes.includes(qt);
                  return (
                    <label key={qt} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setRlQuestionTypes((prev) =>
                            checked ? prev.filter((q) => q !== qt) : [...prev, qt]
                          );
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-700">{qt}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleExecuteWorkflow}
              disabled={isGenerating || !rlTopic.trim()}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-xs flex items-center justify-center space-x-2"
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isGenerating ? t('aiAssistant.analyzingEvidence') : t('aiAssistant.generateAction')}</span>
            </button>
          </div>

          <div className="lg:col-span-7">
            <WorkflowResultCard
              output={workflowOutput}
              model={workflowModel}
              isGenerating={isGenerating}
              isEditing={isEditingOutput}
              editableContent={editableContent}
              onToggleEdit={() => setIsEditingOutput(!isEditingOutput)}
              onChangeEditable={(val) => setEditableContent(val)}
              onCopy={() => workflowOutput && handleCopyText(workflowOutput, 'workflow-result')}
              copied={copiedId === 'workflow-result'}
              t={t}
            />
          </div>
        </div>
      )}

      {/* TAB F: VOCABULARY & GRAMMAR */}
      {activeTab === 'vocab_grammar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">{t('aiAssistant.tabVocabGrammar')}</h2>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {language === 'vi' ? 'Tổng hợp Collocations điểm cao, cấu trúc ngữ pháp và bài tập' : 'Generate topic collocations, advanced syntax & practice exercises'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.focusLabel')}</label>
                <select
                  value={vgFocus}
                  onChange={(e) => setVgFocus(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-hidden"
                >
                  <option value="both">Both (Vocab & Grammar)</option>
                  <option value="vocabulary">Vocabulary Focus</option>
                  <option value="grammar">Grammar Focus</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.targetBandLabel')}</label>
                <select
                  value={vgTargetBand}
                  onChange={(e) => setVgTargetBand(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-hidden"
                >
                  {['6.5', '7.0', '7.5', '8.0+'].map((b) => (
                    <option key={b} value={b}>Band {b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.topicLabel')}</label>
              <input
                type="text"
                value={vgTopic}
                onChange={(e) => setVgTopic(e.target.value)}
                placeholder="e.g. Globalization, Biodiversity, Renewable Energy..."
                className="w-full p-2.5 border border-slate-300 rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleExecuteWorkflow}
              disabled={isGenerating || !vgTopic.trim()}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-xs flex items-center justify-center space-x-2"
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isGenerating ? t('aiAssistant.analyzingEvidence') : t('aiAssistant.generateAction')}</span>
            </button>
          </div>

          <div className="lg:col-span-7">
            <WorkflowResultCard
              output={workflowOutput}
              model={workflowModel}
              isGenerating={isGenerating}
              isEditing={isEditingOutput}
              editableContent={editableContent}
              onToggleEdit={() => setIsEditingOutput(!isEditingOutput)}
              onChangeEditable={(val) => setEditableContent(val)}
              onCopy={() => workflowOutput && handleCopyText(workflowOutput, 'workflow-result')}
              copied={copiedId === 'workflow-result'}
              t={t}
            />
          </div>
        </div>
      )}

      {/* TAB G: ASSIGNMENT DRAFTING */}
      {activeTab === 'assignment_drafting' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">{t('aiAssistant.tabAssignmentDrafting')}</h2>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {language === 'vi' ? 'Soạn đề bài tập, thang chấm và bài giải mẫu cho học viên' : 'Draft assignment briefs, scoring rubrics, and exemplar answers'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.skill')}</label>
                <select
                  value={adSkill}
                  onChange={(e) => setAdSkill(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-hidden"
                >
                  <option value="Writing Task 1">Writing Task 1</option>
                  <option value="Writing Task 2">Writing Task 2</option>
                  <option value="Speaking Part 2">Speaking Part 2</option>
                  <option value="Reading Quiz">Reading Quiz</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.targetBandLabel')}</label>
                <select
                  value={adTargetBand}
                  onChange={(e) => setAdTargetBand(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-hidden"
                >
                  {['6.0', '6.5', '7.0', '7.5', '8.0+'].map((b) => (
                    <option key={b} value={b}>Band {b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.topicLabel')}</label>
              <input
                type="text"
                value={adTopic}
                onChange={(e) => setAdTopic(e.target.value)}
                placeholder="e.g. Government Investment in Green Technology"
                className="w-full p-2.5 border border-slate-300 rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('aiAssistant.instructionsLabel')}</label>
              <textarea
                rows={3}
                value={adInstructions}
                onChange={(e) => setAdInstructions(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 leading-relaxed"
              />
            </div>

            <button
              onClick={handleExecuteWorkflow}
              disabled={isGenerating || !adTopic.trim()}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-xs flex items-center justify-center space-x-2"
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isGenerating ? t('aiAssistant.analyzingEvidence') : t('aiAssistant.generateAction')}</span>
            </button>
          </div>

          <div className="lg:col-span-7">
            <WorkflowResultCard
              output={workflowOutput}
              model={workflowModel}
              isGenerating={isGenerating}
              isEditing={isEditingOutput}
              editableContent={editableContent}
              onToggleEdit={() => setIsEditingOutput(!isEditingOutput)}
              onChangeEditable={(val) => setEditableContent(val)}
              onCopy={() => workflowOutput && handleCopyText(workflowOutput, 'workflow-result')}
              copied={copiedId === 'workflow-result'}
              t={t}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// SUB-COMPONENT: WORKFLOW RESULT CARD
// ---------------------------------------------------------------------------
interface WorkflowResultCardProps {
  output: string | null;
  model: string;
  isGenerating: boolean;
  isEditing: boolean;
  editableContent: string;
  onToggleEdit: () => void;
  onChangeEditable: (content: string) => void;
  onCopy: () => void;
  copied: boolean;
  t: (key: string, params?: any) => string;
}

const WorkflowResultCard: React.FC<WorkflowResultCardProps> = ({
  output,
  model,
  isGenerating,
  isEditing,
  editableContent,
  onToggleEdit,
  onChangeEditable,
  onCopy,
  copied,
  t,
}) => {
  if (isGenerating) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[420px] space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <h3 className="font-bold text-slate-800 text-sm">{t('aiAssistant.analyzingEvidence')}</h3>
        <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
          Google Gemini is synthesizing pedagogical evidence and band descriptors...
        </p>
      </div>
    );
  }

  if (!output) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[420px] space-y-3 text-slate-400">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
          <FileEdit className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-slate-700 text-xs">Ready to Generate</h3>
        <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
          Select parameters on the left and click Generate to produce a structured IELTS teaching draft with Gemini AI.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col min-h-[500px] overflow-hidden">
      {/* Result Card Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">
            {t('aiAssistant.disclaimerBadge')}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleEdit}
            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 bg-white border border-slate-200 shadow-2xs font-semibold text-[11px] transition-colors"
          >
            {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            <span>{isEditing ? t('aiAssistant.viewMode') : t('aiAssistant.editMode')}</span>
          </button>

          <button
            onClick={onCopy}
            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-blue-700 hover:text-blue-800 bg-blue-50 border border-blue-200 shadow-2xs font-semibold text-[11px] transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? t('aiAssistant.copiedToClipboard') : t('common.copy')}</span>
          </button>
        </div>
      </div>

      {/* Result Card Content */}
      <div className="p-6 overflow-y-auto grow text-xs leading-relaxed">
        {isEditing ? (
          <textarea
            rows={18}
            value={editableContent}
            onChange={(e) => onChangeEditable(e.target.value)}
            className="w-full p-4 border border-slate-200 rounded-xl outline-hidden focus:ring-1 focus:ring-blue-500 font-mono text-xs leading-relaxed bg-slate-50/50"
          />
        ) : (
          <div className="whitespace-pre-wrap font-sans text-slate-800 leading-relaxed space-y-4">
            {editableContent}
          </div>
        )}
      </div>

      {/* Result Card Footer */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11px] text-slate-400">
        <span>{t('aiAssistant.modelPoweredBy', { model })}</span>
        <span>{t('aiAssistant.productRuleNote')}</span>
      </div>
    </div>
  );
};
