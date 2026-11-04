import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import { useSeasonalTheme } from '../theme/SeasonalThemeContext';
import { SeasonalThemeId } from '../theme/types';
import {
  Bell,
  Globe,
  LogOut,
  ChevronDown,
  Settings,
  BookOpen,
  Palette,
  Check,
} from 'lucide-react';

const themeIcons: Record<SeasonalThemeId, string> = {
  tet: '🌸',
  back_to_school: '🎒',
  mid_autumn: '🏮',
  halloween: '🎃',
  womens_day_8_3: '💐',
  vietnamese_womens_day_20_10: '🪷',
  teachers_day_20_11: '🎓',
  christmas: '🎄',
  new_year: '✨',
  default: '🏛️',
};

export const Navbar: React.FC = () => {
  const {
    currentUser,
    logout,
    notifications,
    markNotificationRead,
    setActiveTab,
  } = useApp();
  const { t, language, setLanguage } = useI18n();
  const { activeThemeId, currentTheme, setTheme, availableThemes } = useSeasonalTheme();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  if (!currentUser) return null;

  const isTeacher = currentUser.role === 'teacher';
  const myNotifications = notifications.filter((n) => n.userId === currentUser.id);
  const unreadCount = myNotifications.filter((n) => !n.read).length;

  const isDefaultTheme = activeThemeId === 'default';

  return (
    <header
      className="no-print h-16 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors duration-200 border-b"
      style={{
        backgroundColor: isDefaultTheme ? '#FFFFFF' : currentTheme.palette.mainBg,
        borderColor: isDefaultTheme ? '#E2E8F0' : currentTheme.palette.border,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* Brand & Workspace Context */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg shadow-xs transition-transform hover:scale-105"
            style={{
              backgroundColor: isDefaultTheme ? '#2563EB' : currentTheme.palette.primary,
              color: '#FFFFFF',
            }}
          >
            🎓
          </div>
          <div className="flex flex-col">
            <span
              className="font-extrabold tracking-tight text-base leading-tight uppercase"
              style={{
                color: isDefaultTheme ? '#0F172A' : currentTheme.palette.primary,
                letterSpacing: '0.02em',
              }}
            >
              {t('common.appName')}
            </span>
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{
                color: isDefaultTheme
                  ? (currentUser.role === 'teacher' ? '#B91C1C' : '#2563EB')
                  : currentTheme.palette.textSecondary,
              }}
            >
              {currentUser.role === 'teacher'
                ? t('nav.teacherWorkspace')
                : t('nav.studentWorkspace')}
            </span>
          </div>
        </div>

        {/* Course Discovery Pill for Student */}
        {currentUser.role === 'student' && (
          <button
            onClick={() => setActiveTab('find_course')}
            className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-colors ml-4 border"
            style={{
              backgroundColor: currentTheme.palette.secondaryBg,
              color: currentTheme.palette.primary,
              borderColor: currentTheme.palette.border,
            }}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t('nav.joinWithCode')}</span>
          </button>
        )}
      </div>

      {/* Right controls: Theme Switcher, Language Switcher, Notifications, Profile */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Seasonal Theme Switcher (Available to teachers to manage the global seasonal experience) */}
        {isTeacher && (
          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-xs"
              style={{
                backgroundColor: currentTheme.palette.cardSurface,
                borderColor: currentTheme.palette.border,
                color: currentTheme.palette.textMain,
              }}
              title="Chọn chủ đề lễ hội (Seasonal Theme)"
            >
              <span className="text-sm">{themeIcons[activeThemeId]}</span>
              <span className="hidden md:inline font-semibold">{currentTheme.name}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>

            {showThemeMenu && (
              <div
                className="absolute right-0 mt-2 w-72 rounded-xl shadow-xl border py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                style={{
                  backgroundColor: currentTheme.palette.cardSurface,
                  borderColor: currentTheme.palette.border,
                }}
              >
                <div
                  className="px-3 py-2 border-b flex items-center justify-between"
                  style={{ borderColor: currentTheme.palette.border }}
                >
                  <div className="flex items-center space-x-1.5">
                    <Palette className="w-4 h-4" style={{ color: currentTheme.palette.primary }} />
                    <span className="font-bold text-xs" style={{ color: currentTheme.palette.textMain }}>
                      Chủ đề giao diện lễ hội
                    </span>
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: currentTheme.palette.textSecondary }}>
                    Toàn hệ thống
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto py-1">
                  {availableThemes.map((theme) => {
                    const isSelected = theme.id === activeThemeId;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => {
                          setTheme(theme.id);
                          setShowThemeMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors hover:bg-black/5"
                        style={{
                          backgroundColor: isSelected ? `${currentTheme.palette.primary}12` : 'transparent',
                          color: isSelected ? currentTheme.palette.primary : currentTheme.palette.textMain,
                          fontWeight: isSelected ? 700 : 500,
                        }}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <span className="text-base">{themeIcons[theme.id]}</span>
                          <div className="truncate">
                            <p className="truncate">{theme.labelVi}</p>
                            <p className="text-[10px] opacity-75 truncate">{theme.visualIdentity}</p>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Language Switcher Pill */}
        <div
          className="flex items-center space-x-1 p-1 rounded-lg border text-xs"
          style={{
            backgroundColor: currentTheme.palette.cardSurface,
            borderColor: currentTheme.palette.border,
          }}
        >
          <Globe className="w-3.5 h-3.5 opacity-60 ml-1.5 mr-0.5" />
          <button
            onClick={() => setLanguage('vi')}
            className="px-2 py-0.5 rounded font-bold transition-all text-[11px]"
            style={{
              backgroundColor: language === 'vi' ? currentTheme.palette.primary : 'transparent',
              color: language === 'vi' ? '#FFFFFF' : currentTheme.palette.textSecondary,
            }}
          >
            VI
          </button>
          <span className="opacity-40">|</span>
          <button
            onClick={() => setLanguage('en')}
            className="px-2 py-0.5 rounded font-bold transition-all text-[11px]"
            style={{
              backgroundColor: language === 'en' ? currentTheme.palette.primary : 'transparent',
              color: language === 'en' ? '#FFFFFF' : currentTheme.palette.textSecondary,
            }}
          >
            EN
          </button>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative p-2 rounded-lg transition-colors hover:bg-black/5"
            style={{
              color: isDefaultTheme ? '#EF4444' : currentTheme.palette.primary,
              backgroundColor: 'transparent',
            }}
            title={t('nav.notifications')}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span
                className="absolute top-1 right-1 w-4 h-4 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white"
                style={{ backgroundColor: isDefaultTheme ? '#EF4444' : currentTheme.palette.primary }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div
              className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl shadow-xl border py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
              style={{
                backgroundColor: currentTheme.palette.cardSurface,
                borderColor: currentTheme.palette.border,
              }}
            >
              <div
                className="px-4 py-2 border-b flex items-center justify-between"
                style={{ borderColor: currentTheme.palette.border }}
              >
                <span className="font-semibold text-sm" style={{ color: currentTheme.palette.textMain }}>
                  {t('nav.notifications')}
                </span>
                <span className="text-xs opacity-60">
                  {myNotifications.length} {t('common.total')}
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: currentTheme.palette.border }}>
                {myNotifications.length === 0 ? (
                  <div className="p-6 text-center text-xs opacity-60">
                    {t('nav.noNotifications')}
                  </div>
                ) : (
                  myNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => markNotificationRead(notif.id)}
                      className={`p-3 text-left transition-colors cursor-pointer ${
                        !notif.read ? 'bg-amber-500/10' : 'hover:bg-black/5'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-xs font-semibold" style={{ color: currentTheme.palette.textMain }}>
                          {notif.title}
                        </p>
                        <span className="text-[10px] opacity-60">{notif.timestamp}</span>
                      </div>
                      <p className="text-xs mt-1 leading-relaxed opacity-80">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-2.5 p-1 rounded-lg transition-colors hover:bg-black/5"
            style={{
              backgroundColor: isDefaultTheme ? 'transparent' : currentTheme.palette.cardSurface,
              borderColor: isDefaultTheme ? 'transparent' : currentTheme.palette.border,
            }}
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-8 h-8 rounded-full object-cover border border-slate-200"
            />
            <div className="hidden md:flex flex-col text-left pr-1">
              <span className="text-xs font-bold leading-tight" style={{ color: currentTheme.palette.textMain }}>
                {currentUser.name}
              </span>
              <span className="text-[10px] font-medium capitalize" style={{ color: currentTheme.palette.textSecondary }}>
                {currentUser.role === 'teacher' ? 'Giáo Viên IELTS Độc Lập' : t('auth.studentRole')}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 opacity-60 mr-1" />
          </button>

          {showUserMenu && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-xl shadow-xl border py-2 z-50"
              style={{
                backgroundColor: currentTheme.palette.cardSurface,
                borderColor: currentTheme.palette.border,
              }}
            >
              <div className="px-4 py-2 border-b" style={{ borderColor: currentTheme.palette.border }}>
                <p className="text-xs font-semibold" style={{ color: currentTheme.palette.textMain }}>
                  {currentUser.name}
                </p>
                <p className="text-[11px] opacity-60 truncate">{currentUser.email}</p>
                <div
                  className="mt-1.5 inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${currentTheme.palette.primary}20`,
                    color: currentTheme.palette.primary,
                  }}
                >
                  {currentUser.role}
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs hover:bg-black/5 flex items-center space-x-2"
                  style={{ color: currentTheme.palette.textMain }}
                >
                  <Settings className="w-4 h-4 opacity-60" />
                  <span>{t('nav.settings')}</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  <span>{t('nav.logout')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
