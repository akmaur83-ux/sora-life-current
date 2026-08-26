// ============================================================
// POST /api/razorpay/webhook
//
// Server-to-server payment confirmation from Razorpay. This is the
// authoritative signal: the browser callback (/api/razorpay/verify) can be
// abandoned when a customer closes the tab mid-payment, whereas the webhook
// is retried by Razorpay until it receives a 2xx.
//
// Security:
//   * The HMAC is computed over the RAW body with RAZORPAY_WEBHOOK_SECRET
//     (a different credential from the API key secret). The parsed body is
//     never used for verification, because re-serialising JSON changes bytes.
//   * Nothing is trusted from the payload until the signature passes.
//   * The amount in the payload is compared against the amount this server
//     computed at order creation. A mismatch is recorded and never marked paid.
//
// Idempotency:
//   * payment_transactions.gateway_payment_id is UNIQUE, so a replayed
//     delivery conflicts and is reported as a duplicate instead of creating a
//     second payment record.
//   * An order already marked paid short-circuits.
//   * Always answers 200 for handled-but-ignored events so Razorpay stops
//     retrying; only genuine server faults return 5xx.
// ============================================================
import { getWebhookSecret, verifyWebhookSignature } from '../_lib/razorpay.js';
import { generateInvoiceNumber } from '../_lib/pricing.js';
import {
  getSupabaseConfig, findOrderByRazorpayOrderId, updateOrderById,
  recordPaymentTransaction, consumeCouponForOrder, setConversionStatus,
} from '../_lib/supabaseAdmin.js';

// Razorpay must be verified against raw bytes, so the platform body parser
// is disabled for this route.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const wh = getWebhookSecret();
  const sb = getSupabaseConfig();
  if (!wh.configured || !sb.configured) {
    console.error('[webhook] RAZORPAY_WEBHOOK_SECRET or Supabase env missing.');
    // 503 so Razorpay retries once the environment is fixed.
    return res.status(503).json({ error: 'Webhook not configured.' });
  }

  let raw;
  try {
    raw = await readRawBody(req);
  } catch (err) {
    console.error('[webhook] could not read body:', err?.message);
    return res.status(400).json({ error: 'Bad request.' });
  }

  const signature = req.headers['x-razorpay-signature'];
  if (!verifyWebhookSignature({ rawBody: raw, signature, webhookSecret: wh.secret })) {
    // Not from Razorpay (or tampered). Do not retry, do not record.
    console.error('[webhook] signature verification failed.');
    return res.status(400).json({ error: 'Invalid signature.' });
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON.' });
  }

  const event = payload?.event || '';
  const entity = payload?.payload?.payment?.entity || null;

  // Only payment events carry what we need. Acknowledge everything else so
  // Razorpay does not keep retrying subscription/refund/settlement events.
  if (!entity || !event.startsWith('payment.')) {
    return res.status(200).json({ received: true, ignored: event || 'unknown' });
  }

  const paymentId = entity.id;
  const rzOrderId = entity.order_id;
  const amountPaise = Number(entity.amount);

  try {
    const order = rzOrderId ? await findOrderByRazorpayOrderId(rzOrderId, sb) : null;

    // Record the gateway event first. The UNIQUE gateway_payment_id makes a
    // replayed delivery a no-op rather than a duplicate row.
    const captured = event === 'payment.captured';
    const failed = event === 'payment.failed';
    const txResult = await recordPaymentTransaction({
      order_id: order?.id ?? null,
      order_number: order?.order_number ?? null,
      gateway: 'razorpay',
      gateway_order_id: rzOrderId ?? null,
      gateway_payment_id: paymentId,
      event,
      status: captured ? 'captured' : failed ? 'failed' : 'authorized',
      method: entity.method || null,
      amount_paise: Number.isFinite(amountPaise) ? amountPaise : null,
      currency: entity.currency || 'INR',
      error_code: entity.error_code || null,
      error_description: entity.error_description || null,
      raw: payload,
    }, sb);

    if (!order) {
      // Signature was valid, so this is a real Razorpay payment — but we have
      // no matching local order. Recorded above for reconciliation; ack so it
      // is not retried forever.
      console.error('[webhook] no local order for razorpay_order_id', rzOrderId);
      return res.status(200).json({ received: true, matched: false });
    }

    if (txResult.duplicate) {
      return res.status(200).json({ received: true, duplicate: true, orderNumber: order.order_number });
    }

    if (order.payment_status === 'paid') {
      return res.status(200).json({ received: true, alreadyPaid: true, orderNumber: order.order_number });
    }

    if (failed) {
      await updateOrderById(order.id, {
        status: 'failed',
        payment_status: 'failed',
        razorpay_payment_id: paymentId,
        failure_reason: entity.error_description || entity.error_code || 'payment_failed',
      }, sb);
      // A failed payment never qualifies its conversion. Non-fatal.
      await setConversionStatus(order.id, 'cancelled', 'payment_failed', sb).catch(() => {});
      return res.status(200).json({ received: true, orderNumber: order.order_number, status: 'failed' });
    }

    if (captured) {
      // The amount Razorpay captured must equal the amount this server
      // computed when the order was created. A mismatch means the charge does
      // not correspond to this order — never mark it paid.
      if (Number.isFinite(amountPaise) && Number(order.amount_paise) !== amountPaise) {
        console.error('[webhook] amount mismatch', {
          order: order.order_number, expected: order.amount_paise, got: amountPaise,
        });
        await updateOrderById(order.id, {
          payment_status: 'failed',
          status: 'failed',
          failure_reason: 'amount_mismatch',
        }, sb).catch(() => {});
        return res.status(200).json({ received: true, mismatch: true });
      }

      await updateOrderById(order.id, {
        status: 'paid',
        payment_status: 'paid',
        razorpay_payment_id: paymentId,
        paid_at: new Date().toISOString(),
        // Invoice is issued at the moment money is confirmed.
        ...(order.invoice_number ? {} : { invoice_number: generateInvoiceNumber() }),
        invoiced_at: new Date().toISOString(),
      }, sb);

      // Consume the coupon (if any) now that payment is confirmed. Idempotent
      // per order in the DB, so this webhook and the /verify callback firing
      // for the same order cannot double-consume. Non-fatal.
      await consumeCouponForOrder(order, sb).catch(() => {});
      // Qualify the creator conversion. Idempotent + non-fatal; a retried
      // webhook or the /verify callback for the same order just no-ops.
      await setConversionStatus(order.id, 'eligible', 'payment_captured', sb).catch(() => {});

      return res.status(200).json({ received: true, orderNumber: order.order_number, status: 'paid' });
    }

    return res.status(200).json({ received: true, event });
  } catch (err) {
    // Genuine server fault — 5xx so Razorpay retries.
    console.error('[webhook] processing failed:', err?.message);
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }
}
