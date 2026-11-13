// New features (owner, 2026-11-13, round 8): /new (every new arrival), the Wedding &
// Festive edit, budget chips on /offers, live product counts on Our Brands, and
// "Can't find it? Ask us on WhatsApp" under an empty search.
//   node scripts/test-more-features-8.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
import { BRANDS, brandCounts } from '../src/lib/brands.js';
import { STATIC_PATHS } from '../api/sitemap.js';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('/new and the Wedding edit: routed, in the footer and the sitemap; the homepage row\'s View All opens /new', () => {
  const app = read('src/App.jsx');
  assert.match(app, /<Route path="\/new" element={<NewArrivalsPage \/>} \/>/);
  assert.match(app, /<Route path="wedding" element={<WeddingEdit \/>} \/>/);
  const footer = read('src/components/Footer.jsx');
  assert.match(footer, /<Link to="\/new">New arrivals<\/Link>/);
  assert.match(footer, /<Link to="\/fashion\/wedding">Wedding edit<\/Link>/);
  for (const p of ['/new', '/fashion/wedding']) assert.ok(STATIC_PATHS.includes(p), p);
  assert.match(read('src/components/NewArrivals.jsx'), /export const viewAllLink = \(link\) => link \|\| '\/new';/);
  assert.match(read('src/fashion/FashionHome.jsx'), /<WeddingStrip \/>/);
});
test('wedding edit: in-stock pieces of each section\'s categories, taking turns, eight at most; empty sections dropped', () => {
  const w = loadModule('src/lib/weddingEdit.js', { useEffect: () => {}, useMemo: (f) => f(), useState: (v) => [v, () => {}], supabase: null, cataloguePrice: (r) => Number(r.sale_price) || Number(r.mrp) || 0 });
  const row = (id, slug, extra = {}) => ({ id, slug: `p${id}`, name: `P${id}`, mrp: 1000, sale_price: 800, images: ['x.jpg'], stock: 1, category: { slug }, ...extra });
  const rows = [
    row(1, 'suits-dress-materials'), row(2, 'suits-dress-materials'), row(3, 'sarees'),
    row(4, 'dupattas-phulkari', { stock: 0, variants: [{ stock: 2, is_active: true }] }),
    row(5, 'womens-shawls', { stock: 0, variants: [{ stock: 0, is_active: true }] }),
    row(6, 'clutches', { images: [] }), row(7, 'mens-leather-jackets', { is_demo: true }),
    ...Array.from({ length: 12 }, (_, i) => row(100 + i, 'shawl-gift-sets')),
  ];
  const s = w.weddingSections(rows);
  assert.deepEqual(s.map((x) => x.id), ['outfits', 'drape', 'gifts']);
  assert.deepEqual(s[0].items.map((c) => c.key), ['fashion-1', 'fashion-3', 'fashion-2'], 'categories take turns');
  assert.deepEqual(s[1].items.map((c) => c.key), ['fashion-4'], 'stock read from the variants');
  assert.equal(s[2].items.length, 8);
  assert.equal(s[0].href, '/fashion/c/suits-dress-materials');
  assert.equal(s[0].items[0].price, 800);
});
test('offers: budget chips keep deals at or under the price; any price keeps all', () => {
  const offers = loadModule('src/pages/Offers.jsx', { useEffect: () => {}, useMemo: (f) => f(), useState: (v) => [v, () => {}], Link: () => null, useSearchParams: () => [new URLSearchParams(), () => {}], Icon: () => null, money: (n) => `₹${n}`, supabase: null, products: [], OfferBanner: () => null, LoadMore: () => null, useShowMore: () => ({}), useStorefrontSection: (s, p, d) => d, OFFER_COUNTDOWN: {}, parseIndiaTime: () => 0, offerShareText: () => '', usePageMeta: () => {} });
  const d = [{ price: 299 }, { price: 499 }, { price: 999 }, { price: 2500 }];
  assert.deepEqual(offers.underBudget(d, '499').map((x) => x.price), [299, 499]);
  assert.deepEqual(offers.underBudget(d, '1999').map((x) => x.price), [299, 499, 999]);
  assert.equal(offers.underBudget(d, '').length, 4);
  assert.deepEqual(offers.BUDGETS.map((b) => b.id), ['', '499', '999', '1999']);
});
test('brands: counts from the catalogue table for partner brands, from the loaded catalogue for wellness; unknown shows nothing', () => {
  const products = [{ slug: 'a', brand: 'Atomy' }, { slug: 'b', brand: 'Atomy' }, { slug: 'c', brand: 'Biosash' }, { slug: '', brand: 'Atomy' }];
  const c = brandCounts(products, (p) => p.brand, { 'Taj Leather': 508, 'Ansari Fashion': 135 });
  assert.equal(c.atomy, 2); assert.equal(c.biosash, 1);
  assert.equal(c['taj-leather'], 508); assert.equal(c['ansari-fashion'], 135);
  assert.equal(c['weavers-villa'], null);
  assert.ok(BRANDS.filter((b) => b.catalogueBrand).length === 4);
  assert.match(read('src/pages/Brands.jsx'), /counts\[b\.id\] \? ` · \$\{counts\[b\.id\]\} products` : ''/);
});
test('empty search: a WhatsApp ask with the search in it, on Fashion and Home & Living', () => {
  const src = read('src/components/FindForMe.jsx');
  const m = src.match(/export const findText = \(q\) => (`[^`]*`);/);
  const findText = new Function('q', `return ${m[1]};`);
  assert.equal(findText(' banarasi lehenga '), 'Hi SORA Lifestyle, I searched for “banarasi lehenga” on your site and couldn’t find it. Can you help me find it?');
  assert.match(read('src/fashion/FashionListing.jsx'), /emptyExtra=\{q \? <FindForMe q=\{q\} \/> : null\}/);
  assert.match(read('src/homeliving/HomeLivingSearch.jsx'), /<FindForMe q=\{q\} \/>/);
  assert.match(src, /if \(!n \|\| !String\(q \|\| ''\)\.trim\(\)\) return null;/);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
