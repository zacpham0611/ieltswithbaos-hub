import React from 'react';
import { SeasonalThemeConfig, SeasonalThemeId } from './types';
import { seasonalThemesData } from './themeData';
import {
  TetCalligraphyTitle,
  TetLionDanceMascot,
  TetFloralBranchDecor,
  TetSidebarBottomDecor,
  BackToSchoolHeroArtwork,
  BackToSchoolSidebarDecor,
  MidAutumnHeroArtwork,
  MidAutumnSidebarDecor,
  HalloweenHeroArtwork,
  HalloweenSidebarDecor,
  WomensDay83HeroArtwork,
  WomensDay83SidebarDecor,
  WomensDay2010HeroArtwork,
  WomensDay2010SidebarDecor,
  TeachersDayHeroArtwork,
  TeachersDaySidebarDecor,
  ChristmasHeroArtwork,
  ChristmasSidebarDecor,
  NewYearHeroArtwork,
  NewYearSidebarDecor,
} from './artwork';

export const seasonalThemes: Record<SeasonalThemeId, SeasonalThemeConfig> = {
  tet: {
    ...seasonalThemesData.tet,
    hero: {
      ...seasonalThemesData.tet.hero,
      titleCustomComponent: React.createElement(TetCalligraphyTitle),
    },
  },
  back_to_school: { ...seasonalThemesData.back_to_school },
  mid_autumn: { ...seasonalThemesData.mid_autumn },
  halloween: { ...seasonalThemesData.halloween },
  womens_day_8_3: { ...seasonalThemesData.womens_day_8_3 },
  vietnamese_womens_day_20_10: { ...seasonalThemesData.vietnamese_womens_day_20_10 },
  teachers_day_20_11: { ...seasonalThemesData.teachers_day_20_11 },
  christmas: { ...seasonalThemesData.christmas },
  new_year: { ...seasonalThemesData.new_year },
  default: { ...seasonalThemesData.default },
};

export const getThemeArtwork = (themeId: SeasonalThemeId) => {
  switch (themeId) {
    case 'tet':
      return {
        HeroMascot: TetLionDanceMascot,
        HeroBranch: TetFloralBranchDecor,
        SidebarBottom: TetSidebarBottomDecor,
      };
    case 'back_to_school':
      return {
        HeroMascot: BackToSchoolHeroArtwork,
        HeroBranch: null,
        SidebarBottom: BackToSchoolSidebarDecor,
      };
    case 'mid_autumn':
      return {
        HeroMascot: MidAutumnHeroArtwork,
        HeroBranch: null,
        SidebarBottom: MidAutumnSidebarDecor,
      };
    case 'halloween':
      return {
        HeroMascot: HalloweenHeroArtwork,
        HeroBranch: null,
        SidebarBottom: HalloweenSidebarDecor,
      };
    case 'womens_day_8_3':
      return {
        HeroMascot: WomensDay83HeroArtwork,
        HeroBranch: null,
        SidebarBottom: WomensDay83SidebarDecor,
      };
    case 'vietnamese_womens_day_20_10':
      return {
        HeroMascot: WomensDay2010HeroArtwork,
        HeroBranch: null,
        SidebarBottom: WomensDay2010SidebarDecor,
      };
    case 'teachers_day_20_11':
      return {
        HeroMascot: TeachersDayHeroArtwork,
        HeroBranch: null,
        SidebarBottom: TeachersDaySidebarDecor,
      };
    case 'christmas':
      return {
        HeroMascot: ChristmasHeroArtwork,
        HeroBranch: null,
        SidebarBottom: ChristmasSidebarDecor,
      };
    case 'new_year':
      return {
        HeroMascot: NewYearHeroArtwork,
        HeroBranch: null,
        SidebarBottom: NewYearSidebarDecor,
      };
    case 'default':
    default:
      return {
        HeroMascot: null,
        HeroBranch: null,
        SidebarBottom: null,
      };
  }
};
