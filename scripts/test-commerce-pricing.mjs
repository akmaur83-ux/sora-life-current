// ============================================================
// Commerce pricing tests — variants, quantity, discounts, coupons,
// GST breakdown, shipping and price-tampering resistance.
//
// Covers the critical cases: a larger pack must cost more, quantity must
// multiply the *variant* price, a tampered/foreign/inactive variant must be
// rejected rather than silently billed at the cheaper base price, and the
// GST split must be internally consistent with the grand total.
//
// Run: node scripts/test-commerce-pricing.mjs
// ============================================================
import {
  validateCartPayload,
  computeOrderTotal,
  trustedVariantPrice,
  computeCouponDiscount,
  generateInvoiceNumber,
} from '../api/_lib/pricing.js';
import { computeTax, resolveTaxKind, splitInclusive, getTaxConfig } from '../api/_lib/tax.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'not equal'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }
function close(a, b, msg, tol = 0.02) {
  if (Math.abs(a - b) > tol) throw new Error(`${msg || 'not close'}: got ${a}, want ~${b}`);
}

// ---- Fixtures -------------------------------------------------------
const PRODUCT = {
  id: 101, biosash_id: 'b115', name: 'Sea Buckthorn Diabo Juice',
  original_price: 999, sale_price: 749, discount_percent: 25, is_active: true,
};
const VARIANTS = [
  { id: 'v250', product_id: 101, label: '250 ml', sku: 'SL-DIABO-250', mrp: 999,  sale_price: 749,  stock: 10, is_active: true },
  { id: 'v750', product_id: 101, label: '750 ml', sku: 'SL-DIABO-750', mrp: 1999, sale_price: 1599, stock: 5,  is_active: true },
  { id: 'vOff', product_id: 101, label: '500 ml', sku: 'SL-DIABO-500', mrp: 1499, sale_price: 1199, stock: 5,  is_active: false },
  { id: 'vOut', product_id: 101, label: '1 L',    sku: 'SL-DIABO-1L',  mrp: 2499, sale_price: 2199, stock: 0,  is_active: true },
  { id: 'vAlien', product_id: 999, label: '250 ml', sku: 'OTHER', mrp: 100, sale_price: 50, stock: 5, is_active: true },
];
const NO_TAX = { rate: 0, mode: 'inclusive', sellerState: null };
const GST18_INC = { rate: 18, mode: 'inclusive', sellerState: 'Punjab' };
const GST18_EXC = { rate: 18, mode: 'exclusive', sellerState: 'Punjab' };

const base = (items, opts = {}) =>
  computeOrderTotal(items, [PRODUCT], 'std', { variantRows: VARIANTS, taxConfig: NO_TAX, ...opts });

console.log('\n— Variant pricing —');

test('250 ml variant is priced from its own row', () => {
  const r = base([{ id: 'b115', qty: 1, variantId: 'v250' }]);
  ok(r.ok, r.error);
  eq(r.lines[0].unit_price, 749, '250ml unit price');
  eq(r.lines[0].variant, '250 ml');
  eq(r.lines[0].sku, 'SL-DIABO-250');
});

test('750 ml variant costs more than 250 ml (not the base price)', () => {
  const small = base([{ id: 'b115', qty: 1, variantId: 'v250' }]);
  const large = base([{ id: 'b115', qty: 1, variantId: 'v750' }]);
  eq(large.lines[0].unit_price, 1599, '750ml unit price');
  ok(large.total > small.total, '750ml must total more than 250ml');
});

test('quantity multiplies the VARIANT price, not the base price', () => {
  const r = base([{ id: 'b115', qty: 2, variantId: 'v750' }]);
  eq(r.lines[0].qty, 2);
  eq(r.lines[0].line_total, 3198, '1599 x 2');
  eq(r.breakdown.itemTotal, 3198);
});

test('250 ml x 2 subtotals correctly', () => {
  const r = base([{ id: 'b115', qty: 2, variantId: 'v250' }]);
  eq(r.lines[0].line_total, 1498, '749 x 2');
});

test('no variantId falls back to base product price (backwards compatible)', () => {
  const r = base([{ id: 'b115', qty: 1 }]);
  eq(r.lines[0].unit_price, 749);
  eq(r.lines[0].variant_id, null);
});

console.log('\n— Variant tampering resistance —');

test('unknown variant id is rejected (never billed at base price)', () => {
  const r = base([{ id: 'b115', qty: 1, variantId: 'does-not-exist' }]);
  eq(r.ok, false, 'must reject');
});

test('variant belonging to another product is rejected', () => {
  const r = base([{ id: 'b115', qty: 1, variantId: 'vAlien' }]);
  eq(r.ok, false, 'cross-product variant must be rejected');
});

test('inactive variant is rejected', () => {
  const r = base([{ id: 'b115', qty: 1, variantId: 'vOff' }]);
  eq(r.ok, false, 'inactive variant must be rejected');
});

test('out-of-stock variant is rejected', () => {
  const r = base([{ id: 'b115', qty: 1, variantId: 'vOut' }]);
  eq(r.ok, false, 'zero-stock variant must be rejected');
});

test('a price sent by the browser is ignored entirely', () => {
  const parsed = validateCartPayload([
    { id: 'b115', qty: 1, variantId: 'v750', price: 1, sale_price: 1, unit_price: 1, mrp: 1 },
  ]);
  ok(parsed.ok, parsed.error);
  ok(!('price' in parsed.items[0]), 'client price must not survive validation');
  const r = base(parsed.items);
  eq(r.lines[0].unit_price, 1599, 'server price wins over client-sent price');
});

test('fractional / negative quantity rejected for variants too', () => {
  eq(validateCartPayload([{ id: 'b115', qty: 1.5, variantId: 'v250' }]).ok, false);
  eq(validateCartPayload([{ id: 'b115', qty: -3, variantId: 'v250' }]).ok, false);
});

console.log('\n— Discounts and MRP —');

test('MRP total, product discount and savings are computed from trusted rows', () => {
  const r = base([{ id: 'b115', qty: 1, variantId: 'v750' }]);
  eq(r.breakdown.mrpTotal, 1999);
  eq(r.breakdown.itemTotal, 1599);
  eq(r.breakdown.productDiscount, 400);
  eq(r.lines[0].line_discount, 400);
});

test('MRP is never allowed to be below the selling price', () => {
  const weird = { ...PRODUCT, original_price: 100, sale_price: 500 };
  const r = computeOrderTotal([{ id: 'b115', qty: 1 }], [weird], 'std', { taxConfig: NO_TAX });
  ok(r.lines[0].unit_mrp >= r.lines[0].unit_price, 'mrp >= price');
  eq(r.breakdown.productDiscount, 0, 'no negative discount');
});

console.log('\n— Coupons —');

test('percent coupon applies with cap', () => {
  eq(computeCouponDiscount({ type: 'percent', value: 10, max_discount: 100 }, 1599), 100);
  eq(computeCouponDiscount({ type: 'percent', value: 10, max_discount: 0 }, 1000), 100);
});

test('coupon below minimum order value does not apply', () => {
  eq(computeCouponDiscount({ type: 'flat', value: 50, min_order_value: 2000 }, 1599), 0);
});

test('coupon can never exceed the order or go negative', () => {
  eq(computeCouponDiscount({ type: 'flat', value: 99999 }, 500), 500);
  eq(computeCouponDiscount({ type: 'flat', value: -50 }, 500), 0);
});

test('product discount + coupon produce the correct final price', () => {
  const r = base([{ id: 'b115', qty: 1, variantId: 'v750' }], {
    coupon: { code: 'SAVE50', type: 'flat', value: 50 },
  });
  eq(r.breakdown.itemTotal, 1599);
  eq(r.breakdown.couponDiscount, 50);
  eq(r.breakdown.subtotal, 1549);
  eq(r.total, 1549, 'free shipping over threshold');
});

console.log('\n— Shipping —');

test('free shipping above threshold', () => {
  const r = base([{ id: 'b115', qty: 1, variantId: 'v750' }], {}); // 1599 > 699
  eq(r.shipping, 0);
  eq(r.breakdown.shippingLabel, 'FREE');
});

test('paid express shipping below threshold is added', () => {
  const cheap = { ...PRODUCT, sale_price: 200, original_price: 200, discount_percent: 0 };
  const r = computeOrderTotal([{ id: 'b115', qty: 1 }], [cheap], 'exp', { taxConfig: NO_TAX });
  eq(r.shipping, 79);
  eq(r.total, 279);
});

test('a coupon cannot be used to dodge the free-shipping threshold', () => {
  const p = { ...PRODUCT, sale_price: 700, original_price: 700, discount_percent: 0 };
  const r = computeOrderTotal([{ id: 'b115', qty: 1 }], [p], 'exp', {
    taxConfig: NO_TAX, coupon: { type: 'flat', value: 100 },
  });
  // 700 - 100 = 600 < 699 -> shipping is charged, not waived.
  eq(r.shipping, 79, 'shipping charged on post-coupon value');
});

console.log('\n— GST / tax —');

test('no configured rate omits the tax block entirely (no invented tax)', () => {
  const r = base([{ id: 'b115', qty: 1, variantId: 'v750' }]);
  eq(r.breakdown.tax, null, 'tax must be null when unconfigured');
  eq(r.total, 1599, 'total unchanged without tax');
});

test('inclusive mode extracts GST without changing the payable amount', () => {
  const r = base([{ id: 'b115', qty: 1, variantId: 'v750' }], { taxConfig: GST18_INC, buyerState: 'Punjab' });
  eq(r.total, 1599, 'inclusive tax must not raise the total');
  ok(r.breakdown.tax, 'tax block present');
  close(r.breakdown.tax.taxableAmount + r.breakdown.tax.totalTax, 1599, 'taxable + tax = gross');
});

test('exclusive mode adds GST on top', () => {
  const r = base([{ id: 'b115', qty: 1, variantId: 'v750' }], { taxConfig: GST18_EXC, buyerState: 'Punjab' });
  close(r.total, 1599 * 1.18, 'exclusive tax added');
  close(r.breakdown.tax.totalTax, 1599 * 0.18, 'tax amount');
});

test('intra-state splits CGST + SGST, and they sum to total tax', () => {
  const r = base([{ id: 'b115', qty: 1, variantId: 'v750' }], { taxConfig: GST18_INC, buyerState: 'Punjab' });
  const t = r.breakdown.tax;
  eq(t.kind, 'cgst_sgst');
  eq(t.igst, null);
  close(t.cgst + t.sgst, t.totalTax, 'cgst + sgst = total tax');
});

test('inter-state uses IGST only', () => {
  const r = base([{ id: 'b115', qty: 1, variantId: 'v750' }], { taxConfig: GST18_INC, buyerState: 'Kerala' });
  const t = r.breakdown.tax;
  eq(t.kind, 'igst');
  eq(t.cgst, null);
  close(t.igst, t.totalTax, 'igst = total tax');
});

test('unknown seller state reports undivided GST', () => {
  eq(resolveTaxKind(null, 'Kerala'), 'gst');
});

test('per-variant GST rate overrides the default rate', () => {
  const v = [{ ...VARIANTS[1], gst_rate: 5 }];
  const r = computeOrderTotal([{ id: 'b115', qty: 1, variantId: 'v750' }], [PRODUCT], 'std', {
    variantRows: v, taxConfig: GST18_INC, buyerState: 'Punjab',
  });
  const { net, tax } = splitInclusive(1599, 5);
  close(r.breakdown.tax.totalTax, tax, 'uses 5% not 18%');
  close(r.breakdown.tax.taxableAmount, net, 'taxable at 5%');
});

test('mixed GST slabs are reported separately on the invoice', () => {
  const v = [
    { ...VARIANTS[0], gst_rate: 5 },
    { ...VARIANTS[1], gst_rate: 18 },
  ];
  const r = computeOrderTotal(
    [{ id: 'b115', qty: 1, variantId: 'v250' }, { id: 'b115', qty: 1, variantId: 'v750' }],
    [PRODUCT], 'std', { variantRows: v, taxConfig: GST18_INC, buyerState: 'Punjab' },
  );
  const rates = r.breakdown.tax.slabs.map((s) => s.rate).sort((a, b) => a - b);
  ok(rates.includes(5) && rates.includes(18), `expected 5 and 18 slabs, got ${rates}`);
});

console.log('\n— Breakdown integrity —');

test('breakdown arithmetic is internally consistent (inclusive)', () => {
  const r = base([{ id: 'b115', qty: 2, variantId: 'v750' }], {
    taxConfig: GST18_INC, buyerState: 'Punjab', coupon: { code: 'X', type: 'flat', value: 100 },
    fees: { platform: 10, packaging: 5 },
  });
  const b = r.breakdown;
  close(b.mrpTotal - b.productDiscount, b.itemTotal, 'mrp - discount = itemTotal');
  close(b.itemTotal - b.couponDiscount, b.subtotal, 'itemTotal - coupon = subtotal');
  close(b.subtotal + b.shipping + b.feeTotal, b.grandTotal, 'inclusive grand total');
  eq(b.grandTotal, r.total, 'breakdown matches charged total');
  eq(Math.round(r.total * 100), r.amountPaise, 'paise matches rupees');
});

test('breakdown arithmetic is internally consistent (exclusive)', () => {
  const r = base([{ id: 'b115', qty: 1, variantId: 'v250' }], {
    taxConfig: GST18_EXC, buyerState: 'Punjab', fees: { platform: 10 },
  });
  const b = r.breakdown;
  close(b.subtotal + b.shipping + b.feeTotal + b.tax.totalTax, b.grandTotal, 'exclusive grand total');
  eq(Math.round(r.total * 100), r.amountPaise, 'paise matches rupees');
});

test('line-level taxable + tax reconcile to the order tax', () => {
  const r = base([
    { id: 'b115', qty: 1, variantId: 'v250' },
    { id: 'b115', qty: 2, variantId: 'v750' },
  ], { taxConfig: GST18_INC, buyerState: 'Punjab' });
  const lineTax = r.lines.reduce((s, l) => s + (l.tax_amount || 0), 0);
  // Order tax also covers shipping/fees; with free shipping and no fees the
  // line tax should account for all of it.
  close(lineTax, r.breakdown.tax.totalTax, 'sum(line tax) = order tax', 0.05);
});

test('amountPaise is an integer (Razorpay requirement)', () => {
  const r = base([{ id: 'b115', qty: 3, variantId: 'v250' }], { taxConfig: GST18_EXC, buyerState: 'Kerala' });
  ok(Number.isInteger(r.amountPaise), `amountPaise must be integer, got ${r.amountPaise}`);
});

console.log('\n— Invoice numbering —');

test('invoice numbers are unique across rapid generation', () => {
  const set = new Set();
  for (let i = 0; i < 500; i++) set.add(generateInvoiceNumber());
  ok(set.size > 495, `expected near-unique, got ${set.size}/500`);
});

test('getTaxConfig defaults to inclusive with no invented rate', () => {
  const c = getTaxConfig({});
  eq(c.rate, 0, 'no rate invented');
  eq(c.mode, 'inclusive', 'safe default mode');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
