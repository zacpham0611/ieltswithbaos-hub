import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { SeasonalThemeConfig, SeasonalThemeId } from './types';
import { seasonalThemes } from './themes';

interface SeasonalThemeContextType {
  activeThemeId: SeasonalThemeId;
  currentTheme: SeasonalThemeConfig;
  setTheme: (themeId: SeasonalThemeId) => void;
  resetToDefault: () => void;
  availableThemes: SeasonalThemeConfig[];
  isSeasonalActive: boolean;
}

const STORAGE_KEY = 'ielts_seasonal_theme';
const DEFAULT_THEME_ID: SeasonalThemeId = 'default';

const SeasonalThemeContext = createContext<SeasonalThemeContextType | undefined>(undefined);

export const SeasonalThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeThemeId, setActiveThemeId] = useState<SeasonalThemeId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as SeasonalThemeId;
      if (saved && seasonalThemes[saved]) {
        return saved;
      }
    } catch {
      // localStorage may fail in restricted sandboxes
    }
    return DEFAULT_THEME_ID;
  });

  const currentTheme = useMemo(() => {
    return seasonalThemes[activeThemeId] || seasonalThemes.default;
  }, [activeThemeId]);

  const setTheme = (themeId: SeasonalThemeId) => {
    if (!seasonalThemes[themeId]) return;
    setActiveThemeId(themeId);
    try {
      if (themeId === 'default') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, themeId);
      }
    } catch {
      // Ignore storage write errors
    }
  };

  const resetToDefault = () => {
    setActiveThemeId('default');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  // Sync CSS variables to document root for smooth universal styling
  useEffect(() => {
    const root = document.documentElement;
    const { palette, typography } = currentTheme;

    root.style.setProperty('--theme-main-bg', palette.mainBg);
    root.style.setProperty('--theme-secondary-bg', palette.secondaryBg);
    root.style.setProperty('--theme-sidebar-bg', palette.sidebarBg);
    root.style.setProperty('--theme-card-surface', palette.cardSurface);
    root.style.setProperty('--theme-primary', palette.primary);
    root.style.setProperty('--theme-secondary', palette.secondary);
    root.style.setProperty('--theme-supporting', palette.supporting);
    root.style.setProperty('--theme-border', palette.border);
    root.style.setProperty('--theme-text-main', palette.textMain);
    root.style.setProperty('--theme-text-secondary', palette.textSecondary);
    root.style.setProperty('--theme-display-font', typography.displayFont);
    root.style.setProperty('--theme-body-font', typography.bodyFont);

    // Apply main background directly to body to avoid flashing white
    document.body.style.backgroundColor = palette.mainBg;
    document.body.style.color = palette.textMain;
  }, [currentTheme]);

  const availableThemes = useMemo(() => Object.values(seasonalThemes), []);
  const isSeasonalActive = activeThemeId !== 'default';

  return (
    <SeasonalThemeContext.Provider
      value={{
        activeThemeId,
        currentTheme,
        setTheme,
        resetToDefault,
        availableThemes,
        isSeasonalActive,
      }}
    >
      {children}
    </SeasonalThemeContext.Provider>
  );
};

export const useSeasonalTheme = () => {
  const context = useContext(SeasonalThemeContext);
  if (!context) {
    throw new Error('useSeasonalTheme must be used within a SeasonalThemeProvider');
  }
  return context;
};
