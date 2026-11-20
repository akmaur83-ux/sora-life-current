// More features (owner, 2026-11-20, round 10): brand size charts on leather jackets,
// sales by brand and stock watch in Admin → Insights, orders as CSV, "/" to search.
//   node scripts/test-more-features-10.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const R = { useEffect: () => {}, useState: (v) => [v, () => {}], useRef: () => ({}), Fragment: 'f', Link: () => null, Icon: () => null, money: (n) => `₹${n}`, supabase: null };

test('size guide: letter sizes however written; Diamond Leather gets its own chart and its own rule', () => {
  const g = loadModule('src/fashion/SizeGuide.jsx', R);
  assert.deepEqual(['M', 'S (42)', 'M-44', '2XL-50', 'XXL', '44', 'Free Size'].map(g.letterOf), ['M', 'S', 'M', 'XXL', 'XXL', '', '']);
  assert.equal(g.hasLetterSizes(['S (42)', 'M (44)']), true);
  assert.equal(g.hasLetterSizes(['40', '42']), false, 'number-only sizes get no letter chart');
  const dl = g.brandChart(' Diamond Leather ');
  assert.equal(dl.rows.find((r) => r[0] === 'S')[1], '34–35', 'their chart: S is a 34–35 in chest');
  assert.equal(g.suggestSize(dl, 35), 'S', 'their rule: chest 34–35 → S');
  assert.equal(g.suggestSize(dl, 36), 'M');
  assert.equal(g.suggestSize(dl, 35.5), 'M', 'between their rows, the next size up');
  assert.equal(g.suggestSize(g.SIZE_CHART.men, 38), 'M', 'the general chart is unchanged');
  assert.equal(g.brandChart('Taj Leather'), null);
  assert.match(read('src/fashion/FashionProductPage.jsx'), /<SizeGuide sizes=\{view\.sizes\} department=\{[^}]+\} brand=\{view\.brand\} \/>/);
});
test('csv: quoted, formula-safe, numbers kept', () => {
  const c = loadModule('src/admin/lib/csv.js', {});
  assert.equal(c.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(c.csvCell('+91 98'), '"\'+91 98"');
  assert.equal(c.csvCell(4500), '4500');
  assert.equal(c.csvCell(null), '""');
  assert.equal(c.toCsv([{ a: 'x,y', b: 2 }], [['A', (r) => r.a], ['B', (r) => r.b]]), '"A","B"\r\n"x,y",2');
});
test('sales by brand: paid only, by each line\'s brand, orders counted once per brand', () => {
  const i = loadModule('src/admin/pages/Insights.jsx', { ...R, toCsv: () => '', downloadCsv: () => {} });
  const brandOf = i.lineBrand({ c1: 'Diamond Leather', c2: 'Taj Leather' }, { 7: 'Atomy' });
  const orders = [
    { payment_status: 'paid', items: [{ catalogue: 'fashion', product_id: 'c1', qty: 1, line_total: 4500 }, { catalogue: 'fashion', product_id: 'c1', qty: 1, line_total: 4500 }, { product_id: 7, qty: 2, line_total: 1200 }] },
    { payment_status: 'paid', items: [{ catalogue: 'fashion', product_id: 'c2', qty: 1, line_total: 6799 }, { product_id: 99, biosash_id: 'b', qty: 1, line_total: 300 }, { product_id: 98, qty: 1, line_total: 50 }] },
    { payment_status: 'failed', items: [{ catalogue: 'fashion', product_id: 'c1', qty: 9, line_total: 1 }] },
  ];
  assert.deepEqual(i.salesByBrand(orders, brandOf).map((r) => [r.brand, r.orders, r.units, r.revenue]),
    [['Diamond Leather', 1, 2, 9000], ['Taj Leather', 1, 1, 6799], ['Atomy', 1, 2, 1200], ['Biosash', 1, 1, 300], ['Other', 1, 1, 50]]);
  assert.deepEqual(i.RANGES.map(([d]) => d), [7, 30, 90]);
});
test('stock watch: live products only; out, and 1–3 left fewest first', () => {
  const i = loadModule('src/admin/pages/Insights.jsx', { ...R, toCsv: () => '', downloadCsv: () => {} });
  const w = i.stockWatch([{ name: 'B', stock: 0, is_active: true, store: 'fashion' }, { name: 'A', stock: 3 }, { name: 'C', stock: 1, store: 'homeliving' }, { name: 'Hidden', stock: 0, is_active: false }, { name: 'Plenty', stock: 9 }]);
  assert.deepEqual(w.out.map((r) => r.name), ['B']);
  assert.deepEqual(w.low.map((r) => [r.name, r.stock, r.store]), [['C', 1, 'homeliving'], ['A', 3, 'wellness']]);
});
test('orders csv: the accounts\' columns; no street, phone or email', () => {
  const o = loadModule('src/admin/pages/Orders.jsx', { ...R, toCsv: (rows, cols) => ({ rows, cols }), downloadCsv: () => {}, adminListOrders: async () => [], adminUpdateOrderFulfillment: async () => ({}), adminMarkCodCollected: async () => ({}), adminListOrderEvents: async () => [], FULFILLMENT_STATUSES: [], fulfillmentStatusLabel: String, validateFulfillmentInput: () => ({}) });
  const heads = o.ORDER_CSV_COLUMNS.map(([h]) => h);
  assert.deepEqual(heads, ['Order', 'Date', 'Payment', 'Method', 'Status', 'Amount (INR)', 'Units', 'Items', 'Customer', 'City', 'State', 'PIN']);
  const row = { order_number: 'SL-1', created_at: '2026-11-20T10:00:00Z', payment_status: 'paid', amount_paise: 450000, items: [{ name: 'Jacket', variant: 'M (44) / Black', qty: 1 }], customer: { firstName: 'A', lastName: 'B', phone: '9999999999', email: 'a@b.c', address: '12 Street', city: 'Delhi', state: 'Delhi', pin: '110066' } };
  const cells = o.ORDER_CSV_COLUMNS.map(([, get]) => get(row));
  assert.deepEqual(cells, ['SL-1', '2026-11-20', 'paid', '', '', 4500, 1, 'Jacket (M (44) / Black) × 1', 'A B', 'Delhi', 'Delhi', '110066']);
  assert.ok(!cells.some((c) => /9999999999|a@b\.c|12 Street/.test(String(c))));
});
test('"/" to search: never while typing; a visible search box only', () => {
  const a = loadModule('src/components/AppShell.jsx', { ...R, useLocation: () => ({}), useNavigate: () => () => {}, useStore: () => ({}), isStandalone: () => false, CompareTray: () => null, logSearch: () => {}, logView: () => {} });
  assert.equal(a.isTypingTarget({ tagName: 'input' }), true);
  assert.equal(a.isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(a.isTypingTarget({ tagName: 'BODY' }), false);
  const box = (w) => ({ getBoundingClientRect: () => ({ width: w, height: w }) });
  const hidden = box(0); const shown = box(200);
  assert.equal(a.visibleSearchInput({ querySelectorAll: () => [hidden, shown] }), shown);
  assert.equal(a.visibleSearchInput({ querySelectorAll: () => [hidden] }), null);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
