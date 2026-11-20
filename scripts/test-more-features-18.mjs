// Round 18 (owner, 2026-11-20): what the site audit found — a hover photo that fails
// drops out, disabled buy buttons readable — and the admin's photo check.
//   node scripts/test-more-features-18.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

await test('a hover photo that does not load is removed, on both stores\' cards', () => {
  assert.match(read('src/fashion/FashionProductCard.jsx'), /className="fs-card__alt"[^>]*onError=\{\(e\) => \{ e\.currentTarget\.remove\(\); \}\}/);
  assert.match(read('src/homeliving/HomeLivingProductCard.jsx'), /className="hl-card__alt"[^>]*onError=\{\(e\) => \{ e\.currentTarget\.remove\(\); \}\}/);
});
await test('disabled buy buttons: #666B6B on #F0F2F2, above 4.5:1', () => {
  const lum = (h) => { const [r, g, b] = h.match(/\w\w/g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (lum('F0F2F2') + 0.05) / (lum('666B6B') + 0.05);
  assert.ok(ratio > 4.5, ratio.toFixed(2));
  assert.match(read('src/styles/sora-ds.css'), /\.fs \.fs-pdp__bar \.fs-btn--buy:disabled \{ color: #666B6B; \}/, 'outranks fashion.css, which loads after this sheet');
});
await test('photo check: the main picture of each product, failures listed by name', async () => {
  const i = loadModule('src/admin/pages/Insights.jsx', { useEffect: () => {}, useState: (x) => [x, () => {}], supabase: null, money: String, toCsv: () => '', downloadCsv: () => {} });
  const rows = [{ name: 'B', store: 'fashion', slug: 'b', images: ['ok.jpg'] }, { name: 'A', store: 'homeliving', slug: 'a', images: ['dead.jpg', 'ok.jpg'] }, { name: 'C', store: 'fashion', slug: 'c', images: [] }];
  const seen = [];
  const bad = await i.checkPhotos(rows, async (u) => { seen.push(u); return u !== 'dead.jpg'; }, 2);
  assert.deepEqual(bad.map((r) => [r.name, r.url]), [['A', 'dead.jpg']]);
  assert.deepEqual(seen.sort(), ['dead.jpg', 'ok.jpg'], 'only main pictures, none for a product without one');
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
