import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
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
} from 'lucide-react';

export const AssessmentsView: React.FC = () => {
  const {
    currentUser,
    courses,
    users,
    monthlyReports,
    createMonthlyReportDraft,
    updateMonthlyReport,
    approveMonthlyReport,
    publishMonthlyReport,
    voidMonthlyReport,
    selectedReportId,
    setSelectedReportId,
  } = useApp();

  const isTeacher = currentUser.role === 'teacher';

  // Filters & creation state
  const [filterMonth, setFilterMonth] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCourseId, setNewCourseId] = useState('');
  const [newStudentId, setNewStudentId] = useState('');
  const [newMonth, setNewMonth] = useState('October 2026');

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
  // Teacher sees their own created reports
  // Student sees ONLY reports where studentId === currentUser.id AND state === 'published'
  const visibleReports = isTeacher
    ? monthlyReports.filter((r) => r.teacherId === currentUser.id)
    : monthlyReports.filter((r) => r.studentId === currentUser.id && r.state === 'published');

  const filteredReports = visibleReports.filter(
    (r) => filterMonth === 'all' || r.month === filterMonth
  );

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseId || !newStudentId) return;

    const report = createMonthlyReportDraft(newCourseId, newStudentId, newMonth);
    setShowCreateModal(false);
    setSelectedReportId(report.id);
  };

  const handleSaveEvaluation = () => {
    if (!activeReport) return;
    updateMonthlyReport(activeReport.id, {
      teacherEvaluation: {
        ...activeReport.teacherEvaluation,
        professionalJudgement: profJudgement,
        nextMonthPriorities: nextPriorities,
        estimatedBand: estBand,
      },
      state: 'in_review',
    });
    alert('Evaluation saved successfully.');
  };

  const handleApprove = () => {
    if (!activeReport) return;
    if (!profJudgement.trim()) {
      alert('Please fill out the Teacher Professional Evaluation before approving.');
      return;
    }
    updateMonthlyReport(activeReport.id, {
      teacherEvaluation: {
        ...activeReport.teacherEvaluation,
        professionalJudgement: profJudgement,
        nextMonthPriorities: nextPriorities,
        estimatedBand: estBand,
      },
    });
    approveMonthlyReport(activeReport.id);
  };

  const handlePublish = () => {
    if (!activeReport) return;
    publishMonthlyReport(activeReport.id);
  };

  const handlePrint = () => {
    window.print();
  };

  // If a report is selected, display the 3-column Monthly Learning Report layout from Page 5!
  if (activeReport) {
    const isApproved = activeReport.state === 'approved';
    const isPublished = activeReport.state === 'published';
    const isVoid = activeReport.state === 'void';

    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Navigation & Action Bar */}
        <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <button
              onClick={() => setSelectedReportId(null)}
              className="text-xs font-semibold text-blue-600 hover:underline mb-1 block"
            >
              &larr; Back to all reports
            </button>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-slate-900">
                Monthly Learning Assessment: {activeReport.month}
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
              Course: <span className="font-semibold text-slate-700">{activeReport.courseName}</span> · Teacher: {activeReport.teacherName}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Export Student PDF</span>
            </button>

            {isTeacher && !isPublished && !isVoid && (
              <>
                {!isApproved ? (
                  <button
                    onClick={handleApprove}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Approve Report</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePublish}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Publish to Student</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm('Void this report? It will be archived with full history.')) {
                      voidMonthlyReport(activeReport.id);
                    }
                  }}
                  className="px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Void
                </button>
              </>
            )}
          </div>
        </div>

        {/* Workflow breadcrumb banner for Teacher */}
        {isTeacher && (
          <div className="no-print bg-slate-100/80 p-3 rounded-xl border border-slate-200 text-xs flex items-center justify-between overflow-x-auto">
            <span className="font-bold text-slate-600 uppercase text-[10px] tracking-wider">
              Report Workflow:
            </span>
            <div className="flex items-center space-x-2 text-[11px] font-semibold">
              <span className="text-slate-500">1. Select Student</span>
              <span className="text-slate-300">&rarr;</span>
              <span className="text-slate-500">2. Gather Evidence</span>
              <span className="text-slate-300">&rarr;</span>
              <span className="text-purple-700 font-bold">3. AI Draft</span>
              <span className="text-slate-300">&rarr;</span>
              <span className={`${activeReport.state === 'in_review' ? 'text-amber-700 font-bold' : 'text-slate-500'}`}>
                4. Teacher Review
              </span>
              <span className="text-slate-300">&rarr;</span>
              <span className={`${isApproved ? 'text-blue-700 font-bold' : 'text-slate-500'}`}>
                5. Approve (Required)
              </span>
              <span className="text-slate-300">&rarr;</span>
              <span className={`${isPublished ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                6. Publish + PDF
              </span>
            </div>
          </div>
        )}

        {/* PRINTABLE REPORT CARD (Matches Page 5 Mockup Exactly) */}
        <div className="print-page bg-white rounded-xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-6">
          {/* Header Banner */}
          <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <span className="text-[10px] tracking-widest font-extrabold uppercase text-blue-400 block">
                MONTHLY LEARNING REPORT
              </span>
              <h2 className="text-lg font-extrabold">{activeReport.month}</h2>
            </div>
            <div className="text-xs text-slate-300 flex flex-wrap gap-4 sm:text-right">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Student</span>
                <span className="font-bold text-white text-sm">{activeReport.studentName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Course</span>
                <span className="font-bold text-white text-sm">{activeReport.courseName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Target</span>
                <span className="font-bold text-blue-300 text-sm">{activeReport.targetBand}</span>
              </div>
            </div>
          </div>

          {/* 3-COLUMN REPORT GRID (Page 5: Learning evidence, AI-assisted draft, Teacher evaluation) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: Learning Evidence */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Learning Evidence
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-slate-700 block mb-0.5">Reading Accuracy</span>
                  <p className="text-slate-600 bg-white p-2.5 rounded border border-slate-200/80">
                    {activeReport.learningEvidence.readingAccuracy || 'No Reading drills logged'}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-700 block mb-0.5">Writing Submissions</span>
                  <div className="bg-white p-2.5 rounded border border-slate-200/80">
                    <span className="font-semibold text-slate-800">
                      {activeReport.learningEvidence.writingSubmissions} essays submitted
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {activeReport.learningEvidence.writingLastFeedback}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-700 block mb-0.5">Speaking Recordings</span>
                  <div className="bg-white p-2.5 rounded border border-slate-200/80">
                    {activeReport.learningEvidence.speakingAudioAvailable ? (
                      <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Verified audio attached ({activeReport.learningEvidence.speakingSubmissions} files)</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">No audio recorded this period</span>
                    )}
                  </div>
                </div>

                {/* Evidence Gaps / Missing skills */}
                {activeReport.learningEvidence.insufficientEvidenceSkills.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                    <span className="font-bold block mb-0.5">⚠️ Evidence Gaps Flagged:</span>
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
                  AI-Assisted Draft
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-bold text-purple-900 block mb-0.5">Demonstrated Strengths</span>
                  <p className="text-slate-700 bg-white p-2.5 rounded border border-purple-100 whitespace-pre-line leading-relaxed">
                    {activeReport.aiDraft.strengths}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-purple-900 block mb-0.5">Focus & Improvement Areas</span>
                  <p className="text-slate-700 bg-white p-2.5 rounded border border-purple-100 whitespace-pre-line leading-relaxed">
                    {activeReport.aiDraft.focusAreas}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-purple-900 block mb-0.5">Recurring Learning Patterns</span>
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
                  Teacher Evaluation
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                {isTeacher && !isPublished ? (
                  <>
                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        Professional Judgment (Required)
                      </label>
                      <textarea
                        rows={4}
                        value={profJudgement}
                        onChange={(e) => setProfJudgement(e.target.value)}
                        placeholder="Teacher's expert diagnostic assessment..."
                        className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-hidden leading-relaxed text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-800 block mb-1">Next-Month Priorities</label>
                      <textarea
                        rows={3}
                        value={nextPriorities}
                        onChange={(e) => setNextPriorities(e.target.value)}
                        placeholder="1. Timed drills... 2. Concession clauses..."
                        className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-hidden leading-relaxed text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        Evidence-Based Band Estimate (Optional)
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
                      Save Evaluation Changes
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="font-bold text-blue-900 block mb-0.5">Professional Judgment</span>
                      <p className="text-slate-800 bg-white p-3 rounded-lg border border-blue-100 leading-relaxed">
                        {activeReport.teacherEvaluation.professionalJudgement || 'Pending teacher review.'}
                      </p>
                    </div>

                    <div>
                      <span className="font-bold text-blue-900 block mb-0.5">Next-Month Priorities</span>
                      <p className="text-slate-800 bg-white p-3 rounded-lg border border-blue-100 whitespace-pre-line leading-relaxed">
                        {activeReport.teacherEvaluation.nextMonthPriorities || 'Pending teacher review.'}
                      </p>
                    </div>

                    {activeReport.teacherEvaluation.estimatedBand && (
                      <div className="p-3 bg-blue-100/70 rounded-lg border border-blue-200">
                        <span className="text-[10px] uppercase font-bold text-blue-900 block">
                          Teacher Estimated Band
                        </span>
                        <span className="text-sm font-extrabold text-blue-900">
                          {activeReport.teacherEvaluation.estimatedBand}
                        </span>
                        <p className="text-[10px] text-blue-700 mt-0.5">
                          *Estimate based on classroom evidence, not an official test result.
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
              <span>Traceable Report History</span>
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
            This document is an internal formative assessment generated by IELTS Teaching Hub. Band estimates are diagnostic and do not represent official IELTS score certificates.
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Monthly Student Assessments</h1>
          <p className="text-sm text-slate-500">
            {isTeacher
              ? 'Synthesize verified learning evidence, review AI draft observations, and approve professional monthly reports.'
              : 'View your official published monthly learning reports and teacher recommendations.'}
          </p>
        </div>

        {isTeacher && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Generate New Report</span>
          </button>
        )}
      </div>

      {/* Reports Table / List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
            <tr>
              <th className="py-3 px-4">Student & Course</th>
              <th className="py-3 px-4">Reporting Month</th>
              <th className="py-3 px-4">Target Band</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Teacher Professional Eval</th>
              <th className="py-3 px-4 text-right">Actions</th>
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
                      Open Report &rarr;
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Prepare Monthly Report</h3>
            <p className="text-xs text-slate-500 mb-4">
              Select student and period. System will gather verified submissions, flag any missing evidence gaps, and prepare an editable AI draft.
            </p>

            <form onSubmit={handleCreateReport} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Course</label>
                <select
                  required
                  value={newCourseId}
                  onChange={(e) => {
                    setNewCourseId(e.target.value);
                  }}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
                >
                  <option value="">-- Choose Course --</option>
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
                <label className="block font-semibold text-slate-700 mb-1">Select Student</label>
                <select
                  required
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
                >
                  <option value="">-- Choose Student --</option>
                  {users
                    .filter((u) => u.role === 'student')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reporting Period</label>
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs flex items-center space-x-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Gather Evidence & Draft</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
