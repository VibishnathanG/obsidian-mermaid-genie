import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('node:module');

// Mock Obsidian runtime exports for unit testing in Node
const originalLoad = Module._load;
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'obsidian') {
    return {
      Platform: { isDesktopApp: true, isMobile: false },
      setIcon: (el: HTMLElement, iconId: string) => {
        el.setAttribute('data-icon', iconId);
      },
      Menu: class {
        addItem(fn: (item: any) => any) {
          const item = {
            setTitle: () => item,
            setIcon: () => item,
            onClick: () => item,
          };
          fn(item);
          return this;
        }
        addSeparator() { return this; }
        showAtMouseEvent() {}
      },
      Notice: class {},
      MarkdownRenderChild: class {
        constructor(public containerEl: HTMLElement) {}
        load() {}
        onload() {}
        unload() {}
        onunload() {}
      },
      SuggestModal: class {
        constructor(public app: any) {}
        setPlaceholder() {}
        open() {}
        close() {}
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const {
  svgNaturalSize,
  getBlockScale,
  setBlockScale,
  zoomBlockBy,
  resetBlockZoom,
  setFullscreenIcon,
  openFullscreenModal,
  INLINE_MIN_SCALE,
  INLINE_MAX_SCALE,
  INLINE_ZOOM_STEP,
} = require('../src/zoom-fullscreen');
const { decorateMermaidBlock } = require('../src/export-controls');
Module._load = originalLoad;

describe('Zoom and Fullscreen Capability Tests', () => {
  it('correctly extracts natural dimensions from SVG viewBox and attributes', () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
      <svg id="s1" viewBox="0 0 800 600"></svg>
      <svg id="s2" width="500" height="400"></svg>
      <svg id="s3"></svg>
    </body></html>`);
    const doc = dom.window.document;

    const s1 = doc.getElementById('s1') as unknown as SVGSVGElement;
    assert.deepEqual(svgNaturalSize(s1), { width: 800, height: 600 });

    const s2 = doc.getElementById('s2') as unknown as SVGSVGElement;
    assert.deepEqual(svgNaturalSize(s2), { width: 500, height: 400 });

    const s3 = doc.getElementById('s3') as unknown as SVGSVGElement;
    assert.equal(svgNaturalSize(s3), null);
  });

  it('retrieves default scale 1 and tracks updated block scale', () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="block"></div></body></html>`);
    const block = dom.window.document.getElementById('block') as HTMLElement;

    assert.equal(getBlockScale(block), 1);

    block.dataset.mgScale = '1.44';
    assert.equal(getBlockScale(block), 1.44);

    block.dataset.mgScale = 'invalid';
    assert.equal(getBlockScale(block), 1);
  });

  it('updates SVG width, height, and classes on setBlockScale, and restores on reset', () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id="block" class="mermaid">
        <svg class="mfe-enhanced" viewBox="0 0 1000 500" style="width: 1000px; height: 500px; max-width: 100%;"></svg>
      </div>
    </body></html>`);
    const doc = dom.window.document;
    const block = doc.getElementById('block') as HTMLElement;
    const svg = block.querySelector('svg') as SVGSVGElement;

    // Zoom in to 1.5x
    setBlockScale(block, 1.5);
    assert.equal(getBlockScale(block), 1.5);
    assert.equal(block.classList.contains('mermaid-genie-scaled'), true);
    assert.equal(svg.style.width, '1500px');
    assert.equal(svg.style.height, '750px');
    assert.equal(svg.style.maxWidth, 'none');

    // Zoom out using zoomBlockBy
    zoomBlockBy(block, 0.5);
    assert.equal(getBlockScale(block), 0.75);
    assert.equal(svg.style.width, '750px');
    assert.equal(svg.style.height, '375px');

    // Reset zoom back to 1.0
    resetBlockZoom(block);
    assert.equal(getBlockScale(block), 1);
    assert.equal(block.classList.contains('mermaid-genie-scaled'), false);
    assert.equal(block.dataset.mgScale, undefined);
    assert.equal(svg.style.maxWidth, '100%');
  });

  it('clamps zoom scales strictly between INLINE_MIN_SCALE and INLINE_MAX_SCALE', () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id="block" class="mermaid">
        <svg class="mfe-enhanced" viewBox="0 0 1000 500"></svg>
      </div>
    </body></html>`);
    const block = dom.window.document.getElementById('block') as HTMLElement;

    setBlockScale(block, 100);
    assert.equal(getBlockScale(block), INLINE_MAX_SCALE);

    setBlockScale(block, 0.01);
    assert.equal(getBlockScale(block), INLINE_MIN_SCALE);
  });

  it('creates clean 4-corner brackets fullscreen icon', () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body><button id="btn"></button></body></html>`);
    const btn = dom.window.document.getElementById('btn') as HTMLElement;

    setFullscreenIcon(btn);
    const svg = btn.querySelector('svg');
    assert.ok(svg, 'SVG icon is created');
    assert.equal(svg.getAttribute('viewBox'), '0 0 16 16');
    const polylines = svg.querySelectorAll('polyline');
    assert.equal(polylines.length, 4, 'Has 4 corner bracket polylines');
  });

  it('opens fullscreen modal with Obsidian background, Genie styling, and clean controls', () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body class="theme-dark">
      <div id="block" class="mermaid">
        <svg class="mfe-enhanced" viewBox="0 0 600 400" style="--mpe-node: #273449; --mpe-border: #7186a2;">
          <g class="node"><rect width="100" height="40"></rect></g>
        </svg>
      </div>
    </body></html>`);
    const doc = dom.window.document;
    (globalThis as any).document = doc;
    (globalThis as any).window = dom.window;

    const sourceSvg = doc.querySelector('svg.mfe-enhanced') as SVGSVGElement;
    let exportedAction: string | null = null;

    openFullscreenModal({
      app: {} as any,
      sourceSvg,
      sourcePath: 'note.md',
      onExport: (_svg: any, action: string) => {
        exportedAction = action;
      },
    });

    const modal = doc.querySelector('.mermaid-genie-fullscreen-modal');
    assert.ok(modal, 'Fullscreen modal element exists in DOM');

    // Controls dock
    const controls = modal.querySelector('.mermaid-genie-modal-controls');
    assert.ok(controls, 'Modal controls dock exists');

    // Buttons
    const buttons = controls.querySelectorAll('button.mermaid-genie-btn');
    assert.equal(buttons.length, 5, 'Has zoom in, zoom out, reset, export, and close buttons');

    // Scale indicator
    const scaleIndicator = controls.querySelector('.mermaid-genie-scale-indicator');
    assert.ok(scaleIndicator, 'Scale indicator exists');
    assert.equal(scaleIndicator.textContent, '100%');

    // SVG clone in modal preserves classes and custom properties
    const clonedSvg = modal.querySelector('svg.mfe-enhanced') as SVGSVGElement;
    assert.ok(clonedSvg, 'Cloned SVG exists in modal');
    assert.notEqual(clonedSvg, sourceSvg, 'Cloned SVG is distinct from source SVG');
    assert.equal(clonedSvg.style.getPropertyValue('--mpe-node'), '#273449');
    assert.equal(clonedSvg.style.getPropertyValue('--mpe-border'), '#7186a2');

    // Ensure NO legacy invert filter or prohibited theme classes exist
    assert.equal(modal.classList.contains('mermaid-zoom-legacy-invert'), false);
    assert.equal(modal.querySelector('.mermaid-zoom-legacy-invert'), null);

    // Close modal via Escape key
    const escEvent = new dom.window.KeyboardEvent('keydown', { key: 'Escape' });
    doc.dispatchEvent(escEvent);

    assert.equal(doc.querySelector('.mermaid-genie-fullscreen-modal'), null, 'Modal cleanly removed on Escape');
  });

  it('decorateMermaidBlock injects controls into mermaid blocks and is idempotent', () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id="block1" class="mermaid">
        <svg viewBox="0 0 500 300"><text>Flow</text></svg>
      </div>
      <div id="block2" class="mermaid">
        <!-- no svg -->
      </div>
    </body></html>`);
    const doc = dom.window.document;

    // Polyfill Obsidian element helpers for JSDOM test
    (dom.window.Element.prototype as any).createDiv = function (opts: any) {
      const el = doc.createElement('div');
      if (opts?.cls) el.className = opts.cls;
      this.appendChild(el);
      return el;
    };
    (dom.window.Element.prototype as any).createEl = function (tag: string, opts: any) {
      const el = doc.createElement(tag);
      if (opts?.cls) el.className = opts.cls;
      if (opts?.attr) {
        for (const [k, v] of Object.entries(opts.attr)) el.setAttribute(k, String(v));
      }
      this.appendChild(el);
      return el;
    };

    const block1 = doc.getElementById('block1') as HTMLElement;
    const block2 = doc.getElementById('block2') as HTMLElement;

    decorateMermaidBlock(block1, { workspace: { getActiveFile: () => null } } as any, {} as any, {} as any, () => true);

    assert.ok(block1.classList.contains('mermaid-genie-container'), 'block1 gets container class');
    const actions = block1.querySelector('.mermaid-genie-actions');
    assert.ok(actions, 'Actions toolbar created on block1');

    const buttons = actions.querySelectorAll('button.mermaid-genie-btn');
    assert.equal(buttons.length, 5, 'Contains 5 action buttons: export, zoom out, zoom in, reset, fullscreen');

    // Calling decorateMermaidBlock a second time must NOT create duplicate actions
    decorateMermaidBlock(block1, { workspace: { getActiveFile: () => null } } as any, {} as any, {} as any, () => true);
    assert.equal(block1.querySelectorAll('.mermaid-genie-actions').length, 1, 'Actions toolbar remains singular');

    // block2 without svg should not get decorated
    decorateMermaidBlock(block2, { workspace: { getActiveFile: () => null } } as any, {} as any, {} as any, () => true);
    assert.equal(block2.querySelector('.mermaid-genie-actions'), null, 'block2 without svg is not decorated');
  });
});
