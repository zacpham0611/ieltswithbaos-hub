import React from 'react';
import { SeasonalThemeConfig, SeasonalThemeId } from './types';
import { seasonalThemesData } from './themeData';
import {
  TetCalligraphyTitle,
  TetLionDanceMascot,
  TetFloralBranchDecor,
  TetSidebarBottomDecor,
  BackToSchoolCalligraphyTitle,
  BackToSchoolHeroArtwork,
  BackToSchoolCornerDecor,
  BackToSchoolSidebarDecor,
  MidAutumnCalligraphyTitle,
  MidAutumnHeroArtwork,
  MidAutumnCornerDecor,
  MidAutumnSidebarDecor,
  HalloweenCalligraphyTitle,
  HalloweenHeroArtwork,
  HalloweenCornerDecor,
  HalloweenSidebarDecor,
  WomensDay83CalligraphyTitle,
  WomensDay83HeroArtwork,
  WomensDay83CornerDecor,
  WomensDay83SidebarDecor,
  WomensDay2010CalligraphyTitle,
  WomensDay2010HeroArtwork,
  WomensDay2010CornerDecor,
  WomensDay2010SidebarDecor,
  TeachersDayCalligraphyTitle,
  TeachersDayHeroArtwork,
  TeachersDayCornerDecor,
  TeachersDaySidebarDecor,
  ChristmasCalligraphyTitle,
  ChristmasHeroArtwork,
  ChristmasCornerDecor,
  ChristmasSidebarDecor,
  NewYearCalligraphyTitle,
  NewYearHeroArtwork,
  NewYearCornerDecor,
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
  back_to_school: {
    ...seasonalThemesData.back_to_school,
    hero: {
      ...seasonalThemesData.back_to_school.hero,
      titleCustomComponent: React.createElement(BackToSchoolCalligraphyTitle),
    },
  },
  mid_autumn: {
    ...seasonalThemesData.mid_autumn,
    hero: {
      ...seasonalThemesData.mid_autumn.hero,
      titleCustomComponent: React.createElement(MidAutumnCalligraphyTitle),
    },
  },
  halloween: {
    ...seasonalThemesData.halloween,
    hero: {
      ...seasonalThemesData.halloween.hero,
      titleCustomComponent: React.createElement(HalloweenCalligraphyTitle),
    },
  },
  womens_day_8_3: {
    ...seasonalThemesData.womens_day_8_3,
    hero: {
      ...seasonalThemesData.womens_day_8_3.hero,
      titleCustomComponent: React.createElement(WomensDay83CalligraphyTitle),
    },
  },
  vietnamese_womens_day_20_10: {
    ...seasonalThemesData.vietnamese_womens_day_20_10,
    hero: {
      ...seasonalThemesData.vietnamese_womens_day_20_10.hero,
      titleCustomComponent: React.createElement(WomensDay2010CalligraphyTitle),
    },
  },
  teachers_day_20_11: {
    ...seasonalThemesData.teachers_day_20_11,
    hero: {
      ...seasonalThemesData.teachers_day_20_11.hero,
      titleCustomComponent: React.createElement(TeachersDayCalligraphyTitle),
    },
  },
  christmas: {
    ...seasonalThemesData.christmas,
    hero: {
      ...seasonalThemesData.christmas.hero,
      titleCustomComponent: React.createElement(ChristmasCalligraphyTitle),
    },
  },
  new_year: {
    ...seasonalThemesData.new_year,
    hero: {
      ...seasonalThemesData.new_year.hero,
      titleCustomComponent: React.createElement(NewYearCalligraphyTitle),
    },
  },
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
        HeroBranch: BackToSchoolCornerDecor,
        SidebarBottom: BackToSchoolSidebarDecor,
      };
    case 'mid_autumn':
      return {
        HeroMascot: MidAutumnHeroArtwork,
        HeroBranch: MidAutumnCornerDecor,
        SidebarBottom: MidAutumnSidebarDecor,
      };
    case 'halloween':
      return {
        HeroMascot: HalloweenHeroArtwork,
        HeroBranch: HalloweenCornerDecor,
        SidebarBottom: HalloweenSidebarDecor,
      };
    case 'womens_day_8_3':
      return {
        HeroMascot: WomensDay83HeroArtwork,
        HeroBranch: WomensDay83CornerDecor,
        SidebarBottom: WomensDay83SidebarDecor,
      };
    case 'vietnamese_womens_day_20_10':
      return {
        HeroMascot: WomensDay2010HeroArtwork,
        HeroBranch: WomensDay2010CornerDecor,
        SidebarBottom: WomensDay2010SidebarDecor,
      };
    case 'teachers_day_20_11':
      return {
        HeroMascot: TeachersDayHeroArtwork,
        HeroBranch: TeachersDayCornerDecor,
        SidebarBottom: TeachersDaySidebarDecor,
      };
    case 'christmas':
      return {
        HeroMascot: ChristmasHeroArtwork,
        HeroBranch: ChristmasCornerDecor,
        SidebarBottom: ChristmasSidebarDecor,
      };
    case 'new_year':
      return {
        HeroMascot: NewYearHeroArtwork,
        HeroBranch: NewYearCornerDecor,
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
