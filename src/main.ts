import { loadMermaid, MarkdownView, Plugin } from 'obsidian';

export interface RenderResult {
  svg: string;
  bindFunctions?: (element: Element) => void;
}

export interface MermaidConfig {
  theme?: string;
  fontFamily?: string;
  themeVariables?: Record<string, unknown>;
  flowchart?: Record<string, unknown>;
  [key: string]: unknown;
}
import { resolvePaletteData } from './colors';
import { DiagramFileExport } from './file-export';
import { DiagramExportControls, DiagramPickerModal, exportDiagram } from './export-controls';
import { createPathController } from './highlight';
import { styleSvg, widenSingleRectangles, wrapDecisions, type Direction } from './layout';
import { DEFAULT_SETTINGS, GenieSettingsTab, normalizeSettings, type GenieSettings } from './settings';
import { SvgClipboard } from './svg-clipboard';

type MermaidRender = (this: unknown, id: string, source: unknown, ...args: unknown[]) => Promise<string | RenderResult>;
interface MermaidRuntime {
  render: MermaidRender;
}

export default class MermaidGeniePlugin extends Plugin {
  private stopped = false;
  settings: GenieSettings = { ...DEFAULT_SETTINGS };
  private svgClipboard = new SvgClipboard(this.app);
  private fileExport = new DiagramFileExport(
    this.app,
    () => this.settings.exportFolder,
    async folder => {
      this.settings.exportFolder = folder;
      await this.saveSettings();
    }
  );

  async onload(): Promise<void> {
    this.stopped = false;
    this.settings = normalizeSettings(await this.loadData());
    if (this.stopped) return;

    this.addSettingTab(new GenieSettingsTab(this.app, this));

    // Ancestor path highlighting controller
    const controller = createPathController(document, () => this.settings);
    this.registerDomEvent(document, 'pointerover', event => controller.enter(event));
    this.registerDomEvent(document, 'pointerout', event => controller.leave(event));
    this.registerDomEvent(document, 'focusin', event => controller.enter(event));
    this.registerDomEvent(document, 'focusout', event => controller.leave(event));
    this.register(() => controller.dispose());

    // Markdown post-processor for export action button
    this.registerMarkdownPostProcessor((element, context) => {
      if (this.stopped || !this.settings.exportControls) return;
      if (!element.matches('.mermaid, .mermaid-wrapper') && !element.querySelector('.mermaid, .mermaid-wrapper, code.language-mermaid')) {
        return;
      }
      const controls = new DiagramExportControls(
        element,
        context.sourcePath,
        this.svgClipboard,
        this.fileExport,
        () => this.settings.exportControls
      );
      context.addChild(controls);
    });

    // Paste handler for SVG diagrams copied from Genie
    this.registerEvent(
      this.app.workspace.on('editor-paste', (event, editor, info) => {
        if (event.defaultPrevented || this.stopped) return;
        const paste = this.svgClipboard.paste(event, editor, info);
        if (paste) {
          event.preventDefault();
          void paste;
        }
      })
    );

    // Register user commands
    this.registerCommands();

    // Hook Obsidian's Mermaid engine
    const mermaid = (await loadMermaid()) as MermaidRuntime;
    if (this.stopped) return;

    const original = mermaid.render;
    const getSettings = () => this.settings;

    const wrapped: MermaidRender = async function (id, source, ...args) {
      if (typeof source !== 'string') return original.call(this, id, source, ...args);

      let text = source;
      // Opt-out check (supports both %% mg:off and %% mfe:off)
      if (/^\s*%%\s*(?:mg|mfe):off\s*$/m.test(text)) {
        return original.call(this, id, text, ...args);
      }

      const directionMatch = text.match(/^\s*(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/m);
      const direction = directionMatch?.[1] as Direction | undefined;

      const currentSettings = getSettings();
      const dark = document.body.classList.contains('theme-dark');
      const palette = resolvePaletteData(
        currentSettings.colorStyle,
        currentSettings.multiPalette,
        currentSettings.singlePalette,
        dark,
        currentSettings.customColors?.[dark ? 'dark' : 'light']
      );

      // Smart label wrapping on decision diamonds
      if (direction && currentSettings.compactLayout) {
        text = wrapDecisions(text);
      }

      const header = text.match(/^\s*---\s*\n[\s\S]*?\n---\s*\n/);
      const prefix = header ? header[0] : '';

      const configuredDefaults: MermaidConfig = {
        theme: dark ? 'dark' : 'base',
        fontFamily: 'var(--font-text, var(--default-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif))',
        themeVariables: {
          darkMode: dark,
          background: dark ? palette.background : '#ffffff',
          primaryColor: palette.surface,
          primaryTextColor: palette.text,
          primaryBorderColor: palette.border,
          lineColor: palette.line,
          edgeLabelBackground: palette.label,
          clusterBkg: palette.clusterBkg ?? (dark ? '#1d2838' : '#f1f5f9'),
          clusterBorder: palette.clusterBorder ?? palette.border,
          fontSize: '15px',
        },
        flowchart: {
          curve: 'step',
          nodeSpacing: 28,
          rankSpacing: 26,
          padding: 10,
          diagramPadding: 4,
          wrappingWidth: 160,
          useMaxWidth: false,
          htmlLabels: true,
        },
      };

      const configured = prefix + `%%{init: ${JSON.stringify(configuredDefaults)}}%%\n` + text.slice(prefix.length);
      let result = await original.call(this, id, configured, ...args);

      if (direction && currentSettings.compactLayout) {
        const rawSvg = typeof result === 'string' ? result : result.svg;
        const widerSource = widenSingleRectangles(text, rawSvg, direction);
        if (widerSource !== text) {
          const widerConfigured = prefix + `%%{init: ${JSON.stringify(configuredDefaults)}}%%\n` + widerSource.slice(prefix.length);
          result = await original.call(this, id, widerConfigured, ...args);
        }
      }

      try {
        const rawSvg = typeof result === 'string' ? result : result.svg;
        const enhancedSvg = styleSvg(rawSvg, direction ?? '', currentSettings, palette, dark);
        return typeof result === 'string' ? enhancedSvg : { ...result, svg: enhancedSvg };
      } catch (error) {
        console.warn('Mermaid Genie: kept original SVG after layout/styling failed', error);
        return result;
      }
    };

    mermaid.render = wrapped;
    this.register(() => {
      if (mermaid.render === wrapped) mermaid.render = original;
    });
  }

  private registerCommands(): void {
    this.addCommand({
      id: 'refresh-diagrams',
      name: 'Refresh diagrams',
      callback: () => this.refreshDiagrams(),
    });

    const exportActions = [
      { id: 'copy-diagram-png', name: 'Copy diagram as PNG', action: 'copy' as const },
      { id: 'copy-diagram-svg', name: 'Copy diagram as SVG', action: 'copy-svg' as const },
      { id: 'export-diagram-png', name: 'Export diagram as PNG', action: 'png' as const },
      { id: 'export-diagram-svg', name: 'Export diagram as SVG', action: 'svg' as const },
    ];

    for (const item of exportActions) {
      this.addCommand({
        id: item.id,
        name: item.name,
        checkCallback: checking => {
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          const diagrams = Array.from(view?.containerEl.querySelectorAll<SVGSVGElement>('.mermaid > svg.mfe-enhanced') ?? []);
          if (!diagrams.length) return false;

          if (!checking) {
            const handleExport = (svg: SVGSVGElement) => {
              void exportDiagram(svg, item.action, view?.file?.path ?? '', this.svgClipboard, this.fileExport);
            };

            if (diagrams.length === 1) {
              handleExport(diagrams[0]!);
            } else {
              new DiagramPickerModal(this.app, diagrams, handleExport).open();
            }
          }
          return true;
        },
      });
    }
  }

  refreshDiagrams(): void {
    this.app.workspace.trigger('post-processor-change');
  }

  async saveSettings(): Promise<void> {
    this.settings = normalizeSettings(this.settings);
    await this.saveData(this.settings);

    document.querySelectorAll<SVGSVGElement>('svg.mfe-enhanced').forEach(svg => {
      svg.style.setProperty('--mpe-duration', `${this.settings.animationDuration}ms`);
    });

    if (!this.settings.pathHighlight) {
      document.querySelectorAll('.mpe-tracing, .mpe-on-path').forEach(el => el.classList.remove('mpe-tracing', 'mpe-on-path'));
    }
  }

  onunload(): void {
    this.stopped = true;
    this.svgClipboard.clear();
    this.fileExport.dispose();
    this.refreshDiagrams();
  }
}
