import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { flowchartGroups, type FlowchartEdge, type FlowchartNode } from '../src/flowchart-groups';
import { flowchartSourceId } from '../src/flowchart-colors';

const graph = (links: string[], nodes: FlowchartNode[] = [], extra: FlowchartEdge[] = []): Map<string, number> => {
  const edges = links.map(link => {
    const [start, end] = link.split('>');
    return { start: start!, end: end! };
  });
  const ids = new Set([...edges, ...extra].flatMap(edge => [edge.start, edge.end]));
  return flowchartGroups(
    [...ids].map(id => nodes.find(node => node.id === id) ?? { id }).concat(nodes.filter(node => !ids.has(node.id))),
    [...edges, ...extra]
  );
};

describe('Flowchart Groups & Structural Colors', () => {
  it('extracts source IDs without render ID or node counter', () => {
    assert.equal(flowchartSourceId('first-flowchart-Order-0', 'first'), 'Order');
    assert.equal(flowchartSourceId('second-flowchart-step-2-99', 'second'), 'step-2');
    assert.equal(flowchartSourceId('render-flowchart-MyNode-1', 'render'), 'MyNode');
  });

  it('keeps a continuous chain in one color group', () => {
    const before = graph(['A>B', 'B>C']);
    const after = graph(['A>X', 'X>B', 'B>C']);
    assert.equal(new Set(after.values()).size, 1);
    for (const [id, color] of before) {
      assert.equal(after.get(id), color);
    }
  });

  it('separates substantial branches into distinct color groups', () => {
    const colors = graph(['A>B', 'B>C', 'C>D', 'B>E', 'E>F']);
    assert.equal(colors.get('A'), colors.get('B'));
    assert.equal(colors.get('C'), colors.get('D'));
    assert.equal(colors.get('E'), colors.get('F'));
    assert.equal(new Set([colors.get('A'), colors.get('C'), colors.get('E')]).size, 3);
  });

  it('absorbs terminal twigs instead of creating unnecessary colors', () => {
    const colors = graph(['A>B', 'B>C', 'B>D', 'D>E']);
    assert.equal(new Set(colors.values()).size, 1);
  });

  it('handles subgraphs cleanly', () => {
    const nodes: FlowchartNode[] = [
      { id: 'Outer', isGroup: true },
      { id: 'Inner', parentId: 'Outer', isGroup: true },
      { id: 'A', parentId: 'Outer' },
      { id: 'B', parentId: 'Outer' },
      { id: 'C', parentId: 'Inner' },
      { id: 'D', parentId: 'Inner' },
    ];
    const colors = graph(['A>C', 'B>D'], nodes);
    assert.equal(colors.get('Outer'), colors.get('A'));
    assert.equal(colors.get('Inner'), colors.get('C'));
    assert.equal(colors.get('A'), colors.get('B'));
    assert.equal(colors.get('C'), colors.get('D'));
    assert.notEqual(colors.get('A'), colors.get('C'));
  });
});
