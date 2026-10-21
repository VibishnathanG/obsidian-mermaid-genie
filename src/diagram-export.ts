const MAX_SIDE = 4096;
const MAX_PIXELS = 16_000_000;

export interface DiagramImage {
  svg: string;
  width: number;
  height: number;
}

/** Keep raster exports within canvas limits without changing aspect ratio. */
export function pngSize(width: number, height: number): { width: number; height: number; scale: number } {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Invalid diagram dimensions.');
  }
  const scale = Math.min(2, MAX_SIDE / width, MAX_SIDE / height, Math.sqrt(MAX_PIXELS / (width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale };
}

const STYLE_PROPERTIES = [
  'color', 'background-color', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width',
  'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin',
  'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
  'letter-spacing', 'line-height', 'text-anchor', 'dominant-baseline', 'text-decoration',
  'white-space', 'word-break', 'overflow-wrap', 'text-align', 'vertical-align',
  'display', 'visibility', 'padding', 'margin', 'border', 'border-radius',
  'box-sizing', 'width', 'height', 'max-width', 'min-width',
  'marker-start', 'marker-mid', 'marker-end', 'clip-path', 'mask', 'vector-effect',
  'transform', 'transform-origin', 'transform-box', 'rx', 'ry',
];

/** Snapshot an already rendered diagram with inlined styles so it is fully standalone. */
export function diagramImage(svg: SVGSVGElement): DiagramImage {
  const bounds = svg.viewBox.baseVal;
  const width = bounds.width > 0 ? bounds.width : parseFloat(svg.getAttribute('width') || '800') || 800;
  const height = bounds.height > 0 ? bounds.height : parseFloat(svg.getAttribute('height') || '600') || 600;
  pngSize(width, height);

  const view = svg.ownerDocument?.defaultView || window;
  const copy = svg.cloneNode(true) as SVGSVGElement;

  const originals = [svg, ...svg.querySelectorAll<SVGElement | HTMLElement>('*')];
  const copies = [copy, ...copy.querySelectorAll<SVGElement | HTMLElement>('*')];

  for (let i = 0; i < originals.length; i++) {
    const original = originals[i]!, target = copies[i]!;
    if (!target.style) continue;
    const computed = view.getComputedStyle(original);
    target.removeAttribute('style');
    for (const property of STYLE_PROPERTIES) {
      let value = computed.getPropertyValue(property);
      if (!value) continue;
      // Resolve url(#...) fragments safely
      value = value.replace(/url\(["']?([^"')]+)["']?\)/g, (_match, url: string) => {
        const fragment = url.indexOf('#');
        if (fragment >= 0 && (url.startsWith('#') || url.slice(0, fragment) === svg.ownerDocument.URL.split('#')[0])) {
          return `url(${url.slice(fragment)})`;
        }
        return `url(${url})`;
      });
      target.style.setProperty(property, value);
    }
  }

  // Remove potential script tags or unsafe elements from export copy
  for (const element of copy.querySelectorAll('script, iframe, object, embed, link, meta')) {
    element.remove();
  }

  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', String(width));
  copy.setAttribute('height', String(height));
  copy.style.setProperty('width', `${width}px`);
  copy.style.setProperty('height', `${height}px`);
  for (const property of ['max-width', 'max-height', 'min-width']) {
    copy.style.removeProperty(property);
  }

  return { svg: new XMLSerializer().serializeToString(copy), width, height };
}

/** Rasterizes a self-contained SVG snapshot to PNG Blob using Canvas. */
export async function diagramPng(image: DiagramImage, canvas: HTMLCanvasElement): Promise<Blob> {
  const size = pngSize(image.width, image.height);
  const picture = new Image();
  let timer: number | undefined;
  picture.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(image.svg)}`;

  try {
    await Promise.race([
      picture.decode(),
      new Promise<never>((_resolve, reject) => {
        timer = window.setTimeout(() => reject(new Error('Image decoding timed out.')), 15_000);
      }),
    ]);
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image canvas is unavailable.');
    context.drawImage(picture, 0, 0, size.width, size.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode image.')), 'image/png');
    });
  } finally {
    window.clearTimeout(timer);
    picture.src = '';
    canvas.width = 0;
    canvas.height = 0;
  }
}
