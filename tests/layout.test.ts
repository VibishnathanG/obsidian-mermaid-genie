import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { orthogonalPath, curvedConnectorPath, roundPath, routePoints, equalizeCardWidths } from '../src/layout';
import { softenOrthogonalPath } from '../src/rounded-path';

describe('Layout & Connector Routing', () => {
  it('computes clean orthogonal paths between points', () => {
    const points: [number, number][] = [[10, 10], [50, 80]];
    const path = orthogonalPath(points, 'TD', 10, 80);
    assert.ok(path?.startsWith('M10,10L10,45L50,45L50,80'));
  });

  it('computes smooth bended curved paths for displaced connector anchors', () => {
    const points: [number, number][] = [[10, 10], [50, 80]];
    const path = curvedConnectorPath(points, 'TD', 10, 80);
    assert.ok(path?.startsWith('M10,10Q10,45 30,45Q50,45 50,80'));
  });

  it('rounds orthogonal corners using quadratic beziers', () => {
    const raw = 'M10,10L10,40L50,40L50,80';
    const rounded = roundPath(raw, 4);
    assert.ok(rounded.includes('Q10,40'));
    assert.ok(rounded.includes('Q50,40'));
  });

  it('softens orthogonal path corners without shifting endpoints', () => {
    const raw = 'M0,0L95,0Q100,0 100,5L100,96';
    const softened = softenOrthogonalPath(raw, 12);
    assert.equal(softened, 'M0,0L88,0Q100,0 100,12L100,96');
  });

  it('extracts route points from svg path string', () => {
    const d = 'M10,10L20,20Q30,30 40,40L50,50';
    const points = routePoints(d);
    assert.ok(points && points.length > 2);
    assert.deepEqual(points?.[0], [10, 10]);
  });

  it('equalizes card widths in the same layer without error', () => {
    // Basic smoke check for DOM environment or simulated document
    assert.doesNotThrow(() => {
      equalizeCardWidths({ querySelectorAll: () => [] } as unknown as Element, 'TD');
    });
  });

  it('skips card width equalization on vertical diagrams to prevent horizontal collisions', () => {
    let queryCalled = false;
    const fakeDoc = {
      querySelectorAll: () => {
        queryCalled = true;
        return [];
      },
    } as unknown as Element;
    equalizeCardWidths(fakeDoc, 'TD');
    assert.equal(queryCalled, false, 'Should return immediately for TD without touching nodes');
    equalizeCardWidths(fakeDoc, 'TB');
    assert.equal(queryCalled, false, 'Should return immediately for TB without touching nodes');
  });
});
