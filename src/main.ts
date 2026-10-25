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
import { DiagramExportControls, DiagramPickerModal, decorateMermaidBlock, exportDiagram } from './export-controls';
import { createPathController } from './highlight';
import { computeDiagramSpacing, styleSvg, widenSingleRectangles, wrapDecisions, type Direction } from './layout';
import { DEFAULT_SETTINGS, GenieSettingsTab, normalizeSettings, type GenieSettings } from './settings';
import { renderWithPele } from './pele-engine';
import { SvgClipboard } from './svg-clipboard';
import { adaptDiagramSource } from './transpiler';
import { teardownInlineZoom } from './zoom-fullscreen';

type MermaidRender = (this: unknown, id: string, source: unknown, ...args: unknown[]) => Promise<string | RenderResult>;
interface MermaidRuntime {
  render: MermaidRender;
}

export default class MermaidGeniePlugin extends Plugin {
  private stopped = false;
  settings: GenieSettings = { ...DEFAULT_SETTINGS };
  private svgClipboard = new SvgClipboard(this.app);
  private renderCache = new Map<string, { svg: string; raw: string | RenderResult }>();
  private maxCacheSize = 10000;
  private fileExport = new DiagramFileExport(
    this.app,
    () => this.settings.exportFolder,
    async folder => {
      this.settings.exportFolder = folder;
      await this.saveSettings();
    }
  );
  private mutationObserver?: MutationObserver;
  private pendingMutationNodes: Set<HTMLElement> = new Set();
  private mutationRaf: number | null = null;

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

    // Live Preview & dynamic DOM mutation observer
    this.setupMutationObserver();

    // Workspace sweep on initial layout ready and navigation
    this.app.workspace.onLayoutReady(() => {
      this.scheduleDecorateAll();
    });

    this.registerEvent(this.app.workspace.on('layout-change', () => {
      this.scheduleDecorateAll();
    }));

    this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
      this.scheduleDecorateAll();
    }));

    this.registerEvent(this.app.workspace.on('file-open', async file => {
      this.scheduleDecorateAll();
      if (!file || file.extension !== 'md') return;
      try {
        const content = await this.app.vault.cachedRead(file);
        void this.prewarmDiagramsInText(content);
      } catch (err) {
        console.debug('Mermaid Genie prewarm error:', err);
      }
    }));

    // Markdown post-processor for reading view & embeds
    this.registerMarkdownPostProcessor((element, context) => {
      if (this.stopped || !this.settings.exportControls) return;
      this.decorateMermaidBlocksIn(element, context.sourcePath);
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

      const header = text.match(/^\s*---\s*\n[\s\S]*?\n---\s*\n/);
      const prefix = header ? header[0] : '';
      const body = text.slice(prefix.length);

      // Resilient adapter: gracefully transpiles unsupported modern/extended syntaxes
      // (ZenUML, UseCase-beta, TreeView-beta, AgentFlow-beta) to standard Mermaid
      const adapted = adaptDiagramSource(body);
      if (adapted.transpiled) {
        text = prefix + adapted.code;
      }

      const currentSettings = getSettings();
      const dark = document.body.classList.contains('theme-dark');

      // Check in-memory render cache for immediate zero-latency load
      const cacheKey = `${currentSettings.renderEngine}|${dark ? '1' : '0'}|${currentSettings.colorStyle}|${currentSettings.multiPalette}|${currentSettings.singlePalette}|${text}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        // True LRU: refresh entry order in Map
        cache.delete(cacheKey);
        cache.set(cacheKey, cached);

        const cachedIdMatch = cached.svg.match(/^<svg\s+id="([^"]*)"/);
        const cachedId = cachedIdMatch?.[1];
        const currentIdSvg = cachedId && cachedId !== id
          ? cached.svg.split(cachedId).join(id)
          : cached.svg.replace(/^<svg\s+id="[^"]*"/, `<svg id="${id}"`);

        const cachedResult: RenderResult = {
          ...(typeof cached.raw === 'object' && cached.raw !== null ? cached.raw : {}),
          svg: currentIdSvg,
          bindFunctions: typeof (cached.raw as any)?.bindFunctions === 'function'
            ? (cached.raw as any).bindFunctions
            : () => {},
        };
        (cachedResult as any).toString = () => currentIdSvg;
        return cachedResult;
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

      // Primary Ultra-Fast Engine: Pele (Obsidian's official zero-dependency compiler)
      if (currentSettings.renderEngine === 'pele') {
        try {
          const peleSvg = renderWithPele({
            text,
            id,
            settings: currentSettings,
            palette,
            dark,
          });

          if (peleSvg) {
            const peleResult: RenderResult = {
              svg: peleSvg,
              bindFunctions: () => {},
            };
            (peleResult as any).toString = () => peleSvg;

            if (cache.size >= maxCache) {
              const oldestKey = cache.keys().next().value;
              if (oldestKey) cache.delete(oldestKey);
            }
            cache.set(cacheKey, { svg: peleSvg, raw: peleResult });
            return peleResult;
          }
        } catch (peleErr) {
          console.debug('Mermaid Genie: Pele compile error, falling back to Mermaid.js:', peleErr);
        }
      }

      // Resilient Fallback: Classic Mermaid.js
      // Smart label wrapping on decision diamonds
      if (direction && currentSettings.compactLayout) {
        text = wrapDecisions(text);
      }

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
          taskTextDarkColor: '#0f172a',
          activeTaskTextColor: dark ? '#0f172a' : '#ffffff',
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
          pieSectionTextColor: '#ffffff',
          pieLegendTextColor: palette.text,
          pieStrokeColor: palette.border,

          // Git graphs: luminous, high-visibility branch colors in dark and light modes
          git0: dark ? '#7dd3fc' : '#2563eb',
          git1: dark ? '#6ee7b7' : '#059669',
          git2: dark ? '#fde047' : '#d97706',
          git3: dark ? '#c4b5fd' : '#7c3aed',
          git4: dark ? '#67e8f9' : '#0891b2',
          git5: dark ? '#f472b6' : '#db2777',
          git6: dark ? '#7dd3fc' : '#2563eb',
          git7: dark ? '#6ee7b7' : '#059669',
          gitBranchLabel0: dark ? '#0f172a' : '#ffffff',
          gitBranchLabel1: dark ? '#0f172a' : '#ffffff',
          gitBranchLabel2: dark ? '#0f172a' : '#ffffff',
          gitBranchLabel3: dark ? '#0f172a' : '#ffffff',
          gitBranchLabel4: dark ? '#0f172a' : '#ffffff',
          gitBranchLabel5: dark ? '#0f172a' : '#ffffff',
          gitCommitLabelColor: '#ffffff',
          gitCommitLabelBackground: dark ? '#1e293b' : '#334155',
          tagLabelColor: '#ffffff',
          tagLabelBackground: palette.accent,
          tagLabelBorder: palette.accent,

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

          // Requirement diagrams (SysML)
          requirementBackground: palette.surface,
          requirementBorderColor: palette.border,
          requirementBorderSize: '1.5px',
          requirementTextColor: palette.text,
          relationColor: palette.line,
          relationLabelBackground: palette.label,
          requirementEdgeLabelBackground: palette.label,
          reqTitleColor: palette.text,
          reqLabelColor: palette.text,
          reqBoxColor: palette.surface,
          reqBorderColor: palette.border,
        },
        c4: {
          c4ShapeMargin: 180,
          c4BoundaryMargin: 35,
          diagramMarginX: 50,
          diagramMarginY: 35,
          c4ShapePadding: 24,
          useMaxWidth: false,
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
          leftPadding: 150,
          rightPadding: 75,
          topPadding: 50,
          barHeight: 22,
          barGap: 6,
          useMaxWidth: false,
        },
        block: {
          padding: 24,
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
        const finalResult: RenderResult = {
          ...(typeof result === 'object' && result !== null ? result : {}),
          svg: enhancedSvg,
          bindFunctions: typeof (result as any)?.bindFunctions === 'function'
            ? (result as any).bindFunctions
            : () => {},
        };
        (finalResult as any).toString = () => enhancedSvg;

        // Save in-memory cache to guarantee 0ms instant reload
        if (cache.size >= maxCache) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey) cache.delete(oldestKey);
        }
        cache.set(cacheKey, { svg: enhancedSvg, raw: finalResult });

        return finalResult;
      } catch (error) {
        console.warn('Mermaid Genie: kept original SVG after layout/styling failed', error);
        const fallbackResult: RenderResult = {
          ...(typeof result === 'object' && result !== null ? result : {}),
          svg: typeof result === 'string' ? result : (result?.svg || ''),
          bindFunctions: typeof (result as any)?.bindFunctions === 'function' ? (result as any).bindFunctions : () => {},
        };
        (fallbackResult as any).toString = () => fallbackResult.svg;
        return fallbackResult;
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

    this.addCommand({
      id: 'open-settings',
      name: 'Open settings',
      callback: () => {
        const setting = (this.app as any).setting;
        if (setting) {
          setting.open?.();
          setting.openTabById?.(this.manifest.id);
        }
      },
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
          const diagrams = Array.from(view?.containerEl.querySelectorAll<SVGSVGElement>('.mermaid > svg') ?? []);
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

  private scheduleDecorateAll(): void {
    if (this.stopped || !this.settings.exportControls) return;
    if (this.mutationRaf !== null) return;
    this.mutationRaf = requestAnimationFrame(() => {
      this.mutationRaf = null;
      this.decorateAllMermaidBlocks();
    });
  }

  decorateAllMermaidBlocks(): void {
    if (this.stopped || !this.settings.exportControls) return;
    const blocks = document.querySelectorAll<HTMLElement>('.mermaid');
    for (const block of Array.from(blocks)) {
      decorateMermaidBlock(block, this.app, this.svgClipboard, this.fileExport, () => this.settings.exportControls);
    }
  }

  decorateMermaidBlocksIn(root: HTMLElement, sourcePath = ''): void {
    if (this.stopped || !this.settings.exportControls) return;
    const blocks: HTMLElement[] = [];
    if (root.classList?.contains('mermaid')) {
      blocks.push(root);
    } else {
      for (const block of Array.from(root.querySelectorAll<HTMLElement>('.mermaid'))) {
        blocks.push(block);
      }
      const host = root.closest?.('.mermaid') as HTMLElement | null;
      if (host && !blocks.includes(host)) blocks.push(host);
    }
    for (const block of blocks) {
      decorateMermaidBlock(block, this.app, this.svgClipboard, this.fileExport, () => this.settings.exportControls, sourcePath);
    }
  }

  private async prewarmDiagramsInText(text: string): Promise<void> {
    const mermaidRegex = /```(?:mermaid)\r?\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    const sources: string[] = [];
    while ((match = mermaidRegex.exec(text)) !== null) {
      const code = match[1]?.trim();
      if (code && !/^\s*%%\s*(?:mg|mfe):off\s*$/m.test(code)) {
        sources.push(code);
      }
    }
    if (!sources.length) return;

    const mermaid = (await loadMermaid()) as MermaidRuntime;
    if (this.stopped || !mermaid?.render) return;

    for (let i = 0; i < sources.length; i++) {
      if (this.stopped) break;
      const source = sources[i];
      const tempId = `mermaid-prewarm-${Date.now()}-${i}`;
      try {
        await mermaid.render(tempId, source);
      } catch {
        // Silently ignore during background prewarm
      }
      // Yield to main thread so UI remains buttery smooth
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }

  private setupMutationObserver(): void {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

    this.mutationObserver = new MutationObserver(mutations => {
      let hasRelevant = false;
      for (const mutation of Array.from(mutations)) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLElement) {
            // Fast skip common CodeMirror virtualized lines and gutter elements during note scrolling
            if (node.classList?.contains('cm-line') || node.classList?.contains('cm-gutterElement') || node.classList?.contains('cm-cursor')) {
              continue;
            }

            // Ignore any mutations occurring inside our own actions or modal
            if (node.classList?.contains('mermaid-genie-actions') || node.classList?.contains('mermaid-genie-fullscreen-modal')) {
              continue;
            }

            if (node.classList?.contains('mermaid')) {
              if (node.dataset.mgReady !== 'true') {
                this.pendingMutationNodes.add(node);
                hasRelevant = true;
              }
            } else if (node.tagName?.toLowerCase() === 'svg' && node.parentElement?.classList?.contains('mermaid')) {
              if (node.parentElement.dataset.mgReady !== 'true') {
                this.pendingMutationNodes.add(node.parentElement);
                hasRelevant = true;
              }
            } else if (node.classList?.contains('cm-embed-block') || node.classList?.contains('cm-preview-code-block')) {
              const m = node.querySelector<HTMLElement>('.mermaid:not([data-mg-ready="true"])');
              if (m) {
                this.pendingMutationNodes.add(m);
                hasRelevant = true;
              }
            }
          }
        }
      }

      if (hasRelevant && this.mutationRaf === null) {
        this.mutationRaf = requestAnimationFrame(() => {
          this.mutationRaf = null;
          const nodes = Array.from(this.pendingMutationNodes);
          this.pendingMutationNodes.clear();
          for (const node of nodes) {
            if (node.isConnected && node.dataset.mgReady !== 'true') {
              decorateMermaidBlock(node, this.app, this.svgClipboard, this.fileExport, () => this.settings.exportControls);
            }
          }
        });
      }
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  refreshDiagrams(): void {
    this.app.workspace.trigger('post-processor-change');
    this.scheduleDecorateAll();
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

    this.scheduleDecorateAll();
  }

  onunload(): void {
    this.stopped = true;
    if (this.mutationRaf !== null) {
      cancelAnimationFrame(this.mutationRaf);
      this.mutationRaf = null;
    }
    this.mutationObserver?.disconnect();
    this.pendingMutationNodes.clear();

    const containers = document.querySelectorAll<HTMLElement>('.mermaid-genie-container, .mermaid');
    for (const block of Array.from(containers)) {
      teardownInlineZoom(block);
      block.classList.remove('mermaid-genie-container', 'mermaid-genie-scaled', 'mermaid-genie-dragging');
      delete block.dataset.mgScale;
      delete block.dataset.mgReady;
      for (const action of Array.from(block.querySelectorAll('.mermaid-genie-actions'))) {
        action.remove();
      }
    }

    this.renderCache.clear();
    this.svgClipboard.clear();
    this.fileExport.dispose();
    this.refreshDiagrams();
  }
}
