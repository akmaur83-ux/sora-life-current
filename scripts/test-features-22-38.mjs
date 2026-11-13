// Features 22–38 (owner, 2026-11-13): banner films, price history, the compare tray,
// the hamper, the mega menu, the sticky category strip, shop by colour, styling tips,
// "almost gone", trending searches, rate your purchase, admin insights, helpful votes,
// the back-in-stock email.
//   node scripts/test-features-22-38.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { toggleCompare, COMPARE_MAX } = loadModule('src/lib/compareList.js', { useSyncExternalStore: () => [] });
const { cleanQuery, priceSummary } = loadModule('src/lib/insights.js', { useEffect: () => {}, useState: (v) => [v, () => {}], supabase: null });
const R = { useEffect: () => {}, useState: (v) => [typeof v === 'function' ? v() : v, () => {}], useRef: () => ({}), useMemo: (f) => f(), Link: () => null, NavLink: () => null, useLocation: () => ({ pathname: '/' }), useNavigate: () => () => {}, Icon: () => null, money: (n) => `₹${n}`, supabase: null, usePageMeta: () => {} };

test('compare: same store only, four at most (the oldest drops), a second tap removes', () => {
  const it = (k, store = 'fashion') => ({ key: k, store });
  let l = [];
  for (const k of ['a', 'b', 'c', 'd', 'e']) l = toggleCompare(l, it(k));
  assert.deepEqual(l.map((x) => x.key), ['b', 'c', 'd', 'e']); assert.equal(COMPARE_MAX, 4);
  assert.deepEqual(toggleCompare(l, it('c')).map((x) => x.key), ['b', 'd', 'e']);
  assert.deepEqual(toggleCompare(l, it('w', 'wellness')).map((x) => x.key), ['w'], 'another store starts afresh');
  assert.match(read('src/fashion/FashionProductPage.jsx'), /<CompareButton item=/);
  assert.match(read('src/homeliving/HomeLivingProductPage.jsx'), /<CompareButton item=/);
  assert.match(read('src/pages/Product.jsx'), /<CompareButton item=/);
  assert.match(read('src/App.jsx'), /<Route path="\/compare" element={<ComparePage \/>} \/>/);
});
test('price history: only real days; nothing under two points; lowest flagged only when it moved', () => {
  const h = [{ day: '2026-11-01', price: 900 }, { day: '2026-11-05', price: 1000 }, { day: '2026-11-12', price: 800 }];
  const s = priceSummary(h, 30, '2026-11-13');
  assert.deepEqual([s.low, s.high, s.now, s.isLowest], [800, 1000, 800, true]);
  assert.equal(priceSummary([{ day: '2026-11-12', price: 800 }], 30, '2026-11-13'), null);
  assert.equal(priceSummary([{ day: '2026-11-12', price: 800 }, { day: '2026-11-13', price: 800 }], 30, '2026-11-13').isLowest, false);
  const ph = loadModule('src/components/PriceHistory.jsx', { ...R, fetchPriceHistory: async () => [], priceSummary });
  assert.match(ph.sparkPath([{ price: 1 }, { price: 2 }]), /^M4\.0 52\.0 L256\.0 4\.0$/);
});
test('search log: text only, trimmed and lower-cased; the admin sees top and nothing-found lists', () => {
  assert.equal(cleanQuery('  Banarasi   SUIT '), 'banarasi suit');
  assert.equal(cleanQuery('x'.repeat(81)), '');
  const ins = loadModule('src/admin/pages/Insights.jsx', R);
  const s = ins.summariseSearches([{ q: 'lehenga', store: 'fashion', results: 0 }, { q: 'lehenga', store: 'fashion', results: 0 }, { q: 'kullu', store: 'fashion', results: 4 }, { q: 'kullu', store: 'fashion', results: 0 }]);
  assert.deepEqual(s.top.map((r) => [r.q, r.n]), [['kullu', 1]]);
  assert.deepEqual(s.zero.map((r) => [r.q, r.n]), [['lehenga', 2]], 'a query that once found something is not "nothing found"');
  const b = ins.bestSellers([{ payment_status: 'paid', items: [{ name: 'A', qty: 2, line_total: 400 }, { name: 'B', qty: 1, line_total: 900 }] }, { payment_status: 'failed', items: [{ name: 'B', qty: 9 }] }]);
  assert.deepEqual(b.map((r) => [r.name, r.units, r.revenue]), [['A', 2, 400], ['B', 1, 900]]);
  const sql = read('supabase/migrations/0045_search_log_and_votes.sql');
  assert.match(sql, /grant insert \(q, store, results\) on public\.search_log to anon, authenticated;/);
  assert.match(sql, /create policy "search log admin read" on public\.search_log for select to authenticated using \(public\.is_sora_admin\(\)\);/);
  assert.match(sql, /having count\(\*\) >= 3/);
  assert.match(read('src/components/SearchSuggest.jsx'), /Trending searches/);
});
test('hamper: in stock with a picture and a price; three to six; one of each at its own price', () => {
  const h = loadModule('src/pages/Hamper.jsx', { ...R, useStore: () => ({ addToCart: () => {} }), products: [], categories: [] });
  assert.equal(h.hamperPool([{ id: 1, slug: 'a', image: 'x', stock: 2, price: 10 }, { id: 2, slug: 'b', image: 'x', stock: 0, price: 10 }, { id: 3, slug: 'c', image: '', stock: 3, price: 10 }]).length, 1);
  let p = [];
  for (const id of [1, 2, 3, 4, 5, 6, 7]) p = h.toggleHamper(p, id);
  assert.deepEqual(p, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(h.toggleHamper(p, 3), [1, 2, 4, 5, 6]);
  assert.equal(h.hamperTotal([{ price: 100 }, { price: 250 }]), 350);
  assert.equal([h.HAMPER_MIN, h.HAMPER_MAX].join(), '3,6');
});
test('almost gone: only real stock (0044 leaves out placeholder brands); fewest left first', () => {
  const x = loadModule('src/components/ShopExtras.jsx', { ...R, cataloguePrice: (r) => Number(r.sale_price) || Number(r.mrp) });
  const c = x.lastChanceCards([{ left_in_stock: 3, product: { id: 1, store: 'fashion', slug: 'a', name: 'A', mrp: 100, images: ['i'] } }, { left_in_stock: 1, product: { id: 2, store: 'homeliving', slug: 'b', name: 'B', mrp: 50, images: ['i'] } }, { left_in_stock: 2, product: { id: 3, store: 'fashion', slug: 'c', name: 'C', mrp: 80, images: [] } }]);
  assert.deepEqual(c.map((k) => [k.key, k.left, k.href]), [['homeliving-2', 1, '/homeliving/p/b'], ['fashion-1', 3, '/fashion/p/a']]);
  const sql = read('supabase/migrations/0044_last_chance.sql');
  assert.match(sql, /b\.top_share < 0\.8/); assert.match(sql, /left_in_stock between 1 and 3/); assert.match(sql, /security_invoker = true/);
  assert.deepEqual(x.stylingTips('suits-dress-materials').length, 3);
  assert.deepEqual(x.stylingTips('keychains'), []);
  assert.equal(x.COLOURS.length, 12);
  assert.match(read('src/fashion/FashionHome.jsx'), /<ShopByColour \/>/);
});
test('mega menu: Fashion roots with their sub-categories and a picture each; nothing pictureless and empty', () => {
  const m = loadModule('src/components/MegaMenu.jsx', { ...R, categories: [], products: [], fetchCategoryCovers: async () => ({}), flatTiles: () => [] });
  const rows = [{ id: 'r1', name: 'Clothing', slug: 'clothing', store: 'fashion' }, { id: 'c1', name: 'Women', slug: 'women', parent_id: 'r1', store: 'fashion' }, { id: 'r2', name: 'Empty', slug: 'empty', store: 'fashion' }];
  const g = m.fashionMenu(rows, { c1: 'w.jpg' });
  assert.deepEqual(g.map((x) => [x.name, x.image, x.children.map((c) => c.href).join()]), [['Clothing', 'w.jpg', '/fashion/c/women']]);
});
test('orders: "Rate your purchase" once delivered; the back-in-stock email names the product and a link to it', () => {
  const acc = read('src/pages/Account.jsx');
  assert.match(acc, /export function rateLink\(order\) \{\n  if \(!order \|\| order\.fulfillment_status !== 'delivered'\) return '';/);
  assert.match(acc, /Rate your purchase/);
  const rev = read('src/admin/pages/Reviews.jsx');
  assert.match(rev, /&body=\$\{encodeURIComponent\(backInStockBody\(g\)\)\}/);
  assert.match(rev, /is back in stock at SORA LIFESTYLE/);
});
test('helpful votes, the sticky strip, the banner films, the security of the catalogue writes', () => {
  assert.match(read('src/components/pdp/PdpEngage.jsx'), /<Helpful id=\{q\.id\} count=\{q\.helpful\} \/>/);
  assert.match(read('src/lib/productEngage.js'), /rpc\('vote_question_helpful', \{ qid: id \}\)/);
  assert.match(read('src/components/Layout.jsx'), /<StickyCats store="wellness"/);
  assert.match(read('src/fashion/FashionLayout.jsx'), /<FashionStickyCats \/>/);
  assert.match(read('src/fashion/FashionListing.jsx'), /autoPlay=\{!stillOnly\} muted loop playsInline/);
  const cat = read('supabase/migrations/0043_insights.sql');
  assert.match(cat, /language plpgsql security invoker/);
  assert.ok(!/security definer/i.test(cat), 'the catalogue migration runs nothing as its owner');
  assert.match(read('src/App.jsx'), /<Route path="insights" element={<AdminInsights \/>} \/>/);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
