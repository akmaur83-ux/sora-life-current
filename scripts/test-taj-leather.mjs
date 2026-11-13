// Taj Leather (partner, 2026-11-11): Fashion › Leather Jackets, their posters and range
// on the wellness homepage and the Fashion home.   node scripts/test-taj-leather.mjs
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const lib = loadModule('src/lib/tajLeather.js', { useEffect: () => {}, useMemo: (f) => f(), useState: (v) => [v, () => {}], supabase: null, selectWeaversRange: (rows) => rows });

test('posters: their two jacket posters, served from this site, each opening its listing', () => {
  assert.deepEqual(lib.TAJ_POSTERS.map((p) => p.href), ['/fashion/c/mens-leather-jackets', '/fashion/c/womens-leather-jackets']);
  for (const p of lib.TAJ_POSTERS) {
    for (const f of [p.wide, p.tall].filter(Boolean)) { assert.match(f, /^\/img\/partners\/taj-leather\/[a-z-]+\.webp$/); assert.ok(existsSync(new URL(`..${f}`, import.meta.url)), f); }
    assert.ok(p.alt.length > 10);
  }
  assert.equal(lib.TAJ_LISTING, '/fashion/search?q=taj%20leather');
});
test('the range reads only their in-stock fashion rows', async () => {
  const calls = [];
  const q = new Proxy({}, { get: (t, k) => (k === 'then' ? undefined : (...a) => { calls.push([k, ...a]); return k === 'limit' ? Promise.resolve({ data: [{ id: 1 }], error: null }) : q; }) });
  const rows = await lib.fetchTajRows({ from: (t) => { calls.push(['from', t]); return q; } });
  assert.deepEqual(rows, [{ id: 1 }]);
  const flat = calls.map((c) => c.join(':'));
  for (const c of ['from:catalogue_products', 'eq:store:fashion', 'eq:brand:Taj Leather', 'eq:is_active:true', 'gt:stock:0']) assert.ok(flat.includes(c), c);
});
test('wired: posters lead the Fashion home; on the wellness homepage through the brands row (2026-11-13 redesign); both editable', () => {
  const fs = read('src/fashion/FashionHome.jsx');
  assert.ok(fs.indexOf('<TajLeatherPosters />') > fs.indexOf('<CategoryChips />') && fs.indexOf('<TajLeatherPosters />') < fs.indexOf('<BagReminder'));
  assert.match(fs, /<TajLeatherRange \/>/);
  const home = read('src/pages/Home.jsx');
  // Owner, 2026-11-13: the posters back on the homepage, straight under the brands row (which sits under the festive gifting).
  assert.ok(home.indexOf('<FestivePromo />') < home.indexOf('<BrandCarousel />') && home.indexOf('<BrandCarousel />') < home.indexOf('<TajLeatherPosters />') && home.split('<TajLeatherPosters />').length === 2);
  assert.match(read('src/lib/brands.js'), /id: 'taj-leather', luxe: true, page: '\/brands\/taj-leather'/);
  const c = read('src/lib/storefrontContent.js');
  assert.match(c, /tajPosters: group\(/); assert.match(c, /tajLeather: group\(/);
  assert.match(read('src/lib/tajLeather.js'), /laptop\|bag/);
});

// The Fashion store passed a thousand-row read with this partner: it must read in pages.
{
  const api = loadModule('src/lib/fashionApi.js', { supabase: null, FASHION_STORE: 'fashion', fashionCategoryToRow: (x) => x, fashionProductToRow: (x) => x, fashionVariantToRow: (x) => x });
  const ranges = [];
  const chain = (from) => new Proxy({}, { get: (t, k) => (k === 'then' ? undefined : (...a) => {
    if (k === 'range') { ranges.push(a); const n = a[0] < 2000 ? 1000 : 5; return Promise.resolve({ data: Array.from({ length: n }, (_, i) => ({ id: `p${a[0] + i}` })), error: null }); }
    return chain(from);
  }) });
  const realSupabase = { from: () => chain() };
  const api2 = loadModule('src/lib/fashionApi.js', { supabase: realSupabase, FASHION_STORE: 'fashion', fashionCategoryToRow: (x) => x, fashionProductToRow: (x) => x, fashionVariantToRow: (x) => x });
  const rows = await api2.getFashionProducts();
  test('the Fashion catalogue reads every active product, a thousand at a time', () => {
    assert.equal(rows.length, 2005);
    assert.deepEqual(ranges, [[0, 999], [1000, 1999], [2000, 2999]]);
    assert.ok(api.FASHION_PAGE === 1000);
  });
}

if (failed) { console.log(`\n${failed} FAIL`); process.exit(1); }
console.log('\nall passed');
