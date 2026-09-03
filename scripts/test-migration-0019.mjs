// ============================================================
// Regression fixtures for migration 0019.
//
// 0019 rewrites announcement notices that promise free shipping above a
// CART-VALUE THRESHOLD. Getting the pattern wrong is a live-copy incident
// in either direction: too loose and it clobbers admin-authored marketing
// ("Free shipping all over 100 cities"), too tight and the stale ₹699
// promise stays on the storefront.
//
// This reads the pattern OUT OF THE SQL FILE — it is never restated here,
// so the fixtures can only ever describe the pattern that actually ships.
// The two occurrences in the file must be byte-identical.
//
// PostgreSQL ARE vs JavaScript: \y (PG word boundary) is translated to \b.
// Everything else in the pattern (\s, alternation, optional groups,
// bracket expressions) is common to both engines, and none of the fixtures
// depend on locale-specific word characters, so JS is a faithful proxy.
//
// Run: node scripts/test-migration-0019.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sqlPath = new URL('../supabase/migrations/0019_retire_free_shipping_threshold.sql', import.meta.url);
const sql = readFileSync(sqlPath, 'utf8');
const seed = readFileSync(new URL('../supabase/migrations/0001_admin_extensions.sql', import.meta.url), 'utf8');

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

// Statement-level assertions must look at EXECUTABLE SQL only. The file's
// VERIFY and ROLLBACK sections contain example statements in comments, and
// counting those would silently inflate every occurrence check.
//
// CRLF is normalised first: `.` does not match \r, so a naive /--.*$/gm
// strip does nothing at all on a CRLF checkout.
const code = sql
  .replace(/\r\n/g, '\n')
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n');

// ---- Extract the pattern actually used by the migration ----------------
const uses = [...code.matchAll(/~\*\s*'([^']*)'/g)].map((m) => m[1]);

console.log('\n— Pattern extraction —');

check('the migration uses exactly two regex comparisons', () => {
  assert.equal(uses.length, 2, `found ${uses.length}`);
});

check('both occurrences are byte-identical', () => {
  assert.equal(uses[0], uses[1], 'the guard and the CASE must use the same pattern');
});

check('the pattern is structural, not a broad .*over.*number', () => {
  assert.doesNotMatch(uses[0], /\.\*/, 'a .* wildcard would let unrelated words sit between the offer and the threshold');
});

// PG \y -> JS \b. No other translation is needed.
const RE = new RegExp(uses[0].replace(/\\y/g, '\\b'), 'i');
console.log(`\n  pattern: ${uses[0]}\n`);

// ---- Fixtures ----------------------------------------------------------
// Genuine cart-value threshold copy — must be retired.
const MUST_MATCH = [
  'FREE SHIPPING on orders above ₹699',
  'FREE SHIPPING on orders over ₹699',
  'FREE SHIPPING above ₹699',
  'FREE SHIPPING over ₹699',
  'Free shipping over Rs. 500',
  'FREE DELIVERY above 999',
  'free delivery on orders above INR 1200',
  'Free shipping for orders above ₹1,000'.replace(',', ''),
  'Free shipping on all orders above 750',
  'FREE SHIPPING ON ORDERS ABOVE RS.699',
];

// Legitimate copy — must survive untouched.
const MUST_NOT_MATCH = [
  'FREE STANDARD SHIPPING',
  'COD Available',
  'EXPLORE WELLNESS, PERSONAL CARE & MORE',
  'Free shipping, delivered all over India',
  'Free shipping all over 100 cities',
  'Trusted all over Punjab since 2019',
  'Flat ₹79 express shipping',
  'Free shipping available in over 100 cities',
  'Free shipping on selected products',
  'Free shipping on standard delivery',
  'Free shipping on every order',
  'Save 20% above 5 items',
  'Free shipping overnight to 6 metros',
  'Express delivery in over 20 states',
];

console.log('— Threshold copy is matched —');
for (const notice of MUST_MATCH) {
  check(`matches: ${notice}`, () => assert.ok(RE.test(notice), 'should have matched'));
}

console.log('\n— Legitimate copy is preserved —');
for (const notice of MUST_NOT_MATCH) {
  check(`ignores: ${notice}`, () => assert.ok(!RE.test(notice), 'must NOT be rewritten'));
}

console.log('\n— The actual historical seed from migration 0001 —');

check('0001 still seeds the notice this migration targets', () => {
  assert.match(seed, /'FREE SHIPPING on orders above ₹699'/,
    'the seeded string changed — re-derive the fixtures from 0001');
});

check('the seeded string is matched by the shipped pattern', () => {
  const seeded = (seed.match(/'(FREE SHIPPING on orders above ₹699)'/) || [])[1];
  assert.ok(seeded, 'could not read the seeded notice out of 0001');
  assert.ok(RE.test(seeded), `the pattern does not match the real seed: ${seeded}`);
});

check('0001 is not modified by this work', () => {
  // 0019 is a forward migration; history must stay as it ran.
  assert.match(seed, /'free_shipping_threshold', 699/);
});

// ---- Statement-level safety properties ---------------------------------
console.log('\n— Migration safety properties —');

check('only the announcement row is targeted', () => {
  const wheres = [...code.matchAll(/where key = '([^']+)'/g)].map((m) => m[1]);
  assert.equal(wheres.length, 2, 'expected one key filter per statement');
  assert.deepEqual([...new Set(wheres)], ['announcement']);
});

check('the retired key is removed, guarded against scalar values', () => {
  assert.match(code, /set value = value - 'free_shipping_threshold'/);
  assert.match(code, /and jsonb_typeof\(value\) = 'object'/);
  assert.match(code, /and value \? 'free_shipping_threshold'/);
});

check('notice order is preserved', () => {
  assert.match(code, /order by ord/);
  assert.match(code, /with ordinality as t\(notice, ord\)/);
});

check('unrelated notices pass through unchanged', () => {
  assert.match(code, /else notice/, 'non-matching elements must be re-emitted as-is');
});

check('sibling announcement keys are preserved', () => {
  // jsonb_set on the {notices} path only — never a wholesale value replace.
  assert.match(code, /jsonb_set\(\s*value,\s*'\{notices\}'/);
});

check('updated_at is set explicitly (site_settings has no trigger)', () => {
  assert.equal((code.match(/updated_at = now\(\)/g) || []).length, 2,
    'both statements must bump updated_at');
});

check('malformed settings shapes cannot error the migration', () => {
  assert.match(code, /jsonb_typeof\(value -> 'notices'\) = 'array'/,
    'a non-array notices value must be skipped, not fed to jsonb_array_elements');
});

check('both statements are idempotent by construction', () => {
  // Statement 1 requires the key to be present; statement 2 requires at
  // least one matching notice. After one run neither is true.
  assert.match(code, /and value \? 'free_shipping_threshold';/);
  assert.match(code, /and exists \(/);
});

check('no schema change and nothing destructive', () => {
  assert.doesNotMatch(code, /\b(drop|alter|truncate|delete)\b/i);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
