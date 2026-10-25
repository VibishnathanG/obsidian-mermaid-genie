# Obsidian Mermaid Genie

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-83%20passed-brightgreen.svg)]()
[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-purple.svg)](https://obsidian.md)
[![Pele Compiler](https://img.shields.io/badge/Compiler-Pele%20Ultra--Fast-blueviolet.svg)]()

**Mermaid Genie** is an advanced, high-performance Obsidian plugin engineered for publication-quality Mermaid diagrams. It combines Obsidian's native **Pele** compiler (<1ms synchronous render time) with a resilient **Mermaid.js** fallback, intelligent layout compaction, branch-aligned connectors, interactive upstream path illumination, harmonious branch color palettes, and distortion-free typography across all 33 Mermaid diagram types.

Developed and maintained by **Vibish** ([@VibishnathanG](https://github.com/VibishnathanG)).

---

## Table-of-Contents

- [Core Capabilities](#Core-Capabilities)
- [Dual Engine Architecture](#Dual-Engine-Architecture)
- [Specialized Diagram Cosmetics](#Specialized-Diagram-Cosmetics)
- [Future Pele Upgrades Guide](#Future-Pele-Upgrades)
- [Installing in Another Obsidian Vault](#Installing-in-Another-Obsidian-Vault)
- [Palettes and Theming](#Palettes-and-Theming)
- [Interactive Controls & Export](#Interactive-Controls-and-Export)
- [Configuration](#Configuration)
- [Development and Testing](#Development-and-Testing)
- [License](#License)

---

## Core-Capabilities

- **Dual-Engine Architecture (Pele + Mermaid.js)**:
  - Primary: Obsidian's official **Pele** compiler (<1ms render latency, synchronous zero-flicker rendering, up to 500x faster).
  - Fallback: Resilient **Mermaid.js v12+** engine with zero-interruption error recovery.
- **Harmonious Multi-Colored Flow Blocks**:
  - Automatically identifies parallel decision branches, subgraphs, and execution paths.
  - Assigns coordinated 6-slot palette tones (`Clear`, `Cool`, `Natural`) or single-hue presets (`Slate`, `Mint`, `Sky`, `Rose`, `Custom`).
- **Interactive Ancestor Path Highlighting**:
  - Hover or keyboard-focus any node or edge to illuminate its full upstream workflow.
  - Non-path elements smoothly dim with hardware-accelerated transitions.
- **Diagram Zoom & Fullscreen Viewer**:
  - Floating zoom controls (+, -, reset) on every diagram block.
  - One-click 4-bracket fullscreen modal with pan and zoom.
- **Export & Clipboard Suite**:
  - One-click copy as clean vector SVG or high-DPI PNG.
  - Direct export to Obsidian vault attachments or local system directories.
- **Extended & Transpiled Diagram Syntaxes**:
  - ZenUML, UseCase-beta, AgentFlow-beta, TreeView-beta, Cynefin-beta, Wardley-beta, and Railroad-beta.
- **WCAG AA Compliance**:
  - Enforces minimum 4.5:1 contrast ratios on all text and labels across both light and dark themes.

---

## Dual-Engine-Architecture

Mermaid Genie features a resilient dual-engine rendering pipeline:

```text
               ┌──────────────────────────────┐
               │    Mermaid Diagram Source    │
               └──────────────┬───────────────┘
                              │
                    Pre-transpile & Sanitize
                              │
               ┌──────────────▼───────────────┐
               │  Pele Compiler (Primary)     │
               │  Synchronous, <1ms render    │
               └──────────────┬───────────────┘
                              │
                Success? ─────┴───── Fallback?
                   │                    │
                  YES                   NO
                   │                    │
        ┌──────────▼──────────┐ ┌───────▼───────────┐
        │  enhancePeleSvg()   │ │ Mermaid.js v12    │
        │  Genie CSS Vars &   │ │ + styleSvg()      │
        │  Multi-color branch │ │ 6-Diagram Tweaks  │
        └──────────┬──────────┘ └───────┬───────────┘
                   │                    │
                   └──────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │ True LRU Cache    │
                    │ 0ms instant reload│
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │ Obsidian DOM View │
                    └───────────────────┘
```

1. **Pele Engine**: Obsidian's official Rust/Wasm-based Mermaid compiler. Runs synchronously with zero layout shift and maps Genie's active theme palette directly to Pele's native `--pele-*` CSS variables.
2. **Mermaid.js Fallback**: Seamlessly handles advanced or extended diagram types with specialized SVG post-processing and auto-sanitization.
3. **In-Memory LRU Cache**: Zero-latency re-renders when navigating back and forth between notes in Obsidian.

---

## Specialized-Diagram-Cosmetics

Mermaid Genie provides dedicated cosmetic post-processing for the following diagram types:

### D11-Requirement-Diagram
- **Auto-Sanitized Verification Methods**: Automatically corrects non-standard verification tokens (e.g. `benchmark` or `automated_test`) to standard SysML tokens (`analysis`, `demonstration`, `inspection`, `test`), eliminating parser crashes.
- **Thematic Containers & Badges**: Enhances requirement boxes with `palette.surface` fills, `palette.border` strokes, and dedicated `<<Element>>` styling.
- **Padded HTML Labels**: Applies internal horizontal padding to ID, Text, Risk, and Verification rows to eliminate border collisions.

### D04-Class-Diagram
- **Member & Method Padding**: Insets class attribute and method labels with 10px left padding, preventing symbols like `+String make` and `+startEngine() void` from touching the left container border.
- **Crisp Dividers & Centered Titles**: Formats class headers and dividers with 6px corner rounding, high-contrast bold titles, and clean divider strokes.

### D06-Entity-Relationship-Diagram
- **Attribute Inset Breathing Room**: Provides 8px horizontal padding on attribute types, names, and keys (`paddingLeft: 8px`), eliminating text collisions against the outer border and vertical dividers.
- **Key Highlighting & Alternating Rows**: Highlights `PK` and `FK` badges in `palette.accent` and styles alternating table rows with `palette.surface` and `palette.clusterBkg`.

### D08-Gantt-Chart
- **Dark Mode Outside Text Contrast**: Eliminates Mermaid's default dark charcoal (`#2c2c2c`) on outside task labels and section headers, enforcing bright, legible typography (`!important`) in dark themes.
- **Thematic Task Bars & Milestones**: Distinguishes active tasks (`palette.accent`) and done tasks (`palette.clusterBkg`), and offsets milestone labels by +14px from milestone diamond markers.

### D22-Kanban
- **Card Text Word-Wrapping**: Replaces Mermaid's hardcoded `white-space: nowrap` with `white-space: normal; word-break: break-word;` and 4px 8px padding, preventing card titles from spilling into adjacent columns.
- **Column Header Clearance**: Enforces 20px clearance between column header titles and top cards, preventing overlap.

### D26-Treemap
- **Coordinated Palette Fills**: Replaces muddy dark boxes with vibrant, coordinated fills from `palette.fills` with 5px corner rounding and crisp borders.
- **Vertical Label/Value Separation**: Automatically offsets leaf values by +16px below leaf category labels when rendered at overlapping vertical positions.

---

## Future-Pele-Upgrades

Pele is Obsidian's official zero-dependency, pure JavaScript/Wasm synchronous compiler. It compiles Mermaid diagrams in `<1ms` without the asynchronous Dagre web-worker overhead of classic Mermaid.js.

Mermaid Genie deeply integrates with Pele by:
- Binding Genie's active theme palette directly to Pele's native CSS variables (`--pele-bg`, `--pele-fg`, `--pele-line`, `--pele-surface`, `--pele-surface-alt`, `--pele-border`, `--pele-accent`, and `--pele-series-1` through `--pele-series-12`).
- Injecting ancestor path tracing metadata (`data-mpe-key`, `data-mpe-from`, `data-mpe-to`) and zoom/export overlay controls.
- Providing specialized cosmetic enhancements for Pele-rendered diagrams (`isPeleFlowchart`, `isPeleClass`, `isPeleEr`, `isPeleGantt`, `isPeleKanban`, `isPeleSeq`, `isPeleState`, `isPeleTreemap`, `isPelePacket`, `isPeleBlock`, `isPeleC4`, `isPeleArch`, `isPeleTimeline`, `isPeleJourney`, `isPeleGit`, `isPeleWardley`, `isPeleCynefin`, and `isPeleMindmap`).
- Ensuring a **zero-disruption fallback**: if Pele encounters an unsupported diagram or syntax error, `renderWithPele()` safely catches the exception and returns `null`, seamlessly triggering Mermaid.js v12+.

When a new version of Pele is released in the future, follow this streamlined upgrade and verification workflow:

### S1-Check-and-Install-New-Version
Check for new releases and install the latest Pele package:
```bash
# Check installed vs latest version
npm outdated pele

# Upgrade to latest
npm install pele@latest
```

### S2-Inspect-Pele-API-and-AST-Changes
Review changes in Pele's API and rendered SVG output:
1. **Render Options Signature** in [`src/pele-engine.ts`](src/pele-engine.ts):
   Verify the `render(text, options)` call signature:
   ```ts
   const result = peleRender(text, {
     fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif',
     fontSize: 14,
     idPrefix: id ? `${id}-` : undefined,
     measurer: {
       width(str: string, size: number) {
         return str.length * (size * 0.65) * 1.25;
       },
     },
   });
   ```
2. **CSS Variable Mapping**:
   Confirm Pele continues to use `--pele-*` custom properties on the root `<svg>` (`--pele-bg`, `--pele-fg`, `--pele-line`, `--pele-surface`, `--pele-series-N`).
3. **Selector Scoping Isolation**:
   When new diagram classes are introduced, ensure selectors in [`styles.css`](styles.css) and [`src/layout.ts`](src/layout.ts) remain properly scoped. For example, ensure GitGraph branch selectors (`.pele-gitGraph .pele-branch text`) remain scoped so they do not unintentionally target mindmap branches (`.pele-mindmap .pele-branch`).
4. **Bundler Configuration**:
   Ensure [`esbuild.config.mts`](esbuild.config.mts) bundles `pele` directly into `main.js` (do **not** mark `pele` as external).

### S3-Run-the-Comprehensive-Test-Suite
Execute the full test suite to verify syntax compatibility, cosmetic accuracy, and fallback resilience:
```bash
# 1. Typecheck TypeScript sources
npm run typecheck

# 2. Verify Pele engine rendering & cosmetics
npx tsx --test tests/pele-engine.test.ts

# 3. Verify all 33 gallery diagrams against Pele
npx tsx --test tests/gallery-verify.test.ts

# 4. Verify cosmetic fixes (Mindmaps, GitGraph, Treemap, Arch, Cynefin, etc.)
npx tsx --test tests/cosmetic-fixes-verification.test.ts

# 5. Run all 83 automated tests across 11 test suites
npm test
```

### S4-Build-and-Verify-in-Obsidian
Build the production bundle and verify the upgrade in live Obsidian notes:
```bash
npm run build
```
1. Open the [Mermaid Syntax Gallery](mermaid-syntax-gallery.md) in Obsidian to inspect all 33 diagram types.
2. In Obsidian **Settings → Mermaid Genie**, verify that toggling between `pele` and `mermaid` render engines operates seamlessly with instantaneous re-rendering.

---

## Installing-in-Another-Obsidian-Vault

Mermaid Genie is fully self-contained. To run the plugin in another vault or on another computer, you only need **three runtime files**:

| File | Purpose | Location in Repository | Reference Note |
| :--- | :--- | :--- | :--- |
| `main.js` | Compiled JavaScript runtime containing Pele & Mermaid.js | `dist/main.js` or `main.js` | |
| `manifest.json` | Obsidian plugin descriptor (`id: "mermaid-genie"`, version, minAppVersion) | `manifest.json` | |
| `styles.css` | Plugin stylesheet for palettes, high-contrast typography, and overlays | `dist/styles.css` or `styles.css` | |

### Method-1-Direct-Copy-to-Another-Vault
This method works on any desktop computer running Obsidian (Windows, macOS, or Linux):

1. **Locate your target Obsidian vault folder** on your file system (e.g., `Documents/MySecondVault/`).
2. **Open the hidden `.obsidian/plugins/` directory**:
   - Inside your vault root, open the `.obsidian` folder, then open `plugins`.
   - *Tip: If `.obsidian` is hidden, press `Ctrl + H` (Linux), `Cmd + Shift + .` (macOS), or check **View → Hidden items** in Windows Explorer.*
3. **Create a plugin folder**:
   - Create a new directory named `mermaid-genie` (or `mermaid-genie-local`).
4. **Copy the runtime files**:
   - Copy `dist/main.js`, `manifest.json`, and `dist/styles.css` into `.obsidian/plugins/mermaid-genie/`.
5. **Enable the plugin in Obsidian**:
   - Open Obsidian and your target vault.
   - Go to **Settings (`Ctrl+,` or `Cmd+,`) → Community plugins**.
   - If **Restricted mode** is on, click **Turn on community plugins**.
   - Under **Installed plugins**, click the **Reload plugins** button (circular refresh icon).
   - Find **Mermaid Genie** in the list and toggle the switch to **ON**.

#### Fast One-Line Terminal Commands

- **Linux / macOS / WSL**:
  ```bash
  TARGET_VAULT="/path/to/YourVault"
  mkdir -p "$TARGET_VAULT/.obsidian/plugins/mermaid-genie"
  cp dist/main.js manifest.json dist/styles.css "$TARGET_VAULT/.obsidian/plugins/mermaid-genie/"
  ```

- **Windows PowerShell**:
  ```powershell
  $VaultPluginDir = "C:\Users\YourUser\Documents\YourVault\.obsidian\plugins\mermaid-genie"
  New-Item -ItemType Directory -Force -Path $VaultPluginDir
  Copy-Item "dist\main.js", "manifest.json", "dist\styles.css" -Destination $VaultPluginDir
  ```

### Method-2-Automated-Multi-Vault-Build-Sync
If you actively work with multiple Obsidian vaults on the same development machine, configure [`esbuild.config.mts`](esbuild.config.mts) to automatically sync builds to all of them at once:

1. Open [`esbuild.config.mts`](esbuild.config.mts).
2. Configure your vault destinations:
   ```ts
   const VAULT_DIRS = [
     "/mnt/c/Users/YourUser/Documents/FirstVault/.obsidian/plugins/mermaid-genie-local",
     "/mnt/c/Users/YourUser/Documents/SecondVault/.obsidian/plugins/mermaid-genie",
   ];
   ```
3. Run the build command:
   ```bash
   npm run build
   ```
   Esbuild compiles the bundle once and automatically copies `main.js`, `manifest.json`, and `styles.css` into every specified vault simultaneously.

### Method-3-Distributable-ZIP-Release
To share Mermaid Genie with teammates or archive releases:

1. Run `npm run build` to compile the latest code.
2. Package the three runtime files:
   ```bash
   zip -j mermaid-genie-v1.0.0.zip dist/main.js manifest.json dist/styles.css
   ```
3. To install from the ZIP on another machine:
   - Extract `mermaid-genie-v1.0.0.zip` into `<VaultFolder>/.obsidian/plugins/mermaid-genie/`.
   - Reload plugins in Obsidian settings and toggle **Mermaid Genie** on.

### Installation-Verification-and-Troubleshooting

| Issue / Symptom | Possible Cause | Solution | Reference Note |
| :--- | :--- | :--- | :--- |
| **Plugin does not appear in Community Plugins list** | Files copied to root `.obsidian/` instead of `.obsidian/plugins/mermaid-genie/` | Verify that `main.js` and `manifest.json` are inside `.obsidian/plugins/mermaid-genie/`. | |
| **"Failed to load plugin" error** | Missing `manifest.json` or corrupted `main.js` | Ensure `manifest.json` is present and was copied alongside `main.js`. | |
| **Diagrams render without colors or overlays** | Missing `styles.css` | Verify `styles.css` was copied into the plugin folder. | |
| **Changes not reflecting after update** | Obsidian cached the previous plugin build | Press `Ctrl + R` / `Cmd + R` inside Obsidian to reload the window, or toggle the plugin off and on. | |

---

## Configuration

All plugin settings can be modified via Obsidian's settings UI or directly edited in `data.json`:

```json
{
  "renderEngine": "pele",
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

For full details on each configuration property, refer to [DATA_OPTIONS.md](DATA_OPTIONS.md).

---

## Development-and-Testing

```bash
# Install dependencies
npm install

# Run the complete automated test suite (83 tests across 11 test suites)
npm test

# Run TypeScript typecheck
npm run typecheck

# Build production bundle and sync to vault
npm run build

# Start watch mode for active development
npm run dev
```

---

## License

MIT License — Copyright (c) 2026 [Vibish](https://github.com/VibishnathanG).
