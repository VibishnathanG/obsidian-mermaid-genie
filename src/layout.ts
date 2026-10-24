import { textOnFill, type PaletteData } from './colors';
import { applyFlowchartColors } from './flowchart-colors';
import { softenOrthogonalPath } from './rounded-path';
import type { GenieSettings } from './settings';

export type Direction = 'TD' | 'TB' | 'BT' | 'LR' | 'RL';
export type Point = [number, number];
type Axis = 0 | 1;
type Edge = [null, string, string];

export interface Bounds {
  center: Point;
  min: Point;
  max: Point;
}

export interface NodeBounds extends Bounds {
  node: Element;
}

interface LayoutNode {
  node: Element;
  key: string;
  center: Point;
  incoming: number | undefined;
}

interface LayoutEdge {
  from: LayoutNode;
  to: LayoutNode;
}

const edgeIndexes = new WeakMap<Document, Map<string, Edge | null>>();

export function resolveEdge(doc: Document, path: Element): Edge | null {
  let index = edgeIndexes.get(doc);
  if (!index) {
    index = new Map();
    const keys = [...doc.querySelectorAll('g.node')]
      .map(n => n.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1])
      .filter((key): key is string => key !== undefined);

    for (const from of keys) {
      for (const to of keys) {
        const prefix = `L_${from}_${to}_`;
        index.set(prefix, index.has(prefix) ? null : [null, from, to]);
        const hyphenPrefix = `L-${from}-${to}-`;
        index.set(hyphenPrefix, index.has(hyphenPrefix) ? null : [null, from, to]);
      }
    }
    edgeIndexes.set(doc, index);
  }

  // Check data attributes first
  const dataFrom = path.getAttribute('data-mpe-from') || path.parentElement?.getAttribute('data-mpe-from');
  const dataTo = path.getAttribute('data-mpe-to') || path.parentElement?.getAttribute('data-mpe-to');
  if (dataFrom && dataTo) return [null, dataFrom, dataTo];

  // Check class list for LS-from LE-to
  const cls = (path.getAttribute('class') || '') + ' ' + (path.parentElement?.getAttribute('class') || '');
  const startMatch = /\bLS-([^\s]+)\b/.exec(cls);
  const endMatch = /\bLE-([^\s]+)\b/.exec(cls);
  if (startMatch && endMatch) {
    return [null, startMatch[1]!, endMatch[1]!];
  }

  const id = path.getAttribute('data-id') || path.id || path.parentElement?.id || '';
  const idPrefix = id.replace(/[^_]*$/, '');
  const idMatch = /^L[_-](.+?)[_-](.+?)[_-]/.exec(id);
  if (idMatch) {
    return [null, idMatch[1]!, idMatch[2]!];
  }

  return index.get(idPrefix) || null;
}

export function orthogonalPath(
  points: Point[],
  direction: Direction | '',
  sourceLimit?: number,
  targetLimit?: number,
  branchLevel?: number
): string | null {
  const vertical = /^(TD|TB|BT)$/.test(direction);
  const axis = vertical ? 1 : 0;
  const cross: Axis = axis === 0 ? 1 : 0;
  const first = points[0], last = points[points.length - 1];
  if (!first || !last) return null;
  const sign = Math.sign(last[axis] - first[axis]);
  if (!sign) return null;
  const a = sourceLimit ?? first[axis], b = targetLimit ?? last[axis];
  if (sign * (b - a) <= 0) return null;
  const level = branchLevel ?? (a + b) / 2;
  const middle = sign * (level - a) > 0 && sign * (b - level) > 0 ? level : (a + b) / 2;
  const p: Point = [...first], q: Point = [...last];
  p[axis] = middle;
  q[axis] = middle;
  const route = Math.abs(first[cross] - last[cross]) < 0.01
    ? [first, last]
    : [first, p, q, last];
  return route
    .filter((pt, i) => !i || pt.some((v, j) => Math.abs(v - route[i - 1]![j]!) > 0.001))
    .map((pt, i) => `${i ? 'L' : 'M'}${pt.join(',')}`)
    .join('');
}

/** Computes smooth bended curved paths for flowchart connectors. */
export function curvedConnectorPath(
  points: Point[],
  direction: Direction | '',
  sourceLimit?: number,
  targetLimit?: number
): string | null {
  const isVertical = /^(TD|TB|BT)$/.test(direction);
  const axis = isVertical ? 1 : 0;
  const cross = isVertical ? 0 : 1;
  const first = points[0], last = points[points.length - 1];
  if (!first || !last) return null;

  const delta = last[axis] - first[axis];
  const sign = Math.sign(delta);
  if (!sign) return null;

  const a = sourceLimit ?? first[axis];
  const b = targetLimit ?? last[axis];
  if (sign * (b - a) <= 0) return null;

  const crossDist = Math.abs(last[cross] - first[cross]);

  // Straight line if aligned on the cross axis
  if (crossDist < 2) {
    return `M${first.join(',')}L${last.join(',')}`;
  }

  // Smooth bended S-curve using quadratic Bezier arcs
  const midAxis = (first[axis] + last[axis]) / 2;
  const midCross = (first[cross] + last[cross]) / 2;

  const midPoint: Point = isVertical ? [midCross, midAxis] : [midAxis, midCross];
  const cp1: Point = isVertical ? [first[cross], midAxis] : [midAxis, first[cross]];
  const cp2: Point = isVertical ? [last[cross], midAxis] : [midAxis, last[cross]];

  return `M${first.join(',')}Q${cp1.join(',')} ${midPoint.join(',')}Q${cp2.join(',')} ${last.join(',')}`;
}

function transformOffset(element: Node | null): Point | undefined {
  const offset: Point = [0, 0];
  for (let el = element; el; el = el.parentNode) {
    const transform = el.nodeType === 1
      ? (el as Element).getAttribute('transform') || ''
      : '';
    if (!transform) continue;
    const t = transform.match(/^\s*translate\(\s*([-+\d.eE]+)(?:[,\s]+([-+\d.eE]+))?\s*\)\s*$/);
    if (!t) return undefined;
    offset[0] += Number(t[1]);
    offset[1] += Number(t[2] ?? 0);
  }
  return offset;
}

function polygonHasSideCenter(points: Point[], axis: Axis, side: 'min' | 'max', centerCross: number): boolean {
  const min = Math.min(...points.map(point => point[axis]));
  const max = Math.max(...points.map(point => point[axis]));
  const boundary = side === 'min' ? min : max;
  const close = (a: number, b: number) => Math.abs(a - b) < 0.01;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    const aa = a[axis], ba = b[axis], ac = a[1 - axis], bc = b[1 - axis];
    if (close(aa, boundary) && close(ba, boundary) &&
        centerCross >= Math.min(ac, bc) - 0.01 && centerCross <= Math.max(ac, bc) + 0.01) return true;
    if (close(aa, boundary) && close(ac, centerCross)) return true;
    if (close(ba, boundary) && close(bc, centerCross)) return true;
  }
  return false;
}

export function nodeBounds(doc: Document, key: string): NodeBounds | undefined {
  const node = [...doc.querySelectorAll('g.node')].find(n => n.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1] === key);
  if (!node) return undefined;
  const shape = node.querySelector('polygon, rect, circle, ellipse');
  if (!shape) return undefined;
  const offset = transformOffset(shape);
  if (!offset) return undefined;
  let x: number[], y: number[];
  if (shape.tagName === 'polygon') {
    const source = (shape.getAttribute('points') || '').trim().split(/\s+/)
      .map(point => point.split(',').map(Number));
    if (source.length > 1 && source[0]![0] === source.at(-1)![0] && source[0]![1] === source.at(-1)![1]) source.pop();
    if (source.length < 3 || source.some(point => point.length !== 2 || !point.every(Number.isFinite))) return undefined;
    x = source.map(point => point[0]!);
    y = source.map(point => point[1]!);
    const center: Point = [(Math.min(...x) + Math.max(...x)) / 2, (Math.min(...y) + Math.max(...y)) / 2];
    for (const axis of [0, 1] as const) {
      if (!polygonHasSideCenter(source as Point[], axis, 'min', center[1 - axis]!) ||
          !polygonHasSideCenter(source as Point[], axis, 'max', center[1 - axis]!)) return undefined;
    }
  } else if (shape.tagName === 'circle') {
    const values = ['cx', 'cy', 'r'].map(name => shape.getAttribute(name));
    if (values.some(value => value === null)) return undefined;
    const [cx, cy, r] = values.map(Number);
    if (![cx, cy, r].every(Number.isFinite) || r < 0) return undefined;
    x = [cx - r, cx + r];
    y = [cy - r, cy + r];
  } else if (shape.tagName === 'ellipse') {
    const values = ['cx', 'cy', 'rx', 'ry'].map(name => shape.getAttribute(name));
    if (values.some(value => value === null)) return undefined;
    const [cx, cy, rx, ry] = values.map(Number);
    if (![cx, cy, rx, ry].every(Number.isFinite) || rx < 0 || ry < 0) return undefined;
    x = [cx - rx, cx + rx];
    y = [cy - ry, cy + ry];
  } else {
    const values = ['x', 'y', 'width', 'height'].map(name => shape.getAttribute(name));
    if (values.some(value => value === null)) return undefined;
    const [left, top, w, h] = values.map(Number);
    if (![left, top, w, h].every(Number.isFinite) || w < 0 || h < 0) return undefined;
    x = [left, left + w];
    y = [top, top + h];
  }
  const min: Point = [Math.min(...x) + offset[0], Math.min(...y) + offset[1]];
  const max: Point = [Math.max(...x) + offset[0], Math.max(...y) + offset[1]];
  return { node, center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2], min, max };
}

export function nodeLimit(doc: Document, key: string, direction: Direction | '', outgoing: boolean): number | undefined {
  const bounds = nodeBounds(doc, key);
  if (!bounds) return undefined;
  const axis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
  const forward = !/^(BT|RL)$/.test(direction);
  return (outgoing === forward) ? bounds.max[axis] : bounds.min[axis];
}

export function centerAnchor(bounds: Bounds, direction: Direction | '', travelSign: number, outgoing: boolean): Point {
  const axis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
  const cross: Axis = axis === 0 ? 1 : 0;
  const sideSign = outgoing ? travelSign : -travelSign;
  const anchor: Point = [...bounds.center];
  anchor[axis] = sideSign > 0 ? bounds.max[axis] : bounds.min[axis];
  anchor[cross] = bounds.center[cross];
  return anchor;
}

export function returnLanePath(
  points: Point[],
  direction: Direction | '',
  from?: Bounds,
  to?: Bounds,
  offset: Point = [0, 0]
): string | null {
  const vertical = /^(TD|TB|BT)$/.test(direction);
  const cross: Axis = vertical ? 0 : 1;
  const first = points[0], last = points[points.length - 1];
  if (!first || !last || !from || !to) return null;
  const values = points.map(point => point[cross]);
  const high = Math.max(...values), low = Math.min(...values);
  const lane = high > Math.max(first[cross], last[cross]) + 0.01 ? high
    : low < Math.min(first[cross], last[cross]) - 0.01 ? low : null;
  if (lane === null) return null;
  const outer = lane + offset[cross] > (from.center[cross] + to.center[cross]) / 2 ? 'max' : 'min';
  const source: Point = [...from.center], target: Point = [...to.center];
  source[cross] = from[outer][cross];
  target[cross] = to[outer][cross];

  // Move the return lane outside both blocks so connector routes cleanly.
  const laneRoot = outer === 'max'
    ? Math.max(lane + offset[cross], from.max[cross] + 18, to.max[cross] + 18)
    : Math.min(lane + offset[cross], from.min[cross] - 18, to.min[cross] - 18);
  const bend1: Point = [...source], bend2: Point = [...target];
  bend1[cross] = laneRoot;
  bend2[cross] = laneRoot;
  for (const point of [source, target, bend1, bend2]) {
    point[0] -= offset[0];
    point[1] -= offset[1];
  }
  return [source, bend1, bend2, target]
    .filter((point, i, all) => !i || point.some((v, j) => Math.abs(v - all[i - 1]![j]!) > 0.001))
    .map((point, i) => `${i ? 'L' : 'M'}${point.join(',')}`)
    .join('');
}

export function roundPath(d: string, radius = 5): string {
  const number = '[-+]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][-+]?\\d+)?';
  const segment = new RegExp(`([ML])\\s*(${number})[\\s,]+(${number})`, 'g');
  const matches = [...d.matchAll(segment)];
  if (matches.length < 3 || d.replace(segment, '').trim() ||
      matches[0]![1] !== 'M' || matches.slice(1).some(m => m[1] !== 'L')) return d;
  const points = matches.map(m => [Number(m[2]), Number(m[3])] as Point)
    .filter((p, i, all) => !i || p[0] !== all[i - 1]![0] || p[1] !== all[i - 1]![1]);
  let path = `M${points[0]!.join(',')}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1]!, b = points[i]!, c = points[i + 1]!;
    const u = [a[0] - b[0], a[1] - b[1]], v = [c[0] - b[0], c[1] - b[1]];
    const lu = Math.hypot(u[0]!, u[1]!), lv = Math.hypot(v[0]!, v[1]!);
    const orthogonal = (u[0] === 0 || u[1] === 0) &&
      (v[0] === 0 || v[1] === 0) && u[0]! * v[0]! + u[1]! * v[1]! === 0;
    if (!orthogonal || !lu || !lv) { path += `L${b.join(',')}`; continue; }
    const r = Math.min(radius, lu / 2, lv / 2);
    const before = b.map((n, j) => n + u[j]! * r / lu);
    const after = b.map((n, j) => n + v[j]! * r / lv);
    path += `L${before.join(',')}Q${b.join(',')} ${after.join(',')}`;
  }
  return path + `L${points[points.length - 1]!.join(',')}`;
}

export function routePoints(d: string): Point[] | null {
  const number = '[-+]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][-+]?\\d+)?';
  const command = new RegExp(`([ML])\\s*(${number})[\\s,]+(${number})|Q\\s*(${number})[\\s,]+(${number})[\\s,]+(${number})[\\s,]+(${number})`, 'g');
  const matches = [...d.matchAll(command)];
  if (!matches.length || matches[0]![1] !== 'M' || d.replace(command, '').trim()) return null;
  if (matches.slice(1).some(m => m[1] === 'M')) return null;
  return matches.flatMap<Point>(m => m[1] ? [[Number(m[2]), Number(m[3])]]
    : [[Number(m[4]), Number(m[5])], [Number(m[6]), Number(m[7])]])
    .filter((point, i, all) => !i || point.some((v, axis) => Math.abs(v - all[i - 1]![axis]!) > 0.001));
}

/** Equalizes the widths of rectangular cards in the same rank/layer for a clean, unified layout. */
export function equalizeCardWidths(doc: Document | Element, direction: Direction | ''): void {
  // Never equalize widths on vertical diagrams (TD/TB/BT) where sibling cards sit side-by-side horizontally,
  // as expanding widths without moving their centers causes adjacent cards to collide horizontally.
  if (!direction || /^(TD|TB|BT)$/.test(direction)) return;

  const isHorizontal = direction === 'LR' || direction === 'RL';
  const axis = isHorizontal ? 0 : 1; // compare X for horizontal, Y for vertical

  interface Card {
    node: Element;
    rect: SVGRectElement;
    pos: [number, number];
    width: number;
    height: number;
  }

  const cards: Card[] = [];
  for (const node of doc.querySelectorAll('g.node')) {
    // Only equalize rectangular cards, not decision diamonds, circles, etc.
    if (node.querySelector('polygon, circle, ellipse')) continue;
    const rect = node.querySelector(':scope > .label-container, :scope > rect') as SVGRectElement | null;
    if (!rect) continue;
    const t = (node.getAttribute('transform') || '').match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
    if (!t) continue;
    const pos: [number, number] = [Number(t[1]), Number(t[2])];
    const width = parseFloat(rect.getAttribute('width') || '0');
    const height = parseFloat(rect.getAttribute('height') || '0');
    if (width > 0 && height > 0) {
      cards.push({ node, rect, pos, width, height });
    }
  }

  // Sort cards by their position on layout axis
  cards.sort((a, b) => a.pos[axis] - b.pos[axis]);

  // Group into layers with a 15px threshold
  const layers: Card[][] = [];
  let currentLayer: Card[] = [];
  let lastCoord = -Infinity;

  for (const card of cards) {
    if (Math.abs(card.pos[axis] - lastCoord) <= 15) {
      currentLayer.push(card);
    } else {
      if (currentLayer.length > 1) layers.push(currentLayer);
      currentLayer = [card];
      lastCoord = card.pos[axis];
    }
  }
  if (currentLayer.length > 1) layers.push(currentLayer);

  // Equalize widths in each layer (capped to prevent collision with next rank)
  for (const layer of layers) {
    const maxWidth = Math.max(...layer.map(c => c.width));
    for (const card of layer) {
      const diff = maxWidth - card.width;
      if (diff > 1 && diff <= 60) {
        card.rect.setAttribute('width', String(maxWidth));
        card.rect.setAttribute('x', String(-maxWidth / 2));
      }
    }
  }
}

/** Processes and enhances the Mermaid SVG diagram with layout alignment, coloring, and clean formatting. */
export function computeDiagramSpacing(text: string, direction: string = 'TD'): { nodeSpacing: number; rankSpacing: number } {
  const matches = [
    ...text.matchAll(/(?:--+>|==+>|-\.+->?|--+|==+)\s*\|([^|\n]+)\|/g),
    ...text.matchAll(/--\s*([^->\n|]+?)\s*-->/g),
    ...text.matchAll(/==\s*([^=>\n|]+?)\s*==>/g),
  ];

  let maxLen = 0;
  for (const m of matches) {
    const raw = (m[1] || '').trim();
    if (raw.length > maxLen) {
      maxLen = raw.length;
    }
  }

  const outgoingCounts = new Map<string, number>();
  const linkMatches = text.matchAll(/([a-zA-Z0-9_-]+)\s*(?:--+>|==+>|-\.+->?|--+|==+)/g);
  for (const lm of linkMatches) {
    const src = lm[1];
    if (src && src !== 'flowchart' && src !== 'graph') outgoingCounts.set(src, (outgoingCounts.get(src) || 0) + 1);
  }

  let maxFanOut = 0;
  for (const count of outgoingCounts.values()) {
    if (count > maxFanOut) maxFanOut = count;
  }

  const isVertical = !/^(LR|RL)$/i.test(direction);

  let baseNode = 55;
  let baseRank = 65;

  if (maxLen > 0) {
    // Proportional node spacing to give labels adequate horizontal span
    const labelSpacingAdd = Math.max(0, (maxLen - 6) * 4);
    const fanOutAdd = maxFanOut >= 4 ? Math.min(40, (maxFanOut - 3) * 10) : 0;
    baseNode = Math.min(130, Math.max(60, 60 + labelSpacingAdd + fanOutAdd));

    // Proportional rank spacing to expand arrow lines and link links
    const rankAdd = Math.max(0, (maxLen - 8) * 1.5) + (maxFanOut >= 3 ? 15 : 0);
    baseRank = Math.min(105, Math.max(70, 70 + rankAdd));
  } else {
    baseNode = 50;
    baseRank = 60;
  }

  return {
    nodeSpacing: isVertical ? baseNode : baseRank,
    rankSpacing: isVertical ? baseRank : baseNode,
  };
}

/**
 * Detects and resolves vertical overlaps between cluster/kanban headers and their first child cards.
 * When Mermaid renders Kanban columns or subgraphs with tight top margins, cards can overlap the title.
 * This shifts cards down to provide clean clearance and expands the cluster rect height.
 */
export function fixClusterHeaderOverlap(doc: Document): void {
  const clusters = Array.from(doc.querySelectorAll('g.cluster, .kanban-column, .kanban-section'));
  if (clusters.length === 0) return;

  let maxAddedHeight = 0;

  for (const cluster of clusters) {
    const rect = cluster.querySelector(':scope > rect, rect') as SVGRectElement | null;
    if (!rect) continue;

    const clusterY = parseFloat(rect.getAttribute('y') || '0');
    const clusterX = parseFloat(rect.getAttribute('x') || '0');
    const clusterWidth = parseFloat(rect.getAttribute('width') || '0');
    const clusterHeight = parseFloat(rect.getAttribute('height') || '0');
    if (clusterWidth <= 0 || clusterHeight <= 0) continue;

    // Find the cluster header label
    const label = cluster.querySelector('.cluster-label, .cluster-title, text');
    if (!label) continue;

    let labelBottomY = clusterY + 24;
    const labelTransform = label.getAttribute('transform');
    if (labelTransform) {
      const match = labelTransform.match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
      if (match && match[2] !== undefined) {
        labelBottomY = parseFloat(match[2]) + 16;
      }
    } else {
      const ly = parseFloat(label.getAttribute('y') || '0');
      if (ly > 0) labelBottomY = ly + 16;
    }

    // Find cards / tasks within this cluster
    const allNodes = Array.from(doc.querySelectorAll('g.node, .kanban-item, .kanban-ticket, .task'));
    const columnNodes: Array<{ node: Element; x: number; y: number; rawTransform: string }> = [];

    for (const node of allNodes) {
      const t = node.getAttribute('transform') || '';
      const match = t.match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
      if (!match) continue;
      const nx = parseFloat(match[1]!);
      const ny = parseFloat(match[2]!);

      const isInside = (nx >= clusterX - 5 && nx <= clusterX + clusterWidth + 5) || cluster.contains(node);
      if (isInside && ny >= clusterY - 10 && ny <= clusterY + clusterHeight + 60) {
        columnNodes.push({ node, x: nx, y: ny, rawTransform: t });
      }
    }

    if (columnNodes.length === 0) continue;

    columnNodes.sort((a, b) => a.y - b.y);

    const firstNode = columnNodes[0]!;
    const nodeCard = firstNode.node.querySelector('rect, polygon, circle');
    const cardHeight = nodeCard ? parseFloat(nodeCard.getAttribute('height') || '40') : 40;
    const cardTop = firstNode.y - cardHeight / 2;

    const desiredCardTop = labelBottomY + 20;
    if (cardTop < desiredCardTop) {
      const shiftY = Math.ceil(desiredCardTop - cardTop);
      if (shiftY > 0 && shiftY < 200) {
        for (const item of columnNodes) {
          const newY = item.y + shiftY;
          const updatedTransform = item.rawTransform.replace(
            /translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/,
            `translate($1, ${newY})`
          );
          item.node.setAttribute('transform', updatedTransform);
        }

        rect.setAttribute('height', String(clusterHeight + shiftY));
        if (shiftY > maxAddedHeight) {
          maxAddedHeight = shiftY;
        }
      }
    }
  }

  if (maxAddedHeight > 0) {
    const root = doc.documentElement;
    const viewBox = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (viewBox.length === 4 && viewBox.every(Number.isFinite)) {
      const [vx, vy, vw, vh] = viewBox as [number, number, number, number];
      root.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh + maxAddedHeight}`);
      const h = parseFloat(root.getAttribute('height') || '0');
      if (h > 0) {
        root.setAttribute('height', String(h + maxAddedHeight));
      }
    }
  }
}

/**
 * Detects and resolves text collisions in Sankey diagrams, optimizes linear gradient link visibility,
 * and normalizes node label typography.
 */
export function fixSankeyCollisions(doc: Document, palette?: PaletteData, dark?: boolean): void {
  // Remove inline mix-blend-mode: multiply from link groups and adjust stroke opacity so ribbons stay luminous
  for (const g of doc.querySelectorAll('g.link, .link')) {
    g.removeAttribute('style');
    g.setAttribute('style', 'mix-blend-mode: normal;');
  }
  for (const path of doc.querySelectorAll('g.link path, .link path')) {
    path.setAttribute('stroke-opacity', dark ? '0.72' : '0.60');
  }

  // Ensure high contrast label typography
  if (palette) {
    for (const text of doc.querySelectorAll('g.node-labels text, .sankey-node text, .sankey text')) {
      text.setAttribute('fill', palette.text);
      if ((text as HTMLElement).style) {
        (text as HTMLElement).style.color = palette.text;
        (text as HTMLElement).style.fill = palette.text;
      }
    }
  }

  const textNodes = Array.from(doc.querySelectorAll('g.node-labels text, .sankey-node text, .sankey text'));
  if (textNodes.length < 2) return;

  interface SankeyLabelItem {
    el: Element;
    x: number;
    y: number;
    anchor: 'start' | 'end' | 'middle';
    width: number;
    height: number;
    xMin: number;
    xMax: number;
  }

  const labels: SankeyLabelItem[] = textNodes.map(el => {
    const x = parseFloat(el.getAttribute('x') || '0');
    const y = parseFloat(el.getAttribute('y') || '0');
    const anchor = (el.getAttribute('text-anchor') || 'start') as 'start' | 'end' | 'middle';
    const text = el.textContent || '';
    const lines = text.split('\n').filter(Boolean);
    const maxLine = Math.max(...lines.map(l => l.length), 1);
    const width = maxLine * 8 + 10;
    const height = Math.max(lines.length * 16, 22);
    const xMin = anchor === 'start' ? x : (anchor === 'end' ? x - width : x - width / 2);
    const xMax = xMin + width;
    return { el, x, y, anchor, width, height, xMin, xMax };
  });

  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i]!;
      const b = labels[j]!;
      // Check horizontal interval overlap
      const hOverlap = a.xMin < b.xMax + 12 && b.xMin < a.xMax + 12;
      const vDist = Math.abs(a.y - b.y);

      if (hOverlap && vDist < 36) {
        // Vertical collision detected! Shift the upper label upward and lower label downward
        const shift = Math.max(24, (38 - vDist) / 2);
        if (a.y <= b.y) {
          a.y -= shift;
          b.y += shift;
        } else {
          a.y += shift;
          b.y -= shift;
        }

        a.el.setAttribute('y', String(a.y));
        b.el.setAttribute('y', String(b.y));

        // Also update any child <tspan> elements
        const updateTspans = (item: SankeyLabelItem) => {
          const tspans = Array.from(item.el.querySelectorAll('tspan'));
          if (tspans.length > 0) {
            tspans.forEach((ts, idx) => {
              if (ts.hasAttribute('y')) {
                ts.setAttribute('y', String(item.y + idx * 16));
              }
            });
          }
        };
        updateTspans(a);
        updateTspans(b);
      }
    }
  }
}

/**
 * Detects and resolves overlapping relationship labels and cards in C4 architecture diagrams.
 * Staggers colliding horizontal relationship labels and ensures each relationship badge has
 * a legible high-contrast background pill.
 */
export function fixC4RelationshipCollisions(doc: Document, palette: PaletteData): void {
  const root = doc.documentElement;
  const isC4 = root.classList.contains('c4Context') ||
    root.classList.contains('c4Container') ||
    root.classList.contains('c4Component') ||
    root.classList.contains('c4Dynamic') ||
    root.classList.contains('c4Deployment') ||
    !!doc.querySelector('.c4-shape, .c4-person, .c4-system, .c4-boundary, .c4Context, .c4Container, .c4Component, g.relationship, .relationships, text.relationshipLabel');
  if (!isC4) return;

  const relLabels = Array.from(
    doc.querySelectorAll(
      '.relationshipLabel, .relation-label, .relationship-label, g.relationship text, text[class*="relationship"], .relationships text, text:has(tspan[alignment-baseline]), g:has(> line, > path) > text'
    )
  ).filter(el => !el.closest('.tick, .grid, .node, .c4-shape, .label-container, .task, .sectionTitle'));

  const labelItems: Array<{ el: Element; x: number; y: number; width: number; height: number }> = [];

  for (const el of relLabels) {
    if (el.getAttribute('data-c4-fixed') === 'true') continue;
    if (el.closest('.tick, .grid, .node, .c4-shape, .label-container, .task, .sectionTitle')) continue;

    const rawX = el.getAttribute('x');
    const rawY = el.getAttribute('y');
    const x = parseFloat(rawX || '0');
    const y = parseFloat(rawY || '0');
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) continue;

    const fullText = (el.textContent || '').trim();
    if (!fullText) continue;

    el.setAttribute('data-c4-fixed', 'true');
    el.setAttribute('fill', palette.text);
    if ((el as HTMLElement).style) {
      (el as HTMLElement).style.fill = palette.text;
      (el as HTMLElement).style.color = palette.text;
    }

    let width = 0;
    let height = 24;
    // Wrap long relationship text (> 22 chars) into 2 lines so it doesn't collide horizontally with cards
    if (fullText.length > 22 && fullText.includes(' ')) {
      const words = fullText.split(/\s+/);
      const mid = Math.ceil(words.length / 2);
      const line1 = words.slice(0, mid).join(' ');
      const line2 = words.slice(mid).join(' ');
      width = Math.max(line1.length, line2.length) * 7.5 + 24;
      height = 36;

      el.textContent = '';
      const tspan1 = doc.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan1.setAttribute('x', String(x));
      tspan1.setAttribute('dy', '-0.55em');
      tspan1.setAttribute('text-anchor', 'middle');
      tspan1.textContent = line1;

      const tspan2 = doc.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan2.setAttribute('x', String(x));
      tspan2.setAttribute('dy', '1.2em');
      tspan2.setAttribute('text-anchor', 'middle');
      tspan2.textContent = line2;

      el.appendChild(tspan1);
      el.appendChild(tspan2);
    } else {
      width = Math.max(fullText.length * 7.5, 60);
      height = 24;
    }

    labelItems.push({ el, x, y, width, height });
  }

  for (let i = 0; i < labelItems.length; i++) {
    for (let j = i + 1; j < labelItems.length; j++) {
      const a = labelItems[i]!;
      const b = labelItems[j]!;
      const hDist = Math.abs(a.x - b.x);
      const vDist = Math.abs(a.y - b.y);

      const minHDist = Math.max((a.width + b.width) / 2 + 20, 180);
      if (vDist < 25 && hDist < minHDist) {
        if (a.y <= b.y) {
          a.y -= 22;
          b.y += 22;
        } else {
          a.y += 22;
          b.y -= 22;
        }
        a.el.setAttribute('y', String(a.y));
        b.el.setAttribute('y', String(b.y));
        for (const tspan of a.el.querySelectorAll('tspan')) {
          tspan.setAttribute('x', String(a.x));
        }
        for (const tspan of b.el.querySelectorAll('tspan')) {
          tspan.setAttribute('x', String(b.x));
        }
      }
    }
  }

  for (const item of labelItems) {
    const parent = item.el.parentElement;
    if (!parent) continue;
    if (parent.querySelector('rect.c4-rel-pill')) continue;

    const padX = 8;
    const padY = 4;
    const rect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('c4-rel-pill');
    rect.setAttribute('x', String(item.x - item.width / 2 - padX));
    rect.setAttribute('y', String(item.y - item.height / 2 - padY));
    rect.setAttribute('width', String(item.width + padX * 2));
    rect.setAttribute('height', String(item.height + padY * 2));
    rect.setAttribute('rx', '6');
    rect.setAttribute('ry', '6');
    rect.setAttribute('fill', palette.label);
    rect.setAttribute('stroke', palette.border);
    rect.setAttribute('stroke-width', '1px');
    rect.setAttribute('opacity', '0.96');

    parent.insertBefore(rect, item.el);
  }
}

/**
 * Enhances SysML Requirement Diagrams with thematic container fills, crisp borders,
 * clear typography, and styled relationship badges.
 */
export function fixRequirementDiagram(doc: Document, palette: PaletteData, _dark: boolean): void {
  const root = doc.documentElement;
  const isReq = root.classList.contains('requirementDiagram') ||
    root.getAttribute('aria-roledescription') === 'requirement' ||
    !!doc.querySelector('.requirementDiagram, g.requirement, g.element, .reqBox, .reqTitle, g[class*="req-"]');
  if (!isReq) return;

  // Box shapes (rects and modern Mermaid outer-path paths)
  for (const node of doc.querySelectorAll('.requirementDiagram g.node, g.requirement, g.element, g[class*="req-"]')) {
    const textContent = node.textContent || '';
    const isElement = textContent.includes('<<Element>>') || textContent.includes('type:');
    const fill = isElement ? (palette.clusterBkg ?? palette.surface) : palette.surface;
    const stroke = isElement ? palette.accent : palette.border;

    for (const rect of node.querySelectorAll(':scope > rect, rect.basic, .reqBox, rect')) {
      rect.setAttribute('fill', fill);
      rect.setAttribute('stroke', stroke);
      rect.setAttribute('stroke-width', '1.5px');
      rect.setAttribute('rx', '6');
      rect.setAttribute('ry', '6');
    }

    for (const path of node.querySelectorAll('g.outer-path path, g.basic path, path.basic')) {
      const currentFill = path.getAttribute('fill');
      const currentStroke = path.getAttribute('stroke');
      if (currentStroke && currentStroke !== 'none' && currentStroke !== 'transparent') {
        path.setAttribute('stroke', stroke);
        path.setAttribute('stroke-width', '1.5px');
      } else if (currentFill && currentFill !== 'none') {
        path.setAttribute('fill', fill);
      }
    }

    // Ensure clean padding on HTML labels inside foreignObject so text doesn't touch the borders
    for (const foDiv of node.querySelectorAll('foreignObject div, .nodeLabel')) {
      const divEl = foDiv as HTMLElement;
      if (divEl.style) {
        divEl.style.color = palette.text;
        if (!divEl.style.padding || divEl.style.padding === '0px') {
          divEl.style.padding = '2px 8px';
        }
      }
    }
  }

  // Divider lines
  for (const line of doc.querySelectorAll('.req-title-line, .requirementDiagram line, .requirementDiagram g.divider path')) {
    line.setAttribute('stroke', palette.border);
    line.setAttribute('stroke-width', '1.5px');
  }

  // Typography and labels
  for (const text of doc.querySelectorAll('.requirementDiagram text, .requirementDiagram .nodeLabel text, .requirementDiagram .nodeLabel span, .requirementDiagram .nodeLabel p, .reqTitle, .reqLabel, .reqText')) {
    text.setAttribute('fill', palette.text);
    if ((text as HTMLElement).style) (text as HTMLElement).style.color = palette.text;
  }

  // Relationship lines
  for (const path of doc.querySelectorAll('.requirementDiagram .edgePaths path, .requirementDiagram path.relationshipLine')) {
    path.setAttribute('stroke', palette.line);
    path.setAttribute('stroke-width', '1.5px');
  }

  // Relationship badges/pills
  for (const labelBkg of doc.querySelectorAll('.requirementDiagram .labelBkg, .requirementDiagram .edgeLabels rect, .reqLabelBox')) {
    labelBkg.setAttribute('fill', palette.label);
    labelBkg.setAttribute('stroke', palette.border);
    labelBkg.setAttribute('rx', '5');
    labelBkg.setAttribute('ry', '5');
  }
}

/**
 * Enhances Block Diagrams with high-contrast typography, crisp borders, and visible text.
 */
export function fixBlockDiagram(doc: Document, palette: PaletteData, _dark: boolean): void {
  const root = doc.documentElement;
  const isBlock = root.classList.contains('block-beta') ||
    root.getAttribute('aria-roledescription') === 'block' ||
    !!doc.querySelector('.block-beta, svg[aria-roledescription="block"], g.block, .block');
  if (!isBlock) return;

  // Enhance all block shapes (rects, cylinders, documents, asymmetric blocks)
  for (const shape of doc.querySelectorAll('svg[aria-roledescription="block"] :is(rect.basic, path.basic, .basic path, .outer-path path, path.outer-path, .label-container path), .block-beta :is(rect.basic, path.basic, .basic path, .outer-path path, path.outer-path, .label-container path), g.block :is(rect.basic, path.basic, .basic path, .outer-path path, path.outer-path, .label-container path)')) {
    if (shape.closest('marker, .label, .nodeLabel')) continue;
    const currentStroke = shape.getAttribute('stroke');
    if (currentStroke === 'none' || shape.getAttribute('stroke-width') === '0') {
      shape.setAttribute('fill', palette.surface);
    } else {
      shape.setAttribute('fill', palette.surface);
      shape.setAttribute('stroke', palette.border);
      shape.setAttribute('stroke-width', '1.5px');
    }
  }

  for (const text of doc.querySelectorAll('.block-beta text, svg[aria-roledescription="block"] text, g.block text, .block text, .block-beta .nodeLabel, svg[aria-roledescription="block"] .nodeLabel, .block .nodeLabel, .block-beta span, svg[aria-roledescription="block"] span, .block span, .block-beta p, svg[aria-roledescription="block"] p, .block p')) {
    text.setAttribute('fill', palette.text);
    if ((text as HTMLElement).style) {
      (text as HTMLElement).style.color = palette.text;
      (text as HTMLElement).style.fill = palette.text;
    }
  }
}

/**
 * Enhances Gantt charts with high-contrast active task text and clearly visible grid date tick labels.
 */
export function fixGanttChart(doc: Document, palette: PaletteData, dark: boolean): void {
  const root = doc.documentElement;
  const isGantt = root.classList.contains('gantt') || !!doc.querySelector('.grid .tick, .taskText, .sectionTitle, rect.task');
  if (!isGantt) return;

  // Active task text: high contrast against accent fill
  const activeTextColor = dark ? '#0f172a' : '#ffffff';
  for (const text of doc.querySelectorAll('[class*="activeText"], .taskText.active, .task.active + text')) {
    text.setAttribute('fill', activeTextColor);
    if ((text as HTMLElement).style) {
      (text as HTMLElement).style.setProperty('fill', activeTextColor, 'important');
      (text as HTMLElement).style.setProperty('color', activeTextColor, 'important');
    }
  }

  // Critical fix for dark mode: Mermaid injects CSS fill: #2c2c2c on taskTextOutsideLeft / Right!
  // Force high contrast palette text with !important so text is crystal clear
  for (const text of doc.querySelectorAll('.taskTextOutsideLeft, .taskTextOutsideRight, .taskTextOutside, [class*="taskTextOutside"], .sectionTitle, .titleText, .grid .tick text, g.tick text')) {
    text.setAttribute('fill', palette.text);
    if ((text as HTMLElement).style) {
      (text as HTMLElement).style.setProperty('fill', palette.text, 'important');
      (text as HTMLElement).style.setProperty('color', palette.text, 'important');
    }
  }

  // Section titles: bold, crisp
  for (const title of doc.querySelectorAll('.sectionTitle')) {
    title.setAttribute('fill', palette.text);
    if ((title as HTMLElement).style) {
      (title as HTMLElement).style.setProperty('fill', palette.text, 'important');
      (title as HTMLElement).style.setProperty('color', palette.text, 'important');
      (title as HTMLElement).style.fontWeight = '700';
    }
  }

  // Task bars: colorize with coordinated palette fills and borders
  const isMulti = palette.fills.length > 0;
  let taskBarIdx = 0;
  for (const rect of doc.querySelectorAll('rect.task, rect[class*="task"]')) {
    const cls = rect.getAttribute('class') || '';
    if (cls.includes('done')) {
      rect.setAttribute('fill', palette.clusterBkg ?? (dark ? '#222f3e' : '#e2e8f0'));
      rect.setAttribute('stroke', palette.border);
      rect.setAttribute('stroke-width', '1.5px');
      rect.setAttribute('rx', '4');
      rect.setAttribute('ry', '4');
    } else if (cls.includes('active')) {
      rect.setAttribute('fill', palette.accent);
      rect.setAttribute('stroke', palette.accent);
      rect.setAttribute('stroke-width', '1.5px');
      rect.setAttribute('rx', '4');
      rect.setAttribute('ry', '4');
    } else if (!cls.includes('milestone')) {
      const slot = taskBarIdx % (palette.fills.length || 1);
      const fill = isMulti ? palette.fills[slot]! : palette.surface;
      const stroke = isMulti ? palette.borders[slot]! : palette.border;
      taskBarIdx++;
      rect.setAttribute('fill', fill);
      rect.setAttribute('stroke', stroke);
      rect.setAttribute('stroke-width', '1.5px');
      rect.setAttribute('rx', '4');
      rect.setAttribute('ry', '4');
    }
  }

  // Milestone diamond shapes and offset milestone label
  for (const ms of doc.querySelectorAll('rect.milestone, polygon.milestone')) {
    ms.setAttribute('fill', palette.accent);
    ms.setAttribute('stroke', palette.accent);
  }
  for (const text of doc.querySelectorAll('.milestoneText')) {
    const x = parseFloat(text.getAttribute('x') || '0');
    if (x > 0) {
      text.setAttribute('x', String(x + 14));
    }
    text.setAttribute('fill', palette.text);
    if ((text as HTMLElement).style) {
      (text as HTMLElement).style.setProperty('fill', palette.text, 'important');
      (text as HTMLElement).style.setProperty('color', palette.text, 'important');
    }
  }

  // Non-milestone task bars: enclose text cleanly inside the task bar with guaranteed contrast
  for (const text of Array.from(doc.querySelectorAll('.taskTextOutsideRight, .taskTextOutsideLeft, .taskTextOutside, .taskText, [class*="taskText"]'))) {
    if (text.classList.contains('milestoneText')) continue;
    const ty = parseFloat(text.getAttribute('y') || '0');
    let matchedRect: SVGRectElement | null = null;
    const textId = text.id || '';
    if (textId) {
      const candidateId = textId.replace(/-text$/, '');
      const candidate = doc.getElementById(candidateId);
      if (candidate && candidate.tagName.toLowerCase() === 'rect') {
        matchedRect = candidate as unknown as SVGRectElement;
      }
    }
    if (!matchedRect) {
      let minDist = Infinity;
      for (const r of Array.from(doc.querySelectorAll('rect.task, rect[class*="task"]:not(.milestone)')) as SVGRectElement[]) {
        const ry = parseFloat(r.getAttribute('y') || '0');
        const dist = Math.abs(ry - ty);
        if (dist < 30 && dist < minDist) {
          minDist = dist;
          matchedRect = r;
        }
      }
    }

    if (matchedRect) {
      const rx = parseFloat(matchedRect.getAttribute('x') || '0');
      const ry = parseFloat(matchedRect.getAttribute('y') || '0');
      let rw = parseFloat(matchedRect.getAttribute('width') || '0');
      const rh = parseFloat(matchedRect.getAttribute('height') || '20');

      const textLen = (text.textContent || '').trim().length;
      const minWidth = Math.max(rw, textLen * 7.5 + 24);
      if (rw < minWidth) {
        rw = minWidth;
        matchedRect.setAttribute('width', String(rw));
      }

      text.setAttribute('x', String(rx + rw / 2));
      text.setAttribute('y', String(ry + rh / 2 + 4.5));
      text.setAttribute('text-anchor', 'middle');
      text.classList.remove('taskTextOutsideRight', 'taskTextOutsideLeft', 'taskTextOutside');
      text.classList.add('taskText');

      const rectFill = matchedRect.getAttribute('fill') || palette.surface;
      const fillCol = textOnFill(rectFill, palette.text);
      text.setAttribute('fill', fillCol);
      if ((text as HTMLElement).style) {
        (text as HTMLElement).style.setProperty('fill', fillCol, 'important');
        (text as HTMLElement).style.setProperty('color', fillCol, 'important');
        (text as HTMLElement).style.setProperty('text-anchor', 'middle', 'important');
      }
    } else {
      text.setAttribute('fill', palette.text);
      if ((text as HTMLElement).style) {
        (text as HTMLElement).style.setProperty('fill', palette.text, 'important');
        (text as HTMLElement).style.setProperty('color', palette.text, 'important');
      }
    }
  }

  // Grid lines
  for (const line of doc.querySelectorAll('.grid line, line.tick')) {
    line.setAttribute('stroke', palette.border);
    line.setAttribute('stroke-opacity', '0.45');
  }

  // Alternating section background bands
  for (const sec of doc.querySelectorAll('.section0, .section1, .section2, .section3')) {
    sec.setAttribute('fill', palette.clusterBkg ?? (dark ? '#182230' : '#f8fafc'));
    sec.setAttribute('fill-opacity', '0.35');
  }
}

/**
 * Enhances Class Diagrams with clean container fills, divider lines, member padding,
 * and high-contrast typography.
 */
export function fixClassDiagram(doc: Document, palette: PaletteData, _dark: boolean): void {
  const root = doc.documentElement;
  const isClass = root.classList.contains('classDiagram') ||
    root.getAttribute('aria-roledescription') === 'classDiagram' ||
    !!doc.querySelector('.classDiagram, g.classGroup, .classTitle, .classLabel, [id*="classId"]');
  if (!isClass) return;

  // Class box containers (rects and path-based outer-paths)
  const isMulti = palette.fills.length > 0;
  const classNodes = Array.from(doc.querySelectorAll('.classDiagram g.node, g.classGroup, [id*="classId"]'));
  for (let i = 0; i < classNodes.length; i++) {
    const node = classNodes[i]!;
    const slot = i % (palette.fills.length || 1);
    const fill = isMulti ? palette.fills[slot]! : palette.surface;
    const stroke = isMulti ? palette.borders[slot]! : palette.border;
    const textColor = textOnFill(fill, palette.text);

    for (const rect of node.querySelectorAll(':scope > rect, rect.basic, g.classGroup > rect')) {
      rect.setAttribute('fill', fill);
      rect.setAttribute('stroke', stroke);
      rect.setAttribute('stroke-width', '1.5px');
      rect.setAttribute('rx', '6');
      rect.setAttribute('ry', '6');
    }

    for (const path of node.querySelectorAll('g.outer-path path, g.basic path, path.basic')) {
      const currentFill = path.getAttribute('fill');
      const currentStroke = path.getAttribute('stroke');
      if (currentStroke && currentStroke !== 'none' && currentStroke !== 'transparent') {
        path.setAttribute('stroke', palette.border);
        path.setAttribute('stroke-width', '1.5px');
      } else if (currentFill && currentFill !== 'none') {
        path.setAttribute('fill', palette.surface);
      }
    }

    // Class title
    for (const title of node.querySelectorAll('.label-group text, .classTitle, text.title, .label-group .nodeLabel, .label-group p')) {
      title.setAttribute('fill', palette.text);
      if ((title as HTMLElement).style) {
        (title as HTMLElement).style.color = palette.text;
        (title as HTMLElement).style.fontWeight = '700';
      }
    }

    // Members & Methods: ensure clean left padding so text never touches or overlaps the left border
    for (const group of node.querySelectorAll('.members-group, .methods-group')) {
      for (const foDiv of group.querySelectorAll('foreignObject div, .nodeLabel')) {
        const divEl = foDiv as HTMLElement;
        if (divEl.style) {
          divEl.style.textAlign = 'left';
          divEl.style.paddingLeft = '10px';
          divEl.style.paddingRight = '10px';
          divEl.style.color = palette.text;
          divEl.style.whiteSpace = 'nowrap';
        }
      }
      for (const text of group.querySelectorAll('text')) {
        text.setAttribute('fill', palette.text);
        text.setAttribute('text-anchor', 'start');
      }
    }
  }

  // Dividers
  for (const divider of doc.querySelectorAll('.classDiagram g.divider path, g.classGroup line, line.divider')) {
    divider.setAttribute('stroke', palette.border);
    divider.setAttribute('stroke-width', '1.2px');
  }

  // All remaining text in classDiagram
  for (const text of doc.querySelectorAll('.classDiagram text:not(.classLabel text), g.classGroup text')) {
    text.setAttribute('fill', palette.text);
    if ((text as HTMLElement).style) (text as HTMLElement).style.color = palette.text;
  }

  // Relationship lines & markers
  for (const path of doc.querySelectorAll('.classDiagram .edgePaths path, path.relation')) {
    path.setAttribute('stroke', palette.line);
    path.setAttribute('stroke-width', '1.5px');
  }
  for (const marker of doc.querySelectorAll('.classDiagram marker path, marker[id*="extension"] path, marker[id*="composition"] path, marker[id*="aggregation"] path, marker[id*="dependency"] path')) {
    marker.setAttribute('stroke', palette.line);
    marker.setAttribute('fill', palette.surface);
  }

  // Relationship labels
  for (const labelBox of doc.querySelectorAll('.classDiagram .classLabel .box, .classDiagram .edgeLabels rect')) {
    labelBox.setAttribute('fill', palette.label);
    labelBox.setAttribute('stroke', palette.border);
    labelBox.setAttribute('rx', '4');
    labelBox.setAttribute('ry', '4');
  }
  for (const labelText of doc.querySelectorAll('.classDiagram .classLabel .label, .classDiagram .edgeLabels text, .classDiagram .edgeLabels p')) {
    labelText.setAttribute('fill', palette.text);
    if ((labelText as HTMLElement).style) (labelText as HTMLElement).style.color = palette.text;
  }
}

/**
 * Enhances Entity Relationship (ER) diagrams with clean container fills, alternating row bands,
 * attribute text padding, PK/FK styling, and cardinality markers.
 */
export function fixEntityRelationshipDiagram(doc: Document, palette: PaletteData, dark: boolean): void {
  const root = doc.documentElement;
  const isEr = root.classList.contains('erDiagram') ||
    root.getAttribute('aria-roledescription') === 'er' ||
    !!doc.querySelector('.erDiagram, .entityBox, .relationshipLine, [id*="entity-"]');
  if (!isEr) return;
  root.classList.add('erDiagram');

  // Outer entity container boxes
  const isMultiEr = palette.fills.length > 0;
  const entities = Array.from(doc.querySelectorAll('g.node, [id*="entity-"]'));
  for (let i = 0; i < entities.length; i++) {
    const node = entities[i]!;
    const slot = i % (palette.fills.length || 1);
    const fill = isMultiEr ? palette.fills[slot]! : palette.surface;
    const stroke = isMultiEr ? palette.borders[slot]! : palette.border;

    for (const rect of node.querySelectorAll(':scope > rect.entityBox, rect.basic')) {
      rect.setAttribute('fill', fill);
      rect.setAttribute('stroke', stroke);
      rect.setAttribute('stroke-width', '1.5px');
      rect.setAttribute('rx', '6');
      rect.setAttribute('ry', '6');
    }

    for (const path of node.querySelectorAll('g.outer-path path')) {
      const currentFill = path.getAttribute('fill');
      const currentStroke = path.getAttribute('stroke');
      if (currentStroke && currentStroke !== 'none' && currentStroke !== 'transparent') {
        path.setAttribute('stroke', palette.border);
        path.setAttribute('stroke-width', '1.5px');
      } else if (currentFill && currentFill !== 'none') {
        path.setAttribute('fill', palette.surface);
      }
    }
  }

  // Alternating row rects
  for (const path of doc.querySelectorAll('g.row-rect-odd path, rect.er.attributeBoxOdd')) {
    const stroke = path.getAttribute('stroke');
    if (stroke && stroke !== 'none') path.setAttribute('stroke', palette.border);
    else path.setAttribute('fill', palette.surface);
  }
  for (const path of doc.querySelectorAll('g.row-rect-even path, rect.er.attributeBoxEven')) {
    const stroke = path.getAttribute('stroke');
    if (stroke && stroke !== 'none') path.setAttribute('stroke', palette.border);
    else path.setAttribute('fill', palette.clusterBkg ?? (dark ? '#1d2838' : '#f1f5f9'));
  }

  // Dividers
  for (const divider of doc.querySelectorAll('g.divider path, line.divider')) {
    divider.setAttribute('stroke', palette.border);
    divider.setAttribute('stroke-width', '1px');
  }

  // Entity title
  for (const title of doc.querySelectorAll('g.label.name, text.entityLabel, .name .nodeLabel, .name p')) {
    title.setAttribute('fill', palette.text);
    if ((title as HTMLElement).style) {
      (title as HTMLElement).style.color = palette.text;
      (title as HTMLElement).style.fontWeight = '700';
    }
  }

  // Attributes: ensure clean horizontal padding and high contrast
  for (const attr of doc.querySelectorAll('.attribute-type, .attribute-name, .attribute-keys, .attribute-comment, text.er.entityText')) {
    for (const foDiv of attr.querySelectorAll('foreignObject div, .nodeLabel')) {
      const divEl = foDiv as HTMLElement;
      if (divEl.style) {
        divEl.style.paddingLeft = '8px';
        divEl.style.paddingRight = '8px';
        divEl.style.color = palette.text;
      }
    }
    for (const text of attr.querySelectorAll('text')) {
      text.setAttribute('fill', palette.text);
    }
  }

  // Key badges (PK, FK)
  for (const key of doc.querySelectorAll('.attribute-keys foreignObject div, .attribute-keys .nodeLabel, .attribute-keys p, .attribute-keys span, .attribute-keys text')) {
    const text = (key.textContent || '').trim();
    if (!text) continue;
    key.setAttribute('fill', palette.accent);
    if ((key as HTMLElement).style) {
      (key as HTMLElement).style.color = palette.accent;
      (key as HTMLElement).style.fontWeight = '700';
    }
  }

  // Relationship lines & markers
  for (const path of doc.querySelectorAll('path.relationshipLine, .edgePaths path')) {
    path.setAttribute('stroke', palette.line);
    path.setAttribute('stroke-width', '1.5px');
  }
  for (const marker of doc.querySelectorAll('marker[class*="er"] path, marker[class*="er"] circle, marker.onlyOne path, marker.zeroOrOne path, marker.zeroOrOne circle, marker.oneOrMore path, marker.zeroOrMore path, marker.zeroOrMore circle')) {
    marker.setAttribute('stroke', palette.line);
    marker.setAttribute('fill', palette.surface);
  }

  // Relationship labels
  for (const labelBox of doc.querySelectorAll('.edgeLabels rect, .labelBkg')) {
    labelBox.setAttribute('fill', palette.label);
    labelBox.setAttribute('stroke', palette.border);
    labelBox.setAttribute('rx', '4');
    labelBox.setAttribute('ry', '4');
  }
  for (const labelText of doc.querySelectorAll('.edgeLabels text, .edgeLabels p')) {
    labelText.setAttribute('fill', palette.text);
    if ((labelText as HTMLElement).style) (labelText as HTMLElement).style.color = palette.text;
  }
}

/**
 * Enhances Kanban boards with cohesive column containers, card surfaces, and card text word wrapping.
 */
export function fixKanbanDiagram(doc: Document, palette: PaletteData, dark: boolean): void {
  const root = doc.documentElement;
  const isKanban = root.getAttribute('aria-roledescription') === 'kanban' ||
    !!doc.querySelector('g.cluster.section-1, g.kanban-section, .kanban-column, .kanban-item, [class*="kanban"]');
  if (!isKanban) return;

  // Kanban column backgrounds
  const isMultiKanban = palette.fills.length > 0;
  const cols = Array.from(doc.querySelectorAll('g.cluster, g.kanban-column, g.kanban-section'));
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i]!;
    const slot = i % (palette.fills.length || 1);
    const stroke = isMultiKanban ? palette.borders[slot]! : palette.border;

    const rect = col.querySelector(':scope > rect, rect') as SVGRectElement | null;
    if (rect) {
      rect.setAttribute('fill', palette.clusterBkg ?? (dark ? '#1a2333' : '#f8fafc'));
      rect.setAttribute('stroke', stroke);
      rect.setAttribute('stroke-width', '1.5px');
      rect.setAttribute('rx', '8');
      rect.setAttribute('ry', '8');
    }

    // Column header labels
    for (const title of col.querySelectorAll('.cluster-label, .kanban-label, .cluster-label .nodeLabel, .cluster-label p, .cluster-label span')) {
      title.setAttribute('fill', palette.text);
      if ((title as HTMLElement).style) {
        (title as HTMLElement).style.setProperty('color', palette.text, 'important');
        (title as HTMLElement).style.setProperty('fill', palette.text, 'important');
        (title as HTMLElement).style.fontWeight = '700';
        (title as HTMLElement).style.fontSize = '14px';
      }
    }
  }

  // Kanban card nodes
  for (const node of doc.querySelectorAll('.kanban-item, .kanban-ticket, g.items g.node, g.node[id*="task"]')) {
    const cardRect = node.querySelector('rect.basic, rect') as SVGRectElement | null;
    if (cardRect) {
      cardRect.setAttribute('fill', palette.surface);
      cardRect.setAttribute('stroke', palette.border);
      cardRect.setAttribute('stroke-width', '1.2px');
      cardRect.setAttribute('rx', '6');
      cardRect.setAttribute('ry', '6');
    }

    // Card text word-wrap: critical fix! Mermaid's hardcoded white-space: nowrap causes card text to spill into adjacent columns.
    for (const foDiv of node.querySelectorAll('foreignObject div, .nodeLabel, p, span')) {
      const divEl = foDiv as HTMLElement;
      if (divEl.style) {
        divEl.style.whiteSpace = 'normal';
        divEl.style.wordBreak = 'break-word';
        divEl.style.textAlign = 'left';
        divEl.style.padding = '4px 8px';
        divEl.style.color = palette.text;
        divEl.style.fontSize = '12.5px';
        divEl.style.lineHeight = '1.4';
      }
    }
    for (const text of node.querySelectorAll('text')) {
      text.setAttribute('fill', palette.text);
    }
  }
}

/**
 * Enhances Treemap diagrams with clean section headers, coordinated palette fills for leaf nodes,
 * crisp borders, and distinct label/value positioning.
 */
export function fixTreemapDiagram(doc: Document, palette: PaletteData, dark: boolean): void {
  const root = doc.documentElement;
  const isTreemap = root.getAttribute('aria-roledescription') === 'treemap' ||
    !!doc.querySelector('.treemapContainer, g.treemapSection, rect.treemapLeaf');
  if (!isTreemap) return;

  // Section headers
  for (const section of doc.querySelectorAll('g.treemapSection')) {
    const headerRect = section.querySelector('rect.treemapSectionHeader') as SVGRectElement | null;
    if (headerRect) {
      headerRect.setAttribute('fill', palette.clusterBkg ?? (dark ? '#1a2333' : '#f8fafc'));
      headerRect.setAttribute('stroke', palette.border);
      headerRect.setAttribute('stroke-width', '1px');
      headerRect.setAttribute('rx', '4');
      headerRect.setAttribute('ry', '4');
    }

    const secRect = section.querySelector('rect.treemapSection:not(.section0)') as SVGRectElement | null;
    if (secRect) {
      secRect.setAttribute('stroke', palette.border);
      secRect.setAttribute('stroke-width', '1.5px');
      secRect.setAttribute('rx', '6');
      secRect.setAttribute('ry', '6');
    }

    const secLabel = section.querySelector('text.treemapSectionLabel') as SVGTextElement | null;
    if (secLabel) {
      secLabel.setAttribute('fill', palette.text);
      secLabel.setAttribute('font-weight', '700');
      secLabel.setAttribute('font-size', '13px');
      const sy = parseFloat(secLabel.getAttribute('y') || '0');
      if (sy < 15) secLabel.setAttribute('y', '15');
    }

    const secValue = section.querySelector('text.treemapSectionValue') as SVGTextElement | null;
    if (secValue) {
      secValue.setAttribute('fill', palette.accent);
      secValue.setAttribute('font-weight', '600');
      secValue.setAttribute('font-size', '12px');
      const vy = parseFloat(secValue.getAttribute('y') || '0');
      if (vy < 15) secValue.setAttribute('y', '15');
    }
  }

  // Leaf nodes: coordinated palette fills, borders, and clear typography
  const leafNodes = Array.from(doc.querySelectorAll('g.treemapNode, g.treemapLeafGroup'));
  leafNodes.forEach((leaf, idx) => {
    const fill = palette.fills[idx % palette.fills.length] ?? palette.surface;
    const textColor = palette.textOnFills[idx % palette.fills.length] ?? palette.text;

    const leafRect = leaf.querySelector('rect.treemapLeaf, rect') as SVGRectElement | null;
    if (leafRect) {
      leafRect.setAttribute('fill', fill);
      leafRect.setAttribute('stroke', palette.border);
      leafRect.setAttribute('stroke-width', '1.2px');
      leafRect.setAttribute('rx', '5');
      leafRect.setAttribute('ry', '5');
    }

    const label = leaf.querySelector('text.treemapLabel') as SVGTextElement | null;
    const value = leaf.querySelector('text.treemapValue') as SVGTextElement | null;

    if (label) {
      label.setAttribute('fill', textColor);
      label.setAttribute('font-weight', '600');
      label.setAttribute('font-size', '12px');
    }

    if (value) {
      value.setAttribute('fill', textColor);
      value.setAttribute('opacity', '0.88');
      value.setAttribute('font-size', '11px');

      if (label) {
        const ly = parseFloat(label.getAttribute('y') || '0');
        const vy = parseFloat(value.getAttribute('y') || '0');
        if (Math.abs(vy - ly) < 14) {
          value.setAttribute('y', String(ly + 16));
        }
      }
    }
  });
}

export function styleSvg(
  svg: string,
  direction: Direction | '',
  settings: GenieSettings,
  palette: PaletteData,
  dark: boolean
): string {
  const compactLayout = settings.compactLayout !== false;
  // Fix common HTML entities for valid XML parsing
  svg = svg.replace(/&nbsp;/g, '\u00a0').replace(/<br\s*>/gi, '<br/>');
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return svg;

  const root = doc.documentElement as unknown as SVGSVGElement;
  const isFlowchart = Boolean(direction && /^(TD|TB|BT|LR|RL)$/.test(direction));
  const layoutAxis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
  const layoutSign = /^(BT|RL)$/.test(direction) ? -1 : 1;

  const layoutNodes = isFlowchart ? [...doc.querySelectorAll('g.node')].map(node => {
    const key = node.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1];
    const t = (node.getAttribute('transform') || '').match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
    return {
      node,
      key,
      center: t ? [Number(t[1]), Number(t[2])] as Point : null,
      incoming: key ? nodeLimit(doc, key, direction, false) : NaN,
    };
  }).filter((n): n is LayoutNode => !!n.key && !!n.center) : [];

  const layoutByKey = isFlowchart ? new Map(layoutNodes.map(n => [n.key, n])) : new Map<string, LayoutNode>();
  const layoutEdges = isFlowchart ? [...doc.querySelectorAll('path.flowchart-link, .edgePath path.path')].map(path => {
    const edge = resolveEdge(doc, path);
    if (edge) return { from: layoutByKey.get(edge[1]), to: layoutByKey.get(edge[2]) };
  }).filter((e): e is LayoutEdge => !!e?.from && !!e.to) : [];

  // Pre-index edges by source node for O(1) branch lookups
  const edgesBySource = new Map<LayoutNode, LayoutEdge[]>();
  if (isFlowchart) {
    for (const edge of layoutEdges) {
      let list = edgesBySource.get(edge.from);
      if (!list) {
        list = [];
        edgesBySource.set(edge.from, list);
      }
      list.push(edge);
    }
  }

  const alignedTargets = new Set<string>();

  if (isFlowchart) {
    for (const node of doc.querySelectorAll('g.node')) {
      const key = node.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1];
      if (key) {
        node.setAttribute('data-mpe-key', key);
        node.setAttribute('tabindex', '0');
      }
      const polygon = node.querySelector('polygon');
      const points = (polygon?.getAttribute('points') || '').trim().split(/\s+/).map(p => p.split(',').map(Number))
        .filter((p, i, all) => !i || p[0] !== all[0]![0] || p[1] !== all[0]![1]);
      if (!compactLayout || points.length !== 4) continue;
      const cx = points.reduce((s, p) => s + p[0]!, 0) / 4;
      const cy = points.reduce((s, p) => s + p[1]!, 0) / 4;
      const hw = Math.max(...points.map(p => Math.abs(p[0]! - cx)));
      const hh = Math.max(...points.map(p => Math.abs(p[1]! - cy)));
      const label = node.querySelector('foreignObject');
      const labelHeight = label ? Number(label.getAttribute('height')) : 0;
      const widthRatio = label ? Number(label.getAttribute('width')) / (2 * hw) : 1;
      // Only apply gentle compaction when diamond has substantial excess vertical headroom (> 2x text height)
      if (label && labelHeight > 0 && 2 * hh > labelHeight * 2.2 && widthRatio < 0.95) {
        const needed = Number(label.getAttribute('height')) / (2 * hh) / (0.99 - widthRatio);
        const scale = Math.min(1, Math.max(0.90, needed));
        polygon!.setAttribute('points', points.map(p => `${p[0]!},${cy + (p[1]! - cy) * scale}`).join(' '));
      }
    }

    // Align decision branches leaving same condition
    for (const source of compactLayout ? layoutNodes : []) {
      const outgoingList = edgesBySource.get(source) || [];
      const targets = [...new Set(outgoingList.filter(e =>
        layoutSign * (e.to.center[layoutAxis] - source.center[layoutAxis]) > 0).map(e => e.to))];
      if (targets.length < 2) continue;
      const sameCenters = targets.every(n => Math.abs(n.center[layoutAxis] - targets[0]!.center[layoutAxis]) <= 2);
      const sameIncomingSides = targets.every(n => Math.abs((n.incoming ?? NaN) - (targets[0]!.incoming ?? NaN)) <= 2);
      if (!sameCenters && !sameIncomingSides) continue;
      const limits = targets.map(n => nodeLimit(doc, n.key, direction, false));
      if (!limits.every((limit): limit is number => limit !== undefined && Number.isFinite(limit))) continue;
      const level = layoutSign > 0 ? Math.min(...limits) : Math.max(...limits);
      targets.forEach((n, i) => {
        if (alignedTargets.has(n.key)) return;
        const delta: Point = [0, 0];
        delta[layoutAxis] = level - limits[i]!;
        n.center[layoutAxis] += delta[layoutAxis];
        n.node.setAttribute('transform', `translate(${n.center.join(',')})`);
        alignedTargets.add(n.key);
      });
    }
  }

  const number = '[-+]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][-+]?\\d+)?';
  const segment = new RegExp(`([ML])\\s*(${number})[\\s,]+(${number})`, 'g');
  const labelPositions = new Map<string, Point>();
  const routeExtent: Point[] = [];

  const branchLevels = new Map<string, number>();
  const outgoing = new Map<string, number[]>();
  const sign = /^(BT|RL)$/.test(direction) ? -1 : 1;
  const axis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
  const crossAxis: Axis = axis === 0 ? 1 : 0;

  for (const path of compactLayout ? doc.querySelectorAll('path.flowchart-link, .edgePath path.path') : []) {
    const edge = resolveEdge(doc, path);
    if (!edge || !direction) continue;
    const source = [...doc.querySelectorAll('g.node')].find(n => n.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1] === edge[1]);
    if (!source?.querySelector('polygon')) continue;
    const a = nodeLimit(doc, edge[1], direction, true);
    const b = nodeLimit(doc, edge[2], direction, false);
    if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b) || sign * (b - a) <= 0) continue;
    const levels = outgoing.get(edge[1]) || [];
    levels.push((a + b) / 2);
    outgoing.set(edge[1], levels);
  }
  for (const [source, levels] of outgoing) {
    if (levels.length > 1) branchLevels.set(source, sign > 0 ? Math.min(...levels) : Math.max(...levels));
  }

  // Pre-calculate dedicated disjoint spans for sibling branches leaving the same node
  const outgoingBySource = new Map<string, Array<{ target: string; edgeId: string; crossCoord: number }>>();
  if (compactLayout && direction) {
    for (const path of doc.querySelectorAll('path.flowchart-link, .edgePath path.path')) {
      const edge = resolveEdge(doc, path);
      if (!edge) continue;
      const from = nodeBounds(doc, edge[1]);
      const to = nodeBounds(doc, edge[2]);
      if (!from || !to) continue;
      const delta = to.center[axis] - from.center[axis];
      if (sign * delta > 0) {
        const edgeId = path.getAttribute('data-id') || path.id || `L_${edge[1]}_${edge[2]}_`;
        const list = outgoingBySource.get(edge[1]) || [];
        list.push({ target: edge[2], edgeId, crossCoord: to.center[crossAxis] });
        outgoingBySource.set(edge[1], list);
      }
    }

    for (const [sourceKey, list] of outgoingBySource) {
      const from = nodeBounds(doc, sourceKey);
      if (!from) continue;
      const sourceCenter = from.center[crossAxis];
      const branchLevel = branchLevels.get(sourceKey);

      const left = list.filter(item => item.crossCoord < sourceCenter - 0.01)
        .sort((a, b) => b.crossCoord - a.crossCoord);
      const right = list.filter(item => item.crossCoord > sourceCenter + 0.01)
        .sort((a, b) => a.crossCoord - b.crossCoord);

      let prevLeft = sourceCenter;
      for (const item of left) {
        const midpointCross = (prevLeft + item.crossCoord) / 2;
        const to = nodeBounds(doc, item.target);
        const levelAxis = branchLevel ?? (to ? (from.max[axis] + to.min[axis]) / 2 : from.center[axis]);
        const pos: Point = axis === 1 ? [midpointCross, levelAxis] : [levelAxis, midpointCross];
        labelPositions.set(item.edgeId, pos);
        labelPositions.set(`L_${sourceKey}_${item.target}_`, pos);
        labelPositions.set(`L-${sourceKey}-${item.target}-`, pos);
        prevLeft = item.crossCoord;
      }

      let prevRight = sourceCenter;
      for (const item of right) {
        const midpointCross = (prevRight + item.crossCoord) / 2;
        const to = nodeBounds(doc, item.target);
        const levelAxis = branchLevel ?? (to ? (from.max[axis] + to.min[axis]) / 2 : from.center[axis]);
        const pos: Point = axis === 1 ? [midpointCross, levelAxis] : [levelAxis, midpointCross];
        labelPositions.set(item.edgeId, pos);
        labelPositions.set(`L_${sourceKey}_${item.target}_`, pos);
        labelPositions.set(`L-${sourceKey}-${item.target}-`, pos);
        prevRight = item.crossCoord;
      }
    }
  }

  // Equalize card widths in the same rank/layer for neat, clean block alignment
  if (compactLayout && isFlowchart) {
    equalizeCardWidths(doc, direction);
  }

  // Orthogonal connector routing and corner rounding (flowchart-only)
  if (isFlowchart) {
    for (const path of doc.querySelectorAll('path.flowchart-link, .edgePath path.path')) {
      const d = path.getAttribute('d') || '';
      if (!d) continue;

      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', palette.line);
      path.setAttribute('stroke-width', '1.53px');

      const edge = resolveEdge(doc, path);
      let routed: string | null = null;
      let points = routePoints(d);

      if (compactLayout && direction && edge) {
        const from = nodeBounds(doc, edge[1]);
        const to = nodeBounds(doc, edge[2]);
        if (from && to) {
          const delta = to.center[axis] - from.center[axis];
          if (Math.abs(delta) >= 0.01) {
            const travelSign = Math.sign(delta);
            const pathOffset = transformOffset(path);
            if (pathOffset) {
              const startAnchor: Point = centerAnchor(from, direction, travelSign, true).map((v, i) => v - pathOffset[i]) as Point;
              const endAnchor: Point = centerAnchor(to, direction, travelSign, false).map((v, i) => v - pathOffset[i]) as Point;
              points = [startAnchor, endAnchor];
              const forward = sign * delta > 0;
              if (forward) {
                const sourceLimit = nodeLimit(doc, edge[1], direction, true)! - pathOffset[axis];
                const targetLimit = nodeLimit(doc, edge[2], direction, false)! - pathOffset[axis];
                routed = curvedConnectorPath(
                  points,
                  direction,
                  sourceLimit,
                  targetLimit
                ) ?? orthogonalPath(
                  points,
                  direction,
                  sourceLimit,
                  targetLimit,
                  branchLevels.has(edge[1]) ? branchLevels.get(edge[1])! - pathOffset[axis] : undefined
                );
              } else {
                // Keep Mermaid's outer return lane and remove small stairs
                routed = returnLanePath(points, direction, from, to, pathOffset);
              }
            }
          }
        }
      }

      if (!points || points.length < 2) {
        path.setAttribute('d', softenOrthogonalPath(d, 8));
        continue;
      }

      if (routed) {
        const route = [...routed.matchAll(segment)].map(m => [Number(m[2]), Number(m[3])]);
        const a = route.length > 2 ? route[1] : (route[0] ?? points[0]);
        const b = route.length > 2 ? route[2] : (route[1] ?? points[points.length - 1]);
        const offset = transformOffset(path) || [0, 0];
        if (a && b && Number.isFinite(a[0]) && Number.isFinite(b[0])) {
          const edgeId = path.getAttribute('data-id') || path.id || (edge ? `L_${edge[1]}_${edge[2]}_` : '');
          const fallbackPos: Point = [
            (a[0] + b[0]) / 2 + offset[0],
            (a[1] + b[1]) / 2 + offset[1],
          ];
          if (edgeId && !labelPositions.has(edgeId)) {
            labelPositions.set(edgeId, fallbackPos);
          }
          if (edge) {
            const lKey = `L_${edge[1]}_${edge[2]}_`;
            const hKey = `L-${edge[1]}-${edge[2]}-`;
            if (!labelPositions.has(lKey)) labelPositions.set(lKey, fallbackPos);
            if (!labelPositions.has(hKey)) labelPositions.set(hKey, fallbackPos);
          }
        }
        if (route.length > 0) {
          routeExtent.push(...route.map(pt => pt.map((value, ax) => value + offset[ax]!) as Point));
        } else if (points.length >= 2) {
          routeExtent.push(
            [points[0]![0] + offset[0], points[0]![1] + offset[1]],
            [points[points.length - 1]![0] + offset[0], points[points.length - 1]![1] + offset[1]]
          );
        }
        path.setAttribute('d', routed.includes('C') || routed.includes('Q') ? routed : roundPath(routed, 14));
      } else {
        path.setAttribute('d', d.includes('C') || d.includes('Q') ? d : roundPath(d, 14));
      }
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', palette.line);
      path.setAttribute('stroke-width', '1.53px');
    }
  }

  // Collect non-empty edge labels for positioning and vertical collision avoidance
  const placedLabels: Array<{ el: Element; x: number; y: number; width: number; height: number }> = [];

  for (const label of doc.querySelectorAll('.edgeLabels > .edgeLabel, .edgeLabel')) {
    const text = (label.textContent || '').trim();
    if (!text) {
      // Empty flow edge: remove completely so no small empty rectangles appear
      label.setAttribute('data-empty', 'true');
      label.classList.add('edgeLabel-empty');
      label.remove();
      continue;
    }

    const key = label.getAttribute('data-id') || label.querySelector('[data-id]')?.getAttribute('data-id') || label.id;
    let position = key ? labelPositions.get(key) : undefined;
    if (!position && key) {
      for (const [posKey, pos] of labelPositions) {
        if (posKey && (key.startsWith(posKey) || posKey.startsWith(key))) {
          position = pos;
          break;
        }
      }
    }

    if (position && Number.isFinite(position[0]) && Number.isFinite(position[1])) {
      const fo = label.querySelector('foreignObject');
      const rect = label.querySelector('rect');
      const measuredWidth = fo ? parseFloat(fo.getAttribute('width') || '0')
        : rect ? parseFloat(rect.getAttribute('width') || '0')
        : 0;
      const width = measuredWidth > 0 ? measuredWidth : Math.max(30, text.length * 8 + 16);
      placedLabels.push({
        el: label,
        x: position[0],
        y: position[1],
        width,
        height: 24,
      });
    }
  }

  // Detect and resolve horizontal overlaps on the same level by staggering vertically
  placedLabels.sort((a, b) => a.x - b.x);
  for (let i = 0; i < placedLabels.length - 1; i++) {
    const curr = placedLabels[i]!;
    const next = placedLabels[i + 1]!;
    if (Math.abs(curr.y - next.y) < 12) {
      const minDistance = (curr.width + next.width) / 2 + 8;
      const actualDistance = next.x - curr.x;
      if (actualDistance < minDistance) {
        curr.y -= 12;
        next.y += 12;
      }
    }
  }

  for (const item of placedLabels) {
    const offset = transformOffset(item.el.parentNode) || [0, 0];
    item.el.setAttribute(
      'transform',
      `translate(${item.x - offset[0]},${item.y - offset[1]})`
    );
  }

  // 1. Flowchart and Block arrow markers (pointEnd / pointStart)
  for (const marker of doc.querySelectorAll('marker[id$="pointEnd"], marker[id$="pointStart"], marker[id*="pointEnd"], marker[id*="pointStart"]')) {
    const isBlock = marker.id.toLowerCase().includes('block') || !!doc.querySelector('.block-beta, svg[aria-roledescription="block"], g.block, .block');
    const start = marker.id.toLowerCase().endsWith('pointstart') || marker.id.toLowerCase().includes('pointstart');

    if (isBlock) {
      marker.setAttribute('markerUnits', 'userSpaceOnUse');
      marker.setAttribute('markerWidth', '14');
      marker.setAttribute('markerHeight', '12');
      marker.setAttribute('viewBox', '0 0 14 12');
      marker.setAttribute('refY', '6');
      marker.setAttribute('orient', 'auto');
      marker.setAttribute('refX', start ? '1' : '13');
      const path = marker.querySelector('path');
      if (path) {
        path.setAttribute('d', start ? 'M13 1 L1 6 L13 11 Z' : 'M1 1 L13 6 L1 11 Z');
        path.setAttribute('stroke-width', '0');
        path.setAttribute('fill', palette.line);
      }
    } else {
      marker.setAttribute('markerUnits', 'userSpaceOnUse');
      marker.setAttribute('markerWidth', '8.2');
      marker.setAttribute('markerHeight', '8.2');
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refY', '5');
      marker.setAttribute('orient', 'auto');
      marker.setAttribute('refX', start ? '0' : '10');
      const path = marker.querySelector('path');
      if (path) {
        path.setAttribute('d', start ? 'M10 0 L0 5 L10 10 Z' : 'M0 0 L10 5 L0 10 Z');
        path.setAttribute('stroke-width', '0');
        path.setAttribute('fill', palette.line);
      }
    }
  }

  // 2. State diagram arrow markers (barbEnd / stateDiagram)
  for (const marker of doc.querySelectorAll('marker[id*="barbEnd"], marker[id*="barbend"], marker[id*="barbStart"], marker[id*="barbstart"], marker[id*="stateDiagram"], marker[id*="statediagram"]')) {
    const isStart = marker.id.toLowerCase().includes('barbstart');
    const isMargin = marker.id.toLowerCase().includes('margin');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');
    marker.setAttribute('markerWidth', '14.2');
    marker.setAttribute('markerHeight', '10.2');
    marker.setAttribute('viewBox', '0 0 20 14');
    marker.setAttribute('refX', isStart ? '0' : (isMargin ? '17' : '19'));
    marker.setAttribute('refY', '7');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('overflow', 'visible');
    const path = marker.querySelector('path');
    if (path) {
      path.setAttribute('d', isStart ? 'M 19,2 L 9,7 L 19,12 Z' : 'M 9,2 L 19,7 L 9,12 Z');
      path.setAttribute('stroke-width', '0');
      path.setAttribute('fill', palette.line);
      path.setAttribute('stroke', palette.line);
    }
  }

  // Ensure state diagram transition connector paths have high-contrast lines and no fill
  for (const path of doc.querySelectorAll('path.transition, .edgePaths path.transition, .stateGroup .transition')) {
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', palette.line);
    path.setAttribute('stroke-width', '1.53px');
  }

  for (const node of doc.querySelectorAll('g.node')) {
    const polygon = node.querySelector('polygon');
    const points = (polygon?.getAttribute('points') || '').trim().split(/\s+/).map(p => p.split(',').map(Number))
      .filter((p, i, all) => !i || p[0] !== all[0]![0] || p[1] !== all[0]![1]);
    if (points.length === 4) {
      node.classList.add('mpe-decision');
      node.setAttribute('tabindex', '0');
    }
  }

  // Format edge label badges so words over arrows are never blocked
  for (const label of doc.querySelectorAll('.edgeLabel')) {
    const text = (label.textContent || '').trim();
    if (!text) {
      label.setAttribute('data-empty', 'true');
      label.classList.add('edgeLabel-empty');
      label.remove();
      continue;
    }
    // 1. For SVG rects inside edgeLabel
    for (const rect of label.querySelectorAll('rect')) {
      const width = parseFloat(rect.getAttribute('width') || '0');
      const height = parseFloat(rect.getAttribute('height') || '0');
      if (width > 0 && height > 0) {
        const padX = 8;
        const padY = 4;
        rect.setAttribute('x', String(parseFloat(rect.getAttribute('x') || '0') - padX));
        rect.setAttribute('y', String(parseFloat(rect.getAttribute('y') || '0') - padY));
        rect.setAttribute('width', String(width + padX * 2));
        rect.setAttribute('height', String(height + padY * 2));
        rect.setAttribute('rx', '5');
        rect.setAttribute('ry', '5');
        rect.setAttribute('fill', palette.label);
        rect.setAttribute('stroke', palette.border);
        rect.setAttribute('stroke-width', '1px');
        if (rect.style) rect.style.opacity = '1';
        else rect.setAttribute('opacity', '1');
      }
    }

    // 2. For HTML foreignObjects inside edgeLabel
    for (const fo of label.querySelectorAll('foreignObject')) {
      const width = parseFloat(fo.getAttribute('width') || '0');
      const height = parseFloat(fo.getAttribute('height') || '0');
      if (width > 0 && height > 0) {
        fo.setAttribute('width', String(width + 24));
        fo.setAttribute('height', String(height + 12));
        fo.setAttribute('x', String(parseFloat(fo.getAttribute('x') || '0') - 12));
        fo.setAttribute('y', String(parseFloat(fo.getAttribute('y') || '0') - 6));
        if (fo.style) fo.style.overflow = 'visible';
      }
    }
  }

  // Ensure edgeLabels group is on top of connector lines in SVG rendering order
  const edgeLabelsGroup = doc.querySelector('g.edgeLabels');
  if (edgeLabelsGroup && edgeLabelsGroup.parentElement) {
    edgeLabelsGroup.parentElement.appendChild(edgeLabelsGroup);
  }

  // Resolve Kanban and cluster header overlaps so column titles are never blocked by cards
  fixClusterHeaderOverlap(doc);

  // Resolve Sankey diagram label overlaps and gradients
  fixSankeyCollisions(doc, palette, dark);

  // Resolve C4 architecture relationship label overlaps and add clean badge pills
  fixC4RelationshipCollisions(doc, palette);

  // Expand viewBox if outer return lanes or routes extend past original dimensions
  const viewBox = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (routeExtent.length && viewBox.length === 4 && viewBox.every(Number.isFinite)) {
    const [x, y, width, height] = viewBox as [number, number, number, number];
    const left = Math.min(x, ...routeExtent.map(p => p[0] - 6));
    const top = Math.min(y, ...routeExtent.map(p => p[1] - 6));
    const right = Math.max(x + width, ...routeExtent.map(p => p[0] + 6));
    const bottom = Math.max(y + height, ...routeExtent.map(p => p[1] + 6));
    const sizes = [right - left, bottom - top];
    root.setAttribute('viewBox', `${left} ${top} ${sizes.join(' ')}`);
    for (const [name, size] of [['width', sizes[0]], ['height', sizes[1]]] as const) {
      if (/^[\d.]+$/.test(root.getAttribute(name) || '')) root.setAttribute(name, String(size));
    }
    if (Math.abs(parseFloat(root.style.maxWidth) - width) < 1) root.style.maxWidth = `${sizes[0]}px`;
  }

  if (isFlowchart) {
    // Set hierarchy data attributes for path highlighting traversal
    const hierarchyNodes = [...doc.querySelectorAll('g.node[data-mpe-key]')];
    const posAxis = /^(TD|TB|BT)$/.test(direction) ? 2 : 1;
    const position = (node: Element) => Number((node.getAttribute('transform') || '').match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/)?.[posAxis]);
    const hierarchyByKey = new Map(hierarchyNodes.map(n => [n.getAttribute('data-mpe-key'), n]));

    for (const path of doc.querySelectorAll('path.flowchart-link, .edgePath path.path')) {
      const edge = resolveEdge(doc, path);
      if (!edge || !direction) continue;
      const from = hierarchyByKey.get(edge[1]), to = hierarchyByKey.get(edge[2]);
      if (!from || !to) continue;
      path.setAttribute('data-mpe-from', edge[1]);
      path.setAttribute('data-mpe-to', edge[2]);
      path.setAttribute('data-mpe-forward', String(sign * (position(to) - position(from)) > 0));
    }
  }

  // Apply corner rounding to rectangles
  if (settings.nodeRadius > 0) {
    for (const rect of doc.querySelectorAll('.node rect:not(.labelBkg)')) {
      rect.setAttribute('rx', String(settings.nodeRadius));
      rect.setAttribute('ry', String(settings.nodeRadius));
    }
  }

  // Apply colored flow blocks using graph group structure and palette
  applyFlowchartColors(root, palette, dark, settings.colorStyle);

  if (dark) {
    // Normalise hardcoded #444444 lines, paths, and text in C4 architecture to high-contrast palette colors
    for (const el of doc.querySelectorAll('[stroke="#444444"], [stroke="#444"], [stroke="#333333"]')) {
      el.setAttribute('stroke', palette.line);
    }
    for (const el of doc.querySelectorAll('[fill="#444444"], [fill="#444"], [fill="#333333"]')) {
      el.setAttribute('fill', palette.text);
    }
    // Ensure timeline event text is high-contrast
    for (const text of doc.querySelectorAll('g[class*="timeline"] text, g[class*="event"] text, .event text, .timeline-event text')) {
      const fill = (text.getAttribute('fill') || '').toLowerCase();
      if (!fill || fill === '#000000' || fill === '#000' || fill === 'black' || fill === '#111111') {
        text.setAttribute('fill', palette.text);
      }
    }
  }

  // Specialized diagram type cosmetic styling
  fixRequirementDiagram(doc, palette, dark);
  fixBlockDiagram(doc, palette, dark);
  fixGanttChart(doc, palette, dark);
  fixClassDiagram(doc, palette, dark);
  fixEntityRelationshipDiagram(doc, palette, dark);
  fixKanbanDiagram(doc, palette, dark);
  fixTreemapDiagram(doc, palette, dark);

  // Mark SVG as enhanced and set custom properties
  root.classList?.add?.('mfe-enhanced', 'mermaid-genie-diagram');
  if (root.style?.setProperty) {
    root.style.setProperty('--mpe-duration', `${settings.animationDuration ?? 450}ms`);
    root.style.setProperty('--mpe-highlight', palette.accent);
    root.style.setProperty('--mpe-line', palette.line);
    root.style.setProperty('--mpe-border', palette.border);
    root.style.setProperty('--mpe-node', palette.surface);
    root.style.setProperty('--mpe-text', palette.text);
    root.style.setProperty('--mpe-label', palette.label);
  }

  return new XMLSerializer().serializeToString(doc.documentElement);
}

export function widenSingleRectangles(source: string, svg: string, direction: Direction | ''): string {
  if (!/^(TD|TB|BT)$/.test(direction)) return source;
  const doc = new DOMParser().parseFromString(svg.replace(/<br\s*>/gi, '<br/>'), 'image/svg+xml');
  const nodes = [...doc.querySelectorAll('g.node')].map(node => {
    const t = (node.getAttribute('transform') || '').match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
    const key = node.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1];
    return { key, y: t ? Number(t[2]) : NaN, rect: !!node.querySelector('rect') };
  }).filter(n => n.key && Number.isFinite(n.y));
  const single = new Set(nodes.filter(n => n.rect &&
    !nodes.some(other => other !== n && Math.abs(other.y - n.y) < 2)).map(n => n.key));
  return source.replace(/([\p{L}\p{N}_-]+)\["([^"\n]+)"\]/gu, (whole: string, key: string, label: string): string => {
    if (!single.has(key) || label.length > 55 || /[<>&`]/.test(label)) return whole;
    return `${key}["${label.replace(/ /g, '\u00a0')}"]`;
  });
}

export function wrapDecisions(source: string): string {
  let context: CanvasRenderingContext2D | null = null;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    context = canvas.getContext('2d');
  }
  if (!context) return source;
  context.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif';
  return source.replace(/([\p{L}\p{N}_-]+)\{"([^"\n]+)"\}/gu, (whole: string, key: string, label: string): string => {
    if (/[<>&`]/.test(label) || context.measureText(label).width <= 140) return whole;
    const words = label.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > 140) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return `${key}{"${lines.join('<br/>')}"}`;
  });
}
