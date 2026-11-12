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
import { RegularTestsView } from './views/RegularTestsView';
import { RegularTestExamView } from './views/regular-tests/RegularTestExamView';
import { AuthView } from './views/AuthView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useI18n } from './i18n/context';
import { useSeasonalTheme } from './theme/SeasonalThemeContext';
import { SeasonalPageDecoration } from './theme/artwork';

export const AppContent: React.FC = () => {
  const {
    currentUser,
    loadingAuth,
    loadingData,
    activeTab,
    setActiveTab,
    activeExamAttempt,
    regularTests,
    setActiveExamAttempt,
  } = useApp();
  const { t } = useI18n();
  const { activeThemeId, currentTheme } = useSeasonalTheme();

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

  // Active Exam Takes Over Entire Viewport (Desktop Distraction-Free)
  if (activeExamAttempt) {
    const examTest = regularTests.find((t) => t.id === activeExamAttempt.testId);
    if (examTest) {
      return (
        <RegularTestExamView
          test={examTest}
          attempt={activeExamAttempt}
          onExit={() => setActiveExamAttempt(null)}
        />
      );
    }
    if (loadingData) {
      return (
        <div className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col items-center justify-center p-8 text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-lg font-bold">Resuming Exam Session...</h2>
          <p className="text-xs text-slate-400 mt-2">Connecting to secure exam server, please wait...</p>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col items-center justify-center p-8 text-center">
        <div className="p-6 max-w-md bg-slate-800 rounded-2xl border border-slate-700 space-y-4">
          <h2 className="text-lg font-bold text-red-400">Exam Session Unavailable</h2>
          <p className="text-xs text-slate-300">
            The exam data could not be retrieved from the server. The test may have ended, been unpublished, or is no longer assigned to your account.
          </p>
          <button
            onClick={() => setActiveExamAttempt(null)}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 font-bold text-xs rounded-xl"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
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
      case 'regular_tests':
        return <RegularTestsView />;
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
    <div
      className="min-h-screen relative flex flex-col transition-colors duration-200"
      style={{
        backgroundColor: currentTheme.palette.mainBg,
        color: currentTheme.palette.textMain,
        fontFamily: currentTheme.typography.bodyFont,
      }}
    >
      <SeasonalPageDecoration themeId={activeThemeId} />
      <Navbar />
      <div className="flex-1 flex overflow-hidden z-10">
        <Sidebar />
        <main
          className="flex-1 overflow-y-auto p-4 md:p-8 relative"
          style={{
            backgroundColor: activeThemeId === 'tet' ? 'transparent' : currentTheme.palette.mainBg,
          }}
        >
          <div key={activeTab} className="page-transition min-h-full">
            <ErrorBoundary>
              {renderContent()}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};
