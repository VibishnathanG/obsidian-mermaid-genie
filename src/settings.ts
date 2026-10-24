import { App, PluginSettingTab, Setting, type Plugin } from 'obsidian';
import type { ColorStyle, MulticolorPaletteName, SinglePaletteName, ThemeColors } from './colors';

export type RenderEngine = 'pele' | 'mermaid';

export interface GenieSettings {
  renderEngine: RenderEngine;
  compactLayout: boolean;
  pathHighlight: boolean;
  animationDuration: number;
  hoverDelay: number;
  nodeRadius: number;

  colorStyle: ColorStyle;
  multiPalette: MulticolorPaletteName;
  singlePalette: SinglePaletteName;
  customColors?: {
    light?: Partial<ThemeColors>;
    dark?: Partial<ThemeColors>;
  };

  exportControls: boolean;
  exportFolder?: string;
}

export interface SettingsOwner extends Plugin {
  settings: GenieSettings;
  saveSettings(): Promise<void>;
  refreshDiagrams(): void;
}

export const DEFAULT_SETTINGS: Readonly<GenieSettings> = Object.freeze({
  renderEngine: 'pele',
  compactLayout: true,
  pathHighlight: true,
  animationDuration: 450,
  hoverDelay: 180,
  nodeRadius: 6,

  colorStyle: 'multi',
  multiPalette: 'clear',
  singlePalette: 'slate',

  exportControls: true,
  exportFolder: '',
});

export function normalizeSettings(value: unknown = {}): GenieSettings {
  const input: Record<string, unknown> = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  const finite = (key: 'animationDuration' | 'hoverDelay' | 'nodeRadius', min: number, max: number, fallback: number): number => {
    const candidate = input[key];
    return typeof candidate === 'number' && Number.isFinite(candidate)
      ? Math.min(max, Math.max(min, Math.round(candidate)))
      : fallback;
  };

  const engineCandidate = input.renderEngine;
  const renderEngine: RenderEngine = (engineCandidate === 'pele' || engineCandidate === 'mermaid')
    ? engineCandidate
    : DEFAULT_SETTINGS.renderEngine;

  const styleCandidate = input.colorStyle;
  const colorStyle: ColorStyle = (styleCandidate === 'multi' || styleCandidate === 'single' || styleCandidate === 'custom')
    ? styleCandidate
    : DEFAULT_SETTINGS.colorStyle;

  const multiCandidate = input.multiPalette;
  const multiPalette: MulticolorPaletteName = (multiCandidate === 'clear' || multiCandidate === 'cool' || multiCandidate === 'natural')
    ? multiCandidate
    : DEFAULT_SETTINGS.multiPalette;

  const singleCandidate = input.singlePalette;
  const singlePalette: SinglePaletteName = (singleCandidate === 'slate' || singleCandidate === 'mint' || singleCandidate === 'sky' || singleCandidate === 'rose')
    ? singleCandidate
    : DEFAULT_SETTINGS.singlePalette;

  const result: GenieSettings = {
    renderEngine,
    compactLayout: typeof input.compactLayout === 'boolean' ? input.compactLayout : DEFAULT_SETTINGS.compactLayout,
    pathHighlight: typeof input.pathHighlight === 'boolean' ? input.pathHighlight : DEFAULT_SETTINGS.pathHighlight,
    animationDuration: finite('animationDuration', 0, 2000, DEFAULT_SETTINGS.animationDuration),
    hoverDelay: finite('hoverDelay', 0, 1000, DEFAULT_SETTINGS.hoverDelay),
    nodeRadius: finite('nodeRadius', 0, 24, DEFAULT_SETTINGS.nodeRadius),

    colorStyle,
    multiPalette,
    singlePalette,

    exportControls: typeof input.exportControls === 'boolean' ? input.exportControls : DEFAULT_SETTINGS.exportControls,
    exportFolder: typeof input.exportFolder === 'string' ? input.exportFolder : DEFAULT_SETTINGS.exportFolder,
  };

  if (typeof input.customColors === 'object' && input.customColors !== null) {
    result.customColors = input.customColors as GenieSettings['customColors'];
  }

  return result;
}

export class GenieSettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: SettingsOwner) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const headerDiv = containerEl.createDiv({ cls: 'mermaid-genie-header-card' });
    headerDiv.style.padding = '12px 16px';
    headerDiv.style.marginBottom = '18px';
    headerDiv.style.border = '1px solid var(--background-modifier-border)';
    headerDiv.style.borderRadius = '8px';
    headerDiv.style.backgroundColor = 'var(--background-secondary)';

    const title = headerDiv.createEl('h3', { text: 'Mermaid Genie' });
    title.style.marginTop = '0';
    title.style.marginBottom = '6px';

    const info = headerDiv.createEl('p', { cls: 'setting-item-description' });
    info.style.margin = '0';
    info.appendText('Developed & maintained by ');
    const authorLink = info.createEl('a', { text: 'Vibish', href: 'https://github.com/VibishnathanG' });
    authorLink.style.color = 'var(--text-accent)';
    info.appendText(' • ');
    const repoLink = info.createEl('a', { text: 'GitHub Repository & Documentation', href: 'https://github.com/VibishnathanG/obsidian-mermaid-genie' });
    repoLink.style.color = 'var(--text-accent)';

    // --- Rendering Engine ---
    containerEl.createEl('h3', { text: 'Rendering Engine' });

    new Setting(containerEl)
      .setName('Mermaid compiler')
      .setDesc('Pele is Obsidian\'s official zero-dependency compiler (up to 500x faster, renders synchronously in <1ms). Mermaid.js is the classic legacy engine.')
      .addDropdown(dropdown => dropdown
        .addOption('pele', 'Pele (Ultra-fast, Recommended)')
        .addOption('mermaid', 'Mermaid.js (Classic)')
        .setValue(this.plugin.settings.renderEngine)
        .onChange(async (value: string) => {
          this.plugin.settings.renderEngine = value as RenderEngine;
          await this.plugin.saveSettings();
          this.plugin.refreshDiagrams();
        }));

    // --- Layout & Architecture ---
    containerEl.createEl('h3', { text: 'Flowchart Layout & Routing' });

    new Setting(containerEl)
      .setName('Compact layout')
      .setDesc('Align branches leaving decisions, shorten connectors, and wrap diamond labels nicely.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.compactLayout)
        .onChange(async value => {
          this.plugin.settings.compactLayout = value;
          await this.plugin.saveSettings();
          this.plugin.refreshDiagrams();
        }));

    new Setting(containerEl)
      .setName('Highlight ancestor paths')
      .setDesc('Highlight incoming forward paths on hover or keyboard focus.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.pathHighlight)
        .onChange(async value => {
          this.plugin.settings.pathHighlight = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Node corner radius (px)')
      .setDesc('Smooth rounded corners for rectangular flowchart blocks.')
      .addSlider(slider => slider
        .setLimits(0, 20, 1)
        .setValue(this.plugin.settings.nodeRadius)
        .setDynamicTooltip()
        .onChange(async value => {
          this.plugin.settings.nodeRadius = value;
          await this.plugin.saveSettings();
          this.plugin.refreshDiagrams();
        }));

    new Setting(containerEl)
      .setName('Animation duration (ms)')
      .setDesc('Transition timing for path highlighting and fades.')
      .addSlider(slider => slider
        .setLimits(0, 2000, 50)
        .setValue(this.plugin.settings.animationDuration)
        .setDynamicTooltip()
        .onChange(async value => {
          this.plugin.settings.animationDuration = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Hover reset delay (ms)')
      .setDesc('Delay before clearing highlighted paths when mouse leaves diagram elements.')
      .addSlider(slider => slider
        .setLimits(0, 1000, 20)
        .setValue(this.plugin.settings.hoverDelay)
        .setDynamicTooltip()
        .onChange(async value => {
          this.plugin.settings.hoverDelay = value;
          await this.plugin.saveSettings();
        }));

    // --- Colors & Formatting ---
    containerEl.createEl('h3', { text: 'Colored Flow Blocks & Theme' });

    new Setting(containerEl)
      .setName('Color style')
      .setDesc('Choose between coordinated multi-colored flow blocks or a uniform preset.')
      .addDropdown(dropdown => dropdown
        .addOption('multi', 'Coordinated Multi-Color (Branches & Subgraphs)')
        .addOption('single', 'Single-Hue Preset (Uniform Accent)')
        .setValue(this.plugin.settings.colorStyle)
        .onChange(async (value: string) => {
          this.plugin.settings.colorStyle = value as ColorStyle;
          await this.plugin.saveSettings();
          this.plugin.refreshDiagrams();
          this.display();
        }));

    if (this.plugin.settings.colorStyle === 'multi') {
      new Setting(containerEl)
        .setName('Multi-color palette')
        .setDesc('Select the coordinated palette used to color flow branches and clusters.')
        .addDropdown(dropdown => dropdown
          .addOption('clear', 'Clear (Fresh & Balanced: Blue, Teal, Amber, Violet)')
          .addOption('cool', 'Cool (Modern High-Tech: Indigo, Cyan, Slate)')
          .addOption('natural', 'Natural (Earthy Harmony: Sage, Ochre, Terracotta)')
          .setValue(this.plugin.settings.multiPalette)
          .onChange(async (value: string) => {
            this.plugin.settings.multiPalette = value as MulticolorPaletteName;
            await this.plugin.saveSettings();
            this.plugin.refreshDiagrams();
          }));
    } else if (this.plugin.settings.colorStyle === 'single') {
      new Setting(containerEl)
        .setName('Single-hue preset')
        .setDesc('Select the uniform theme color for flowchart blocks.')
        .addDropdown(dropdown => dropdown
          .addOption('slate', 'Slate Blue (Professional & Clean)')
          .addOption('mint', 'Fresh Mint (Crisp Green)')
          .addOption('sky', 'Sky Blue (Bright & Vibrant)')
          .addOption('rose', 'Rose Berry (Warm & Sophisticated)')
          .setValue(this.plugin.settings.singlePalette)
          .onChange(async (value: string) => {
            this.plugin.settings.singlePalette = value as SinglePaletteName;
            await this.plugin.saveSettings();
            this.plugin.refreshDiagrams();
          }));
    }

    // --- Diagram Controls & Export ---
    containerEl.createEl('h3', { text: 'Diagram Controls & Export' });

    new Setting(containerEl)
      .setName('Show diagram controls')
      .setDesc('Display floating action buttons (export, zoom, reset, and fullscreen) on rendered Mermaid diagrams.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.exportControls)
        .onChange(async value => {
          this.plugin.settings.exportControls = value;
          await this.plugin.saveSettings();
          this.plugin.refreshDiagrams();
        }));

    new Setting(containerEl)
      .setName('Default export folder')
      .setDesc('Optional path for saved PNG and SVG diagrams. Leave blank to use vault attachment settings.')
      .addText(text => text
        .setPlaceholder('e.g. Attachments/Diagrams')
        .setValue(this.plugin.settings.exportFolder || '')
        .onChange(async value => {
          this.plugin.settings.exportFolder = value.trim();
          await this.plugin.saveSettings();
        }));
  }
}
