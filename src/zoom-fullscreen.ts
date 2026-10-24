import { Platform, setIcon, Menu, type App } from 'obsidian';
import type { DiagramFileExport } from './file-export';
import type { SvgClipboard } from './svg-clipboard';

export const INLINE_MIN_SCALE = 0.25;
export const INLINE_MAX_SCALE = 4.0;
export const INLINE_ZOOM_STEP = 1.2;

interface PristineStyles {
  width: string;
  height: string;
  maxWidth: string;
}

const pristineSvgStyles = new WeakMap<SVGSVGElement, PristineStyles>();
const gestureTeardowns = new WeakMap<HTMLElement, () => void>();

export function svgNaturalSize(svg: SVGSVGElement): { width: number; height: number } | null {
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) {
    return { width: vb.width, height: vb.height };
  }
  const attrWidth = parseFloat(svg.getAttribute('width') || '');
  const attrHeight = parseFloat(svg.getAttribute('height') || '');
  if (attrWidth > 0 && attrHeight > 0) {
    return { width: attrWidth, height: attrHeight };
  }
  const rect = svg.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    return { width: rect.width, height: rect.height };
  }
  return null;
}

export function snapshotPristine(svg: SVGSVGElement): void {
  if (pristineSvgStyles.has(svg)) return;
  pristineSvgStyles.set(svg, {
    width: svg.style.width,
    height: svg.style.height,
    maxWidth: svg.style.maxWidth,
  });
}

export function restorePristine(svg: SVGSVGElement): void {
  const pristine = pristineSvgStyles.get(svg);
  if (!pristine) return;
  svg.style.width = pristine.width;
  svg.style.height = pristine.height;
  svg.style.maxWidth = pristine.maxWidth;
  pristineSvgStyles.delete(svg);
}

export function getBlockScale(block: HTMLElement): number {
  const parsed = parseFloat(block.dataset.mgScale ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function setBlockScale(block: HTMLElement, scale: number, anchorClientX?: number): void {
  const svg = block.querySelector<SVGSVGElement>('svg.mfe-enhanced') || block.querySelector<SVGSVGElement>('svg');
  if (!svg) return;
  const natural = svgNaturalSize(svg);
  if (!natural) return;

  const newScale = Math.max(INLINE_MIN_SCALE, Math.min(INLINE_MAX_SCALE, scale));
  const oldScale = getBlockScale(block);

  if (Math.abs(newScale - 1) < 0.01) {
    restorePristine(svg);
    delete block.dataset.mgScale;
    block.classList.remove('mermaid-genie-scaled');
    block.scrollLeft = 0;
    return;
  }

  snapshotPristine(svg);
  svg.style.maxWidth = 'none';
  svg.style.width = `${Math.round(natural.width * newScale)}px`;
  svg.style.height = `${Math.round(natural.height * newScale)}px`;
  block.classList.add('mermaid-genie-scaled');
  block.dataset.mgScale = String(newScale);

  if (oldScale > 0) {
    const rect = block.getBoundingClientRect();
    const offsetX = anchorClientX !== undefined
      ? anchorClientX - rect.left
      : rect.width / 2;
    const oldContentWidth = natural.width * oldScale;
    if (oldContentWidth > 0) {
      const fraction = (block.scrollLeft + offsetX) / oldContentWidth;
      const newLeft = fraction * natural.width * newScale - offsetX;
      const maxLeft = block.scrollWidth - block.clientWidth;
      block.scrollLeft = Math.max(0, Math.min(maxLeft, newLeft));
    }
  }
}

export function zoomBlockBy(block: HTMLElement, factor: number, anchorClientX?: number): void {
  const current = getBlockScale(block);
  setBlockScale(block, current * factor, anchorClientX);
}

export function resetBlockZoom(block: HTMLElement): void {
  setBlockScale(block, 1);
}

export function attachInlineGestures(block: HTMLElement): () => void {
  if (gestureTeardowns.has(block)) {
    return gestureTeardowns.get(block)!;
  }

  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? INLINE_ZOOM_STEP : (1 / INLINE_ZOOM_STEP);
      zoomBlockBy(block, factor, e.clientX);
    }
  };

  let isDragging = false;
  let startX = 0;
  let scrollStart = 0;

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging) return;
    block.scrollLeft = scrollStart - (e.clientX - startX);
  };

  const onPointerEnd = (e: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    block.classList.remove('mermaid-genie-dragging');
    try {
      block.releasePointerCapture?.(e.pointerId);
    } catch {}
    block.removeEventListener('pointermove', onPointerMove);
    block.removeEventListener('pointerup', onPointerEnd);
    block.removeEventListener('pointercancel', onPointerEnd);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    if (e.button !== 0) return;
    if ((e.target as Element)?.closest?.('.mermaid-genie-actions')) return;
    if (block.scrollWidth <= block.clientWidth + 1) return;
    isDragging = true;
    startX = e.clientX;
    scrollStart = block.scrollLeft;
    block.setPointerCapture?.(e.pointerId);
    block.classList.add('mermaid-genie-dragging');
    block.addEventListener('pointermove', onPointerMove);
    block.addEventListener('pointerup', onPointerEnd);
    block.addEventListener('pointercancel', onPointerEnd);
  };

  block.addEventListener('wheel', onWheel, { passive: false });
  block.addEventListener('pointerdown', onPointerDown);

  const teardown = () => {
    block.removeEventListener('wheel', onWheel);
    block.removeEventListener('pointerdown', onPointerDown);
    block.removeEventListener('pointermove', onPointerMove);
    block.removeEventListener('pointerup', onPointerEnd);
    block.removeEventListener('pointercancel', onPointerEnd);
  };

  gestureTeardowns.set(block, teardown);
  return teardown;
}

export function teardownInlineZoom(block: HTMLElement): void {
  const teardown = gestureTeardowns.get(block);
  if (teardown) {
    teardown();
    gestureTeardowns.delete(block);
  }
  const svg = block.querySelector<SVGSVGElement>('svg');
  if (svg) restorePristine(svg);
  delete block.dataset.mgScale;
  delete block.dataset.mgReady;
  block.classList.remove('mermaid-genie-scaled', 'mermaid-genie-dragging');
}

export function setFullscreenIcon(el: HTMLElement): void {
  const doc = el.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) return;
  const svgNS = 'http://www.w3.org/2000/svg';
  const icon = doc.createElementNS(svgNS, 'svg');
  icon.setAttribute('width', '16');
  icon.setAttribute('height', '16');
  icon.setAttribute('viewBox', '0 0 16 16');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.5');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  for (const points of ['1,6 1,1 6,1', '15,6 15,1 10,1', '1,10 1,15 6,15', '15,10 15,15 10,15']) {
    const polyline = doc.createElementNS(svgNS, 'polyline');
    polyline.setAttribute('points', points);
    icon.appendChild(polyline);
  }
  el.appendChild(icon);
}

function makeElement<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const doc = parent.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const el = doc ? doc.createElement(tag) : document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  parent.appendChild(el);
  return el;
}

export interface FullscreenModalOptions {
  app: App;
  sourceSvg: SVGSVGElement;
  sourcePath: string;
  onExport: (svg: SVGSVGElement, action: 'copy' | 'copy-svg' | 'png' | 'svg') => void;
}

export function openFullscreenModal(opts: FullscreenModalOptions): void {
  const { sourceSvg, onExport } = opts;
  const doc = sourceSvg.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) return;

  // 1. Fullscreen overlay
  const modal = doc.createElement('div');
  modal.className = 'mermaid-genie-fullscreen-modal';

  // 2. Content area
  const content = makeElement(modal, 'div', 'mermaid-genie-modal-content');

  // 3. Zoom container
  const zoomContainer = makeElement(content, 'div', 'mermaid-genie-modal-zoom-container');

  // 4. Content wrapper (marked with .mermaid for Genie styling inheritance)
  const contentWrapper = makeElement(zoomContainer, 'div', 'mermaid-genie-modal-wrapper mermaid');

  // 5. Cloned SVG
  const svgClone = sourceSvg.cloneNode(true) as SVGSVGElement;

  // Remove any inline zoomed width/height from the clone
  const viewBox = svgClone.viewBox?.baseVal;
  svgClone.style.removeProperty('width');
  svgClone.style.removeProperty('height');
  svgClone.style.maxWidth = 'none';

  // Preserve theme classes and CSS custom variables from host
  const host = sourceSvg.closest<HTMLElement>('.mermaid');
  if (host) {
    for (const cls of Array.from(host.classList)) {
      if (cls !== 'mermaid' && !cls.startsWith('mermaid-genie-')) {
        contentWrapper.classList.add(cls);
      }
    }
    const win = doc.defaultView || window;
    const hostStyle = win.getComputedStyle ? win.getComputedStyle(host) : host.style;
    const genieVars = [
      '--mpe-node',
      '--mpe-border',
      '--mpe-group',
      '--mpe-group-border',
      '--mpe-line',
      '--mpe-text',
      '--mpe-label',
      '--mpe-highlight',
      '--mpe-duration',
      '--mpe-cluster-bkg',
      '--mpe-accent'
    ];
    for (const prop of genieVars) {
      const val = hostStyle.getPropertyValue ? hostStyle.getPropertyValue(prop) : '';
      if (val) {
        contentWrapper.style.setProperty(prop, val);
        svgClone.style.setProperty(prop, val);
      }
    }
  }

  const win = doc.defaultView || window;
  const svgStyle = win.getComputedStyle ? win.getComputedStyle(sourceSvg) : sourceSvg.style;
  for (const prop of ['--mpe-node', '--mpe-border', '--mpe-group', '--mpe-group-border', '--mpe-line', '--mpe-text', '--mpe-label', '--mpe-highlight', '--mpe-duration', '--mpe-cluster-bkg', '--mpe-accent']) {
    const val = svgStyle.getPropertyValue ? svgStyle.getPropertyValue(prop) : '';
    if (val) {
      svgClone.style.setProperty(prop, val);
    }
  }

  contentWrapper.appendChild(svgClone);

  // Measure dimensions
  const cloneRect = svgClone.getBoundingClientRect ? svgClone.getBoundingClientRect() : { width: 0, height: 0 };
  const naturalWidth = viewBox?.width || cloneRect.width || parseFloat(svgClone.getAttribute('width') || '') || 400;
  const naturalHeight = viewBox?.height || cloneRect.height || parseFloat(svgClone.getAttribute('height') || '') || 300;

  // Zoom State
  const state = {
    scale: 1,
    minScale: 0.1,
    maxScale: 6.0,
    translateX: 0,
    translateY: 0,
    scaleIndicator: null as HTMLElement | null,
  };

  const updateTransform = () => {
    svgClone.style.maxWidth = 'none';
    svgClone.style.width = `${Math.round(naturalWidth * state.scale)}px`;
    svgClone.style.height = `${Math.round(naturalHeight * state.scale)}px`;
    contentWrapper.style.transform = `translate(${state.translateX}px, ${state.translateY}px)`;
    if (state.scaleIndicator) {
      state.scaleIndicator.textContent = `${Math.round(state.scale * 100)}%`;
    }
  };

  const zoomTo = (newScale: number, centerX?: number, centerY?: number) => {
    const clampedScale = Math.max(state.minScale, Math.min(state.maxScale, newScale));
    if (clampedScale === state.scale) return;

    const cx = centerX !== undefined ? centerX : zoomContainer.clientWidth / 2;
    const cy = centerY !== undefined ? centerY : zoomContainer.clientHeight / 2;

    const scaleRatio = clampedScale / state.scale;
    state.translateX = cx - (cx - state.translateX) * scaleRatio;
    state.translateY = cy - (cy - state.translateY) * scaleRatio;
    state.scale = clampedScale;
    updateTransform();
  };

  const zoomBy = (factor: number, centerX?: number, centerY?: number) => {
    zoomTo(state.scale * factor, centerX, centerY);
  };

  const fitToContainer = () => {
    const cw = zoomContainer.clientWidth;
    const ch = zoomContainer.clientHeight;
    if (cw <= 0 || ch <= 0 || naturalWidth <= 0 || naturalHeight <= 0) return;

    const padding = 48;
    const availW = cw - padding * 2;
    const availH = ch - padding * 2;

    const scaleX = availW / naturalWidth;
    const scaleY = availH / naturalHeight;
    let fitScale = 1;
    if (naturalWidth > availW || naturalHeight > availH) {
      fitScale = Math.min(scaleX, scaleY);
    } else {
      fitScale = Math.min(1, Math.min(scaleX, scaleY));
    }

    const scaledW = naturalWidth * fitScale;
    const scaledH = naturalHeight * fitScale;
    state.scale = fitScale;
    state.translateX = (cw - scaledW) / 2;
    state.translateY = (ch - scaledH) / 2;
    updateTransform();
  };

  // Bottom-right controls dock with matching Genie cosmetics
  const controls = makeElement(modal, 'div', 'mermaid-genie-modal-controls');

  const makeBtn = (iconName: string, title: string, onClick: (e: MouseEvent) => void, cls = '') => {
    const btn = makeElement(controls, 'button', `mermaid-genie-btn ${cls}`.trim());
    btn.type = 'button';
    btn.setAttribute('aria-label', title);
    btn.title = title;
    setIcon(btn, iconName);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick(e);
    });
    return btn;
  };

  // Zoom In
  makeBtn('plus', 'Zoom in', () => zoomBy(1.2));

  // Zoom Out
  makeBtn('minus', 'Zoom out', () => zoomBy(1 / 1.2));

  // Reset to fit
  makeBtn('rotate-ccw', 'Reset zoom to fit', () => fitToContainer());

  // Scale percentage readout
  const indicator = makeElement(controls, 'span', 'mermaid-genie-scale-indicator', '100%');
  state.scaleIndicator = indicator;

  // Genie Export Menu
  makeBtn('image-down', 'Export diagram', (e) => {
    const menu = new Menu();
    menu.addItem(item =>
      item.setTitle('Copy as PNG')
        .setIcon('copy')
        .onClick(() => onExport(svgClone, 'copy'))
    );
    menu.addItem(item =>
      item.setTitle('Copy as SVG')
        .setIcon('copy')
        .onClick(() => onExport(svgClone, 'copy-svg'))
    );
    menu.addSeparator();
    menu.addItem(item =>
      item.setTitle(Platform.isDesktopApp ? 'Export as PNG…' : 'Save as PNG')
        .setIcon('image-down')
        .onClick(() => onExport(svgClone, 'png'))
    );
    menu.addItem(item =>
      item.setTitle(Platform.isDesktopApp ? 'Export as SVG…' : 'Save as SVG')
        .setIcon('file-code')
        .onClick(() => onExport(svgClone, 'svg'))
    );
    menu.showAtMouseEvent(e);
  });

  // Close button
  makeBtn('x', 'Close fullscreen', () => closeModal(), 'mermaid-genie-modal-close-btn');

  // Mouse wheel zoom
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = zoomContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 33;
    else if (e.deltaMode === 2) delta *= 300;
    const factor = Math.exp((-Math.max(-100, Math.min(100, delta)) / 100) * 0.15);
    zoomBy(factor, mouseX, mouseY);
  };
  zoomContainer.addEventListener('wheel', onWheel, { passive: false });

  // Mouse drag-to-pan
  let dragId = -1;
  let lastClientX = 0;
  let lastClientY = 0;

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    if (e.button !== 0) return;
    if ((e.target as Element)?.closest?.('.mermaid-genie-modal-controls')) return;
    dragId = e.pointerId;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    contentWrapper.classList.add('is-dragging');
    zoomContainer.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== dragId) return;
    const dx = e.clientX - lastClientX;
    const dy = e.clientY - lastClientY;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    state.translateX += dx;
    state.translateY += dy;
    updateTransform();
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== dragId) return;
    dragId = -1;
    contentWrapper.classList.remove('is-dragging');
    try {
      zoomContainer.releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  zoomContainer.addEventListener('pointerdown', onPointerDown);
  zoomContainer.addEventListener('pointermove', onPointerMove);
  zoomContainer.addEventListener('pointerup', onPointerUp);
  zoomContainer.addEventListener('pointercancel', onPointerUp);

  // Touch gestures (pinch zoom & pan)
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let touchStartX = 0;
  let touchStartY = 0;

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStartDist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      pinchStartScale = state.scale;
    } else if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      contentWrapper.classList.add('is-dragging');
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist > 0) {
      if (e.cancelable) e.preventDefault();
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      const rect = zoomContainer.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      zoomTo(pinchStartScale * (dist / pinchStartDist), midX, midY);
    } else if (e.touches.length === 1) {
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      state.translateX += dx;
      state.translateY += dy;
      updateTransform();
    }
  };

  const onTouchEnd = () => {
    pinchStartDist = 0;
    contentWrapper.classList.remove('is-dragging');
  };

  zoomContainer.addEventListener('touchstart', onTouchStart, { passive: true });
  zoomContainer.addEventListener('touchmove', onTouchMove, { passive: false });
  zoomContainer.addEventListener('touchend', onTouchEnd);
  zoomContainer.addEventListener('touchcancel', onTouchEnd);

  // Keyboard shortcuts
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
    } else if (e.key === '+' || e.key === '=') {
      zoomBy(1.2);
    } else if (e.key === '-' || e.key === '_') {
      zoomBy(1 / 1.2);
    } else if (e.key === '0') {
      fitToContainer();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  // Android hardware back button
  const popstateHandler = () => closeModal();
  if (Platform.isMobile) {
    history.pushState(null, '');
    window.addEventListener('popstate', popstateHandler);
  }

  const closeModal = () => {
    if (Platform.isMobile) {
      window.removeEventListener('popstate', popstateHandler);
    }
    document.removeEventListener('keydown', onKeyDown);
    zoomContainer.removeEventListener('wheel', onWheel);
    zoomContainer.removeEventListener('pointerdown', onPointerDown);
    zoomContainer.removeEventListener('pointermove', onPointerMove);
    zoomContainer.removeEventListener('pointerup', onPointerUp);
    zoomContainer.removeEventListener('pointercancel', onPointerUp);
    zoomContainer.removeEventListener('touchstart', onTouchStart);
    zoomContainer.removeEventListener('touchmove', onTouchMove);
    zoomContainer.removeEventListener('touchend', onTouchEnd);
    zoomContainer.removeEventListener('touchcancel', onTouchEnd);
    modal.remove();
  };

  (doc.body || doc.documentElement).appendChild(modal);
  const winRef = doc.defaultView || (typeof window !== 'undefined' ? window : null);
  if (winRef && typeof winRef.requestAnimationFrame === 'function') {
    winRef.requestAnimationFrame(() => fitToContainer());
  } else {
    setTimeout(() => fitToContainer(), 0);
  }
}
