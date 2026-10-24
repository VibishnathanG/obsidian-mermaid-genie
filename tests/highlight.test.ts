import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { ancestorPath, createPathController, highlightAncestors, type PathEdge } from '../src/highlight';

describe('Ancestor Path Traversal', () => {
  it('traverses incoming forward paths to find ancestors', () => {
    const edges: PathEdge[] = [
      { from: 'A', to: 'B', id: 'e1' },
      { from: 'B', to: 'C', id: 'e2' },
      { from: 'X', to: 'B', id: 'e3' },
      { from: 'C', to: 'D', id: 'e4' },
    ];

    const result = ancestorPath(edges, 'C');
    assert.deepEqual([...result.nodes].sort(), ['A', 'B', 'C', 'X']);
    assert.deepEqual([...result.edges].sort(), ['e1', 'e2', 'e3']);
  });

  it('stops at root nodes and handles isolated targets', () => {
    const edges: PathEdge[] = [
      { from: 'A', to: 'B', id: 'e1' },
    ];
    const result = ancestorPath(edges, 'A');
    assert.deepEqual([...result.nodes], ['A']);
    assert.equal(result.edges.size, 0);
  });

  it('createPathController optimizes hover and ignores non-diagram elements', () => {
    const dom = new JSDOM(`
      <div class="note">
        <p class="regular-text">Paragraph</p>
        <div class="mermaid">
          <svg class="mfe-enhanced">
            <g class="node" data-mpe-key="A" id="node-A"><rect></rect></g>
            <g class="node" data-mpe-key="B" id="node-B"><rect></rect></g>
            <path class="flowchart-link" data-id="e1" data-mpe-from="A" data-mpe-to="B" data-mpe-forward="true"></path>
          </svg>
        </div>
      </div>
    `);
    const doc = dom.window.document;
    const settings = { pathHighlight: true, hoverDelay: 50 };
    const timeouts: { cb: () => void; delay: number }[] = [];
    const mockTimers = {
      setTimeout: (cb: () => void, delay: number) => {
        timeouts.push({ cb, delay });
        return timeouts.length;
      },
      clearTimeout: () => {},
    };

    const controller = createPathController(doc, () => settings, mockTimers);

    // 1. Hovering outside diagram should do nothing
    const p = doc.querySelector('.regular-text')!;
    controller.enter({ target: p } as any);
    const svg = doc.querySelector('svg.mfe-enhanced')!;
    assert.equal(svg.classList.contains('mpe-tracing'), false);

    // 2. Hovering node B should trace ancestors (A and B)
    const nodeB = doc.querySelector('#node-B')!;
    controller.enter({ target: nodeB } as any);
    assert.equal(svg.classList.contains('mpe-tracing'), true);
    assert.equal(nodeB.classList.contains('mpe-on-path'), true);
    const nodeA = doc.querySelector('#node-A')!;
    assert.equal(nodeA.classList.contains('mpe-on-path'), true);

    // 3. Hovering the same node again should be a no-op
    controller.enter({ target: nodeB } as any);
    assert.equal(svg.classList.contains('mpe-tracing'), true);

    // 4. Leaving node B schedules reset timer
    controller.leave({ target: nodeB, relatedTarget: p } as any);
    assert.equal(timeouts.length, 1);
    // Execute reset timer
    timeouts[0]!.cb();
    assert.equal(svg.classList.contains('mpe-tracing'), false);

    controller.dispose();
  });
});
