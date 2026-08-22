// ============================================================
// TRUSTED SERVER-SIDE PRICING
//
// The browser sends only product identifiers and quantities. Every price
// and the final payable amount are recalculated here from the database
// row, so a tampered price/amount in DevTools cannot change what is
// actually charged.
//
// Kept dependency-free and side-effect-free so it can be unit-tested
// directly (see scripts/test-payment-logic.mjs).
// ============================================================

// Mirrors the delivery options shown at checkout. Server-authoritative.
export const DELIVERY_FEES = { std: 0, exp: 79, sched: 49 };
export const FREE_SHIPPING_THRESHOLD = 699;
export const MAX_QTY_PER_LINE = 20;
export const MAX_LINES = 50;

/**
 * Validate the raw cart payload shape from the browser.
 * Returns { ok: true, items } or { ok: false, error }.
 */
export function validateCartPayload(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: 'Your cart is empty.' };
  }
  if (rawItems.length > MAX_LINES) {
    return { ok: false, error: 'Too many items in cart.' };
  }
  const items = [];
  for (const raw of rawItems) {
    if (!raw || (typeof raw.id !== 'string' && typeof raw.id !== 'number')) {
      return { ok: false, error: 'Invalid item in cart.' };
    }
    const qty = Number(raw.qty);
    // Integer, positive, bounded — blocks 0, negatives, fractions, NaN.
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      return { ok: false, error: 'Invalid quantity in cart.' };
    }
    items.push({
      id: String(raw.id),
      qty,
      variant: typeof raw.variant === 'string' ? raw.variant.slice(0, 120) : null,
    });
  }
  return { ok: true, items };
}

/**
 * Given validated cart items and the trusted product rows loaded from the
 * database, compute the authoritative order total.
 *
 * `productRows` are rows from public.products. A cart id may be either the
 * row's biosash_id (imported catalogue) or its numeric id (admin-created),
 * because the storefront derives product.id as `biosash_id || id`.
 *
 * Returns { ok, lines, subtotal, shipping, total, amountPaise } or { ok:false, error }.
 */
export function computeOrderTotal(items, productRows, deliveryMethod) {
  const byKey = new Map();
  for (const row of productRows) {
    if (row.biosash_id != null) byKey.set(String(row.biosash_id), row);
    if (row.id != null) byKey.set(String(row.id), row);
  }

  const lines = [];
  let subtotal = 0;

  for (const item of items) {
    const row = byKey.get(item.id);
    // Unknown or inactive product -> reject rather than silently skip, so a
    // tampered/nonexistent id can never quietly reduce the amount.
    if (!row) return { ok: false, error: 'One or more items are no longer available.' };
    if (row.is_active === false) return { ok: false, error: `"${row.name}" is no longer available.` };

    const unit = trustedUnitPrice(row);
    if (!Number.isFinite(unit) || unit <= 0) {
      return { ok: false, error: `"${row.name}" is not available for purchase right now.` };
    }

    const lineTotal = unit * item.qty;
    subtotal += lineTotal;
    lines.push({
      product_id: row.id,
      biosash_id: row.biosash_id ?? null,
      name: row.name,
      unit_price: unit,
      qty: item.qty,
      variant: item.variant,
      line_total: lineTotal,
    });
  }

  const method = Object.prototype.hasOwnProperty.call(DELIVERY_FEES, deliveryMethod)
    ? deliveryMethod
    : 'std';
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : DELIVERY_FEES[method];
  const total = subtotal + shipping;

  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, error: 'Could not calculate a valid order total.' };
  }

  return {
    ok: true,
    lines,
    subtotal,
    shipping,
    total,
    // Razorpay expects the smallest currency unit: ₹100 -> 10000 paise.
    amountPaise: Math.round(total * 100),
    deliveryMethod: method,
  };
}

/**
 * The price a customer actually pays for one unit, taken from the DB row.
 * Prefers the stored sale_price; falls back to recomputing it from
 * original_price + discount_percent if sale_price is absent/stale.
 */
export function trustedUnitPrice(row) {
  const original = Number(row.original_price) || 0;
  const discount = Number(row.discount_percent) || 0;
  const sale = row.sale_price == null ? null : Number(row.sale_price);
  if (sale != null && Number.isFinite(sale) && sale > 0) return Math.round(sale);
  if (original > 0) return Math.round(original * (1 - discount / 100));
  return 0;
}

/** Human-readable order reference. */
export function generateOrderNumber() {
  return `SORA-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
}
