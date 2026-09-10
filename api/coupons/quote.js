// ============================================================
// POST /api/coupons/quote
//
// The missing piece Cart.jsx names: "a way to VALIDATE a code before the
// customer commits". Until now the only server call that could price a
// coupon was create-order, which already writes the order row — and for COD
// completes the purchase. So the cart could either guess (the old SORA10 bug)
// or offer nothing. This endpoint quotes without committing to anything.
//
// Read-only. It creates no order and does NOT reserve the coupon: nothing is
// consumed until consume_coupon() runs under its row lock after payment. Two
// customers can therefore both be quoted the last remaining use, and the
// second is refused at order time — which is the correct trade. Holding a
// coupon for an abandoned cart takes it away from someone who would have
// completed.
//
// Request  { items, delivery, couponCode, customer? }
// Response { ok, coupon, breakdown, reason?, message? }
// ============================================================
import { getSupabaseConfig, getUserIdFromToken } from '../_lib/supabaseAdmin.js';
import { enforceRateLimit } from '../_lib/rateLimit.js';
import { priceCart, loadBuyerContext, quoteCoupon } from '../_lib/couponQuote.js';
import { COUPON_REASONS, reasonMessage } from '../_lib/coupons.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const sb = getSupabaseConfig();

  // Tighter than /eligible on purpose. This is the one endpoint that answers
  // "is this string a real coupon", so it is the guessing surface. 15/minute
  // is far more than a customer typing a code from a poster needs and far
  // less than a dictionary run wants.
  if (!(await enforceRateLimit(req, res, { name: 'coupons-quote', limit: 15, windowSeconds: 60 }, sb))) return;

  if (!sb.configured) {
    return res.status(503).json({ ok: false, error: 'We could not check that code right now. Please try again.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const buyerState = typeof body.customer?.state === 'string' ? body.customer.state : null;

    const priced = await priceCart(body.items, body.delivery, sb, { buyerState });
    // The cart's own problem, not the coupon's. Reported as-is so the
    // customer is told "X is out of stock" rather than "that code is invalid".
    if (!priced.ok) return res.status(400).json({ ok: false, error: priced.error });

    const code = typeof body.couponCode === 'string' ? body.couponCode : '';
    if (!code.trim()) {
      return res.status(400).json({
        ok: false,
        reason: COUPON_REASONS.NOT_FOUND,
        message: reasonMessage(COUPON_REASONS.NOT_FOUND),
      });
    }

    const userId = await getUserIdFromToken(req.headers?.authorization, sb);
    const buyer = await loadBuyerContext(userId, sb);

    const quoted = await quoteCoupon(code, priced, body.delivery, buyer, sb, { buyerState });

    if (!quoted.ok) {
      // 200, not 4xx: the request was well-formed and the answer is a real
      // answer. The cart renders `message` beside the input; a 4xx here would
      // make every rejected code look like a network fault in the console.
      return res.status(200).json({
        ok: false,
        reason: quoted.reason,
        message: quoted.message,
        // The cart still needs a total to render while the code is refused.
        breakdown: priced.base.breakdown,
      });
    }

    return res.status(200).json({
      ok: true,
      coupon: quoted.coupon,
      // Every figure the cart displays comes from here. The browser adds and
      // subtracts nothing — that is the whole point of the endpoint.
      breakdown: quoted.totals.breakdown,
    });
  } catch (err) {
    console.error('[coupons/quote]', err?.message);
    return res.status(500).json({ ok: false, error: 'We could not check that code right now. Please try again.' });
  }
}
