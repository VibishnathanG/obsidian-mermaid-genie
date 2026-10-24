import { render as peleRender } from 'pele';
import { textOnFill, type PaletteData } from './colors';
import { applyFlowchartColors } from './flowchart-colors';
import type { GenieSettings } from './settings';

export interface PeleRenderOptions {
  text: string;
  id: string;
  settings: GenieSettings;
  palette: PaletteData;
  dark: boolean;
}

/**
 * Renders a Mermaid diagram using Obsidian's official Pele compiler (up to 500x faster,
 * synchronous, <1ms render time) and applies Genie's coordinated branch color themes,
 * palettes, and styling.
 *
 * Returns null if Pele cannot parse the diagram or if an error occurs, enabling
 * seamless, zero-interruption fallback to Mermaid.js.
 */
export function renderWithPele(options: PeleRenderOptions): string | null {
  const { text, id, settings, palette, dark } = options;

  try {
    const result = peleRender(text, {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif',
      fontSize: 14,
      idPrefix: id ? `${id}-` : undefined,
      measurer: {
        width(str: string, size: number) {
          return str.length * (size * 0.65) * 1.25;
        },
      },
    });

    if (!result?.svg) return null;

    return enhancePeleSvg(result.svg, id, settings, palette, dark);
  } catch (err) {
    return null;
  }
}

/**
 * Enhances Pele's raw SVG with Mermaid Genie cosmetics, including:
 * - Direct mapping of Genie's active theme palette to Pele's CSS variables
 * - Coordinated branch/flow block multi-color thematic fills and borders
 * - Ancestor path tracing metadata (data-mpe-key, data-mpe-from, data-mpe-to)
 * - Genie diagram classes for drop shadows, zoom controls, and export tools
 */
export function enhancePeleSvg(
  svgString: string,
  id: string,
  settings: GenieSettings,
  palette: PaletteData,
  dark: boolean
): string {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return svgString;

  const root = doc.documentElement;

  // Set diagram ID for Obsidian DOM matching
  if (id) {
    root.setAttribute('id', id);
  }

  // Add Genie enhancement classes
  root.classList.add('mfe-enhanced', 'mermaid-genie-diagram');

  // Map Genie's palette and typography directly to Pele's native CSS custom properties
  if (root.style?.setProperty) {
    root.style.setProperty('--pele-bg', dark ? palette.background : '#ffffff');
    root.style.setProperty('--pele-fg', palette.text);
    root.style.setProperty('--pele-line', palette.line);
    root.style.setProperty('--pele-surface', palette.surface);
    root.style.setProperty('--pele-surface-alt', palette.clusterBkg ?? (dark ? '#1d2838' : '#f1f5f9'));
    root.style.setProperty('--pele-border', palette.border);
    root.style.setProperty('--pele-accent', palette.accent);
    root.style.setProperty('--pele-radius', `${settings.nodeRadius}px`);
    root.style.setProperty('--pele-font', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif');

    // Also set Genie variables for path tracing and hover effects
    root.style.setProperty('--mpe-duration', `${settings.animationDuration ?? 180}ms`);
    root.style.setProperty('--mpe-highlight', palette.accent);
    root.style.setProperty('--mpe-line', palette.line);
    root.style.setProperty('--mpe-border', palette.border);
    root.style.setProperty('--mpe-node', palette.surface);
    root.style.setProperty('--mpe-text', palette.text);
    root.style.setProperty('--mpe-label', palette.label);
  }

  // Enhance nodes with standard Genie classes and path-tracing metadata
  for (const node of Array.from(doc.querySelectorAll('g.pele-node'))) {
    node.classList.add('node');
    const nodeId = node.getAttribute('data-id');
    if (nodeId) {
      node.setAttribute('data-mpe-key', nodeId);
    }
    node.setAttribute('tabindex', '0');

    // Decision diamonds
    if (node.classList.contains('pele-shape-diam') || node.querySelector('polygon')) {
      node.classList.add('mpe-decision');
    }
  }

  // Enhance edges with path-tracing metadata
  for (const edge of Array.from(doc.querySelectorAll('g.pele-edge'))) {
    edge.classList.add('flowchart-link');
    const edgeId = edge.getAttribute('data-id') || '';
    const match = /(?:^|[_-])L[_-](.+?)[_-](.+?)[_-]/.exec(edgeId);
    if (match) {
      edge.setAttribute('data-mpe-from', match[1]!);
      edge.setAttribute('data-mpe-to', match[2]!);
      edge.setAttribute('data-mpe-forward', 'true');
    }
    for (const path of Array.from(edge.querySelectorAll('path:not(.pele-marker)'))) {
      path.classList.add('flowchart-link', 'path');
      if (match) {
        path.setAttribute('data-mpe-from', match[1]!);
        path.setAttribute('data-mpe-to', match[2]!);
        path.setAttribute('data-mpe-forward', 'true');
      }
    }
  }

  // Enhance cluster groups
  for (const cluster of Array.from(doc.querySelectorAll('g.pele-cluster'))) {
    cluster.classList.add('cluster');
  }

  // Enhance edge labels
  for (const label of Array.from(doc.querySelectorAll('g.pele-edge-label'))) {
    label.classList.add('edgeLabel');
    const rect = label.querySelector('rect');
    if (rect) {
      rect.setAttribute('fill', palette.label);
      rect.setAttribute('stroke', palette.border);
      rect.setAttribute('stroke-width', '1px');
      rect.setAttribute('rx', '4');
      rect.setAttribute('ry', '4');
    }
    const text = label.querySelector('text');
    if (text) {
      text.setAttribute('fill', palette.text);
    }
  }

  // Diagram type classification
  const isPeleFlowchart = root.classList.contains('pele-flowchart') || root.getAttribute('aria-roledescription') === 'flowchart';
  const isPeleClass = root.classList.contains('pele-class') || root.getAttribute('aria-roledescription') === 'class';
  const isPeleEr = root.classList.contains('pele-er') || root.getAttribute('aria-roledescription') === 'er';
  const isPeleGantt = root.classList.contains('pele-gantt') || root.getAttribute('aria-roledescription') === 'gantt';
  const isPeleReq = root.classList.contains('pele-requirement') || root.getAttribute('aria-roledescription') === 'requirement';
  const isPeleKanban = root.classList.contains('pele-kanban') || root.getAttribute('aria-roledescription') === 'kanban';
  const isPeleSeq = root.classList.contains('pele-sequence') || root.getAttribute('aria-roledescription') === 'sequence';
  const isPeleState = root.classList.contains('pele-state') || root.getAttribute('aria-roledescription') === 'state';
  const isPeleTreemap = root.classList.contains('pele-treemap') || root.getAttribute('aria-roledescription') === 'treemap';

  const isMulti = settings.colorStyle === 'multi' && palette.fills.length > 0;

  // 1. Flowcharts: Coordinated multi-color branch palette
  if (isPeleFlowchart) {
    applyFlowchartColors(root, palette, dark, settings.colorStyle);
  }

  // 2. Class Diagrams: Coordinated thematic class card fills, borders, and dividers
  if (isPeleClass) {
    const classNodes = Array.from(doc.querySelectorAll('g.pele-class'));
    for (let i = 0; i < classNodes.length; i++) {
      const node = classNodes[i]!;
      const slot = i % (palette.fills.length || 1);
      const classFill = isMulti ? palette.fills[slot]! : palette.surface;
      const classBorder = isMulti ? palette.borders[slot]! : palette.border;

      const rect = node.querySelector(':scope > rect');
      if (rect) {
        rect.setAttribute('fill', classFill);
        rect.setAttribute('stroke', classBorder);
        rect.setAttribute('stroke-width', '1.5px');
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
      }

      for (const divider of Array.from(node.querySelectorAll('.pele-divider, path.pele-divider'))) {
        divider.setAttribute('fill', 'none');
        divider.setAttribute('stroke', classBorder);
        divider.setAttribute('stroke-width', '1.25px');
      }

      const title = node.querySelector(':scope > text.pele-label');
      if (title) {
        const titleColor = textOnFill(classFill, palette.text);
        title.setAttribute('fill', titleColor);
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('font-weight', 'bold');
      }

      for (const member of Array.from(node.querySelectorAll('.pele-member, .pele-attribute, .pele-method'))) {
        const memColor = textOnFill(classFill, palette.text);
        member.setAttribute('fill', memColor);
        member.setAttribute('text-anchor', 'start');
      }
    }

    for (const marker of Array.from(doc.querySelectorAll('.pele-marker'))) {
      marker.setAttribute('fill', palette.surface);
      marker.setAttribute('stroke', palette.line);
    }
  }

  // 3. ER Diagrams: Coordinated entity fills, borders, and dividers
  if (isPeleEr) {
    const entityNodes = Array.from(doc.querySelectorAll('g.pele-entity'));
    for (let i = 0; i < entityNodes.length; i++) {
      const node = entityNodes[i]!;
      const slot = i % (palette.fills.length || 1);
      const entityFill = isMulti ? palette.fills[slot]! : palette.surface;
      const entityBorder = isMulti ? palette.borders[slot]! : palette.border;

      const rect = node.querySelector(':scope > rect');
      if (rect) {
        rect.setAttribute('fill', entityFill);
        rect.setAttribute('stroke', entityBorder);
        rect.setAttribute('stroke-width', '1.5px');
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
      }

      for (const divider of Array.from(node.querySelectorAll('.pele-er-divider, path.pele-er-divider'))) {
        divider.setAttribute('fill', 'none');
        divider.setAttribute('stroke', entityBorder);
        divider.setAttribute('stroke-width', '1.25px');
      }

      const stripes = Array.from(node.querySelectorAll('g.pele-er-stripes rect'));
      for (let s = 0; s < stripes.length; s++) {
        const stripe = stripes[s]!;
        stripe.setAttribute('fill', s % 2 === 0 ? entityFill : (palette.clusterBkg ?? (dark ? '#1d2838' : '#f1f5f9')));
      }

      const title = node.querySelector(':scope > text.pele-label');
      if (title) {
        const titleColor = textOnFill(entityFill, palette.text);
        title.setAttribute('fill', titleColor);
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('font-weight', 'bold');
      }

      for (const text of Array.from(node.querySelectorAll('.pele-er-type, .pele-er-name'))) {
        const attrColor = textOnFill(entityFill, palette.text);
        text.setAttribute('fill', attrColor);
        text.setAttribute('text-anchor', 'start');
      }

      for (const key of Array.from(node.querySelectorAll('.pele-er-keys'))) {
        key.setAttribute('fill', palette.accent);
        key.setAttribute('text-anchor', 'start');
        key.setAttribute('font-weight', 'bold');
      }
    }
  }

  // 4. Gantt Charts: Coordinated task bars with guaranteed WCAG text contrast
  if (isPeleGantt) {
    const taskGroups = Array.from(doc.querySelectorAll('g.pele-task'));
    let normalTaskIndex = 0;

    for (const taskGroup of taskGroups) {
      const isMilestone = taskGroup.classList.contains('pele-milestone') || !!taskGroup.querySelector('path');
      const isActive = taskGroup.classList.contains('pele-active') || !!taskGroup.querySelector('.pele-active');
      const text = taskGroup.querySelector('text.pele-label, text');

      if (isMilestone) {
        const msPath = taskGroup.querySelector('path');
        if (msPath) {
          msPath.setAttribute('fill', palette.accent);
          msPath.setAttribute('stroke', palette.accent);
        }
        if (text) {
          text.setAttribute('fill', palette.text);
          if ((text as HTMLElement).style) {
            (text as HTMLElement).style.setProperty('fill', palette.text, 'important');
            (text as HTMLElement).style.setProperty('color', palette.text, 'important');
          }
        }
        continue;
      }

      const rect = taskGroup.querySelector('rect');
      if (!rect || !text) continue;

      const rx = parseFloat(rect.getAttribute('x') || '0');
      const ry = parseFloat(rect.getAttribute('y') || '0');
      let rw = parseFloat(rect.getAttribute('width') || '0');
      const rh = parseFloat(rect.getAttribute('height') || '24');

      const textContent = (text.textContent || '').trim();
      const minWidth = Math.max(rw, textContent.length * 7.5 + 24);

      if (rw < minWidth) {
        rw = minWidth;
        rect.setAttribute('width', String(rw));
      }

      // Bar fill & stroke with coordinated palette colors
      let barFill = palette.surface;
      let barStroke = palette.border;

      if (isActive) {
        barFill = palette.accent;
        barStroke = palette.accent;
      } else if (isMulti) {
        const slot = normalTaskIndex % palette.fills.length;
        barFill = palette.fills[slot]!;
        barStroke = palette.borders[slot]!;
        normalTaskIndex++;
      } else {
        normalTaskIndex++;
      }

      rect.setAttribute('fill', barFill);
      rect.setAttribute('stroke', barStroke);
      rect.setAttribute('stroke-width', '1.5px');
      rect.setAttribute('rx', '4');
      rect.setAttribute('ry', '4');

      // Enclose text inside task box with guaranteed readable contrast
      const cx = rx + rw / 2;
      const cy = ry + rh / 2 + 4.5;
      text.setAttribute('x', String(cx));
      text.setAttribute('y', String(cy));
      text.setAttribute('text-anchor', 'middle');

      const textColor = textOnFill(barFill, palette.text);
      text.setAttribute('fill', textColor);
      text.setAttribute('font-weight', '600');
      if ((text as HTMLElement).style) {
        (text as HTMLElement).style.setProperty('fill', textColor, 'important');
        (text as HTMLElement).style.setProperty('color', textColor, 'important');
        (text as HTMLElement).style.setProperty('text-anchor', 'middle', 'important');
      }
    }

    for (const title of Array.from(doc.querySelectorAll('.pele-title, .pele-section-label, .pele-axis text'))) {
      title.setAttribute('fill', palette.text);
    }
  }

  // 5. Requirement Diagrams: Coordinated requirement & element node fills
  if (isPeleReq) {
    const reqNodes = Array.from(doc.querySelectorAll('g.pele-requirement, g.pele-element'));
    for (let i = 0; i < reqNodes.length; i++) {
      const node = reqNodes[i]!;
      const slot = i % (palette.fills.length || 1);
      const nodeFill = isMulti ? palette.fills[slot]! : palette.surface;
      const nodeBorder = isMulti ? palette.borders[slot]! : palette.border;

      const rect = node.querySelector(':scope > rect');
      if (rect) {
        rect.setAttribute('fill', nodeFill);
        rect.setAttribute('stroke', nodeBorder);
        rect.setAttribute('stroke-width', '1.5px');
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
      }

      for (const divider of Array.from(node.querySelectorAll('.pele-divider, path.pele-divider'))) {
        divider.setAttribute('fill', 'none');
        divider.setAttribute('stroke', nodeBorder);
        divider.setAttribute('stroke-width', '1.25px');
      }

      const title = node.querySelector(':scope > text.pele-label');
      if (title) {
        title.setAttribute('fill', textOnFill(nodeFill, palette.text));
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('font-weight', 'bold');
      }

      const stereo = node.querySelector(':scope > text.pele-stereotype');
      if (stereo) {
        stereo.setAttribute('fill', dark ? '#94a3b8' : '#64748b');
        stereo.setAttribute('text-anchor', 'middle');
      }

      for (const field of Array.from(node.querySelectorAll('.pele-field, .pele-field tspan'))) {
        field.setAttribute('fill', dark ? '#94a3b8' : '#64748b');
        field.setAttribute('text-anchor', 'start');
      }

      for (const val of Array.from(node.querySelectorAll('.pele-value, .pele-value tspan'))) {
        val.setAttribute('fill', textOnFill(nodeFill, palette.text));
        val.setAttribute('text-anchor', 'start');
      }
    }
  }

  // 6. Kanban Boards: Coordinated column borders & start-aligned card text
  if (isPeleKanban) {
    const columns = Array.from(doc.querySelectorAll('g.pele-column, g.pele-cluster'));
    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      const col = columns[colIdx]!;
      const slot = colIdx % (palette.fills.length || 1);
      const colBorder = isMulti ? palette.borders[slot]! : palette.border;

      const rect = col.querySelector(':scope > rect');
      if (rect) {
        rect.setAttribute('fill', palette.clusterBkg ?? (dark ? '#1a2333' : '#f8fafc'));
        rect.setAttribute('stroke', colBorder);
        rect.setAttribute('stroke-width', '1.5px');
        rect.setAttribute('rx', '8');
        rect.setAttribute('ry', '8');
      }

      for (const title of Array.from(col.querySelectorAll('.pele-cluster-label'))) {
        title.setAttribute('fill', palette.text);
        title.setAttribute('text-anchor', 'start');
        title.setAttribute('font-weight', 'bold');
      }

      for (const count of Array.from(col.querySelectorAll('.pele-count'))) {
        count.setAttribute('fill', isMulti ? colBorder : (dark ? '#94a3b8' : '#64748b'));
        count.setAttribute('font-weight', 'bold');
        count.setAttribute('text-anchor', 'end');
      }

      // Card nodes in this column: strictly start-aligned inside card box
      for (const card of Array.from(col.querySelectorAll('g.pele-card, g.pele-node'))) {
        const cardRect = card.querySelector('rect');
        if (cardRect) {
          cardRect.setAttribute('fill', palette.surface);
          cardRect.setAttribute('stroke', isMulti ? colBorder : palette.border);
          cardRect.setAttribute('stroke-width', '1.25px');
          cardRect.setAttribute('rx', '6');
          cardRect.setAttribute('ry', '6');
        }
        for (const cardText of Array.from(card.querySelectorAll('text'))) {
          cardText.setAttribute('fill', palette.text);
          cardText.setAttribute('text-anchor', 'start');
          const el = cardText as unknown as SVGElement;
          if (el.style) {
            el.style.setProperty('text-anchor', 'start', 'important');
            el.style.setProperty('text-align', 'left', 'important');
            el.style.setProperty('fill', palette.text, 'important');
          }
        }
      }
    }
  }

  // 7. Sequence Diagrams: Coordinated participant boxes
  if (isPeleSeq) {
    const actors = Array.from(doc.querySelectorAll('g.pele-actor, g.pele-participant'));
    for (let i = 0; i < actors.length; i++) {
      const actor = actors[i]!;
      const slot = i % (palette.fills.length || 1);
      const actorFill = isMulti ? palette.fills[slot]! : palette.surface;
      const actorBorder = isMulti ? palette.borders[slot]! : palette.border;

      for (const rect of Array.from(actor.querySelectorAll('rect'))) {
        rect.setAttribute('fill', actorFill);
        rect.setAttribute('stroke', actorBorder);
        rect.setAttribute('stroke-width', '1.25px');
        rect.setAttribute('rx', '4');
        rect.setAttribute('ry', '4');
      }
      for (const text of Array.from(actor.querySelectorAll('text'))) {
        text.setAttribute('fill', textOnFill(actorFill, palette.text));
      }
    }
  }

  // 8. State Diagrams: Coordinated state boxes
  if (isPeleState) {
    const states = Array.from(doc.querySelectorAll('g.pele-state-node, g.pele-node'));
    for (let i = 0; i < states.length; i++) {
      const state = states[i]!;
      const slot = i % (palette.fills.length || 1);
      const stateFill = isMulti ? palette.fills[slot]! : palette.surface;
      const stateBorder = isMulti ? palette.borders[slot]! : palette.border;

      const rect = state.querySelector('rect');
      if (rect) {
        rect.setAttribute('fill', stateFill);
        rect.setAttribute('stroke', stateBorder);
        rect.setAttribute('stroke-width', '1.5px');
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
      }
      const text = state.querySelector('text');
      if (text) {
        text.setAttribute('fill', textOnFill(stateFill, palette.text));
      }
    }
  }

  // 9. Treemap Diagrams: Coordinated leaf node fills & borders
  if (isPeleTreemap) {
    const leaves = Array.from(doc.querySelectorAll('g.pele-leaf, rect.pele-leaf'));
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i]!;
      const slot = i % (palette.fills.length || 1);
      const leafFill = isMulti ? palette.fills[slot]! : palette.surface;
      const leafBorder = isMulti ? palette.borders[slot]! : palette.border;

      const rect = leaf.tagName.toLowerCase() === 'rect' ? (leaf as SVGRectElement) : leaf.querySelector('rect');
      if (rect) {
        rect.setAttribute('fill', leafFill);
        rect.setAttribute('stroke', leafBorder);
      }
      const text = leaf.tagName.toLowerCase() === 'rect' ? null : leaf.querySelector('text');
      if (text) {
        text.setAttribute('fill', textOnFill(leafFill, palette.text));
      }
    }
  }

  return new XMLSerializer().serializeToString(doc.documentElement);
}
