// ============================================================
// Fashion store, Phase 2 — cart + PDP. Offline suite.
//
// The server pricing path with fashion lines (api/_lib/pricing.js), the
// wellness path proven byte-identical against the pre-change module, the
// client hydration (fashionCartLine.js) and the store's wiring, the
// payload the browser sends, and the product page rendered through the
// real router. NO NETWORK, NO DATABASE, NO ORDER.
//
//   node scripts/test-fashion-cart.mjs
//   FASHION_SRC_ROOT=<pre-change checkout> node scripts/test-fashion-cart.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ROOT, read, h, buildFashionApp, loadModule, PRODUCTS, CATEGORIES } from './fashion-ssr.mjs';

let passed = 0, failed = 0, current = '(startup)';
process.on('unhandledRejection', (e) => { console.error(`\n  FATAL during: ${current}\n  ${e?.stack || e}`); process.exitCode = 1; });
async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
console.log(`\nsource root: ${ROOT}`);

// The pricing module under test, and the one that shipped before this phase.
const BASELINE_SHA = 'bda8f9f';
let pricing = null; let baseline = null;
try { pricing = await import(pathToFileURL(resolve(ROOT, 'api/_lib/pricing.js')).href); } catch { pricing = null; }
{
  const dir = mkdtempSync(join(tmpdir(), 'sora-pricing-'));
  // Read from THIS repo whatever ROOT points at: the pre-change run reads
  // sources from an exported tree that is not a git checkout.
  const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
  for (const f of ['pricing.js', 'tax.js']) writeFileSync(join(dir, f), execFileSync('git', ['show', `${BASELINE_SHA}:api/_lib/${f}`], { cwd: REPO, encoding: 'utf8' }));
  baseline = await import(pathToFileURL(join(dir, 'pricing.js')).href);
}

// ---- trusted rows, as they come from the tables --------------------------------
const WELLNESS_ROWS = [
  { id: 2, biosash_id: 'b183', name: 'Beard Cream', original_price: 295, discount_percent: 20, sale_price: 236, is_active: true, stock: true, gst_rate: null },
  { id: 3, biosash_id: 'b185', name: 'Beard Wash', original_price: 225, discount_percent: 15, sale_price: 191, is_active: true, stock: true, gst_rate: null },
  { id: 7, biosash_id: 'b777', name: 'Juice', original_price: 500, discount_percent: 0, sale_price: null, is_active: true, stock: true, gst_rate: null },
];
const WELLNESS_VARIANTS = [
  { id: 'v750', product_id: 7, label: '750 ml', sku: 'J-750', mrp: 900, sale_price: 810, gst_rate: 5, stock: 6, is_active: true },
  { id: 'v250', product_id: 7, label: '250 ml', sku: 'J-250', mrp: 400, sale_price: null, gst_rate: null, stock: 0, is_active: true },
];
const SHIRT = PRODUCTS[0]; const SNEAKERS = PRODUCTS[2];
const F_PRODUCTS = PRODUCTS.map(({ fashion_variants, ...p }) => p);
const F_VARIANTS = PRODUCTS.flatMap((p) => p.fashion_variants);
const vid = (product, size, colour) => product.fashion_variants.find((v) => v.size === size && v.colour === colour).id;
const M_NAVY = vid(SHIRT, 'M', 'Navy'); const M_SAGE = vid(SHIRT, 'M', 'Sage'); const UK8_FOREST = vid(SNEAKERS, 'UK 8', 'Forest');
const TAX = { mode: 'inclusive', rate: 18, cgstSgstThresholdState: null };
const opts = (extra = {}) => ({ variantRows: WELLNESS_VARIANTS, fashionProductRows: F_PRODUCTS, fashionVariantRows: F_VARIANTS, taxConfig: TAX, ...extra });
const price = (items, delivery = 'std', extra = {}) => {
  const v = pricing.validateCartPayload(items); if (!v.ok) return v;
  return pricing.computeOrderTotal(v.items, WELLNESS_ROWS, delivery, opts(extra));
};

// ============================================================
console.log('\n— Server pricing —');
// ============================================================

await test('wellness-only carts price byte-for-byte as they did before this phase', () => {
  assert.ok(pricing, 'api/_lib/pricing.js loads');
  const carts = [
    [[{ id: 'b183', qty: 2 }], 'std', {}],
    [[{ id: 'b183', qty: 1 }, { id: 'b185', qty: 3 }], 'exp', {}],
    [[{ id: 'b777', qty: 2, variantId: 'v750', variant: '750 ml' }], 'sched', {}],
    [[{ id: 'b183', qty: 1 }, { id: 'b777', qty: 1, variantId: 'v750' }], 'std', { coupon: { code: 'TEN', type: 'percent', value: 10, max_discount: 0, min_order_value: 0, is_active: true } }],
    [[{ id: 'b185', qty: 4 }], 'std', { coupon: { code: 'FLAT50', type: 'flat', value: 50, min_order_value: 100, is_active: true }, buyerState: 'Punjab' }],
    [[{ id: 'b777', qty: 1, variantId: 'v250' }], 'std', {}],          // out of stock → refused
    [[{ id: 'b777', qty: 9, variantId: 'v750' }], 'std', {}],          // over stock → refused
    [[{ id: 'nope', qty: 1 }], 'std', {}],                              // unknown → refused
    [[{ id: 'b183', qty: 1, price: 1, amount: 1 }], 'exp', {}],         // smuggled figures ignored
  ];
  for (const [items, delivery, extra] of carts) {
    const before = baseline.computeOrderTotal(baseline.validateCartPayload(items).items, WELLNESS_ROWS, delivery, { variantRows: WELLNESS_VARIANTS, taxConfig: TAX, ...extra });
    const after = pricing.computeOrderTotal(pricing.validateCartPayload(items).items, WELLNESS_ROWS, delivery, { variantRows: WELLNESS_VARIANTS, taxConfig: TAX, ...extra });
    assert.equal(JSON.stringify(after), JSON.stringify(before), `identical for ${JSON.stringify(items)} / ${delivery}`);
    // and with the fashion row lists present but empty — the production shape for a wellness cart
    const afterEmpty = pricing.computeOrderTotal(pricing.validateCartPayload(items).items, WELLNESS_ROWS, delivery, { variantRows: WELLNESS_VARIANTS, fashionProductRows: [], fashionVariantRows: [], taxConfig: TAX, ...extra });
    assert.equal(JSON.stringify(afterEmpty), JSON.stringify(before));
  }
  assert.equal(JSON.stringify(pricing.validateCartPayload([{ id: 'b183', qty: 2, variantId: 'v750', variant: 'x' }])), JSON.stringify(baseline.validateCartPayload([{ id: 'b183', qty: 2, variantId: 'v750', variant: 'x' }])), 'a wellness payload validates to the same items');
});

await test('a fashion-only cart prices from the fashion tables: override, then sale price, then MRP', () => {
  const t = price([{ catalogue: 'fashion', id: SHIRT.id, qty: 2, variantId: M_NAVY }, { catalogue: 'fashion', id: SNEAKERS.id, qty: 1, variantId: UK8_FOREST }]);
  assert.equal(t.ok, true, t.error);
  assert.deepEqual(t.lines.map((l) => [l.catalogue, l.name, l.variant, l.unit_price, l.unit_mrp, l.qty, l.line_total, l.sku]), [
    ['fashion', SHIRT.name, 'M · Navy', 1099, 1999, 2, 2198, 'AW-MLS-M-NAVY'],
    ['fashion', SNEAKERS.name, 'UK 8 · Forest', 1099, 2499, 1, 1099, 'NS-CMS-8-FOR'],
  ]);
  assert.equal(t.lines[0].product_id, SHIRT.id); assert.equal(t.lines[0].variant_id, M_NAVY); assert.equal(t.lines[0].biosash_id, null);
  assert.equal(t.subtotal, 3297); assert.equal(t.shipping, 0); assert.equal(t.total, 3297); assert.equal(t.amountPaise, 329700);
  assert.equal(t.breakdown.mrpTotal, 3998 + 2499); assert.equal(t.breakdown.productDiscount, 6497 - 3297);
  const mrpOnly = pricing.trustedFashionPrice({ mrp: 1500, sale_price: null }, { size: 'S', colour: 'Red' });
  assert.deepEqual(mrpOnly, { price: 1500, mrp: 1500, sku: null, label: 'S · Red' });
  assert.equal(pricing.trustedFashionPrice({ mrp: 0, sale_price: null }, { size: 'S', colour: 'Red' }), null, 'nothing priced → refused, never ₹0');
  assert.equal(pricing.trustedFashionPrice({ mrp: 1500, sale_price: 1200 }, { price_override: 0 }).price, 1200, 'a zero override is no override');
});

await test('a mixed cart prices both catalogues and checks out as one order', () => {
  const t = price([{ id: 'b183', qty: 2 }, { catalogue: 'fashion', id: SHIRT.id, qty: 1, variantId: M_NAVY }, { id: 'b777', qty: 1, variantId: 'v750' }], 'exp');
  assert.equal(t.ok, true, t.error);
  assert.deepEqual(t.lines.map((l) => [l.catalogue ?? 'wellness', l.line_total]), [['wellness', 472], ['fashion', 1099], ['wellness', 810]]);
  assert.equal(t.subtotal, 2381); assert.equal(t.shipping, 79); assert.equal(t.total, 2460); assert.equal(t.amountPaise, 246000);
  assert.equal(t.lines.length, 3, 'one order, three lines');
  assert.ok(t.lines.every((l) => Number.isFinite(l.taxable_value)), 'tax is apportioned across both catalogues');
});

await test('a coupon on a mixed cart: the quote figure and the order figure are the same computation', () => {
  const items = [{ id: 'b183', qty: 2 }, { catalogue: 'fashion', id: SHIRT.id, qty: 1, variantId: M_NAVY }];
  const coupon = { code: 'TEN', type: 'percent', value: 10, max_discount: 0, min_order_value: 0, is_active: true };
  const dryRun = price(items, 'std');                       // what create-order judges the coupon against
  const quoted = price(items, 'std', { coupon });           // what /api/coupons/quote shows
  const charged = price(items, 'std', { coupon });          // what create-order charges
  assert.equal(dryRun.breakdown.itemTotal, 1571);
  assert.equal(quoted.breakdown.couponDiscount, pricing.computeCouponDiscount(coupon, dryRun.breakdown.itemTotal), 'judged against the goods value, whole rupees');
  assert.equal(quoted.breakdown.couponDiscount, 157);
  assert.equal(JSON.stringify(quoted), JSON.stringify(charged));
  assert.equal(charged.total, 1571 - 157); assert.equal(charged.amountPaise, 141400);
  assert.equal(JSON.stringify(quoted.breakdown.coupon), JSON.stringify({ code: 'TEN', discount: 157 }));
});

await test('a fashion line is refused — never dropped — when its variant is out of stock, over-ordered, gone, inactive or unchosen', () => {
  const r = (items, rows = {}) => pricing.computeOrderTotal(pricing.validateCartPayload(items).items, WELLNESS_ROWS, 'std', opts(rows));
  assert.deepEqual(r([{ catalogue: 'fashion', id: SHIRT.id, qty: 1, variantId: M_SAGE }]), { ok: false, error: `"${SHIRT.name} (M · Sage)" is out of stock.` });
  assert.deepEqual(r([{ catalogue: 'fashion', id: SHIRT.id, qty: 9, variantId: M_NAVY }]), { ok: false, error: `Only 8 of "${SHIRT.name} (M · Navy)" are left.` });
  assert.deepEqual(r([{ catalogue: 'fashion', id: SHIRT.id, qty: 1, variantId: '00000000-0000-4000-8000-000000009999' }]), { ok: false, error: `The chosen size and colour of "${SHIRT.name}" is no longer available.` });
  assert.deepEqual(r([{ catalogue: 'fashion', id: SHIRT.id, qty: 1, variantId: UK8_FOREST }]), { ok: false, error: 'The selected size does not match the product.' });
  assert.deepEqual(r([{ catalogue: 'fashion', id: SHIRT.id, qty: 1 }]), { ok: false, error: `Please choose a size and colour for "${SHIRT.name}".` });
  assert.deepEqual(r([{ catalogue: 'fashion', id: '00000000-0000-4000-8000-000000000999', qty: 1, variantId: M_NAVY }]), { ok: false, error: 'One or more items are no longer available.' });
  assert.deepEqual(r([{ catalogue: 'fashion', id: SHIRT.id, qty: 1, variantId: M_NAVY }], { fashionProductRows: F_PRODUCTS.map((p) => (p.id === SHIRT.id ? { ...p, is_active: false } : p)) }), { ok: false, error: `"${SHIRT.name}" is no longer available.` });
  assert.deepEqual(r([{ catalogue: 'fashion', id: SHIRT.id, qty: 1, variantId: M_NAVY }], { fashionVariantRows: F_VARIANTS.map((v) => (v.id === M_NAVY ? { ...v, is_active: false } : v)) }), { ok: false, error: `The chosen size and colour of "${SHIRT.name}" is no longer available.` });
  // A wellness item beside it does not rescue the order: the whole cart is refused with the reason.
  const mixed = r([{ id: 'b183', qty: 1 }, { catalogue: 'fashion', id: SHIRT.id, qty: 1, variantId: M_SAGE }]);
  assert.equal(mixed.ok, false); assert.match(mixed.error, /is out of stock/);
});

await test('a price that changed between add and checkout is charged at the server\'s figure; nothing the browser sends is a price', () => {
  const items = [{ catalogue: 'fashion', id: SHIRT.id, qty: 1, variantId: M_NAVY, price: 1, unit_price: 1, amount: 1, variant: '₹1 special' }];
  const before = price(items); assert.equal(before.total, 1099);
  const repriced = pricing.computeOrderTotal(pricing.validateCartPayload(items).items, WELLNESS_ROWS, 'std', opts({ fashionProductRows: F_PRODUCTS.map((p) => (p.id === SHIRT.id ? { ...p, sale_price: 1299 } : p)) }));
  assert.equal(repriced.total, 1299, 'the row wins');
  assert.equal(repriced.lines[0].variant, 'M · Navy', 'the label is the row\'s, not the browser\'s');
  const overridden = pricing.computeOrderTotal(pricing.validateCartPayload(items).items, WELLNESS_ROWS, 'std', opts({ fashionVariantRows: F_VARIANTS.map((v) => (v.id === M_NAVY ? { ...v, price_override: 899 } : v)) }));
  assert.equal(overridden.total, 899, 'a variant override wins over the sale price');
  assert.ok(!('price' in pricing.validateCartPayload(items).items[0]), 'validateCartPayload strips every price-shaped field');
});

await test('the payload marks the catalogue and the two never merge or masquerade', () => {
  const v = pricing.validateCartPayload([{ id: 'b183', qty: 1, catalogue: 'fashion' }, { id: 'b183', qty: 2 }, { id: 'x', qty: 1, catalogue: 'wellness' }, { id: 'y', qty: 1, catalogue: { $ne: 1 } }]);
  assert.equal(v.ok, true);
  assert.deepEqual(v.items.map((i) => [i.id, i.qty, i.catalogue ?? null]), [['b183', 1, 'fashion'], ['b183', 2, null], ['x', 1, null], ['y', 1, null]], 'only the literal "fashion" is a catalogue; the same id in two catalogues stays two lines');
  const n = pricing.normalizeCartLines([{ catalogue: 'fashion', id: 'p', qty: 1, variantId: 'v' }, { catalogue: 'fashion', id: 'p', qty: 2, variantId: 'v' }, { id: 'p', qty: 1, variantId: 'v' }]);
  assert.deepEqual(n.items.map((i) => [i.catalogue ?? null, i.qty]), [['fashion', 3], [null, 1]], 'same fashion variant twice merges; the wellness twin does not');
  assert.equal(pricing.normalizeCartLines([{ catalogue: 'fashion', id: 'p', qty: 15, variantId: 'v' }, { catalogue: 'fashion', id: 'p', qty: 15, variantId: 'v' }]).ok, false, 'the per-line cap holds for the merged fashion quantity');
});

await test('both endpoints fetch both catalogues through one path, and the fashion fetchers exist', () => {
  const admin = read('api/_lib/supabaseAdmin.js');
  for (const fn of ['fetchFashionProductsForCart', 'fetchFashionVariantsForCart', 'fetchCartRows']) assert.match(admin, new RegExp(`export async function ${fn}\\(`));
  assert.match(admin, /const select = 'id,name,slug,mrp,sale_price,is_active';[\s\S]*?fashion_products\?select=\$\{select\}&id=in\./);
  assert.match(admin, /const select = 'id,product_id,size,colour,colour_hex,sku,stock,price_override,is_active';[\s\S]*?fashion_variants\?select=\$\{select\}&id=in\./);
  assert.match(admin, /wellness\.length \? fetchProductsForCart\(wellness\.map\(\(i\) => i\.id\), cfg\) : Promise\.resolve\(\[\]\)/, 'a wellness id never reaches the fashion tables and a fashion id never reaches products');
  const create = read('api/razorpay/create-order.js');
  assert.match(create, /const \{ products, variantRows, fashionProductRows, fashionVariantRows \} = await fetchCartRows\(parsed\.items, sb\);/);
  assert.match(create, /variantRows, fashionProductRows, fashionVariantRows, taxConfig: getTaxConfig\(\), buyerState,/, 'the coupon dry run sees fashion rows');
  assert.match(create, /variantRows,\n\s+fashionProductRows,\n\s+fashionVariantRows,\n\s+coupon,/, 'the charged total sees fashion rows');
  assert.doesNotMatch(create, /fetchProductsForCart|fetchVariantsForCart/, 'no second, wellness-only fetch left behind');
  const quote = read('api/_lib/couponQuote.js');
  assert.match(quote, /await fetchCartRows\(parsed\.items, sb\)/);
  assert.match(quote, /fashionProductRows,\n\s+fashionVariantRows,\n\s+taxConfig/);
  // The rule that governs this run: nothing in the client computes a price.
  for (const f of ['src/fashion/FashionProductPage.jsx', 'src/fashion/FashionProductCard.jsx', 'src/fashion/FashionVariantPicker.jsx', 'src/lib/fashionPdp.js']) {
    // Code only: comments and string/className literals (fs-price--lg, bar-price) are not arithmetic.
    const c = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/"[^"\n]*"|'[^'\n]*'/g, '""');
    assert.doesNotMatch(c, /\bprice\s*[*\/+-]\s*[\w(]|\)\s*[*\/+-]\s*price\b|[\w)]\s*[*\/]\s*price\b|\(1\s*-\s*discount|discount\s*\/\s*100/, `${f} does no price arithmetic`);
  }
});

// ============================================================
console.log('\n— Client cart —');
// ============================================================

let fcl = null;
try { fcl = loadModule('src/lib/fashionCartLine.js', { getFashionProductsByIds: async () => [] }); } catch { fcl = null; }

await test('a stored fashion line hydrates against the fashion rows — priced, labelled, linked to /fashion — and pending until they load', () => {
  assert.ok(fcl, 'src/lib/fashionCartLine.js exists');
  const line = { key: fcl.fashionLineKey(SHIRT.id, M_NAVY), catalogue: 'fashion', id: SHIRT.id, variantId: M_NAVY, variant: 'M · Navy', qty: 2 };
  assert.equal(line.key, `fashion:${SHIRT.id}::${M_NAVY}`);
  const pending = fcl.hydrateFashionCartLine(line, null, { resolved: false });
  assert.equal(pending.pending, true); assert.equal(pending.purchasable, false); assert.equal(pending.unavailableReason, 'Checking availability…');
  assert.equal(pending.qty, 2, 'still counts toward the badge'); assert.equal(pending.lineTotal, 0); assert.equal(pending.unitPrice, null);
  assert.equal(fcl.hydrateFashionCartLine(line, null, { resolved: true }), null, 'a product a fetch confirmed gone is dropped');
  const entry = { row: { ...SHIRT }, variants: SHIRT.fashion_variants };
  const live = fcl.hydrateFashionCartLine(line, entry, { resolved: true });
  assert.equal(live.purchasable, true); assert.equal(live.unitPrice, 1099); assert.equal(live.unitMrp, 1999); assert.equal(live.lineTotal, 2198);
  assert.equal(live.variantLabel, 'M · Navy'); assert.equal(live.variantStock, 8); assert.equal(live.variantObj.colour_hex, '#2F3A56');
  assert.equal(live.product.href, '/fashion/p/meadow-linen-shirt-sage'); assert.equal(live.product.image, '/img/demo-mens-shirt.webp'); assert.equal(live.product.cardImage, '/img/demo-mens-shirt.webp');
  assert.equal(live.product.name, SHIRT.name); assert.equal(live.product.form, null);
  const sage = fcl.hydrateFashionCartLine({ ...line, variantId: M_SAGE, key: fcl.fashionLineKey(SHIRT.id, M_SAGE) }, entry, { resolved: true });
  assert.equal(sage.purchasable, false); assert.equal(sage.unavailableReason, 'This size and colour is out of stock.');
  const over = fcl.hydrateFashionCartLine({ ...line, qty: 9 }, entry, { resolved: true });
  assert.equal(over.unavailableReason, 'Only 8 left — please reduce the quantity.');
  const gone = fcl.hydrateFashionCartLine({ ...line, variantId: 'nope' }, entry, { resolved: true });
  assert.equal(gone.variantMissing, true); assert.equal(gone.unitPrice, null); assert.match(gone.unavailableReason, /no longer available/);
  const overridden = fcl.hydrateFashionCartLine({ key: 'k', catalogue: 'fashion', id: SNEAKERS.id, variantId: UK8_FOREST, qty: 1 }, { row: SNEAKERS, variants: SNEAKERS.fashion_variants }, { resolved: true });
  assert.equal(overridden.unitPrice, 1099, 'the variant override, as the server will charge');
  const inactive = fcl.hydrateFashionCartLine(line, { row: { ...SHIRT, is_active: false }, variants: SHIRT.fashion_variants }, { resolved: true });
  assert.equal(inactive.unavailableReason, 'This item is no longer available.');
});

await test('the cache resolves ids on demand, and only a confirmed-gone product is pruned', async () => {
  let calls = [];
  const mod = loadModule('src/lib/fashionCartLine.js', { getFashionProductsByIds: async (ids) => { calls.push(ids); return PRODUCTS.filter((p) => ids.includes(p.id)); } });
  const lines = [
    { key: mod.fashionLineKey(SHIRT.id, M_NAVY), catalogue: 'fashion', id: SHIRT.id, variantId: M_NAVY, qty: 1 },
    { key: mod.fashionLineKey('00000000-0000-4000-8000-000000000999', 'x'), catalogue: 'fashion', id: '00000000-0000-4000-8000-000000000999', variantId: 'x', qty: 1 },
    { key: 'b183', id: 'b183', qty: 1 },
  ];
  assert.deepEqual(mod.fashionKeysToPrune(lines), [], 'nothing is pruned before a fetch has answered');
  await mod.ensureFashionProducts(lines.filter(mod.isFashionLine).map((l) => l.id));
  assert.equal(calls.length, 1); assert.deepEqual(calls[0].sort(), [SHIRT.id, '00000000-0000-4000-8000-000000000999'].sort());
  assert.ok(mod.fashionRowFor(SHIRT.id)); assert.equal(mod.fashionRowFor('00000000-0000-4000-8000-000000000999'), null);
  assert.deepEqual(mod.fashionKeysToPrune(lines), [lines[1].key], 'the gone product, and only it; the wellness line is not this module\'s business');
  await mod.ensureFashionProducts([SHIRT.id]);
  assert.equal(calls.length, 1, 'a resolved id is not fetched again');
  const failing = loadModule('src/lib/fashionCartLine.js', { getFashionProductsByIds: async () => { throw new Error('offline'); } });
  await failing.ensureFashionProducts([SHIRT.id]);
  assert.equal(failing.isFashionIdResolved(SHIRT.id), false, 'a network failure leaves the line pending, never pruned');
  assert.deepEqual(failing.fashionKeysToPrune(lines), []);
});

await test('the store keeps wellness lines exactly as before and gives fashion lines their own namespace, hydration and reconciliation', () => {
  const store = read('src/lib/store.jsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(store, /const \{ id, qty = 1, variant = null, variantId = null, catalogue = null \} = action;/);
  assert.match(store, /: id \+ \(variantId \? '::' \+ variantId : variant \? '::' \+ variant : ''\);/, 'the wellness key is the old expression');
  // The grocery store (a later phase) sits between the two branches; the wellness line is still the bare shape.
  assert.match(store, /fashion \? \{ key, catalogue: FASHION_CATALOGUE, id, variant, variantId, qty \}\s*: grocery \? \{ key, catalogue: GROCERY_CATALOGUE, id, variant, variantId, qty \}\s*: \{ key, id, variant, variantId, qty \}/, 'a wellness line has no catalogue field');
  assert.match(store, /const hydrate = \(l\) => \(isFashionLine\(l\)\s*\? hydrateFashionCartLine\(l, fashionRowFor\(l\.id\), \{ resolved: isFashionIdResolved\(l\.id\) \}\)\s*: isGroceryLine\(l\) \? hydrateGroceryCartLine\(l, groceryProductFor\(l\.id\)\)\s*: hydrateCartLine\(l, productById\[l\.id\]\)\);/);
  assert.match(store, /\.filter\(\(l\) => !isFashionLine\(l\) && !isGroceryLine\(l\) && !productById\[l\.id\]\)/, 'the wellness prune never judges a fashion line');
  assert.match(store, /const keys = fashionKeysToPrune\(\[\.\.\.state\.cart, \.\.\.state\.saved\]\);/);
  assert.match(store, /const addFashionToCart = useCallback\(\(view, variant, qty = 1\) => \{/);
  assert.match(store, /dispatch\(\{ type: 'ADD', catalogue: FASHION_CATALOGUE, id: String\(view\.id\), qty, variant: label, variantId: String\(variant\.id\) \}\);/);
  assert.match(store, /addToCart,\n\s+addFashionToCart,/);
  assert.match(store, /\[state\.cart, catalogVersion, fashionVersion\]/, 'the fashion rows invalidate the memo like the wellness ones');
  // Persisted shape: the line object is stored whole, so the catalogue marker survives a reload.
  const persist = read('src/lib/wishlistState.js');
  assert.match(persist, /PERSISTED_KEYS/); assert.match(persist, /'cart'/);
});

await test('the browser sends ids and the catalogue — never a price — for both endpoints; a wellness payload is unchanged', () => {
  const api = loadModule('src/lib/couponApi.js', { supabase: {}, getVisitorId: () => 'v' });
  const lines = [{ id: 'b183', qty: 2, variantId: null, variant: null }, { key: 'k', catalogue: 'fashion', id: SHIRT.id, qty: 1, variantId: M_NAVY, variant: 'M · Navy', unitPrice: 1099, lineTotal: 1099 }];
  assert.deepEqual(api.cartToPayload(lines), [{ id: 'b183', qty: 2, variantId: null, variant: null }, { id: SHIRT.id, qty: 1, variantId: M_NAVY, variant: 'M · Navy', catalogue: 'fashion' }]);
  assert.deepEqual(Object.keys(api.cartToPayload(lines)[0]), ['id', 'qty', 'variantId', 'variant'], 'a wellness item has exactly the keys it always had');
  const pay = read('src/lib/payments.js');
  assert.match(pay, /variant: l\.variant \|\| null,\n\s+\.\.\.\(l\.catalogue === 'fashion' \? \{ catalogue: 'fashion' \} : \{\}\),/);
  assert.doesNotMatch(pay, /unitPrice|lineTotal|price:/, 'create-order is never sent a price');
});

// ============================================================
console.log('\n— The product page —');
// ============================================================

const app = await buildFashionApp({ cartCount: 1 }).catch((e) => ({ error: e }));
const SLUG = '/fashion/p/meadow-linen-shirt-sage';

await test('gallery, brand, name, rating, price row, both selectors, delivery rules, description, details, related, sticky bar', () => {
  assert.ok(!app.error, app.error?.message);
  const html = app.render(SLUG);
  assert.match(html, /class="fs-gallery"[\s\S]*?<figure class="fs-gallery__slide is-on"[\s\S]*?<img src="\/img\/demo-mens-shirt\.webp" alt="Meadow Linen Shirt — Sage"[^>]*fetchpriority="high"/);
  assert.match(html, /<p class="fs-pdp__brand">Aurelia Wear<\/p>/);
  assert.match(html, /<h1 class="fs-pdp__h serif">Meadow Linen Shirt — Sage<\/h1>/);
  assert.match(html, /<p class="fs-rating"><b>4\.4<\/b>[\s\S]*?\(812 reviews\)/);
  assert.match(html, /<p class="fs-price fs-price--lg" data-price="1099"><strong><span class="fs-price__cur">₹<\/span>1,099<\/strong><span class="fs-price__mrp">M\.R\.P: <s>₹1,999<\/s><\/span><span class="fs-badge">45% OFF<\/span><\/p>/);
  assert.match(html, /<legend>Colour<\/legend>/); assert.match(html, /<legend>Size<\/legend>/);
  assert.deepEqual([...html.matchAll(/class="fs-pick__swatch[^"]*" style="--sw:([^"]+)"/g)].map((m) => m[1]), ['#8A9A6B', '#2F3A56', '#EDE6D6', '#B4552E', '#1B1B1B'], 'swatches use colour_hex');
  assert.deepEqual([...html.matchAll(/class="fs-pick__size[^"]*"[^>]*>([^<]+)</g)].map((m) => m[1]), ['S', 'M', 'L', 'XL'], 'every size is listed');
  assert.match(html, /Delivery[\s\S]*?Standard<em>3–5 business days<\/em><\/span><b>Free<\/b>[\s\S]*?Express[\s\S]*?<b>₹79<\/b>[\s\S]*?Scheduled[\s\S]*?<b>₹49<\/b>/, 'the real shipping rules');
  assert.match(html, /About this style[\s\S]*?A breathable linen-blend shirt/);
  assert.match(html, /<dt>Category<\/dt><dd>Clothing › Men › Shirts<\/dd>/);
  const related = html.slice(html.indexOf('You may also like'));
  const cards = [...related.matchAll(/data-product="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(cards.length >= 1 && cards.length <= 4 && !cards.includes('meadow-linen-shirt-sage'), 'related styles, never itself');
  assert.match(html, /<div class="fs-pdp__bar" role="region" aria-label="Buy">/);
  const noDesc = app.render(SLUG, { categories: CATEGORIES, products: PRODUCTS.map((p) => ({ ...p, description: '' })) });
  assert.doesNotMatch(noDesc, /About this style/, 'an empty section hides');
});

await test('per-combination stock on the page: M/Sage out, M/Navy in, M/Rust low, XL/Navy not made — sizes disabled, not hidden', () => {
  const sage = app.render(`${SLUG}?size=M&colour=Sage`);
  assert.match(sage, /<p class="fs-pick__note is-out" role="status">Out of stock in this size and colour<\/p>/);
  assert.match(sage, /class="fs-btn fs-btn--add" disabled="" data-can-add="no">[\s\S]*?Out of stock</);
  const navy = app.render(`${SLUG}?size=M&colour=Navy`);
  assert.match(navy, /<p class="fs-pick__note is-in" role="status">In stock<\/p>/);
  assert.match(navy, /class="fs-btn fs-btn--add" data-can-add="yes">[\s\S]*?Add to cart</);
  assert.match(navy, /class="fs-btn fs-btn--buy">Buy now<\/button>/);
  assert.match(navy, /class="fs-pick__swatch is-on" style="--sw:#2F3A56"/);
  assert.match(navy, /class="fs-pick__size is-on" aria-pressed="true" aria-label="M"/);
  assert.match(navy, /class="fs-pick__size is-out" aria-pressed="false" disabled="" aria-label="XL — out of stock"/, 'XL is not made in Navy: disabled, still listed');
  assert.match(navy, /<p class="fs-pdp__tax">/);
  const rust = app.render(`${SLUG}?size=M&colour=Rust`);
  assert.match(rust, /<p class="fs-pick__note is-low" role="status">Only 2 left<\/p>/);
  assert.match(rust, /data-can-add="yes"/);
  const sizeOnly = app.render(`${SLUG}?size=M`);
  assert.match(sizeOnly, /is-choose" role="status">Choose a colour</);
  assert.match(sizeOnly, /class="fs-pick__swatch is-out" style="--sw:#8A9A6B" aria-pressed="false" aria-label="Sage — not available for this size"/, 'Sage is crossed out for M');
  assert.match(sizeOnly, /class="fs-pick__swatch" style="--sw:#2F3A56" aria-pressed="false" aria-label="Navy"/, 'Navy stays available for M');
  const forest = app.render('/fashion/p/cloudstep-minimal-sneakers?size=UK%208&colour=Forest');
  assert.match(forest, /data-price="1099"/, 'the variant override is the figure shown (the row\'s, not computed)');
  const st = app.pdpRules.selectionState(app.rules.productView(SHIRT), { size: 'M', colour: 'Sage' });
  assert.equal(st.canAdd, false); assert.equal(st.status, 'out');
  assert.equal(app.pdpRules.selectionState(app.rules.productView(SHIRT), { size: 'M', colour: 'Navy' }).canAdd, true);
  assert.equal(app.pdpRules.selectionState(app.rules.productView(SHIRT), { size: 'XL', colour: 'Navy' }).status, 'missing');
  assert.deepEqual(app.pdpRules.readSelection('size=M&colour=Bogus', app.rules.productView(SHIRT)), { size: 'M', colour: null }, 'an unknown colour in the URL is ignored');
});

await test('Add to Cart and Buy Now are disabled until both size and colour are chosen', () => {
  const none = app.render(SLUG);
  assert.match(none, /class="fs-btn fs-btn--add" disabled="" data-can-add="no">[\s\S]*?Choose a size and colour</);
  assert.match(none, /class="fs-btn fs-btn--buy" disabled="">Buy now<\/button>/);
  assert.match(none, /<p class="fs-pick__note is-choose" role="status">Choose a size and colour<\/p>/);
  assert.match(app.render(`${SLUG}?colour=Navy`), /data-can-add="no">[\s\S]*?Choose a size</);
  assert.match(app.render(`${SLUG}?size=M`), /data-can-add="no">[\s\S]*?Choose a colour</);
  assert.match(app.render(`${SLUG}?size=M&colour=Navy`), /data-can-add="yes"/);
  // The sticky bar mirrors the same gate.
  const bar = none.slice(none.indexOf('class="fs-pdp__bar"'));
  assert.match(bar, /disabled=""/);
  assert.doesNotMatch(app.render(`${SLUG}?size=M&colour=Navy`).slice(none.indexOf('class="fs-pdp__bar"')), /fs-btn--add" disabled/);
});

await test('quick-add: one variant adds directly, several open the sheet, none in stock offers nothing', () => {
  const single = { ...PRODUCTS[4], fashion_variants: [PRODUCTS[4].fashion_variants[0]] };           // sunglasses, Gold only
  const soldOut = { ...PRODUCTS[4], fashion_variants: PRODUCTS[4].fashion_variants.map((v) => ({ ...v, stock: 0 })) };
  const html = app.render('/fashion', { categories: CATEGORIES, products: [single, SHIRT, soldOut] });
  const card = (slug) => { const i = html.indexOf(`data-product="${slug}"`); return html.slice(i, html.indexOf('</article>', i)); };
  assert.match(card('sunhaven-oversized-sunglasses'), /class="fs-quick" data-quick="direct" aria-label="Add Sunhaven Oversized Sunglasses to cart"/);
  assert.match(card('meadow-linen-shirt-sage'), /class="fs-quick" data-quick="sheet" aria-label="Choose size and colour for Meadow Linen Shirt — Sage"/);
  assert.deepEqual(app.pdpRules.quickAddPlan(app.rules.productView(single)), { mode: 'direct', variant: app.rules.productView(single).variants[0] });
  assert.deepEqual(app.pdpRules.quickAddPlan(app.rules.productView(SHIRT)), { mode: 'sheet' });
  assert.deepEqual(app.pdpRules.quickAddPlan(app.rules.productView(soldOut)), { mode: 'none' });
  const multiOneLive = { ...SHIRT, fashion_variants: SHIRT.fashion_variants.map((v) => ({ ...v, stock: v.id === M_NAVY ? 3 : 0 })) };
  assert.equal(app.pdpRules.quickAddPlan(app.rules.productView(multiOneLive)).mode, 'sheet', 'several variants with one in stock still asks — the customer chooses');
  assert.match(read('src/fashion/FashionProductCard.jsx'), /if \(plan\.mode === 'direct'\) addFashionToCart\(view, plan\.variant\);\s*else if \(plan\.mode === 'sheet'\) setSheet\(true\);/);
  assert.match(read('src/fashion/FashionVariantPicker.jsx'), /export function VariantSheet/);
  assert.match(read('src/fashion/FashionVariantPicker.jsx'), /disabled=\{!st\.canAdd\} onClick=\{\(\) => \{ if \(onAdd\(st\.variant, st\)\) onClose\(\); \}\}/);
});

await test('the sheet: mobile-safe, clears the home indicator; the PDP bar too', () => {
  const css = read('src/styles/fashion.css');
  assert.match(css, /\.fs-sheet__panel \{[^}]*padding: 18px 20px calc\(20px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.fs-pdp__bar \{ position: fixed;[^}]*padding: 10px 14px calc\(10px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.fs-pdp \{ padding-bottom: 92px; \}/, 'the page clears the bar');
  assert.match(css, /\.fs-gallery__track \{[^}]*scroll-snap-type: x mandatory/);
  assert.match(css, /\.fs-pick__size\.is-out, \.fs-pick__size:disabled \{[^}]*text-decoration: line-through/, 'unavailable sizes are visibly disabled');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
