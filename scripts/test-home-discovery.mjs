// ============================================================
// Homepage discovery rails + the mobile polish pass.
//
//   Shop by category   real catalogue categories, real routes
//   Shop by concerns   only concerns the catalogue can actually back, each
//                      linking to the exact result set it was measured on
//   plus the sticky-cart, Featured Brands, footer and announcement changes.
//
// Offline: real modules and real JSX rendered in memory. No network, no
// Supabase, no orders.
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { products, searchProducts, getByCategory } from '../src/data/products.js';
import { categories } from '../src/data/categories.js';
import { transformSync } from '@babel/core';
import {
  selectCategoryCards, selectConcernCards, concernMatches, concernDestination,
  CONCERN_REGISTRY, MIN_CONCERN_PRODUCTS, sanitizeDiscoveryImages,
  sanitizeConcernProducts, discoveryConcernProducts, resolveConcernProducts,
  concernIsCurated, concernSlug, findConcern, MAX_CONCERN_PRODUCTS,
  searchCatalogueForPicker, sanitizeDiscoveryCards, makeDiscoveryId,
  normalizeDiscovery, discoveryPayload, defaultCategoryCards, defaultConcernCards,
  findCollectionCard, findConcernCard, collectionProducts, concernCardProducts,
  MAX_DISCOVERY_CARDS,
} from '../src/lib/homeDiscovery.js';
import { applyHomepage, getHomepageSnapshot, subscribeHomepage } from '../src/lib/settings.js';

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

console.log('\n— Shop by category —');

test('D1 category cards come from the real catalogue, never invented', () => {
  const cards = selectCategoryCards();
  assert.ok(cards.length >= 3, 'the rail needs at least three categories to be worth showing');
  const known = new Set(categories.map((c) => c.slug));
  for (const card of cards) {
    assert.ok(known.has(card.slug), `${card.slug} must be a real catalogue category`);
    assert.equal(card.name, categories.find((c) => c.slug === card.slug).name,
      'the label is the category\'s own name');
    assert.ok(card.count > 0, `${card.slug} must actually hold products`);
  }
});

test('D2 every category card links to its existing category route', () => {
  for (const card of selectCategoryCards()) {
    assert.equal(card.to, `/category/${card.slug}`);
    assert.ok(getByCategory(card.slug).length > 0, `${card.to} must resolve to products`);
  }
});

test('D3 a card always has real artwork — an asset or a real product', () => {
  for (const card of selectCategoryCards()) {
    assert.ok(card.image || card.fallbackProduct, `${card.slug} has nothing to show`);
    if (card.image && card.imageSource !== 'admin') {
      assert.match(card.image, /^\/public\/category-images\/[a-z0-9-]+\.webp$/,
        'built-in category art must come from the committed asset folder, never a guessed path');
    }
  }
});

test('D4 a category with no products is not offered', () => {
  const cards = selectCategoryCards(
    [...categories, { slug: 'ghost-category', name: 'Ghost' }],
    products,
  );
  assert.ok(!cards.some((c) => c.slug === 'ghost-category'),
    'an empty category must not become a dead card');
});

console.log('\n— Shop by concerns —');

test('D5 only concerns the catalogue can back are shown', () => {
  for (const card of selectConcernCards()) {
    assert.ok(card.count >= MIN_CONCERN_PRODUCTS,
      `${card.label} shows with only ${card.count} products behind it`);
  }
});

test('D6 a concern\'s backing IS its destination, so the card cannot over-promise', () => {
  for (const concern of CONCERN_REGISTRY) {
    const matches = concernMatches(concern);
    const to = concernDestination(concern);
    if (concern.query) {
      // One destination for every concern. /shop resolves the id back to this
      // same registry entry and re-runs concernMatches, so the page shows
      // exactly the set the card was measured on.
      assert.equal(to, `/shop?concern=${encodeURIComponent(concern.id)}`);
      assert.equal(findConcern(concern.id), concern, 'the destination must resolve back');
      assert.equal(matches.length, searchProducts(concern.query).length);
    } else {
      assert.equal(to, `/category/${concern.categorySlug}`);
      assert.equal(matches.length, getByCategory(concern.categorySlug).length);
    }
  }
});

test('D7 unbacked concerns are hidden rather than shipped as dead cards', () => {
  const shown = new Set(selectConcernCards().map((c) => c.id));
  for (const concern of CONCERN_REGISTRY) {
    if (shown.has(concern.id)) continue;
    assert.ok(concernMatches(concern).length < MIN_CONCERN_PRODUCTS,
      `${concern.label} is backed but hidden`);
  }
});

test('D8 a thin set of concerns hides the whole section', () => {
  // Two backed concerns is not a rail worth rendering.
  const tiny = selectConcernCards(products, CONCERN_REGISTRY.slice(0, 1));
  assert.deepEqual(tiny, [], 'below the minimum the section must render nothing');
});

test('D9 concern labels are commerce copy, never medical claims', () => {
  const banned = /\b(cure|cures|treat|treats|treatment|heal|heals|remedy|prevents?|clinically|guaranteed|doctor|prescription|therapy)\b/i;
  for (const concern of CONCERN_REGISTRY) {
    assert.doesNotMatch(concern.label, banned, `${concern.label} reads as a medical claim`);
    assert.doesNotMatch(concern.group, banned);
  }
  const lib = src('../src/lib/homeDiscovery.js');
  const rail = src('../src/components/HomeDiscoveryRails.jsx');
  // Copy rendered into the section, not the explanatory comments.
  assert.doesNotMatch(rail.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ''), banned);
  // The rule is documented in a wrapped comment, so normalise whitespace first.
  assert.match(lib.replace(/\s*\/\/\s*/g, ' ').replace(/\s+/g, ' '),
    /never claims of treatment, cure or medical efficacy/i,
    'the rule must stay documented where the registry lives');
});

console.log('\n— Rails: interaction + accessibility —');

test('D10 both rails are labelled and their controls are named', () => {
  const rail = src('../src/components/HomeDiscoveryRails.jsx');
  assert.match(rail, /aria-label=\{label\}/, 'the scroll region must carry an accessible name');
  assert.match(rail, /aria-label=\{`Scroll \$\{label\} backward`\}/);
  assert.match(rail, /aria-label=\{`Scroll \$\{label\} forward`\}/);
  assert.match(rail, /data-home-section="shop-by-category"|id="shop-by-category"/);
  // The progress track is decoration; it must not be announced.
  assert.match(rail, /className="hd-nav__track" aria-hidden="true"/);
});

test('D11 a whole card is one link — no nested interactive elements', () => {
  const rail = src('../src/components/HomeDiscoveryRails.jsx');
  const card = rail.slice(rail.indexOf('function DiscoveryTile'), rail.indexOf('export function ShopByCategory'));
  assert.match(card, /<Link[\s\S]*className="hd-tile__link"/);
  assert.doesNotMatch(card, /<button/, 'a tile must not contain a button inside its link');
  // Editorial tile, not a product card: no price, badge, count or per-card arrow.
  assert.doesNotMatch(card, /price|badge|discount|arrowRight/i);
});

test('D12 controls disappear when there is nothing to scroll', () => {
  const rail = src('../src/components/HomeDiscoveryRails.jsx');
  assert.match(rail, /if \(state\.atStart && state\.atEnd\) return null/,
    'no dead arrows on a rail that does not scroll');
});

console.log('\n— Mobile polish —');

test('D13 Featured Brands no longer exposes raw catalogue counts', () => {
  const mk = src('../src/components/HomeMarketplace.jsx');
  const brands = mk.slice(mk.indexOf('export function FeaturedBrands'), mk.indexOf('export function DiscoveryEdit'));
  assert.doesNotMatch(brands, /products?' : '[^']*'\} in the catalogue|in the catalogue/,
    'the per-brand product tally made the marketplace read as one dominant label');
  assert.doesNotMatch(brands, /brand\.products\.length/, 'no count may be rendered');
  assert.match(brands, /Discover the brand/, 'brand discovery copy stays');
  assert.match(brands, /brands\.length < 2\) return null/, 'the single-brand guard stays');
});

test('D14 the sticky cart is compact and still fully functional', () => {
  const css = src('../src/styles/v2-mobile-cart.css');
  const h = css.match(/--slv2-mobile-cart-height:(\d+)px/);
  assert.ok(h, 'the dock height must be declared');
  const px = Number(h[1]);
  assert.ok(px >= 56 && px <= 72, `dock height ${px}px is outside the compact target`);
  assert.match(css, /align-items:baseline/, 'amount and count share one line');

  const jsx = src('../src/components/MobileCartSummary.jsx');
  assert.match(jsx, /cartCount/, 'the live item count is still rendered');
  assert.match(jsx, /money\(subtotal\)/, 'the live subtotal is still rendered');
  assert.match(jsx, /to="\/cart"/, 'View cart still links to the cart');
  assert.match(jsx, /aria-live="polite"/, 'totals stay announced as they change');
  assert.match(jsx, /<MobileTabBar \/>/, 'the bottom navigation is untouched');
  // Content must still be reserved for, not covered.
  assert.match(css, /\.page-main \{ padding-bottom:var\(--slv2-mobile-cart-height\)/);
});

test('D15 the newsletter meets the footer with no page-background gap', () => {
  const css = src('../src/styles/v2-home-marketplace.css');
  assert.match(css, /body:has\(\.v2-home\) \.ftr \{ margin-top: 0; \}/,
    'the footer separator margin is what left a strip of bare page background');
  assert.doesNotMatch(css, /body:has\(\.v2-home\) \.ftr \{[^}]*margin-top:\s*-/,
    'the gap must be removed at its cause, not hidden with a negative margin');
  assert.match(css, /\.v2-home \.nl \{ margin:0;/, 'the newsletter band owns its own spacing');
});

test('D16 the announcement default stays marketplace-neutral', () => {
  const settings = src('../src/lib/settings.js');
  const notices = settings.slice(settings.indexOf('export let announcement'), settings.indexOf('export let homepage'));
  assert.doesNotMatch(notices, /biosash/i, 'no single-brand takeover in the shipped default');
  assert.match(settings, /export function applyAnnouncement/, 'the admin override stays intact');
});

test('D17 the footer states the marketplace positioning without inventing claims', () => {
  const footer = src('../src/components/Footer.jsx');
  assert.match(footer, /marketplace for wellness, personal care and everyday essentials/i);
  assert.doesNotMatch(footer, /delivered to your door/i, 'the old narrower promise is gone');
  assert.doesNotMatch(footer, /\b(\d[\d,]*\+? (customers|orders)|since \d{4}|guarantee|certified|free returns)\b/i,
    'no invented history, counts, certifications or guarantees');
});

test('D18 two distinct category experiences, each rendered once', () => {
  // A: the circular quick-nav rail under the hero. B: the editorial browse
  // further down. They are deliberately different sections, not duplicates,
  // so each must appear exactly once and neither may replace the other.
  const strip = src('../src/components/HomeCategoryStrip.jsx');
  assert.match(strip, /<CategoryRail \/>/, 'the quick-nav rail keeps its original circular implementation');
  assert.doesNotMatch(strip, /ShopByCategory/, 'the editorial rail does not live inside the quick-nav strip');

  const home = src('../src/pages/Home.jsx');
  assert.equal((home.match(/<HomeCategoryStrip/g) || []).length, 1, 'exactly one quick-nav rail');
  assert.equal((home.match(/<ShopByCategory\s*\/>/g) || []).length, 1, 'exactly one editorial category rail');
  assert.equal((home.match(/<ShopByConcerns/g) || []).length, 1, 'exactly one concerns section');

  // Order: hero -> quick-nav rail ... editorial category -> concerns.
  const iStrip = home.indexOf('<HomeCategoryStrip');
  const iOffers = home.indexOf('<HomeOffers');
  const iCat = home.indexOf('<ShopByCategory');
  const iCon = home.indexOf('<ShopByConcerns');
  assert.ok(iStrip < iOffers, 'the quick-nav rail sits directly under the hero, above offers');
  assert.ok(iOffers < iCat, 'the editorial rail sits below offers, not beside the quick-nav rail');
  assert.ok(iCat < iCon, 'Shop by Category immediately precedes Shop by Concerns');
});

test('D25 the discovery sections stay compact, with no wasted space', () => {
  const css = src('../src/styles/v2-home-discovery.css');
  const pad = css.match(/\.hd-section \{[^}]*padding-block: (\d+)px (\d+)px/);
  assert.ok(pad, 'the section must declare its own vertical padding');
  assert.ok(Number(pad[1]) <= 24 && Number(pad[2]) <= 24, 'mobile section padding stays within 16-24px');
  assert.match(css, /\.hd-section > \.v2-wrap \{ padding-inline: 16px; \}/, 'tight horizontal gutter on mobile');
  assert.match(css, /\.hd-section \+ \.hd-section \{ margin-top: 0; \}/,
    'the pair reads as one block — no band of page ground between them');
  assert.doesNotMatch(css, /min-height:\s*\d/, 'no min-height may pad the section out');
  assert.doesNotMatch(css, /margin-top:\s*-/, 'spacing is fixed at the cause, never with negative margins');
});

console.log('\n— Admin-assigned discovery artwork —');

test('D19 an admin image takes priority over the built-in artwork', () => {
  const images = {
    categories: { wellness: 'https://cdn.example.com/wellness-lifestyle.jpg' },
    concerns: { 'face-care': 'https://cdn.example.com/face-closeup.jpg' },
  };
  const cat = selectCategoryCards(categories, products, images).find((c) => c.slug === 'wellness');
  assert.equal(cat.image, images.categories.wellness);
  assert.equal(cat.imageSource, 'admin');

  const concern = selectConcernCards(products, CONCERN_REGISTRY, images).find((c) => c.id === 'face-care');
  assert.equal(concern.image, images.concerns['face-care']);
  assert.equal(concern.imageSource, 'admin');
});

test('D20 without an admin image the built-in fallback still renders', () => {
  const empty = { categories: {}, concerns: {} };
  for (const card of selectCategoryCards(categories, products, empty)) {
    assert.ok(card.image || card.fallbackProduct, `${card.slug} lost its artwork`);
    assert.notEqual(card.imageSource, 'admin');
  }
  for (const card of selectConcernCards(products, CONCERN_REGISTRY, empty)) {
    assert.ok(card.image || card.product, `${card.label} lost its artwork`);
  }
});

test('D21 a concern falls back to owned group artwork, not a product bottle', () => {
  const empty = { categories: {}, concerns: {} };
  for (const card of selectConcernCards(products, CONCERN_REGISTRY, empty)) {
    assert.equal(card.imageSource, 'group',
      `${card.label} fell through to product imagery instead of its group artwork`);
    assert.match(card.image, /^\/public\/category-images\//);
    assert.equal(card.product, null, 'no product bottle is carried when group art exists');
  }
});

test('D22 unusable admin URLs are dropped rather than rendered', () => {
  const dirty = sanitizeDiscoveryImages({
    categories: { wellness: 'javascript:alert(1)', 'skin-care': '//evil.example/x.png' },
    concerns: { acne: 'data:text/html,<script>x</script>', 'face-care': 'https://cdn.example.com/ok.jpg' },
  });
  assert.deepEqual(dirty.categories, {}, 'unsafe category URLs must not survive');
  assert.deepEqual(dirty.concerns, { 'face-care': 'https://cdn.example.com/ok.jpg' });
  const cat = selectCategoryCards(categories, products, dirty).find((c) => c.slug === 'wellness');
  assert.equal(cat.imageSource, 'asset', 'a rejected URL falls back to the built-in art');
});

test('D23 the admin editor is wired to the same setting the storefront reads', () => {
  const page = src('../src/admin/pages/Homepage.jsx');
  assert.match(page, /<DiscoveryCardControls/, 'the control must be mounted on Admin -> Homepage');
  assert.match(page, /discoveryPayload\(categoryCards, concernCards\)/, 'values are sanitised before saving');
  assert.match(page, /discovery: cleanDiscovery/, 'saved inside the existing homepage setting');
  assert.match(page, /adminSetSetting\('homepage'/, 'no new settings key is introduced');
  const ctl = src('../src/admin/components/DiscoveryCardControls.jsx');
  assert.match(ctl, /uploadHomepageImage/, 'reuses the existing homepage image uploader');
  assert.match(ctl, /Use default/, 'an admin can clear back to the built-in image');
});

test('D24 the tile geometry stays sharp and editorial', () => {
  const css = src('../src/styles/v2-home-discovery.css');
  const radius = css.match(/\.hd-tile__media \{[\s\S]*?border-radius: (\d+)px/);
  assert.ok(radius && Number(radius[1]) <= 4, 'tile radius must be 0-4px');
  assert.match(css, /aspect-ratio: 4 \/ 3/, 'landscape tiles, close to the reference');
  const tileBlock = css.slice(css.indexOf('.hd-tile__link {'), css.indexOf('.hd-tile__media {'));
  assert.doesNotMatch(tileBlock, /border:\s*1px/, 'no card border — the tile is the artwork');
});

console.log('\n— Admin-chosen products per concern —');

// A tiny catalogue whose products share no words with any concern query, so a
// curated result can only come from the explicit mapping — never from the text
// matcher leaking through.
const pick = (slug, extra = {}) => ({
  id: slug, slug, name: slug.replace(/-/g, ' '), category: 'wellness', categories: ['wellness'],
  price: 199, stock: 5, image: `/img/${slug}.png`, media: [], isActive: true, ...extra,
});
const CURATED = [pick('zeta-one'), pick('zeta-two'), pick('zeta-three'), pick('zeta-four')];
const OTHER = [pick('omega-unrelated'), pick('omega-also-unrelated')];
const TINY = [...CURATED, ...OTHER];
const curatedSlugs = CURATED.map((p) => p.slug);

test('D26 a saved mapping keeps only known concerns and real slug values', () => {
  const clean = sanitizeConcernProducts({
    acne: ['zeta-one', 'zeta-one', 'zeta-two'],        // duplicate collapses
    'not-a-concern': ['zeta-one'],                      // unknown key dropped
    dandruff: 'zeta-one',                               // not an array
    detan: ['javascript:alert(1)', '../../etc/passwd', '', 42, 'zeta-three'],
    scrubs: [],                                         // empty is not stored
  });
  assert.deepEqual(clean, { acne: ['zeta-one', 'zeta-two'], detan: ['zeta-three'] });
});

test('D27 only slugs are stored — never a copy of name, price or image', () => {
  const clean = sanitizeConcernProducts({ acne: curatedSlugs });
  assert.deepEqual(clean.acne, curatedSlugs);
  for (const value of clean.acne) assert.equal(typeof value, 'string');
  const lib = src('../src/lib/homeDiscovery.js');
  const block = lib.slice(lib.indexOf('export function sanitizeConcernProducts'), lib.indexOf('export function discoveryConcernProducts'));
  assert.doesNotMatch(block, /\bprice\b|\bname\b|\bimage\b/, 'the sanitiser must not carry product copy');
});

test('D28 an oversized selection is capped rather than stored whole', () => {
  const many = Array.from({ length: MAX_CONCERN_PRODUCTS + 10 }, (_, i) => `zeta-${i}`);
  assert.equal(sanitizeConcernProducts({ acne: many }).acne.length, MAX_CONCERN_PRODUCTS);
});

test('D29 a curated concern opens exactly the chosen products, in order', () => {
  const manual = { acne: ['zeta-three', 'zeta-one', 'zeta-four'] };
  const concern = CONCERN_REGISTRY.find((c) => c.id === 'acne');
  const got = concernMatches(concern, TINY, manual);
  assert.deepEqual(got.map((p) => p.slug), manual.acne, 'admin order is preserved');
  assert.ok(concernIsCurated(concern, TINY, manual));
});

test('D30 unrelated products never leak into a curated concern', () => {
  const manual = { acne: ['zeta-one', 'zeta-two'] };
  const concern = CONCERN_REGISTRY.find((c) => c.id === 'acne');
  const slugs = concernMatches(concern, TINY, manual).map((p) => p.slug);
  for (const other of OTHER) assert.ok(!slugs.includes(other.slug), `${other.slug} must not appear`);
  assert.equal(slugs.length, 2, 'the matcher must not top the selection up');
});

test('D31 missing and deactivated selections are skipped, never rendered', () => {
  const catalogue = [...CURATED, pick('zeta-retired', { isActive: false })];
  const resolved = resolveConcernProducts(
    ['zeta-one', 'ghost-product', 'zeta-retired', 'zeta-two'], catalogue,
  );
  assert.deepEqual(resolved.map((p) => p.slug), ['zeta-one', 'zeta-two']);
});

test('D32 with no mapping the automatic matcher still drives the concern', () => {
  for (const concern of CONCERN_REGISTRY) {
    assert.deepEqual(
      concernMatches(concern, products, {}).map((p) => p.id),
      concern.query ? searchProducts(concern.query).map((p) => p.id) : getByCategory(concern.categorySlug).map((p) => p.id),
      `${concern.label} changed behaviour without a mapping`,
    );
    assert.equal(concernIsCurated(concern, products, {}), false);
  }
});

test('D33 a concern with neither manual nor automatic backing stays hidden', () => {
  const cards = selectConcernCards(TINY, CONCERN_REGISTRY, { concerns: {} }, {});
  assert.deepEqual(cards, [], 'nothing is backed by this catalogue, so nothing renders');
});

test('D34 a curated concern shows even below the automatic minimum', () => {
  // "acne" resolves to nothing automatically in the real catalogue, so it is
  // hidden today. Two hand-picked products is a decision, and must be honoured.
  const manual = { acne: ['zeta-one', 'zeta-two'] };
  const card = selectConcernCards([...products, ...CURATED], CONCERN_REGISTRY, { concerns: {} }, manual)
    .find((c) => c.id === 'acne');
  assert.ok(card, 'a curated concern must not be filtered out by the automatic minimum');
  assert.equal(card.count, 2);
  assert.equal(card.source, 'admin');
  assert.equal(card.to, '/shop?concern=acne');
  assert.ok(!selectConcernCards(products, CONCERN_REGISTRY, { concerns: {} }, {}).some((c) => c.id === 'acne'),
    'and it stays hidden while nothing backs it');
});

test('D35 /shop accepts the concern id and its readable alias', () => {
  const concern = CONCERN_REGISTRY.find((c) => c.id === 'detan');
  assert.equal(concernSlug(concern), 'de-tan-care');
  assert.equal(findConcern('detan'), concern);
  assert.equal(findConcern('de-tan-care'), concern, 'the label form must resolve too');
  assert.equal(findConcern('DeTan'.toLowerCase()), concern);
  assert.equal(findConcern('not-a-concern'), null, 'an unknown value resolves to nothing');
  assert.equal(findConcern(''), null);
  assert.equal(findConcern(null), null);
});

test('D36 the saved setting is what the storefront reads', () => {
  const before = getHomepageSnapshot().discovery;
  try {
    applyHomepage({ discovery: { concerns: {}, concernProducts: { acne: curatedSlugs, bogus: ['x'] } } });
    assert.deepEqual(discoveryConcernProducts().acne, curatedSlugs);
    assert.equal(discoveryConcernProducts().bogus, undefined, 'an unknown key never reaches the storefront');
  } finally {
    applyHomepage({ discovery: before });
  }
});

console.log('\n— /shop?concern= —');

const jsx = (file, name, deps = {}) => {
  const { code } = transformSync(src(file), {
    configFile: false, babelrc: false,
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    plugins: [() => ({ visitor: {
      ImportDeclaration(path) { path.remove(); },
      ExportDefaultDeclaration(path) { path.replaceWith(path.node.declaration); },
      ExportNamedDeclaration(path) { path.replaceWith(path.node.declaration); },
    } })],
  });
  const scope = { React, ...React, ...deps };
  return new Function(...Object.keys(scope), `${code}; return ${name};`)(...Object.values(scope));
};
const h = React.createElement;
const Link = ({ to, children, ...rest }) => h('a', { ...rest, href: to }, children);
const Icon = () => h('span');
// Stands in for the real browser so the assertions can see exactly which
// products the page handed it. ProductBrowser itself is unchanged and is
// covered by the storefront suites.
const ProductBrowser = ({ baseProducts }) => h('div', { 'data-browser': String(baseProducts.length) },
  baseProducts.map((p) => h('span', { key: p.slug, 'data-slug': p.slug })));
const shopPage = (query, deps = {}) => {
  const ShopPage = jsx('../src/pages/Shop.jsx', 'Shop', {
    Link, Icon, ProductBrowser, products, getHomepageSnapshot, subscribeHomepage,
    normalizeDiscovery, findCollectionCard, findConcernCard,
    collectionProducts, concernCardProducts, selectCategoryCards, selectConcernCards,
    useSearchParams: () => [new URLSearchParams(query)],
    ...deps,
  });
  return renderToStaticMarkup(h(ShopPage));
};
// Saved-settings shaped input for the page, without touching real settings.
const withDiscovery = (discovery) => ({ getHomepageSnapshot: () => ({ discovery }) });
const shownSlugs = (html) => [...html.matchAll(/data-slug="([^"]+)"/g)].map((m) => m[1]);

test('D37 a concern page shows its label and a plain product count', () => {
  const html = shopPage('concern=detan');
  assert.match(html, /<h1[^>]*>De-Tan Care<\/h1>/);
  assert.match(html, /class="v2-shop__count">4 products</, 'the count is stated plainly');
  assert.equal(shownSlugs(html).length, 4);
  assert.doesNotMatch(html, /All products<\/h1>/);
});

test('D38 the page hands the browser exactly the concern set', () => {
  const concern = CONCERN_REGISTRY.find((c) => c.id === 'scrubs');
  const expected = concernMatches(concern).map((p) => p.slug);
  assert.deepEqual(shownSlugs(shopPage('concern=scrubs')), expected);
  assert.deepEqual(shownSlugs(shopPage(`concern=${concernSlug(concern)}`)), expected,
    'the readable name form opens the same set');
});

test('D39 an admin selection wins on the page, and nothing else appears', () => {
  const html = shopPage('concern=acne', {
    products: TINY,
    ...withDiscovery({ concernCards: [{ id: 'acne', name: 'Acne Care', productSlugs: ['zeta-two', 'zeta-one'] }] }),
  });
  assert.deepEqual(shownSlugs(html), ['zeta-two', 'zeta-one']);
  assert.match(html, /class="v2-shop__count">2 products</);
  for (const other of OTHER) assert.ok(!html.includes(other.slug));
});

test('D40 one product reads as "1 product", not "1 products"', () => {
  const html = shopPage('concern=acne', {
    products: TINY,
    ...withDiscovery({ concernCards: [{ id: 'acne', name: 'Acne Care', productSlugs: ['zeta-one'] }] }),
  });
  assert.match(html, /class="v2-shop__count">1 product</);
});

test('D41 an unknown or absent concern falls back to the full catalogue', () => {
  for (const query of ['', 'concern=', 'concern=ghost-concern']) {
    const html = shopPage(query);
    assert.match(html, /All products<\/h1>/, `"${query}" must render the normal Shop page`);
    assert.equal(shownSlugs(html).length, products.length, 'the whole catalogue is offered');
    assert.doesNotMatch(html, /v2-shop__count/);
  }
});

test('D42 concern pages reuse the existing browser — no bespoke product card', () => {
  const page = src('../src/pages/Shop.jsx');
  assert.match(page, /<ProductBrowser baseProducts=\{view\.items\}/, 'the same browser renders every mode');
  assert.doesNotMatch(page, /ProductCard|addToCart|wishlist|money\(|price/i,
    'pricing, cart and wishlist stay entirely inside the existing components');
});

test('D44 the picker search finds real products and hides what is chosen', () => {
  const hit = searchCatalogueForPicker(products, 'beard');
  assert.ok(hit.length >= 3, 'a real catalogue term must return real products');
  for (const p of hit) assert.match(p.name.toLowerCase(), /beard/);

  // Already-chosen products drop out, so the same product cannot be added twice.
  const without = searchCatalogueForPicker(products, 'beard', { exclude: [hit[0].slug] });
  assert.ok(!without.some((p) => p.slug === hit[0].slug));

  // Case-insensitive, capped, and empty-safe.
  assert.deepEqual(searchCatalogueForPicker(products, 'BEARD').map((p) => p.slug), hit.map((p) => p.slug));
  assert.ok(searchCatalogueForPicker(products, 'a', { limit: 4 }).length <= 4, 'results are capped');
  for (const empty of ['', '   ', null, undefined]) {
    assert.deepEqual(searchCatalogueForPicker(products, empty), [], 'no term means no list to scroll');
  }
  assert.deepEqual(searchCatalogueForPicker(products, 'zzz-not-a-product'), []);
});

test('D43 the admin editor writes the mapping into the same homepage setting', () => {
  const page = src('../src/admin/pages/Homepage.jsx');
  assert.match(page, /discoveryPayload\(categoryCards, concernCards\)/, 'sanitised before saving');
  assert.match(page, /adminSetSetting\('homepage'/, 'no new settings key is introduced');
  assert.match(page, /onConcernCardsChange=\{setConcernCards\}/);

  const ctl = src('../src/admin/components/DiscoveryCardControls.jsx');
  assert.match(ctl, /<DiscoveryProductPicker/, 'the picker sits on every card');
  assert.match(ctl, /uploadHomepageImage/, 'the image control is still intact');
  assert.match(ctl, /Use default/, 'clearing back to the built-in image still works');

  // Comments stripped first: the file explains in prose why it is not a
  // <select>, and that sentence must not be read as the markup itself.
  const picker = src('../src/admin/components/DiscoveryProductPicker.jsx').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(picker, /<select/, 'a 149-item select is exactly what this replaces');
  assert.match(picker, /type="search"/, 'selection is search-driven');
  assert.match(picker, /aria-label=\{`Remove /, 'each chosen product can be removed');
  assert.match(picker, /move\(i, -1\)[\s\S]*move\(i, 1\)/, 'chosen products can be reordered');
});

console.log('\n— Discovery cards: the admin-owned model —');

// A catalogue whose names share no words with any concern query, so a curated
// result can only come from an explicit selection.
const CARD_CATALOGUE = [...CURATED, ...OTHER];
const card = (over = {}) => ({ id: 'zeta-shelf', name: 'Zeta Shelf', image: '', productSlugs: [], enabled: true, ...over });

test('D45 the pre-card configuration survives, card for card', () => {
  // Exactly what an admin had saved before this existed: images by slug,
  // concern images by id, and a concern -> products mapping.
  const legacy = {
    categories: { wellness: 'https://cdn.example.com/wellness.jpg' },
    concerns: { detan: 'https://cdn.example.com/detan.jpg' },
    concernProducts: { detan: ['vitamin-c-face-cream-de-tan'] },
  };
  const norm = normalizeDiscovery(legacy);
  assert.equal(norm.categoriesAreCurated, false, 'nothing was curated yet, so these are the built-in rails');
  assert.equal(norm.concernsAreCurated, false);

  const wellness = norm.categoryCards.find((c) => c.id === 'wellness');
  assert.equal(wellness.name, 'Wellness', 'the catalogue name is carried over');
  assert.equal(wellness.image, legacy.categories.wellness, 'the saved image survives');

  const detan = norm.concernCards.find((c) => c.id === 'detan');
  assert.equal(detan.name, 'De-Tan Care');
  assert.equal(detan.group, 'Skin');
  assert.equal(detan.image, legacy.concerns.detan);
  assert.deepEqual(detan.productSlugs, legacy.concernProducts.detan, 'the saved product mapping survives');

  // And every built-in category/concern is present, none invented.
  assert.deepEqual(norm.categoryCards.map((c) => c.id), categories.map((c) => c.slug));
  assert.deepEqual(norm.concernCards.map((c) => c.id), CONCERN_REGISTRY.map((c) => c.id));
});

test('D46 with nothing saved at all the rails are byte-for-byte what they were', () => {
  const fresh = normalizeDiscovery({});
  assert.deepEqual(fresh.categoryCards, defaultCategoryCards(categories, { categories: {} }));
  assert.deepEqual(fresh.concernCards, defaultConcernCards(CONCERN_REGISTRY, { concerns: {} }, {}));
  // The rendered rail is identical to the pre-card selector output.
  const rail = selectCategoryCards(categories, products, { categories: {} }, undefined);
  for (const c of rail) assert.equal(c.to, `/category/${c.slug}`, 'an uncurated card still opens its real category');
});

test('D47 a new card gets a readable, unique, stable id without anyone typing one', () => {
  const taken = ['healthy-skin'];
  assert.equal(makeDiscoveryId('Healthy Skin', []), 'healthy-skin', 'the plain form is used when free');
  const second = makeDiscoveryId('Healthy Skin', taken);
  assert.notEqual(second, 'healthy-skin', 'a collision must not produce a duplicate');
  assert.match(second, /^healthy-skin-[a-z0-9]{1,8}$/, 'and stays recognisable');
  // Names that carry nothing usable still produce a valid id.
  for (const name of ['', '   ', '!!!', '///']) {
    assert.match(makeDiscoveryId(name, []), /^[a-z0-9][a-z0-9-]{0,63}$/);
  }
});

test('D48 renaming a card changes nothing but the label', () => {
  const before = card({ id: 'wellness', name: 'Wellness', image: 'https://cdn.example.com/a.jpg', productSlugs: ['zeta-one'] });
  const after = { ...before, name: 'Daily Wellness' };
  const [clean] = sanitizeDiscoveryCards([after]);
  assert.equal(clean.id, 'wellness', 'the id is what everything hangs on, so it must not move');
  assert.equal(clean.image, before.image, 'the artwork follows the id, not the name');
  assert.deepEqual(clean.productSlugs, before.productSlugs);
  // And the saved link still resolves.
  assert.equal(findCollectionCard('wellness', [clean]).name, 'Daily Wellness');
});

test('D49 a curated category card opens a collection, not the raw category', () => {
  const cards = [card({ id: 'zeta-shelf', name: 'Zeta Shelf', productSlugs: ['zeta-two', 'zeta-one'] })];
  const [rendered] = selectCategoryCards(categories, CARD_CATALOGUE, { categories: {} }, cards);
  assert.equal(rendered.to, '/shop?collection=zeta-shelf');
  assert.equal(rendered.count, 2);
  assert.equal(rendered.source, 'admin');
  assert.deepEqual(
    collectionProducts(cards[0], CARD_CATALOGUE).map((p) => p.slug),
    ['zeta-two', 'zeta-one'],
    'the admin order is the customer order',
  );
});

test('D50 a renamed catalogue card opens the collection so the heading matches the tile', () => {
  const cards = [card({ id: 'wellness', name: 'Daily Wellness' })];
  const [rendered] = selectCategoryCards(categories, products, { categories: {} }, cards);
  assert.equal(rendered.to, '/shop?collection=wellness',
    'a customer must never click "Daily Wellness" and land on a page headed "Wellness"');
  assert.equal(rendered.name, 'Daily Wellness');
  // Still backed by the real category, because nothing was curated.
  assert.equal(rendered.count, getByCategory('wellness').length);
});

test('D51 the homepage follows the admin order exactly', () => {
  const order = ['skin-care', 'wellness', 'hair-care'];
  const cards = order.map((id) => card({ id, name: categories.find((c) => c.slug === id).name }));
  assert.deepEqual(selectCategoryCards(categories, products, { categories: {} }, cards).map((c) => c.id), order);
  const reversed = [...cards].reverse();
  assert.deepEqual(selectCategoryCards(categories, products, { categories: {} }, reversed).map((c) => c.id), [...order].reverse());
});

test('D52 a disabled card leaves the rail and stops resolving', () => {
  const cards = [card({ id: 'wellness', name: 'Wellness', enabled: false }), card({ id: 'skin-care', name: 'Skin Care' })];
  const rail = selectCategoryCards(categories, products, { categories: {} }, cards);
  assert.deepEqual(rail.map((c) => c.id), ['skin-care'], 'a hidden card must not render');
  assert.equal(findCollectionCard('wellness', cards), null, 'nor be reachable by typing its URL');
  assert.equal(shownSlugs(shopPage('collection=wellness', { ...withDiscovery({ categoryCards: cards }) })).length,
    products.length, 'the URL falls back to the full catalogue rather than erroring');
});

test('D53 deleting a card removes the tile and nothing else', () => {
  const catalogueBefore = products.map((p) => p.slug);
  const categoriesBefore = categories.map((c) => c.slug);
  const cards = [card({ id: 'wellness', name: 'Wellness' }), card({ id: 'skin-care', name: 'Skin Care' })];

  const afterDelete = cards.filter((c) => c.id !== 'wellness');
  assert.deepEqual(selectCategoryCards(categories, products, { categories: {} }, afterDelete).map((c) => c.id), ['skin-care']);

  // The catalogue is untouched: same products, same categories, same route.
  assert.deepEqual(products.map((p) => p.slug), catalogueBefore, 'no product may be removed');
  assert.deepEqual(categories.map((c) => c.slug), categoriesBefore, 'no catalogue category may be removed');
  assert.ok(getByCategory('wellness').length > 0, '/category/wellness still resolves to its products');

  // And the editor says so before it happens.
  const ctl = src('../src/admin/components/DiscoveryCardControls.jsx');
  assert.match(ctl, /window\.confirm\(/, 'delete must be confirmed');
  assert.match(ctl, /Products will not be deleted/, 'and must say what it does not do');
});

test('D54 /shop?collection= shows exactly the chosen products and nothing else', () => {
  const cards = [card({ id: 'zeta-shelf', name: 'Zeta Shelf', productSlugs: ['zeta-three', 'zeta-one'] })];
  const html = shopPage('collection=zeta-shelf', {
    products: CARD_CATALOGUE, ...withDiscovery({ categoryCards: cards }),
  });
  assert.match(html, /<h1[^>]*>Zeta Shelf<\/h1>/);
  assert.match(html, /class="v2-shop__count">2 products</);
  assert.deepEqual(shownSlugs(html), ['zeta-three', 'zeta-one']);
  for (const other of OTHER) assert.ok(!html.includes(other.slug), `${other.slug} must not appear`);
});

test('D55 a deleted or unknown collection falls back to Shop instead of breaking', () => {
  for (const query of ['collection=', 'collection=deleted-card', 'collection=../../etc']) {
    const html = shopPage(query, { ...withDiscovery({ categoryCards: [card()] }) });
    assert.match(html, /All products<\/h1>/, `"${query}" must render the normal Shop page`);
    assert.equal(shownSlugs(html).length, products.length);
  }
});

test('D56 missing and deactivated products are skipped in a collection', () => {
  const catalogue = [...CURATED, pick('zeta-retired', { isActive: false })];
  const one = card({ productSlugs: ['zeta-one', 'ghost-product', 'zeta-retired', 'zeta-two'] });
  assert.deepEqual(collectionProducts(one, catalogue).map((p) => p.slug), ['zeta-one', 'zeta-two']);
  const [rendered] = selectCategoryCards(categories, catalogue, { categories: {} }, [one]);
  assert.equal(rendered.count, 2, 'the tile counts what a customer will actually see');
});

console.log('\n— Discovery cards: concerns —');

test('D57 a concern an admin invented stays hidden until it has products', () => {
  const custom = card({ id: 'dark-circles', name: 'Dark Circles', group: 'Skin' });
  const cards = [custom, ...defaultConcernCards(CONCERN_REGISTRY, { concerns: {} }, {})];
  const rail = selectConcernCards(products, CONCERN_REGISTRY, { concerns: {} }, {}, cards);
  assert.ok(!rail.some((c) => c.id === 'dark-circles'),
    'a custom concern has no matcher to fall back on, so an empty one must not ship');
});

test('D58 the same concern appears the moment products are chosen', () => {
  const custom = card({ id: 'dark-circles', name: 'Dark Circles', group: 'Skin', productSlugs: ['zeta-one', 'zeta-two'] });
  const rail = selectConcernCards(CARD_CATALOGUE, CONCERN_REGISTRY, { concerns: {} }, {}, [custom]);
  const found = rail.find((c) => c.id === 'dark-circles');
  assert.ok(found, 'a curated custom concern renders');
  assert.equal(found.count, 2);
  assert.equal(found.label, 'Dark Circles');
  assert.equal(found.source, 'admin');
  assert.equal(found.to, '/shop?concern=dark-circles');
  // Its group still selects the owned Skin artwork rather than a product bottle.
  assert.equal(found.imageSource, 'group');
});

test('D59 an explicit concern list is honoured below the automatic rail minimum', () => {
  // Two curated concerns is a decision. The 3-card minimum only ever existed
  // to stop the BUILT-IN default shipping a thin rail nobody chose.
  const cards = [
    card({ id: 'a-shelf', name: 'A Shelf', productSlugs: ['zeta-one'] }),
    card({ id: 'b-shelf', name: 'B Shelf', productSlugs: ['zeta-two'] }),
  ];
  const rail = selectConcernCards(CARD_CATALOGUE, CONCERN_REGISTRY, { concerns: {} }, {}, cards);
  assert.deepEqual(rail.map((c) => c.id), ['a-shelf', 'b-shelf']);
  // But the untouched default still hides a thin automatic rail.
  assert.deepEqual(selectConcernCards(products, CONCERN_REGISTRY.slice(0, 1)), []);
});

test('D60 concern cards reorder, disable and delete like category cards', () => {
  const mk = (id, name) => card({ id, name, productSlugs: ['zeta-one'] });
  const cards = [mk('a-shelf', 'A'), mk('b-shelf', 'B'), mk('c-shelf', 'C')];
  const ids = (list) => selectConcernCards(CARD_CATALOGUE, CONCERN_REGISTRY, { concerns: {} }, {}, list).map((c) => c.id);

  assert.deepEqual(ids(cards), ['a-shelf', 'b-shelf', 'c-shelf']);
  const moved = [cards[1], cards[0], cards[2]];
  assert.deepEqual(ids(moved), ['b-shelf', 'a-shelf', 'c-shelf'], 'order in the array is order on the page');
  const disabled = cards.map((c) => (c.id === 'b-shelf' ? { ...c, enabled: false } : c));
  assert.deepEqual(ids(disabled), ['a-shelf', 'c-shelf']);
  assert.deepEqual(ids(cards.filter((c) => c.id !== 'a-shelf')), ['b-shelf', 'c-shelf']);
});

test('D61 renaming a built-in concern keeps its id, artwork, products and link', () => {
  const renamed = card({ id: 'detan', name: 'Summer De-Tan', group: 'Skin', image: 'https://cdn.example.com/d.jpg' });
  const [rendered] = selectConcernCards(products, CONCERN_REGISTRY, { concerns: {} }, {}, [renamed]);
  assert.equal(rendered.id, 'detan');
  assert.equal(rendered.label, 'Summer De-Tan');
  assert.equal(rendered.image, 'https://cdn.example.com/d.jpg');
  assert.equal(rendered.to, '/shop?concern=detan');
  // Still backed by the built-in matcher, because nothing was curated.
  assert.equal(rendered.count, concernMatches(CONCERN_REGISTRY.find((c) => c.id === 'detan'), products, {}).length);
  assert.equal(findConcernCard('detan', [renamed]).name, 'Summer De-Tan');
  assert.equal(findConcernCard('summer-de-tan', [renamed]).id, 'detan', 'the new name resolves too');
});

test('D62 /shop?concern= shows a renamed concern under its new name', () => {
  const cards = [card({ id: 'detan', name: 'Summer De-Tan', productSlugs: ['zeta-one', 'zeta-four'] })];
  const html = shopPage('concern=detan', {
    products: CARD_CATALOGUE, ...withDiscovery({ concernCards: cards }),
  });
  assert.match(html, /<h1[^>]*>Summer De-Tan<\/h1>/);
  assert.deepEqual(shownSlugs(html), ['zeta-one', 'zeta-four']);
  assert.match(html, /class="v2-shop__count">2 products</);
});

console.log('\n— Discovery cards: security and storage —');

test('D63 unusable image URLs never reach a card', () => {
  const dirty = sanitizeDiscoveryCards([
    card({ id: 'a', name: 'A', image: 'javascript:alert(1)' }),
    card({ id: 'b', name: 'B', image: '//evil.example/x.png' }),
    card({ id: 'c', name: 'C', image: 'data:text/html,<script>x</script>' }),
    card({ id: 'd', name: 'D', image: 'http://insecure.example/x.png' }),
    card({ id: 'e', name: 'E', image: 'https://cdn.example.com/ok.jpg' }),
  ]);
  assert.deepEqual(dirty.map((c) => c.image), ['', '', '', '', 'https://cdn.example.com/ok.jpg']);
});

test('D64 malformed ids, duplicates, blank names and overflow are all rejected', () => {
  const clean = sanitizeDiscoveryCards([
    card({ id: '../../etc/passwd', name: 'Traversal' }),
    card({ id: 'has space', name: 'Space' }),
    card({ id: '-leading', name: 'Leading dash' }),
    card({ id: 'UPPER', name: 'Uppercased' }),        // lowercased, then valid
    card({ id: 'dup', name: 'First' }),
    card({ id: 'dup', name: 'Second' }),              // duplicate id dropped
    card({ id: 'blank', name: '   ' }),               // no visible name
    card({ id: 'ctrl', name: 'Bad\u0000Name' }),  // control chars stripped
    'not-an-object',
    null,
  ]);
  assert.deepEqual(clean.map((c) => c.id), ['upper', 'dup', 'ctrl']);
  assert.equal(clean.find((c) => c.id === 'dup').name, 'First', 'the first of a duplicate pair wins');
  assert.equal(clean.find((c) => c.id === 'ctrl').name, 'Bad Name');
  assert.equal(sanitizeDiscoveryCards(null).length, 0);
  assert.equal(
    sanitizeDiscoveryCards(Array.from({ length: MAX_DISCOVERY_CARDS + 12 }, (_, i) => card({ id: `c${i}`, name: `C${i}` }))).length,
    MAX_DISCOVERY_CARDS,
  );
});

test('D65 no saved value can surface a product the catalogue is hiding', () => {
  const hidden = pick('zeta-hidden', { isActive: false });
  const catalogue = [...CURATED, hidden];
  const cards = [card({ id: 'zeta-shelf', name: 'Zeta Shelf', productSlugs: ['zeta-hidden', 'zeta-one'] })];
  assert.deepEqual(collectionProducts(cards[0], catalogue).map((p) => p.slug), ['zeta-one']);
  const html = shopPage('collection=zeta-shelf', { products: catalogue, ...withDiscovery({ categoryCards: cards }) });
  assert.ok(!shownSlugs(html).includes('zeta-hidden'), 'a deactivated product stays off the page');
  // The same holds for a concern card, and for a slug that is simply invented.
  assert.deepEqual(concernCardProducts(card({ id: 'x', productSlugs: ['nope', 'zeta-hidden'] }), catalogue), []);
  // Product slugs are the only thing a mapping can name — no free-text query.
  const lib = src('../src/lib/homeDiscovery.js');
  const cleaner = lib.slice(lib.indexOf('function cleanSlugList'), lib.indexOf('export function sanitizeDiscoveryCards'));
  assert.match(cleaner, /SLUG_RE\.test/, 'every stored slug is charset-checked');
});

test('D66 what is saved is exactly what is read back, plus a faithful legacy mirror', () => {
  const cats = [card({ id: 'zeta-shelf', name: 'Zeta Shelf', image: 'https://cdn.example.com/z.jpg', productSlugs: ['zeta-one'] })];
  const cons = [card({ id: 'detan', name: 'De-Tan Care', group: 'Skin', image: 'https://cdn.example.com/d.jpg', productSlugs: ['zeta-two'] })];
  const saved = discoveryPayload(cats, cons);

  // Round trip: reading the payload back gives the same cards, now curated.
  const back = normalizeDiscovery(saved);
  assert.deepEqual(back.categoryCards, saved.categoryCards);
  assert.deepEqual(back.concernCards, saved.concernCards);
  assert.equal(back.categoriesAreCurated, true);
  assert.equal(back.concernsAreCurated, true);

  // The pre-card keys are rewritten from the cards, so an older build still
  // finds every image and mapping exactly where it used to look.
  assert.deepEqual(saved.categories, { 'zeta-shelf': 'https://cdn.example.com/z.jpg' });
  assert.deepEqual(saved.concerns, { detan: 'https://cdn.example.com/d.jpg' });
  assert.deepEqual(saved.concernProducts, { detan: ['zeta-two'] });
  assert.deepEqual(sanitizeDiscoveryImages(saved).concerns, saved.concerns);
  assert.deepEqual(sanitizeConcernProducts(saved.concernProducts), saved.concernProducts);
});

test('D67 the round rail under the hero is not part of this system', () => {
  // It renders real catalogue categories through its own component, and nothing
  // in the card model can reach it.
  const strip = src('../src/components/HomeCategoryStrip.jsx');
  assert.match(strip, /<CategoryRail \/>/, 'the quick-nav rail keeps its original implementation');
  assert.doesNotMatch(strip, /discovery|categoryCards|collection/i, 'and knows nothing about discovery cards');

  const rail = src('../src/components/CategoryRail.jsx');
  assert.match(rail, /categories/, 'it reads the real catalogue categories');
  assert.doesNotMatch(rail, /homeDiscovery|categoryCards|\?collection=/,
    'it must never be routed through the merchandising model');

  const home = src('../src/pages/Home.jsx');
  const order = ['<Hero', '<HomeCategoryStrip', '<HomeOffers', '<ShopByCategory', '<ShopByConcerns'];
  let cursor = -1;
  for (const token of order) {
    const at = home.indexOf(token);
    assert.ok(at > cursor, `${token} is out of order`);
    cursor = at;
  }
});

test('D69 every sibling chip leads somewhere real', () => {
  // Not every configured concern is backed — the built-in list deliberately
  // describes more of the range than this catalogue holds. A chip for one of
  // those would be a link to an empty page.
  const html = shopPage('concern=detan');
  const chips = [...html.matchAll(/class="v2-chip"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*class="v2-chip"/g)]
    .map((m) => m[1] || m[2]);
  const linked = chips.filter((h) => h.startsWith('/shop?concern='))
    .map((h) => decodeURIComponent(h.split('=')[1]));
  assert.ok(linked.length > 0, 'there should be sibling concerns to offer');
  // The chips must be exactly the rail, minus the current card.
  const rail = selectConcernCards().map((c) => c.id);
  assert.deepEqual(linked, rail.filter((id) => id !== 'detan'),
    'the sibling chips are the homepage rail, so neither can offer what the other hides');
  for (const id of linked) {
    assert.ok(concernCardProducts(findConcernCard(id), products).length > 0, `${id} opens an empty page`);
  }
  assert.ok(!linked.includes('acne'), 'an unbacked concern must not be offered');
  assert.ok(!linked.includes('strength'), 'nor one the rail itself judged too thin');
});

test('D68 a card cannot create, rename or delete anything in the catalogue', () => {
  const lib = src('../src/lib/homeDiscovery.js');
  // The module reads the catalogue and never writes to it.
  assert.doesNotMatch(lib, /applyCatalog|applyCategories|adminSetSetting|\.push\(categories|categories\s*=/,
    'homeDiscovery must stay a read-only view of the catalogue');
  const ctl = src('../src/admin/components/DiscoveryCardControls.jsx');
  assert.doesNotMatch(ctl, /adminSaveCategory|adminDeleteProduct|adminSetSetting|from '\.\.\/\.\.\/lib\/adminApi/,
    'the card editor must not reach the catalogue admin API');
  assert.match(ctl, /do not create or change catalogue categories/,
    'and must tell the admin so');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
