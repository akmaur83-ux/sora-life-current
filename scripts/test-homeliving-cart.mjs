// ============================================================
// Home & Living — purchasable end to end. Offline suite.
//
// The server prices a homeliving line from catalogue_products /
// catalogue_variants (store 'homeliving') and refuses it at every gate; the
// browser sends ids and the catalogue marker, never a price; the store keeps
// the line in its own namespace; the product page and the card add to it.
// And the other three stores are proven unchanged with ACTUAL OUTPUT: the
// pre-change payment modules (git, BASELINE_SHA) and the working tree's are
// run side by side over the same corpus, and every total, every request and
// every payload is compared byte for byte.
//
// NO NETWORK, NO DATABASE, NO ORDER.
//
//   node scripts/test-homeliving-cart.mjs
//   GROCERY_SRC_ROOT=<pre-change checkout> node scripts/test-homeliving-cart.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ROOT, read, has, loadModule, buildHomeLivingApp, loadHomeLivingData, PDP, PDP_PRODUCTS } from './homeliving-ssr.mjs';
import { loadSource } from './grocery-ssr.mjs';
import { REPO } from './baseline-export.mjs';

// The tip before this change: the grocery size-label fix.
const BASELINE_SHA = '280062b';

let passed = 0, failed = 0, current = '(startup)';
process.on('unhandledRejection', (e) => { console.error(`\n  FATAL during: ${current}\n  ${e?.stack || e}`); process.exitCode = 1; });
async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
console.log(`\nsource root: ${ROOT}`);
const atBaseline = (rel) => execFileSync('git', ['show', `${BASELINE_SHA}:${rel}`], { cwd: REPO, encoding: 'utf8' }).replace(/\r\n/g, '\n');
const tryImport = async (path) => { try { return await import(pathToFileURL(path).href); } catch { return null; } };

// ---- the payment modules: the working tree's, and the baseline's from git --------------
const now = {
  pricing: await tryImport(resolve(ROOT, 'api/_lib/pricing.js')),
  admin: await tryImport(resolve(ROOT, 'api/_lib/supabaseAdmin.js')),
  quote: await tryImport(resolve(ROOT, 'api/_lib/couponQuote.js')),
};
const then = {};
{
  const dir = mkdtempSync(join(tmpdir(), 'sora-hlcart-'));
  mkdirSync(join(dir, '_lib'));
  for (const f of ['pricing.js', 'tax.js', 'supabaseAdmin.js', 'coupons.js', 'couponQuote.js']) writeFileSync(join(dir, '_lib', f), atBaseline(`api/_lib/${f}`));
  then.pricing = await import(pathToFileURL(join(dir, '_lib', 'pricing.js')).href);
  then.admin = await import(pathToFileURL(join(dir, '_lib', 'supabaseAdmin.js')).href);
  then.quote = await import(pathToFileURL(join(dir, '_lib', 'couponQuote.js')).href);
}

// ---- trusted rows, as the tables return them ----------------------------------------
const WELLNESS = [
  { id: 2, biosash_id: 'b183', name: 'Beard Cream', original_price: 295, discount_percent: 20, sale_price: 236, is_active: true, stock: true, gst_rate: null },
  { id: 3, biosash_id: 'b185', name: 'Beard Wash', original_price: 225, discount_percent: 15, sale_price: 191, is_active: true, stock: true, gst_rate: 18 },
  { id: 7, biosash_id: 'b777', name: 'Juice', original_price: 500, discount_percent: 0, sale_price: null, is_active: true, stock: true, gst_rate: null },
  { id: 8, biosash_id: 'b888', name: 'Sold Out Oil', original_price: 300, discount_percent: 0, sale_price: 280, is_active: true, stock: false, gst_rate: null },
  { id: 9, biosash_id: 'b999', name: 'Retired Balm', original_price: 300, discount_percent: 0, sale_price: 280, is_active: false, stock: true, gst_rate: null },
];
const WELLNESS_VARIANTS = [
  { id: 'v750', product_id: 7, label: '750 ml', sku: 'J-750', mrp: 900, sale_price: 810, gst_rate: 5, stock: 6, is_active: true },
  { id: 'v250', product_id: 7, label: '250 ml', sku: 'J-250', mrp: 400, sale_price: null, gst_rate: null, stock: 0, is_active: true },
  { id: 'vx', product_id: 3, label: 'Other', sku: 'X', mrp: 100, sale_price: 90, gst_rate: null, stock: 3, is_active: true },
];
const FASHION = [
  { id: 'f-shirt', name: 'Meadow Linen Shirt', slug: 'meadow-linen-shirt', mrp: 1299, sale_price: 1099, is_active: true },
  { id: 'f-old', name: 'Retired Tee', slug: 'retired-tee', mrp: 799, sale_price: 699, is_active: false },
];
const FASHION_VARIANTS = [
  { id: 'fv-m-navy', product_id: 'f-shirt', size: 'M', colour: 'Navy', sku: 'SH-M-NV', stock: 5, price_override: null, is_active: true },
  { id: 'fv-l-navy', product_id: 'f-shirt', size: 'L', colour: 'Navy', sku: 'SH-L-NV', stock: 0, price_override: null, is_active: true },
  { id: 'fv-xl-sage', product_id: 'f-shirt', size: 'XL', colour: 'Sage', sku: 'SH-XL-SG', stock: 2, price_override: 1249, is_active: true },
  { id: 'fv-tee', product_id: 'f-old', size: 'M', colour: 'Grey', sku: 'T', stock: 9, price_override: null, is_active: true },
];
const HL = {
  sheet: { id: 'h-sheet', name: 'Sage Fitted Sheet', slug: 'sage-fitted-sheet', sku: 'SL-HL-FIT-SAGE', mrp: 1299, sale_price: 999, stock: 30, is_active: true, gst_rate: 12 },
  towel: { id: 'h-towel', name: 'Bath Towel Set', slug: 'bath-towel-set', sku: 'SL-HL-TWL-2', mrp: 949, sale_price: 799, stock: 3, is_active: true, gst_rate: null },
  curtain: { id: 'h-curtain', name: 'Linen Curtain Pair', slug: 'linen-curtain-pair', sku: 'SL-HL-CUR-2', mrp: 2999, sale_price: 2499, stock: 0, is_active: true },
  runner: { id: 'h-runner', name: 'Jute Runner', slug: 'jute-runner', sku: 'SL-HL-RUG', mrp: 1499, sale_price: 1499, stock: 12, is_active: true },
  retired: { id: 'h-retired', name: 'Retired Throw', slug: 'retired-throw', sku: 'SL-HL-THR', mrp: 999, sale_price: 899, stock: 5, is_active: false },
  unpriced: { id: 'h-unpriced', name: 'Unpriced Mat', slug: 'unpriced-mat', sku: 'SL-HL-MAT', mrp: 0, sale_price: null, stock: 5, is_active: true },
  nostock: { id: 'h-nostock', name: 'Uncounted Cushion', slug: 'uncounted-cushion', sku: 'SL-HL-CUS', mrp: 599, sale_price: 499, stock: null, is_active: true },
  b183: { id: 'b183', name: 'Same Id As A Wellness Product', slug: 'same-id', sku: 'SL-HL-SAME', mrp: 5000, sale_price: 4500, stock: 9, is_active: true },
};
const HV = [
  { id: 'hv-single-sage', product_id: 'h-sheet', size: 'Single', colour: 'Sage', sku: 'V-1', stock: 6, price_override: null, is_active: true },
  { id: 'hv-king-sage', product_id: 'h-sheet', size: 'King', colour: 'Sage', sku: 'V-2', stock: 0, price_override: null, is_active: true },
  { id: 'hv-king-ivory', product_id: 'h-sheet', size: 'King', colour: 'Ivory', sku: 'V-3', stock: 4, price_override: 1199, is_active: true },
  { id: 'hv-queen-retired', product_id: 'h-sheet', size: 'Queen', colour: '', sku: 'V-4', stock: 9, price_override: null, is_active: false },
  { id: 'hv-runner-borrowed', product_id: 'h-runner', size: '60 × 90', colour: '', sku: 'V-5', stock: 9, price_override: 99, is_active: true },
];
const TAXES = [
  { mode: 'inclusive', rate: 18, cgstSgstThresholdState: null },
  { mode: 'exclusive', rate: 18, cgstSgstThresholdState: null },
  { mode: 'inclusive', rate: 0, cgstSgstThresholdState: null },
];
const TAX = TAXES[0];
const COUPONS = [
  null,
  { id: 'c1', code: 'TEN', type: 'percent', value: 10, max_discount: 0, min_order_value: 0, is_active: true },
  { id: 'c2', code: 'FLAT100', type: 'flat', value: 100, max_discount: 0, min_order_value: 500, is_active: true },
  { id: 'c3', code: 'HALF', type: 'percent', value: 50, max_discount: 200, min_order_value: 0, is_active: true },
  { id: 'c4', code: 'OFF', type: 'percent', value: 90, max_discount: 0, min_order_value: 0, is_active: false },
];
const DELIVERIES = ['std', 'exp', 'sched', undefined, '__proto__'];
const hlOpts = (extra = {}) => ({ homeLivingProductRows: Object.values(HL), homeLivingVariantRows: HV, taxConfig: TAX, ...extra });
const priceHl = (payload, extra = {}) => {
  const v = now.pricing.validateCartPayload(payload);
  if (!v.ok) return v;
  return now.pricing.computeOrderTotal(v.items, WELLNESS, 'std', { variantRows: WELLNESS_VARIANTS, fashionProductRows: FASHION, fashionVariantRows: FASHION_VARIANTS, ...hlOpts(extra) });
};
const hl = (id, qty = 1, variantId = null, extra = {}) => ({ catalogue: 'homeliving', id, qty, variantId, ...extra });

// The corpus every comparison below runs over: wellness, fashion, mixed, and
// what a grocery line or an unknown store word looks like on the wire.
const CORPUS = [
  ['wellness', [{ id: 'b183', qty: 2 }]],
  ['wellness', [{ id: 'b777', qty: 1, variantId: 'v750', variant: '750 ml' }]],
  ['wellness', [{ id: 'b777', qty: 9, variantId: 'v750' }]],
  ['wellness', [{ id: 'b777', qty: 1, variantId: 'v250' }]],
  ['wellness', [{ id: 'b185', qty: 1, variantId: 'v750' }]],
  ['wellness', [{ id: 'b888', qty: 1 }]],
  ['wellness', [{ id: 'b999', qty: 1 }]],
  ['wellness', [{ id: 'nope', qty: 1 }]],
  ['wellness', [{ id: 2, qty: 3 }, { id: 'b185', qty: 1, variant: 'a label the server ignores' }]],
  ['wellness', [{ id: 'b183', qty: 1, price: 1, unitPrice: 1, lineTotal: 1, mrp: 1 }]],
  ['wellness', [{ id: 'b183', qty: 15 }, { id: 'b183', qty: 10 }]],
  ['wellness', [{ id: 'b183', qty: 4 }, { id: 'b185', qty: 2 }, { id: 'b777', qty: 2, variantId: 'v750' }]],
  ['fashion', [{ catalogue: 'fashion', id: 'f-shirt', qty: 1, variantId: 'fv-m-navy' }]],
  ['fashion', [{ catalogue: 'fashion', id: 'f-shirt', qty: 2, variantId: 'fv-xl-sage' }]],
  ['fashion', [{ catalogue: 'fashion', id: 'f-shirt', qty: 6, variantId: 'fv-m-navy' }]],
  ['fashion', [{ catalogue: 'fashion', id: 'f-shirt', qty: 1, variantId: 'fv-l-navy' }]],
  ['fashion', [{ catalogue: 'fashion', id: 'f-shirt', qty: 1 }]],
  ['fashion', [{ catalogue: 'fashion', id: 'f-shirt', qty: 1, variantId: 'fv-tee' }]],
  ['fashion', [{ catalogue: 'fashion', id: 'f-old', qty: 1, variantId: 'fv-tee' }]],
  ['fashion', [{ catalogue: 'fashion', id: 'f-shirt', qty: 1, variantId: 'fv-m-navy', price: 1 }]],
  ['fashion', [{ catalogue: 'fashion', id: 'f-shirt', qty: 3, variantId: 'fv-m-navy' }, { catalogue: 'fashion', id: 'f-shirt', qty: 3, variantId: 'fv-m-navy' }]],
  ['mixed', [{ id: 'b183', qty: 1 }, { catalogue: 'fashion', id: 'f-shirt', qty: 1, variantId: 'fv-m-navy' }]],
  ['mixed', [{ id: 'f-shirt', qty: 1 }, { catalogue: 'fashion', id: 'b183', qty: 1, variantId: 'fv-m-navy' }]],
  ['grocery', [{ catalogue: 'grocery', id: 'g-rice', qty: 1 }]],
  ['grocery', [{ catalogue: 'grocery', id: 'b183', qty: 1 }]],
  ['unknown word', [{ catalogue: 'Fashion', id: 'f-shirt', qty: 1, variantId: 'fv-m-navy' }]],
  ['unknown word', [{ catalogue: 'wholesale', id: 'b183', qty: 1 }]],
  ['unknown word', [{ catalogue: 'fashion ', id: 'b183', qty: 1 }]],
  ['unknown word', [{ catalogue: 1, id: 'b183', qty: 1 }, { catalogue: null, id: 'b185', qty: 1 }]],
  ['invalid', []],
  ['invalid', [{ id: 'b183', qty: 0 }]],
  ['invalid', [{ id: 'b183', qty: 21 }]],
  ['invalid', [{ id: 'b183', qty: 1.5 }]],
  ['invalid', [{ id: { x: 1 }, qty: 1 }]],
];

// ============================================================
console.log('\n— Wellness, fashion and grocery: byte-identical to the pre-change modules —');
// ============================================================

await test('pricing: every corpus cart through validateCartPayload + computeOrderTotal, both modules, every delivery × coupon × tax mode', () => {
  const tally = {}; let compared = 0; const differ = [];
  for (const [kind, payload] of CORPUS) {
    const a = then.pricing.validateCartPayload(payload), b = now.pricing.validateCartPayload(payload);
    assert.equal(JSON.stringify(b), JSON.stringify(a), `${kind}: validateCartPayload differs for ${JSON.stringify(payload)}`);
    for (const delivery of DELIVERIES) for (const coupon of COUPONS) for (const taxConfig of TAXES) {
      const opts = { variantRows: WELLNESS_VARIANTS, fashionProductRows: FASHION, fashionVariantRows: FASHION_VARIANTS, coupon, taxConfig };
      const x = a.ok ? then.pricing.computeOrderTotal(a.items, WELLNESS, delivery, opts) : a;
      const y = b.ok ? now.pricing.computeOrderTotal(b.items, WELLNESS, delivery, opts) : b;
      compared += 1; tally[kind] = (tally[kind] || 0) + 1;
      if (JSON.stringify(y) !== JSON.stringify(x)) differ.push(`${kind} ${JSON.stringify(payload)} ${delivery} ${coupon?.code} ${taxConfig.mode}`);
    }
  }
  console.log(`        ${compared} priced comparisons — ${Object.entries(tally).map(([k, n]) => `${k} ${n}`).join(', ')} — ${compared - differ.length} identical, ${differ.length} different`);
  assert.deepEqual(differ, []);
  assert.ok(compared >= 2500, 'the corpus actually ran');
});

await test('normalizeCartLines and the helpers it shares: identical for every corpus cart', () => {
  let n = 0;
  for (const [, payload] of CORPUS) {
    const items = (Array.isArray(payload) ? payload : []).filter((r) => r && (typeof r.id === 'string' || typeof r.id === 'number')).map((r) => ({ ...r, id: String(r.id) }));
    assert.equal(JSON.stringify(now.pricing.normalizeCartLines(items)), JSON.stringify(then.pricing.normalizeCartLines(items)));
    n += 1;
  }
  for (const row of [...WELLNESS, ...WELLNESS_VARIANTS]) {
    assert.equal(now.pricing.trustedUnitPrice(row), then.pricing.trustedUnitPrice(row));
    assert.equal(now.pricing.trustedUnitMrp(row), then.pricing.trustedUnitMrp(row));
    assert.equal(JSON.stringify(now.pricing.trustedVariantPrice(row)), JSON.stringify(then.pricing.trustedVariantPrice(row)));
  }
  for (const v of FASHION_VARIANTS) assert.equal(JSON.stringify(now.pricing.trustedFashionPrice(FASHION[0], v)), JSON.stringify(then.pricing.trustedFashionPrice(FASHION[0], v)));
  for (const s of [true, false, null, undefined, 0, 3, '4', 'x']) assert.deepEqual(now.pricing.resolveStock(s), then.pricing.resolveStock(s));
  console.log(`        ${n} carts normalised, ${WELLNESS.length + WELLNESS_VARIANTS.length + FASHION_VARIANTS.length} price rows and 8 stock values compared — all identical`);
});

// One PostgREST stub that records every request and answers by table name.
function recorder() {
  const urls = [];
  const fetch = async (url) => {
    urls.push(String(url).split('/rest/v1/')[1]);
    const table = String(url).split('/rest/v1/')[1].split('?')[0];
    const rows = table === 'products' ? WELLNESS : table === 'product_variants' ? WELLNESS_VARIANTS
      : table === 'fashion_products' ? FASHION : table === 'fashion_variants' ? FASHION_VARIANTS
        : table === 'catalogue_products' ? Object.values(HL) : table === 'catalogue_variants' ? HV.filter((v) => v.is_active) : [];
    return { ok: true, status: 200, text: async () => JSON.stringify(rows), json: async () => rows };
  };
  return { urls, fetch };
}
const cfg = { url: 'https://stub.supabase.co', serviceKey: 'stub-service-key' };

await test('Supabase reads: fetchCartRows asks the same tables the same questions for every wellness, fashion and grocery cart', async () => {
  const realFetch = globalThis.fetch; let n = 0;
  try {
    for (const [kind, payload] of CORPUS.filter(([k]) => k !== 'invalid')) {
      const v = then.pricing.validateCartPayload(payload);
      if (!v.ok) continue;
      const r1 = recorder(); globalThis.fetch = r1.fetch; const a = await then.admin.fetchCartRows(v.items, cfg);
      const r2 = recorder(); globalThis.fetch = r2.fetch; const b = await now.admin.fetchCartRows(v.items, cfg);
      assert.deepEqual(r2.urls, r1.urls, `${kind}: the requests differ for ${JSON.stringify(payload)}`);
      for (const k of Object.keys(a)) assert.equal(JSON.stringify(b[k]), JSON.stringify(a[k]), `${kind}: ${k}`);
      assert.deepEqual([b.homeLivingProductRows, b.homeLivingVariantRows], [[], []], 'no Home & Living read for a cart without a Home & Living line');
      n += 1;
    }
  } finally { globalThis.fetch = realFetch; }
  console.log(`        ${n} carts — every request URL and every returned list identical`);
});

const clientDeps = (fetchStub) => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } }, getVisitorId: () => 'visitor', fetch: fetchStub });
const WIRE_LINES = [
  { key: 'b183', id: 'b183', qty: 2, variantId: null, variant: null },
  { key: 'b777::v750', id: 'b777', qty: 1, variantId: 'v750', variant: '750 ml' },
  { key: 'fashion:f-shirt::fv-m-navy', catalogue: 'fashion', id: 'f-shirt', qty: 1, variantId: 'fv-m-navy', variant: 'M · Navy', unitPrice: 1099, lineTotal: 1099 },
  { key: 'grocery:g-rice::', catalogue: 'grocery', id: 'g-rice', qty: 2, variantId: null, variant: '1 kg', unitPrice: 99 },
  { key: 'x', catalogue: 'wholesale', id: 'b185', qty: 1, variantId: null, variant: null },
];
await test('the browser\'s two payloads (quote and order) are byte-identical for wellness, fashion and grocery lines', async () => {
  const bodies = (src) => {
    const sent = [];
    const fetchStub = async (url, init) => { sent.push(init.body); return { ok: true, status: 200, json: async () => ({}) }; };
    return { sent, mod: loadSource(src, clientDeps(fetchStub)) };
  };
  const apiThen = loadSource(atBaseline('src/lib/couponApi.js'), clientDeps(null));
  const apiNow = loadModule('src/lib/couponApi.js', clientDeps(null));
  for (const line of WIRE_LINES) assert.equal(JSON.stringify(apiNow.cartToPayload([line])), JSON.stringify(apiThen.cartToPayload([line])), `quote payload for ${line.key}`);
  const a = bodies(atBaseline('src/lib/payments.js')), b = bodies(read('src/lib/payments.js'));
  const order = { items: WIRE_LINES, delivery: 'std', customer: { name: 'A', state: 'Karnataka' }, paymentMethod: 'online', idempotencyKey: 'k', couponCode: 'TEN', quotedTotals: { total: 1 } };
  await a.mod.createPaymentOrder(order); await b.mod.createPaymentOrder(order);
  assert.equal(b.sent[0], a.sent[0], 'the create-order body');
  console.log(`        ${WIRE_LINES.length} lines through cartToPayload and one ${a.sent[0].length}-byte create-order body — identical`);
});

// ============================================================
console.log('\n— The server: Home & Living priced from the catalogue rows, refused at every gate —');
// ============================================================

await test('priced from the rows: the variant override, else a sale price below MRP, else MRP — whole rupees, MRP never below the price', () => {
  const T = now.pricing.trustedHomeLivingPrice;
  assert.equal(T(HL.sheet, HV[0]).price, 999, 'sale price below MRP');
  assert.equal(T(HL.sheet, HV[2]).price, 1199, 'the variant override');
  assert.equal(T(HL.runner, null).price, 1499, 'a sale price equal to MRP is not a sale');
  assert.equal(T({ ...HL.towel, sale_price: 1200 }, null).price, 949, 'a sale price above MRP is ignored');
  assert.equal(T({ ...HL.towel, sale_price: null }, null).price, 949, 'no sale price: MRP');
  assert.equal(T({ ...HL.towel, sale_price: 798.6 }, null).price, 799, 'whole rupees');
  assert.equal(T(HL.unpriced, null), null, 'nothing priced: null, so the line is refused');
  assert.deepEqual(T(HL.sheet, HV[2]), { price: 1199, mrp: 1299, sku: 'V-3', label: 'King · Ivory' });
  assert.equal(T({ ...HL.sheet, mrp: 0 }, HV[2]).mrp, 1199, 'MRP never below the price');
});

await test('a Home & Living cart is charged the server\'s figure; a price, line total or MRP sent from the browser is ignored', () => {
  const r = priceHl([hl('h-sheet', 2, 'hv-single-sage', { price: 1, unitPrice: 1, lineTotal: 2, mrp: 1, unit_price: 1 }), hl('h-towel', 1, null, { price: 1 })]);
  assert.ok(r.ok, r.error);
  assert.deepEqual(r.lines.map((l) => [l.catalogue, l.product_id, l.variant_id, l.unit_price, l.qty, l.line_total, l.variant]),
    [['homeliving', 'h-sheet', 'hv-single-sage', 999, 2, 1998, 'Single · Sage'], ['homeliving', 'h-towel', null, 799, 1, 799, null]]);
  assert.equal(r.total, 2797); assert.equal(r.amountPaise, 279700);
  assert.equal(r.breakdown.mrpTotal, 1299 * 2 + 949);
});

await test('every gate refuses — never drops — the line: gone, retired, option gone/retired/borrowed, option unchosen, option on a product without options, out of stock, over-ordered, unpriced, uncounted', () => {
  const refuse = (payload, re) => { const r = priceHl(payload); assert.equal(r.ok, false, `${JSON.stringify(payload)} must be refused`); assert.match(r.error, re); };
  refuse([hl('h-missing')], /no longer available/);
  refuse([hl('h-retired')], /"Retired Throw" is no longer available/);
  refuse([hl('h-sheet', 1, 'hv-nope')], /option you chose for "Sage Fitted Sheet" is no longer available/);
  refuse([hl('h-sheet', 1, 'hv-queen-retired')], /option you chose for "Sage Fitted Sheet" is no longer available/);
  refuse([hl('h-sheet', 1, 'hv-runner-borrowed')], /option you chose for "Sage Fitted Sheet" is no longer available/);
  refuse([hl('h-sheet', 1)], /Please choose an option for "Sage Fitted Sheet"/);
  refuse([hl('h-towel', 1, 'hv-single-sage')], /option you chose for "Bath Towel Set" is no longer available/);
  refuse([hl('h-sheet', 1, 'hv-king-sage')], /"Sage Fitted Sheet \(King · Sage\)" is out of stock/);
  refuse([hl('h-curtain', 1)], /"Linen Curtain Pair" is out of stock/);
  refuse([hl('h-sheet', 7, 'hv-single-sage')], /Only 6 of "Sage Fitted Sheet \(Single · Sage\)" are left/);
  refuse([hl('h-towel', 4)], /Only 3 of "Bath Towel Set" are left/);
  refuse([hl('h-unpriced', 1)], /"Unpriced Mat" is not available for purchase/);
  refuse([hl('h-nostock', 1)], /"Uncounted Cushion" is out of stock/);
  // One bad line refuses the whole order: a good wellness line beside it does not slip through alone.
  refuse([{ id: 'b183', qty: 1 }, hl('h-curtain', 1)], /out of stock/);
});

await test('merged before the stock check: two lines of the same option cannot each pass a check their total fails', () => {
  const r = priceHl([hl('h-sheet', 4, 'hv-single-sage'), hl('h-sheet', 4, 'hv-single-sage')]);
  assert.equal(r.ok, false); assert.match(r.error, /Only 6 of/);
  const ok = priceHl([hl('h-sheet', 3, 'hv-single-sage'), hl('h-sheet', 3, 'hv-single-sage')]);
  assert.ok(ok.ok); assert.equal(ok.lines.length, 1); assert.equal(ok.lines[0].qty, 6);
});

await test('its own namespace: a Home & Living id equal to a wellness biosash_id is never priced as wellness, and the two stay two lines', () => {
  const r = priceHl([{ id: 'b183', qty: 1 }, hl('b183', 1)]);
  assert.ok(r.ok, r.error);
  assert.deepEqual(r.lines.map((l) => [l.catalogue ?? 'wellness', l.unit_price]), [['wellness', 236], ['homeliving', 4500]]);
  const gone = now.pricing.computeOrderTotal(now.pricing.validateCartPayload([hl('b183', 1)]).items, WELLNESS, 'std', { taxConfig: TAX });
  assert.equal(gone.ok, false, 'with no Home & Living rows, a Home & Living id finds nothing — it does not fall back to the wellness row');
});

await test('gst_rate is forced null like fashion: the row\'s slab is not read, the configured default applies', () => {
  const r = priceHl([hl('h-sheet', 1, 'hv-single-sage')]);
  assert.equal(r.lines[0].gst_rate, null, 'the row carries 12 — it is ignored');
  const pricing = read('api/_lib/pricing.js');
  assert.match(pricing, /Deliberately null, like fashion[\s\S]{0,700}audited[\s\S]{0,120}gst_rate: null,/, 'the comment says why, and what has to happen first');
  const select = read('api/_lib/supabaseAdmin.js').match(/export async function fetchHomeLivingProductsForCart[\s\S]*?const select = '([^']+)'/)[1];
  assert.doesNotMatch(select, /gst_rate/, 'and it is not even selected');
});

await test('the catalogue marker is a closed list: only "fashion" and "homeliving" survive validation; anything else is a wellness line', () => {
  const v = now.pricing.validateCartPayload([hl('h-sheet', 1, 'hv-single-sage'), { catalogue: 'Homeliving', id: 'h-sheet', qty: 1 }, { catalogue: 'homeliving ', id: 'h-towel', qty: 1 }, { catalogue: 'grocery', id: 'g', qty: 1 }]);
  assert.deepEqual(v.items.map((i) => i.catalogue ?? null), ['homeliving', null, null, null]);
});

await test('fetchCartRows reads the BASE tables, filtered to the homeliving store: the products named, and every active variant of them', async () => {
  const realFetch = globalThis.fetch; const r = recorder(); globalThis.fetch = r.fetch;
  try {
    const v = now.pricing.validateCartPayload([hl('h-sheet', 1, 'hv-single-sage'), hl('h-towel', 1)]);
    const rows = await now.admin.fetchCartRows(v.items, cfg);
    assert.deepEqual(r.urls.sort(), [
      'catalogue_products?select=id,name,slug,sku,mrp,sale_price,stock,is_active&store=eq.homeliving&id=in.("h-sheet","h-towel")',
      'catalogue_variants?select=id,product_id,size,colour,sku,stock,price_override,is_active&store=eq.homeliving&is_active=eq.true&product_id=in.("h-sheet","h-towel")',
    ].sort(), 'no wellness and no fashion read for a Home & Living cart');
    assert.equal(rows.homeLivingProductRows.length, Object.keys(HL).length);
  } finally { globalThis.fetch = realFetch; }
});

await test('both endpoints carry the rows to EVERY pricing call: priceCart, quoteCoupon (a 10% code on a Home & Living cart) and create-order\'s dry run and real run', async () => {
  const realFetch = globalThis.fetch;
  const COUPON = { id: 'c1', code: 'TEN', type: 'percent', value: 10, max_discount: 0, min_order_value: 0, is_active: true, usage_limit: null, per_user_limit: null, starts_at: null, ends_at: null, first_order_only: false };
  globalThis.fetch = async (url) => {
    const table = String(url).split('/rest/v1/')[1].split('?')[0];
    const rows = table === 'catalogue_products' ? Object.values(HL) : table === 'catalogue_variants' ? HV.filter((x) => x.is_active) : table === 'coupons' ? [COUPON] : [];
    return { ok: true, status: 200, text: async () => JSON.stringify(rows), json: async () => rows };
  };
  try {
    const priced = await now.quote.priceCart([hl('h-sheet', 1, 'hv-king-ivory'), hl('h-towel', 1)], 'std', cfg);
    assert.ok(priced.ok, priced.error); assert.equal(priced.base.breakdown.itemTotal, 1199 + 799);
    const q = await now.quote.quoteCoupon('TEN', priced, 'std', { userId: null, hasPriorOrder: null }, cfg);
    assert.ok(q.ok, q.message); assert.equal(q.totals.breakdown.couponDiscount, 200); assert.equal(q.totals.total, 1998 - 200);
  } finally { globalThis.fetch = realFetch; }
  const order = read('api/razorpay/create-order.js');
  assert.match(order, /const \{ products, variantRows, fashionProductRows, fashionVariantRows, homeLivingProductRows, homeLivingVariantRows \} = await fetchCartRows\(parsed\.items, sb\);/);
  const calls = order.match(/computeOrderTotal\(parsed\.items, products, delivery, \{[\s\S]*?\}\);/g);
  assert.equal(calls.length, 2, 'the dry run and the real one');
  for (const c of calls) assert.match(c, /homeLivingProductRows,[\s\S]*homeLivingVariantRows/);
});

// ============================================================
console.log('\n— The browser: the line, the store, the payload —');
// ============================================================

const data = loadHomeLivingData({ initial: PDP });
const VIEWS = PDP_PRODUCTS.map(data.homelivingProductView);
const view = (slug) => VIEWS.find((p) => p.slug === slug);
const cache = loadModule('src/lib/catalogueCartCache.js', {});
const fetched = [];
const line = has('src/lib/homelivingCartLine.js')
  ? loadModule('src/lib/homelivingCartLine.js', { ...cache, homelivingProductView: data.homelivingProductView, getHomeLivingProductsByIds: async (ids) => { fetched.push(ids); return PDP_PRODUCTS.filter((p) => ids.includes(p.id)); } })
  : null;

await test('the store keeps a Home & Living line in its own namespace: keyed homeliving:<id>::<variantId>, never merged with the same id in another store', () => {
  const store = read('src/lib/store.jsx');
  const start = store.indexOf('function reducer(state, action) {'); const end = store.indexOf('\nexport function StoreProvider');
  const deps = {
    FASHION_CATALOGUE: 'fashion', fashionLineKey: (p, v) => `fashion:${p}::${v ?? ''}`,
    GROCERY_CATALOGUE: 'grocery', groceryLineKey: (p, v) => `grocery:${p}::${v ?? ''}`,
    HOMELIVING_CATALOGUE: line?.HOMELIVING_CATALOGUE, homelivingLineKey: line?.homelivingLineKey,
  };
  const reducer = new Function(...Object.keys(deps), `${store.slice(start, end)}\n; return reducer;`)(...Object.values(deps));
  const s = [
    { type: 'ADD', catalogue: 'homeliving', id: 'h1', qty: 1, variant: 'Single · Sage', variantId: 'v1' },
    { type: 'ADD', id: 'h1', qty: 1 },
    { type: 'ADD', catalogue: 'fashion', id: 'h1', qty: 1, variantId: 'v1' },
    { type: 'ADD', catalogue: 'grocery', id: 'h1', qty: 1 },
    { type: 'ADD', catalogue: 'homeliving', id: 'h1', qty: 2, variant: 'Single · Sage', variantId: 'v1' },
    { type: 'ADD', catalogue: 'homeliving', id: 'h2', qty: 1, variant: 'Pair · 140 × 213 cm', variantId: null },
  ].reduce((st, a) => reducer(st, a), { cart: [], saved: [] });
  assert.deepEqual(s.cart.map((l) => l.key), ['homeliving:h1::v1', 'h1', 'fashion:h1::v1', 'grocery:h1::', 'homeliving:h2::']);
  assert.deepEqual(s.cart[0], { key: 'homeliving:h1::v1', catalogue: 'homeliving', id: 'h1', variant: 'Single · Sage', variantId: 'v1', qty: 3 });
  assert.deepEqual(Object.keys(s.cart[1]), ['key', 'id', 'variant', 'variantId', 'qty'], 'the wellness line is the bare shape it always was');
});

await test('addHomeLivingToCart: an option is required when the product has options, stock is gated, and the line carries ids and a label — never a price', () => {
  const store = read('src/lib/store.jsx');
  const from = store.indexOf('const addHomeLivingToCart = useCallback(');
  assert.ok(from > 0, 'the add path exists');
  const body = store.slice(store.indexOf('(view, variant = null, qty = 1) =>', from), store.indexOf('}, [toast]);', from) + 1);
  const dispatched = []; const toasts = [];
  const add = new Function('dispatch', 'toast', 'HOMELIVING_CATALOGUE', `return ${body};`)((a) => dispatched.push(a), (m) => toasts.push(m), 'homeliving');
  const sheet = view('sage-fitted-sheet'); const curtain = view('linen-curtain-pair'); const towelSet = view('bath-towel-set-pack-of-2');
  assert.equal(add(sheet, null), false); assert.match(toasts.at(-1), /choose a size/i);
  assert.equal(add(sheet, sheet.variants.find((v) => v.size === 'King' && v.colour === 'Sage')), false); assert.match(toasts.at(-1), /out of stock/);
  assert.equal(add(curtain, null), false); assert.match(toasts.at(-1), /out of stock/);
  assert.equal(add(sheet, sheet.variants.find((v) => v.size === 'Single' && v.colour === 'Sage'), 2), true);
  assert.equal(add(towelSet, null), true);
  assert.deepEqual(dispatched, [
    { type: 'ADD', catalogue: 'homeliving', id: sheet.id, qty: 2, variant: 'Single · Sage', variantId: sheet.variants.find((v) => v.size === 'Single' && v.colour === 'Sage').id },
    { type: 'ADD', catalogue: 'homeliving', id: towelSet.id, qty: 1, variant: 'Pack of 2 · 70 × 140 cm', variantId: null },
  ]);
  assert.ok(dispatched.every((d) => !('price' in d) && !('unitPrice' in d)), 'no price on the line');
  const ctx = store.slice(store.indexOf('const value = {'));
  assert.match(ctx, /addGroceryToCart,\n\s+addHomeLivingToCart,/, 'exported to the components');
});

await test('a line hydrates against its own rows: pending until they land, priced like the PDP, purchasable — and blocked with a reason for every way it can go wrong', () => {
  const H = line.hydrateHomeLivingCartLine;
  const sheet = view('sage-fitted-sheet'); const towel = view('waffle-bath-towel'); const set = view('bath-towel-set-pack-of-2');
  const vOf = (p, size, colour = '') => p.variants.find((v) => v.size === size && (v.colour || '') === colour);
  const L = (p, variantId = null, qty = 1, extra = {}) => ({ key: 'k', catalogue: 'homeliving', id: p.id, variantId, variant: null, qty, ...extra });
  assert.equal(H(L(sheet), null, { resolved: false }).unavailableReason, 'Checking availability…');
  assert.equal(H(L(sheet), null, { resolved: true }), null, 'confirmed gone: pruned');
  const ok = H(L(sheet, vOf(sheet, 'Single', 'Sage').id, 2), sheet);
  assert.deepEqual([ok.purchasable, ok.unitPrice, ok.unitMrp, ok.lineTotal, ok.variantLabel, ok.product.href], [true, 999, 1299, 1998, 'Single · Sage', '/homeliving/p/sage-fitted-sheet']);
  const over = H(L(towel, vOf(towel, 'Hand').id), towel);
  assert.deepEqual([over.purchasable, over.unitPrice], [true, 349], 'a variant override is the price, as on the PDP');
  const plain = H(L(set), set);
  assert.deepEqual([plain.purchasable, plain.unitPrice, plain.variantLabel], [true, 799, 'Pack of 2 · 70 × 140 cm']);
  const reason = (l, v) => H(l, v).unavailableReason;
  assert.equal(reason(L(sheet, vOf(sheet, 'Single', 'Sage').id), { ...sheet, is_active: false }), 'This item is no longer available.');
  assert.equal(reason(L(sheet, 'gone', 1, { variant: 'King · Rust' }), sheet), '“King · Rust” is no longer available.');
  assert.equal(reason(L(sheet), sheet), 'Please choose a size for this item.');
  assert.equal(reason(L(set, 'v-x'), set), 'This item is no longer sold in that option.');
  assert.equal(reason(L(sheet, vOf(sheet, 'King', 'Sage').id), sheet), 'This option is out of stock.');
  assert.equal(reason(L(view('linen-curtain-pair')), view('linen-curtain-pair')), 'This item is out of stock.');
  assert.equal(reason(L(sheet, vOf(sheet, 'Single', 'Ivory').id, 3), sheet), 'Only 2 left — please reduce the quantity.');
  assert.equal(reason(L(set), { ...set, price: 0, mrp: 0 }), 'This item is not available to buy right now.');
});

await test('the rows load on demand into the shared cart cache, and only a product a fetch has confirmed gone is pruned', async () => {
  const sheet = view('sage-fitted-sheet');
  const lines = [{ key: 'a', catalogue: 'homeliving', id: sheet.id, variantId: null, qty: 1 }, { key: 'b', catalogue: 'homeliving', id: 'gone-id', variantId: null, qty: 1 }, { key: 'c', id: 'b183', qty: 1 }];
  assert.deepEqual(line.homelivingKeysToPrune(lines), [], 'nothing is pruned before a fetch has answered');
  await line.ensureHomeLivingProducts([sheet.id, 'gone-id']);
  assert.deepEqual(fetched.at(-1).sort(), [sheet.id, 'gone-id'].sort());
  assert.equal(line.homelivingEntryFor(sheet.id).slug, 'sage-fitted-sheet', 'the cache keeps the storefront view of the row');
  assert.deepEqual(line.homelivingKeysToPrune(lines), ['b']);
  const store = read('src/lib/store.jsx');
  assert.match(store, /homelivingKeysToPrune\(\[\.\.\.state\.cart, \.\.\.state\.saved\]\);\n\s+if \(keys\.length\) dispatch\(\{ type: 'PRUNE_MISSING', keys \}\);\n\s+\}, \[state\.cart, state\.saved, fashionVersion\]\);/, 'pruned when the rows land, not on the next cart change');
  assert.match(store, /\.filter\(\(l\) => !isFashionLine\(l\) && !isGroceryLine\(l\) && !isHomeLivingLine\(l\) && !productById\[l\.id\]\)/, 'the wellness prune never judges a Home & Living line');
});

await test('the browser sends ids and the marker for a Home & Living line to both endpoints — never a price', async () => {
  const api = loadModule('src/lib/couponApi.js', clientDeps(null));
  const hlLine = { key: 'homeliving:h1::v1', catalogue: 'homeliving', id: 'h1', qty: 2, variantId: 'v1', variant: 'Single · Sage', unitPrice: 999, lineTotal: 1998 };
  assert.deepEqual(api.cartToPayload([hlLine]), [{ id: 'h1', qty: 2, variantId: 'v1', variant: 'Single · Sage', catalogue: 'homeliving' }]);
  const sent = [];
  const pay = loadModule('src/lib/payments.js', clientDeps(async (url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({}) }; }));
  await pay.createPaymentOrder({ items: [hlLine], delivery: 'std', customer: {}, paymentMethod: 'online' });
  assert.deepEqual(sent[0].items, [{ id: 'h1', qty: 2, variantId: 'v1', variant: 'Single · Sage', catalogue: 'homeliving' }]);
});

// ============================================================
console.log('\n— The product page and the card —');
// ============================================================

const app = await buildHomeLivingApp({ initial: PDP }).catch((e) => ({ error: e }));
const strip = (html) => html.replace(/<svg[\s\S]*?<\/svg>/g, '');
const actions = (html) => strip(html.match(/<div class="hl-pdp__actions"[\s\S]*?<\/div>/)?.[0] || '');
const bar = (html) => strip(html.match(/<div class="hl-pdp__bar"[\s\S]*?<\/div>/)?.[0] || '');

await test('PDP: Add to cart sits in the reserved slot and in the phone bar, disabled until the choice is complete and in stock', () => {
  const r = (q) => app.render(`/homeliving/p/${q}`);
  const btn = (disabled, label, cls = '') => `<button type="button" class="hl-btn hl-add${cls}"${disabled ? ' disabled=""' : ''}> ${label}</button>`;
  assert.equal(actions(r('sage-fitted-sheet')), `<div class="hl-pdp__actions" data-slot="add-to-cart" data-can-add="no">${btn(true, 'Add to cart')}<button type="button" class="hl-card__heart hl-heart--inline" aria-label="Save Sage Fitted Sheet to wishlist" aria-disabled="true"></button></div>`);
  assert.match(actions(r('sage-fitted-sheet?size=Single&colour=Sage')), new RegExp(`data-can-add="yes">${btn(false, 'Add to cart')}`));
  assert.match(actions(r('sage-fitted-sheet?size=King&colour=Sage')), new RegExp(`data-can-add="no">${btn(true, 'Out of stock')}`));
  assert.match(actions(r('linen-curtain-pair')), new RegExp(`data-can-add="no">${btn(true, 'Out of stock')}`));
  assert.match(actions(r('bath-towel-set-pack-of-2')), new RegExp(`data-can-add="yes">${btn(false, 'Add to cart')}`));
  assert.equal(bar(r('sage-fitted-sheet?size=Single&colour=Sage')), `<div class="hl-pdp__bar" role="region" aria-label="Buy" data-slot="add-to-cart"><span class="hl-pdp__bar-price"><b><span class="hl-price__cur">₹</span>999</b><em>Single · Sage</em><span class="hl-pick__note is-in">In stock</span></span>${btn(false, 'Add to cart', ' hl-add--bar')}</div>`);
  assert.match(bar(r('waffle-bath-towel?size=Sheet')), new RegExp(btn(true, 'Out of stock', ' hl-add--bar')));
});

// The page and the card called as functions, with their hooks injected, so a
// click can be made without a DOM: find the element, call its handler.
const walk = (el, hit, out = []) => {
  if (Array.isArray(el)) { for (const c of el) walk(c, hit, out); return out; }
  if (!el || typeof el !== 'object') return out;
  if (hit(el)) out.push(el);
  walk(el.props?.children, hit, out);
  return out;
};
const rules = loadModule('src/lib/homelivingPdp.js', {});
const listing = has('src/lib/homelivingListing.js') ? loadModule('src/lib/homelivingListing.js', {}) : {};
const pageWith = (slug, query, recorded) => loadModule('src/homeliving/HomeLivingProductPage.jsx', {
  Link: (p) => React.createElement('a', p), Icon: () => null, money: (n) => `₹${n}`, Breadcrumb: () => null, HomeLivingProductCard: () => null,
  useParams: () => ({ slug }), useSearchParams: () => [new URLSearchParams(query), () => {}], useMemo: (f) => f(),
  useHomeLivingCatalogue: () => ({ status: 'ready', categories: PDP.categories, products: VIEWS }),
  HOMELIVING_DELIVERY_WINDOW: '6-7 days', breadcrumbFor: listing.breadcrumbFor || (() => []), ...rules,
  useStore: () => ({ addHomeLivingToCart: (...args) => { recorded.push(args); return true; } }),
});

await test('PDP: the click adds the chosen size × colour — and nothing while the button is disabled', () => {
  const rec = [];
  const mod = pageWith('sage-fitted-sheet', 'size=King&colour=Ivory', rec);
  const tree = mod.default();
  const buttons = walk(tree, (el) => el.type === mod.AddToCartButton);
  assert.equal(buttons.length, 2, 'the action row and the phone bar');
  buttons[0].props.onAdd();
  const sheet = view('sage-fitted-sheet');
  assert.deepEqual(rec.map(([v, variant, qty]) => [v.id, variant.id, qty]), [[sheet.id, sheet.variants.find((x) => x.size === 'King' && x.colour === 'Ivory').id, 1]]);
  const off = mod.AddToCartButton({ st: { canAdd: false, status: 'choose' }, onAdd: () => rec.push('no') });
  assert.equal(off.props.disabled, true); assert.equal(off.props.onClick, undefined, 'a disabled button carries no handler at all');
  const plain = pageWith('bath-towel-set-pack-of-2', '', rec).default();
  walk(plain, (el) => el.props?.onAdd && el.props.className !== 'hl-add--bar')[0].props.onAdd();
  assert.deepEqual(rec.at(-1).slice(1), [null, 1], 'a product without options adds with no variant');
});

await test('card: a product without options is added from the card (out of stock: disabled); one with options links to its page to choose', () => {
  const html = app.render('/homeliving/category/bedsheets');
  assert.match(strip(html), /<a class="hl-btn hl-add hl-card__add hl-card__add--choose" href="\/homeliving\/p\/sage-fitted-sheet">Choose options<\/a>/);
  assert.match(strip(html), /<button type="button" class="hl-btn hl-add hl-card__add"> Add to cart<\/button>/);
  const rec = [];
  const card = loadModule('src/homeliving/HomeLivingProductCard.jsx', { Link: (p) => React.createElement('a', p), Icon: () => null, money: (n) => `₹${n}`, useStore: () => ({ addHomeLivingToCart: (...a) => { rec.push(a); return true; } }) });
  const set = view('bath-towel-set-pack-of-2');
  walk(card.default({ product: set }), (el) => el.type === 'button' && /hl-card__add/.test(el.props.className))[0].props.onClick();
  assert.deepEqual(rec.map(([p, v, q]) => [p.id, v, q]), [[set.id, null, 1]]);
  const out = walk(card.default({ product: view('linen-curtain-pair') }), (el) => el.type === 'button' && /hl-card__add/.test(el.props.className))[0];
  assert.equal(out.props.disabled, true); assert.equal(out.props.onClick, undefined); assert.equal(renderToStaticMarkup(out), '<button type="button" class="hl-btn hl-add hl-card__add" disabled="">Out of stock</button>');
  const choose = walk(card.default({ product: view('sage-fitted-sheet') }), (el) => /hl-card__add--choose/.test(el.props?.className || ''))[0];
  assert.equal(choose.props.to, '/homeliving/p/sage-fitted-sheet');
});

await test('nothing left saying this store cannot sell: no "no cart namespace", "shows and does not sell" or "no cart path" in its source', () => {
  for (const rel of ['src/homeliving/HomeLivingProductCard.jsx', 'src/homeliving/HomeLivingProductPage.jsx', 'src/lib/homelivingPdp.js', 'src/data/homelivingHomepage.js']) {
    assert.doesNotMatch(read(rel), /no cart namespace|does not sell|no cart path|There is no Add|until the cart is next opened/i, rel);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
