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
  assert.equal(lib.TAJ_LISTING, '/fashion/c/leather-jackets');
});
test('the range reads only their in-stock fashion rows', async () => {
  const calls = [];
  const q = new Proxy({}, { get: (t, k) => (k === 'then' ? undefined : (...a) => { calls.push([k, ...a]); return k === 'limit' ? Promise.resolve({ data: [{ id: 1 }], error: null }) : q; }) });
  const rows = await lib.fetchTajRows({ from: (t) => { calls.push(['from', t]); return q; } });
  assert.deepEqual(rows, [{ id: 1 }]);
  const flat = calls.map((c) => c.join(':'));
  for (const c of ['from:catalogue_products', 'eq:store:fashion', 'eq:brand:Taj Leather', 'eq:is_active:true', 'gt:stock:0']) assert.ok(flat.includes(c), c);
});
test('wired: posters lead the Fashion home and follow Atomy on the wellness homepage; both editable', () => {
  const fs = read('src/fashion/FashionHome.jsx');
  assert.ok(fs.indexOf('<TajLeatherPosters />') > fs.indexOf('<CategoryChips />') && fs.indexOf('<TajLeatherPosters />') < fs.indexOf('<BagReminder'));
  assert.match(fs, /<TajLeatherRange \/>/);
  const home = read('src/pages/Home.jsx');
  assert.ok(home.indexOf('<TajLeatherPosters />') > home.indexOf('<AtomyShowcase />'));
  const c = read('src/lib/storefrontContent.js');
  assert.match(c, /tajPosters: group\(/); assert.match(c, /tajLeather: group\(/);
  assert.match(read('src/lib/tajLeather.js'), /laptop\|bag/);
});

if (failed) { console.log(`\n${failed} FAIL`); process.exit(1); }
console.log('\nall passed');
