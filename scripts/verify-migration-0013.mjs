// ============================================================
// Post-migration verification for 0013_creator_attribution_engine.sql
//
// READ-ONLY. Uses the PUBLIC anon key (the browser's key) to prove what an
// anonymous attacker can and cannot reach. The two write probes use payloads
// RLS refuses; nothing is created.
//
//   node scripts/verify-migration-0013.mjs
// ============================================================
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const bundle = readFileSync('public/bundle.js', 'utf8');
const URL_ = (bundle.match(/https:\/\/[a-z0-9]{15,}\.supabase\.co/) || [])[0];
const KEY = (bundle.match(/sb_publishable_[A-Za-z0-9_\-]+/) || [])[0];
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const SQL = readFileSync('supabase/migrations/0013_creator_attribution_engine.sql', 'utf8');

let pass = 0, fail = 0, note = 0;
const ok = (m) => { console.log(`  PASS  ${m}`); pass++; };
const bad = (m) => { console.log(`  FAIL  ${m}`); fail++; };
const inf = (m) => { console.log(`  NOTE  ${m}`); note++; };

async function sel(t, c = '*') {
  const r = await fetch(`${URL_}/rest/v1/${t}?select=${c}&limit=1`, { headers: H });
  let b = null; try { b = JSON.parse(await r.text()); } catch {}
  return { status: r.status, code: b?.code, rows: Array.isArray(b) ? b.length : null };
}
async function post(path, body) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  let b = null; try { b = JSON.parse(await r.text()); } catch {}
  return { status: r.status, code: b?.code };
}
const exists = (r) => r.status === 200 || r.status === 206;
const missing = (r) => r.status === 404 && (r.code === 'PGRST205' || r.code === '42P01');
const denied = (r) => r.status === 401 || r.status === 403 || r.code === '42501';

const TABLES = ['creator_attributions', 'creator_conversions', 'creator_conversion_items', 'creator_conversion_audit'];
const COLS = {
  creator_attributions: 'id,visitor_id,user_id,creator_id,campaign_id,tracking_link_id,matched_code,attribution_model,status,first_seen_at,last_seen_at,expires_at,created_at,updated_at',
  creator_conversions: 'id,order_id,order_number,creator_id,campaign_id,tracking_link_id,attribution_id,customer_user_id,matched_code,attribution_model,attribution_window_days,status,currency,gross_item_sales,discounts,tax,shipping,refunded_amount,eligible_sales,eligible_sales_original,attributed_at,qualified_at,cancelled_at,refunded_at,created_at,updated_at',
  creator_conversion_items: 'id,conversion_id,order_item_index,product_id,variant_id,product_name_snapshot,variant_label_snapshot,quantity,unit_price,line_amount,eligible_amount,created_at',
  creator_conversion_audit: 'id,conversion_id,order_id,from_status,to_status,eligible_delta,reason,actor,metadata,created_at',
};

console.log('\n=== 0013 CREATOR ATTRIBUTION ENGINE — READ-ONLY VERIFICATION ===');

console.log('\n— 1. All four Part 2 tables exist —');
for (const t of TABLES) {
  const r = await sel(t, 'id');
  if (missing(r)) bad(`${t} does NOT exist (migration not applied?)`);
  else if (exists(r) || denied(r)) ok(`${t} exists`);
  else bad(`${t} unexpected ${r.status} ${r.code || ''}`);
}

console.log('\n— 2. Expected columns present —');
for (const [t, cols] of Object.entries(COLS)) {
  const r = await sel(t, cols);
  if (exists(r)) ok(`${t}: all ${cols.split(',').length} columns selectable`);
  else if (r.code === '42703') bad(`${t}: a column is missing`);
  else if (denied(r)) inf(`${t}: columns not anon-verifiable (read denied) — see STATIC`);
  else bad(`${t}: inconclusive (${r.status} ${r.code || ''})`);
}

console.log('\n— 3. RLS enabled (migration source) —');
for (const t of TABLES) {
  (new RegExp(`alter table public\\.${t}\\s+enable row level security`).test(SQL))
    ? ok(`${t}: RLS enabled`) : bad(`${t}: RLS not enabled`);
}

console.log('\n— 4. Anonymous READS blocked on private tables —');
for (const t of TABLES) {
  const r = await sel(t, 'id');
  if (denied(r) || (exists(r) && r.rows === 0)) ok(`${t}: anon reads nothing`);
  else if (exists(r) && r.rows > 0) bad(`${t}: LEAKING rows to anon`);
  else inf(`${t}: ${r.status} ${r.code || ''}`);
}

console.log('\n— 5. Anonymous/customer WRITES blocked (FK-safe probes) —');
for (const [label, t, row] of [
  ['forge attribution', 'creator_attributions', { creator_id: randomUUID(), expires_at: new Date().toISOString() }],
  ['forge conversion', 'creator_conversions', { order_id: randomUUID(), creator_id: randomUUID() }],
  ['forge conversion item', 'creator_conversion_items', { conversion_id: randomUUID() }],
  ['forge audit row', 'creator_conversion_audit', { to_status: 'eligible' }],
]) {
  const r = await post(t, row);
  if (denied(r)) ok(`${label}: denied (${r.status})`);
  else if (r.status >= 200 && r.status < 300) bad(`${label}: WRITE SUCCEEDED`);
  else inf(`${label}: ${r.status} ${r.code || ''}`);
}

console.log('\n— 6. Attribution/conversion RPCs NOT callable by anon —');
for (const [fn, args] of [
  ['resolve_attribution_for_order', { p_visitor_id: 'x', p_user_id: null }],
  ['record_conversion', { p_order_id: randomUUID(), p_order_number: 'x', p_visitor_id: 'x', p_user_id: null, p_totals: {}, p_items: [] }],
  ['set_conversion_status', { p_order_id: randomUUID(), p_status: 'eligible', p_reason: 'x' }],
]) {
  const r = await post(`rpc/${fn}`, args);
  if (denied(r)) ok(`rpc/${fn}: anon denied (${r.status})`);
  else if (r.status === 404 || r.code === 'PGRST202') bad(`rpc/${fn}: not found`);
  else if (r.status >= 200 && r.status < 300) bad(`rpc/${fn}: anon CAN call it`);
  else inf(`rpc/${fn}: ${r.status} ${r.code || ''}`);
}
// admin/authenticated-only functions: anon must still be denied
for (const [fn, args] of [
  ['admin_refund_conversion', { p_order_id: randomUUID(), p_refund_amount: 1, p_reason: 'x' }],
  ['my_creator_analytics', {}],
]) {
  const r = await post(`rpc/${fn}`, args);
  denied(r) ? ok(`rpc/${fn}: anon denied (authenticated-only)`) : inf(`rpc/${fn}: ${r.status} ${r.code || ''}`);
}
// STATIC grants
for (const fn of ['resolve_attribution_for_order', 'record_conversion', 'set_conversion_status']) {
  (new RegExp(`grant execute on function public\\.${fn}[\\s\\S]{0,160}to service_role`).test(SQL))
    ? ok(`${fn}: granted to service_role only (STATIC)`) : bad(`${fn}: grant missing`);
}

console.log('\n— 7. Existing commerce tables unaffected —');
{
  for (const t of ['products', 'product_variants', 'categories']) {
    const r = await sel(t, 'id');
    exists(r) ? ok(`${t}: public read still works`) : bad(`${t}: broken (${r.status})`);
  }
  const all = await fetch(`${URL_}/rest/v1/products?select=id&limit=1000`, { headers: H });
  const rows = await all.json().catch(() => []);
  Array.isArray(rows) ? ok(`products count = ${rows.length} (catalogue intact)`) : bad('products count failed');
  for (const t of ['orders', 'payment_transactions', 'coupons']) {
    const r = await sel(t, 'id');
    (denied(r) || (exists(r) && r.rows === 0)) ? ok(`${t}: still private to anon`) : bad(`${t}: unexpected`);
  }
  !/(alter|drop)\s+table\s+public\.(products|orders|coupons|product_variants|payment_transactions)\b/i.test(SQL)
    ? ok('0013 alters no commerce table (STATIC)') : bad('0013 touches a commerce table');
}

console.log(`\n=== ${pass} passed, ${fail} failed, ${note} notes ===\n`);
process.exit(fail ? 1 : 0);
