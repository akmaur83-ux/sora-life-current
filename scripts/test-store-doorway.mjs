// ============================================================
// The homepage store doorway ("Two Worlds. A Better You.") — offline suite.
//
// Part A, the Lifestyle banner: one whole-card link over one photograph
// with every word on it as HTML — a 16:9 landscape (copy on the empty left
// 38%) from 1024px, a 4:5 portrait (copy on the empty upper-left) below,
// the browser choosing through <picture>; four icon badges over the photo
// on a wide screen and beneath it on a phone. Part B, the two store cards
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
import { Link } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server.mjs';
import { ROOT, read, has, h, loadModule } from './grocery-ssr.mjs';
import { REPO, atCommit } from './baseline-export.mjs';

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
  'img/lifestyle-banner-wide.webp': [1600, 900],
  'img/lifestyle-banner-tall.webp': [1000, 1250],
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
await test('the images: the Lifestyle banner pair and the two store cards\' pairs (16:9 landscape, 4:5 portrait), each under 150 KB, at the sizes the markup declares', () => {
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
const mod = loadModule('src/components/FashionBanner.jsx', { Link, Icon, DeferredImage });
// A tree without the two exports (the pre-change tree) renders nothing here and fails each test on its own.
const safe = (C) => { try { return C ? renderToStaticMarkup(h(StaticRouter, { location: '/' }, h(C))) : ''; } catch { return ''; } };
const render = (m) => safe(m.LifestyleBanner) + safe(m.StoreCarousel);
const bannerHtml = safe(mod.LifestyleBanner);
const carouselHtml = safe(mod.StoreCarousel);
const html = bannerHtml + carouselHtml;
const EagerImage = ({ src, sources = [], loading, decoding, fetchPriority, ...props }) =>
  h('picture', null, ...sources.map((s) => h('source', { key: s.media, media: s.media, srcSet: s.srcSet })), h('img', { ...props, src }));
const eager = render(loadModule('src/components/FashionBanner.jsx', { Link, Icon, DeferredImage: EagerImage }));

await test('two sections, placed independently: LifestyleBanner is the banner alone with no heading; StoreCarousel is the heading and lede over the two store cards; no default export; no control inside any card link', () => {
  assert.equal(mod.default, undefined, 'no combined default export any more');
  assert.match(bannerHtml, /^<section class="v2-sec fsb fsb--lead" aria-labelledby="fsb-lifestyle-h fsb-lifestyle-cta"><div class="v2-wrap"><a class="fsb__card fsb__card--lifestyle fsb__card--lead" aria-labelledby="fsb-lifestyle-h fsb-lifestyle-cta" href="\/lifestyle">/, 'the banner section is the card and nothing else');
  assert.doesNotMatch(bannerHtml, /fsb__intro|Two Worlds|More to explore|fsb__carousel/, 'no heading on the banner');
  assert.deepEqual([...bannerHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ['/lifestyle']);
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

await test('Part A: the <picture> takes the 4:5 portrait under 1024px and the landscape otherwise; eyebrow "Live beautifully", "Lifestyle Store", the subline, "Explore Lifestyle" and the four badges — all HTML', () => {
  const lead = html.match(/<a class="fsb__card fsb__card--lifestyle fsb__card--lead"[\s\S]*?<\/a>/)[0];
  assert.match(lead, /<div class="fsb__art"><picture><source media="\(max-width: 1023px\)"\/><img alt="[^"]{20,}" width="1600" height="900" class="fsb__image" loading="lazy" decoding="async"\/><\/picture><\/div>/, 'deferred: no src until revealed');
  assert.ok(lead.includes('<div class="fsb__content"><div class="fsb__copy"><p class="fsb__eyebrow">Live beautifully</p><h3 class="fsb__h" id="fsb-lifestyle-h">Lifestyle Store</h3><p class="fsb__description">Fashion, home, living and everyday essentials — all in one place.</p><span class="fsb__cta" id="fsb-lifestyle-cta">Explore Lifestyle <svg'), 'the copy, in order');
  const badges = [...lead.matchAll(/<li><svg[\s\S]*?<\/svg><span>([^<]*)<\/span><\/li>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  assert.deepEqual(badges, ['Fashion & Accessories', 'Home & Living', 'Beauty & Wellness', 'Everyday Essentials']);
  assert.match(lead, /<ul class="fsb__details" aria-label="[^"]+">/);
  assert.ok(lead.indexOf('class="fsb__copy"') < lead.indexOf('class="fsb__details"'), 'the badges follow the copy in the same overlay column');
  const el = eager.match(/<a class="fsb__card fsb__card--lifestyle fsb__card--lead"[\s\S]*?<\/a>/)[0];
  assert.match(el, /<source media="\(max-width: 1023px\)" srcSet="\/img\/lifestyle-banner-tall\.webp"\/><img [^>]*src="\/img\/lifestyle-banner-wide\.webp"/);
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
    assert.match(c, new RegExp(`<a class="fsb__card fsb__card--${e.key}" aria-labelledby="fsb-${e.key}-h fsb-${e.key}-cta"${i === 0 ? '' : ' tabindex="-1"'} href="${e.href.replace(/\//g, '\\/')}">`), `${e.key}: ${i === 0 ? 'tabbable' : 'untabbable while hidden'}`);
    assert.match(c, /<div class="fsb__art"><picture><source media="\(max-width: 1023px\)"\/><img alt="[^"]{20,}" width="1600" height="900" class="fsb__image" loading="lazy" decoding="async"\/><\/picture><\/div>/, `${e.key}: one photograph — the portrait under 1024px, the landscape above`);
    assert.ok(c.includes(`<p class="fsb__eyebrow">${e.eyebrow}</p><h3 class="fsb__h" id="fsb-${e.key}-h"><span>${e.h[0]}</span> <span>${e.h[1]}</span></h3><p class="fsb__description">${e.desc}</p><span class="fsb__cta" id="fsb-${e.key}-cta">${e.cta} <svg`), `${e.key}: the copy as today`);
    assert.deepEqual([...c.matchAll(/<li><svg[\s\S]*?<\/svg><span>([^<]*)<\/span><\/li>/g)].map((m) => m[1].replace(/&amp;/g, '&')), e.badges, `${e.key}: the badges as today`);
  });
  const eagerSlides = [...eager.matchAll(/<div class="fsb__slide[^"]*"[\s\S]*?<source media="\(max-width: 1023px\)" srcSet="([^"]+)"\/><img [^>]*src="([^"]+)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(eagerSlides, [['/img/doorway-fashion-tall.webp', '/img/doorway-fashion-wide.webp'], ['/img/doorway-living-tall.webp', '/img/doorway-living-wide.webp']]);
  assert.match(car, /<div class="fsb__dots" role="tablist" aria-label="Choose a store"><button type="button" role="tab" aria-selected="true" aria-label="Fashion Store" class="fsb__dot is-on"><\/button><button type="button" role="tab" aria-selected="false" aria-label="Home &amp; Living Store" class="fsb__dot"><\/button><\/div>/, 'two dots, the first selected');
  assert.equal((html.match(/<button/g) || []).length, 2, 'the dots are the only buttons');
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
  for (const alt of [...eager.matchAll(/alt="([^"]*)"/g)].map((m) => m[1])) assert.ok(alt.length > 20, 'a real description of the photograph');
  assert.equal((html.match(/<img /g) || []).length, 3); assert.equal((html.match(/loading="lazy"/g) || []).length, 3);
  assert.doesNotMatch(html, /<img[^>]+ src=/, 'deferred: no src on initial render');
  const sources = [['component', stripComments(read('src/components/FashionBanner.jsx'))], ['sheet', stripComments(read('src/styles/fashion-banner.css'))], ['render', t]];
  for (const [name, s] of sources) {
    for (const re of SPEED_CLAIMS) assert.doesNotMatch(s, re, `${name}: speed claim ${re}`);
    for (const re of PLANET_CLAIMS) assert.doesNotMatch(s, re, `${name}: sustainability claim ${re}`);
  }
  for (const s of ['Live beautifully', 'Lifestyle Store', 'Explore Lifestyle', 'Fashion & Accessories', 'Beauty & Wellness', 'Everyday Essentials', 'Explore Fashion', 'Explore Living']) assert.ok(t.includes(s), s);
});

// ---- the stylesheet ------------------------------------------------------
const css = has('src/styles/fashion-banner.css') ? stripComments(read('src/styles/fashion-banner.css')) : '';
const wideBlock = css.slice(0, css.indexOf('@media (hover: hover)'));
const phoneBlock = (() => { const at = css.indexOf('@media (max-width: 1023px)'); return at < 0 ? '' : css.slice(at, css.indexOf('\n}\n', at) + 3); })();

await test('1280 (from 1024): the banner is page-wide at 16:7 with the copy on the left 38% under a seamless wash gone by 52% and the four badges on the photo beneath the CTA; "Lifestyle Store" sized to stay on one line in Playfair; the carousel is a 760px 16:9 card — smaller than the banner in width and height', () => {
  assert.equal(decl(wideBlock, '.fsb__card--lead .fsb__art', 'aspect-ratio'), '16 / 7');
  assert.equal(decl(wideBlock, '.fsb__card--lead .fsb__content', 'width'), '38%');
  assert.equal(decl(wideBlock, '.fsb__art::after', 'background'), 'var(--fsb-wash)');
  const leadWash = decl(wideBlock, '.fsb__card--lead', '--fsb-wash'), cardWash = decl(wideBlock, '.fsb__card', '--fsb-wash');
  assert.match(leadWash, /^linear-gradient\(90deg, .*rgba\(246, 239, 227, 0\) 52%\)$/); assertSmooth(leadWash, 'banner wash');
  assert.match(cardWash, /^linear-gradient\(90deg, .*rgba\(246, 239, 227, 0\) 64%\)$/); assertSmooth(cardWash, 'card wash');
  // Playfair Display at the old clamp(40px, 4.2vw, 56px) set "Lifestyle Store" ~470px wide at 1280 against a 419px column — it wrapped. 3.6vw keeps it on one line to 1024.
  assert.equal(decl(wideBlock, '.fsb__card--lead .fsb__h', 'font-size'), 'clamp(36px, 3.6vw, 48px)');
  assert.equal(decl(wideBlock, '.fsb__card--lead .fsb__details', 'grid-template-columns'), 'repeat(4, minmax(0, 1fr))');
  assert.equal(decl(wideBlock, '.fsb__content', 'grid-area'), '1 / 1', 'the copy and the badges share the photo\'s cell');
  assert.equal(decl(wideBlock, '.fsb__content', 'justify-content'), 'space-between', 'copy at the top of the column, badges at its foot');
  assert.match(decl(wideBlock, '.fsb__details li', 'background'), /^rgba\(251, 248, 241, \.[4-7]\d?\)$/, 'badges are translucent pills on the photo');
  assert.doesNotMatch(wideBlock, /\.fsb__card--lead \.fsb__art::after|\.fsb__slide \.fsb__art/, 'one wash rule, driven by the token');
  assert.equal(decl(wideBlock, '.fsb__carousel', 'max-width'), 'min(760px, 68%)');
  assert.equal(decl(wideBlock, '.fsb__art', 'aspect-ratio'), '16 / 9');
  for (const vw of [1024, 1280, 1440]) {
    const banner = Math.min(vw, 1440) - 64, card = Math.min(760, banner * 0.68);
    assert.ok(card < banner && card * 9 / 16 < banner * 7 / 16, `${vw}: card ${card}×${Math.round(card * 9 / 16)} inside banner ${banner}×${Math.round(banner * 7 / 16)}`);
  }
  assert.equal(decl(wideBlock, '.fsb__viewport', 'overflow'), 'hidden'); assert.equal(decl(wideBlock, '.fsb__viewport', 'touch-action'), 'pan-y', 'vertical scrolling stays with the page; the swipe is ours');
  assert.match(decl(wideBlock, '.fsb__track', 'transition'), /^transform /);
  assert.doesNotMatch(wideBlock, /\.fsb__grid/, 'the side-by-side grid is gone');
  assert.doesNotMatch(css, /\.fsb__card--lead \{ margin-bottom/, 'the banner is its own section now; no spacing to a carousel beneath');
});

await test('390 and 768: every card is its 4:5 portrait — the copy at the top of the overlay column under a wash fading down, the badges at its foot over a wash fading up, both seamless; no panel beneath the photo; the carousel inset to 96% so it reads smaller', () => {
  assert.ok(phoneBlock, 'a phone block');
  assert.equal(decl(phoneBlock, '.fsb__card .fsb__art', 'aspect-ratio'), '4 / 5', 'the banner and both cards');
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

await test('the phone scale is pinned: the five tokens exactly; at a 358px banner (390 viewport) the copy stack — eyebrow, one-line headline, two-line subline, CTA — ends above 42% of the 4:5 card, where the portrait subject begins; on the 96%-wide carousel cards, with a two-line headline, at or above the 46% where the sofa begins (45.6% on a 360 phone, 44% on a 390)', () => {
  const tokens = { '--fsb-pad': 'clamp(18px, 5cqw, 32px)', '--fsb-eyebrow': 'clamp(10px, 2.8cqw, 12px)', '--fsb-h': 'clamp(25px, 8.4cqw, 44px)', '--fsb-desc': 'clamp(13px, 3.8cqw, 17px)', '--fsb-cta': 'clamp(38px, 11cqw, 48px)' };
  for (const [k, v] of Object.entries(tokens)) assert.equal(decl(phoneBlock, '.fsb__card', k), v, k);
  assert.equal(decl(phoneBlock, '.fsb__card .fsb__eyebrow', 'font-size'), 'var(--fsb-eyebrow)'); assert.equal(decl(phoneBlock, '.fsb__card .fsb__h', 'font-size'), 'var(--fsb-h)');
  assert.equal(decl(phoneBlock, '.fsb__card .fsb__description', 'font-size'), 'var(--fsb-desc)'); assert.equal(decl(phoneBlock, '.fsb__card .fsb__cta', 'min-height'), 'var(--fsb-cta)');
  const stack = (W, headlineLines) => px(tokens['--fsb-pad'], W)
    + px(tokens['--fsb-eyebrow'], W) * Number(decl(wideBlock, '.fsb__card .fsb__eyebrow', 'line-height')) + px(decl(phoneBlock, '.fsb__card .fsb__eyebrow', 'margin-bottom'), W)
    + px(tokens['--fsb-h'], W) * Number(decl(wideBlock, '.fsb__h', 'line-height')) * headlineLines + px(decl(phoneBlock, '.fsb__card .fsb__h', 'margin-bottom'), W)
    + px(tokens['--fsb-desc'], W) * Number(decl(phoneBlock, '.fsb__card .fsb__description', 'line-height')) * 2 + px(decl(phoneBlock, '.fsb__card .fsb__description', 'margin-bottom'), W)
    + px(tokens['--fsb-cta'], W);
  for (const [vw, W] of [[360, 328], [390, 358], [768, 720]]) {
    const need = stack(W, 1), card = W * 1.25;
    assert.ok(need / card <= 0.42, `${vw} banner: the copy stack ends at ${((need / card) * 100).toFixed(1)}% of the card`);
  }
  for (const [vw, W] of [[360, Math.round(328 * 0.96)], [390, Math.round(358 * 0.96)], [768, Math.round(720 * 0.96)]]) {
    const need = stack(W, 2), card = W * 1.25;
    assert.ok(need / card <= 0.46, `${vw} card: the copy stack ends at ${((need / card) * 100).toFixed(1)}% of the card`);
  }
});

await test('the display face: Playfair Display through the token, weight 400, tracking -.02em on the section heading and the card headlines; no Fraunces axis left in the sheet', () => {
  assert.match(css, /\.fsb__intro h2 \{[^}]*font-family: var\(--font-display, 'Playfair Display', Georgia, serif\);[^}]*font-weight: 400;[^}]*letter-spacing: -\.02em;/);
  assert.match(css, /\.fsb__h \{[^}]*font-family: var\(--font-display, 'Playfair Display', Georgia, serif\);[^}]*font-weight: 400;[^}]*letter-spacing: -\.02em;/);
  assert.doesNotMatch(css, /Fraunces|font-variation-settings|font-optical-sizing/);
});

await test('motion: transitions on transform, opacity and box-shadow only; hover lifts only on fine pointers; reduced motion stills the cards and the track; every selector is namespaced .fsb', () => {
  for (const m of css.matchAll(/transition:\s*([^;]+);/g)) for (const part of m[1].replace(/\([^)]*\)/g, '').split(',')) assert.match(part.trim(), /^(?:transform|opacity|box-shadow|none)\b/, `transition on ${part.trim()}`);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{[^@]*\.fsb__card:hover \{ transform: translateY\(-3px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.fsb__card, \.fsb__image, \.fsb__cta svg, \.fsb__track \{ transition: none; \}/);
  assert.ok(css.split('\n').filter((l) => /^[.]/.test(l)).every((l) => l.startsWith('.fsb')), 'every selector is namespaced .fsb');
});

// ---- wiring and isolation ------------------------------------------------
await test('the build lists and every other file are byte-identical to the baseline: only the section\'s own files, Home.jsx (the two mounts), scripts and build output changed', () => {
  const changed = new Set(execFileSync('git', ['diff', '--name-only', BASELINE_SHA], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean));
  // The typeface swap (test-typeface.mjs) touched index.html and the stylesheets in the same release.
  const allowed = /^(src\/components\/FashionBanner\.jsx$|src\/styles\/[a-z0-9-]+\.css$|index\.html$|src\/pages\/Home\.jsx$|img\/lifestyle-banner-(wide|tall)\.webp$|scripts\/|public\/|reports\/)/;
  const bad = [...changed].filter((f) => !allowed.test(f));
  assert.deepEqual(bad, [], `unexpected files changed: ${bad.join(', ')}`);
  for (const rel of ['src/pages/Home.jsx', 'build/build-css.mjs', 'src/App.jsx', 'src/lifestyle/LifestyleHome.jsx', 'src/lib/store.jsx', 'src/pages/Cart.jsx', 'src/pages/Checkout.jsx', 'src/lib/payments.js', 'src/lib/customerAuth.jsx']) {
    assert.equal(read(rel), atCommit(BASELINE_SHA, rel).replace(/\r\n/g, '\n'), `${rel} is byte-identical to ${BASELINE_SHA}`);
  }
  assert.match(read('build/build-css.mjs'), /'src\/styles\/fashion-banner\.css',/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
