import { MarkdownRenderChild, Menu, Notice, Platform, setIcon, SuggestModal, type App } from 'obsidian';
import { diagramImage, diagramPng } from './diagram-export';
import type { DiagramFileExport } from './file-export';
import type { SvgClipboard } from './svg-clipboard';

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

export class DiagramExportControls extends MarkdownRenderChild {
  private observer?: MutationObserver;
  private controls = new Map<SVGSVGElement, { host: HTMLElement; actions: HTMLElement; onScroll: () => void }>();

  constructor(
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
    this.observer = new MutationObserver(() => this.scan());
    this.observer.observe(this.containerEl, { childList: true, subtree: true });
  }

  private scan(): void {
    if (!this.isEnabled()) return;

    for (const [svg, { host, actions, onScroll }] of this.controls) {
      if (!this.containerEl.contains(svg)) {
        host.removeEventListener('scroll', onScroll);
        actions.remove();
        this.controls.delete(svg);
        if (!host.querySelector('svg.mfe-enhanced')) host.classList.remove('mermaid-genie-container');
      }
    }

    for (const svg of this.containerEl.querySelectorAll<SVGSVGElement>('svg.mfe-enhanced')) {
      if (this.controls.has(svg) || !svg.parentElement?.matches('.mermaid')) continue;
      const parent = svg.parentElement;
      if (parent.querySelector(':scope > .mermaid-genie-actions')) continue;

      parent.classList.add('mermaid-genie-container');
      const actions = parent.createDiv({ cls: 'mermaid-genie-actions' });
      const onScroll = (): void => {
        actions.style.setProperty('--mermaid-genie-scroll-offset', `${parent.scrollLeft}px`);
      };
      parent.addEventListener('scroll', onScroll, { passive: true });
      onScroll();

      const button = actions.createEl('button', {
        cls: 'mermaid-genie-export-btn',
        attr: {
          type: 'button',
          'aria-label': 'Copy and export diagram',
          title: 'Copy and export diagram',
        },
      });
      setIcon(button, 'image-down');

      button.addEventListener('pointerdown', (event: PointerEvent) => event.stopPropagation());
      button.addEventListener('click', (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const menu = new Menu();

        menu.addItem(item =>
          item.setTitle('Copy as PNG')
            .setIcon('copy')
            .onClick(() => { void exportDiagram(svg, 'copy', this.sourcePath, this.svgClipboard, this.files); })
        );
        menu.addItem(item =>
          item.setTitle('Copy as SVG')
            .setIcon('copy')
            .onClick(() => { void exportDiagram(svg, 'copy-svg', this.sourcePath, this.svgClipboard, this.files); })
        );
        menu.addSeparator();
        menu.addItem(item =>
          item.setTitle(Platform.isDesktopApp ? 'Export as PNG…' : 'Save as PNG')
            .setIcon('image-down')
            .onClick(() => { void exportDiagram(svg, 'png', this.sourcePath, this.svgClipboard, this.files); })
        );
        menu.addItem(item =>
          item.setTitle(Platform.isDesktopApp ? 'Export as SVG…' : 'Save as SVG')
            .setIcon('file-code')
            .onClick(() => { void exportDiagram(svg, 'svg', this.sourcePath, this.svgClipboard, this.files); })
        );

        menu.showAtMouseEvent(event);
      });

      this.controls.set(svg, { host: parent, actions, onScroll });
    }
  }

  onunload(): void {
    this.observer?.disconnect();
    for (const { host, actions, onScroll } of this.controls.values()) {
      host.removeEventListener('scroll', onScroll);
      host.classList.remove('mermaid-genie-container');
      actions.remove();
    }
    this.controls.clear();
  }
}
