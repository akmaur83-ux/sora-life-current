// ============================================================
// Legacy product-slug compatibility.
//
// The shim has to be correct in BOTH production states, because the Admin
// rename happens on the owner's schedule with no deploy in between:
//
//   State A  catalogue still holds the malformed slug -> it resolves directly
//            and nothing redirects (a premature redirect here would 404 every
//            one of these products the moment this build shipped)
//   State B  catalogue holds the canonical slug       -> the old URL redirects
//
// Offline: pure module, no DOM, no network.
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEGACY_PRODUCT_SLUGS, canonicalProductSlug } from '../src/data/legacyProductSlugs.js';

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const pairs = Object.entries(LEGACY_PRODUCT_SLUGS);
const catalogueOf = (...slugs) => Object.fromEntries(slugs.map((s) => [s, { slug: s, id: s }]));

console.log('\n— The six mappings —');

test('L1 exactly the six confirmed production mistakes are mapped', () => {
  assert.equal(pairs.length, 6, 'this is a shim for six known rows, not a framework');
  for (const [oldSlug, canonical] of pairs) {
    assert.ok(oldSlug.length > 0 && canonical.length > 0);
    assert.match(canonical, /^[a-z0-9][a-z0-9-]*$/, `${canonical} must be canonical kebab-case`);
    assert.notEqual(oldSlug, canonical);
  }
  const targets = pairs.map(([, c]) => c);
  assert.equal(new Set(targets).size, targets.length, 'two legacy slugs must not point at one product');
});

console.log('\n— State A: production still stores the malformed slug —');

test('L2 the old slug resolves directly and is NOT redirected', () => {
  for (const [oldSlug] of pairs) {
    const catalogue = catalogueOf(oldSlug);
    assert.equal(canonicalProductSlug(oldSlug, catalogue), '',
      `${oldSlug} still exists, so it must render — redirecting it would 404 the product`);
  }
});

test('L3 that holds even when the canonical slug is absent entirely', () => {
  for (const [oldSlug, canonical] of pairs) {
    const catalogue = catalogueOf(oldSlug);
    assert.equal(catalogue[canonical], undefined);
    assert.equal(canonicalProductSlug(oldSlug, catalogue), '');
  }
});

console.log('\n— State B: production stores the canonical slug —');

test('L4 the old URL resolves to the canonical slug', () => {
  for (const [oldSlug, canonical] of pairs) {
    const catalogue = catalogueOf(canonical);
    assert.equal(canonicalProductSlug(oldSlug, catalogue), canonical);
  }
});

test('L5 the canonical URL itself renders, never redirects', () => {
  for (const [, canonical] of pairs) {
    assert.equal(canonicalProductSlug(canonical, catalogueOf(canonical)), '');
  }
});

test('L6 no 404 for either URL once renamed', () => {
  for (const [oldSlug, canonical] of pairs) {
    const catalogue = catalogueOf(canonical);
    const target = canonicalProductSlug(oldSlug, catalogue) || oldSlug;
    assert.ok(catalogue[target], `${oldSlug} must end up at a product that exists`);
  }
});

console.log('\n— Safety —');

test('L3b the catalogue wins even when BOTH slugs resolve', () => {
  // Isolates the "normal lookup first" rule. Without a catalogue holding both,
  // the second guard (never redirect into a 404) masks the first and the
  // ordering requirement goes untested.
  for (const [oldSlug, canonical] of pairs) {
    const catalogue = catalogueOf(oldSlug, canonical);
    assert.equal(canonicalProductSlug(oldSlug, catalogue), '',
      `${oldSlug} resolves on its own, so the catalogue must win over the map`);
    assert.equal(canonicalProductSlug(canonical, catalogue), '');
  }
});

test('L7 the shim never redirects into a 404', () => {
  // Mid-rename: the old row is gone but the canonical one has not landed.
  for (const [oldSlug] of pairs) {
    assert.equal(canonicalProductSlug(oldSlug, catalogueOf('something-else')), '',
      'with no valid target the route must fall through to normal 404 handling');
  }
});

test('L8 an unknown slug is untouched, so 404 handling is unchanged', () => {
  const catalogue = catalogueOf('beard-cream', 'mouch-wax');
  for (const unknown of ['not-a-product', 'zzz', '../etc/passwd', '', 'undefined']) {
    assert.equal(canonicalProductSlug(unknown, catalogue), '');
  }
  for (const bad of [null, undefined, 42, {}, []]) {
    assert.equal(canonicalProductSlug(bad, catalogue), '');
  }
});

test('L9 ordinary products are never affected', () => {
  const catalogue = catalogueOf('beard-cream', 'mouch-wax', 'spirusash-capsule');
  for (const slug of Object.keys(catalogue)) {
    assert.equal(canonicalProductSlug(slug, catalogue), '', `${slug} is a normal product`);
  }
  assert.equal(canonicalProductSlug('beard-cream', {}), '', 'a missing normal product still 404s');
});

console.log('\n— Wiring —');

test('L10 the route checks the catalogue first and redirects with replace', () => {
  const page = src('../src/pages/Product.jsx');
  const lookup = page.indexOf('const product = productBySlug[slug]');
  const shim = page.indexOf('canonicalProductSlug(slug, productBySlug)');
  const loading = page.indexOf("if (view === 'loading')");
  const notfound = page.indexOf("if (view === 'notfound')");
  assert.ok(lookup !== -1 && shim !== -1, 'both the lookup and the shim must be present');
  assert.ok(lookup < shim, 'the normal catalogue lookup has to come first');
  assert.ok(loading < shim, 'never redirect while the catalogue is still hydrating');
  assert.ok(shim < notfound, 'the shim gets its chance before NotFound renders');
  assert.match(page, /<Navigate to=\{`\/product\/\$\{canonical\}\$\{location\.search\}\$\{location\.hash\}`\} replace \/>/,
    'canonical project route, replace navigation, query and hash carried across');
});

test('L11 the shim owns no product data and no migration', () => {
  const mod = src('../src/data/legacyProductSlugs.js');
  assert.doesNotMatch(mod, /fetch\(|supabase|adminApi|price|stock|id:\s*\d/i,
    'this file maps slugs and nothing else');
  assert.match(mod, /Object\.freeze/, 'the map is not mutable at runtime');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
