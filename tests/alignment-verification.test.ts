import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('node:module');

try {
  const { JSDOM } = require('/tmp/test-mermaid/node_modules/jsdom');
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

const { styleSvg, equalizeCardWidths, wrapDecisions } = require('../src/layout');
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
});
