import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import {
  Bell,
  Globe,
  LogOut,
  ChevronDown,
  User,
  Settings,
  BookOpen,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    currentUser,
    logout,
    notifications,
    markNotificationRead,
    setActiveTab,
  } = useApp();
  const { t, language, setLanguage } = useI18n();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  if (!currentUser) return null;

  const myNotifications = notifications.filter((n) => n.userId === currentUser.id);
  const unreadCount = myNotifications.filter((n) => !n.read).length;

  return (
    <header className="no-print h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Brand & Workspace Context */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            🎓
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 tracking-tight text-base leading-tight">
              {t('common.appName')}
            </span>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
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
            className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full hover:bg-blue-100 transition-colors ml-4 border border-blue-200"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t('nav.joinWithCode')}</span>
          </button>
        )}
      </div>

      {/* Right controls: Language Switcher, Notifications, Profile */}
      <div className="flex items-center space-x-3">
        {/* Language Switcher Pill */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
          <button
            onClick={() => setLanguage('en')}
            className={`px-2 py-0.5 rounded font-bold transition-all text-[11px] ${
              language === 'en'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            EN
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={() => setLanguage('vi')}
            className={`px-2 py-0.5 rounded font-bold transition-all text-[11px] ${
              language === 'vi'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            VI
          </button>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title={t('nav.notifications')}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="font-semibold text-slate-900 text-sm">{t('nav.notifications')}</span>
                <span className="text-xs text-slate-500">{t('nav.itemsCount', { count: myNotifications.length })}</span>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {myNotifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-sm">
                    {t('nav.noNotifications') || t('common.empty')}
                  </div>
                ) : (
                  myNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        markNotificationRead(notif.id);
                        if (notif.linkTarget) setActiveTab(notif.linkTarget);
                        setShowNotifMenu(false);
                      }}
                      className={`p-3.5 hover:bg-slate-50 cursor-pointer transition-colors ${
                        !notif.read ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-xs font-semibold text-slate-800">{notif.title}</p>
                        <span className="text-[10px] text-slate-400">{notif.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
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
            className="flex items-center space-x-2.5 p-1.5 rounded-lg hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-8 h-8 rounded-full object-cover border border-slate-200"
            />
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {currentUser.name}
              </span>
              <span className="text-[10px] font-medium text-slate-500 capitalize">
                {currentUser.role === 'teacher' ? t('auth.teacherRole') : t('auth.studentRole')}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900">{currentUser.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                <div className="mt-1.5 inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 uppercase tracking-wider">
                  {currentUser.role}
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
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
