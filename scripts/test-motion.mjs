// Round 37 (owner, 2026-11-21: "animations add kro … sab add kro"): the twenty movements —
// reveal on scroll, card stagger, header settle, press, ripple, heart burst, chip pop, page
// fade, card→page picture morph, sheet spring + drag-to-close, odometer totals, order snow,
// coupon stamp, cart row slide-out, hero words, countdown flip, search ring, empty-state art,
// pull-down snow — all transform/opacity only, none for reduced motion, none hiding content
// that is already on screen.
//   node scripts/test-motion.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const css = read('src/styles/sora-ds.css');
const motionBlock = css.slice(css.indexOf('Motion'));

const fakeEl = ({ top = 0, height = 100, rv, inside = false, card = false } = {}) => ({
  dataset: rv ? { rv } : {},
  closest: (sel) => (inside && sel.includes('.sora-winter') ? {} : null),
  parentElement: { closest: () => null },
  matches: () => card,
  getBoundingClientRect: () => ({ top, height }),
});

test('only things below the fold get the reveal; the winter band, header and bars never do', () => {
  const m = loadModule('src/lib/motion.js', { isWinterSeason: () => true });
  assert.equal(m.wantsReveal(fakeEl({ top: 200 }), 800), false, 'on screen stays as it is');
  assert.equal(m.wantsReveal(fakeEl({ top: 900 }), 800), true);
  assert.equal(m.wantsReveal(fakeEl({ top: 900, inside: true }), 800), false);
  assert.equal(m.wantsReveal(fakeEl({ top: 900, height: 0 }), 800), false);
  assert.equal(m.wantsReveal(fakeEl({ top: 900, rv: '0' }), 800), false, 'decided once');
  assert.equal(m.wantsReveal(null, 800), false);
});
test('nothing is installed for reduced motion, and the classes are removed once revealed', () => {
  const s = read('src/lib/motion.js');
  assert.match(s, /export function installMotion\(\) \{\s*\n\s*if \(typeof window === 'undefined' \|\| reducedMotion\(\)\) return \(\) => \{\};/);
  assert.match(s, /el\.classList\.remove\('rv', 'rv-in'\)/);
  assert.match(s, /if \(isWinterSeason\(\)\) undo\.push\(installPullSnow\(\)\);/);
});
test('the motion CSS animates only transform and opacity, and stops for reduced motion', () => {
  const frames = [...motionBlock.matchAll(/@keyframes [\w-]+ \{([^@]*?)\}\s*\}/g)].map((x) => x[1]);
  assert.ok(frames.length >= 8, `found ${frames.length} keyframes`);
  for (const f of frames) for (const prop of f.matchAll(/([a-z-]+)\s*:/g)) assert.ok(['transform', 'opacity', 'text-shadow'].includes(prop[1]), `animates ${prop[1]}`);
  // The one paint-y glow plays once on a few letters of an applied coupon, never on a loop.
  assert.match(motionBlock, /\.cartcoupon__appliedcode \{ animation: coupon-glow 1\.4s ease \.35s 1; \}/);
  assert.match(motionBlock, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(motionBlock, /backdrop-filter|filter:\s*blur/);
});
test('the odometer keeps the exact amount as text and rolls only the digits that changed', () => {
  const r = loadModule('src/components/RollNumber.jsx', { useRef: () => ({ current: null }) });
  assert.deepEqual(r.rollKeys('₹3,249'), ['6-₹', '5-3', '4-,', '3-2', '2-4', '1-9']);
  const before = new Set(r.rollKeys('₹3,249')); const after = r.rollKeys('₹3,299');
  assert.deepEqual(after.filter((k) => !before.has(k)), ['2-9'], 'one digit changed, one rolls');
  assert.match(read('src/components/PriceSummary.jsx'), /strong && typeof value === 'string' \? <RollNumber text=\{value\} \/> : value/);
  assert.match(read('src/components/MobileCartSummary.jsx'), /<span className="sr-only">Item subtotal <\/span><RollNumber text=\{money\(subtotal\)\} \/>/);
});
test('a removed cart row slides away first, and is removed even if the slide is cut short', () => {
  assert.match(read('src/pages/Cart.jsx'), /leave\(e\.currentTarget\.closest\('\.cartrow'\), \(\) => dispatch\(\{ type: 'REMOVE', key: l\.key \}\)\)/);
  const s = read('src/lib/motion.js');
  assert.match(s, /if \(!el \|\| reducedMotion\(\) \|\| typeof el\.animate !== 'function'\) \{ done\(\); return; \}/);
  assert.match(s, /out\.oncancel = done;/);
  assert.match(s, /fold\.onfinish = done; fold\.oncancel = done;/);
});
test('the card picture morphs into the product page where the browser can, else plain navigation', () => {
  const s = read('src/components/Motion.jsx');
  assert.match(s, /typeof document\.startViewTransition !== 'function'/);
  assert.match(s, /flushSync\(\(\) => navigate\(/);
  assert.match(css, /view-transition-name: sora-hero/);
});
test('order confirmation snows in winter; countdown digits flip; empty bag and wishlist are drawn', () => {
  assert.match(read('src/components/OrderCelebration.jsx'), /if \(!reduced && isWinterSeason\(\)\) snowFlurry\(26\);/);
  assert.match(read('src/components/OfferBanner.jsx'), /key=\{`\$\{k\}-\$\{v\}`\}/);
  assert.match(read('src/pages/Cart.jsx'), /<EmptyArt kind="bag" \/>/);
  assert.match(read('src/pages/Wishlist.jsx'), /<EmptyArt kind="heart" \/>/);
  assert.match(read('src/main.jsx'), /<Motion \/>/);
});

// ---- Round 38 bug fixes (owner 2026-11-21: "bugs find krke fix kro") ----------------
test('panels close by swiping the way they came in: quick-add down, wellness filters right, fashion/home filters left', () => {
  const m = loadModule('src/lib/motion.js', { isWinterSeason: () => true });
  assert.deepEqual(m.SHEETS.map((x) => x[2]), ['down', 'right', 'left', 'left']);
  assert.equal(m.along('down', 5, 120), 120);
  assert.equal(m.along('down', 0, -40), 0, 'never negative');
  assert.equal(m.along('right', 100, 3), 100);
  assert.equal(m.along('left', -100, 3), 100);
  assert.equal(m.along('left', 100, 3), 0);
  const s = read('src/lib/motion.js');
  assert.match(s, /if \(e\.target\.closest\?\.\('input, select, textarea, \[role="slider"\]'\)\) return;/, 'a slider is never a swipe');
  assert.match(s, /s\.lock = \(s\.dir === 'down'\) === \(Math\.abs\(dy\) > Math\.abs\(dx\)\);/, 'scrolling across is not a swipe');
});
test('entrance animations never pin transform after they end (the swipe and the press still work)', () => {
  assert.doesNotMatch(motionBlock, /animation: (sheet-up|coupon-in|hero-in|flip-in|sug-in|roll-in) [^;]* both;/);
  assert.match(motionBlock, /\.fs-sheet__panel \{ animation: sheet-up [^;]* backwards; \}/);
});
test('the page fade is opacity only, so fixed bars inside <main> never jump', () => {
  const s = read('src/components/Motion.jsx');
  assert.match(s, /main\?\.animate\?\.\(\[\{ opacity: navType === 'POP' \? 0\.55 : 0\.35 \}, \{ opacity: 1 \}\]/);
  assert.doesNotMatch(s.slice(s.indexOf('main?.animate'), s.indexOf('main?.animate') + 200), /transform/);
});
test('the odometer is inline-block, so the amount reads as one word', () => {
  assert.match(css, /\.roll \{ display: inline-block;/);
  assert.doesNotMatch(css, /\.roll \{ display: inline-flex/);
});
test('a one-colour garment never asks the shopper to choose its colour', () => {
  const view = { sizes: ['S', 'M'], swatches: [{ colour: 'Black' }], variants: [] };
  const pdp = read('src/fashion/FashionProductPage.jsx');
  const fn = pdp.slice(pdp.indexOf('export function defaultSelection'), pdp.indexOf('export default function FashionProductPage'));
  const defaultSelection = new Function(`${fn.replace('export ', '')}; return defaultSelection;`)();
  assert.deepEqual(defaultSelection(view, { size: null, colour: null }), { size: null, colour: 'Black' });
  assert.deepEqual(defaultSelection(view, { size: 'M', colour: null }), { size: 'M', colour: 'Black' });
  assert.deepEqual(defaultSelection({ ...view, swatches: [{ colour: 'Black' }, { colour: 'Brown' }] }, { size: null, colour: null }), { size: null, colour: null }, 'two colours: the shopper chooses');
  assert.match(read('src/fashion/FashionVariantPicker.jsx'), /useState\(\(\) => \(\{ size: view\.sizes\.length === 1 \? view\.sizes\[0\] : null, colour: view\.swatches\.length === 1 \? view\.swatches\[0\]\.colour : null \}\)\)/);
  const hl = read('src/homeliving/HomeLivingProductPage.jsx');
  assert.match(hl, /if \(view\.sizes\.length !== 1\) return !sel\.colour && \(view\.swatches \|\| \[\]\)\.length === 1 \? \{ \.\.\.sel, colour: view\.swatches\[0\]\.colour \} : sel;/);
});
test('checkout: a wrong field the shopper cannot see is brought into view; the checks are unchanged', () => {
  const c = read('src/pages/Checkout.jsx');
  assert.match(c, /onClick=\{\(\) => \{ if \(validateShipping\(\)\) next\(\); else showFirstError\(\); \}\}/);
  assert.match(c, /document\.querySelector\('\.field-error input, \.field-error select, \.field-error textarea'\)/);
});
test('the winter tab bar is solid, so footer text never shows through', () => {
  assert.match(css, /linear-gradient\(180deg, #1B3F7C, #0E2247\); \/\* solid/);
});

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
