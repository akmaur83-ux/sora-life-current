// ============================================================
// Home & Living homepage — the full-bleed hero with the header floating
// over it, the trust band, the category scroller. Offline suite.
//
// The two hero photographs (renamed, WebP, under 150 KB, a 3:2 and a 4:5),
// the homepage rendered through the real router with the photograph at
// the top of the page and the shell's nav strip, delivery row and search
// bar under it; the header transparent until the page scrolls and solid
// after; every other page's header solid with the delivery row and the
// search bar inside it, as before; the copy's measured type scale; the
// trust band as one quiet row on larger screens and a compact phone grid;
// the circles' snap, fade and chevron; and
// the isolation of everything else. NO NETWORK, NO DATABASE, NO BROWSER.
//
//   node scripts/test-homeliving-hero.mjs
//   GROCERY_SRC_ROOT=<pre-change checkout> node scripts/test-homeliving-hero.mjs   (must fail)
// ============================================================
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { ROOT, read, buildHomeLivingApp } from './homeliving-ssr.mjs';
import { REPO, atCommit } from './baseline-export.mjs';

// The tip before this work: the typeface release.
const BASELINE_SHA = '24bb729';
let passed = 0, failed = 0, current = '(startup)';
process.on('unhandledRejection', (e) => { console.error(`\n  FATAL during: ${current}\n  ${e?.stack || e}`); process.exitCode = 1; });
async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const section = (css, from, to) => css.slice(css.indexOf(from), to ? css.indexOf(to) : undefined);
const SPEED_CLAIMS = [/\bfast\b/i, /\bfaster\b/i, /\bexpress\b/i, /\binstant/i, /\bsecure\s+deliver/i, /\bsame[- ]day\b/i, /\bnext[- ]day\b/i, /\b\d+\s*mins?\b/i, /\bminutes?\b/i, /\bquick\b/i, /\brapid\b/i, /\bspeedy\b/i, /\beco[- ]friendly\b/i];
console.log(`\nsource root: ${ROOT}`);

const app = await buildHomeLivingApp({ cartCount: 3 }).catch((e) => ({ error: e }));
const home = app.error ? '' : app.render('/homeliving');
const category = app.error ? '' : app.render('/homeliving/category/bedsheets');
const product = app.error ? '' : app.render('/homeliving/p/sage-fitted-sheet');
const css = read('src/styles/homeliving.css');
const layoutSrc = stripComments(read('src/homeliving/HomeLivingLayout.jsx'));
const homeSrc = stripComments(read('src/homeliving/HomeLivingHome.jsx'));

// ============================================================
console.log('\n— The photographs —');
// ============================================================

await test('the hero is a pair: the 3:2 landscape (1536×1024) and the 4:5 portrait (1122×1402), renamed, WebP, each under 150 KB; the slide names both', async () => {
  const { HERO_SLIDES } = app.data;
  assert.deepEqual(HERO_SLIDES[0].image, { wide: '/img/homeliving-hero-wide.webp', tall: '/img/homeliving-hero-tall.webp' });
  for (const [rel, w, h] of [['img/homeliving-hero-wide.webp', 1536, 1024], ['img/homeliving-hero-tall.webp', 1122, 1402]]) {
    const buf = readFileSync(resolve(ROOT, rel));
    assert.ok(buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP', `${rel} is WebP`);
    assert.ok(statSync(resolve(ROOT, rel)).size < 150 * 1024, `${rel} under 150 KB (${(buf.length / 1024).toFixed(0)} KB)`);
    const m = await sharp(buf).metadata();
    assert.equal(m.width, w, `${rel} width`); assert.equal(m.height, h, `${rel} height`);
  }
  // The earlier hero file stays: the Lifestyle hero's first slide still uses it.
  assert.ok(statSync(resolve(ROOT, 'img/homeliving-hero.webp')).size > 0);
  assert.match(read('src/data/lifestyleHomepage.js'), /wide: '\/img\/homeliving-hero\.webp'/);
});

// ============================================================
console.log('\n— The homepage: the photograph at the top, the header over it —');
// ============================================================

await test('the homepage shell is .hl--over with a floating header (.hl-hdr--over, not solid on the server), and nothing sits above the photograph: main, then the hero, first', () => {
  assert.ok(!app.error, app.error?.message);
  assert.match(home, /^<div class="hl hl--over"><header class="hl-hdr hl-hdr--over"><div class="hl-hdr__row"><button type="button" class="hl-hdr__menu" aria-label="Open menu">/);
  assert.doesNotMatch(home, /class="hl-hdr hl-hdr--over is-solid"/, 'the server never renders the scrolled state');
  const header = home.slice(0, home.indexOf('</header>'));
  assert.doesNotMatch(header, /hl-deliver|hl-search/, 'the delivery row and the search bar are not in the floating header');
  assert.match(home, /<\/header><main class="hl-main"><div class="hl-home"><section class="hl-hero"/, 'header → main → hero: no nav strip, delivery row or search bar between');
  assert.match(home, /<\/section><nav class="hl-nav" aria-label="Home &amp; Living">[\s\S]*?<\/nav><div class="hl-tools"><div class="hl-deliver" aria-label="Delivery">[\s\S]*?<div class="hl-search" role="search"[\s\S]*?<\/div><\/div><div class="hl-wrap"><ul class="hl-trust"/, 'under the hero: nav strip → delivery row → search bar → trust band');
  assert.equal((home.match(/class="hl-nav"/g) || []).length, 1, 'one nav strip');
  assert.equal((home.match(/class="hl-deliver"/g) || []).length, 1); assert.equal((home.match(/class="hl-search"/g) || []).length, 1);
});

await test('the hero is a <picture>: the portrait below 768px, the landscape from it, eager and high priority; the copy (eyebrow, h1, sub, gold CTA, then the note) in one block; every word HTML, the photographs empty-alt', () => {
  const hero = home.slice(home.indexOf('<section class="hl-hero"'), home.indexOf('</section>', home.indexOf('<section class="hl-hero"')));
  assert.match(hero, /<picture><source media="\(max-width: 767px\)" srcSet="\/img\/homeliving-hero-tall\.webp"\/><img class="hl-hero__img" src="\/img\/homeliving-hero-wide\.webp" alt="" width="1536" height="1024" decoding="async" fetchpriority="high" loading="eager"\/><\/picture>/);
  assert.match(hero, /<div class="hl-wrap hl-hero__inner"><div class="hl-hero__txt"><p class="hl-hero__eyebrow">Home &amp; Living<\/p><h1 class="hl-hero__h serif">Comfort Lives Here<\/h1><p class="hl-hero__sub">[^<]+<\/p><a class="hl-cta" tabindex="0" href="\/homeliving\/category\/bedsheets">Explore Home Collection <svg[\s\S]*?<\/svg><\/a><p class="hl-hero__note serif" aria-hidden="true">Better homes, brighter days<\/p><\/div><\/div>/);
  assert.equal(app.modules.home.HERO_TALL_MEDIA, '(max-width: 767px)');
  assert.match(css, /\.hl-hero__slide \{ position: relative; flex: 0 0 100%; aspect-ratio: 3 \/ 2; max-height: 820px; display: grid; align-items: start; \}/, 'the landscape at 3:2, capped');
  assert.match(css, /\.hl-hero__slide > picture \{ display: block; position: absolute; inset: 0; \}/, 'the picture is out of the grid flow');
  assert.match(css, /\.hl-hero__img \{ display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; \}/, 'the crop favours the top');
  // Below 768px the portrait is shorter than a full screen and keeps the image's
  // useful upper area, making the utility and shopping content arrive sooner.
  assert.match(section(css, '@media (max-width: 767px)', '@media (max-width: 599px)'), /\.hl-hero__slide \{ aspect-ratio: auto; height: clamp\(410px, 54svh, 480px\); min-height: 410px; max-height: 480px; \}\n\s*\.hl-hero__img \{ object-position: 50% 4%; \}/, 'the portrait below 768px is compact and bounded');
  assert.doesNotMatch(css, /\.hl-hero__note \{[^}]*position: absolute/, 'the note is in the copy block, not pinned top-right under the header');
});

await test('the floating header: fixed height the page is pulled up by, transparent with a top-down cream scrim behind it, the cream bar fading in once scrolled — opacity only; the tagline in a darker gold until then', () => {
  assert.match(css, /\.hl \{[^}]*--hl-hdr-h: 68px;/); assert.match(section(css, '@media (max-width: 599px)'), /\.hl \{ --hl-hdr-h: 60px; \}/);
  assert.match(css, /\.hl-hdr--over \{ background: transparent; border-bottom: 0; margin-bottom: calc\(-1 \* var\(--hl-hdr-h\)\); \}/);
  assert.match(css, /\.hl-hdr--over::before, \.hl-hdr--over::after \{ content: ''; position: absolute; left: 0; right: 0; top: 0; pointer-events: none; transition: opacity \.22s ease; \}/);
  assert.match(css, /\.hl-hdr--over::before \{ bottom: 0; z-index: -1; background: var\(--hl-hdr\); border-bottom: 1px solid var\(--hl-line\); opacity: 0; \}/, 'the cream bar, hidden until scrolled');
  assert.match(css, /\.hl-hdr--over::after \{ height: calc\(100% \+ 72px\); z-index: -2; background: linear-gradient\(180deg, rgba\(251, 248, 241, \.48\) 0%, rgba\(251, 248, 241, \.3\) 45%, rgba\(251, 248, 241, 0\) 100%\); \}/, 'the scrim: soft, top-down, 72px past the bar');
  assert.match(css, /\.hl-hdr--over\.is-solid::before \{ opacity: 1; \}\n\.hl-hdr--over\.is-solid::after \{ opacity: 0; \}/);
  assert.match(css, /\.hl-hdr--over \.hl-hdr__row \{ height: var\(--hl-hdr-h\); padding-top: 0; padding-bottom: 0; \}/);
  assert.match(css, /\.hl-hdr--over:not\(\.is-solid\) \.hl-logo em \{ color: #664B12; \}/, 'the tagline gold darkened over the photograph (5.0:1 measured under the scrim; the token is 3.5:1 there)');
  assert.match(css, /\.hl-hdr \{ position: sticky; top: 0; z-index: 20; background: var\(--hl-hdr\); border-bottom: 1px solid var\(--hl-line\); \}/, 'the solid bar everywhere else, unchanged');
  // The scroll state: a passive, rAF-throttled listener past 8px, cleaned up; only the floating header listens.
  assert.match(layoutSrc, /export const SOLID_AFTER_PX = 8;/);
  assert.match(layoutSrc, /const solid = useScrolledPast\(over \? SOLID_AFTER_PX : null\);/);
  assert.match(layoutSrc, /if \(threshold == null \|\| typeof window === 'undefined'\) return undefined;/);
  assert.match(layoutSrc, /window\.addEventListener\('scroll', onScroll, \{ passive: true \}\);\n\s*return \(\) => \{ window\.removeEventListener\('scroll', onScroll\); if \(raf\) cancelAnimationFrame\(raf\); \};/);
  assert.match(layoutSrc, /raf = requestAnimationFrame\(\(\) => \{ raf = null; setPast\(window\.scrollY > threshold\); \}\);/);
  assert.match(layoutSrc, /className=\{`hl-hdr\$\{over \? ' hl-hdr--over' : ''\}\$\{over && solid \? ' is-solid' : ''\}`\}/);
  assert.match(layoutSrc, /const HOME_PATH = \/\^\\\/homeliving\\\/\?\$\/;/); assert.match(layoutSrc, /const over = HOME_PATH\.test\(pathname\);/);
  assert.match(layoutSrc, /\{!over && <DeliveryRow \/>\}\n\s*\{!over && <SearchBar \/>\}/); assert.match(layoutSrc, /\{!over && <BottomNav \/>\}/);
});

await test('the copy: on the landscape, top-aligned on the bare wall left, 40% wide (42% on a tablet, the note dropped there); on the portrait, compact in a premium frosted panel under the header', () => {
  assert.match(css, /\.hl-hero__inner \{ position: relative; z-index: 1; width: 100%; padding-top: calc\(var\(--hl-hdr-h\) \+ 56px\); padding-bottom: 56px; \}/);
  assert.match(css, /\.hl-hero__txt \{ max-width: 40%; \}/);
  assert.match(css, /\.hl-hero__slide::before \{[^}]*linear-gradient\(90deg, rgba\(251, 248, 241, \.5\) 0%, rgba\(251, 248, 241, \.42\) 28%, rgba\(251, 248, 241, 0\) 50%\)/, 'a wash the wall shows through (eyebrow 6.4:1, sub 7.3:1 measured at 1280)');
  assert.match(css, /\.hl-hero__eyebrow \{[^}]*color: #664B12; \}/, 'the eyebrow in the darker gold too (the token would be 2.6:1 on the bare wall)');
  assert.match(css, /\.hl-hero__note \{ margin: 18px 0 0; font-style: italic; font-size: 24px; line-height: 1\.15; color: var\(--slv2-f800\); \}/);
  const tablet = section(css, '@media (max-width: 1019px)', '@media (max-width: 767px)');
  assert.match(tablet, /\.hl-hero__inner \{ padding-top: calc\(var\(--hl-hdr-h\) \+ 32px\); padding-bottom: 40px; \}/);
  assert.match(tablet, /\.hl-hero__txt \{ max-width: 42%; \}/); assert.match(tablet, /\.hl-hero__note \{ display: none; \}/);
  // The portrait is intentionally shorter than a full viewport so the collection
  // begins to appear on first scroll, while the copy remains readable over the image.
  const portrait = section(css, '@media (max-width: 767px)', '@media (max-width: 599px)');
  assert.match(portrait, /\.hl-hero__slide \{ aspect-ratio: auto; height: clamp\(410px, 54svh, 480px\); min-height: 410px; max-height: 480px; \}/, 'the mobile hero is compact and bounded');
  assert.match(portrait, /\.hl-hero__slide::before \{ background: linear-gradient\(180deg, rgba\(251, 248, 241, \.08\) 0%, rgba\(251, 248, 241, \.2\) 38%, rgba\(251, 248, 241, 0\) 68%\); \}/, 'a light wash preserves the photograph');
  assert.match(portrait, /\.hl-hero \.hl-hero__inner \{ padding-top: calc\(var\(--hl-hdr-h\) \+ 10px\); padding-bottom: 34px; \}/, 'outranks the phone .hl-wrap reset that follows it');
  assert.match(portrait, /\.hl-hero__txt \{ max-width: min\(100%, 300px\); padding: 14px 16px 15px;[^}]*border-radius: 18px;[^}]*backdrop-filter: blur\(7px\); \}/, 'a restrained frosted editorial panel keeps the copy readable');
  assert.match(portrait, /\.hl-hero__eyebrow \{ font-size: 10px; margin-bottom: 6px; \}/);
  assert.match(portrait, /\.hl-hero__h \{ font-size: clamp\(27px, 7\.4vw, 30px\); line-height: 1; \}/);
  assert.match(portrait, /\.hl-hero__sub \{ font-size: 13px; line-height: 1\.4; max-width: 30ch; margin: 7px 0 11px; \}/);
  assert.match(portrait, /\.hl-hero \.hl-cta \{ min-height: 40px; padding: 0 16px; font-size: 13\.5px;/, 'the CTA scales with the compact portrait composition');
  assert.doesNotMatch(section(css, '@media (max-width: 599px)'), /\.hl-hero__(h|sub|txt|eyebrow|inner|slide|img) \{/, 'the phone block leaves the hero to the portrait block');
});

// ============================================================
console.log('\n— Every other page: the solid header, unchanged —');
// ============================================================

await test('the category and product pages keep the solid bar with the delivery row and the search bar inside it and the nav strip before main — the homepage rework never reaches them', () => {
  for (const [name, html] of [['category', category], ['product', product]]) {
    assert.match(html, /^<div class="hl"><header class="hl-hdr"><div class="hl-hdr__row">/, `${name}: the plain shell`);
    assert.match(html, /<\/div><div class="hl-deliver" aria-label="Delivery">[\s\S]*?<span class="hl-deliver__badge">[\s\S]*?<\/svg> Standard Delivery · 6-7 days<\/span><\/div><div class="hl-search" role="search" aria-label="Search Home &amp; Living">[\s\S]*?<\/div><\/header><nav class="hl-nav" aria-label="Home &amp; Living">/, `${name}: delivery row and search bar inside the header, then the nav strip`);
    assert.doesNotMatch(html, /hl-hdr--over|hl--over|hl-tools/, `${name}: nothing of the floating header`);
  }
  // The header's row markup is the same on every page.
  const row = (html) => html.slice(html.indexOf('<div class="hl-hdr__row">'), html.indexOf('</nav></div>', html.indexOf('<div class="hl-hdr__row">')));
  assert.equal(row(home), row(category)); assert.equal(row(category), row(product));
});

// ============================================================
console.log('\n— The trust band and the category scroller —');
// ============================================================

await test('the trust band: one quiet row on larger screens, a fully visible two-column phone grid, and the promo keeps its 46px icon rings', () => {
  const strip = home.slice(home.indexOf('<ul class="hl-trust"'), home.indexOf('</ul>', home.indexOf('<ul class="hl-trust"')));
  assert.equal((strip.match(/<li><span class="hl-trust__icon"><svg width="18" height="18"/g) || []).length, 4);
  assert.match(css, /\.hl-trust \{ list-style: none; margin: 18px 0 0; padding: 12px 0; display: flex; align-items: center; justify-content: space-between; gap: 24px; border-top: 1px solid var\(--hl-line\); border-bottom: 1px solid var\(--hl-line\); \}/);
  assert.match(css, /\.hl-trust li \{ display: flex; align-items: center; gap: 10px; min-width: 0; \}/, 'no tiles');
  assert.match(css, /\.hl-trust \.hl-trust__icon \{ width: auto; height: auto; border: 0; background: none; \}/, 'no ring in the band');
  assert.match(css, /\.hl-trust__icon \{ flex: none; width: 46px; height: 46px; border-radius: 50%; border: 1\.5px solid var\(--slv2-f700\)/, 'the ring survives for the promo badges');
  assert.match(css, /\.hl-trust__txt \{ display: flex; align-items: baseline; gap: 6px; line-height: 1\.25; min-width: 0; white-space: nowrap; \}/);
  assert.match(css, /\.hl-trust__txt strong \{ font-size: 13\.5px; font-weight: 600; color: var\(--slv2-ink\); \}/);
  assert.match(section(css, '@media (max-width: 1019px)', '@media (max-width: 767px)'), /\.hl-trust__txt \{ display: grid; gap: 1px; \}/, 'four still fit at 768 with the sub-label under its label (measured 724px, one row)');
  const phone = section(css, '@media (max-width: 599px)');
  assert.match(phone, /\.hl-trust \{ margin: 14px -12px 0; padding: 10px 12px; gap: 18px; justify-content: flex-start; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; \}/);
  assert.match(phone, /\.hl-trust li \{ flex: none; \}/);
  assert.match(phone, /\.hl-home \.hl-trust \{ margin: 12px 0 0; padding: 0; display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 8px; overflow: visible; border: 0; \}/, 'the homepage overrides the fallback scroller with a 2×2 grid');
  assert.match(phone, /\.hl-home \.hl-trust li \{ min-height: 58px;[^}]*border-radius: 14px;/, 'each trust item is a readable compact tile');
  assert.match(home, /<ul class="hl-promo__badges" aria-label="Why it matters"><li><span class="hl-trust__icon"><svg width="22" height="22"/, 'the promo badges as before');
});

await test('the circles scroller: tiles snap, the right edge fades into the page, a round chevron scrolls a page — fade and chevron gone at the end; labels wrap, never clip', () => {
  assert.match(home, /<div class="hl-circles__scroller is-start"><nav class="hl-circles" aria-label="Shop by category"><a class="hl-circle" href="\/homeliving\/category\/bedsheets">/);
  assert.match(home, /<\/nav><button type="button" class="hl-circles__more" aria-label="Scroll to more categories" tabindex="0" aria-hidden="false"><svg[\s\S]*?<\/svg><\/button><\/div><\/section>/);
  assert.match(css, /\.hl-circles__scroller \{ position: relative; \}\n\.hl-circles__scroller::after, \.hl-circles__more \{ display: none; \}/, 'nothing of it on the grid');
  const phone = section(css, '@media (max-width: 599px)');
  assert.match(phone, /\.hl-circles__scroller \{ margin: 0 -12px; \}/);
  assert.match(phone, /\.hl-circles \{ display: flex; gap: 12px; padding: 4px 12px 8px; overflow-x: auto; scroll-snap-type: x proximity; scroll-padding-inline: 12px; scrollbar-width: none; -webkit-overflow-scrolling: touch; \}/);
  assert.match(phone, /\.hl-circle \{ flex: 0 0 88px; gap: 8px; scroll-snap-align: start; \}/);
  assert.match(phone, /\.hl-circles__scroller::after \{ content: ''; display: block; position: absolute; top: 0; right: 0; bottom: 0; width: 64px; pointer-events: none; background: linear-gradient\(90deg, rgba\(251, 248, 241, 0\) 0%, rgba\(251, 248, 241, \.85\) 55%, rgba\(251, 248, 241, 1\) 100%\); transition: opacity \.18s ease; \}/);
  assert.match(phone, /\.hl-circles__more \{ display: grid; place-items: center; position: absolute; right: 10px; top: 32px; width: 36px; height: 36px; padding: 0; border: 1px solid var\(--hl-line\); border-radius: 50%; background: var\(--slv2-paper\); color: var\(--slv2-f700\); box-shadow: var\(--hl-shadow\); cursor: pointer; transition: opacity \.18s ease; \}/, 'the chevron centred on the 88px circles');
  assert.match(phone, /\.hl-circles__scroller\.is-end::after, \.hl-circles__scroller\.is-end \.hl-circles__more \{ opacity: 0; pointer-events: none; \}/);
  assert.doesNotMatch(css, /\.hl-circle__name \{[^}]*(text-overflow|white-space: nowrap|overflow: hidden)/, 'labels wrap to a second line rather than clip');
  // The measurement: at the end when the last pixel is in view, on scroll and on resize, with the button a page at a time honouring reduced motion.
  assert.match(homeSrc, /const end = el\.scrollWidth - el\.clientWidth - el\.scrollLeft <= 1;/);
  assert.match(homeSrc, /<nav className="hl-circles" aria-label="Shop by category" ref=\{track\} onScroll=\{measure\}>/);
  assert.match(homeSrc, /window\.addEventListener\('resize', measure\);\n\s*return \(\) => window\.removeEventListener\('resize', measure\);/);
  assert.match(homeSrc, /el\.scrollBy\(\{ left: Math\.round\(el\.clientWidth \* 0\.8\), behavior: reduced \? 'auto' : 'smooth' \}\);/);
  assert.match(homeSrc, /tabIndex=\{edge\.end \? -1 : 0\} aria-hidden=\{edge\.end\}/);
});

// ============================================================
console.log('\n— Copy and isolation —');
// ============================================================

await test('no speed claim in any changed file; the words on the page are the data module\'s', () => {
  for (const rel of ['src/homeliving/HomeLivingLayout.jsx', 'src/homeliving/HomeLivingHome.jsx', 'src/data/homelivingHomepage.js', 'src/styles/homeliving.css']) {
    for (const re of SPEED_CLAIMS) assert.ok(!re.test(read(rel)), `${rel} matches ${re}`);
  }
  const text = home.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  for (const k of ['eyebrow', 'headline', 'sub', 'cta', 'note']) assert.ok(text.includes(app.data.HERO_SLIDES[0][k]), `hero ${k}`);
  assert.ok(text.includes('Standard Delivery · 6-7 days'));
});

await test('isolation: the store\'s own homepage files, its sheet, the two photographs and scripts/ — nothing else; the category and product pages, the other stores, cart, checkout, coupons, auth, payments and the shared build are byte-identical to the baseline', () => {
  const changed = new Set(execFileSync('git', ['diff', '--name-only', BASELINE_SHA], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean));
  // Three approved changes landed beside this section and moved files these pins guard:
  //   86ea8cf  src/components/Hero.jsx   — the wellness hero drops the Supabase render-transform URLs (test-homepage-appearance.mjs)
  //   e58317c  src/fashion/FashionHome.jsx — the campaign hero leads /fashion (test-fashion.mjs pins the new order)
  //   a651320  src/pages/Legal.jsx       — the shipping policy rewrite (test-company-surfaces.mjs pins the policy)
  //   e58317c also restyled src/styles/fashion.css.
  // Express and Scheduled were withdrawn — brands ship standard, and the published Shipping Policy
  // documents Standard only. That edited the fee map (api/_lib/pricing.js), the checkout picker,
  // the PDP's display copy (src/data/pdpContent.js) and the PDP delivery panel, and nothing else.
  // test-company-surfaces.mjs pins the fee map against the policy; test-payment-hardening.mjs,
  // test-payment-logic.mjs and test-commerce-pricing.mjs pin that a withdrawn method cannot be charged.
  const allowed = /^(src\/homeliving\/(HomeLivingLayout|HomeLivingHome)\.jsx$|api\/_lib\/pricing\.js$|src\/pages\/Checkout\.jsx$|src\/data\/pdpContent\.js$|src\/components\/pdp\/ProductDeliveryInfo\.jsx$|src\/lib\/legalPageDefaults\.js$|src\/lib\/settings\.js$|src\/components\/Hero\.jsx$|src\/fashion\/FashionHome\.jsx$|src\/pages\/Legal\.jsx$|src\/styles\/fashion\.css$|src\/data\/homelivingHomepage\.js$|src\/styles\/homeliving\.css$|img\/homeliving-hero-(wide|tall)\.webp$|scripts\/|public\/|reports\/)/;
  const bad = [...changed].filter((f) => !allowed.test(f));
  assert.deepEqual(bad, [], `unexpected files changed: ${bad.join(', ')}`);
  for (const rel of ['src/homeliving/HomeLivingCategory.jsx', 'src/homeliving/HomeLivingProductPage.jsx', 'src/homeliving/HomeLivingProductCard.jsx', 'src/lib/homelivingListing.js', 'src/lib/homelivingPdp.js', 'src/components/Header.jsx', 'src/fashion/FashionLayout.jsx', 'src/grocery/GroceryLayout.jsx', 'src/lifestyle/LifestyleLayout.jsx', 'src/lifestyle/LifestyleHome.jsx', 'src/data/lifestyleHomepage.js', 'src/styles/grocery.css', 'src/styles/lifestyle.css', 'src/styles/v2-foundation.css', 'src/styles/tokens.css', 'src/lib/store.jsx', 'src/lib/cartLine.js', 'src/lib/couponApi.js', 'src/lib/payments.js', 'src/lib/customerAuth.jsx', 'src/pages/Cart.jsx', 'src/pages/Checkout.jsx', 'api/_lib/pricing.js', 'api/razorpay/create-order.js', 'src/App.jsx', 'build/build-css.mjs', 'src/lib/deferredStyles.js', 'index.html']) {
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
    assert.equal(sansDelivery(read(rel).replace(/\r\n/g, '\n')), sansDelivery(atCommit(BASELINE_SHA, rel).replace(/\r\n/g, '\n')), `${rel} is byte-identical to ${BASELINE_SHA}`);
  }
  assert.ok(![...changed].some((f) => /^supabase\//.test(f)), 'no migration');
  const untracked = execFileSync('git', ['status', '--porcelain'], { cwd: REPO, encoding: 'utf8' }).split('\n').map((l) => l.slice(3).replace(/^"|"$/g, '')).filter(Boolean);
  assert.ok(!untracked.some((f) => /^package(-lock)?\.json$/.test(f)), 'no dependency change');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
