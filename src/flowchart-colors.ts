import type { PaletteData } from './colors';
import { textOnFill } from './colors';
import { flowchartGroups, type FlowchartEdge, type FlowchartNode } from './flowchart-groups';

/** Extracts the author's original source ID from Mermaid's generated DOM ID. */
export function flowchartSourceId(nodeId: string, diagramId = ''): string {
  let localId = nodeId;
  if (diagramId && localId.startsWith(`${diagramId}-`)) {
    localId = localId.slice(diagramId.length + 1);
  }
  const match = /(?:^|-)flowchart-(.+)-\d+$/.exec(localId);
  return match?.[1] ?? localId;
}

/** Extracts nodes and edges from the rendered SVG to reconstruct the flowchart graph. */
export function extractGraphFromSvg(doc: Document | Element): { nodes: FlowchartNode[]; edges: FlowchartEdge[] } {
  const diagramId = (doc instanceof Document ? doc.documentElement : doc).getAttribute('id') ?? '';
  const nodes: FlowchartNode[] = [];
  const edges: FlowchartEdge[] = [];
  const seenNodes = new Set<string>();

  // Extract cluster subgraphs
  for (const cluster of doc.querySelectorAll('g.cluster')) {
    const rawId = cluster.getAttribute('id') || '';
    const id = flowchartSourceId(rawId, diagramId);
    if (!id || seenNodes.has(id)) continue;
    seenNodes.add(id);
    const parentCluster = cluster.parentElement?.closest('g.cluster');
    const parentId = parentCluster ? flowchartSourceId(parentCluster.getAttribute('id') || '', diagramId) : undefined;
    nodes.push({ id, parentId, isGroup: true });
  }

  // Extract nodes
  for (const node of doc.querySelectorAll('g.node')) {
    const rawId = node.getAttribute('data-mpe-key') || node.getAttribute('id') || '';
    const id = flowchartSourceId(rawId, diagramId);
    if (!id || seenNodes.has(id)) continue;
    seenNodes.add(id);
    const parentCluster = node.closest('g.cluster');
    const parentId = parentCluster ? flowchartSourceId(parentCluster.getAttribute('id') || '', diagramId) : undefined;
    nodes.push({ id, parentId });
  }

  // Extract edges
  const seenEdges = new Set<string>();
  const linkElements = doc.querySelectorAll('path.flowchart-link, .edgePath path.path, g.edgePath');
  for (const el of linkElements) {
    let from = el.getAttribute('data-mpe-from');
    let to = el.getAttribute('data-mpe-to');

    if (!from || !to) {
      // Check classes like LS-nodeA LE-nodeB
      const cls = (el.getAttribute('class') || '') + ' ' + (el.parentElement?.getAttribute('class') || '');
      const startMatch = /\bLS-([^\s]+)\b/.exec(cls);
      const endMatch = /\bLE-([^\s]+)\b/.exec(cls);
      if (startMatch && endMatch) {
        from = flowchartSourceId(startMatch[1]!, diagramId);
        to = flowchartSourceId(endMatch[1]!, diagramId);
      }
    }

    if (!from || !to) {
      // Check ID like L_nodeA_nodeB_0 or L-nodeA-nodeB-0
      const idStr = el.getAttribute('id') || el.parentElement?.getAttribute('id') || '';
      const idMatch = /^L[_-](.+?)[_-](.+?)[_-]\d+$/.exec(idStr);
      if (idMatch) {
        from = flowchartSourceId(idMatch[1]!, diagramId);
        to = flowchartSourceId(idMatch[2]!, diagramId);
      }
    }

    if (from && to && from !== to) {
      const edgeKey = `${from}->${to}`;
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey);
        const isDotted = el.classList.contains('edge-pattern-dotted') || (el.getAttribute('stroke-dasharray') && el.getAttribute('stroke-dasharray') !== 'none');
        edges.push({
          start: from,
          end: to,
          pattern: isDotted ? 'dotted' : 'solid',
        });
      }
    }
  }

  return { nodes, edges };
}

/** Colors nodes and cluster blocks according to their graph group and palette colors. */
export function applyFlowchartColors(
  root: Element,
  palette: PaletteData,
  dark: boolean,
  colorStyle: 'multi' | 'single' | 'custom'
): void {
  const diagramId = root.getAttribute('id') ?? '';
  const { nodes, edges } = extractGraphFromSvg(root);
  const groups = colorStyle === 'multi' ? flowchartGroups(nodes, edges) : undefined;
  const fills = palette.fills;
  const borders = palette.borders;

  // Style cluster groups
  for (const cluster of root.querySelectorAll('g.cluster')) {
    const rawId = cluster.getAttribute('id') || '';
    const id = flowchartSourceId(rawId, diagramId);
    const slot = groups?.get(id) ?? 0;
    const clusterFill = colorStyle === 'multi' && fills.length > 0 ? fills[slot % fills.length] : palette.clusterBkg;
    const clusterBorder = colorStyle === 'multi' && borders.length > 0 ? borders[slot % borders.length] : palette.clusterBorder;

    const clusterShapes = Array.from(cluster.querySelectorAll(':scope > rect, :scope > path')) as SVGElement[];
    for (const shape of clusterShapes) {
      if (!shape.style.fill && clusterFill) {
        shape.style.fill = clusterFill;
        shape.style.fillOpacity = dark ? '0.22' : '0.35';
      }
      if (!shape.style.stroke && clusterBorder) {
        shape.style.stroke = clusterBorder;
        shape.style.strokeWidth = '1.2px';
      }
    }
  }

  // Style nodes
  for (const node of Array.from(root.querySelectorAll('g.node')) as SVGElement[]) {
    const rawId = node.getAttribute('data-mpe-key') || node.getAttribute('id') || '';
    const id = flowchartSourceId(rawId, diagramId);
    const slot = groups?.get(id) ?? 0;

    const fill = colorStyle === 'multi' && fills.length > 0
      ? fills[slot % fills.length]!
      : palette.surface;
    const border = colorStyle === 'multi' && borders.length > 0
      ? borders[slot % borders.length]!
      : palette.border;

    const textColor = textOnFill(fill, palette.text, 4.5);

    // Set CSS custom properties on the node container
    node.style.setProperty('--node-fill', fill);
    node.style.setProperty('--node-border', border);
    node.style.setProperty('--node-text', textColor);

    // Target the shape element inside the node
    const shapeElements = Array.from(node.querySelectorAll(':scope > .label-container, :scope > rect, :scope > polygon, :scope > circle, :scope > ellipse, :scope > path')) as SVGElement[];
    const shapes: SVGElement[] = shapeElements.length > 0
      ? shapeElements
      : (Array.from(node.querySelectorAll('rect, polygon, circle, ellipse, path')) as SVGElement[]);

    for (const shape of shapes) {
      // Do not override author's explicit inline styling or stroke-only elements
      if (shape.classList.contains('arrowMarkerPath')) continue;
      if (!shape.style.fill && shape.getAttribute('fill') !== 'none') {
        shape.style.fill = fill;
      }
      if (!shape.style.stroke) {
        shape.style.stroke = border;
        shape.style.strokeWidth = '1.25px';
      }
    }

    // Apply readable text color to labels
    for (const textEl of Array.from(node.querySelectorAll('.nodeLabel, .label text, text, .nodeLabel p, foreignObject div'))) {
      if (textEl instanceof HTMLElement) {
        textEl.style.color = textColor;
      } else if (textEl instanceof SVGElement) {
        textEl.style.fill = textColor;
      }
    }
  }
}
