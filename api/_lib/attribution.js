// ============================================================
// Creator Program — Part 2 server-side attribution helpers.
//
// Computes the COMMISSIONABLE BASE for a conversion from the SERVER's own
// authoritative order (the same `lines` + `breakdown` computeOrderTotal
// produced). It never reads a price or amount from the browser, and never
// computes commission — only the eligible product-sales base.
//
// Formula (see 0013 migration header for the full statement):
//   per line: eligible = taxable_value (net of GST + coupon) when present,
//             else line_total minus the line's proportional coupon share.
//   totals:   gross_item_sales = Σ line_total   (selling price, tax-incl)
//             discounts        = couponDiscount
//             tax              = Σ line tax_amount
//             shipping         = breakdown.shipping   (EXCLUDED from eligible)
//             eligible_sales   = Σ eligible          (product revenue, net of
//                                                     coupon and tax)
// ============================================================

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * @param lines    the server `totals.lines` (or a stored order's `items`)
 * @param breakdown the server `totals.breakdown` (or a stored order's `billing`)
 * @returns { gross_item_sales, discounts, tax, shipping, eligible_sales, items[] }
 */
export function computeConversionBase(lines, breakdown) {
  const items = Array.isArray(lines) ? lines : [];
  const b = breakdown && typeof breakdown === 'object' ? breakdown : {};
  const itemTotal = Number(b.itemTotal) || items.reduce((s, l) => s + (Number(l.line_total) || 0), 0);
  const couponDiscount = Number(b.couponDiscount) || 0;

  let gross = 0, tax = 0, eligible = 0;
  const outItems = items.map((l, i) => {
    const lineTotal = Number(l.line_total) || 0;
    const couponShare = itemTotal > 0 ? round2(couponDiscount * (lineTotal / itemTotal)) : 0;
    const goodsAfterCoupon = round2(lineTotal - couponShare);
    // taxable_value is already net of GST AND the coupon ratio (see pricing.js).
    const eligibleLine = l.taxable_value != null ? round2(Number(l.taxable_value)) : goodsAfterCoupon;
    const taxAmount = Number(l.tax_amount) || 0;

    gross = round2(gross + lineTotal);
    tax = round2(tax + taxAmount);
    eligible = round2(eligible + eligibleLine);

    return {
      order_item_index: i,
      product_id: l.biosash_id ?? l.product_id ?? null,
      variant_id: l.variant_id ?? null,
      product_name: l.name ?? null,
      variant_label: l.variant ?? null,
      quantity: Number(l.qty) || 0,
      unit_price: round2(l.unit_price),
      line_amount: lineTotal,
      eligible_amount: eligibleLine,
    };
  });

  return {
    totals: {
      gross_item_sales: gross,
      discounts: round2(couponDiscount),
      tax,
      shipping: round2(b.shipping),
      eligible_sales: eligible,
    },
    items: outItems,
  };
}

/** Best-effort visitor id from the request body (opaque; never an internal id). */
export function readVisitorId(body) {
  const v = body && typeof body.visitorId === 'string' ? body.visitorId.trim() : '';
  return v ? v.slice(0, 64) : null;
}
