// ============================================================
// Phase 1E.2 — cart launch blockers.
//
// The audit found a cart that did its arithmetic perfectly and then told the
// customer things that were not true:
//
//   COUPON    Cart.jsx carried `COUPONS = { SORA10: 0.1, WELCOME: 0.15 }`.
//             Neither code existed in the coupons table, the API, or any
//             migration, and no code was ever sent anywhere. A ₹51,429 basket
//             showed ₹43,715 with WELCOME and charged ₹51,429 at checkout.
//   VARIANT   A line whose pack size had been retired fell back to the base
//             product price — a 750 ml line displayed at the 250 ml price —
//             and was offered as purchasable. create-order refuses exactly
//             that substitution, so the whole order failed at the payment step.
//   GHOST     A deleted product left a line that could not render but still
//             counted toward the header badge, forever.
//   SAVED     Saving a 750 ml line for later showed ₹1,347 instead of ₹4,038
//             and dropped the pack label.
//   TOUCH     The redesign's .v2-cart-root rules outranked the 44px mobile
//             targets pages.css had deliberately added.
//
// Offline: real modules and real JSX rendered in memory. No network, no
// Supabase, no orders, no payment.
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import {
  hydrateCartLine, countableStock, cartSubtotal, cartMrpTotal, cartSavings,
} from '../src/lib/cartLine.js';

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const src = (p) => read(p).replace(/\r\n/g, '\n');
// Comments explain the bugs these tests pin, and say the old code out loud.
// Counting occurrences in prose would make every check meaningless.
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const h = React.createElement;

function component(file, name, deps = {}) {
  const { code: js } = transformSync(read(file), {
    configFile: false, babelrc: false,
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    plugins: [() => ({ visitor: {
      ImportDeclaration(p) { p.remove(); },
      ExportDefaultDeclaration(p) { p.replaceWith(p.node.declaration); },
      ExportNamedDeclaration(p) { if (p.node.declaration) p.replaceWith(p.node.declaration); else p.remove(); },
    } })],
  });
  const scope = { React, ...React, ...deps };
  return new Function(...Object.keys(scope), `${js}\n;return ${name};`)(...Object.values(scope));
}

// ---- fixtures ------------------------------------------------------
// Mirrors the real catalogue shape: a juice sold in two priced pack sizes.
const V250 = { id: 'v-250', label: '250 ml', price: 1347, mrp: 1585, stock: null };
const V750 = { id: 'v-750', label: '750 ml', price: 4038, mrp: 4750, stock: null };
const juice = {
  id: 'b353', slug: 'wellsash-juice', name: 'Wellsash Sea Buckthorn Juice',
  price: 1347, mrp: 1585, priceVerified: true, isActive: true, stock: 40,
  variants: [V250, V750],
};
const simple = {
  id: 'b1403', slug: 'biosip', name: 'Sea Buckthorn Biosip',
  price: 53, mrp: 66, priceVerified: true, isActive: true, stock: 40, variants: null,
};
const line = (over = {}) => ({ key: 'k', id: simple.id, variant: null, variantId: null, qty: 1, ...over });

// ====================================================================
console.log('\n— Coupon: the cart cannot promise a discount nobody honours —');
// ====================================================================

test('C1 the hard-coded coupon map is gone from the cart', () => {
  const cart = code('../src/pages/Cart.jsx');
  assert.doesNotMatch(cart, /SORA10/, 'SORA10 must not survive as live code');
  assert.doesNotMatch(cart, /WELCOME/, 'WELCOME must not survive as live code');
  assert.doesNotMatch(cart, /const COUPONS/, 'the coupon map must be gone');
  // The specific shape of the bug: a locally invented percentage.
  assert.doesNotMatch(cart, /subtotal\s*\*\s*\w*[Rr]ate/, 'no client-side percentage pricing');
  assert.doesNotMatch(cart, /subtotal\s*-\s*discount/, 'the summary must not subtract a local discount');
});

test('C2 the cart summary is fed the real subtotal, unmodified', () => {
  const cart = code('../src/pages/Cart.jsx');
  assert.match(cart, /fallback=\{\{\s*itemTotal:\s*subtotal\s*,/,
    'itemTotal must be the catalogue subtotal itself');
});

test('C3 no coupon entry UI remains in the cart', () => {
  const cart = code('../src/pages/Cart.jsx');
  assert.doesNotMatch(cart, /Coupon code/i, 'the coupon input is removed');
  assert.doesNotMatch(cart, /applyCoupon/, 'the apply handler is removed');
  assert.doesNotMatch(cart, /summary__applied/, 'the applied-coupon badge is removed');
});

test('C4 the server coupon path is left completely intact', () => {
  // Removing the fake UI must not have touched the real implementation.
  const createOrder = src('../api/razorpay/create-order.js');
  assert.match(createOrder, /couponCode/, 'create-order still accepts a coupon code');
  assert.match(createOrder, /fetchCouponByCode/, 'create-order still resolves it server-side');
  const pricing = src('../api/_lib/pricing.js');
  assert.match(pricing, /computeCouponDiscount/, 'server coupon maths is untouched');
  const admin = src('../api/_lib/supabaseAdmin.js');
  assert.match(admin, /export async function fetchCouponByCode/, 'the resolver is untouched');
});

test('C5 promo copy no longer sends customers to a field that does not exist', () => {
  const rail = code('../src/components/promo/PromoRail.jsx');
  assert.doesNotMatch(rail, /enter it at checkout/i,
    'checkout has no coupon field; the note must not claim otherwise');
  const checkout = src('../src/pages/Checkout.jsx');
  assert.doesNotMatch(checkout, /placeholder="Coupon/i, 'checkout genuinely has no coupon input');
});

// ====================================================================
console.log('\n— Retired pack size: no silent substitution —');
// ====================================================================

test('V1 a line with a live variant is priced at THAT pack, not the base', () => {
  const l = hydrateCartLine(line({ id: juice.id, variant: '750 ml', variantId: 'v-750', qty: 2 }), juice);
  assert.equal(l.unitPrice, 4038, 'the 750 ml price, not the 1347 base');
  assert.equal(l.unitMrp, 4750);
  assert.equal(l.lineTotal, 8076);
  assert.equal(l.variantLabel, '750 ml');
  assert.equal(l.purchasable, true);
  assert.equal(l.unavailableReason, null);
});

test('V2 a retired variant is BLOCKED and never falls back to the base price', () => {
  const l = hydrateCartLine(line({ id: juice.id, variant: '5 litre', variantId: 'gone', qty: 1 }), juice);
  // The exact defect: this used to be 1347 — the 250 ml price on a 5 litre line.
  assert.notEqual(l.unitPrice, juice.price, 'the base price must NOT be substituted');
  assert.equal(l.unitPrice, null, 'an unknowable price is null, not a guess');
  assert.equal(l.unitMrp, null);
  assert.equal(l.lineTotal, 0, 'an unpriceable line contributes nothing to the total');
  assert.equal(l.purchasable, false, 'create-order would refuse this line');
  assert.equal(l.variantMissing, true);
  assert.match(l.unavailableReason, /5 litre/, 'the message names the pack that went away');
});

test('V3 a product that never had a variant is unaffected', () => {
  const l = hydrateCartLine(line({ qty: 3 }), simple);
  assert.equal(l.unitPrice, 53);
  assert.equal(l.lineTotal, 159);
  assert.equal(l.variantMissing, false);
  assert.equal(l.purchasable, true);
  // A display-only catalogue variant carries a label but no id, and must keep
  // pricing from the base product exactly as before.
  const labelled = hydrateCartLine(line({ variant: '250ml', variantId: null }), simple);
  assert.equal(labelled.unitPrice, 53);
  assert.equal(labelled.purchasable, true);
});

test('V4 a deleted product yields no line at all', () => {
  assert.equal(hydrateCartLine(line(), null), null);
  assert.equal(hydrateCartLine(line(), undefined), null);
});

// ====================================================================
console.log('\n— Stock: only promises the catalogue can actually keep —');
// ====================================================================

test('S1 variant stock is a real count; product stock is not', () => {
  // adminApi maps a boolean products.stock to the stand-in 40, so its value
  // means nothing. Variant stock passes through untouched.
  assert.equal(countableStock({ ...V750, stock: 3 }), 3);
  assert.equal(countableStock({ ...V750, stock: 0 }), 0);
  assert.equal(countableStock({ ...V750, stock: null }), null, 'untracked variant = no ceiling');
  assert.equal(countableStock(null), null, 'a base product line never gets a ceiling');
});

test('S2 quantity above a variant\'s real stock is blocked, and says how many are left', () => {
  const v = { ...V750, stock: 2 };
  const p = { ...juice, variants: [V250, v] };
  const ok = hydrateCartLine(line({ id: p.id, variantId: 'v-750', qty: 2 }), p);
  assert.equal(ok.purchasable, true, 'exactly the available quantity is fine');
  const over = hydrateCartLine(line({ id: p.id, variantId: 'v-750', qty: 3 }), p);
  assert.equal(over.purchasable, false);
  assert.match(over.unavailableReason, /Only 2 left/);
  // Still priced: the customer has to see what they are reducing.
  assert.equal(over.unitPrice, 4038);
});

test('S3 no invented ceiling for a base product, whose stock is a boolean in disguise', () => {
  // 40 is adminApi's IN_STOCK_QTY stand-in. Blocking at 41 would be inventing
  // a limit the catalogue never stated.
  const l = hydrateCartLine(line({ qty: 999 }), simple);
  assert.equal(l.purchasable, true, 'a stand-in quantity must not become a promise');
  assert.equal(l.unavailableReason, null);
});

test('S4 sold-out and deactivated lines are blocked', () => {
  const out = hydrateCartLine(line(), { ...simple, stock: 0 });
  assert.equal(out.purchasable, false);
  assert.match(out.unavailableReason, /out of stock/i);

  const soldOutVariant = hydrateCartLine(
    line({ id: juice.id, variantId: 'v-750' }),
    { ...juice, variants: [V250, { ...V750, stock: 0 }] },
  );
  assert.equal(soldOutVariant.purchasable, false);
  assert.match(soldOutVariant.unavailableReason, /out of stock/i);

  const inactive = hydrateCartLine(line(), { ...simple, isActive: false });
  assert.equal(inactive.purchasable, false);
  assert.match(inactive.unavailableReason, /no longer available/i);

  const unpriced = hydrateCartLine(line(), { ...simple, price: 0, priceVerified: false });
  assert.equal(unpriced.purchasable, false);
});

test('S5 every blocked reason the cart shows matches one the server enforces', () => {
  // The cart must not be stricter or laxer than api/_lib/pricing.js.
  const pricing = src('../api/_lib/pricing.js');
  assert.match(pricing, /is no longer available/, 'server rejects inactive products');
  assert.match(pricing, /The selected size is no longer available/, 'server rejects retired variants');
  assert.match(pricing, /is out of stock/, 'server rejects sold-out lines');
  assert.match(pricing, /Only \$\{stock\.available\} of/, 'server rejects over-stock quantities');
});

// ====================================================================
console.log('\n— Totals: real numbers, never NaN —');
// ====================================================================

test('T1 totals match hand arithmetic on a mixed cart', () => {
  const lines = [
    hydrateCartLine(line({ key: 'a', id: simple.id, qty: 3 }), simple),
    hydrateCartLine(line({ key: 'b', id: juice.id, variantId: 'v-750', qty: 2 }), juice),
    hydrateCartLine(line({ key: 'c', id: juice.id, variantId: 'v-250', qty: 2 }), juice),
  ];
  assert.equal(cartSubtotal(lines), 53 * 3 + 4038 * 2 + 1347 * 2);
  assert.equal(cartSubtotal(lines), 10929);
  assert.equal(cartMrpTotal(lines), 66 * 3 + 4750 * 2 + 1585 * 2);
  assert.equal(cartSavings(lines), 10929 * -1 + cartMrpTotal(lines));
});

test('T2 an unpriceable line cannot turn the totals into NaN', () => {
  // Math.max(0, null - null) is NaN; one retired pack size used to be enough
  // to make every figure on the page NaN once the price became null.
  const lines = [
    hydrateCartLine(line({ key: 'a', id: simple.id, qty: 2 }), simple),
    hydrateCartLine(line({ key: 'b', id: juice.id, variant: '5 litre', variantId: 'gone', qty: 1 }), juice),
  ];
  for (const [label, v] of [['subtotal', cartSubtotal(lines)], ['mrpTotal', cartMrpTotal(lines)], ['savings', cartSavings(lines)]]) {
    assert.ok(Number.isFinite(v), `${label} must be a real number, got ${v}`);
  }
  assert.equal(cartSubtotal(lines), 106, 'only the priced line counts');
  assert.equal(cartMrpTotal(lines), 132);
  assert.equal(cartSavings(lines), 26);
});

// ====================================================================
console.log('\n— Ghost lines: the badge cannot count what the page cannot show —');
// ====================================================================

test('G1 the badge counts rendered lines, not raw storage', () => {
  const store = code('../src/lib/store.jsx');
  assert.match(store, /cartCount = useMemo\(\(\) => cartDetailed\.reduce/,
    'cartCount must derive from cartDetailed, not state.cart');
});

test('G2 pruning only runs against the REAL catalogue, never the bundled seed', () => {
  const store = code('../src/lib/store.jsx');
  assert.match(store, /if \(!isCatalogHydrated\(\)\) return;/,
    'pruning before Supabase lands would delete valid lines');
  assert.match(store, /PRUNE_MISSING/);
  // Only a missing PRODUCT is pruned. A retired pack size stays visible so the
  // customer's own choice is never silently discarded.
  assert.match(store, /\.filter\(\(l\) => !productById\[l\.id\]\)/);
});

test('G3 PRUNE_MISSING is a no-op when nothing is missing, so it cannot loop', () => {
  const store = src('../src/lib/store.jsx');
  const body = store.slice(store.indexOf("case 'PRUNE_MISSING'"), store.indexOf("case 'SAVE_LATER'"));
  assert.match(body, /if \(!gone\.size\) return state;/, 'empty key list returns the same object');
  assert.match(body, /return state;/, 'no change returns the identical state reference');
  assert.match(body, /cart\.length === state\.cart\.length/, 'length check guards the identity return');
});

// ====================================================================
console.log('\n— Saved for later, quantity, and accessible names —');
// ====================================================================

const cartDeps = {
  Link: ({ to, children, ...rest }) => h('a', { ...rest, href: to }, children),
  Icon: () => h('span'),
  ProductImage: () => h('span'),
  ProductRail: () => h('span'),
  PriceSummary: () => h('span'),
  PromoRail: () => h('span'),
  money: (n) => `₹${Number(n).toLocaleString('en-IN')}`,
  getBestsellers: () => [],
  promotionsSource: 'local',
  useStore: () => ({}),
};

test('SL1 a saved 750 ml line shows ITS price and keeps its pack label', () => {
  const SavedList = component('../src/pages/Cart.jsx', 'SavedList', cartDeps);
  const saved = [hydrateCartLine(
    { key: 's1', id: juice.id, variant: '750 ml', variantId: 'v-750', qty: 1 }, juice,
  )];
  const html = renderToStaticMarkup(h(SavedList, { saved, dispatch: () => {} }));
  assert.match(html, /₹4,038/, 'the 750 ml price');
  assert.doesNotMatch(html, /₹1,347/, 'must NOT show the 250 ml base price');
  assert.match(html, /750 ml/, 'the pack size must survive into the saved card');
});

test('SL2 saved-card controls name the product and pack', () => {
  const SavedList = component('../src/pages/Cart.jsx', 'SavedList', cartDeps);
  const saved = [hydrateCartLine(
    { key: 's1', id: juice.id, variant: '750 ml', variantId: 'v-750', qty: 1 }, juice,
  )];
  const html = renderToStaticMarkup(h(SavedList, { saved, dispatch: () => {} }));
  assert.match(html, /aria-label="Move Wellsash Sea Buckthorn Juice, 750 ml to cart"/);
  assert.match(html, /aria-label="Remove Wellsash Sea Buckthorn Juice, 750 ml from saved items"/);
  assert.doesNotMatch(html, /aria-label="Remove"/, 'a bare "Remove" identifies nothing');
});

test('Q1 the cart minus is disabled at quantity 1, like the PDP', () => {
  const cart = code('../src/pages/Cart.jsx');
  assert.match(cart, /disabled=\{l\.qty <= 1\}/, 'minus is disabled at the floor');
  // The clamp stays: the button is the courtesy, the reducer is the guarantee.
  const store = code('../src/lib/store.jsx');
  assert.match(store, /qty: Math\.max\(1, action\.qty\)/, 'the minimum clamp must remain');
  // Increase is untouched — no arbitrary maximum was introduced.
  assert.doesNotMatch(cart, /aria-label=\{`Increase quantity for \$\{who\}`\}\s*\n?\s*disabled/,
    'increase must not gain a cap');
});

test('A1 every per-line control names its product', () => {
  const cart = code('../src/pages/Cart.jsx');
  for (const pattern of [
    /aria-label=\{`Decrease quantity for \$\{who\}`\}/,
    /aria-label=\{`Increase quantity for \$\{who\}`\}/,
    /aria-label=\{`Save \$\{who\} for later`\}/,
    /aria-label=\{`Remove \$\{who\} from cart`\}/,
  ]) assert.match(cart, pattern);
  // `who` disambiguates two lines of the same product by pack size.
  assert.match(cart, /const who = l\.variantLabel \? `\$\{l\.product\.name\}, \$\{l\.variantLabel\}` : l\.product\.name;/);
  assert.doesNotMatch(cart, /aria-label="Decrease"/, 'the bare labels are gone');
  assert.doesNotMatch(cart, /aria-label="Increase"/);
});

test('A2 the quantity value is announced when it changes', () => {
  const cart = code('../src/pages/Cart.jsx');
  assert.match(cart, /<span aria-live="polite">\{l\.qty\}<\/span>/);
});

test('A3 the empty cart has exactly one h1', () => {
  const cart = code('../src/pages/Cart.jsx');
  const empty = cart.slice(cart.indexOf('if (!cartDetailed.length)'), cart.indexOf('<div className="pagehead'));
  assert.match(empty, /<h1[^>]*>Your cart is empty<\/h1>/, 'the empty state needs the page heading');
  assert.doesNotMatch(empty, /<h3>Your cart is empty<\/h3>/, 'it used to be an h3, leaving /cart with no h1');
  assert.equal((cart.match(/<h1/g) || []).length, 2, 'one h1 per branch: empty and populated');
});

test('A4 a blocked line explains itself on the row, and holds checkout shut', () => {
  const cart = code('../src/pages/Cart.jsx');
  assert.match(cart, /\{l\.unavailableReason && \(/, 'the reason is shown on its own row');
  assert.match(cart, /blockedCartLines\.length > 0 \?/, 'checkout still gates on blocked lines');
  assert.match(cart, /disabled aria-disabled="true"/, 'the blocked checkout button is really disabled');
});

// ====================================================================
console.log('\n— Mobile touch targets —');
// ====================================================================

test('M1 the cart stepper and row actions reach 44px on phones', () => {
  const css = src('../src/styles/v2-cart-checkout.css');
  const mq = css.slice(css.lastIndexOf('@media (max-width: 900px)'));
  assert.match(mq, /\.v2-cart-root \.qty\.qty--sm button \{ width: 44px; height: 44px; \}/);
  assert.match(mq, /\.v2-cart-root \.qty\.qty--sm \{ height: 44px; \}/,
    'the container has a fixed height and would clip the taller buttons');
  // Matched at .cartrow__actions depth: a 560px rule pins these to 34px and
  // outranks a plainer .v2-cart-root .linkbtn selector on phone widths.
  assert.match(mq, /\.v2-cart-root \.cartrow__actions \.linkbtn,\s*\.v2-cart-root \.savedlist \.linkbtn \{ min-height: 44px; \}/,
    'Save for later / Remove were 34px, and need to beat the 560px rule');
  assert.match(mq, /\.v2-cart-root \.savedcard__actions \.btn \{ min-height: 44px; \}/);
});

test('M2 the override is scoped to mobile, so desktop density is unchanged', () => {
  const css = src('../src/styles/v2-cart-checkout.css');
  // The compact 32px rule must still be the one that applies from 901px up.
  assert.match(css, /\.v2-cart-root \.qty\.qty--sm button \{\s*width: 32px; height: 32px;/,
    'desktop keeps the compact stepper');
  const mq = css.lastIndexOf('@media (max-width: 900px)');
  const compact = css.indexOf('.v2-cart-root .qty.qty--sm button {\n    width: 32px');
  assert.ok(compact < mq, 'the 44px rules must come after the compact ones to win');
});

test('M3 the disabled minus is styled, not just non-functional', () => {
  const css = src('../src/styles/v2-cart-checkout.css');
  assert.match(css, /\.v2-cart-root \.qty\.qty--sm button:disabled \{[^}]*cursor: not-allowed/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
