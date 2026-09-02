// ============================================================
// TRUSTED SERVER-SIDE PRICING
//
// The browser sends only product identifiers, variant identifiers and
// quantities. Every price and the final payable amount are recalculated here
// from the database row, so a tampered price/amount in DevTools cannot change
// what is actually charged.
//
// Kept dependency-free and side-effect-free so it can be unit-tested
// directly (see scripts/test-payment-logic.mjs).
// ============================================================
import { computeTax, getTaxConfig, round2 } from './tax.js';

// Mirrors the delivery options shown at checkout. Server-authoritative.
//
// These fees are ABSOLUTE: there is deliberately no cart-subtotal threshold
// that waives Express or Scheduled. Standard is free at every basket size
// because its fee is ₹0, not because a threshold zeroed it. A threshold used
// to exist here and silently made a ₹700 basket ship Express for free.
export const DELIVERY_FEES = { std: 0, exp: 79, sched: 49 };
export const MAX_QTY_PER_LINE = 20;
export const MAX_LINES = 50;

/**
 * Collapse repeated lines for the same product+variant into one line.
 *
 * A cart can legitimately carry the same SKU twice (added from the PDP and
 * again from a quick-add), and stock was previously validated per line — so
 * "qty 4" plus "qty 5" of a variant with 6 in stock passed twice and oversold.
 * Merging first means every downstream quantity/stock check sees the real
 * total the customer is asking for.
 *
 * Returns { ok: true, items } or { ok: false, error }.
 */
export function normalizeCartLines(items) {
  const merged = new Map();
  for (const item of items) {
    // Same product AND same variant is the same physical thing. A line with
    // no variant is kept distinct from a variant line of the same product.
    const key = `${item.id}::${item.variantId ?? ''}`;
    const seen = merged.get(key);
    if (seen) {
      seen.qty += item.qty;
      // Keep the first non-empty label; it is only ever used for display and
      // is overwritten by the trusted variant row when one resolves.
      if (!seen.variant && item.variant) seen.variant = item.variant;
    } else {
      merged.set(key, { ...item });
    }
  }
  const out = [...merged.values()];
  for (const line of out) {
    // The per-line cap must hold for the MERGED quantity, otherwise splitting
    // one oversized line into several was enough to walk straight past it.
    if (line.qty > MAX_QTY_PER_LINE) {
      return { ok: false, error: 'Invalid quantity in cart.' };
    }
  }
  return { ok: true, items: out };
}

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
      // Identifier only. Its price is looked up server-side; a price sent
      // alongside it is ignored entirely.
      variantId: raw.variantId != null ? String(raw.variantId).slice(0, 64) : null,
      variant: typeof raw.variant === 'string' ? raw.variant.slice(0, 120) : null,
    });
  }
  return normalizeCartLines(items);
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

/** The undiscounted reference price (MRP) for one unit. */
export function trustedUnitMrp(row) {
  const original = Number(row.original_price) || 0;
  if (original > 0) return Math.round(original);
  return trustedUnitPrice(row);
}

/**
 * Resolve the trusted price for a specific variant.
 *
 * A variant row carries its own absolute mrp/sale_price rather than a delta,
 * so "750 ml costs more than 250 ml" is expressed as data, not arithmetic in
 * a UI component. Returns null when the variant is unusable, so the caller
 * can reject the line instead of silently charging the base price for a
 * larger pack.
 */
export function trustedVariantPrice(variantRow) {
  if (!variantRow || variantRow.is_active === false) return null;
  const sale = variantRow.sale_price == null ? null : Number(variantRow.sale_price);
  const mrp = variantRow.mrp == null ? null : Number(variantRow.mrp);
  const price = sale != null && Number.isFinite(sale) && sale > 0
    ? Math.round(sale)
    : (mrp != null && Number.isFinite(mrp) && mrp > 0 ? Math.round(mrp) : null);
  if (price == null || price <= 0) return null;
  return {
    price,
    mrp: mrp != null && Number.isFinite(mrp) && mrp > 0 ? Math.round(mrp) : price,
    sku: variantRow.sku || null,
    label: variantRow.label || null,
    gstRate: Number.isFinite(Number(variantRow.gst_rate)) ? Number(variantRow.gst_rate) : null,
    stock: variantRow.stock,
  };
}

/**
 * Interpret a stock value from the database into { tracked, available }.
 *
 * The two stock columns in this project do NOT agree on a type, and the
 * difference matters at checkout:
 *   * products.stock       — a BOOLEAN "in stock" flag (predates the admin
 *                            system; see src/lib/adminApi.js).
 *   * product_variants.stock — an integer COUNT.
 * A null/undefined value means the row simply does not track stock, which
 * must stay purchasable rather than becoming un-buyable.
 */
export function resolveStock(value) {
  if (value == null) return { tracked: false, available: Infinity };
  if (typeof value === 'boolean') {
    // Boolean flag: in stock means "no quantity ceiling we know of".
    return { tracked: true, available: value ? Infinity : 0 };
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return { tracked: false, available: Infinity };
  return { tracked: true, available: Math.max(0, Math.floor(n)) };
}

/**
 * Validate and apply a coupon. Coupons are resolved from trusted data passed
 * in by the caller (never from the browser). Returns the discount in rupees.
 */
export function computeCouponDiscount(coupon, eligibleAmount) {
  if (!coupon || coupon.is_active === false) return 0;
  const min = Number(coupon.min_order_value) || 0;
  if (eligibleAmount < min) return 0;
  let off = 0;
  if (coupon.type === 'percent') {
    off = eligibleAmount * (Number(coupon.value) || 0) / 100;
    const cap = Number(coupon.max_discount) || 0;
    if (cap > 0) off = Math.min(off, cap);
  } else {
    off = Number(coupon.value) || 0;
  }
  // Never discount below zero or beyond the eligible amount.
  return round2(Math.max(0, Math.min(off, eligibleAmount)));
}

/**
 * Given validated cart items and the trusted product rows loaded from the
 * database, compute the authoritative order total and full billing breakdown.
 *
 * `productRows` are rows from public.products. A cart id may be either the
 * row's biosash_id (imported catalogue) or its numeric id (admin-created),
 * because the storefront derives product.id as `biosash_id || id`.
 *
 * `opts` (all optional, all trusted/server-supplied):
 *   variantRows  rows from public.product_variants
 *   coupon       trusted coupon record
 *   taxConfig    from getTaxConfig(); defaults to environment
 *   buyerState   customer's state, for CGST/SGST vs IGST
 *   fees         { platform, packaging } in rupees
 *
 * Returns { ok, lines, subtotal, shipping, total, amountPaise, breakdown, ... }
 * or { ok:false, error }. The pre-existing fields keep their original meaning
 * so callers and tests written against the older signature still work.
 */
export function computeOrderTotal(items, productRows, deliveryMethod, opts = {}) {
  const byKey = new Map();
  for (const row of productRows) {
    if (row.biosash_id != null) byKey.set(String(row.biosash_id), row);
    if (row.id != null) byKey.set(String(row.id), row);
  }

  // Variants indexed by their own id, and by product for membership checks.
  const variantById = new Map();
  for (const v of opts.variantRows || []) {
    if (v && v.id != null) variantById.set(String(v.id), v);
  }

  // Repeated lines for the same product+variant are merged BEFORE any stock
  // or quantity check, so two lines of the same SKU cannot each pass a check
  // that their combined quantity would fail.
  const normalized = normalizeCartLines(items);
  if (!normalized.ok) return { ok: false, error: normalized.error };

  const lines = [];
  let subtotal = 0;   // what the customer pays for goods, after product discount
  let mrpTotal = 0;   // undiscounted reference total

  for (const item of normalized.items) {
    const row = byKey.get(item.id);
    // Unknown or inactive product -> reject rather than silently skip, so a
    // tampered/nonexistent id can never quietly reduce the amount.
    if (!row) return { ok: false, error: 'One or more items are no longer available.' };
    if (row.is_active === false) return { ok: false, error: `"${row.name}" is no longer available.` };

    let unit;
    let unitMrp;
    let sku = row.sku || null;
    // Deliberately NOT seeded from item.variant: a label the browser sent is
    // untrusted display text. It is only adopted below when a real variant
    // row resolves, so a cart line cannot claim "750 ml" while being priced
    // and shipped as the base product.
    let variantLabel = null;
    let variantId = null;
    let gstRate = Number.isFinite(Number(row.gst_rate)) ? Number(row.gst_rate) : null;

    if (item.variantId) {
      const vRow = variantById.get(item.variantId);
      // A variant id that does not exist, is inactive, belongs to a different
      // product, or has no usable price must fail the order — never fall back
      // to the cheaper base price for a pack the customer did not choose.
      if (!vRow) return { ok: false, error: 'The selected size is no longer available.' };
      if (String(vRow.product_id) !== String(row.id)) {
        return { ok: false, error: 'The selected size does not match the product.' };
      }
      const priced = trustedVariantPrice(vRow);
      if (!priced) return { ok: false, error: 'The selected size is not available for purchase right now.' };

      // Stock is a QUANTITY here, so the ordered quantity must fit inside it —
      // checking only for zero let a customer buy 9 of something with 5 left.
      const stock = resolveStock(vRow.stock);
      const outName = `${row.name}${priced.label ? ` ${priced.label}` : ''}`;
      if (stock.tracked && stock.available === 0) {
        return { ok: false, error: `"${outName}" is out of stock.` };
      }
      if (stock.tracked && item.qty > stock.available) {
        return {
          ok: false,
          error: `Only ${stock.available} of "${outName}" ${stock.available === 1 ? 'is' : 'are'} left.`,
        };
      }

      unit = priced.price;
      unitMrp = priced.mrp;
      sku = priced.sku || sku;
      variantLabel = priced.label || null;
      variantId = String(vRow.id);
      if (priced.gstRate != null) gstRate = priced.gstRate;
    } else {
      // Base products were never stock-checked at all, so a sold-out item
      // could be bought as long as it had no variants.
      const stock = resolveStock(row.stock);
      if (stock.tracked && stock.available === 0) {
        return { ok: false, error: `"${row.name}" is out of stock.` };
      }
      if (stock.tracked && item.qty > stock.available) {
        return {
          ok: false,
          error: `Only ${stock.available} of "${row.name}" ${stock.available === 1 ? 'is' : 'are'} left.`,
        };
      }
      unit = trustedUnitPrice(row);
      unitMrp = trustedUnitMrp(row);
    }

    if (!Number.isFinite(unit) || unit <= 0) {
      return { ok: false, error: `"${row.name}" is not available for purchase right now.` };
    }
    if (!Number.isFinite(unitMrp) || unitMrp < unit) unitMrp = unit;

    const lineTotal = unit * item.qty;
    const lineMrp = unitMrp * item.qty;
    subtotal += lineTotal;
    mrpTotal += lineMrp;

    lines.push({
      product_id: row.id,
      biosash_id: row.biosash_id ?? null,
      variant_id: variantId,
      name: row.name,
      sku,
      unit_price: unit,
      unit_mrp: unitMrp,
      qty: item.qty,
      variant: variantLabel,
      line_mrp: lineMrp,
      line_discount: round2(lineMrp - lineTotal),
      line_total: lineTotal,
      gst_rate: gstRate,
    });
  }

  const method = Object.prototype.hasOwnProperty.call(DELIVERY_FEES, deliveryMethod)
    ? deliveryMethod
    : 'std';

  const productDiscount = round2(mrpTotal - subtotal);

  // Coupon applies to the post-product-discount goods value.
  const coupon = opts.coupon || null;
  const couponDiscount = computeCouponDiscount(coupon, subtotal);
  const goodsAfterDiscount = round2(subtotal - couponDiscount);

  // Shipping is a flat per-method fee and does NOT depend on basket value:
  // Standard ₹0, Express ₹79, Scheduled ₹49 at every subtotal. The previous
  // ₹699 threshold zeroed Express/Scheduled on larger baskets, so the courier
  // cost was absorbed on exactly the orders that cost the most to ship.
  const shippingBase = DELIVERY_FEES[method];
  const shipping = shippingBase;
  // Nothing is ever waived now; Standard simply costs nothing. Retained so
  // the breakdown shape stays stable for stored orders and the admin views.
  const shippingWaived = false;

  const fees = opts.fees || {};
  const platformFee = Number(fees.platform) > 0 ? round2(Number(fees.platform)) : 0;
  const packagingFee = Number(fees.packaging) > 0 ? round2(Number(fees.packaging)) : 0;
  const feeTotal = round2(platformFee + packagingFee);

  const taxConfig = opts.taxConfig || getTaxConfig();
  // Coupon reduces the taxable value proportionally across lines.
  const discountRatio = subtotal > 0 ? goodsAfterDiscount / subtotal : 1;
  const taxLines = lines.map((l) => ({
    lineTotal: round2(l.line_total * discountRatio),
    gstRate: l.gst_rate,
  }));
  const tax = computeTax(taxLines, round2(shipping + feeTotal), taxConfig, opts.buyerState);

  // In inclusive mode (the default) tax is already inside the prices, so the
  // payable is unchanged. In exclusive mode it is added on top.
  const preTaxPayable = round2(goodsAfterDiscount + shipping + feeTotal);
  const total = tax && taxConfig.mode === 'exclusive'
    ? round2(preTaxPayable + tax.totalTax)
    : preTaxPayable;

  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, error: 'Could not calculate a valid order total.' };
  }

  // Attach per-line tax figures for the invoice.
  if (tax) {
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      const rate = Number.isFinite(l.gst_rate) && l.gst_rate > 0 ? l.gst_rate : taxConfig.rate;
      const gross = taxLines[i].lineTotal;
      if (!rate) { l.taxable_value = gross; l.tax_amount = 0; continue; }
      if (taxConfig.mode === 'inclusive') {
        const net = gross / (1 + rate / 100);
        l.taxable_value = round2(net);
        l.tax_amount = round2(gross - net);
      } else {
        l.taxable_value = round2(gross);
        l.tax_amount = round2(gross * (rate / 100));
      }
    }
  }

  const breakdown = {
    currency: 'INR',
    mrpTotal: round2(mrpTotal),
    itemTotal: round2(subtotal),
    productDiscount,
    coupon: coupon ? { code: coupon.code || null, discount: couponDiscount } : null,
    couponDiscount,
    subtotal: goodsAfterDiscount,
    shipping,
    shippingWaived,
    shippingLabel: shipping === 0 ? 'FREE' : null,
    platformFee,
    packagingFee,
    feeTotal,
    tax,
    grandTotal: total,
    totalSavings: round2(productDiscount + couponDiscount + (shippingWaived ? shippingBase : 0)),
  };

  return {
    ok: true,
    lines,
    subtotal: goodsAfterDiscount,
    shipping,
    total,
    // Razorpay expects the smallest currency unit: ₹100 -> 10000 paise.
    amountPaise: Math.round(total * 100),
    deliveryMethod: method,
    breakdown,
  };
}

/** Human-readable order reference. */
export function generateOrderNumber() {
  return `SORA-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
}

/**
 * Invoice reference, prefixed with the Indian financial year (Apr-Mar).
 *
 * Uniqueness is ultimately enforced by the unique index on
 * orders.invoice_number, but the generator itself needs enough entropy that
 * concurrent checkouts in the same millisecond do not collide and fail the
 * insert. Math.random alone gave ~8 collisions per 500 rapid calls, so this
 * uses CSPRNG bytes.
 */
export function generateInvoiceNumber(date = new Date()) {
  const y = date.getFullYear();
  const fyStart = date.getMonth() + 1 >= 4 ? y : y - 1;
  const fy = `${String(fyStart).slice(-2)}${String(fyStart + 1).slice(-2)}`;
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  return `SL/${fy}/${stamp}${randomToken(6)}`;
}

/** Uppercase base36 token from a CSPRNG when available. */
function randomToken(len) {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let bytes;
  try {
    // Available in Node (Vercel functions) and in modern browsers.
    const g = globalThis.crypto;
    if (g && typeof g.getRandomValues === 'function') {
      bytes = g.getRandomValues(new Uint8Array(len));
    }
  } catch { /* fall through */ }
  let out = '';
  for (let i = 0; i < len; i += 1) {
    const n = bytes ? bytes[i] : Math.floor(Math.random() * 256);
    out += alphabet[n % alphabet.length];
  }
  return out;
}
