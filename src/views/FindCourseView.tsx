import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import { supabase } from '../lib/supabase';
import {
  Compass,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  ArrowRight,
} from 'lucide-react';

export const FindCourseView: React.FC = () => {
  const {
    currentUser,
    courses,
    courseMembers,
    enrollmentRequests,
    requestEnrollment,
    setActiveTab,
    setSelectedCourseId,
  } = useApp();
  const { t, formatCurrency } = useI18n();

  const [inputCode, setInputCode] = useState('');
  const [searchedCourse, setSearchedCourse] = useState<any | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!currentUser) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);
    setSearchError(null);

    const trimmed = inputCode.trim().toUpperCase();
    if (!trimmed) return;

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*, profiles:teacher_id(name)')
        .eq('code', trimmed)
        .maybeSingle();

      if (error || !data) {
        setSearchError(t('findCourse.notFoundError', { code: trimmed }));
        setSearchedCourse(null);
      } else {
        setSearchedCourse({
          ...data,
          teacherName: data.profiles?.name || 'Teacher',
          tuitionModel: data.tuition_model,
          tuitionAmount: Number(data.tuition_amount),
          startDate: data.start_date,
          endDate: data.end_date,
        });
      }
    } catch {
      setSearchError(t('findCourse.notFoundError', { code: trimmed }));
      setSearchedCourse(null);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchedCourse) return;
    const res = await requestEnrollment(searchedCourse.code);
    if (res.success) {
      setFeedbackMsg({ type: 'success', text: res.message });
    } else {
      setFeedbackMsg({ type: 'error', text: res.message });
    }
  };

  const isEnrolled = searchedCourse
    ? courseMembers.some(
        (m) => m.courseId === searchedCourse.id && m.studentId === currentUser.id && m.status === 'enrolled'
      )
    : false;

  const activeRequest = searchedCourse
    ? enrollmentRequests.find(
        (r) => r.courseId === searchedCourse.id && r.studentId === currentUser.id
      )
    : null;

  const myRequests = enrollmentRequests.filter((r) => r.studentId === currentUser.id);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {t('findCourse.title')}
        </h1>
        <p className="text-sm text-slate-500">
          {t('findCourse.subtitle')}
        </p>
      </div>

      {/* Code Search Input Box */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Compass className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder={t('findCourse.inputPlaceholder')}
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 text-sm uppercase tracking-wider font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center space-x-2"
          >
            <Search className="w-4 h-4" />
            <span>{searching ? t('common.loading') : t('findCourse.findBtn')}</span>
          </button>
        </form>

        {searchError && (
          <div className="mt-3 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {/* Searched Course Preview Card */}
      {searchedCourse && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-md p-6 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {t('findCourse.previewBadge')}
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">{searchedCourse.name}</h2>
              <p className="text-xs text-slate-500">{t('findCourse.taughtBy')} {searchedCourse.teacherName}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-slate-400">{t('courses.codeLabel')}: {searchedCourse.code}</span>
              <div
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full mt-1 ${
                  searchedCourse.status === 'active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {t(`status.${searchedCourse.status}`)}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">{searchedCourse.description}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">{t('courses.targetSkills')}</span>
              <span className="font-semibold text-slate-800 capitalize">
                {(searchedCourse.skills || []).join(', ')}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">{t('courses.tuitionModel')}</span>
              <span className="font-semibold text-slate-800 capitalize">
                {searchedCourse.tuitionModel?.replace('_', ' ')}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">{t('courses.baseAmountLabel')}</span>
              <span className="font-semibold text-slate-800">
                {formatCurrency(searchedCourse.tuitionAmount, searchedCourse.currency)}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">{t('courses.startDate')}</span>
              <span className="font-semibold text-slate-800">
                {searchedCourse.startDate || '—'} &rarr; {searchedCourse.endDate || '—'}
              </span>
            </div>
          </div>

          {/* Feedback */}
          {feedbackMsg && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {feedbackMsg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2 flex items-center justify-end">
            {isEnrolled ? (
              <button
                onClick={() => {
                  setSelectedCourseId(searchedCourse.id);
                  setActiveTab('courses');
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{t('findCourse.enrolledBadge')}</span>
              </button>
            ) : activeRequest?.status === 'pending' ? (
              <div className="flex items-center space-x-2 px-4 py-2 bg-amber-50 text-amber-800 text-xs font-semibold rounded-lg border border-amber-200">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>{t('findCourse.pendingBadge')}</span>
              </div>
            ) : activeRequest?.status === 'rejected' ? (
              <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200 w-full flex items-start space-x-2">
                <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">{t('findCourse.rejectedBadge')}</p>
                  <p className="text-[11px] mt-0.5">{activeRequest.rejectionReason || '—'}</p>
                  <button
                    onClick={handleSendRequest}
                    className="mt-2 text-xs text-blue-600 font-bold underline"
                  >
                    {t('findCourse.reapplyBtn')}
                  </button>
                </div>
              </div>
            ) : searchedCourse.status !== 'active' ? (
              <div className="text-xs text-slate-500 bg-slate-100 px-4 py-2 rounded-lg">
                {t('findCourse.courseClosed', { status: searchedCourse.status })}
              </div>
            ) : (
              <button
                onClick={handleSendRequest}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center space-x-2"
              >
                <span>{t('findCourse.requestToJoin')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* History of My Requests */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-3">{t('findCourse.myRequestsTitle')}</h3>

        {myRequests.length === 0 ? (
          <p className="text-xs text-slate-400 py-3">{t('findCourse.noRequestsYet')}</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {myRequests.map((req) => (
              <div key={req.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800">{req.courseName}</p>
                  <p className="text-[11px] text-slate-500">{t('findCourse.requestedOn')}: {req.requestedAt}</p>
                  {req.rejectionReason && (
                    <p className="text-[11px] text-red-600 mt-0.5">{t('courses.reasonNote')}: {req.rejectionReason}</p>
                  )}
                </div>
                <span
                  className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${
                    req.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : req.status === 'rejected'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {t(`status.${req.status}`)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
