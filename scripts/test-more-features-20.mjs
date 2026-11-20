// Round 20 (owner, 2026-11-20): "price dropped" from the price history only, and the
// admin's notes on enquiries.
//   node scripts/test-more-features-20.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('price dropped: real falls of ₹1 or more only, rounded', () => {
  const d = loadModule('src/lib/priceDrops.js', { useEffect: () => {}, useState: (v) => [v, () => {}], supabase: null });
  assert.deepEqual(d.dropMap([{ product_id: 'a', was_price: 5999, now_price: 4500 }, { product_id: 'b', was_price: 100, now_price: 99.6 }, { product_id: 'c', was_price: 0, now_price: 10 }, { product_id: 'd', was_price: 10, now_price: 20 }]), { a: 1499 });
  const sql = read('supabase/migrations/0048_price_drops_and_notes.sql');
  assert.match(sql, /with \(security_invoker = true\)/);
  assert.match(sql, /where p\.is_active and coalesce\(p\.sale_price, p\.mrp\) < h\.was_price;/);
  assert.match(sql, /recorded_on >= \(now\(\) at time zone 'Asia\/Kolkata'\)::date - 30/);
  assert.ok(!/security definer/i.test(sql));
  assert.match(read('src/fashion/FashionProductCard.jsx'), /\{dropped > 0 && <p className="sora-drop">Price dropped \{rupee\(dropped\)\}<\/p>\}/);
  assert.match(read('src/homeliving/HomeLivingProductCard.jsx'), /\{dropped > 0 && <p className="sora-drop">Price dropped \{money\(dropped\)\}<\/p>\}/);
});
test('enquiry notes: admin-only column, capped, saved per row, in the CSV', () => {
  const sql = read('supabase/migrations/0048_price_drops_and_notes.sql');
  assert.match(sql, /add column if not exists notes text check \(notes is null or char_length\(notes\) <= 1000\)/);
  assert.match(sql, /grant update \(status, notes\) on public\.enquiries to authenticated;/);
  const e = read('src/admin/pages/Enquiries.jsx');
  assert.match(e, /\.update\(\{ notes: text\.trim\(\)\.slice\(0, 1000\) \|\| null \}\)\.eq\('id', row\.id\)/);
  assert.match(e, /\['Notes', \(r\) => r\.notes\]/);
});
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall passed');
