// More features (owner, 2026-11-20, round 14): search inside a brand, shop by occasion,
// the shawl care guide and the care guides hub.
//   node scripts/test-more-features-14.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('brand search: every word in the name or category, with the category and sort', () => {
  const b = loadModule('src lib/brandPage.js'.replace(' ', '/'), { useEffect: () => {}, useState: (v) => [v, () => {}], supabase: null, cataloguePrice: () => 0 });
  const cards = [{ name: 'Black Biker Jacket', category: "Men's Leather Jackets", price: 5000, order: 0, at: 0 }, { name: 'Brown Biker Jacket', category: "Men's Leather Jackets", price: 4000, order: 1, at: 0 }, { name: 'Black Wallet', category: 'Wallets', price: 900, order: 2, at: 0 }];
  assert.deepEqual(b.arrangeBrandCards(cards, { q: 'black' }).map((c) => c.name), ['Black Biker Jacket', 'Black Wallet']);
  assert.deepEqual(b.arrangeBrandCards(cards, { q: 'BIKER black' }).map((c) => c.name), ['Black Biker Jacket']);
  assert.deepEqual(b.arrangeBrandCards(cards, { q: 'wallets' }).map((c) => c.name), ['Black Wallet'], 'the category counts');
  assert.deepEqual(b.arrangeBrandCards(cards, { q: 'biker', sort: 'low' }).map((c) => c.price), [4000, 5000]);
  assert.equal(b.arrangeBrandCards(cards, { q: 'x' }).length, 3, 'one letter is not a search');
  assert.match(read('src/pages/BrandPage.jsx'), /cards && cards\.length > 12 && \(/);
});
test('shop by occasion: existing pages only; a tile needs its own category\'s live picture; four or nothing', () => {
  const o = loadModule('src/components/ShopByOccasion.jsx', { useEffect: () => {}, useState: (v) => [v, () => {}], Link: () => null, Icon: () => null, supabase: null, fetchCategoryCovers: async () => ({}) });
  const routes = read('src/App.jsx');
  for (const t of o.OCCASIONS) {
    const path = t.href.split('#')[0];
    const ok = path === '/gifts' || path === '/homeliving' || /^\/fashion\/(wedding|winter|leather)$/.test(path);
    assert.ok(ok, t.href);
  }
  assert.ok(routes.includes('<Route path="/gifts"'));
  assert.deepEqual(o.occasionTiles({ 'suits-dress-materials': 'a', handbags: 'b' }).map((t) => t.id), ['wedding', 'leather']);
  assert.equal(o.occasionTiles(null).length, 0);
  assert.match(read('src/pages/Home.jsx'), /<ShopByOccasion \/>\n      <GiftShop \/>/);
  assert.match(read('src/fashion/FashionEdit.jsx'), /document\.getElementById\(decodeURIComponent\(hash\.slice\(1\)\)\)/, 'a #section link lands on its section');
});
test('care: shawl guide and hub; the care link on shawls, stoles, dupattas, mufflers; no promises', () => {
  const g = loadModule('src/pages/CareGuides.jsx', { Link: () => null, Icon: () => null, usePageMeta: () => {} });
  assert.ok(g.SHAWL_SECTIONS.length >= 5);
  assert.ok(!g.SHAWL_SECTIONS.flatMap(([, t]) => t).some((t) => /\b(years|lifetime|guarantee|forever|never fades)\b/i.test(t)));
  assert.deepEqual(g.GUIDES.map((x) => x.href), ['/guides/leather-care', '/guides/shawl-care']);
  const o = loadModule('src/components/ProductOrigin.jsx', { Link: () => null, Icon: () => null });
  assert.equal(o.isShawl("Men's Woven Poly Wool Blend Shawl"), true);
  assert.equal(o.isShawl('Phulkari Dupatta'), true);
  assert.equal(o.isShawl('Leather Jacket'), false);
  const app = read('src/App.jsx');
  assert.match(app, /<Route path="\/guides\/shawl-care" element=\{<ShawlCare \/>\} \/>/);
  assert.match(app, /<Route path="\/guides" element=\{<GuidesHub \/>\} \/>/);
  for (const p of ['/guides', '/guides/shawl-care']) assert.ok(read('api/sitemap.js').includes(`'${p}'`), p);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
