// Offline, Homepage-only regression checks. No network or catalogue writes.
//
// This file used to eval a `categoryRepresentative` helper out of
// CategoryRail.jsx, which picked a representative PRODUCT image per
// category. That approach was retired in 5b33bac ("use admin category
// images"): the rail now renders an explicitly configured category image
// (admin-supplied, falling back to a bundled asset) and never borrows a
// product photo. The assertions below track the CURRENT implementation —
// they were not relaxed to make the old ones pass.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const rail = read('../src/components/CategoryRail.jsx');
const css = read('../src/styles/v2-home.css');

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };

console.log('\n— Category rail sourcing —');

check('category art is configured, never borrowed from a product', () => {
  // The rail must not reach into the catalogue for imagery.
  assert.doesNotMatch(rail, /categoryRepresentative|products\b|stock|sortOrder/);
  assert.match(rail, /const CATEGORY_IMAGES = \{/);
});

check('every category slug has a bundled fallback image', () => {
  const slugs = [...rail.matchAll(/^\s{2}'?([a-z-]+)'?:\s*'\/public\/category-images\//gm)].map((m) => m[1]);
  assert.equal(slugs.length, 9, `expected 9 mapped slugs, got ${slugs.length}`);
  for (const slug of ['wellness', 'skin-care', 'hair-care', 'juices-drinks', 'supplements']) {
    assert.ok(slugs.includes(slug), `missing fallback for ${slug}`);
  }
});

check('admin-supplied image wins over the bundled fallback', () => {
  assert.match(rail, /c\.image \|\| c\.image_url \|\| CATEGORY_IMAGES\[c\.slug\]/);
});

check('a broken image hides itself rather than showing a broken icon', () => {
  assert.match(rail, /onError=\{\(e\) => \{\s*e\.currentTarget\.style\.display = 'none';/);
  assert.match(rail, /loading="lazy"/);
});

check('the rail stays navigation-only — no price, rating or cart affordance', () => {
  assert.doesNotMatch(rail, /price|rating|Add to cart/i);
});

check('the marquee duplicate set is hidden from assistive tech', () => {
  assert.match(rail, /aria-hidden=\{duplicate \? 'true' : undefined\}/);
  assert.match(rail, /tabIndex=\{duplicate \? -1 : undefined\}/);
  assert.match(rail, /aria-label="Shop by category"/);
});

check('the rail renders nothing when there are too few categories', () => {
  assert.match(rail, /if \(items\.length < 3\) return null;/);
});

check('categories without an icon fall back to initials', () => {
  assert.match(rail, /v2-cat__initials/);
  assert.match(rail, /category\.name\.split\(\/\\s\+\/\)\.map\(\(s\) => s\[0\]\)/);
});

console.log('\n— Homepage stylesheet —');

check('stylesheet braces stay balanced', () => {
  let depth = 0;
  for (const c of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (c === '{') depth++;
    if (c === '}') { depth--; assert.ok(depth >= 0, 'unexpected closing brace'); }
  }
  assert.equal(depth, 0);
});

check('the mobile landscape ratio is shared by both hero modes', () => {
  // One for .v2-hero__media, one for .v2-hero__stage.
  assert.equal((css.match(/aspect-ratio:358 \/ 200/g) || []).length, 2);
});

check('category photos are hidden by default and revealed on the home rail', () => {
  assert.match(css, /\.v2-cat__photo \{ display:none; \}/);
  assert.match(css, /\.v2-home \.v2-cat__photo \{ display:block;/);
});

check('a category photo replaces the icon tile rather than stacking on it', () => {
  assert.match(css, /\.v2-home \.v2-cat__visual:has\(\.v2-cat__photo[^)]*\) \.v2-cat__tile \{ display:none; \}/);
});

console.log(`\n${passed} passed, 0 failed`);
