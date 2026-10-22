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
import { computeDiagramSpacing, styleSvg, widenSingleRectangles, wrapDecisions, type Direction } from './layout';
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
  private renderCache = new Map<string, { svg: string; raw: string | RenderResult }>();
  private maxCacheSize = 150;
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
    const cache = this.renderCache;
    const maxCache = this.maxCacheSize;

    const wrapped: MermaidRender = async function (id, source, ...args) {
      if (typeof source !== 'string') return original.call(this, id, source, ...args);

      let text = source;
      // Opt-out check (supports both %% mg:off and %% mfe:off)
      if (/^\s*%%\s*(?:mg|mfe):off\s*$/m.test(text)) {
        return original.call(this, id, text, ...args);
      }

      const currentSettings = getSettings();
      const dark = document.body.classList.contains('theme-dark');

      // Check in-memory render cache for immediate zero-latency load
      const cacheKey = `${dark ? '1' : '0'}|${currentSettings.colorStyle}|${currentSettings.multiPalette}|${currentSettings.singlePalette}|${text}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        const cachedIdMatch = cached.svg.match(/^<svg\s+id="([^"]*)"/);
        const cachedId = cachedIdMatch?.[1];
        const currentIdSvg = cachedId && cachedId !== id
          ? cached.svg.split(cachedId).join(id)
          : cached.svg.replace(/^<svg\s+id="[^"]*"/, `<svg id="${id}"`);
        return typeof cached.raw === 'string'
          ? currentIdSvg
          : { ...cached.raw, svg: currentIdSvg };
      }

      const directionMatch = text.match(/^\s*(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/m);
      const direction = directionMatch?.[1] as Direction | undefined;

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
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif',
        themeVariables: {
          darkMode: dark,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif',
          background: dark ? palette.background : '#ffffff',
          primaryColor: palette.surface,
          primaryTextColor: palette.text,
          primaryBorderColor: palette.border,
          lineColor: palette.line,
          edgeLabelBackground: palette.label,
          clusterBkg: palette.clusterBkg ?? (dark ? '#1d2838' : '#f1f5f9'),
          clusterBorder: palette.clusterBorder ?? palette.border,
          fontSize: '14px',

          // Sequence diagrams
          actorBkg: palette.surface,
          actorBorder: palette.border,
          actorTextColor: palette.text,
          actorLineColor: palette.line,
          signalColor: palette.line,
          signalTextColor: palette.text,
          labelBoxBkgColor: palette.label,
          labelBoxBorderColor: palette.border,
          labelTextColor: palette.text,
          loopTextColor: palette.text,
          noteBkgColor: palette.clusterBkg ?? (dark ? '#1d2838' : '#f1f5f9'),
          noteBorderColor: palette.border,
          noteTextColor: palette.text,
          activationBkgColor: palette.accent,

          // Class diagrams
          classText: palette.text,
          classTitle: palette.text,
          classBorder: palette.border,
          classBkg: palette.surface,

          // State diagrams
          stateBkg: palette.surface,
          stateBorder: palette.border,
          labelColor: palette.text,
          altBackground: palette.clusterBkg ?? (dark ? '#1d2838' : '#f1f5f9'),
          transitionColor: palette.line,
          transitionLabelColor: palette.text,

          // Entity Relationship diagrams
          entityBkg: palette.surface,
          entityBorder: palette.border,
          entityTextColor: palette.text,
          relationshipColor: palette.line,
          relationshipLineColor: palette.line,
          attributeBackgroundColorOdd: palette.surface,
          attributeBackgroundColorEven: palette.clusterBkg ?? (dark ? '#1d2838' : '#f1f5f9'),

          // Gantt charts
          taskBkgColor: palette.surface,
          taskBorderColor: palette.border,
          taskTextColor: palette.text,
          taskTextLightColor: palette.text,
          activeTaskBkgColor: palette.accent,
          activeTaskBorderColor: palette.accent,
          doneTaskBkgColor: palette.clusterBkg ?? (dark ? '#1d2838' : '#f1f5f9'),
          doneTaskBorderColor: palette.border,
          gridColor: palette.border,
          sectionBkgColor: palette.clusterBkg ?? (dark ? '#1d2838' : '#f1f5f9'),
          sectionBkgColor2: palette.background,
          todayLineColor: palette.accent,

          // Pie charts
          ...(palette.fills.length >= 6 ? {
            pie1: palette.fills[0],
            pie2: palette.fills[1],
            pie3: palette.fills[2],
            pie4: palette.fills[3],
            pie5: palette.fills[4],
            pie6: palette.fills[5],
          } : {}),
          pieTitleTextColor: palette.text,
          pieSectionTextColor: palette.text,
          pieLegendTextColor: palette.text,
          pieStrokeColor: palette.border,

          // Git graphs
          ...(palette.fills.length >= 6 ? {
            git0: palette.fills[0],
            git1: palette.fills[1],
            git2: palette.fills[2],
            git3: palette.fills[3],
            git4: palette.fills[4],
            git5: palette.fills[5],
          } : {}),
          gitCommitLabelColor: palette.text,
          gitBranchLabel0: palette.text,
          tagLabelBackground: palette.label,
          tagLabelBorder: palette.border,

          // Timelines (12-slot color wheel with WCAG AA verified label and text contrast)
          ...(palette.fills.length >= 6 ? {
            cScale0: palette.fills[0],
            cScale1: palette.fills[1],
            cScale2: palette.fills[2],
            cScale3: palette.fills[3],
            cScale4: palette.fills[4],
            cScale5: palette.fills[5],
            cScale6: palette.fills[0],
            cScale7: palette.fills[1],
            cScale8: palette.fills[2],
            cScale9: palette.fills[3],
            cScale10: palette.fills[4],
            cScale11: palette.fills[5],
            cScaleLabel0: palette.textOnFills[0] ?? palette.text,
            cScaleLabel1: palette.textOnFills[1] ?? palette.text,
            cScaleLabel2: palette.textOnFills[2] ?? palette.text,
            cScaleLabel3: palette.textOnFills[3] ?? palette.text,
            cScaleLabel4: palette.textOnFills[4] ?? palette.text,
            cScaleLabel5: palette.textOnFills[5] ?? palette.text,
            cScaleLabel6: palette.textOnFills[0] ?? palette.text,
            cScaleLabel7: palette.textOnFills[1] ?? palette.text,
            cScaleLabel8: palette.textOnFills[2] ?? palette.text,
            cScaleLabel9: palette.textOnFills[3] ?? palette.text,
            cScaleLabel10: palette.textOnFills[4] ?? palette.text,
            cScaleLabel11: palette.textOnFills[5] ?? palette.text,
            cScaleColor0: palette.textOnFills[0] ?? palette.text,
            cScaleColor1: palette.textOnFills[1] ?? palette.text,
            cScaleColor2: palette.textOnFills[2] ?? palette.text,
            cScaleColor3: palette.textOnFills[3] ?? palette.text,
            cScaleColor4: palette.textOnFills[4] ?? palette.text,
            cScaleColor5: palette.textOnFills[5] ?? palette.text,
            cScaleColor6: palette.textOnFills[0] ?? palette.text,
            cScaleColor7: palette.textOnFills[1] ?? palette.text,
            cScaleColor8: palette.textOnFills[2] ?? palette.text,
            cScaleColor9: palette.textOnFills[3] ?? palette.text,
            cScaleColor10: palette.textOnFills[4] ?? palette.text,
            cScaleColor11: palette.textOnFills[5] ?? palette.text,
          } : {
            cScaleLabel0: palette.text,
            cScaleColor0: palette.text,
          }),
          timelineTitleColor: palette.text,
          timelineSectionTitleColor: palette.text,
          timelineBorderColor: palette.border,
          timelineLineColor: palette.line,

          // C4 Architecture diagrams
          c4ShapeColor: palette.surface,
          c4ShapeBorderColor: palette.border,
          c4BoundaryColor: palette.border,
          c4BoundaryBorderColor: palette.border,
          personBkgColor: palette.surface,
          personBorderColor: palette.border,
          personTextColor: palette.text,
          systemBkgColor: palette.surface,
          systemBorderColor: palette.border,
          systemTextColor: palette.text,
          systemExtBkgColor: palette.clusterBkg ?? (dark ? '#1d2838' : '#f1f5f9'),
          systemExtBorderColor: palette.border,
          systemExtTextColor: palette.text,
          relationshipTextColor: palette.text,
          relColor: palette.line,
          relTextColor: palette.text,

          // User Journeys
          ...(palette.fills.length >= 6 ? {
            fillType0: palette.fills[0],
            fillType1: palette.fills[1],
            fillType2: palette.fills[2],
            fillType3: palette.fills[3],
            fillType4: palette.fills[4],
            fillType5: palette.fills[5],
          } : {}),
          section0: palette.surface,
          section1: palette.clusterBkg ?? (dark ? '#1d2838' : '#f1f5f9'),

          // Requirement diagrams
          reqTitleColor: palette.text,
          reqLabelColor: palette.text,
          reqBoxColor: palette.surface,
          reqBorderColor: palette.border,
        },
        flowchart: {
          curve: 'basis',
          nodeSpacing: computeDiagramSpacing(text, direction ?? 'TD').nodeSpacing,
          rankSpacing: computeDiagramSpacing(text, direction ?? 'TD').rankSpacing,
          padding: 16,
          diagramPadding: 20,
          subGraphTitleMargin: { top: 12, bottom: 16 },
          wrappingWidth: 240,
          useMaxWidth: false,
          htmlLabels: true,
        },
        sequence: {
          mirrorActors: false,
          useMaxWidth: false,
        },
        gantt: {
          useMaxWidth: false,
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
        const finalResult = typeof result === 'string' ? enhancedSvg : { ...result, svg: enhancedSvg };

        // Save in-memory cache to guarantee 0ms instant reload
        if (cache.size >= maxCache) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey) cache.delete(oldestKey);
        }
        cache.set(cacheKey, { svg: enhancedSvg, raw: result });

        return finalResult;
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
    this.renderCache.clear();
    this.app.workspace.trigger('post-processor-change');
  }

  async saveSettings(): Promise<void> {
    this.renderCache.clear();
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
    this.renderCache.clear();
    this.svgClipboard.clear();
    this.fileExport.dispose();
    this.refreshDiagrams();
  }
}
