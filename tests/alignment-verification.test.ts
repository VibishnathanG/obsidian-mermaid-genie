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
} catch {
  // If JSDOM is unavailable, provide mock
}

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

const { styleSvg, equalizeCardWidths, wrapDecisions, computeDiagramSpacing, fixClusterHeaderOverlap } = require('../src/layout');
const { DEFAULT_SETTINGS } = require('../src/settings');
const { resolvePaletteData } = require('../src/colors');
Module._load = originalLoad;

describe('Alignment & Layout Precision Tests', () => {
  const palette = resolvePaletteData('multi', 'default', 'default', false);

  it('preserves subroutine shapes without generating nested borders', () => {
    const rawSvg = `<svg id="test-svg" class="mermaid">
      <g id="flowchart-A-0" class="node default default flowchart-label">
        <polygon class="label-container" points="0,0 15,0 15,-15 0,-15 0,0 -8,0 23,0 23,-15 -8,-15 -8,0"/>
        <g class="label">
          <rect/>
          <foreignObject height="20" width="80">
            <div xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel"><p>System status</p></span></div>
          </foreignObject>
        </g>
      </g>
    </svg>`;

    const enhanced = styleSvg(rawSvg, 'TD', DEFAULT_SETTINGS, palette, false);
    assert.ok(enhanced.includes('data-mpe-key="A"'));
    // The polygon retains its coordinates
    assert.ok(enhanced.includes('polygon class="label-container"'));
  });

  it('prevents horizontal collisions by leaving sibling card widths untouched in TD diagrams', () => {
    // Sibling cards with different natural widths
    const rawSvg = `<svg id="test-svg" class="mermaid">
      <g id="flowchart-nodeM-1" class="node default flowchart-label" transform="translate(100, 100)">
        <rect class="basic label-container" width="80" height="40" x="-40" y="-20"/>
      </g>
      <g id="flowchart-nodeC-2" class="node default flowchart-label" transform="translate(220, 100)">
        <rect class="basic label-container" width="120" height="40" x="-60" y="-20"/>
      </g>
      <g id="flowchart-nodeR-3" class="node default flowchart-label" transform="translate(360, 100)">
        <rect class="basic label-container" width="100" height="40" x="-50" y="-20"/>
      </g>
    </svg>`;

    const enhanced = styleSvg(rawSvg, 'TD', DEFAULT_SETTINGS, palette, false);
    // In TD, nodeM should still have width 80 (not blown up to 120 which would collide with nodeC)
    assert.ok(enhanced.includes('width="80"'));
    assert.ok(enhanced.includes('width="120"'));
    assert.ok(enhanced.includes('width="100"'));
  });

  it('wraps long decision diamond text cleanly without clipping', () => {
    const source = 'C{"What is the binding constraint"}';
    const wrapped = wrapDecisions(source);
    assert.ok(typeof wrapped === 'string');
    // Words are not truncated
    assert.ok(!wrapped.includes('th binding'));
  });

  it('routes forward branches with smooth rounded orthogonal paths and formats arrowhead markers', () => {
    const rawSvg = `<svg id="test-svg" class="mermaid">
      <defs>
        <marker id="test_flowchart-pointEnd" class="marker flowchart"><path d="M 0 0 L 10 5 L 0 10 z"/></marker>
      </defs>
      <g id="flowchart-B-0" class="node default" transform="translate(140, 100)">
        <polygon class="label-container" points="0,0 20,20 0,40 -20,20"/>
      </g>
      <g id="flowchart-C-1" class="node default" transform="translate(60, 200)">
        <rect class="basic label-container" width="80" height="40" x="-40" y="-20"/>
      </g>
      <g id="flowchart-D-2" class="node default" transform="translate(220, 200)">
        <rect class="basic label-container" width="80" height="40" x="-40" y="-20"/>
      </g>
      <g class="edgePaths">
        <path id="L-B-C-0" class="flowchart-link" d="M140,120L100,120L100,160L60,160L60,180"/>
        <path id="L-B-D-1" class="flowchart-link" d="M140,120L180,120L180,160L220,160L220,180"/>
      </g>
      <g class="edgeLabels">
        <g class="edgeLabel" data-id="L-B-C-0"><g class="label"><foreignObject width="60" height="20"><div><span>System status</span></div></foreignObject></g></g>
        <g class="edgeLabel" data-id="L-B-D-1"><g class="label"><foreignObject width="60" height="20"><div><span>Instance status</span></div></foreignObject></g></g>
      </g>
    </svg>`;

    const enhanced = styleSvg(rawSvg, 'TD', DEFAULT_SETTINGS, palette, false);
    // Orthogonal paths should have rounded corners (Q commands)
    assert.ok(enhanced.includes('Q'), 'Should contain quadratic bezier rounded corners');
    // Arrowhead marker is formatted with crisp triangle
    assert.ok(enhanced.includes('d="M0 0 L10 5 L0 10 Z"'), 'Marker should be formatted with crisp triangle');
    // Edge labels are moved to midpoint of the bridges
    assert.ok(enhanced.includes('transform="translate('), 'Edge labels should have valid transform positions');
    assert.ok(!enhanced.includes('translate(undefined'), 'Should not contain undefined or NaN in transforms');
  });

  it('seamlessly enhances non-flowchart diagram types without crashing or parser errors', () => {
    const sequenceSvg = `<svg id="seq" class="mermaid"><g class="actor"><rect class="actor" width="100" height="40"/><text class="actor">Alice</text></g></svg>`;
    const enhancedSeq = styleSvg(sequenceSvg, '', DEFAULT_SETTINGS, palette, false);
    assert.ok(enhancedSeq.includes('class="mermaid mfe-enhanced mermaid-genie-diagram"'));

    const classSvg = `<svg id="cls" class="mermaid"><g class="classGroup"><rect width="120" height="60"/><text>Animal</text></g></svg>`;
    const enhancedCls = styleSvg(classSvg, '', DEFAULT_SETTINGS, palette, false);
    assert.ok(enhancedCls.includes('class="mermaid mfe-enhanced mermaid-genie-diagram"'));

    const pieSvg = `<svg id="pie" class="mermaid"><path class="pieCircle" d="M0,0 L10,10"/><text class="pieTitleText">Pets</text></svg>`;
    const enhancedPie = styleSvg(pieSvg, '', DEFAULT_SETTINGS, palette, false);
    assert.ok(enhancedPie.includes('class="mermaid mfe-enhanced mermaid-genie-diagram"'));
  });

  it('removes empty edgeLabels so no small empty rectangle boxes appear on empty flows', () => {
    const rawSvg = `<svg id="test-empty-labels" class="mermaid">
      <g id="flowchart-A-0" class="node default"><rect width="80" height="40"/><text>Start</text></g>
      <g id="flowchart-B-1" class="node default"><rect width="80" height="40"/><text>Next</text></g>
      <g id="flowchart-C-2" class="node default"><rect width="80" height="40"/><text>End</text></g>
      <g class="edgePaths">
        <path id="L-A-B-0" class="flowchart-link" d="M40,40L40,80"/>
        <path id="L-B-C-1" class="flowchart-link" d="M40,120L40,160"/>
      </g>
      <g class="edgeLabels">
        <g class="edgeLabel" id="empty-label-1" data-id="L-A-B-0">
          <g class="label"><foreignObject width="0" height="0"><div><span class="edgeLabel"></span></div></foreignObject></g>
        </g>
        <g class="edgeLabel" id="active-label-2" data-id="L-B-C-1">
          <g class="label"><foreignObject width="60" height="20"><div><span class="edgeLabel">Valid Label</span></div></foreignObject></g>
        </g>
      </g>
    </svg>`;

    const enhanced = styleSvg(rawSvg, 'TD', DEFAULT_SETTINGS, palette, false);
    assert.ok(!enhanced.includes('id="empty-label-1"'), 'Empty edge label should be completely removed from DOM');
    assert.ok(enhanced.includes('id="active-label-2"'), 'Non-empty edge label should be preserved');
    assert.ok(enhanced.includes('Valid Label'), 'Valid label content should remain');
  });

  it('expands diagram spacing adaptively when long edge labels or high fan-out branches exist', () => {
    const simpleDiag = `flowchart TD\n  A --> B\n  B --> C`;
    const simpleSpacing = computeDiagramSpacing(simpleDiag, 'TD');
    assert.equal(simpleSpacing.nodeSpacing, 50);
    assert.equal(simpleSpacing.rankSpacing, 60);

    const complexDiag = `flowchart TD
      A{"What is the binding constraint?"}
      A -->|Balanced, general| B["M family"]
      A -->|CPU-bound| C["C family"]
      A -->|Memory-bound| D["R or X family"]
      A -->|Storage IOPS| E["I family with instance store"]
      A -->|GPU or accelerator| F["P, G, Inf, or Trn family"]
      A -->|Low and spiky| G["T family — burstable"]
    `;
    const complexSpacing = computeDiagramSpacing(complexDiag, 'TD');
    // Long edge labels and 6 branches must expand nodeSpacing and rankSpacing significantly
    assert.ok(complexSpacing.nodeSpacing >= 110, `Expected nodeSpacing >= 110, got ${complexSpacing.nodeSpacing}`);
    assert.ok(complexSpacing.rankSpacing >= 85, `Expected rankSpacing >= 85, got ${complexSpacing.rankSpacing}`);
  });

  it('separates multi-branch sibling edge labels into disjoint horizontal intervals without overlap', () => {
    const rawSvg = `<svg id="test-multibranch" class="mermaid">
      <g id="flowchart-root-0" class="node default"><polygon points="500,60 560,90 500,120 440,90"/></g>
      <g id="flowchart-n1-1" class="node default"><rect x="60" y="180" width="80" height="40"/></g>
      <g id="flowchart-n2-2" class="node default"><rect x="220" y="180" width="80" height="40"/></g>
      <g id="flowchart-n3-3" class="node default"><rect x="360" y="180" width="80" height="40"/></g>
      <g class="edgePaths">
        <path id="L-root-n1-0" class="flowchart-link" d="M500,120L100,120L100,180"/>
        <path id="L-root-n2-1" class="flowchart-link" d="M500,120L260,120L260,180"/>
        <path id="L-root-n3-2" class="flowchart-link" d="M500,120L400,120L400,180"/>
      </g>
      <g class="edgeLabels">
        <g class="edgeLabel" data-id="L-root-n1-0"><g class="label"><foreignObject width="100" height="20"><div><span>Balanced, general</span></div></foreignObject></g></g>
        <g class="edgeLabel" data-id="L-root-n2-1"><g class="label"><foreignObject width="70" height="20"><div><span>CPU-bound</span></div></foreignObject></g></g>
        <g class="edgeLabel" data-id="L-root-n3-2"><g class="label"><foreignObject width="80" height="20"><div><span>Memory-bound</span></div></foreignObject></g></g>
      </g>
    </svg>`;

    const enhanced = styleSvg(rawSvg, 'TD', DEFAULT_SETTINGS, palette, false);
    // Extract translate X coordinates of all 3 labels
    const matches = [...enhanced.matchAll(/class="edgeLabel"[^>]*transform="translate\(([-0-9.]+),/g)];
    assert.equal(matches.length, 3, 'All 3 non-empty labels should have transforms');
    const xCoords = matches.map(m => parseFloat(m[1]!)).sort((a, b) => a - b);
    // Verify each label is spaced far apart (at least 50px between centers)
    assert.ok(xCoords[1]! - xCoords[0]! >= 50, `Distance between label 0 and 1 should be >= 50, got ${xCoords[1]! - xCoords[0]!}`);
    assert.ok(xCoords[2]! - xCoords[1]! >= 50, `Distance between label 1 and 2 should be >= 50, got ${xCoords[2]! - xCoords[1]!}`);
  });

  it('preserves state diagram transition paths and formats barbEnd arrow markers cleanly', () => {
    const originalD = 'M100,50 C100,75 150,75 150,100';
    const stateSvg = `<svg id="test-state" class="mermaid">
      <defs>
        <marker id="statediagram-barbEnd" class="marker statediagram" viewBox="0 0 20 14" refX="19" refY="7">
          <path d="M 19,7 L9,13 L14,7 L9,1 Z" stroke-width="1.5"/>
        </marker>
      </defs>
      <g class="edgePaths">
        <g class="edgePath"><path class="path" d="${originalD}"/></g>
      </g>
    </svg>`;

    const enhanced = styleSvg(stateSvg, '', DEFAULT_SETTINGS, palette, false);
    // Path d in state diagram is untouched by flowchart orthogonal router
    assert.ok(enhanced.includes(`d="${originalD}"`), 'Curved transition path in state diagram should remain untouched');
    // Marker is formatted with crisp triangle, correct refY=7 and stroke-width 0
    assert.ok(enhanced.includes('d="M 9,2 L 19,7 L 9,12 Z"'), 'Marker should be formatted into crisp state triangle');
    assert.ok(enhanced.includes('refY="7"'), 'Marker refY should remain centered at 7');
    assert.ok(enhanced.includes('stroke-width="0"'), 'Marker path stroke-width should be 0');
  });

  it('resolves kanban column header overlaps by shifting cards down and expanding column rect', () => {
    const kanbanSvg = `<svg id="test-kanban" class="mermaid" viewBox="0 0 400 300" height="300">
      <g class="cluster" id="backlog">
        <rect x="10" y="10" width="180" height="200"/>
        <g class="cluster-label" transform="translate(100, 20)"><text>📋 Ready for Planning</text></g>
      </g>
      <g id="flowchart-task1-0" class="node default" transform="translate(100, 25)">
        <rect width="160" height="40" x="-80" y="-20"/>
        <g class="label"><text>Task 1 text</text></g>
      </g>
      <g id="flowchart-task2-1" class="node default" transform="translate(100, 75)">
        <rect width="160" height="40" x="-80" y="-20"/>
        <g class="label"><text>Task 2 text</text></g>
      </g>
    </svg>`;

    const enhanced = styleSvg(kanbanSvg, '', DEFAULT_SETTINGS, palette, false);
    // Verify task 1 has been shifted down away from header (originally translate(100, 25))
    const task1Match = enhanced.match(/id="flowchart-task1-0"[^>]*transform="translate\(\s*100\s*,\s*([-\d.]+)\s*\)/);
    assert.ok(task1Match, 'Task 1 should have a translate transform');
    const task1Y = parseFloat(task1Match[1]!);
    assert.ok(task1Y >= 45, `Task 1 Y coordinate should be >= 45 to clear header, got ${task1Y}`);

    // Verify cluster rect height is expanded (originally 200)
    const rectMatch = enhanced.match(/<rect[^>]*width="180"[^>]*height="([-\d.]+)"/);
    assert.ok(rectMatch, 'Cluster rect should have updated height');
    const newHeight = parseFloat(rectMatch[1]!);
    assert.ok(newHeight > 200, `Cluster height should be expanded beyond 200, got ${newHeight}`);
  });

  it('normalizes dark-mode C4 #444444 lines and timeline event text to high-contrast palette colors', () => {
    const darkPalette = resolvePaletteData('multi', 'cool', 'slate', true);
    const mixedSvg = `<svg id="test-contrast" class="mermaid">
      <g class="c4">
        <line class="relationshipLine" stroke="#444444" x1="0" y1="0" x2="100" y2="100"/>
        <text class="relationshipLabel" fill="#444444">Relates To</text>
      </g>
      <g class="timeline-event">
        <text fill="#000000">Timeline Event 2024</text>
      </g>
    </svg>`;

    const enhanced = styleSvg(mixedSvg, '', DEFAULT_SETTINGS, darkPalette, true);
    // #444444 stroke and fill are normalized to palette colors
    assert.ok(!enhanced.includes('stroke="#444444"'), 'Hardcoded #444444 stroke should be replaced in dark mode');
    assert.ok(!enhanced.includes('fill="#444444"'), 'Hardcoded #444444 text fill should be replaced in dark mode');
    assert.ok(!enhanced.includes('fill="#000000"'), 'Black timeline text fill should be replaced in dark mode');
    assert.ok(enhanced.includes(`stroke="${darkPalette.line}"`), 'Relationship line should use palette line color');
    assert.ok(enhanced.includes(`fill="${darkPalette.text}"`), 'Text should use palette text color');
  });

  it('resolves Sankey diagram label collisions by staggering overlapping Y coordinates', () => {
    const palette = resolvePaletteData('multi', 'cool', 'slate', false);
    // Middle column collision: Electricity at x=212, y=192 and Data Center at x=387, y=192
    const sankeySvg = `<svg id="sankey-test" class="mermaid">
      <g class="node-labels">
        <text id="lbl1" x="212.67" y="192.86" text-anchor="start">Electricity&#10;100</text>
        <text id="lbl2" x="387.33" y="192.48" text-anchor="end">Data Center Infrastructure&#10;100</text>
      </g>
    </svg>`;

    const enhanced = styleSvg(sankeySvg, '', DEFAULT_SETTINGS, palette, false);
    const m1 = enhanced.match(/id="lbl1"[^>]*y="([-\d.]+)"/);
    const m2 = enhanced.match(/id="lbl2"[^>]*y="([-\d.]+)"/);

    assert.ok(m1, 'Label 1 should have Y attribute');
    assert.ok(m2, 'Label 2 should have Y attribute');

    const y1 = parseFloat(m1[1]!);
    const y2 = parseFloat(m2[1]!);

    // Vertical distance should now be >= 40px to prevent overlap
    const vDist = Math.abs(y1 - y2);
    assert.ok(vDist >= 40, `Sankey labels should be separated vertically by >= 40px, got ${vDist}`);
  });

  it('resolves C4 architecture relationship crowding and generates protective pill backgrounds', () => {
    const palette = resolvePaletteData('multi', 'cool', 'slate', false);
    const c4Svg = `<svg id="c4-test" class="mermaid">
      <g class="relationships">
        <g class="relationship">
          <text class="relationshipLabel" x="840" y="403">Reads and writes notes locally</text>
        </g>
        <g class="relationship">
          <text class="relationshipLabel" x="1010" y="403">Syncs encrypted note snapshots</text>
        </g>
      </g>
    </svg>`;

    const enhanced = styleSvg(c4Svg, '', DEFAULT_SETTINGS, palette, false);
    // Verify protective pill backgrounds are added
    assert.ok(enhanced.includes('class="c4-rel-pill"'), 'C4 relationship pill background rects should be generated');

    // Verify Y coordinates are staggered to prevent collision
    const yMatches = [...enhanced.matchAll(/class="relationshipLabel"[^>]*y="([-\d.]+)"/g)].map(m => parseFloat(m[1]!));
    assert.equal(yMatches.length, 2);
    const vDist = Math.abs(yMatches[0]! - yMatches[1]!);
    assert.ok(vDist >= 35, `C4 relationship labels should be staggered vertically by >= 35px, got ${vDist}`);
  });

  it('enhances SysML requirement diagrams with palette surface fills and borders', () => {
    const palette = resolvePaletteData('multi', 'cool', 'slate', true);
    const reqSvg = `<svg id="req-test" class="requirementDiagram mermaid">
      <g class="node">
        <rect class="reqBox basic" width="200" height="120" fill="#000000" stroke="#444444"/>
        <text class="reqTitle">Req_Performance</text>
      </g>
      <g class="node">
        <rect class="basic" width="160" height="80" fill="#000000"/>
        <text class="nodeLabel">&lt;&lt;Element&gt;&gt; Engine</text>
      </g>
      <g class="edgeLabels">
        <rect class="labelBkg" width="80" height="24"/>
        <text>&lt;&lt;satisfies&gt;&gt;</text>
      </g>
    </svg>`;

    const enhanced = styleSvg(reqSvg, '', DEFAULT_SETTINGS, palette, true);
    assert.ok(enhanced.includes(`fill="${palette.surface}"`), 'Requirement box should use palette surface fill');
    assert.ok(enhanced.includes(`stroke="${palette.border}"`), 'Requirement box should use palette border');
    assert.ok(enhanced.includes(`fill="${palette.text}"`), 'Requirement text should use palette text fill');
  });
});
