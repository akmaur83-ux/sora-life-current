import { validateImageUpload } from './productMediaOperations.js';

const SOURCE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SOURCE_BYTES = 6 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 16 * 1000 * 1000;
const MAX_SOURCE_DIMENSION = 6000;
const MAX_OUTPUT_DIMENSION = 2400;
const VISIBLE_ALPHA = 12;
const ACCENT_ALPHA = 64;

export const PACKSHOT_PADDING_RATIO = 0.05;

const clampByte = (n) => Math.max(0, Math.min(255, Math.round(n)));
const hex = ([r, g, b]) => `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const mix = (a, b, amount) => a.map((v, i) => v + (b[i] - v) * amount);

function rgbToHsl(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  const l = (max + min) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return { h, s, l };
}

function nearWhite(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return min >= 225 && max - min <= 32;
}

function edgeBackgroundReference(data, width, height) {
  let opaque = 0, white = 0, r = 0, g = 0, b = 0;
  const visit = (x, y) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < VISIBLE_ALPHA) return;
    opaque += 1;
    if (!nearWhite(data[i], data[i + 1], data[i + 2])) return;
    white += 1; r += data[i]; g += data[i + 1]; b += data[i + 2];
  };
  for (let x = 0; x < width; x += 1) { visit(x, 0); if (height > 1) visit(x, height - 1); }
  for (let y = 1; y < height - 1; y += 1) { visit(0, y); if (width > 1) visit(width - 1, y); }
  if (!opaque || white / opaque < 0.35) return null;
  return [r / white, g / white, b / white];
}

function removeEdgeConnectedWhite(data, width, height) {
  const reference = edgeBackgroundReference(data, width, height);
  if (!reference) return 0;

  const total = width * height;
  const seen = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0, tail = 0, removed = 0;
  const qualifies = (p) => {
    const i = p * 4;
    if (data[i + 3] < VISIBLE_ALPHA) return false;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // Being pale is not enough: white caps and labels are real product pixels.
    // A removable pixel must closely match the near-white colour sampled from
    // the OUTER edge. The deliberately conservative tolerance may retain a
    // faint antialias fringe, but cannot flood through into pale packaging.
    const close = Math.max(
      Math.abs(r - reference[0]),
      Math.abs(g - reference[1]),
      Math.abs(b - reference[2]),
    ) <= 10;
    return close && Math.min(r, g, b) >= 225;
  };
  const add = (p) => {
    if (seen[p] || !qualifies(p)) return;
    seen[p] = 1; queue[tail++] = p;
  };
  for (let x = 0; x < width; x += 1) { add(x); if (height > 1) add((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y += 1) { add(y * width); if (width > 1) add(y * width + width - 1); }

  while (head < tail) {
    const p = queue[head++], x = p % width, y = Math.floor(p / width);
    data[p * 4 + 3] = 0; removed += 1;
    if (x > 0) add(p - 1);
    if (x + 1 < width) add(p + 1);
    if (y > 0) add(p - width);
    if (y + 1 < height) add(p + width);
  }
  return removed;
}

function visibleBounds(data, width, height) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < VISIBLE_ALPHA) continue;
      if (x < left) left = x; if (x > right) right = x;
      if (y < top) top = y; if (y > bottom) bottom = y;
    }
  }
  return right < left ? null : { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

export function representativeAccent(data, width, height) {
  const bins = Array.from({ length: 24 }, () => ({ score: 0, r: 0, g: 0, b: 0, weight: 0 }));
  const stride = Math.max(1, Math.floor(Math.sqrt((width * height) / 150000)));
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < ACCENT_ALPHA) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (nearWhite(r, g, b) || Math.max(r, g, b) < 38) continue;
      const { h, s, l } = rgbToHsl(r, g, b);
      if (s < 0.14 || l < 0.12 || l > 0.9) continue;
      const weight = Math.pow(s, 1.35) * (0.55 + 0.45 * (1 - Math.abs(l - 0.54)));
      const bin = bins[Math.min(23, Math.floor(h / 15))];
      bin.score += weight; bin.weight += weight;
      bin.r += r * weight; bin.g += g * weight; bin.b += b * weight;
    }
  }
  const winner = bins.reduce((best, bin) => (bin.score > best.score ? bin : best), bins[0]);
  if (!winner.weight) return [111, 127, 109];
  return [winner.r / winner.weight, winner.g / winner.weight, winner.b / winner.weight].map(clampByte);
}

export function pastelThemeFromAccent(accent) {
  const warmIvory = [250, 247, 240];
  const background = mix(warmIvory, accent, 0.12);
  const start = mix(warmIvory, accent, 0.07);
  const end = mix(warmIvory, accent, 0.21);
  return {
    accent: hex(accent),
    background: hex(background),
    gradient: `linear-gradient(168deg, ${hex(start)} 0%, ${hex(end)} 100%)`,
  };
}

/**
 * Pure pixel core shared by the browser importer and offline regression/QA.
 * White is removed only when connected to a near-white outer edge. Internal
 * white packaging and label pixels therefore survive.
 */
export function normalizePackshotPixels(input, width, height, { paddingRatio = PACKSHOT_PADDING_RATIO } = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('Packshot dimensions are invalid.');
  }
  if (!input || input.length !== width * height * 4) throw new Error('Packshot pixel data is invalid.');
  const data = new Uint8ClampedArray(input);
  const removedPixels = removeEdgeConnectedWhite(data, width, height);
  const bounds = visibleBounds(data, width, height);
  if (!bounds) throw new Error('No visible product remains after background cleanup.');

  const pad = Math.max(2, Math.ceil(Math.max(bounds.width, bounds.height) * Math.min(0.06, Math.max(0.04, paddingRatio))));
  const outputWidth = bounds.width + pad * 2;
  const outputHeight = bounds.height + pad * 2;
  const output = new Uint8ClampedArray(outputWidth * outputHeight * 4);
  for (let y = 0; y < bounds.height; y += 1) {
    const sourceStart = ((bounds.top + y) * width + bounds.left) * 4;
    const targetStart = ((y + pad) * outputWidth + pad) * 4;
    output.set(data.subarray(sourceStart, sourceStart + bounds.width * 4), targetStart);
  }
  const accent = representativeAccent(output, outputWidth, outputHeight);
  return {
    data: output,
    width: outputWidth,
    height: outputHeight,
    theme: pastelThemeFromAccent(accent),
    stats: {
      sourceWidth: width, sourceHeight: height, removedPixels,
      backgroundRemoved: removedPixels > 0, bounds, padding: pad,
      outputWidth, outputHeight, accent: hex(accent),
    },
  };
}

function canvas(width, height) {
  if (typeof document === 'undefined') throw new Error('Packshot processing requires a browser.');
  const el = document.createElement('canvas'); el.width = width; el.height = height; return el;
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
  }
  const url = URL.createObjectURL(file);
  const image = new Image(); image.decoding = 'async'; image.src = url;
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('This image could not be decoded.')); });
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

const toPng = (el) => new Promise((resolve, reject) => {
  el.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The normalized PNG could not be created.'))), 'image/png');
});

export async function processSpotlightPackshot(file) {
  await validateImageUpload(file, {
    allowedTypes: SOURCE_TYPES, maxBytes: MAX_SOURCE_BYTES,
    maxPixels: MAX_SOURCE_PIXELS, maxDimension: MAX_SOURCE_DIMENSION,
  });
  const decoded = await decode(file);
  try {
    const sourceCanvas = canvas(decoded.width, decoded.height);
    const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!sourceCtx) throw new Error('Image processing is not available in this browser.');
    sourceCtx.drawImage(decoded.source, 0, 0);
    const pixels = sourceCtx.getImageData(0, 0, decoded.width, decoded.height);
    const normalized = normalizePackshotPixels(pixels.data, decoded.width, decoded.height);

    const rawCanvas = canvas(normalized.width, normalized.height);
    const rawCtx = rawCanvas.getContext('2d');
    const out = rawCtx.createImageData(normalized.width, normalized.height);
    out.data.set(normalized.data); rawCtx.putImageData(out, 0, 0);

    const scale = Math.min(1, MAX_OUTPUT_DIMENSION / Math.max(normalized.width, normalized.height));
    const finalCanvas = scale < 1
      ? canvas(Math.max(1, Math.round(normalized.width * scale)), Math.max(1, Math.round(normalized.height * scale)))
      : rawCanvas;
    if (scale < 1) finalCanvas.getContext('2d').drawImage(rawCanvas, 0, 0, finalCanvas.width, finalCanvas.height);
    const blob = await toPng(finalCanvas);
    const name = `${String(file.name || 'packshot').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 100) || 'packshot'}.png`;
    const processedFile = typeof File === 'function'
      ? new File([blob], name, { type: 'image/png', lastModified: Date.now() })
      : Object.assign(blob, { name });
    return { file: processedFile, theme: normalized.theme, stats: normalized.stats };
  } finally {
    decoded.close();
  }
}
