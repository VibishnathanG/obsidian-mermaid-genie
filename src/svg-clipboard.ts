import { Notice, type App, type Editor, type MarkdownFileInfo } from 'obsidian';
import type { DiagramImage } from './diagram-export';

export class SvgClipboard {
  private copied?: { token: string; svg: string };
  private generation = 0;

  constructor(private app: App) {}

  async copy(image: DiagramImage, clipboard: Clipboard | undefined): Promise<void> {
    if (!clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw new Error('Clipboard is unavailable.');
    }
    const token = crypto.randomUUID();
    const copied = { token, svg: image.svg };
    const html = `<img data-mermaid-genie-svg="${token}" alt="Mermaid diagram" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(image.svg)}">`;

    try {
      await clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([image.svg], { type: 'text/plain' }),
        }),
      ]);
      this.copied = copied;
      new Notice('Diagram SVG copied to clipboard.');
    } catch {
      new Notice('Could not write SVG to clipboard.');
    }
  }

  paste(event: ClipboardEvent, editor: Editor, info: MarkdownFileInfo): Promise<void> | undefined {
    const copied = this.copied;
    if (event.defaultPrevented || !copied || !info.file) return;
    const token = event.clipboardData?.getData('text/html').match(/data-mermaid-genie-svg=["']([\da-f-]+)["']/i)?.[1];
    if (token !== copied.token) return;
    return this.insert(copied.svg, editor, info, info.file.path, info.file.basename);
  }

  private async insert(svg: string, editor: Editor, info: MarkdownFileInfo, sourcePath: string, basename: string): Promise<void> {
    this.generation++;
    const gen = this.generation;
    try {
      const name = (basename || 'diagram').replace(/[\\/:*?"<>|]/g, '-');
      const path = await this.app.fileManager.getAvailablePathForAttachment(`${name}-diagram.svg`, sourcePath);
      const file = await this.app.vault.createBinary(path, new TextEncoder().encode(svg).buffer as ArrayBuffer);
      if (gen !== this.generation || info.file?.path !== sourcePath) return;
      editor.replaceSelection(`!${this.app.fileManager.generateMarkdownLink(file, sourcePath)}`);
    } catch {
      new Notice('Could not paste diagram SVG.');
    }
  }

  clear(): void {
    this.copied = undefined;
  }
}
