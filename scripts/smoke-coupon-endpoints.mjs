// ============================================================
// LIVE SMOKE TEST — /api/coupons/eligible and /api/coupons/quote
//
// Invokes the real handlers against the real database with a real product,
// so this exercises the whole path: Supabase config, rate limiter, cart
// validation, trusted pricing, coupon lookup and response shape. The unit
// matrix in test-coupon-validation.mjs proves the DECISIONS; this proves the
// plumbing around them.
//
// It creates one coupon and it is INACTIVE for its entire life. That is
// deliberate: an active coupon in production, however briefly and however
// random its code, is a code a customer could redeem. The 'inactive' branch
// is enough to prove the row was found, read and judged through the real
// stack — which is the part a unit test cannot show.
//
// The coupon is deleted in a finally block, and the script re-checks the
// table is empty before exiting.
//
//   node scripts/smoke-coupon-endpoints.mjs
// ============================================================
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// The handlers read process.env at call time, so .env.local is loaded first.
for (const line of readFileSync(join(HERE, '../.env.local'), 'utf8').split(/\r?\n/)) {
  if (!line.includes('=') || line.trim().startsWith('#')) continue;
  const i = line.indexOf('=');
  const key = line.slice(0, i).trim();
  if (!process.env[key]) process.env[key] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const { default: eligibleHandler } = await import('../api/coupons/eligible.js');
const { default: quoteHandler } = await import('../api/coupons/quote.js');
const { getSupabaseConfig } = await import('../api/_lib/supabaseAdmin.js');

const sb = getSupabaseConfig();
if (!sb.configured) { console.error('Supabase env missing — cannot smoke test.'); process.exit(2); }
const h = { apikey: sb.serviceKey, Authorization: `Bearer ${sb.serviceKey}`, 'Content-Type': 'application/json' };

/** Minimal Vercel-shaped req/res so the handlers run unmodified. */
function invoke(handler, body) {
  const req = { method: 'POST', headers: { 'x-forwarded-for': '127.0.0.1' }, body };
  let status = 200;
  return new Promise((resolve) => {
    const res = {
      setHeader() {},
      status(code) { status = code; return res; },
      json(payload) { resolve({ status, payload }); return res; },
    };
    handler(req, res).catch((err) => resolve({ status: 500, payload: { crashed: err.message } }));
  });
}

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `\n        ${detail}` : ''}`);
  if (!ok) failed++;
};

// A real, active, priced product to build the cart from.
const products = await (await fetch(
  `${sb.url}/rest/v1/products?select=id,biosash_id,name,sale_price,original_price`
  + '&is_active=eq.true&sale_price=gt.0&order=sale_price.desc&limit=1', { headers: h },
)).json();
const product = products[0];
if (!product) { console.error('No active priced product to test with.'); process.exit(2); }
const cartId = product.biosash_id || String(product.id);
const unit = Number(product.sale_price);
console.log(`\ncart: ${product.name} @ ₹${unit}  (id ${cartId})`);

const CODE = `ZZSMOKE${randomBytes(8).toString('hex').toUpperCase()}`;
let couponId = null;

try {
  // ---------- 1. no coupons in the table ----------
  console.log('\n— With an empty coupons table —\n');
  const empty = await invoke(eligibleHandler, { items: [{ id: cartId, qty: 1 }] });
  check('eligible returns 200 with two empty lists', empty.status === 200
    && Array.isArray(empty.payload.applicable) && empty.payload.applicable.length === 0
    && Array.isArray(empty.payload.unlockable), JSON.stringify(empty.payload));

  const noCode = await invoke(quoteHandler, { items: [{ id: cartId, qty: 1 }], couponCode: 'DEFINITELYNOTREAL' });
  check('quote refuses an unknown code with not_found',
    noCode.status === 200 && noCode.payload.ok === false && noCode.payload.reason === 'not_found',
    JSON.stringify(noCode.payload).slice(0, 160));
  check('a refused quote still returns a usable breakdown',
    Number(noCode.payload.breakdown?.grandTotal) > 0,
    `grandTotal=${noCode.payload.breakdown?.grandTotal}`);
  check('the refused breakdown carries no discount',
    noCode.payload.breakdown?.couponDiscount === 0);

  // ---------- 2. a real row, never switched on ----------
  console.log('\n— With one INACTIVE coupon row —\n');
  const created = await fetch(`${sb.url}/rest/v1/coupons`, {
    method: 'POST',
    headers: { ...h, Prefer: 'return=representation' },
    body: JSON.stringify({
      code: CODE, type: 'flat', value: 100, min_order_value: 0,
      is_active: false, usage_limit: 1,
    }),
  });
  if (!created.ok) throw new Error(`could not create probe coupon: ${await created.text()}`);
  couponId = (await created.json())[0].id;
  console.log(`  created ${CODE} (is_active=false)`);

  const inactive = await invoke(quoteHandler, { items: [{ id: cartId, qty: 1 }], couponCode: CODE });
  check('quote finds the real row and reports inactive — not not_found',
    inactive.payload.ok === false && inactive.payload.reason === 'inactive',
    `reason=${inactive.payload.reason} message="${inactive.payload.message}"`);
  check('the customer-facing message is populated',
    typeof inactive.payload.message === 'string' && inactive.payload.message.length > 0,
    `"${inactive.payload.message}"`);

  const stillEmpty = await invoke(eligibleHandler, { items: [{ id: cartId, qty: 1 }] });
  check('an inactive coupon is offered to nobody',
    stillEmpty.payload.applicable.length === 0 && stillEmpty.payload.unlockable.length === 0);

  // ---------- 3. cart-level failures are the cart's, not the coupon's ----------
  console.log('\n— Cart problems report as cart problems —\n');
  const emptyCart = await invoke(quoteHandler, { items: [], couponCode: CODE });
  check('an empty cart is a 400 about the cart',
    emptyCart.status === 400 && /cart is empty/i.test(emptyCart.payload.error || ''),
    JSON.stringify(emptyCart.payload));

  const badId = await invoke(quoteHandler, { items: [{ id: 'NO-SUCH-PRODUCT', qty: 1 }], couponCode: CODE });
  check('an unknown product is a 400, not a coupon verdict',
    badId.status === 400 && !badId.payload.reason, JSON.stringify(badId.payload));

  const badMethod = await new Promise((resolve) => {
    const res = { setHeader() {}, status(c) { this._s = c; return this; }, json(p) { resolve({ status: this._s, payload: p }); return this; } };
    quoteHandler({ method: 'GET', headers: {}, body: {} }, res);
  });
  check('GET is rejected with 405', badMethod.status === 405);

  // ---------- 4. pricing is genuinely server-side ----------
  console.log('\n— The browser cannot move the total —\n');
  const tampered = await invoke(quoteHandler, {
    items: [{ id: cartId, qty: 1, price: 1, sale_price: 1 }],
    couponCode: CODE,
  });
  check('a price posted by the browser is ignored',
    Math.round(Number(tampered.payload.breakdown?.itemTotal)) === Math.round(unit),
    `itemTotal=${tampered.payload.breakdown?.itemTotal}, catalogue price=${unit}`);
} finally {
  if (couponId) {
    await fetch(`${sb.url}/rest/v1/coupons?id=eq.${couponId}`, { method: 'DELETE', headers: h });
    console.log(`\n  deleted ${CODE}`);
  }
  const left = await (await fetch(`${sb.url}/rest/v1/coupons?select=code,is_active`, { headers: h })).json();
  const active = left.filter((c) => c.is_active);
  console.log(`  coupons table: ${left.length} row(s), ${active.length} active`);
  if (left.length !== 0) { console.log(`  LEFTOVER: ${left.map((c) => c.code).join(', ')}`); failed++; }
}

console.log(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAILURE(S)`}`);
process.exit(failed ? 1 : 0);
