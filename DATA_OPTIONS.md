# Mermaid Genie — data.json Configuration Guide

This guide documents all configuration keys available in `data.json` for **Mermaid Genie** (`mermaid-genie`).

You can edit `data.json` directly with any text editor without using the Obsidian UI. Changes take effect as soon as Obsidian reloads (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>R</kbd> or run the command *"Reload app without saving"*).

---

## File Location

```text
<your-vault>/.obsidian/plugins/mermaid-genie/data.json
```

---

## Complete data.json Template (Default Settings)

```json
{
  "colorStyle": "multi",
  "multiPalette": "clear",
  "singlePalette": "slate",
  "compactLayout": true,
  "pathHighlight": true,
  "animationDuration": 450,
  "hoverDelay": 180,
  "nodeRadius": 6,
  "exportControls": true,
  "exportFolder": ""
}
```

---

## Configuration Reference

| Option | Type | Allowed Values | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `colorStyle` | `string` | `"multi"`, `"single"`, `"custom"` | `"multi"` | **Coloring strategy.** `"multi"` colors branches and subgraphs with coordinated palettes; `"single"` applies a uniform accent color; `"custom"` overrides specific theme hex colors. |
| `multiPalette` | `string` | `"clear"`, `"cool"`, `"natural"`, `"warm"`, `"neon"`, `"pastel"` | `"clear"` | Active multi-color palette (used when `colorStyle` is `"multi"`). See palette details below. |
| `singlePalette` | `string` | `"slate"`, `"blue"`, `"emerald"`, `"violet"`, `"amber"`, `"rose"` | `"slate"` | Active single-color preset (used when `colorStyle` is `"single"`). See preset details below. |
| `compactLayout` | `boolean` | `true`, `false` | `true` | **Compact layout engine.** Aligns branches leaving decision diamonds, compacts excess diamond head-room, and rounds orthogonal connectors. |
| `pathHighlight` | `boolean` | `true`, `false` | `true` | **Interactive ancestor path tracing.** Hovering over any node or link illuminates the entire upstream path leading into it while gently dimming other elements. |
| `animationDuration` | `number` | `0` to `2000` | `450` | Transition duration in milliseconds for hover states, path lighting, and focus glow. |
| `hoverDelay` | `number` | `0` to `1000` | `180` | Delay in milliseconds before unhighlighting after the mouse cursor leaves a node. |
| `nodeRadius` | `number` | `0` to `24` | `6` | Corner rounding radius in pixels for flowchart cards and block diagram rectangles. `0` = sharp corners, `6` = modern rounded, `12` = pill-like. |
| `exportControls` | `boolean` | `true`, `false` | `true` | Displays floating export action buttons (copy/export SVG/PNG) directly on diagrams. |
| `exportFolder` | `string` | Relative path, e.g. `""`, `"Attachments"`, `"Diagrams/Exports"` | `""` | Vault subfolder where exported SVG and PNG files are saved. Empty string `""` saves to vault root or default attachments folder. |
| `customColors` | `object` | JSON object with `light` and `dark` hex overrides | *(undefined)* | *(Optional)* Custom hex color overrides for surface, border, text, and accent colors. |

---

## Palette Details

### Multi-Color Palettes (for `"colorStyle": "multi"`)

* **`"clear"`** *(Default)*: Fresh and balanced modern palette (Blue, Teal, Amber, Violet, Cyan, Rose).
* **`"cool"`**: High-tech focused palette (Indigo, Cyan, Violet, Sky, Ocean, Slate).
* **`"natural"`**: Warm organic tones (Sage Green, Ochre, Terracotta, Olive, Stone, Clay).
* **`"warm"`**: High-energy presentation tones (Coral, Tangerine, Gold, Crimson, Amber).
* **`"neon"`**: Vibrant cyberpunk tones (Electric Violet, Acid Green, Hot Pink, Cyan, Bright Gold).
* **`"pastel"`**: Soft muted tones (Lavender, Mint, Peach, Periwinkle, Buttercup, Lilac).

### Single-Hue Presets (for `"colorStyle": "single"`)

* **`"slate"`** *(Default)*: Clean neutral slate gray with subtle blue undertones.
* **`"blue"`**: Modern classic blue accent.
* **`"emerald"`**: Refreshing emerald green accent.
* **`"violet"`**: Deep royal violet purple accent.
* **`"amber"`**: Warm golden amber accent.
* **`"rose"`**: Elegant rose / crimson accent.

---

## Quick Example Configurations

### 1. High-Tech Cool Theme (Indigo / Cyan / Slate)

```json
{
  "colorStyle": "multi",
  "multiPalette": "cool",
  "compactLayout": true,
  "pathHighlight": true,
  "animationDuration": 400,
  "hoverDelay": 180,
  "nodeRadius": 8,
  "exportControls": true,
  "exportFolder": "Attachments"
}
```

---

### 2. Earthy / Nature Harmony Theme (Sage / Terracotta)

```json
{
  "colorStyle": "multi",
  "multiPalette": "natural",
  "compactLayout": true,
  "pathHighlight": true,
  "animationDuration": 450,
  "hoverDelay": 180,
  "nodeRadius": 10,
  "exportControls": true,
  "exportFolder": ""
}
```

---

### 3. Minimalist Classic Blue Accent (Single-Hue)

```json
{
  "colorStyle": "single",
  "singlePalette": "blue",
  "compactLayout": true,
  "pathHighlight": true,
  "animationDuration": 450,
  "hoverDelay": 180,
  "nodeRadius": 6,
  "exportControls": true,
  "exportFolder": ""
}
```

---

### 4. Custom Hex Overrides

```json
{
  "colorStyle": "custom",
  "compactLayout": true,
  "pathHighlight": true,
  "animationDuration": 450,
  "hoverDelay": 180,
  "nodeRadius": 6,
  "exportControls": true,
  "customColors": {
    "light": {
      "surface": "#ffffff",
      "border": "#cbd5e1",
      "text": "#0f172a",
      "accent": "#2563eb"
    },
    "dark": {
      "surface": "#1e293b",
      "border": "#334155",
      "text": "#f8fafc",
      "accent": "#38bdf8"
    }
  }
}
```

---

## How to Apply Changes

1. Open `<your-vault>/.obsidian/plugins/mermaid-genie/data.json` in your editor.
2. Edit the desired fields and save the file.
3. In Obsidian, press <kbd>Ctrl</kbd> + <kbd>R</kbd> (or <kbd>Cmd</kbd> + <kbd>R</kbd> on Mac).
4. The plugin will immediately load and apply your updated settings across all diagrams.
