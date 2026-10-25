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

function setNodeVars(el: Element, fill: string, stroke: string, text: string): void {
  const h = el as unknown as HTMLElement;
  if (h && h.style) {
    h.style.setProperty('--node-fill', fill);
    h.style.setProperty('--node-border', stroke);
    h.style.setProperty('--node-text', text);
  }
}

function setElStyle(el: Element, prop: string, val: string, important = false): void {
  const h = el as unknown as HTMLElement;
  if (h && h.style) {
    if (important) h.style.setProperty(prop, val, 'important');
    else h.style.setProperty(prop, val);
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

    // Series variables for timeline, journey, actor dots, and multi-series charts
    for (let s = 0; s < 12; s++) {
      const sFill = palette.fills[s % palette.fills.length] ?? palette.accent;
      root.style.setProperty(`--pele-series-${s + 1}`, sFill);
    }

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
  const isPelePacket = root.classList.contains('pele-packet') || root.getAttribute('aria-roledescription') === 'packet';
  const isPeleBlock = root.classList.contains('pele-block') || root.getAttribute('aria-roledescription') === 'block';
  const isPeleC4 = root.classList.contains('pele-c4') || root.getAttribute('aria-roledescription') === 'c4';
  const isPeleArch = root.classList.contains('pele-architecture') || root.getAttribute('aria-roledescription') === 'architecture';
  const isPeleTimeline = root.classList.contains('pele-timeline') || root.getAttribute('aria-roledescription') === 'timeline';
  const isPeleJourney = root.classList.contains('pele-journey') || root.getAttribute('aria-roledescription') === 'journey';

  // 1. Flowcharts: Coordinated branch palette
  if (isPeleFlowchart) {
    applyFlowchartColors(root, palette, dark, settings.colorStyle);
  }

  // 2. Class Diagrams: Coordinated class card fills, borders, and dividers
  if (isPeleClass) {
    const classes = Array.from(doc.querySelectorAll('g.pele-class'));
    for (let i = 0; i < classes.length; i++) {
      const node = classes[i]!;
      const slot = i % (palette.fills.length || 1);
      const fill = palette.fills[slot] ?? palette.surface;
      const stroke = palette.borders[slot] ?? palette.border;
      const textColor = textOnFill(fill, palette.text);

      setNodeVars(node, fill, stroke, textColor);

      const rect = node.querySelector(':scope > rect') as SVGRectElement | null;
      if (rect) {
        rect.setAttribute('fill', fill);
        rect.setAttribute('stroke', stroke);
        rect.setAttribute('stroke-width', '1.25px');
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
        if (rect.style) {
          rect.style.fill = fill;
          rect.style.stroke = stroke;
        }
      }

      for (const divider of Array.from(node.querySelectorAll('.pele-divider, path.pele-divider'))) {
        divider.setAttribute('fill', 'none');
        divider.setAttribute('stroke', stroke);
        divider.setAttribute('stroke-width', '1.25px');
        setElStyle(divider, 'fill', 'none', true);
        setElStyle(divider, 'stroke', stroke, true);
      }

      const title = node.querySelector(':scope > text.pele-label');
      if (title) {
        title.setAttribute('fill', textColor);
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('font-weight', 'bold');
        setElStyle(title, 'fill', textColor, true);
      }

      for (const member of Array.from(node.querySelectorAll('.pele-member, .pele-attribute, .pele-method'))) {
        member.setAttribute('fill', textColor);
        member.setAttribute('text-anchor', 'start');
        setElStyle(member, 'fill', textColor, true);
      }
    }

    for (const marker of Array.from(doc.querySelectorAll('.pele-marker'))) {
      marker.setAttribute('fill', palette.surface);
      marker.setAttribute('stroke', palette.line);
    }
  }

  // 3. ER Diagrams: Coordinated entity fills, borders, and dividers
  if (isPeleEr) {
    const entities = Array.from(doc.querySelectorAll('g.pele-entity'));
    for (let i = 0; i < entities.length; i++) {
      const node = entities[i]!;
      const slot = i % (palette.fills.length || 1);
      const fill = palette.fills[slot] ?? palette.surface;
      const stroke = palette.borders[slot] ?? palette.border;
      const textColor = textOnFill(fill, palette.text);

      setNodeVars(node, fill, stroke, textColor);

      // Remove duplicate overlay rects inserted by Pele that cover the divider line
      const allRects = Array.from(node.querySelectorAll(':scope > rect'));
      for (let r = 1; r < allRects.length; r++) {
        allRects[r]!.remove();
      }

      const rect = node.querySelector(':scope > rect') as SVGRectElement | null;
      if (rect) {
        rect.setAttribute('fill', fill);
        rect.setAttribute('stroke', stroke);
        rect.setAttribute('stroke-width', '1.25px');
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
        if (rect.style) {
          rect.style.fill = fill;
          rect.style.stroke = stroke;
        }
      }

      for (const divider of Array.from(node.querySelectorAll('.pele-er-divider, path.pele-er-divider'))) {
        divider.setAttribute('fill', 'none');
        divider.setAttribute('stroke', stroke);
        divider.setAttribute('stroke-width', '1.5px');
        setElStyle(divider, 'fill', 'none', true);
        setElStyle(divider, 'stroke', stroke, true);
        setElStyle(divider, 'stroke-width', '1.5px', true);
        setElStyle(divider, 'display', 'block', true);
        node.appendChild(divider);
      }

      // Remove inner patch rect stripes that create conflicting horizontal borders across attributes
      for (const stripes of Array.from(node.querySelectorAll('g.pele-er-stripes'))) {
        stripes.remove();
      }

      const title = node.querySelector(':scope > text.pele-label');
      if (title) {
        title.setAttribute('fill', textColor);
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('font-weight', 'bold');
        setElStyle(title, 'fill', textColor, true);
      }

      for (const text of Array.from(node.querySelectorAll('.pele-er-type, .pele-er-name'))) {
        text.setAttribute('fill', textColor);
        text.setAttribute('text-anchor', 'start');
        setElStyle(text, 'fill', textColor, true);
      }

      for (const key of Array.from(node.querySelectorAll('.pele-er-keys'))) {
        key.setAttribute('fill', palette.accent);
        key.setAttribute('text-anchor', 'start');
        key.setAttribute('font-weight', 'bold');
        setElStyle(key, 'fill', palette.accent, true);
      }
    }
  }

  // 4. Gantt Charts: Dark muted color bars with white font and clear backgrounds
  if (isPeleGantt) {
    // Clear intrusive section stripe backgrounds
    for (const sec of Array.from(doc.querySelectorAll('.pele-sections rect, rect.pele-section'))) {
      sec.setAttribute('fill', 'none');
      sec.setAttribute('stroke', 'none');
      setElStyle(sec, 'fill', 'none', true);
      setElStyle(sec, 'stroke', 'none', true);
    }

    const darkMutedFills = dark
      ? palette.fills
      : ['#25446b', '#1e4d41', '#544122', '#453361', '#214957', '#563347'];
    const darkMutedBorders = palette.borders;

    let taskBarIdx = 0;
    for (const taskGroup of Array.from(doc.querySelectorAll('g.pele-task'))) {
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
          setElStyle(text, 'fill', palette.text, true);
          setElStyle(text, 'color', palette.text, true);
        }
        continue;
      }

      const rect = taskGroup.querySelector('rect') as SVGRectElement | null;
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

      const slot = taskBarIdx % (darkMutedFills.length || 1);
      taskBarIdx++;

      const barFill = isActive ? palette.accent : (darkMutedFills[slot] ?? palette.surface);
      const barStroke = isActive ? palette.accent : (darkMutedBorders[slot % darkMutedBorders.length] ?? palette.border);

      rect.setAttribute('fill', barFill);
      rect.setAttribute('stroke', barStroke);
      rect.setAttribute('stroke-width', '1.25px');
      rect.setAttribute('rx', '4');
      rect.setAttribute('ry', '4');
      if (rect.style) {
        rect.style.fill = barFill;
        rect.style.stroke = barStroke;
      }

      // Enclose text inside task box with guaranteed readable contrast: font as white (#ffffff)
      const cx = rx + rw / 2;
      const cy = ry + rh / 2 + 4.5;
      text.setAttribute('x', String(cx));
      text.setAttribute('y', String(cy));
      text.setAttribute('text-anchor', 'middle');

      const textColor = '#ffffff';

      text.setAttribute('fill', textColor);
      text.setAttribute('font-weight', '600');
      setElStyle(text, 'fill', textColor, true);
      setElStyle(text, 'color', textColor, true);
      setElStyle(text, 'text-anchor', 'middle', true);
    }

    for (const title of Array.from(doc.querySelectorAll('.pele-title, .pele-section-label, .pele-axis text'))) {
      title.setAttribute('fill', palette.text);
      if (title.classList.contains('pele-section-label')) {
        setElStyle(title, 'font-weight', '600');
      }
    }
  }

  // 5. Requirement Diagrams: Coordinated requirement & element node fills
  if (isPeleReq) {
    const reqNodes = Array.from(doc.querySelectorAll('g.pele-requirement, g.pele-element'));
    for (let i = 0; i < reqNodes.length; i++) {
      const node = reqNodes[i]!;
      const slot = i % (palette.fills.length || 1);
      const fill = palette.fills[slot] ?? palette.surface;
      const stroke = palette.borders[slot] ?? palette.border;
      const textColor = textOnFill(fill, palette.text);

      setNodeVars(node, fill, stroke, textColor);

      const rect = node.querySelector(':scope > rect') as SVGRectElement | null;
      if (rect) {
        rect.setAttribute('fill', fill);
        rect.setAttribute('stroke', stroke);
        rect.setAttribute('stroke-width', '1.25px');
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
        if (rect.style) {
          rect.style.fill = fill;
          rect.style.stroke = stroke;
        }
      }

      for (const divider of Array.from(node.querySelectorAll('.pele-divider, path.pele-divider'))) {
        divider.setAttribute('fill', 'none');
        divider.setAttribute('stroke', stroke);
        divider.setAttribute('stroke-width', '1.25px');
        setElStyle(divider, 'fill', 'none', true);
        setElStyle(divider, 'stroke', stroke, true);
      }

      const title = node.querySelector(':scope > text.pele-label');
      if (title) {
        title.setAttribute('fill', textColor);
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('font-weight', 'bold');
        setElStyle(title, 'fill', textColor, true);
      }

      const stereo = node.querySelector(':scope > text.pele-stereotype');
      if (stereo) {
        stereo.setAttribute('fill', textColor);
        stereo.setAttribute('text-anchor', 'middle');
      }

      for (const field of Array.from(node.querySelectorAll('.pele-field, .pele-field tspan'))) {
        field.setAttribute('fill', textColor);
        field.setAttribute('text-anchor', 'start');
      }

      for (const val of Array.from(node.querySelectorAll('.pele-value, .pele-value tspan'))) {
        val.setAttribute('fill', textColor);
        val.setAttribute('text-anchor', 'start');
      }
    }
  }

  // 6. Kanban Boards: Coordinated column containers & start-aligned card text
  if (isPeleKanban) {
    const cols = Array.from(doc.querySelectorAll('g.pele-column, g.pele-cluster'));
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i]!;
      const slot = i % (palette.fills.length || 1);
      const colFill = palette.fills[slot] ?? palette.surface;
      const colBorder = palette.borders[slot] ?? palette.border;
      const cardTextColor = textOnFill(colFill, palette.text);

      const rect = col.querySelector(':scope > rect') as SVGRectElement | null;
      if (rect) {
        rect.setAttribute('fill', palette.clusterBkg ?? (dark ? '#1a2333' : '#f8fafc'));
        rect.setAttribute('stroke', colBorder);
        rect.setAttribute('stroke-width', '1.5px');
        rect.setAttribute('rx', '8');
        rect.setAttribute('ry', '8');
        if (rect.style) {
          rect.style.stroke = colBorder;
        }
      }

      for (const title of Array.from(col.querySelectorAll('.pele-cluster-label, text.pele-cluster-label'))) {
        title.setAttribute('fill', palette.text);
        title.setAttribute('text-anchor', 'start');
        title.setAttribute('font-weight', 'bold');
        if ((title as HTMLElement).style) {
          (title as HTMLElement).style.setProperty('text-anchor', 'start', 'important');
          (title as HTMLElement).style.setProperty('text-align', 'left', 'important');
        }
      }

      for (const count of Array.from(col.querySelectorAll('.pele-count'))) {
        count.setAttribute('fill', dark ? '#94a3b8' : '#64748b');
        count.setAttribute('font-weight', 'bold');
        count.setAttribute('text-anchor', 'end');
      }

      // Card nodes in this column: styled with column's coordinated color and strictly start-aligned inside card box
      for (const card of Array.from(col.querySelectorAll('g.pele-card, g.pele-node'))) {
        setNodeVars(card, colFill, colBorder, cardTextColor);

        const cardRect = card.querySelector('rect') as SVGRectElement | null;
        if (cardRect) {
          cardRect.setAttribute('fill', colFill);
          cardRect.setAttribute('stroke', colBorder);
          cardRect.setAttribute('stroke-width', '1.25px');
          cardRect.setAttribute('rx', '6');
          cardRect.setAttribute('ry', '6');
          if (cardRect.style) {
            cardRect.style.fill = colFill;
            cardRect.style.stroke = colBorder;
          }
        }
        for (const cardText of Array.from(card.querySelectorAll('text'))) {
          cardText.setAttribute('fill', cardTextColor);
          cardText.setAttribute('text-anchor', 'start');
          setElStyle(cardText, 'text-anchor', 'start', true);
          setElStyle(cardText, 'text-align', 'left', true);
          setElStyle(cardText, 'fill', cardTextColor, true);
          setElStyle(cardText, 'color', cardTextColor, true);
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
      const fill = palette.fills[slot] ?? palette.surface;
      const stroke = palette.borders[slot] ?? palette.border;
      const textColor = textOnFill(fill, palette.text);

      setNodeVars(actor, fill, stroke, textColor);

      for (const rect of Array.from(actor.querySelectorAll('rect')) as SVGRectElement[]) {
        rect.setAttribute('fill', fill);
        rect.setAttribute('stroke', stroke);
        rect.setAttribute('stroke-width', '1.25px');
        rect.setAttribute('rx', '4');
        rect.setAttribute('ry', '4');
        if (rect.style) {
          rect.style.fill = fill;
          rect.style.stroke = stroke;
        }
      }
      for (const text of Array.from(actor.querySelectorAll('text'))) {
        text.setAttribute('fill', textColor);
        setElStyle(text, 'fill', textColor, true);
      }
    }
  }

  // 8. State Diagrams: Coordinated state boxes
  if (isPeleState) {
    const states = Array.from(doc.querySelectorAll('g.pele-state-node, g.pele-node'));
    for (let i = 0; i < states.length; i++) {
      const state = states[i]!;
      const slot = i % (palette.fills.length || 1);
      const fill = palette.fills[slot] ?? palette.surface;
      const stroke = palette.borders[slot] ?? palette.border;
      const textColor = textOnFill(fill, palette.text);

      setNodeVars(state, fill, stroke, textColor);

      const rect = state.querySelector('rect') as SVGRectElement | null;
      if (rect) {
        rect.setAttribute('fill', fill);
        rect.setAttribute('stroke', stroke);
        rect.setAttribute('stroke-width', '1.25px');
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
        if (rect.style) {
          rect.style.fill = fill;
          rect.style.stroke = stroke;
        }
      }
      const text = state.querySelector('text');
      if (text) {
        text.setAttribute('fill', textColor);
        setElStyle(text, 'fill', textColor, true);
      }
    }
  }

  // 9. Treemap Diagrams: Coordinated leaf node fills & borders
  if (isPeleTreemap) {
    const leaves = Array.from(doc.querySelectorAll('g.pele-leaf, rect.pele-leaf'));
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i]!;
      const slot = i % (palette.fills.length || 1);
      const fill = palette.fills[slot] ?? palette.surface;
      const stroke = palette.borders[slot] ?? palette.border;
      const textColor = textOnFill(fill, palette.text);

      const rect = (leaf.tagName.toLowerCase() === 'rect' ? leaf : leaf.querySelector('rect')) as SVGRectElement | null;
      if (rect) {
        rect.setAttribute('fill', fill);
        rect.setAttribute('stroke', stroke);
        if (rect.style) {
          rect.style.fill = fill;
          rect.style.stroke = stroke;
        }
      }
      const text = leaf.tagName.toLowerCase() === 'rect' ? null : leaf.querySelector('text');
      if (text) {
        text.setAttribute('fill', textColor);
        setElStyle(text, 'fill', textColor, true);
      }
    }
  }

  // 10. Packet Diagrams: Coordinated packet field fills & borders
  if (isPelePacket) {
    const fields = Array.from(doc.querySelectorAll('g.pele-packet-fields > g.pele-node'));
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i]!;
      const slot = i % (palette.fills.length || 1);
      const fill = palette.fills[slot] ?? palette.surface;
      const stroke = palette.borders[slot] ?? palette.border;
      const textColor = textOnFill(fill, palette.text);

      setNodeVars(field, fill, stroke, textColor);

      const rect = field.querySelector('rect') as SVGRectElement | null;
      if (rect) {
        rect.setAttribute('fill', fill);
        rect.setAttribute('stroke', stroke);
        rect.setAttribute('stroke-width', '1.25px');
        rect.setAttribute('rx', '4');
        rect.setAttribute('ry', '4');
        if (rect.style) {
          rect.style.fill = fill;
          rect.style.stroke = stroke;
        }
      }

      const text = field.querySelector('text');
      if (text) {
        text.setAttribute('fill', textColor);
        text.setAttribute('font-weight', '600');
        setElStyle(text, 'fill', textColor, true);
        setElStyle(text, 'color', textColor, true);
      }
    }
  }

  // 11. Block Diagrams: Coordinated block node fills & borders
  if (isPeleBlock) {
    const blocks = Array.from(doc.querySelectorAll('g.pele-nodes > g.pele-node'));
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]!;
      const slot = i % (palette.fills.length || 1);
      const fill = palette.fills[slot] ?? palette.surface;
      const stroke = palette.borders[slot] ?? palette.border;
      const textColor = textOnFill(fill, palette.text);

      setNodeVars(b, fill, stroke, textColor);

      const rect = b.querySelector('rect') as SVGRectElement | null;
      if (rect) {
        rect.setAttribute('fill', fill);
        rect.setAttribute('stroke', stroke);
        rect.setAttribute('stroke-width', '1.25px');
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
        if (rect.style) {
          rect.style.fill = fill;
          rect.style.stroke = stroke;
        }
      }
      const text = b.querySelector('text.pele-label, text');
      if (text) {
        text.setAttribute('fill', textColor);
        setElStyle(text, 'fill', textColor, true);
      }
    }
  }

  // 12. C4 Architecture Diagrams: Coordinated person & system fills
  if (isPeleC4) {
    const nodes = Array.from(doc.querySelectorAll('g.pele-nodes > g.pele-node'));
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      const slot = i % (palette.fills.length || 1);
      const fill = palette.fills[slot] ?? palette.surface;
      const stroke = palette.borders[slot] ?? palette.border;
      const textColor = textOnFill(fill, palette.text);

      setNodeVars(node, fill, stroke, textColor);

      for (const shape of Array.from(node.querySelectorAll('rect, circle')) as SVGElement[]) {
        shape.setAttribute('fill', fill);
        shape.setAttribute('stroke', stroke);
        if (shape.style) {
          shape.style.fill = fill;
          shape.style.stroke = stroke;
        }
      }
      for (const text of Array.from(node.querySelectorAll('text, tspan'))) {
        if (text.classList.contains('pele-c4-type') || text.classList.contains('pele-c4-descr')) {
          text.setAttribute('fill', dark ? '#cbd5e1' : '#475569');
        } else {
          text.setAttribute('fill', textColor);
        }
      }
    }
  }

  // 13. Architecture Diagrams: Coordinated cloud clusters, service fills, and icon strokes
  if (isPeleArch) {
    const clusters = Array.from(doc.querySelectorAll('g.pele-cluster'));
    for (let c = 0; c < clusters.length; c++) {
      const cluster = clusters[c]!;
      const slot = c % (palette.fills.length || 1);
      const clusterFill = palette.clusterBkg ?? (dark ? '#1a2333' : '#f8fafc');
      const clusterBorder = palette.borders[slot] ?? palette.border;

      const rect = cluster.querySelector(':scope > rect, rect') as SVGRectElement | null;
      if (rect) {
        rect.setAttribute('fill', clusterFill);
        rect.setAttribute('fill-opacity', dark ? '0.45' : '0.65');
        rect.setAttribute('stroke', clusterBorder);
        rect.setAttribute('stroke-width', '1.5px');
        rect.setAttribute('rx', '8');
        rect.setAttribute('ry', '8');
        if (rect.style) {
          rect.style.fill = clusterFill;
          rect.style.stroke = clusterBorder;
        }
      }

      const label = cluster.querySelector('.pele-cluster-label, text.pele-cluster-label');
      if (label) {
        label.setAttribute('fill', palette.text);
        label.setAttribute('text-anchor', 'start');
        setElStyle(label, 'fill', palette.text, true);
        setElStyle(label, 'font-weight', 'bold');
        if ((label as HTMLElement).style) {
          (label as HTMLElement).style.setProperty('text-anchor', 'start', 'important');
          (label as HTMLElement).style.setProperty('text-align', 'left', 'important');
        }
      }

      const icon = cluster.querySelector('svg.pele-icon path');
      if (icon) {
        icon.setAttribute('stroke', clusterBorder);
        setElStyle(icon, 'stroke', clusterBorder, true);
      }
    }

    const services = Array.from(doc.querySelectorAll('g.pele-service, g.pele-nodes > g.pele-node'));
    for (let s = 0; s < services.length; s++) {
      const service = services[s]!;
      const slot = s % (palette.fills.length || 1);
      const fill = palette.fills[slot] ?? palette.surface;
      const stroke = palette.borders[slot] ?? palette.border;
      const iconColor = textOnFill(fill, palette.text);

      setNodeVars(service, fill, stroke, palette.text);

      const rect = service.querySelector(':scope > rect, rect') as SVGRectElement | null;
      if (rect) {
        rect.setAttribute('fill', fill);
        rect.setAttribute('stroke', stroke);
        rect.setAttribute('stroke-width', '1.5px');
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
        if (rect.style) {
          rect.style.fill = fill;
          rect.style.stroke = stroke;
        }
      }

      for (const iconPath of Array.from(service.querySelectorAll('svg.pele-icon path'))) {
        iconPath.setAttribute('stroke', iconColor);
        setElStyle(iconPath, 'stroke', iconColor, true);
      }

      const label = service.querySelector('text.pele-label, text');
      if (label) {
        label.setAttribute('fill', palette.text);
        setElStyle(label, 'fill', palette.text, true);
        setElStyle(label, 'font-weight', '500');
      }
    }

    for (const edge of Array.from(doc.querySelectorAll('g.pele-edge path'))) {
      edge.setAttribute('stroke', palette.line);
      edge.setAttribute('stroke-width', '1.5px');
    }
  }

  // 14. Timeline Diagrams: Coordinated period banners, axis dots, stems, and event cards
  if (isPeleTimeline) {
    const title = doc.querySelector('.pele-title, text.pele-title tspan');
    if (title) {
      title.setAttribute('fill', palette.text);
      setElStyle(title, 'fill', palette.text, true);
    }

    const axis = doc.querySelector('path.pele-axis');
    if (axis) {
      axis.setAttribute('stroke', palette.line);
      setElStyle(axis, 'stroke', palette.line, true);
    }
    const marker = doc.querySelector('path.pele-marker');
    if (marker) {
      marker.setAttribute('fill', palette.line);
      setElStyle(marker, 'fill', palette.line, true);
    }

    const periods = Array.from(doc.querySelectorAll('g.pele-period'));
    for (let p = 0; p < periods.length; p++) {
      const period = periods[p]!;
      const slot = p % (palette.fills.length || 1);
      const fill = palette.fills[slot] ?? palette.surface;
      const stroke = palette.borders[slot] ?? palette.border;
      const periodTextColor = textOnFill(fill, palette.text);

      const pRect = period.querySelector(':scope > rect') as SVGRectElement | null;
      if (pRect) {
        pRect.setAttribute('fill', fill);
        pRect.setAttribute('stroke', stroke);
        pRect.setAttribute('stroke-width', '1.25px');
        pRect.setAttribute('rx', '4');
        pRect.setAttribute('ry', '4');
        if (pRect.style) {
          pRect.style.fill = fill;
          pRect.style.stroke = stroke;
        }
      }

      const pText = period.querySelector(':scope > text');
      if (pText) {
        pText.setAttribute('fill', periodTextColor);
        setElStyle(pText, 'fill', periodTextColor, true);
        setElStyle(pText, 'font-weight', 'bold');
      }

      const stem = period.querySelector(':scope > path.pele-edge');
      if (stem) {
        stem.setAttribute('stroke', stroke);
        stem.setAttribute('stroke-width', '1.5px');
        setElStyle(stem, 'stroke', stroke, true);
      }

      const dot = period.querySelector(':scope > circle.pele-dot');
      if (dot) {
        dot.setAttribute('fill', fill);
        dot.setAttribute('stroke', dark ? palette.background : '#ffffff');
        dot.setAttribute('stroke-width', '2px');
        setElStyle(dot, 'fill', fill, true);
        setElStyle(dot, 'stroke', dark ? palette.background : '#ffffff', true);
      }

      const events = Array.from(period.querySelectorAll('g.pele-event'));
      for (let e = 0; e < events.length; e++) {
        const evt = events[e]!;
        const eRect = evt.querySelector('rect') as SVGRectElement | null;
        if (eRect) {
          eRect.setAttribute('fill', fill);
          eRect.setAttribute('fill-opacity', dark ? '0.28' : '0.18');
          eRect.setAttribute('stroke', stroke);
          eRect.setAttribute('stroke-width', '1.25px');
          eRect.setAttribute('rx', '4');
          eRect.setAttribute('ry', '4');
          if (eRect.style) {
            eRect.style.fill = fill;
            eRect.style.stroke = stroke;
          }
        }

        const eText = evt.querySelector('text');
        if (eText) {
          eText.setAttribute('fill', palette.text);
          setElStyle(eText, 'fill', palette.text, true);
        }
      }
    }
  }

  // 15. User Journey Diagrams: Coordinated section headers, task cards, and actor dots
  if (isPeleJourney) {
    const title = doc.querySelector('.pele-title, text.pele-title tspan');
    if (title) {
      title.setAttribute('fill', palette.text);
      setElStyle(title, 'fill', palette.text, true);
    }

    for (const grid of Array.from(doc.querySelectorAll('path.pele-grid'))) {
      grid.setAttribute('stroke', palette.border);
      grid.setAttribute('stroke-opacity', '0.35');
    }
    for (const scale of Array.from(doc.querySelectorAll('.pele-scale text'))) {
      scale.setAttribute('fill', palette.text);
    }
    for (const stem of Array.from(doc.querySelectorAll('path.pele-stems'))) {
      stem.setAttribute('stroke', palette.line);
      stem.setAttribute('stroke-opacity', '0.5');
    }
    for (const edge of Array.from(doc.querySelectorAll('path.pele-edge'))) {
      edge.setAttribute('stroke', palette.accent);
      edge.setAttribute('stroke-width', '2px');
    }

    const sections = Array.from(doc.querySelectorAll('g.pele-section'));
    for (let s = 0; s < sections.length; s++) {
      const sec = sections[s]!;
      const slot = s % (palette.fills.length || 1);
      const fill = palette.fills[slot] ?? palette.surface;
      const stroke = palette.borders[slot] ?? palette.border;
      const textColor = textOnFill(fill, palette.text);

      const secRect = sec.querySelector(':scope > rect') as SVGRectElement | null;
      if (secRect) {
        secRect.setAttribute('fill', fill);
        secRect.setAttribute('stroke', stroke);
        secRect.setAttribute('stroke-width', '1.25px');
        secRect.setAttribute('rx', '6');
        secRect.setAttribute('ry', '6');
        if (secRect.style) {
          secRect.style.fill = fill;
          secRect.style.stroke = stroke;
        }
      }

      const secText = sec.querySelector(':scope > text');
      if (secText) {
        secText.setAttribute('fill', textColor);
        setElStyle(secText, 'fill', textColor, true);
        setElStyle(secText, 'font-weight', 'bold');
        const tspan = secText.querySelector('tspan');
        if (tspan) {
          tspan.setAttribute('fill', textColor);
          setElStyle(tspan, 'fill', textColor, true);
        }
      }

      const tasks = Array.from(sec.querySelectorAll('g.pele-task'));
      for (let t = 0; t < tasks.length; t++) {
        const task = tasks[t]!;
        const tRect = task.querySelector('rect') as SVGRectElement | null;
        if (tRect) {
          tRect.setAttribute('fill', fill);
          tRect.setAttribute('fill-opacity', dark ? '0.28' : '0.18');
          tRect.setAttribute('stroke', stroke);
          tRect.setAttribute('stroke-width', '1.25px');
          tRect.setAttribute('rx', '4');
          tRect.setAttribute('ry', '4');
          if (tRect.style) {
            tRect.style.fill = fill;
            tRect.style.stroke = stroke;
          }
        }

        const tText = task.querySelector('text');
        if (tText) {
          tText.setAttribute('fill', palette.text);
          setElStyle(tText, 'fill', palette.text, true);
        }
      }
    }

    const actorMap = new Map<string, number>();
    let actorCount = 0;
    for (const actor of Array.from(doc.querySelectorAll('circle.pele-actor'))) {
      const actorName = actor.querySelector('title')?.textContent || actor.getAttribute('data-id') || '';
      if (actorName && !actorMap.has(actorName)) {
        actorMap.set(actorName, actorCount++);
      }
      const aSlot = (actorMap.get(actorName) ?? 0) % (palette.fills.length || 1);
      const aCol = palette.fills[aSlot] ?? palette.accent;
      const aBorder = palette.borders[aSlot % palette.borders.length] ?? palette.border;
      actor.setAttribute('fill', aCol);
      actor.setAttribute('stroke', aBorder);
      setElStyle(actor, 'fill', aCol, true);
      setElStyle(actor, 'stroke', aBorder, true);
    }

    for (const legItem of Array.from(doc.querySelectorAll('g.pele-legend-item'))) {
      const id = legItem.getAttribute('data-id') || '';
      const aSlot = (actorMap.get(id) ?? 0) % (palette.fills.length || 1);
      const aCol = palette.fills[aSlot] ?? palette.accent;
      const dot = legItem.querySelector('circle');
      if (dot) {
        dot.setAttribute('fill', aCol);
        setElStyle(dot, 'fill', aCol, true);
      }
      const txt = legItem.querySelector('text');
      if (txt) {
        txt.setAttribute('fill', palette.text);
        setElStyle(txt, 'fill', palette.text, true);
      }
    }
  }

  return new XMLSerializer().serializeToString(doc.documentElement);
}
