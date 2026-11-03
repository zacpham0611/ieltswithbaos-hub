import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/context';
import { useSeasonalTheme } from '../theme/SeasonalThemeContext';
import { SeasonalThemeId } from '../theme/types';
import {
  User,
  ShieldCheck,
  Building,
  Key,
  CheckCircle,
  Lock,
  RotateCcw,
  Globe,
  CreditCard,
  Save,
  Palette,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { currentUser, updateProfile } = useApp();
  const { t, locale, setLocale } = useI18n();
  const { activeThemeId, setTheme, availableThemes } = useSeasonalTheme();

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

  if (!currentUser) return null;
  const isTeacher = currentUser.role === 'teacher';

  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [targetBand, setTargetBand] = useState(currentUser.targetBand || '7.5');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState(false);

  // Teacher bank details
  const [bankName, setBankName] = useState('Vietcombank (VCB)');
  const [accountHolder, setAccountHolder] = useState(currentUser.name.toUpperCase());
  const [accountNumber, setAccountNumber] = useState('0071001234567');
  const [branch, setBranch] = useState('Ho Chi Minh City, Vietnam');
  const [bankSuccessMsg, setBankSuccessMsg] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await updateProfile({
        name: name.trim(),
        bio: bio.trim(),
        targetBand: !isTeacher ? targetBand.trim() : undefined,
      });
      setProfileSuccessMsg(true);
      setTimeout(() => setProfileSuccessMsg(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Error updating profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveBank = (e: React.FormEvent) => {
    e.preventDefault();
    setBankSuccessMsg(true);
    setTimeout(() => setBankSuccessMsg(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm text-slate-500">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* Role & Privacy Security Badge */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{t('settings.privacyTitle')}</h3>
            <p className="text-xs text-slate-500">
              {t('settings.privacyDesc', { role: currentUser.role.toUpperCase() })}
            </p>
          </div>
        </div>
        <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold uppercase">
          RLS Active
        </span>
      </div>

      {/* Language Preferences Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
          <Globe className="w-5 h-5 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900">{t('settings.languageTitle')}</h2>
        </div>
        <p className="text-xs text-slate-500">
          {t('settings.languageDesc')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => setLocale('en')}
            className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
              locale === 'en'
                ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-600'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <p className="text-sm font-bold text-slate-900">{t('settings.langEn')}</p>
              <p className="text-xs text-slate-500 mt-0.5">English interface & labels</p>
            </div>
            {locale === 'en' && <CheckCircle className="w-5 h-5 text-blue-600" />}
          </button>

          <button
            type="button"
            onClick={() => setLocale('vi')}
            className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
              locale === 'vi'
                ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-600'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div>
              <p className="text-sm font-bold text-slate-900">{t('settings.langVi')}</p>
              <p className="text-xs text-slate-500 mt-0.5">Giao diện và thông báo tiếng Việt</p>
            </div>
            {locale === 'vi' && <CheckCircle className="w-5 h-5 text-blue-600" />}
          </button>
        </div>
      </div>

      {/* Seasonal Theme System Manager */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Palette className="w-5 h-5 text-rose-600" />
            <h2 className="text-sm font-bold text-slate-900">Chủ đề giao diện lễ hội (Seasonal Themes)</h2>
          </div>
          <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
            {isTeacher ? 'Quyền Giáo Viên' : 'Chế độ Học Viên'}
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          {isTeacher
            ? 'Chọn chủ đề mùa lễ hội áp dụng trên toàn bộ hệ thống IELTS Teaching Hub. Mọi học viên và giáo viên sẽ trải nghiệm cùng một không khí lễ hội thống nhất.'
            : 'Chủ đề giao diện được thiết lập đồng bộ bởi giáo viên để tạo không khí học tập hứng khởi theo từng mùa trong năm.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
          {availableThemes.map((theme) => {
            const isSelected = theme.id === activeThemeId;
            return (
              <button
                key={theme.id}
                type="button"
                disabled={!isTeacher}
                onClick={() => setTheme(theme.id)}
                className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'ring-2 shadow-sm'
                    : 'hover:border-slate-300'
                } ${!isTeacher ? 'cursor-default' : 'cursor-pointer hover:scale-[1.01]'}`}
                style={{
                  backgroundColor: theme.palette.mainBg,
                  borderColor: isSelected ? theme.palette.primary : theme.palette.border,
                  ...(isSelected ? { '--tw-ring-color': theme.palette.primary } as any : {}),
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xl">{themeIcons[theme.id]}</span>
                    {isSelected && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center space-x-1"
                        style={{ backgroundColor: theme.palette.primary }}
                      >
                        <CheckCircle className="w-3 h-3 inline mr-1" />
                        Đang chọn
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs font-bold" style={{ color: theme.palette.primary }}>
                    {theme.labelVi}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {theme.visualIdentity}
                  </p>
                </div>

                {/* Color swatches */}
                <div className="flex items-center space-x-1.5 mt-3 pt-2 border-t border-black/5">
                  <span
                    className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                    style={{ backgroundColor: theme.palette.mainBg }}
                    title="Main Background"
                  />
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: theme.palette.primary }}
                    title="Primary"
                  />
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: theme.palette.secondary }}
                    title="Secondary"
                  />
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: theme.palette.supporting }}
                    title="Supporting"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          <div className="flex items-center space-x-4 pb-4 border-b border-slate-100">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-14 h-14 rounded-full object-cover border border-slate-200"
            />
            <div>
              <h2 className="text-sm font-bold text-slate-900">{currentUser.name}</h2>
              <p className="text-xs text-slate-400 capitalize">{currentUser.role} Account</p>
            </div>
          </div>

          {profileSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{t('settings.profileSaved')}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                disabled
                value={currentUser.email}
                className="w-full p-2.5 border border-slate-200 rounded-lg outline-hidden bg-slate-100 text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          {!isTeacher && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('settings.targetBand')}</label>
              <input
                type="text"
                value={targetBand}
                onChange={(e) => setTargetBand(e.target.value)}
                placeholder="e.g. 7.0 or 7.5"
                className="w-full sm:w-48 p-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('settings.bioLabel')}</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Teaching credentials, experience or learning goals..."
              className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingProfile ? t('common.loading') : t('settings.saveProfileBtn')}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Teacher Bank Settings */}
      {isTeacher && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">{t('settings.bankSettingsTitle')}</h2>
              <p className="text-xs text-slate-500">{t('settings.bankSettingsDesc')}</p>
            </div>
          </div>

          {bankSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{t('settings.bankSaved')}</span>
            </div>
          )}

          <form onSubmit={handleSaveBank} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('settings.bankName')}</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('settings.accountHolder')}</label>
                <input
                  type="text"
                  required
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden uppercase font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('settings.accountNumber')}</label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('settings.branch')}</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{t('settings.saveBankBtn')}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
