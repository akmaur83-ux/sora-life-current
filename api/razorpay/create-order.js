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
      const order = await insertOrder({
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
        ...(userId ? { user_id: userId } : {}),
      }, sb);

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
