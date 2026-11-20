// More features (owner, 2026-11-20, round 15): more like what you viewed, most viewed in
// Insights, share the edits and gift ideas.
//   node scripts/test-more-features-15.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const pop = loadModule('src/lib/popular.js', { useEffect: () => {}, useState: (v) => [v, () => {}], supabase: null, cataloguePrice: () => 0 });
const v = loadModule('src/lib/viewedLike.js', { useEffect: () => {}, useState: (x) => [x, () => {}], supabase: null, cataloguePrice: (r) => Number(r.sale_price) || Number(r.mrp), viewOf: pop.viewOf });

test('seeds: the last product pages, newest first, no repeats, product pages only', () => {
  const recent = [{ href: '/fashion/p/a' }, { href: '/fashion/p/a' }, { href: '/offers' }, { href: '/product/w' }, { href: '/homeliving/p/h?x=1' }, { href: '/fashion/p/b' }, { href: '/fashion/p/c' }];
  assert.deepEqual(v.viewedSeeds(recent).map((s) => `${s.store}/${s.slug}`), ['fashion/a', 'wellness/w', 'homeliving/h', 'fashion/b']);
});
test('lanes take turns; viewed products and repeats left out; at most twelve', () => {
  const card = (s) => ({ slugKey: s, key: s });
  const out = v.interleave([[card('f/a'), card('f/x'), card('f/y')], [card('f/z'), card('f/x')]], new Set(['f/a']));
  assert.deepEqual(out.map((c) => c.slugKey), ['f/z', 'f/x', 'f/y']);
  const many = Array.from({ length: 30 }, (_, i) => card(`k${i}`));
  assert.equal(v.interleave([many]).length, 12);
});
test('catalogue lanes: in stock, with a picture and a price, in the seeds\' category order', () => {
  const rows = [{ id: 1, store: 'fashion', slug: 'x', name: 'X', images: ['i'], mrp: 900, stock: 2, category_id: 'c2' }, { id: 2, store: 'fashion', slug: 'y', name: 'Y', images: ['i'], mrp: 900, stock: 0, category_id: 'c1' }, { id: 3, store: 'homeliving', slug: 'z', name: 'Z', images: ['i'], mrp: 500, stock: 1, category_id: 'c1' }];
  const lanes = v.catalogueLanes([{ category_id: 'c1' }, { category_id: 'c2' }], rows);
  assert.deepEqual(lanes.map((l) => l.map((c) => c.href)), [['/homeliving/p/z'], ['/fashion/p/x']]);
  assert.match(read('src/pages/Home.jsx'), /<RecentlyViewedHome \/>\n.*\n      <ViewedLike \/>/);
  assert.equal(v.LIKE_MIN, 4);
});
test('insights: most viewed counts each row once, most first; links to the right store', () => {
  const i = loadModule('src/admin/pages/Insights.jsx', { useEffect: () => {}, useState: (x) => [x, () => {}], supabase: null, money: String, toCsv: () => '', downloadCsv: () => {} });
  assert.deepEqual(i.topViewed([{ store: 'fashion', slug: 'a' }, { store: 'fashion', slug: 'a' }, { store: 'wellness', slug: 'a' }, { store: 'fashion', slug: '' }]), [{ store: 'fashion', slug: 'a', n: 2 }, { store: 'wellness', slug: 'a', n: 1 }]);
  assert.equal(i.productHref('homeliving', 'q'), '/homeliving/p/q');
  assert.equal(i.productHref('wellness', 'q'), '/product/q');
});
test('share: on the three edits and the gift finder; the text carries the link', () => {
  const s = loadModule('src/components/PageShare.jsx', { useState: (x) => [x, () => {}], Icon: () => null });
  assert.equal(s.shareText('The Winter edit', 'https://x/y'), 'The Winter edit on SORA LIFESTYLE: https://x/y');
  assert.match(read('src/fashion/FashionEdit.jsx'), /<PageShare title=\{edit\.title\} \/>/);
  assert.match(read('src/fashion/WeddingEdit.jsx'), /<PageShare title="The Wedding & Festive edit" \/>/);
  assert.match(read('src/pages/Gifts.jsx'), /<PageShare title=\{`Gift ideas /);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
