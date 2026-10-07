// ============================================================
// Admin "info" banners must not inherit the storefront's info-page wrapper.
//
//   node scripts/test-admin-banner-info.mjs
//
// src/styles/info.css gives `.info` — the About/Privacy/… page wrapper — a
// min-height of 60vh, its own padding and font. It is in public/app.css,
// which loads on every route, admin included. Coupons, Dashboard and
// Promotions mark their notices `adm-banner info`, so each rendered as a box
// at least 60% of the screen tall (540 px at 1280×900, measured in Chrome).
// admin.css now undoes those three properties on `.adm-banner.info`
// (specificity 0,2,0 — it wins whatever order the sheets load in).
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (e) { failed += 1; console.error(`FAIL ${name}\n${e.stack}`); }
}
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const rule = (css, selector) => {
  const at = css.indexOf(`${selector} {`);
  return at < 0 ? null : css.slice(at, css.indexOf('}', at) + 1);
};

test('the cause is still there: the storefront\'s .info sets a min-height, padding and font', () => {
  const info = rule(read('src/styles/info.css'), '.info');
  assert.ok(info, '.info rule present');
  for (const prop of ['min-height:', 'padding:', 'font-family:']) assert.ok(info.includes(prop), prop);
  assert.ok(read('build/build-css.mjs').includes("'src/styles/info.css'"), 'and it is bundled into the render-blocking app.css');
});

test('.adm-banner.info undoes all three', () => {
  const banner = rule(read('src/admin/admin.css'), '.adm-banner.info');
  assert.ok(banner, '.adm-banner.info rule present');
  assert.match(banner, /min-height:\s*0;/);
  assert.match(banner, /padding:\s*14px 18px;/, 'the same padding as .adm-banner');
  assert.match(banner, /font-family:\s*inherit;/);
});

test('the pages that use it are the ones the fix was verified on', () => {
  for (const page of ['Coupons', 'Dashboard', 'Promotions']) assert.match(read(`src/admin/pages/${page}.jsx`), /className="adm-banner info"/, page);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
