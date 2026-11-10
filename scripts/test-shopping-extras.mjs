// Wishlist price drops, "Similar, for less", top deals, from your wishlist, the bag reminder
// (owner, 2026-11-10: more features).   node scripts/test-shopping-extras.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const drops = loadModule('src/components/PriceDrops.jsx', { useEffect: () => {}, useState: (v) => [v, () => {}], Link: () => null, money: (n) => `₹${n}` });
test('price drops: the first sighting is the mark; a lower price later is a drop, biggest first', () => {
  const store = {};
  assert.deepEqual(drops.priceDrops([{ key: 'a', price: 1000 }, { key: 'b', price: 500 }], store, 1), []);
  assert.deepEqual(store, { a: { p: 1000, at: 1 }, b: { p: 500, at: 1 } });
  const d = drops.priceDrops([{ key: 'a', price: 900 }, { key: 'b', price: 300 }], store, 2);
  assert.deepEqual(d.map((x) => [x.key, x.less, x.since]), [['b', 200, 1], ['a', 100, 1]]);
  assert.equal(store.a.p, 1000, 'the mark is kept');
});
test('price drops: a higher price is no drop, and no price is ignored', () => {
  const store = { a: { p: 1000, at: 1 } };
  assert.deepEqual(drops.priceDrops([{ key: 'a', price: 1200 }, { key: 'z', price: 0 }], store, 2), []);
  assert.equal(store.z, undefined);
});

const kit = loadModule('src/components/pdp/PdpOwnerKit.jsx', { Link: () => null, money: (n) => `₹${n}` });
test('similar, for less: same group, in stock, cheaper but not under a third, closest first', () => {
  const cur = { key: 1, price: 900, group: 'g' };
  const pool = [
    { key: 1, price: 900, group: 'g' }, { key: 2, price: 800, group: 'g' }, { key: 3, price: 500, group: 'g' },
    { key: 4, price: 200, group: 'g' }, { key: 5, price: 700, group: 'h' }, { key: 6, price: 600, group: 'g', inStock: false },
    { key: 7, price: 950, group: 'g' },
  ];
  assert.deepEqual(kit.cheaperPicks(pool, cur).map((p) => [p.key, p.save]), [[2, 100], [3, 400]]);
  assert.deepEqual(kit.cheaperPicks(pool, { key: 1, price: 900 }), [], 'no group, nothing');
});
test('similar, for less: on all three product pages', () => {
  for (const f of ['src/fashion/FashionProductPage.jsx', 'src/homeliving/HomeLivingProductPage.jsx', 'src/pages/Product.jsx']) assert.match(read(f), /<PdpCheaper current=/, f);
});

const extras = loadModule('src/components/HomeExtras.jsx', { Link: () => null, Icon: () => null, money: (n) => `₹${n}`, useStore: () => ({}), products: [], productById: {}, useStorefrontSection: (s, p, d) => d });
test('top deals: in stock, a real discount, biggest first', () => {
  const list = [
    { id: 1, slug: 'a', price: 80, mrp: 100, discountPct: 20, stock: 5 },
    { id: 2, slug: 'b', price: 70, mrp: 100, discountPct: 30, stock: 5 },
    { id: 3, slug: 'c', price: 50, mrp: 100, discountPct: 50, stock: 0 },
    { id: 4, slug: 'd', price: 100, mrp: 100, discountPct: 0, stock: 5 },
  ];
  assert.deepEqual(extras.topDeals(list).map((p) => p.id), [2, 1]);
});
test('the homepages carry the new sections; the wishlists their price drops', () => {
  const home = read('src/pages/Home.jsx');
  for (const c of ['<TopDeals />', '<WishlistRail />', '<BagReminder phone={false} />']) assert.ok(home.includes(c), c);
  assert.match(read('src/fashion/FashionHome.jsx'), /<BagReminder wrap="fs-sec" \/>/);
  assert.match(read('src/homeliving/HomeLivingHome.jsx'), /<BagReminder wrap="hl-wrap" \/>/);
  for (const f of ['src/pages/Wishlist.jsx', 'src/homeliving/HomeLivingWishlist.jsx', 'src/fashion/FashionListing.jsx']) assert.match(read(f), /<PriceDrops items=/, f);
  assert.match(read('src/lib/storefrontContent.js'), /topDeals: group\(/);
});

if (failed) { console.log(`\n${failed} FAIL`); process.exit(1); }
console.log('\nall passed');
