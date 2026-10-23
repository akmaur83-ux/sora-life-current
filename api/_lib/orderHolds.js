// ============================================================
// ORDER HOLDS — what an order holds while it is being paid for
//
// Migration 0039 does the holding, under row locks, in reserve_order_holds /
// settle_order_holds / release_order_holds. This module only says WHAT an
// order needs held and for HOW LONG, so create-order, verify and the webhook
// all ask the database the same question in the same way.
//
// The numbers, and why:
//   30 minutes   an unpaid online order's hold. Long enough that a slow payer
//                keeps their unit and their coupon; short enough that an
//                abandoned checkout lets go within half an hour (a failed
//                payment or a changed checkout lets go at once).
//   15 minutes   the longest the Razorpay window stays open (its `timeout`
//                option). UPI, card OTP and netbanking all finish well inside.
//   10 minutes   what is always left of the hold when the window closes, so
//                a payment already under way lands while it is still held.
//                One that lands even later is still honoured (see 0039).
// ============================================================

export const HOLD_MINUTES = 30;
export const PAYMENT_WINDOW_SECONDS = 15 * 60;
export const SETTLE_MARGIN_SECONDS = 10 * 60;
/** A replay with less window than this left is refused: the customer places it afresh. */
export const MIN_WINDOW_SECONDS = 2 * 60;

/**
 * The counted stock an order's priced lines draw on, one entry per line:
 * { target, id, qty, label, line } in the shape reserve_order_holds reads.
 *
 * Only three columns are counts: a wellness pack size (product_variants), a
 * fashion or Home & Living option (catalogue_variants) and a Home & Living
 * product without options (catalogue_products). A wellness product without a
 * pack size carries an in-stock FLAG (products.stock), not a number, so it
 * holds nothing — as before, it is sold while the flag is on.
 *
 * `lines` are computeOrderTotal's lines, which is also what orders.items holds.
 */
export function stockLines(lines) {
  const out = [];
  (Array.isArray(lines) ? lines : []).forEach((l, i) => {
    const qty = Number(l?.qty);
    if (!Number.isInteger(qty) || qty < 1) return;
    let target = null;
    let id = null;
    if (l.catalogue === 'fashion') {
      if (l.variant_id) { target = 'catalogue_variants'; id = l.variant_id; }
    } else if (l.catalogue === 'homeliving') {
      if (l.variant_id) { target = 'catalogue_variants'; id = l.variant_id; }
      else if (l.product_id) { target = 'catalogue_products'; id = l.product_id; }
    } else if (l.variant_id) {
      target = 'product_variants'; id = l.variant_id;
    }
    if (!target || id == null) return;
    out.push({ target, id: String(id), qty, label: `${l.name || 'Item'}${l.variant ? ` (${l.variant})` : ''}`, line: i });
  });
  return out;
}

/**
 * How long the Razorpay window may stay open for an order held until
 * `reservedUntil`: the full 15 minutes on a fresh order, less on a replayed
 * one, 0 when too little of the hold is left to open it at all. An order with
 * no hold (COD, or placed before 0039) gets the full window.
 */
export function paymentWindowSeconds(reservedUntil, now = Date.now()) {
  if (!reservedUntil) return PAYMENT_WINDOW_SECONDS;
  const until = Date.parse(reservedUntil);
  if (!Number.isFinite(until)) return PAYMENT_WINDOW_SECONDS;
  const usable = Math.floor((until - now) / 1000) - SETTLE_MARGIN_SECONDS;
  if (usable < MIN_WINDOW_SECONDS) return 0;
  return Math.min(PAYMENT_WINDOW_SECONDS, usable);
}

/** What the customer is told when a unit they wanted is held or bought by someone else. */
export function stockRefusalMessage(line, available) {
  const name = line?.label || 'An item in your cart';
  return available > 0
    ? `Only ${available} of "${name}" ${available === 1 ? 'is' : 'are'} left. Please update your cart and try again.`
    : `"${name}" has just sold out. Please remove it from your cart and try again.`;
}
