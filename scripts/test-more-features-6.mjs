// More features (owner, 2026-11-13): Buy it again on My Orders, a bulk-price ask on
// product pages, Our Brands, Complete the look, Find my size.
//   node scripts/test-more-features-6.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
import { BRANDS, brandImage } from '../src/lib/brands.js';
import { lookPicks } from '../src/lib/completeLook.js';
import { STATIC_PATHS } from '../api/sitemap.js';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('buy it again: in-stock, priced lines with their quantity (1–10); gone products skipped', () => {
  const src = read('src/pages/Account.jsx');
  assert.match(src, /export function buyAgainLines\(items\)/);
  assert.match(src, /addToCart\(product, qty\)/);
  assert.match(src, /Buy it again/);
});
test('bulk ask: a WhatsApp message naming the product, the quantity left to fill, the link', () => {
  const src = read('src/components/pdp/PdpDeliveryDate.jsx');
  const m = src.match(/export function bulkText\(name, href\) \{\n\s*return (`[^`]*`);/);
  assert.ok(m, 'bulkText');
  const bulkText = new Function('name', 'href', `return ${m[1]};`);
  const t = bulkText(' Kullu Shawl ', 'https://www.soralifestyle.in/fashion/p/x');
  assert.match(t, /buy Kullu Shawl in bulk \(quantity: __\)/);
  assert.match(t, /https:\/\/www.soralifestyle.in\/fashion\/p\/x$/);
  assert.match(src, /pdpk-ask--bulk/);
});
test('our brands: the six partners, each opening the listing its homepage section opens', () => {
  assert.deepEqual(BRANDS.map((b) => b.name), ['Biosash', 'Atomy', 'Weavers Villa', 'Leather Factory', 'Taj Leather', 'Ansari Fashion']);
  const lst = (f, k) => read(`src/lib/${f}`).match(new RegExp(`export const ${k} = '([^']+)'`))[1];
  assert.equal(BRANDS.find((b) => b.id === 'atomy').href, lst('atomy.js', 'ATOMY_LISTING'));
  assert.equal(BRANDS.find((b) => b.id === 'weavers-villa').href, lst('weaversVilla.js', 'WEAVERS_LISTING'));
  assert.equal(BRANDS.find((b) => b.id === 'leather-factory').href, lst('leatherFactory.js', 'LF_LISTING'));
  assert.equal(BRANDS.find((b) => b.id === 'taj-leather').href, lst('tajLeather.js', 'TAJ_LISTING'));
  assert.equal(BRANDS.find((b) => b.id === 'ansari-fashion').href, lst('ansariFashion.js', 'ANSARI_LISTING'));
  for (const b of BRANDS) if (b.image && b.image.startsWith('/')) assert.doesNotThrow(() => readFileSync(new URL(`..${b.image}`, import.meta.url)), b.image);
  assert.equal(brandImage(BRANDS[0], [{ image: 'a', stock: 0, b: 1 }, { image: 'b', stock: 2, b: 1 }], (p) => p.b === 1), 'b');
  assert.equal(brandImage(BRANDS[1], []), BRANDS[1].image);
});
test('our brands: routed, in the footer and the sitemap', () => {
  assert.match(read('src/App.jsx'), /<Route path="\/brands" element={<Brands \/>} \/>/);
  assert.match(read('src/components/Footer.jsx'), /<Link to="\/brands">Our brands<\/Link>/);
  assert.ok(STATIC_PATHS.includes('/brands'));
});
test('complete the look: the matching categories take turns; own category and out-of-stock left out', () => {
  const p = (key, slug, inStock = true) => ({ key, slug, inStock, price: 100, image: 'x', href: `/fashion/p/${key}`, name: key });
  const pool = [p('s2', 'suits-dress-materials'), p('d1', 'dupattas-phulkari'), p('d2', 'dupattas-phulkari'), p('sh1', 'womens-shawls'), p('c1', 'clutches', false), p('h1', 'handbags')];
  assert.deepEqual(lookPicks(pool, { key: 's1', slug: 'suits-dress-materials' }).map((x) => x.key), ['d1', 'sh1', 'h1', 'd2']);
  assert.deepEqual(lookPicks(pool, { key: 'z', slug: 'unknown-thing' }), []);
  const j = lookPicks([p('b1', 'belts'), p('w1', 'mens-wallets'), p('m1', 'mufflers-caps')], { key: 'j', slug: 'mens-leather-jackets' });
  assert.deepEqual(j.map((x) => x.key), ['b1', 'w1', 'm1']);
  assert.match(read('src/fashion/FashionProductPage.jsx'), /<PdpLook items=\{lookPicks\(/);
});
test('find my size: the chart row that reaches the measurement; on a boundary the larger; outside the chart nothing', () => {
  const sg = loadModule('src/fashion/SizeGuide.jsx', { useEffect: () => {}, useRef: () => ({}), useState: (v) => [v, () => {}], Icon: () => null });
  const { suggestSize, SIZE_CHART } = sg;
  assert.equal(suggestSize(SIZE_CHART.women, 33), 'S');
  assert.equal(suggestSize(SIZE_CHART.women, 34), 'M');
  assert.equal(suggestSize(SIZE_CHART.women, '35.5'), 'M');
  assert.equal(suggestSize(SIZE_CHART.men, 41), 'L');
  assert.equal(suggestSize(SIZE_CHART.men, 46), 'XXL');
  assert.equal(suggestSize(SIZE_CHART.men, 60), '');
  assert.equal(suggestSize(SIZE_CHART.women, ''), '');
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
