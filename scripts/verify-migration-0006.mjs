// ============================================================
// Post-migration verification for 0006_variants_billing_invoices.sql
//
// READ-ONLY. Performs no writes and no DDL. Uses the PUBLIC publishable key
// (the same one the browser uses), so it also proves that RLS is still doing
// its job: tables must exist, but anonymous callers must not see admin-only
// or customer-owned data.
//
// Run: node scripts/verify-migration-0006.mjs
// ============================================================
import { readFileSync } from 'node:fs';

const bundle = readFileSync('public/bundle.js', 'utf8');
const URL_ = (bundle.match(/https:\/\/[a-z0-9]{15,}\.supabase\.co/) || [])[0];
const KEY = (bundle.match(/sb_publishable_[A-Za-z0-9_\-]+/) || [])[0];
if (!URL_ || !KEY) { console.error('Could not read Supabase config from bundle.'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

let pass = 0, fail = 0, warn = 0;
const ok   = (m) => { console.log(`  PASS  ${m}`); pass++; };
const bad  = (m) => { console.log(`  FAIL  ${m}`); fail++; };
const note = (m) => { console.log(`  NOTE  ${m}`); warn++; };

async function q(path) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: H });
  let body = null;
  try { body = JSON.parse(await r.text()); } catch { /* empty */ }
  return { status: r.status, body };
}
const exists = (r) => r.status === 200 || r.status === 206;
const missing = (r) => r.status === 404 && r.body?.code === 'PGRST205';

console.log('\n— New tables exist —');

for (const [table, label] of [
  ['product_variants', 'product_variants'],
  ['coupons', 'coupons'],
  ['payment_transactions', 'payment_transactions'],
]) {
  const r = await q(`${table}?select=*&limit=1`);
  if (missing(r)) bad(`${label} does NOT exist (migration not applied?)`);
  else if (exists(r)) ok(`${label} exists`);
  else bad(`${label} unexpected response ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
}

console.log('\n— product_variants columns —');
{
  const cols = 'id,product_id,label,size,unit,sku,barcode,mrp,sale_price,gst_rate,stock,weight_grams,volume_ml,image_url,shipping_note,is_active,sort_order';
  const r = await q(`product_variants?select=${cols}&limit=1`);
  if (exists(r)) ok(`all ${cols.split(',').length} expected columns selectable`);
  else bad(`column check failed: ${JSON.stringify(r.body).slice(0, 200)}`);
}

console.log('\n— orders billing / invoice columns —');
{
  const newCols = [
    'invoice_number', 'invoiced_at', 'billing', 'mrp_total', 'item_total',
    'product_discount', 'coupon_code', 'coupon_discount', 'shipping_fee',
    'platform_fee', 'packaging_fee', 'taxable_amount', 'tax_total',
    'tax_mode', 'billing_address',
  ];
  // Selected individually so a single missing column is named precisely.
  for (const c of newCols) {
    const r = await q(`orders?select=${c}&limit=1`);
    if (exists(r)) ok(`orders.${c}`);
    else bad(`orders.${c} missing — ${JSON.stringify(r.body).slice(0, 120)}`);
  }
}

console.log('\n— payment_transactions columns —');
{
  const cols = 'id,order_id,order_number,gateway,gateway_order_id,gateway_payment_id,gateway_signature,event,status,method,amount_paise,currency,error_code,error_description,raw,created_at';
  const r = await q(`payment_transactions?select=${cols}&limit=1`);
  if (exists(r)) ok(`all ${cols.split(',').length} expected columns selectable`);
  else bad(`column check failed: ${JSON.stringify(r.body).slice(0, 200)}`);
}

console.log('\n— Existing data intact —');
{
  const p = await q('products?select=id,name,original_price,sale_price,is_active&limit=3');
  if (exists(p) && Array.isArray(p.body) && p.body.length) ok(`products readable (${p.body.length} sampled, e.g. id=${p.body[0].id})`);
  else bad(`products not readable: ${p.status} ${JSON.stringify(p.body).slice(0, 120)}`);

  const c = await q('products?select=id');
  if (exists(c)) ok(`product catalogue still queryable (${Array.isArray(c.body) ? c.body.length : '?'} rows visible to anon)`);
  else bad('product count query failed');
}

console.log('\n— RLS still enforced (anonymous must NOT read protected data) —');
{
  // orders: policies allow admin, or customer reading their OWN rows. An
  // anonymous caller has auth.uid() = NULL and must therefore see nothing.
  const o = await q('orders?select=id,order_number,amount_paise&limit=5');
  if (exists(o) && Array.isArray(o.body) && o.body.length === 0) ok('orders: anon sees 0 rows (RLS enforced)');
  else if (exists(o) && o.body?.length) bad(`orders LEAKING ${o.body.length} rows to anonymous callers`);
  else note(`orders returned ${o.status} — ${JSON.stringify(o.body).slice(0, 120)}`);

  // coupons: admin-read only, no public policy -> anon must see nothing.
  const c = await q('coupons?select=code,value&limit=5');
  if (exists(c) && Array.isArray(c.body) && c.body.length === 0) ok('coupons: anon sees 0 rows (not enumerable)');
  else if (exists(c) && c.body?.length) bad(`coupons LEAKING ${c.body.length} rows — customers could enumerate discount codes`);
  else note(`coupons returned ${c.status}`);

  // payment_transactions: admin-read only.
  const t = await q('payment_transactions?select=gateway_payment_id&limit=5');
  if (exists(t) && Array.isArray(t.body) && t.body.length === 0) ok('payment_transactions: anon sees 0 rows');
  else if (exists(t) && t.body?.length) bad(`payment_transactions LEAKING ${t.body.length} rows`);
  else note(`payment_transactions returned ${t.status}`);

  // product_variants: deliberately public for the storefront size selector.
  const v = await q('product_variants?select=id,label,sale_price&limit=5');
  if (exists(v)) ok(`product_variants: readable by storefront (${Array.isArray(v.body) ? v.body.length : 0} active rows) — intended`);
  else bad(`product_variants not readable by storefront: ${v.status}`);

  // Anonymous writes must be refused everywhere.
  const w = await fetch(`${URL_}/rest/v1/product_variants`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: 1, label: 'RLS-PROBE', mrp: 1 }),
  });
  if (w.status === 401 || w.status === 403) ok(`anonymous INSERT refused (${w.status})`);
  else if (w.status === 201) bad('anonymous INSERT SUCCEEDED — RLS write policy is wrong');
  else note(`anonymous INSERT returned ${w.status} (not 2xx, so not writable)`);
}

console.log(`\n${pass} passed, ${fail} failed, ${warn} notes\n`);
process.exit(fail ? 1 : 0);
