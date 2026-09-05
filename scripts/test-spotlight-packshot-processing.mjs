import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizePackshotPixels, pastelThemeFromAccent, PACKSHOT_PADDING_RATIO,
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

test('N3 accent-derived themes are light, restrained and visibly distinct', () => {
  const themes = [
    pastelThemeFromAccent([230, 90, 20]),
    pastelThemeFromAccent([45, 140, 70]),
    pastelThemeFromAccent([125, 65, 165]),
  ];
  assert.equal(new Set(themes.map((t) => t.background)).size, 3);
  for (const theme of themes) {
    assert.match(theme.background, /^#[0-9A-F]{6}$/);
    assert.match(theme.gradient, /^linear-gradient\(168deg, #[0-9A-F]{6} 0%, #[0-9A-F]{6} 100%\)$/);
    const channels = theme.background.match(/[0-9A-F]{2}/g).map((v) => parseInt(v, 16));
    assert.ok(channels.every((v) => v >= 190), `${theme.background} remains pastel`);
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
