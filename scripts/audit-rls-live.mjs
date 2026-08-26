// ============================================================
// Live RLS / access-control probe (SAFE, essentially read-only)
//
// Uses the PUBLIC publishable (anon) key — the same one the browser has.
// Proves what an ANONYMOUS attacker can and cannot reach.
//
// SELECT probes are pure reads. The two INSERT probes deliberately use a
// RANDOM uuid that cannot reference a real auth.users row, so even if a
// permissive policy let the write through, a foreign-key constraint aborts it
// and NO usable row is ever created. The probe therefore distinguishes:
//   403 / 42501  -> RLS denied the write (secure)
//   23503 (FK)   -> RLS ALLOWED the write (insecure) but FK aborted it (no row)
//   2xx          -> row created (should never happen; would be reported loudly)
// Nothing customer-facing is modified.
// ============================================================
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const bundle = readFileSync('public/bundle.js', 'utf8');
const URL_ = (bundle.match(/https:\/\/[a-z0-9]{15,}\.supabase\.co/) || [])[0];
const KEY = (bundle.match(/sb_publishable_[A-Za-z0-9_\-]+/) || [])[0];
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function sel(table, cols = '*') {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=${cols}&limit=3`, { headers: H });
  let body = null; try { body = JSON.parse(await r.text()); } catch {}
  return { status: r.status, rows: Array.isArray(body) ? body.length : null, code: body?.code, msg: body?.message };
}
async function ins(table, row) {
  const r = await fetch(`${URL_}/rest/v1/${table}`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(row) });
  let body = null; try { body = JSON.parse(await r.text()); } catch {}
  return { status: r.status, code: body?.code, msg: (body?.message || '').slice(0, 80) };
}

const verdict = (label, r, { readShouldBeEmpty } = {}) => {
  if (readShouldBeEmpty) {
    if (r.status === 200 && r.rows === 0) return `SECURE  ${label}: anon reads 0 rows`;
    if (r.status === 401 || r.status === 403) return `SECURE  ${label}: anon read denied (${r.status})`;
    if (r.rows > 0) return `LEAK!!  ${label}: anon read ${r.rows} rows`;
    return `NOTE    ${label}: ${r.status} ${r.code || ''}`;
  }
  return `${label}: ${r.status} ${r.code || ''}`;
};

console.log('\n=== ANON READ PROBES (private tables must be empty/denied) ===');
for (const [t, c] of [
  ['orders', 'id,order_number,amount_paise,customer'],
  ['payment_transactions', 'id,gateway_payment_id'],
  ['coupons', 'code,value'],
  ['profiles', 'id'],
  ['customer_addresses', 'id,user_id'],
  ['admin_users', 'user_id'],
]) {
  console.log(' ', verdict(t, await sel(t, c), { readShouldBeEmpty: true }));
}

console.log('\n=== ANON READ PROBES (public catalog SHOULD be readable) ===');
for (const [t, c] of [['products', 'id'], ['product_variants', 'id'], ['categories', 'id'], ['site_settings', 'key']]) {
  const r = await sel(t, c);
  console.log(`  ${r.status === 200 ? 'OK' : 'NOTE'}    ${t}: status ${r.status}, rows ${r.rows}`);
}

console.log('\n=== ANON WRITE PROBES (must be denied by RLS; FK-safe payloads) ===');
const probes = [
  ['admin_users  (privilege escalation)', 'admin_users', { user_id: randomUUID() }],
  ['orders       (forge an order)',       'orders',      { order_number: `PROBE-${randomUUID().slice(0, 8)}`, amount_paise: 1 }],
  ['product_variants (tamper catalog)',   'product_variants', { product_id: 999999999, label: 'RLS-PROBE', mrp: 1 }],
  ['coupons      (create discount)',      'coupons',     { code: `PROBE-${randomUUID().slice(0, 6)}`, value: 99 }],
  ['products     (tamper price)',         'products',    { name: 'RLS-PROBE', slug: `rls-probe-${randomUUID().slice(0, 8)}` }],
];
for (const [label, table, row] of probes) {
  const r = await ins(table, row);
  let tag;
  if (r.status === 401 || r.status === 403 || r.code === '42501') tag = 'SECURE  RLS denied';
  else if (r.code === '23503') tag = 'INSECURE RLS ALLOWED write (FK aborted row) — policy missing!';
  else if (r.status >= 200 && r.status < 300) tag = 'CRITICAL ROW CREATED';
  else tag = `NOTE    ${r.status} ${r.code || ''} ${r.msg || ''}`;
  console.log(`  ${tag.padEnd(20)} ${label}  [http ${r.status}${r.code ? ', ' + r.code : ''}]`);
}
console.log('');
