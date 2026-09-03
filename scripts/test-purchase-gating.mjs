// ============================================================
// M2 / L1 / L2 — the final functionality-audit closeout.
//
// M2  An admin could publish a product at ₹0. The storefront rendered
//     "Price coming soon" but kept a live Add to cart button, so the customer
//     carried an unbuyable line all the way to checkout, where the server
//     refused it — the first honest signal they got.
//
// L1  The header painted the built-in category set and then visibly swapped it
//     for the Supabase set once hydration landed, changing labels under the
//     cursor on every page load.
//
// L2  verifyAdmin collapsed "not an admin" and "the membership query failed"
//     into one boolean, so a dropped request logged a signed-in admin out.
//
// Offline: real modules and real JSX, rendered in memory. No network, no
// Supabase, no orders.
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import { isPurchasable, isPayableAmount, UNAVAILABLE_LABEL } from '../src/data/products.js';
import { isCategoriesHydrated, applyCategories } from '../src/data/categories.js';
import {
  adminStateFromResult, grantsAdminAccess,
  ADMIN_YES, ADMIN_DENIED, ADMIN_ERROR, ADMIN_UNKNOWN,
} from '../src/lib/adminAccess.js';

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const src = (p) => read(p).replace(/\r\n/g, '\n');
const h = React.createElement;

// Render a real component with its imports stripped and deps injected —
// the same technique scripts/test-homepage-appearance.mjs uses.
function component(file, name, deps = {}) {
  const { code } = transformSync(read(file), {
    configFile: false, babelrc: false,
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    plugins: [() => ({ visitor: {
      ImportDeclaration(p) { p.remove(); },
      ExportDefaultDeclaration(p) { p.replaceWith(p.node.declaration); },
      ExportNamedDeclaration(p) { if (p.node.declaration) p.replaceWith(p.node.declaration); else p.remove(); },
    } })],
  });
  const scope = { React, ...React, ...deps };
  return new Function(...Object.keys(scope), `${code}\n;return ${name};`)(...Object.values(scope));
}

const Link = ({ to, children, ...rest }) => h('a', { ...rest, href: to }, children);
const Icon = () => h('span');
const ProductImage = () => h('span');
const PriceTag = ({ product }) => h('span', null,
  product.priceVerified === false ? 'Price coming soon' : `₹${product.price}`);

const priced = {
  id: 'p1', slug: 'priced', name: 'Sea Buckthorn Juice', price: 298, mrp: 350,
  priceVerified: true, stock: 10, category: 'wellness', discountPct: 15, badges: [],
};
const unpriced = {
  ...priced, id: 'p0', slug: 'unpriced', name: 'Unpriced Item',
  price: 0, mrp: 0, priceVerified: false, discountPct: 0,
};

// ---------------------------------------------------------------
console.log('\n— M2: unpriced products cannot be purchased —');
// ---------------------------------------------------------------

test('M2.1 the purchasability rule accepts only a real positive price', () => {
  assert.equal(isPayableAmount(298), true);
  for (const bad of [0, -1, NaN, Infinity, null, undefined, '', 'abc']) {
    assert.equal(isPayableAmount(bad), false, `${JSON.stringify(bad)} must not be payable`);
  }
  assert.equal(isPurchasable(priced), true);
  assert.equal(isPurchasable(unpriced), false, 'priceVerified:false is never purchasable');
  assert.equal(isPurchasable({ ...priced, price: 0 }), false, 'a ₹0 price is never purchasable');
  assert.equal(isPurchasable(null), false);
});

test('M2.2 a variant is judged on ITS own price, never the base price', () => {
  assert.equal(isPurchasable(priced, { id: 'v1', label: '750ml', price: 499 }), true);
  assert.equal(isPurchasable(priced, { id: 'v0', label: '750ml', price: 0 }), false,
    'a ₹0 pack must not fall back to the purchasable base price');
  // A display-only catalogue variant carries no price of its own; the base
  // product price governs, exactly as the cart already prices it.
  assert.equal(isPurchasable(priced, { label: '750ml' }), true);
});

test('M2.3 the product card offers no Add to cart for an unpriced product', () => {
  const ProductCard = component('../src/components/ProductCard.jsx', 'ProductCard', {
    Link, Icon, ProductImage, PriceTag,
    useStore: () => ({ addToCart: () => {}, toggleWish: () => {}, isWished: () => false }),
    categoryBySlug: {}, isPurchasable, UNAVAILABLE_LABEL,
  });
  const bad = renderToStaticMarkup(h(ProductCard, { product: unpriced }));
  assert.match(bad, /Price coming soon/, 'the truthful price line is preserved');
  assert.match(bad, new RegExp(UNAVAILABLE_LABEL), 'the control states it is unavailable');
  assert.match(bad, /disabled/, 'and is disabled');
  assert.doesNotMatch(bad, /Add to cart/, 'no purchase is offered');

  const good = renderToStaticMarkup(h(ProductCard, { product: priced }));
  assert.match(good, /Add to cart/, 'a normal product still sells');
  assert.doesNotMatch(good, new RegExp(UNAVAILABLE_LABEL));
});

test('M2.4 the compact card hides its quick-add for an unpriced product', () => {
  const CompactProductCard = component('../src/components/CompactProductCard.jsx', 'CompactProductCard', {
    Link, Icon, ProductImage, PriceTag,
    useStore: () => ({ addToCart: () => {} }),
    branding: { siteName: 'SORA LIFE' }, isPurchasable,
  });
  const bad = renderToStaticMarkup(h(CompactProductCard, { product: unpriced }));
  assert.doesNotMatch(bad, /v2-cc__add/, 'a "+" that cannot work must not be shown');
  const good = renderToStaticMarkup(h(CompactProductCard, { product: priced }));
  assert.match(good, /v2-cc__add/, 'a normal product keeps its quick-add');
});

test('M2.5 the store refuses to put an unpriced line in the cart', () => {
  // The single choke point every add path funnels through — cards, quick view,
  // PDP and "add all to cart" — so a missed button cannot leak a bad line.
  const store = src('../src/lib/store.jsx');
  assert.match(store, /if \(!isPurchasable\(product/,
    'addToCart must consult the purchasability rule');
  const fnStart = store.indexOf('const addToCart');
  const guard = store.slice(fnStart, store.indexOf('}, [toast]);', fnStart));
  const bail = guard.indexOf('return false');
  const add = guard.indexOf("dispatch({ type: 'ADD'");
  assert.ok(bail > -1 && add > -1, 'both the guard and the dispatch must be present');
  assert.ok(bail < add, 'the guard must return BEFORE the ADD dispatch');
  assert.match(store, /purchasable: isPurchasable\(product, variantObj\)/,
    'every hydrated cart line must carry its purchasability');
  assert.match(store, /blockedCartLines/, 'blocked lines must be exposed to the cart and checkout');
});

test('M2.6 a legacy unpriced line already in the cart cannot reach payment', () => {
  const cart = src('../src/pages/Cart.jsx');
  assert.match(cart, /blockedCartLines\.length > 0/, 'the cart must detect blocked lines');
  assert.match(cart, /disabled aria-disabled="true"[\s\S]{0,80}Checkout/,
    'the Checkout control must be disabled while a line is unbuyable');
  assert.match(cart, /not available to buy right now/, 'and must say why, naming the item');

  const checkout = src('../src/pages/Checkout.jsx');
  const submit = checkout.slice(checkout.indexOf('const placeOrder'));
  assert.ok(submit.indexOf('blockedCartLines.length') > -1
    && submit.indexOf('blockedCartLines.length') < submit.indexOf('inFlight.current = true'),
    'placeOrder must refuse before it starts a payment');
});

test('M2.7 the admin form refuses to publish a product at ₹0', () => {
  const form = src('../src/admin/pages/ProductForm.jsx');
  assert.match(form, /type="number" min="1"/, 'the price field must require at least 1');
  assert.doesNotMatch(form, /type="number" min="0" step="1" required value=\{values\.originalPrice\}/,
    'min="0" allowed a zero-priced product to be saved');
  assert.match(form, /if \(!\(original > 0\)\)/,
    'submit must validate too — the min attribute alone is only a hint');
  assert.match(form, /at least ₹1/, 'and must explain the requirement');
});

test('M2.8 the server-side rejection remains the final defence', () => {
  const pricing = src('../api/_lib/pricing.js');
  assert.match(pricing, /is not available for purchase right now/,
    'the server must still refuse an unpriced line regardless of the UI');
});

// ---------------------------------------------------------------
console.log('\n— L1: the nav does not swap categories after hydration —');
// ---------------------------------------------------------------

test('L1.1 categories report their hydration state', () => {
  // Freshly imported, nothing has replaced the built-in list yet.
  assert.equal(typeof isCategoriesHydrated, 'function');
  assert.equal(isCategoriesHydrated(), false, 'the built-in list is not hydrated data');
  applyCategories([{ slug: 'wellness', name: 'Wellness' }, { slug: 'mom-trust', name: 'Mom Trust' }]);
  assert.equal(isCategoriesHydrated(), true, 'a successful apply marks the list hydrated');
});

test('L1.2 an empty or invalid apply does not claim hydration', () => {
  // applyCategories returns false and changes nothing for these, so a failed
  // fetch cannot make the nav believe it has real data.
  assert.equal(applyCategories([]), false);
  assert.equal(applyCategories(null), false);
});

test('L1.3 the header holds the row instead of painting a set it will replace', () => {
  const header = src('../src/components/Header.jsx');
  assert.match(header, /useCategoriesSettled/, 'the header must wait for the category list to settle');
  assert.match(header, /NAV_PLACEHOLDER_COUNT/, 'and reserve the row while it waits');
  assert.match(header, /v2-hdr__link--ph[\s\S]{0,120}\{c\.name\}/,
    'placeholders must lay out the real fallback label so the slot keeps its true width');
  assert.match(header, /categoriesSettled\s*\n?\s*\?\s*categories\.slice\(0, 5\)/,
    'the real links must render only once settled');
  assert.match(header, /setTimeout\(\(\) => setTimedOut\(true\), 5000\)/,
    'a slow or unreachable Supabase must still fall back to the built-in list');
  assert.match(header, /aria-hidden="true"/, 'placeholders must be invisible to assistive tech');
});

test('L1.4 the placeholder reserves height and cannot be clicked', () => {
  const css = src('../src/styles/v2-header.css');
  assert.match(css, /\.v2-hdr__link--ph/, 'the placeholder needs its own rule');
  assert.match(css, /pointer-events:\s*none/, 'it must not be interactive');
  assert.match(css, /height:\s*\d+px/, 'and must occupy real height so the row cannot reflow');
  assert.match(css, /color:\s*transparent/,
    'the reserved label must be invisible — it sizes the slot, it is not shown');
});

// ---------------------------------------------------------------
console.log('\n— L2: a failed admin check is not a denial —');
// ---------------------------------------------------------------

test('L2.1 a successful query with a membership row is an admin', () => {
  assert.equal(adminStateFromResult({ data: { user_id: 'u1' }, error: null }), ADMIN_YES);
  assert.equal(grantsAdminAccess(ADMIN_YES), true);
});

test('L2.2 a successful query with no row is a confirmed denial', () => {
  assert.equal(adminStateFromResult({ data: null, error: null }), ADMIN_DENIED);
  assert.equal(grantsAdminAccess(ADMIN_DENIED), false);
});

test('L2.3 a failed query is NOT a denial — it is unknown', () => {
  const err = adminStateFromResult({ data: null, error: { message: 'network' } });
  assert.equal(err, ADMIN_ERROR, 'a transport failure must not be reported as "not an admin"');
  assert.notEqual(err, ADMIN_DENIED);
});

test('L2.4 no state except a confirmed admin ever grants access', () => {
  for (const state of [ADMIN_UNKNOWN, ADMIN_DENIED, ADMIN_ERROR, null, undefined, 'yes', true]) {
    assert.equal(grantsAdminAccess(state), false, `${String(state)} must not grant admin access`);
  }
  assert.equal(grantsAdminAccess(ADMIN_YES), true);
});

test('L2.5 the provider retries once and derives isAdmin strictly', () => {
  const auth = src('../src/lib/adminAuth.jsx');
  assert.match(auth, /const isAdmin = grantsAdminAccess\(adminState\)/,
    'isAdmin must be derived, never set independently');
  assert.doesNotMatch(auth, /setIsAdmin\(/, 'no path may set admin access directly');
  assert.match(auth, /state === ADMIN_ERROR[\s\S]{0,200}queryMembership/,
    'an errored check must be retried once');
  assert.match(auth, /verificationFailed/, 'the error state must be exposed to the route');
});

test('L2.6 the route shows a retry screen instead of logging an admin out', () => {
  const app = src('../src/App.jsx');
  assert.match(app, /session && verificationFailed/,
    'a signed-in session with a failed check must be handled separately');
  const guard = app.slice(app.indexOf('function ProtectedAdminRoute'));
  assert.ok(guard.indexOf('verificationFailed') < guard.indexOf('Navigate to="/admin/login"'),
    'the error branch must come before the redirect');
  assert.match(guard, /Could not verify your access/, 'and must explain what happened');
  assert.match(guard, /retryVerification/, 'and offer to try again');
});

test('L2.7 sign-in distinguishes a failed check from an unauthorized account', () => {
  const auth = src('../src/lib/adminAuth.jsx');
  assert.match(auth, /could not verify your admin access/i,
    'a failed check must not claim the account is unauthorized');
  assert.match(auth, /not authorized as a SORA LIFE admin/,
    'a genuine denial keeps its original message');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
