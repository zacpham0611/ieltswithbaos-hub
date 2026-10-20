import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Bell,
  CheckCircle,
  Clock,
  Sparkles,
  LogOut,
  ChevronDown,
  UserCheck,
  GraduationCap,
  BookOpen,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentUser, switchUser, users, notifications, markNotificationRead, setActiveTab } = useApp();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

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
              IELTS TEACHING HUB
            </span>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              {currentUser.role === 'teacher' ? 'Teacher Workspace' : 'Student Workspace'}
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
            <span>Join Course with Code</span>
          </button>
        )}
      </div>

      {/* Right controls: Role switcher, Notifications, Profile */}
      <div className="flex items-center space-x-3">
        {/* Switch Persona Fast-Bar for Testing Scenarios */}
        <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          <span className="text-slate-500 px-2 font-medium">Test Persona:</span>
          {users.map((u) => {
            const isSelected = u.id === currentUser.id;
            return (
              <button
                key={u.id}
                onClick={() => switchUser(u.id)}
                className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center space-x-1 ${
                  isSelected
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title={`${u.name} (${u.role})`}
              >
                <span>{u.role === 'teacher' ? '👨‍🏫' : '👩‍🎓'}</span>
                <span>{u.name.split(' ')[0]}</span>
                <span className="text-[10px] text-slate-400 font-normal">({u.role === 'teacher' ? 'T' : 'S'})</span>
              </button>
            );
          })}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Notifications"
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
                <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                <span className="text-xs text-slate-500">{myNotifications.length} items</span>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {myNotifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-sm">No notifications yet</div>
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
              <span className="text-xs font-bold text-slate-800 leading-tight">{currentUser.name}</span>
              <span className="text-[10px] font-medium text-slate-500 capitalize">{currentUser.role}</span>
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
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Switch Active Role
                </div>
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      switchUser(u.id);
                      setShowUserMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-slate-50 ${
                      u.id === currentUser.id ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span>{u.role === 'teacher' ? '👨‍🏫' : '👩‍🎓'}</span>
                      <span>{u.name}</span>
                    </div>
                    {u.id === currentUser.id && <UserCheck className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-1">
                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                >
                  <span>Account Settings & Privacy</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
