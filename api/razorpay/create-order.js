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
import { validateCartPayload, computeOrderTotal, generateOrderNumber } from '../_lib/pricing.js';
import { getRazorpayCredentials, createRazorpayOrder } from '../_lib/razorpay.js';
import { getSupabaseConfig, fetchProductsForCart, insertOrder } from '../_lib/supabaseAdmin.js';

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
  if (!rz.configured) {
    console.error('[create-order] Razorpay env vars missing (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).');
    return fail(res, 503, 'Online payment is not available right now. Please try again later.');
  }
  if (!sb.configured) {
    console.error('[create-order] Supabase server env missing (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
    return fail(res, 503, 'We could not start your order. Please try again later.');
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { items: rawItems, delivery, customer, paymentMethod } = body;

    const parsed = validateCartPayload(rawItems);
    if (!parsed.ok) return fail(res, 400, parsed.error);

    // Trusted product data straight from the database.
    const products = await fetchProductsForCart(parsed.items.map((i) => i.id), sb);
    const totals = computeOrderTotal(parsed.items, products, delivery);
    if (!totals.ok) return fail(res, 400, totals.error);

    const method = paymentMethod === 'cod' ? 'cod' : 'razorpay';
    const orderNumber = generateOrderNumber();

    // Only keep the customer fields we actually need, length-capped.
    const safeCustomer = {
      email: str(customer?.email, 200),
      phone: str(customer?.phone, 40),
      firstName: str(customer?.firstName, 80),
      lastName: str(customer?.lastName, 80),
      address: str(customer?.address, 300),
      city: str(customer?.city, 120),
      state: str(customer?.state, 120),
      pin: str(customer?.pin, 20),
    };

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
      }, sb);

      return res.status(200).json({
        paymentMethod: 'cod',
        orderNumber: order.order_number,
        amount: totals.total,
        subtotal: totals.subtotal,
        shipping: totals.shipping,
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

    await insertOrder({
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
    }, sb);

    return res.status(200).json({
      paymentMethod: 'razorpay',
      razorpayOrderId: rzOrder.id,
      // PUBLIC key id — safe in the browser. The secret is never sent.
      keyId: rz.keyId,
      amountPaise: totals.amountPaise,
      amount: totals.total,
      subtotal: totals.subtotal,
      shipping: totals.shipping,
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
