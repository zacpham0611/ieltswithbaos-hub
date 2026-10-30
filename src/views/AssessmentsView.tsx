import React, { useState } from 'react';
import { Portal } from '../components/Portal';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import { MonthlyReport, AssessmentState, AssignmentAssessmentEvidence } from '../types';
import { calculateReadingBand } from '../lib/ieltsScoring';
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
  PenTool,
  Mic,
  Headphones,
  Check,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

export const AssessmentsView: React.FC = () => {
  const {
    currentUser,
    courses,
    courseMembers,
    submissions,
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

  // Dynamic calculation & hydration of completed assignments for active report
  const activeCompletedAssignments: AssignmentAssessmentEvidence[] = React.useMemo(() => {
    if (!activeReport) return [];
    if (
      activeReport.learningEvidence?.completedAssignments &&
      activeReport.learningEvidence.completedAssignments.length > 0
    ) {
      return activeReport.learningEvidence.completedAssignments;
    }
    // Dynamic fallback hydration from submissions in context
    const studentSubs = submissions.filter(
      (s) => s.studentId === activeReport.studentId && s.courseId === activeReport.courseId
    );
    return studentSubs.map((s) => {
      let finalBand: number | undefined = undefined;
      let source: 'teacher' | 'ai' | 'unscored' = 'unscored';

      if (s.skill === 'reading') {
        const total = s.readingScore?.total || 40;
        const correct = s.readingScore?.correct || 0;
        if (typeof s.score === 'number' && s.score > 0) {
          finalBand = s.score;
          source = s.status === 'graded' ? 'teacher' : 'ai';
        } else if (s.readingScore?.estimatedBand) {
          finalBand = s.readingScore.estimatedBand;
          source = s.status === 'graded' ? 'teacher' : 'ai';
        } else if (s.status === 'graded' || s.status === 'submitted') {
          const res = calculateReadingBand(correct, 'academic', total);
          finalBand = res.band;
          source = s.status === 'graded' ? 'teacher' : 'ai';
        }
      } else {
        if (typeof s.score === 'number' && s.score > 0) {
          finalBand = s.score;
          source = s.status === 'graded' ? 'teacher' : 'ai';
        }
      }

      return {
        id: s.id,
        assignmentId: s.assignmentId,
        title: s.assignmentTitle || 'Assignment',
        skill: s.skill,
        submittedAt: s.submittedAt || '',
        status: s.status,
        score: finalBand,
        scoreSource: source,
        readingCorrect: s.readingScore?.correct,
        readingTotal: s.readingScore?.total,
        criteriaScores: s.rubricScores?.map((r) => ({ criterion: r.criterion, score: r.score })),
        comments: s.teacherComments || s.strengths || s.areasToImprove || undefined,
      };
    });
  }, [activeReport, submissions]);

  // If a report is selected, show detail/print view
  if (activeReport) {
    const isApproved = activeReport.state === 'approved' || activeReport.state === 'published';
    const isPublished = activeReport.state === 'published';

    const readingAssignments = activeCompletedAssignments.filter((a) => a.skill === 'reading');
    const writingAssignments = activeCompletedAssignments.filter((a) => a.skill === 'writing');
    const speakingAssignments = activeCompletedAssignments.filter((a) => a.skill === 'speaking');

    const validReadingScores = readingAssignments.map((a) => a.score).filter((s): s is number => typeof s === 'number');
    const validWritingScores = writingAssignments.map((a) => a.score).filter((s): s is number => typeof s === 'number');
    const validSpeakingScores = speakingAssignments.map((a) => a.score).filter((s): s is number => typeof s === 'number');

    const avgReading = validReadingScores.length > 0
      ? Math.round((validReadingScores.reduce((a, b) => a + b, 0) / validReadingScores.length) * 2) / 2
      : activeReport.learningEvidence?.skillBreakdown?.readingBand;

    const avgWriting = validWritingScores.length > 0
      ? Math.round((validWritingScores.reduce((a, b) => a + b, 0) / validWritingScores.length) * 2) / 2
      : activeReport.learningEvidence?.skillBreakdown?.writingBand;

    const avgSpeaking = validSpeakingScores.length > 0
      ? Math.round((validSpeakingScores.reduce((a, b) => a + b, 0) / validSpeakingScores.length) * 2) / 2
      : activeReport.learningEvidence?.skillBreakdown?.speakingBand;

    const availableBands = [avgReading, avgWriting, avgSpeaking].filter((b): b is number => typeof b === 'number');
    const overallEstimatedBand = availableBands.length > 0
      ? Math.round((availableBands.reduce((a, b) => a + b, 0) / availableBands.length) * 2) / 2
      : activeReport.learningEvidence?.skillBreakdown?.overallEstimatedBand;

    return (
      <div className="space-y-6 max-w-7xl mx-auto w-full">
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
              <span>{t('assessments.exportStudentPdf')} (Khổ ngang)</span>
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

        {/* PRINTABLE REPORT CARD (LANDSCAPE FORMAT) */}
        <div className="print-page bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-10 space-y-7">
          {/* Section 1: Landscape Header Profile */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 rounded-2xl shadow-md border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] tracking-widest font-black uppercase text-blue-400 block">
                  IELTS ACADEMIC PERIODICAL ASSESSMENT REPORT — BÁO CÁO ĐÁNH GIÁ ĐỊNH KỲ
                </span>
                <h2 className="text-2xl font-black text-white mt-0.5 tracking-tight">{activeReport.month}</h2>
              </div>
              <div className="flex items-center space-x-2">
                <span
                  className={`text-xs uppercase font-extrabold px-3 py-1 rounded-full ${
                    isPublished
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : isApproved
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {isPublished ? 'Official Published' : activeReport.state.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Profile Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-1">
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">{t('assessments.studentLabel')}</span>
                <span className="font-bold text-white text-sm block mt-0.5">{activeReport.studentName}</span>
                {activeReport.studentEmail && (
                  <span className="text-slate-400 text-[11px] block">{activeReport.studentEmail}</span>
                )}
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">{t('assessments.courseLabel')}</span>
                <span className="font-bold text-white text-sm block mt-0.5">{activeReport.courseName}</span>
                <span className="text-slate-400 text-[11px] block">IELTS Academic Core</span>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">{t('assessments.targetLabel')}</span>
                <span className="font-black text-amber-300 text-sm block mt-0.5">{activeReport.targetBand || 'Band 7.0+'}</span>
                <span className="text-slate-400 text-[11px] block">Mục tiêu kỳ này</span>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Giáo viên phụ trách</span>
                <span className="font-bold text-white text-sm block mt-0.5">{activeReport.teacherName}</span>
                <span className="text-slate-400 text-[11px] block">Ngày lập: {activeReport.createdAt}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Skill Overview Cards (Landscape 4-Skill Strip + Overall Evaluated Band) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print-avoid-break">
            {/* Reading Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase flex items-center space-x-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>Reading</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-500">
                  {readingAssignments.length} bài
                </span>
              </div>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-2xl font-black text-slate-900">
                  {avgReading ? `Band ${avgReading.toFixed(1)}` : 'Chưa có'}
                </span>
                {avgReading && <span className="text-[10px] text-emerald-600 font-bold">Trung bình</span>}
              </div>
              <p className="text-[11px] text-slate-600 line-clamp-1">
                {activeReport.learningEvidence.readingAccuracy || 'Chưa ghi nhận bài Reading'}
              </p>
            </div>

            {/* Writing Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase flex items-center space-x-1.5">
                  <PenTool className="w-4 h-4 text-amber-600" />
                  <span>Writing</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-500">
                  {writingAssignments.length} bài luận
                </span>
              </div>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-2xl font-black text-slate-900">
                  {avgWriting ? `Band ${avgWriting.toFixed(1)}` : (writingAssignments.length > 0 ? 'Đã nộp' : 'Chưa có')}
                </span>
                {avgWriting && <span className="text-[10px] text-amber-600 font-bold">Trung bình</span>}
              </div>
              <p className="text-[11px] text-slate-600 line-clamp-1">
                {writingAssignments.length > 0
                  ? activeReport.learningEvidence.writingLastFeedback || `${writingAssignments.length} bài đã nộp`
                  : 'Chưa có bài luận nộp'}
              </p>
            </div>

            {/* Speaking Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase flex items-center space-x-1.5">
                  <Mic className="w-4 h-4 text-purple-600" />
                  <span>Speaking</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-500">
                  {speakingAssignments.length} bài ghi âm
                </span>
              </div>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-2xl font-black text-slate-900">
                  {avgSpeaking ? `Band ${avgSpeaking.toFixed(1)}` : (speakingAssignments.length > 0 ? 'Đã nộp' : 'Chưa có')}
                </span>
                {avgSpeaking && <span className="text-[10px] text-purple-600 font-bold">Trung bình</span>}
              </div>
              <p className="text-[11px] text-slate-600 line-clamp-1">
                {activeReport.learningEvidence.speakingAudioAvailable ? 'Có file ghi âm' : 'Chưa có bản ghi âm'}
              </p>
            </div>

            {/* Overall Band Evaluated */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-900 uppercase flex items-center space-x-1.5">
                  <Award className="w-4 h-4 text-blue-600" />
                  <span>Overall Band</span>
                </span>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                  {activeReport.teacherEvaluation.estimatedBand ? 'GV xác nhận' : 'AI dự phóng'}
                </span>
              </div>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-2xl font-black text-blue-700">
                  {activeReport.teacherEvaluation.estimatedBand || (overallEstimatedBand ? `Band ${overallEstimatedBand.toFixed(1)}` : 'Chờ đánh giá')}
                </span>
              </div>
              <p className="text-[11px] text-blue-800 line-clamp-1 font-medium">
                {activeReport.teacherEvaluation.estimatedBand ? 'Điểm đánh giá chính thức' : 'Dựa trên kết quả bài làm thực tế'}
              </p>
            </div>
          </div>

          {/* Section 3: Per-Assignment Band Scores Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs print-avoid-break">
            <div className="bg-slate-100/90 px-6 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Chi tiết điểm Band từng bài tập đã hoàn thành (Individual Completed Assignment Scores)
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Tổng cộng {activeCompletedAssignments.length} bài nộp trong kỳ đánh giá
              </span>
            </div>

            {activeCompletedAssignments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Chưa có dữ liệu bài nộp nào trong kỳ này. Khi học viên hoàn thành bài tập, điểm band chi tiết sẽ tự động hiển thị tại đây.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4 min-w-[200px]">Tên bài tập</th>
                      <th className="py-3 px-4 w-28">Kỹ năng</th>
                      <th className="py-3 px-4 w-32">Ngày nộp</th>
                      <th className="py-3 px-4 w-28">Trạng thái</th>
                      <th className="py-3 px-4 w-32">Điểm Band</th>
                      <th className="py-3 px-4 w-36">Nguồn điểm</th>
                      <th className="py-3 px-4 min-w-[240px]">Nhận xét / Tiêu chí</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeCompletedAssignments.map((sub, idx) => {
                      const isGraded = sub.status === 'graded';
                      const isTeacherSource = sub.scoreSource === 'teacher';

                      return (
                        <tr key={sub.id || idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block leading-snug">{sub.title}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-block ${
                                sub.skill === 'reading'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : sub.skill === 'writing'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {sub.skill}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                            {sub.submittedAt || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                                sub.status === 'graded'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : sub.status === 'submitted'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {sub.status === 'graded' ? 'Đã chấm' : sub.status === 'submitted' ? 'Đã nộp' : sub.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {typeof sub.score === 'number' ? (
                              <div className="flex items-center space-x-1.5">
                                <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 font-black rounded text-xs">
                                  Band {sub.score.toFixed(1)}
                                </span>
                                {sub.readingCorrect !== undefined && sub.readingTotal !== undefined && (
                                  <span className="text-[10px] text-slate-400 font-semibold">
                                    ({sub.readingCorrect}/{sub.readingTotal})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Chờ chấm
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {typeof sub.score === 'number' ? (
                              isTeacherSource ? (
                                <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-700 font-bold bg-emerald-50/70 px-2 py-0.5 rounded border border-emerald-200">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>GV công bố</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 text-[11px] text-blue-700 font-semibold bg-blue-50/70 px-2 py-0.5 rounded border border-blue-200">
                                  <Sparkles className="w-3 h-3 text-blue-600 shrink-0" />
                                  <span>AI chấm</span>
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-[11px]">
                            {sub.criteriaScores && sub.criteriaScores.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-1">
                                {sub.criteriaScores.map((c, i) => (
                                  <span key={i} className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-mono text-[10px]">
                                    {c.criterion.substring(0, 2).toUpperCase()}: {c.score.toFixed(1)}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="line-clamp-2 leading-relaxed">
                              {sub.comments || 'Bài làm đã được ghi nhận vào hồ sơ định kỳ.'}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 4: Demonstrated Strengths & Focus Areas (Landscape 2-Column Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print-avoid-break">
            {/* Strengths */}
            <div className="bg-emerald-50/40 border border-emerald-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center space-x-2 pb-2 border-b border-emerald-200/80">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                  {t('assessments.demonstratedStrengths')}
                </h3>
              </div>
              <p className="text-slate-800 bg-white p-3.5 rounded-xl border border-emerald-100 whitespace-pre-line leading-relaxed text-xs">
                {activeReport.aiDraft.strengths || 'Thể hiện thái độ học tập tích cực và nộp bài đều đặn.'}
              </p>
            </div>

            {/* Focus Areas & Evidence Gaps */}
            <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center space-x-2 pb-2 border-b border-amber-200/80">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                  {t('assessments.focusAreas')} & Lỗ hổng kỹ năng
                </h3>
              </div>
              <p className="text-slate-800 bg-white p-3.5 rounded-xl border border-amber-100 whitespace-pre-line leading-relaxed text-xs">
                {activeReport.aiDraft.focusAreas}
              </p>
              {activeReport.learningEvidence.insufficientEvidenceSkills && activeReport.learningEvidence.insufficientEvidenceSkills.length > 0 && (
                <div className="p-2.5 bg-amber-100/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-medium">
                  <span className="font-bold block mb-0.5">Kỹ năng chưa đủ dữ liệu kiểm tra:</span>
                  <span>{activeReport.learningEvidence.insufficientEvidenceSkills.join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Teacher Professional Evaluation & Action Plan */}
          <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/40 border border-blue-200 rounded-2xl p-6 space-y-4 print-avoid-break">
            <div className="flex items-center justify-between pb-3 border-b border-blue-200">
              <div className="flex items-center space-x-2">
                <Award className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-black text-blue-950 uppercase tracking-wider">
                  Đánh giá chuyên môn & Kế hoạch hành động của Giáo viên
                </h3>
              </div>
              {activeReport.teacherEvaluation.estimatedBand && (
                <span className="text-xs font-black text-blue-800 bg-blue-100 px-3 py-1 rounded-full border border-blue-300">
                  {activeReport.teacherEvaluation.estimatedBand}
                </span>
              )}
            </div>

            {isTeacher && !isPublished ? (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    {t('assessments.profJudgement')}
                  </label>
                  <textarea
                    rows={3}
                    value={profJudgement}
                    onChange={(e) => setProfJudgement(e.target.value)}
                    placeholder={t('assessments.profJudgementDesc')}
                    className="w-full p-3 border border-slate-300 rounded-xl bg-white outline-hidden leading-relaxed text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">{t('assessments.nextPriorities')}</label>
                    <textarea
                      rows={2}
                      value={nextPriorities}
                      onChange={(e) => setNextPriorities(e.target.value)}
                      placeholder={t('assessments.nextPrioritiesDesc')}
                      className="w-full p-3 border border-slate-300 rounded-xl bg-white outline-hidden leading-relaxed text-xs focus:ring-2 focus:ring-blue-500"
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
                      placeholder="e.g. Band 7.0 (R: 7.5, W: 7.0, S: 6.5)"
                      className="w-full p-3 border border-slate-300 rounded-xl bg-white outline-hidden text-xs focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveEvaluation}
                      className="mt-3 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                    >
                      {t('assessments.saveEvaluation')}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                <div>
                  <span className="font-bold text-blue-950 block mb-1 uppercase text-[10px] tracking-wider">
                    {t('assessments.profJudgement')}
                  </span>
                  <p className="text-slate-800 bg-white p-3.5 rounded-xl border border-blue-100 leading-relaxed min-h-[70px]">
                    {activeReport.teacherEvaluation.professionalJudgement || 'Chờ nhận xét chính thức từ giáo viên.'}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-blue-950 block mb-1 uppercase text-[10px] tracking-wider">
                    {t('assessments.nextPriorities')}
                  </span>
                  <p className="text-slate-800 bg-white p-3.5 rounded-xl border border-blue-100 whitespace-pre-line leading-relaxed min-h-[70px]">
                    {activeReport.teacherEvaluation.nextMonthPriorities || 'Tiếp tục luyện tập theo kế hoạch giảng dạy.'}
                  </p>
                </div>
              </div>
            )}

            {/* Signature sign-off line */}
            <div className="pt-3 border-t border-blue-200/60 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-600 gap-2">
              <span className="font-medium">
                Xác nhận bởi Giáo viên phụ trách: <span className="font-bold text-slate-900">{activeReport.teacherName}</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Phiên bản đánh giá chính thức · Ngày: {activeReport.publishedAt || activeReport.createdAt}
              </span>
            </div>
          </div>

          {/* Section 6: Traceable Audit & Revision History */}
          <div className="pt-3 border-t border-slate-200 print-avoid-break">
            <h4 className="text-xs font-bold text-slate-700 flex items-center space-x-1.5 mb-2">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('assessments.historyTitle')} (Audit Trail)</span>
            </h4>
            <div className="space-y-1 text-[11px] text-slate-500">
              {activeReport.history.map((h, i) => (
                <div key={i} className="flex items-center justify-between py-0.5">
                  <span>
                    v{h.version}: {h.action} ({h.actor})
                  </span>
                  <span className="font-mono">{h.timestamp}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Disclaimer */}
          <div className="text-[10px] text-slate-400 text-center pt-1 print-avoid-break">
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
