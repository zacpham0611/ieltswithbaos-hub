import React, { useState } from 'react';
import { Portal } from '../components/Portal';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import { MonthlyReport, AssessmentState } from '../types';
import {
  Award,
  Sparkles,
  FileText,
  CheckCircle,
  AlertCircle,
  Printer,
  ChevronRight,
  Plus,
  History,
  ShieldAlert,
  ArrowRight,
  BookOpen,
  Calendar,
  Lock,
  X,
} from 'lucide-react';

export const AssessmentsView: React.FC = () => {
  const {
    currentUser,
    courses,
    courseMembers,
    monthlyReports,
    createMonthlyReportDraft,
    updateMonthlyReport,
    approveMonthlyReport,
    publishMonthlyReport,
    voidMonthlyReport,
    selectedReportId,
    setSelectedReportId,
  } = useApp();

  const { t } = useI18n();

  if (!currentUser) return null;
  const isTeacher = currentUser.role === 'teacher';

  // Filters & creation state
  const [filterMonth, setFilterMonth] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCourseId, setNewCourseId] = useState('');
  const [newStudentId, setNewStudentId] = useState('');
  const [newMonth, setNewMonth] = useState('October 2026');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Currently opened report
  const activeReport = selectedReportId
    ? monthlyReports.find((r) => r.id === selectedReportId)
    : null;

  // Editable fields for teacher
  const [profJudgement, setProfJudgement] = useState(activeReport?.teacherEvaluation.professionalJudgement || '');
  const [nextPriorities, setNextPriorities] = useState(activeReport?.teacherEvaluation.nextMonthPriorities || '');
  const [estBand, setEstBand] = useState(activeReport?.teacherEvaluation.estimatedBand || 'Estimated Overall: Band 7.0');

  // Sync state when activeReport changes
  React.useEffect(() => {
    if (activeReport) {
      setProfJudgement(activeReport.teacherEvaluation.professionalJudgement || '');
      setNextPriorities(activeReport.teacherEvaluation.nextMonthPriorities || '');
      setEstBand(activeReport.teacherEvaluation.estimatedBand || 'Estimated Overall: Band 7.0');
    }
  }, [activeReport]);

  // Scoped reports:
  const visibleReports = isTeacher
    ? monthlyReports.filter((r) => r.teacherId === currentUser.id)
    : monthlyReports.filter((r) => r.studentId === currentUser.id && r.state === 'published');

  const filteredReports = visibleReports.filter(
    (r) => filterMonth === 'all' || r.month === filterMonth
  );

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseId || !newStudentId) return;

    setIsSubmittingCreate(true);
    try {
      const report = await createMonthlyReportDraft(newCourseId, newStudentId, newMonth);
      setShowCreateModal(false);
      setSelectedReportId(report.id);
    } catch (err: any) {
      alert(err.message || 'Error drafting report');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleSaveEvaluation = async () => {
    if (!activeReport) return;
    await updateMonthlyReport(activeReport.id, {
      teacherEvaluation: {
        ...activeReport.teacherEvaluation,
        professionalJudgement: profJudgement,
        nextMonthPriorities: nextPriorities,
        estimatedBand: estBand,
      },
      state: 'in_review',
    });
    alert(t('common.success'));
  };

  const handleApprove = async () => {
    if (!activeReport) return;
    if (!profJudgement.trim()) {
      alert('Please fill out the Teacher Professional Evaluation before approving.');
      return;
    }
    await updateMonthlyReport(activeReport.id, {
      teacherEvaluation: {
        ...activeReport.teacherEvaluation,
        professionalJudgement: profJudgement,
        nextMonthPriorities: nextPriorities,
        estimatedBand: estBand,
      },
    });
    await approveMonthlyReport(activeReport.id);
  };

  const handlePublish = async () => {
    if (!activeReport) return;
    await publishMonthlyReport(activeReport.id);
  };

  const handlePrint = () => {
    window.print();
  };

  // If a report is selected, show detail/print view
  if (activeReport) {
    const isApproved = activeReport.state === 'approved' || activeReport.state === 'published';
    const isPublished = activeReport.state === 'published';

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Navigation & Action Bar */}
        <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <button
              onClick={() => setSelectedReportId(null)}
              className="text-xs font-semibold text-blue-600 hover:underline mb-1 block"
            >
              &larr; {t('assessments.backToReports')}
            </button>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-slate-900">
                {t('assessments.reportTitle')}: {activeReport.month}
              </h1>
              <span
                className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                  isPublished
                    ? 'bg-emerald-100 text-emerald-800'
                    : isApproved
                    ? 'bg-blue-100 text-blue-800'
                    : activeReport.state === 'in_review'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {activeReport.state.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('assessments.studentLabel')}: <span className="font-semibold text-slate-700">{activeReport.studentName}</span> · {t('assessments.courseLabel')}: {activeReport.courseName}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>{t('assessments.exportStudentPdf')}</span>
            </button>

            {isTeacher && (
              <>
                {!isApproved && (
                  <button
                    onClick={handleApprove}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{t('assessments.approveReport')}</span>
                  </button>
                )}

                {isApproved && !isPublished && (
                  <button
                    onClick={handlePublish}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{t('assessments.publishToStudent')}</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    if (confirm(t('assessments.voidConfirm'))) {
                      voidMonthlyReport(activeReport.id);
                      setSelectedReportId(null);
                    }
                  }}
                  className="px-3 py-2 text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors"
                >
                  {t('assessments.voidBtn')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Workflow breadcrumb banner for Teacher */}
        {isTeacher && (
          <div className="no-print bg-slate-100/80 p-3 rounded-xl border border-slate-200 text-xs flex items-center justify-between overflow-x-auto">
            <span className="font-bold text-slate-600 uppercase text-[10px] tracking-wider">
              {t('assessments.workflowLabel')}:
            </span>
            <div className="flex items-center space-x-2 text-[11px] font-semibold">
              <span className="text-slate-500">{t('assessments.step1')}</span>
              <span className="text-slate-300">&rarr;</span>
              <span className="text-slate-500">{t('assessments.step2')}</span>
              <span className="text-slate-300">&rarr;</span>
              <span className="text-purple-700 font-bold">{t('assessments.step3')}</span>
              <span className="text-slate-300">&rarr;</span>
              <span className={`${activeReport.state === 'in_review' ? 'text-amber-700 font-bold' : 'text-slate-500'}`}>
                {t('assessments.step4')}
              </span>
              <span className="text-slate-300">&rarr;</span>
              <span className={`${isApproved ? 'text-blue-700 font-bold' : 'text-slate-500'}`}>
                {t('assessments.step5')}
              </span>
              <span className="text-slate-300">&rarr;</span>
              <span className={`${isPublished ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                {t('assessments.step6')}
              </span>
            </div>
          </div>
        )}

        {/* PRINTABLE REPORT CARD */}
        <div className="print-page bg-white rounded-xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-6">
          {/* Header Banner */}
          <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <span className="text-[10px] tracking-widest font-extrabold uppercase text-blue-400 block">
                {t('assessments.bannerHeading')}
              </span>
              <h2 className="text-lg font-extrabold">{activeReport.month}</h2>
            </div>
            <div className="text-xs text-slate-300 flex flex-wrap gap-4 sm:text-right">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">{t('assessments.studentLabel')}</span>
                <span className="font-bold text-white text-sm">{activeReport.studentName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">{t('assessments.courseLabel')}</span>
                <span className="font-bold text-white text-sm">{activeReport.courseName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">{t('assessments.targetLabel')}</span>
                <span className="font-bold text-blue-300 text-sm">{activeReport.targetBand}</span>
              </div>
            </div>
          </div>

          {/* 3-COLUMN REPORT GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: Learning Evidence */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  {t('assessments.col1Heading')}
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-slate-700 block mb-0.5">{t('assessments.readingAccuracy')}</span>
                  <p className="text-slate-600 bg-white p-2.5 rounded border border-slate-200/80">
                    {activeReport.learningEvidence.readingAccuracy || 'No Reading drills logged'}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-700 block mb-0.5">{t('assessments.writingSubmissions')}</span>
                  <div className="bg-white p-2.5 rounded border border-slate-200/80">
                    <span className="font-semibold text-slate-800">
                      {t('assessments.essaysSubmitted', { count: String(activeReport.learningEvidence.writingSubmissions) })}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {activeReport.learningEvidence.writingLastFeedback}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-700 block mb-0.5">{t('assessments.speakingRecordings')}</span>
                  <div className="bg-white p-2.5 rounded border border-slate-200/80">
                    {activeReport.learningEvidence.speakingAudioAvailable ? (
                      <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{t('assessments.audioAttached', { count: String(activeReport.learningEvidence.speakingSubmissions) })}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">{t('assessments.noAudio')}</span>
                    )}
                  </div>
                </div>

                {/* Evidence Gaps */}
                {activeReport.learningEvidence.insufficientEvidenceSkills.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                    <span className="font-bold block mb-0.5">{t('assessments.gapsFlagged')}</span>
                    <ul className="list-disc list-inside">
                      {activeReport.learningEvidence.insufficientEvidenceSkills.map((gap, i) => (
                        <li key={i}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: AI-Assisted Draft */}
            <div className="bg-purple-50/40 p-5 rounded-xl border border-purple-200 space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-purple-200">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <h3 className="text-xs font-extrabold text-purple-900 uppercase tracking-wider">
                  {t('assessments.col2Heading')}
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-purple-900 block mb-0.5">{t('assessments.demonstratedStrengths')}</span>
                  <p className="text-slate-700 bg-white p-2.5 rounded border border-purple-100 whitespace-pre-line leading-relaxed">
                    {activeReport.aiDraft.strengths}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-purple-900 block mb-0.5">{t('assessments.focusAreas')}</span>
                  <p className="text-slate-700 bg-white p-2.5 rounded border border-purple-100 whitespace-pre-line leading-relaxed">
                    {activeReport.aiDraft.focusAreas}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-purple-900 block mb-0.5">{t('assessments.recurringPatterns')}</span>
                  <p className="text-slate-700 bg-white p-2.5 rounded border border-purple-100 leading-relaxed">
                    {activeReport.aiDraft.recurringPatterns}
                  </p>
                </div>

                <div className="p-2.5 bg-purple-100/60 rounded text-[10px] text-purple-800 font-medium">
                  {activeReport.aiDraft.evidenceGapsFlagged}
                </div>
              </div>
            </div>

            {/* Column 3: Teacher Evaluation */}
            <div className="bg-blue-50/40 p-5 rounded-xl border border-blue-200 space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-blue-200">
                <Award className="w-3.5 h-3.5 text-blue-600" />
                <h3 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider">
                  {t('assessments.col3Heading')}
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                {isTeacher && !isPublished ? (
                  <>
                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        {t('assessments.profJudgement')}
                      </label>
                      <textarea
                        rows={4}
                        value={profJudgement}
                        onChange={(e) => setProfJudgement(e.target.value)}
                        placeholder={t('assessments.profJudgementDesc')}
                        className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-hidden leading-relaxed text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-800 block mb-1">{t('assessments.nextPriorities')}</label>
                      <textarea
                        rows={3}
                        value={nextPriorities}
                        onChange={(e) => setNextPriorities(e.target.value)}
                        placeholder={t('assessments.nextPrioritiesDesc')}
                        className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-hidden leading-relaxed text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        {t('assessments.bandEstimateLabel')}
                      </label>
                      <input
                        type="text"
                        value={estBand}
                        onChange={(e) => setEstBand(e.target.value)}
                        placeholder="e.g. Estimated Overall: Band 7.0 (R: 7.5, W: 7.0)"
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-hidden text-xs"
                      />
                    </div>

                    <button
                      onClick={handleSaveEvaluation}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                    >
                      {t('assessments.saveEvaluation')}
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="font-bold text-blue-900 block mb-0.5">{t('assessments.profJudgement')}</span>
                      <p className="text-slate-800 bg-white p-3 rounded-lg border border-blue-100 leading-relaxed">
                        {activeReport.teacherEvaluation.professionalJudgement || 'Pending teacher review.'}
                      </p>
                    </div>

                    <div>
                      <span className="font-bold text-blue-900 block mb-0.5">{t('assessments.nextPriorities')}</span>
                      <p className="text-slate-800 bg-white p-3 rounded-lg border border-blue-100 whitespace-pre-line leading-relaxed">
                        {activeReport.teacherEvaluation.nextMonthPriorities || 'Pending teacher review.'}
                      </p>
                    </div>

                    {activeReport.teacherEvaluation.estimatedBand && (
                      <div className="p-3 bg-blue-100/70 rounded-lg border border-blue-200">
                        <span className="text-[10px] uppercase font-bold text-blue-900 block">
                          {t('assessments.teacherEstimatedBand')}
                        </span>
                        <span className="text-sm font-extrabold text-blue-900">
                          {activeReport.teacherEvaluation.estimatedBand}
                        </span>
                        <p className="text-[10px] text-blue-700 mt-0.5">
                          {t('assessments.estimateDisclaimer')}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Traceable Audit & Revision History */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 flex items-center space-x-1.5 mb-2">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('assessments.historyTitle')}</span>
            </h4>
            <div className="space-y-1.5 text-[11px] text-slate-500">
              {activeReport.history.map((h, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span>
                    v{h.version}: {h.action} ({h.actor})
                  </span>
                  <span>{h.timestamp}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Disclaimer */}
          <div className="text-[10px] text-slate-400 text-center pt-2">
            {t('assessments.disclaimer')}
          </div>
        </div>
      </div>
    );
  }

  // Listing View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('assessments.title')}</h1>
          <p className="text-sm text-slate-500">
            {isTeacher ? t('assessments.subtitleTeacher') : t('assessments.subtitleStudent')}
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
            <span>{t('assessments.generateBtn')}</span>
          </button>
        )}
      </div>

      {/* Reports Table / List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
            <tr>
              <th className="py-3 px-4">{t('assessments.tableStudentCourse')}</th>
              <th className="py-3 px-4">{t('assessments.tableReportingMonth')}</th>
              <th className="py-3 px-4">{t('assessments.tableTargetBand')}</th>
              <th className="py-3 px-4">{t('assessments.tableStatus')}</th>
              <th className="py-3 px-4">{t('assessments.tableProfEval')}</th>
              <th className="py-3 px-4 text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  {isTeacher
                    ? 'No monthly reports created yet. Click "Generate New Report" to start an assessment.'
                    : 'No monthly learning reports published for you yet.'}
                </td>
              </tr>
            ) : (
              filteredReports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-900">{report.studentName}</p>
                    <p className="text-[11px] text-slate-500">{report.courseName}</p>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-700">{report.month}</td>
                  <td className="py-3 px-4 text-blue-600 font-bold">{report.targetBand}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        report.state === 'published'
                          ? 'bg-emerald-100 text-emerald-800'
                          : report.state === 'approved'
                          ? 'bg-blue-100 text-blue-800'
                          : report.state === 'in_review'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {report.state.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    {report.teacherEvaluation.professionalJudgement ? (
                      <p className="text-slate-600 truncate text-[11px]">
                        {report.teacherEvaluation.professionalJudgement}
                      </p>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Pending evaluation</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedReportId(report.id)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      {t('assessments.openReport')} &rarr;
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Generate New Report */}
      {showCreateModal && (
        <Portal>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="relative z-10 bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <h3 className="text-base font-bold text-slate-900">{t('assessments.prepareModalTitle')}</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                {t('assessments.prepareModalDesc')}
              </p>

              <form onSubmit={handleCreateReport} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('resources.selectCourse')}</label>
                  <select
                    required
                    value={newCourseId}
                    onChange={(e) => {
                      setNewCourseId(e.target.value);
                    }}
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
                  <label className="block font-semibold text-slate-700 mb-1">{t('assessments.studentLabel')}</label>
                  <select
                    required
                    value={newStudentId}
                    onChange={(e) => setNewStudentId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
                  >
                    <option value="">{t('assessments.chooseStudent')}</option>
                    {courseMembers
                      .filter((m) => (!newCourseId || m.courseId === newCourseId) && m.status === 'enrolled')
                      .map((m) => (
                        <option key={m.studentId} value={m.studentId}>
                          {m.studentName} ({m.studentEmail})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('assessments.reportingPeriodLabel')}</label>
                  <input
                    type="text"
                    value={newMonth}
                    onChange={(e) => setNewMonth(e.target.value)}
                    placeholder="e.g. October 2026"
                    className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCreate}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs flex items-center space-x-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isSubmittingCreate ? t('common.loading') : t('assessments.gatherAndDraftBtn')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};
