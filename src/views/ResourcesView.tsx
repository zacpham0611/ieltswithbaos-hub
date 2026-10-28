import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import { Resource, Lesson, CourseSkill, ResourceType, GeneratedReadingTest } from '../types';
import {
  FolderArchive,
  FileText,
  FileSpreadsheet,
  Image,
  Headphones,
  Video,
  Link2,
  Lock,
  Globe,
  Plus,
  Search,
  Trash2,
  Sparkles,
  BookOpen,
  Calendar,
  FileUp,
  ArrowRight,
  Download,
  Edit,
} from 'lucide-react';
const SmartDocumentImportModal = React.lazy(() =>
  import('../components/SmartDocumentImportModal').then((m) => ({ default: m.SmartDocumentImportModal }))
);
const AiReadingTestGeneratorModal = React.lazy(() =>
  import('../components/AiReadingTestGeneratorModal').then((m) => ({ default: m.AiReadingTestGeneratorModal }))
);

export const ResourcesView: React.FC = () => {
  const {
    currentUser,
    courses,
    resources,
    addResource,
    deleteResource,
    toggleResourcePublish,
    lessons,
    createLesson,
  } = useApp();
  const { t, formatDate } = useI18n();

  if (!currentUser) return null;
  const isTeacher = currentUser.role === 'teacher';

  const [activeTab, setActiveTab] = useState<'resources' | 'lessons'>('resources');
  const [searchQuery, setSearchQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [folderFilter, setFolderFilter] = useState<string>('all');

  // Modals
  const [showAddResModal, setShowAddResModal] = useState(false);
  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [showAiLessonModal, setShowAiLessonModal] = useState(false);
  const [showSmartImportModal, setShowSmartImportModal] = useState(false);
  const [showAiTestGenModal, setShowAiTestGenModal] = useState(false);
  const [selectedEditTest, setSelectedEditTest] = useState<GeneratedReadingTest | null>(null);

  // New Resource Form
  const [resTitle, setResTitle] = useState('');
  const [resType, setResType] = useState<ResourceType>('pdf');
  const [resUrl, setResUrl] = useState('');
  const [resContent, setResContent] = useState('');
  const [resTags, setResTags] = useState('cambridge, reading');
  const [resSkill, setResSkill] = useState<CourseSkill>('reading');
  const [resFolder, setResFolder] = useState('Reading Practice');
  const [resCourseId, setResCourseId] = useState<string>('');
  const [resIsPublished, setResIsPublished] = useState(false);

  // New Lesson Form
  const [lessonCourseId, setLessonCourseId] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonObjectives, setLessonObjectives] = useState('');
  const [lessonSkill, setLessonSkill] = useState<CourseSkill>('writing');
  const [lessonTeacherNotes, setLessonTeacherNotes] = useState('');
  const [lessonActivities, setLessonActivities] = useState('');
  const [lessonHomework, setLessonHomework] = useState('');
  const [lessonDate, setLessonDate] = useState('2026-10-22');
  const [lessonIsPublished, setLessonIsPublished] = useState(true);

  // AI Lesson Generator inputs
  const [aiSkill, setAiSkill] = useState<CourseSkill>('writing');
  const [aiTopic, setAiTopic] = useState('Writing Task 2 Problem & Solution on Environmental Pollution');
  const [aiTargetBand, setAiTargetBand] = useState('6.5 - 7.5');
  const [aiGeneratedDraft, setAiGeneratedDraft] = useState<string | null>(null);

  const visibleResources = isTeacher
    ? resources.filter((r) => r.teacherId === currentUser.id)
    : resources.filter((r) => r.isPublished);

  const filteredResources = visibleResources.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSkill = skillFilter === 'all' || r.skill === skillFilter;
    const matchesFolder = folderFilter === 'all' || r.folder === folderFilter;
    return matchesSearch && matchesSkill && matchesFolder;
  });

  const uniqueFolders = Array.from(
    new Set(visibleResources.map((r) => r.folder).filter(Boolean) as string[])
  );

  const visibleLessons = isTeacher
    ? lessons
    : lessons.filter((l) => l.isPublished);

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim()) return;

    await addResource({
      title: resTitle.trim(),
      type: resType,
      url: resUrl || undefined,
      content: resContent || undefined,
      tags: resTags.split(',').map((s) => s.trim()).filter(Boolean),
      skill: resSkill,
      folder: resFolder || undefined,
      courseId: resCourseId || null,
      isPublished: resIsPublished,
    });

    setShowAddResModal(false);
    setResTitle('');
    setResUrl('');
    setResContent('');
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle.trim() || !lessonCourseId) return;

    await createLesson({
      courseId: lessonCourseId,
      title: lessonTitle.trim(),
      objectives: lessonObjectives.trim(),
      skill: lessonSkill,
      teacherNotes: lessonTeacherNotes.trim(),
      resources: [],
      activities: lessonActivities.trim(),
      homework: lessonHomework.trim(),
      date: lessonDate,
      isPublished: lessonIsPublished,
    });

    setShowAddLessonModal(false);
    setLessonTitle('');
    setLessonObjectives('');
    setLessonTeacherNotes('');
  };

  const generateAiLesson = () => {
    const draft = `Title: Advanced ${aiSkill.toUpperCase()} Workshop — ${aiTopic}
Objectives:
• Deconstruct Band 7.5+ criteria specifically for ${aiTopic}.
• Master 5 advanced cohesive transitions and eliminate repetitive conjunctions.
• Execute timed 20-minute drafting drill with paired peer critique.

Activities:
1. Warm-up (10m): Diagnostic error analysis of common Band 6.0 mistakes.
2. Direct Instruction (20m): Collocation mapping and band descriptors breakdown.
3. Guided Practice (25m): Step-by-step thesis crafting and paragraph structuring.
4. Independent Sprint (25m): Timed task completion with teacher live feedback.

Teacher Notes:
Ensure students do not over-use memorized idiomatic phrases. Emphasize clarity and grammatical range.

Homework:
Submit full completed assignment with self-editing checklist.`;

    setAiGeneratedDraft(draft);
  };

  const applyAiToLessonForm = () => {
    if (!aiGeneratedDraft) return;
    setLessonTitle(`Workshop: ${aiTopic}`);
    setLessonSkill(aiSkill);
    setLessonObjectives(`Master Band ${aiTargetBand} criteria for ${aiTopic}.`);
    setLessonActivities(`1. Error analysis\n2. Collocation mapping\n3. Guided paragraph drafting`);
    setLessonTeacherNotes(`Remind students: AI output is a draft. Check coherence and natural academic tone.`);
    setLessonHomework(`Submit full task drill via assignment portal.`);
    setShowAiLessonModal(false);
    setShowAddLessonModal(true);
  };

  const handleExportAiTestDocx = async (res: Resource) => {
    if (!res.content) return;
    try {
      const testData: GeneratedReadingTest = JSON.parse(res.content);
      const primaryPassage = testData.passages[0];
      const allQuestions = testData.passages.flatMap((p) => p.questions || []);

      const { generateDocxBlob } = await import('../lib/docxGenerator');
      const blob = await generateDocxBlob({
        title: testData.title,
        courseTitle: 'IELTS Academic Reading Practice',
        targetBand: `Difficulty Level ${testData.difficultyLevel}/10`,
        passage: primaryPassage?.content || '',
        questions: allQuestions,
        includeAnswerKey: true,
        templateStyle: 'academic',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${testData.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Could not export DOCX: ${err.message}`);
    }
  };

  const getIconForType = (type: ResourceType) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-4 h-4 text-red-500" />;
      case 'doc':
        return <FileSpreadsheet className="w-4 h-4 text-blue-500" />;
      case 'image':
        return <Image className="w-4 h-4 text-emerald-500" />;
      case 'audio':
        return <Headphones className="w-4 h-4 text-purple-500" />;
      case 'video':
        return <Video className="w-4 h-4 text-pink-500" />;
      default:
        return <Link2 className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('resources.title')}</h1>
          <p className="text-sm text-slate-500">
            {t('resources.subtitle')}
          </p>
        </div>

        {isTeacher && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setSelectedEditTest(null);
                setShowAiTestGenModal(true);
              }}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center space-x-1.5"
            >
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
              <span>Generate Reading Test with AI</span>
            </button>
            <button
              onClick={() => setShowSmartImportModal(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center space-x-1.5"
            >
              <FileUp className="w-4 h-4 text-white" />
              <span>Smart Document Import</span>
            </button>
            <button
              onClick={() => setShowAiLessonModal(true)}
              className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors flex items-center space-x-1.5"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>{t('resources.aiLessonBtn')}</span>
            </button>
            <button
              onClick={() => setShowAddResModal(true)}
              className="px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{t('resources.addResourceBtn')}</span>
            </button>
            <button
              onClick={() => setShowAddLessonModal(true)}
              className="px-3.5 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{t('resources.createLessonBtn')}</span>
            </button>
          </div>
        )}
      </div>

      {/* AI Reading Test Generator Banner for Teachers */}
      {isTeacher && (
        <div className="bg-gradient-to-r from-purple-50 via-indigo-50/50 to-blue-50 border border-purple-200/80 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Generate Reading Test with AI
                </h3>
                <span className="text-[10px] bg-purple-600 text-white font-bold px-2 py-0.2 rounded-full">
                  AI STUDIO
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Transform any article URL, uploaded document, or topic prompt into a complete IELTS Reading Practice Test. Calibrated across <strong>1–10 difficulty levels</strong> with authentic question formats, verified paragraph citations, and one-click assignment.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => {
                setSelectedEditTest(null);
                setShowAiTestGenModal(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>Generate Test Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Smart Document Import Feature Banner for Teachers */}
      {isTeacher && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-slate-50 border border-blue-200/70 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Smart Document Import & Converter
                </h3>
                <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.2 rounded-full">
                  NEW
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Import PDF, DOCX, TXT or Markdown files. Convert them into formatted <strong>Word (.docx)</strong> documents with answer keys, or transform them into <strong>Interactive Online Assignments</strong> for students.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setShowSmartImportModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <span>Import Document</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Switcher Tab */}
      <div className="border-b border-slate-200 flex space-x-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('resources')}
          className={`pb-3 border-b-2 flex items-center space-x-2 transition-all ${
            activeTab === 'resources'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <FolderArchive className="w-4 h-4" />
          <span>{t('resources.libraryTab')} ({filteredResources.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('lessons')}
          className={`pb-3 border-b-2 flex items-center space-x-2 transition-all ${
            activeTab === 'lessons'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>{t('resources.lessonsTab')} ({visibleLessons.length})</span>
        </button>
      </div>

      {/* Resources Tab */}
      {activeTab === 'resources' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={t('resources.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto text-xs">
              <select
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg outline-hidden bg-white text-slate-700"
              >
                <option value="all">{t('skills.all')}</option>
                <option value="reading">{t('skills.reading')}</option>
                <option value="writing">{t('skills.writing')}</option>
                <option value="listening">{t('skills.listening')}</option>
                <option value="speaking">{t('skills.speaking')}</option>
              </select>

              {uniqueFolders.length > 0 && (
                <select
                  value={folderFilter}
                  onChange={(e) => setFolderFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg outline-hidden bg-white text-slate-700"
                >
                  <option value="all">{t('resources.allFolders')}</option>
                  {uniqueFolders.map((f) => (
                    <option key={f} value={f}>
                      📁 {f}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-3 px-4">{t('resources.tableTitle')}</th>
                  <th className="py-3 px-4">{t('resources.tableFolderSkill')}</th>
                  <th className="py-3 px-4">{t('resources.tableTags')}</th>
                  <th className="py-3 px-4">{t('resources.tableVisibility')}</th>
                  <th className="py-3 px-4 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResources.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      {t('resources.noResources')}
                    </td>
                  </tr>
                ) : (
                  filteredResources.map((res) => {
                    const isAiReadingTest =
                      res.folder === 'AI Reading Tests' || res.tags.includes('ai-generated');

                    return (
                      <tr key={res.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2.5">
                            <span className="p-1.5 bg-slate-100 rounded-lg shrink-0">
                              {isAiReadingTest ? (
                                <Sparkles className="w-4 h-4 text-purple-600" />
                              ) : (
                                getIconForType(res.type)
                              )}
                            </span>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-slate-900 block">{res.title}</span>
                                {isAiReadingTest && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                    AI Test
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] uppercase font-bold text-slate-400">
                                {res.type}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-slate-700 block font-medium">
                            {res.folder ? `📁 ${res.folder}` : '—'}
                          </span>
                          {res.skill && (
                            <span className="text-[10px] text-blue-600 font-semibold capitalize">
                              {res.skill}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {res.tags.map((tg) => (
                              <span
                                key={tg}
                                className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]"
                              >
                                #{tg}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {res.isPublished ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <Globe className="w-3 h-3" />
                              <span>{t('resources.publishedToStudents')}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              <Lock className="w-3 h-3" />
                              <span>{t('resources.privateTeacher')}</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {isAiReadingTest && res.content && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    try {
                                      const testObj = JSON.parse(res.content || '{}');
                                      setSelectedEditTest(testObj);
                                      setShowAiTestGenModal(true);
                                    } catch {
                                      alert('Unable to parse test data.');
                                    }
                                  }}
                                  className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-[11px] font-semibold border border-purple-200 flex items-center space-x-1 transition-colors"
                                  title="Edit Test in AI Studio"
                                >
                                  <Edit className="w-3 h-3" />
                                  <span>Edit Test</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExportAiTestDocx(res)}
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-semibold border border-blue-200 flex items-center space-x-1 transition-colors"
                                  title="Export Word (.docx)"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>DOCX</span>
                                </button>
                              </>
                            )}

                            {isTeacher && (
                              <button
                                onClick={() => toggleResourcePublish(res.id)}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                              >
                                {res.isPublished ? t('resources.unpublish') : t('resources.publish')}
                              </button>
                            )}
                            {isTeacher && (
                              <button
                                onClick={() => {
                                  if (confirm(t('resources.deleteConfirm'))) deleteResource(res.id);
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                                title={t('common.delete')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lessons Tab */}
      {activeTab === 'lessons' && (
        <div className="space-y-4">
          {visibleLessons.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
              {t('common.empty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleLessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          lesson.skill === 'reading'
                            ? 'bg-emerald-100 text-emerald-800'
                            : lesson.skill === 'writing'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {lesson.skill}
                      </span>
                      <span className="text-slate-400 flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(lesson.date)}</span>
                      </span>
                    </div>

                    {isTeacher && (
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          lesson.isPublished
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {lesson.isPublished ? t('status.published') : t('status.draft')}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm">{lesson.title}</h3>

                  <div>
                    <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                      {t('resources.objectives')}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{lesson.objectives}</p>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                      {t('resources.activities')}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                      {lesson.activities}
                    </p>
                  </div>

                  {isTeacher && lesson.teacherNotes && (
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs">
                      <span className="font-bold text-amber-900 block mb-0.5">
                        {t('resources.teacherNotesSecret')}
                      </span>
                      <p className="text-amber-800 leading-relaxed">{lesson.teacherNotes}</p>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="text-slate-600">
                      <span className="font-bold">{t('resources.homework')}: </span>
                      <span>{lesson.homework || '—'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Add Resource */}
      {showAddResModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">{t('resources.addModalTitle')}</h3>
            <form onSubmit={handleAddResource} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('resources.resourceTitle')}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cambridge 18 Reading Passage 2 Drill"
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('resources.resourceType')}</label>
                  <select
                    value={resType}
                    onChange={(e) => setResType(e.target.value as ResourceType)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
                  >
                    <option value="pdf">PDF Document</option>
                    <option value="doc">Word / Doc</option>
                    <option value="audio">Audio Clip</option>
                    <option value="video">Video URL</option>
                    <option value="link">Web Link</option>
                    <option value="note">Text / Note</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('resources.resourceSkill')}</label>
                  <select
                    value={resSkill}
                    onChange={(e) => setResSkill(e.target.value as CourseSkill)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
                  >
                    <option value="reading">{t('skills.reading')}</option>
                    <option value="writing">{t('skills.writing')}</option>
                    <option value="listening">{t('skills.listening')}</option>
                    <option value="speaking">{t('skills.speaking')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('resources.resourceFolder')}</label>
                <input
                  type="text"
                  placeholder="e.g. Reading Practice, Vocabulary Sheets"
                  value={resFolder}
                  onChange={(e) => setResFolder(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('resources.resourceTags')}</label>
                <input
                  type="text"
                  placeholder="e.g. academic, task2, band7"
                  value={resTags}
                  onChange={(e) => setResTags(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="pub-check"
                  checked={resIsPublished}
                  onChange={(e) => setResIsPublished(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="pub-check" className="text-slate-700 font-medium">
                  {t('resources.publishImmediately')}
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddResModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  {t('resources.saveResourceBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Lesson */}
      {showAddLessonModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 mb-3">{t('resources.createLessonTitle')}</h3>
            <form onSubmit={handleCreateLesson} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('resources.selectCourse')}</label>
                <select
                  required
                  value={lessonCourseId}
                  onChange={(e) => setLessonCourseId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
                >
                  <option value="">{t('resources.chooseCourse')}</option>
                  {courses
                    .filter((c) => c.teacherId === currentUser.id && c.status === 'active')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('resources.lessonTitle')}</label>
                <input
                  type="text"
                  required
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('resources.objectives')}</label>
                <textarea
                  rows={2}
                  value={lessonObjectives}
                  onChange={(e) => setLessonObjectives(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('resources.activities')}</label>
                <textarea
                  rows={3}
                  value={lessonActivities}
                  onChange={(e) => setLessonActivities(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <label className="block font-bold text-amber-900 mb-1">
                  {t('resources.teacherNotesSecret')}
                </label>
                <textarea
                  rows={2}
                  value={lessonTeacherNotes}
                  onChange={(e) => setLessonTeacherNotes(e.target.value)}
                  className="w-full p-2 border border-amber-300 rounded-lg outline-hidden bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('resources.homework')}</label>
                <input
                  type="text"
                  value={lessonHomework}
                  onChange={(e) => setLessonHomework(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={lessonIsPublished}
                    onChange={(e) => setLessonIsPublished(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="font-semibold text-slate-700">{t('resources.publishImmediately')}</span>
                </label>

                <div className="space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddLessonModal(false)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs"
                  >
                    {t('resources.saveLessonBtn')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: AI Lesson Assistant */}
      {showAiLessonModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center space-x-2 text-indigo-700 mb-2">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">{t('resources.aiAssistantTitle')}</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {t('resources.aiAssistantDesc')}
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('resources.resourceSkill')}</label>
                <select
                  value={aiSkill}
                  onChange={(e) => setAiSkill(e.target.value as CourseSkill)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-hidden bg-white"
                >
                  <option value="writing">{t('skills.writing')}</option>
                  <option value="reading">{t('skills.reading')}</option>
                  <option value="speaking">{t('skills.speaking')}</option>
                  <option value="listening">{t('skills.listening')}</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('resources.topicFocus')}</label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('resources.targetBandRange')}</label>
                <input
                  type="text"
                  value={aiTargetBand}
                  onChange={(e) => setAiTargetBand(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <button
                onClick={generateAiLesson}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs flex items-center justify-center space-x-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t('resources.generateDraftBtn')}</span>
              </button>

              {aiGeneratedDraft && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <pre className="text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                    {aiGeneratedDraft}
                  </pre>
                  <button
                    onClick={applyAiToLessonForm}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
                  >
                    {t('resources.transferToLesson')} &rarr;
                  </button>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  onClick={() => setShowAiLessonModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart Document Import & Conversion Modal (Lazy Loaded) */}
      {showSmartImportModal && (
        <React.Suspense fallback={null}>
          <SmartDocumentImportModal
            isOpen={showSmartImportModal}
            onClose={() => setShowSmartImportModal(false)}
          />
        </React.Suspense>
      )}

      {/* AI Reading Test Generator Modal (Lazy Loaded) */}
      {showAiTestGenModal && (
        <React.Suspense fallback={null}>
          <AiReadingTestGeneratorModal
            isOpen={showAiTestGenModal}
            onClose={() => {
              setShowAiTestGenModal(false);
              setSelectedEditTest(null);
            }}
            initialTest={selectedEditTest}
          />
        </React.Suspense>
      )}
    </div>
  );
};
