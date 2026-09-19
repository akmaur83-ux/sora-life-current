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

// The tree as it stood before this work: the lifestyle storefront release.
const BASELINE_SHA = 'ccaff64';
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
};

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
await test('the images: the Lifestyle banner pair (16:9 landscape, 4:5 portrait) and the two store cards\' landscapes, each under 150 KB, at the sizes the markup declares', () => {
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
  const then = atCommit(BASELINE_SHA, 'src/pages/Home.jsx').replace(/\r\n/g, '\n');
  const mine = home
    .replace("import { LifestyleBanner, StoreCarousel } from '../components/FashionBanner.jsx';", "import FashionBanner from '../components/FashionBanner.jsx';")
    .replace(/      \{\/\* The doorway to the lifestyle store[^*]*\*\/\}\n      <LifestyleBanner \/>\n/, "      {/* The doorway to the fashion store — a separate section with its own\n          catalogue and navigation (/fashion). One block, no data dependency. */}\n      <FashionBanner />\n")
    .replace(/      \{\/\* The fashion and Home & Living store cards[\s\S]*?\*\/\}\n      <StoreCarousel \/>\n\n/, '');
  assert.equal(mine, then, 'Home.jsx: the import and the two mounts, nothing else');
});

await test('Part A: the <picture> takes the 4:5 portrait under 1024px and the landscape otherwise; eyebrow "Live beautifully", "Lifestyle Store", the subline, "Explore Lifestyle" and the four badges — all HTML', () => {
  const lead = html.match(/<a class="fsb__card fsb__card--lifestyle fsb__card--lead"[\s\S]*?<\/a>/)[0];
  assert.match(lead, /<div class="fsb__art"><picture><source media="\(max-width: 1023px\)"\/><img alt="[^"]{20,}" width="1600" height="900" class="fsb__image" loading="lazy" decoding="async"\/><\/picture><\/div>/, 'deferred: no src until revealed');
  assert.ok(lead.includes('<div class="fsb__content"><div class="fsb__copy"><p class="fsb__eyebrow">Live beautifully</p><h3 class="fsb__h" id="fsb-lifestyle-h">Lifestyle Store</h3><p class="fsb__description">Fashion, home, living and everyday essentials — all in one place.</p><span class="fsb__cta" id="fsb-lifestyle-cta">Explore Lifestyle <svg'), 'the copy, in order');
  const badges = [...lead.matchAll(/<li><svg[\s\S]*?<\/svg><span>([^<]*)<\/span><\/li>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  assert.deepEqual(badges, ['Fashion & Accessories', 'Home & Living', 'Beauty & Wellness', 'Everyday Essentials']);
  assert.match(lead, /<ul class="fsb__details" aria-label="[^"]+">/);
  assert.ok(lead.indexOf('class="fsb__copy"') < lead.indexOf('class="fsb__details"'), 'the badges follow the copy, so they can drop below the photo on a phone');
  const el = eager.match(/<a class="fsb__card fsb__card--lifestyle fsb__card--lead"[\s\S]*?<\/a>/)[0];
  assert.match(el, /<source media="\(max-width: 1023px\)" srcSet="\/img\/lifestyle-banner-tall\.webp"\/><img [^>]*src="\/img\/lifestyle-banner-wide\.webp"/);
});

await test('Part B: the two cards as today — same copy, same badges, the landscape photographs — one per slide, the first current, the other hidden and untabbable; two dots as tabs outside the links', () => {
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
    assert.match(c, /<div class="fsb__art"><img alt="[^"]{20,}" width="1600" height="900" class="fsb__image" loading="lazy" decoding="async"\/><\/div>/, `${e.key}: one photograph, no <picture> — the landscape at every width`);
    assert.ok(c.includes(`<p class="fsb__eyebrow">${e.eyebrow}</p><h3 class="fsb__h" id="fsb-${e.key}-h"><span>${e.h[0]}</span> <span>${e.h[1]}</span></h3><p class="fsb__description">${e.desc}</p><span class="fsb__cta" id="fsb-${e.key}-cta">${e.cta} <svg`), `${e.key}: the copy as today`);
    assert.deepEqual([...c.matchAll(/<li><svg[\s\S]*?<\/svg><span>([^<]*)<\/span><\/li>/g)].map((m) => m[1].replace(/&amp;/g, '&')), e.badges, `${e.key}: the badges as today`);
  });
  const eagerSlides = [...eager.matchAll(/<div class="fsb__slide[^"]*"[\s\S]*?<img [^>]*src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(eagerSlides, ['/img/doorway-fashion-wide.webp', '/img/doorway-living-wide.webp']);
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

await test('1280 (from 1024): the banner is page-wide at 16:7 with the copy on the left 38% under a wash gone by 52% and the four badges beneath the CTA; the carousel is a 760px 16:9 card — smaller than the banner in width and height', () => {
  assert.equal(decl(wideBlock, '.fsb__card--lead .fsb__art', 'aspect-ratio'), '16 / 7');
  assert.equal(decl(wideBlock, '.fsb__card--lead .fsb__content', 'width'), '38%');
  assert.match(decl(wideBlock, '.fsb__card--lead .fsb__art::after', 'background'), /^linear-gradient\(90deg, #f6efe3[0-9a-f]{2} 0%.*#f6efe300 52%\)$/);
  assert.equal(decl(wideBlock, '.fsb__card--lead .fsb__details', 'grid-template-columns'), 'repeat(4, minmax(0, 1fr))');
  assert.equal(decl(wideBlock, '.fsb__content', 'grid-area'), '1 / 1', 'the copy (and, on a wide screen, the badges) share the photo\'s cell');
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

await test('390 and 768: the banner is the 4:5 portrait with the copy on it (cell 1/1, top) under a top-down wash and the badges in the row beneath, two by two; the carousel cards are 16:10 landscapes — shorter than the banner — with their copy left of the subject and badges beneath', () => {
  assert.ok(phoneBlock, 'a phone block');
  assert.equal(decl(phoneBlock, '.fsb__card--lead .fsb__art', 'aspect-ratio'), '4 / 5');
  assert.equal(decl(phoneBlock, '.fsb__content', 'display'), 'contents');
  assert.equal(decl(phoneBlock, '.fsb__copy', 'grid-area'), '1 / 1'); assert.equal(decl(phoneBlock, '.fsb__copy', 'align-self'), 'start');
  assert.equal(decl(phoneBlock, '.fsb__details', 'grid-area'), '2 / 1', 'the badges sit below the photo');
  assert.equal(decl(phoneBlock, '.fsb__card--lead .fsb__details', 'grid-template-columns'), 'repeat(2, minmax(0, 1fr))');
  assert.match(decl(phoneBlock, '.fsb__card--lead .fsb__art::after', 'background'), /^linear-gradient\(180deg, #f6efe3[0-9a-f]{2} 0%.*#f6efe300 (5\d|6[0-4])%\)$/);
  assert.equal(decl(phoneBlock, '.fsb__slide .fsb__art', 'aspect-ratio'), '16 / 10');
  assert.ok(10 / 16 < 5 / 4, 'a 16:10 card is shorter than a 4:5 banner of the same width');
  assert.equal(decl(phoneBlock, '.fsb__slide .fsb__copy', 'align-self'), 'center'); assert.match(decl(phoneBlock, '.fsb__slide .fsb__copy', 'width'), /^5[0-6]%$/, 'the copy stays left of the subjects (from 44% / 50% of the photo)');
  assert.equal(decl(phoneBlock, '.fsb__carousel', 'max-width'), 'none');
});

await test('the phone scale is pinned: the five tokens exactly, and at a 358px banner (390 viewport) the copy stack — eyebrow, one-line headline, two-line subline, CTA — ends above 42% of the 4:5 card, where the portrait subject begins', () => {
  const tokens = { '--fsb-pad': 'clamp(18px, 5cqw, 32px)', '--fsb-eyebrow': 'clamp(10px, 2.8cqw, 12px)', '--fsb-h': 'clamp(26px, 8.4cqw, 44px)', '--fsb-desc': 'clamp(13px, 3.8cqw, 17px)', '--fsb-cta': 'clamp(40px, 11cqw, 48px)' };
  for (const [k, v] of Object.entries(tokens)) assert.equal(decl(phoneBlock, '.fsb__card', k), v, k);
  assert.equal(decl(phoneBlock, '.fsb__card--lead .fsb__eyebrow', 'font-size'), 'var(--fsb-eyebrow)'); assert.equal(decl(phoneBlock, '.fsb__card--lead .fsb__h', 'font-size'), 'var(--fsb-h)');
  assert.equal(decl(phoneBlock, '.fsb__card--lead .fsb__description', 'font-size'), 'var(--fsb-desc)'); assert.equal(decl(phoneBlock, '.fsb__card--lead .fsb__cta', 'min-height'), 'var(--fsb-cta)');
  const stack = (W) => px(tokens['--fsb-pad'], W)
    + px(tokens['--fsb-eyebrow'], W) * Number(decl(wideBlock, '.fsb__card .fsb__eyebrow', 'line-height')) + px(decl(phoneBlock, '.fsb__card--lead .fsb__eyebrow', 'margin-bottom'), W)
    + px(tokens['--fsb-h'], W) * Number(decl(wideBlock, '.fsb__h', 'line-height')) + px(decl(phoneBlock, '.fsb__card--lead .fsb__h', 'margin-bottom'), W)
    + px(tokens['--fsb-desc'], W) * Number(decl(phoneBlock, '.fsb__card--lead .fsb__description', 'line-height')) * 2 + px(decl(phoneBlock, '.fsb__card--lead .fsb__description', 'margin-bottom'), W)
    + px(tokens['--fsb-cta'], W);
  for (const [vw, W] of [[360, 328], [390, 358], [768, 720]]) {
    const need = stack(W), card = W * 1.25;
    assert.ok(need / card <= 0.42, `${vw}: the copy stack ends at ${((need / card) * 100).toFixed(1)}% of the card`);
  }
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
  const allowed = /^(src\/components\/FashionBanner\.jsx$|src\/styles\/fashion-banner\.css$|src\/pages\/Home\.jsx$|img\/lifestyle-banner-(wide|tall)\.webp$|scripts\/|public\/|reports\/)/;
  const bad = [...changed].filter((f) => !allowed.test(f));
  assert.deepEqual(bad, [], `unexpected files changed: ${bad.join(', ')}`);
  for (const rel of ['build/build-css.mjs', 'src/App.jsx', 'src/lifestyle/LifestyleHome.jsx', 'src/lib/store.jsx', 'src/pages/Cart.jsx', 'src/pages/Checkout.jsx', 'src/lib/payments.js', 'src/lib/customerAuth.jsx']) {
    assert.equal(read(rel), atCommit(BASELINE_SHA, rel).replace(/\r\n/g, '\n'), `${rel} is byte-identical to ${BASELINE_SHA}`);
  }
  assert.match(read('build/build-css.mjs'), /'src\/styles\/fashion-banner\.css',/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
