import React from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import { useSeasonalTheme } from '../theme/SeasonalThemeContext';
import { getThemeArtwork } from '../theme/themes';
import {
  LayoutDashboard,
  BookOpen,
  FolderArchive,
  FileCheck2,
  Award,
  WalletCards,
  Sparkles,
  Settings,
  Compass,
  LineChart,
  ShieldCheck,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    currentUser,
    activeTab,
    setActiveTab,
    setSelectedCourseId,
    setSelectedStatementId,
    setSelectedReportId,
  } = useApp();
  const { t } = useI18n();
  const { activeThemeId, currentTheme } = useSeasonalTheme();

  if (!currentUser) return null;

  const handleNav = (tabId: string) => {
    setActiveTab(tabId);
    setSelectedCourseId(null);
    setSelectedStatementId(null);
    setSelectedReportId(null);
  };

  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    badge?: string;
  }

  const teacherItems: NavItem[] = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'courses', label: t('nav.myCourses'), icon: BookOpen },
    { id: 'resources', label: t('nav.resources'), icon: FolderArchive },
    { id: 'assignments', label: t('nav.assignments'), icon: FileCheck2 },
    { id: 'regular_tests', label: t('nav.regularTests'), icon: ShieldCheck },
    { id: 'assessments', label: t('nav.monthlyAssessments'), icon: Award },
    { id: 'tuition', label: t('nav.tuition'), icon: WalletCards },
    { id: 'ai_assistant', label: 'Trợ lý Gemini', icon: Sparkles, badge: 'AI' },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  const studentItems: NavItem[] = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'courses', label: t('nav.myCourses'), icon: BookOpen },
    { id: 'find_course', label: t('nav.findCourse'), icon: Compass },
    { id: 'assignments', label: t('nav.assignments'), icon: FileCheck2 },
    { id: 'regular_tests', label: t('nav.regularTests'), icon: ShieldCheck },
    { id: 'progress', label: t('nav.myProgress'), icon: LineChart },
    { id: 'assessments', label: t('nav.monthlyReports'), icon: Award },
    { id: 'tuition', label: t('nav.tuition'), icon: WalletCards },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  const navItems: NavItem[] = currentUser.role === 'teacher' ? teacherItems : studentItems;
  const { SidebarBottom } = getThemeArtwork(activeThemeId);
  const isDefaultTheme = activeThemeId === 'default';
  const isTetTheme = activeThemeId === 'tet';

  return (
    <aside
      className="no-print w-64 flex flex-col shrink-0 min-h-[calc(100vh-4rem)] border-r transition-colors duration-200"
      style={{
        backgroundColor: isDefaultTheme
          ? '#0B1528'
          : isTetTheme
          ? '#821E28'
          : currentTheme.palette.sidebarBg,
        borderColor: isDefaultTheme
          ? '#1E293B'
          : isTetTheme
          ? 'rgba(212, 166, 74, 0.35)'
          : currentTheme.palette.border,
        color: isDefaultTheme ? '#F8FAFC' : isTetTheme ? '#FFFDF8' : currentTheme.palette.textMain,
      }}
    >
      {/* Workspace branding header in sidebar */}
      <div
        className="p-4 border-b transition-colors"
        style={{
          borderColor: isDefaultTheme
            ? '#1E293B'
            : isTetTheme
            ? 'rgba(212, 166, 74, 0.25)'
            : currentTheme.palette.border,
        }}
      >
        <div className="flex items-center space-x-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: isDefaultTheme
                ? '#3B82F6'
                : isTetTheme
                ? '#E9B94F'
                : currentTheme.palette.primary,
            }}
          />
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{
              color: isDefaultTheme
                ? '#60A5FA'
                : isTetTheme
                ? '#E9B94F'
                : currentTheme.palette.primary,
            }}
          >
            {currentUser.role === 'teacher'
              ? t('nav.teacherWorkspace')
              : t('nav.studentWorkspace')}
          </span>
        </div>
        <div className="flex items-center space-x-1.5 mt-1.5">
          <p
            className="text-xs font-bold truncate"
            style={{
              color: isDefaultTheme ? '#FFFFFF' : isTetTheme ? '#FFFDF8' : currentTheme.palette.textMain,
            }}
          >
            {currentUser.name}
          </p>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer group"
              style={{
                backgroundColor: isActive
                  ? isDefaultTheme
                    ? '#2563EB'
                    : isTetTheme
                    ? '#B9272F'
                    : currentTheme.palette.primary
                  : 'transparent',
                border: isActive && isTetTheme ? '1.5px solid #D4A64A' : '1.5px solid transparent',
                color: isActive
                  ? '#FFFFFF'
                  : isDefaultTheme
                  ? '#94A3B8'
                  : isTetTheme
                  ? '#F7EBD2'
                  : currentTheme.palette.textMain,
                fontWeight: isActive ? 600 : 500,
                boxShadow: isActive
                  ? isTetTheme
                    ? '0 2px 10px rgba(185, 39, 47, 0.4)'
                    : '0 2px 8px rgba(0, 0, 0, 0.15)'
                  : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = isDefaultTheme
                    ? 'rgba(255, 255, 255, 0.08)'
                    : isTetTheme
                    ? 'rgba(255, 255, 255, 0.14)'
                    : `${currentTheme.palette.primary}12`;
                  e.currentTarget.style.color = isDefaultTheme
                    ? '#FFFFFF'
                    : isTetTheme
                    ? '#FFFDF8'
                    : currentTheme.palette.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = isDefaultTheme
                    ? '#94A3B8'
                    : isTetTheme
                    ? '#F7EBD2'
                    : currentTheme.palette.textMain;
                }
              }}
            >
              <div className="flex items-center space-x-3">
                <Icon
                  className="w-4 h-4 shrink-0 transition-colors"
                  style={{
                    color: isActive
                      ? '#FFFFFF'
                      : isDefaultTheme
                      ? '#94A3B8'
                      : isTetTheme
                      ? '#E9B94F'
                      : currentTheme.palette.primary,
                  }}
                />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shadow-2xs"
                  style={{
                    backgroundColor: item.badge === 'AI' && isDefaultTheme
                      ? '#DC2626'
                      : item.badge === 'AI' && isTetTheme
                      ? '#D4A64A'
                      : isActive
                      ? 'rgba(255, 255, 255, 0.25)'
                      : currentTheme.palette.primary,
                    color: item.badge === 'AI' && isTetTheme ? '#4B3027' : '#FFFFFF',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Seasonal Artwork or Default Info Badge */}
      {!isDefaultTheme && SidebarBottom ? (
        <div className="p-2 flex items-center justify-center overflow-hidden">
          <SidebarBottom />
        </div>
      ) : (
        <div
          className="p-4 border-t text-[11px] transition-colors"
          style={{
            borderColor: isDefaultTheme ? '#1E293B' : currentTheme.palette.border,
            color: isDefaultTheme ? '#64748B' : currentTheme.palette.textSecondary,
            backgroundColor: isDefaultTheme ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.03)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{t('nav.privacyEnforced')}</span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <p className="text-[10px] mt-1 opacity-80 leading-normal">
            {currentUser.role === 'teacher'
              ? t('nav.privacyTeacherNote')
              : t('nav.privacyStudentNote')}
          </p>
        </div>
      )}
    </aside>
  );
};
