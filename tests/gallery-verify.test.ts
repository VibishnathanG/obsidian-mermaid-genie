import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('node:module');

try {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM();
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.XMLSerializer = dom.window.XMLSerializer;
} catch {}

const originalLoad = Module._load;
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'obsidian') {
    return {
      PluginSettingTab: class {},
      Setting: class {
        setName() { return this; }
        setDesc() { return this; }
        addToggle() { return this; }
        addSlider() { return this; }
        addDropdown() { return this; }
        addText() { return this; }
      },
      Platform: { isDesktopApp: true },
      Notice: class {},
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { renderWithPele } = require('../src/pele-engine');
const { resolvePaletteData } = require('../src/colors');
const { DEFAULT_SETTINGS } = require('../src/settings');
Module._load = originalLoad;

describe('Gallery Pele Verification', () => {
  it('renders diagrams from mermaid-syntax-gallery.md with Pele', () => {
    const content = fs.readFileSync('mermaid-syntax-gallery.md', 'utf8');
    const regex = /### (D\d+-[^\n]+)\s+```mermaid\r?\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    const palette = resolvePaletteData('multi', 'clear', 'slate', true);

    let count = 0;
    while ((match = regex.exec(content)) !== null) {
      count++;
      const name = match[1];
      const code = match[2]!.trim();
      const res = renderWithPele({
        text: code,
        id: `gallery-diag-${count}`,
        settings: DEFAULT_SETTINGS,
        palette,
        dark: true,
      });

      if (res) {
        assert.match(res, /<svg/);
      }
    }
    assert.ok(count > 0, 'Found gallery diagrams');
  });
});
