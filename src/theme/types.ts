import React from 'react';

export type SeasonalThemeId =
  | 'default'
  | 'tet'
  | 'back_to_school'
  | 'mid_autumn'
  | 'halloween'
  | 'womens_day_8_3'
  | 'vietnamese_womens_day_20_10'
  | 'teachers_day_20_11'
  | 'christmas'
  | 'new_year';

export interface SeasonalThemePalette {
  mainBg: string;
  secondaryBg: string;
  sidebarBg: string;
  cardSurface: string;
  primary: string;
  secondary: string;
  supporting: string;
  accent?: string;
  textMain: string;
  textSecondary: string;
  border: string;
  shadow: string;
}

export interface SeasonalThemeTypography {
  displayFont: string;
  bodyFont: string;
}

export interface SeasonalThemeHero {
  title: string;
  titleCustomComponent?: React.ReactNode;
  subtitle: string;
  aiButtonText: string;
  createButtonText: string;
}

export interface SeasonalThemeConfig {
  id: SeasonalThemeId;
  name: string;
  labelVi: string;
  labelEn: string;
  visualIdentity: string;
  palette: SeasonalThemePalette;
  typography: SeasonalThemeTypography;
  hero: SeasonalThemeHero;
  bannerGradient: string;
  bottomBanner: {
    title: string;
    subtitle: string;
    badgeIconColor: string;
    gradient: string;
    button1Text: string;
    button2Text: string;
  };
}
