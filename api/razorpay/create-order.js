// ============================================================
// POST /api/razorpay/create-order
//
// Creates a PENDING order and its matching Razorpay order.
//
// The browser sends only { items: [{id, qty, variant}], delivery, customer }.
// It does NOT send a price or a total — the amount is recalculated here
// from the database rows, so tampering with prices/quantities/amounts in
// DevTools cannot change what is charged.
//
// Returns only what Razorpay Checkout needs on the client: the Razorpay
// order id, the server-computed amount, and the PUBLIC key id. The key
// secret never leaves the server.
// ============================================================
import { validateCartPayload, computeOrderTotal, generateOrderNumber, generateInvoiceNumber } from '../_lib/pricing.js';
import { getTaxConfig } from '../_lib/tax.js';
import { getRazorpayCredentials, createRazorpayOrder } from '../_lib/razorpay.js';
import {
  getSupabaseConfig, fetchProductsForCart, insertOrder, getUserIdFromToken,
  fetchVariantsForCart, fetchCouponByCode, recordConversion,
  findOrderByIdempotencyKey, consumeCouponForOrder,
} from '../_lib/supabaseAdmin.js';
import { enforceRateLimit } from '../_lib/rateLimit.js';
import { computeConversionBase, readVisitorId } from '../_lib/attribution.js';

// Record creator-attribution for a just-created order. Best-effort and fully
// isolated: attribution must never break or delay a legitimate order, so any
// failure is swallowed. Amounts come from the SERVER's own totals.
async function attributeOrder(order, totals, body, userId, sb) {
  try {
    if (!order?.id) return;
    const { totals: convTotals, items } = computeConversionBase(totals.lines, totals.breakdown);
    await recordConversion({
      orderId: order.id,
      orderNumber: order.order_number,
      visitorId: readVisitorId(body),
      userId: userId ?? null,
      totals: convTotals,
      items,
    }, sb);
  } catch { /* attribution is non-fatal */ }
}

function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

// The delivery details an order genuinely cannot ship without. Matches the
// fields the checkout form already marks required — nothing new is demanded
// of the customer, it is simply now enforced on the server too, where it
// cannot be skipped by posting straight to the API.
const REQUIRED_DELIVERY_FIELDS = [
  ['firstName', 'a first name'],
  ['phone', 'a phone number'],
  ['address', 'a street address'],
  ['city', 'a city'],
  ['state', 'a state'],
  ['pin', 'a PIN code'],
];

/**
 * Reject an order that could never actually be delivered. Previously every
 * one of these could be an empty string and the order was still written.
 */
function validateDeliveryDetails(customer) {
  const missing = REQUIRED_DELIVERY_FIELDS
    .filter(([key]) => !customer?.[key])
    .map(([, label]) => label);
  if (missing.length) {
    return { ok: false, error: `Please add ${missing.join(', ')} before placing your order.` };
  }
  // Indian mobile numbers, tolerant of +91/0 prefixes and spacing.
  const digits = String(customer.phone).replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) {
    return { ok: false, error: 'Please enter a valid phone number.' };
  }
  if (!/^\d{6}$/.test(String(customer.pin).replace(/\s/g, ''))) {
    return { ok: false, error: 'Please enter a valid 6-digit PIN code.' };
  }
  return { ok: true };
}

/**
 * A client-supplied key identifying ONE submit action.
 *
 * Deliberately not derived from cart/name/address: a customer may legitimately
 * place two identical orders minutes apart, and collapsing those would lose a
 * real order. The browser mints a fresh key per checkout attempt, so a
 * double-click, a retried fetch or a back-button resubmit reuses the key while
 * a genuinely new order gets a new one.
 */
function readIdempotencyKey(req, body) {
  const raw = req.headers?.['idempotency-key'] || body?.idempotencyKey;
  if (typeof raw !== 'string') return null;
  const clean = raw.trim().slice(0, 100);
  return /^[A-Za-z0-9_-]{8,100}$/.test(clean) ? clean : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'Method not allowed.');
  }

  const rz = getRazorpayCredentials();
  const sb = getSupabaseConfig();

  // Rate limit BEFORE any work: this is the unauthenticated write endpoint,
  // and each call would otherwise create a pending order row. Generous enough
  // that a real customer placing an order never trips it. Fails open.
  if (!(await enforceRateLimit(req, res, { name: 'create-order', limit: 12, windowSeconds: 60 }, sb))) return;
  // Supabase is required for BOTH payment methods (every order, COD
  // included, is written to the orders table), so this gate stays here.
  if (!sb.configured) {
    console.error('[create-order] Supabase server env missing (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
    return fail(res, 503, 'We could not start your order. Please try again later.');
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { items: rawItems, delivery, customer, paymentMethod, couponCode } = body;

    // Replay of a submit we already completed -> hand back the original order
    // instead of creating a second one. Checked before any work so a retry
    // never re-prices, re-reserves or re-charges anything.
    const idempotencyKey = readIdempotencyKey(req, body);
    if (idempotencyKey) {
      const existing = await findOrderByIdempotencyKey(idempotencyKey, sb);
      if (existing) {
        return res.status(200).json({
          paymentMethod: existing.payment_method === 'cod' ? 'cod' : 'razorpay',
          orderNumber: existing.order_number,
          amount: Number(existing.amount_paise) / 100,
          subtotal: existing.billing?.subtotal ?? null,
          shipping: existing.billing?.shipping ?? null,
          breakdown: existing.billing ?? null,
          ...(existing.razorpay_order_id ? { razorpayOrderId: existing.razorpay_order_id } : {}),
          duplicate: true,
        });
      }
    }

    const parsed = validateCartPayload(rawItems);
    if (!parsed.ok) return fail(res, 400, parsed.error);

    // Trusted product + variant data straight from the database. The browser
    // sent only ids and quantities; every price below is looked up here.
    const products = await fetchProductsForCart(parsed.items.map((i) => i.id), sb);
    const variantRows = await fetchVariantsForCart(parsed.items.map((i) => i.variantId), sb);

    // A coupon CODE is accepted from the browser; the discount it grants is
    // resolved server-side and re-validated (active/window/limit/min-value).
    const coupon = couponCode ? await fetchCouponByCode(couponCode, sb) : null;

    const totals = computeOrderTotal(parsed.items, products, delivery, {
      variantRows,
      coupon,
      taxConfig: getTaxConfig(),
      buyerState: typeof customer?.state === 'string' ? customer.state : null,
    });
    if (!totals.ok) return fail(res, 400, totals.error);
    const bd = totals.breakdown;

    const method = paymentMethod === 'cod' ? 'cod' : 'razorpay';

    // Link this order to a signed-in customer, if any. The id is derived
    // server-side from the validated access token in the Authorization
    // header — a client-supplied user_id is never read or trusted. No
    // token / guest / invalid token => null => a guest order, exactly as
    // before. `userId` is only ever attached to the insert when non-null,
    // so guest inserts are byte-for-byte unchanged.
    const userId = await getUserIdFromToken(req.headers?.authorization, sb);

    // Razorpay is only required for the online-payment branch below — COD
    // must work independently of whether Razorpay is configured. Checking
    // this unconditionally at the top of the handler (the previous
    // behavior) blocked COD orders too whenever Razorpay env vars were
    // missing, which is never correct: COD never talks to Razorpay.
    if (method !== 'cod' && !rz.configured) {
      console.error('[create-order] Razorpay env vars missing (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).');
      return fail(res, 503, 'Online payment is not available right now. Please try again later.');
    }
    const orderNumber = generateOrderNumber();

    // Only keep the customer/shipping fields we actually need, length-capped.
    // Stored in the orders.customer jsonb column, so adding fields here needs
    // no schema migration. `apartment` (address line 2) and `landmark` were
    // previously dropped here and are now persisted for delivery.
    const safeCustomer = {
      email: str(customer?.email, 200),
      phone: str(customer?.phone, 40),
      firstName: str(customer?.firstName, 80),
      lastName: str(customer?.lastName, 80),
      address: str(customer?.address, 300),
      apartment: str(customer?.apartment, 300),
      landmark: str(customer?.landmark, 200),
      city: str(customer?.city, 120),
      state: str(customer?.state, 120),
      pin: str(customer?.pin, 20),
    };

    // Enforced for BOTH payment methods: a prepaid order with no address is
    // just as undeliverable as a COD one, and the browser's own validation is
    // not a control — anyone can POST straight to this endpoint.
    const delivery_ok = validateDeliveryDetails(safeCustomer);
    if (!delivery_ok.ok) return fail(res, 400, delivery_ok.error);

    // Denormalised billing columns + the full breakdown. Every value here is
    // server-computed; none of it came from the browser. Columns added by
    // migration 0006 — if that migration has not been run yet the insert
    // would fail on unknown columns, so they are attached only when the
    // breakdown is present and stripped on a PGRST204 retry below.
    const billingCols = {
      billing: bd,
      mrp_total: bd.mrpTotal,
      item_total: bd.itemTotal,
      product_discount: bd.productDiscount,
      coupon_code: bd.coupon?.code ?? null,
      coupon_discount: bd.couponDiscount,
      shipping_fee: bd.shipping,
      platform_fee: bd.platformFee,
      packaging_fee: bd.packagingFee,
      taxable_amount: bd.tax?.taxableAmount ?? null,
      tax_total: bd.tax?.totalTax ?? null,
      tax_mode: bd.tax?.mode ?? null,
      billing_address: safeCustomer,
    };

    // COD is unpaid at creation, so it gets its invoice number when it is
    // marked paid on delivery. An online order is invoiced on verification.
    const invoiceCols = { invoice_number: generateInvoiceNumber() };

    // ---- Cash on delivery: no Razorpay involved. Recorded as a pending,
    // unpaid order so it still gets a server-computed, auditable amount.
    if (method === 'cod') {
      let order;
      try {
        order = await insertOrder({
          order_number: orderNumber,
          status: 'pending',
          payment_status: 'pending',
          payment_method: 'cod',
          amount_paise: totals.amountPaise,
          currency: 'INR',
          items: totals.lines,
          customer: safeCustomer,
          delivery_method: totals.deliveryMethod,
          ...billingCols,
          ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
          ...(userId ? { user_id: userId } : {}),
        }, sb);
      } catch (err) {
        // Two submits raced past the lookup above and both tried to insert.
        // The unique index decided the winner; return that order rather than
        // failing a customer whose order was in fact placed.
        if (err?.details?.code === '23505' && idempotencyKey) {
          const winner = await findOrderByIdempotencyKey(idempotencyKey, sb);
          if (winner) {
            return res.status(200).json({
              paymentMethod: 'cod',
              orderNumber: winner.order_number,
              amount: Number(winner.amount_paise) / 100,
              subtotal: winner.billing?.subtotal ?? null,
              shipping: winner.billing?.shipping ?? null,
              breakdown: winner.billing ?? null,
              duplicate: true,
            });
          }
        }
        throw err;
      }

      // COD orders were never consuming their coupon: consumption only ran on
      // the Razorpay verify/webhook paths, so a COD customer could reuse a
      // single-use code indefinitely and blow straight past its usage cap.
      // The DB function is atomic and idempotent per order, and non-fatal here
      // — a coupon-ledger hiccup must not lose an order that already exists.
      await consumeCouponForOrder({ ...order, coupon_code: bd.coupon?.code ?? null }, sb).catch(() => {});

      // Attribution snapshot (pending until the order qualifies). Non-fatal.
      await attributeOrder(order, totals, body, userId, sb);

      return res.status(200).json({
        paymentMethod: 'cod',
        orderNumber: order.order_number,
        amount: totals.total,
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        breakdown: bd,
      });
    }

    // ---- Online payment via Razorpay
    const rzOrder = await createRazorpayOrder({
      amountPaise: totals.amountPaise,
      currency: 'INR',
      receipt: orderNumber,
      notes: { order_number: orderNumber },
      keyId: rz.keyId,
      keySecret: rz.keySecret,
    });

    const rzOrderRow = await insertOrder({
      order_number: orderNumber,
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'razorpay',
      razorpay_order_id: rzOrder.id,
      amount_paise: totals.amountPaise,
      currency: 'INR',
      items: totals.lines,
      customer: safeCustomer,
      delivery_method: totals.deliveryMethod,
      ...billingCols,
      ...invoiceCols,
      ...(userId ? { user_id: userId } : {}),
    }, sb);

    // Attribution snapshot (pending; flips to eligible when payment verifies).
    await attributeOrder(rzOrderRow, totals, body, userId, sb);

    return res.status(200).json({
      paymentMethod: 'razorpay',
      razorpayOrderId: rzOrder.id,
      // PUBLIC key id — safe in the browser. The secret is never sent.
      keyId: rz.keyId,
      amountPaise: totals.amountPaise,
      amount: totals.total,
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      breakdown: bd,
      currency: 'INR',
      orderNumber,
    });
  } catch (err) {
    // Log detail server-side; return a generic message to the browser so no
    // internal/stack/secret information is exposed.
    console.error('[create-order] failed:', err?.message);
    return fail(res, 500, 'We could not start your payment. Please try again.');
  }
}

function str(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
