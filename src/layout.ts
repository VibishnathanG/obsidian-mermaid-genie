import type { PaletteData } from './colors';
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

    const desiredCardTop = labelBottomY + 14;
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
  const layoutAxis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
  const layoutSign = /^(BT|RL)$/.test(direction) ? -1 : 1;

  const layoutNodes = [...doc.querySelectorAll('g.node')].map(node => {
    const key = node.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1];
    const t = (node.getAttribute('transform') || '').match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
    return {
      node,
      key,
      center: t ? [Number(t[1]), Number(t[2])] as Point : null,
      incoming: key ? nodeLimit(doc, key, direction, false) : NaN,
    };
  }).filter((n): n is LayoutNode => !!n.key && !!n.center);

  const layoutByKey = new Map(layoutNodes.map(n => [n.key, n]));
  const layoutEdges = [...doc.querySelectorAll('path.flowchart-link, .edgePath path.path')].map(path => {
    const edge = resolveEdge(doc, path);
    if (edge) return { from: layoutByKey.get(edge[1]), to: layoutByKey.get(edge[2]) };
  }).filter((e): e is LayoutEdge => !!e?.from && !!e.to);

  const alignedTargets = new Set<string>();

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
    const targets = [...new Set(layoutEdges.filter(e => e.from === source &&
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
  if (compactLayout) {
    equalizeCardWidths(doc, direction);
  }

  const isFlowchart = Boolean(direction && /^(TD|TB|BT|LR|RL)$/.test(direction));

  // Orthogonal connector routing and corner rounding (flowchart-only)
  if (isFlowchart) {
    for (const path of doc.querySelectorAll('path.flowchart-link, .edgePath path.path')) {
      const d = path.getAttribute('d') || '';
      if (!d) continue;

      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', palette.line);
      path.setAttribute('stroke-width', '1.5px');

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
      path.setAttribute('stroke-width', '1.5px');
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

  // 1. Flowchart arrow markers (pointEnd / pointStart)
  for (const marker of doc.querySelectorAll('marker[id$="pointEnd"], marker[id$="pointStart"]')) {
    marker.setAttribute('markerUnits', 'userSpaceOnUse');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refY', '5');
    marker.setAttribute('orient', 'auto');
    const start = marker.id.endsWith('pointStart');
    marker.setAttribute('refX', start ? '0' : '10');
    const path = marker.querySelector('path');
    if (path) {
      path.setAttribute('d', start ? 'M10 0 L0 5 L10 10 Z' : 'M0 0 L10 5 L0 10 Z');
      path.setAttribute('stroke-width', '0');
      path.setAttribute('fill', palette.line);
    }
  }

  // 2. State diagram arrow markers (barbEnd / stateDiagram)
  for (const marker of doc.querySelectorAll('marker[id*="barbEnd"], marker[id*="barbend"], marker[id*="barbStart"], marker[id*="barbstart"], marker[id*="stateDiagram"], marker[id*="statediagram"]')) {
    const isStart = marker.id.toLowerCase().includes('barbstart');
    const isMargin = marker.id.toLowerCase().includes('margin');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');
    marker.setAttribute('markerWidth', '14');
    marker.setAttribute('markerHeight', '10');
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
    path.setAttribute('stroke-width', '1.5px');
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
