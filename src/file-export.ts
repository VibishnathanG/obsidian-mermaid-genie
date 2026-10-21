import { FileSystemAdapter, Notice, Platform, type App } from 'obsidian';
import { diagramPng, type DiagramImage } from './diagram-export';

export type Format = 'svg' | 'png';

interface SaveOptions {
  title: string;
  defaultPath: string;
  filters: { name: string; extensions: string[] }[];
}

interface DesktopRemote {
  dialog: { showSaveDialog(options: SaveOptions): Promise<{ canceled: boolean; filePath?: string }> };
  shell: { showItemInFolder(path: string): void };
}

export class DiagramFileExport {
  private stopped = false;
  private busy = false;

  constructor(
    private app: App,
    private lastFolder: () => string | undefined,
    private rememberFolder: (folder: string) => Promise<void>
  ) {}

  async save(image: DiagramImage, format: Format, sourcePath: string): Promise<void> {
    if (this.stopped) return;
    if (this.busy) {
      new Notice('Please wait for the current export to finish.');
      return;
    }
    this.busy = true;

    try {
      const name = (sourcePath.split('/').pop()?.replace(/\.md$/i, '') || 'diagram').replace(/[\\/:*?"<>|]/g, '-');
      const filename = `${name}-diagram.${format}`;

      if (!Platform.isDesktopApp) {
        const data = await this.bytes(image, format);
        if (this.stopped) return;
        const path = await this.app.fileManager.getAvailablePathForAttachment(filename, sourcePath);
        if (this.stopped) return;
        await this.app.vault.createBinary(path, data);
        new Notice(`Diagram saved to ${path}`);
        return;
      }

      const electronRequire = (window as Window & { require?: (name: string) => unknown }).require;
      if (!electronRequire || !(this.app.vault.adapter instanceof FileSystemAdapter)) {
        // Fallback to vault attachment save
        const data = await this.bytes(image, format);
        const path = await this.app.fileManager.getAvailablePathForAttachment(filename, sourcePath);
        await this.app.vault.createBinary(path, data);
        new Notice(`Diagram saved to ${path}`);
        return;
      }

      const electron = electronRequire('electron') as { remote?: DesktopRemote };
      const remote = electron.remote;
      const fs = electronRequire('fs/promises') as typeof import('node:fs/promises');
      const paths = electronRequire('path') as typeof import('node:path');

      if (!remote?.dialog?.showSaveDialog) {
        const data = await this.bytes(image, format);
        const path = await this.app.fileManager.getAvailablePathForAttachment(filename, sourcePath);
        await this.app.vault.createBinary(path, data);
        new Notice(`Diagram saved to ${path}`);
        return;
      }

      let folder = this.lastFolder();
      if (folder && !paths.isAbsolute(folder)) folder = undefined;
      if (!folder) {
        folder = await this.attachmentFolder(sourcePath);
      }

      const result = await remote.dialog.showSaveDialog({
        title: format === 'svg' ? 'Export diagram as SVG' : 'Export diagram as PNG',
        defaultPath: paths.join(folder, filename),
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      });

      if (result.canceled || !result.filePath) return;
      const data = await this.bytes(image, format);
      await fs.writeFile(result.filePath, Buffer.from(data));
      await this.rememberFolder(paths.dirname(result.filePath));

      new Notice(`Diagram exported: ${paths.basename(result.filePath)}`);
    } finally {
      this.busy = false;
    }
  }

  private async bytes(image: DiagramImage, format: Format): Promise<ArrayBuffer> {
    if (format === 'svg') {
      return new TextEncoder().encode(image.svg).buffer as ArrayBuffer;
    }
    const canvas = document.createElement('canvas');
    const blob = await diagramPng(image, canvas);
    return blob.arrayBuffer();
  }

  private async attachmentFolder(sourcePath: string): Promise<string> {
    const basePath = (this.app.vault.adapter as FileSystemAdapter).getBasePath();
    try {
      const sample = await this.app.fileManager.getAvailablePathForAttachment('test.png', sourcePath);
      const parts = sample.split('/');
      parts.pop();
      return (window as Window & { require: (n: string) => typeof import('node:path') }).require('path').join(basePath, ...parts);
    } catch {
      return basePath;
    }
  }

  dispose(): void {
    this.stopped = true;
  }
}
