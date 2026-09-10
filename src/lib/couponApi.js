// ============================================================
// COUPON CLIENT — asks the server, renders the answer
//
// There is deliberately no arithmetic in this file, and there must never be.
// The bug this whole feature replaces was a client that priced a coupon
// itself: `const COUPONS = { SORA10: 0.1 }` subtracted 10% from the display
// while checkout charged the full amount. Every rupee below arrives from
// /api/coupons/quote already computed by api/_lib/pricing.js.
//
// If you find yourself wanting a multiply or a subtract here, the figure you
// want belongs in the server's breakdown instead.
// ============================================================
import { supabase } from './supabase.js';

/**
 * The customer's own access token, when they are signed in.
 *
 * Two coupon rules depend on WHO is asking — per_user_limit and
 * first_order_only — and the server derives the identity from this token
 * rather than anything the browser claims. A guest simply sends nothing and
 * is judged as an unidentified buyer, which never refuses on those two.
 */
async function authHeader() {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/** Identifiers and quantities only — the same contract create-order uses. */
export function cartToPayload(lines) {
  return (lines || []).map((l) => ({
    id: l.id,
    qty: l.qty,
    variantId: l.variantId || null,
    variant: l.variant || null,
  }));
}

async function post(url, payload, signal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(payload),
    signal,
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok && !data) throw new Error('Something went wrong. Please try again.');
  return { status: res.status, data: data || {} };
}

/**
 * Offers that apply to this basket.
 *
 * Returns { applicable, unlockable }. `unlockable` are coupons the customer
 * is short of the minimum for; each carries `addMore`, computed server-side,
 * because "how much further" is still a discount calculation.
 *
 * Never throws for a business reason — an empty result is the honest answer
 * when there are no offers, and a failure hides the strip rather than
 * breaking the page around it.
 */
export async function fetchEligibleCoupons({ items, delivery = 'std', signal } = {}) {
  const payload = cartToPayload(items);
  if (!payload.length) return { applicable: [], unlockable: [] };
  try {
    const { data } = await post('/api/coupons/eligible', { items: payload, delivery }, signal);
    return {
      applicable: Array.isArray(data.applicable) ? data.applicable : [],
      unlockable: Array.isArray(data.unlockable) ? data.unlockable : [],
    };
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    return { applicable: [], unlockable: [] };
  }
}

/**
 * Price this cart, with a coupon code if one is supplied.
 *
 * Returns { ok, coupon, breakdown, reason, message, error }. A refused code
 * is `ok: false` WITH a breakdown — the cart still has to show a total while
 * it explains why the code did not apply.
 */
export async function quoteCart({ items, delivery = 'std', couponCode = '', signal } = {}) {
  const payload = cartToPayload(items);
  if (!payload.length) return { ok: false, error: 'Your cart is empty.' };
  const { data } = await post('/api/coupons/quote', {
    items: payload, delivery, couponCode,
  }, signal);
  return data;
}

/**
 * House format for a code: upper case, no spaces, bounded.
 *
 * Presentation only — the server normalises independently before it looks
 * anything up, so a code typed in lower case still resolves even if this
 * never ran.
 */
export function normalizeCouponCode(raw) {
  return typeof raw === 'string' ? raw.trim().toUpperCase().replace(/\s+/g, '').slice(0, 40) : '';
}
