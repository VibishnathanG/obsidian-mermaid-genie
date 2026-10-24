import { render as peleRender } from 'pele';
import type { PaletteData } from './colors';
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

  // Apply Genie's signature coordinated multi-color branch palette blocks only to flowcharts
  if (isPeleFlowchart) {
    applyFlowchartColors(root, palette, dark, settings.colorStyle);
  }

  // Specialized diagram styling for Class, ER, Gantt, Requirement, and Kanban
  if (isPeleClass) {
    // Inter-box divider lines must strictly be stroke lines without solid fill
    for (const divider of Array.from(doc.querySelectorAll('.pele-divider, path.pele-divider'))) {
      divider.setAttribute('fill', 'none');
      divider.setAttribute('stroke', palette.border);
      divider.setAttribute('stroke-width', '1.25px');
    }
    // Class nodes
    for (const node of Array.from(doc.querySelectorAll('g.pele-class'))) {
      const rect = node.querySelector(':scope > rect');
      if (rect) {
        rect.setAttribute('fill', palette.surface);
        rect.setAttribute('stroke', palette.border);
        rect.setAttribute('stroke-width', '1.25px');
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
      }
      const title = node.querySelector(':scope > text.pele-label');
      if (title) {
        title.setAttribute('fill', palette.text);
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('font-weight', 'bold');
      }
      for (const member of Array.from(node.querySelectorAll('.pele-member, .pele-attribute, .pele-method'))) {
        member.setAttribute('fill', palette.text);
        member.setAttribute('text-anchor', 'start');
      }
    }
    // Relation lines and inheritance markers
    for (const marker of Array.from(doc.querySelectorAll('.pele-marker'))) {
      marker.setAttribute('fill', palette.surface);
      marker.setAttribute('stroke', palette.line);
    }
  }

  if (isPeleEr) {
    // Inter-box divider lines
    for (const divider of Array.from(doc.querySelectorAll('.pele-er-divider, path.pele-er-divider'))) {
      divider.setAttribute('fill', 'none');
      divider.setAttribute('stroke', palette.border);
      divider.setAttribute('stroke-width', '1.25px');
    }
    // Entity nodes
    for (const node of Array.from(doc.querySelectorAll('g.pele-entity'))) {
      const rect = node.querySelector(':scope > rect');
      if (rect) {
        rect.setAttribute('fill', palette.surface);
        rect.setAttribute('stroke', palette.border);
        rect.setAttribute('stroke-width', '1.25px');
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
      }
      // Zebra stripes
      const stripes = Array.from(node.querySelectorAll('g.pele-er-stripes rect'));
      for (let i = 0; i < stripes.length; i++) {
        const stripe = stripes[i]!;
        stripe.setAttribute('fill', i % 2 === 0 ? palette.surface : (palette.clusterBkg ?? (dark ? '#1d2838' : '#f1f5f9')));
      }
      const title = node.querySelector(':scope > text.pele-label');
      if (title) {
        title.setAttribute('fill', palette.text);
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('font-weight', 'bold');
      }
      for (const text of Array.from(node.querySelectorAll('.pele-er-type, .pele-er-name'))) {
        text.setAttribute('fill', palette.text);
        text.setAttribute('text-anchor', 'start');
      }
      for (const key of Array.from(node.querySelectorAll('.pele-er-keys'))) {
        key.setAttribute('fill', palette.accent);
        key.setAttribute('text-anchor', 'start');
        key.setAttribute('font-weight', 'bold');
      }
    }
  }

  if (isPeleGantt) {
    for (const taskGroup of Array.from(doc.querySelectorAll('g.pele-task'))) {
      const isMilestone = taskGroup.classList.contains('pele-milestone') || !!taskGroup.querySelector('path');
      const text = taskGroup.querySelector('text.pele-label, text');
      if (isMilestone) {
        if (text) {
          text.setAttribute('fill', palette.text);
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

      // Enclose text inside task box
      const cx = rx + rw / 2;
      const cy = ry + rh / 2 + 4.5;
      text.setAttribute('x', String(cx));
      text.setAttribute('y', String(cy));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', dark ? '#0f172a' : '#ffffff');
      text.setAttribute('font-weight', '600');
    }
    for (const title of Array.from(doc.querySelectorAll('.pele-title, .pele-section-label, .pele-axis text'))) {
      title.setAttribute('fill', palette.text);
    }
  }

  if (isPeleReq) {
    for (const divider of Array.from(doc.querySelectorAll('.pele-divider, path.pele-divider'))) {
      divider.setAttribute('fill', 'none');
      divider.setAttribute('stroke', palette.border);
      divider.setAttribute('stroke-width', '1.25px');
    }
    for (const node of Array.from(doc.querySelectorAll('g.pele-requirement, g.pele-element'))) {
      const rect = node.querySelector(':scope > rect');
      if (rect) {
        rect.setAttribute('fill', palette.surface);
        rect.setAttribute('stroke', palette.border);
        rect.setAttribute('stroke-width', '1.25px');
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
      }
      const title = node.querySelector(':scope > text.pele-label');
      if (title) {
        title.setAttribute('fill', palette.text);
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
        val.setAttribute('fill', palette.text);
        val.setAttribute('text-anchor', 'start');
      }
    }
  }

  if (isPeleKanban) {
    for (const col of Array.from(doc.querySelectorAll('g.pele-column, g.pele-cluster'))) {
      const rect = col.querySelector(':scope > rect');
      if (rect) {
        rect.setAttribute('fill', palette.clusterBkg ?? (dark ? '#1a2333' : '#f8fafc'));
        rect.setAttribute('stroke', palette.border);
        rect.setAttribute('stroke-width', '1.25px');
        rect.setAttribute('rx', '8');
        rect.setAttribute('ry', '8');
      }
      for (const title of Array.from(col.querySelectorAll('.pele-cluster-label'))) {
        title.setAttribute('fill', palette.text);
        title.setAttribute('text-anchor', 'start');
        title.setAttribute('font-weight', 'bold');
      }
      for (const count of Array.from(col.querySelectorAll('.pele-count'))) {
        count.setAttribute('fill', dark ? '#94a3b8' : '#64748b');
        count.setAttribute('text-anchor', 'end');
      }
    }
  }

  return new XMLSerializer().serializeToString(doc.documentElement);
}
