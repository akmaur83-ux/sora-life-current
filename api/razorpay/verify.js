// ============================================================
// POST /api/razorpay/verify
//
// The ONLY place an order can become `paid`.
//
// Razorpay's client callback is not trusted on its own — anyone can call
// this endpoint with made-up ids. The payment is accepted only if the
// HMAC-SHA256 signature over `${order_id}|${payment_id}`, computed here
// with RAZORPAY_KEY_SECRET, matches the signature Razorpay returned.
//
// Idempotent: razorpay_order_id is UNIQUE and an already-paid order short-
// circuits to the same success response, so a double-click, a retried
// request, a repeated callback or a refresh can never produce two paid
// orders or a double charge.
// ============================================================
import { getRazorpayCredentials, verifyPaymentSignature } from '../_lib/razorpay.js';
import { getSupabaseConfig, findOrderByRazorpayOrderId, updateOrderById, consumeCouponForOrder, setConversionStatus } from '../_lib/supabaseAdmin.js';
import { enforceRateLimit } from '../_lib/rateLimit.js';

function fail(res, status, message) {
  return res.status(status).json({ verified: false, error: message });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'Method not allowed.');
  }

  const rz = getRazorpayCredentials();
  const sb = getSupabaseConfig();

  // Rate limit access to the endpoint (does NOT touch signature logic below).
  if (!(await enforceRateLimit(req, res, { name: 'verify', limit: 30, windowSeconds: 60 }, sb))) return;
  if (!rz.configured || !sb.configured) {
    console.error('[verify] server env not configured.');
    return fail(res, 503, 'We could not confirm your payment right now. Please contact support.');
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = body;

    if (!orderId || !paymentId || !signature) {
      return fail(res, 400, 'Missing payment details.');
    }

    const order = await findOrderByRazorpayOrderId(orderId, sb);
    if (!order) {
      console.error('[verify] no local order for razorpay_order_id');
      return fail(res, 404, 'We could not find that order.');
    }

    // Idempotency: already verified and paid -> return the same success.
    if (order.payment_status === 'paid') {
      return res.status(200).json({
        verified: true,
        alreadyProcessed: true,
        orderNumber: order.order_number,
        amount: order.amount_paise / 100,
      });
    }

    const valid = verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
      keySecret: rz.keySecret,
    });

    if (!valid) {
      // Signature mismatch => not a genuine Razorpay payment. Mark failed;
      // never mark paid.
      console.error('[verify] signature mismatch for order', order.order_number);
      await updateOrderById(order.id, {
        status: 'failed',
        payment_status: 'failed',
        failure_reason: 'signature_verification_failed',
      }, sb).catch(() => {});
      return fail(res, 400, 'We could not verify this payment. You have not been charged by Sora Life.');
    }

    const paid = await updateOrderById(order.id, {
      status: 'paid',
      payment_status: 'paid',
      razorpay_payment_id: paymentId,
      paid_at: new Date().toISOString(),
    }, sb);

    // Order is now definitively paid -> consume its coupon (if any). Atomic
    // and idempotent per order in the DB, and non-fatal here: a coupon-ledger
    // issue must never fail a payment that already succeeded.
    await consumeCouponForOrder(order, sb).catch(() => {});
    // Creator attribution: a paid order qualifies its conversion. Idempotent
    // and non-fatal (a retried verify just no-ops).
    await setConversionStatus(order.id, 'eligible', 'payment_verified', sb).catch(() => {});

    return res.status(200).json({
      verified: true,
      orderNumber: paid?.order_number || order.order_number,
      amount: (paid?.amount_paise ?? order.amount_paise) / 100,
    });
  } catch (err) {
    console.error('[verify] failed:', err?.message);
    return fail(res, 500, 'We could not confirm your payment. Please contact support before paying again.');
  }
}
