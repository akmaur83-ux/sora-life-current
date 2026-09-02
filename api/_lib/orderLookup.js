// ============================================================
// Pure, side-effect-free helpers for guest order lookup (the
// Purchase Passport feature). Kept dependency-free and separate from
// the HTTP handler so the matching/sanitizing logic can be unit
// tested directly (see scripts/test-order-lookup.mjs), the same way
// pricing.js and razorpay.js already are.
//
// Guests prove ownership by knowing BOTH the order number and checkout
// email. Signed-in customer reads use the separate RLS-backed browser path.
// Neither path trusts an order number alone.
// ============================================================
import { fulfillmentForDisplay } from '../../src/lib/orderFulfillment.js';

export function normalizeOrderNumber(v) {
  return String(v || '').trim().toUpperCase();
}

export function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

/**
 * True only if the order has a stored customer email AND it matches
 * the supplied email (case/whitespace-insensitive). An order with no
 * stored email can never be "claimed" by an empty/blank input.
 */
export function customerEmailMatches(order, email) {
  const stored = normalizeEmail(order?.customer?.email);
  const given = normalizeEmail(email);
  return Boolean(stored) && Boolean(given) && stored === given;
}

/**
 * Reduce a full `orders` row to exactly what the Purchase Passport
 * screen needs. Deliberately excludes: the internal uuid, Razorpay
 * order/payment ids, failure_reason, and anything else that isn't
 * needed to render the customer's own order. Never include fields
 * unrelated to the customer-facing receipt/passport. Fulfillment is included
 * only when at least one validated, stored fulfillment field exists.
 */
export function sanitizeOrderForCustomer(order) {
  const fulfillment = fulfillmentForDisplay(order);
  return {
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    amount: (Number(order.amount_paise) || 0) / 100,
    currency: order.currency || 'INR',
    items: Array.isArray(order.items) ? order.items : [],
    customer: sanitizeCustomer(order.customer),
    createdAt: order.created_at,
    paidAt: order.paid_at || null,
    ...(fulfillment ? { fulfillment } : {}),
  };
}

function sanitizeCustomer(customer) {
  const c = customer && typeof customer === 'object' ? customer : {};
  return {
    firstName: str(c.firstName),
    lastName: str(c.lastName),
    address: str(c.address),
    apartment: str(c.apartment),
    landmark: str(c.landmark),
    city: str(c.city),
    state: str(c.state),
    pin: str(c.pin),
    // Phone/email are the customer's own identifiers already known to
    // them (email was required just to unlock this response) — kept
    // for display (e.g. "delivered to") but never used elsewhere.
    email: str(c.email),
    phone: str(c.phone),
  };
}

function str(v) {
  return typeof v === 'string' ? v : '';
}
