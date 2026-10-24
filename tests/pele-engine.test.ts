import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('node:module');

try {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM();
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.XMLSerializer = dom.window.XMLSerializer;
} catch {}

// Mock Obsidian runtime exports for unit testing in Node
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

const { renderWithPele, enhancePeleSvg } = require('../src/pele-engine');
const { resolvePaletteData } = require('../src/colors');
const { DEFAULT_SETTINGS } = require('../src/settings');
Module._load = originalLoad;

describe('Pele Engine Integration & Cosmetics', () => {
  it('renders a flowchart with Pele and enhances it with Genie variables and classes', () => {
    const text = `flowchart TD
  A[Start Node] --> B{Decision}
  B -->|Yes| C[Approve]
  B -->|No| D[Reject]`;

    const palette = resolvePaletteData('multi', 'clear', 'slate', true);
    const resultSvg = renderWithPele({
      text,
      id: 'mermaid-test-pele-1',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });

    assert.ok(resultSvg, 'renderWithPele should return a valid SVG string');
    assert.match(resultSvg, /<svg[^>]*class="[^"]*pele[^"]*"/);
    assert.match(resultSvg, /<svg[^>]*class="[^"]*mfe-enhanced[^"]*"/);
    assert.match(resultSvg, /id="mermaid-test-pele-1"/);

    // Verify Pele CSS custom properties set from Genie palette
    assert.match(resultSvg, new RegExp(`--pele-bg:\\s*${palette.background}`));
    assert.match(resultSvg, new RegExp(`--pele-surface:\\s*${palette.surface}`));
    assert.match(resultSvg, new RegExp(`--pele-accent:\\s*${palette.accent}`));

    // Verify node class augmentation and metadata
    assert.match(resultSvg, /class="[^"]*pele-node[^"]*node[^"]*"/);
    assert.match(resultSvg, /data-mpe-key="A"/);
    assert.match(resultSvg, /data-mpe-key="B"/);
    assert.match(resultSvg, /class="[^"]*mpe-decision[^"]*"/);

    // Verify edge class augmentation and path tracing metadata
    assert.match(resultSvg, /data-mpe-from="A"/);
    assert.match(resultSvg, /data-mpe-to="B"/);
    assert.match(resultSvg, /data-mpe-forward="true"/);
  });

  it('assigns coordinated multi-color branch palette fills to parallel branches', () => {
    const text = `flowchart TD
  A[Start] --> B[Branch 1]
  A --> C[Branch 2]
  B --> D[Done]
  C --> D`;

    const palette = resolvePaletteData('multi', 'clear', 'slate', true);
    const resultSvg = renderWithPele({
      text,
      id: 'mermaid-branch-test',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });

    assert.ok(resultSvg);
    const dom = new (require('jsdom')).JSDOM(resultSvg);
    const doc = dom.window.document;

    const nodeB = doc.querySelector('g.node[data-id="B"]');
    const nodeC = doc.querySelector('g.node[data-id="C"]');

    assert.ok(nodeB, 'Node B must exist');
    assert.ok(nodeC, 'Node C must exist');

    const fillB = nodeB.style.getPropertyValue('--node-fill');
    const fillC = nodeC.style.getPropertyValue('--node-fill');

    assert.ok(fillB, 'Node B should have --node-fill assigned');
    assert.ok(fillC, 'Node C should have --node-fill assigned');
    assert.notEqual(fillB, fillC, 'Branches B and C should receive different palette colors');
  });

  it('renders sequence diagrams cleanly with Pele', () => {
    const text = `sequenceDiagram
  Alice->>Bob: Hello Bob
  Bob-->>Alice: Hi Alice`;

    const palette = resolvePaletteData('single', 'clear', 'slate', false);
    const resultSvg = renderWithPele({
      text,
      id: 'seq-diagram',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: false,
    });

    assert.ok(resultSvg);
    assert.match(resultSvg, /class="[^"]*pele-sequence[^"]*"/);
    assert.match(resultSvg, /--pele-surface:\s*#edf0f5/);
  });

  it('renders D01 flowchart and D02 swimlanes from gallery', () => {
    const d01 = `flowchart TD
    Start([Start Process]) --> Check{"Binding Constraint?"}
    Check -->|Balanced, general| M["M Family: General"]
    Check -->|CPU-bound| C["C Family: Compute"]
    Check -->|Memory-bound| R["R Family: Memory"]
    Check -->|Storage IOPS| I["I Family: Storage"]
    Check -->|GPU accelerated| P["P Family: Accelerated"]
    Check -->|Low and spiky| T["T Family: Burstable"]
    M --> Final{"ARM Architecture?"}
    C --> Final
    R --> Final
    Final -->|Yes| Graviton["AWS Graviton instance"]
    Final -->|No| x86["Standard x86 instance"]`;

    const palette = resolvePaletteData('multi', 'clear', 'slate', true);
    const d01Svg = renderWithPele({
      text: d01,
      id: 'd01',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });
    assert.ok(d01Svg, 'D01 should render with Pele');

    const d02 = `flowchart LR
    subgraph Client["👤 Client Layer"]
        Req["Submit Order"]
        Wait["Wait for Confirmation"]
    end
    subgraph Gateway["🛡️ API Gateway"]
        Auth["Authenticate Token"]
        Route["Route Service"]
    end
    Req --> Auth`;

    const d02Svg = renderWithPele({
      text: d02,
      id: 'd02',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });
    assert.ok(d02Svg, 'D02 should render with Pele');
  });

  it('gracefully returns null for unsupported or invalid syntax to enable fallback', () => {
    const text = 'completely invalid mermaid syntax !!!@@#';
    const palette = resolvePaletteData('multi', 'clear', 'slate', true);
    const resultSvg = renderWithPele({
      text,
      id: 'invalid-test',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });

    assert.equal(resultSvg, null, 'Must return null so Genie gracefully falls back to Mermaid.js');
  });
});
