import React from 'react';
import { useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { TeacherDashboard } from './views/TeacherDashboard';
import { StudentDashboard } from './views/StudentDashboard';
import { CoursesView } from './views/CoursesView';
import { FindCourseView } from './views/FindCourseView';
import { ResourcesView } from './views/ResourcesView';
import { AssignmentsView } from './views/AssignmentsView';
import { AssessmentsView } from './views/AssessmentsView';
import { TuitionView } from './views/TuitionView';
import { AiAssistantView } from './views/AiAssistantView';
import { ProgressView } from './views/ProgressView';
import { SettingsView } from './views/SettingsView';
import { AuthView } from './views/AuthView';
import { useI18n } from './i18n/context';

export const AppContent: React.FC = () => {
  const { currentUser, loadingAuth, activeTab, setActiveTab } = useApp();
  const { t } = useI18n();

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-md animate-bounce">
          🎓
        </div>
        <p className="text-xs text-slate-500 font-semibold tracking-wider uppercase animate-pulse">
          {t('common.loading')}
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthView onAuthSuccess={() => setActiveTab('dashboard')} />;
  }

  const isTeacher = currentUser.role === 'teacher';

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return isTeacher ? <TeacherDashboard /> : <StudentDashboard />;
      case 'courses':
        return <CoursesView />;
      case 'find_course':
        return <FindCourseView />;
      case 'resources':
        return <ResourcesView />;
      case 'assignments':
        return <AssignmentsView />;
      case 'assessments':
        return <AssessmentsView />;
      case 'tuition':
        return <TuitionView />;
      case 'ai_assistant':
        return <AiAssistantView />;
      case 'progress':
        return <ProgressView />;
      case 'settings':
        return <SettingsView />;
      default:
        return isTeacher ? <TeacherDashboard /> : <StudentDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div key={activeTab} className="page-transition min-h-full">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};
