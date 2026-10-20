import React from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import {
  BookOpen,
  Clock,
  ArrowRight,
  Award,
  WalletCards,
  CheckCircle,
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const {
    currentUser,
    courses,
    courseMembers,
    assignments,
    submissions,
    monthlyReports,
    tuitionStatements,
    setActiveTab,
    setSelectedCourseId,
    setSelectedStatementId,
    setSelectedReportId,
  } = useApp();
  const { t, formatCurrency, formatNumber } = useI18n();

  if (!currentUser) return null;

  // Enrolled courses for this student
  const myMemberships = courseMembers.filter(
    (m) => m.studentId === currentUser.id && m.status === 'enrolled'
  );
  const myEnrolledCourseIds = myMemberships.map((m) => m.courseId);
  const myCourses = courses.filter((c) => myEnrolledCourseIds.includes(c.id));

  // Assignments for enrolled courses that are published
  const availableAssignments = assignments.filter(
    (a) => myEnrolledCourseIds.includes(a.courseId) && a.status === 'published'
  );

  // Submissions made by this student
  const mySubmissions = submissions.filter((s) => s.studentId === currentUser.id);

  // Assignments requiring action: not submitted or returned for revision
  const actionRequiredAssignments = availableAssignments.filter((a) => {
    const sub = mySubmissions.find((s) => s.assignmentId === a.id);
    return !sub || sub.status === 'returned';
  });

  // Latest published report
  const myPublishedReports = monthlyReports.filter(
    (r) => r.studentId === currentUser.id && r.state === 'published'
  );
  const latestReport = myPublishedReports.length > 0 ? myPublishedReports[0] : null;

  // Tuition balance
  const myStatements = tuitionStatements.filter(
    (s) => s.studentId === currentUser.id && (s.status === 'approved' || s.status === 'paid' || s.status === 'partially_paid')
  );
  const totalTuitionBalance = myStatements.reduce((acc, curr) => acc + curr.remainingBalance, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t('dashboard.studentTitle')}
          </h1>
          <p className="text-sm text-slate-500">
            {t('dashboard.studentSubtitle')}
          </p>
        </div>
        <button
          onClick={() => setActiveTab('find_course')}
          className="inline-flex items-center space-x-2 px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          <span>{t('nav.findCourse')}</span>
        </button>
      </div>

      {/* Top Cards: Enrolled courses, Assignments due, Monthly Reports, Tuition balance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active courses */}
        <div
          onClick={() => setActiveTab('courses')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <span>{t('dashboard.enrolledCourses')}</span>
            <BookOpen className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">
            {formatNumber(myCourses.length)}
          </div>
          <p className="text-xs text-slate-400 mt-1">{t('dashboard.acrossTeachers')}</p>
        </div>

        {/* Action Required */}
        <div
          onClick={() => setActiveTab('assignments')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <span>{t('dashboard.assignmentsToDo')}</span>
            <Clock className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">
            {formatNumber(actionRequiredAssignments.length)}
          </div>
          <p className="text-xs text-amber-600 font-medium mt-1">{t('dashboard.dueSoon')}</p>
        </div>

        {/* Latest Report */}
        <div
          onClick={() => setActiveTab('assessments')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <span>{t('nav.monthlyReports')}</span>
            <Award className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 truncate">
            {latestReport ? latestReport.month : t('status.unpaid')}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {latestReport ? `${latestReport.teacherEvaluation?.estimatedBand || t('status.approved')}` : t('dashboard.noReportsYet')}
          </p>
        </div>

        {/* Tuition Balance */}
        <div
          onClick={() => setActiveTab('tuition')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <span>{t('dashboard.tuitionBalance')}</span>
            <WalletCards className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {totalTuitionBalance === 0 ? t('status.paid') : formatCurrency(totalTuitionBalance, myStatements[0]?.currency || 'VND')}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {formatNumber(myStatements.filter((s) => s.remainingBalance > 0).length)} {t('dashboard.tuitionPending')}
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: My Active Courses & Next Steps */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Courses List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">{t('courses.titleStudent')}</h2>
              <button
                onClick={() => setActiveTab('courses')}
                className="text-xs text-blue-600 font-semibold hover:underline flex items-center space-x-1"
              >
                <span>{t('common.viewAll')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {myCourses.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">{t('dashboard.noCoursesEnrolled')}</p>
                <p className="text-xs text-slate-400 mt-1">{t('dashboard.noCoursesPrompt')}</p>
                <button
                  onClick={() => setActiveTab('find_course')}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('dashboard.enterCourseCode')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {myCourses.map((course) => (
                  <div
                    key={course.id}
                    onClick={() => {
                      setSelectedCourseId(course.id);
                      setActiveTab('courses');
                    }}
                    className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {course.teacherName}
                      </span>
                      <span className="uppercase text-[10px] font-bold text-slate-400">{course.code}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm mb-1">{course.name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                      {course.description}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-200/60">
                      <span>{t('courses.tuitionModel')}: {course.tuitionModel.replace('_', ' ')}</span>
                      <span className="font-semibold text-blue-600">{t('common.enter')} &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assignments Requiring Action */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>{t('dashboard.upcomingDeadlines')}</span>
              </h2>
              <span className="text-xs text-slate-400">{formatNumber(actionRequiredAssignments.length)} {t('status.pending')}</span>
            </div>

            {actionRequiredAssignments.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-1.5" />
                {t('dashboard.allCaughtUpStudent')}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {actionRequiredAssignments.map((a) => {
                  const existingSub = mySubmissions.find((s) => s.assignmentId === a.id);
                  const isRevision = existingSub?.status === 'returned';
                  return (
                    <div
                      key={a.id}
                      onClick={() => setActiveTab('assignments')}
                      className="py-3.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                              a.skill === 'reading'
                                ? 'bg-emerald-100 text-emerald-800'
                                : a.skill === 'writing'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {a.skill}
                          </span>
                          <span className="text-xs font-semibold text-slate-900">{a.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{t('courses.startDate')}: {a.dueDate}</p>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {isRevision ? (
                          <span className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                            {t('status.returned')}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                            {t('common.submit')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Latest Monthly Report & Quick Tuition */}
        <div className="space-y-6">
          {/* Latest Monthly Report Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                <Award className="w-4 h-4 text-indigo-600" />
                <span>{t('dashboard.latestMonthlyReport')}</span>
              </h2>
            </div>

            {latestReport ? (
              <div className="space-y-3">
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900">{latestReport.month}</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {t('status.approved')}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-700 mt-1">{latestReport.courseName}</p>
                  <div className="mt-2 text-xs font-semibold text-slate-800">
                    {latestReport.teacherEvaluation?.estimatedBand}
                  </div>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-700">{t('assessments.profJudgement')}:</p>
                  <p className="text-slate-500 text-[11px] line-clamp-3 leading-relaxed">
                    {latestReport.teacherEvaluation?.professionalJudgement}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSelectedReportId(latestReport.id);
                    setActiveTab('assessments');
                  }}
                  className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <span>{t('dashboard.viewReportPdf')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                {t('dashboard.noReportsYet')}
              </div>
            )}
          </div>

          {/* Tuition summary card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                <WalletCards className="w-4 h-4 text-emerald-600" />
                <span>{t('dashboard.tuitionSummary')}</span>
              </h2>
            </div>

            {myStatements.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{t('tuition.statementNoLabel')}:</span>
                  <span className="font-bold text-slate-800">{myStatements[0].statementNumber}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{t('tuition.billingPeriodLabel')}:</span>
                  <span className="font-medium text-slate-700">{myStatements[0].billingPeriod}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-500">{t('tuition.totalAmountDueLabel')}:</span>
                  <span className="font-bold text-base text-slate-900">
                    {formatCurrency(myStatements[0].remainingBalance, myStatements[0].currency)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSelectedStatementId(myStatements[0].id);
                    setActiveTab('tuition');
                  }}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <span>{t('dashboard.viewAndPay')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                {t('dashboard.noActiveTuition')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
