export interface PathEdge {
  from: string;
  to: string;
  id: string;
  forward?: boolean;
}

export interface AncestorPath {
  nodes: Set<string>;
  edges: Set<string>;
}

type TimerHandle = number;
export interface PathTimers {
  setTimeout(callback: () => void, delay: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export interface PathController {
  enter(event: Event): void;
  leave(event: Event): void;
  dispose(): void;
}

export function ancestorPath(edges: readonly PathEdge[], target: string): AncestorPath {
  const nodes = new Set([target]), selected = new Set<string>(), pending = [target];
  const incoming = new Map<string, PathEdge[]>();
  for (const edge of edges) {
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    incoming.get(edge.to)!.push(edge);
  }
  while (pending.length) {
    const key = pending.pop()!;
    for (const edge of incoming.get(key) || []) {
      selected.add(edge.id);
      if (!nodes.has(edge.from)) {
        nodes.add(edge.from);
        pending.push(edge.from);
      }
    }
  }
  return { nodes, edges: selected };
}

interface CachedSvgGraph {
  edges: PathEdge[];
  edgeById: Map<string, PathEdge>;
  interactiveElements: Element[];
}

const svgGraphCache = new WeakMap<SVGSVGElement, CachedSvgGraph>();

function getSvgGraph(svg: SVGSVGElement): CachedSvgGraph {
  let cached = svgGraphCache.get(svg);
  if (!cached) {
    const paths = Array.from(svg.querySelectorAll('[data-mpe-from][data-mpe-to]'));
    const edges: PathEdge[] = paths.map(path => ({
      from: path.getAttribute('data-mpe-from')!,
      to: path.getAttribute('data-mpe-to')!,
      id: path.getAttribute('data-id') || path.id,
      forward: path.getAttribute('data-mpe-forward') === 'true',
    }));
    const edgeById = new Map<string, PathEdge>(edges.map(e => [e.id, e]));
    const interactiveElements = Array.from(svg.querySelectorAll('.node, .flowchart-link, .edgePath, .edgeLabels > .edgeLabel'));
    cached = { edges, edgeById, interactiveElements };
    svgGraphCache.set(svg, cached);
  }
  return cached;
}

export function highlightAncestors(element: Element): void {
  const svg = element.closest('svg') as SVGSVGElement | null;
  if (!svg) return;
  const { edges, edgeById, interactiveElements } = getSvgGraph(svg);

  const key = element.getAttribute('data-mpe-key');
  const id = element.getAttribute('data-id') || element.querySelector('[data-id]')?.getAttribute('data-id') || element.id;
  const edge = key ? null : (id ? edgeById.get(id) : null);
  if (!key && !edge) return;

  const selected = ancestorPath(edges.filter(e => e.forward), key || edge!.from);
  if (edge) {
    selected.nodes.add(edge.to);
    selected.edges.add(edge.id);
  }

  svg.classList.add('mpe-tracing');
  for (const el of interactiveElements) {
    const elKey = el.getAttribute('data-mpe-key');
    const elId = el.getAttribute('data-id') || el.querySelector('[data-id]')?.getAttribute('data-id') || el.id;
    el.classList.toggle('mpe-on-path', elKey ? selected.nodes.has(elKey) : (elId ? selected.edges.has(elId) : false));
  }
}

export function createPathController(
  doc: Pick<Document, 'querySelectorAll'>,
  getSettings: () => { pathHighlight: boolean; hoverDelay: number },
  timers?: PathTimers
): PathController {
  const target = '.mermaid svg.mfe-enhanced .node, .mermaid svg.mfe-enhanced .flowchart-link, .mermaid svg.mfe-enhanced .edgePath path.path, .mermaid svg.mfe-enhanced .edgeLabels > .edgeLabel';
  const pending = new Map<Element, { handle: TimerHandle; timers: PathTimers }>();
  let disposed = false;

  const cancel = (svg: Element) => {
    const timer = pending.get(svg);
    if (timer !== undefined) timer.timers.clearTimeout(timer.handle);
    pending.delete(svg);
  };

  const reset = (svg: Element) => {
    svg.classList.remove('mpe-tracing');
    svg.querySelectorAll('.mpe-on-path').forEach(el => el.classList.remove('mpe-on-path'));
  };

  return {
    enter(event) {
      if (disposed || !getSettings().pathHighlight) return;
      const node = (event.target as Element | null)?.closest?.(target);
      if (!node) return;
      const svg = node.closest('svg');
      if (!svg) return;
      cancel(svg);
      highlightAncestors(node);
    },
    leave(event) {
      if (disposed) return;
      const node = (event.target as Element | null)?.closest?.(target);
      if (!node || node.contains((event as MouseEvent | FocusEvent).relatedTarget as Node | null)) return;
      const svg = node.closest('svg');
      if (!svg) return;
      cancel(svg);
      const ownerWindow = svg.ownerDocument?.defaultView;
      const ownerTimers = timers ?? {
        setTimeout: (callback: () => void, delay: number) => (ownerWindow ?? window).setTimeout(callback, delay),
        clearTimeout: (handle: TimerHandle) => (ownerWindow ?? window).clearTimeout(handle),
      };
      const handle = ownerTimers.setTimeout(() => {
        pending.delete(svg);
        reset(svg);
      }, getSettings().hoverDelay);
      pending.set(svg, { handle, timers: ownerTimers });
    },
    dispose() {
      disposed = true;
      pending.forEach(timer => timer.timers.clearTimeout(timer.handle));
      pending.clear();
      doc.querySelectorAll('svg.mfe-enhanced').forEach(reset);
    },
  };
}
