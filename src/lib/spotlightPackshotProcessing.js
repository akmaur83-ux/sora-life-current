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

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * Ground tuning, named and in one place so the palette stays adjustable.
 *
 * `lumFloor` is not a taste value like the others: it is the relative-luminance
 * budget the muted text needs. --cspot-ink-mute (#232E26) clears 4.5:1 at
 * luminance 0.30, so no stop of any gradient may fall below it. Change the ink
 * and this number has to be recomputed with it.
 */
const GROUND = {
  satMul: 0.80,       // how much of the accent's own saturation carries through
  satAdd: 0.34,       // floor lift, so a muted accent still reads as a colour
  satMin: 0.52,
  satMax: 0.72,
  greenTrim: 0.30,    // see hueSaturationTrim
  lightTop: 0.675,    // HSL lightness for an already-light accent
  lightSpread: 0.095, // a deeper accent earns a deeper ground
  gradientLift: 0.060,
  gradientDrop: 0.070,
  lumFloor: 0.300,    // the text-contrast budget; see above
};

const channelLuminance = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance, 0-1, from 0-255 channels. */
function relativeLuminance([r, g, b]) {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/**
 * At one HSL saturation a yellow-green carries far more apparent chroma than a
 * rose or a violet does. A single ceiling therefore either lets the greens go
 * acid or holds every other hue back: at satMax 0.86 the aloe accents resolved
 * to #C1F677 and #0FC556 — lime and electric emerald — while the same ceiling
 * left the corals looking unfinished. This trims the ceiling smoothly through
 * the green-yellow band only, deepest around 110 degrees.
 */
function hueSaturationTrim(hue) {
  const bandwidth = 85;
  const distance = Math.min(Math.abs((((hue - 110) + 540) % 360) - 180), bandwidth) / bandwidth;
  return 1 - GROUND.greenTrim * Math.cos((distance * Math.PI) / 2);
}

/**
 * Raise a lightness until the colour clears the luminance floor. Only ever
 * lightens: a colour already above the floor is returned untouched, so the
 * floor can never wash out a hue that did not need protecting.
 */
function liftToLuminanceFloor(hue, sat, light) {
  if (relativeLuminance(hslToRgb(hue, sat, light)) >= GROUND.lumFloor) return light;
  let low = light, high = 1;
  for (let i = 0; i < 22; i += 1) {
    const mid = (low + high) / 2;
    if (relativeLuminance(hslToRgb(hue, sat, mid)) < GROUND.lumFloor) low = mid; else high = mid;
  }
  return high;
}

/**
 * A premium ground derived from the product's own accent.
 *
 * Built in HSL rather than by mixing toward ivory. A flat mix pulls every hue
 * toward the same pale point, which is why ten Hair Care products once landed
 * in one narrow grey-green/grey-beige band — #DDE4D8 beside #E6E7DA beside
 * #E2E6DE, barely distinguishable as the carousel advanced.
 *
 * Colour decides the depth and accessibility only ever vetoes going too dark.
 * Two alternatives were measured against the ten real Hair Care packshots and
 * rejected:
 *
 *  - Raising saturation uniformly. The greens reached #C1F677 while the corals
 *    barely moved, because apparent chroma is hue-dependent. hueSaturationTrim
 *    is the fix.
 *  - Choosing lightness by solving for a fixed relative luminance. That makes
 *    contrast identical on every slide, but it also forces reds light (red is
 *    dark per unit chroma) and greens dark, so the corals washed out to #EBC4B9
 *    exactly where they needed to be strongest.
 *
 * So the tone is set in HSL and then clamped up to lumFloor. The gradient is
 * derived from its DARKEST stop rather than from the ground: clamping each
 * stop independently collapsed the gradient to a flat fill on reds, whose
 * ground already sat on the floor and so had nothing below it to fade into.
 * Pinning the end AT the floor and stacking the ground and start above it
 * gives every hue a real gradient and spends the whole contrast budget.
 *
 * Measured over the ten real packshots: average chroma 111 (was 60, and 33
 * before that), minimum 85, and every stop of every gradient holds 5.5:1 for
 * the title ink, 4.7:1 for the muted ink and 4.1:1 for the CTA pill.
 */
export function groundThemeFromAccent(accent) {
  const { h, s, l } = rgbToHsl(accent[0], accent[1], accent[2]);
  const trim = hueSaturationTrim(h);
  const sat = Math.min(GROUND.satMax * trim, Math.max(GROUND.satMin * trim, s * GROUND.satMul + GROUND.satAdd));
  const base = GROUND.lightTop - GROUND.lightSpread * (1 - l);

  // One colour at three depths, so the stage reads as a single lit surface
  // rather than two unrelated mixes.
  const endLight = liftToLuminanceFloor(h, sat, base - GROUND.gradientDrop);
  const at = (light) => hslToRgb(h, sat, Math.min(0.94, light));
  const ground = at(endLight + GROUND.gradientDrop);
  const start = at(endLight + GROUND.gradientDrop + GROUND.gradientLift);
  const end = at(endLight);

  return {
    accent: hex(accent),
    background: hex(ground),
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
    theme: groundThemeFromAccent(accent),
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
