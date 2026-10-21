export type ColorStyle = 'multi' | 'single' | 'custom';
export type MulticolorPaletteName = 'clear' | 'cool' | 'natural';
export type SinglePaletteName = 'slate' | 'mint' | 'sky' | 'rose';

export interface ThemeColors {
  background: string;
  surface: string;
  label: string;
  text: string;
  border: string;
  line: string;
  accent: string;
  clusterBkg?: string;
  clusterBorder?: string;
}

export interface PaletteData extends ThemeColors {
  fills: string[];
  borders: string[];
  textOnFills: string[];
}

export const LIGHT_SINGLE_PRESETS: Record<SinglePaletteName, ThemeColors> = {
  slate: { background: '#ffffff', surface: '#edf0f5', label: '#f7f8fa', text: '#354158', border: '#7c899c', line: '#5f6f86', accent: '#536783', clusterBkg: '#f3f5f8', clusterBorder: '#a0acbd' },
  mint: { background: '#ffffff', surface: '#ddf3e7', label: '#effaf4', text: '#176b42', border: '#678f76', line: '#527560', accent: '#26845b', clusterBkg: '#eaf6ef', clusterBorder: '#84aba0' },
  sky: { background: '#ffffff', surface: '#e1effc', label: '#f1f7ff', text: '#225c95', border: '#638aab', line: '#4f7393', accent: '#367db9', clusterBkg: '#edf5fd', clusterBorder: '#83a5c2' },
  rose: { background: '#ffffff', surface: '#f8e5ed', label: '#fff4f8', text: '#934360', border: '#a9748b', line: '#885c70', accent: '#aa5375', clusterBkg: '#fcf0f5', clusterBorder: '#c493a8' },
};

export const DARK_SINGLE_PRESETS: Record<SinglePaletteName, ThemeColors> = {
  slate: { background: '#191c22', surface: '#273449', label: '#222936', text: '#edf2fa', border: '#7186a2', line: '#a6b8cf', accent: '#8acbff', clusterBkg: '#1d2838', clusterBorder: '#43566f' },
  mint: { background: '#171c1a', surface: '#203e32', label: '#1b2e26', text: '#d2f3e1', border: '#689e80', line: '#819c8d', accent: '#79cba1', clusterBkg: '#1a2f26', clusterBorder: '#3b5c4d' },
  sky: { background: '#171d24', surface: '#233b53', label: '#1e2c3b', text: '#d7ebff', border: '#719bc2', line: '#8aa4bc', accent: '#86bfee', clusterBkg: '#1d2f44', clusterBorder: '#3d5c7c' },
  rose: { background: '#21191d', surface: '#482d3b', label: '#33222b', text: '#fce3ee', border: '#b9839c', line: '#b395a5', accent: '#e39eba', clusterBkg: '#38232e', clusterBorder: '#6c4357' },
};

export const MULTICOLOR_PALETTES: Record<MulticolorPaletteName, Record<'light' | 'dark', { fills: string[]; borders: string[] }>> = {
  clear: {
    light: {
      fills: ['#d6e7fa', '#cfebe3', '#f5e4ba', '#e8def3', '#d5eaf1', '#f2dce5'],
      borders: ['#4c729d', '#377e6c', '#987026', '#7d619b', '#457e93', '#99617a'],
    },
    dark: {
      fills: ['#243b57', '#1b4037', '#46381e', '#382b50', '#1c3d49', '#482c3c'],
      borders: ['#88add4', '#80bca5', '#d0ae68', '#b8a0d0', '#88b9cc', '#c89bb0'],
    },
  },
  cool: {
    light: {
      fills: ['#dddff8', '#ceebf3', '#eddcf4', '#dce6f5', '#d9e9ed', '#e8e1f1'],
      borders: ['#6565a2', '#387f96', '#90619d', '#56779c', '#507d89', '#7e6a98'],
    },
    dark: {
      fills: ['#30335a', '#193e4e', '#432d50', '#283b53', '#293e46', '#373047'],
      borders: ['#a4a5dc', '#80bbd1', '#c49bd3', '#94b1d3', '#93b9c6', '#b5a6cf'],
    },
  },
  natural: {
    light: {
      fills: ['#dee9d7', '#f1e5c9', '#f3ddcf', '#e8e9ce', '#e4e7d9', '#eedfd5'],
      borders: ['#627e50', '#94762f', '#a46848', '#797d42', '#6c795b', '#906f59'],
    },
    dark: {
      fills: ['#303e2a', '#43391f', '#4b3329', '#393d24', '#343d2e', '#40352e'],
      borders: ['#a6c28c', '#cfb477', '#d5a184', '#bcc189', '#b0bd98', '#c5ad97'],
    },
  },
};

/** Normalizes a hex color string or returns undefined if invalid. */
export function normalizeColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/.test(hex)) return '#' + [...hex.slice(1)].map(char => char + char).join('');
  return undefined;
}

/** Computes relative WCAG luminance of an opaque hex color. */
export function relativeLuminance(hexColor: string): number {
  const hex = normalizeColor(hexColor);
  if (!hex) return 0;
  const channels = [1, 3, 5].map(offset => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

/** Computes WCAG contrast ratio between two hex colors. */
export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first), b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Selects high-contrast readable text color on a background. */
export function textOnFill(background: string, preferred: string, minContrast = 4.5): string {
  if (contrastRatio(background, preferred) >= minContrast) return preferred;
  const blackContrast = contrastRatio(background, '#0f172a');
  const whiteContrast = contrastRatio(background, '#f8fafc');
  return blackContrast >= whiteContrast ? '#0f172a' : '#f8fafc';
}

/** Resolves the complete palette data according to user settings and light/dark mode. */
export function resolvePaletteData(
  style: ColorStyle,
  multiPalette: MulticolorPaletteName,
  singlePalette: SinglePaletteName,
  dark: boolean,
  customColors?: Partial<ThemeColors>
): PaletteData {
  const basePreset = (dark ? DARK_SINGLE_PRESETS : LIGHT_SINGLE_PRESETS)[singlePalette] ?? (dark ? DARK_SINGLE_PRESETS.slate : LIGHT_SINGLE_PRESETS.slate);

  if (style === 'multi') {
    const multi = MULTICOLOR_PALETTES[multiPalette]?.[dark ? 'dark' : 'light'] ?? MULTICOLOR_PALETTES.clear[dark ? 'dark' : 'light'];
    const preferredText = customColors?.text ?? basePreset.text;
    const textOnFills = multi.fills.map(f => textOnFill(f, preferredText));
    return {
      ...basePreset,
      surface: multi.fills[0]!,
      border: multi.borders[0]!,
      fills: multi.fills,
      borders: multi.borders,
      textOnFills,
      ...customColors,
    };
  }

  if (style === 'custom' && customColors) {
    const merged = { ...basePreset, ...customColors };
    const preferredText = merged.text;
    return {
      ...merged,
      fills: [merged.surface],
      borders: [merged.border],
      textOnFills: [textOnFill(merged.surface, preferredText)],
    };
  }

  // Single preset
  const preferredText = customColors?.text ?? basePreset.text;
  return {
    ...basePreset,
    fills: [basePreset.surface],
    borders: [basePreset.border],
    textOnFills: [textOnFill(basePreset.surface, preferredText)],
    ...customColors,
  };
}
