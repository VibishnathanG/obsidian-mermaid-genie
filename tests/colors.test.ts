import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  contrastRatio,
  normalizeColor,
  relativeLuminance,
  resolvePaletteData,
  textOnFill,
} from '../src/colors';

describe('Color Utilities & Palettes', () => {
  it('normalizes hex colors accurately', () => {
    assert.equal(normalizeColor('#abc'), '#aabbcc');
    assert.equal(normalizeColor('#123456'), '#123456');
    assert.equal(normalizeColor('invalid'), undefined);
  });

  it('calculates WCAG relative luminance correctly', () => {
    assert.equal(Math.round(relativeLuminance('#ffffff') * 100) / 100, 1);
    assert.equal(Math.round(relativeLuminance('#000000') * 100) / 100, 0);
  });

  it('calculates contrast ratios properly', () => {
    const blackWhiteContrast = contrastRatio('#ffffff', '#000000');
    assert.ok(blackWhiteContrast >= 20.9);
  });

  it('ensures textOnFill provides at least 4.5 contrast ratio', () => {
    const lightFill = '#d6e7fa';
    const chosenOnLight = textOnFill(lightFill, '#ffffff');
    assert.ok(contrastRatio(lightFill, chosenOnLight) >= 4.5);

    const darkFill = '#243b57';
    const chosenOnDark = textOnFill(darkFill, '#000000');
    assert.ok(contrastRatio(darkFill, chosenOnDark) >= 4.5);
  });

  it('resolves multi-color palette data with 6 coordinated fills', () => {
    const lightPalette = resolvePaletteData('multi', 'clear', 'slate', false);
    assert.equal(lightPalette.fills.length, 6);
    assert.equal(lightPalette.borders.length, 6);

    const darkPalette = resolvePaletteData('multi', 'cool', 'mint', true);
    assert.equal(darkPalette.fills.length, 6);
    assert.equal(darkPalette.borders.length, 6);
  });
});
