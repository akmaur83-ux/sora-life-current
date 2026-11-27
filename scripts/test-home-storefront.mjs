// ============================================================
// The top of the wellness homepage (HomeStorefront.jsx) — offline suite.
//
// White with an orange accent, scoped to .hx: the hero carousel (the
// product lineup, copy over the photograph's empty white), the trust strip,
// the Fashion tile beside Health & Nutrition and Home & Living, "Explore the
// stores", and the festive promo strip — at phone width laid out as the
// owner's mockup (one compact hero block, one row of four trust items, the
// tiles side by side, six circles in a row, the whole festive photograph). The copy is true (free standard
// delivery on every order, 7-day returns, support 9am–6pm IST, no
// percentage, no health outcome); every text-on-orange pair meets WCAG AA;
// every rule is scoped so no other page or storefront changes; everything
// from LifestyleBanner down is as it was but for the jewellery banner, mounted
// directly under it (Jewellery is also the sixth circle). NO NETWORK, NO DATABASE, NO BROWSER.
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
import sharp from 'sharp';
import { atCommit } from './baseline-export.mjs';
import { sansDeadHomepageCode, sansSiteName } from './storefront-settings-pin.mjs';

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

// The jewellery banner's two photographs (the owner's): the wide one from 701px, the 4:5 portrait on a phone.
const JEWELLERY_PHOTOS = { 'img/home-jewellery-wide.webp': [1891, 831], 'img/home-jewellery-portrait.webp': [1122, 1402] };
const IMAGES = {
  'img/home-hero-1.webp': [1536, 864], 'img/home-hero-1-800.webp': [800, 450],
  'img/home-hero-2.webp': [1600, 900], 'img/home-hero-2-800.webp': [800, 450],
  'img/home-hero-diwali.webp': [1280, 720], 'img/home-hero-diwali-800.webp': [800, 450],
  'img/home-fashion-portrait-orange.webp': [800, 1067], 'img/home-tile-nutrition.webp': [900, 563], 'img/home-tile-living.webp': [900, 563],
  'img/home-promo-festive.webp': [1600, 533], 'img/home-promo-festive-800.webp': [800, 267],
  'img/home-cat-wellness.webp': [480, 480], 'img/home-cat-personal-care.webp': [480, 480], 'img/home-cat-fashion.webp': [480, 480],
  'img/home-cat-groceries.webp': [480, 480], 'img/home-cat-home-textiles.webp': [480, 480],
  'img/home-cat-jewellery.webp': [344, 344],
  ...JEWELLERY_PHOTOS,
};

await test(`the photographs: ${Object.keys(IMAGES).length} WebP files, each under 150 KB, at the sizes the markup declares`, () => {
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

// The collage hero (owner, 2026-11-27: "hero image pe 3 shop ke button … 3 collage show honge"): three slides,
// three portrait photographs each, every photograph its own way into a store with its own Shop button.
await test('the hero: three slides of three photographs; the first slide\'s headline is the page\'s only h1 — "Dress up. Shine. Feel good." over Leather, Jewellery and Wellness — then the wedding season and winter; every photograph its own link and Shop button; the first slide\'s photographs load at once, the rest wait', () => {
  const slides = [...hero.matchAll(/<div class="hx-hero__slide hx-hero__slide--([a-z]+)( is-on)?" aria-hidden="(true|false)" aria-roledescription="slide" aria-label="(\d) of 3">/g)];
  assert.deepEqual(slides.map((m) => [m[1], m[3], m[4]]), [['stores', 'false', '1'], ['wedding', 'true', '2'], ['winter', 'true', '3']]);
  assert.match(hero, /<p class="hx-eyebrow">Fashion · Jewellery · Wellness<\/p><h1 class="hx-hero__title"><span>Dress up\. Shine\.<\/span> <span class="hx-hl">Feel good\.<\/span><\/h1>/);
  assert.match(hero, /<h2 class="hx-hero__title"><span>Dressed for<\/span> <span class="hx-hl">every function\.<\/span><\/h2>/);
  assert.match(hero, /<h2 class="hx-hero__title"><span>Layer up\.<\/span> <span class="hx-hl">Settle in\.<\/span><\/h2>/);
  assert.equal((hero.match(/<h1/g) || []).length, 1, 'one h1');
  const panels = [...hero.matchAll(/<a class="hx-hero__card"(?: tabindex="-1")? href="([^"]+)"><span class="hx-hero__ph"><picture><source media="\(max-width: 700px\)"(?: srcSet="[^"]+")?\/><img alt="([^"]{30,})" width="900" height="1200" class="hx-hero__img"(?: src="[^"]+")? loading="(eager|lazy)" decoding="async"(?: fetchPriority="high")?\/><\/picture><\/span><span class="hx-hero__glare" aria-hidden="true"><\/span><span class="hx-hero__txt"><em>[^<]+<\/em><b>([^<]+)<\/b><span class="hx-hero__shop">Shop now <svg/g)];
  const names = mod.HERO_SLIDES.flatMap((sl) => sl.panels.map((pn) => pn.picture.desktop.match(/home-hero\/u-([a-z-]+)\.webp$/)[1]));
  assert.deepEqual(panels.map((m, i) => [m[4].replace('&amp;', '&'), m[1], names[i]]), [
    ['Leather', '/fashion/leather', 'leather'], ['Jewellery', '/fashion/jewellery', 'jewellery'], ['Wellness', '/category/wellness', 'wellness'],
    ['Sarees', '/fashion/women/sarees', 'sarees'], ['Suits', '/fashion/c/suits-dress-materials', 'suits'], ['Bangles', '/fashion/c/bangles', 'bangles'],
    ['Women’s jackets', '/fashion/c/womens-leather-jackets', 'womens-jackets'], ['The winter edit', '/fashion/winter', 'winter'], ['Home & Living', '/homeliving', 'home'],
  ]);
  for (const sl of mod.HERO_SLIDES) for (const pn of sl.panels) assert.equal(pn.picture.phone, pn.picture.desktop.replace('.webp', '-600.webp'), `${pn.title}: the phone file beside it`);
  assert.deepEqual(panels.map((m) => m[3]), ['eager', 'eager', 'eager', 'lazy', 'lazy', 'lazy', 'lazy', 'lazy', 'lazy'], 'slide 1 at once; the others wait');
  assert.equal((hero.match(/fetchPriority="high"/g) || []).length, 3, 'slide 1 is the largest paint');
  assert.equal((hero.match(/<a class="hx-hero__card" tabindex="-1"/g) || []).length, 6, 'the hidden slides\' links leave the tab order');
  assert.match(hero, /<div class="hx-hero__track" style="transform:translateX\(-0%\)">/, 'the track moves on transform');
  assert.match(hero, /<div class="hx-hero__dots" role="group" aria-label="Choose a slide"><button type="button" aria-label="Show slide 1 of 3" aria-pressed="true" class="hx-hero__dot is-on"><i class="hx-hero__fill" aria-hidden="true"><\/i><\/button><button type="button" aria-label="Show slide 2 of 3" aria-pressed="false" class="hx-hero__dot"><\/button>/, 'the slide in view fills its bar');
  assert.match(hero, /<section class="hx hx-hero is-seen" style="--hero-ms:6000ms"/, 'the bar fills over the autoplay\'s time');
});

await test('the hero\'s photographs: real photographs from Unsplash (owner, 2026-11-27: "aise images fake lagti hain"), each under the Unsplash License with its id recorded; portrait 3:4, 900×1200 and 600×800, each under 150 KB', () => {
  for (const sl of mod.HERO_SLIDES) for (const pn of sl.panels) {
    assert.match(pn.photo, /^\d{10,13}-[0-9a-f]{12}$/, `${pn.title}: its Unsplash photo id`);
    const name = pn.picture.desktop.match(/home-hero\/(u-[a-z-]+)\.webp$/)[1];
    for (const [rel, size] of [[`img/home-hero/${name}.webp`, [900, 1200]], [`img/home-hero/${name}-600.webp`, [600, 800]]]) {
      assert.ok(has(rel), `${rel} is missing`);
      assert.ok(statSync(resolve(ROOT, rel)).size <= 150 * 1024, `${rel} under 150 KB`);
      assert.deepEqual(webpSize(readFileSync(resolve(ROOT, rel))), size, `${rel} dimensions`);
    }
  }
  assert.match(read('src/components/HomeStorefront.jsx'), /from Unsplash, under\n\/\/ the Unsplash License/);
});

await test('the hero carousel: autoplays only with more than one slide, pauses on hover and on focus, never moves under prefers-reduced-motion; a 40px sideways swipe changes the slide and swallows the click; the hidden slide\'s button is untabbable', async () => {
  const { hooks, mount, findAll } = await import('./catalogue-admin-harness.mjs');
  let reduce = false;
  const timers = [];
  const win = { matchMedia: () => ({ matches: reduce, addEventListener() {}, removeEventListener() {} }) };
  const setInterval = (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length - 1; };
  const clearInterval = (id) => { if (timers[id]) timers[id].live = false; };
  const m = loadSource(read('src/components/HomeStorefront.jsx'), { ...hooks, window: win, setInterval, clearInterval, Link: 'a', Icon: () => null, DeferredImage: (p) => h('img', p), FashionEntryLink: 'a',
    // The hero as built in (nothing published), read without the real React the harness replaces.
    useStorefrontSection: (_store, _path, built) => built });
  assert.equal(typeof m.HomeHero, 'function');
  const live = () => timers.filter((t) => t.live);
  const tree = await mount(h(m.HomeHero));
  const node = (cls) => findAll(tree.tree, (n) => n.props?.className === cls)[0];
  const at = () => node('hx-hero__track').props.style.transform;
  assert.equal(live().length, 1); assert.equal(live()[0].ms, m.HERO_AUTOPLAY_MS); assert.equal(m.HERO_AUTOPLAY_MS, 6000);
  await tree.act(() => { for (const t of live()) t.fn(); }); assert.equal(at(), 'translateX(-100%)');
  await tree.act(() => { for (const t of live()) t.fn(); }); assert.equal(at(), 'translateX(-200%)');
  await tree.act(() => { for (const t of live()) t.fn(); }); assert.equal(at(), 'translateX(-0%)', 'and round again');
  const button = findAll(tree.tree, (n) => n.type === 'a' && n.props.className === 'hx-hero__card')[0];
  assert.equal(button.props.tabIndex, undefined, 'the current slide\'s links are in the tab order');
  const section = node('hx hx-hero is-seen');
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
  assert.equal(findAll(tree.tree, (n) => n.type === 'a' && n.props.className === 'hx-hero__card')[0].props.tabIndex, -1, 'slide 1 hidden: its links leave the tab order');
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

await test('the trust strip: "Free Standard Delivery — On every order", "Genuine Products", "Easy Returns — 7 days", "Support — 9am–6pm IST"; the three with a policy link to it; on a phone each is two short lines — a two-part title is the two lines and its note gives way', () => {
  const items = [...trust.matchAll(/<li( class="hx-trust--split")?>(?:<a href="([^"]+)">|<span class="hx-trust__item">)<svg[\s\S]*?<\/svg><span><strong>((?:<span>[^<]+<\/span>)+)<\/strong>(?:<small>([^<]+)<\/small>)?<\/span>/g)]
    .map((m) => [[...m[3].matchAll(/<span>([^<]+)<\/span>/g)].map((x) => x[1].trim()), m[4] || null, m[2] || null, Boolean(m[1])]);
  assert.deepEqual(items, [
    [['Free Standard', 'Delivery'], 'On every order', '/shipping', true],
    [['Genuine', 'Products'], null, null, true],
    [['Easy Returns'], '7 days', '/returns', false],
    [['Support'], '9am–6pm IST', '/contact', false],
  ]);
  for (const [lines, note, , split] of items) assert.equal(split ? lines.length : lines.length + (note ? 1 : 0), 2, `${lines.join(' ')}: two lines on a phone`);
});

await test('the tiles: Fashion, large, opening the fashion chooser; Health & Nutrition to Supplements; Home & Living to the Home & Living store — each heading HTML over or beside its photograph', () => {
  assert.match(tiles, /<a class="hx-tile hx-tile--fashion" aria-labelledby="hx-fashion-h hx-fashion-cta" aria-haspopup="dialog" href="\/fashion"><div class="hx-tile__panel"><h2 class="hx-tile__h" id="hx-fashion-h"><span>Fashion<\/span> <span>for every<\/span> <span>mood\.<\/span><\/h2><span class="hx-btn hx-btn--light" id="hx-fashion-cta">Shop Fashion <svg/);
  assert.match(tiles, /<a class="hx-tile hx-tile--small hx-tile--nutrition" aria-labelledby="hx-nutrition-h" href="\/category\/supplements">[\s\S]*?<h2 class="hx-tile__h" id="hx-nutrition-h"><span>Health &amp;<\/span> <span>Nutrition<\/span><\/h2>/);
  assert.match(tiles, /<a class="hx-tile hx-tile--small hx-tile--living" aria-labelledby="hx-living-h" href="\/homeliving">[\s\S]*?<h2 class="hx-tile__h" id="hx-living-h"><span>Home &amp;<\/span> <span>Living<\/span><\/h2>/);
  assert.equal((tiles.match(/<img /g) || []).length, 3); assert.equal((tiles.match(/loading="lazy"/g) || []).length, 3);
  assert.match(tiles, /<span class="hx-tile__art"><img alt="Woman in an orange knit sweater against an orange backdrop" width="800" height="1067" class="hx-tile__image"/, 'the owner\'s portrait, at the size the markup declares');
});

await test('the Fashion photograph is the owner\'s, exactly as supplied — solid orange edge to edge, no white in its background, no fade — under a name never used before (/img is cached for a week); the old name is gone; the panel takes the photograph\'s own orange so no line shows', async () => {
  const src = read('src/components/HomeStorefront.jsx');
  // The tile's built-in photograph (the admin may replace it; storefrontContent.js → wellness.tiles).
  assert.match(src, /picture: tileArt\('\/img\/home-fashion-portrait-orange\.webp'\)/, 'the tile uses the new name');
  assert.ok(!has('img/home-tile-fashion.webp') && !src.includes('home-tile-fashion'), 'the old name — which browsers may still hold an earlier picture under — is gone');
  const { data, info } = await sharp(resolve(ROOT, 'img/home-fashion-portrait-orange.webp')).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
  // The left 40% (her sleeve begins at about 42%) is the solid background: every pixel orange, none white or grey.
  for (let y = 0; y < info.height; y += 7) for (let x = 0; x < info.width * 0.40; x += 7) {
    const [r, g, bl] = px(x, y);
    assert.ok(r > 220 && g > 95 && g < 145 && bl < 60, `(${x}, ${y}) is ${[r, g, bl]} — not the solid orange`);
  }
  const sheet = read('src/styles/v2-home.css');
  assert.doesNotMatch(sheet, /\.hx-tile--fashion \.hx-tile__image \{[^}]*mask-image/, 'no edge fade on the photograph');
  // The panel's gradient follows the photograph's left edge (desktop: the photograph's top 96% spans the tile).
  const grad = sheet.match(/\n\.hx-tile--fashion \{[^}]*background: linear-gradient\(180deg, ([^)]+)\);/);
  assert.ok(grad, 'the panel is a gradient');
  for (const [, hex, pct] of grad[1].matchAll(/#([0-9A-F]{6}) (\d+)%/g)) {
    const y = Math.min(info.height - 21, Math.round((Number(pct) / 100) * 0.96 * info.height));
    let sum = [0, 0, 0], n = 0;
    for (let yy = y; yy < y + 20; yy++) for (let x = 0; x < 40; x++) { const p = px(x, yy); sum = sum.map((v, i) => v + p[i]); n++; }
    const edge = sum.map((v) => v / n), stop = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(...stop.map((v, i) => Math.abs(v - edge[i]))) <= 6, `#${hex} at ${pct}% vs the photograph's edge ${edge.map(Math.round)}`);
  }
});

await test('"Explore the stores" (not a second "Shop by category"): Wellness, Personal Care, Fashion, Groceries, Home Textiles, Jewellery — each a circle and its name, each to its own place', () => {
  assert.match(stores, /<div class="hx-stores__head"><h2 class="hx-stores__h" id="hx-stores-h">Explore the stores<\/h2><a class="hx-more" aria-label="View all products" href="\/shop">View All <svg/, 'the heading and "View All" on one line, as in the mockup');
  const items = [...stores.matchAll(/<li><a (?:class="hx-store" )?(?:aria-haspopup="dialog" )?(?:class="hx-store" )?href="([^"]+)"[^>]*><span class="hx-store__art"><img alt="" width="(\d+)" height="\2" class="hx-store__image" loading="lazy" decoding="async"\/><\/span><span class="hx-store__name">([^<]+)<\/span><\/a><\/li>/g)].map((m) => [m[3], m[1], Number(m[2])]);
  assert.deepEqual(items.map(([name, to]) => [name, to]), [['Wellness', '/category/wellness'], ['Personal Care', '/category/personal-care'], ['Fashion', '/fashion'], ['Groceries', '/grocery'], ['Home Textiles', '/homeliving'], ['Jewellery', '/fashion/jewellery']]);
  // Each circle declares its own photograph's size.
  const src = read('src/components/HomeStorefront.jsx');
  for (const [name, , size] of items) {
    const image = src.match(new RegExp(`name: '${name}'[^\\n]*image: '/(img/home-cat-[a-z-]+\\.webp)'`))[1];
    assert.deepEqual(IMAGES[image], [size, size], `${name}: ${image} is ${size}px square`);
  }
  assert.doesNotMatch(all, /Shop by category/i, 'the page keeps one "Shop by category" — the one further down');
});

await test('the Jewellery circle is the jewellery page\'s rings shot (the necklace\'s fine chain is lost at circle size), cropped square around the ring, never enlarged', async () => {
  const [rings, circle] = await Promise.all(['img/fashion-editorial/jewellery-cat-rings.webp', 'img/home-cat-jewellery.webp']
    .map((rel) => sharp(resolve(ROOT, rel)).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
  assert.ok(circle.info.width <= rings.info.width && circle.info.height <= rings.info.height, 'no larger than its source');
  // The crop is the shot's top-left 344px square, pixel for pixel (within WebP's re-encoding).
  let diff = 0, n = 0;
  for (let y = 0; y < circle.info.height; y += 4) for (let x = 0; x < circle.info.width; x += 4) {
    for (let c = 0; c < 3; c++) { diff += Math.abs(circle.data[(y * circle.info.width + x) * 3 + c] - rings.data[(y * rings.info.width + x) * 3 + c]); n++; }
  }
  assert.ok(diff / n < 4, `the rings shot, as it was (mean difference ${(diff / n).toFixed(2)})`);
});

await test('the promo strip: "Festive gifting" / "Wellness, beauty and home picks to give this season" / "Shop gifts" to /gifts (the gift finder, 2026-11-20), over the gift-and-diya photograph', () => {
  assert.match(promo, /<a class="hx-promo__card" aria-labelledby="hx-promo-h hx-promo-cta" href="\/gifts"><picture><source media="\(max-width: 700px\)"\/><img alt="[^"]{30,}" width="1600" height="533" class="hx-promo__image" loading="lazy" decoding="async"\/><\/picture><div class="hx-promo__copy"><h2 class="hx-promo__h" id="hx-promo-h">Festive gifting<\/h2><p class="hx-promo__text">Wellness, beauty and home picks to give this season<\/p><span class="hx-btn" id="hx-promo-cta">Shop gifts <svg/);
});

await test('the copy is true: no free-shipping threshold, no round-the-clock support, no percentage or offer, no health outcome — in the component and in the render', () => {
  const banned = [/above\s*₹|₹\s*499|threshold/i, /24\s*[×x*]\s*7|24\/7|round[- ]the[- ]clock/i, /\d+\s*%|\bper\s*cent\b|\boff\b(?!er)/i, /festive offers|up to/i, /healthier|happier|\bcures?\b|\bheal(s|ing)?\b|immunit|detox/i, /free shipping/i];
  for (const [name, s] of [['component', stripComments(read('src/components/HomeStorefront.jsx'))], ['render', text(all)]]) {
    for (const re of banned) assert.doesNotMatch(s, re, `${name}: ${re}`);
  }
  for (const s of ['Free Standard Delivery', 'On every order', 'Easy Returns', '7 days', '9am–6pm IST', 'Dress up. Shine.', 'Feel good.', 'Festive gifting', 'Shop gifts']) assert.ok(text(all).includes(s), s);
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
  // The dead homepage code cleared since (4e72220) is undone first, through its recorded patch.
  assert.equal(sansDeadHomepageCode('src/styles/v2-home.css', read('src/styles/v2-home.css')).slice(0, base.length), base, 'the sheet before the new rules is byte-identical');
});

await test('contrast (WCAG 2.x), from the stylesheet itself: white on the deep-orange buttons ≥ 4.5:1, the deep-orange headline line and View All on the page tint ≥ 4.5:1, near-black on the bright-orange Fashion panel ≥ 4.5:1; the bright orange never carries white text', () => {
  const token = (name) => { const m = hx.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`)); assert.ok(m, name); return m[1]; };
  const orange = token('--hx-orange'), deep = token('--hx-orange-deep'), ink = token('--hx-ink'), page = token('--hx-page');
  assert.equal(page.toUpperCase(), '#FFFFFF', 'the page is white (owner, 2026-11-08: the cream is gone)');
  assert.equal(decl('.hx', 'background'), 'var(--hx-page)');
  // The collage hero (2026-11-27): its Shop buttons are near-black on cream; the names cream over the photographs' darkened foot.
  assert.equal(decl('.hx-hero__shop', 'background'), '#FFF8EE'); assert.equal(decl('.hx-hero__shop', 'color'), 'var(--hx-ink)');
  assert.ok(contrast(ink, '#FFF8EE') >= 7, 'the Shop buttons: near-black on cream');
  assert.match(decl('.hx-hero__card::after', 'background'), /rgba\(20, 12, 6, \.78\) 100%/, 'the names sit on the darkened foot of each photograph');
  assert.equal(decl('.hx .hx-btn', 'background'), 'var(--hx-orange-deep)'); assert.equal(decl('.hx .hx-btn', 'color'), '#fff');
  assert.equal(decl('.hx .hx-hl', 'color'), 'var(--hx-orange-deep)'); assert.equal(decl('.hx .hx-more', 'color'), 'var(--hx-orange-deep)');
  assert.equal(decl('.hx-tile__h', 'color'), 'var(--hx-ink)');
  const stops = [...decl('.hx-tile--fashion', 'background').matchAll(/#[0-9A-F]{6}/gi)].map((m) => m[0]);
  assert.ok(stops.length >= 4, 'the Fashion panel\'s orange stops');
  const darkest = stops.reduce((d, c) => (contrast(ink, c) < contrast(ink, d) ? c : d));
  assert.ok(contrast(ink, darkest) >= 4.5, `near-black on the panel's darkest orange ${darkest}: ${contrast(ink, darkest).toFixed(2)}:1`);
  console.log(`        near-black on the Fashion panel's darkest orange: ${ink} on ${darkest} = ${contrast(ink, darkest).toFixed(2)}:1`);
  for (const c of stops) assert.ok(contrast('#FFFFFF', c) < 4.5, `white would fail on ${c} — and nothing puts it there`);
  const pairs = [['white on the deep-orange buttons', '#FFFFFF', deep], ['deep orange on the page tint (headline line, View All)', deep, page], ['near-black on the bright orange accent', ink, orange]];
  for (const [what, fg, bg] of pairs) {
    const r = contrast(fg, bg);
    assert.ok(r >= 4.5, `${what}: ${r.toFixed(2)}:1`);
    console.log(`        ${what}: ${fg} on ${bg} = ${r.toFixed(2)}:1`);
  }
  assert.ok(contrast(deep, '#FFFFFF') >= contrast(deep, page), 'the tint only lowers it: measured on the tint, not on white');
  assert.ok(contrast('#FFFFFF', orange) < 4.5, 'white on the bright orange would fail — which is why nothing does it');
  for (const [, sel, body] of hx.matchAll(/([^{}]+)\{([^{}]*)\}/g)) assert.ok(!(/background:\s*var\(--hx-orange\)/.test(body) && /color:\s*#fff\b/.test(body)), `${sel.trim()}: white text on the bright orange`);
});

await test('the phone, as in the mockup: ONE compact hero block (copy in the left 45%, the lineup filling the right to its edge); the trust strip one row of four across the width; the tiles side by side — Fashion one tile, its portrait filling it from the right; six circles in one row, a two-word name on two lines; the festive photograph whole; no rule pairs aspect-ratio with a min/max height', async () => {
  const at = hx.indexOf('@media (max-width: 700px) {');
  const phone = hx.slice(at, hx.indexOf('\n}\n', at));
  // The hero (the collage, 2026-11-27): the same three photographs as a slim triptych, the height from the width.
  assert.equal(decl('.hx-hero__panels', 'grid-template-columns'), 'repeat(var(--n, 3), minmax(0, 1fr))', 'three side by side, on every screen');
  assert.match(phone, /\.hx-hero__panels \{ gap: 6px; height: clamp\(300px, 92vw, 440px\); \}/);
  assert.match(phone, /\.hx-hero__txt em \{ display: none; \}/, 'on a phone the name and the button, no small line');
  assert.match(hx, /\n\.hx-hero__img \{[^}]*object-position: var\(--focus, 50%\) 30%;/, 'each crop centred where its photograph asks');
  assert.match(phone, /\.hx-eyebrow > span \{ display: block; \}/, 'the eyebrow in two lines');
  // The trust strip: one row of four, never the sideways-scrolling two and a half.
  assert.match(phone, /\.hx-trust__list \{ display: flex; justify-content: space-between;/);
  assert.doesNotMatch(phone, /calc\(100% \/ 2\.5\)|\.hx-trust__list \{[^}]*grid-template-columns/, 'not two and a half, not 2×2');
  assert.match(phone, /\.hx-trust strong > span \{ display: block; \}/); assert.match(phone, /\.hx-trust--split small \{ display: none; \}/);
  assert.match(phone, /\.hx-trust strong, \.hx-trust small \{[^}]*white-space: nowrap;/, 'each line one line');
  // The tiles: side by side, Fashion the wider left tile at full height; its portrait fills it.
  assert.match(phone, /\.hx-tiles__grid \{ grid-template-columns: minmax\(0, 1\.17fr\) minmax\(0, 1fr\); grid-template-rows: repeat\(2, clamp\(72px, 19\.5vw, 140px\)\);/);
  assert.equal(decl('.hx-tile--fashion', 'grid-row'), '1 / 3', 'Fashion spans both rows');
  assert.doesNotMatch(phone, /\.hx-tile--fashion \{[^}]*grid-row/, 'and still does on a phone');
  assert.match(phone, /\.hx-tile--fashion \{ display: block;/); assert.match(phone, /\.hx-tile--fashion \.hx-tile__art \{ position: absolute; inset: 0; \}/, 'one tile: the portrait behind the copy');
  assert.equal(decl('.hx-tile__art .hx-tile__image', 'object-position'), 'right top', 'her head at the top edge');
  // The circles: six in one row, no sideways scroll. Six columns leave a two-word name no room on one
  // line, so on a phone it may break between its words rather than run into its neighbours.
  assert.equal(decl('.hx-stores__row', 'grid-template-columns'), 'repeat(6, minmax(0, 1fr))');
  assert.doesNotMatch(phone, /\.hx-store__name \{[^}]*white-space: nowrap/, 'names may wrap on a phone');
  assert.doesNotMatch(phone, /\.hx-stores__row \{[^}]*(display: flex|overflow-x)/, 'the row does not scroll on a phone');
  assert.doesNotMatch(hx, /\(hover: hover\) and \(pointer: fine\) \{\s*\.hx-trust__list, \.hx-stores__row/, 'no scrollbar rule: nothing scrolls');
  // The festive strip: the whole photograph (its own 3:1, so neither the box nor the diya is cut), the copy over its clear centre.
  assert.match(phone, /\.hx-promo__card \{ height: auto; aspect-ratio: 3 \/ 1;/);
  for (const rel of ['img/home-promo-festive.webp', 'img/home-promo-festive-800.webp']) { const [w, hgt] = IMAGES[rel]; assert.ok(Math.abs(w / hgt / 3 - 1) < 0.01, `${rel} is 3:1`); }
  assert.match(phone, /\.hx-promo__copy \{ position: absolute; inset: 0 19% 0 31%;/);
  const { data, info } = await sharp(resolve(ROOT, 'img/home-promo-festive-800.webp')).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0, n = 0;
  for (let y = Math.round(info.height * 0.15); y < info.height * 0.85; y++) for (let x = Math.round(info.width * 0.31); x < info.width * 0.66; x++) { sum += data[y * info.width + x]; n++; }
  assert.ok(sum / n > 200, `the copy's band of the photograph is clear and light (mean ${(sum / n).toFixed(0)})`);
  for (const [, sel, body] of hx.matchAll(/([^{}]+)\{([^{}]*)\}/g)) assert.ok(!(/aspect-ratio:\s*(?!auto\b)[^;\s]/.test(body) && /(min|max)-height:\s*(?!0[;\s]|none\b)[^;\s]/.test(body)), `${sel.trim()}: aspect-ratio with a min/max height`);
});

// ---- the page ----------------------------------------------------------------
await test('Home.jsx: the five sections lead the page in the mockup\'s order, then the offers; the old hero and category strip are gone from it; from LifestyleBanner down it is exactly as it was but for the jewellery banner, directly under it', () => {
  const home = sansSiteName('src/pages/Home.jsx', read('src/pages/Home.jsx')); // the site name's heading undone (test-site-name.mjs)
  const order = [...home.matchAll(/<(HomeHero|HomeTrustStrip|HomeTiles|ExploreStores|FestivePromo|HomeOffers|LifestyleBanner|JewelleryBanner)\b/g)].map((m) => m[1]);
  // The three store tiles gave way to the collage hero (2026-11-27), which opens the stores.
  assert.deepEqual(order, ['HomeHero', 'HomeTrustStrip', 'ExploreStores', 'FestivePromo', 'HomeOffers', 'LifestyleBanner', 'JewelleryBanner']);
  assert.doesNotMatch(home, /import Hero from|import HomeCategoryStrip from|<Hero \/>|<HomeCategoryStrip/);
  assert.match(home, /admin Hero Slides page no longer drives it/, 'the page says where the hero comes from now');
  // LifestyleBanner renders the banner and the fashion category strip beneath it, so the next mount is under the strip.
  const mount = '      <LifestyleBanner />\n\n      {/* The doorway to the jewellery page, directly under the fashion category strip. */}\n      <JewelleryBanner />\n';
  assert.equal(home.split(mount).length - 1, 1, 'the jewellery banner is mounted once, directly after LifestyleBanner');
  const tail = (s) => s.slice(s.indexOf('      <LifestyleBanner />'));
  // The owner moved Luxury Beds to the foot of the page on 2026-11-07, above the newsletter
  // (test-home-category-rails.mjs owns it; Bedsheets sits above LifestyleBanner); that block is all that may differ.
  const bedroom = /      \{\/\* Home & Living's Luxury Beds[\s\S]*?<LuxuryBeds \/>\n\n/;
  // The 2026-11-13 redesign ("homepage cleanup") regrouped the page under four bands and put the partner
  // sections in one "Our brands" row, so the tail is no longer byte-identical; its closing order still holds.
  void bedroom; void tail;
  const at = (x) => home.indexOf(x);
  assert.ok(at('<FestivePromo />') < at('<BrandCarousel />') && at('<BrandCarousel />') < at('<LifestyleBanner />') && at('<LifestyleBanner />') < at('<CreatorCommunity />') && at('<CreatorCommunity />') < at('<WhySoraLife />') && at('<WhySoraLife />') < at('<LuxuryBeds />') && at('<LuxuryBeds />') < at('<Newsletter />'), 'from LifestyleBanner down: brands, the closing blocks, the beds, the newsletter');
});

await test('the jewellery banner: one link to /fashion/jewellery — "SORA LIFE Jewellery" / "Jewellery that tells your story" / "Rings, necklaces, earrings and bracelets, made to be worn every day." / "Explore Jewellery" — over the owner\'s photograph, the 4:5 portrait on a phone; square-edged, near-black on the ivory', () => {
  const html = render(mod.JewelleryBanner);
  const [wide, tall] = Object.keys(JEWELLERY_PHOTOS);
  const [w, hgt] = JEWELLERY_PHOTOS[wide];
  assert.match(html, new RegExp(`^<section class="hx hx-jewel" aria-labelledby="hx-jewel-h"><a class="hx-jewel__link" aria-labelledby="hx-jewel-h hx-jewel-cta" href="/fashion/jewellery"><span class="hx-jewel__art"><picture><source media="\\(max-width: 700px\\)"/><img alt="[^"]{30,}" width="${w}" height="${hgt}" class="hx-jewel__image" loading="lazy" decoding="async"/></picture></span><div class="hx-jewel__copy"><p class="hx-jewel__eyebrow">SORA LIFE Jewellery</p><h2 class="hx-jewel__h" id="hx-jewel-h"><span>Jewellery that</span> <span>tells your story</span></h2><p class="hx-jewel__text">Rings, necklaces, earrings and bracelets, made to be worn every day.</p><span class="hx-jewel__cta" id="hx-jewel-cta">Explore Jewellery <svg`));
  const src = read('src/components/HomeStorefront.jsx');
  assert.match(src, new RegExp(`src: '/${wide}'`)); assert.match(src, new RegExp(`tall: '/${tall}'`));
  // The Lifestyle banner's treatment: full-bleed (no wrap, no inset), square, the height from the width.
  for (const [, sel, body] of hx.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (/hx-jewel/.test(sel)) assert.doesNotMatch(body, /border-radius|box-shadow/, `${sel.trim()}: square-edged, flat`);
  assert.equal(decl('.hx-jewel__link', 'height'), 'clamp(300px, 43.94vw, 680px)', 'the wide photograph\'s own 1891:831, so it is not cropped from 683px to 1548px');
  assert.equal(decl('.hx-jewel__h', 'text-transform'), 'uppercase');
  assert.equal(decl('.hx-jewel__h', 'color'), 'var(--hx-ink)'); assert.equal(decl('.hx-jewel__cta', 'background'), 'var(--hx-ink)'); assert.equal(decl('.hx-jewel__cta', 'color'), '#fff');
  const banned = [/\d+\s*%|\bper\s*cent\b|\boff\b(?!er)/i, /handcrafted|hand-?made|ethical|certified|hallmark|\b(18|22|24)\s*k|solid gold|real (gold|diamond)|lifetime|guarantee|trusted|best[- ]?sell/i];
  for (const re of banned) assert.doesNotMatch(text(html), re, `${re}`);
});

await test('the jewellery photographs: the wide one\'s left 45% and the portrait\'s upper 40% are plain ivory (where the copy sits), the portrait is 4:5; near-black copy and the muted line clear 4.5:1 on their darkest pixel', async () => {
  const [wide, tall] = Object.keys(JEWELLERY_PHOTOS);
  const [tw, th] = JEWELLERY_PHOTOS[tall];
  assert.ok(Math.abs(tw / th - 0.8) < 0.001, `${tall} is 4:5`);
  const hex = (p) => `#${p.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
  for (const [rel, area, what] of [[wide, [0, 0, 0.45, 1], 'the left 45%'], [tall, [0, 0, 1, 0.40], 'the upper 40%']]) {
    const { data, info } = await sharp(resolve(ROOT, rel)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let lo = null, sum = 0, sq = 0, n = 0;
    for (let y = Math.round(area[1] * info.height); y < area[3] * info.height; y += 3) for (let x = Math.round(area[0] * info.width); x < area[2] * info.width; x += 3) {
      const i = (y * info.width + x) * 3, p = [data[i], data[i + 1], data[i + 2]], l = lum(p);
      if (!lo || l < lum(lo)) lo = p;
      sum += l; sq += l * l; n++;
    }
    const sd = Math.sqrt(sq / n - (sum / n) ** 2);
    assert.ok(sum / n > 215 && sd < 8, `${rel}: ${what} is plain and light (mean ${(sum / n).toFixed(0)}, spread ${sd.toFixed(1)})`);
    for (const [name, token] of [['the headline and button', '--hx-ink'], ['the subline', '--hx-muted']]) {
      const fg = hx.match(new RegExp(`${token}:\\s*(#[0-9A-Fa-f]{6})`))[1];
      const r = contrast(fg, hex(lo));
      assert.ok(r >= 4.5, `${rel}: ${name} (${fg}) on its darkest pixel ${hex(lo)}: ${r.toFixed(2)}:1`);
      console.log(`        ${rel}, ${what}: ${name} ${fg} on the darkest ${hex(lo)} = ${r.toFixed(2)}:1`);
    }
  }
  // Desktop: the copy over the plain left; a phone: over the clear upper half, never the arrangement.
  assert.equal(decl('.hx-jewel__copy', 'width'), 'min(40%, 470px)');
  const at = hx.indexOf('@media (max-width: 700px) {');
  const phone = hx.slice(at, hx.indexOf('\n}\n', at));
  assert.match(phone, /\.hx-jewel__link \{ align-items: flex-start; height: auto; aspect-ratio: 4 \/ 5; \}/, 'the portrait whole, the copy at its top');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
