import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../i18n/context';
import type {
  RegularTest,
  RegularTestSection,
  RegularTestTimingMode,
  StrictExamPreset,
} from '../../types';
import { TeacherLiveDashboardModal } from './TeacherLiveDashboardModal';
import { TeacherGradingModal } from './TeacherGradingModal';
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
} from 'lucide-react';

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
  const [formSkills, setFormSkills] = useState<('reading' | 'writing')[]>(['reading']);
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
  const [showLibraryPicker, setShowLibraryPicker] = useState<'reading' | 'writing' | null>(null);
  const [savingTest, setSavingTest] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    setFormSkills(test.skills);
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
      setFormError('Test title is required');
      return;
    }
    if (!formCourseId) {
      setFormError('Please select a course');
      return;
    }

    try {
      setSavingTest(true);
      setFormError(null);

      if (editingTest) {
        await updateRegularTest(editingTest.id, {
          title: formTitle.trim(),
          instructions: formInstructions.trim(),
          courseId: formCourseId,
          skills: formSkills,
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
          skills: formSkills,
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
      setFormError(err.message || 'Failed to save test');
    } finally {
      setSavingTest(false);
    }
  };

  const handleAddSectionFromLibrary = (resource: any) => {
    if (resource.skill === 'reading' || resource.type === 'reading') {
      const newSec: RegularTestSection = {
        id: `sec_${Date.now()}`,
        skill: 'reading',
        title: resource.title || 'Reading Section',
        resourceId: resource.id,
        durationMinutes: 60,
        readingPassage: resource.content || '',
        readingQuestions: resource.readingQuestions || [],
        questionGroups: resource.questionGroups || [],
        passages: resource.passages || [],
      };
      setFormSections((prev) => [...prev, newSec]);
      if (!formSkills.includes('reading')) {
        setFormSkills((prev) => [...prev, 'reading']);
      }
    } else {
      const newSec: RegularTestSection = {
        id: `sec_${Date.now()}`,
        skill: 'writing',
        title: resource.title || 'Writing Section',
        resourceId: resource.id,
        durationMinutes: 60,
        writingPrompt: resource.content || '',
        writingTaskType: 'task2',
        writingMinWords: 250,
      };
      setFormSections((prev) => [...prev, newSec]);
      if (!formSkills.includes('writing')) {
        setFormSkills((prev) => [...prev, 'writing']);
      }
    }
    setShowLibraryPicker(null);
  };

  const handleDeleteTest = async (testId: string) => {
    if (!window.confirm('Are you sure you want to delete this test?')) return;
    const res = await deleteRegularTest(testId);
    if (!res.success) {
      alert(res.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t('regularTests.createTest')}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tests by title..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={selectedCourseFilter}
          onChange={(e) => setSelectedCourseFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700"
        >
          <option value="all">All Courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="live">Live</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Test Cards List */}
      {filteredTests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No regular tests found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Get started by creating a formal periodic exam with configured strict exam mode and proctoring.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create First Test
          </button>
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
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow flex flex-col overflow-hidden"
              >
                {/* Status Bar */}
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between text-xs">
                  <span
                    className={`font-bold uppercase tracking-wider text-[10px] px-2.5 py-0.5 rounded-full ${
                      test.status === 'live'
                        ? 'bg-emerald-100 text-emerald-800'
                        : test.status === 'scheduled'
                        ? 'bg-blue-100 text-blue-800'
                        : test.status === 'draft'
                        ? 'bg-slate-100 text-slate-600'
                        : test.status === 'closed'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
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
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
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

      {/* Test Creator / Editor Modal */}
      {showCreatorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                {editingTest ? t('regularTests.editTest') : t('regularTests.createTest')}
              </h2>
              <button
                onClick={() => setShowCreatorModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-medium">
                  {formError}
                </div>
              )}

              {/* Basic Info */}
              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Test Title *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. IELTS Mid-Term Periodic Exam 2026"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target Course *</label>
                    <select
                      value={formCourseId}
                      onChange={(e) => setFormCourseId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Skills Assessed</label>
                    <div className="flex items-center gap-3 mt-1.5">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formSkills.includes('reading')}
                          onChange={(e) => {
                            if (e.target.checked) setFormSkills([...formSkills, 'reading']);
                            else setFormSkills(formSkills.filter((s) => s !== 'reading'));
                          }}
                          className="w-4 h-4 text-blue-600 rounded-sm"
                        />
                        <span>Reading</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formSkills.includes('writing')}
                          onChange={(e) => {
                            if (e.target.checked) setFormSkills([...formSkills, 'writing']);
                            else setFormSkills(formSkills.filter((s) => s !== 'writing'));
                          }}
                          className="w-4 h-4 text-blue-600 rounded-sm"
                        />
                        <span>Writing</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">General Instructions</label>
                  <textarea
                    value={formInstructions}
                    onChange={(e) => setFormInstructions(e.target.value)}
                    rows={2}
                    placeholder="Exam guidelines, candidate rules, and instructions..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Timing & Strict Mode */}
              <div className="pt-4 border-t border-slate-200 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('regularTests.durationMinutes')}</label>
                  <input
                    type="number"
                    min={10}
                    max={240}
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Timing Mode</label>
                  <select
                    value={formTimingMode}
                    onChange={(e) => setFormTimingMode(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="overall_timer">Overall timer (Free navigation)</option>
                    <option value="per_section">Per-section timers (Sequential lock)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Strict Exam Preset</label>
                  <select
                    value={formStrictPreset}
                    onChange={(e) => setFormStrictPreset(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="standard">Standard (Monitored)</option>
                    <option value="strict">Strict (Fullscreen Enforced)</option>
                    <option value="off">Off (Standard Practice)</option>
                  </select>
                </div>
              </div>

              {/* Access Code */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <label className="font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAccessCodeEnabled}
                      onChange={(e) => setFormAccessCodeEnabled(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded-sm"
                    />
                    Require Access Code to start exam
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Salted and hashed securely on server.
                  </p>
                </div>
                {formAccessCodeEnabled && (
                  <input
                    type="text"
                    value={formAccessCode}
                    onChange={(e) => setFormAccessCode(e.target.value)}
                    placeholder="e.g. EXAM2026"
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 uppercase tracking-widest font-mono font-bold w-36"
                  />
                )}
              </div>

              {/* Materials Library Section Builder */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Library className="w-4 h-4 text-blue-600" />
                    Exam Sections & Materials Library Content ({formSections.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLibraryPicker('reading')}
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Reading from Library
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLibraryPicker('writing')}
                      className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Writing from Library
                    </button>
                  </div>
                </div>

                {formSections.length === 0 ? (
                  <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400">
                    No sections added yet. Click above to select passages and prompts from your Materials Library.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formSections.map((sec, idx) => (
                      <div
                        key={sec.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          {sec.skill === 'reading' ? (
                            <BookOpen className="w-4 h-4 text-blue-600" />
                          ) : (
                            <PenTool className="w-4 h-4 text-indigo-600" />
                          )}
                          <div>
                            <div className="font-bold text-slate-800">
                              Section {idx + 1}: {sec.title}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Skill: {sec.skill.toUpperCase()} • {sec.skill === 'reading' ? `${sec.readingQuestions?.length || 0} Questions` : 'Task Essay'}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setFormSections(formSections.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreatorModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveTest}
                disabled={savingTest}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm disabled:opacity-50"
              >
                {savingTest ? 'Saving...' : editingTest ? 'Update Test' : 'Create Draft Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Materials Library Picker Sub-modal */}
      {showLibraryPicker && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Library className="w-4 h-4 text-blue-400" />
                Select {showLibraryPicker.toUpperCase()} from Materials Library
              </h3>
              <button onClick={() => setShowLibraryPicker(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {resources.filter((r) => r.skill === showLibraryPicker || (r as any).type === showLibraryPicker).length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No {showLibraryPicker} materials found in library.
                </div>
              ) : (
                resources
                  .filter((r) => r.skill === showLibraryPicker || (r as any).type === showLibraryPicker)
                  .map((res) => (
                    <div
                      key={res.id}
                      onClick={() => handleAddSectionFromLibrary(res)}
                      className="p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 cursor-pointer transition-all flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{res.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {res.tags?.join(', ') || 'No tags'} • {res.createdAt}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-blue-600" />
                    </div>
                  ))
              )}
            </div>
          </div>
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
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Student Attempts: {attemptsListTest.title}</h3>
                <p className="text-xs text-slate-400">{attemptsListTest.courseName}</p>
              </div>
              <button onClick={() => setAttemptsListTest(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {regularTestAttempts.filter((a) => a.testId === attemptsListTest.id).length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No submissions yet for this exam.
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
                          {attempt.submittedAt && ` • Submitted: ${attempt.submittedAt}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-black text-blue-600">
                            Band {attempt.scores?.overall ?? attempt.scores?.reading?.band ?? '—'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {attempt.isReleased ? 'Released' : 'Private'}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setGradingAttemptData({ test: attemptsListTest, attempt });
                            setAttemptsListTest(null);
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs"
                        >
                          Grade / Review
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Teacher Grading Modal */}
      {gradingAttemptData && (
        <TeacherGradingModal
          test={gradingAttemptData.test}
          attempt={gradingAttemptData.attempt}
          onClose={() => setGradingAttemptData(null)}
        />
      )}
    </div>
  );
};
