// ============================================================
// POST /api/coupons/eligible
//
// "Which offers apply to this basket?" Read-only: it creates no order, holds
// no coupon, and writes nothing. The PDP calls it with a single line, the
// cart with the real basket — same code path either way, so an offer shown on
// a product page is one the cart will honour.
//
// This endpoint is why coupons has no public read policy. Migration 0006 is
// explicit: "a customer must not be able to enumerate every coupon." The
// service-role key stays here and only the coupons that apply to the cart in
// hand go back to the browser, with the internal counters (used_count,
// usage_limit, per_user_limit) stripped by publicCouponView.
//
// Request  { items: [{ id, qty, variantId }], delivery? }
// Response { applicable: [...], unlockable: [...] }
// ============================================================
import { getSupabaseConfig, getUserIdFromToken } from '../_lib/supabaseAdmin.js';
import { enforceRateLimit } from '../_lib/rateLimit.js';
import { priceCart, loadBuyerContext, listEligibleCoupons } from '../_lib/couponQuote.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const sb = getSupabaseConfig();

  // Unauthenticated and DB-touching, so it is limited like the other public
  // endpoints. Generous: the cart re-quotes on every mutation, and a customer
  // adjusting quantities a few times must never be told to slow down.
  if (!(await enforceRateLimit(req, res, { name: 'coupons-eligible', limit: 40, windowSeconds: 60 }, sb))) return;

  // No database means no coupons — an empty offer list, not an error. The PDP
  // slot and the cart section both render nothing for an empty list, so the
  // page degrades to exactly how it looks today.
  if (!sb.configured) return res.status(200).json({ applicable: [], unlockable: [] });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const priced = await priceCart(body.items, body.delivery, sb, {
      buyerState: typeof body.customer?.state === 'string' ? body.customer.state : null,
    });
    // An unpriceable cart (empty, out of stock, unknown id) has no offers to
    // show. Checkout is the place that explains why a cart cannot be ordered;
    // an offer strip must not start reporting stock errors.
    if (!priced.ok) return res.status(200).json({ applicable: [], unlockable: [] });

    const userId = await getUserIdFromToken(req.headers?.authorization, sb);
    const buyer = await loadBuyerContext(userId, sb);

    const { applicable, unlockable } = await listEligibleCoupons(
      priced.base.breakdown.itemTotal, buyer, sb,
    );

    return res.status(200).json({ applicable, unlockable });
  } catch (err) {
    console.error('[coupons/eligible]', err?.message);
    // Offers are decoration on top of a working cart. A failure here hides
    // the strip; it never blocks the page.
    return res.status(200).json({ applicable: [], unlockable: [] });
  }
}
