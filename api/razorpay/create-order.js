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
import { getTaxConfig } from '../_lib/tax.js';
import { getRazorpayCredentials, createRazorpayOrder } from '../_lib/razorpay.js';
import {
  getSupabaseConfig, fetchProductsForCart, insertOrder, getUserIdFromToken,
  fetchVariantsForCart, fetchCouponByCode, recordConversion,
  findOrderByIdempotencyKey, consumeCouponForOrder, updateOrderById,
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

const PREPAID_RESERVATION_STALE_MS = 15_000;
const PREPAID_REPLAY_DELAYS_MS = [0, 10, 25, 50, 100, 200];

function isStalePrepaidReservation(order, now = Date.now()) {
  const timestamp = Date.parse(order?.updated_at || order?.created_at || '');
  return Number.isFinite(timestamp) && now - timestamp >= PREPAID_RESERVATION_STALE_MS;
}

/**
 * A prepaid request reserves its idempotency key in the local order row
 * before calling Razorpay. A concurrent caller can therefore observe the
 * row while the winning request is still attaching its Razorpay order id.
 * Wait briefly for that write instead of creating a second gateway order.
 */
async function waitForPrepaidOrder(existing, idempotencyKey, sb) {
  let current = existing;
  for (const delayMs of PREPAID_REPLAY_DELAYS_MS) {
    if (current?.payment_method === 'cod' || current?.razorpay_order_id) return current;
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    else await Promise.resolve();
    current = await findOrderByIdempotencyKey(idempotencyKey, sb) || current;
  }
  return current;
}

async function createRazorpayOrderFromPersisted(order, rz) {
  const amountPaise = Number(order?.amount_paise);
  const orderNumber = typeof order?.order_number === 'string' ? order.order_number : '';
  const currency = (typeof order?.currency === 'string' && order.currency.trim()) || 'INR';
  if (!Number.isInteger(amountPaise) || amountPaise <= 0 || !orderNumber) {
    throw new Error('Persisted prepaid order is not payable.');
  }
  return createRazorpayOrder({
    amountPaise,
    currency,
    receipt: orderNumber,
    notes: { order_number: orderNumber },
    keyId: rz.keyId,
    keySecret: rz.keySecret,
  });
}

/**
 * Attach one gateway order with a compare-and-set update. If another stale
 * adopter linked first, its id is authoritative and this caller replays it;
 * the losing gateway order is never returned to a customer.
 */
async function linkRazorpayOrder(order, razorpayOrderId, idempotencyKey, sb) {
  try {
    const linked = await updateOrderById(
      order.id,
      { razorpay_order_id: razorpayOrderId },
      sb,
      { ifRazorpayOrderMissing: true },
    );
    if (linked?.razorpay_order_id) return linked;
  } catch (err) {
    // A response can be lost after Postgres committed. Re-read before
    // treating the writeback as failed, so an already-linked winner survives.
    const winner = await findOrderByIdempotencyKey(idempotencyKey, sb);
    if (winner?.razorpay_order_id) return winner;
    throw err;
  }

  const winner = await findOrderByIdempotencyKey(idempotencyKey, sb);
  if (winner?.razorpay_order_id) return winner;
  throw new Error('Razorpay order could not be linked to the local order.');
}

async function adoptStalePrepaidOrder(order, idempotencyKey, sb, rz) {
  const gatewayOrder = await createRazorpayOrderFromPersisted(order, rz);
  return linkRazorpayOrder(order, gatewayOrder.id, idempotencyKey, sb);
}

function replayPayload(order, rz) {
  const paymentMethod = order.payment_method === 'cod' ? 'cod' : 'razorpay';
  const payload = {
    paymentMethod,
    orderNumber: order.order_number,
    amount: Number(order.amount_paise) / 100,
    subtotal: order.billing?.subtotal ?? null,
    shipping: order.billing?.shipping ?? null,
    breakdown: order.billing ?? null,
    duplicate: true,
  };

  if (paymentMethod === 'razorpay') {
    payload.keyId = rz.keyId;
    payload.amountPaise = Number(order.amount_paise);
    payload.currency = order.currency || 'INR';
    payload.razorpayOrderId = order.razorpay_order_id;
  }
  return payload;
}

async function returnExistingOrder(existing, idempotencyKey, sb, rz, res, body) {
  let ready = existing;
  let adopted = false;
  if (ready?.payment_method !== 'cod') {
    if (!rz.configured) {
      return fail(res, 503, 'Online payment is not available right now. Please try again later.');
    }

    if (!ready?.razorpay_order_id && isStalePrepaidReservation(ready)) {
      ready = await adoptStalePrepaidOrder(ready, idempotencyKey, sb, rz);
      adopted = true;
    } else if (!ready?.razorpay_order_id) {
      ready = await waitForPrepaidOrder(ready, idempotencyKey, sb);
      if (!ready?.razorpay_order_id && isStalePrepaidReservation(ready)) {
        ready = await adoptStalePrepaidOrder(ready, idempotencyKey, sb, rz);
        adopted = true;
      }
    }

    if (!ready?.razorpay_order_id) {
      return fail(res, 409, 'Your payment is still being prepared. Please try again.');
    }
  }

  if (adopted) {
    await attributeOrder(
      ready,
      { lines: ready.items || [], breakdown: ready.billing || {} },
      body,
      ready.user_id ?? null,
      sb,
    );
  }
  return res.status(200).json(replayPayload(ready, rz));
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
        return await returnExistingOrder(existing, idempotencyKey, sb, rz, res, body);
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

    // NO invoice columns are written here, for either payment method. An
    // order is created UNPAID, and an invoice records that money was taken —
    // so invoice_number and invoiced_at are issued together at the paid
    // transition (see invoicePatchForPaidTransition in _lib/pricing.js).
    //
    // The prepaid branch used to stamp an invoice_number at creation, which
    // burned a number on every abandoned or failed payment attempt and left
    // the matching invoiced_at unset.

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
    const prepaidRow = {
      order_number: orderNumber,
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'razorpay',
      amount_paise: totals.amountPaise,
      currency: 'INR',
      items: totals.lines,
      customer: safeCustomer,
      delivery_method: totals.deliveryMethod,
      ...billingCols,
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      ...(userId ? { user_id: userId } : {}),
    };

    let rzOrderRow;
    let rzOrder;

    if (idempotencyKey) {
      // Claim the unique key in Postgres BEFORE creating an external order.
      // Only the insert winner may call Razorpay; a 23505 loser replays the
      // winner's row, so one submit cannot fan out into two payable orders.
      try {
        rzOrderRow = await insertOrder(prepaidRow, sb);
      } catch (err) {
        if (err?.details?.code === '23505') {
          const winner = await findOrderByIdempotencyKey(idempotencyKey, sb);
          if (winner) return await returnExistingOrder(winner, idempotencyKey, sb, rz, res, body);
        }
        throw err;
      }

      rzOrder = await createRazorpayOrderFromPersisted(rzOrderRow, rz);
      rzOrderRow = await linkRazorpayOrder(rzOrderRow, rzOrder.id, idempotencyKey, sb);
    } else {
      // Legacy clients without a key retain the existing single-request flow.
      rzOrder = await createRazorpayOrder({
        amountPaise: totals.amountPaise,
        currency: 'INR',
        receipt: orderNumber,
        notes: { order_number: orderNumber },
        keyId: rz.keyId,
        keySecret: rz.keySecret,
      });
      rzOrderRow = await insertOrder({ ...prepaidRow, razorpay_order_id: rzOrder.id }, sb);
    }

    // Attribution snapshot (pending; flips to eligible when payment verifies).
    await attributeOrder(rzOrderRow, totals, body, userId, sb);

    return res.status(200).json({
      paymentMethod: 'razorpay',
      razorpayOrderId: rzOrderRow.razorpay_order_id,
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
