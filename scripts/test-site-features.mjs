// Site features (owner, 2026-11-08): delivery dates, WhatsApp chat link.
//   node scripts/test-site-features.mjs
import assert from 'node:assert/strict';
import { loadModule } from './catalogue-admin-harness.mjs';
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); passed++; } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const eta = loadModule('src/lib/deliveryEstimate.js', {});
test('delivery window: 6–7 business days from today, Sundays not counted', () => {
  const sun = new Date(2026, 10, 8);               // Sun 8 Nov 2026
  const w = eta.deliveryWindow(sun);
  assert.equal(w.from.toDateString(), new Date(2026, 10, 14).toDateString(), 'Mon–Sat → Sat 14');
  assert.equal(w.to.toDateString(), new Date(2026, 10, 16).toDateString(), 'skips Sun 15 → Mon 16');
  const fri = eta.deliveryWindow(new Date(2026, 10, 13));
  assert.equal(fri.from.toDateString(), new Date(2026, 10, 20).toDateString());
  assert.match(w.label, /14.*Nov.*16.*Nov/);
});
const sa = loadModule('src/components/SiteAssist.jsx', { useEffect: () => {}, useState: (v) => [v, () => {}], useLocation: () => ({ pathname: '/' }), Icon: () => null, useConsumerCare: () => ({}) });
test('WhatsApp: Indian numbers as published, nothing when unset; a product page names the product and its link', () => {
  assert.equal(sa.waNumber('+91 78890 96228'), '917889096228');
  assert.equal(sa.waNumber('78890 96228'), '917889096228');
  assert.equal(sa.waNumber('078890 96228'), '917889096228');
  assert.equal(sa.waNumber(''), '');
  assert.equal(sa.waLink('', '/', 'x', 'y'), '');
  const p = decodeURIComponent(sa.waLink('+91 78890 96228', '/fashion/p/a-shawl', 'Kalamkari Shawl | SORA LIFESTYLE', 'https://www.soralifestyle.in/fashion/p/a-shawl'));
  assert.match(p, /^https:\/\/wa\.me\/917889096228\?text=Hi SORA Lifestyle, I have a question about Kalamkari Shawl: https:\/\/www\.soralifestyle\.in\/fashion\/p\/a-shawl$/);
  assert.match(decodeURIComponent(sa.waLink('7889096228', '/shop', 'Shop', 'u')), /I need some help\.$/);
});
const sm = loadModule('src/lib/searchMatch.js', {});
test('search: every word in name, brand or category, any order and case; plural finds singular; name-start first', () => {
  const items = [{ name: 'Cotton Bedsheet King', brand: 'SORA', category: 'Bedsheets' }, { name: 'King Size Bedsheet Set', brand: 'X', category: 'Bedsheets' }, { name: 'Wool Shawl', brand: 'Weavers Villa', category: "Women's Shawls" }];
  assert.deepEqual(sm.searchItems(items, 'king bedsheets').map((x) => x.name), ['King Size Bedsheet Set', 'Cotton Bedsheet King']);
  assert.deepEqual(sm.searchItems(items, 'WEAVERS shawl').map((x) => x.name), ['Wool Shawl']);
  assert.deepEqual(sm.searchItems(items, 'k'), [], 'one letter is not a search');
  assert.deepEqual(sm.searchItems(items, 'silk'), []);
});
const xs = loadModule('src/lib/crossStoreSearch.js', { useEffect: () => {}, useState: (v) => [v, () => {}], supabase: null, searchItems: sm.searchItems, cataloguePrice: (r) => (r.sale_price > 0 && r.sale_price < r.mrp ? r.sale_price : r.mrp) });
test('one search across stores: fashion and Home & Living rows link to their own pages; unpriced or unslugged rows are left out', () => {
  const rows = xs.toSearchRows([
    { id: 'a', store: 'fashion', slug: 'red-shawl', name: 'Red Shawl', brand: 'Weavers Villa', mrp: 999, sale_price: 699, images: ['https://x/y.jpg?v=1&width=2000'], category_id: 'c1' },
    { id: 'b', store: 'homeliving', slug: 'king-sheet', name: 'King Sheet', brand: '', mrp: 1299, sale_price: null, images: [], category_id: 'c2' },
    { id: 'c', store: 'fashion', slug: '', name: 'No slug', mrp: 100 }, { id: 'd', store: 'homeliving', slug: 'free', name: 'Free', mrp: 0 },
  ], new Map([['c1', "Women's Shawls"]]));
  assert.deepEqual(rows.map((r) => [r.href, r.price, r.storeLabel]), [['/fashion/p/red-shawl', 699, 'Fashion'], ['/homeliving/p/king-sheet', 1299, 'Home & Living']]);
  assert.equal(rows[0].image, 'https://x/y.jpg?v=1&width=500');
  assert.deepEqual(sm.searchItems(rows, 'shawls').map((r) => r.name), ['Red Shawl'], 'the category counts');
});
const oc = loadModule('src/lib/offerCountdown.js', {});
test('offer countdown: the admin\'s end time is India time; the time left reads d/h/m; gone at the end', () => {
  const end = oc.parseIndiaTime('2026-11-15 23:59');
  assert.equal(new Date(end).toISOString(), '2026-11-15T18:29:00.000Z');
  assert.ok(Number.isNaN(oc.parseIndiaTime('15/11/2026')));
  assert.equal(oc.timeLeft((6 * 1440 + 18 * 60 + 20) * 60000), '6d 18h 20m');
  assert.equal(oc.timeLeft((4 * 60 + 5) * 60000), '4h 05m');
  assert.equal(oc.timeLeft(0), '');
  assert.equal(oc.timeLeft(-5), '');
});
const eng = loadModule('src/lib/productEngage.js', { supabase: null });
test('stock alerts group by product and choice, most wanted first; admin links per store', () => {
  const g = eng.groupAlerts([{ id: 1, product_key: 'fashion:a', product_name: 'A', choice: '' }, { id: 2, product_key: 'fashion:b', product_name: 'B', choice: 'M' }, { id: 3, product_key: 'fashion:b', product_name: 'B', choice: 'M' }]);
  assert.deepEqual(g.map((x) => [x.product_name, x.rows.length]), [['B', 2], ['A', 1]]);
  assert.equal(eng.productHref('fashion:x1'), '/admin/store-catalogue/fashion/x1');
  assert.equal(eng.productHref('wellness:7'), '/admin/products/7/edit');
});
await (async () => {
  const bad = await eng.requestStockAlert({ key: 'fashion:a', name: 'A', email: 'nope' }, {});
  test('a bad email never reaches the database; a short question neither', () => {
    assert.equal(bad.ok, false);
  });
  const q = await eng.submitQuestion({ key: 'fashion:a', question: 'short', authorName: 'A' }, {});
  test('question under 10 characters is refused', () => assert.equal(q.ok, false));
})();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
