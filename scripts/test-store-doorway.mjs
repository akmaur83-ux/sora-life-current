// ============================================================
// The homepage store doorway ("Two Worlds. A Better You.") — offline suite.
//
// Part A, the Lifestyle banner, in the women's page's language: full-bleed,
// square-edged, uppercase Inter, one whole-banner link over one photograph
// with every word on it as HTML — over the sky on the left of the wide
// shot from 701px, over a fade at the foot of the 3:4 portrait below;
// nothing beneath the image;
// its height from the width, never aspect-ratio with a min/max height.
// Directly beneath it, the fashion category strip: women's and men's tiles
// in turn, each opening its own listing, a tile without its photograph left
// out; a transform-only track that advances on its own, pauses on hover and
// focus, never moves under reduced motion, with arrows and a swipe; no
// rounded corner anywhere in either. Part B, the two store cards
// as one carousel: one slide in view on a transform-only track, autoplay
// that pauses on hover and focus and never runs under reduced motion,
// dots, a swipe. The images (under 150 KB each), the copy, the cream wash,
// the phone scale pinned so the copy cannot creep into the subject, the
// carousel cards smaller than the banner at every width, no speed claim,
// no sustainability claim, and the isolation of everything else.
// NO NETWORK, NO DATABASE, NO BROWSER.
//
//   node scripts/test-store-doorway.mjs
//   GROCERY_SRC_ROOT=<pre-change checkout> node scripts/test-store-doorway.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link, useLocation } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server.mjs';
import { ROOT, read, has, h, loadModule } from './grocery-ssr.mjs';
import { REPO, atCommit } from './baseline-export.mjs';
import { CART_CHANGE_EDITS, DEPLOY_CONFIG_FILES, FASHION_DEPARTMENT_EDITS, FASHION_DEPARTMENT_FILES, HOMELIVING_CART_FILES, STOREFRONT_ADMIN_FILES, STOREFRONT_SETTINGS_READS, sansStorefrontChanges, SCROLL_MANAGER_EDITS, SCROLL_MANAGER_FILES, FASHION_PDP_THUMBS_EDITS } from './storefront-settings-pin.mjs';

// The tree as it stood before this work: the carousel-move release.
const BASELINE_SHA = 'b582caa';
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

const SPEED_CLAIMS = [/\bfast\b/i, /\bfaster\b/i, /\bexpress\b/i, /\binstant/i, /\bsecure\s+deliver/i, /\breliable\b/i, /\bsame[- ]day\b/i, /\bnext[- ]day\b/i, /\b\d+\s*mins?\b/i, /\bminutes?\b/i, /\bquick\b/i, /\brapid\b/i, /\bspeedy\b/i, /\bdoorstep\b/i];
const PLANET_CLAIMS = [/\bplanet\b/i, /\bsustainab/i, /\beco[- ]?friendly\b/i, /\bthoughtful choices\b/i, /\bsmall choices\b/i, /\bbigger tomorrow\b/i, /\bcarbon\b/i, /\bgreen(er)? choice/i, /\bethical/i, /\bconscious/i];
const IMAGES = {
  'img/fashion-editorial/women-edit-tailoring-1898.webp': [1898, 829],
  'img/fashion-editorial/women-main-hero-mobile.webp': [900, 1200],
  'img/doorway-fashion-wide.webp': [1600, 900],
  'img/doorway-living-wide.webp': [1600, 900],
  'img/doorway-fashion-tall.webp': [1000, 1250],
  'img/doorway-living-tall.webp': [1000, 1250],
};
/** The alphas of a cream gradient, in order: a wash with no seam falls monotonically, in steps no bigger than .3, to 0. */
function alphas(gradient) { return [...gradient.matchAll(/rgba\(246, 239, 227, (\.\d+|0|1)\)/g)].map((m) => Number(m[1])); }
function assertSmooth(gradient, label) {
  const a = alphas(gradient);
  assert.ok(a.length >= 5, `${label}: at least five stops (${a.length})`);
  for (let i = 1; i < a.length; i++) assert.ok(a[i] <= a[i - 1] && a[i - 1] - a[i] <= 0.3, `${label}: stop ${i} ${a[i - 1]}→${a[i]} is a seam`);
  assert.equal(a[a.length - 1], 0, `${label}: fades to nothing`);
  assert.ok(a[0] >= 0.8, `${label}: strong under the copy`);
}

/** Width and height from a WebP header (simple lossy 'VP8 ', lossless 'VP8L' or extended 'VP8X'). */
function webpSize(buf) {
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF'); assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (chunk === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  if (chunk === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  throw new Error(`unknown WebP chunk ${chunk}`);
}
/** A CSS length at a given container width: 12px, 5.4cqw, 3vw, max/min/clamp(). */
function px(expr, W) {
  const e = expr.trim();
  const fn = e.match(/^(clamp|max|min)\((.*)\)$/);
  if (fn) {
    const args = fn[2].split(',').map((a) => px(a, W));
    if (fn[1] === 'max') return Math.max(...args);
    if (fn[1] === 'min') return Math.min(...args);
    return Math.min(Math.max(args[1], args[0]), args[2]);
  }
  const m = e.match(/^(-?[\d.]+)(px|cqw|vw)$/);
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

// ---- the images ---------------------------------------------------------
await test('the images: the banner pair from the women\'s page set (the wide tailoring shot, the women\'s hero portrait) and the two store cards\' pairs (16:9 landscape, 4:5 portrait), each under 150 KB, at the sizes the markup declares', () => {
  for (const [rel, [w, hgt]] of Object.entries(IMAGES)) {
    assert.ok(has(rel), `${rel} is missing`);
    const size = statSync(resolve(ROOT, rel)).size;
    assert.ok(size <= 150 * 1024, `${rel} is ${(size / 1024).toFixed(0)} KB`);
    assert.deepEqual(webpSize(readFileSync(resolve(ROOT, rel))), [w, hgt], `${rel} dimensions`);
  }
});

// ---- the component, rendered ---------------------------------------------
const Icon = loadModule('src/components/Icon.jsx').default;
const DeferredImage = loadModule('src/components/DeferredImage.jsx').default;
const FashionEntryLink = loadModule('src/components/FashionEntryLink.jsx', { Link, useLocation, Icon }).default;
const mod = loadModule('src/components/FashionBanner.jsx', { Link, Icon, DeferredImage, FashionEntryLink });
// A tree without the two exports (the pre-change tree) renders nothing here and fails each test on its own.
const safe = (C) => { try { return C ? renderToStaticMarkup(h(StaticRouter, { location: '/' }, h(C))) : ''; } catch { return ''; } };
const render = (m) => safe(m.LifestyleBanner) + safe(m.StoreCarousel);
const bannerHtml = safe(mod.LifestyleBanner);
const carouselHtml = safe(mod.StoreCarousel);
const html = bannerHtml + carouselHtml;
// The banner section and the strip section LifestyleBanner renders, one after the other.
const leadHtml = bannerHtml.match(/^<section class="fsb-lead"[\s\S]*?<\/section>/)?.[0] || '';
const stripHtml = bannerHtml.match(/<section class="fsb-strip"[\s\S]*<\/section>$/)?.[0] || '';
const EagerImage = ({ src, sources = [], loading, decoding, fetchPriority, ...props }) =>
  sources.length ? h('picture', null, ...sources.map((s) => h('source', { key: s.media, media: s.media, srcSet: s.srcSet })), h('img', { ...props, src })) : h('img', { ...props, src });
const eager = render(loadModule('src/components/FashionBanner.jsx', { Link, Icon, DeferredImage: EagerImage, FashionEntryLink }));

await test('two sections, placed independently: LifestyleBanner is the full-bleed banner with no heading above it and the fashion category strip directly beneath; StoreCarousel is the heading and lede over the two store cards; no default export; no control inside any card link', () => {
  assert.equal(mod.default, undefined, 'no combined default export any more');
  assert.match(bannerHtml, /^<section class="fsb-lead" aria-labelledby="fsb-lifestyle-h fsb-lifestyle-cta"><a class="fsb-lead__link" aria-labelledby="fsb-lifestyle-h fsb-lifestyle-cta" href="\/lifestyle">/, 'the banner section is one whole-banner link, outside any page-width wrapper');
  assert.equal(bannerHtml, leadHtml + stripHtml, 'the strip follows the banner directly, nothing between');
  assert.match(stripHtml, /^<section class="fsb-strip" aria-labelledby="fsb-strip-h">/);
  assert.doesNotMatch(bannerHtml, /fsb__intro|Two Worlds|More to explore|fsb__carousel|v2-wrap/, 'no store heading and no wrapper on the banner');
  assert.deepEqual([...leadHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ['/lifestyle']);
  assert.match(carouselHtml, /^<section class="v2-sec fsb" aria-labelledby="fsb-h" id="more-to-explore"><div class="v2-wrap"><header class="fsb__intro"><p class="fsb__eyebrow fsb__overline">More to explore<\/p><h2 id="fsb-h">Two Worlds\. A Better You\.<\/h2><p class="fsb__lede">Fashion for your style\. Living for your space\. All at SORA LIFE\.<\/p><\/header><div class="fsb__carousel"/, 'the heading moved with the carousel');
  assert.doesNotMatch(carouselHtml, /fsb__card--lead|\/lifestyle/, 'the banner is not in the carousel section');
  assert.deepEqual([...carouselHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ['/fashion', '/homeliving']);
  for (const a of html.matchAll(/<a [^>]*>[\s\S]*?<\/a>/g)) assert.doesNotMatch(a[0].slice(2), /<button|<a /, 'nothing interactive inside a card link');
});

await test('Home.jsx: LifestyleBanner sits directly after the offers; StoreCarousel sits directly above the popular rail (the slot, not its title — "Worth discovering" becomes "Bestsellers" with verified data); each once; nothing else in Home.jsx changed', () => {
  const home = read('src/pages/Home.jsx');
  assert.equal((home.match(/<LifestyleBanner \/>/g) || []).length, 1); assert.equal((home.match(/<StoreCarousel \/>/g) || []).length, 1);
  assert.doesNotMatch(home, /FashionBanner \/>|import FashionBanner/, 'the combined component is gone from the page');
  assert.match(home, /<HomeOffers[^>]*\/>\s*(\{\/\*[\s\S]*?\*\/\})?\s*<LifestyleBanner \/>/, 'the banner after the offers');
  assert.match(home, /<DiscoveryEdit[^>]*\/>\s*(\{\/\*[\s\S]*?\*\/\})?\s*<StoreCarousel \/>\s*(\{\/\*[\s\S]*?\*\/\})?\s*<MarketplaceProductRail\s+id="popular"/, 'the carousel between the discovery edit and the popular rail');
  assert.equal(home, atCommit(BASELINE_SHA, 'src/pages/Home.jsx').replace(/\r\n/g, '\n'), 'Home.jsx is untouched since the carousel move');
});

await test('Part A: the <picture> takes the women\'s hero portrait up to 700px and the wide tailoring shot above; eyebrow "Live beautifully", "Lifestyle Store", the subline and "Explore Lifestyle" — all HTML, all in the one copy column over the photograph; no details', () => {
  assert.match(leadHtml, /<span class="fsb-lead__art"><picture><source media="\(max-width: 700px\)"\/><img alt="[^"]{20,}" width="1898" height="829" class="fsb-lead__image" loading="lazy" decoding="async"\/><\/picture><\/span>/, 'deferred: no src until revealed');
  assert.ok(leadHtml.includes('<div class="fsb-lead__copy"><p class="fsb-lead__eyebrow">Live beautifully</p><h2 class="fsb-lead__h" id="fsb-lifestyle-h"><span>Lifestyle</span> <span>Store</span></h2><p class="fsb-lead__description">Fashion, home, living and everyday essentials — all in one place.</p><span class="fsb-lead__cta" id="fsb-lifestyle-cta">Explore Lifestyle <svg'), 'the copy, in order');
  assert.match(leadHtml, /<\/span><\/div><\/a><\/section>$/, 'the CTA closes the copy and the copy closes the banner: nothing after it');
  assert.doesNotMatch(leadHtml, /fsb-lead__details|<ul|<li/, 'the four details are gone');
  assert.equal(mod.LIFESTYLE.details, undefined, 'and so is their data');
  const el = eager.match(/<section class="fsb-lead"[\s\S]*?<\/section>/)[0];
  assert.match(el, /<source media="\(max-width: 700px\)" srcSet="\/img\/fashion-editorial\/women-main-hero-mobile\.webp"\/><img [^>]*src="\/img\/fashion-editorial\/women-edit-tailoring-1898\.webp"/);
});

await test('the strip: women\'s and men\'s tiles in turn, each opening its own listing under a "Women" or "Men" label; a tile without its photograph stays out — today the six women\'s tiles, the five men\'s waiting for theirs', () => {
  assert.equal(typeof mod.FashionCategoryStrip, 'function', 'the strip is its own export');
  const cats = mod.FASHION_CATEGORIES;
  assert.deepEqual(cats.women.map((t) => t.slug), ['dresses', 'knitwear', 'shirts', 'denim', 'coats-jackets', 'womens-bags'], 'the Women sub-categories, the women\'s page\'s five slugs and Bags');
  assert.deepEqual(cats.men.map((t) => t.slug), ['mens-shirts', 'mens-t-shirts', 'mens-trousers', 'mens-jackets', 'mens-footwear']);
  for (const t of cats.women) {
    assert.match(t.art, /^\/img\/fashion-editorial\/women-shop-[a-z]+\.webp$/);
    assert.ok(has(t.art.slice(1)), `${t.art} exists`);
  }
  for (const t of cats.men) {
    assert.equal(t.art, null, `${t.name}: no photograph yet`);
    assert.ok(!has(`img/fashion-editorial/${t.planned}.webp`), `${t.planned}.webp has landed: set the tile's art so it shows`);
  }
  const full = { women: cats.women, men: cats.men.map((t) => ({ ...t, art: `/img/x/${t.slug}.webp` })) };
  assert.deepEqual(mod.stripTiles(full).map((t) => `${t.dept}:${t.slug}`), ['Women:dresses', 'Men:mens-shirts', 'Women:knitwear', 'Men:mens-t-shirts', 'Women:shirts', 'Men:mens-trousers', 'Women:denim', 'Men:mens-jackets', 'Women:coats-jackets', 'Men:mens-footwear', 'Women:womens-bags'], 'one of each in turn while both last');
  assert.deepEqual(mod.stripTiles().map((t) => `${t.dept}:${t.slug}`), cats.women.map((t) => `Women:${t.slug}`), 'no photograph, no tile');
  const tiles = [...stripHtml.matchAll(/<li class="fsb-strip__tile" aria-hidden="(true|false)"><a( tabindex="-1")? href="([^"]+)"><span class="fsb-strip__art"><img alt="" width="600" height="780" class="fsb-strip__image" loading="lazy" decoding="async"\/><\/span><span class="fsb-strip__dept">(Women|Men)<\/span><span class="fsb-strip__name">([^<]+)<\/span><\/a><\/li>/g)];
  assert.equal(tiles.length, 6, 'six tiles, each the whole of its link');
  assert.deepEqual(tiles.map((m) => m[3]), cats.women.map((t) => `/fashion/c/${t.slug}`), 'each tile opens its own listing');
  assert.deepEqual(tiles.map((m) => m[5].replace(/&amp;/g, '&')), ['Dresses', 'Knitwear', 'Shirts', 'Denim', 'Coats & Jackets', 'Bags']);
  assert.deepEqual(tiles.map((m) => [m[1], !!m[2]]), [['false', false], ...Array(5).fill(['true', true])], 'before measuring, one tile in view; the rest hidden and untabbable');
  assert.match(stripHtml, /<p class="fsb-strip__eyebrow">Women<\/p><h2 id="fsb-strip-h">Shop fashion by category<\/h2>/, 'the label names only the departments on show');
  assert.match(stripHtml, /<div class="fsb-strip__arrows"><button type="button" aria-label="Previous categories" disabled=""><svg[\s\S]*?<\/button><button type="button" aria-label="Next categories"><svg/, 'arrows, the first disabled at the start');
  assert.match(stripHtml, /<div class="fsb-strip__viewport" aria-roledescription="carousel" aria-label="Women&#x27;s and men&#x27;s categories"><ul class="fsb-strip__track" style="--i:0">/, 'the track carries only its index; the stylesheet turns it into a transform');
  const eagerStrip = eager.match(/<section class="fsb-strip"[\s\S]*?<\/section>/)[0];
  assert.deepEqual([...eagerStrip.matchAll(/<img [^>]*src="([^"]+)"/g)].map((m) => m[1]), cats.women.map((t) => t.art));
});

await test('the strip carousel: steps a tile at a time on its own (wrapping after the last window), pauses on hover and on focus, never moves under prefers-reduced-motion, arrows clamp at both ends, a 40px sideways swipe steps and swallows the click; nothing to move, no autoplay and no arrows', async () => {
  const { hooks, mount, findAll } = await import('./catalogue-admin-harness.mjs');
  const { loadSource } = await import('./grocery-ssr.mjs');
  let reduce = false;
  const timers = [], listeners = {};
  const win = {
    matchMedia: () => ({ matches: reduce, addEventListener() {}, removeEventListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: (p) => (p === '--per' ? ' 2' : '') }),
    addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener() {},
  };
  const setInterval = (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length - 1; };
  const clearInterval = (id) => { if (timers[id]) timers[id].live = false; };
  const m = loadSource(read('src/components/FashionBanner.jsx'), { ...hooks, window: win, setInterval, clearInterval, Link: 'a', Icon: () => null, DeferredImage: (p) => h('img', p), FashionEntryLink: 'a' });
  assert.equal(typeof m.FashionCategoryStrip, 'function');
  const tiles = m.stripTiles({ women: m.FASHION_CATEGORIES.women, men: m.FASHION_CATEGORIES.men.map((t) => ({ ...t, art: `/img/x/${t.slug}.webp` })) });
  const strip = await mount(h(m.FashionCategoryStrip, { tiles }));
  const node = (cls) => findAll(strip.tree, (n) => n.props?.className === cls)[0];
  const idx = () => Number(node('fsb-strip__track').props.style['--i']);
  const live = () => timers.filter((t) => t.live);
  const tick = () => strip.act(() => { for (const t of live()) t.fn(); });
  node('fsb-strip__track').ref.current = {};
  await strip.act(() => listeners.resize());
  const shown = () => findAll(strip.tree, (n) => n.props?.className === 'fsb-strip__tile').map((n) => n.props['aria-hidden'] ? 0 : 1).join('');
  assert.equal(shown(), '11000000000', 'the stylesheet says two in view');
  assert.equal(live().length, 1); assert.equal(live()[0].ms, m.STRIP_AUTOPLAY_MS);
  for (const want of [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) { await tick(); assert.equal(idx(), want, 'one tile per tick, back to the start after the last window'); }
  assert.equal(shown(), '11000000000');
  await strip.act(() => node('fsb-strip__wrap').props.onMouseEnter());
  assert.equal(live().length, 0, 'hover pauses'); await tick(); assert.equal(idx(), 0);
  await strip.act(() => node('fsb-strip__wrap').props.onMouseLeave());
  assert.equal(live().length, 1, 'and leaving resumes');
  await strip.act(() => node('fsb-strip__wrap').props.onFocus());
  assert.equal(live().length, 0, 'focus pauses'); await tick(); assert.equal(idx(), 0);
  await strip.act(() => node('fsb-strip__wrap').props.onBlur());
  const button = (label) => findAll(strip.tree, (n) => n.type === 'button' && n.props['aria-label'] === label)[0];
  assert.equal(button('Previous categories').props.disabled, true);
  await strip.act(() => button('Previous categories').props.onClick()); assert.equal(idx(), 0, 'clamped at the start');
  await strip.act(() => button('Next categories').props.onClick()); assert.equal(idx(), 1);
  for (let i = 0; i < 12; i++) await strip.act(() => button('Next categories').props.onClick());
  assert.equal(idx(), 9, 'clamped at the last window'); assert.equal(button('Next categories').props.disabled, true);
  const vp = node('fsb-strip__viewport');
  await strip.act(() => { vp.props.onPointerDown({ clientX: 300, clientY: 10 }); vp.props.onPointerUp({ clientX: 280, clientY: 12 }); });
  assert.equal(idx(), 9, 'a 20px drag is not a swipe');
  await strip.act(() => { vp.props.onPointerDown({ clientX: 100, clientY: 10 }); vp.props.onPointerUp({ clientX: 160, clientY: 18 }); });
  assert.equal(idx(), 8, 'a swipe to the right steps back');
  let swallowed = 0;
  vp.props.onClickCapture({ preventDefault() { swallowed++; }, stopPropagation() {} });
  assert.equal(swallowed, 1, 'and the click it ends in does not open a tile');
  reduce = true;
  const still = await mount(h(m.FashionCategoryStrip, { tiles }));
  for (let i = 0; i < 4; i++) await still.act(() => { for (const t of live()) t.fn(); });
  assert.equal(Number(findAll(still.tree, (n) => n.props?.className === 'fsb-strip__track')[0].props.style['--i']), 0, 'reduced motion: never moves on its own');
  reduce = false;
  const before = live().length;
  const two = await mount(h(m.FashionCategoryStrip, { tiles: tiles.slice(0, 1) }));
  assert.equal(live().length, before, 'one tile: no autoplay');
  assert.equal(findAll(two.tree, (n) => n.type === 'button').length, 0, 'and no arrows');
  const none = await mount(h(m.FashionCategoryStrip, { tiles: [] }));
  assert.equal(none.tree, null, 'no tiles, no section');
});

await test('Part B: the two cards as today — same copy, same badges, the same photographs — one per slide, the first current, the other hidden and untabbable; two dots as tabs outside the links', () => {
  const car = html.match(/<div class="fsb__carousel" aria-roledescription="carousel" aria-label="The stores">[\s\S]*<\/div><\/div><\/section>/)[0];
  const slides = [...car.matchAll(/<div class="fsb__slide( is-on)?" aria-hidden="(true|false)" aria-roledescription="slide" aria-label="(\d) of 2">([\s\S]*?)<\/a><\/div>/g)];
  assert.equal(slides.length, 2);
  assert.deepEqual(slides.map((s) => [!!s[1], s[2], s[3]]), [[true, 'false', '1'], [false, 'true', '2']]);
  const expect = [
    { key: 'fashion', href: '/fashion', eyebrow: 'Discover your style', h: ['Fashion', 'Store'], desc: 'Clothing, footwear, bags, beauty and accessories — all in one place.', cta: 'Explore Fashion', badges: ['Clothing & more', 'Everyday style', 'Easy shopping'], img: '/img/doorway-fashion-wide.webp' },
    { key: 'living', href: '/homeliving', eyebrow: 'Make space for a better you', h: ['Home &amp; Living', 'Store'], desc: 'Home textiles, soft furnishings and everyday essentials for your space.', cta: 'Explore Living', badges: ['Soft textures', 'Calm spaces', 'Everyday living'], img: '/img/doorway-living-wide.webp' },
  ];
  slides.forEach((s, i) => {
    const e = expect[i], c = s[4];
    assert.match(c, new RegExp(`<a class="fsb__card fsb__card--${e.key}" aria-labelledby="fsb-${e.key}-h fsb-${e.key}-cta"${i === 0 ? '' : ' tabindex="-1"'}${e.key === 'fashion' ? ' aria-haspopup="dialog"' : ''} href="${e.href.replace(/\//g, '\\/')}">`), `${e.key}: ${i === 0 ? 'tabbable' : 'untabbable while hidden'}`);
    assert.match(c, /<div class="fsb__art"><picture><source media="\(max-width: 1023px\)"\/><img alt="[^"]{20,}" width="1600" height="900" class="fsb__image" loading="lazy" decoding="async"\/><\/picture><\/div>/, `${e.key}: one photograph — the portrait under 1024px, the landscape above`);
    assert.ok(c.includes(`<p class="fsb__eyebrow">${e.eyebrow}</p><h3 class="fsb__h" id="fsb-${e.key}-h"><span>${e.h[0]}</span> <span>${e.h[1]}</span></h3><p class="fsb__description">${e.desc}</p><span class="fsb__cta" id="fsb-${e.key}-cta">${e.cta} <svg`), `${e.key}: the copy as today`);
    assert.deepEqual([...c.matchAll(/<li><svg[\s\S]*?<\/svg><span>([^<]*)<\/span><\/li>/g)].map((m) => m[1].replace(/&amp;/g, '&')), e.badges, `${e.key}: the badges as today`);
  });
  const eagerSlides = [...eager.matchAll(/<div class="fsb__slide[^"]*"[\s\S]*?<source media="\(max-width: 1023px\)" srcSet="([^"]+)"\/><img [^>]*src="([^"]+)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(eagerSlides, [['/img/doorway-fashion-tall.webp', '/img/doorway-fashion-wide.webp'], ['/img/doorway-living-tall.webp', '/img/doorway-living-wide.webp']]);
  assert.match(car, /<div class="fsb__dots" role="tablist" aria-label="Choose a store"><button type="button" role="tab" aria-selected="true" aria-label="Fashion Store" class="fsb__dot is-on"><\/button><button type="button" role="tab" aria-selected="false" aria-label="Home &amp; Living Store" class="fsb__dot"><\/button><\/div>/, 'two dots, the first selected');
  assert.equal((carouselHtml.match(/<button/g) || []).length, 2, 'the dots are the carousel\'s only buttons');
  assert.match(car, /<div class="fsb__track" style="transform:translateX\(-0%\)">/, 'the track moves on transform');
});

await test('the carousel rules: one slide → no dots; none → nothing; autoplay only with more than one slide and never under prefers-reduced-motion; pause on hover and focus; a 40px sideways swipe changes the slide and swallows the click', () => {
  const one = renderToStaticMarkup(h(StaticRouter, { location: '/' }, h(mod.DoorwayCarousel, { stores: [mod.STORES[0]] })));
  assert.equal((one.match(/<div class="fsb__slide/g) || []).length, 1); assert.doesNotMatch(one, /fsb__dots|<button/);
  assert.equal(renderToStaticMarkup(h(StaticRouter, { location: '/' }, h(mod.DoorwayCarousel, { stores: [] }))), '');
  const src = read('src/components/FashionBanner.jsx');
  assert.match(src, /if \(n < 2 \|\| paused\) return undefined;\n\s+const t = setInterval\(\(\) => \{ if \(!reduced\.current\) setIndex/, 'autoplay: more than one slide, not paused, not reduced');
  assert.match(src, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(src, /onMouseEnter=\{\(\) => setPaused\(true\)\} onMouseLeave=\{\(\) => setPaused\(false\)\} onFocus=\{\(\) => setPaused\(true\)\} onBlur=\{\(\) => setPaused\(false\)\}/);
  assert.match(src, /Math\.abs\(dx\) >= 40 && Math\.abs\(dx\) > Math\.abs\(dy\)/, 'a sideways swipe of 40px');
  assert.match(src, /onClickCapture=\{onClickCapture\}/); assert.match(src, /if \(swipe\.current\.moved\) \{ e\.preventDefault\(\); e\.stopPropagation\(\);/);
  assert.match(src, /export const AUTOPLAY_MS = 6000;/);
});

await test('text rule and copy: every card photograph has a real description; every label is text; no speed claim and no sustainability claim in the component, the sheet or the render', () => {
  const t = text(html);
  // The store photographs carry a description; a strip tile's image is decorative — its department and name are its text.
  for (const alt of [...eager.replace(/<section class="fsb-strip"[\s\S]*?<\/section>/, '').matchAll(/alt="([^"]*)"/g)].map((m) => m[1])) assert.ok(alt.length > 20, 'a real description of the photograph');
  const tiles = mod.stripTiles ? mod.stripTiles().length : 0;
  assert.equal((html.match(/<img /g) || []).length, 3 + tiles); assert.equal((html.match(/loading="lazy"/g) || []).length, 3 + tiles);
  assert.doesNotMatch(html, /<img[^>]+ src=/, 'deferred: no src on initial render');
  const sources = [['component', stripComments(read('src/components/FashionBanner.jsx'))], ['sheet', stripComments(read('src/styles/fashion-banner.css'))], ['render', t]];
  for (const [name, s] of sources) {
    for (const re of SPEED_CLAIMS) assert.doesNotMatch(s, re, `${name}: speed claim ${re}`);
    for (const re of PLANET_CLAIMS) assert.doesNotMatch(s, re, `${name}: sustainability claim ${re}`);
  }
  for (const s of ['Live beautifully', 'Lifestyle Store', 'Explore Lifestyle', 'Explore Fashion', 'Explore Living', 'Shop fashion by category', 'Women Dresses', 'Women Coats & Jackets']) assert.ok(t.includes(s), s);
});

// ---- the stylesheet ------------------------------------------------------
const css = has('src/styles/fashion-banner.css') ? stripComments(read('src/styles/fashion-banner.css')) : '';
const wideBlock = css.slice(0, css.indexOf('@media (hover: hover)'));
const phoneBlock = (() => { const at = css.indexOf('@media (max-width: 1023px)'); return at < 0 ? '' : css.slice(at, css.indexOf('\n}\n', at) + 3); })();
const smallBlock = (() => { const at = css.indexOf('@media (max-width: 700px)'); return at < 0 ? '' : css.slice(at, css.indexOf('\n}\n', at) + 3); })();
/** The body of the first `selector {` rule in a block. */
const ruleBody = (block, selector) => { const at = block.indexOf(`${selector} {`); return at < 0 ? '' : block.slice(at, block.indexOf('}', at)); };

await test('1280 (from 701): the banner is full-bleed, its height from the width — clamp(460px, 43.75vw, 680px), never aspect-ratio with a min/max height — the copy white on the sky at the left under a seamless navy fade gone by 56%, set exactly like the women\'s hero; the carousel is a 760px 16:9 card — smaller than the banner in width and height', () => {
  assert.equal(decl(wideBlock, '.fsb-lead__link', 'height'), 'clamp(460px, 43.75vw, 680px)');
  assert.doesNotMatch(ruleBody(wideBlock, '.fsb-lead__link'), /aspect-ratio|max-width|min-height|max-height/, 'nothing that could cap or force the width (the women\'s hero lesson)');
  assert.doesNotMatch(wideBlock, /\.fsb-lead \{[^}]*(max-width|margin-inline)/, 'the section is the page\'s width');
  assert.equal(decl(wideBlock, '.fsb-lead__art', 'position'), 'absolute', 'the photograph under the copy');
  assert.equal(decl(wideBlock, '.fsb-lead__copy', 'width'), 'min(40%, 470px)');
  assert.equal(decl(wideBlock, '.fsb-lead__copy', 'margin-left'), 'max(28px, calc((100% - 1240px) / 2))', 'the copy lines up with the page\'s 1240px column');
  assert.equal(decl(wideBlock, '.fsb-lead__image', 'object-fit'), 'cover');
  const women = stripComments(read('src/styles/fashion-departments.css'));
  for (const prop of ['font-size', 'line-height', 'letter-spacing', 'text-transform']) assert.equal(decl(wideBlock, '.fsb-lead__h', prop), decl(women, '.wm-hero h1', prop), `the headline's ${prop} is the women's hero's`);
  for (const sel of ['.fsb-lead__eyebrow', '.fsb-lead__h', '.fsb-lead__description']) assert.match(decl(wideBlock, sel, 'color'), /^#f|^#fff/, `${sel} is white on the photograph`);
  assert.equal(decl(wideBlock, '.fsb-lead__cta', 'background'), '#fff', 'a white button, as on the women\'s hero');
  const fade = decl(wideBlock, '.fsb-lead__link::after', 'background');
  assert.match(fade, /^linear-gradient\(90deg, .*rgba\(36, 69, 109, 0\) 56%\)$/, 'a navy fade from the left, gone before the subject');
  const a = [...fade.matchAll(/rgba\(36, 69, 109, (\.\d+|0)\)/g)].map((m) => Number(m[1]));
  assert.ok(a.length >= 5 && a.every((x, i) => i === 0 || (x <= a[i - 1] && a[i - 1] - x <= 0.3)) && a.at(-1) === 0, `the fade has no seam: ${a.join(' → ')}`);
  assert.equal(decl(wideBlock, '.fsb__art::after', 'background'), 'var(--fsb-wash)');
  const cardWash = decl(wideBlock, '.fsb__card', '--fsb-wash');
  assert.match(cardWash, /^linear-gradient\(90deg, .*rgba\(246, 239, 227, 0\) 64%\)$/); assertSmooth(cardWash, 'card wash');
  assert.equal(decl(wideBlock, '.fsb__content', 'grid-area'), '1 / 1', 'the copy and the badges share the photo\'s cell');
  assert.equal(decl(wideBlock, '.fsb__content', 'justify-content'), 'space-between', 'copy at the top of the column, badges at its foot');
  assert.match(decl(wideBlock, '.fsb__details li', 'background'), /^rgba\(251, 248, 241, \.[4-7]\d?\)$/, 'badges are translucent pills on the photo');
  assert.doesNotMatch(wideBlock, /\.fsb__card--lead \.fsb__art::after|\.fsb__slide \.fsb__art/, 'one wash rule, driven by the token');
  assert.equal(decl(wideBlock, '.fsb__carousel', 'max-width'), 'min(760px, 68%)');
  assert.equal(decl(wideBlock, '.fsb__art', 'aspect-ratio'), '16 / 9');
  for (const vw of [1024, 1280, 1440]) {
    const banner = vw, bannerH = Math.min(Math.max(460, vw * 0.4375), 680), card = Math.min(760, (Math.min(vw, 1440) - 64) * 0.68);
    assert.ok(card < banner && card * 9 / 16 < bannerH, `${vw}: card ${Math.round(card)}×${Math.round(card * 9 / 16)} inside banner ${banner}×${Math.round(bannerH)}`);
  }
  assert.equal(decl(wideBlock, '.fsb__viewport', 'overflow'), 'hidden'); assert.equal(decl(wideBlock, '.fsb__viewport', 'touch-action'), 'pan-y', 'vertical scrolling stays with the page; the swipe is ours');
  assert.match(decl(wideBlock, '.fsb__track', 'transition'), /^transform /);
  assert.doesNotMatch(wideBlock, /\.fsb__grid/, 'the side-by-side grid is gone');
  assert.doesNotMatch(css, /\.fsb__card--lead \{ margin-bottom/, 'the banner is its own section now; no spacing to a carousel beneath');
});

await test('390 and 768: each carousel card is its 4:5 portrait — the copy at the top of the overlay column under a wash fading down, the badges at its foot over a wash fading up, both seamless; the carousel inset to 96% so it reads smaller; up to 700px the banner is the 3:4 portrait with the copy on its foot over a fade — nothing beneath the image — and the strip shows two tiles (three up to 1000px)', () => {
  assert.ok(smallBlock, 'a small-screen block');
  assert.equal(decl(smallBlock, '.fsb-lead__link', 'aspect-ratio'), '3 / 4', 'the portrait\'s own shape');
  assert.equal(decl(smallBlock, '.fsb-lead__link', 'height'), 'auto'); assert.equal(decl(smallBlock, '.fsb-lead__link', 'align-items'), 'flex-end', 'the copy at the foot');
  assert.doesNotMatch(ruleBody(smallBlock, '.fsb-lead__link'), /min-height|max-height|max-width/, 'no limit that could transfer to the width');
  assert.doesNotMatch(smallBlock, /\.fsb-lead__art \{|\.fsb-lead__link::after \{ display: none|\.fsb-lead \{/, 'the photograph stays under the copy: nothing pushed beneath it');
  const fade = decl(smallBlock, '.fsb-lead__link::after', 'background');
  assert.match(fade, /^linear-gradient\(0deg, rgba\(20, 31, 48, \.[6-9]\d?\) 0%, .*rgba\(20, 31, 48, 0\) 5\d%\)$/, 'a dark fade up from the foot, gone above the faces');
  assert.equal(decl(wideBlock, '.fsb-strip__track', '--per'), '5'); assert.equal(decl(smallBlock, '.fsb-strip__track', '--per'), '2');
  assert.match(css, /@media \(max-width: 1000px\) \{\s*\.fsb-strip__track \{ --per: 3; \}/);
  assert.ok(phoneBlock, 'a phone block');
  assert.equal(decl(phoneBlock, '.fsb__card .fsb__art', 'aspect-ratio'), '4 / 5', 'both cards');
  assert.equal(decl(phoneBlock, '.fsb__card .fsb__content', 'width'), '100%'); assert.equal(decl(phoneBlock, '.fsb__card .fsb__content', 'padding'), 'var(--fsb-pad)');
  assert.doesNotMatch(phoneBlock, /display: contents|grid-area: 2 \/ 1|\.fsb__slide|16 \/ 10/, 'nothing sits in a row beneath the photo any more');
  const wash = decl(phoneBlock, '.fsb__card', '--fsb-wash');
  const parts = wash.split(/\),\s*linear-gradient\(/);
  assert.equal(parts.length, 2, 'two washes: down from the top, up from the bottom');
  assert.match(parts[0], /^linear-gradient\(180deg/); assert.match(parts[1], /^0deg/);
  assertSmooth(parts[0], 'top wash'); assertSmooth(parts[1], 'bottom wash');
  assert.match(parts[0], /rgba\(246, 239, 227, 0\) 6[0-4]%$/, 'the top wash is gone by ~62%, past the copy'); assert.match(parts[1], /rgba\(246, 239, 227, 0\) 4[0-4]%\)?$/, 'the bottom wash climbs to ~44%, under the badges');
  assert.match(decl(phoneBlock, '.fsb__card .fsb__details', 'grid-template-columns'), /^repeat\(auto-fit, minmax\(1\d\dpx, 1fr\)\)$/, 'the badges flow two across');
  assert.equal(decl(phoneBlock, '.fsb__card .fsb__details li', 'flex-direction'), 'row');
  assert.equal(decl(phoneBlock, '.fsb__carousel', 'max-width'), '96%');
});

await test('the phone scale is pinned: the five tokens exactly; on the 96%-wide carousel cards, with a two-line headline, the copy stack — eyebrow, headline, two-line subline, CTA — ends at or above the 46% where the sofa begins (45.6% on a 360 phone, 44% on a 390)', () => {
  const tokens = { '--fsb-pad': 'clamp(18px, 5cqw, 32px)', '--fsb-eyebrow': 'clamp(10px, 2.8cqw, 12px)', '--fsb-h': 'clamp(25px, 8.4cqw, 44px)', '--fsb-desc': 'clamp(13px, 3.8cqw, 17px)', '--fsb-cta': 'clamp(38px, 11cqw, 48px)' };
  for (const [k, v] of Object.entries(tokens)) assert.equal(decl(phoneBlock, '.fsb__card', k), v, k);
  assert.equal(decl(phoneBlock, '.fsb__card .fsb__eyebrow', 'font-size'), 'var(--fsb-eyebrow)'); assert.equal(decl(phoneBlock, '.fsb__card .fsb__h', 'font-size'), 'var(--fsb-h)');
  assert.equal(decl(phoneBlock, '.fsb__card .fsb__description', 'font-size'), 'var(--fsb-desc)'); assert.equal(decl(phoneBlock, '.fsb__card .fsb__cta', 'min-height'), 'var(--fsb-cta)');
  const stack = (W, headlineLines) => px(tokens['--fsb-pad'], W)
    + px(tokens['--fsb-eyebrow'], W) * Number(decl(wideBlock, '.fsb__card .fsb__eyebrow', 'line-height')) + px(decl(phoneBlock, '.fsb__card .fsb__eyebrow', 'margin-bottom'), W)
    + px(tokens['--fsb-h'], W) * Number(decl(wideBlock, '.fsb__h', 'line-height')) * headlineLines + px(decl(phoneBlock, '.fsb__card .fsb__h', 'margin-bottom'), W)
    + px(tokens['--fsb-desc'], W) * Number(decl(phoneBlock, '.fsb__card .fsb__description', 'line-height')) * 2 + px(decl(phoneBlock, '.fsb__card .fsb__description', 'margin-bottom'), W)
    + px(tokens['--fsb-cta'], W);
  for (const [vw, W] of [[360, Math.round(328 * 0.96)], [390, Math.round(358 * 0.96)], [768, Math.round(720 * 0.96)]]) {
    const need = stack(W, 2), card = W * 1.25;
    assert.ok(need / card <= 0.46, `${vw} card: the copy stack ends at ${((need / card) * 100).toFixed(1)}% of the card`);
  }
});

await test('the faces: Playfair Display through the token, weight 400, tracking -.02em on the store section heading and the card headlines; the banner and the strip in the women\'s page\'s uppercase Inter, weight 400; no Fraunces axis left in the sheet', () => {
  assert.match(css, /\.fsb__intro h2 \{[^}]*font-family: var\(--font-display, 'Playfair Display', Georgia, serif\);[^}]*font-weight: 400;[^}]*letter-spacing: -\.02em;/);
  assert.match(css, /\.fsb__h \{[^}]*font-family: var\(--font-display, 'Playfair Display', Georgia, serif\);[^}]*font-weight: 400;[^}]*letter-spacing: -\.02em;/);
  for (const sel of ['.fsb-lead__h', '.fsb-strip__head h2']) assert.match(css, new RegExp(`${sel.replace(/[.]/g, '\\.')} \\{[^}]*font-family: 'Inter', sans-serif;[^}]*font-weight: 400;[^}]*text-transform: uppercase;`), sel);
  for (const sel of ['.fsb-lead__eyebrow', '.fsb-strip__eyebrow', '.fsb-strip__dept']) assert.match(css, new RegExp(`${sel.replace(/[.]/g, '\\.')} \\{[^}]*letter-spacing: \\.18em;[^}]*text-transform: uppercase;`), sel);
  assert.doesNotMatch(css, /Fraunces|font-variation-settings|font-optical-sizing/);
});

await test('square edges: no border-radius anywhere in the banner\'s or the strip\'s rules — not the banner, not a tile, not a button — and the strip track moves on transform only, by its index, a tile at a time', () => {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /\.fsb-(lead|strip)/.test(m[1]));
  assert.ok(rules.length >= 30, `the banner and strip rules (${rules.length})`);
  for (const [, sel, body] of rules) assert.doesNotMatch(body, /radius/, `${sel.trim()} rounds a corner`);
  assert.doesNotMatch(read('src/components/FashionBanner.jsx').slice(read('src/components/FashionBanner.jsx').indexOf('const shopArt')), /radius/i, 'no inline rounding either');
  assert.equal(decl(wideBlock, '.fsb-strip__track', 'transform'), 'translateX(calc(var(--i, 0) * -1 * ((100% - (var(--per) - 1) * var(--gap)) / var(--per) + var(--gap))))');
  assert.equal(decl(wideBlock, '.fsb-strip__tile', 'flex'), '0 0 calc((100% - (var(--per) - 1) * var(--gap)) / var(--per))', 'a tile is exactly one step wide');
  assert.match(decl(wideBlock, '.fsb-strip__track', 'transition'), /^transform /);
  assert.equal(decl(wideBlock, '.fsb-strip__viewport', 'overflow'), 'hidden'); assert.equal(decl(wideBlock, '.fsb-strip__viewport', 'touch-action'), 'pan-y', 'vertical scrolling stays with the page; the swipe is ours');
});

await test('motion: transitions on transform, opacity and box-shadow only; hover lifts only on fine pointers; reduced motion stills the cards and the track; every selector is namespaced .fsb', () => {
  for (const m of css.matchAll(/transition:\s*([^;]+);/g)) for (const part of m[1].replace(/\([^)]*\)/g, '').split(',')) assert.match(part.trim(), /^(?:transform|opacity|box-shadow|none)\b/, `transition on ${part.trim()}`);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{[^@]*\.fsb__card:hover \{ transform: translateY\(-3px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.fsb__card, \.fsb__image, \.fsb__cta svg, \.fsb__track \{ transition: none; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.fsb-lead__image, \.fsb-lead__cta svg, \.fsb-strip__track, \.fsb-strip__image \{ transition: none; \}/, 'reduced motion stills the banner and the strip');
  assert.ok(css.split('\n').filter((l) => /^[.]/.test(l)).every((l) => l.startsWith('.fsb')), 'every selector is namespaced .fsb');
});

// ---- wiring and isolation ------------------------------------------------
await test('the build lists and every other file are byte-identical to the baseline: only the section\'s own files, Home.jsx (the two mounts), scripts and build output changed', () => {
  const changed = new Set(execFileSync('git', ['diff', '--name-only', BASELINE_SHA], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean));
  // The typeface swap (test-typeface.mjs) touched index.html and the stylesheets in the same release.
  // The Home & Living homepage rework (test-homeliving-hero.mjs) — an approved change to that store's own homepage files and its hero pair.
  // Three approved changes landed beside this section and moved files these pins guard:
  //   86ea8cf  src/components/Hero.jsx   — the wellness hero drops the Supabase render-transform URLs (test-homepage-appearance.mjs)
  //   e58317c  src/fashion/FashionHome.jsx — the campaign hero leads /fashion (test-fashion.mjs pins the new order)
  //   a651320  src/pages/Legal.jsx       — the shipping policy rewrite (test-company-surfaces.mjs pins the policy)
  // Express and Scheduled were withdrawn — brands ship standard, and the published Shipping Policy
  // documents Standard only. That edited the fee map (api/_lib/pricing.js), the checkout picker,
  // the PDP's display copy (src/data/pdpContent.js) and the PDP delivery panel, and nothing else.
  // test-company-surfaces.mjs pins the fee map against the policy; test-payment-hardening.mjs,
  // test-payment-logic.mjs and test-commerce-pricing.mjs pin that a withdrawn method cannot be charged.
  // api/_lib/couponQuote.js: quoteCoupon dropped the fashion rows priceCart had fetched, so every
  // coupon on a cart holding a fashion line was refused. Fixed on its own; test-coupon-quote-rows.mjs
  // pins it through quoteCoupon rather than through computeOrderTotal.
  // 99b67ba made the Fashion and Lifestyle storefront copy editable from the admin
  // (test-storefront-customization.mjs and test-store-catalogue-admin.mjs own it). Its admin
  // pages and libs may change; the storefront files it touched are compared through
  // sansStorefrontSettings (storefront-settings-pin.mjs), which undoes exactly that settings read.
  // The fashion departments followed (/fashion/men, /fashion/women and the doorway chooser;
  // test-fashion-departments.mjs owns them): their own files may change, and the shared files
  // they edited go through sansStorefrontChanges, which undoes both changes.
  const allowed = /^(src\/components\/FashionBanner\.jsx$|api\/_lib\/couponQuote\.js$|api\/_lib\/pricing\.js$|src\/pages\/Checkout\.jsx$|src\/data\/pdpContent\.js$|src\/components\/pdp\/ProductDeliveryInfo\.jsx$|src\/lib\/legalPageDefaults\.js$|src\/lib\/settings\.js$|src\/components\/Hero\.jsx$|src\/fashion\/FashionHome\.jsx$|src\/pages\/Legal\.jsx$|src\/styles\/[a-z0-9-]+\.css$|index\.html$|src\/pages\/Home\.jsx$|img\/lifestyle-banner-(wide|tall)\.webp$|src\/homeliving\/(HomeLivingLayout|HomeLivingHome)\.jsx$|src\/data\/homelivingHomepage\.js$|img\/homeliving-hero-(wide|tall)\.webp$|scripts\/|public\/|reports\/)/;
  // .vercelignore is deploy configuration (f927077), not storefront code.
  // An approved cart change may edit a shared cart file only because the byte checks below undo it (sansCartChanges).
  // The Home & Living cart's own new files (test-homeliving-cart.mjs).
  const bad = [...changed].filter((f) => !allowed.test(f) && !STOREFRONT_ADMIN_FILES.test(f) && !STOREFRONT_SETTINGS_READS.test(f) && !FASHION_DEPARTMENT_FILES.test(f) && !FASHION_DEPARTMENT_EDITS.test(f) && !DEPLOY_CONFIG_FILES.test(f) && !CART_CHANGE_EDITS.test(f) && !HOMELIVING_CART_FILES.test(f) && !SCROLL_MANAGER_FILES.test(f) && !SCROLL_MANAGER_EDITS.test(f) && !FASHION_PDP_THUMBS_EDITS.test(f));
  assert.deepEqual(bad, [], `unexpected files changed: ${bad.join(', ')}`);
  // Scroll on navigation (test-scroll-on-navigate.mjs) replaced the wellness shell's own reset with one manager mounted in
  // main.jsx; its new files are its own, and these two are byte-identical to the baseline once its recorded undo is applied.
  // The fashion PDP's thumbnails became buttons (test-fashion-cart.mjs); that file too, through its undo.
  for (const rel of ['src/main.jsx', 'src/components/Layout.jsx', 'src/fashion/FashionProductPage.jsx']) assert.equal(sansStorefrontChanges(rel, read(rel)).replace(/\r\n/g, '\n'), atCommit(BASELINE_SHA, rel).replace(/\r\n/g, '\n'), `${rel} is byte-identical to ${BASELINE_SHA} once the scroll change is undone`);
  for (const rel of ['src/pages/Home.jsx', 'build/build-css.mjs', 'src/App.jsx', 'src/lifestyle/LifestyleHome.jsx', 'src/lifestyle/LifestyleLayout.jsx', 'src/data/lifestyleHomepage.js', 'src/fashion/FashionLayout.jsx', 'src/lib/store.jsx', 'src/pages/Cart.jsx', 'src/pages/Checkout.jsx', 'src/lib/payments.js', 'src/lib/customerAuth.jsx', 'api/_lib/supabaseAdmin.js', 'api/razorpay/create-order.js', 'src/lib/couponApi.js', 'src/homeliving/HomeLivingProductCard.jsx', 'src/homeliving/HomeLivingProductPage.jsx', 'src/lib/homelivingPdp.js', 'src/components/CartCoupons.jsx']) {
    // Express and Scheduled were withdrawn (test-company-surfaces.mjs pins the fee map against the
    // published policy; the three payment suites pin that a withdrawn method cannot be charged).
    // For the two files that carries — the fee map and the checkout picker — normalise that one
    // declaration and the comments around it; every other file below stays a byte comparison.
    const sansDelivery = (t) => (/DELIVERY_FEES = \{|const DELIVERY = \[/.test(t)
      ? t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
        .replace(/export const DELIVERY_FEES = \{[^}]*\};/, 'DELIVERY_FEES')
        .replace(/const DELIVERY = \[[\s\S]*?\n\];/, 'DELIVERY')
        .split('\n').filter((l) => l.trim()).join('\n')
      : t);
    assert.equal(sansDelivery(sansStorefrontChanges(rel, read(rel))), sansDelivery(atCommit(BASELINE_SHA, rel).replace(/\r\n/g, '\n')), `${rel} is byte-identical to ${BASELINE_SHA}`);
  }
  assert.match(read('build/build-css.mjs'), /'src\/styles\/fashion-banner\.css',/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
