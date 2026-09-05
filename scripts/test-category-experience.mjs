// ============================================================
// Category Experience — the animated spotlight stage on category pages.
//
// What these checks defend:
//
//   STORAGE      it rides inside the already-allowlisted `homepage` setting,
//                so the feature needs no migration and no RLS change.
//   SAFETY       colours and gradients reach an inline style attribute, so
//                anything that could carry script or a url() is refused.
//   TRUTH        only real, sellable products from the right category reach
//                the stage; no invented ratings, claims or "bestseller".
//   PERFORMANCE  a 100-product category renders THREE slides, not 100.
//
// Offline: real modules and real JSX rendered in memory. No network, no
// Supabase, no orders.
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import {
  safeColor, safeGradient, sanitizeTheme, sanitizeSpotlightItem, sanitizeCategoryConfig,
  normalizeCategoryExperience, categoryExperiencePayload, isSpotlightEligible,
  resolveSpotlightItems, visibleWindow, wrapIndex, spotlightVisible,
  looksTransparent, categoryToneTheme, makeSpotlightId, categoryIsReadyButOff, mobileSpotlightTheme,
  MAX_STORED_ITEMS, DEFAULT_INTERVAL_MS, MIN_INTERVAL_MS, MAX_INTERVAL_MS,
  MIN_ITEM_SCALE, MAX_ITEM_SCALE, DEFAULT_ITEM_SCALE, ITEM_OFFSET_LIMIT,
} from '../src/lib/categoryExperience.js';

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
};
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const src = (p) => read(p).replace(/\r\n/g, '\n');
// Comments name the bugs and quote the old code; counting words in prose
// would make every source assertion meaningless.
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const h = React.createElement;

function component(file, name, deps = {}) {
  const { code: js } = transformSync(read(file), {
    configFile: false, babelrc: false,
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    plugins: [() => ({ visitor: {
      ImportDeclaration(p) { p.remove(); },
      ExportDefaultDeclaration(p) { p.replaceWith(p.node.declaration); },
      ExportNamedDeclaration(p) { if (p.node.declaration) p.replaceWith(p.node.declaration); else p.remove(); },
    } })],
  });
  const scope = { React, ...React, ...deps };
  return new Function(...Object.keys(scope), `${js}\n;return ${name};`)(...Object.values(scope));
}

// ---- fixtures -------------------------------------------------------
const mk = (over = {}) => ({
  id: over.slug || 'p', slug: 'p', name: 'Product', price: 100, mrp: 120,
  priceVerified: true, isActive: true, stock: 40, category: 'hair-care',
  image: '/img/p.png', form: '250 ml', rating: 0, reviewCount: 0, ...over,
});
const A = mk({ slug: 'shampoo-a', id: 'a', name: 'Shampoo A' });
const B = mk({ slug: 'oil-b', id: 'b', name: 'Oil B', rating: 4.6, reviewCount: 32 });
const C = mk({ slug: 'mask-c', id: 'c', name: 'Mask C' });
const D = mk({ slug: 'serum-d', id: 'd', name: 'Serum D' });
const HAIR = [A, B, C, D];

// ====================================================================
console.log('\n— Storage: no migration, no new settings key —');
// ====================================================================

test('S1 the feature lives inside the already-allowlisted homepage key', () => {
  const lib = code('../src/lib/categoryExperience.js');
  assert.match(lib, /categoryExperience/, 'the sub-object is named');
  // The public-read allowlist is fixed by migration 0015. Anything outside it
  // would be invisible to the storefront and need a migration.
  const mig = src('../supabase/migrations/0015_storefront_theme.sql');
  const allow = mig.match(/key in \(([^)]*)\)/)[1];
  assert.match(allow, /'homepage'/, 'homepage is publicly readable');
  // And no migration was added for this feature.
  const admin = code('../src/admin/pages/CategoryExperience.jsx');
  assert.match(admin, /adminGetSetting\('homepage'\)/, 'admin reads the homepage key');
  assert.match(admin, /adminSetSetting\('homepage'/, 'and writes the same key');
});

test('S2 saving preserves the rest of the homepage object', () => {
  const admin = code('../src/admin/pages/CategoryExperience.jsx');
  // Read-modify-write: a concurrent edit to discovery or the visuals must not
  // be wiped by a spotlight save.
  assert.match(admin, /const current = \(await adminGetSetting\('homepage'\)\) \|\| \{\};/);
  assert.match(admin, /\{ \.\.\.current, categoryExperience:/, 'spread the existing object');
});

test('S3 payload omits untouched categories instead of writing defaults', () => {
  const empty = categoryExperiencePayload({ 'hair-care': sanitizeCategoryConfig({}, 'hair-care') });
  assert.deepEqual(empty.categories, {}, 'an all-default category is not persisted');
  const real = categoryExperiencePayload({
    'hair-care': { enabled: false, items: [{ productSlug: 'shampoo-a' }] },
  });
  assert.equal(real.categories['hair-care'].enabled, false);
  assert.equal(real.categories['hair-care'].items.length, 1);
  // A slug that is not a real category cannot be written at all.
  assert.deepEqual(
    categoryExperiencePayload({ 'not-a-category': { enabled: false } }).categories, {},
  );
});

// ====================================================================
console.log('\n— Inline style safety —');
// ====================================================================

test('X1 only real colours survive', () => {
  for (const ok of ['#fff', '#F1EDE4', '#F1EDE4CC', 'rgb(1,2,3)', 'rgba(1,2,3,.5)', 'hsl(10 20% 30%)', 'seagreen']) {
    assert.equal(safeColor(ok), ok, `${ok} should be allowed`);
  }
  for (const bad of [
    'red;background:url(x)', 'url(javascript:alert(1))', 'var(--x)', 'expression(alert(1))',
    '#fff"><script>', 'rgb(1,2,3);}', '', null, undefined, 'a'.repeat(80),
  ]) {
    assert.equal(safeColor(bad), '', `${JSON.stringify(bad)} must be refused`);
  }
});

test('X2 only a plain gradient survives', () => {
  const ok = 'linear-gradient(168deg, #F4EFF5 0%, #E6DCEA 100%)';
  assert.equal(safeGradient(ok), ok);
  assert.equal(safeGradient('radial-gradient(circle, #fff 0%, #000 100%)').startsWith('radial-'), true);
  for (const bad of [
    'linear-gradient(#fff, url(x))', 'linear-gradient(#fff, var(--x))',
    'linear-gradient(#fff, #000); background: url(evil)', 'linear-gradient(#fff',
    'image-set("a.png")', '#fff', 'expression(1)', 'linear-gradient(#fff,#000)"><script>',
  ]) {
    assert.equal(safeGradient(bad), '', `${JSON.stringify(bad)} must be refused`);
  }
});

test('X3 a bad stored theme falls back rather than reaching the DOM', () => {
  const t = sanitizeTheme({ background: 'url(evil)', gradient: 'var(--x)' }, { background: '#ABCDEF', gradient: '' });
  assert.equal(t.background, '#ABCDEF');
  assert.equal(t.gradient, '');
  // A category with a known tone gets that tone's ground, not a generic grey.
  assert.match(categoryToneTheme('hair-care').background, /^#[0-9A-F]{6}$/i);
});

test('X4 the spotlight image obeys the existing visual-URL policy', () => {
  assert.equal(sanitizeSpotlightItem({ productSlug: 'x', spotlightImage: 'javascript:alert(1)' }).spotlightImage, '');
  assert.equal(sanitizeSpotlightItem({ productSlug: 'x', spotlightImage: 'http://evil.test/a.png' }).spotlightImage, '');
  assert.equal(sanitizeSpotlightItem({ productSlug: 'x', spotlightImage: '/img/a.png' }).spotlightImage, '/img/a.png');
});

test('X5 generated item themes are sanitized independently from manual overrides', () => {
  const item = sanitizeSpotlightItem({
    productSlug: 'x',
    background: '#112233',
    gradient: '',
    autoTheme: {
      background: '#F8E3D6',
      gradient: 'linear-gradient(168deg, #F9EBE1 0%, #F6D4C2 100%)',
    },
  });
  assert.equal(item.background, '#112233');
  assert.equal(item.autoTheme.background, '#F8E3D6');
  assert.match(item.autoTheme.gradient, /^linear-gradient/);
  const bad = sanitizeSpotlightItem({
    productSlug: 'x', autoTheme: { background: 'url(evil)', gradient: 'var(--x)' },
  });
  assert.deepEqual(bad.autoTheme, { background: '', gradient: '' });
});

// ====================================================================
console.log('\n— Only real, sellable products reach the stage —');
// ====================================================================

test('E1 eligibility matches the storefront rules, and invents nothing', () => {
  assert.equal(isSpotlightEligible(A), true);
  assert.equal(isSpotlightEligible({ ...A, isActive: false }), false, 'deactivated');
  assert.equal(isSpotlightEligible({ ...A, stock: 0 }), false, 'sold out');
  assert.equal(isSpotlightEligible({ ...A, price: 0, priceVerified: false }), false, 'unpriced');
  assert.equal(isSpotlightEligible({ ...A, slug: '' }), false, 'no slug');
  assert.equal(isSpotlightEligible(null), false);
  // No featured/bestseller/new concept anywhere in the module.
  const lib = code('../src/lib/categoryExperience.js');
  assert.doesNotMatch(lib, /isBestseller|isFeatured|bestseller/i,
    'ordering is the admin\'s job or catalogue order — never an invented status');
});

test('E2 curated items win, in the admin order', () => {
  const cfg = sanitizeCategoryConfig({
    items: [{ productSlug: 'mask-c' }, { productSlug: 'shampoo-a' }],
  }, 'hair-care');
  const out = resolveSpotlightItems('hair-care', { config: cfg, productList: HAIR });
  assert.deepEqual(out.map((s) => s.productSlug), ['mask-c', 'shampoo-a']);
});

test('E3 a curated product that went stale is skipped, not rendered', () => {
  const dead = { ...C, isActive: false };
  const cfg = sanitizeCategoryConfig({
    items: [{ productSlug: 'shampoo-a' }, { productSlug: 'mask-c' }, { productSlug: 'gone-forever' }],
  }, 'hair-care');
  const out = resolveSpotlightItems('hair-care', { config: cfg, productList: [A, B, dead, D] });
  assert.deepEqual(out.map((s) => s.productSlug), ['shampoo-a'],
    'a deactivated and a missing product both drop out');
});

test('E4 a curated product recategorised away no longer lingers', () => {
  const moved = { ...A, category: 'skin-care', categories: ['skin-care'] };
  const cfg = sanitizeCategoryConfig({
    items: [{ productSlug: 'shampoo-a' }, { productSlug: 'mask-c' }],
  }, 'hair-care');
  const out = resolveSpotlightItems('hair-care', { config: cfg, productList: [moved, B, C, D] });
  assert.deepEqual(out.map((s) => s.productSlug), ['mask-c'],
    'the moved product drops out; the rest of the curation stands');

  // And when it was the ONLY curated item, the category does not go blank —
  // curation is empty, so the automatic fallback fills the stage with the
  // category's real products. The moved product is still not among them.
  const soloCfg = sanitizeCategoryConfig({ items: [{ productSlug: 'shampoo-a' }] }, 'hair-care');
  const fellBack = resolveSpotlightItems('hair-care', { config: soloCfg, productList: [moved, B, C, D] });
  assert.deepEqual(fellBack.map((s) => s.productSlug), ['oil-b', 'mask-c', 'serum-d']);
  assert.ok(!fellBack.some((s) => s.productSlug === 'shampoo-a'), 'never resurfaces');
});

test('E5 with nothing curated, EVERY eligible product in the category rotates', () => {
  const out = resolveSpotlightItems('hair-care', {
    config: sanitizeCategoryConfig({ enabled: true }, 'hair-care'), productList: HAIR,
  });
  assert.deepEqual(out.map((s) => s.productSlug), ['shampoo-a', 'oil-b', 'mask-c', 'serum-d']);

  // The automatic pool used to stop at 8, hiding the rest of a category for
  // no benefit — the stage mounts three seats however deep the pool is.
  const wellness = Array.from({ length: 46 }, (_, i) => mk({ slug: `w${i}`, id: `w${i}` }));
  const pool = resolveSpotlightItems('hair-care', {
    config: sanitizeCategoryConfig({ enabled: true }, 'hair-care'), productList: wellness,
  });
  assert.equal(pool.length, 46, 'a 46-product category offers all 46');

  const hundred = Array.from({ length: 100 }, (_, i) => mk({ slug: `p${i}`, id: `p${i}` }));
  assert.equal(
    resolveSpotlightItems('hair-care', { config: sanitizeCategoryConfig({ enabled: true }, 'hair-care'), productList: hundred }).length,
    100, 'and 100 products give a pool of 100');

  // Ineligible products are still excluded — removing the cap did not relax
  // the bar for what may appear.
  const mixed = [...hundred.slice(0, 5), mk({ slug: 'gone', id: 'gone', stock: 0 })];
  assert.equal(
    resolveSpotlightItems('hair-care', { config: sanitizeCategoryConfig({ enabled: true }, 'hair-care'), productList: mixed }).length,
    5, 'a sold-out product is still left out');
});

test('E6 one, two and zero eligible products are all handled', () => {
  const cfg = sanitizeCategoryConfig({ enabled: true }, 'hair-care');
  assert.equal(resolveSpotlightItems('hair-care', { config: cfg, productList: [A] }).length, 1);
  assert.equal(resolveSpotlightItems('hair-care', { config: cfg, productList: [A, B] }).length, 2);
  const none = resolveSpotlightItems('hair-care', { config: cfg, productList: [{ ...A, stock: 0 }] });
  assert.equal(none.length, 0);
  assert.equal(spotlightVisible('hair-care', none, cfg), false, 'the stage hides itself entirely');
  assert.equal(spotlightVisible('hair-care', [1], { ...cfg, enabled: false }), false, 'and when switched off');
});

test('E7 facts come from the catalogue; copy comes only from the admin', () => {
  const cfg = sanitizeCategoryConfig({
    items: [{ productSlug: 'oil-b', headline: 'Our pick', subline: 'Cold pressed' }],
  }, 'hair-care');
  const [slide] = resolveSpotlightItems('hair-care', { config: cfg, productList: HAIR });
  assert.equal(slide.name, 'Oil B');
  assert.equal(slide.form, '250 ml');
  assert.equal(slide.rating, 4.6, 'a genuine rating is carried');
  assert.equal(slide.reviewCount, 32);
  assert.equal(slide.headline, 'Our pick');
  assert.equal(slide.subline, 'Cold pressed');
  // A product with no reviews shows no rating rather than a fabricated one.
  const cfgA = sanitizeCategoryConfig({ items: [{ productSlug: 'shampoo-a' }] }, 'hair-care');
  const [plain] = resolveSpotlightItems('hair-care', { config: cfgA, productList: HAIR });
  assert.equal(plain.rating, null);
  assert.equal(plain.headline, '');
});

test('E8 image priority: configured asset, then cutout, then product image', () => {
  const cfg = (items) => sanitizeCategoryConfig({ items }, 'hair-care');
  const [withAsset] = resolveSpotlightItems('hair-care', {
    config: cfg([{ productSlug: 'shampoo-a', spotlightImage: '/img/hero.png' }]), productList: HAIR,
  });
  assert.equal(withAsset.image, '/img/hero.png');
  assert.equal(withAsset.framed, false, 'a configured asset is treated as a cutout');

  const [png] = resolveSpotlightItems('hair-care', { config: cfg([{ productSlug: 'shampoo-a' }]), productList: HAIR });
  assert.equal(png.image, '/img/p.png');
  assert.equal(png.framed, false, 'a png may carry alpha');

  const jpg = { ...A, image: '/img/p.jpg' };
  const [framed] = resolveSpotlightItems('hair-care', { config: cfg([{ productSlug: 'shampoo-a' }]), productList: [jpg, B, C, D] });
  assert.equal(framed.framed, true, 'a jpeg is framed rather than faked as a cutout');
  assert.equal(looksTransparent('/a.png?v=2'), true);
  assert.equal(looksTransparent('/a.jpg'), false);
});

test('E9 each slide uses its stored auto theme, while manual item colours win', () => {
  const cfg = sanitizeCategoryConfig({
    theme: { background: '#EEEEEE', gradient: '' },
    items: [
      { productSlug: 'shampoo-a', autoTheme: { background: '#F8E3D6', gradient: 'linear-gradient(168deg, #F9EBE1 0%, #F6D4C2 100%)' } },
      { productSlug: 'oil-b', autoTheme: { background: '#E4EFE2', gradient: 'linear-gradient(168deg, #EFF5EC 0%, #D7E7D3 100%)' } },
      { productSlug: 'mask-c', background: '#ABCDEF', gradient: '', autoTheme: { background: '#F5E0EC', gradient: 'linear-gradient(168deg, #F8EAF2 0%, #ECD1E1 100%)' } },
    ],
  }, 'hair-care');
  const slides = resolveSpotlightItems('hair-care', { config: cfg, productList: HAIR });
  assert.equal(slides[0].theme.background, '#F8E3D6');
  assert.equal(slides[1].theme.background, '#E4EFE2');
  assert.notEqual(slides[0].theme.gradient, slides[1].theme.gradient);
  assert.deepEqual(slides[2].theme, { background: '#ABCDEF', gradient: '' }, 'manual background suppresses auto theme');
});

// ====================================================================
console.log('\n— Performance: three slides, whatever the catalogue size —');
// ====================================================================

test('P1 the visible window is exactly prev/active/next', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];
  const w = visibleWindow(items, 2);
  assert.equal(w.prev.slide, 'b');
  assert.equal(w.active.slide, 'c');
  assert.equal(w.next.slide, 'd');
  // Wrapping both ways.
  assert.equal(visibleWindow(items, 0).prev.slide, 'e');
  assert.equal(visibleWindow(items, 4).next.slide, 'a');
});

test('P2 a 100-product category still yields three slides', () => {
  const many = Array.from({ length: 100 }, (_, i) => `p${i}`);
  const w = visibleWindow(many, 50);
  const rendered = [w.prev, w.active, w.next].filter(Boolean);
  assert.equal(rendered.length, 3, 'never more than three');
});

test('P2c every product in a deep pool is reachable by rotating', () => {
  // A pool of 46 must actually cycle through all 46 rather than looping over
  // a truncated head.
  const items = Array.from({ length: 46 }, (_, i) => `p${i}`);
  const seen = new Set();
  for (let i = 0; i < 46; i += 1) seen.add(visibleWindow(items, i).active.slide);
  assert.equal(seen.size, 46, 'each index selects a distinct product');
  // And it wraps continuously rather than stopping at the end.
  assert.equal(visibleWindow(items, 45).next.slide, 'p0', 'the loop is continuous');
  assert.equal(visibleWindow(items, 0).prev.slide, 'p45');
});

test('P3 tiny collections do not double-render one product', () => {
  const one = visibleWindow(['a'], 0);
  assert.equal(one.prev, null);
  assert.equal(one.next, null);
  assert.equal(one.active.slide, 'a');
  // With two, prev and next would be the SAME product; offer it once.
  const two = visibleWindow(['a', 'b'], 0);
  assert.equal(two.active.slide, 'a');
  assert.equal(two.prev.slide, 'b');
  assert.equal(two.next, null, 'the same slide must not occupy both sides');
  assert.equal(visibleWindow([], 0).active, null);
});

test('P4 index wrapping never escapes the range', () => {
  for (const i of [-7, -1, 0, 3, 11]) {
    const v = wrapIndex(i, 4);
    assert.ok(v >= 0 && v < 4, `${i} -> ${v}`);
  }
  assert.equal(wrapIndex(2, 0), 0, 'an empty list cannot index');
});

test('P5 the upcoming image is fetched by the stage, not by a preload hint', () => {
  // A <link rel="preload"> was tried and removed: the NEXT product is already
  // a real <img> in the stage, and preloading the one after it fired ~10s
  // early, logging "preloaded but not used" on every rotation.
  const cmp = code('../src/components/category/CategorySpotlight.jsx');
  assert.doesNotMatch(cmp, /rel="preload"/, 'no preload hint is emitted');
  assert.match(cmp, /<SpotlightImage slide=\{s\} \/>/, 'the next seat renders a real image');
  assert.doesNotMatch(code('../src/lib/categoryExperience.js'), /preloadTarget/,
    'and the helper was removed rather than left dead');
});

test('P6 no animation library, no canvas, no polling loop', () => {
  const cmp = code('../src/components/category/CategorySpotlight.jsx');
  assert.doesNotMatch(cmp, /framer-motion|gsap|three|canvas|requestAnimationFrame/i,
    'CSS transitions only');
  // One interval, for auto-rotation, and it is cleared.
  assert.equal((cmp.match(/setInterval/g) || []).length, 1);
  assert.match(cmp, /return \(\) => clearInterval\(t\)/);
  assert.doesNotMatch(cmp, /getImageData|createImageBitmap/, 'no runtime colour extraction');
});

// ====================================================================
console.log('\n— Motion, interaction and accessibility —');
// ====================================================================

test('M1 only transform and opacity are transitioned', () => {
  const css = src('../src/styles/category-spotlight.css');
  const seat = css.slice(css.indexOf('.cspot__seat {'), css.indexOf('.cspot__seat--active'));
  assert.match(seat, /transition:\s*\n?\s*transform var\(--cspot-dur\)/);
  assert.match(seat, /opacity var\(--cspot-dur\)/);
  // Layout properties and filters must never be animated.
  assert.doesNotMatch(seat, /transition:[^;]*(width|height|top|left|margin|padding|filter)/);
  assert.doesNotMatch(css, /transition:[^;]*filter/, 'no filter animation anywhere');
  assert.doesNotMatch(css, /cubic-bezier\(\s*[^)]*,\s*-/, 'no overshoot/bounce easing');
});

test('M2 motion is brief and geometry remains centralised', () => {
  const css = src('../src/styles/category-spotlight.css');
  const dur = Number(css.match(/--cspot-dur:\s*(\d+)ms/)[1]);
  assert.ok(dur >= 200 && dur <= 650, `duration ${dur}ms stays responsive`);
  assert.match(css, /--cspot-ease:\s*cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
  // Geometry belongs in variables, not scattered through the JSX.
  const cmp = src('../src/components/category/CategorySpotlight.jsx');
  assert.doesNotMatch(cmp, /translate3d|scale\(|vw\b/, 'no geometry hardcoded in the component');
  for (const v of ['--cspot-h', '--cspot-shot-h', '--cspot-side-scale', '--cspot-side-x',
    '--cspot-side-op', '--cspot-active-y', '--cspot-side-y']) {
    assert.match(css, new RegExp(`${v}:`), `${v} must be tunable`);
  }
});

test('M3 the mobile stage geometry stays within art-directed bounds', () => {
  // Pass 2 replaced pass 1's numbers; F3 pins the exact current values, so
  // this one guards the SHAPE of the composition rather than repeating them.
  const css = src('../src/styles/category-spotlight.css');
  const base = css.slice(css.indexOf('.cspot {'), css.indexOf('.cspot__bg'));
  const num = (name) => {
    // src() has already normalised CRLF, so a plain newline split is enough.
    const line = base.split("\n").find((l) => l.trim().startsWith(`${name}:`));
    if (!line) throw new Error(`${name} is not declared in the .cspot block`);
    return parseFloat(line.split(':')[1].trim());
  };

  assert.ok(num('--cspot-h') >= 220 && num('--cspot-h') <= 300, 'stage stays compact');
  assert.ok(num('--cspot-seat-w') > 0 && num('--cspot-seat-w') < 100,
    'a full-width seat would hide the side products behind the active one');
  assert.ok(num('--cspot-shot-h') >= 70 && num('--cspot-shot-h') <= 95,
    'the product fills the stage rather than floating in empty space');
  assert.ok(num('--cspot-side-scale') >= 0.5 && num('--cspot-side-scale') < 1,
    'sides are smaller than the active product, but not tiny');
  assert.ok(num('--cspot-side-op') >= 0.7,
    'sides are secondary through scale and position, not through heavy fading');
  assert.ok(num('--cspot-active-y') <= 0, 'the active product is raised, never dropped');
});

test('M3b the stage shows isolated packshots, never boxed lifestyle cards', () => {
  // Comment-stripped: the comments here describe the white card that was
  // REMOVED, so reading raw CSS would match the very words being banned.
  const css = code('../src/styles/category-spotlight.css');
  const img = css.slice(css.indexOf('.cspot__img {'), css.indexOf('.cspot__img--empty'));
  // No second background behind the product: the category theme is the only
  // ground. This used to paint a white panel with padding and a box-shadow.
  assert.doesNotMatch(img, /background:\s*#fff|background:\s*white/i,
    'no white card behind a product');
  assert.doesNotMatch(img, /padding:\s*\d/, 'no panel padding');
  assert.doesNotMatch(img, /box-shadow/, 'grounding is a drop-shadow on the cutout, not a card shadow');
  assert.match(img, /filter: drop-shadow\(/, 'a single soft grounding shadow');
  // Explicitly banned by the brief.
  assert.doesNotMatch(css, /filter:[^;]*blur\(/, 'no blur');
  assert.doesNotMatch(css, /backdrop-filter/, 'no glass/glow effects');
  // The shadow is static — animating a filter would leave the compositor.
  assert.doesNotMatch(css, /transition:[^;]*filter/, 'the shadow is never animated');
});

test('M3c mobile tuning does not leak into tablet or desktop', () => {
  const css = src('../src/styles/category-spotlight.css');
  const tablet = css.slice(css.indexOf('@container (min-width: 768px)'), css.indexOf('@container (min-width: 1100px)'));
  const desktop = css.slice(css.indexOf('@container (min-width: 1100px)'));
  // These two are the ones the larger breakpoints did not previously set, so
  // retuning them for mobile would have silently changed 768 and 1440 too.
  for (const [name, block] of [['tablet', tablet], ['desktop', desktop]]) {
    assert.match(block, /--cspot-active-y:\s*-12px/, `${name} pins its own active lift`);
    assert.match(block, /--cspot-side-y:/, `${name} sets its own neighbour placement`);
    assert.match(block, /--cspot-h:/, `${name} sets its own stage height`);
    assert.match(block, /--cspot-seat-w:/, `${name} sets its own seat width`);
  }
});

test('M4 reduced motion keeps the content and drops the movement', () => {
  const css = src('../src/styles/category-spotlight.css');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  const cmp = code('../src/components/category/CategorySpotlight.jsx');
  assert.match(cmp, /prefers-reduced-motion: reduce/, 'the component reads it too');
  assert.match(cmp, /cspot--still/, 'and marks the stage');
  // Auto-rotation is off under reduced motion, but switching still works.
  assert.match(cmp, /if \(!config\.autoRotate \|\| paused \|\| reducedMotion\) return undefined;/);
});

test('M5 auto-rotate pauses for hover, interaction, hidden tab and offscreen', () => {
  const cmp = code('../src/components/category/CategorySpotlight.jsx');
  assert.match(cmp, /onMouseEnter=\{\(\) => setHovered\(true\)\}/);
  assert.match(cmp, /if \(!onScreen \|\| !pageVisible \|\| count < 2\) return undefined;/);
  assert.match(cmp, /rotationStopped \|\| focused \|\| hovered/, 'each pause reason is independent');
  assert.match(cmp, /visibilitychange/);
  assert.match(cmp, /IntersectionObserver/);
  assert.match(cmp, /RESUME_AFTER_INTERACTION_MS/, 'and resumes after a delay');
  const interval = Number(src('../src/lib/categoryExperience.js').match(/DEFAULT_INTERVAL_MS = (\d+)/)[1]);
  assert.ok(interval >= 4500 && interval <= 6000, `default ${interval}ms should be 4.5-6s`);
  // The stored value is clamped, so a bad setting cannot make it strobe.
  const fast = sanitizeCategoryConfig({ intervalMs: 50 }, 'hair-care');
  assert.equal(fast.intervalMs, MIN_INTERVAL_MS);
  assert.equal(sanitizeCategoryConfig({ intervalMs: 1e9 }, 'hair-care').intervalMs, MAX_INTERVAL_MS);
  assert.equal(sanitizeCategoryConfig({ intervalMs: 'soon' }, 'hair-care').intervalMs, DEFAULT_INTERVAL_MS);
});

test('M5b async settings attach visibility observation after the initial gated render', () => {
  let previousDependencies;
  let cleanup;
  let observed = 0, disconnected = 0;
  const observe = component('../src/components/category/CategorySpotlight.jsx', 'useOnScreen', {
    useState: (value) => [value, () => {}],
    useEffect: (effect, dependencies) => {
      if (previousDependencies && dependencies.every((value, i) => Object.is(value, previousDependencies[i]))) return;
      cleanup?.();
      previousDependencies = dependencies;
      cleanup = effect();
    },
    IntersectionObserver: class {
      observe() { observed += 1; }
      disconnect() { disconnected += 1; }
    },
  });
  const ref = { current: null };
  observe(ref, false);
  assert.equal(observed, 0, 'there is no stage before settings resolve');
  ref.current = {};
  observe(ref, true);
  assert.equal(observed, 1, 'the newly mounted stage is observed with the SAME ref');
  observe(ref, true);
  assert.equal(observed, 1, 'ordinary renders do not recreate the observer');
  ref.current = null;
  observe(ref, false);
  assert.equal(disconnected, 1, 'unpublishing cleans up the observation');
});

test('M6 swipe does not steal vertical scrolling', () => {
  const css = src('../src/styles/category-spotlight.css');
  assert.match(css, /touch-action: pan-y/, 'vertical scroll stays the page\'s');
  const cmp = code('../src/components/category/CategorySpotlight.jsx');
  assert.match(cmp, /Math\.abs\(dx\) <= Math\.abs\(dy\)/, 'a mostly-vertical drag is not a swipe');
});

test('A1 the stage is keyboard operable and not a trap', () => {
  const cmp = code('../src/components/category/CategorySpotlight.jsx');
  assert.match(cmp, /e\.key === 'ArrowRight'/);
  assert.match(cmp, /e\.key === 'ArrowLeft'/);
  assert.match(cmp, /aria-label="Previous product"/);
  assert.match(cmp, /aria-label="Next product"/);
  // Side products are decoration until chosen: out of the tab order and
  // hidden from assistive tech, so they cannot trap a keyboard user.
  assert.match(cmp, /tabIndex=\{-1\}/);
  assert.match(cmp, /aria-hidden=\{!isActive\}/);
  const css = src('../src/styles/category-spotlight.css');
  assert.match(css, /\.cspot__stage:focus-visible/, 'the stage shows focus');
});

test('A2 the product change is announced once, not three times', () => {
  const cmp = code('../src/components/category/CategorySpotlight.jsx');
  const live = (cmp.match(/aria-live/g) || []).length;
  assert.equal(live, 1, 'exactly one live region for the whole stage');
  assert.match(cmp, /aria-roledescription="carousel"/);
});

// ====================================================================
console.log('\n— Rendered output —');
// ====================================================================

const deps = {
  Link: ({ to, children, ...rest }) => h('a', { ...rest, href: to }, children),
  Icon: () => h('span'),
  getHomepageSnapshot: () => ({}),
  subscribeHomepage: () => () => {},
  // Explicitly enabled: an unconfigured category is OFF now, so a render test
  // has to publish the category the same way an owner would.
  categoryConfig: (slug) => sanitizeCategoryConfig({ enabled: true }, slug),
  resolveSpotlightItems, spotlightVisible, visibleWindow, wrapIndex,
};

test('P2b a 100-product pool still mounts exactly THREE seats', () => {
  // The whole justification for removing the caps: pool depth and DOM cost are
  // independent. Rendered against 100 real eligible products, not a stub.
  const hundred = Array.from({ length: 100 }, (_, i) => mk({ slug: `p${i}`, id: `p${i}`, name: `Product ${i}` }));
  const cfg = sanitizeCategoryConfig({ enabled: true }, 'hair-care');
  const pool = resolveSpotlightItems('hair-care', { config: cfg, productList: hundred });
  assert.equal(pool.length, 100, 'the pool is the whole category');

  const Spotlight = component('../src/components/category/CategorySpotlight.jsx', 'CategorySpotlight', deps);
  const html = renderToStaticMarkup(h(Spotlight, {
    category: { slug: 'hair-care', name: 'Hair Care' }, products: hundred,
  }));
  assert.equal((html.match(/cspot__seat--/g) || []).length, 3, 'three seats, never a hundred');
  assert.equal((html.match(/cspot__seat--active/g) || []).length, 1);

  // And exactly three images — no burst fetch of the pool.
  assert.equal((html.match(/<img/g) || []).length, 3, 'only three product images are requested');
  // The only eager one is the active product; the neighbours are lazy.
  assert.equal((html.match(/loading="eager"/g) || []).length, 1);
  assert.equal((html.match(/loading="lazy"/g) || []).length, 2);
  // Nothing preloads the pool.
  assert.doesNotMatch(html, /rel="preload"/);
});

test('R0b a deep pool shows a position readout, keeping the arrows reachable', () => {
  const Spotlight = component('../src/components/category/CategorySpotlight.jsx', 'CategorySpotlight', deps);

  // Small pool: pips, as before.
  const small = renderToStaticMarkup(h(Spotlight, {
    category: { slug: 'hair-care', name: 'Hair Care' }, products: HAIR,
  }));
  assert.equal((small.match(/cspot__pip"/g) || []).length + (small.match(/cspot__pip /g) || []).length > 0, true,
    'four products still get pips');
  assert.doesNotMatch(small, /cspot__position/);

  // Deep pool: one readout instead of 43 pips. Measured live, 43 pips came to
  // 812px inside a 358px row and pushed BOTH arrows off a 390px screen.
  const many = Array.from({ length: 43 }, (_, i) => mk({ slug: `p${i}`, id: `p${i}`, name: `Product ${i}` }));
  const deep = renderToStaticMarkup(h(Spotlight, {
    category: { slug: 'hair-care', name: 'Hair Care' }, products: many,
  }));
  assert.doesNotMatch(deep, /cspot__pip/, 'no pip strip for a deep pool');
  assert.match(deep, /cspot__position[^>]*>1 \/ 43</, 'a compact "1 / 43" instead');
  // The arrows are still rendered — that is what the readout protects.
  assert.match(deep, /aria-label="Previous product"/);
  assert.match(deep, /aria-label="Next product"/);
  // And the pool is genuinely 43 deep while only three seats are mounted.
  assert.equal((deep.match(/cspot__seat--/g) || []).length, 3);
});

test('G1 an UNCONFIGURED category shows no spotlight at all', () => {
  // The launch gate. Deploying this feature must not light up every category
  // using whatever catalogue images happen to exist.
  const cfg = sanitizeCategoryConfig({}, 'hair-care');
  assert.equal(cfg.enabled, false, 'no configuration means off');
  const items = resolveSpotlightItems('hair-care', { config: cfg, productList: HAIR });
  assert.equal(items.length, 4, 'the pool still resolves…');
  assert.equal(spotlightVisible('hair-care', items, cfg), false, '…but nothing is published');

  const Spotlight = component('../src/components/category/CategorySpotlight.jsx', 'CategorySpotlight', {
    ...deps, categoryConfig: () => cfg,
  });
  const html = renderToStaticMarkup(h(Spotlight, {
    category: { slug: 'hair-care', name: 'Hair Care' }, products: HAIR,
  }));
  assert.equal(html, '', 'the category page is exactly as it was before the feature');
});

test('G2 enabled:false shows no spotlight, however much is configured', () => {
  const cfg = sanitizeCategoryConfig({
    enabled: false,
    items: [{ productSlug: 'shampoo-a', spotlightImage: '/img/a.png' }],
  }, 'hair-care');
  const items = resolveSpotlightItems('hair-care', { config: cfg, productList: HAIR });
  assert.equal(items.length, 1, 'the curated item resolves');
  assert.equal(spotlightVisible('hair-care', items, cfg), false, 'and is still not published');

  const Spotlight = component('../src/components/category/CategorySpotlight.jsx', 'CategorySpotlight', {
    ...deps, categoryConfig: () => cfg,
  });
  assert.equal(
    renderToStaticMarkup(h(Spotlight, { category: { slug: 'hair-care', name: 'Hair Care' }, products: HAIR })),
    '', 'nothing renders');
  // Admin can tell this apart from "nothing configured".
  assert.equal(categoryIsReadyButOff(cfg), true, 'READY — NOT LIVE');
  assert.equal(categoryIsReadyButOff(sanitizeCategoryConfig({}, 'hair-care')), false, 'vs nothing configured');
});

test('G3 enabled:true with NO curated items uses the uncapped fallback', () => {
  const cfg = sanitizeCategoryConfig({ enabled: true }, 'hair-care');
  assert.equal(cfg.items.length, 0);
  const items = resolveSpotlightItems('hair-care', { config: cfg, productList: HAIR });
  assert.deepEqual(items.map((i) => i.productSlug), ['shampoo-a', 'oil-b', 'mask-c', 'serum-d']);
  assert.equal(spotlightVisible('hair-care', items, cfg), true);

  // Still uncapped once published.
  const many = Array.from({ length: 46 }, (_, i) => mk({ slug: `w${i}`, id: `w${i}` }));
  assert.equal(resolveSpotlightItems('hair-care', { config: cfg, productList: many }).length, 46);
  const hundred = Array.from({ length: 100 }, (_, i) => mk({ slug: `p${i}`, id: `p${i}` }));
  const pool = resolveSpotlightItems('hair-care', { config: cfg, productList: hundred });
  assert.equal(pool.length, 100);
  // And a 100-deep published pool still mounts three seats.
  const Spotlight = component('../src/components/category/CategorySpotlight.jsx', 'CategorySpotlight', {
    ...deps, categoryConfig: () => cfg,
  });
  const html = renderToStaticMarkup(h(Spotlight, {
    category: { slug: 'hair-care', name: 'Hair Care' }, products: hundred,
  }));
  assert.equal((html.match(/cspot__seat--/g) || []).length, 3);
  assert.equal((html.match(/<img/g) || []).length, 3);
});

test('G4 enabled:true with curated items uses the curated pool', () => {
  const cfg = sanitizeCategoryConfig({
    enabled: true,
    items: [{ productSlug: 'mask-c' }, { productSlug: 'shampoo-a' }],
  }, 'hair-care');
  const items = resolveSpotlightItems('hair-care', { config: cfg, productList: HAIR });
  assert.deepEqual(items.map((i) => i.productSlug), ['mask-c', 'shampoo-a'], 'curated order wins');
  assert.equal(spotlightVisible('hair-care', items, cfg), true);
});

test('G5 an all-default (off, empty) category is not persisted at all', () => {
  const payload = categoryExperiencePayload({ 'hair-care': sanitizeCategoryConfig({}, 'hair-care') });
  assert.deepEqual(payload.categories, {}, 'an absent key and a pristine one mean the same thing');
  // Switching it on IS meaningful, so it is written.
  const on = categoryExperiencePayload({ 'hair-care': sanitizeCategoryConfig({ enabled: true }, 'hair-care') });
  assert.equal(on.categories['hair-care'].enabled, true);
  // So is having items while still off.
  const off = categoryExperiencePayload({
    'hair-care': sanitizeCategoryConfig({ items: [{ productSlug: 'shampoo-a' }] }, 'hair-care'),
  });
  assert.equal(off.categories['hair-care'].enabled, false, 'items are kept, publish state is not invented');
  assert.equal(off.categories['hair-care'].items.length, 1);
});

test('G6 admin preview renders a disabled category without publishing it', () => {
  const cfg = sanitizeCategoryConfig({
    enabled: false, items: [{ productSlug: 'shampoo-a' }],
  }, 'hair-care');
  const Spotlight = component('../src/components/category/CategorySpotlight.jsx', 'CategorySpotlight', deps);
  const args = { category: { slug: 'hair-care', name: 'Hair Care' }, products: HAIR, configOverride: cfg };

  assert.equal(renderToStaticMarkup(h(Spotlight, args)), '', 'the storefront still shows nothing');
  const previewed = renderToStaticMarkup(h(Spotlight, { ...args, preview: true }));
  assert.match(previewed, /Shampoo A/, 'preview shows it');
  assert.match(previewed, /cspot__seat--active/);

  // Preview reuses the real component — there is no second implementation.
  const page = code('../src/admin/pages/CategoryExperience.jsx');
  assert.match(page, /<CategorySpotlight/, 'admin mounts the real stage');
  assert.match(page, /configOverride=\{cfg\}/, 'with the configuration being edited');
  assert.match(page, /preview$/m, 'in preview mode');
});

test('T1 MANUAL theme beats the auto-generated one', () => {
  // The owner's decision always wins. A re-import refreshes autoTheme, so if
  // auto could override manual, every re-import would silently repaint colours
  // somebody had chosen by hand.
  const cfg = sanitizeCategoryConfig({
    enabled: true,
    theme: { background: '#111111', gradient: '' },
    items: [{
      productSlug: 'shampoo-a',
      background: '#ABCDEF',
      gradient: 'linear-gradient(168deg, #ABCDEF 0%, #123456 100%)',
      autoTheme: { background: '#FFEEDD', gradient: 'linear-gradient(168deg, #FFEEDD 0%, #FFCCBB 100%)' },
    }],
  }, 'hair-care');
  const [slide] = resolveSpotlightItems('hair-care', { config: cfg, productList: HAIR });
  assert.equal(slide.theme.background, '#ABCDEF', 'manual background wins');
  assert.match(slide.theme.gradient, /#ABCDEF/, 'and so does the manual gradient');

  // A manual background with no manual gradient must not inherit the auto or
  // category gradient underneath it — that would tint the owner's colour.
  const bgOnly = sanitizeCategoryConfig({
    enabled: true,
    items: [{
      productSlug: 'shampoo-a',
      background: '#ABCDEF',
      autoTheme: { background: '#FFEEDD', gradient: 'linear-gradient(168deg, #FFEEDD 0%, #FFCCBB 100%)' },
    }],
  }, 'hair-care');
  const [plain] = resolveSpotlightItems('hair-care', { config: bgOnly, productList: HAIR });
  assert.equal(plain.theme.background, '#ABCDEF');
  assert.equal(plain.theme.gradient, '', 'a manual colour stands on its own');
});

test('T2 AUTO theme beats the category fallback', () => {
  const cfg = sanitizeCategoryConfig({
    enabled: true,
    theme: { background: '#111111', gradient: 'linear-gradient(168deg, #111111 0%, #222222 100%)' },
    items: [{
      productSlug: 'shampoo-a',
      autoTheme: { background: '#F7EBD7', gradient: 'linear-gradient(168deg, #F8F0E1 0%, #F4E2C4 100%)' },
    }],
  }, 'hair-care');
  const [slide] = resolveSpotlightItems('hair-care', { config: cfg, productList: HAIR });
  assert.equal(slide.theme.background, '#F7EBD7', 'the generated colour is used');
  assert.match(slide.theme.gradient, /#F8F0E1/, 'with its own generated gradient');
});

test('T3 with neither, the category theme still supplies the background', () => {
  const cfg = sanitizeCategoryConfig({
    enabled: true,
    theme: { background: '#EFE9F1', gradient: 'linear-gradient(168deg, #F4EFF5 0%, #E6DCEA 100%)' },
    items: [{ productSlug: 'shampoo-a' }],
  }, 'hair-care');
  const [slide] = resolveSpotlightItems('hair-care', { config: cfg, productList: HAIR });
  assert.equal(slide.theme.background, '#EFE9F1');
  assert.match(slide.theme.gradient, /#F4EFF5/);
  // An unconfigured product falls all the way back to the category tone.
  const auto = sanitizeCategoryConfig({ enabled: true }, 'hair-care');
  const [fallback] = resolveSpotlightItems('hair-care', { config: auto, productList: HAIR });
  assert.equal(fallback.theme.background, categoryToneTheme('hair-care').background);
});

test('T4 each slide carries its OWN theme, so the background changes on advance', () => {
  // The stage reads the active slide's theme into --cspot-bg. If every slide
  // resolved to the same colour the transition would be invisible.
  const cfg = sanitizeCategoryConfig({
    enabled: true,
    items: [
      { productSlug: 'shampoo-a', autoTheme: { background: '#F7EBD7', gradient: '' } },
      { productSlug: 'oil-b', autoTheme: { background: '#E9ECD9', gradient: '' } },
      { productSlug: 'mask-c', autoTheme: { background: '#F6E7DE', gradient: '' } },
    ],
  }, 'hair-care');
  const items = resolveSpotlightItems('hair-care', { config: cfg, productList: HAIR });
  const backgrounds = items.map((i) => i.theme.background);
  assert.deepEqual(backgrounds, ['#F7EBD7', '#E9ECD9', '#F6E7DE']);
  assert.equal(new Set(backgrounds).size, 3, 'three distinct grounds');

  // The active theme remains authoritative for both paint layers.
  const cmp = code('../src/components/category/CategorySpotlight.jsx');
  assert.match(cmp, /'--cspot-bg': active\.theme\.background/);
  assert.match(cmp, /'--cspot-grad': active\.theme\.gradient/);
  const css = code('../src/styles/category-spotlight.css');
  assert.match(css, /animation: cspot-field-in var\(--cspot-dur\)/,
    'the incoming paint layer carries the gradient change');
});

test('T5 a malformed auto theme cannot reach the DOM', () => {
  const item = sanitizeSpotlightItem({
    productSlug: 'x',
    autoTheme: { background: 'url(evil)', gradient: 'linear-gradient(#fff, url(x))' },
  });
  assert.equal(item.autoTheme.background, '', 'the same colour policy applies to generated values');
  assert.equal(item.autoTheme.gradient, '');
  // A missing autoTheme is normalised to empty strings, never undefined.
  assert.deepEqual(sanitizeSpotlightItem({ productSlug: 'x' }).autoTheme, { background: '', gradient: '' });
});

test('F1 per-item fit is stored, bounded and defaulted', () => {
  const of = (raw) => sanitizeSpotlightItem({ productSlug: 'x', ...raw });
  assert.equal(of({}).visualScale, DEFAULT_ITEM_SCALE, 'defaults to 1x');
  assert.equal(of({}).verticalOffset, 0);
  assert.equal(of({ visualScale: 1.2, verticalOffset: -18 }).visualScale, 1.2);
  assert.equal(of({ visualScale: 1.2, verticalOffset: -18 }).verticalOffset, -18);
  // Bounded: a stored value can adjust the shot, never launch it off the stage.
  assert.equal(of({ visualScale: 99 }).visualScale, MAX_ITEM_SCALE);
  assert.equal(of({ visualScale: 0.01 }).visualScale, MIN_ITEM_SCALE);
  assert.equal(of({ verticalOffset: 9999 }).verticalOffset, ITEM_OFFSET_LIMIT);
  assert.equal(of({ verticalOffset: -9999 }).verticalOffset, -ITEM_OFFSET_LIMIT);
  // Junk falls back rather than reaching a style attribute.
  for (const bad of ['big', null, undefined, NaN, Infinity, {}]) {
    assert.equal(of({ visualScale: bad }).visualScale, DEFAULT_ITEM_SCALE);
    assert.equal(of({ verticalOffset: bad }).verticalOffset, 0);
  }
});

test('F2 fit reaches the IMAGE, never the seat whose transform is the animation', () => {
  const cfg = sanitizeCategoryConfig({
    enabled: true,
    items: [{ productSlug: 'shampoo-a', visualScale: 1.25, verticalOffset: -20 }],
  }, 'hair-care');
  const [slide] = resolveSpotlightItems('hair-care', { config: cfg, productList: HAIR });
  assert.equal(slide.visualScale, 1.25);
  assert.equal(slide.verticalOffset, -20);

  const Spotlight = component('../src/components/category/CategorySpotlight.jsx', 'CategorySpotlight', {
    ...deps, categoryConfig: () => cfg,
  });
  const html = renderToStaticMarkup(h(Spotlight, {
    category: { slug: 'hair-care', name: 'Hair Care' }, products: HAIR,
  }));
  // Emitted as custom properties on the seat…
  assert.match(html, /--cspot-item-scale:1\.25/);
  assert.match(html, /--cspot-item-y:-20px/);
  // …and the seat's own transform is untouched by them.
  const cmp = code('../src/components/category/CategorySpotlight.jsx');
  assert.doesNotMatch(cmp, /transform:\s*[`'"]/, 'the component sets no transform of its own');

  // The CSS applies them to the image, and the seat rule still owns the
  // animation transform.
  const css = code('../src/styles/category-spotlight.css');
  const img = css.slice(css.indexOf('.cspot__img {'), css.indexOf('.cspot__img--framed'));
  assert.match(img, /transform: translateY\(var\(--cspot-item-y\)\) scale\(var\(--cspot-item-scale\)\)/);
  const seat = css.slice(css.indexOf('.cspot__seat {'), css.indexOf('.cspot__seat--prev'));
  assert.doesNotMatch(seat, /--cspot-item/, 'the seat never reads the per-item values');
  assert.match(seat, /transition:[\s\S]*?transform var\(--cspot-dur\)/, 'and keeps its animation');
  // The per-item transform must never be transitioned.
  assert.doesNotMatch(img, /transition/);
});

test('F4 a packshot can never exceed its seat, whatever its aspect ratio', () => {
  // The bug this pins: with `width: auto; height: 100%` the percentage height
  // did not bind for portrait sources. A 347x851 bottle resolved to 615px
  // inside a 288px box and rendered 394px tall in a 184px side seat — the side
  // products came out LARGER than the active one and covered the product
  // title, the size chip and the CTA.
  const css = code('../src/styles/category-spotlight.css');
  const shot = css.slice(css.indexOf('.cspot__shot {'), css.indexOf('.cspot__shot--link'));
  assert.match(shot, /position: relative/, 'the shot is the positioning context');
  assert.match(shot, /height: var\(--cspot-shot-h\)/, 'and has a definite height');

  const img = css.slice(css.indexOf('.cspot__img {'), css.indexOf('.cspot__img--framed'));
  assert.match(img, /position: absolute/, 'the image is placed against that box');
  assert.match(img, /inset: 0/);
  assert.match(img, /width: 100%/);
  assert.match(img, /height: 100%/);
  assert.match(img, /object-fit: contain/, 'so it letterboxes rather than overflowing');
  // The aspect-dependent sizing that caused the bug must not come back.
  assert.doesNotMatch(img, /width: auto/, 'auto width reintroduces aspect-dependent sizing');
});

test('F3 the colour field ends within the product stage, before the metadata', () => {
  const css = code('../src/styles/category-spotlight.css');
  const base = css.slice(css.indexOf('.cspot {'), css.indexOf('.cspot__backdrop {'));
  const stageHeight = Number(base.match(/--cspot-h:\s*(\d+)px/)[1]);
  const fieldHeight = Number(base.match(/--cspot-arc-h:\s*(\d+)px/)[1]);
  assert.ok(fieldHeight < stageHeight, 'the packshots cross the field onto the page ground');
  assert.match(base, /container-type: inline-size/, 'preview width owns the mobile geometry');
  assert.match(base, /--cspot-side-x: [\d.]+cqw/, 'neighbours follow the preview container, not the browser');
  assert.match(base, /background: transparent/);
  const meta = css.slice(css.indexOf('.cspot__meta {'), css.indexOf('@keyframes cspot-meta-in'));
  assert.doesNotMatch(meta, /position: absolute/, 'long titles can expand without overlapping controls');
});

test('F5 gradients really cross-fade using two paint layers without extra images', () => {
  const Spotlight = component('../src/components/category/CategorySpotlight.jsx', 'CategorySpotlight', deps);
  const html = renderToStaticMarkup(h(Spotlight, {
    category: { slug: 'hair-care', name: 'Hair Care' }, products: HAIR,
  }));
  assert.match(html, /cspot__backdrop/);
  assert.equal((html.match(/<img/g) || []).length, 3);
  const css = code('../src/styles/category-spotlight.css');
  assert.match(css, /border-radius: 0 0 50% 50%/);
  assert.match(css, /cspot__bg--incoming \{ animation: cspot-field-in/);
  assert.doesNotMatch(css, /transition: background var/, 'gradient strings cannot be interpolated');
});

test('F5b price and size are catalogue facts, and autoplay has an explicit pause control', () => {
  const Spotlight = component('../src/components/category/CategorySpotlight.jsx', 'CategorySpotlight', deps);
  const html = renderToStaticMarkup(h(Spotlight, {
    category: { slug: 'hair-care', name: 'Hair Care' }, products: HAIR,
  }));
  assert.match(html, /cspot__price[^>]*>₹100</);
  assert.match(html, /Pause automatic rotation/);
  assert.match(html, /Swipe to explore/);
});

test('F6 secondary type on the dome uses the spotlight ink, not the page grey', () => {
  // The page greys are tuned for the ivory page ground. With the grounds now
  // carrying real colour, --slv2-ink-4 (#6B7168) measures 2.6:1 against the
  // deepest of them, below AA. Every muted label inside the spotlight must
  // read the local darker token instead.
  const css = code('../src/styles/category-spotlight.css');
  const spotlight = css.slice(0, css.indexOf('.v2-shop--spotlit'));
  assert.match(css, /--cspot-ink-mute: #[0-9A-F]{6};/, 'the token exists');
  assert.doesNotMatch(spotlight, /--slv2-ink-4/,
    'no spotlight rule may fall back to the page grey while sitting on colour');
  assert.doesNotMatch(spotlight, /--slv2-ink-3/,
    'nor to the mid grey, for the same reason');
  // The active product name keeps the full-strength ink.
  const name = css.slice(css.indexOf('.cspot__name {'), css.indexOf('.cspot__facts {'));
  assert.match(name, /--slv2-ink,/, 'the product name keeps the primary ink');
});

test('R1 the stage renders three seats, one active, with real product copy', () => {
  const Spotlight = component('../src/components/category/CategorySpotlight.jsx', 'CategorySpotlight', deps);
  const html = renderToStaticMarkup(h(Spotlight, {
    category: { slug: 'hair-care', name: 'Hair Care' }, products: HAIR,
  }));
  assert.equal((html.match(/cspot__seat--/g) || []).length, 3, 'three seats, never four');
  assert.equal((html.match(/cspot__seat--active/g) || []).length, 1);
  assert.match(html, /<h2[^>]*cspot__name[^>]*>Shampoo A<\/h2>/, 'the product name is an h2');
  assert.match(html, /href="\/product\/shampoo-a"/, 'the active product links to its PDP');
  assert.match(html, /View product/, 'and has an explicit CTA');
  assert.match(html, /Hair Care/, 'the category eyebrow');
});

test('R2 a side product is a button that selects, not a link that navigates', () => {
  const Spotlight = component('../src/components/category/CategorySpotlight.jsx', 'CategorySpotlight', deps);
  const html = renderToStaticMarkup(h(Spotlight, {
    category: { slug: 'hair-care', name: 'Hair Care' }, products: HAIR,
  }));
  const prev = html.slice(html.indexOf('cspot__seat--prev'), html.indexOf('cspot__seat--active'));
  assert.match(prev, /<button/, 'the side seat is a button');
  assert.doesNotMatch(prev, /<a /, 'tapping a side product must not navigate away');
  assert.match(prev, /aria-label="Show /, 'it says what it will do');
});

test('R3 a single eligible product renders a static stage with no controls', () => {
  const Spotlight = component('../src/components/category/CategorySpotlight.jsx', 'CategorySpotlight', deps);
  const html = renderToStaticMarkup(h(Spotlight, {
    category: { slug: 'hair-care', name: 'Hair Care' }, products: [A],
  }));
  assert.equal((html.match(/cspot__seat--/g) || []).length, 1);
  assert.doesNotMatch(html, /Next product/, 'no arrows for a single item');
  assert.match(html, /Shampoo A/);
});

test('R4 no eligible products means no stage at all', () => {
  const Spotlight = component('../src/components/category/CategorySpotlight.jsx', 'CategorySpotlight', deps);
  const html = renderToStaticMarkup(h(Spotlight, {
    category: { slug: 'hair-care', name: 'Hair Care' }, products: [{ ...A, stock: 0 }],
  }));
  assert.equal(html, '', 'the category page is left exactly as it was');
});

test('R5 the category page keeps one h1 and still mounts ProductBrowser', () => {
  const page = code('../src/pages/Category.jsx');
  assert.equal((page.match(/<h1/g) || []).length, 1, 'the category name stays the only h1');
  assert.match(page, /<CategorySpotlight category=\{cat\} products=\{items\} categoryPage \/>/);
  // ProductBrowser is mounted unchanged — the filter row, URL state and grid
  // are still entirely its business.
  assert.match(page, /<ProductBrowser baseProducts=\{items\} lockCategory showCategoryFilter=\{false\} \/>/);
});

test('R6 ProductBrowser was not modified by this feature', () => {
  const browser = code('../src/components/ProductBrowser.jsx');
  assert.doesNotMatch(browser, /cspot|CategorySpotlight|categoryExperience/,
    'the spotlight must not have leaked into the browser');
  // The compact filter/sort row the category page relies on still lives here.
  assert.match(browser, /Open filters/);
  assert.match(browser, /Sort by/);
  assert.doesNotMatch(browser, /Bestseller|Top rated/i, 'no fake highlights reintroduced');
});

// ====================================================================
console.log('\n— Admin —');
// ====================================================================

test('AD1 the picker offers only sellable products from the chosen category', () => {
  const admin = code('../src/admin/pages/CategoryExperience.jsx');
  assert.match(admin, /\.filter\(\(p\) => \(p\.categories \|\| \[p\.category\]\)\.includes\(slug\)\)/);
  assert.match(admin, /\.filter\(isSpotlightEligible\)/);
  assert.match(admin, /available = eligible\.filter\(\(p\) => !chosen\.has\(p\.slug\)\)/,
    'and never offers a duplicate');
});

test('AD2 items carry stable ids and can be reordered', () => {
  const admin = code('../src/admin/pages/CategoryExperience.jsx');
  assert.match(admin, /makeSpotlightId\(productSlug, cfg\.items\.map\(\(i\) => i\.id\)\)/);
  assert.match(admin, /Move up/);
  assert.match(admin, /Move down/);
  // Ids are stable and unique without any new dependency.
  assert.equal(makeSpotlightId('shampoo-a'), 'shampoo-a');
  assert.equal(makeSpotlightId('shampoo-a', ['shampoo-a']), 'shampoo-a-2');
  const pkg = JSON.parse(src('../package.json'));
  const deps2 = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const banned of ['framer-motion', 'react-beautiful-dnd', 'dnd-kit', '@dnd-kit/core', 'gsap', 'three']) {
    assert.ok(!deps2[banned], `${banned} must not have been added`);
  }
});

test('AD3 the admin route and nav entry exist', () => {
  const app = code('../src/App.jsx');
  assert.match(app, /<Route path="category-experience" element=\{<CategoryExperience \/>\} \/>/);
  assert.match(code('../src/admin/AdminLayout.jsx'), /\/admin\/category-experience/);
});

test('AD4 stored config is bounded', () => {
  // 50 curated items are kept in full: there is no merchandising cap.
  const many = sanitizeCategoryConfig({
    items: Array.from({ length: 50 }, (_, i) => ({ productSlug: `p${i}` })),
  }, 'hair-care');
  assert.equal(many.items.length, 50, 'a curated list is not truncated');
  // A structural ceiling still guards the settings row against a malformed or
  // hostile value. It sits far above the whole catalogue, so no real category
  // can reach it.
  const absurd = sanitizeCategoryConfig({
    items: Array.from({ length: MAX_STORED_ITEMS + 40 }, (_, i) => ({ productSlug: `p${i}` })),
  }, 'hair-care');
  assert.equal(absurd.items.length, MAX_STORED_ITEMS);
  assert.ok(MAX_STORED_ITEMS > 164, 'the bound must exceed the entire catalogue');
  const item = sanitizeSpotlightItem({ productSlug: 'x', headline: 'h'.repeat(500), subline: 's'.repeat(500) });
  assert.ok(item.headline.length <= 60);
  assert.ok(item.subline.length <= 90);
  assert.equal(sanitizeSpotlightItem({ headline: 'orphan' }), null, 'an item with no product is not an item');
  // Unknown categories are dropped on the way in as well as on the way out.
  const norm = normalizeCategoryExperience({ categories: { 'not-real': { enabled: false } } });
  assert.deepEqual(norm.categories, {});
});

test('MC1 mobile heading is generic, with a real navigation link and the gate intact', () => {
  const Spotlight = component('../src/components/category/CategorySpotlight.jsx', 'CategorySpotlight', deps);
  for (const name of ['Wellness', 'Juices & Drinks', 'Everyday Personal Care Essentials']) {
    const html = renderToStaticMarkup(h(Spotlight, {
      category: { slug: 'hair-care', name }, products: HAIR, categoryPage: true,
    }));
    assert.match(html, /cspot--category-page/);
    assert.match(html, /<h1 class="cspot__category-name">/);
    assert.ok(html.includes(name.replaceAll('&', '&amp;')), 'the heading uses category data');
    assert.match(html, /href="\/shop"[^>]*|aria-label="Back to all products"/);
    assert.equal((html.match(/<img/g) || []).length, 3);
  }
  const css = code('../src/styles/category-spotlight.css');
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*:has\(> \.cspot--category-page\)/,
    'mobile header removal requires an actually rendered spotlight');
  assert.match(css, /\.cspot__category-nav \{ display: none; \}/, 'larger layouts retain the original opening');
});

test('MC2 mobile auto themes are darker, readable and leave source/manual themes untouched', () => {
  const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  for (const background of ['#ACD46B', '#EA849A', '#D49452', '#D1B3EF', '#80B9D0', '#C0C0C0']) {
    const source = Object.freeze({ background, gradient: '' });
    const mobile = mobileSpotlightTheme(source, true);
    assert.ok(lum(mobile.background) < lum(background), 'stored auto colour is deepened for mobile');
    assert.equal(mobile.ink, '#FFFFFF');
    for (const stop of mobile.gradient.match(/#[0-9A-F]{6}/g)) {
      assert.ok(1.05 / (lum(stop) + 0.05) >= 4.5, 'white heading clears AA at every gradient stop');
    }
    assert.equal(source.background, background, 'stored source is never rewritten');
    assert.deepEqual(mobileSpotlightTheme(source, false), { ...source, ink: '#16211B' }, 'manual theme values are preserved');
  }
  assert.equal(mobileSpotlightTheme({ background: '#000000', gradient: '' }, false).ink, '#FFFFFF');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
