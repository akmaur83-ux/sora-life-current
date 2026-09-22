// ============================================================
// The lifestyle storefront (/lifestyle) — shell and homepage. Offline suite.
//
// The roof over the fashion and Home & Living stores: the data layer that
// reads both catalogues (and recomputes nothing), the shell (header with
// the store switcher, the five-tab bottom nav with only Home live, the
// drawer), the homepage in the mockup's order — the 4:5/16:9 hero carousel
// with its 1/3 counter, the Home & Living circles, the fashion doorway
// card, the fashion circles, the two feature tiles, Trending Now from both
// stores with the Add slot reserved and no cart icon, the promo strip —
// the copy corrections (no speed claim, no sustainability claim), every
// word HTML, the three widths with the phone hero scale pinned, and the
// isolation of everything else (one switcher link per shell).
// NO NETWORK, NO DATABASE, NO BROWSER.
//
//   node scripts/test-lifestyle.mjs
//   GROCERY_SRC_ROOT=<pre-change checkout> node scripts/test-lifestyle.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server.mjs';
import { ROOT, read, has, h, loadModule, buildLifestyleApp, loadLifestyleData, INITIAL, HOME_CATEGORIES, HOME_PRODUCTS, FASHION_CATEGORIES, FASHION_PRODUCTS } from './lifestyle-ssr.mjs';
import { REPO, atCommit } from './baseline-export.mjs';

// The tree as it stood before this work: the homepage store doorway release.
const BASELINE_SHA = '9ca51d5';
let passed = 0, failed = 0, current = '(startup)';
process.on('unhandledRejection', (e) => { console.error(`\n  FATAL during: ${current}\n  ${e?.stack || e}`); process.exitCode = 1; });
async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
const text = (html) => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
console.log(`\nsource root: ${ROOT}`);

const NEW_FILES = ['src/data/lifestyleHomepage.js', 'src/lifestyle/LifestyleLayout.jsx', 'src/lifestyle/LifestyleHome.jsx', 'src/styles/lifestyle.css'];
const SPEED_CLAIMS = [/\bfast\b/i, /\bfaster\b/i, /\bexpress\b/i, /\binstant/i, /\bsecure\s+deliver/i, /\breliable\b/i, /\bsame[- ]day\b/i, /\bnext[- ]day\b/i, /\b\d+\s*mins?\b/i, /\bminutes?\b/i, /\bquick\b/i, /\brapid\b/i, /\bspeedy\b/i, /\bdoorstep\b/i];
const PLANET_CLAIMS = [/\bplanet\b/i, /\bsustainab/i, /\beco[- ]?friendly\b/i, /\bthoughtful choices\b/i, /\bsmall choices\b/i, /\bbigger tomorrow\b/i, /\bcarbon\b/i, /\bgreen(er)? choice/i, /\bethical/i, /\bconscious/i];

/** A CSS length at a given container width: 12px, 5vw, max(a, b), clamp(a, b, c). */
function px(expr, W) {
  const e = expr.trim();
  const fn = e.match(/^(clamp|max|min)\((.*)\)$/);
  if (fn) {
    const args = fn[2].split(',').map((a) => px(a, W));
    if (fn[1] === 'max') return Math.max(...args);
    if (fn[1] === 'min') return Math.min(...args);
    return Math.min(Math.max(args[1], args[0]), args[2]);
  }
  const m = e.match(/^(-?[\d.]+)(px|vw|cqw)$/);
  assert.ok(m, `cannot read length ${expr}`);
  return m[2] === 'px' ? Number(m[1]) : (Number(m[1]) / 100) * W;
}
function decl(css, selector, prop) {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `no rule ${selector}`);
  const body = css.slice(at, css.indexOf('}', at));
  const m = body.match(new RegExp(`(?:^|[\\s;{])${prop.replace(/[-]/g, '\\-')}:\\s*([^;]+);`));
  assert.ok(m, `${selector} has no ${prop}`);
  return m[1].trim();
}

// ---- the data layer ----------------------------------------------------
let data = null;
await test('the data layer reads both catalogues and recomputes nothing: fashion circles in the fashion homepage\'s order with fashionArt, prices from each store\'s own view, product links into the right store', () => {
  data = loadLifestyleData({ initial: INITIAL });
  const circles = data.fashionCircles(FASHION_CATEGORIES);
  assert.deepEqual(circles.map((c) => c.slug), ['men', 'women', 'kids', 'beauty', 'footwear', 'bags-accessories'], 'Clothing\'s children, then the other roots');
  assert.deepEqual(circles.map((c) => c.art), ['/img/fashion-circle-men.webp', '/img/fashion-circle-women.webp', '/img/fashion-circle-kids.webp', '/img/fashion-circle-beauty.webp', '/img/fashion-circle-footwear.webp', '/img/fashion-circle-bags.webp']);
  assert.deepEqual(circles.map((c) => c.href), ['/fashion/c/men', '/fashion/c/women', '/fashion/c/kids', '/fashion/c/beauty', '/fashion/c/footwear', '/fashion/c/bags-accessories']);
  for (const a of circles.map((c) => c.art)) assert.ok(has(a.slice(1)), `${a} exists`);
  const fashion = loadModule('src/lib/fashion.js', {});
  const homeliving = loadModule('src/data/homelivingHomepage.js', { supabase: {} });
  for (const row of FASHION_PRODUCTS) {
    const v = data.lifestyleProductView(row, 'fashion'), ref = fashion.productView(row, row.fashion_variants);
    assert.equal(v.price, ref.price, `${row.slug}: the fashion price`); assert.equal(v.mrp, ref.mrp); assert.equal(v.hasDiscount, ref.hasDiscount); assert.equal(v.image, row.images[0]);
    assert.equal(data.productHref(v), `/fashion/p/${row.slug}`);
  }
  for (const row of HOME_PRODUCTS) {
    const v = data.lifestyleProductView(row, 'homeliving'), ref = homeliving.homelivingProductView(row);
    assert.equal(v.price, ref.price, `${row.slug}: the Home & Living price`); assert.equal(v.mrp, ref.mrp); assert.equal(v.image, ref.gallery[0].url);
    assert.equal(data.productHref(v), `/homeliving/p/${row.slug}`);
  }
  assert.equal(data.LIFESTYLE_DELIVERY_WINDOW, homeliving.HOMELIVING_DELIVERY_WINDOW, 'one delivery window');
  assert.equal(data.TALL_MEDIA, '(max-width: 1023px)');
});

await test('trendingOf: each store ranked on its own (bestseller → new → rating → order) and the two interleaved, so four cards show both stores; capped; an empty store yields the other alone', () => {
  const snap = data.getLifestyleCatalogue();
  const row = data.trendingOf(snap.products, 4);
  assert.deepEqual(row.map((p) => p.store), ['fashion', 'homeliving', 'fashion', 'homeliving']);
  assert.deepEqual(row.map((p) => p.slug), ['ethnic-embroidered-kurta-set-sage', 'botanical-bedsheet-set-king', 'cloudstep-minimal-sneakers', 'leaf-cushion-cover-pair'], 'the kurta set (bestseller + new + 4.5) leads fashion; Home & Living in its own order');
  assert.equal(data.trendingOf(snap.products, 2).length, 2);
  assert.deepEqual(data.trendingOf(snap.products.filter((p) => p.store === 'homeliving'), 4).map((p) => p.store), ['homeliving', 'homeliving', 'homeliving', 'homeliving']);
  assert.deepEqual(data.trendingOf([], 4), []);
  const flagged = snap.products.map((p) => (p.store === 'homeliving' && p.slug === 'cotton-quilt-single' ? { ...p, isBestseller: true } : p));
  assert.equal(data.trendingOf(flagged, 4)[1].slug, 'cotton-quilt-single', 'a Home & Living bestseller leads its store');
});

// ---- the shell and the page, rendered through the real router ----------------
const app = await buildLifestyleApp({ cartCount: 3, initial: INITIAL }).catch((e) => ({ error: e }));
const html = app.error ? '' : app.render('/lifestyle');

await test('the shell: menu, centred wordmark as text with the tagline, the four other stores in the header, search and wishlist inert, the cart with its live count; the five-tab bottom nav with only Home live; footer; the drawer closed', () => {
  assert.ok(!app.error, `the app builds: ${app.error?.message}`);
  assert.match(html, /<header class="ls-hdr"><div class="ls-hdr__row"><button type="button" class="ls-hdr__menu" aria-label="Open menu">/);
  assert.match(html, /<a class="ls-logo" aria-label="SORA LIFE lifestyle home" href="\/lifestyle"><strong class="serif">SORA LIFE<\/strong><em>Live a better you<\/em><\/a>/);
  const stores = [...html.matchAll(/<a class="ls-hdr__store" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(stores, ['/', '/fashion', '/homeliving', '/grocery'], 'the other four storefronts, never itself');
  assert.match(html, /<button type="button" class="ls-hdr__act" aria-label="Search \(coming soon\)" aria-disabled="true">/);
  assert.match(html, /<button type="button" class="ls-hdr__act" aria-label="Wishlist \(coming soon\)" aria-disabled="true">/);
  assert.match(html, /<a class="ls-hdr__act" aria-label="Cart, 3 items" href="\/cart">[\s\S]*?<span class="ls-hdr__count">3<\/span><\/a>/);
  const nav = html.match(/<nav class="ls-nav" aria-label="Lifestyle">([\s\S]*?)<\/nav>/)[1];
  assert.deepEqual([...nav.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]), ['Home', 'Shop', 'Categories', 'Saved', 'Account']);
  assert.equal((nav.match(/<a /g) || []).length, 1, 'only Home is a link');
  assert.match(nav, /<a class="ls-nav__item is-on" aria-current="page" href="\/lifestyle">/);
  assert.equal((nav.match(/aria-disabled="true"/g) || []).length, 4, 'the other four render inert — nothing to 404');
  assert.ok(html.includes('data-stub="footer"'), 'the storefront footer');
  assert.doesNotMatch(html, /ls-drawer/, 'the drawer is closed on first paint');
  const empty = app.data; empty.resetLifestyleCatalogue();
  const loading = app.render('/lifestyle');
  assert.match(loading, /Loading the catalogue…/); assert.doesNotMatch(loading, /ls-circle"/, 'no circles before the catalogue');
  empty.seedLifestyleCatalogue(INITIAL);
});

await test('the homepage in the mockup\'s order: hero, Home & Living circles, the fashion card, "Shop Fashion Categories", the feature tiles, "Trending Now", the promo strip; every store link points into /fashion or /homeliving', () => {
  const order = ['class="ls-hero"', 'class="ls-wrap ls-homecats"', 'class="ls-banner"', 'id="ls-fashion-h"', 'class="ls-features"', 'id="ls-trending-h"', 'class="ls-promo"'];
  const at = order.map((s) => html.indexOf(s));
  assert.ok(at.every((i) => i >= 0), `every section renders: ${order.filter((_, i) => at[i] < 0).join(', ')}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in order');
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const links = [...main.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(links.length > 20);
  for (const l of links) assert.match(l, /^\/(fashion|homeliving)(\/|$)/, `${l} leads into a store`);
});

await test('the hero: three slides, each a <picture> — the 4:5 portrait under 1024px, the 16:9 landscape as the <img> — the first eager and high priority; two-line eyebrow, two-line h1, subline, CTA and the script note as HTML; the "1 / 3" counter, progress bar and arrows', () => {
  const hero = html.match(/<section class="ls-hero"[\s\S]*?<\/section>/)[0];
  const slides = hero.split('<article ').slice(1);
  assert.equal(slides.length, 3);
  const expect = [
    { tall: '/img/doorway-living-tall.webp', wide: '/img/doorway-living-wide.webp', eyebrow: ['Beautiful spaces', 'Happier days'], h: ['Make Home', 'a Happier Place'], sub: 'Home essentials for a calmer, warmer and more you.', cta: 'Shop Home &amp; Living', href: '/homeliving', note: 'Good spaces, better days' },
    { tall: '/img/lifestyle-hero-bedroom-tall.webp', wide: '/img/homeliving-hero.webp', eyebrow: ['Bedsheets', 'Quilts &amp; cushions'], h: ['Sleep Softer,', 'Wake Brighter'], sub: 'Cotton bedsheets, quilts and cushion covers for calmer rooms.', cta: 'Shop Bedsheets', href: '/homeliving/category/bedsheets', note: 'Rest well, every night' },
    { tall: '/img/doorway-fashion-tall.webp', wide: '/img/doorway-fashion-wide.webp', eyebrow: ['Your style', 'Your story'], h: ['Fashion', 'for Everyday'], sub: 'Clothing, footwear, bags and more — all in one place.', cta: 'Explore Fashion', href: '/fashion', note: 'Wear what feels you' },
  ];
  slides.forEach((s, i) => {
    const e = expect[i];
    assert.ok(s.includes(`<source media="(max-width: 1023px)" srcSet="${e.tall}"/>`), `slide ${i + 1}: the portrait source`);
    assert.match(s, new RegExp(`<img class="ls-hero__img" src="${e.wide.replace(/\//g, '\\/')}" alt="[^"]{20,}" width="1600" height="900" decoding="async" fetchpriority="${i === 0 ? 'high' : 'auto'}" loading="${i === 0 ? 'eager' : 'lazy'}"`), `slide ${i + 1}: the landscape img, ${i === 0 ? 'eager' : 'lazy'}`);
    for (const f of [e.tall, e.wide]) { assert.ok(has(f.slice(1)), `${f} exists`); assert.ok(statSync(resolve(ROOT, f.slice(1))).size <= 150 * 1024, `${f} under 150 KB`); }
    assert.ok(s.includes(`<p class="ls-hero__eyebrow"><span>${e.eyebrow[0]}</span> <span>${e.eyebrow[1]}</span></p>`), `slide ${i + 1}: two-line eyebrow`);
    assert.ok(s.includes(`<h1 class="ls-hero__h serif"><span>${e.h[0]}</span> <span>${e.h[1]}</span></h1>`), `slide ${i + 1}: two-line headline`);
    assert.ok(s.includes(`<p class="ls-hero__sub">${e.sub}</p>`));
    assert.match(s, new RegExp(`<a class="ls-cta" tabindex="${i === 0 ? '0' : '-1'}" href="${e.href.replace(/\//g, '\\/')}">${e.cta} <svg`), `slide ${i + 1}: the CTA`);
    assert.ok(s.includes(`<p class="ls-hero__note serif" aria-hidden="true">${e.note}</p>`));
    assert.ok(s.indexOf('class="ls-hero__art"') < s.indexOf('class="ls-hero__copy"'), 'art first, the copy on it');
    assert.match(s, new RegExp(`^[^>]*aria-hidden="${i === 0 ? 'false' : 'true'}"`), `slide ${i + 1} ${i === 0 ? 'is' : 'is not'} the current one`);
  });
  assert.match(hero, /<div class="ls-hero__ctl"><p class="ls-hero__count" aria-live="polite"><b>1<\/b> \/ 3<\/p><span class="ls-hero__bar" aria-hidden="true"><i style="width:33\.3+%"><\/i><\/span><button type="button" class="ls-hero__arrow" aria-label="Previous slide">[\s\S]*?<button type="button" class="ls-hero__arrow" aria-label="Next slide">/);
  assert.equal((hero.match(/<img /g) || []).length, 3, 'one photograph per slide, nothing else');
  // One slide: no counter, no arrows.
  const Icon = loadModule('src/components/Icon.jsx').default;
  const home = loadModule('src/lifestyle/LifestyleHome.jsx', { Link, Icon, money: (n) => `₹${n}`, ...app.data });
  const one = renderToStaticMarkup(h(StaticRouter, { location: '/lifestyle' }, h(home.HeroCarousel, { slides: [app.data.HERO_SLIDES[0]] })));
  assert.equal((one.match(/<article /g) || []).length, 1); assert.doesNotMatch(one, /ls-hero__ctl|ls-hero__arrow|ls-hero__count/);
  assert.equal(renderToStaticMarkup(h(StaticRouter, { location: '/lifestyle' }, h(home.HeroCarousel, { slides: [] }))), '');
});

await test('the circles: six Home & Living (catalogue names, image_url, /homeliving/category/<slug>) and six fashion under "Shop Fashion Categories / View All" (/fashion/c/<slug>, fashionArt); the fashion card links to /fashion with its copy on the photo', () => {
  const home = html.match(/<section class="ls-wrap ls-homecats"><nav class="ls-circles" aria-label="Shop Home &amp; Living by category">([\s\S]*?)<\/nav><\/section>/);
  assert.ok(home, 'the Home & Living circles, without a heading, as in the mockup');
  const hc = [...home[1].matchAll(/<a class="ls-circle" href="([^"]+)"><span class="ls-circle__img"><img src="([^"]+)" alt="" loading="lazy" decoding="async" width="200" height="200"\/><\/span><span class="ls-circle__name">([^<]+)<\/span><\/a>/g)];
  assert.deepEqual(hc.map((m) => m[1]), HOME_CATEGORIES.map((c) => `/homeliving/category/${c.slug}`));
  assert.deepEqual(hc.map((m) => m[2]), HOME_CATEGORIES.map((c) => c.image_url));
  assert.deepEqual(hc.map((m) => m[3].replace('&amp;', '&')), HOME_CATEGORIES.map((c) => c.name), 'the catalogue names, not the mockup\'s shortened ones');
  const fashion = html.match(/<section class="ls-wrap ls-sec" aria-labelledby="ls-fashion-h">([\s\S]*?)<\/section>/)[1];
  assert.match(fashion, /<h2 class="ls-sec__h serif" id="ls-fashion-h">Shop Fashion Categories<\/h2><a class="ls-sec__link" href="\/fashion">View All <svg/);
  const fc = [...fashion.matchAll(/<a class="ls-circle" href="([^"]+)"><span class="ls-circle__img"><img src="([^"]+)"[^>]*\/><\/span><span class="ls-circle__name">([^<]+)<\/span><\/a>/g)];
  assert.deepEqual(fc.map((m) => m[1]), ['/fashion/c/men', '/fashion/c/women', '/fashion/c/kids', '/fashion/c/beauty', '/fashion/c/footwear', '/fashion/c/bags-accessories']);
  assert.deepEqual(fc.map((m) => m[2]), ['/img/fashion-circle-men.webp', '/img/fashion-circle-women.webp', '/img/fashion-circle-kids.webp', '/img/fashion-circle-beauty.webp', '/img/fashion-circle-footwear.webp', '/img/fashion-circle-bags.webp']);
  const banner = html.match(/<a class="ls-banner" aria-labelledby="ls-banner-h ls-banner-cta" href="\/fashion">([\s\S]*?)<\/a>/);
  assert.ok(banner, 'the fashion card is one whole-card link');
  assert.match(banner[1], /<div class="ls-banner__art"><img src="\/img\/doorway-fashion-wide\.webp" alt="[^"]{20,}" width="1600" height="900" loading="lazy" decoding="async"\/><\/div><div class="ls-banner__copy">/);
  assert.ok(banner[1].includes('<p class="ls-eyebrow ls-banner__eyebrow"><span>Your style</span> <span>Your story</span></p><h2 class="ls-banner__h serif" id="ls-banner-h"><span>Fashion</span> <span>for Everyday</span></h2><p class="ls-banner__sub">Clothing, footwear, bags and more — all in one place.</p><span class="ls-cta ls-cta--sm" id="ls-banner-cta">Explore Fashion <svg'));
  assert.ok(banner[1].includes('<p class="ls-banner__note serif" aria-hidden="true">Wear what feels you</p>'));
});

await test('the corrections: feature tiles read "Natural Fabrics / Cotton, linen and jute" and "Standard Delivery / 6-7 days"; the promo reads "Made for everyday living" with "Shop Home & Living"; no speed claim and no sustainability claim anywhere in the new code or the render', () => {
  assert.match(html, /<ul class="ls-features" aria-label="What to expect"><li><span class="ls-features__icon"><svg[\s\S]*?<\/svg><\/span><span class="ls-features__txt"><strong>Natural Fabrics<\/strong><em>Cotton, linen and jute<\/em><\/span><\/li><li><span class="ls-features__icon"><svg[\s\S]*?<\/svg><\/span><span class="ls-features__txt"><strong>Standard Delivery<\/strong><em>6-7 days<\/em><\/span><\/li><\/ul>/);
  assert.match(html, /<div class="ls-promo" aria-labelledby="ls-promo-h"><div class="ls-promo__art" aria-hidden="true"><img src="\/img\/homeliving-promo\.webp" alt="" loading="lazy"[^>]*\/><\/div><p class="ls-promo__h" id="ls-promo-h">Made for everyday living<\/p><a class="ls-cta ls-cta--paper" href="\/homeliving">Shop Home &amp; Living <svg/);
  const t = text(html);
  const sources = NEW_FILES.map((f) => [f, stripComments(read(f))]).concat([['render', t]]);
  for (const [name, src] of sources) {
    for (const re of SPEED_CLAIMS) assert.doesNotMatch(src, re, `${name}: speed claim ${re}`);
    for (const re of PLANET_CLAIMS) assert.doesNotMatch(src, re, `${name}: sustainability claim ${re}`);
  }
  for (const s of ['Fast', 'Reliable', 'Thoughtful Choices', 'Small Choices', 'Shop Sustainable', 'Right to your doorstep']) assert.ok(!t.includes(s), `the mockup's "${s}" does not ship`);
});

await test('Trending Now: four whole-card links from both stores to their product pages — image, name, price (the store\'s own) — the Add slot reserved (data-slot="add-to-cart"), no cart icon and no button; the heart is inert; "View All" links into a store', () => {
  const sec = html.match(/<section class="ls-wrap ls-sec" aria-labelledby="ls-trending-h">([\s\S]*?)<\/section>/)[1];
  assert.match(sec, /<h2 class="ls-sec__h ls-sec__h--rule serif" id="ls-trending-h">Trending Now<\/h2><a class="ls-sec__link" href="\/(fashion|homeliving)[^"]*">View All <svg/);
  const cards = [...sec.matchAll(/<a class="ls-card" data-store="(fashion|homeliving)" href="([^"]+)">([\s\S]*?)<\/a>/g)];
  assert.equal(cards.length, 4);
  assert.deepEqual(cards.map((c) => c[1]), ['fashion', 'homeliving', 'fashion', 'homeliving'], 'both stores, interleaved');
  const snap = app.data.getLifestyleCatalogue();
  const expected = app.data.trendingOf(snap.products, 4);
  cards.forEach((c, i) => {
    const p = expected[i];
    assert.equal(c[2], app.data.productHref(p));
    assert.match(c[3], new RegExp(`<span class="ls-card__media"><img src="${p.image.replace(/\//g, '\\/')}" alt="" loading="${i < 2 ? 'eager' : 'lazy'}"`), `${p.slug}: the photo, first two eager`);
    assert.ok(c[3].includes(`<span class="ls-card__name">${p.name.replace(/&/g, '&amp;')}</span>`));
    assert.ok(c[3].includes(`<span class="ls-price"><strong>₹${p.price.toLocaleString('en-IN')}</strong>`), `${p.slug}: the price`);
    assert.ok(c[3].includes('<span class="ls-card__slot" data-slot="add-to-cart" aria-hidden="true"></span>'), 'the Add slot is reserved and empty');
    assert.doesNotMatch(c[3], /<button|<a /, 'nothing interactive inside the card link');
    assert.match(c[3], /<span class="ls-card__heart" aria-hidden="true">/);
  });
  assert.doesNotMatch(sec, /aria-label="Add [^"]*cart"|name="bag"|ls-card__cart/, 'no cart icon that is not a cart');
});

await test('text rule: every hero and banner photograph has a real description, every other image is decorative, every label is text; no text lives in an image', () => {
  const imgs = [...html.matchAll(/<img ([^>]*)>/g)].map((m) => m[1]);
  assert.ok(imgs.length >= 3 + 1 + 6 + 6 + 4 + 1, `${imgs.length} images`);
  for (const a of imgs) assert.match(a, /alt="[^"]*"/, 'every image declares alt');
  assert.equal(imgs.filter((a) => /alt="[^"]{20,}"/.test(a)).length, 4, 'the three hero photographs and the fashion card carry descriptions; the rest are decorative');
  for (const s of ['Home', 'Shop', 'Categories', 'Saved', 'Account', 'Shop Fashion Categories', 'Trending Now', 'View All', 'Natural Fabrics', 'Standard Delivery', 'Made for everyday living']) assert.ok(text(html).includes(s), s);
});

// ---- the stylesheet ------------------------------------------------------
const css = has('src/styles/lifestyle.css') ? stripComments(read('src/styles/lifestyle.css')) : '';
const wideAt = css.indexOf('@media (min-width: 1024px)');
const base = css.slice(0, css.indexOf('@media (hover: hover)'));
const wide = css.slice(wideAt, css.indexOf('\n}\n', wideAt) + 3);

await test('390 and 768 (the base sheet): the hero is a 4:5 portrait with the copy in grid cell 1/1 over the art, top-aligned, under a top-down cream wash; the circles and the product row scroll sideways; the bottom nav is fixed', () => {
  assert.equal(decl(base, '.ls-hero__art', 'aspect-ratio'), '4 / 5');
  assert.equal(decl(base, '.ls-hero__art', 'grid-area'), '1 / 1'); assert.equal(decl(base, '.ls-hero__copy', 'grid-area'), '1 / 1', 'the copy shares the photo\'s cell: on it, not below it');
  assert.equal(decl(base, '.ls-hero__copy', 'align-self'), 'start'); assert.match(decl(base, '.ls-hero__copy', 'z-index'), /^[1-9]/);
  assert.match(decl(base, '.ls-hero__art::after', 'background'), /^linear-gradient\(180deg, #f6efe3[0-9a-f]{2} 0%.*#f6efe300 (5\d|6[0-4])%\)$/);
  assert.equal(decl(base, '.ls-hero__img', 'object-fit'), 'cover');
  assert.match(decl(base, '.ls-circles', 'overflow-x'), /^auto$/); assert.match(decl(base, '.ls-row', 'overflow-x'), /^auto$/);
  assert.equal(decl(base, '.ls-features', 'grid-template-columns'), 'repeat(2, minmax(0, 1fr))', 'two tiles side by side on a phone');
  assert.equal(decl(base, '.ls-nav', 'position'), 'fixed');
  assert.equal(decl(base, '.ls-hdr__stores', 'display'), 'none', 'the header switcher waits for a wide screen; the drawer carries it');
  assert.doesNotMatch(css, /@media \(max-width: 1023px\)|@media \(max-width: 599px\)/, 'mobile first: the base sheet is the phone; 768 gets the same portrait treatment');
});

await test('the phone hero scale is pinned: the five tokens exactly, and at 360 and 390 the copy stack ends above 46% of the 4:5 art, where the portrait subjects begin', () => {
  const tokens = { '--ls-hero-pad': 'clamp(16px, 4.6vw, 18px)', '--ls-hero-eyebrow': 'clamp(10px, 2.7vw, 10.5px)', '--ls-hero-h': 'clamp(28px, 8.2vw, 32px)', '--ls-hero-sub': 'clamp(13px, 3.6vw, 14px)', '--ls-hero-cta': 'clamp(40px, 11.3vw, 44px)' };
  for (const [k, v] of Object.entries(tokens)) assert.equal(decl(base, '.ls-hero__copy', k), v, k);
  assert.equal(decl(base, '.ls-hero__eyebrow', 'font-size'), 'var(--ls-hero-eyebrow)'); assert.equal(decl(base, '.ls-hero__h', 'font-size'), 'var(--ls-hero-h)');
  assert.equal(decl(base, '.ls-hero__sub', 'font-size'), 'var(--ls-hero-sub)'); assert.equal(decl(base, '.ls-hero__copy .ls-cta', 'min-height'), 'var(--ls-hero-cta)');
  const stack = (W) => px(tokens['--ls-hero-pad'], W)
    + px(tokens['--ls-hero-eyebrow'], W) * Number(decl(base, '.ls-hero__eyebrow', 'line-height')) * 2 + px(decl(base, '.ls-hero__eyebrow', 'margin').split(/\s+/)[2], W)
    + px(tokens['--ls-hero-h'], W) * Number(decl(base, '.ls-hero__h', 'line-height')) * 2 + px(decl(base, '.ls-hero__h', 'margin').split(/\s+/)[2], W)
    + px(tokens['--ls-hero-sub'], W) * Number(decl(base, '.ls-hero__sub', 'line-height')) * 2 + px(decl(base, '.ls-hero__sub', 'margin').split(/\s+/)[2], W)
    + px(tokens['--ls-hero-cta'], W);
  for (const W of [360, 390]) {
    const need = stack(W), art = W * 1.25;
    assert.ok(need / art <= 0.46, `${W}: the copy stack ends at ${((need / art) * 100).toFixed(1)}% of the art`);
  }
  assert.equal(decl(base, '.ls-hero__sub', 'max-width'), '30ch', 'two lines for every subline at 390px');
});

await test('1280 (from 1024): the hero is the 16:9 landscape cropped to 16:7 with the copy on the left under a left-to-right wash; six circles in a row, four cards across, the switcher in the header, the nav a static strip', () => {
  assert.equal(decl(wide, '.ls-hero__art', 'aspect-ratio'), '16 / 7');
  assert.match(decl(wide, '.ls-hero__art::after', 'background'), /^linear-gradient\(90deg, #f6efe3[0-9a-f]{2} 0%.*#f6efe300 (5\d|6[0-4])%\)$/);
  assert.match(decl(wide, '.ls-hero__copy', 'width'), /^min\((3\d|4[0-2])%, \d+px\)$/, 'the copy column stays left of the subjects (fashion from 44%, living from 50%)');
  assert.equal(decl(wide, '.ls-hero__copy', 'align-self'), 'center');
  assert.equal(decl(wide, '.ls-circles', 'grid-template-columns'), 'repeat(6, minmax(0, 1fr))');
  assert.equal(decl(wide, '.ls-row', 'grid-template-columns'), 'repeat(4, minmax(0, 1fr))');
  assert.equal(decl(wide, '.ls-hdr__stores', 'display'), 'inline-flex');
  assert.equal(decl(wide, '.ls-nav', 'position'), 'static');
  assert.equal(decl(wide, '.ls-banner__art', 'aspect-ratio'), '5 / 2'); assert.match(decl(wide, '.ls-banner__copy', 'width'), /^4[0-8]%$/);
});

await test('motion and namespace: transitions on transform, opacity and box-shadow only; the track slides on transform; reduced motion stills everything; every selector starts with .ls', () => {
  for (const m of css.matchAll(/transition:\s*([^;]+);/g)) for (const part of m[1].replace(/\([^)]*\)/g, '').split(',')) assert.match(part.trim(), /^(?:transform|opacity|box-shadow|none)\b/, `transition on ${part.trim()}`);
  assert.match(css, /\.ls-hero__track \{ display: flex; transition: transform \.5s ease; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.ls \*, \.ls \*::before, \.ls \*::after \{ transition: none !important; \}/);
  assert.ok(css.split('\n').filter((l) => /^[.]/.test(l)).every((l) => l.startsWith('.ls')), 'every selector is namespaced .ls');
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /^(?!\s*[.@}]|\s*$)[a-z:*][^{]*\{/m, 'no bare element or :root rule');
});

// ---- wiring and isolation ------------------------------------------------
await test('App.jsx mounts /lifestyle as a sibling shell with an index page; the sheet is deferred after homeliving.css and fetched on /lifestyle; each other shell gained exactly its switcher link; nothing else changed', () => {
  const appSrc = read('src/App.jsx');
  assert.match(appSrc, /import LifestyleLayout from '\.\/lifestyle\/LifestyleLayout\.jsx';\nimport LifestyleHome from '\.\/lifestyle\/LifestyleHome\.jsx';/);
  assert.match(appSrc, /<Route path="\/lifestyle" element=\{<LifestyleLayout \/>\}>\n\s+<Route index element=\{<LifestyleHome \/>\} \/>\n\s+<\/Route>/);
  assert.equal(appSrc.replace("import LifestyleLayout from './lifestyle/LifestyleLayout.jsx';\nimport LifestyleHome from './lifestyle/LifestyleHome.jsx';\n", '').replace(/\n\s*\{\/\*[^*]*lifestyle[^*]*\*\/\}\n\s+<Route path="\/lifestyle" element=\{<LifestyleLayout \/>\}>\n\s+<Route index element=\{<LifestyleHome \/>\} \/>\n\s+<\/Route>\n/, '\n'), atCommit(BASELINE_SHA, 'src/App.jsx'), 'App.jsx: the imports and the route, nothing else');
  const buildCss = read('build/build-css.mjs');
  assert.match(buildCss, /'src\/styles\/homeliving\.css',\n(\s*\/\/[^\n]*\n)*\s*'src\/styles\/lifestyle\.css',\n\];/, 'lifestyle.css is the last deferred sheet');
  assert.match(read('src/lib/deferredStyles.js'), /\(admin\|passport\|creator\|fashion\|grocery\|homeliving\|lifestyle\)/);
  // Each shell: the diff against the baseline is additions only, every added line about /lifestyle.
  // The homepage rework (test-homeliving-hero.mjs): the hero runs to the top with the shell floating over it — an approved change to the store's own homepage files; that suite pins the category and product pages unchanged.
  for (const rel of ['src/components/Header.jsx', 'src/fashion/FashionLayout.jsx', 'src/grocery/GroceryLayout.jsx']) {
    const diff = execFileSync('git', ['diff', BASELINE_SHA, '--', rel], { cwd: REPO, encoding: 'utf8' }).split('\n').filter((l) => /^[-+]/.test(l) && !/^(\+\+\+|---)/.test(l));
    assert.ok(diff.length >= 2 && diff.length <= 4, `${rel}: one bar link and one drawer link (${diff.length} lines)`);
    for (const l of diff) { assert.match(l, /^\+/, `${rel}: additions only — ${l}`); assert.match(l, /\/lifestyle"/, `${rel}: about /lifestyle — ${l}`); }
  }
  const changed = new Set(execFileSync('git', ['diff', '--name-only', BASELINE_SHA], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean));
  // The homepage doorway was rebuilt around the Lifestyle banner (test-store-doorway.mjs) — an approved change to its own two files.
  // The homepage doorway split (test-store-doorway.mjs): Home.jsx mounts the Lifestyle banner and the store carousel — an approved change.
  // The display typeface swap (test-typeface.mjs) touched index.html and most stylesheets — an approved change; that suite pins the sheets it must not have touched.
  // Three approved changes landed beside this section and moved files these pins guard:
  //   86ea8cf  src/components/Hero.jsx   — the wellness hero drops the Supabase render-transform URLs (test-homepage-appearance.mjs)
  //   e58317c  src/fashion/FashionHome.jsx — the campaign hero leads /fashion (test-fashion.mjs pins the new order)
  //   a651320  src/pages/Legal.jsx       — the shipping policy rewrite (test-company-surfaces.mjs pins the policy)
  const allowed = /^(src\/lifestyle\/|src\/data\/lifestyleHomepage\.js$|src\/components\/Hero\.jsx$|src\/fashion\/FashionHome\.jsx$|src\/pages\/Legal\.jsx$|src\/styles\/lifestyle\.css$|img\/lifestyle-|src\/components\/FashionBanner\.jsx$|src\/styles\/fashion-banner\.css$|src\/pages\/Home\.jsx$|src\/styles\/[a-z0-9-]+\.css$|index\.html$|src\/App\.jsx$|build\/build-css\.mjs$|src\/lib\/deferredStyles\.js$|src\/components\/Header\.jsx$|src\/fashion\/FashionLayout\.jsx$|src\/grocery\/GroceryLayout\.jsx$|src\/homeliving\/(HomeLivingLayout|HomeLivingHome)\.jsx$|src\/data\/homelivingHomepage\.js$|img\/homeliving-hero-|scripts\/|public\/|reports\/)/;
  const bad = [...changed].filter((f) => !allowed.test(f));
  assert.deepEqual(bad, [], `unexpected files changed: ${bad.join(', ')}`);
  for (const rel of ['src/lib/store.jsx', 'src/lib/cartLine.js', 'src/lib/payments.js', 'src/lib/customerAuth.jsx', 'src/pages/Cart.jsx', 'src/pages/Checkout.jsx', 'src/lib/fashionApi.js', 'src/lib/fashion.js', 'src/fashion/fashionArt.js']) {
  // src/fashion/FashionHome.jsx moved its campaign hero to the top of the page (e58317c);
  // test-fashion.mjs pins the new order and test-catalogue.mjs the rendered markup, so it is no longer asserted byte-identical here.

    assert.equal(read(rel), atCommit(BASELINE_SHA, rel).replace(/\r\n/g, '\n'), `${rel} is byte-identical to ${BASELINE_SHA}`);
  }
  assert.ok(!(readFileSync(resolve(ROOT, 'src/data/lifestyleHomepage.js'), 'utf8').includes("from('")), 'the lifestyle data layer issues no query of its own — it reads through the two stores');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
