import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import { CourseSkill, TuitionModel } from '../types';
import {
  BookOpen,
  Plus,
  Users,
  Copy,
  RefreshCw,
  Check,
  X,
  Archive,
  ChevronRight,
  Layers,
  FileCheck2,
  Award,
  WalletCards,
  Settings,
  UserX,
  Clock,
} from 'lucide-react';

export const CoursesView: React.FC = () => {
  const {
    currentUser,
    courses,
    createCourse,
    regenerateCourseCode,
    archiveCourse,
    enrollmentRequests,
    reviewEnrollmentRequest,
    courseMembers,
    removeStudentFromCourse,
    selectedCourseId,
    setSelectedCourseId,
    setActiveTab,
  } = useApp();
  const { t, formatCurrency, formatNumber } = useI18n();

  if (!currentUser) return null;
  const isTeacher = currentUser.role === 'teacher';

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeCourseTab, setActiveCourseTab] = useState<
    'overview' | 'students' | 'lessons' | 'assignments' | 'assessments' | 'tuition' | 'settings'
  >('overview');
  const [copiedCode, setCopiedCode] = useState(false);
  const [rejectModalReqId, setRejectModalReqId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [creating, setCreating] = useState(false);

  // New course form
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCourseSkills, setNewCourseSkills] = useState<CourseSkill[]>(['reading', 'writing']);
  const [newTuitionModel, setNewTuitionModel] = useState<TuitionModel>('fixed_monthly');
  const [newTuitionAmount, setNewTuitionAmount] = useState(4000000);
  const [newCurrency, setNewCurrency] = useState<'VND' | 'USD'>('VND');
  const [newStartDate, setNewStartDate] = useState('2026-11-01');
  const [newEndDate, setNewEndDate] = useState('2027-04-30');

  // Teacher sees only their own courses
  const myCourses = isTeacher
    ? courses.filter((c) => c.teacherId === currentUser.id)
    : courses.filter((c) =>
        courseMembers.some(
          (m) => m.courseId === c.id && m.studentId === currentUser.id && m.status === 'enrolled'
        )
      );

  const filteredCourses = isTeacher
    ? statusFilter === 'all'
      ? myCourses
      : myCourses.filter((c) => c.status === statusFilter)
    : myCourses;

  const currentCourse = selectedCourseId ? courses.find((c) => c.id === selectedCourseId) : null;

  // Requests for this teacher's courses
  const teacherCourseIds = courses.filter((c) => c.teacherId === currentUser.id).map((c) => c.id);
  const relevantRequests = enrollmentRequests.filter((r) =>
    teacherCourseIds.includes(r.courseId)
  );
  const pendingRequests = relevantRequests.filter((r) => r.status === 'pending');

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim() || creating) return;

    setCreating(true);
    try {
      const created = await createCourse({
        name: newCourseName.trim(),
        description: newCourseDesc.trim(),
        skills: newCourseSkills,
        status: 'active',
        code: '',
        startDate: newStartDate,
        endDate: newEndDate,
        tuitionModel: newTuitionModel,
        tuitionAmount: Number(newTuitionAmount),
        currency: newCurrency,
      });

      setShowCreateModal(false);
      setSelectedCourseId(created.id);
      setNewCourseName('');
      setNewCourseDesc('');
    } catch (err: any) {
      alert(err.message || 'Error creating course');
    } finally {
      setCreating(false);
    }
  };

  const toggleSkill = (skill: CourseSkill) => {
    setNewCourseSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // If a specific course is selected, show detail view with tabs
  if (currentCourse) {
    const courseStudents = courseMembers.filter((m) => m.courseId === currentCourse.id);
    const courseRequests = enrollmentRequests.filter((r) => r.courseId === currentCourse.id);

    return (
      <div className="space-y-6">
        {/* Breadcrumb & Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <button
              onClick={() => setSelectedCourseId(null)}
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center space-x-1 mb-1.5"
            >
              <span>&larr; {t('courses.backToCourses')}</span>
            </button>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-slate-900">{currentCourse.name}</h1>
              <span
                className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                  currentCourse.status === 'active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {t(`status.${currentCourse.status}`)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{t('tuition.teacherLabel')}: {currentCourse.teacherName}</p>
          </div>

          {/* Course Code box for sharing */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center space-x-3 shadow-xs">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">
                {t('courses.discoveryCode')}
              </div>
              <div className="text-sm font-mono font-bold text-blue-700 tracking-wider">
                {currentCourse.code}
              </div>
            </div>
            <button
              onClick={() => handleCopyCode(currentCourse.code)}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              title={t('courses.copyCodeTitle')}
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
            {isTeacher && (
              <button
                onClick={async () => {
                  if (confirm(t('courses.regenerateWarning'))) {
                    await regenerateCourseCode(currentCourse.id);
                  }
                }}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                title={t('courses.regenerateCodeTitle')}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 flex space-x-2 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'overview', label: t('courses.tabs.overview'), icon: BookOpen },
            { id: 'students', label: `${t('courses.tabs.students')} (${formatNumber(courseStudents.filter(s => s.status === 'enrolled').length)})`, icon: Users },
            { id: 'lessons', label: t('courses.tabs.lessons'), icon: Layers },
            { id: 'assignments', label: t('courses.tabs.assignments'), icon: FileCheck2 },
            { id: 'assessments', label: t('courses.tabs.assessments'), icon: Award },
            { id: 'tuition', label: t('courses.tabs.tuition'), icon: WalletCards },
            ...(isTeacher ? [{ id: 'settings', label: t('courses.tabs.settings'), icon: Settings }] : []),
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCourseTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCourseTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 px-4 border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Overview */}
        {activeCourseTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900">{t('courses.aboutCourse')}</h2>
              <p className="text-xs text-slate-600 leading-relaxed">{currentCourse.description}</p>

              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {t('courses.targetSkills')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {currentCourse.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 capitalize"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">{t('courses.startDate')}</span>
                  <span className="font-semibold text-slate-800">{currentCourse.startDate || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">{t('courses.endDate')}</span>
                  <span className="font-semibold text-slate-800">{currentCourse.endDate || '—'}</span>
                </div>
              </div>
            </div>

            {/* Tuition Model Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <WalletCards className="w-4 h-4 text-emerald-600" />
                <span>{t('courses.tuitionModel')}</span>
              </h3>
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div className="text-xs font-semibold text-slate-700 capitalize">
                  {currentCourse.tuitionModel.replace('_', ' ')}
                </div>
                <div className="text-xl font-extrabold text-slate-900 mt-1">
                  {formatCurrency(currentCourse.tuitionAmount, currentCourse.currency)}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setActiveCourseTab('tuition')}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  {t('courses.manageTuitionLink')} &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Students (Roster) */}
        {activeCourseTab === 'students' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">{t('courses.rosterTitle')}</h2>
                <p className="text-xs text-slate-500">
                  {t('courses.rosterDesc')}
                </p>
              </div>
            </div>

            {/* Pending Requests */}
            {isTeacher && courseRequests.filter((r) => r.status === 'pending').length > 0 && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>
                    {t('courses.pendingRequests')} ({formatNumber(courseRequests.filter((r) => r.status === 'pending').length)})
                  </span>
                </h3>
                <div className="divide-y divide-amber-200/60">
                  {courseRequests
                    .filter((r) => r.status === 'pending')
                    .map((req) => (
                      <div key={req.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{req.studentName}</p>
                          <p className="text-[11px] text-slate-500">
                            {req.studentEmail} · {t('findCourse.requestedOn')}: {req.requestedAt}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => reviewEnrollmentRequest(req.id, 'approved')}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors flex items-center space-x-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{t('courses.approve')}</span>
                          </button>
                          <button
                            onClick={() => {
                              setRejectModalReqId(req.id);
                              setRejectReason('');
                            }}
                            className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-md border border-red-200 transition-colors flex items-center space-x-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>{t('courses.reject')}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Enrolled Students Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">{t('courses.tableStudent')}</th>
                    <th className="py-3 px-4">{t('courses.tableStatus')}</th>
                    <th className="py-3 px-4">{t('courses.tableJoinDate')}</th>
                    <th className="py-3 px-4">{t('courses.tableRecentActivity')}</th>
                    <th className="py-3 px-4">{t('courses.tableOutstanding')}</th>
                    {isTeacher && <th className="py-3 px-4 text-right">{t('common.actions')}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {courseStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        {t('courses.noStudentsYet')}
                      </td>
                    </tr>
                  ) : (
                    courseStudents.map((member) => (
                      <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{member.studentName}</p>
                          <p className="text-[11px] text-slate-400">{member.studentEmail}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              member.status === 'enrolled'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {t(`status.${member.status === 'enrolled' ? 'approved' : 'removed'}`)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{member.joinedAt}</td>
                        <td className="py-3 px-4 text-slate-600">{member.recentActivity}</td>
                        <td className="py-3 px-4">
                          {member.outstandingWork > 0 ? (
                            <span className="text-amber-600 font-bold">{member.outstandingWork} tasks</span>
                          ) : (
                            <span className="text-slate-400">{t('dashboard.allCaughtUpStudent')}</span>
                          )}
                        </td>
                        {isTeacher && (
                          <td className="py-3 px-4 text-right">
                            {member.status === 'enrolled' ? (
                              <button
                                onClick={() => {
                                  if (confirm(t('courses.removeStudentConfirm', { name: member.studentName }))) {
                                    removeStudentFromCourse(currentCourse.id, member.studentId);
                                  }
                                }}
                                className="text-red-600 hover:text-red-800 font-semibold text-xs flex items-center space-x-1 ml-auto"
                                title={t('courses.removeStudent')}
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>{t('courses.removeStudent')}</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">{t('courses.historicalRecord')}</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Previously Rejected Requests */}
            {isTeacher && courseRequests.filter((r) => r.status === 'rejected').length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  {t('courses.previouslyRejected')}
                </h3>
                <div className="divide-y divide-slate-200 text-xs">
                  {courseRequests
                    .filter((r) => r.status === 'rejected')
                    .map((rej) => (
                      <div key={rej.id} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800">{rej.studentName}</span>
                          <span className="text-slate-400 ml-2">({rej.studentEmail})</span>
                          {rej.rejectionReason && (
                            <p className="text-[11px] text-slate-500 mt-0.5">{t('courses.reasonNote')}: {rej.rejectionReason}</p>
                          )}
                        </div>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-red-100 text-red-700 rounded">
                          {t('status.rejected')}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Lessons */}
        {activeCourseTab === 'lessons' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs text-center">
            <h2 className="text-base font-bold text-slate-900 mb-2">{t('courses.tabs.lessons')}</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              {t('courses.lessonsHubDesc')}
            </p>
            <button
              onClick={() => setActiveTab('resources')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              {t('courses.openResources')} &rarr;
            </button>
          </div>
        )}

        {/* Tab 4: Assignments */}
        {activeCourseTab === 'assignments' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs text-center">
            <h2 className="text-base font-bold text-slate-900 mb-2">{t('courses.tabs.assignments')}</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              {t('courses.assignmentsHubDesc')}
            </p>
            <button
              onClick={() => setActiveTab('assignments')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              {t('courses.openAssignments')} &rarr;
            </button>
          </div>
        )}

        {/* Tab 5: Assessments */}
        {activeCourseTab === 'assessments' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs text-center">
            <h2 className="text-base font-bold text-slate-900 mb-2">{t('courses.tabs.assessments')}</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              {t('courses.assessmentsHubDesc')}
            </p>
            <button
              onClick={() => setActiveTab('assessments')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              {t('courses.openAssessments')} &rarr;
            </button>
          </div>
        )}

        {/* Tab 6: Tuition */}
        {activeCourseTab === 'tuition' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs text-center">
            <h2 className="text-base font-bold text-slate-900 mb-2">{t('courses.tabs.tuition')}</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              {t('courses.tuitionHubDesc')}
            </p>
            <button
              onClick={() => setActiveTab('tuition')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              {t('courses.openTuition')} &rarr;
            </button>
          </div>
        )}

        {/* Tab 7: Settings */}
        {activeCourseTab === 'settings' && isTeacher && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-slate-900">{t('courses.courseAdmin')}</h2>

            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-800">{t('courses.regenerateHeading')}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {t('courses.regenerateDesc', { code: currentCourse.code })}
              </p>
              <button
                onClick={async () => {
                  if (confirm(t('courses.regenerateWarning'))) {
                    await regenerateCourseCode(currentCourse.id);
                  }
                }}
                className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-black text-white text-xs font-semibold rounded-md shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t('courses.generateNewCodeBtn')}</span>
              </button>
            </div>

            <div className="border border-amber-200 bg-amber-50/40 rounded-lg p-4">
              <h3 className="text-xs font-bold text-amber-900">{t('courses.archiveHeading')}</h3>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                {t('courses.archiveDesc')}
              </p>
              {currentCourse.status === 'active' ? (
                <button
                  onClick={async () => {
                    if (confirm(t('courses.archiveConfirm'))) {
                      await archiveCourse(currentCourse.id);
                    }
                  }}
                  className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors flex items-center space-x-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{t('courses.archiveBtn')}</span>
                </button>
              ) : (
                <p className="mt-2 text-xs font-semibold text-slate-600">{t('courses.alreadyArchived')}</p>
              )}
            </div>
          </div>
        )}

        {/* Modal for Reject Reason */}
        {rejectModalReqId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 mb-2">{t('courses.rejectModalTitle')}</h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                {t('courses.rejectModalDesc')}
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason..."
                rows={3}
                className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setRejectModalReqId(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={async () => {
                    await reviewEnrollmentRequest(rejectModalReqId, 'rejected', rejectReason);
                    setRejectModalReqId(null);
                  }}
                  className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  {t('courses.confirmRejection')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Course Listing View
  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isTeacher ? t('courses.titleTeacher') : t('courses.titleStudent')}
          </h1>
          <p className="text-sm text-slate-500">
            {isTeacher ? t('courses.descTeacher') : t('courses.descStudent')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {isTeacher && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center space-x-2 px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('courses.createBtn')}</span>
            </button>
          )}
          {!isTeacher && (
            <button
              onClick={() => setActiveTab('find_course')}
              className="inline-flex items-center space-x-2 px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span>{t('courses.joinBtn')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs for Teacher */}
      {isTeacher && (
        <div className="flex items-center justify-between">
          <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            {(['active', 'archived', 'all'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-md font-medium capitalize transition-all ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t(`status.${status}`)} ({formatNumber(courses.filter((c) => c.teacherId === currentUser.id && (status === 'all' || c.status === status)).length)})
              </button>
            ))}
          </div>

          {pendingRequests.length > 0 && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              {formatNumber(pendingRequests.length)} {t('courses.pendingRequests')}
            </span>
          )}
        </div>
      )}

      {/* Course Cards Grid */}
      {filteredCourses.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">{t('courses.noCoursesFound')}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {isTeacher ? t('courses.noCoursesTeacherDesc') : t('courses.noCoursesStudentDesc')}
          </p>
          {isTeacher ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('courses.createFirstCourse')}
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('find_course')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('dashboard.enterCourseCode')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const enrolledCount = courseMembers.filter(
              (m) => m.courseId === course.id && m.status === 'enrolled'
            ).length;
            const coursePendingReqs = enrollmentRequests.filter(
              (r) => r.courseId === course.id && r.status === 'pending'
            ).length;

            return (
              <div
                key={course.id}
                onClick={() => setSelectedCourseId(course.id)}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col overflow-hidden group"
              >
                <div className="p-5 pb-3">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {t('courses.codeLabel')}: {course.code}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        course.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {t(`status.${course.status}`)}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors line-clamp-1">
                    {course.name}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">
                    {course.description}
                  </p>
                </div>

                <div className="px-5 py-2 flex flex-wrap gap-1.5">
                  {course.skills.map((s) => (
                    <span
                      key={s}
                      className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded capitalize"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <div className="mt-auto px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 text-slate-600">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold">{formatNumber(enrolledCount)} {t('courses.enrolledCount')}</span>
                    {coursePendingReqs > 0 && isTeacher && (
                      <span className="ml-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        +{formatNumber(coursePendingReqs)}
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-slate-800 flex items-center space-x-1 text-blue-600">
                    <span>{t('courses.manageCourse')}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900">{t('courses.modalTitle')}</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('courses.courseTitleLabel')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('courses.courseTitlePlaceholder')}
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('courses.descLabel')}</label>
                <textarea
                  rows={3}
                  placeholder={t('courses.descPlaceholder')}
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">{t('courses.targetSkills')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['reading', 'writing', 'listening', 'speaking'] as CourseSkill[]).map((sk) => {
                    const isSelected = newCourseSkills.includes(sk);
                    return (
                      <button
                        type="button"
                        key={sk}
                        onClick={() => toggleSkill(sk)}
                        className={`p-2 rounded-lg border text-center capitalize font-semibold transition-all ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {t(`skills.${sk}`)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('courses.tuitionModel')}</label>
                  <select
                    value={newTuitionModel}
                    onChange={(e) => setNewTuitionModel(e.target.value as TuitionModel)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
                  >
                    <option value="fixed_monthly">{t('tuition.fixedMonthly')}</option>
                    <option value="per_session">{t('tuition.perSession')}</option>
                    <option value="hourly">{t('tuition.hourly')}</option>
                    <option value="course_package">{t('tuition.coursePackage')}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden bg-white"
                  >
                    <option value="VND">VND</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('courses.baseAmountLabel')}</label>
                <input
                  type="number"
                  value={newTuitionAmount}
                  onChange={(e) => setNewTuitionAmount(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('courses.startDate')}</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('courses.endDate')}</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  {creating ? t('common.loading') : t('courses.createAndGenerateBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
