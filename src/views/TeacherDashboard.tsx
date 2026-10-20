import React from 'react';
import { useApp } from '../context/AppContext';
import {
  BookOpen,
  Users,
  Clock,
  ArrowRight,
  AlertCircle,
  FileCheck2,
  Award,
  WalletCards,
  Sparkles,
  ChevronRight,
  PlusCircle,
  TrendingUp,
} from 'lucide-react';

export const TeacherDashboard: React.FC = () => {
  const {
    currentUser,
    courses,
    courseMembers,
    enrollmentRequests,
    submissions,
    monthlyReports,
    tuitionStatements,
    activities,
    setActiveTab,
    setSelectedCourseId,
    setSelectedStatementId,
    setSelectedReportId,
  } = useApp();

  // Scoped to current teacher
  const myCourses = courses.filter((c) => c.teacherId === currentUser.id && c.status === 'active');
  const myCourseIds = myCourses.map((c) => c.id);

  // Active enrolled students under this teacher
  const myStudents = courseMembers.filter(
    (m) => myCourseIds.includes(m.courseId) && m.status === 'enrolled'
  );
  // Distinct student IDs
  const distinctStudentIds = Array.from(new Set(myStudents.map((m) => m.studentId)));

  // Submissions to review
  const pendingSubmissions = submissions.filter(
    (s) => myCourseIds.includes(s.courseId) && (s.status === 'submitted' || s.status === 'resubmitted')
  );

  // Pending enrollment requests
  const pendingRequests = enrollmentRequests.filter(
    (r) => myCourseIds.includes(r.courseId) && r.status === 'pending'
  );

  // Monthly reports awaiting approval
  const pendingReports = monthlyReports.filter(
    (r) => r.teacherId === currentUser.id && (r.state === 'ai_generated' || r.state === 'in_review')
  );

  // Statements requiring action (pending approval or overdue)
  const pendingStatements = tuitionStatements.filter(
    (s) => s.teacherId === currentUser.id && s.status === 'pending_approval'
  );

  const totalToReview = pendingSubmissions.length + pendingRequests.length + pendingReports.length;

  return (
    <div className="space-y-6">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Teacher Dashboard</h1>
          <p className="text-sm text-slate-500">Your teaching workspace at a glance</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setActiveTab('ai_assistant')}
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>AI Teaching Assistant</span>
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Course</span>
          </button>
        </div>
      </div>

      {/* Summary Cards matching Page 1 & 2 design: Active Courses (4), Students (38), To review (7) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active Courses */}
        <div
          onClick={() => setActiveTab('courses')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Active courses</span>
            <BookOpen className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">{myCourses.length}</div>
          <p className="text-xs text-slate-400 mt-1 flex items-center space-x-1">
            <span>{courses.filter((c) => c.teacherId === currentUser.id && c.status === 'archived').length} archived</span>
          </p>
        </div>

        {/* Enrolled Students */}
        <div
          onClick={() => setActiveTab('courses')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Students</span>
            <Users className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">{distinctStudentIds.length}</div>
          <p className="text-xs text-slate-400 mt-1">Across all your active courses</p>
        </div>

        {/* Items to Review */}
        <div
          onClick={() => setActiveTab('assignments')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">
            <span>To review</span>
            <Clock className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900">{totalToReview}</div>
          <p className="text-xs text-amber-600 font-medium mt-1 flex items-center space-x-1">
            <span>{pendingSubmissions.length} submissions · {pendingRequests.length} requests</span>
          </p>
        </div>
      </div>

      {/* Main Grid: Pending Tasks vs Recent Activity (matching Page 1 mockup) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Tasks Panel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <span>Pending tasks</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">Action required</span>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {/* Submissions */}
            {pendingSubmissions.length > 0 ? (
              pendingSubmissions.slice(0, 3).map((sub) => (
                <div
                  key={sub.id}
                  onClick={() => setActiveTab('assignments')}
                  className="py-3.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-start space-x-3">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        Review {sub.skill.toUpperCase()}: {sub.assignmentTitle}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {sub.studentName} ({sub.courseName})
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 shrink-0">
                    Awaiting review
                  </span>
                </div>
              ))
            ) : null}

            {/* Monthly Report approval */}
            {pendingReports.length > 0 && (
              <div
                onClick={() => setActiveTab('assessments')}
                className="py-3.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Approve monthly reports</p>
                    <p className="text-[11px] text-slate-500">
                      {pendingReports[0].studentName} — {pendingReports[0].month}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 shrink-0">
                  {pendingReports.length} waiting
                </span>
              </div>
            )}

            {/* Enrollment Requests */}
            {pendingRequests.length > 0 && (
              <div
                onClick={() => setActiveTab('courses')}
                className="py-3.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Enrollment requests</p>
                    <p className="text-[11px] text-slate-500">
                      {pendingRequests[0].studentName} requested {pendingRequests[0].courseName}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
                  {pendingRequests.length} new
                </span>
              </div>
            )}

            {/* Tuition Pending Approval */}
            {pendingStatements.length > 0 && (
              <div
                onClick={() => setActiveTab('tuition')}
                className="py-3.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Tuition statements awaiting review</p>
                    <p className="text-[11px] text-slate-500">
                      {pendingStatements[0].statementNumber} ({pendingStatements[0].studentName})
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 shrink-0">
                  {pendingStatements.length} draft
                </span>
              </div>
            )}

            {pendingSubmissions.length === 0 &&
              pendingReports.length === 0 &&
              pendingRequests.length === 0 &&
              pendingStatements.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  All caught up! No pending tasks right now.
                </div>
              )}
          </div>
        </div>

        {/* Recent Activity Panel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span>Recent activity</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">Logged updates</span>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {activities.slice(0, 5).map((act) => (
              <div
                key={act.id}
                onClick={() => act.targetTab && setActiveTab(act.targetTab)}
                className="py-3.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="pr-4">
                  <p className="text-xs font-medium text-slate-800">{act.text}</p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{act.timeAgo}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Operations Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-xl p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold tracking-tight">Monthly Operations & Audits</h3>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Prepare evidence-based monthly student assessments and transparent tuition statements. AI outputs are drafts until you review, edit, and approve them.
          </p>
        </div>
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => setActiveTab('assessments')}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Manage Reports
          </button>
          <button
            onClick={() => setActiveTab('tuition')}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors border border-white/20"
          >
            Review Statements
          </button>
        </div>
      </div>
    </div>
  );
};
