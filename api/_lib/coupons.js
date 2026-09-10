// ============================================================
// COUPON VALIDATION — one decision, shared by every caller
//
// /api/coupons/eligible, /api/coupons/quote and create-order all run THIS
// function. That is the point: the quote a customer was shown and the
// revalidation at order time must be the same logic, or they eventually
// disagree in front of them — which is exactly how the old client-only
// SORA10/WELCOME codes failed.
//
// Nothing here computes a discount. The rupee figure comes from
// computeOrderTotal() in pricing.js, already the only place in this codebase
// allowed to price an order.
//
// TOLERATES AN UNAPPLIED MIGRATION. 0028 adds title, description,
// first_order_only and is_stackable. Until it is applied those columns are
// absent from the row, so every read of them is defaulted the way
// dbRowToProduct treats the 0025 content columns: absent means "no opinion",
// never "false is the answer".
// ============================================================

/** Validation outcomes, in the order they are checked. */
export const COUPON_REASONS = {
  OK: 'ok',
  NOT_FOUND: 'not_found',
  INACTIVE: 'inactive',
  NOT_STARTED: 'not_started',
  EXPIRED: 'expired',
  BELOW_MIN: 'below_min_order',
  EXHAUSTED: 'exhausted',
  USER_LIMIT: 'user_limit',
  FIRST_ORDER_ONLY: 'first_order_only',
};

/**
 * Rupees, grouped the way the storefront groups them.
 *
 * These strings sit directly beside figures the browser formatted with
 * money(), so an ungrouped "₹60000" next to a grouped "₹19,500" reads as a
 * different kind of number rather than the same one.
 */
const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

/** Customer-facing wording. The UI shows these; it never composes its own. */
export function reasonMessage(reason, coupon) {
  const min = Number(coupon?.min_order_value) || 0;
  switch (reason) {
    case COUPON_REASONS.NOT_FOUND: return 'That code is not valid.';
    case COUPON_REASONS.INACTIVE: return 'That code is no longer available.';
    case COUPON_REASONS.NOT_STARTED: return 'That code is not active yet.';
    case COUPON_REASONS.EXPIRED: return 'That code has expired.';
    case COUPON_REASONS.BELOW_MIN: return `Spend ${rupees(min)} or more to use this code.`;
    case COUPON_REASONS.EXHAUSTED: return 'That code has been fully claimed.';
    case COUPON_REASONS.USER_LIMIT: return 'You have already used this code.';
    case COUPON_REASONS.FIRST_ORDER_ONLY: return 'That code is for first orders only.';
    default: return '';
  }
}

/** 0028 columns, read so an unapplied migration behaves as "no rule". */
export const couponFlags = (c) => ({
  firstOrderOnly: c?.first_order_only === true,
  stackable: c?.is_stackable === true,
  title: (typeof c?.title === 'string' && c.title.trim()) || null,
  description: (typeof c?.description === 'string' && c.description.trim()) || null,
});

/**
 * Is this coupon usable for this cart and this buyer?
 *
 * `context` is entirely server-derived:
 *   eligibleAmount  goods value after product discount, from computeOrderTotal
 *   userUses        coupon_redemptions rows for (coupon, user); null = unknown
 *   hasPriorOrder   buyer already has a paid order; null = unknown
 *   now             injectable, so the window cases are testable
 *
 * Returns { ok, reason }. The check order is fixed and is the order the
 * brief specifies, so the reason shown is the FIRST thing wrong rather than
 * whichever check happened to run first.
 */
export function validateCoupon(coupon, context = {}) {
  const now = context.now instanceof Date ? context.now : new Date();
  const R = COUPON_REASONS;

  if (!coupon) return { ok: false, reason: R.NOT_FOUND };
  if (coupon.is_active !== true) return { ok: false, reason: R.INACTIVE };

  const startsAt = coupon.starts_at ? new Date(coupon.starts_at) : null;
  if (startsAt && !Number.isNaN(startsAt.getTime()) && startsAt > now) {
    return { ok: false, reason: R.NOT_STARTED };
  }
  const expiresAt = coupon.expires_at ? new Date(coupon.expires_at) : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt < now) {
    return { ok: false, reason: R.EXPIRED };
  }

  const min = Number(coupon.min_order_value) || 0;
  const amount = Number(context.eligibleAmount) || 0;
  if (amount < min) return { ok: false, reason: R.BELOW_MIN };

  // usage_limit is the brief's usage_limit_total. used_count is maintained by
  // consume_coupon() under its row lock, so this read is advisory — the lock
  // is what actually prevents overshoot.
  const limit = coupon.usage_limit == null ? null : Number(coupon.usage_limit);
  if (limit != null && Number(coupon.used_count || 0) >= limit) {
    return { ok: false, reason: R.EXHAUSTED };
  }

  const perUser = coupon.per_user_limit == null ? null : Number(coupon.per_user_limit);
  if (perUser != null && context.userUses != null && Number(context.userUses) >= perUser) {
    return { ok: false, reason: R.USER_LIMIT };
  }

  // Refuses only on a KNOWN prior order. An unidentified buyer is not assumed
  // to be a returning one; create-order re-checks with the identity it
  // actually has, and consume_coupon holds the final lock.
  if (couponFlags(coupon).firstOrderOnly && context.hasPriorOrder === true) {
    return { ok: false, reason: R.FIRST_ORDER_ONLY };
  }

  return { ok: true, reason: R.OK };
}

/** The shape the storefront renders. Never includes internal counters. */
export function publicCouponView(coupon, discount) {
  const flags = couponFlags(coupon);
  const min = Math.round(Number(coupon.min_order_value) || 0);
  return {
    code: coupon.code,
    // Falls back to a sentence derived from the coupon's own fields, so a
    // coupon created before 0028 — or one an admin left untitled — still
    // renders something true rather than an empty card.
    title: flags.title
      || (coupon.type === 'percent'
        ? `${Math.round(Number(coupon.value) || 0)}% off`
        : `${rupees(coupon.value)} off`),
    description: flags.description || (min > 0 ? `On orders above ${rupees(min)}` : 'On any order'),
    discount: Math.round(Number(discount) || 0),
    minOrderValue: min,
  };
}
