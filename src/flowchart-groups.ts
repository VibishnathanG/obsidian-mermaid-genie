export interface FlowchartNode {
  id: string;
  parentId?: string;
  isGroup?: boolean;
}

export interface FlowchartEdge {
  start: string;
  end: string;
  pattern?: string;
  arrowTypeStart?: string;
}

/** Assigns bounded palette color slots (0, 1, 2...) based on flowchart graph structure. */
export function flowchartGroups(nodes: readonly FlowchartNode[], edges: readonly FlowchartEdge[]): Map<string, number> {
  const vertices = nodes.filter(node => !node.isGroup);
  const groups = new Map(nodes.map(node => [node.id, node.isGroup ? `group:${node.id}` : node.parentId ? `group:${node.parentId}` : `node:${node.id}`]));
  const neighbors = new Map(vertices.filter(node => !node.parentId).map(node => [node.id, new Set<string>()]));
  const outgoing = new Map([...neighbors.keys()].map(id => [id, new Set<string>()]));
  const incoming = new Map([...neighbors.keys()].map(id => [id, new Set<string>()]));

  // Dotted references and invisible layout links must not fragment continuous chains.
  const solid = edges.filter(edge => edge.pattern !== 'dotted' && edge.pattern !== 'invisible');
  for (const edge of solid) {
    if (!neighbors.has(edge.start) || !neighbors.has(edge.end) || edge.start === edge.end) continue;
    neighbors.get(edge.start)!.add(edge.end);
    neighbors.get(edge.end)!.add(edge.start);
    outgoing.get(edge.start)!.add(edge.end);
    incoming.get(edge.end)!.add(edge.start);
    if (edge.arrowTypeStart && edge.arrowTypeStart !== 'none') {
      outgoing.get(edge.end)!.add(edge.start);
      incoming.get(edge.start)!.add(edge.end);
    }
  }

  const cuts = new Map<string, Set<string>>();
  const addCut = (from: string, to: string) => {
    if (!cuts.has(from)) cuts.set(from, new Set());
    cuts.get(from)!.add(to);
    if (!cuts.has(to)) cuts.set(to, new Set());
    cuts.get(to)!.add(from);
  };

  // 1. Separate branches at decision forks and parallel paths
  for (const [start, targets] of outgoing) {
    if (targets.size < 2) continue;
    const branches: string[] = [];
    for (const end of targets) {
      if (outgoing.get(end)?.has(start)) continue;
      // Forward-only traversal along directed outgoing edges to prevent false cycles through join nodes
      const seen = new Set([end]), queue = [end];
      for (let i = 0; i < queue.length; i++) {
        const current = queue[i]!;
        for (const next of outgoing.get(current) ?? []) {
          if (!seen.has(next)) { seen.add(next); queue.push(next); }
        }
      }
      if (!seen.has(start)) {
        if (seen.size >= 2 || targets.size > 2) {
          branches.push(end);
        }
      }
    }
    const allLeaves = Array.from(targets).every(t => (outgoing.get(t)?.size ?? 0) === 0);
    // When 2 or more distinct branches exist, or all parallel targets are choices/leaves
    if (branches.length >= 2 || (targets.size > 2 && branches.length >= 1) || (allLeaves && targets.size >= 2)) {
      for (const target of targets) {
        addCut(start, target);
      }
    }
  }

  // 2. Separate reconverged paths at join nodes (in-degree >= 2)
  for (const [node, sources] of incoming) {
    if (sources.size >= 2) {
      for (const src of sources) {
        addCut(src, node);
      }
    }
  }

  const visited = new Set<string>();
  for (const id of [...neighbors.keys()].sort()) {
    if (visited.has(id)) continue;
    const queue = [id];
    visited.add(id);
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i]!;
      groups.set(current, `node:${id}`);
      for (const next of neighbors.get(current) ?? []) {
        if (visited.has(next) || cuts.get(current)?.has(next) || cuts.get(next)?.has(current)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
  }

  // Assign a bounded set of color slots in stable graph order.
  const links = new Map([...new Set(groups.values())].sort().map(group => [group, new Set<string>()]));
  const groupIncoming = new Set<string>();
  for (const edge of solid) {
    const from = groups.get(edge.start), to = groups.get(edge.end);
    if (!from || !to || from === to) continue;
    links.get(from)?.add(to);
    groupIncoming.add(to);
  }

  const slots = new Map<string, number>();
  const roots = [...links.keys()].filter(group => !groupIncoming.has(group));
  for (const root of [...roots, ...links.keys()]) {
    if (slots.has(root)) continue;
    const queue = [root];
    slots.set(root, slots.size);
    for (let i = 0; i < queue.length; i++) {
      for (const next of [...(links.get(queue[i]!) ?? [])].sort()) {
        if (slots.has(next)) continue;
        slots.set(next, slots.size);
        queue.push(next);
      }
    }
  }

  return new Map([...groups].map(([id, group]) => [id, slots.get(group) ?? 0]));
}
