// ============================================================
// The homepage store doorway ("Two Worlds. A Better You.") — offline suite.
//
// Two whole-card links, each one photograph with every word on it as HTML:
// a 16:9 landscape with the copy down the left on wide screens, a 4:5
// portrait with the copy in the empty upper area under 1024px and the icon
// badges below the photo. The four images (subject right / subject low,
// under 150 KB each), the <picture> that lets the browser choose, the copy
// (the Home & Living line describes only what the store stocks), the cream
// wash, the desktop and phone type scales pinned so the copy stack cannot
// creep into the subject, the three widths, no speed claim, and the
// isolation of everything else. NO NETWORK, NO DATABASE, NO BROWSER.
//
//   node scripts/test-store-doorway.mjs
//   GROCERY_SRC_ROOT=<pre-change checkout> node scripts/test-store-doorway.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server.mjs';
import { ROOT, read, has, h, loadModule } from './grocery-ssr.mjs';
import { REPO } from './baseline-export.mjs';

// The tree as it stood before this work: the Home & Living product page release.
const BASELINE_SHA = '1cd6bb4';
let passed = 0, failed = 0, current = '(startup)';
process.on('unhandledRejection', (e) => { console.error(`\n  FATAL during: ${current}\n  ${e?.stack || e}`); process.exitCode = 1; });
async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
const text = (html) => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
console.log(`\nsource root: ${ROOT}`);

const SPEED_CLAIMS = [/\bfast\b/i, /\bfaster\b/i, /\bexpress\b/i, /\binstant/i, /\bsecure\s+deliver/i, /\bsame[- ]day\b/i, /\bnext[- ]day\b/i, /\b\d+\s*mins?\b/i, /\bminutes?\b/i, /\bquick\b/i, /\brapid\b/i, /\bspeedy\b/i, /\beco[- ]friendly\b/i];
const IMAGES = {
  'img/doorway-fashion-wide.webp': [1600, 900],
  'img/doorway-living-wide.webp': [1600, 900],
  'img/doorway-fashion-tall.webp': [1000, 1250],
  'img/doorway-living-tall.webp': [1000, 1250],
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

/** A CSS length at a given card width: 12px, 5.4cqw, max(a, b), clamp(a, b, c). */
function px(expr, cardWidth) {
  const e = expr.trim();
  const fn = e.match(/^(clamp|max|min)\((.*)\)$/);
  if (fn) {
    const args = fn[2].split(',').map((a) => px(a, cardWidth));
    if (fn[1] === 'max') return Math.max(...args);
    if (fn[1] === 'min') return Math.min(...args);
    return Math.min(Math.max(args[1], args[0]), args[2]);
  }
  const m = e.match(/^(-?[\d.]+)(px|cqw)$/);
  assert.ok(m, `cannot read length ${expr}`);
  return m[2] === 'px' ? Number(m[1]) : (Number(m[1]) / 100) * cardWidth;
}
/** `prop: value` inside the first rule whose selector list matches, within a CSS block. */
function decl(css, selector, prop) {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `no rule ${selector}`);
  const body = css.slice(at, css.indexOf('}', at));
  const m = body.match(new RegExp(`(?:^|[\\s;{])${prop.replace(/[-]/g, '\\-')}:\\s*([^;]+);`));
  assert.ok(m, `${selector} has no ${prop}`);
  return m[1].trim();
}

// ---- the images ---------------------------------------------------------
await test('the four doorway images exist, under 150 KB each, at the sizes the markup declares: two 16:9 landscapes for wide screens, two 4:5 portraits for phones', () => {
  for (const [rel, [w, hgt]] of Object.entries(IMAGES)) {
    assert.ok(has(rel), `${rel} is missing`);
    const size = statSync(resolve(ROOT, rel)).size;
    assert.ok(size <= 150 * 1024, `${rel} is ${(size / 1024).toFixed(0)} KB`);
    assert.deepEqual(webpSize(readFileSync(resolve(ROOT, rel))), [w, hgt], `${rel} dimensions`);
  }
  assert.equal(Math.round((1600 / 900) * 100), 178); assert.equal(1000 / 1250, 0.8);
});

// ---- the component, rendered ---------------------------------------------
const Icon = loadModule('src/components/Icon.jsx').default;
const DeferredImage = loadModule('src/components/DeferredImage.jsx').default;
const Banner = loadModule('src/components/FashionBanner.jsx', { Link, Icon, DeferredImage }).default;
const html = renderToStaticMarkup(h(StaticRouter, { location: '/' }, h(Banner)));
// The same component with the deferral removed, so the file choice is visible.
const EagerImage = ({ src, sources = [], loading, decoding, fetchPriority, ...props }) =>
  h('picture', null, ...sources.map((s) => h('source', { key: s.media, media: s.media, srcSet: s.srcSet })), h('img', { ...props, src }));
const EagerBanner = loadModule('src/components/FashionBanner.jsx', { Link, Icon, DeferredImage: EagerImage }).default;
const eager = renderToStaticMarkup(h(StaticRouter, { location: '/' }, h(EagerBanner)));

await test('two whole-card links, each one photograph: a <picture> whose portrait <source> is chosen under 1024px and whose <img> is the landscape; nothing loads until revealed', () => {
  assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ['/fashion', '/homeliving']);
  assert.equal((html.match(/<a /g) || []).length, 2, 'two links, nothing nested');
  assert.equal((html.match(/<picture>/g) || []).length, 2);
  assert.equal((html.match(/<source media="\(max-width: 1023px\)"\/?>/g) || []).length, 2, 'the portrait source carries no srcset until revealed');
  assert.equal((html.match(/<img /g) || []).length, 2); assert.equal((html.match(/loading="lazy"/g) || []).length, 2);
  assert.doesNotMatch(html, /<img[^>]+ src=/, 'deferred: no src on initial render');
  const files = [...eager.matchAll(/(?:srcSet|srcset|src)="(\/img\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(files, ['/img/doorway-fashion-tall.webp', '/img/doorway-fashion-wide.webp', '/img/doorway-living-tall.webp', '/img/doorway-living-wide.webp']);
  for (const f of files) assert.ok(has(f.slice(1)), `${f} exists`);
  assert.equal((eager.match(/<source media="\(max-width: 1023px\)" srcSet="\/img\/doorway-[a-z]+-tall\.webp"/g) || []).length, 2);
  assert.equal((eager.match(/<img [^>]*width="1600" height="900"/g) || []).length, 2, 'intrinsic size declared');
  for (const alt of [...eager.matchAll(/alt="([^"]*)"/g)].map((m) => m[1])) assert.ok(alt.length > 20, 'a real description of the photograph');
});

await test('the copy: section heading and lede kept; each card has eyebrow, a two-line headline, subline, CTA and three badges, all as HTML; the Home & Living line names only what the store stocks', () => {
  const t = text(html);
  assert.ok(t.includes('More to explore') && t.includes('Two Worlds. A Better You.') && t.includes('Fashion for your style. Living for your space. All at SORA LIFE.'));
  assert.match(html, /<h2 id="fsb-h">Two Worlds\. A Better You\.<\/h2>/);
  const cards = html.split('<a ').slice(1);
  assert.equal(cards.length, 2);
  const expect = [
    { eyebrow: 'Discover your style', h: ['Fashion', 'Store'], desc: 'Clothing, footwear, bags, beauty and accessories — all in one place.', cta: 'Explore Fashion', badges: ['Clothing & more', 'Everyday style', 'Easy shopping'] },
    { eyebrow: 'Make space for a better you', h: ['Home & Living', 'Store'], desc: 'Home textiles, soft furnishings and everyday essentials for your space.', cta: 'Explore Living', badges: ['Soft textures', 'Calm spaces', 'Everyday living'] },
  ];
  cards.forEach((c, i) => {
    const e = expect[i];
    assert.match(c, new RegExp(`<p class="fsb__eyebrow">${e.eyebrow}</p>`));
    assert.match(c, new RegExp(`<h3 class="fsb__h" id="fsb-[a-z]+-h"><span>${e.h[0].replace('&', '&amp;')}</span> <span>${e.h[1]}</span></h3>`), 'two-line headline: two spans');
    assert.ok(c.includes(`<p class="fsb__description">${e.desc}</p>`), `${e.h[0]} subline`);
    assert.match(c, new RegExp(`<span class="fsb__cta" id="fsb-[a-z]+-cta">${e.cta} <svg`));
    const badges = [...c.matchAll(/<li><svg[\s\S]*?<\/svg><span>([^<]*)<br\/>([^<]*)<\/span><\/li>/g)].map((m) => `${m[1]} ${m[2]}`.replace('&amp;', '&'));
    assert.deepEqual(badges, e.badges);
    assert.ok(c.indexOf('class="fsb__art"') < c.indexOf('class="fsb__content"'), 'art first, then the copy on it');
    assert.ok(c.includes('<div class="fsb__copy">'), 'the copy is wrapped so it can overlay the photo on its own');
    assert.ok(c.indexOf('class="fsb__copy"') < c.indexOf('class="fsb__details"'), 'the badges come after the copy so they can drop below the photo');
  });
  for (const bad of [/d[ée]cor/i, /kitchen/i, /furniture/i, /storage/i]) assert.doesNotMatch(t, bad, 'no range we do not stock');
  assert.match(cards[0], /aria-labelledby="fsb-fashion-h fsb-fashion-cta"/); assert.match(cards[1], /aria-labelledby="fsb-living-h fsb-living-cta"/);
  assert.doesNotMatch(html, /<button/, 'no nested interactive controls inside the links');
});

await test('text rule and copy: no speed claim in the component, the sheet or the render; every image has a description; no copy is baked in (every string the brief lists is in the HTML)', () => {
  const t = text(html);
  for (const re of SPEED_CLAIMS) {
    assert.doesNotMatch(t, re, `render: ${re}`);
    assert.doesNotMatch(read('src/components/FashionBanner.jsx'), re, `component: ${re}`);
    assert.doesNotMatch(stripComments(read('src/styles/fashion-banner.css')), re, `sheet: ${re}`);
  }
  for (const s of ['Discover your style', 'Fashion', 'Store', 'Explore Fashion', 'Make space for a better you', 'Home & Living', 'Explore Living', 'Soft textures', 'Calm spaces', 'Everyday living']) assert.ok(t.includes(s), s);
});

// ---- the stylesheet ------------------------------------------------------
const css = stripComments(read('src/styles/fashion-banner.css'));
const wideBlock = css.slice(0, css.indexOf('@media (max-width: 1023px)'));
const phoneBlock = (() => { const at = css.indexOf('@media (max-width: 1023px)'); return css.slice(at, css.indexOf('\n}\n', at) + 3); })();
const smallBlock = (() => { const at = css.indexOf('@media (max-width: 599px)'); return css.slice(at, css.indexOf('\n}\n', at) + 3); })();

await test('1280 (and every width from 1024): two side-by-side 16:9 cards, the photo full-bleed, the copy overlaid on its left with a cream wash that ends before the subject', () => {
  assert.match(wideBlock, /\.fsb__grid \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.equal(decl(wideBlock, '.fsb__art', 'aspect-ratio'), '16 / 9');
  assert.equal(decl(wideBlock, '.fsb__art', 'grid-area'), '1 / 1'); assert.equal(decl(wideBlock, '.fsb__content', 'grid-area'), '1 / 1', 'the copy shares the photo\'s cell: on it, not beside it');
  assert.equal(decl(wideBlock, '.fsb__image', 'object-fit'), 'cover');
  assert.equal(decl(wideBlock, '.fsb__card', 'container-type'), 'inline-size', 'the card is the size container the cqw type scales against');
  assert.match(decl(wideBlock, '.fsb__content', 'width'), /^(4\d|5[0-2])%$/, 'the copy column stays left of the subject (fashion from 44%, living from 50% of the photo)');
  const wash = decl(wideBlock, '.fsb__art::after', 'background');
  assert.match(wash, /^linear-gradient\(90deg, #f6efe3[0-9a-f]{2} 0%/, 'a cream wash from the left');
  const end = Number(wash.match(/#f6efe300 (\d+)%\)$/)?.[1]);
  assert.ok(end <= 64, `the wash is gone by ${end}%`);
  assert.doesNotMatch(wideBlock, /\.fsb__content \{[^}]*background:/, 'no coloured panel behind the copy');
  assert.doesNotMatch(wideBlock, /min-height: \d{3}px/, 'no fixed card height: the 16:9 photo sets it, so it is never cropped into the copy');
});

await test('the desktop type scale (cqw) fits the whole stack — eyebrow, two-line headline, two-line subline, CTA and badges — inside a 16:9 card at 1024 and at 1440', () => {
  const stack = (W) => {
    const pad = decl(wideBlock, '.fsb__content', 'padding').split(/\s+/);
    const eyebrowF = px(decl(wideBlock, '.fsb__card .fsb__eyebrow', 'font-size'), W), eyebrowLh = Number(decl(wideBlock, '.fsb__card .fsb__eyebrow', 'line-height')), eyebrowMb = px(decl(wideBlock, '.fsb__card .fsb__eyebrow', 'margin-bottom'), W);
    const hF = px(decl(wideBlock, '.fsb__h', 'font-size'), W), hLh = Number(decl(wideBlock, '.fsb__h', 'line-height')), hMb = px(decl(wideBlock, '.fsb__h', 'margin').split(/\s+/)[2], W);
    const dF = px(decl(wideBlock, '.fsb__description', 'font-size'), W), dLh = Number(decl(wideBlock, '.fsb__description', 'line-height')), dMb = px(decl(wideBlock, '.fsb__description', 'margin').split(/\s+/)[2], W);
    const cta = px(decl(wideBlock, '.fsb__cta', 'min-height'), W);
    const detPad = px(decl(wideBlock, '.fsb__details', 'padding').split(/\s+/)[0], W);
    const svg = px(decl(wideBlock, '.fsb__details svg', 'width'), W) + 2 * px(decl(wideBlock, '.fsb__details svg', 'padding'), W);
    const liGap = px(decl(wideBlock, '.fsb__details li', 'gap'), W), liF = px(decl(wideBlock, '.fsb__details li', 'font-size'), W), liLh = Number(decl(wideBlock, '.fsb__details li', 'line-height'));
    return px(pad[0], W) + px(pad[2], W) + eyebrowF * eyebrowLh + eyebrowMb + hF * hLh * 2 + hMb + dF * dLh * 2 + dMb + cta + detPad + svg + liGap + liF * liLh * 2;
  };
  for (const [vw, W] of [[1024, (1024 - 48 - 22) / 2], [1280, (1280 - 64 - 22) / 2], [1440, (1440 - 64 - 22) / 2]]) {
    const need = stack(W), have = W * 9 / 16;
    assert.ok(need <= have, `${vw}: the stack needs ${need.toFixed(0)}px in a ${have.toFixed(0)}px card`);
  }
});

await test('390 and 768: the 4:5 portrait, the copy ON the photo in its upper area (grid cell 1/1 over the art), the badges in the row below; the wash runs down from the top', () => {
  assert.match(phoneBlock, /^@media \(max-width: 1023px\)/);
  assert.match(phoneBlock, /\.fsb__grid \{ grid-template-columns: minmax\(0, 1fr\);/, 'stacked');
  assert.equal(decl(phoneBlock, '.fsb__art', 'aspect-ratio'), '4 / 5');
  assert.equal(decl(phoneBlock, '.fsb__content', 'display'), 'contents', 'the wrapper dissolves so the copy and the badges can land in different rows');
  assert.equal(decl(phoneBlock, '.fsb__copy', 'grid-area'), '1 / 1', 'the copy overlays the photo');
  assert.equal(decl(phoneBlock, '.fsb__copy', 'align-self'), 'start', '…in its upper area');
  assert.match(decl(phoneBlock, '.fsb__copy', 'z-index'), /^[1-9]/);
  assert.equal(decl(phoneBlock, '.fsb__details', 'grid-area'), '2 / 1', 'the badges sit below the photo');
  assert.equal(decl(phoneBlock, '.fsb__card', 'grid-template-rows'), 'auto auto');
  assert.match(decl(phoneBlock, '.fsb__art::after', 'background'), /^linear-gradient\(180deg, #f6efe3[0-9a-f]{2} 0%.*#f6efe300 (5\d|6[0-4])%\)$/);
  // The old phone layout — a static photo panel with a paper block of copy beneath it — is gone.
  assert.doesNotMatch(css, /\.fsb__art \{[^}]*position: relative; inset: auto/);
  assert.doesNotMatch(css, /\.fsb__content \{[^}]*background: var\(--fsb-paper\)/);
  assert.doesNotMatch(smallBlock, /fsb__(art|content|copy|image|details)/, 'the ≤599 block touches only the intro');
});

await test('the phone type scale is pinned: the five tokens exactly, and at a 358px card (390 viewport) the stack ends above 46% of the 4:5 card, where the portrait subjects begin', () => {
  const tokens = {
    '--fsb-pad': 'clamp(18px, 5cqw, 32px)',
    '--fsb-eyebrow': 'clamp(10px, 2.8cqw, 12px)',
    '--fsb-h': 'clamp(26px, 8.4cqw, 44px)',
    '--fsb-desc': 'clamp(13px, 3.8cqw, 17px)',
    '--fsb-cta': 'clamp(40px, 11cqw, 48px)',
  };
  for (const [k, v] of Object.entries(tokens)) assert.equal(decl(phoneBlock, '.fsb__card', k), v, k);
  assert.equal(decl(phoneBlock, '.fsb__card .fsb__eyebrow', 'font-size'), 'var(--fsb-eyebrow)'); assert.equal(decl(phoneBlock, '.fsb__h', 'font-size'), 'var(--fsb-h)');
  assert.equal(decl(phoneBlock, '.fsb__description', 'font-size'), 'var(--fsb-desc)'); assert.equal(decl(phoneBlock, '.fsb__cta', 'min-height'), 'var(--fsb-cta)');
  assert.equal(decl(phoneBlock, '.fsb__copy', 'padding'), 'var(--fsb-pad) var(--fsb-pad) 0');
  const stack = (W) => {
    const pad = px(tokens['--fsb-pad'], W);
    const eyebrow = px(tokens['--fsb-eyebrow'], W) * Number(decl(wideBlock, '.fsb__card .fsb__eyebrow', 'line-height')) + px(decl(phoneBlock, '.fsb__card .fsb__eyebrow', 'margin-bottom'), W);
    const head = px(tokens['--fsb-h'], W) * Number(decl(wideBlock, '.fsb__h', 'line-height')) * 2 + px(decl(phoneBlock, '.fsb__h', 'margin-bottom'), W);
    const desc = px(tokens['--fsb-desc'], W) * Number(decl(phoneBlock, '.fsb__description', 'line-height')) * 2 + px(decl(phoneBlock, '.fsb__description', 'margin-bottom'), W);
    return pad + eyebrow + head + desc + px(tokens['--fsb-cta'], W);
  };
  for (const [vw, W] of [[390, 390 - 32], [360, 360 - 32], [768, 768 - 48]]) {
    const need = stack(W), card = W * 1.25;
    assert.ok(need / card <= 0.46, `${vw}: the copy stack ends at ${((need / card) * 100).toFixed(1)}% of the card`);
  }
  assert.equal(decl(phoneBlock, '.fsb__description', 'max-width'), '40ch', 'two lines for both sublines at 358px');
});

await test('motion: transitions on transform, opacity and box-shadow only; hover lifts only on fine pointers; reduced motion stills everything', () => {
  for (const m of css.matchAll(/transition:\s*([^;]+);/g)) for (const part of m[1].replace(/\([^)]*\)/g, '').split(',')) assert.match(part.trim(), /^(?:transform|opacity|box-shadow|none)\b/, `transition on ${part.trim()}`);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{[^@]*\.fsb__card:hover \{ transform: translateY\(-3px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.fsb__card, \.fsb__image, \.fsb__cta svg \{ transition: none; \}/);
  assert.ok(css.split('\n').filter((l) => /^[.]/.test(l)).every((l) => l.startsWith('.fsb')), 'every selector is namespaced .fsb');
});

// ---- wiring and isolation ------------------------------------------------
await test('Home.jsx, the build lists and every other file are byte-identical to the baseline: only the banner\'s own files, the four images, scripts and build output changed', () => {
  const changed = new Set(execFileSync('git', ['diff', '--name-only', BASELINE_SHA], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean));
  const allowed = /^(src\/components\/FashionBanner\.jsx$|src\/styles\/fashion-banner\.css$|img\/doorway-(fashion|living)-(wide|tall)\.webp$|scripts\/|public\/|reports\/)/;
  const bad = [...changed].filter((f) => !allowed.test(f));
  assert.deepEqual(bad, [], `unexpected files changed: ${bad.join(', ')}`);
  assert.match(read('src/pages/Home.jsx'), /<HomeOffers[^>]*\/>\s*(\{\/\*[\s\S]*?\*\/\})?\s*<FashionBanner \/>/, 'still mounted after the offers');
  assert.match(read('build/build-css.mjs'), /'src\/styles\/fashion-banner\.css',/);
  assert.ok(existsSync(resolve(ROOT, 'img/doorway-living-tall.webp')));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
