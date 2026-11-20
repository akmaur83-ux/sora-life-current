// Winter deals band (owner, 2026-11-20: "winter theme ... animation ke sath").
//   node scripts/test-winter-deals.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const w = loadModule('src/lib/winterDeals.js', { useEffect: () => {}, useState: (v) => [v, () => {}], supabase: null, cataloguePrice: (r) => { const m = Number(r.mrp); const s = r.sale_price == null ? null : Number(r.sale_price); return s != null && s > 0 && s < m ? s : m; } });
const row = (slug, cat, mrp, sale, extra = {}) => ({ slug, name: `${slug} - Black`, mrp, sale_price: sale, images: [`https://cdn/${slug}.jpg`], stock: 5, category: { slug: cat }, ...extra });
const rows = [
  row('j1', 'mens-leather-jackets', 10000, 4300), row('j2', 'womens-leather-jackets', 9000, 6000), row('j3', 'mens-leather-jackets', 8000, 8000),
  row('s1', 'womens-shawls', 2000, 840), row('s2', 'stoles', 1000, 700),
  row('c1', 'mens-leather-coats', 20000, 10000), row('c2', 'womens-leather-coats', 22000, 15000),
  row('m1', 'mufflers-caps', 599, 299), row('m2', 'mufflers-caps', 999, 499, { stock: 0, variants: [{ stock: 0, is_active: true }] }),
  row('m3', 'mufflers-caps', 499, 499), row('demo', 'mens-leather-jackets', 10000, 100, { is_demo: true }),
];
test('every number is the catalogue\'s: biggest in-stock discount per tile, rounded down', () => {
  const d = w.winterDeals(rows);
  assert.deepEqual(d.tiles.map((t) => [t.id, t.upTo]), [['jackets', 57], ['shawls', 58], ['coats', 50]]);
  assert.equal(w.offPct({ mrp: 300, sale_price: 199 }), 33);
});
test('out of stock, demo and undiscounted items never count; a tile needs 2 discounted pieces', () => {
  const d = w.winterDeals(rows);
  assert.ok(!d.tiles.some((t) => t.id === 'caps'), 'one discounted cap in stock is not a tile');
  assert.ok(!JSON.stringify(d).includes('demo'));
});
test('the hero: the cheapest discounted everyday piece, with its own prices and link', () => {
  const { hero } = w.winterDeals(rows);
  assert.deepEqual([hero.href, hero.mrp, hero.price, hero.off], ['/fashion/p/m1', 599, 299, 50]);
});
test('too little and the band does not show; outside Nov–Feb it does not show', () => {
  assert.equal(w.winterDeals(rows.filter((r) => !r.category.slug.includes('coats'))), null);
  assert.equal(w.winterDeals(null), null);
  assert.equal(w.isWinterSeason(Date.parse('2026-11-20T12:00:00Z')), true);
  assert.equal(w.isWinterSeason(Date.parse('2027-02-28T12:00:00Z')), true);
  assert.equal(w.isWinterSeason(Date.parse('2027-02-28T19:00:00Z')), false, '1 March in India');
  assert.equal(w.isWinterSeason(Date.parse('2026-07-01T12:00:00Z')), false);
});
test('links open the winter and leather edit sections that exist', () => {
  const edit = read('src/fashion/FashionEdit.jsx');
  assert.match(edit, /id=\{`\$\{id\}-\$\{s\.id\}`\}/);
  const hrefs = w.WINTER_TILES.map((t) => t.href);
  assert.deepEqual(hrefs, ['/fashion/winter', '/fashion/winter#winter-shawls', '/fashion/leather#leather-coats', '/fashion/winter#winter-caps']);
});
test('on the homepage under the store circles; motion stops for reduced-motion; no words in pictures', () => {
  assert.match(read('src/pages/Home.jsx'), /<ExploreStores \/>\n.*\n      <WinterDeals \/>/);
  const css = read('src/styles/sora-ds.css');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  \.sora-winter__snow \{ display: none; \}/);
  const c = read('src/components/WinterDeals.jsx');
  assert.ok(!/Math\.random/.test(c.replace(/\/\/.*$/gm, '')));
  assert.match(c, /aria-label="Winter deals"/);
});
test('round 25: on the Fashion home under the category chips; ornaments, twinkles, near snow and a pom-pom hem', () => {
  assert.match(read('src/fashion/FashionHome.jsx'), /<CategoryChips \/>\n.*\n      <WinterDeals \/>/);
  const c = read('src/components/WinterDeals.jsx');
  for (const k of ['sora-winter__orn', 'sora-winter__twinkle', 'sora-winter__snow--near', 'sora-winter__hem']) assert.ok(c.includes(k), k);
  const css = read('src/styles/sora-ds.css');
  assert.match(css, /@keyframes sw-swing/);
  assert.match(css, /\.fs \.sora-winter__snow i, \.fs \.sora-winter__hem i \{ border-radius: 50% !important; \}/);
  assert.match(css, /\.fs a\.sora-winter__all \{ color: var\(--w-ink\); \}/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.sora-winter__deco, \.sora-winter__hem i \{ animation: none !important; \}/);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
