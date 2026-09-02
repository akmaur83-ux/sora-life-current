// ============================================================
// POST /api/razorpay/verify
//
// The ONLY place an order can become `paid`.
//
// Razorpay's client callback is not trusted on its own — anyone can call
// this endpoint with made-up ids. Two independent things must BOTH hold:
//
//   1. The HMAC-SHA256 signature over `${order_id}|${payment_id}`, computed
//      here with RAZORPAY_KEY_SECRET, matches what Razorpay returned. This
//      proves the ids are genuine.
//   2. Razorpay's own Payments API reports the payment as CAPTURED, against
//      this order, for this amount. This proves the money actually moved.
//
// (1) alone is not proof of payment, which is how this endpoint used to work:
// an `authorized`-but-never-captured payment carries a completely valid
// signature, so a customer could reach a "paid" order for money that was only
// ever held and would later be released.
//
// Idempotent and monotonic: razorpay_order_id is UNIQUE, an already-paid
// order short-circuits to the same success response, and every write is
// conditional on the order not already being paid — so a double-click, a
// retried request, a repeated callback, or a forged request racing a genuine
// one can never produce two paid orders, a double charge, or a paid order
// knocked back to failed.
// ============================================================
import {
  getRazorpayCredentials, verifyPaymentSignature, fetchRazorpayPayment, isCapturedPayment,
} from '../_lib/razorpay.js';
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
      // never mark paid. `unlessPaid` means a forged request cannot undo a
      // capture that landed between the read above and this write.
      console.error('[verify] signature mismatch for order', order.order_number);
      await updateOrderById(order.id, {
        status: 'failed',
        payment_status: 'failed',
        failure_reason: 'signature_verification_failed',
      }, sb, { unlessPaid: true }).catch(() => {});
      return fail(res, 400, 'We could not verify this payment. You have not been charged by Sora Life.');
    }

    // The signature is genuine. Now ask Razorpay what actually happened to
    // the money — the callback body never gets to answer that question.
    let payment;
    try {
      payment = await fetchRazorpayPayment({ paymentId, keyId: rz.keyId, keySecret: rz.keySecret });
    } catch (err) {
      // Unknown, not failed. Leave the order alone: the webhook is the
      // authoritative path and will settle it. Status code only in the log.
      console.error('[verify] payment lookup failed:', err?.status || err?.message);
      return fail(res, 503, 'We are still confirming your payment. Please check your orders in a moment before paying again.');
    }

    // The payment must belong to THIS order and carry the amount this server
    // computed. Otherwise a genuine signature from an unrelated (perhaps much
    // cheaper) payment could settle this one.
    if (payment?.order_id && payment.order_id !== orderId) {
      console.error('[verify] payment/order mismatch for order', order.order_number);
      return fail(res, 400, 'We could not verify this payment. You have not been charged by Sora Life.');
    }
    const paidPaise = Number(payment?.amount);
    if (Number.isFinite(paidPaise) && Number(order.amount_paise) !== paidPaise) {
      console.error('[verify] amount mismatch for order', order.order_number);
      await updateOrderById(order.id, {
        status: 'failed',
        payment_status: 'failed',
        failure_reason: 'amount_mismatch',
      }, sb, { unlessPaid: true }).catch(() => {});
      return fail(res, 400, 'We could not verify this payment. You have not been charged by Sora Life.');
    }

    if (!isCapturedPayment(payment)) {
      if (payment?.status === 'failed') {
        await updateOrderById(order.id, {
          status: 'failed',
          payment_status: 'failed',
          razorpay_payment_id: paymentId,
          failure_reason: 'payment_failed',
        }, sb, { unlessPaid: true }).catch(() => {});
        return fail(res, 400, "Payment wasn't completed. You have not been charged by Sora Life.");
      }
      // `authorized` / `created` / `pending`: the funds are held but not
      // taken. Not an error and not a payment — the webhook finishes this.
      return res.status(202).json({
        verified: false,
        pending: true,
        orderNumber: order.order_number,
        error: 'Your payment is still being confirmed. We will update your order shortly.',
      });
    }

    const paid = await updateOrderById(order.id, {
      status: 'paid',
      payment_status: 'paid',
      razorpay_payment_id: paymentId,
      paid_at: new Date().toISOString(),
    }, sb, { unlessPaid: true });

    // The webhook won the race and already settled this order. That is a
    // success, not a failure — report it the same way.
    if (!paid) {
      return res.status(200).json({
        verified: true,
        alreadyProcessed: true,
        orderNumber: order.order_number,
        amount: order.amount_paise / 100,
      });
    }

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
