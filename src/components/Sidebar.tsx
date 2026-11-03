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

  return (
    <aside
      className="no-print w-64 flex flex-col shrink-0 min-h-[calc(100vh-4rem)] border-r transition-colors duration-200"
      style={{
        backgroundColor: currentTheme.palette.sidebarBg,
        borderColor: currentTheme.palette.border,
        color: currentTheme.palette.textMain,
      }}
    >
      {/* Workspace branding header in sidebar */}
      <div
        className="p-4 border-b transition-colors"
        style={{ borderColor: currentTheme.palette.border }}
      >
        <div className="flex items-center space-x-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: currentTheme.palette.primary }}
          />
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: currentTheme.palette.primary }}
          >
            {currentUser.role === 'teacher'
              ? t('nav.teacherWorkspace')
              : t('nav.studentWorkspace')}
          </span>
        </div>
        <div className="flex items-center space-x-1.5 mt-1.5">
          <p
            className="text-xs font-bold truncate"
            style={{ color: currentTheme.palette.textMain }}
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
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all"
              style={{
                backgroundColor: isActive ? currentTheme.palette.primary : 'transparent',
                color: isActive ? '#FFFFFF' : currentTheme.palette.textMain,
                fontWeight: isActive ? 600 : 500,
                boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.12)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = isDefaultTheme
                    ? 'rgba(255, 255, 255, 0.08)'
                    : `${currentTheme.palette.primary}12`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
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
                      : currentTheme.palette.primary,
                  }}
                />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: isActive
                      ? 'rgba(255, 255, 255, 0.25)'
                      : currentTheme.palette.primary,
                    color: '#FFFFFF',
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
      {SidebarBottom ? (
        <div className="p-2 flex items-center justify-center overflow-hidden">
          <SidebarBottom />
        </div>
      ) : (
        <div
          className="p-4 border-t text-[11px] opacity-75"
          style={{
            borderColor: currentTheme.palette.border,
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
          }}
        >
          <div className="flex items-center justify-between">
            <span>{t('nav.privacyEnforced')}</span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <p className="text-[10px] mt-1 opacity-80">
            {currentUser.role === 'teacher'
              ? t('nav.privacyTeacherNote')
              : t('nav.privacyStudentNote')}
          </p>
        </div>
      )}
    </aside>
  );
};
