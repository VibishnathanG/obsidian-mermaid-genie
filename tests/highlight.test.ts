import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ancestorPath, type PathEdge } from '../src/highlight';

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
});
