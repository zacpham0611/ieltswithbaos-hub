import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations } from './translations';
import { supabase } from '../lib/supabase';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  locale: Language;
  setLocale: (lang: Language) => void;
  t: (keyPath: string, params?: Record<string, string | number>) => string;
  formatCurrency: (amount: number, currency?: 'VND' | 'USD') => string;
  formatDate: (dateStr: string) => string;
  formatNumber: (val: number) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode; userLanguage?: Language }> = ({
  children,
  userLanguage,
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (userLanguage) return userLanguage;
    const saved = localStorage.getItem('ielts_language') as Language;
    if (saved === 'en' || saved === 'vi') return saved;
    // Default to Vietnamese if browser is Vietnamese or default
    return navigator.language.startsWith('vi') ? 'vi' : 'en';
  });

  useEffect(() => {
    if (userLanguage && userLanguage !== language) {
      setLanguageState(userLanguage);
      localStorage.setItem('ielts_language', userLanguage);
    }
  }, [userLanguage]);

  const setLanguage = async (newLang: Language) => {
    setLanguageState(newLang);
    localStorage.setItem('ielts_language', newLang);

    // Sync to Supabase profile if logged in
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase
          .from('profiles')
          .update({ language_preference: newLang, updated_at: new Date().toISOString() })
          .eq('id', session.user.id);
      }
    } catch {
      // Ignore background sync errors
    }
  };

  const t = (keyPath: string, params?: Record<string, string | number>): string => {
    const keys = keyPath.split('.');
    let current: any = translations[language];

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        // Fallback to English if missing in Vietnamese
        let fallback: any = translations.en;
        for (const fk of keys) {
          if (fallback && typeof fallback === 'object' && fk in fallback) {
            fallback = fallback[fk];
          } else {
            return keyPath;
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current !== 'string') return keyPath;

    let res = current;
    if (params) {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        res = res.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      });
    }
    return res;
  };

  const formatCurrency = (amount: number, currency: 'VND' | 'USD' = 'VND'): string => {
    const num = Math.max(0, Number(amount) || 0);
    if (currency === 'USD') {
      return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${Math.round(num).toLocaleString('vi-VN')} ₫`;
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const formatNumber = (val: number): string => {
    return new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US').format(val);
  };

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        locale: language,
        setLocale: setLanguage,
        t,
        formatCurrency,
        formatDate,
        formatNumber,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
