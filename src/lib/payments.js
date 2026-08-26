// ============================================================
// Client-side payment helpers.
//
// This file never sees a secret. It sends cart identifiers + quantities to
// the server, which recalculates the amount and creates the Razorpay
// order; and it forwards Razorpay's callback to the server for signature
// verification. The browser is never the authority on price or on whether
// a payment succeeded.
// ============================================================

import { supabase } from './supabase.js';
import { getVisitorId } from './creatorAttribution.js';

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptPromise = null;

/**
 * If a customer is signed in, return their Supabase access token as an
 * Authorization header so the server can link the new order to their
 * account. Guests (no session) send nothing and check out exactly as
 * before. This header carries only the user's own short-lived JWT — never
 * a secret, and never a client-chosen user id.
 */
async function customerAuthHeader() {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/** Load Razorpay Checkout once; resolves true when window.Razorpay exists. */
export function loadRazorpayScript() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve) => {
    const el = document.createElement('script');
    el.src = RAZORPAY_SCRIPT;
    el.async = true;
    el.onload = () => resolve(Boolean(window.Razorpay));
    el.onerror = () => { scriptPromise = null; resolve(false); };
    document.body.appendChild(el);
  });
  return scriptPromise;
}

async function postJson(url, payload, extraHeaders = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(payload),
  });

  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error page */ }

  if (!res.ok) {
    const err = new Error(data?.error || 'Something went wrong. Please try again.');
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * Ask the server to price the cart and open a payable order.
 * Only ids + quantities are sent — never prices or totals.
 */
export async function createPaymentOrder({ items, delivery, customer, paymentMethod }) {
  const authHeaders = await customerAuthHeader();
  return postJson('/api/razorpay/create-order', {
    // Identifiers and quantities only. No price is sent: the server looks up
    // the variant's price and recomputes the total (api/_lib/pricing.js).
    items: items.map((l) => ({
      id: l.id,
      qty: l.qty,
      variantId: l.variantId || null,
      variant: l.variant || null,
    })),
    delivery,
    customer,
    paymentMethod,
    // Opaque, self-assigned browser id used ONLY to resolve creator attribution
    // server-side. Carries no internal creator/campaign/link id and no PII.
    visitorId: getVisitorId(),
  }, authHeaders);
}

/** Hand Razorpay's callback to the server, which alone decides if it's genuine. */
export function verifyPayment(response) {
  return postJson('/api/razorpay/verify', {
    razorpay_order_id: response.razorpay_order_id,
    razorpay_payment_id: response.razorpay_payment_id,
    razorpay_signature: response.razorpay_signature,
  });
}
