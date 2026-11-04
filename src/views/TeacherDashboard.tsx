import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import { useSeasonalTheme } from '../theme/SeasonalThemeContext';
import { getThemeArtwork } from '../theme/themes';
import {
  ThemeEmptyStateArtwork,
  StatCardBookIllustration,
  StatCardStudentsIllustration,
  StatCardCalendarIllustration,
} from '../theme/artwork';
import {
  TetBaoLiXi,
  TetThoiVang,
  HoaMaiBlossom,
  HoaDaoBlossom,
  TetBanhChung,
} from '../theme/tetVectors';
import { TetBlessingModal } from '../components/TetBlessingModal';
import {
  BookOpen,
  Users,
  Clock,
  Sparkles,
  PlusCircle,
  Award,
  ArrowRight,
  FileText,
  CheckCircle2,
  Tag,
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
  } = useApp();
  const { t, formatNumber } = useI18n();
  const { activeThemeId, currentTheme } = useSeasonalTheme();
  const [showTetModal, setShowTetModal] = useState(false);

  if (!currentUser) return null;

  // Scoped to current teacher
  const myCourses = courses.filter((c) => c.teacherId === currentUser.id && c.status === 'active');
  const myCourseIds = myCourses.map((c) => c.id);

  // Active enrolled students under this teacher
  const myStudents = courseMembers.filter(
    (m) => myCourseIds.includes(m.courseId) && m.status === 'enrolled'
  );
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

  // Statements requiring action
  const pendingStatements = tuitionStatements.filter(
    (s) => s.teacherId === currentUser.id && s.status === 'pending_approval'
  );

  const totalToReview = pendingSubmissions.length + pendingRequests.length + pendingReports.length;

  const { HeroMascot, HeroBranch } = getThemeArtwork(activeThemeId);
  const isDefaultTheme = activeThemeId === 'default';

  return (
    <div className="space-y-6">
      {/* =====================================================================
          1. HEADER AREA: ORIGINAL CLEAN DEFAULT HEADER vs. SEASONAL HERO BANNER
          ===================================================================== */}
      {isDefaultTheme ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              Bảng điều khiển Giáo viên
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1 font-normal">
              Tổng quan không gian giảng dạy và tiến độ lớp học
            </p>
          </div>
          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => setActiveTab('ai_assistant')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-50/90 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition-colors shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Trợ lý AI Giảng dạy</span>
            </button>
            <button
              onClick={() => setActiveTab('courses')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Tạo khóa học mới</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          className="relative overflow-hidden rounded-2xl md:rounded-3xl border p-5 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 transition-all shadow-xs"
          style={{
            background: currentTheme.bannerGradient,
            borderColor: currentTheme.palette.border,
          }}
        >
          {HeroBranch && (
            <div className="absolute -top-1 -right-1 pointer-events-none z-0 opacity-90 hidden sm:block">
              <HeroBranch />
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-5 z-10 w-full md:w-auto text-center sm:text-left">
            {HeroMascot && (
              <div className="shrink-0 transition-transform hover:scale-105 duration-300">
                <HeroMascot />
              </div>
            )}

            <div className="space-y-1.5 max-w-xl">
              {currentTheme.hero.titleCustomComponent ? (
                currentTheme.hero.titleCustomComponent
              ) : (
                <>
                  <h1
                    className="text-2xl md:text-3xl font-extrabold tracking-tight"
                    style={{
                      color: currentTheme.palette.primary,
                      fontFamily: currentTheme.typography.displayFont,
                    }}
                  >
                    {currentTheme.hero.title}
                  </h1>
                  <p
                    className="text-xs md:text-sm italic font-medium leading-relaxed"
                    style={{
                      color: currentTheme.palette.textSecondary,
                      fontFamily: currentTheme.typography.displayFont,
                    }}
                  >
                    {currentTheme.hero.subtitle}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5 shrink-0 z-10 w-full sm:w-auto justify-center sm:justify-end">
            {/* Standalone Interactive Illustrated Button for Vietnamese Tết: "Hái Lộc Đầu Năm" */}
            {activeThemeId === 'tet' && (
              <button
                onClick={() => setShowTetModal(true)}
                className="relative inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-full text-xs font-bold text-white transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #B9272F 0%, #821E28 100%)',
                  border: '1.5px solid #E9B94F',
                  boxShadow: '0 4px 14px rgba(185, 39, 47, 0.35)',
                }}
              >
                <span className="shrink-0 -ml-1">
                  <TetBaoLiXi className="w-4 h-6 drop-shadow-xs" />
                </span>
                <span className="tracking-wide">Hái Lộc Đầu Năm</span>
                <span className="shrink-0 -mr-1">
                  <HoaMaiBlossom size={16} />
                </span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('ai_assistant')}
              className="relative inline-flex items-center space-x-2 px-4 py-2.5 rounded-full text-xs font-semibold transition-all shadow-xs hover:opacity-90 hover:shadow-sm cursor-pointer"
              style={{
                backgroundColor: currentTheme.palette.secondaryBg,
                color: currentTheme.palette.primary,
                border: `1px solid ${currentTheme.palette.border}`,
              }}
            >
              {activeThemeId === 'tet' && (
                <span className="absolute -top-1.5 -left-1.5 pointer-events-none">
                  <HoaDaoBlossom size={15} />
                </span>
              )}
              <Sparkles className="w-3.5 h-3.5" style={{ color: currentTheme.palette.primary }} />
              <span>{currentTheme.hero.aiButtonText}</span>
            </button>

            <button
              onClick={() => setActiveTab('courses')}
              className="relative inline-flex items-center space-x-2 px-4 py-2.5 rounded-full text-xs font-semibold text-white transition-all shadow-xs hover:opacity-95 hover:shadow-sm cursor-pointer"
              style={{
                backgroundColor: currentTheme.palette.primary,
              }}
            >
              {activeThemeId === 'tet' && (
                <span className="absolute -top-2 -right-1.5 pointer-events-none">
                  <TetThoiVang className="w-5 h-3.5" />
                </span>
              )}
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{currentTheme.hero.createButtonText}</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. THREE STATISTICS CARDS (COURSES, STUDENTS, TO REVIEW)
          ===================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Khóa học đang dạy */}
        <div
          onClick={() => setActiveTab('courses')}
          className="relative overflow-hidden p-5 rounded-2xl border transition-all cursor-pointer group shadow-xs hover:shadow-md"
          style={{
            backgroundColor: isDefaultTheme ? '#FFFFFF' : 'rgba(255, 252, 248, 0.94)',
            borderColor: isDefaultTheme ? '#E2E8F0' : currentTheme.palette.border,
            backdropFilter: isDefaultTheme ? undefined : 'blur(8px)',
          }}
        >
          {/* Authentic Vietnamese Tết Corner Accent */}
          {activeThemeId === 'tet' && (
            <div className="absolute top-2 right-10 pointer-events-none opacity-35 group-hover:opacity-75 transition-opacity">
              <TetBanhChung className="w-7 h-7" />
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: isDefaultTheme ? '#64748B' : currentTheme.palette.textMain }}
            >
              Khóa học đang dạy
            </span>
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
          </div>

          <div
            className="text-3xl font-extrabold tracking-tight mt-1"
            style={{ color: isDefaultTheme ? '#0F172A' : currentTheme.palette.textMain }}
          >
            {formatNumber(myCourses.length)}
          </div>

          {isDefaultTheme ? (
            <p className="text-[11px] mt-1.5 font-normal text-slate-400">
              0 đã lưu trữ
            </p>
          ) : (
            <p className="text-[11px] mt-1 font-medium text-emerald-600 flex items-center space-x-1">
              <span>↑ 0% so với tháng trước</span>
            </p>
          )}

          {/* Bottom right 3D Book Illustration in seasonal themes */}
          {!isDefaultTheme && (
            <div className="absolute -bottom-1 -right-1 pointer-events-none opacity-90 group-hover:scale-105 transition-transform">
              <StatCardBookIllustration />
            </div>
          )}
        </div>

        {/* Card 2: Học viên */}
        <div
          onClick={() => setActiveTab('courses')}
          className="relative overflow-hidden p-5 rounded-2xl border transition-all cursor-pointer group shadow-xs hover:shadow-md"
          style={{
            backgroundColor: isDefaultTheme ? '#FFFFFF' : 'rgba(255, 252, 248, 0.94)',
            borderColor: isDefaultTheme ? '#E2E8F0' : currentTheme.palette.border,
            backdropFilter: isDefaultTheme ? undefined : 'blur(8px)',
          }}
        >
          {/* Authentic Vietnamese Tết Corner Accent */}
          {activeThemeId === 'tet' && (
            <div className="absolute top-2 right-10 pointer-events-none opacity-45 group-hover:opacity-85 transition-opacity">
              <HoaMaiBlossom size={19} />
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: isDefaultTheme ? '#64748B' : currentTheme.palette.textMain }}
            >
              Học viên
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
          </div>

          <div
            className="text-3xl font-extrabold tracking-tight mt-1"
            style={{ color: isDefaultTheme ? '#0F172A' : currentTheme.palette.textMain }}
          >
            {formatNumber(distinctStudentIds.length)}
          </div>

          {isDefaultTheme ? (
            <p className="text-[11px] mt-1.5 font-normal text-slate-400">
              Từ các giáo viên độc lập
            </p>
          ) : (
            <p className="text-[11px] mt-1 font-medium text-emerald-600 flex items-center space-x-1">
              <span>↑ 0% so với tháng trước</span>
            </p>
          )}

          {/* Bottom right 3D Cute Students Illustration in seasonal themes */}
          {!isDefaultTheme && (
            <div className="absolute -bottom-1 -right-1 pointer-events-none opacity-95 group-hover:scale-105 transition-transform">
              <StatCardStudentsIllustration />
            </div>
          )}
        </div>

        {/* Card 3: Cần xem xét */}
        <div
          onClick={() => setActiveTab('assignments')}
          className="relative overflow-hidden p-5 rounded-2xl border transition-all cursor-pointer group shadow-xs hover:shadow-md"
          style={{
            backgroundColor: isDefaultTheme ? '#FFFFFF' : 'rgba(255, 252, 248, 0.94)',
            borderColor: isDefaultTheme ? '#E2E8F0' : currentTheme.palette.border,
            backdropFilter: isDefaultTheme ? undefined : 'blur(8px)',
          }}
        >
          {/* Authentic Vietnamese Tết Corner Accent */}
          {activeThemeId === 'tet' && (
            <div className="absolute top-2 right-10 pointer-events-none opacity-45 group-hover:opacity-85 transition-opacity">
              <TetBaoLiXi className="w-5 h-7" />
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: isDefaultTheme ? '#64748B' : currentTheme.palette.textMain }}
            >
              Cần xem xét
            </span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </div>
          </div>

          <div
            className="text-3xl font-extrabold tracking-tight mt-1"
            style={{ color: isDefaultTheme ? '#0F172A' : currentTheme.palette.textMain }}
          >
            {formatNumber(totalToReview)}
          </div>

          <p className="text-[11px] mt-1.5 font-medium text-amber-600">
            {formatNumber(pendingSubmissions.length)} bài nộp · {formatNumber(pendingRequests.length)} yêu cầu
          </p>

          {/* Bottom right 3D Calendar Illustration in seasonal themes */}
          {!isDefaultTheme && (
            <div className="absolute -bottom-1 -right-1 pointer-events-none opacity-90 group-hover:scale-105 transition-transform">
              <StatCardCalendarIllustration />
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          3. MAIN PANELS: VIỆC CẦN XỬ LÝ & HOẠT ĐỘNG GẦN ĐÂY
          ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Panel: Việc cần xử lý */}
        <div
          className="rounded-2xl border p-5 flex flex-col justify-between shadow-xs"
          style={{
            backgroundColor: currentTheme.palette.cardSurface,
            borderColor: currentTheme.palette.border,
          }}
        >
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: currentTheme.palette.border }}>
            <h2
              className="text-xs md:text-sm font-bold tracking-tight flex items-center space-x-2"
              style={{ color: currentTheme.palette.textMain }}
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: currentTheme.palette.primary }}
              />
              <span>Việc cần xử lý</span>
            </h2>
            <button
              onClick={() => setActiveTab('assignments')}
              className="text-xs font-semibold flex items-center space-x-1 hover:underline"
              style={{ color: currentTheme.palette.primary }}
            >
              <span>Cần thao tác</span>
              <ArrowRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>

          <div className="py-6 flex-1 flex flex-col items-center justify-center text-center">
            {totalToReview === 0 && pendingStatements.length === 0 ? (
              <div className="space-y-3">
                {!isDefaultTheme && (
                  <ThemeEmptyStateArtwork themeId={activeThemeId} className="w-24 h-24 mx-auto" />
                )}
                <p
                  className="text-xs font-normal"
                  style={{ color: isDefaultTheme ? '#94A3B8' : currentTheme.palette.textSecondary }}
                >
                  Tuyệt vời! Hiện không có công việc nào đang chờ xử lý.
                </p>
              </div>
            ) : (
              <div className="w-full divide-y" style={{ borderColor: currentTheme.palette.border }}>
                {pendingSubmissions.slice(0, 3).map((sub) => (
                  <div
                    key={sub.id}
                    onClick={() => setActiveTab('assignments')}
                    className="py-3 flex items-center justify-between hover:bg-black/5 px-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="text-left">
                      <p className="text-xs font-semibold" style={{ color: currentTheme.palette.textMain }}>
                        Chấm bài {sub.skill.toUpperCase()}: {sub.assignmentTitle}
                      </p>
                      <p className="text-[11px] opacity-75">{sub.studentName} ({sub.courseName})</p>
                    </div>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${currentTheme.palette.primary}15`,
                        color: currentTheme.palette.primary,
                      }}
                    >
                      Chờ chấm
                    </span>
                  </div>
                ))}

                {pendingRequests.slice(0, 2).map((req) => (
                  <div
                    key={req.id}
                    onClick={() => setActiveTab('courses')}
                    className="py-3 flex items-center justify-between hover:bg-black/5 px-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="text-left">
                      <p className="text-xs font-semibold" style={{ color: currentTheme.palette.textMain }}>
                        Yêu cầu tham gia khóa học
                      </p>
                      <p className="text-[11px] opacity-75">{req.studentName} ({req.courseName})</p>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Chờ duyệt
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Hoạt động gần đây */}
        <div
          className="rounded-2xl border p-5 flex flex-col justify-between shadow-xs"
          style={{
            backgroundColor: currentTheme.palette.cardSurface,
            borderColor: currentTheme.palette.border,
          }}
        >
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: currentTheme.palette.border }}>
            <h2
              className="text-xs md:text-sm font-bold tracking-tight flex items-center space-x-2"
              style={{ color: currentTheme.palette.textMain }}
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: currentTheme.palette.primary }}
              />
              <span>Hoạt động gần đây</span>
            </h2>
            <button
              onClick={() => setActiveTab('resources')}
              className="text-xs font-semibold flex items-center space-x-1 hover:underline"
              style={{ color: currentTheme.palette.primary }}
            >
              <span>Nhật ký hệ thống</span>
              <ArrowRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>

          <div className="divide-y divide-black/5 mt-2 flex-1">
            {activities.length === 0 ? (
              <div className="py-8 text-center text-xs opacity-60">
                {t('dashboard.noActivity')}
              </div>
            ) : (
              activities.slice(0, 5).map((act, idx) => {
                // Colored icon pills matching the screenshot
                const colors = [
                  { bg: 'bg-blue-100', text: 'text-blue-600', Icon: FileText },
                  { bg: 'bg-purple-100', text: 'text-purple-600', Icon: FileText },
                  { bg: 'bg-emerald-100', text: 'text-emerald-600', Icon: CheckCircle2 },
                  { bg: 'bg-amber-100', text: 'text-amber-600', Icon: Tag },
                  { bg: 'bg-cyan-100', text: 'text-cyan-600', Icon: FileText },
                ];
                const c = colors[idx % colors.length];
                const ActIcon = c.Icon;

                return (
                  <div
                    key={act.id}
                    onClick={() => act.targetTab && setActiveTab(act.targetTab)}
                    className="py-3 flex items-center justify-between hover:bg-black/5 px-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-3 pr-4 truncate">
                      <div className={`w-6 h-6 rounded-lg ${c.bg} ${c.text} flex items-center justify-center shrink-0`}>
                        <ActIcon className="w-3.5 h-3.5" />
                      </div>
                      <p
                        className="text-xs font-medium truncate"
                        style={{ color: currentTheme.palette.textMain }}
                      >
                        {act.text}
                      </p>
                    </div>
                    <span className="text-[11px] opacity-60 shrink-0 font-normal">
                      {act.timeAgo}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          4. BOTTOM OPERATIONS BANNER (VẬN HÀNH THÁNG & ĐỐI SOÁT)
          ===================================================================== */}
      <div
        className="relative overflow-hidden rounded-2xl md:rounded-3xl p-5 md:p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all"
        style={{
          background: isDefaultTheme
            ? 'linear-gradient(90deg, #0B1528 0%, #16243E 100%)'
            : currentTheme.bottomBanner.gradient,
        }}
      >
        {/* Left Side: Medal icon + Description */}
        <div className="flex items-center space-x-4 max-w-2xl z-10">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs"
            style={{
              backgroundColor: isDefaultTheme ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.2)',
              borderColor: isDefaultTheme ? 'rgba(96, 165, 250, 0.3)' : 'rgba(255, 255, 255, 0.3)',
            }}
          >
            <Award
              className="w-6 h-6"
              style={{ color: isDefaultTheme ? '#60A5FA' : '#FDE68A' }}
            />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm md:text-base font-bold tracking-tight text-white">
              {currentTheme.bottomBanner.title}
            </h3>
            <p className="text-xs text-white/90 leading-relaxed font-normal">
              {currentTheme.bottomBanner.subtitle}
            </p>
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center space-x-3 shrink-0 z-10 w-full sm:w-auto justify-end">
          <button
            onClick={() => setActiveTab('assessments')}
            className={`px-4 py-2.5 text-xs font-semibold transition-all shadow-xs cursor-pointer ${
              isDefaultTheme
                ? 'rounded-lg bg-blue-600 hover:bg-blue-500 text-white'
                : 'rounded-full bg-white hover:bg-white/90 text-primary'
            }`}
            style={
              !isDefaultTheme
                ? {
                    backgroundColor: '#FFFFFF',
                    color: currentTheme.palette.primary,
                  }
                : undefined
            }
          >
            {currentTheme.bottomBanner.button1Text}
          </button>
          <button
            onClick={() => setActiveTab('tuition')}
            className={`px-4 py-2.5 text-xs font-semibold transition-all shadow-xs cursor-pointer ${
              isDefaultTheme
                ? 'rounded-lg bg-[#1E293B] hover:bg-[#334155] text-white border border-slate-700'
                : 'rounded-full text-white hover:opacity-90'
            }`}
            style={
              !isDefaultTheme
                ? {
                    backgroundColor: currentTheme.palette.primary,
                  }
                : undefined
            }
          >
            {currentTheme.bottomBanner.button2Text}
          </button>
        </div>
      </div>

      {/* Standalone Interactive Vietnamese Tết Blessing Modal */}
      {activeThemeId === 'tet' && (
        <TetBlessingModal
          isOpen={showTetModal}
          onClose={() => setShowTetModal(false)}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      )}
    </div>
  );
};
