import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../i18n/context';
import {
  GraduationCap,
  Mail,
  Lock,
  User,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Globe,
  Sparkles,
  Key,
} from 'lucide-react';
import { UserRole } from '../types';

interface AuthViewProps {
  onAuthSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const { t, language, setLanguage } = useI18n();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('teacher');
  const [teacherCode, setTeacherCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setErrorMessage(t('auth.invalidCredentials'));
          } else if (error.message.toLowerCase().includes('email not confirmed')) {
            setErrorMessage(t('auth.emailNotConfirmed'));
          } else {
            setErrorMessage(error.message);
          }
          setLoading(false);
          return;
        }

        if (data.user) {
          onAuthSuccess?.();
        }
      } else {
        // Sign Up
        if (!fullName.trim()) {
          setErrorMessage(t('common.required'));
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: fullName.trim(),
              role,
              language_preference: language,
              teacher_code: teacherCode.trim(),
            },
          },
        });

        if (error) {
          if (error.message.includes('already registered')) {
            setErrorMessage(t('auth.emailInUse'));
          } else {
            setErrorMessage(error.message);
          }
          setLoading(false);
          return;
        }

        // If auto-confirm is enabled or session created directly:
        if (data.session) {
          onAuthSuccess?.();
        } else if (data.user) {
          setSuccessMessage(t('auth.signUpConfirmEmail'));
          setMode('signin');
        } else {
          setSuccessMessage(t('auth.signUpSuccess'));
          setMode('signin');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || t('auth.authError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-blue-100 selection:text-blue-900">
      {/* Top right language switch */}
      <div className="absolute top-6 right-6 flex items-center space-x-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-xs text-xs">
        <Globe className="w-3.5 h-3.5 text-slate-500" />
        <button
          onClick={() => setLanguage('en')}
          className={`font-semibold px-2 py-0.5 rounded ${
            language === 'en' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          EN
        </button>
        <span className="text-slate-300">|</span>
        <button
          onClick={() => setLanguage('vi')}
          className={`font-semibold px-2 py-0.5 rounded ${
            language === 'vi' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          VI
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-md text-2xl font-bold mb-3">
          🎓
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          {mode === 'signin' ? t('auth.signInTitle') : t('auth.signUpTitle')}
        </h2>
        <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          {mode === 'signin' ? t('auth.signInSubtitle') : t('auth.signUpSubtitle')}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl border border-slate-200 sm:px-8">
          {/* Messages */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Full Name for Sign Up */}
            {mode === 'signup' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {t('auth.fullName')}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Nguyen Van A"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {t('auth.email')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="teacher@ieltshub.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Role Selection for Sign Up */}
            {mode === 'signup' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  {t('auth.role')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      role === 'teacher'
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-lg block mb-1">👨‍🏫</span>
                    <span className="font-bold text-slate-900 block text-xs">
                      {t('auth.teacherRole')}
                    </span>
                    <span className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
                      {t('auth.teacherDesc')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      role === 'student'
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-lg block mb-1">👩‍🎓</span>
                    <span className="font-bold text-slate-900 block text-xs">
                      {t('auth.studentRole')}
                    </span>
                    <span className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
                      {t('auth.studentDesc')}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Teacher Code Input when signing up as teacher */}
            {mode === 'signup' && role === 'teacher' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {t('auth.teacherCode')}
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder={t('auth.teacherCodePlaceholder')}
                    value={teacherCode}
                    onChange={(e) => setTeacherCode(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-xs uppercase"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {t('auth.teacherCodeHint')}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition-colors flex items-center justify-center space-x-2 mt-2"
            >
              <span>
                {loading
                  ? mode === 'signin'
                    ? t('auth.loggingIn')
                    : t('auth.registering')
                  : mode === 'signin'
                  ? t('auth.signInBtn')
                  : t('auth.signUpBtn')}
              </span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Mode Switcher */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs">
            {mode === 'signin' ? (
              <p className="text-slate-500">
                {t('auth.noAccount')}{' '}
                <button
                  onClick={() => {
                    setMode('signup');
                    setErrorMessage(null);
                  }}
                  className="font-bold text-blue-600 hover:underline"
                >
                  {t('auth.signUpLink')}
                </button>
              </p>
            ) : (
              <p className="text-slate-500">
                {t('auth.haveAccount')}{' '}
                <button
                  onClick={() => {
                    setMode('signin');
                    setErrorMessage(null);
                  }}
                  className="font-bold text-blue-600 hover:underline"
                >
                  {t('auth.signInLink')}
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Security badge at bottom */}
        <div className="mt-4 text-center text-[11px] text-slate-400 flex items-center justify-center space-x-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t('auth.demoAccountNote')}</span>
        </div>
      </div>
    </div>
  );
};
