"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MermaidGeniePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/colors.ts
var LIGHT_SINGLE_PRESETS = {
  slate: { background: "#ffffff", surface: "#edf0f5", label: "#f7f8fa", text: "#354158", border: "#7c899c", line: "#5f6f86", accent: "#536783", clusterBkg: "#f3f5f8", clusterBorder: "#a0acbd" },
  mint: { background: "#ffffff", surface: "#ddf3e7", label: "#effaf4", text: "#176b42", border: "#678f76", line: "#527560", accent: "#26845b", clusterBkg: "#eaf6ef", clusterBorder: "#84aba0" },
  sky: { background: "#ffffff", surface: "#e1effc", label: "#f1f7ff", text: "#225c95", border: "#638aab", line: "#4f7393", accent: "#367db9", clusterBkg: "#edf5fd", clusterBorder: "#83a5c2" },
  rose: { background: "#ffffff", surface: "#f8e5ed", label: "#fff4f8", text: "#934360", border: "#a9748b", line: "#885c70", accent: "#aa5375", clusterBkg: "#fcf0f5", clusterBorder: "#c493a8" }
};
var DARK_SINGLE_PRESETS = {
  slate: { background: "#191c22", surface: "#273449", label: "#222936", text: "#edf2fa", border: "#7186a2", line: "#a6b8cf", accent: "#8acbff", clusterBkg: "#1d2838", clusterBorder: "#43566f" },
  mint: { background: "#171c1a", surface: "#203e32", label: "#1b2e26", text: "#d2f3e1", border: "#689e80", line: "#819c8d", accent: "#79cba1", clusterBkg: "#1a2f26", clusterBorder: "#3b5c4d" },
  sky: { background: "#171d24", surface: "#233b53", label: "#1e2c3b", text: "#d7ebff", border: "#719bc2", line: "#8aa4bc", accent: "#86bfee", clusterBkg: "#1d2f44", clusterBorder: "#3d5c7c" },
  rose: { background: "#21191d", surface: "#482d3b", label: "#33222b", text: "#fce3ee", border: "#b9839c", line: "#b395a5", accent: "#e39eba", clusterBkg: "#38232e", clusterBorder: "#6c4357" }
};
var MULTICOLOR_PALETTES = {
  clear: {
    light: {
      fills: ["#d6e7fa", "#cfebe3", "#f5e4ba", "#e8def3", "#d5eaf1", "#f2dce5"],
      borders: ["#4c729d", "#377e6c", "#987026", "#7d619b", "#457e93", "#99617a"]
    },
    dark: {
      fills: ["#243b57", "#1b4037", "#46381e", "#382b50", "#1c3d49", "#482c3c"],
      borders: ["#88add4", "#80bca5", "#d0ae68", "#b8a0d0", "#88b9cc", "#c89bb0"]
    }
  },
  cool: {
    light: {
      fills: ["#dddff8", "#ceebf3", "#eddcf4", "#dce6f5", "#d9e9ed", "#e8e1f1"],
      borders: ["#6565a2", "#387f96", "#90619d", "#56779c", "#507d89", "#7e6a98"]
    },
    dark: {
      fills: ["#30335a", "#193e4e", "#432d50", "#283b53", "#293e46", "#373047"],
      borders: ["#a4a5dc", "#80bbd1", "#c49bd3", "#94b1d3", "#93b9c6", "#b5a6cf"]
    }
  },
  natural: {
    light: {
      fills: ["#dee9d7", "#f1e5c9", "#f3ddcf", "#e8e9ce", "#e4e7d9", "#eedfd5"],
      borders: ["#627e50", "#94762f", "#a46848", "#797d42", "#6c795b", "#906f59"]
    },
    dark: {
      fills: ["#303e2a", "#43391f", "#4b3329", "#393d24", "#343d2e", "#40352e"],
      borders: ["#a6c28c", "#cfb477", "#d5a184", "#bcc189", "#b0bd98", "#c5ad97"]
    }
  }
};
function normalizeColor(value) {
  if (typeof value !== "string") return void 0;
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/.test(hex)) return "#" + [...hex.slice(1)].map((char) => char + char).join("");
  return void 0;
}
function relativeLuminance(hexColor) {
  const hex = normalizeColor(hexColor);
  if (!hex) return 0;
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrastRatio(first, second) {
  const a = relativeLuminance(first), b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function textOnFill(background, preferred, minContrast = 4.5) {
  if (contrastRatio(background, preferred) >= minContrast) return preferred;
  const blackContrast = contrastRatio(background, "#0f172a");
  const whiteContrast = contrastRatio(background, "#f8fafc");
  return blackContrast >= whiteContrast ? "#0f172a" : "#f8fafc";
}
function resolvePaletteData(style, multiPalette, singlePalette, dark, customColors) {
  const basePreset = (dark ? DARK_SINGLE_PRESETS : LIGHT_SINGLE_PRESETS)[singlePalette] ?? (dark ? DARK_SINGLE_PRESETS.slate : LIGHT_SINGLE_PRESETS.slate);
  if (style === "multi") {
    const multi = MULTICOLOR_PALETTES[multiPalette]?.[dark ? "dark" : "light"] ?? MULTICOLOR_PALETTES.clear[dark ? "dark" : "light"];
    return {
      ...basePreset,
      surface: multi.fills[0],
      border: multi.borders[0],
      fills: multi.fills,
      borders: multi.borders,
      ...customColors
    };
  }
  if (style === "custom" && customColors) {
    const merged = { ...basePreset, ...customColors };
    return {
      ...merged,
      fills: [merged.surface],
      borders: [merged.border]
    };
  }
  return {
    ...basePreset,
    fills: [basePreset.surface],
    borders: [basePreset.border],
    ...customColors
  };
}

// src/file-export.ts
var import_obsidian = require("obsidian");

// src/diagram-export.ts
var MAX_SIDE = 4096;
var MAX_PIXELS = 16e6;
function pngSize(width, height) {
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Invalid diagram dimensions.");
  }
  const scale = Math.min(2, MAX_SIDE / width, MAX_SIDE / height, Math.sqrt(MAX_PIXELS / (width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale };
}
var STYLE_PROPERTIES = [
  "color",
  "background-color",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "letter-spacing",
  "line-height",
  "text-anchor",
  "dominant-baseline",
  "text-decoration",
  "white-space",
  "word-break",
  "overflow-wrap",
  "text-align",
  "vertical-align",
  "display",
  "visibility",
  "padding",
  "margin",
  "border",
  "border-radius",
  "box-sizing",
  "width",
  "height",
  "max-width",
  "min-width",
  "marker-start",
  "marker-mid",
  "marker-end",
  "clip-path",
  "mask",
  "vector-effect",
  "transform",
  "transform-origin",
  "transform-box",
  "rx",
  "ry"
];
function diagramImage(svg) {
  const bounds = svg.viewBox.baseVal;
  const width = bounds.width > 0 ? bounds.width : parseFloat(svg.getAttribute("width") || "800") || 800;
  const height = bounds.height > 0 ? bounds.height : parseFloat(svg.getAttribute("height") || "600") || 600;
  pngSize(width, height);
  const view = svg.ownerDocument?.defaultView || window;
  const copy = svg.cloneNode(true);
  const originals = [svg, ...svg.querySelectorAll("*")];
  const copies = [copy, ...copy.querySelectorAll("*")];
  for (let i = 0; i < originals.length; i++) {
    const original = originals[i], target = copies[i];
    if (!target.style) continue;
    const computed = view.getComputedStyle(original);
    target.removeAttribute("style");
    for (const property of STYLE_PROPERTIES) {
      let value = computed.getPropertyValue(property);
      if (!value) continue;
      value = value.replace(/url\(["']?([^"')]+)["']?\)/g, (_match, url) => {
        const fragment = url.indexOf("#");
        if (fragment >= 0 && (url.startsWith("#") || url.slice(0, fragment) === svg.ownerDocument.URL.split("#")[0])) {
          return `url(${url.slice(fragment)})`;
        }
        return `url(${url})`;
      });
      target.style.setProperty(property, value);
    }
  }
  for (const element of copy.querySelectorAll("script, iframe, object, embed, link, meta")) {
    element.remove();
  }
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  copy.style.setProperty("width", `${width}px`);
  copy.style.setProperty("height", `${height}px`);
  for (const property of ["max-width", "max-height", "min-width"]) {
    copy.style.removeProperty(property);
  }
  return { svg: new XMLSerializer().serializeToString(copy), width, height };
}
async function diagramPng(image, canvas) {
  const size = pngSize(image.width, image.height);
  const picture = new Image();
  let timer;
  picture.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(image.svg)}`;
  try {
    await Promise.race([
      picture.decode(),
      new Promise((_resolve, reject) => {
        timer = window.setTimeout(() => reject(new Error("Image decoding timed out.")), 15e3);
      })
    ]);
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image canvas is unavailable.");
    context.drawImage(picture, 0, 0, size.width, size.height);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not encode image.")), "image/png");
    });
  } finally {
    window.clearTimeout(timer);
    picture.src = "";
    canvas.width = 0;
    canvas.height = 0;
  }
}

// src/file-export.ts
var DiagramFileExport = class {
  constructor(app, lastFolder, rememberFolder) {
    this.app = app;
    this.lastFolder = lastFolder;
    this.rememberFolder = rememberFolder;
  }
  stopped = false;
  busy = false;
  async save(image, format, sourcePath) {
    if (this.stopped) return;
    if (this.busy) {
      new import_obsidian.Notice("Please wait for the current export to finish.");
      return;
    }
    this.busy = true;
    try {
      const name = (sourcePath.split("/").pop()?.replace(/\.md$/i, "") || "diagram").replace(/[\\/:*?"<>|]/g, "-");
      const filename = `${name}-diagram.${format}`;
      if (!import_obsidian.Platform.isDesktopApp) {
        const data2 = await this.bytes(image, format);
        if (this.stopped) return;
        const path = await this.app.fileManager.getAvailablePathForAttachment(filename, sourcePath);
        if (this.stopped) return;
        await this.app.vault.createBinary(path, data2);
        new import_obsidian.Notice(`Diagram saved to ${path}`);
        return;
      }
      const electronRequire = window.require;
      if (!electronRequire || !(this.app.vault.adapter instanceof import_obsidian.FileSystemAdapter)) {
        const data2 = await this.bytes(image, format);
        const path = await this.app.fileManager.getAvailablePathForAttachment(filename, sourcePath);
        await this.app.vault.createBinary(path, data2);
        new import_obsidian.Notice(`Diagram saved to ${path}`);
        return;
      }
      const electron = electronRequire("electron");
      const remote = electron.remote;
      const fs = electronRequire("fs/promises");
      const paths = electronRequire("path");
      if (!remote?.dialog?.showSaveDialog) {
        const data2 = await this.bytes(image, format);
        const path = await this.app.fileManager.getAvailablePathForAttachment(filename, sourcePath);
        await this.app.vault.createBinary(path, data2);
        new import_obsidian.Notice(`Diagram saved to ${path}`);
        return;
      }
      let folder = this.lastFolder();
      if (folder && !paths.isAbsolute(folder)) folder = void 0;
      if (!folder) {
        folder = await this.attachmentFolder(sourcePath);
      }
      const result = await remote.dialog.showSaveDialog({
        title: format === "svg" ? "Export diagram as SVG" : "Export diagram as PNG",
        defaultPath: paths.join(folder, filename),
        filters: [{ name: format.toUpperCase(), extensions: [format] }]
      });
      if (result.canceled || !result.filePath) return;
      const data = await this.bytes(image, format);
      await fs.writeFile(result.filePath, Buffer.from(data));
      await this.rememberFolder(paths.dirname(result.filePath));
      new import_obsidian.Notice(`Diagram exported: ${paths.basename(result.filePath)}`);
    } finally {
      this.busy = false;
    }
  }
  async bytes(image, format) {
    if (format === "svg") {
      return new TextEncoder().encode(image.svg).buffer;
    }
    const canvas = document.createElement("canvas");
    const blob = await diagramPng(image, canvas);
    return blob.arrayBuffer();
  }
  async attachmentFolder(sourcePath) {
    const basePath = this.app.vault.adapter.getBasePath();
    try {
      const sample = await this.app.fileManager.getAvailablePathForAttachment("test.png", sourcePath);
      const parts = sample.split("/");
      parts.pop();
      return window.require("path").join(basePath, ...parts);
    } catch {
      return basePath;
    }
  }
  dispose() {
    this.stopped = true;
  }
};

// src/export-controls.ts
var import_obsidian2 = require("obsidian");
async function exportDiagram(svg, action, sourcePath, svgClipboard, files) {
  try {
    const snapshot = diagramImage(svg);
    if (action === "copy-svg") {
      await svgClipboard.copy(snapshot, svg.ownerDocument?.defaultView?.navigator.clipboard);
    } else if (action === "copy") {
      const clipboard = svg.ownerDocument?.defaultView?.navigator.clipboard;
      if (!clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Clipboard is unavailable.");
      }
      const canvas = document.createElement("canvas");
      const blob = await diagramPng(snapshot, canvas);
      await clipboard.write([new ClipboardItem({ "image/png": blob })]);
      new import_obsidian2.Notice("Diagram copied to clipboard as PNG.");
    } else {
      await files.save(snapshot, action, sourcePath);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    new import_obsidian2.Notice(`Export failed: ${message}`);
  }
}
var DiagramPickerModal = class extends import_obsidian2.SuggestModal {
  constructor(app, diagrams, onSelect) {
    super(app);
    this.diagrams = diagrams;
    this.onSelect = onSelect;
    this.setPlaceholder("Select a diagram to export...");
  }
  getSuggestions(query) {
    const lower = query.toLowerCase();
    return this.diagrams.filter((svg) => {
      const text = svg.textContent?.toLowerCase() || "";
      return text.includes(lower);
    });
  }
  renderSuggestion(svg, el) {
    const text = svg.textContent?.trim().slice(0, 80) || "Mermaid Diagram";
    el.createEl("div", { text, cls: "mermaid-genie-picker-item" });
  }
  onChooseSuggestion(item) {
    this.onSelect(item);
  }
};
var DiagramExportControls = class extends import_obsidian2.MarkdownRenderChild {
  constructor(container, sourcePath, svgClipboard, files, isEnabled) {
    super(container);
    this.sourcePath = sourcePath;
    this.svgClipboard = svgClipboard;
    this.files = files;
    this.isEnabled = isEnabled;
  }
  observer;
  controls = /* @__PURE__ */ new Map();
  onload() {
    this.scan();
    this.observer = new MutationObserver(() => this.scan());
    this.observer.observe(this.containerEl, { childList: true, subtree: true });
  }
  scan() {
    if (!this.isEnabled()) return;
    for (const [svg, { host, actions, onScroll }] of this.controls) {
      if (!this.containerEl.contains(svg)) {
        host.removeEventListener("scroll", onScroll);
        actions.remove();
        this.controls.delete(svg);
        if (!host.querySelector("svg.mfe-enhanced")) host.classList.remove("mermaid-genie-container");
      }
    }
    for (const svg of this.containerEl.querySelectorAll("svg.mfe-enhanced")) {
      if (this.controls.has(svg) || !svg.parentElement?.matches(".mermaid")) continue;
      const parent = svg.parentElement;
      if (parent.querySelector(":scope > .mermaid-genie-actions")) continue;
      parent.classList.add("mermaid-genie-container");
      const actions = parent.createDiv({ cls: "mermaid-genie-actions" });
      const onScroll = () => {
        actions.style.setProperty("--mermaid-genie-scroll-offset", `${parent.scrollLeft}px`);
      };
      parent.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      const button = actions.createEl("button", {
        cls: "mermaid-genie-export-btn",
        attr: {
          type: "button",
          "aria-label": "Copy and export diagram",
          title: "Copy and export diagram"
        }
      });
      (0, import_obsidian2.setIcon)(button, "image-down");
      button.addEventListener("pointerdown", (event) => event.stopPropagation());
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const menu = new import_obsidian2.Menu();
        menu.addItem(
          (item) => item.setTitle("Copy as PNG").setIcon("copy").onClick(() => {
            void exportDiagram(svg, "copy", this.sourcePath, this.svgClipboard, this.files);
          })
        );
        menu.addItem(
          (item) => item.setTitle("Copy as SVG").setIcon("copy").onClick(() => {
            void exportDiagram(svg, "copy-svg", this.sourcePath, this.svgClipboard, this.files);
          })
        );
        menu.addSeparator();
        menu.addItem(
          (item) => item.setTitle(import_obsidian2.Platform.isDesktopApp ? "Export as PNG\u2026" : "Save as PNG").setIcon("image-down").onClick(() => {
            void exportDiagram(svg, "png", this.sourcePath, this.svgClipboard, this.files);
          })
        );
        menu.addItem(
          (item) => item.setTitle(import_obsidian2.Platform.isDesktopApp ? "Export as SVG\u2026" : "Save as SVG").setIcon("file-code").onClick(() => {
            void exportDiagram(svg, "svg", this.sourcePath, this.svgClipboard, this.files);
          })
        );
        menu.showAtMouseEvent(event);
      });
      this.controls.set(svg, { host: parent, actions, onScroll });
    }
  }
  onunload() {
    this.observer?.disconnect();
    for (const { host, actions, onScroll } of this.controls.values()) {
      host.removeEventListener("scroll", onScroll);
      host.classList.remove("mermaid-genie-container");
      actions.remove();
    }
    this.controls.clear();
  }
};

// src/highlight.ts
function ancestorPath(edges, target) {
  const nodes = /* @__PURE__ */ new Set([target]), selected = /* @__PURE__ */ new Set(), pending = [target];
  const incoming = /* @__PURE__ */ new Map();
  for (const edge of edges) {
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    incoming.get(edge.to).push(edge);
  }
  while (pending.length) {
    const key = pending.pop();
    for (const edge of incoming.get(key) || []) {
      selected.add(edge.id);
      if (!nodes.has(edge.from)) {
        nodes.add(edge.from);
        pending.push(edge.from);
      }
    }
  }
  return { nodes, edges: selected };
}
function highlightAncestors(element) {
  const svg = element.closest("svg");
  if (!svg) return;
  const paths = [...svg.querySelectorAll("[data-mpe-from][data-mpe-to]")];
  const edges = paths.map((path) => ({
    from: path.getAttribute("data-mpe-from"),
    to: path.getAttribute("data-mpe-to"),
    id: path.getAttribute("data-id") || path.id,
    forward: path.getAttribute("data-mpe-forward") === "true"
  }));
  const key = element.getAttribute("data-mpe-key");
  const id = element.getAttribute("data-id") || element.querySelector("[data-id]")?.getAttribute("data-id") || element.id;
  const edge = key ? null : edges.find((e) => e.id === id);
  if (!key && !edge) return;
  const selected = ancestorPath(edges.filter((e) => e.forward), key || edge.from);
  if (edge) {
    selected.nodes.add(edge.to);
    selected.edges.add(edge.id);
  }
  svg.classList.add("mpe-tracing");
  for (const el of svg.querySelectorAll(".node, .flowchart-link, .edgePath, .edgeLabels > .edgeLabel")) {
    const elKey = el.getAttribute("data-mpe-key");
    const elId = el.getAttribute("data-id") || el.querySelector("[data-id]")?.getAttribute("data-id") || el.id;
    el.classList.toggle("mpe-on-path", elKey ? selected.nodes.has(elKey) : selected.edges.has(elId));
  }
}
function createPathController(doc, getSettings, timers) {
  const target = ".mermaid svg.mfe-enhanced .node, .mermaid svg.mfe-enhanced .flowchart-link, .mermaid svg.mfe-enhanced .edgePath path.path, .mermaid svg.mfe-enhanced .edgeLabels > .edgeLabel";
  const pending = /* @__PURE__ */ new Map();
  let disposed = false;
  const cancel = (svg) => {
    const timer = pending.get(svg);
    if (timer !== void 0) timer.timers.clearTimeout(timer.handle);
    pending.delete(svg);
  };
  const reset = (svg) => {
    svg.classList.remove("mpe-tracing");
    svg.querySelectorAll(".mpe-on-path").forEach((el) => el.classList.remove("mpe-on-path"));
  };
  return {
    enter(event) {
      if (disposed || !getSettings().pathHighlight) return;
      const node = event.target?.closest?.(target);
      if (!node) return;
      const svg = node.closest("svg");
      if (!svg) return;
      cancel(svg);
      highlightAncestors(node);
    },
    leave(event) {
      if (disposed) return;
      const node = event.target?.closest?.(target);
      if (!node || node.contains(event.relatedTarget)) return;
      const svg = node.closest("svg");
      if (!svg) return;
      cancel(svg);
      const ownerWindow = svg.ownerDocument?.defaultView;
      const ownerTimers = timers ?? {
        setTimeout: (callback, delay) => (ownerWindow ?? window).setTimeout(callback, delay),
        clearTimeout: (handle2) => (ownerWindow ?? window).clearTimeout(handle2)
      };
      const handle = ownerTimers.setTimeout(() => {
        pending.delete(svg);
        reset(svg);
      }, getSettings().hoverDelay);
      pending.set(svg, { handle, timers: ownerTimers });
    },
    dispose() {
      disposed = true;
      pending.forEach((timer) => timer.timers.clearTimeout(timer.handle));
      pending.clear();
      doc.querySelectorAll("svg.mfe-enhanced").forEach(reset);
    }
  };
}

// src/flowchart-groups.ts
function flowchartGroups(nodes, edges) {
  const vertices = nodes.filter((node) => !node.isGroup);
  const groups = new Map(nodes.map((node) => [node.id, node.isGroup ? `group:${node.id}` : node.parentId ? `group:${node.parentId}` : `node:${node.id}`]));
  const neighbors = new Map(vertices.filter((node) => !node.parentId).map((node) => [node.id, /* @__PURE__ */ new Set()]));
  const outgoing = new Map([...neighbors.keys()].map((id) => [id, /* @__PURE__ */ new Set()]));
  const solid = edges.filter((edge) => edge.pattern !== "dotted" && edge.pattern !== "invisible");
  for (const edge of solid) {
    if (!neighbors.has(edge.start) || !neighbors.has(edge.end) || edge.start === edge.end) continue;
    neighbors.get(edge.start).add(edge.end);
    neighbors.get(edge.end).add(edge.start);
    outgoing.get(edge.start).add(edge.end);
    if (edge.arrowTypeStart && edge.arrowTypeStart !== "none") outgoing.get(edge.end).add(edge.start);
  }
  const cuts = /* @__PURE__ */ new Map();
  for (const [start, targets] of outgoing) {
    if (targets.size < 2) continue;
    const branches = [];
    for (const end of targets) {
      if (outgoing.get(end).has(start)) continue;
      const seen = /* @__PURE__ */ new Set([end]), queue = [end];
      for (let i = 0; i < queue.length && !seen.has(start); i++) {
        const current = queue[i];
        for (const next of neighbors.get(current) ?? []) {
          if (current === end && next === start) continue;
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      if (!seen.has(start) && seen.size >= 2) branches.push(end);
    }
    if (branches.length >= 2) cuts.set(start, new Set(branches));
  }
  const visited = /* @__PURE__ */ new Set();
  for (const id of [...neighbors.keys()].sort()) {
    if (visited.has(id)) continue;
    const queue = [id];
    visited.add(id);
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      groups.set(current, `node:${id}`);
      for (const next of neighbors.get(current) ?? []) {
        if (visited.has(next) || cuts.get(current)?.has(next) || cuts.get(next)?.has(current)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
  }
  const links = new Map([...new Set(groups.values())].sort().map((group) => [group, /* @__PURE__ */ new Set()]));
  const incoming = /* @__PURE__ */ new Set();
  for (const edge of solid) {
    const from = groups.get(edge.start), to = groups.get(edge.end);
    if (!from || !to || from === to) continue;
    links.get(from)?.add(to);
    incoming.add(to);
  }
  const slots = /* @__PURE__ */ new Map();
  const roots = [...links.keys()].filter((group) => !incoming.has(group));
  for (const root of [...roots, ...links.keys()]) {
    if (slots.has(root)) continue;
    const queue = [root];
    slots.set(root, slots.size);
    for (let i = 0; i < queue.length; i++) {
      for (const next of [...links.get(queue[i]) ?? []].sort()) {
        if (slots.has(next)) continue;
        slots.set(next, slots.size);
        queue.push(next);
      }
    }
  }
  return new Map([...groups].map(([id, group]) => [id, slots.get(group) ?? 0]));
}

// src/flowchart-colors.ts
function flowchartSourceId(nodeId, diagramId = "") {
  let localId = nodeId;
  if (diagramId && localId.startsWith(`${diagramId}-`)) {
    localId = localId.slice(diagramId.length + 1);
  }
  const match = /(?:^|-)flowchart-(.+)-\d+$/.exec(localId);
  return match?.[1] ?? localId;
}
function extractGraphFromSvg(doc) {
  const diagramId = (doc instanceof Document ? doc.documentElement : doc).getAttribute("id") ?? "";
  const nodes = [];
  const edges = [];
  const seenNodes = /* @__PURE__ */ new Set();
  for (const cluster of doc.querySelectorAll("g.cluster")) {
    const rawId = cluster.getAttribute("id") || "";
    const id = flowchartSourceId(rawId, diagramId);
    if (!id || seenNodes.has(id)) continue;
    seenNodes.add(id);
    const parentCluster = cluster.parentElement?.closest("g.cluster");
    const parentId = parentCluster ? flowchartSourceId(parentCluster.getAttribute("id") || "", diagramId) : void 0;
    nodes.push({ id, parentId, isGroup: true });
  }
  for (const node of doc.querySelectorAll("g.node")) {
    const rawId = node.getAttribute("data-mpe-key") || node.getAttribute("id") || "";
    const id = flowchartSourceId(rawId, diagramId);
    if (!id || seenNodes.has(id)) continue;
    seenNodes.add(id);
    const parentCluster = node.closest("g.cluster");
    const parentId = parentCluster ? flowchartSourceId(parentCluster.getAttribute("id") || "", diagramId) : void 0;
    nodes.push({ id, parentId });
  }
  const seenEdges = /* @__PURE__ */ new Set();
  const linkElements = doc.querySelectorAll("path.flowchart-link, .edgePath path.path, g.edgePath");
  for (const el of linkElements) {
    let from = el.getAttribute("data-mpe-from");
    let to = el.getAttribute("data-mpe-to");
    if (!from || !to) {
      const cls = (el.getAttribute("class") || "") + " " + (el.parentElement?.getAttribute("class") || "");
      const startMatch = /\bLS-([^\s]+)\b/.exec(cls);
      const endMatch = /\bLE-([^\s]+)\b/.exec(cls);
      if (startMatch && endMatch) {
        from = flowchartSourceId(startMatch[1], diagramId);
        to = flowchartSourceId(endMatch[1], diagramId);
      }
    }
    if (!from || !to) {
      const idStr = el.getAttribute("id") || el.parentElement?.getAttribute("id") || "";
      const idMatch = /^L[_-](.+?)[_-](.+?)[_-]\d+$/.exec(idStr);
      if (idMatch) {
        from = flowchartSourceId(idMatch[1], diagramId);
        to = flowchartSourceId(idMatch[2], diagramId);
      }
    }
    if (from && to && from !== to) {
      const edgeKey = `${from}->${to}`;
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey);
        const isDotted = el.classList.contains("edge-pattern-dotted") || el.getAttribute("stroke-dasharray") && el.getAttribute("stroke-dasharray") !== "none";
        edges.push({
          start: from,
          end: to,
          pattern: isDotted ? "dotted" : "solid"
        });
      }
    }
  }
  return { nodes, edges };
}
function applyFlowchartColors(root, palette, dark, colorStyle) {
  const diagramId = root.getAttribute("id") ?? "";
  const { nodes, edges } = extractGraphFromSvg(root);
  const groups = colorStyle === "multi" ? flowchartGroups(nodes, edges) : void 0;
  const fills = palette.fills;
  const borders = palette.borders;
  for (const cluster of root.querySelectorAll("g.cluster")) {
    const rawId = cluster.getAttribute("id") || "";
    const id = flowchartSourceId(rawId, diagramId);
    const slot = groups?.get(id) ?? 0;
    const clusterFill = colorStyle === "multi" && fills.length > 0 ? fills[slot % fills.length] : palette.clusterBkg;
    const clusterBorder = colorStyle === "multi" && borders.length > 0 ? borders[slot % borders.length] : palette.clusterBorder;
    const clusterShapes = Array.from(cluster.querySelectorAll(":scope > rect, :scope > path"));
    for (const shape of clusterShapes) {
      if (!shape.style.fill && clusterFill) {
        shape.style.fill = clusterFill;
        shape.style.fillOpacity = dark ? "0.22" : "0.35";
      }
      if (!shape.style.stroke && clusterBorder) {
        shape.style.stroke = clusterBorder;
        shape.style.strokeWidth = "1.2px";
      }
    }
  }
  for (const node of Array.from(root.querySelectorAll("g.node"))) {
    const rawId = node.getAttribute("data-mpe-key") || node.getAttribute("id") || "";
    const id = flowchartSourceId(rawId, diagramId);
    const slot = groups?.get(id) ?? 0;
    const fill = colorStyle === "multi" && fills.length > 0 ? fills[slot % fills.length] : palette.surface;
    const border = colorStyle === "multi" && borders.length > 0 ? borders[slot % borders.length] : palette.border;
    const textColor = textOnFill(fill, palette.text, 4.5);
    node.style.setProperty("--node-fill", fill);
    node.style.setProperty("--node-border", border);
    node.style.setProperty("--node-text", textColor);
    const shapeElements = Array.from(node.querySelectorAll(":scope > .label-container, :scope > rect, :scope > polygon, :scope > circle, :scope > ellipse, :scope > path"));
    const shapes = shapeElements.length > 0 ? shapeElements : Array.from(node.querySelectorAll("rect, polygon, circle, ellipse, path"));
    for (const shape of shapes) {
      if (shape.classList.contains("arrowMarkerPath")) continue;
      if (!shape.style.fill && shape.getAttribute("fill") !== "none") {
        shape.style.fill = fill;
      }
      if (!shape.style.stroke) {
        shape.style.stroke = border;
        shape.style.strokeWidth = "1.25px";
      }
    }
    for (const textEl of Array.from(node.querySelectorAll(".nodeLabel, .label text, text, .nodeLabel p, foreignObject div"))) {
      if (textEl instanceof HTMLElement) {
        textEl.style.color = textColor;
      } else if (textEl instanceof SVGElement) {
        textEl.style.fill = textColor;
      }
    }
  }
}

// src/layout.ts
var edgeIndexes = /* @__PURE__ */ new WeakMap();
function resolveEdge(doc, path) {
  let index = edgeIndexes.get(doc);
  if (!index) {
    index = /* @__PURE__ */ new Map();
    const keys = [...doc.querySelectorAll("g.node")].map((n) => n.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1]).filter((key) => key !== void 0);
    for (const from of keys) {
      for (const to of keys) {
        const prefix = `L_${from}_${to}_`;
        index.set(prefix, index.has(prefix) ? null : [null, from, to]);
        const hyphenPrefix = `L-${from}-${to}-`;
        index.set(hyphenPrefix, index.has(hyphenPrefix) ? null : [null, from, to]);
      }
    }
    edgeIndexes.set(doc, index);
  }
  const dataFrom = path.getAttribute("data-mpe-from") || path.parentElement?.getAttribute("data-mpe-from");
  const dataTo = path.getAttribute("data-mpe-to") || path.parentElement?.getAttribute("data-mpe-to");
  if (dataFrom && dataTo) return [null, dataFrom, dataTo];
  const cls = (path.getAttribute("class") || "") + " " + (path.parentElement?.getAttribute("class") || "");
  const startMatch = /\bLS-([^\s]+)\b/.exec(cls);
  const endMatch = /\bLE-([^\s]+)\b/.exec(cls);
  if (startMatch && endMatch) {
    return [null, startMatch[1], endMatch[1]];
  }
  const id = path.getAttribute("data-id") || path.id || path.parentElement?.id || "";
  const idPrefix = id.replace(/[^_]*$/, "");
  const idMatch = /^L[_-](.+?)[_-](.+?)[_-]/.exec(id);
  if (idMatch) {
    return [null, idMatch[1], idMatch[2]];
  }
  return index.get(idPrefix) || null;
}
function orthogonalPath(points, direction, sourceLimit, targetLimit, branchLevel) {
  const vertical = /^(TD|TB|BT)$/.test(direction);
  const axis = vertical ? 1 : 0;
  const cross = axis === 0 ? 1 : 0;
  const first = points[0], last = points[points.length - 1];
  if (!first || !last) return null;
  const sign = Math.sign(last[axis] - first[axis]);
  if (!sign) return null;
  const a = sourceLimit ?? first[axis], b = targetLimit ?? last[axis];
  if (sign * (b - a) <= 0) return null;
  const level = branchLevel ?? (a + b) / 2;
  const middle = sign * (level - a) > 0 && sign * (b - level) > 0 ? level : (a + b) / 2;
  const p = [...first], q = [...last];
  p[axis] = middle;
  q[axis] = middle;
  const route = Math.abs(first[cross] - last[cross]) < 0.01 ? [first, last] : [first, p, q, last];
  return route.filter((pt, i) => !i || pt.some((v, j) => Math.abs(v - route[i - 1][j]) > 1e-3)).map((pt, i) => `${i ? "L" : "M"}${pt.join(",")}`).join("");
}
function transformOffset(element) {
  const offset = [0, 0];
  for (let el = element; el; el = el.parentNode) {
    const transform = el.nodeType === 1 ? el.getAttribute("transform") || "" : "";
    if (!transform) continue;
    const t = transform.match(/^\s*translate\(\s*([-+\d.eE]+)(?:[,\s]+([-+\d.eE]+))?\s*\)\s*$/);
    if (!t) return void 0;
    offset[0] += Number(t[1]);
    offset[1] += Number(t[2] ?? 0);
  }
  return offset;
}
function polygonHasSideCenter(points, axis, side, centerCross) {
  const min = Math.min(...points.map((point) => point[axis]));
  const max = Math.max(...points.map((point) => point[axis]));
  const boundary = side === "min" ? min : max;
  const close = (a, b) => Math.abs(a - b) < 0.01;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const aa = a[axis], ba = b[axis], ac = a[1 - axis], bc = b[1 - axis];
    if (close(aa, boundary) && close(ba, boundary) && centerCross >= Math.min(ac, bc) - 0.01 && centerCross <= Math.max(ac, bc) + 0.01) return true;
    if (close(aa, boundary) && close(ac, centerCross)) return true;
    if (close(ba, boundary) && close(bc, centerCross)) return true;
  }
  return false;
}
function nodeBounds(doc, key) {
  const node = [...doc.querySelectorAll("g.node")].find((n) => n.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1] === key);
  if (!node) return void 0;
  const shape = node.querySelector("polygon, rect, circle, ellipse");
  if (!shape) return void 0;
  const offset = transformOffset(shape);
  if (!offset) return void 0;
  let x, y;
  if (shape.tagName === "polygon") {
    const source = (shape.getAttribute("points") || "").trim().split(/\s+/).map((point) => point.split(",").map(Number));
    if (source.length > 1 && source[0][0] === source.at(-1)[0] && source[0][1] === source.at(-1)[1]) source.pop();
    if (source.length < 3 || source.some((point) => point.length !== 2 || !point.every(Number.isFinite))) return void 0;
    x = source.map((point) => point[0]);
    y = source.map((point) => point[1]);
    const center = [(Math.min(...x) + Math.max(...x)) / 2, (Math.min(...y) + Math.max(...y)) / 2];
    for (const axis of [0, 1]) {
      if (!polygonHasSideCenter(source, axis, "min", center[1 - axis]) || !polygonHasSideCenter(source, axis, "max", center[1 - axis])) return void 0;
    }
  } else if (shape.tagName === "circle") {
    const values = ["cx", "cy", "r"].map((name) => shape.getAttribute(name));
    if (values.some((value) => value === null)) return void 0;
    const [cx, cy, r] = values.map(Number);
    if (![cx, cy, r].every(Number.isFinite) || r < 0) return void 0;
    x = [cx - r, cx + r];
    y = [cy - r, cy + r];
  } else if (shape.tagName === "ellipse") {
    const values = ["cx", "cy", "rx", "ry"].map((name) => shape.getAttribute(name));
    if (values.some((value) => value === null)) return void 0;
    const [cx, cy, rx, ry] = values.map(Number);
    if (![cx, cy, rx, ry].every(Number.isFinite) || rx < 0 || ry < 0) return void 0;
    x = [cx - rx, cx + rx];
    y = [cy - ry, cy + ry];
  } else {
    const values = ["x", "y", "width", "height"].map((name) => shape.getAttribute(name));
    if (values.some((value) => value === null)) return void 0;
    const [left, top, w, h] = values.map(Number);
    if (![left, top, w, h].every(Number.isFinite) || w < 0 || h < 0) return void 0;
    x = [left, left + w];
    y = [top, top + h];
  }
  const min = [Math.min(...x) + offset[0], Math.min(...y) + offset[1]];
  const max = [Math.max(...x) + offset[0], Math.max(...y) + offset[1]];
  return { node, center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2], min, max };
}
function nodeLimit(doc, key, direction, outgoing) {
  const bounds = nodeBounds(doc, key);
  if (!bounds) return void 0;
  const axis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
  const forward = !/^(BT|RL)$/.test(direction);
  return outgoing === forward ? bounds.max[axis] : bounds.min[axis];
}
function centerAnchor(bounds, direction, travelSign, outgoing) {
  const axis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
  const cross = axis === 0 ? 1 : 0;
  const sideSign = outgoing ? travelSign : -travelSign;
  const anchor = [...bounds.center];
  anchor[axis] = sideSign > 0 ? bounds.max[axis] : bounds.min[axis];
  anchor[cross] = bounds.center[cross];
  return anchor;
}
function returnLanePath(points, direction, from, to, offset = [0, 0]) {
  const vertical = /^(TD|TB|BT)$/.test(direction);
  const cross = vertical ? 0 : 1;
  const first = points[0], last = points[points.length - 1];
  if (!first || !last || !from || !to) return null;
  const values = points.map((point) => point[cross]);
  const high = Math.max(...values), low = Math.min(...values);
  const lane = high > Math.max(first[cross], last[cross]) + 0.01 ? high : low < Math.min(first[cross], last[cross]) - 0.01 ? low : null;
  if (lane === null) return null;
  const outer = lane + offset[cross] > (from.center[cross] + to.center[cross]) / 2 ? "max" : "min";
  const source = [...from.center], target = [...to.center];
  source[cross] = from[outer][cross];
  target[cross] = to[outer][cross];
  const laneRoot = outer === "max" ? Math.max(lane + offset[cross], from.max[cross] + 18, to.max[cross] + 18) : Math.min(lane + offset[cross], from.min[cross] - 18, to.min[cross] - 18);
  const bend1 = [...source], bend2 = [...target];
  bend1[cross] = laneRoot;
  bend2[cross] = laneRoot;
  for (const point of [source, target, bend1, bend2]) {
    point[0] -= offset[0];
    point[1] -= offset[1];
  }
  return [source, bend1, bend2, target].filter((point, i, all) => !i || point.some((v, j) => Math.abs(v - all[i - 1][j]) > 1e-3)).map((point, i) => `${i ? "L" : "M"}${point.join(",")}`).join("");
}
function roundPath(d, radius = 5) {
  const number = "[-+]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][-+]?\\d+)?";
  const segment = new RegExp(`([ML])\\s*(${number})[\\s,]+(${number})`, "g");
  const matches = [...d.matchAll(segment)];
  if (matches.length < 3 || d.replace(segment, "").trim() || matches[0][1] !== "M" || matches.slice(1).some((m) => m[1] !== "L")) return d;
  const points = matches.map((m) => [Number(m[2]), Number(m[3])]).filter((p, i, all) => !i || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]);
  let path = `M${points[0].join(",")}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const u = [a[0] - b[0], a[1] - b[1]], v = [c[0] - b[0], c[1] - b[1]];
    const lu = Math.hypot(u[0], u[1]), lv = Math.hypot(v[0], v[1]);
    const orthogonal = (u[0] === 0 || u[1] === 0) && (v[0] === 0 || v[1] === 0) && u[0] * v[0] + u[1] * v[1] === 0;
    if (!orthogonal || !lu || !lv) {
      path += `L${b.join(",")}`;
      continue;
    }
    const r = Math.min(radius, lu / 2, lv / 2);
    const before = b.map((n, j) => n + u[j] * r / lu);
    const after = b.map((n, j) => n + v[j] * r / lv);
    path += `L${before.join(",")}Q${b.join(",")} ${after.join(",")}`;
  }
  return path + `L${points[points.length - 1].join(",")}`;
}
function routePoints(d) {
  const number = "[-+]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][-+]?\\d+)?";
  const command = new RegExp(`([ML])\\s*(${number})[\\s,]+(${number})|Q\\s*(${number})[\\s,]+(${number})[\\s,]+(${number})[\\s,]+(${number})`, "g");
  const matches = [...d.matchAll(command)];
  if (!matches.length || matches[0][1] !== "M" || d.replace(command, "").trim()) return null;
  if (matches.slice(1).some((m) => m[1] === "M")) return null;
  return matches.flatMap((m) => m[1] ? [[Number(m[2]), Number(m[3])]] : [[Number(m[4]), Number(m[5])], [Number(m[6]), Number(m[7])]]).filter((point, i, all) => !i || point.some((v, axis) => Math.abs(v - all[i - 1][axis]) > 1e-3));
}
function styleSvg(svg, direction, settings, palette, dark) {
  const compactLayout = settings.compactLayout !== false;
  svg = svg.replace(/&nbsp;/g, "\xA0").replace(/<br\s*>/gi, "<br/>");
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror")) return svg;
  const root = doc.documentElement;
  const layoutAxis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
  const layoutSign = /^(BT|RL)$/.test(direction) ? -1 : 1;
  const layoutNodes = [...doc.querySelectorAll("g.node")].map((node) => {
    const key = node.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1];
    const t = (node.getAttribute("transform") || "").match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
    return {
      node,
      key,
      center: t ? [Number(t[1]), Number(t[2])] : null,
      incoming: key ? nodeLimit(doc, key, direction, false) : NaN
    };
  }).filter((n) => !!n.key && !!n.center);
  const layoutByKey = new Map(layoutNodes.map((n) => [n.key, n]));
  const layoutEdges = [...doc.querySelectorAll("path.flowchart-link, .edgePath path.path")].map((path) => {
    const edge = resolveEdge(doc, path);
    if (edge) return { from: layoutByKey.get(edge[1]), to: layoutByKey.get(edge[2]) };
  }).filter((e) => !!e?.from && !!e.to);
  const alignedTargets = /* @__PURE__ */ new Set();
  for (const node of doc.querySelectorAll("g.node")) {
    const key = node.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1];
    if (key) {
      node.setAttribute("data-mpe-key", key);
      node.setAttribute("tabindex", "0");
    }
    const polygon = node.querySelector("polygon");
    const points = (polygon?.getAttribute("points") || "").trim().split(/\s+/).map((p) => p.split(",").map(Number)).filter((p, i, all) => !i || p[0] !== all[0][0] || p[1] !== all[0][1]);
    if (!compactLayout || points.length !== 4) continue;
    const cx = points.reduce((s, p) => s + p[0], 0) / 4;
    const cy = points.reduce((s, p) => s + p[1], 0) / 4;
    const hw = Math.max(...points.map((p) => Math.abs(p[0] - cx)));
    const hh = Math.max(...points.map((p) => Math.abs(p[1] - cy)));
    const label = node.querySelector("foreignObject");
    const widthRatio = label ? Number(label.getAttribute("width")) / (2 * hw) : 1;
    const needed = label && widthRatio < 0.99 ? Number(label.getAttribute("height")) / (2 * hh) / (0.99 - widthRatio) : 1;
    const scale = Math.min(1, Math.max(0.76, needed));
    polygon.setAttribute("points", points.map((p) => `${p[0]},${cy + (p[1] - cy) * scale}`).join(" "));
  }
  for (const source of compactLayout ? layoutNodes : []) {
    const targets = [...new Set(layoutEdges.filter((e) => e.from === source && layoutSign * (e.to.center[layoutAxis] - source.center[layoutAxis]) > 0).map((e) => e.to))];
    if (targets.length < 2) continue;
    const sameCenters = targets.every((n) => Math.abs(n.center[layoutAxis] - targets[0].center[layoutAxis]) <= 2);
    const sameIncomingSides = targets.every((n) => Math.abs((n.incoming ?? NaN) - (targets[0].incoming ?? NaN)) <= 2);
    if (!sameCenters && !sameIncomingSides) continue;
    const limits = targets.map((n) => nodeLimit(doc, n.key, direction, false));
    if (!limits.every((limit) => limit !== void 0 && Number.isFinite(limit))) continue;
    const level = layoutSign > 0 ? Math.min(...limits) : Math.max(...limits);
    targets.forEach((n, i) => {
      if (alignedTargets.has(n.key)) return;
      const delta = [0, 0];
      delta[layoutAxis] = level - limits[i];
      n.center[layoutAxis] += delta[layoutAxis];
      n.node.setAttribute("transform", `translate(${n.center.join(",")})`);
      alignedTargets.add(n.key);
    });
  }
  const number = "[-+]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][-+]?\\d+)?";
  const segment = new RegExp(`([ML])\\s*(${number})[\\s,]+(${number})`, "g");
  const labelPositions = /* @__PURE__ */ new Map();
  const routeExtent = [];
  const branchLevels = /* @__PURE__ */ new Map();
  const outgoing = /* @__PURE__ */ new Map();
  const sign = /^(BT|RL)$/.test(direction) ? -1 : 1;
  for (const path of compactLayout ? doc.querySelectorAll("path.flowchart-link, .edgePath path.path") : []) {
    const edge = resolveEdge(doc, path);
    if (!edge || !direction) continue;
    const source = [...doc.querySelectorAll("g.node")].find((n) => n.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1] === edge[1]);
    if (!source?.querySelector("polygon")) continue;
    const a = nodeLimit(doc, edge[1], direction, true);
    const b = nodeLimit(doc, edge[2], direction, false);
    if (a === void 0 || b === void 0 || !Number.isFinite(a) || !Number.isFinite(b) || sign * (b - a) <= 0) continue;
    const levels = outgoing.get(edge[1]) || [];
    levels.push((a + b) / 2);
    outgoing.set(edge[1], levels);
  }
  for (const [source, levels] of outgoing) {
    if (levels.length > 1) branchLevels.set(source, sign > 0 ? Math.min(...levels) : Math.max(...levels));
  }
  for (const path of compactLayout ? doc.querySelectorAll("path.flowchart-link, .edgePath path.path") : []) {
    const d = path.getAttribute("d") || "";
    const points = routePoints(d);
    if (!points || points.length < 2) continue;
    const edge = resolveEdge(doc, path);
    let routed = null;
    if (direction && edge) {
      const from = nodeBounds(doc, edge[1]), to = nodeBounds(doc, edge[2]);
      const axis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
      if (!from || !to) continue;
      const delta = to.center[axis] - from.center[axis];
      if (Math.abs(delta) < 0.01) continue;
      const travelSign = Math.sign(delta);
      const pathOffset = transformOffset(path);
      if (!pathOffset) continue;
      points[0] = centerAnchor(from, direction, travelSign, true).map((v, i) => v - pathOffset[i]);
      points[points.length - 1] = centerAnchor(to, direction, travelSign, false).map((v, i) => v - pathOffset[i]);
      const forward = sign * delta > 0;
      if (forward) {
        const sourceLimit = nodeLimit(doc, edge[1], direction, true) - pathOffset[axis];
        const targetLimit = nodeLimit(doc, edge[2], direction, false) - pathOffset[axis];
        routed = orthogonalPath(
          points,
          direction,
          sourceLimit,
          targetLimit,
          branchLevels.has(edge[1]) ? branchLevels.get(edge[1]) - pathOffset[axis] : void 0
        );
      } else {
        routed = returnLanePath(points, direction, from, to, pathOffset);
      }
      if (!routed) continue;
    }
    if (routed) {
      const route = [...routed.matchAll(segment)].map((m) => [Number(m[2]), Number(m[3])]);
      const a = route.length > 2 ? route[1] : route[0];
      const b = route.length > 2 ? route[2] : route[1];
      const offset = transformOffset(path) || [0, 0];
      labelPositions.set(
        path.getAttribute("data-id") || path.id,
        [(a[0] + b[0]) / 2 + offset[0], (a[1] + b[1]) / 2 + offset[1]]
      );
      routeExtent.push(...route.map((pt) => pt.map((value, ax) => value + offset[ax])));
    }
    path.setAttribute("d", routed ? roundPath(routed) : roundPath(d));
  }
  for (const label of doc.querySelectorAll(".edgeLabels > .edgeLabel")) {
    const key = label.getAttribute("data-id") || label.querySelector("[data-id]")?.getAttribute("data-id");
    const position2 = key ? labelPositions.get(key) : void 0;
    const offset = transformOffset(label.parentNode);
    if (position2 && offset) {
      label.setAttribute("transform", `translate(${position2.map((value, ax) => value - offset[ax]).join(",")})`);
    }
  }
  for (const node of doc.querySelectorAll("g.node")) {
    const polygon = node.querySelector("polygon");
    const points = (polygon?.getAttribute("points") || "").trim().split(/\s+/).map((p) => p.split(",").map(Number)).filter((p, i, all) => !i || p[0] !== all[0][0] || p[1] !== all[0][1]);
    if (points.length === 4) {
      node.classList.add("mpe-decision");
      node.setAttribute("tabindex", "0");
    }
  }
  const viewBox = (root.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  if (routeExtent.length && viewBox.length === 4 && viewBox.every(Number.isFinite)) {
    const [x, y, width, height] = viewBox;
    const left = Math.min(x, ...routeExtent.map((p) => p[0] - 6));
    const top = Math.min(y, ...routeExtent.map((p) => p[1] - 6));
    const right = Math.max(x + width, ...routeExtent.map((p) => p[0] + 6));
    const bottom = Math.max(y + height, ...routeExtent.map((p) => p[1] + 6));
    const sizes = [right - left, bottom - top];
    root.setAttribute("viewBox", `${left} ${top} ${sizes.join(" ")}`);
    for (const [name, size] of [["width", sizes[0]], ["height", sizes[1]]]) {
      if (/^[\d.]+$/.test(root.getAttribute(name) || "")) root.setAttribute(name, String(size));
    }
    if (Math.abs(parseFloat(root.style.maxWidth) - width) < 1) root.style.maxWidth = `${sizes[0]}px`;
  }
  const hierarchyNodes = [...doc.querySelectorAll("g.node[data-mpe-key]")];
  const posAxis = /^(TD|TB|BT)$/.test(direction) ? 2 : 1;
  const position = (node) => Number((node.getAttribute("transform") || "").match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/)?.[posAxis]);
  const hierarchyByKey = new Map(hierarchyNodes.map((n) => [n.getAttribute("data-mpe-key"), n]));
  for (const path of doc.querySelectorAll("path.flowchart-link, .edgePath path.path")) {
    const edge = resolveEdge(doc, path);
    if (!edge || !direction) continue;
    const from = hierarchyByKey.get(edge[1]), to = hierarchyByKey.get(edge[2]);
    if (!from || !to) continue;
    path.setAttribute("data-mpe-from", edge[1]);
    path.setAttribute("data-mpe-to", edge[2]);
    path.setAttribute("data-mpe-forward", String(sign * (position(to) - position(from)) > 0));
  }
  for (const marker of doc.querySelectorAll('marker[id$="pointEnd"], marker[id$="pointStart"]')) {
    marker.setAttribute("markerUnits", "userSpaceOnUse");
    marker.setAttribute("markerWidth", "8");
    marker.setAttribute("markerHeight", "8");
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refY", "5");
    marker.setAttribute("orient", "auto");
    const start = marker.id.endsWith("pointStart");
    marker.setAttribute("refX", start ? "0" : "10");
    const path = marker.querySelector("path");
    if (path) {
      path.setAttribute("d", start ? "M10 0 L0 5 L10 10 Z" : "M0 0 L10 5 L0 10 Z");
      path.setAttribute("stroke-width", "0");
    }
  }
  if (settings.nodeRadius > 0) {
    for (const rect of doc.querySelectorAll(".node rect:not(.labelBkg)")) {
      rect.setAttribute("rx", String(settings.nodeRadius));
      rect.setAttribute("ry", String(settings.nodeRadius));
    }
  }
  applyFlowchartColors(root, palette, dark, settings.colorStyle);
  for (const label of doc.querySelectorAll(".edgeLabel")) {
    const rects = label.querySelectorAll("rect");
    for (const rect of rects) {
      rect.setAttribute("rx", "4");
      rect.setAttribute("ry", "4");
    }
  }
  root.classList.add("mfe-enhanced", "mermaid-genie-diagram");
  root.style.setProperty("--mpe-duration", `${settings.animationDuration ?? 450}ms`);
  root.style.setProperty("--mpe-highlight", palette.accent);
  root.style.setProperty("--mpe-line", palette.line);
  root.style.setProperty("--mpe-border", palette.border);
  root.style.setProperty("--mpe-node", palette.surface);
  root.style.setProperty("--mpe-text", palette.text);
  root.style.setProperty("--mpe-label", palette.label);
  return new XMLSerializer().serializeToString(doc.documentElement);
}
function widenSingleRectangles(source, svg, direction) {
  if (!/^(TD|TB|BT)$/.test(direction)) return source;
  const doc = new DOMParser().parseFromString(svg.replace(/<br\s*>/gi, "<br/>"), "image/svg+xml");
  const nodes = [...doc.querySelectorAll("g.node")].map((node) => {
    const t = (node.getAttribute("transform") || "").match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
    const key = node.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1];
    return { key, y: t ? Number(t[2]) : NaN, rect: !!node.querySelector("rect") };
  }).filter((n) => n.key && Number.isFinite(n.y));
  const single = new Set(nodes.filter((n) => n.rect && !nodes.some((other) => other !== n && Math.abs(other.y - n.y) < 2)).map((n) => n.key));
  return source.replace(/([\p{L}\p{N}_-]+)\["([^"\n]+)"\]/gu, (whole, key, label) => {
    if (!single.has(key) || label.length > 55 || /[<>&`]/.test(label)) return whole;
    return `${key}["${label.replace(/ /g, "\xA0")}"]`;
  });
}
function wrapDecisions(source) {
  let context = null;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    context = canvas.getContext("2d");
  }
  if (!context) return source;
  context.font = '15px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  return source.replace(/([\p{L}\p{N}_-]+)\{"([^"\n]+)"\}/gu, (whole, key, label) => {
    if (/[<>&`]/.test(label) || context.measureText(label).width <= 110) return whole;
    const words = label.split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > 110) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return `${key}{"${lines.join("<br/>")}"}`;
  });
}

// src/settings.ts
var import_obsidian3 = require("obsidian");
var DEFAULT_SETTINGS = Object.freeze({
  compactLayout: true,
  pathHighlight: true,
  animationDuration: 450,
  hoverDelay: 180,
  nodeRadius: 6,
  colorStyle: "multi",
  multiPalette: "clear",
  singlePalette: "slate",
  exportControls: true,
  exportFolder: ""
});
function normalizeSettings(value = {}) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const finite = (key, min, max, fallback) => {
    const candidate = input[key];
    return typeof candidate === "number" && Number.isFinite(candidate) ? Math.min(max, Math.max(min, Math.round(candidate))) : fallback;
  };
  const styleCandidate = input.colorStyle;
  const colorStyle = styleCandidate === "multi" || styleCandidate === "single" || styleCandidate === "custom" ? styleCandidate : DEFAULT_SETTINGS.colorStyle;
  const multiCandidate = input.multiPalette;
  const multiPalette = multiCandidate === "clear" || multiCandidate === "cool" || multiCandidate === "natural" ? multiCandidate : DEFAULT_SETTINGS.multiPalette;
  const singleCandidate = input.singlePalette;
  const singlePalette = singleCandidate === "slate" || singleCandidate === "mint" || singleCandidate === "sky" || singleCandidate === "rose" ? singleCandidate : DEFAULT_SETTINGS.singlePalette;
  const result = {
    compactLayout: typeof input.compactLayout === "boolean" ? input.compactLayout : DEFAULT_SETTINGS.compactLayout,
    pathHighlight: typeof input.pathHighlight === "boolean" ? input.pathHighlight : DEFAULT_SETTINGS.pathHighlight,
    animationDuration: finite("animationDuration", 0, 2e3, DEFAULT_SETTINGS.animationDuration),
    hoverDelay: finite("hoverDelay", 0, 1e3, DEFAULT_SETTINGS.hoverDelay),
    nodeRadius: finite("nodeRadius", 0, 24, DEFAULT_SETTINGS.nodeRadius),
    colorStyle,
    multiPalette,
    singlePalette,
    exportControls: typeof input.exportControls === "boolean" ? input.exportControls : DEFAULT_SETTINGS.exportControls,
    exportFolder: typeof input.exportFolder === "string" ? input.exportFolder : DEFAULT_SETTINGS.exportFolder
  };
  if (typeof input.customColors === "object" && input.customColors !== null) {
    result.customColors = input.customColors;
  }
  return result;
}
var GenieSettingsTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Mermaid Genie Settings" });
    containerEl.createEl("h3", { text: "Flowchart Layout & Routing" });
    new import_obsidian3.Setting(containerEl).setName("Compact layout").setDesc("Align branches leaving decisions, shorten connectors, and wrap diamond labels nicely.").addToggle((toggle) => toggle.setValue(this.plugin.settings.compactLayout).onChange(async (value) => {
      this.plugin.settings.compactLayout = value;
      await this.plugin.saveSettings();
      this.plugin.refreshDiagrams();
    }));
    new import_obsidian3.Setting(containerEl).setName("Highlight ancestor paths").setDesc("Highlight incoming forward paths on hover or keyboard focus.").addToggle((toggle) => toggle.setValue(this.plugin.settings.pathHighlight).onChange(async (value) => {
      this.plugin.settings.pathHighlight = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(containerEl).setName("Node corner radius (px)").setDesc("Smooth rounded corners for rectangular flowchart blocks.").addSlider((slider) => slider.setLimits(0, 20, 1).setValue(this.plugin.settings.nodeRadius).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.nodeRadius = value;
      await this.plugin.saveSettings();
      this.plugin.refreshDiagrams();
    }));
    new import_obsidian3.Setting(containerEl).setName("Animation duration (ms)").setDesc("Transition timing for path highlighting and fades.").addSlider((slider) => slider.setLimits(0, 2e3, 50).setValue(this.plugin.settings.animationDuration).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.animationDuration = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(containerEl).setName("Hover reset delay (ms)").setDesc("Delay before clearing highlighted paths when mouse leaves diagram elements.").addSlider((slider) => slider.setLimits(0, 1e3, 20).setValue(this.plugin.settings.hoverDelay).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.hoverDelay = value;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "Colored Flow Blocks & Theme" });
    new import_obsidian3.Setting(containerEl).setName("Color style").setDesc("Choose between coordinated multi-colored flow blocks or a uniform preset.").addDropdown((dropdown) => dropdown.addOption("multi", "Coordinated Multi-Color (Branches & Subgraphs)").addOption("single", "Single-Hue Preset (Uniform Accent)").setValue(this.plugin.settings.colorStyle).onChange(async (value) => {
      this.plugin.settings.colorStyle = value;
      await this.plugin.saveSettings();
      this.plugin.refreshDiagrams();
      this.display();
    }));
    if (this.plugin.settings.colorStyle === "multi") {
      new import_obsidian3.Setting(containerEl).setName("Multi-color palette").setDesc("Select the coordinated palette used to color flow branches and clusters.").addDropdown((dropdown) => dropdown.addOption("clear", "Clear (Fresh & Balanced: Blue, Teal, Amber, Violet)").addOption("cool", "Cool (Modern High-Tech: Indigo, Cyan, Slate)").addOption("natural", "Natural (Earthy Harmony: Sage, Ochre, Terracotta)").setValue(this.plugin.settings.multiPalette).onChange(async (value) => {
        this.plugin.settings.multiPalette = value;
        await this.plugin.saveSettings();
        this.plugin.refreshDiagrams();
      }));
    } else if (this.plugin.settings.colorStyle === "single") {
      new import_obsidian3.Setting(containerEl).setName("Single-hue preset").setDesc("Select the uniform theme color for flowchart blocks.").addDropdown((dropdown) => dropdown.addOption("slate", "Slate Blue (Professional & Clean)").addOption("mint", "Fresh Mint (Crisp Green)").addOption("sky", "Sky Blue (Bright & Vibrant)").addOption("rose", "Rose Berry (Warm & Sophisticated)").setValue(this.plugin.settings.singlePalette).onChange(async (value) => {
        this.plugin.settings.singlePalette = value;
        await this.plugin.saveSettings();
        this.plugin.refreshDiagrams();
      }));
    }
    containerEl.createEl("h3", { text: "Diagram Export & Clipboard" });
    new import_obsidian3.Setting(containerEl).setName("Show diagram action button").setDesc("Display a floating export button in the corner of rendered Mermaid diagrams.").addToggle((toggle) => toggle.setValue(this.plugin.settings.exportControls).onChange(async (value) => {
      this.plugin.settings.exportControls = value;
      await this.plugin.saveSettings();
      this.plugin.refreshDiagrams();
    }));
    new import_obsidian3.Setting(containerEl).setName("Default export folder").setDesc("Optional path for saved PNG and SVG diagrams. Leave blank to use vault attachment settings.").addText((text) => text.setPlaceholder("e.g. Attachments/Diagrams").setValue(this.plugin.settings.exportFolder || "").onChange(async (value) => {
      this.plugin.settings.exportFolder = value.trim();
      await this.plugin.saveSettings();
    }));
  }
};

// src/svg-clipboard.ts
var import_obsidian4 = require("obsidian");
var SvgClipboard = class {
  constructor(app) {
    this.app = app;
  }
  copied;
  generation = 0;
  async copy(image, clipboard) {
    if (!clipboard?.write || typeof ClipboardItem === "undefined") {
      throw new Error("Clipboard is unavailable.");
    }
    const token = crypto.randomUUID();
    const copied = { token, svg: image.svg };
    const html = `<img data-mermaid-genie-svg="${token}" alt="Mermaid diagram" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(image.svg)}">`;
    try {
      await clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([image.svg], { type: "text/plain" })
        })
      ]);
      this.copied = copied;
      new import_obsidian4.Notice("Diagram SVG copied to clipboard.");
    } catch {
      new import_obsidian4.Notice("Could not write SVG to clipboard.");
    }
  }
  paste(event, editor, info) {
    const copied = this.copied;
    if (event.defaultPrevented || !copied || !info.file) return;
    const token = event.clipboardData?.getData("text/html").match(/data-mermaid-genie-svg=["']([\da-f-]+)["']/i)?.[1];
    if (token !== copied.token) return;
    return this.insert(copied.svg, editor, info, info.file.path, info.file.basename);
  }
  async insert(svg, editor, info, sourcePath, basename) {
    this.generation++;
    const gen = this.generation;
    try {
      const name = (basename || "diagram").replace(/[\\/:*?"<>|]/g, "-");
      const path = await this.app.fileManager.getAvailablePathForAttachment(`${name}-diagram.svg`, sourcePath);
      const file = await this.app.vault.createBinary(path, new TextEncoder().encode(svg).buffer);
      if (gen !== this.generation || info.file?.path !== sourcePath) return;
      editor.replaceSelection(`!${this.app.fileManager.generateMarkdownLink(file, sourcePath)}`);
    } catch {
      new import_obsidian4.Notice("Could not paste diagram SVG.");
    }
  }
  clear() {
    this.copied = void 0;
  }
};

// src/main.ts
var MermaidGeniePlugin = class extends import_obsidian5.Plugin {
  stopped = false;
  settings = { ...DEFAULT_SETTINGS };
  svgClipboard = new SvgClipboard(this.app);
  fileExport = new DiagramFileExport(
    this.app,
    () => this.settings.exportFolder,
    async (folder) => {
      this.settings.exportFolder = folder;
      await this.saveSettings();
    }
  );
  async onload() {
    this.stopped = false;
    this.settings = normalizeSettings(await this.loadData());
    if (this.stopped) return;
    this.addSettingTab(new GenieSettingsTab(this.app, this));
    const controller = createPathController(document, () => this.settings);
    this.registerDomEvent(document, "pointerover", (event) => controller.enter(event));
    this.registerDomEvent(document, "pointerout", (event) => controller.leave(event));
    this.registerDomEvent(document, "focusin", (event) => controller.enter(event));
    this.registerDomEvent(document, "focusout", (event) => controller.leave(event));
    this.register(() => controller.dispose());
    this.registerMarkdownPostProcessor((element, context) => {
      if (this.stopped || !this.settings.exportControls) return;
      if (!element.matches(".mermaid, .mermaid-wrapper") && !element.querySelector(".mermaid, .mermaid-wrapper, code.language-mermaid")) {
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
    this.registerEvent(
      this.app.workspace.on("editor-paste", (event, editor, info) => {
        if (event.defaultPrevented || this.stopped) return;
        const paste = this.svgClipboard.paste(event, editor, info);
        if (paste) {
          event.preventDefault();
          void paste;
        }
      })
    );
    this.registerCommands();
    const mermaid = await (0, import_obsidian5.loadMermaid)();
    if (this.stopped) return;
    const original = mermaid.render;
    const getSettings = () => this.settings;
    const wrapped = async function(id, source, ...args) {
      if (typeof source !== "string") return original.call(this, id, source, ...args);
      let text = source;
      if (/^\s*%%\s*(?:mg|mfe):off\s*$/m.test(text)) {
        return original.call(this, id, text, ...args);
      }
      const directionMatch = text.match(/^\s*(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/m);
      const direction = directionMatch?.[1];
      const currentSettings = getSettings();
      const dark = document.body.classList.contains("theme-dark");
      const palette = resolvePaletteData(
        currentSettings.colorStyle,
        currentSettings.multiPalette,
        currentSettings.singlePalette,
        dark,
        currentSettings.customColors?.[dark ? "dark" : "light"]
      );
      if (direction && currentSettings.compactLayout) {
        text = wrapDecisions(text);
      }
      const header = text.match(/^\s*---\s*\n[\s\S]*?\n---\s*\n/);
      const prefix = header ? header[0] : "";
      const configuredDefaults = {
        theme: dark ? "dark" : "base",
        fontFamily: 'var(--font-text, var(--default-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif))',
        themeVariables: {
          darkMode: dark,
          background: dark ? palette.background : "#ffffff",
          primaryColor: palette.surface,
          primaryTextColor: palette.text,
          primaryBorderColor: palette.border,
          lineColor: palette.line,
          edgeLabelBackground: palette.label,
          clusterBkg: palette.clusterBkg ?? (dark ? "#1d2838" : "#f1f5f9"),
          clusterBorder: palette.clusterBorder ?? palette.border,
          fontSize: "15px"
        },
        flowchart: {
          curve: "step",
          nodeSpacing: 28,
          rankSpacing: 26,
          padding: 10,
          diagramPadding: 4,
          wrappingWidth: 160,
          useMaxWidth: false,
          htmlLabels: true
        }
      };
      const configured = prefix + `%%{init: ${JSON.stringify(configuredDefaults)}}%%
` + text.slice(prefix.length);
      let result = await original.call(this, id, configured, ...args);
      if (direction && currentSettings.compactLayout) {
        const rawSvg = typeof result === "string" ? result : result.svg;
        const widerSource = widenSingleRectangles(text, rawSvg, direction);
        if (widerSource !== text) {
          const widerConfigured = prefix + `%%{init: ${JSON.stringify(configuredDefaults)}}%%
` + widerSource.slice(prefix.length);
          result = await original.call(this, id, widerConfigured, ...args);
        }
      }
      try {
        const rawSvg = typeof result === "string" ? result : result.svg;
        const enhancedSvg = styleSvg(rawSvg, direction ?? "", currentSettings, palette, dark);
        return typeof result === "string" ? enhancedSvg : { ...result, svg: enhancedSvg };
      } catch (error) {
        console.warn("Mermaid Genie: kept original SVG after layout/styling failed", error);
        return result;
      }
    };
    mermaid.render = wrapped;
    this.register(() => {
      if (mermaid.render === wrapped) mermaid.render = original;
    });
  }
  registerCommands() {
    this.addCommand({
      id: "refresh-diagrams",
      name: "Refresh diagrams",
      callback: () => this.refreshDiagrams()
    });
    const exportActions = [
      { id: "copy-diagram-png", name: "Copy diagram as PNG", action: "copy" },
      { id: "copy-diagram-svg", name: "Copy diagram as SVG", action: "copy-svg" },
      { id: "export-diagram-png", name: "Export diagram as PNG", action: "png" },
      { id: "export-diagram-svg", name: "Export diagram as SVG", action: "svg" }
    ];
    for (const item of exportActions) {
      this.addCommand({
        id: item.id,
        name: item.name,
        checkCallback: (checking) => {
          const view = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
          const diagrams = Array.from(view?.containerEl.querySelectorAll(".mermaid > svg.mfe-enhanced") ?? []);
          if (!diagrams.length) return false;
          if (!checking) {
            const handleExport = (svg) => {
              void exportDiagram(svg, item.action, view?.file?.path ?? "", this.svgClipboard, this.fileExport);
            };
            if (diagrams.length === 1) {
              handleExport(diagrams[0]);
            } else {
              new DiagramPickerModal(this.app, diagrams, handleExport).open();
            }
          }
          return true;
        }
      });
    }
  }
  refreshDiagrams() {
    this.app.workspace.trigger("post-processor-change");
  }
  async saveSettings() {
    this.settings = normalizeSettings(this.settings);
    await this.saveData(this.settings);
    document.querySelectorAll("svg.mfe-enhanced").forEach((svg) => {
      svg.style.setProperty("--mpe-duration", `${this.settings.animationDuration}ms`);
    });
    if (!this.settings.pathHighlight) {
      document.querySelectorAll(".mpe-tracing, .mpe-on-path").forEach((el) => el.classList.remove("mpe-tracing", "mpe-on-path"));
    }
  }
  onunload() {
    this.stopped = true;
    this.svgClipboard.clear();
    this.fileExport.dispose();
    this.refreshDiagrams();
  }
};
