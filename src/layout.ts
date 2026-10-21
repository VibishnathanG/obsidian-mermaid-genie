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

  // Equalize widths in each layer
  for (const layer of layers) {
    const maxWidth = Math.max(...layer.map(c => c.width));
    for (const card of layer) {
      const diff = maxWidth - card.width;
      if (diff > 1 && diff <= 140) {
        card.rect.setAttribute('width', String(maxWidth));
        card.rect.setAttribute('x', String(-maxWidth / 2));
      }
    }
  }
}

/** Processes and enhances the Mermaid SVG diagram with layout alignment, coloring, and clean formatting. */
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
    const widthRatio = label ? Number(label.getAttribute('width')) / (2 * hw) : 1;
    const needed = label && widthRatio < 0.99
      ? Number(label.getAttribute('height')) / (2 * hh) / (0.99 - widthRatio) : 1;
    const scale = Math.min(1, Math.max(0.76, needed));
    polygon!.setAttribute('points', points.map(p => `${p[0]!},${cy + (p[1]! - cy) * scale}`).join(' '));
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

  // Equalize card widths in the same rank/layer for neat, clean block alignment
  if (compactLayout) {
    equalizeCardWidths(doc, direction);
  }

  // Orthogonal connector routing and corner rounding
  for (const path of doc.querySelectorAll('path.flowchart-link, .edgePath path.path')) {
    const d = path.getAttribute('d') || '';
    if (!d) continue;

    const edge = resolveEdge(doc, path);
    let handled = false;

    // Handle return loops through outer lane if backwards
    if (compactLayout && direction && edge) {
      const from = nodeBounds(doc, edge[1]);
      const to = nodeBounds(doc, edge[2]);
      const axis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
      if (from && to) {
        const delta = to.center[axis] - from.center[axis];
        const forward = sign * delta > 0;
        if (!forward) {
          const points = routePoints(d);
          const pathOffset = transformOffset(path);
          if (points && points.length >= 2 && pathOffset) {
            const routed = returnLanePath(points, direction, from, to, pathOffset);
            if (routed) {
              const route = [...routed.matchAll(segment)].map(m => [Number(m[2]), Number(m[3])]);
              routeExtent.push(...route.map(pt => pt.map((value, ax) => value + pathOffset[ax]!) as Point));
              path.setAttribute('d', roundPath(routed, 8));
              handled = true;
            }
          }
        }
      }
    }

    if (!handled) {
      // Soften orthogonal bends with rounded beziers without displacing label clearance
      path.setAttribute('d', softenOrthogonalPath(d, 12));
    }
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
        rect.style.opacity = '1';
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
        fo.style.overflow = 'visible';
      }
    }
  }

  // Ensure edgeLabels group is on top of connector lines in SVG rendering order
  const edgeLabelsGroup = doc.querySelector('g.edgeLabels');
  if (edgeLabelsGroup && edgeLabelsGroup.parentElement) {
    edgeLabelsGroup.parentElement.appendChild(edgeLabelsGroup);
  }

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

  // Clean triangular markers for connectors
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

  // Mark SVG as enhanced and set custom properties
  root.classList.add('mfe-enhanced', 'mermaid-genie-diagram');
  root.style.setProperty('--mpe-duration', `${settings.animationDuration ?? 450}ms`);
  root.style.setProperty('--mpe-highlight', palette.accent);
  root.style.setProperty('--mpe-line', palette.line);
  root.style.setProperty('--mpe-border', palette.border);
  root.style.setProperty('--mpe-node', palette.surface);
  root.style.setProperty('--mpe-text', palette.text);
  root.style.setProperty('--mpe-label', palette.label);

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
  context.font = '15px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  return source.replace(/([\p{L}\p{N}_-]+)\{"([^"\n]+)"\}/gu, (whole: string, key: string, label: string): string => {
    if (/[<>&`]/.test(label) || context.measureText(label).width <= 110) return whole;
    const words = label.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > 110) {
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
