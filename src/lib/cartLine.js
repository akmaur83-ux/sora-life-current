// ============================================================
// Cart line hydration — the single place that decides what a stored cart
// line costs and whether it can be bought.
//
// Split out of store.jsx for the same reason wishlistState.js was: these
// rules are the ones most worth executing directly in a test, and doing that
// through a React provider proves less while costing more.
//
// A stored line holds identifiers only — { key, id, variant, variantId, qty }.
// Every price is re-derived from the LIVE catalogue on each render, so a
// price change reaches the cart on the next hydration and a stale figure in
// localStorage can never be spent. These numbers are for display; the payable
// amount is always recomputed server-side (api/_lib/pricing.js).
// ============================================================

import { isPurchasable } from '../data/products.js';

/**
 * Interpret a stock value the way the cart is allowed to.
 *
 * The two stock sources do NOT mean the same thing, and treating them alike
 * is how a cart starts making promises it cannot keep:
 *
 *   variant stock   a real integer count — adminApi passes v.stock straight
 *                   through, so 3 means three.
 *   product stock   a boolean in disguise — adminApi maps `true` to the
 *                   stand-in IN_STOCK_QTY (40) and `false` to 0, so the
 *                   number carries no information beyond "some" or "none".
 *
 * So a quantity ceiling is only honest for a variant. For a base product we
 * may say "out of stock" and nothing more. This is the same split the server
 * makes in api/_lib/pricing.js -> resolveStock().
 *
 * @returns {number|null} a real remaining count, or null when unknowable
 */
export function countableStock(variantObj) {
  if (!variantObj) return null;
  return Number.isFinite(variantObj.stock) ? variantObj.stock : null;
}

/**
 * Why this line cannot be ordered, or null when it can.
 *
 * Ordered so the customer is told the most specific thing that is wrong:
 * a pack size that no longer exists explains itself better than the generic
 * "not available", and both beat letting create-order refuse the whole order
 * after the address is filled in.
 */
export function unavailableReasonFor({ product, line, variantObj, variantMissing }) {
  if (variantMissing) {
    return line.variant
      ? `Pack size “${line.variant}” is no longer available.`
      : 'The pack size you chose is no longer available.';
  }
  if (product.isActive === false) return 'This item is no longer available.';

  const stock = countableStock(variantObj);
  if (stock === 0 || (!variantObj && product.stock === 0)) return 'This item is out of stock.';
  if (stock != null && line.qty > stock) {
    return stock === 1
      ? 'Only 1 left — please reduce the quantity.'
      : `Only ${stock} left — please reduce the quantity.`;
  }
  // A line persisted from before purchase gating existed, or one whose price
  // disappeared when the catalogue hydrated.
  if (!isPurchasable(product, variantObj)) return 'This item is not available to buy right now.';
  return null;
}

/**
 * Price and judge one stored cart line against the live catalogue.
 *
 * @param line     the stored line: { key, id, variant, variantId, qty }
 * @param product  the live catalogue product, or null/undefined if it is gone
 * @returns the hydrated line, or null when the product no longer exists
 *          (the caller drops those — see PRUNE_MISSING in store.jsx)
 */
export function hydrateCartLine(line, product) {
  if (!product) return null;

  const variantObj = line.variantId
    ? (product.variants || []).find((v) => String(v.id) === String(line.variantId)) || null
    : null;

  // The customer chose a pack size and that pack is gone. Falling back to
  // product.price would quietly re-price a 750 ml line at the 250 ml price —
  // exactly the substitution create-order refuses with "The selected size is
  // no longer available", and exactly what isPurchasable's own contract warns
  // against. So the price stays UNKNOWN and the line is blocked. A product
  // that never had a variant is untouched by this.
  const variantMissing = Boolean(line.variantId) && !variantObj;

  const unavailableReason = unavailableReasonFor({ product, line, variantObj, variantMissing });

  // Only a missing variant leaves the price genuinely unknowable. Every other
  // blocked line has a real price, and showing it is more honest than blanking
  // it — checkout is disabled either way.
  const unitPrice = variantMissing ? null : (variantObj?.price ?? product.price);
  const unitMrpRaw = variantMissing ? null : (variantObj?.mrp ?? product.mrp ?? unitPrice);

  return {
    ...line,
    product,
    variantObj,
    variantLabel: variantObj?.label ?? line.variant ?? null,
    variantMissing,
    variantStock: countableStock(variantObj),
    unitPrice,
    unitMrp: unitPrice == null ? null : Math.max(unitMrpRaw, unitPrice),
    // A price we cannot know contributes nothing to the totals, rather than
    // contributing a guess.
    lineTotal: unitPrice == null ? 0 : unitPrice * line.qty,
    unavailableReason,
    purchasable: unavailableReason == null,
  };
}

/** Item subtotal. Lines with an unknown price contribute nothing. */
export function cartSubtotal(lines) {
  return lines.reduce((s, l) => s + l.lineTotal, 0);
}

/** MRP total. A line with no known MRP is skipped rather than counted as 0. */
export function cartMrpTotal(lines) {
  return lines.reduce((s, l) => (l.unitMrp == null ? s : s + l.unitMrp * l.qty), 0);
}

/** Total saved against MRP. Skips lines with no comparable pair (never NaN). */
export function cartSavings(lines) {
  return lines.reduce(
    (s, l) => (l.unitMrp == null || l.unitPrice == null
      ? s
      : s + Math.max(0, l.unitMrp - l.unitPrice) * l.qty),
    0,
  );
}
