import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('node:module');

// Mock Obsidian runtime exports for unit testing in Node
const originalLoad = Module._load;
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'obsidian') {
    return {
      PluginSettingTab: class {},
      Setting: class {
        setName() { return this; }
        setDesc() { return this; }
        addToggle(fn: (t: unknown) => unknown) { fn({ setValue() { return this; }, onChange() { return this; } }); return this; }
        addSlider(fn: (s: unknown) => unknown) { fn({ setLimits() { return this; }, setValue() { return this; }, setDynamicTooltip() { return this; }, onChange() { return this; } }); return this; }
        addDropdown(fn: (d: unknown) => unknown) { fn({ addOption() { return this; }, setValue() { return this; }, onChange() { return this; } }); return this; }
        addText(fn: (t: unknown) => unknown) { fn({ setPlaceholder() { return this; }, setValue() { return this; }, onChange() { return this; } }); return this; }
      },
      Platform: { isDesktopApp: true },
      Notice: class {},
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { DEFAULT_SETTINGS, normalizeSettings } = require('../src/settings');
Module._load = originalLoad;

describe('Settings Normalization', () => {
  it('returns default settings when empty object is passed', () => {
    const settings = normalizeSettings({});
    assert.deepEqual(settings, DEFAULT_SETTINGS);
  });

  it('clamps numerical values within bounds', () => {
    const settings = normalizeSettings({
      animationDuration: 99999,
      hoverDelay: -50,
      nodeRadius: 100,
    });
    assert.equal(settings.animationDuration, 2000);
    assert.equal(settings.hoverDelay, 0);
    assert.equal(settings.nodeRadius, 24);
  });

  it('preserves valid palettes and styles', () => {
    const settings = normalizeSettings({
      colorStyle: 'multi',
      multiPalette: 'natural',
      singlePalette: 'mint',
    });
    assert.equal(settings.colorStyle, 'multi');
    assert.equal(settings.multiPalette, 'natural');
    assert.equal(settings.singlePalette, 'mint');
  });

  it('falls back safely for invalid inputs', () => {
    const settings = normalizeSettings('invalid');
    assert.deepEqual(settings, DEFAULT_SETTINGS);
  });
});
