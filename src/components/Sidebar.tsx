import React from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
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
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }

  const teacherItems: NavItem[] = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'courses', label: t('nav.myCourses'), icon: BookOpen },
    { id: 'resources', label: t('nav.resources'), icon: FolderArchive },
    { id: 'assignments', label: t('nav.assignments'), icon: FileCheck2 },
    { id: 'assessments', label: t('nav.monthlyAssessments'), icon: Award },
    { id: 'tuition', label: t('nav.tuition'), icon: WalletCards },
    { id: 'ai_assistant', label: t('nav.aiAssistant'), icon: Sparkles, badge: 'AI' },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  const studentItems: NavItem[] = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'courses', label: t('nav.myCourses'), icon: BookOpen },
    { id: 'find_course', label: t('nav.findCourse'), icon: Compass },
    { id: 'assignments', label: t('nav.assignments'), icon: FileCheck2 },
    { id: 'progress', label: t('nav.myProgress'), icon: LineChart },
    { id: 'assessments', label: t('nav.monthlyReports'), icon: Award },
    { id: 'tuition', label: t('nav.tuition'), icon: WalletCards },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  const navItems: NavItem[] = currentUser.role === 'teacher' ? teacherItems : studentItems;

  return (
    <aside className="no-print w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-[calc(100vh-4rem)] border-r border-slate-800">
      {/* Workspace branding header in sidebar */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center space-x-2 text-white">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {currentUser.role === 'teacher'
              ? t('nav.teacherWorkspace')
              : t('nav.studentWorkspace')}
          </span>
        </div>
        <p className="text-xs text-slate-300 font-medium mt-1 truncate">
          {currentUser.name}
        </p>
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
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                    isActive ? 'bg-blue-700 text-blue-100' : 'bg-blue-500/20 text-blue-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom info badge */}
      <div className="p-4 border-t border-slate-800/80 text-[11px] text-slate-400 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <span>{t('nav.privacyEnforced')}</span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          {currentUser.role === 'teacher'
            ? t('nav.privacyTeacherNote')
            : t('nav.privacyStudentNote')}
        </p>
      </div>
    </aside>
  );
};
