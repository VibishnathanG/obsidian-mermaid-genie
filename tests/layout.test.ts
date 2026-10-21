import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { orthogonalPath, roundPath, routePoints } from '../src/layout';

describe('Layout & Connector Routing', () => {
  it('computes clean orthogonal paths between points', () => {
    const points: [number, number][] = [[10, 10], [50, 80]];
    const path = orthogonalPath(points, 'TD', 10, 80);
    assert.ok(path?.startsWith('M10,10L10,45L50,45L50,80'));
  });

  it('rounds orthogonal corners using quadratic beziers', () => {
    const raw = 'M10,10L10,40L50,40L50,80';
    const rounded = roundPath(raw, 4);
    assert.ok(rounded.includes('Q10,40'));
    assert.ok(rounded.includes('Q50,40'));
  });

  it('extracts route points from svg path string', () => {
    const d = 'M10,10L20,20Q30,30 40,40L50,50';
    const points = routePoints(d);
    assert.ok(points && points.length > 2);
    assert.deepEqual(points?.[0], [10, 10]);
  });
});
