// More features (owner, 2026-11-20, round 13): the Diwali copy retired, the gift
// finder, the edits on the homepage.
//   node scripts/test-more-features-13.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const g = loadModule('src/lib/giftFinder.js', { useEffect: () => {}, useMemo: (f) => f(), useState: (v) => [v, () => {}], supabase: null, cataloguePrice: (r) => Number(r.sale_price) || Number(r.mrp) });
const row = (id, store, slug, price, extra = {}) => ({ id, store, slug: `p${id}`, name: `P${id}`, images: ['i'], mrp: price + 100, sale_price: price, stock: 2, category: { slug }, ...extra });

test('no Diwali left on the homepage defaults', () => {
  for (const f of ['src/components/GiftShop.jsx', 'src/components/HomeStorefront.jsx']) {
    const code = read(f).split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    assert.ok(!/Diwali/.test(code.replace(/home-hero-diwali/g, '')), f);
  }
});
test('gift finder: who it is for, from their own store and categories; in stock only', () => {
  const rows = [row(1, 'fashion', 'mens-wallets', 799), row(2, 'fashion', 'womens-shawls', 1499), row(3, 'homeliving', 'table-covers', 899), row(4, 'fashion', 'belts', 600, { variants: [{ stock: 0, is_active: true }] }), row(5, 'fashion', 'sarees', 2000)];
  const him = g.RECIPIENTS.find((r) => r.id === 'him'); const her = g.RECIPIENTS.find((r) => r.id === 'her'); const home = g.RECIPIENTS.find((r) => r.id === 'home');
  assert.deepEqual(g.catalogueGifts(rows, him).map((c) => c.key), ['fashion-1']);
  assert.deepEqual(g.catalogueGifts(rows, her).map((c) => c.key), ['fashion-2']);
  assert.deepEqual(g.catalogueGifts(rows, home).map((c) => [c.key, c.href]), [['homeliving-3', '/homeliving/p/p3']]);
  assert.deepEqual(g.wellnessGifts([{ id: 9, slug: 'w', name: 'W', image: 'x', price: 350, stock: 1 }, { id: 8, slug: 'v', name: 'V', image: 'x', price: 200, stock: 0 }]).map((c) => c.href), ['/product/w']);
});
test('budgets: the price paid, cheapest first, edges in the right band', () => {
  const cards = [999, 1000, 2500, 2501, 5000, 5001, 300].map((p, i) => ({ key: `k${i}`, name: `N${i}`, price: p }));
  assert.deepEqual(g.inBudget(cards, 'u1000').map((c) => c.price), [300, 999]);
  assert.deepEqual(g.inBudget(cards, '1000-2500').map((c) => c.price), [1000, 2500]);
  assert.deepEqual(g.inBudget(cards, '2500-5000').map((c) => c.price), [2501, 5000]);
  assert.deepEqual(g.inBudget(cards, '5000').map((c) => c.price), [5001]);
  assert.equal(g.inBudget(cards, '').length, 7);
  assert.deepEqual(g.budgetCounts(cards), { u1000: 2, '1000-2500': 2, '2500-5000': 2, 5000: 1 });
});
test('ways in: the route, the gift shop, the promo, the footer, the sitemap; the edits on the homepage', () => {
  assert.match(read('src/App.jsx'), /<Route path="\/gifts" element=\{<Gifts \/>\} \/>/);
  assert.match(read('src/components/GiftShop.jsx'), /<Link to="\/gifts" className="hx-more">Find a gift by budget/);
  assert.match(read('src/components/HomeStorefront.jsx'), /cta: 'Shop gifts', link: '\/gifts',/);
  assert.ok(read('api/sitemap.js').includes("'/gifts'"));
  assert.ok(read('src/components/Footer.jsx').includes('to="/gifts"'));
  assert.match(read('src/pages/Home.jsx'), /<FestivePromo \/>\n.*\n      <section className="hx sora-homeedits" aria-label="Edits"><div className="hx-wrap"><EditStrips \/><\/div><\/section>/);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
