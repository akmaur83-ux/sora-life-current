// ============================================================
// LOCAL COUPON PREVIEW SERVER — for verifying the UI, not the data
//
//   node scripts/dev-coupon-preview.mjs        (http://localhost:4180)
//
// Serves the built site AND answers /api/coupons/eligible and
// /api/coupons/quote, which python server.py cannot (they are Vercel
// functions).
//
// The coupons are FIXTURES defined below. They are never written anywhere and
// the real coupons table is never read. That is deliberate: a coupon that is
// is_active=true in the production database is returned by /eligible to every
// visitor on every product page, so "just make one briefly to look at it"
// would put a live, redeemable code in front of real customers. The database
// stays at zero coupons; the pixels get verified here.
//
// What IS real: priceCart() prices the cart from the real products table, and
// validateCoupon()/computeCouponDiscount() judge and price the fixtures. So
// the figures on screen are produced by the same functions that produce them
// in production — only the coupon rows are invented.
//
// Lives in scripts/, which .vercelignore excludes, so it is never deployed.
// ============================================================
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PORT = Number(process.env.PORT || 4180);

for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  if (!line.includes('=') || line.trim().startsWith('#')) continue;
  const i = line.indexOf('=');
  const k = line.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const { getSupabaseConfig } = await import('../api/_lib/supabaseAdmin.js');
const { priceCart } = await import('../api/_lib/couponQuote.js');
const { validateCoupon, publicCouponView, reasonMessage, COUPON_REASONS } = await import('../api/_lib/coupons.js');
const { computeCouponDiscount, computeOrderTotal } = await import('../api/_lib/pricing.js');
const { getTaxConfig } = await import('../api/_lib/tax.js');

const sb = getSupabaseConfig();

// ---- Fixtures: exactly the shapes the storefront has to render ----
const now = Date.now();
const iso = (d) => new Date(now + d * 86400000).toISOString();
const FIXTURES = [
  {
    id: 'fx-1', code: 'WELCOME200', type: 'flat', value: 200,
    min_order_value: 0, max_discount: null,
    starts_at: iso(-7), expires_at: iso(30),
    usage_limit: null, used_count: 0, per_user_limit: null, is_active: true,
    title: 'Welcome gift', description: '₹200 off your first order',
    first_order_only: false, is_stackable: false,
  },
  {
    // Untitled on purpose: proves the ticket falls back to the terms rather
    // than rendering an empty card.
    id: 'fx-2', code: 'SAVE15', type: 'percent', value: 15,
    min_order_value: 0, max_discount: 500,
    starts_at: iso(-1), expires_at: iso(10),
    usage_limit: null, used_count: 0, per_user_limit: null, is_active: true,
    title: null, description: null,
    first_order_only: false, is_stackable: false,
  },
  {
    // Above the minimum for a small basket: exercises the "unlockable" branch
    // and the server-computed addMore.
    id: 'fx-3', code: 'BIG1000', type: 'flat', value: 1000,
    min_order_value: 60000, max_discount: null,
    starts_at: iso(-1), expires_at: iso(10),
    usage_limit: null, used_count: 0, per_user_limit: null, is_active: true,
    title: 'Bulk saver', description: 'On large orders',
    first_order_only: false, is_stackable: false,
  },
  {
    // Exhausted: must appear in NEITHER list.
    id: 'fx-4', code: 'GONE', type: 'flat', value: 100,
    min_order_value: 0, max_discount: null,
    starts_at: iso(-10), expires_at: iso(10),
    usage_limit: 5, used_count: 5, per_user_limit: null, is_active: true,
    title: 'Fully claimed', description: 'Nobody should see this',
    first_order_only: false, is_stackable: false,
  },
  {
    // Expired: /quote must say so by name.
    id: 'fx-5', code: 'OLDCODE', type: 'flat', value: 100,
    min_order_value: 0, max_discount: null,
    starts_at: iso(-30), expires_at: iso(-1),
    usage_limit: null, used_count: 0, per_user_limit: null, is_active: true,
    title: 'Last season', description: 'Expired',
    first_order_only: false, is_stackable: false,
  },
];

const readBody = (req) => new Promise((resolve) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
});

const send = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.map': 'application/json', '.mp4': 'video/mp4',
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/coupons/eligible' || url.pathname === '/api/coupons/quote') {
    const body = await readBody(req);
    const priced = await priceCart(body.items, body.delivery, sb, {});
    if (!priced.ok) {
      return url.pathname.endsWith('eligible')
        ? send(res, 200, { applicable: [], unlockable: [] })
        : send(res, 400, { ok: false, error: priced.error });
    }
    const eligibleAmount = priced.base.breakdown.itemTotal;

    if (url.pathname.endsWith('eligible')) {
      const applicable = []; const unlockable = [];
      for (const c of FIXTURES) {
        const v = validateCoupon(c, { eligibleAmount });
        if (v.ok) { applicable.push(publicCouponView(c, computeCouponDiscount(c, eligibleAmount))); continue; }
        if (v.reason === COUPON_REASONS.BELOW_MIN) {
          unlockable.push({
            ...publicCouponView(c, 0),
            addMore: Math.max(0, Math.round(Number(c.min_order_value) || 0) - Math.round(eligibleAmount)),
            message: reasonMessage(v.reason, c),
          });
        }
      }
      applicable.sort((a, b) => b.discount - a.discount);
      unlockable.sort((a, b) => a.addMore - b.addMore);
      return send(res, 200, { applicable, unlockable });
    }

    const code = String(body.couponCode || '').trim().toUpperCase();
    if (!code) return send(res, 200, { ok: true, coupon: null, breakdown: priced.base.breakdown });

    const found = FIXTURES.find((c) => c.code === code) || null;
    const v = validateCoupon(found, { eligibleAmount });
    if (!v.ok) {
      return send(res, 200, {
        ok: false, reason: v.reason, message: reasonMessage(v.reason, found),
        breakdown: priced.base.breakdown,
      });
    }
    const totals = computeOrderTotal(priced.items, priced.products, body.delivery, {
      variantRows: priced.variantRows, coupon: found, taxConfig: getTaxConfig(),
    });
    return send(res, 200, {
      ok: true,
      coupon: publicCouponView(found, totals.breakdown.couponDiscount),
      breakdown: totals.breakdown,
    });
  }

  // Static, with SPA fallback — same rule as server.py.
  let p = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  if (!extname(p) || !existsSync(p)) p = join(ROOT, 'index.html');
  if (!existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
  return res.end(readFileSync(p));
}).listen(PORT, () => {
  console.log(`\ncoupon preview on http://localhost:${PORT}`);
  console.log(`  ${FIXTURES.length} fixture coupons; the coupons table is NOT touched`);
  console.log('  applicable: WELCOME200, SAVE15   unlockable: BIG1000');
  console.log('  hidden: GONE (exhausted), OLDCODE (expired — try typing it)\n');
});
