// ============================================================
// The top of the wellness homepage (HomeStorefront.jsx) — offline suite.
//
// White with an orange accent, scoped to .hx: the hero carousel (the
// product lineup, copy over the photograph's empty white), the trust strip,
// the Fashion tile beside Health & Nutrition and Home & Living, "Explore the
// stores", and the festive promo strip. The copy is true (free standard
// delivery on every order, 7-day returns, support 9am–6pm IST, no
// percentage, no health outcome); every text-on-orange pair meets WCAG AA;
// every rule is scoped so no other page or storefront changes; everything
// from LifestyleBanner down is as it was. NO NETWORK, NO DATABASE, NO BROWSER.
//
//   node scripts/test-home-storefront.mjs
//   GROCERY_SRC_ROOT=<pre-change checkout> node scripts/test-home-storefront.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link, useLocation } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server.mjs';
import { ROOT, read, has, h, loadModule, loadSource } from './grocery-ssr.mjs';
import { atCommit } from './baseline-export.mjs';

// The tree before this work: the homepage banner and the fashion category strip.
const BASELINE_SHA = '2d22a4e';
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
const text = (html) => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
console.log(`\nsource root: ${ROOT}`);

/** Width and height from a WebP header. */
function webpSize(buf) {
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (chunk === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  if (chunk === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  throw new Error(`unknown WebP chunk ${chunk}`);
}
/** WCAG 2.x contrast of two #rrggbb colours. */
function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const IMAGES = {
  'img/home-hero-1.webp': [1536, 864], 'img/home-hero-1-800.webp': [800, 450],
  'img/home-hero-2.webp': [1600, 900], 'img/home-hero-2-800.webp': [800, 450],
  'img/home-tile-fashion.webp': [800, 1067], 'img/home-tile-nutrition.webp': [900, 563], 'img/home-tile-living.webp': [900, 563],
  'img/home-promo-festive.webp': [1600, 533], 'img/home-promo-festive-800.webp': [800, 267],
  'img/home-cat-wellness.webp': [480, 480], 'img/home-cat-personal-care.webp': [480, 480], 'img/home-cat-fashion.webp': [480, 480],
  'img/home-cat-groceries.webp': [480, 480], 'img/home-cat-home-textiles.webp': [480, 480],
};

await test('the photographs: fourteen WebP files, each under 150 KB, at the sizes the markup declares', () => {
  for (const [rel, [w, hgt]] of Object.entries(IMAGES)) {
    assert.ok(has(rel), `${rel} is missing`);
    const size = statSync(resolve(ROOT, rel)).size;
    assert.ok(size <= 150 * 1024, `${rel} is ${(size / 1024).toFixed(0)} KB`);
    assert.deepEqual(webpSize(readFileSync(resolve(ROOT, rel))), [w, hgt], `${rel} dimensions`);
  }
});

// ---- the sections, rendered -------------------------------------------------
const Icon = loadModule('src/components/Icon.jsx').default;
const DeferredImage = loadModule('src/components/DeferredImage.jsx').default;
const FashionEntryLink = loadModule('src/components/FashionEntryLink.jsx', { Link, useLocation, Icon }).default;
const mod = has('src/components/HomeStorefront.jsx') ? loadModule('src/components/HomeStorefront.jsx', { Link, Icon, DeferredImage, FashionEntryLink }) : {};
const render = (C, props = {}) => (C ? renderToStaticMarkup(h(StaticRouter, { location: '/' }, h(C, props))) : '');
const hero = render(mod.HomeHero), trust = render(mod.HomeTrustStrip), tiles = render(mod.HomeTiles), stores = render(mod.ExploreStores), promo = render(mod.FestivePromo);
const all = hero + trust + tiles + stores + promo;

await test('the hero: two slides of the product lineup; the first is the page\'s only h1 — "Everything for everyday wellbeing." with "Shop now" to /shop — the second "The Biosash range" with no button (no brand page exists); the first photograph loads at once, the second waits', () => {
  const slides = [...hero.matchAll(/<div class="hx-hero__slide hx-hero__slide--([a-z]+)" aria-hidden="(true|false)" aria-roledescription="slide" aria-label="(\d) of 2">([\s\S]*?)<\/div><\/div>(?=<div class="hx-hero__slide|<\/div><\/div><div class="hx-hero__dots")/g)];
  assert.deepEqual(slides.map((m) => [m[1], m[2], m[3]]), [['everyday', 'false', '1'], ['biosash', 'true', '2']]);
  const [one, two] = slides.map((m) => m[4]);
  assert.ok(one.includes('<p class="hx-eyebrow">Wellness · Fashion · Home · Personal care · More</p><h1 class="hx-hero__title"><span>Everything for</span> <span class="hx-hl">everyday wellbeing.</span></h1><a class="hx-btn" href="/shop">Shop now <svg'), 'slide 1, in order');
  assert.ok(two.endsWith('<p class="hx-eyebrow">In the catalogue</p><h2 class="hx-hero__title"><span>The Biosash</span> <span class="hx-hl">range</span></h2>'), 'slide 2: a heading, nothing after it');
  assert.doesNotMatch(two, /<a /, 'and no button');
  assert.equal((hero.match(/<h1/g) || []).length, 1, 'one h1');
  assert.match(one, /<picture><source media="\(max-width: 700px\)" srcSet="\/img\/home-hero-1-800\.webp"\/><img alt="[^"]{30,}" width="1536" height="864" class="hx-hero__image" src="\/img\/home-hero-1\.webp" loading="eager" decoding="async" fetchPriority="high"\/><\/picture>/, 'the first photograph is the page\'s largest paint: eager, high priority');
  assert.match(two, /<picture><source media="\(max-width: 700px\)"\/><img alt="[^"]{30,}" width="1600" height="900" class="hx-hero__image" loading="lazy" decoding="async"\/><\/picture>/, 'the second waits until it is near');
  assert.match(hero, /<div class="hx-hero__track" style="transform:translateX\(-0%\)">/, 'the track moves on transform');
  assert.match(hero, /<div class="hx-hero__dots" role="group" aria-label="Choose a slide"><button type="button" aria-label="Show slide 1 of 2" aria-pressed="true" class="hx-hero__dot is-on"><\/button><button type="button" aria-label="Show slide 2 of 2" aria-pressed="false" class="hx-hero__dot"><\/button><\/div>/);
});

await test('the hero carousel: autoplays only with more than one slide, pauses on hover and on focus, never moves under prefers-reduced-motion; a 40px sideways swipe changes the slide and swallows the click; the hidden slide\'s button is untabbable', async () => {
  const { hooks, mount, findAll } = await import('./catalogue-admin-harness.mjs');
  let reduce = false;
  const timers = [];
  const win = { matchMedia: () => ({ matches: reduce, addEventListener() {}, removeEventListener() {} }) };
  const setInterval = (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length - 1; };
  const clearInterval = (id) => { if (timers[id]) timers[id].live = false; };
  const m = loadSource(read('src/components/HomeStorefront.jsx'), { ...hooks, window: win, setInterval, clearInterval, Link: 'a', Icon: () => null, DeferredImage: (p) => h('img', p), FashionEntryLink: 'a' });
  assert.equal(typeof m.HomeHero, 'function');
  const live = () => timers.filter((t) => t.live);
  const tree = await mount(h(m.HomeHero));
  const node = (cls) => findAll(tree.tree, (n) => n.props?.className === cls)[0];
  const at = () => node('hx-hero__track').props.style.transform;
  assert.equal(live().length, 1); assert.equal(live()[0].ms, m.HERO_AUTOPLAY_MS); assert.equal(m.HERO_AUTOPLAY_MS, 6000);
  await tree.act(() => { for (const t of live()) t.fn(); }); assert.equal(at(), 'translateX(-100%)');
  await tree.act(() => { for (const t of live()) t.fn(); }); assert.equal(at(), 'translateX(-0%)', 'and round again');
  const button = findAll(tree.tree, (n) => n.type === 'a' && n.props.className === 'hx-btn')[0];
  assert.equal(button.props.tabIndex, undefined, 'the current slide\'s button is in the tab order');
  const section = node('hx hx-hero');
  await tree.act(() => section.props.onMouseEnter()); assert.equal(live().length, 0, 'hover pauses');
  await tree.act(() => section.props.onMouseLeave()); assert.equal(live().length, 1);
  await tree.act(() => section.props.onFocus()); assert.equal(live().length, 0, 'focus pauses');
  await tree.act(() => section.props.onBlur()); assert.equal(live().length, 1);
  const vp = node('hx-hero__viewport');
  await tree.act(() => { vp.props.onPointerDown({ clientX: 300, clientY: 10 }); vp.props.onPointerUp({ clientX: 280, clientY: 12 }); });
  assert.equal(at(), 'translateX(-0%)', 'a 20px drag is not a swipe');
  await tree.act(() => { vp.props.onPointerDown({ clientX: 300, clientY: 10 }); vp.props.onPointerUp({ clientX: 220, clientY: 16 }); });
  assert.equal(at(), 'translateX(-100%)', 'a swipe to the left: the next slide');
  let swallowed = 0;
  vp.props.onClickCapture({ preventDefault() { swallowed++; }, stopPropagation() {} });
  assert.equal(swallowed, 1, 'the click a swipe ends in does not follow the link');
  assert.equal(findAll(tree.tree, (n) => n.type === 'a' && n.props.className === 'hx-btn')[0].props.tabIndex, -1, 'slide 1 hidden: its button leaves the tab order');
  reduce = true;
  const still = await mount(h(m.HomeHero));
  for (let i = 0; i < 3; i++) await still.act(() => { for (const t of live()) t.fn(); });
  assert.equal(findAll(still.tree, (n) => n.props?.className === 'hx-hero__track')[0].props.style.transform, 'translateX(-0%)', 'reduced motion: never moves on its own');
  reduce = false;
  const before = live().length;
  const single = await mount(h(m.HomeHero, { slides: m.HERO_SLIDES.slice(0, 1) }));
  assert.equal(live().length, before, 'one slide: no autoplay');
  assert.equal(findAll(single.tree, (n) => n.type === 'button').length, 0, 'and no dots');
});

await test('the trust strip: "Free Standard Delivery — On every order", "Genuine Products", "Easy Returns — 7 days", "Support — 9am–6pm IST"; the three with a policy link to it', () => {
  const items = [...trust.matchAll(/<li>(?:<a href="([^"]+)">|<span class="hx-trust__item">)<svg[\s\S]*?<\/svg><span><strong>([^<]+)<\/strong>(?:<small>([^<]+)<\/small>)?<\/span>/g)].map((m) => [m[2], m[3] || null, m[1] || null]);
  assert.deepEqual(items, [
    ['Free Standard Delivery', 'On every order', '/shipping'],
    ['Genuine Products', null, null],
    ['Easy Returns', '7 days', '/returns'],
    ['Support', '9am–6pm IST', '/contact'],
  ]);
});

await test('the tiles: Fashion, large, opening the fashion chooser; Health & Nutrition to Supplements; Home & Living to the Home & Living store — each heading HTML over or beside its photograph', () => {
  assert.match(tiles, /<a class="hx-tile hx-tile--fashion" aria-labelledby="hx-fashion-h hx-fashion-cta" aria-haspopup="dialog" href="\/fashion"><div class="hx-tile__panel"><h2 class="hx-tile__h" id="hx-fashion-h"><span>Fashion<\/span> <span>for every<\/span> <span>mood\.<\/span><\/h2><span class="hx-btn hx-btn--light" id="hx-fashion-cta">Shop Fashion <svg/);
  assert.match(tiles, /<a class="hx-tile hx-tile--small hx-tile--nutrition" aria-labelledby="hx-nutrition-h" href="\/category\/supplements">[\s\S]*?<h2 class="hx-tile__h" id="hx-nutrition-h"><span>Health &amp;<\/span> <span>Nutrition<\/span><\/h2>/);
  assert.match(tiles, /<a class="hx-tile hx-tile--small hx-tile--living" aria-labelledby="hx-living-h" href="\/homeliving">[\s\S]*?<h2 class="hx-tile__h" id="hx-living-h"><span>Home &amp;<\/span> <span>Living<\/span><\/h2>/);
  assert.equal((tiles.match(/<img /g) || []).length, 3); assert.equal((tiles.match(/loading="lazy"/g) || []).length, 3);
});

await test('"Explore the stores" (not a second "Shop by category"): Wellness, Personal Care, Fashion, Groceries, Home Textiles — each a circle and its name, each to its own place', () => {
  assert.match(stores, /<h2 class="hx-stores__h" id="hx-stores-h">Explore the stores<\/h2>/);
  const items = [...stores.matchAll(/<li><a (?:class="hx-store" )?(?:aria-haspopup="dialog" )?(?:class="hx-store" )?href="([^"]+)"[^>]*><span class="hx-store__art"><img alt="" width="480" height="480" class="hx-store__image" loading="lazy" decoding="async"\/><\/span><span class="hx-store__name">([^<]+)<\/span><\/a><\/li>/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(items, [['Wellness', '/category/wellness'], ['Personal Care', '/category/personal-care'], ['Fashion', '/fashion'], ['Groceries', '/grocery'], ['Home Textiles', '/homeliving']]);
  assert.doesNotMatch(all, /Shop by category/i, 'the page keeps one "Shop by category" — the one further down');
});

await test('the promo strip: "Festive gifting" / "Wellness, beauty and home picks to give this season" / "Shop gifts" to /shop, over the gift-and-diya photograph', () => {
  assert.match(promo, /<a class="hx-promo__card" aria-labelledby="hx-promo-h hx-promo-cta" href="\/shop"><picture><source media="\(max-width: 700px\)"\/><img alt="[^"]{30,}" width="1600" height="533" class="hx-promo__image" loading="lazy" decoding="async"\/><\/picture><div class="hx-promo__copy"><h2 class="hx-promo__h" id="hx-promo-h">Festive gifting<\/h2><p class="hx-promo__text">Wellness, beauty and home picks to give this season<\/p><span class="hx-btn" id="hx-promo-cta">Shop gifts <svg/);
});

await test('the copy is true: no free-shipping threshold, no round-the-clock support, no percentage or offer, no health outcome — in the component and in the render', () => {
  const banned = [/above\s*₹|₹\s*499|threshold/i, /24\s*[×x*]\s*7|24\/7|round[- ]the[- ]clock/i, /\d+\s*%|\bper\s*cent\b|\boff\b(?!er)/i, /festive offers|up to/i, /healthier|happier|\bcures?\b|\bheal(s|ing)?\b|immunit|detox/i, /free shipping/i];
  for (const [name, s] of [['component', stripComments(read('src/components/HomeStorefront.jsx'))], ['render', text(all)]]) {
    for (const re of banned) assert.doesNotMatch(s, re, `${name}: ${re}`);
  }
  for (const s of ['Free Standard Delivery', 'On every order', 'Easy Returns', '7 days', '9am–6pm IST', 'Everything for everyday wellbeing.', 'Festive gifting', 'Shop gifts']) assert.ok(text(all).includes(s), s);
});

// ---- the stylesheet --------------------------------------------------------
const sheet = stripComments(read('src/styles/v2-home.css'));
const hxAt = sheet.indexOf('.hx {');
const hx = hxAt < 0 ? '' : sheet.slice(hxAt);
const decl = (selector, prop) => {
  const at = hx.indexOf(`${selector} {`);
  assert.ok(at >= 0, `no rule ${selector}`);
  const m = hx.slice(at, hx.indexOf('}', at)).match(new RegExp(`(?:^|[\\s;{])${prop.replace(/-/g, '\\-')}:\\s*([^;]+);`));
  assert.ok(m, `${selector} has no ${prop}`);
  return m[1].trim();
};

await test('scoped: every selector in the new rules starts with .hx (no element, :root, body or other storefront selector), no --slv2-* token is redefined, and the rest of the sheet is as it was', () => {
  assert.ok(hx, 'the .hx block');
  const rules = [...hx.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  assert.ok(rules.length >= 60, `the rules (${rules.length})`);
  for (const [, sel, body] of rules) {
    for (const part of sel.split(',').map((p) => p.trim()).filter(Boolean)) assert.match(part, /^\.hx/, `unscoped selector: ${part}`);
    assert.doesNotMatch(body, /--slv2-[a-z0-9-]+\s*:/, `${sel.trim()} redefines a --slv2 token`);
  }
  const base = atCommit(BASELINE_SHA, 'src/styles/v2-home.css').replace(/\r\n/g, '\n');
  assert.equal(read('src/styles/v2-home.css').slice(0, base.length), base, 'the sheet before the new rules is byte-identical');
});

await test('contrast (WCAG 2.x), from the stylesheet itself: white on the deep-orange buttons ≥ 4.5:1, the deep-orange headline line on white ≥ 4.5:1, near-black on the bright-orange Fashion panel ≥ 4.5:1; the bright orange never carries white text', () => {
  const token = (name) => { const m = hx.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`)); assert.ok(m, name); return m[1]; };
  const orange = token('--hx-orange'), deep = token('--hx-orange-deep'), ink = token('--hx-ink');
  assert.equal(decl('.hx .hx-btn', 'background'), 'var(--hx-orange-deep)'); assert.equal(decl('.hx .hx-btn', 'color'), '#fff');
  assert.equal(decl('.hx .hx-hl', 'color'), 'var(--hx-orange-deep)');
  assert.equal(decl('.hx-tile--fashion', 'background'), 'var(--hx-orange)'); assert.equal(decl('.hx-tile__h', 'color'), 'var(--hx-ink)');
  const pairs = [['white on the deep-orange buttons', '#FFFFFF', deep], ['deep orange on white (headline line)', deep, '#FFFFFF'], ['near-black on the bright-orange Fashion panel', ink, orange]];
  for (const [what, fg, bg] of pairs) {
    const r = contrast(fg, bg);
    assert.ok(r >= 4.5, `${what}: ${r.toFixed(2)}:1`);
    console.log(`        ${what}: ${fg} on ${bg} = ${r.toFixed(2)}:1`);
  }
  assert.ok(contrast('#FFFFFF', orange) < 4.5, 'white on the bright orange would fail — which is why nothing does it');
  for (const [, sel, body] of hx.matchAll(/([^{}]+)\{([^{}]*)\}/g)) assert.ok(!(/background:\s*var\(--hx-orange\)/.test(body) && /color:\s*#fff\b/.test(body)), `${sel.trim()}: white text on the bright orange`);
});

await test('the phone, as in the mockup: the hero stacks its copy above the lineup; the trust strip stays one row of four, scrolling sideways; the three tiles stay side by side — Fashion the left half at full height, the two others stacked in the right half; the circles scroll sideways; no rule pairs aspect-ratio with a min/max height', () => {
  const at = hx.indexOf('@media (max-width: 700px)');
  const phone = hx.slice(at, hx.indexOf('\n}\n', at));
  assert.match(phone, /\.hx-hero__image \{ top: auto; bottom: 0; width: 170%; height: auto;/);
  assert.match(phone, /\.hx-trust__list \{ display: flex;[^}]*overflow-x: auto;/, 'one row that scrolls');
  // A row that scrolls shows a partial item at the edge as its cue — never items cut wherever they happen to fall.
  assert.match(phone, /\.hx-trust__list li \{ flex: 0 0 calc\(100% \/ 2\.5\);/, 'two and a half trust items in view');
  assert.match(phone, /\.hx-stores__row li \{ flex: 0 0 calc\(\(100% - 3 \* 14px\) \/ 3\.5\);/, 'three and a half circles in view');
  assert.match(hx, /@media \(max-width: 700px\) and \(hover: hover\) and \(pointer: fine\) \{\s*\.hx-trust__list, \.hx-stores__row \{ scrollbar-width: thin; \}/, 'a mouse, which cannot swipe, gets a thin scrollbar');
  assert.doesNotMatch(phone, /\.hx-trust__list \{[^}]*grid-template-columns/, 'not a 2×2 grid');
  assert.match(phone, /\.hx-tiles__grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); grid-template-rows: repeat\(2, minmax\(0, 1fr\)\);/, 'two columns, two rows');
  assert.equal(decl('.hx-tile--fashion', 'grid-row'), '1 / 3', 'Fashion spans both rows');
  assert.doesNotMatch(phone, /\.hx-tile--fashion \{[^}]*grid-row/, 'and still does on a phone');
  assert.match(phone, /\.hx-stores__row \{ display: flex;[^}]*overflow-x: auto;/);
  for (const [, sel, body] of hx.matchAll(/([^{}]+)\{([^{}]*)\}/g)) assert.ok(!(/aspect-ratio:\s*(?!auto\b)[^;\s]/.test(body) && /(min|max)-height:\s*(?!0[;\s]|none\b)[^;\s]/.test(body)), `${sel.trim()}: aspect-ratio with a min/max height`);
});

// ---- the page ----------------------------------------------------------------
await test('Home.jsx: the five sections lead the page in the mockup\'s order, then the offers; the old hero and category strip are gone from it; everything from LifestyleBanner down is exactly as it was', () => {
  const home = read('src/pages/Home.jsx');
  const order = [...home.matchAll(/<(HomeHero|HomeTrustStrip|HomeTiles|ExploreStores|FestivePromo|HomeOffers|LifestyleBanner)\b/g)].map((m) => m[1]);
  assert.deepEqual(order, ['HomeHero', 'HomeTrustStrip', 'HomeTiles', 'ExploreStores', 'FestivePromo', 'HomeOffers', 'LifestyleBanner']);
  assert.doesNotMatch(home, /import Hero from|import HomeCategoryStrip from|<Hero \/>|<HomeCategoryStrip/);
  assert.match(home, /admin Hero Slides page no longer drives it/, 'the page says where the hero comes from now');
  const tail = (s) => s.slice(s.indexOf('      <LifestyleBanner />'));
  assert.equal(tail(home), tail(atCommit(BASELINE_SHA, 'src/pages/Home.jsx')), 'from LifestyleBanner down, byte-identical');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
