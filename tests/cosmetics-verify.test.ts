import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('node:module');

let dom: any;
try {
  const { JSDOM } = require('jsdom');
  dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.XMLSerializer = dom.window.XMLSerializer;
  globalThis.CSSStyleSheet = class CSSStyleSheet {
    cssRules: string[] = [];
    cssText = '';
    replaceSync(val: string) { this.cssText = val; }
    insertRule(rule: string) { this.cssRules.push(rule); }
  } as any;

  dom.window.SVGElement.prototype.getBBox = function () {
    const text = (this.textContent || '').trim();
    return { x: 0, y: 0, width: Math.max(text.length * 8 + 16, 40), height: 20 };
  };
  dom.window.SVGElement.prototype.getComputedTextLength = function () {
    return (this.textContent || '').length * 8;
  };
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

const mermaid = require('mermaid').default;
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif',
});

const { resolvePaletteData } = require('../src/colors');
const { DEFAULT_SETTINGS } = require('../src/settings');
const { adaptDiagramSource } = require('../src/transpiler');
const { styleSvg } = require('../src/layout');
Module._load = originalLoad;

describe('Six Diagram Cosmetics Verification', () => {
  const palette = resolvePaletteData('multi', 'clear', 'slate', true);

  it('1. Requirement Diagram: auto-sanitizes invalid verifymethod in adaptDiagramSource and styles nodes', async () => {
    const raw = `requirementDiagram
    requirement Req_Performance {
        id: 101
        text: Render diagrams under 100ms
        risk: medium
        verifymethod: benchmark
    }
    functionalRequirement Req_Accessibility {
        id: 102
        text: Maintain WCAG AA 4.5 contrast
        risk: low
        verifymethod: automated_test
    }
    element Engine {
        type: software_module
        docref: CoreRenderer
    }
    Engine - satisfies -> Req_Performance`;

    const adapted = adaptDiagramSource(raw);
    assert.equal(adapted.transpiled, true);
    assert.match(adapted.code, /verifymethod:\s*test/i);
    assert.doesNotMatch(adapted.code, /benchmark/i);
    assert.doesNotMatch(adapted.code, /automated_test/i);

    const rendered = await mermaid.render('test-req', adapted.code);
    const styled = styleSvg(rendered.svg, '', DEFAULT_SETTINGS, palette, true);

    const d = new dom.window.DOMParser().parseFromString(styled, 'image/svg+xml');
    assert.ok(d.querySelector('.requirementDiagram, g.node'), 'Requirement diagram rendered');

    // Check that box paths have been styled with palette surface
    const paths = Array.from(d.querySelectorAll('g.node path'));
    assert.ok(paths.some((p: any) => p.getAttribute('fill') === palette.surface || p.getAttribute('stroke') === palette.border));
  });

  it('2. Class Diagram: ensures class boxes, dividers, and left-padded members/methods', async () => {
    const code = `classDiagram
    class Vehicle {
        +String make
        +String model
        +startEngine() void
    }
    class ElectricCar {
        +int batteryCapacityKwh
    }
    Vehicle <|-- ElectricCar : Extends`;

    const rendered = await mermaid.render('test-class', code);
    const styled = styleSvg(rendered.svg, '', DEFAULT_SETTINGS, palette, true);

    const d = new dom.window.DOMParser().parseFromString(styled, 'image/svg+xml');
    assert.ok(d.querySelector('.classDiagram, [id*="classId"]'), 'Class diagram rendered');

    // Dividers styled with palette border
    const dividers = Array.from(d.querySelectorAll('g.divider path, line.divider'));
    assert.ok(dividers.length > 0, 'Class dividers exist');
    for (const div of dividers as any[]) {
      assert.equal(div.getAttribute('stroke'), palette.border);
    }

    // Members & methods have left padding
    const memberDivs = Array.from(d.querySelectorAll('.members-group foreignObject div, .methods-group foreignObject div'));
    assert.ok(memberDivs.length > 0, 'Member divs exist');
    for (const div of memberDivs as any[]) {
      assert.equal(div.style.paddingLeft, '10px');
      assert.equal(div.style.textAlign, 'left');
    }
  });

  it('3. ER Diagram: ensures entity containers, alternating rows, and padded attributes', async () => {
    const code = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        string customer_id PK
        string full_name
        string email
    }`;

    const rendered = await mermaid.render('test-er', code);
    const styled = styleSvg(rendered.svg, '', DEFAULT_SETTINGS, palette, true);

    const d = new dom.window.DOMParser().parseFromString(styled, 'image/svg+xml');
    assert.ok(d.querySelector('.erDiagram, [id*="entity-"]'), 'ER diagram rendered');

    // Attributes have left padding so text never touches border
    const attrDivs = Array.from(d.querySelectorAll('.attribute-type foreignObject div, .attribute-name foreignObject div'));
    assert.ok(attrDivs.length > 0, 'Attribute divs exist');
    for (const div of attrDivs as any[]) {
      assert.equal(div.style.paddingLeft, '8px');
    }

    // PK keys styled with accent
    const pkKeys = Array.from(d.querySelectorAll('.attribute-keys foreignObject div, .attribute-keys .nodeLabel'))
      .filter((el: any) => (el.textContent || '').trim().length > 0);
    assert.ok(pkKeys.length > 0, 'PK keys exist');
    for (const pk of pkKeys as any[]) {
      assert.ok(
        pk.style.color === palette.accent || pk.style.color.includes('138') || pk.style.color.includes('203'),
        'PK key has accent color'
      );
    }
  });

  it('4. Gantt Chart: ensures high contrast for dark mode taskTextOutside and bars', async () => {
    const code = `gantt
    title Obsidian Plugin Development Sprint
    dateFormat YYYY-MM-DD
    section Architecture
    Design Token System :done, des1, 2026-03-01, 2026-03-05
    Color Contrast Engine :active, des2, 2026-03-06, 2026-03-10
    Release Milestone :milestone, rel, 2026-03-11, 0d`;

    const rendered = await mermaid.render('test-gantt', code);
    const styled = styleSvg(rendered.svg, '', DEFAULT_SETTINGS, palette, true);

    const d = new dom.window.DOMParser().parseFromString(styled, 'image/svg+xml');
    assert.ok(d.querySelector('.gantt, .sectionTitle'), 'Gantt chart rendered');

    // Outside text forced to palette.text (!important in style)
    const outsideTexts = Array.from(d.querySelectorAll('.taskTextOutsideLeft, .taskTextOutsideRight, .sectionTitle'));
    assert.ok(outsideTexts.length > 0, 'Outside texts exist');
    for (const txt of outsideTexts as any[]) {
      assert.equal(txt.getAttribute('fill'), palette.text);
    }
  });

  it('5. Kanban: ensures cards have word-break styling and column headers have clear bounds', async () => {
    const code = `kanban
    backlog[📋 Ready for Planning]
      task1[Explore WebGL GPU acceleration with long title]
    done[✅ Shipped to Production]
      task2[Orthogonal rounded step connectors]`;

    const rendered = await mermaid.render('test-kanban', code);
    const styled = styleSvg(rendered.svg, '', DEFAULT_SETTINGS, palette, true);

    const d = new dom.window.DOMParser().parseFromString(styled, 'image/svg+xml');

    // Cards have white-space: normal and word-break: break-word
    const cardDivs = Array.from(d.querySelectorAll('g.node foreignObject div'));
    assert.ok(cardDivs.length > 0, 'Card divs exist');
    for (const div of cardDivs as any[]) {
      assert.equal(div.style.whiteSpace, 'normal');
      assert.equal(div.style.wordBreak, 'break-word');
      assert.equal(div.style.textAlign, 'left');
    }
  });

  it('6. Treemap: ensures section headers and leaf nodes have coordinated palette fills and clean labels', async () => {
    const code = `treemap-beta
    "Repository Codebase"
      "Layout & Routing": 42
      "Palettes & Theming": 24
    "Test Suites"
      "Color Utilities": 15`;

    const rendered = await mermaid.render('test-treemap', code);
    const styled = styleSvg(rendered.svg, '', DEFAULT_SETTINGS, palette, true);

    const d = new dom.window.DOMParser().parseFromString(styled, 'image/svg+xml');

    // Leaf nodes have palette fills and borders
    const leafRects = Array.from(d.querySelectorAll('rect.treemapLeaf'));
    assert.ok(leafRects.length > 0, 'Leaf rects exist');
    for (const rect of leafRects as any[]) {
      assert.ok(rect.getAttribute('fill'), 'Leaf rect has fill');
      assert.equal(rect.getAttribute('stroke'), palette.border);
      assert.equal(rect.getAttribute('rx'), '5');
    }

    // Leaf labels have high-contrast text
    const leafLabels = Array.from(d.querySelectorAll('text.treemapLabel'));
    assert.ok(leafLabels.length > 0, 'Leaf labels exist');
    for (const lbl of leafLabels as any[]) {
      assert.ok(lbl.getAttribute('fill'), 'Leaf label has text color');
      assert.equal(lbl.getAttribute('font-weight'), '600');
    }
  });
});
