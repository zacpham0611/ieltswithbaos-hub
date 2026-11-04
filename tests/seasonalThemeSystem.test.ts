import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { seasonalThemesData } from '../src/theme/themeData.ts';
import type { SeasonalThemeId } from '../src/theme/types.ts';

describe('Seasonal Theme Design System (Benchmark: Approved Vietnamese Tết Standard)', () => {
  const allThemeIds: SeasonalThemeId[] = [
    'tet',
    'back_to_school',
    'mid_autumn',
    'halloween',
    'womens_day_8_3',
    'vietnamese_womens_day_20_10',
    'teachers_day_20_11',
    'christmas',
    'new_year',
    'default',
  ];

  test('registers all 9 seasonal themes plus default theme', () => {
    assert.strictEqual(Object.keys(seasonalThemesData).length, 10);
    for (const themeId of allThemeIds) {
      assert.ok(seasonalThemesData[themeId], `Theme ${themeId} should be registered`);
      assert.strictEqual(seasonalThemesData[themeId].id, themeId);
    }
  });

  test('enforces non-pure-white dominant background across all seasonal themes', () => {
    const seasonalOnly = allThemeIds.filter((id) => id !== 'default');
    for (const id of seasonalOnly) {
      const theme = seasonalThemesData[id];
      const mainBg = theme.palette.mainBg.toLowerCase();
      assert.notStrictEqual(mainBg, '#ffffff', `Theme ${id} must not use pure white as mainBg`);
      assert.notStrictEqual(mainBg, '#fff', `Theme ${id} must not use pure white as mainBg`);
      assert.ok(mainBg.startsWith('#'), `Theme ${id} mainBg should be a valid hex color`);
    }
  });

  test('validates complete palette configuration for every theme', () => {
    for (const id of allThemeIds) {
      const { palette } = seasonalThemesData[id];
      assert.ok(palette.mainBg, `Theme ${id} missing mainBg`);
      assert.ok(palette.secondaryBg, `Theme ${id} missing secondaryBg`);
      assert.ok(palette.sidebarBg, `Theme ${id} missing sidebarBg`);
      assert.ok(palette.cardSurface, `Theme ${id} missing cardSurface`);
      assert.ok(palette.primary, `Theme ${id} missing primary`);
      assert.ok(palette.secondary, `Theme ${id} missing secondary`);
      assert.ok(palette.supporting, `Theme ${id} missing supporting`);
      assert.ok(palette.textMain, `Theme ${id} missing textMain`);
      assert.ok(palette.textSecondary, `Theme ${id} missing textSecondary`);
      assert.ok(palette.border, `Theme ${id} missing border`);
      assert.ok(palette.shadow, `Theme ${id} missing shadow`);
    }
  });

  test('validates complete typography & display font pairings', () => {
    for (const id of allThemeIds) {
      const { typography } = seasonalThemesData[id];
      assert.ok(typography.displayFont, `Theme ${id} missing displayFont`);
      assert.ok(typography.bodyFont, `Theme ${id} missing bodyFont`);
    }
  });

  test('validates hero banner and bottom operations banner parity', () => {
    for (const id of allThemeIds) {
      const theme = seasonalThemesData[id];
      assert.ok(theme.hero.title, `Theme ${id} missing hero title`);
      assert.ok(theme.hero.subtitle, `Theme ${id} missing hero subtitle`);
      assert.ok(theme.hero.aiButtonText, `Theme ${id} missing hero aiButtonText`);
      assert.ok(theme.hero.createButtonText, `Theme ${id} missing hero createButtonText`);
      assert.ok(theme.bannerGradient, `Theme ${id} missing bannerGradient`);

      assert.ok(theme.bottomBanner.title, `Theme ${id} missing bottomBanner title`);
      assert.ok(theme.bottomBanner.subtitle, `Theme ${id} missing bottomBanner subtitle`);
      assert.ok(theme.bottomBanner.gradient, `Theme ${id} missing bottomBanner gradient`);
      assert.ok(theme.bottomBanner.button1Text, `Theme ${id} missing bottomBanner button1Text`);
      assert.ok(theme.bottomBanner.button2Text, `Theme ${id} missing bottomBanner button2Text`);
    }
  });

  test('verifies approved Vietnamese Tết reference benchmark parameters', () => {
    const tet = seasonalThemesData.tet;
    assert.strictEqual(tet.id, 'tet');
    assert.strictEqual(tet.palette.primary, '#B92735', 'Tết primary must be traditional vermilion #B92735');
    assert.strictEqual(tet.palette.mainBg, '#FFF7EF', 'Tết mainBg must match warm ivory #FFF7EF');
    assert.strictEqual(tet.palette.sidebarBg, '#F8EBDD', 'Tết sidebarBg must match warm cream #F8EBDD');
    assert.strictEqual(tet.palette.cardSurface, '#FFFCF8', 'Tết cardSurface must match #FFFCF8');
  });

  test('ensures Vietnamese Women’s Day 20/10 is distinct from International Women’s Day 8/3', () => {
    const day83 = seasonalThemesData.womens_day_8_3;
    const day2010 = seasonalThemesData.vietnamese_womens_day_20_10;

    assert.notStrictEqual(day83.palette.primary, day2010.palette.primary);
    assert.notStrictEqual(day83.palette.mainBg, day2010.palette.mainBg);
    assert.ok(day2010.labelVi.includes('20/10'));
    assert.ok(day83.labelVi.includes('8/3'));
    assert.ok(day2010.visualIdentity.includes('sen') || day2010.visualIdentity.includes('áo dài'));
  });

  test('verifies Teachers’ Day 20/11 features classic scholastic emerald & appreciation identity', () => {
    const teachersDay = seasonalThemesData.teachers_day_20_11;
    assert.strictEqual(teachersDay.palette.primary, '#2F6B55');
    assert.ok(teachersDay.labelVi.includes('20/11'));
    assert.ok(teachersDay.hero.title.includes('20/11'));
  });

  test('enforces Be Vietnam Pro as the mandatory body font across all 10 themes', () => {
    for (const id of allThemeIds) {
      const theme = seasonalThemesData[id];
      assert.ok(
        theme.typography.bodyFont.includes('Be Vietnam Pro'),
        `Theme ${id} bodyFont must include Be Vietnam Pro`
      );
    }
  });

  test('restores original Default UI baseline matching authoritative screenshot', () => {
    const def = seasonalThemesData.default;
    assert.strictEqual(def.id, 'default');
    assert.strictEqual(def.palette.sidebarBg, '#0B1528', 'Default sidebarBg must match original dark navy #0B1528');
    assert.strictEqual(def.palette.cardSurface, '#FFFFFF', 'Default cardSurface must be pure white');
    assert.strictEqual(def.palette.primary, '#2563EB', 'Default primary must be blue #2563EB');
    assert.strictEqual(def.palette.mainBg, '#F8FAFC', 'Default mainBg must be slate-50 #F8FAFC');
    assert.ok(def.typography.displayFont.includes('Be Vietnam Pro'), 'Default display font must be Be Vietnam Pro');
    assert.ok(def.typography.bodyFont.includes('Be Vietnam Pro'), 'Default body font must be Be Vietnam Pro');
  });

  test('guarantees Christmas theme has balanced festive palette and is not monochromatic blue', () => {
    const xmas = seasonalThemesData.christmas;
    assert.strictEqual(xmas.palette.primary, '#2E6B4E', 'Christmas primary must be pine evergreen');
    assert.strictEqual(xmas.palette.secondary, '#A62B38', 'Christmas secondary must be cranberry/burgundy red');
    assert.strictEqual(xmas.palette.supporting, '#C9A658', 'Christmas supporting must be champagne gold');
  });
});
