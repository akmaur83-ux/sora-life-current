// Offline, Homepage-only regression checks. No network or catalogue writes.
//
// This file used to check CategoryRail.jsx and the v2 hero's stylesheet. No
// page rendered either any more: the round "Explore the stores" circles
// (HomeStorefront.jsx) replaced the rail and the static hero replaced the
// carousel. The rail and every rule written only for them were deleted, so
// these checks now keep them deleted and the homepage stylesheets sound.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const SHEETS = ['v2-home', 'home', 'v2-home-marketplace', 'homepage-appearance', 'storefront-motion', 'storefront-refinements'];
const sheets = Object.fromEntries(SHEETS.map((n) => [n, read(`../src/styles/${n}.css`)]));
const rules = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };

console.log('\n— Retired homepage pieces —');

check('the unused category rail and the hero stylesheet stay deleted', () => {
  assert.ok(!existsSync(new URL('../src/components/CategoryRail.jsx', import.meta.url)));
  assert.ok(!existsSync(new URL('../src/styles/hero-cta.css', import.meta.url)));
  assert.doesNotMatch(read('../build/build-css.mjs'), /hero-cta\.css/, 'and the CSS build no longer lists it');
});

check('no homepage rule styles the retired rail or carousel', () => {
  for (const [name, css] of Object.entries(sheets)) {
    assert.doesNotMatch(rules(css), /\.(v2-cats?|v2-cat__[a-z-]+|v2-cats-[a-z]+|v2-hero(__[a-z-]+|--[a-z-]+)?|hm-hero__[a-z-]+|hp-category-strip[a-z_-]*|hero-cta[a-z_-]*)(?![A-Za-z0-9_-])/, `${name}.css`);
  }
});

console.log('\n— Homepage stylesheets —');

check('stylesheet braces stay balanced', () => {
  for (const [name, css] of Object.entries(sheets)) {
    let depth = 0;
    for (const c of rules(css)) {
      if (c === '{') depth++;
      if (c === '}') { depth--; assert.ok(depth >= 0, `${name}.css: unexpected closing brace`); }
    }
    assert.equal(depth, 0, `${name}.css`);
  }
});

check('the animations deleted with them are named by no remaining rule', () => {
  const all = Object.values(sheets).map(rules).join('\n');
  for (const name of ['heroKenBurns', 'sl-cinema', 'sl-copy-rise', 'v2CategoryMarquee']) {
    assert.doesNotMatch(all, new RegExp(`\\b${name}\\b`), name);
  }
});

console.log(`\n${passed} passed, 0 failed`);
