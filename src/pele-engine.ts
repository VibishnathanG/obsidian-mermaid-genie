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

  // Apply Genie's signature coordinated multi-color branch palette blocks
  applyFlowchartColors(root, palette, dark, settings.colorStyle);

  return new XMLSerializer().serializeToString(doc.documentElement);
}
