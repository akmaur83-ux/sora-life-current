// ============================================================
// Razorpay server-side helpers.
//
// RAZORPAY_KEY_SECRET is read from the environment and never leaves the
// server: it is used only for the Orders API Basic-auth header and for
// HMAC signature verification. It is never returned to the browser, never
// logged, and never included in any response body.
// ============================================================
import crypto from 'node:crypto';

const RAZORPAY_API = 'https://api.razorpay.com/v1';

export function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return { keyId, keySecret, configured: Boolean(keyId && keySecret) };
}

/**
 * Verify the Razorpay payment signature.
 *
 * Razorpay signs `${razorpay_order_id}|${razorpay_payment_id}` with
 * HMAC-SHA256 using the key secret. A payment is only genuine if our
 * independently computed digest matches the signature Razorpay returned.
 * Compared with timingSafeEqual to avoid leaking information through
 * comparison timing.
 */
export function verifyPaymentSignature({ orderId, paymentId, signature, keySecret }) {
  if (!orderId || !paymentId || !signature || !keySecret) return false;

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  // timingSafeEqual throws on length mismatch, so guard first.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Create a Razorpay order. Uses the REST API directly with Basic auth so
 * the project needs no additional runtime dependency.
 */
export async function createRazorpayOrder({ amountPaise, currency, receipt, notes, keyId, keySecret }) {
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const res = await fetch(`${RAZORPAY_API}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: currency || 'INR',
      receipt,
      notes,
      payment_capture: 1,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Surface Razorpay's own description for server logs only — the caller
    // decides what (if anything) reaches the browser.
    const detail = body?.error?.description || `Razorpay responded ${res.status}`;
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return body;
}
