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

/**
 * Fetch a payment's authoritative state from Razorpay.
 *
 * A valid checkout signature only proves the ids came from Razorpay — it says
 * nothing about whether the money was actually captured. An `authorized` (not
 * captured) payment carries a perfectly valid signature, and so does one that
 * was later voided. So /verify asks Razorpay directly before it will call an
 * order paid.
 *
 * Returns the payment entity. Throws with a generic message on failure; the
 * caller must treat a throw as "unknown", never as "captured".
 */
export async function fetchRazorpayPayment({ paymentId, keyId, keySecret }) {
  if (!paymentId || !keyId || !keySecret) {
    throw new Error('Missing payment lookup credentials.');
  }
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${RAZORPAY_API}/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Status code only — the body can echo payment/customer detail that has
      // no business in our logs or in an error that may bubble to a response.
      const err = new Error(`Razorpay payment lookup failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * True only when Razorpay itself reports the money as captured.
 * `authorized` is explicitly NOT enough: the funds are merely held.
 */
export function isCapturedPayment(payment) {
  return Boolean(payment) && payment.status === 'captured';
}

/**
 * Verify a Razorpay WEBHOOK signature.
 *
 * Different scheme from the checkout callback: the HMAC is computed over the
 * RAW request body (not `order|payment`) using the webhook secret, which is a
 * separate credential from the API key secret.
 *
 * `rawBody` must be the exact bytes Razorpay sent. Re-serialising the parsed
 * JSON changes key order/whitespace and would fail verification, so the route
 * reads the raw stream.
 */
export function verifyWebhookSignature({ rawBody, signature, webhookSecret }) {
  if (!rawBody || !signature || !webhookSecret) return false;
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody, 'utf8')
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Webhook secret is a distinct credential from the API key secret. */
export function getWebhookSecret() {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  return { secret, configured: Boolean(secret) };
}
