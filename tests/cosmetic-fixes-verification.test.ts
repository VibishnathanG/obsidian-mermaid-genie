import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('node:module');

let dom: any;
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

const originalLoad = Module._load;
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'obsidian') {
    return {
      PluginSettingTab: class {},
      Setting: class {},
      Platform: { isDesktopApp: true },
      Notice: class {},
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { renderWithPele } = require('../src/pele-engine');
const { styleSvg } = require('../src/layout');
const { transpileAgentFlow, transpileCynefin } = require('../src/transpiler');
const { resolvePaletteData } = require('../src/colors');
const { DEFAULT_SETTINGS } = require('../src/settings');
const mermaid = require('mermaid').default;
mermaid.initialize({ startOnLoad: false });

describe('Six User Defect Fixes Verification', () => {
  const palette = resolvePaletteData('multi', 'clear', 'slate', true);

  // 1. ER Diagram line overlap fix (D06)
  it('1. ER Diagram: ensures no stripe patch rects overlap attribute text', () => {
    const code = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        string customer_id PK
        string full_name
        string email
    }`;
    const svg = renderWithPele({
      text: code,
      id: 'er-fix-test',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });
    assert.ok(svg, 'ER diagram rendered with Pele');
    const d = new JSDOM(svg).window.document;
    const customer = d.querySelector('[data-id="CUSTOMER"]');
    assert.ok(customer);
    // Verified: g.pele-er-stripes removed so no half-height patch rects cut through last row
    assert.equal(customer.querySelectorAll('g.pele-er-stripes').length, 0, 'No conflicting stripe patch rects');
    // Outer rect exists with border
    const rect = customer.querySelector(':scope > rect');
    assert.ok(rect);
    assert.equal(rect.getAttribute('fill'), palette.fills[0]);
    // Divider line below title exists
    const divider = customer.querySelector('.pele-er-divider');
    assert.ok(divider);
    assert.equal(divider.getAttribute('fill'), 'none');
  });

  // 2. Gantt Chart active task text white (D08)
  it('2. Gantt Chart: ensures active task bar text is white #ffffff', () => {
    const ganttCode = `gantt
    title Obsidian Plugin Development Sprint
    dateFormat  YYYY-MM-DD
    section Implementation
    Orthogonal Connector Flow :active, imp1, 2026-03-11, 2026-03-18`;

    const svg = renderWithPele({
      text: ganttCode,
      id: 'gantt-white-test',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });
    assert.ok(svg);
    const d = new JSDOM(svg).window.document;
    const activeText = d.querySelector('g.pele-active text, g.pele-task text');
    assert.ok(activeText);
    assert.equal(activeText.getAttribute('fill'), '#ffffff', 'Active task bar text must be white #ffffff');
  });

  // 3. Pie Chart inner white percentage and distinct slice colors (D09)
  it('3. Pie Chart: ensures inner slice percentage text is white #ffffff and slices have distinct colors', () => {
    const pieSvg = `<svg id="pie-test" class="pie mermaid">
      <path class="pieCircle" d="M0,0"/>
      <path class="pieCircle" d="M1,1"/>
      <g class="legend"><rect x="0" y="0"/></g>
      <text class="slice">42%</text>
      <text class="slice">24%</text>
      <text class="pieTitleText">Cloud Budget</text>
    </svg>`;

    const styled = styleSvg(pieSvg, '', DEFAULT_SETTINGS, palette, true);
    const d = new JSDOM(styled).window.document;
    const slices = Array.from(d.querySelectorAll('text.slice'));
    assert.equal(slices.length, 2);
    for (const s of slices as any[]) {
      assert.equal(s.getAttribute('fill'), '#ffffff', 'Inner slice percentage must be white #ffffff');
      assert.ok(
        s.style.getPropertyValue('fill') === '#ffffff' || s.style.getPropertyValue('fill').includes('255'),
        'Fill style should be white'
      );
    }

    const paths = Array.from(d.querySelectorAll('path.pieCircle')) as Element[];
    assert.equal(paths[0]!.getAttribute('fill'), palette.fills[0], 'First slice must match palette.fills[0]');
    assert.equal(paths[1]!.getAttribute('fill'), palette.fills[1], 'Second slice must match palette.fills[1]');

    const legendRect = d.querySelector('.legend rect') as Element;
    assert.equal(legendRect.getAttribute('fill'), palette.fills[0], 'Legend rect must match palette.fills[0]');
  });

  // 4. Git Graph redesign (D13)
  it('4. Git Graph: ensures branch lines have luminous colors and labels have high contrast', () => {
    const gitSvg = `<svg id="git-test" class="gitGraph mermaid">
      <line class="branch branch0" x1="0" y1="0" x2="100" y2="0"/>
      <line class="branch branch1" x1="0" y1="50" x2="100" y2="50"/>
      <rect class="branchLabelBkg label0" x="0" y="0" width="40" height="20"/>
      <g class="branch-label0"><text>main</text></g>
      <circle class="commit commit0" cx="20" cy="0" r="5"/>
      <rect class="commit-label-bkg" x="10" y="-20" width="60" height="15"/>
      <text class="commit-label">Initial commit</text>
    </svg>`;

    const styled = styleSvg(gitSvg, '', DEFAULT_SETTINGS, palette, true);
    const d = new JSDOM(styled).window.document;

    const b0 = d.querySelector('line.branch0');
    assert.equal(b0.getAttribute('stroke'), '#7dd3fc');
    const b1 = d.querySelector('line.branch1');
    assert.equal(b1.getAttribute('stroke'), '#6ee7b7');

    const btext = d.querySelector('.branch-label0 text');
    assert.equal(btext.getAttribute('fill'), '#0f172a');

    const commitCircle = d.querySelector('circle.commit0');
    assert.equal(commitCircle.getAttribute('fill'), '#7dd3fc');
    assert.equal(commitCircle.getAttribute('stroke'), '#ffffff');

    const commitBkg = d.querySelector('rect.commit-label-bkg');
    assert.equal(commitBkg.getAttribute('fill'), '#222e3e');
    const commitText = d.querySelector('text.commit-label');
    assert.equal(commitText.getAttribute('fill'), '#ffffff');
  });

  // 5. Centered Headings for Wardley, Treemap, Arch, and Cynefin vs Kanban start-aligned
  it('5. Headings: centers Wardley, Treemap, Arch, and Cynefin while Kanban remains start-aligned', () => {
    const cynefinCode = `cynefin-beta
    title Engineering Problem Domains
    complex
      "Dynamic adaptive graph layout with arbitrary branching"
    clear
      "Mapping theme hex tokens to CSS variables"`;

    const transpiled = transpileCynefin(cynefinCode);
    assert.ok(transpiled.includes('subgraph Complex ["🌀 Complex<br/><i>Probe · Sense · Respond</i>"]\n                direction TB'));
    assert.ok(transpiled.includes('subgraph Clear ["✅ Clear<br/><i>Sense · Categorize · Respond</i>"]\n                direction TB'));

    // Check Cynefin-scoped cluster label centering in styleSvg
    const cynefinSvg = `<svg class="mermaid"><g id="Cynefin-Complex" class="cluster-label"><text>Complex</text></g></svg>`;
    const styledCynefin = styleSvg(cynefinSvg, '', DEFAULT_SETTINGS, palette, true);
    const dCynefin = new JSDOM(styledCynefin).window.document;
    const clText = dCynefin.querySelector('.cluster-label text');
    assert.equal(clText.getAttribute('text-anchor'), 'middle', 'Cynefin cluster text must be centered with middle anchor');

    // Check Kanban column header remains start-aligned
    const kanbanCode = `kanban
      backlog[📋 Ready for Planning]
        task1[Explore WebGL GPU acceleration]`;
    const kanbanSvg = renderWithPele({
      text: kanbanCode,
      id: 'kanban-test',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });
    const styledKanban = styleSvg(kanbanSvg, '', DEFAULT_SETTINGS, palette, true);
    const dKanban = new JSDOM(styledKanban).window.document;
    const kLabel = dKanban.querySelector('.pele-cluster-label');
    assert.equal(kLabel.getAttribute('text-anchor'), 'start', 'Kanban column title must remain start-aligned');

    // Check Architecture Diagram cluster title is centered
    const archCode = `architecture-beta
      group cloud(cloud)[AWS Infrastructure]
      service alb(internet)[Application Load Balancer] in cloud`;
    const archSvg = renderWithPele({
      text: archCode,
      id: 'arch-test',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });
    const styledArch = styleSvg(archSvg, '', DEFAULT_SETTINGS, palette, true);
    const dArch = new JSDOM(styledArch).window.document;
    const archLabel = dArch.querySelector('.pele-cluster-label');
    const archRect = dArch.querySelector('.pele-cluster rect');
    const expectedCx = (parseFloat(archRect.getAttribute('x') || '0') + parseFloat(archRect.getAttribute('width') || '0') / 2).toString();
    assert.equal(archLabel.getAttribute('text-anchor'), 'middle', 'Architecture cluster title must be centered');
    assert.equal(archLabel.getAttribute('x'), expectedCx, 'Architecture cluster title x must be exactly centered over cluster rect');

    // Check Treemap section heading alone is centered
    const treemapCode = `treemap-beta
      "Repository Codebase"
          "Core Parser": 45
          "Layout Engine": 35`;
    const treemapSvg = renderWithPele({
      text: treemapCode,
      id: 'treemap-test',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });
    const styledTreemap = styleSvg(treemapSvg, '', DEFAULT_SETTINGS, palette, true);
    const dTreemap = new JSDOM(styledTreemap).window.document;
    const tmSecLabel = dTreemap.querySelector('g.pele-section text:not(.pele-value)');
    assert.equal(tmSecLabel.getAttribute('text-anchor'), 'middle', 'Treemap section heading must be centered');
  });

  // 6. AgentFlow Colorization (D33)
  it('6. AgentFlow: colorizes pipeline steps with sequential coordinated palette stage classes', () => {
    const code = `agentflow-beta TB
    flow GenieAgent["Mermaid Genie Processing Pipeline"]
      raw["Source Markdown"]@{ shape: input }
      pre["Wrap Decisions & Calc Spacing"]@{ shape: tool }
      render["Native Mermaid / Pele Render"]@{ shape: tool }
      enhance["Orthogonal Routing & Badges"]@{ shape: tool }
      out["Enhanced SVG Output"]@{ shape: output }

      raw --> pre
      pre --> render
      render --> enhance
      enhance --> out
    end`;

    const transpiled = transpileAgentFlow(code);
    assert.ok(transpiled.includes('class raw step0;'));
    assert.ok(transpiled.includes('class pre step1;'));
    assert.ok(transpiled.includes('class render step2;'));
    assert.ok(transpiled.includes('class enhance step3;'));
    assert.ok(transpiled.includes('class out step4;'));

    const svg = renderWithPele({
      text: transpiled,
      id: 'agentflow-color-test',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });
    assert.ok(svg);
    const d = new JSDOM(svg).window.document;
    const rawNode = d.querySelector('[data-id="raw"]');
    const preNode = d.querySelector('[data-id="pre"]');
    const renderNode = d.querySelector('[data-id="render"]');

    assert.equal(rawNode.style.getPropertyValue('--node-fill'), palette.fills[0]);
    assert.equal(preNode.style.getPropertyValue('--node-fill'), palette.fills[1]);
    assert.equal(renderNode.style.getPropertyValue('--node-fill'), palette.fills[2]);
  });

  // 7. Mindmap font styling and high contrast (D15)
  it('7. Mindmap: ensures crisp high-contrast fonts across root, branch, and leaf nodes in dark mode', () => {
    const mindmapCode = `mindmap
      root((Obsidian Mermaid Genie))
        Visual Aesthetics
          Coordinated Color Palettes
        Geometry & Routing
          Orthogonal Step Connectors`;

    const svg = renderWithPele({
      text: mindmapCode,
      id: 'mindmap-font-test',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });
    assert.ok(svg);
    const styled = styleSvg(svg, '', DEFAULT_SETTINGS, palette, true);
    const d = new JSDOM(styled).window.document;

    const rootText = d.querySelector('.pele-root text');
    assert.ok(rootText);
    assert.equal(rootText.getAttribute('fill'), '#ffffff');

    const branchTexts = Array.from(d.querySelectorAll('.pele-shape-branch text'));
    assert.ok(branchTexts.length > 0);
    for (const bt of branchTexts) {
      assert.equal((bt as Element).getAttribute('fill'), '#f8fafc');
    }

    const leafTexts = Array.from(d.querySelectorAll('.pele-shape-text text'));
    assert.ok(leafTexts.length > 0);
    for (const lt of leafTexts) {
      assert.equal((lt as Element).getAttribute('fill'), '#e2e8f0');
    }
  });
});
