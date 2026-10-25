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

  it('renders Class diagrams with wide boxes, non-filled dividers, and start-anchored members', () => {
    const text = `classDiagram
class Vehicle {
  +String make
  +startEngine() : void
}
class ElectricCar {
  +int batteryCapacity
  +charge() : void
}
Vehicle <|-- ElectricCar`;

    const palette = resolvePaletteData('multi', 'clear', 'slate', true);
    const resultSvg = renderWithPele({
      text,
      id: 'class-diagram-test',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });

    assert.ok(resultSvg, 'Class diagram should render with Pele');
    const dom = new (require('jsdom')).JSDOM(resultSvg);
    const doc = dom.window.document;

    // Divider paths must have fill none and valid stroke
    for (const divider of doc.querySelectorAll('.pele-divider, path.pele-divider')) {
      assert.equal(divider.getAttribute('fill'), 'none', 'Divider must not be filled with solid color');
      assert.ok(palette.borders.includes(divider.getAttribute('stroke') || ''), 'Divider must have coordinated palette border stroke');
    }

    // Members must have start text-anchor
    for (const member of doc.querySelectorAll('.pele-member, .pele-attribute, .pele-method')) {
      assert.equal(member.getAttribute('text-anchor'), 'start', 'Member text must be left-aligned with start anchor');
      assert.ok([palette.text, ...palette.textOnFills].includes(member.getAttribute('fill') || ''), 'Member text must have palette text fill');
    }

    // Class box width should be expanded by custom measurer (at least 200px)
    const vehicleRect = doc.querySelector('g.pele-class[data-id="Vehicle"] rect');
    assert.ok(vehicleRect);
    const vehicleWidth = parseFloat(vehicleRect.getAttribute('width') || '0');
    assert.ok(vehicleWidth >= 200, `Vehicle box width (${vehicleWidth}) should be >= 200px`);
  });

  it('renders ER diagrams with left-aligned attributes and highlighted PK keys', () => {
    const text = `erDiagram
CUSTOMER ||--o{ ORDER : places
CUSTOMER {
  string customer_id PK
  string name
  float total_amount
}`;

    const palette = resolvePaletteData('multi', 'clear', 'slate', true);
    const resultSvg = renderWithPele({
      text,
      id: 'er-diagram-test',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });

    assert.ok(resultSvg, 'ER diagram should render with Pele');
    const dom = new (require('jsdom')).JSDOM(resultSvg);
    const doc = dom.window.document;

    // Divider path must have fill none
    for (const divider of doc.querySelectorAll('.pele-er-divider, path.pele-er-divider')) {
      assert.equal(divider.getAttribute('fill'), 'none', 'ER divider must not be filled with solid color');
    }

    // Attribute types and names must be start anchored
    for (const attr of doc.querySelectorAll('.pele-er-type, .pele-er-name')) {
      assert.equal(attr.getAttribute('text-anchor'), 'start', 'ER attribute must have start text-anchor');
    }

    // PK key badge should have accent fill
    const pkKey = doc.querySelector('.pele-er-keys');
    assert.ok(pkKey, 'PK key element should exist');
    assert.equal(pkKey.getAttribute('fill'), palette.accent, 'PK key badge should have accent fill');
  });

  it('encloses Gantt chart task text cleanly inside task bars', () => {
    const text = `gantt
title Project Timeline
dateFormat YYYY-MM-DD
section Core
Long task :a1, 2024-01-01, 30d
Short :after a1, 1d
M1 :milestone, m1, 2024-02-05, 0d`;

    const palette = resolvePaletteData('multi', 'clear', 'slate', true);
    const resultSvg = renderWithPele({
      text,
      id: 'gantt-diagram-test',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });

    assert.ok(resultSvg, 'Gantt chart should render with Pele');
    const dom = new (require('jsdom')).JSDOM(resultSvg);
    const doc = dom.window.document;

    // Normal and short tasks: text must be centered inside task bar rect
    const tasks = doc.querySelectorAll('g.pele-task:not(.pele-milestone)');
    assert.ok(tasks.length >= 2, 'Should have at least 2 non-milestone tasks');
    for (const task of tasks) {
      const rect = task.querySelector('rect');
      const label = task.querySelector('text.pele-label, text');
      assert.ok(rect && label);

      const rx = parseFloat(rect.getAttribute('x') || '0');
      const rw = parseFloat(rect.getAttribute('width') || '0');
      const lx = parseFloat(label.getAttribute('x') || '0');

      // Label x coordinate must be inside the rect [rx, rx + rw]
      assert.ok(lx >= rx && lx <= rx + rw, `Label x (${lx}) must be inside rect [${rx}, ${rx + rw}]`);
      assert.equal(label.getAttribute('text-anchor'), 'middle', 'Task text must be middle-anchored inside task bar');

      // Verify task bar fill is from coordinated palette and text has high contrast
      const fill = rect.getAttribute('fill') || '';
      assert.ok(fill, 'Task bar must have fill');
      const textFill = label.getAttribute('fill') || '';
      assert.ok(textFill === '#edf2fa' || textFill === '#ffffff' || textFill === '#0f172a', 'Task text must have high contrast fill');
    }
  });

  it('renders Requirement and Kanban diagrams with proper field and header alignment', () => {
    const reqText = `requirementDiagram
requirement test_req {
  id: 1
  text: the test text.
  risk: high
  verifymethod: test
}`;

    const kanbanText = `kanban
backlog[📋 Ready for Planning]
  task1[Explore WebGL GPU acceleration]
  task2[Interactive node drag handles]
wip[⚡ Actively in Progress]
  task3[Disjoint interval branch spacing]`;

    const palette = resolvePaletteData('multi', 'clear', 'slate', true);
    const reqSvg = renderWithPele({
      text: reqText,
      id: 'req-test',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });
    assert.ok(reqSvg);
    const reqDoc = new (require('jsdom')).JSDOM(reqSvg).window.document;
    for (const field of reqDoc.querySelectorAll('.pele-field, .pele-value')) {
      assert.equal(field.getAttribute('text-anchor'), 'start', 'Requirement fields must have start text-anchor');
    }

    const kanbanSvg = renderWithPele({
      text: kanbanText,
      id: 'kanban-test',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });
    assert.ok(kanbanSvg);
    const kanbanDoc = new (require('jsdom')).JSDOM(kanbanSvg).window.document;
    for (const label of kanbanDoc.querySelectorAll('.pele-cluster-label')) {
      assert.equal(label.getAttribute('text-anchor'), 'start', 'Kanban column headers must have start text-anchor');
    }
    for (const count of kanbanDoc.querySelectorAll('.pele-count')) {
      assert.equal(count.getAttribute('text-anchor'), 'end', 'Kanban count badge must have end text-anchor');
    }

    // Kanban card task text must be start-aligned and have coordinated color fills
    for (const card of kanbanDoc.querySelectorAll('g.pele-card')) {
      const rect = card.querySelector('rect');
      assert.ok(rect);
      assert.ok(palette.fills.includes(rect.getAttribute('fill') || ''), 'Card rect must have coordinated palette fill');
      for (const cardText of card.querySelectorAll('text')) {
        assert.equal(cardText.getAttribute('text-anchor'), 'start', 'Kanban card text must be start-aligned');
      }
    }
  });

  it('renders Packet diagram with coordinated palette fills for all packet fields', () => {
    const packetText = `packet-beta
0-7: "Packet Type (OpCode)"
8-15: "Flags & Security"
16-31: "Payload Sequence Length"
32-63: "Originating Node Address"
64-95: "Destination Node Address"
96-127: "CRC32 Checksum Verification"`;

    const palette = resolvePaletteData('multi', 'clear', 'slate', true);
    const packetSvg = renderWithPele({
      text: packetText,
      id: 'packet-test',
      settings: DEFAULT_SETTINGS,
      palette,
      dark: true,
    });

    assert.ok(packetSvg, 'Packet diagram should render with Pele');
    const doc = new (require('jsdom')).JSDOM(packetSvg).window.document;
    const fields = doc.querySelectorAll('g.pele-packet-fields > g.pele-node');
    assert.equal(fields.length, 6, 'Should have 6 packet fields');

    const usedFills = new Set<string>();
    for (const field of fields) {
      const rect = field.querySelector('rect');
      const text = field.querySelector('text');
      assert.ok(rect && text, 'Each field must have a rect and text');

      const fill = rect.getAttribute('fill');
      assert.ok(fill && palette.fills.includes(fill), `Rect fill (${fill}) must be from palette.fills`);
      usedFills.add(fill);

      const textFill = text.getAttribute('fill');
      assert.ok(textFill, 'Field text must have fill attribute');
    }
    assert.ok(usedFills.size >= 4, `Should use multiple distinct coordinated colors (found ${usedFills.size})`);
  });
});
