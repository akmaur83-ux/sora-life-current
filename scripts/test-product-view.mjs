// ============================================================
// Regression tests for the product-route loading/404 decision.
//
//   node scripts/test-product-view.mjs
//
// Imports the REAL helpers from src/data/products.js. Guards the fix that a
// live-only product no longer flashes 404 while the catalogue hydrates, while a
// genuinely-unknown slug still resolves to NotFound once the catalogue is in
// (or a safety timeout elapsed).
// ============================================================
import { productRouteState, isCatalogHydrated, applyCatalog, products } from '../src/data/products.js';

let pass = 0, fail = 0;
const eq = (got, want, label) => (got === want
  ? (console.log(`  PASS  ${label}: ${got}`), pass++)
  : (console.log(`  FAIL  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`), fail++));

console.log('\n— productRouteState decision matrix —');
// found → always the product, regardless of settle state
eq(productRouteState(true, false), 'product', 'found + not-settled → product');
eq(productRouteState(true, true), 'product', 'found + settled → product');
// not found → loading until settled, then NotFound (never a premature 404)
eq(productRouteState(false, false), 'loading', 'missing + hydrating → loading (no 404 flash)');
eq(productRouteState(false, true), 'notfound', 'missing + settled → NotFound');

console.log('\n— isCatalogHydrated transitions —');
eq(typeof isCatalogHydrated, 'function', 'isCatalogHydrated is exported');
eq(isCatalogHydrated(), false, 'starts false (bundled static seed)');
// Re-apply the (already-normalised) seed list as a "supabase" source to flip it.
const applied = applyCatalog(products, 'supabase');
eq(applied, true, 'applyCatalog(products, "supabase") succeeds');
eq(isCatalogHydrated(), true, 'true once the catalogue is hydrated');

console.log('\n— combined: the exact bug scenario —');
// A live-only slug during hydration (settled=false) must be loading, not a 404.
eq(productRouteState(false, false), 'loading', 'pre-hydration missing slug → loading (was: 404 flash)');
// The same slug once it resolves is the product.
eq(productRouteState(true, false), 'product', 'slug resolves after hydration → product');
// A genuinely-unknown slug once the catalogue settled → NotFound.
eq(productRouteState(false, true), 'notfound', 'truly-unknown slug when settled → NotFound');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
