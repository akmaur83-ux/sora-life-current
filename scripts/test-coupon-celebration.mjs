// ============================================================
// COUPON CELEBRATION — the rules, and the constraints
//
//   node scripts/test-coupon-celebration.mjs
//
// Three groups:
//   1. WHEN it fires. The reducer and shouldCelebrate() run directly, so the
//      four "nevers" (refused, restored, repeated, removed) are each proved
//      rather than assumed.
//   2. WHAT it shows. No arithmetic: the two figures are read off the
//      server's breakdown by name.
//   3. HOW it moves. Every celebrate-* keyframe animates transform and
//      opacity and nothing else; the scrim has no backdrop-filter; reduced
//      motion is honoured in both the component and the stylesheet.
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { couponReducer, initialCouponState, shouldCelebrate } from '../src/lib/couponState.js';
import { PERSISTED_KEYS } from '../src/lib/wishlistState.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, p), 'utf8').replace(/\r\n/g, '\n');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

let passed = 0; const failures = [];
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push(name); }
}

const ok = (c) => ({ status: 'ok', stale: false, coupon: { code: c }, breakdown: { couponDiscount: 200, grandTotal: 1000 } });
const run = (...actions) => actions.reduce(couponReducer, initialCouponState);

// ====================================================================
console.log('\n— When it fires —\n');
// ====================================================================

test('a first apply, confirmed by the server, celebrates', () => {
  const s = run({ type: 'APPLY_COUPON', code: 'A' });
  assert.equal(s.celebratePending, 'A');
  assert.equal(shouldCelebrate(s, ok('A')), true);
});

test('NEVER on a refused code — the quote is rejected, not ok', () => {
  const s = run({ type: 'APPLY_COUPON', code: 'A' });
  const rejected = { status: 'rejected', stale: false, coupon: null, message: 'That code has expired.' };
  assert.equal(shouldCelebrate(s, rejected), false);
});

test('NEVER while the quote is still stale', () => {
  // The previous quote can still say ok for a DIFFERENT basket while the
  // refetch is in flight; the celebration waits for the settled answer.
  const s = run({ type: 'APPLY_COUPON', code: 'A' });
  assert.equal(shouldCelebrate(s, { ...ok('A'), stale: true }), false);
});

test('NEVER for a code the server confirms that is not the one just applied', () => {
  const s = run({ type: 'APPLY_COUPON', code: 'A' });
  assert.equal(shouldCelebrate(s, ok('B')), false);
});

test('NEVER on restore — a persisted code sets no pending intent', () => {
  // This is the reload case: couponCode comes back from storage, but
  // celebratePending does not, because it is not persisted.
  assert.ok(PERSISTED_KEYS.includes('couponCode'));
  assert.ok(!PERSISTED_KEYS.includes('celebratePending'), 'celebratePending must not persist');
  assert.ok(!PERSISTED_KEYS.includes('celebratedCodes'), 'celebratedCodes must not persist');
  const restored = { ...initialCouponState, couponCode: 'A' };
  assert.equal(shouldCelebrate(restored, ok('A')), false);
});

test('NEVER twice — the same code re-applied after a remove does not repeat', () => {
  const s = run(
    { type: 'APPLY_COUPON', code: 'A' },
    { type: 'COUPON_CELEBRATED', code: 'A' },
    { type: 'CLEAR_COUPON' },
    { type: 'APPLY_COUPON', code: 'A' },
  );
  assert.equal(s.couponCode, 'A', 'it still applies');
  assert.equal(s.celebratePending, '', 'but there is nothing to celebrate');
  assert.equal(shouldCelebrate(s, ok('A')), false);
});

test('a DIFFERENT code after the first still celebrates', () => {
  const s = run(
    { type: 'APPLY_COUPON', code: 'A' },
    { type: 'COUPON_CELEBRATED', code: 'A' },
    { type: 'CLEAR_COUPON' },
    { type: 'APPLY_COUPON', code: 'B' },
  );
  assert.equal(shouldCelebrate(s, ok('B')), true);
});

test('NEVER after a remove — CLEAR_COUPON withdraws the pending intent', () => {
  // Apply, then remove before the quote lands. A late ok must not celebrate
  // a coupon that is no longer on the cart.
  const s = run({ type: 'APPLY_COUPON', code: 'A' }, { type: 'CLEAR_COUPON' });
  assert.equal(s.celebratePending, '');
  assert.equal(shouldCelebrate(s, ok('A')), false);
});

test('COUPON_CELEBRATED clears the intent and records the code once', () => {
  const s = run(
    { type: 'APPLY_COUPON', code: 'A' },
    { type: 'COUPON_CELEBRATED', code: 'A' },
    { type: 'COUPON_CELEBRATED', code: 'A' },
  );
  assert.equal(s.celebratePending, '');
  assert.deepEqual(s.celebratedCodes, ['A']);
});

test('CLEAR_COUPON on an already-empty state returns the same object', () => {
  // The reducer identity contract the rest of the store relies on.
  assert.equal(couponReducer(initialCouponState, { type: 'CLEAR_COUPON' }), initialCouponState);
});

test('the store delegates the coupon actions rather than re-implementing them', () => {
  const store = code('../src/lib/store.jsx');
  assert.match(store, /case 'APPLY_COUPON':\s*case 'CLEAR_COUPON':\s*case 'COUPON_CELEBRATED':\s*return couponReducer\(state, action\)/);
  assert.match(code('../src/pages/Cart.jsx'), /shouldCelebrate\(/, 'the cart asks the shared predicate');
});

// ====================================================================
console.log('\n— What it shows —\n');
// ====================================================================

test('the two figures are read off the breakdown by name', () => {
  const c = code('../src/components/CouponCelebration.jsx');
  assert.match(c, /breakdown\.couponDiscount/, 'the saving is the server\'s');
  assert.match(c, /breakdown\.grandTotal/, 'the new total is the server\'s');
});

test('the modal does no arithmetic on them', () => {
  const c = code('../src/components/CouponCelebration.jsx');
  // Strip the particle scatter, whose maths is geometry, not money.
  const withoutScatter = c.replace(/function scatter[\s\S]*?\n}\n/, '');
  assert.doesNotMatch(withoutScatter, /(saved|total|Discount|grandTotal)\s*[-+*/]/, 'no adjusting a figure');
  assert.doesNotMatch(withoutScatter, /[-+*/]\s*(saved|total|Discount|grandTotal)\b/, 'no adjusting a figure');
});

test('the modal is a dialog, dismissible, and auto-closes at 3 seconds', () => {
  const c = code('../src/components/CouponCelebration.jsx');
  assert.match(c, /role="dialog"/);
  assert.match(c, /aria-modal="true"/);
  assert.match(c, /AUTO_CLOSE_MS = 3000/);
  assert.match(c, /e\.key === 'Escape'/, 'Escape closes it');
  assert.match(c, /className="celebrate__close"/, 'there is a close button');
  assert.match(c, /onClick=\{onClose\}[\s\S]*role="dialog"/, 'the backdrop closes it');
  assert.match(c, /stopPropagation/, 'a click inside the card does not');
});

// ====================================================================
console.log('\n— How it moves —\n');
// ====================================================================

// Comments stripped, so a comment SAYING "no backdrop-filter" cannot trip the
// assertion that there is none.
const css = src('../src/styles/coupons.css').replace(/\/\*[\s\S]*?\*\//g, '');

/** Every property set inside a keyframe block, for the named animation. */
function keyframeProperties(name) {
  const m = css.match(new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(m, `@keyframes ${name} exists`);
  const props = new Set();
  for (const decl of m[1].matchAll(/([a-z-]+)\s*:/g)) props.add(decl[1]);
  return props;
}

const CELEBRATE_KEYFRAMES = [...css.matchAll(/@keyframes\s+(celebrate-[a-z-]+)/g)].map((m) => m[1]);

test('there are celebration keyframes to check', () => {
  assert.ok(CELEBRATE_KEYFRAMES.length >= 5, `found ${CELEBRATE_KEYFRAMES.join(', ')}`);
});

for (const name of CELEBRATE_KEYFRAMES) {
  test(`@keyframes ${name} animates ONLY transform and opacity`, () => {
    const props = keyframeProperties(name);
    for (const p of props) {
      assert.ok(p === 'transform' || p === 'opacity', `${name} animates "${p}"`);
    }
  });
}

test('the scrim has no backdrop-filter', () => {
  const scrim = css.match(/\.celebrate\s*\{([\s\S]*?)\}/)[1];
  assert.doesNotMatch(scrim, /backdrop-filter/);
  assert.doesNotMatch(css, /\.celebrate[a-z_-]*\s*\{[^}]*filter\s*:/, 'no filter anywhere in the celebration');
});

test('the particles do not animate a layout or paint property', () => {
  const bit = css.match(/\.celebrate__bit\s*\{([\s\S]*?)\}/)[1];
  assert.match(bit, /will-change:\s*transform,\s*opacity/);
  assert.doesNotMatch(bit, /transition/, 'keyframes only — no transitions to fight them');
  // The one place a layout property is set is the initial position, once.
  assert.match(bit, /left:\s*var\(--x\)/);
  assert.ok(!keyframeProperties('celebrate-fall').has('left'), 'left is set once, never animated');
  assert.ok(!keyframeProperties('celebrate-fall').has('top'), 'top is set once, never animated');
});

test('prefers-reduced-motion drops the particles in the component…', () => {
  const c = code('../src/components/CouponCelebration.jsx');
  assert.match(c, /prefers-reduced-motion: reduce/);
  assert.match(c, /reduced \? \[\] : scatter/, 'no particles are even rendered');
  assert.match(c, /!reduced && \(/, 'no ribbons either');
});

test('…and calms what remains in the stylesheet', () => {
  const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(block, /\.celebrate__badge\s*\{\s*animation:\s*none/);
  assert.match(block, /\.celebrate__bit,\s*\.celebrate__ribbon\s*\{\s*animation:\s*none/);
  assert.match(block, /\.celebrate__card\s*\{\s*animation:\s*celebrate-fade/, 'the card fades instead of popping');
});

test('confetti is hand-rolled — no animation or confetti dependency was added', () => {
  const pkg = JSON.parse(src('../package.json'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of Object.keys(deps)) {
    assert.doesNotMatch(name, /confetti|party|gsap|framer|motion|anime|lottie/i, `${name} looks like an animation library`);
  }
  assert.doesNotMatch(code('../src/components/CouponCelebration.jsx'), /from ['"](?!react|\.)/, 'the component imports only react and local files');
});

// ====================================================================
console.log('\n— The applied ticket and the offers use the shared shape —\n');
// ====================================================================

test('one ticket shape, parameterised by what it sits on', () => {
  assert.match(css, /\.ticket\s*\{[\s\S]*?--ticket-cut/);
  assert.match(css, /\.cartcoupon \.ticket\s*\{\s*--ticket-cut:\s*var\(--v2-surface/);
  assert.match(src('../src/admin/admin.css'), /\.adm-coupon-preview \.ticket\s*\{\s*--ticket-cut:\s*var\(--paper\)/);
  assert.match(code('../src/components/pdp/CouponTicket.jsx'), /className=\{`ticket pdp-coupon/);
  assert.match(code('../src/components/CartCoupons.jsx'), /className="ticket cartcoupon__applied"/);
  assert.match(code('../src/components/CartCoupons.jsx'), /className=\{`ticket cartcoupon__offer/);
});

test('the applied ticket derives its one tint from a token, not a new colour', () => {
  const applied = css.match(/\.cartcoupon__applied\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(applied, /color-mix\(in srgb, var\(--honey-500\)/, 'the grain is honey at low alpha');
  // No raw hex/rgb in the applied ticket at all.
  assert.doesNotMatch(applied, /#[0-9a-f]{3,6}\b|rgba?\(/i);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log(`failing: ${failures.join(', ')}`); process.exit(1); }
