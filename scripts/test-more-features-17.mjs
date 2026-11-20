// More features (owner, 2026-11-20, round 17): not-found pages that help, the Bedroom
// edit, the stock watch as CSV.
//   node scripts/test-more-features-17.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const n = loadModule('src/lib/notFoundHelp.js', {});

test('an old link\'s words: meaningful ones only, no repeats', () => {
  assert.deepEqual(n.slugWords('diamond-leather-rider-leather-biker-jacket-black'), ['diamond', 'leather', 'rider', 'biker', 'jacket', 'black']);
  assert.deepEqual(n.slugWords('mens-genuine-leather-belt-38-pack-of-2'), ['leather', 'belt']);
  assert.deepEqual(n.slugWords(''), []);
});
test('similar: two words in common (one for a one-word link), best first, live items only as given', () => {
  const items = [{ n: 'Black Leather Wallet' }, { n: 'Rider Leather Biker Jacket Black' }, { n: 'Cotton Suit' }, { n: 'Leather Belt' }];
  const t = (x) => x.n;
  assert.deepEqual(n.similarByWords(items, ['rider', 'leather', 'black'], t).map(t), ['Rider Leather Biker Jacket Black', 'Black Leather Wallet']);
  assert.deepEqual(n.similarByWords(items, ['belt'], t).map(t), ['Leather Belt']);
  assert.deepEqual(n.similarByWords(items, [], t), []);
  assert.equal(n.searchFor('fashion', ['rider', 'jacket']), '/fashion/search?q=rider%20jacket');
  assert.equal(n.searchFor('wellness', ['oil']), '/shop?q=oil');
  assert.match(read('src/fashion/FashionProductPage.jsx'), /similarByWords\(views\.filter\(\(v\) => v\.inStock\), slugWords\(slug\)/);
  assert.match(read('src/pages/NotFound.jsx'), /\/\^\\\/product\\\/\(\[\^\/\?#\]\+\)\//);
});
test('the Bedroom edit: Home & Living rows, Home & Living links', () => {
  const w = loadModule('src/lib/weddingEdit.js', { useEffect: () => {}, useMemo: (f) => f(), useState: (v) => [v, () => {}], supabase: null, cataloguePrice: (r) => Number(r.mrp) });
  const f = loadModule('src/lib/fashionEdits.js', { useEffect: () => {}, useMemo: (x) => x(), useState: (v) => [v, () => {}], supabase: null, weddingSections: w.weddingSections });
  const e = f.FASHION_EDITS.bedroom;
  assert.equal(e.store, 'homeliving');
  const s = f.editSections([{ id: 1, slug: 'oak-bed', name: 'Oak Bed', images: ['i'], mrp: 9000, stock: 2, category: { slug: 'beds' } }], e);
  assert.deepEqual(s.map((x) => [x.href, x.items[0].href, x.items[0].key]), [['/homeliving/category/beds', '/homeliving/p/oak-bed', 'homeliving-1']]);
  assert.match(read('src/lib/fashionEdits.js'), /\.eq\('store', edit\.store \|\| 'fashion'\)/);
  assert.match(read('src/App.jsx'), /<Route path="bedroom" element=\{<FashionEdit id="bedroom" \/>\} \/>/);
  assert.ok(read('api/sitemap.js').includes("'/homeliving/bedroom'"));
});
test('stock CSV: out first, then running low', () => {
  const i = loadModule('src/admin/pages/Insights.jsx', { useEffect: () => {}, useState: (x) => [x, () => {}], supabase: null, money: String, toCsv: (rows, cols) => rows.map((r) => cols.map(([, g]) => g(r)).join('|')), downloadCsv: () => {} });
  assert.deepEqual(i.stockCsv({ out: [{ name: 'A', store: 'fashion', brand: 'X', stock: 0 }], low: [{ name: 'B', store: 'wellness', brand: '', stock: 2 }] }), ['Out of stock|A|fashion|X|0', 'Running low|B|wellness||2']);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
