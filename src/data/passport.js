// ============================================================
// PURCHASE PASSPORT — real order data adapter.
//
// Guests prove ownership by knowing BOTH the order number and the email
// used at checkout, verified server-side in api/orders/lookup.js.
// Signed-in customers instead read only their own order through the
// existing orders RLS policy. Neither path exposes a service-role key.
//
// Anything the `orders` schema genuinely has no column for (batch
// number, expiry date, courier/tracking, delivery ETA, fulfillment
// steps beyond "ordered") is surfaced as NOT_AVAILABLE rather than
// invented. See the Phase 2 report for exactly what's missing.
// ============================================================
import { productById } from './products.js';
import { supabase } from '../lib/supabase.js';

export const NOT_AVAILABLE = 'Not available yet';

const PAYMENT_METHOD_LABELS = { razorpay: 'Razorpay', cod: 'Cash on Delivery' };

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function formatDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = formatDate(iso);
  const time = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  return `${date}, ${time}`;
}

// Same field order/skip-if-blank convention as the admin Orders page
// (src/admin/pages/Orders.jsx formatAddress) — kept as one line here
// since the Passport field is a single-line value, not a postal block.
function formatAddress(c = {}) {
  const cityLine = [c.city, c.state].filter(Boolean).join(', ');
  const cityPin = [cityLine, c.pin].filter(Boolean).join(' - ');
  return [c.address, c.apartment, cityPin].filter(Boolean).join(', ') || NOT_AVAILABLE;
}

function computeStatusLabel({ status, paymentStatus, paymentMethod }) {
  if (status === 'cancelled') return 'Cancelled';
  if (paymentStatus === 'failed') return 'Payment Failed';
  if (paymentStatus === 'paid') return 'Payment Confirmed';
  if (paymentMethod === 'cod') return 'Order Placed (Cash on Delivery)';
  return 'Awaiting Payment';
}

/** Merge a real order line with the live catalog entry it points at
 * (for image + description) — never invents a product that isn't in
 * either the order or the catalog. */
function resolveProduct(item) {
  const catalogId = item?.biosash_id || item?.product_id;
  const catalogProduct = catalogId != null ? productById[catalogId] : null;
  return {
    id: catalogId ?? item?.name,
    name: item?.name || catalogProduct?.name || 'Product',
    image: catalogProduct?.image || null,
    gallery: catalogProduct?.gallery || [],
    category: catalogProduct?.category || null,
    shortDescription: catalogProduct?.shortDescription || catalogProduct?.description || '',
  };
}

/**
 * Map the sanitized order returned by /api/orders/lookup into exactly
 * the shape Passport.jsx renders. Every field below is either real
 * (traceable to a column on `orders`) or explicitly NOT_AVAILABLE —
 * nothing here is a placeholder invented for display purposes.
 */
export function mapOrderToPassport(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const first = items[0] || {};
  const product = resolveProduct(first);
  const extraCount = items.length - 1;

  const totalQty = items.reduce((n, l) => n + (Number(l.qty) || 0), 0);
  const memberName = [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ').trim() || 'Guest';

  // The schema has no carrier or fulfillment events. Render only the one
  // event the order record proves, rather than inventing future milestones.
  const timeline = [
    { key: 'ordered', label: 'Order recorded', short: 'Order recorded', date: formatDate(order.createdAt), time: formatDateTime(order.createdAt), done: true, current: true },
  ];

  return {
    passportId: order.orderNumber,
    member: { name: memberName, tier: 'Verified order', tierIcon: 'checkCircle' },
    status: computeStatusLabel(order),
    product: {
      ...product,
      qty: first.qty || totalQty || 1,
      extraItemsCount: extraCount > 0 ? extraCount : 0,
    },
    order: {
      date: formatDate(order.createdAt) || NOT_AVAILABLE,
      amount: order.amount,
      paymentMethod: PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod || NOT_AVAILABLE,
      address: formatAddress(order.customer),
    },
    timeline,
  };
}

/**
 * Look up one order by number + the email used at checkout, and map
 * it to Passport shape. Throws a user-facing Error on any failure —
 * the API route intentionally returns the same generic message for
 * "no such order" and "wrong email" so this can't be used to probe
 * whether an order number exists.
 */
export async function lookupPassport({ orderNumber, email }) {
  const res = await fetch('/api/orders/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNumber, email }),
  });

  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error page */ }

  if (!res.ok || !data?.order) {
    throw new Error(data?.error || 'We could not look up that order. Please try again.');
  }
  return mapOrderToPassport(data.order);
}

/**
 * Authenticated-owner lookup: fetch the customer's OWN order by number
 * through the normal browser client. Ownership is enforced entirely by the
 * "orders customer read" RLS policy (user_id = auth.uid()) — a foreign or
 * non-existent order number simply matches zero rows, so this both proves
 * ownership and gives the same generic denial in every non-owned case (no
 * existence oracle). No email is asked for or trusted; the URL only supplies
 * the order number, never a user_id or email. Throws NO_ACCESS when the
 * caller doesn't own a matching order.
 */
export async function lookupPassportForUser(orderNumber) {
  const on = String(orderNumber || '').trim().toUpperCase();
  if (!on) { const e = new Error('Missing order number.'); e.code = 'NO_ACCESS'; throw e; }

  const { data, error } = await supabase
    .from('orders')
    .select('order_number, status, payment_status, payment_method, amount_paise, currency, items, customer, created_at, paid_at')
    .eq('order_number', on)
    .maybeSingle();
  if (error) throw error;
  if (!data) { const e = new Error('You do not have access to this order.'); e.code = 'NO_ACCESS'; throw e; }

  // Reshape the raw DB row into the same sanitized shape mapOrderToPassport
  // consumes (the customer jsonb already uses the same field names).
  return mapOrderToPassport({
    orderNumber: data.order_number,
    status: data.status,
    paymentStatus: data.payment_status,
    paymentMethod: data.payment_method,
    amount: (Number(data.amount_paise) || 0) / 100,
    currency: data.currency || 'INR',
    items: Array.isArray(data.items) ? data.items : [],
    customer: data.customer || {},
    createdAt: data.created_at,
    paidAt: data.paid_at || null,
  });
}
