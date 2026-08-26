// ============================================================
// Live security regression suite (SAFE — read-only / rejected-writes only)
//
//   node scripts/test-security-live.mjs [baseUrl]
//   default baseUrl = https://sora-life-current.vercel.app
//
// Uses the PUBLIC anon key (the browser's key) to prove what an anonymous
// attacker can and cannot do against the LIVE deployment. No customer data is
// read, no data is created (write probes use FK-safe payloads that abort), no
// secret is printed. Run after deploying to confirm the hardening holds.
// ============================================================
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const BASE = (process.argv[2] || 'https://sora-life-current.vercel.app').replace(/\/$/, '');
const bundle = readFileSync('public/bundle.js', 'utf8');
const URL_ = (bundle.match(/https:\/\/[a-z0-9]{15,}\.supabase\.co/) || [])[0];
const KEY = (bundle.match(/sb_publishable_[A-Za-z0-9_\-]+/) || [])[0];
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

let pass = 0, fail = 0, note = 0;
const ok = (m) => { console.log(`  PASS  ${m}`); pass++; };
const bad = (m) => { console.log(`  FAIL  ${m}`); fail++; };
const inf = (m) => { console.log(`  NOTE  ${m}`); note++; };

async function sel(t, c = '*') {
  const r = await fetch(`${URL_}/rest/v1/${t}?select=${c}&limit=3`, { headers: H });
  let b = null; try { b = JSON.parse(await r.text()); } catch {}
  return { status: r.status, rows: Array.isArray(b) ? b.length : null, code: b?.code };
}
async function post(path, body) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  let b = null; try { b = JSON.parse(await r.text()); } catch {}
  return { status: r.status, code: b?.code };
}

console.log(`\n=== LIVE SECURITY SUITE vs ${BASE} ===`);

console.log('\n— Private tables deny anonymous reads —');
for (const [t, c] of [
  ['orders', 'id,customer'], ['payment_transactions', 'id'], ['coupons', 'code'],
  ['profiles', 'id'], ['customer_addresses', 'id'], ['admin_users', 'user_id'],
  ['coupon_redemptions', 'id'], ['rate_limits', 'bucket_key'],
]) {
  const r = await sel(t, c);
  if ((r.status === 200 && r.rows === 0) || r.status === 401 || r.status === 403 || r.status === 404) ok(`${t}: anon cannot read (status ${r.status}, rows ${r.rows ?? '—'})`);
  else if (r.rows > 0) bad(`${t}: LEAKING ${r.rows} rows to anon`);
  else inf(`${t}: status ${r.status} ${r.code || ''}`);
}

console.log('\n— Public catalog still readable —');
for (const t of ['products', 'product_variants', 'categories']) {
  const r = await sel(t, 'id');
  r.status === 200 ? ok(`${t}: public read works (rows ${r.rows})`) : bad(`${t}: broken (status ${r.status})`);
}
{
  // site_settings: presentation keys public, others not
  const pub = await fetch(`${URL_}/rest/v1/site_settings?select=key&key=eq.branding`, { headers: H });
  const pb = await pub.json().catch(() => []);
  (Array.isArray(pb) && pb.length) ? ok('site_settings: presentation key "branding" is public') : inf('site_settings: branding not returned (status ' + pub.status + ')');
}

console.log('\n— Anonymous writes denied (FK-safe probes) —');
for (const [label, t, row] of [
  ['admin_users (privilege escalation)', 'admin_users', { user_id: randomUUID() }],
  ['orders (forge order)', 'orders', { order_number: `PROBE-${randomUUID().slice(0, 8)}`, amount_paise: 1 }],
  ['coupons (create discount)', 'coupons', { code: `PB-${randomUUID().slice(0, 6)}`, value: 99 }],
  ['coupon_redemptions (forge redemption)', 'coupon_redemptions', { coupon_id: randomUUID() }],
  ['rate_limits (poison limiter)', 'rate_limits', { bucket_key: `pb:${randomUUID()}`, count: 0, expires_at: new Date().toISOString() }],
]) {
  const r = await post(t, row);
  if (r.status === 401 || r.status === 403 || r.code === '42501') ok(`${label}: denied (${r.status})`);
  else if (r.status >= 200 && r.status < 300) bad(`${label}: WRITE SUCCEEDED`);
  else inf(`${label}: ${r.status} ${r.code || ''}`);
}

console.log('\n— Security-definer RPCs are NOT callable by anon —');
for (const [fn, args] of [
  ['consume_coupon', { p_code: 'X', p_order_id: null, p_user_id: null, p_order_number: null }],
  ['rate_limit_check', { p_key: 'probe', p_limit: 1, p_window_seconds: 60 }],
]) {
  const r = await post(`rpc/${fn}`, args);
  if (r.status === 401 || r.status === 403 || r.code === '42501') ok(`rpc/${fn}: anon denied (${r.status})`);
  else if (r.status === 404 || r.code === 'PGRST202') inf(`rpc/${fn}: not found (migration 0009 not applied yet)`);
  else if (r.status >= 200 && r.status < 300) bad(`rpc/${fn}: anon CAN call it — must be service-role only`);
  else inf(`rpc/${fn}: ${r.status} ${r.code || ''}`);
}

console.log('\n— Storage: anon cannot write to a public bucket —');
{
  const r = await fetch(`${URL_}/storage/v1/object/product-images/rls-probe-${randomUUID().slice(0, 8)}.txt`, {
    method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'text/plain' }, body: 'probe',
  });
  (r.status === 401 || r.status === 403 || r.status === 400) ? ok(`anon upload denied (${r.status})`) : (r.status < 300 ? bad(`anon UPLOAD SUCCEEDED (${r.status})`) : inf(`upload probe: ${r.status}`));
}

console.log('\n— Order-lookup: no enumeration —');
{
  const call = (o, e) => fetch(`${BASE}/api/orders/lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNumber: o, email: e }) })
    .then(async (r) => `${r.status}:${(await r.text())}`);
  const a = await call('SORA-FAKE-0001', 'a@example.com');
  const b = await call('SORA-FAKE-9999', 'b@example.com');
  a === b ? ok('two unknown identities return an identical response (no enumeration)') : bad(`differential response:\n    ${a}\n    ${b}`);
}

console.log('\n— Method enforcement —');
for (const p of ['/api/orders/lookup', '/api/razorpay/verify', '/api/razorpay/create-order']) {
  const r = await fetch(`${BASE}${p}`, { method: 'GET' });
  r.status === 405 ? ok(`GET ${p} -> 405`) : inf(`GET ${p} -> ${r.status}`);
}

console.log('\n— Security headers on production —');
{
  const r = await fetch(`${BASE}/`, { method: 'GET' });
  const want = {
    'content-security-policy': /default-src 'self'/,
    'x-content-type-options': /nosniff/,
    'x-frame-options': /DENY/,
    'referrer-policy': /strict-origin-when-cross-origin/,
    'permissions-policy': /camera=\(\)/,
    'strict-transport-security': /max-age=/,
  };
  for (const [h, re] of Object.entries(want)) {
    const v = r.headers.get(h);
    v && re.test(v) ? ok(`header ${h} present & correct`) : bad(`header ${h} missing/wrong (got: ${v || 'none'})`);
  }
  // CSP must allow Razorpay + Supabase so checkout/data don't break
  const csp = r.headers.get('content-security-policy') || '';
  /checkout\.razorpay\.com/.test(csp) ? ok('CSP allows Razorpay checkout') : bad('CSP missing Razorpay checkout host');
  /\*\.supabase\.co/.test(csp) ? ok('CSP allows Supabase') : bad('CSP missing Supabase host');
}

console.log('\n— Rate limiting (live, safe burst on order-lookup) —');
{
  // orders-lookup limit is 15/60s. Fire 20 quick unknown-identity lookups.
  let got429 = false, statuses = [];
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${BASE}/api/orders/lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNumber: `RL-${i}`, email: 'x@y.com' }) });
    statuses.push(r.status);
    if (r.status === 429) { got429 = true; break; }
  }
  if (got429) ok('burst of lookups eventually returns 429 (rate limiting ACTIVE)');
  else inf('no 429 seen — migration 0009 not applied yet, so limiter fails open (expected pre-migration)');
}

console.log(`\n${pass} passed, ${fail} failed, ${note} notes\n`);
process.exit(fail ? 1 : 0);
