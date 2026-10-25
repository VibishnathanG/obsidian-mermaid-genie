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
  const diagramId = ('documentElement' in doc ? (doc as Document).documentElement : doc).getAttribute('id') ?? '';
  const nodes: FlowchartNode[] = [];
  const edges: FlowchartEdge[] = [];
  const seenNodes = new Set<string>();

  // Extract cluster subgraphs
  const clusterBoxes: Array<{ id: string; box: [number, number, number, number] }> = [];
  for (const cluster of doc.querySelectorAll('g.cluster, g.pele-cluster')) {
    const rawId = cluster.getAttribute('id') || cluster.getAttribute('data-id') || '';
    const id = flowchartSourceId(rawId, diagramId);
    if (!id || seenNodes.has(id)) continue;
    seenNodes.add(id);
    const parentCluster = cluster.parentElement?.closest('g.cluster, g.pele-cluster');
    const parentId = parentCluster ? flowchartSourceId(parentCluster.getAttribute('id') || parentCluster.getAttribute('data-id') || '', diagramId) : undefined;
    nodes.push({ id, parentId, isGroup: true });

    const rect = cluster.querySelector(':scope > rect, rect');
    if (rect) {
      const rx = parseFloat(rect.getAttribute('x') || '0');
      const ry = parseFloat(rect.getAttribute('y') || '0');
      const rw = parseFloat(rect.getAttribute('width') || '0');
      const rh = parseFloat(rect.getAttribute('height') || '0');
      clusterBoxes.push({ id, box: [rx, ry, rx + rw, ry + rh] });
    }
  }

  // Extract nodes
  for (const node of doc.querySelectorAll('g.node, g.pele-node')) {
    const rawId = node.getAttribute('data-mpe-key') || node.getAttribute('data-id') || node.getAttribute('id') || '';
    const id = flowchartSourceId(rawId, diagramId);
    if (!id || seenNodes.has(id)) continue;
    seenNodes.add(id);

    // 1. Check DOM ancestry (Mermaid.js nests nodes inside cluster elements)
    const parentCluster = node.closest('g.cluster, g.pele-cluster');
    let parentId = parentCluster ? flowchartSourceId(parentCluster.getAttribute('id') || parentCluster.getAttribute('data-id') || '', diagramId) : undefined;

    // 2. Check geometric bounding box (Pele puts nodes in separate g.pele-nodes group)
    if (!parentId && clusterBoxes.length > 0) {
      const t = (node.getAttribute('transform') || '').match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
      if (t) {
        const nx = parseFloat(t[1]!);
        const ny = parseFloat(t[2]!);
        const matched = clusterBoxes.find(c => nx >= c.box[0] && nx <= c.box[2] && ny >= c.box[1] && ny <= c.box[3]);
        if (matched) {
          parentId = matched.id;
        }
      }
    }

    nodes.push({ id, parentId });
  }

  // Extract edges
  const seenEdges = new Set<string>();
  const linkElements = doc.querySelectorAll('path.flowchart-link, .edgePath path.path, g.edgePath, g.pele-edge');
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
      const idStr = el.getAttribute('id') || el.getAttribute('data-id') || el.parentElement?.getAttribute('id') || el.parentElement?.getAttribute('data-id') || '';
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
  for (const cluster of root.querySelectorAll('g.cluster, g.pele-cluster')) {
    const rawId = cluster.getAttribute('id') || cluster.getAttribute('data-id') || '';
    const id = flowchartSourceId(rawId, diagramId);
    const slot = groups?.get(id) ?? 0;
    const clusterFill = colorStyle === 'multi' && fills.length > 0 ? fills[slot % fills.length] : palette.clusterBkg;
    const clusterBorder = colorStyle === 'multi' && borders.length > 0 ? borders[slot % borders.length] : palette.clusterBorder;

    const hCluster = cluster as unknown as HTMLElement;
    if (hCluster && hCluster.style) {
      hCluster.style.setProperty('--cluster-fill', clusterFill ?? 'transparent');
      hCluster.style.setProperty('--cluster-border', clusterBorder ?? 'transparent');
    }

    const clusterShapes = Array.from(cluster.querySelectorAll(':scope > rect, :scope > path, rect')) as SVGElement[];
    for (const shape of clusterShapes) {
      if (clusterFill) {
        shape.setAttribute('fill', clusterFill);
        shape.setAttribute('fill-opacity', dark ? '0.20' : '0.30');
        if (shape.style) {
          shape.style.setProperty('fill', clusterFill, 'important');
          shape.style.setProperty('fill-opacity', dark ? '0.20' : '0.30', 'important');
        }
      }
      if (clusterBorder) {
        shape.setAttribute('stroke', clusterBorder);
        shape.setAttribute('stroke-width', '1.5px');
        if (shape.style) {
          shape.style.setProperty('stroke', clusterBorder, 'important');
          shape.style.setProperty('stroke-width', '1.5px', 'important');
        }
      }
    }

    for (const label of Array.from(cluster.querySelectorAll('.pele-cluster-label, text.cluster-label, .cluster-label text, .cluster-label span, .cluster-label div'))) {
      (label as SVGElement).setAttribute('fill', palette.text);
      if ((label as HTMLElement).style) {
        (label as HTMLElement).style.setProperty('fill', palette.text, 'important');
        (label as HTMLElement).style.setProperty('color', palette.text, 'important');
        (label as HTMLElement).style.fontWeight = 'bold';
      }
    }
  }

  // Style nodes
  for (const node of Array.from(root.querySelectorAll('g.node, g.pele-node')) as SVGElement[]) {
    const rawId = node.getAttribute('data-mpe-key') || node.getAttribute('data-id') || node.getAttribute('id') || '';
    const id = flowchartSourceId(rawId, diagramId);
    // Explicit stage/step class (e.g. from AgentFlow or pipelines: step0, step1, stage0, c0...)
    const stepClassMatch = node.getAttribute('class')?.match(/\b(?:step|stage|c)(\d+)\b/);
    const explicitSlot = stepClassMatch ? parseInt(stepClassMatch[1]!, 10) : undefined;
    const slot = explicitSlot ?? groups?.get(id) ?? 0;

    const fill = colorStyle === 'multi' && fills.length > 0
      ? fills[slot % fills.length]!
      : palette.surface;
    const border = colorStyle === 'multi' && borders.length > 0
      ? borders[slot % borders.length]!
      : palette.border;

    const textColor = textOnFill(fill, palette.text, 4.5);

    // Set CSS custom properties on the node container
    if (node.style?.setProperty) {
      node.style.setProperty('--node-fill', fill);
      node.style.setProperty('--node-border', border);
      node.style.setProperty('--node-text', textColor);
    }

    // Target only the primary outer shape of the node, never inner label rects
    const shapeElements = Array.from(node.querySelectorAll(':scope > .label-container, :scope > rect, :scope > polygon, :scope > circle, :scope > ellipse, :scope > path')) as SVGElement[];
    const shapes: SVGElement[] = (shapeElements.length > 0
      ? shapeElements
      : (Array.from(node.querySelectorAll('rect, polygon, circle, ellipse, path')) as SVGElement[])
    ).filter(shape => !shape.closest('.label, .nodeLabel, foreignObject') && !shape.classList.contains('arrowMarkerPath'));

    for (const shape of shapes) {
      const isNoneFill = shape.getAttribute('fill') === 'none' || shape.style?.fill === 'none';
      if (!isNoneFill) {
        shape.setAttribute('fill', fill);
        if (shape.style) shape.style.setProperty('fill', fill);
      }
      shape.setAttribute('stroke', border);
      shape.setAttribute('stroke-width', '1.25px');
      if (shape.style) {
        shape.style.setProperty('stroke', border);
        shape.style.setProperty('stroke-width', '1.25px');
      }
    }

    // Apply readable text color to labels
    for (const textEl of Array.from(node.querySelectorAll('.nodeLabel, .label text, text, .nodeLabel p, foreignObject div, .pele-label'))) {
      if ('style' in textEl && (textEl as HTMLElement).style) {
        (textEl as HTMLElement).style.setProperty('color', textColor, 'important');
        (textEl as SVGElement).style.setProperty('fill', textColor, 'important');
      }
      textEl.setAttribute('fill', textColor);
    }
  }
}
