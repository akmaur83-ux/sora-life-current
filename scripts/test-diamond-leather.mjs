// Diamond Leather (partner, 2026-11-16): their men's leather jackets on the Fashion home,
// their card on Our Brands and in the brand carousel, their brand page.
//   node scripts/test-diamond-leather.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = async (name, fn) => { try { await fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const dl = loadModule('src/lib/diamondLeather.js', { useEffect: () => {}, useMemo: (f) => f(), useState: (v) => [v, () => {}], supabase: null, selectWeaversRange: (r) => r });

await test('the range reads only their live, in-stock fashion rows; a failed read is none', async () => {
  const calls = [];
  const q = new Proxy({}, { get: (_, k) => (k === 'then' ? undefined : (...a) => { calls.push([k, ...a]); return k === 'limit' ? Promise.resolve({ data: [{ id: 1 }], error: null }) : q; }) });
  const rows = await dl.fetchDiamondRows({ from: (t) => { calls.push(['from', t]); return q; } });
  assert.deepEqual(rows, [{ id: 1 }]);
  const eq = calls.filter((c) => c[0] === 'eq').map((c) => c.slice(1));
  assert.deepEqual(eq, [['store', 'fashion'], ['brand', 'Diamond Leather'], ['is_active', true]]);
  assert.ok(calls.some((c) => c[0] === 'gt' && c[1] === 'stock' && c[2] === 0));
  const bad = new Proxy({}, { get: (_, k) => (k === 'then' ? undefined : () => (k === 'limit' ? Promise.resolve({ data: null, error: { message: 'x' } }) : bad)) });
  assert.deepEqual(await dl.fetchDiamondRows({ from: () => bad }), []);
});
await test('the brand card opens the same listing as the row; the row sits under Taj Leather on the Fashion home', () => {
  assert.equal(dl.DIAMOND_LISTING, '/fashion/search?q=diamond%20leather');
  const b = read('src/lib/brands.js');
  assert.match(b, /id: 'diamond-leather', page: '\/brands\/diamond-leather'.*catalogueBrand: 'Diamond Leather'.*href: '\/fashion\/search\?q=diamond%20leather'/);
  assert.match(read('src/fashion/FashionHome.jsx'), /<TajLeatherRange \/>\n.*\n      <DiamondLeatherRange \/>/);
  assert.match(read('src/lib/storefrontContent.js'), /diamondLeather: group\(\{/);
  assert.match(read('src/components/DiamondLeather.jsx'), /useStorefrontSection\('wellness', 'diamondLeather', DIAMOND_SECTION\)/);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
