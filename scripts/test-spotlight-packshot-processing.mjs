import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizePackshotPixels, groundThemeFromAccent, PACKSHOT_PADDING_RATIO,
} from '../src/lib/spotlightPackshotProcessing.js';

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  PASS  ${name}`); passed += 1; }
  catch (error) { console.log(`  FAIL  ${name}\n        ${error.message}`); failed += 1; }
};
const rgba = (width, height, color = [0, 0, 0, 0]) => {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) out.set(color, i * 4);
  return out;
};
const set = (data, width, x, y, color) => data.set(color, (y * width + x) * 4);

console.log('\n— Packshot normalization —');

test('N1 only edge-connected near-white is removed', () => {
  const width = 40, height = 50, data = rgba(width, height, [250, 250, 248, 255]);
  for (let y = 5; y <= 44; y += 1) for (let x = 10; x <= 29; x += 1) set(data, width, x, y, [220, 70, 25, 255]);
  // A white label enclosed by the product must remain white and opaque.
  for (let y = 20; y <= 29; y += 1) for (let x = 14; x <= 25; x += 1) set(data, width, x, y, [255, 255, 255, 255]);
  const out = normalizePackshotPixels(data, width, height);
  assert.ok(out.stats.removedPixels > 0);
  assert.deepEqual(out.stats.bounds, { left: 10, top: 5, right: 29, bottom: 44, width: 20, height: 40 });
  const labelX = out.stats.padding + 8, labelY = out.stats.padding + 20;
  assert.equal(out.data[(labelY * out.width + labelX) * 4 + 3], 255, 'internal white label survives');
});

test('N1b a pale package touching the canvas edge is not mistaken for background', () => {
  const width = 50, height = 60, data = rgba(width, height, [255, 255, 255, 255]);
  // A pale cap touches the top edge. Its small but real colour difference from
  // the sampled canvas must stop the flood-fill before it enters the product.
  for (let y = 0; y < 20; y += 1) for (let x = 15; x < 35; x += 1) set(data, width, x, y, [243, 241, 245, 255]);
  for (let y = 20; y < 55; y += 1) for (let x = 12; x < 38; x += 1) set(data, width, x, y, [220, 130, 30, 255]);
  const out = normalizePackshotPixels(data, width, height);
  assert.equal(out.stats.bounds.top, 0, 'the cap remains part of the visible product');
  const cap = ((out.stats.padding + 5) * out.width + out.stats.padding + 10) * 4;
  assert.equal(out.data[cap + 3], 255, 'pale cap pixels remain opaque');
});

test('N2 transparent excess is cropped with five percent breathing room', () => {
  const width = 200, height = 300, data = rgba(width, height);
  for (let y = 50; y < 250; y += 1) for (let x = 70; x < 130; x += 1) set(data, width, x, y, [40, 150, 70, 255]);
  const out = normalizePackshotPixels(data, width, height);
  assert.equal(out.stats.backgroundRemoved, false);
  assert.equal(out.stats.padding, 10);
  assert.equal(out.width, 80);
  assert.equal(out.height, 220);
  assert.equal(PACKSHOT_PADDING_RATIO, 0.05);
});

// Contrast, not channel floors. The grounds used to be near-white and an
// "every channel >= 190" test was a fair proxy for "text will be readable on
// this". They are mid-tone now, so that proxy would only ever measure how pale
// the palette is. These helpers measure the thing that actually matters.
const chan = (hex) => hex.match(/[0-9A-F]{2}/g).map((v) => parseInt(v, 16));
const relLum = (hex) => {
  const [r, g, b] = chan(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const x = relLum(a), y = relLum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
// The three things that sit on the dome, read from the stylesheet so a change
// there cannot silently invalidate these numbers.
const spotlightCss = readFileSync(new URL('../src/styles/category-spotlight.css', import.meta.url), 'utf8');
const INK_TITLE = '#16211B';
const INK_MUTE = spotlightCss.match(/--cspot-ink-mute:\s*(#[0-9A-Fa-f]{6})/)[1].toUpperCase();
const CTA_PILL = '#1E3A2F';
// Every stop a viewer's eye actually lands on: the flat ground and both ends
// of the gradient that replaces it.
const stopsOf = (theme) => [theme.background, ...theme.gradient.match(/#[0-9A-F]{6}/g)];

test('N3 accent-derived themes are colourful, distinct and readable', () => {
  const themes = [
    groundThemeFromAccent([230, 90, 20]),
    groundThemeFromAccent([45, 140, 70]),
    groundThemeFromAccent([125, 65, 165]),
  ];
  assert.equal(new Set(themes.map((t) => t.background)).size, 3);
  for (const theme of themes) {
    assert.match(theme.background, /^#[0-9A-F]{6}$/);
    assert.match(theme.gradient, /^linear-gradient\(168deg, #[0-9A-F]{6} 0%, #[0-9A-F]{6} 100%\)$/);
    for (const stop of stopsOf(theme)) {
      assert.ok(contrast(stop, INK_TITLE) >= 4.5,
        `${stop}: product title only reaches ${contrast(stop, INK_TITLE).toFixed(2)}:1`);
      assert.ok(contrast(stop, INK_MUTE) >= 4.5,
        `${stop}: muted text (${INK_MUTE}) only reaches ${contrast(stop, INK_MUTE).toFixed(2)}:1`);
      // The CTA is a filled pill, not text: WCAG asks 3:1 of a UI shape.
      assert.ok(contrast(stop, CTA_PILL) >= 3,
        `${stop}: the CTA pill only reaches ${contrast(stop, CTA_PILL).toFixed(2)}:1`);
    }
  }
});

test('N4 the browser importer validates, normalizes, encodes PNG and never uploads itself', () => {
  const source = readFileSync(new URL('../src/lib/spotlightPackshotProcessing.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(source, /validateImageUpload\(file/);
  assert.match(source, /normalizePackshotPixels\(pixels\.data/);
  assert.match(source, /toBlob[\s\S]{0,220}['"]image\/png['"]/);
  assert.doesNotMatch(source, /supabase|\.storage\.|fetch\(/i, 'preprocessing performs no network I/O');
});

test('N3b the ground carries real colour and keeps the accent hue', () => {
  // The grounds used to be a flat 12% mix toward ivory, which pulled every hue
  // toward one pale point: ten real Hair Care products landed on #DDE4D8,
  // #E6E7DA, #E2E6DE — a narrow grey band you could not tell apart as the
  // carousel advanced. These assertions are what stop that returning.
  const chroma = (hex) => { const c = chan(hex); return Math.max(...c) - Math.min(...c); };
  const hueOf = (r, g, b) => {
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return null;
    let x = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (x * 60 + 360) % 360;
  };
  const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

  // Real accents measured from the actual Hair Care packshots.
  const accents = {
    aloeGreen: [0x6C, 0x99, 0x2D],
    sesameAmber: [0xDF, 0x93, 0x1D],
    serumCoral: [0xD7, 0x74, 0x59],
    avocadoTeal: [0x35, 0x68, 0x5D],
    pomadeForest: [0x0C, 0x56, 0x29],
    cocoaRose: [0x40, 0x16, 0x1B],
  };

  for (const [label, accent] of Object.entries(accents)) {
    const theme = groundThemeFromAccent(accent);
    // 80 sits above everything the two previous, paler formulas could produce
    // (their weakest grounds were chroma 27 and 48) and below the weakest this
    // one does (85), so reverting the constants fails here rather than passing
    // quietly.
    assert.ok(chroma(theme.background) >= 80,
      `${label}: ground ${theme.background} has chroma ${chroma(theme.background)}, too washed out`);
    const [r, g, b] = chan(theme.background);
    assert.ok(hueGap(hueOf(r, g, b), hueOf(...accent)) <= 22,
      `${label}: ground ${theme.background} drifted off the accent's hue`);
    // Premium, not neon: the ground must stay a tint, never a fully saturated
    // signal colour, and the packshot must remain the brightest thing on it.
    assert.ok(Math.max(r, g, b) >= 190,
      `${label}: ${theme.background} is too dark to sit a cutout on`);
    assert.ok(Math.min(r, g, b) >= 55,
      `${label}: ${theme.background} has a channel at ${Math.min(r, g, b)} — that is a signal colour, not a ground`);
    // And it must stay readable at every depth of its own gradient.
    for (const stop of stopsOf(theme)) {
      assert.ok(contrast(stop, INK_MUTE) >= 4.5,
        `${label}: ${stop} gives muted text only ${contrast(stop, INK_MUTE).toFixed(2)}:1`);
    }
  }

  // A green must not be allowed to go acid while the corals stay timid. This
  // is what the hue-aware saturation ceiling exists for: with one flat ceiling
  // the aloe accents resolved to #C1F677 and #0FC556 — lime and electric
  // emerald — because apparent chroma is hue-dependent. Both of these accents
  // are saturated enough to sit ON the ceiling, so if the ceiling stops
  // varying by hue they land at the same HSL saturation as the corals and this
  // fails.
  const satOf = (hex) => {
    const [r, g, b] = chan(hex).map((v) => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    return d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  };
  const warm = satOf(groundThemeFromAccent(accents.serumCoral).background);
  for (const key of ['aloeGreen', 'pomadeForest']) {
    const green = groundThemeFromAccent(accents[key]).background;
    assert.ok(satOf(green) <= warm - 0.08,
      `${key}: ground ${green} sits at saturation ${satOf(green).toFixed(2)} against the coral's ${warm.toFixed(2)} — the green band is not being trimmed`);
  }

  // The gradient must add real vertical depth, not two near-identical stops.
  const grad = groundThemeFromAccent(accents.aloeGreen).gradient;
  const stops = grad.match(/#[0-9A-F]{6}/g);
  assert.equal(stops.length, 2);
  const lum = (hex) => { const [r, g, b] = chan(hex); return 0.299 * r + 0.587 * g + 0.114 * b; };
  assert.ok(lum(stops[0]) - lum(stops[1]) >= 12, 'the gradient reads as one lit surface, not a flat fill');

  // Reds sit on the luminance floor, so their gradient is the one that
  // collapses if the stops are clamped independently instead of stacked above
  // the darkest one. Check the flattest case, not just the roomiest.
  const rose = groundThemeFromAccent(accents.cocoaRose).gradient.match(/#[0-9A-F]{6}/g);
  assert.ok(lum(rose[0]) - lum(rose[1]) >= 12,
    `the rose gradient collapsed to ${rose[0]} -> ${rose[1]}`);

  // Two products from the same hue family must still be separable.
  const a = groundThemeFromAccent(accents.aloeGreen).background;
  const b = groundThemeFromAccent(accents.pomadeForest).background;
  const spread = chan(a).reduce((n, v, i) => n + Math.abs(v - chan(b)[i]), 0);
  assert.ok(spread >= 30, `two greens resolved to ${a} and ${b}, too close to tell apart`);
});

test('N5 removal follows the SAMPLED border colour, not "anything pale"', () => {
  // The bug this guards: a generic near-white test shaves pale product pixels
  // that happen to touch the canvas. Here the canvas is a warm off-white and
  // the cap is a COOLER off-white — both are "near white", but only one is
  // the background, and only that one may go.
  const width = 60, height = 60, data = rgba(width, height, [252, 250, 244, 255]);
  for (let y = 0; y < 30; y += 1) for (let x = 20; x < 40; x += 1) set(data, width, x, y, [240, 244, 252, 255]);
  for (let y = 30; y < 55; y += 1) for (let x = 18; x < 42; x += 1) set(data, width, x, y, [200, 90, 40, 255]);
  const out = normalizePackshotPixels(data, width, height);
  assert.ok(out.stats.removedPixels > 0, 'the warm canvas is removed');
  assert.equal(out.stats.bounds.top, 0, 'the cool cap is kept, so the product still reaches the top edge');
  const cap = ((out.stats.padding + 4) * out.width + out.stats.padding + 10) * 4;
  assert.equal(out.data[cap + 3], 255, 'and its pixels stay fully opaque');
});

test('N6 a source with no recognisable background is left alone but still cropped', () => {
  // A photographic/lifestyle source has no uniform border, so nothing may be
  // deleted — the processor must degrade to a pure crop rather than guessing.
  const width = 40, height = 40, data = rgba(width, height, [90, 120, 140, 255]);
  for (let y = 10; y < 30; y += 1) for (let x = 10; x < 30; x += 1) set(data, width, x, y, [200, 80, 40, 255]);
  const out = normalizePackshotPixels(data, width, height);
  assert.equal(out.stats.removedPixels, 0, 'no background reference means no deletion');
  assert.equal(out.stats.backgroundRemoved, false);
  assert.equal(out.stats.bounds.width, 40, 'everything is still visible, so nothing is cropped away');
});

test('N7 the storefront performs no runtime pixel analysis', () => {
  // All of this is import-time, in Admin. The customer-facing stage must never
  // read pixels: no canvas, no getImageData, no colour extraction.
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const file of [
    '../src/components/category/CategorySpotlight.jsx',
    '../src/lib/categoryExperience.js',
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /getImageData|createImageBitmap|createElement\(['"]canvas|OffscreenCanvas/i,
      `${file} must not touch pixels at runtime`);
    assert.doesNotMatch(source, /spotlightPackshotProcessing/,
      `${file} must not even import the import-time processor`);
  }
  // And the processor is only ever reached from the Admin importer.
  const importer = read('../src/admin/components/BulkPackshotImport.jsx');
  assert.match(importer, /processSpotlightPackshot\(row\.file\)/,
    'preprocessing runs in the Admin importer, before the existing upload');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed ? 1 : 0;
