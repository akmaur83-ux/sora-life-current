// More features (owner, 2026-11-16, round 9): about the maker on product pages, sizes in
// stock on fashion cards, popular this week (real views only), the gift receipt, shop by
// ingredient.
//   node scripts/test-more-features-9.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { BRANDS } = loadModule('src/lib/brands.js', {});

test('about the maker: partner brands only, by catalogue or display name; on all three product pages', () => {
  const m = loadModule('src/components/MakerCard.jsx', { BRANDS, Link: () => null, Icon: () => null });
  assert.equal(m.makerFor('Diamond Leather').page, '/brands/diamond-leather');
  assert.equal(m.makerFor('  taj leather ').id, 'taj-leather');
  assert.equal(m.makerFor('Atomy').id, 'atomy');
  assert.equal(m.makerFor('Some Other Label'), null);
  assert.equal(m.makerFor(''), null);
  assert.match(read('src/fashion/FashionProductPage.jsx'), /<MakerCard brand=\{view\.brand\} \/>/);
  assert.match(read('src/homeliving/HomeLivingProductPage.jsx'), /<MakerCard brand=\{view\.brand\} \/>/);
  assert.match(read('src/pages/Product.jsx'), /<MakerCard brand=\{product\.brand\} \/>/);
});
test('sizes on the cards: in stock only, short labels, nothing for one size, "+n" past six', () => {
  const c = loadModule('src/fashion/FashionProductCard.jsx', { usePriceDrop: () => 0, useState: (v) => [v, () => {}], Link: () => null, Icon: () => null, money: String, swatchOverflow: () => ({ shown: [], more: 0 }), quickAddPlan: () => ({}), useFashionWishlist: () => ({}), useStore: () => ({}), VariantSheet: () => null });
  const v = (size, stock) => ({ size, colour: 'Black', stock });
  assert.deepEqual(c.cardSizes({ sizes: ['S (42)', 'M (44)', 'L (46)'], variants: [v('S (42)', 10), v('M (44)', 0), v('L (46)', 3)] }), { shown: ['S', 'L'], more: 0 });
  assert.equal(c.cardSizes({ sizes: ['Free Size'], variants: [v('Free Size', 5)] }), null);
  assert.equal(c.cardSizes({ sizes: ['S', 'M'], variants: [v('S', 0), v('M', 0)] }), null);
  assert.deepEqual(c.cardSizes({ sizes: ['XS-40', 'M-44', 'S-42', '2XL-50', 'XL-48', 'L-46'], variants: ['XS-40', 'M-44', 'S-42', '2XL-50', 'XL-48', 'L-46'].map((s) => v(s, 1)) }).shown, ['XS', 'S', 'M', 'L', 'XL', '2XL']);
  assert.deepEqual(c.cardSizes({ sizes: ['44', '42', '52', '46'], variants: ['44', '42', '52', '46'].map((s) => v(s, 1)) }).shown, ['42', '44', '46', '52']);
  const many = ['36', '38', '40', '42', '44', '46', '48', '50'];
  assert.deepEqual(c.cardSizes({ sizes: many, variants: many.map((s) => v(s, 1)) }), { shown: many.slice(0, 6), more: 2 });
});
test('popular this week: product pages only, once a day per browser, real counts, in stock, four or nothing', () => {
  const p = loadModule('src/lib/popular.js', { useEffect: () => {}, useState: (v) => [v, () => {}], supabase: null, cataloguePrice: (r) => Number(r.sale_price) || Number(r.mrp) });
  assert.deepEqual(p.viewOf('/fashion/p/diamond-leather-rider-leather-biker-jacket-black'), { store: 'fashion', slug: 'diamond-leather-rider-leather-biker-jacket-black' });
  assert.deepEqual(p.viewOf('/product/sea-buckthorn-oil'), { store: 'wellness', slug: 'sea-buckthorn-oil' });
  assert.equal(p.viewOf('/fashion/c/leather'), null);
  assert.equal(p.viewOf('/product/Bad Slug'), null);
  const mem = new Map(); const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(p.firstViewToday('fashion', 'a', '2026-11-16', storage), true);
  assert.equal(p.firstViewToday('fashion', 'a', '2026-11-16', storage), false);
  assert.equal(p.firstViewToday('fashion', 'a', '2026-11-17', storage), true, 'a new day counts again');
  const cards = p.popularCards(
    [{ store: 'fashion', slug: 'x' }, { store: 'wellness', slug: 'w' }, { store: 'homeliving', slug: 'gone' }, { store: 'fashion', slug: 'out' }],
    { w: { name: 'W', price: 300, stock: 4, image: 'w.jpg' } },
    [{ store: 'fashion', slug: 'x', name: 'X', mrp: 900, sale_price: 700, images: ['x.jpg'], stock: 5, is_active: true }, { store: 'fashion', slug: 'out', name: 'O', mrp: 1, images: ['o'], stock: 0, is_active: true }]);
  assert.deepEqual(cards.map((k) => [k.key, k.href, k.price]), [['fashion-x', '/fashion/p/x', 700], ['wellness-w', '/product/w', 300]]);
  assert.equal(p.POPULAR_MIN_CARDS, 4);
  const sql = read('supabase/migrations/0046_product_views.sql');
  assert.match(sql, /grant insert \(store, slug\) on public\.product_views to anon, authenticated;/);
  assert.match(sql, /having count\(\*\) >= 5/);
  assert.ok(!/user_id|ip_address|session/.test(sql.replace(/^--.*$/gm, '')), 'nothing personal is stored');
  assert.match(read('src/pages/Home.jsx'), /<PopularThisWeek \/>/);
});
test('gift receipt: the parcel without money; own orders only; linked from My Orders', () => {
  const g = loadModule('src/pages/GiftReceipt.jsx', { useEffect: () => {}, useState: (v) => [v, () => {}], Link: () => null, useParams: () => ({}), Icon: () => null, supabase: null, useCustomerAuth: () => ({}) });
  assert.deepEqual(g.giftLines([{ product_id: 'p', name: 'Jacket', variant: 'M (44) / Black', qty: 2, unit_price: 4500, line_total: 9000 }]), [{ key: 'p-0', name: 'Jacket', variant: 'M (44) / Black', qty: 2 }]);
  const src = read('src/pages/GiftReceipt.jsx');
  assert.match(src, /\.select\('order_number, created_at, items'\)/, 'reads no payment, address or contact columns');
  assert.ok(!/money\(|unit_price|grandTotal|amount_paise/.test(src.replace(/\/\/.*$/gm, '')), 'no prices anywhere on the page');
  assert.match(read('src/App.jsx'), /<Route path="\/gift-receipt\/:orderNumber" element=\{<GiftReceipt \/>\} \/>/);
  assert.match(read('src/pages/Account.jsx'), /to=\{`\/gift-receipt\/\$\{o\.order_number\}`\}/);
});
test('shop by ingredient: names only, three or more in stock, most first', () => {
  const x = loadModule('src/components/ShopExtras.jsx', { useEffect: () => {}, useState: (v) => [v, () => {}], Link: () => null, Icon: () => null, money: String, supabase: null, cataloguePrice: () => 0 });
  const p = (name, stock = 5) => ({ name, stock });
  const list = [p('Sea Buckthorn Oil'), p('Sea buckthorn Juice'), p('Sea Buckthorn Tea'), p('Sea Buckthorn Soap', 0), p('Tulsi Drops'), p('Tulsi Tea'), p('Tulsi Honey'), p('Honey Jar'), p('Honey Comb'), p('Rosemary Oil'), p('Rose Water')];
  const c = x.ingredientChips(list);
  assert.deepEqual(c.map((k) => [k.name, k.count]), [['Sea buckthorn', 3], ['Tulsi', 3], ['Honey', 3]]);
  assert.equal(c[0].href, '/shop?q=sea%20buckthorn');
  assert.ok(!c.some((k) => k.name === 'Rose'), 'rosemary is not rose, and one rose is not three');
  assert.match(read('src/pages/Home.jsx'), /<ShopByIngredient products=\{products\} \/>/);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
