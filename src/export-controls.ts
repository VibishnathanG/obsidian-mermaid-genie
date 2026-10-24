import { MarkdownRenderChild, Menu, Notice, Platform, setIcon, SuggestModal, type App } from 'obsidian';
import { diagramImage, diagramPng } from './diagram-export';
import type { DiagramFileExport } from './file-export';
import type { SvgClipboard } from './svg-clipboard';
import {
  attachInlineGestures,
  getBlockScale,
  openFullscreenModal,
  resetBlockZoom,
  setBlockScale,
  setFullscreenIcon,
  teardownInlineZoom,
  zoomBlockBy,
} from './zoom-fullscreen';

export type ExportAction = 'copy' | 'copy-svg' | 'png' | 'svg';

export async function exportDiagram(
  svg: SVGSVGElement,
  action: ExportAction,
  sourcePath: string,
  svgClipboard: SvgClipboard,
  files: DiagramFileExport
): Promise<void> {
  try {
    const snapshot = diagramImage(svg);
    if (action === 'copy-svg') {
      await svgClipboard.copy(snapshot, svg.ownerDocument?.defaultView?.navigator.clipboard);
    } else if (action === 'copy') {
      const clipboard = svg.ownerDocument?.defaultView?.navigator.clipboard;
      if (!clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Clipboard is unavailable.');
      }
      const canvas = document.createElement('canvas');
      const blob = await diagramPng(snapshot, canvas);
      await clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      new Notice('Diagram copied to clipboard as PNG.');
    } else {
      await files.save(snapshot, action, sourcePath);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    new Notice(`Export failed: ${message}`);
  }
}

export class DiagramPickerModal extends SuggestModal<SVGSVGElement> {
  constructor(
    app: App,
    private diagrams: SVGSVGElement[],
    private onSelect: (svg: SVGSVGElement) => void
  ) {
    super(app);
    this.setPlaceholder('Select a diagram to export...');
  }

  getSuggestions(query: string): SVGSVGElement[] {
    const lower = query.toLowerCase();
    return this.diagrams.filter(svg => {
      const text = svg.textContent?.toLowerCase() || '';
      return text.includes(lower);
    });
  }

  renderSuggestion(svg: SVGSVGElement, el: HTMLElement): void {
    const text = svg.textContent?.trim().slice(0, 80) || 'Mermaid Diagram';
    el.createEl('div', { text, cls: 'mermaid-genie-picker-item' });
  }

  onChooseSuggestion(item: SVGSVGElement): void {
    this.onSelect(item);
  }
}

let cachedDockTemplate: HTMLElement | null = null;

function createDockTemplate(doc: Document): HTMLElement {
  const actions = doc.createElement('div');
  actions.className = 'mermaid-genie-actions';

  // 1. Export button
  const exportBtn = doc.createElement('button');
  exportBtn.className = 'mermaid-genie-btn mermaid-genie-export-btn';
  exportBtn.type = 'button';
  exportBtn.setAttribute('aria-label', 'Copy and export diagram');
  exportBtn.title = 'Copy and export diagram';
  exportBtn.dataset.action = 'export';
  setIcon(exportBtn, 'image-down');
  actions.appendChild(exportBtn);

  // 2. Zoom Out button
  const zoomOutBtn = doc.createElement('button');
  zoomOutBtn.className = 'mermaid-genie-btn mermaid-genie-zoom-out-btn';
  zoomOutBtn.type = 'button';
  zoomOutBtn.setAttribute('aria-label', 'Zoom out');
  zoomOutBtn.title = 'Zoom out';
  zoomOutBtn.dataset.action = 'zoom-out';
  setIcon(zoomOutBtn, 'minus');
  actions.appendChild(zoomOutBtn);

  // 3. Zoom In button
  const zoomInBtn = doc.createElement('button');
  zoomInBtn.className = 'mermaid-genie-btn mermaid-genie-zoom-in-btn';
  zoomInBtn.type = 'button';
  zoomInBtn.setAttribute('aria-label', 'Zoom in');
  zoomInBtn.title = 'Zoom in';
  zoomInBtn.dataset.action = 'zoom-in';
  setIcon(zoomInBtn, 'plus');
  actions.appendChild(zoomInBtn);

  // 4. Reset Zoom button
  const resetBtn = doc.createElement('button');
  resetBtn.className = 'mermaid-genie-btn mermaid-genie-reset-btn';
  resetBtn.type = 'button';
  resetBtn.setAttribute('aria-label', 'Reset zoom');
  resetBtn.title = 'Reset zoom';
  resetBtn.dataset.action = 'reset';
  setIcon(resetBtn, 'rotate-ccw');
  actions.appendChild(resetBtn);

  // 5. Fullscreen button
  const fullscreenBtn = doc.createElement('button');
  fullscreenBtn.className = 'mermaid-genie-btn mermaid-genie-fullscreen-btn';
  fullscreenBtn.type = 'button';
  fullscreenBtn.setAttribute('aria-label', 'Fullscreen');
  fullscreenBtn.title = 'Fullscreen';
  fullscreenBtn.dataset.action = 'fullscreen';
  setFullscreenIcon(fullscreenBtn);
  actions.appendChild(fullscreenBtn);

  return actions;
}

function getDockTemplate(doc: Document): HTMLElement {
  if (!cachedDockTemplate || cachedDockTemplate.ownerDocument !== doc) {
    cachedDockTemplate = createDockTemplate(doc);
  }
  return cachedDockTemplate;
}

export function decorateMermaidBlock(
  block: HTMLElement,
  app: App,
  svgClipboard: SvgClipboard,
  files: DiagramFileExport,
  isEnabled: () => boolean,
  sourcePath?: string
): void {
  if (!isEnabled()) return;

  // Fast-path guard: if already decorated, avoid unnecessary querySelector and reflow
  if (block.dataset.mgReady === 'true' && block.querySelector(':scope > .mermaid-genie-actions')) {
    return;
  }
  if (block.querySelector(':scope > .mermaid-genie-actions')) {
    block.dataset.mgReady = 'true';
    return;
  }

  const svg = block.querySelector<SVGSVGElement>('svg');
  if (!svg) return;

  block.classList.add('mermaid-genie-container');
  block.dataset.mgReady = 'true';

  const doc = block.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) return;

  // Instant O(1) mount via pre-compiled template clone with all icons already parsed
  const actions = getDockTemplate(doc).cloneNode(true) as HTMLElement;
  block.appendChild(actions);

  // Pin actions dock to bottom-right during horizontal scrolling without forcing layout
  let scrollRaf: number | null = null;
  const onScroll = (): void => {
    if (scrollRaf !== null) return;
    const win = block.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null);
    const schedule = win?.requestAnimationFrame || (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (cb: FrameRequestCallback) => setTimeout(cb, 16) as unknown as number);
    scrollRaf = schedule(() => {
      scrollRaf = null;
      if (block.scrollLeft > 0) {
        actions.style.transform = `translateX(${block.scrollLeft}px)`;
      } else {
        actions.style.removeProperty('transform');
      }
    });
  };
  block.addEventListener('scroll', onScroll, { passive: true });

  // Attach inline gestures (Ctrl+wheel, drag to pan when scaled)
  attachInlineGestures(block);

  const getSourcePath = () => sourcePath || app.workspace?.getActiveFile?.()?.path || '';

  // Single delegated pointerdown to prevent drag initiation on toolbar clicks
  actions.addEventListener('pointerdown', (event: PointerEvent) => {
    event.stopPropagation();
  });

  // Single delegated click listener handles all 5 buttons with zero individual listener overhead
  actions.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as Element | null;
    const btn = target?.closest<HTMLButtonElement>('button.mermaid-genie-btn');
    if (!btn || !actions.contains(btn)) return;

    event.preventDefault();
    event.stopPropagation();

    const action = btn.dataset.action;
    const currentSvg = block.querySelector<SVGSVGElement>('svg') || svg;
    const currentPath = getSourcePath();

    if (action === 'export') {
      const menu = new Menu();
      menu.addItem(item =>
        item.setTitle('Copy as PNG')
          .setIcon('copy')
          .onClick(() => { void exportDiagram(currentSvg, 'copy', currentPath, svgClipboard, files); })
      );
      menu.addItem(item =>
        item.setTitle('Copy as SVG')
          .setIcon('copy')
          .onClick(() => { void exportDiagram(currentSvg, 'copy-svg', currentPath, svgClipboard, files); })
      );
      menu.addSeparator();
      menu.addItem(item =>
        item.setTitle(Platform.isDesktopApp ? 'Export as PNG…' : 'Save as PNG')
          .setIcon('image-down')
          .onClick(() => { void exportDiagram(currentSvg, 'png', currentPath, svgClipboard, files); })
      );
      menu.addItem(item =>
        item.setTitle(Platform.isDesktopApp ? 'Export as SVG…' : 'Save as SVG')
          .setIcon('file-code')
          .onClick(() => { void exportDiagram(currentSvg, 'svg', currentPath, svgClipboard, files); })
      );
      menu.showAtMouseEvent(event);
    } else if (action === 'zoom-out') {
      zoomBlockBy(block, 1 / 1.2);
    } else if (action === 'zoom-in') {
      zoomBlockBy(block, 1.2);
    } else if (action === 'reset') {
      resetBlockZoom(block);
    } else if (action === 'fullscreen') {
      openFullscreenModal({
        app,
        sourceSvg: currentSvg,
        sourcePath: currentPath,
        onExport: (exportedSvg, exportAct) => {
          void exportDiagram(exportedSvg, exportAct, currentPath, svgClipboard, files);
        },
      });
    }
  });

  // Heal re-rendered SVG if scale was applied
  const scale = getBlockScale(block);
  if (scale !== 1 && !svg.style.width) {
    setBlockScale(block, scale);
  }
}

export class DiagramExportControls extends MarkdownRenderChild {
  constructor(
    private app: App,
    container: HTMLElement,
    private sourcePath: string,
    private svgClipboard: SvgClipboard,
    private files: DiagramFileExport,
    private isEnabled: () => boolean
  ) {
    super(container);
  }

  onload(): void {
    this.scan();
  }

  scan(): void {
    const blocks: HTMLElement[] = [];
    if (this.containerEl.classList?.contains('mermaid')) {
      blocks.push(this.containerEl);
    }
    for (const b of Array.from(this.containerEl.querySelectorAll<HTMLElement>('.mermaid'))) {
      blocks.push(b);
    }
    for (const b of blocks) {
      decorateMermaidBlock(b, this.app, this.svgClipboard, this.files, this.isEnabled, this.sourcePath);
    }
  }

  onunload(): void {
    const blocks: HTMLElement[] = [];
    if (this.containerEl.classList?.contains('mermaid')) {
      blocks.push(this.containerEl);
    }
    for (const b of Array.from(this.containerEl.querySelectorAll<HTMLElement>('.mermaid'))) {
      blocks.push(b);
    }
    for (const b of blocks) {
      teardownInlineZoom(b);
      b.classList.remove('mermaid-genie-container', 'mermaid-genie-scaled', 'mermaid-genie-dragging');
      delete b.dataset.mgScale;
      b.querySelector(':scope > .mermaid-genie-actions')?.remove();
    }
  }
}
