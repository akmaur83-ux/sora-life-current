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
import {
  selectCategoryCards, selectConcernCards, concernMatches, concernDestination,
  CONCERN_REGISTRY, MIN_CONCERN_PRODUCTS, sanitizeDiscoveryImages,
} from '../src/lib/homeDiscovery.js';

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
      assert.equal(to, `/shop?q=${encodeURIComponent(concern.query)}`);
      // The link opens exactly the set the card was measured on.
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
  assert.match(page, /<DiscoveryImageControls/, 'the control must be mounted on Admin -> Homepage');
  assert.match(page, /sanitizeDiscoveryImages\(discovery\)/, 'values are sanitised before saving');
  assert.match(page, /discovery: cleanDiscovery/, 'saved inside the existing homepage setting');
  assert.match(page, /adminSetSetting\('homepage'/, 'no new settings key is introduced');
  const ctl = src('../src/admin/components/DiscoveryImageControls.jsx');
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

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
