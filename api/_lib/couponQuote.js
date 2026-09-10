// ============================================================
// COUPON QUOTING — the one path from a cart to a discount
//
// /api/coupons/eligible, /api/coupons/quote and create-order's revalidation
// all go through here. That is deliberate: a quote the customer was shown
// and the figure charged at order time must come from the same code, or they
// eventually disagree in front of them. That disagreement is exactly the bug
// Cart.jsx documents — a client-side SORA10 that took 10% off the display and
// nothing off the charge.
//
// Nothing in this file prices anything itself. The rupee figures all come
// from computeOrderTotal() in pricing.js, which stays the only place in this
// codebase allowed to price an order.
// ============================================================
import { validateCartPayload, computeOrderTotal, computeCouponDiscount } from './pricing.js';
import { getTaxConfig } from './tax.js';
import {
  fetchProductsForCart, fetchVariantsForCart, fetchCouponRowByCode,
  fetchActiveCoupons, countCouponUsesForUser, hasPriorPaidOrder,
} from './supabaseAdmin.js';
import {
  COUPON_REASONS, validateCoupon, reasonMessage, publicCouponView,
} from './coupons.js';

/**
 * Price the cart with no coupon at all.
 *
 * The result's breakdown.itemTotal is the goods value after product discount,
 * and that — not the grand total — is what a coupon applies to. Shipping,
 * fees and tax are deliberately outside the eligible amount: a ₹79 Express
 * fee must not help a basket clear a ₹999 minimum.
 *
 * Returns { ok, items, products, variantRows, base } or { ok:false, error }.
 */
export async function priceCart(rawItems, deliveryMethod, sb, opts = {}) {
  const parsed = validateCartPayload(rawItems);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const products = await fetchProductsForCart(parsed.items.map((i) => i.id), sb);
  const variantRows = await fetchVariantsForCart(parsed.items.map((i) => i.variantId), sb);

  const base = computeOrderTotal(parsed.items, products, deliveryMethod, {
    variantRows,
    taxConfig: getTaxConfig(),
    buyerState: opts.buyerState ?? null,
  });
  if (!base.ok) return { ok: false, error: base.error };

  return { ok: true, items: parsed.items, products, variantRows, base };
}

/**
 * The buyer facts validateCoupon needs, loaded once per request rather than
 * once per coupon. Both are null for a guest, and null is never read as
 * "no" — see the note in validateCoupon.
 */
export async function loadBuyerContext(userId, sb) {
  if (!userId) return { userId: null, hasPriorOrder: null };
  return { userId, hasPriorOrder: await hasPriorPaidOrder(userId, sb) };
}

/**
 * Judge one coupon against a priced cart. Pure orchestration: the decision is
 * validateCoupon's, the rupee figure is computeCouponDiscount's.
 */
export async function judgeCoupon(coupon, eligibleAmount, buyer, sb) {
  // Only fetched when the coupon actually has a per-user cap — an
  // unrestricted coupon should not cost a round trip to the redemptions
  // table on every cart view.
  const userUses = coupon?.per_user_limit != null && buyer?.userId
    ? await countCouponUsesForUser(coupon.id, buyer.userId, sb)
    : null;

  const verdict = validateCoupon(coupon, {
    eligibleAmount,
    userUses,
    hasPriorOrder: buyer?.hasPriorOrder ?? null,
  });

  const discount = verdict.ok ? computeCouponDiscount(coupon, eligibleAmount) : 0;
  return { ...verdict, discount, message: verdict.ok ? '' : reasonMessage(verdict.reason, coupon) };
}

/**
 * Every switched-on coupon, split by whether this cart can use it.
 *
 *   applicable  usable right now, with the discount it would give
 *   unlockable  fails on the minimum order value and NOTHING else, so the
 *               customer can reach it by spending more
 *
 * An expired, exhausted or already-used coupon appears in neither list: it is
 * not an offer, and dangling it in front of someone who cannot have it is
 * worse than silence.
 *
 * A coupon still shown here is only ever an OFFER. The card renders the copy
 * and the code; it never renders a discounted price, because at PDP the
 * "cart" is one unit and any figure derived from it would be wrong the moment
 * a second item went in the basket.
 */
export async function listEligibleCoupons(eligibleAmount, buyer, sb) {
  const coupons = await fetchActiveCoupons(sb);
  const applicable = [];
  const unlockable = [];

  for (const coupon of coupons) {
    const judged = await judgeCoupon(coupon, eligibleAmount, buyer, sb);
    if (judged.ok) {
      applicable.push(publicCouponView(coupon, judged.discount));
      continue;
    }
    if (judged.reason === COUPON_REASONS.BELOW_MIN) {
      const min = Math.round(Number(coupon.min_order_value) || 0);
      unlockable.push({
        ...publicCouponView(coupon, 0),
        // What the customer must still add. Computed here rather than in the
        // browser so the cart never subtracts two numbers of its own.
        addMore: Math.max(0, min - Math.round(eligibleAmount)),
        message: judged.message,
      });
    }
  }

  // Best offer first. Ties keep the order the database returned them in.
  applicable.sort((a, b) => b.discount - a.discount);
  unlockable.sort((a, b) => a.addMore - b.addMore);
  return { applicable, unlockable };
}

/**
 * Resolve a code against a priced cart and re-price the cart with it.
 *
 * Returns { ok:true, coupon, breakdown, totals } when the code applies, and
 * { ok:false, reason, message } when it does not — the message is always
 * COUPON_REASONS wording, never composed at the call site, so the cart and
 * checkout say the same thing about the same failure.
 */
export async function quoteCoupon(code, priced, deliveryMethod, buyer, sb, opts = {}) {
  const coupon = await fetchCouponRowByCode(code, sb);
  const eligibleAmount = priced.base.breakdown.itemTotal;

  const judged = await judgeCoupon(coupon, eligibleAmount, buyer, sb);
  if (!judged.ok) return { ok: false, reason: judged.reason, message: judged.message, coupon: null };

  // Re-price the whole cart WITH the coupon rather than subtracting the
  // discount from the base total. Tax is apportioned across the discounted
  // lines inside computeOrderTotal, so subtracting afterwards would report a
  // total the invoice could not reproduce.
  const totals = computeOrderTotal(priced.items, priced.products, deliveryMethod, {
    variantRows: priced.variantRows,
    coupon,
    taxConfig: getTaxConfig(),
    buyerState: opts.buyerState ?? null,
  });
  if (!totals.ok) return { ok: false, reason: COUPON_REASONS.NOT_FOUND, message: totals.error, coupon: null };

  return {
    ok: true,
    reason: COUPON_REASONS.OK,
    message: '',
    coupon: publicCouponView(coupon, totals.breakdown.couponDiscount),
    row: coupon,
    totals,
  };
}
