// ============================================================
// Wishlist cross-device sync regression suite.
//
// The invariant this suite exists to defend:
//
//   A signs in, saves something, signs out. B signs in on the same browser.
//   B MUST NOT see A's item.
//
// That is a privacy bug, not a UI bug, so the ownership rules are executed
// here rather than asserted against source text. wishlistState.js is pure
// (no React, no Supabase) precisely so this is possible.
//
// NO NETWORK, NO SECRETS, NO DATABASE.
//
// Run: node scripts/test-wishlist-sync.mjs
// ============================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  normalizeKey, normalizeKeys, visibleWishlist, wishlistReducer, planWishlistSync,
  loadPersistedWishlist, pickPersisted, PERSISTED_KEYS, initialWishlistState, MAX_KEY_LENGTH,
} from '../src/lib/wishlistState.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const sqlCode = (src) => src.replace(/\r\n/g, '\n').split('\n')
  .map((l) => l.replace(/--.*$/, '')).join('\n');
const jsCode = (src) => src.replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

const migration = read('../supabase/migrations/0021_customer_wishlist.sql');
const dataHelper = read('../src/lib/wishlistData.js');
const store = read('../src/lib/store.jsx');
const wishlistPage = read('../src/pages/Wishlist.jsx');
const account = read('../src/pages/Account.jsx');

let passed = 0, failed = 0, current = '(startup)';
function reportFatal(kind, err) {
  console.error(`\n  FATAL ${kind} during: ${current}`);
  console.error(`  ${err && err.stack ? err.stack : err}`);
  process.exitCode = 1;
}
process.on('unhandledRejection', (e) => reportFatal('unhandledRejection', e));
process.on('uncaughtException', (e) => reportFatal('uncaughtException', e));

async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

// A tiny store double: applies the real reducer, tracks what would be
// persisted, and models the sync effect's stale-response guard.
function makeStore(persistedRaw = null) {
  let state = {
    cart: [], saved: [],
    ...initialWishlistState,
    guestWish: loadPersistedWishlist(persistedRaw),
  };
  if (persistedRaw?.cart) state.cart = persistedRaw.cart;
  if (persistedRaw?.saved) state.saved = persistedRaw.saved;
  let token = 0;
  return {
    get state() { return state; },
    get visible() { return visibleWishlist(state); },
    get persisted() { return pickPersisted(state); },
    dispatch(action) { state = wishlistReducer(state, action); return state; },
    /** Mirrors the effect: bump the token, and only apply if still current. */
    beginSync() { return ++token; },
    isCurrent(t) { return t === token; },
    signOut() { this.beginSync(); state = wishlistReducer(state, { type: 'WISH_SESSION_CLEARED' }); },
    /** The full login merge, as store.jsx performs it. */
    login(userId, remote, { staleAfterFetch = false } = {}) {
      const t = this.beginSync();
      const guestAtLogin = normalizeKeys(state.guestWish);
      const { missing, union } = planWishlistSync({ guestAtLogin, remote });
      if (staleAfterFetch) this.beginSync();     // another account arrived
      if (!this.isCurrent(t)) return { applied: false, missing, union };
      state = wishlistReducer(state, { type: 'WISH_SYNCED', userId, keys: union });
      return { applied: true, missing, union };
    },
  };
}

// ============================================================
console.log('\n— Anonymous shopper —');
// ============================================================

await test('a legacy sora.store.v1 wishlist loads as the guest list', () => {
  const s = makeStore({ wishlist: ['b1152', 5, 'b115'], cart: [{ key: 'x' }] });
  assert.deepEqual(s.state.guestWish, ['b1152', '5', 'b115']);
  assert.deepEqual(s.visible, ['b1152', '5', 'b115']);
});

await test('an anonymous toggle works with no session and no network', () => {
  const s = makeStore();
  s.dispatch({ type: 'WISH_GUEST_TOGGLE', key: 'b115' });
  assert.deepEqual(s.visible, ['b115']);
  s.dispatch({ type: 'WISH_GUEST_TOGGLE', key: 'b115' });
  assert.deepEqual(s.visible, []);
});

await test('the guest list is persisted; account state never is', () => {
  assert.deepEqual(PERSISTED_KEYS, ['cart', 'saved', 'guestWish']);
  const s = makeStore();
  s.dispatch({ type: 'WISH_GUEST_TOGGLE', key: 'b1' });
  s.dispatch({ type: 'WISH_SYNCED', userId: 'user-A', keys: ['secret-A'] });
  const p = s.persisted;
  assert.deepEqual(Object.keys(p).sort(), ['cart', 'guestWish', 'saved']);
  assert.equal('accountWish' in p, false, 'accountWish must never be written to localStorage');
  assert.equal('syncedUserId' in p, false);
  assert.equal(JSON.stringify(p).includes('secret-A'), false, "an account item leaked into storage");
});

await test('an unauthenticated toggle issues no remote write', () => {
  // The signed-out branch returns before any await, and the whole
  // anonymous path never touches wishlistData.
  const c = jsCode(store);
  const fn = c.slice(c.indexOf('const toggleWish'), c.indexOf('const toggleWish') + 1200);
  const guestBranch = fn.slice(fn.indexOf('if (!signedIn)'), fn.indexOf('return;', fn.indexOf('if (!signedIn)')));
  assert.doesNotMatch(guestBranch, /addWishlistItem|removeWishlistItem|mergeWishlist/);
});

// ============================================================
console.log('\n— Key normalization —');
// ============================================================

await test('numeric and string ids are the same key', () => {
  assert.equal(normalizeKey(5), '5');
  assert.equal(normalizeKey('5'), '5');
  assert.equal(normalizeKey(' b115 '), 'b115');
  assert.deepEqual(normalizeKeys([5, '5', 'b1', 'b1']), ['5', 'b1']);
});

await test('invalid keys are rejected, never stored', () => {
  for (const bad of [null, undefined, '', '   ', {}, [], NaN, 'a'.repeat(MAX_KEY_LENGTH + 1)]) {
    assert.equal(normalizeKey(bad), '', `should reject: ${JSON.stringify(bad)}`);
  }
  assert.deepEqual(normalizeKeys([null, '', 'b1', undefined]), ['b1']);
});

await test('a toggle with an unusable id changes nothing', () => {
  const s = makeStore();
  s.dispatch({ type: 'WISH_GUEST_TOGGLE', key: '' });
  s.dispatch({ type: 'WISH_ACCOUNT_ADD', key: null });
  assert.deepEqual(s.visible, []);
  assert.deepEqual(s.state.accountWish, []);
});

await test('existing mixed-type local ids survive migration without loss', () => {
  const s = makeStore({ wishlist: [101, '101', 'b115', 202] });
  assert.deepEqual(s.state.guestWish, ['101', 'b115', '202'], 'deduped, order kept, nothing dropped');
});

// ============================================================
console.log('\n— Login merge —');
// ============================================================

await test('remote-only: the account list appears', () => {
  const s = makeStore();
  const r = s.login('user-A', ['r1', 'r2']);
  assert.deepEqual(r.missing, [], 'nothing to write');
  assert.deepEqual(s.visible.sort(), ['r1', 'r2']);
});

await test('guest-only: guest items are written to the account', () => {
  const s = makeStore({ wishlist: ['g1', 'g2'] });
  const r = s.login('user-A', []);
  assert.deepEqual(r.missing, ['g1', 'g2'], 'both must be pushed remotely');
  assert.deepEqual(s.visible, ['g1', 'g2']);
});

await test('overlap: the union appears exactly once each', () => {
  const s = makeStore({ wishlist: ['shared', 'g-only'] });
  s.login('user-A', ['shared', 'r-only']);
  const v = s.visible;
  assert.deepEqual([...v].sort(), ['g-only', 'r-only', 'shared']);
  assert.equal(v.filter((k) => k === 'shared').length, 1, 'no duplicate');
});

await test('only the missing guest items are written', () => {
  const s = makeStore({ wishlist: ['shared', 'g-only'] });
  const r = s.login('user-A', ['shared', 'r-only']);
  assert.deepEqual(r.missing, ['g-only'], 'already-saved items must not be rewritten');
});

await test('the merge is idempotent — a second run writes nothing new', () => {
  const s = makeStore({ wishlist: ['g1'] });
  const first = s.login('user-A', []);
  assert.deepEqual(first.missing, ['g1']);
  // Second pass now sees g1 remotely.
  const second = s.login('user-A', first.union);
  assert.deepEqual(second.missing, [], 'a repeat merge must be a no-op');
  assert.deepEqual(s.visible, ['g1']);
});

await test('StrictMode double initialization cannot duplicate items', () => {
  const s = makeStore({ wishlist: ['g1'] });
  s.login('user-A', []);
  s.login('user-A', ['g1']);   // effect ran twice
  assert.deepEqual(s.visible, ['g1']);
  assert.equal(s.state.accountWish.filter((k) => k === 'g1').length, 1);
});

await test('the bulk merge is one duplicate-safe request, not N', () => {
  const c = jsCode(dataHelper);
  const fn = c.slice(c.indexOf('export async function mergeWishlist'));
  assert.match(fn, /\.upsert\(\s*keys\.map/, 'must send the whole array in one call');
  assert.match(fn, /ignoreDuplicates: true/);
  assert.doesNotMatch(fn, /for \(|forEach|Promise\.all/, 'must not issue one request per item');
});

// ============================================================
console.log('\n— Signed-in toggle —');
// ============================================================

await test('adding while signed in touches the account list only', () => {
  const s = makeStore();
  s.login('user-A', []);
  s.dispatch({ type: 'WISH_ACCOUNT_ADD', key: 'a1' });
  assert.deepEqual(s.state.accountWish, ['a1']);
  assert.deepEqual(s.state.guestWish, [], 'an account save must NOT become a guest item');
  assert.deepEqual(s.visible, ['a1']);
});

await test('removing while signed in clears the guest copy too', () => {
  // Otherwise the union would put it straight back and the removal would
  // look broken to the customer.
  const s = makeStore({ wishlist: ['shared'] });
  s.login('user-A', ['shared']);
  s.dispatch({ type: 'WISH_ACCOUNT_REMOVE', key: 'shared' });
  assert.deepEqual(s.visible, [], 'must disappear from the visible list');
  assert.deepEqual(s.state.guestWish, []);
});

await test('a failed remote add is rolled back, not shown as saved', () => {
  const s = makeStore();
  s.login('user-A', []);
  s.dispatch({ type: 'WISH_ACCOUNT_ADD', key: 'a1' });   // optimistic
  s.dispatch({ type: 'WISH_ACCOUNT_REMOVE', key: 'a1' }); // rollback
  assert.deepEqual(s.visible, []);
});

await test('a failed remote remove restores both lists', () => {
  const s = makeStore({ wishlist: ['shared'] });
  s.login('user-A', ['shared']);
  s.dispatch({ type: 'WISH_ACCOUNT_REMOVE', key: 'shared' }); // optimistic
  // rollback, exactly as store.jsx does it
  s.dispatch({ type: 'WISH_ACCOUNT_ADD', key: 'shared' });
  s.dispatch({ type: 'WISH_GUEST_TOGGLE', key: 'shared' });
  assert.deepEqual(s.state.guestWish, ['shared'], 'the guest copy must come back');
  assert.deepEqual(s.visible, ['shared']);
});

await test('the failure path warns and does not claim success', () => {
  const c = jsCode(store);
  assert.match(c, /Could not sync wishlist\. Please try again\./);
  const fn = c.slice(c.indexOf('const toggleWish'));
  assert.match(fn.slice(0, 2000), /if \(ok\) return;/, 'rollback must be gated on the write result');
});

// ============================================================
console.log('\n— User isolation (the headline requirement) —');
// ============================================================

await test("user B does NOT inherit user A's account-only item", () => {
  const s = makeStore({ wishlist: ['browser-item'] });

  s.login('user-A', ['A-private']);
  assert.ok(s.visible.includes('A-private'), 'A sees their own item');

  s.signOut();
  assert.equal(s.visible.includes('A-private'), false, "A's item must vanish on sign-out");
  assert.deepEqual(s.visible, ['browser-item'], 'only the browser list remains');

  s.login('user-B', []);
  assert.equal(s.visible.includes('A-private'), false, "B MUST NOT see A's item");
  assert.deepEqual(s.visible, ['browser-item']);
});

await test("A's account item is never persisted for B to find", () => {
  const s = makeStore();
  s.login('user-A', ['A-private']);
  assert.equal(JSON.stringify(s.persisted).includes('A-private'), false);
});

await test('a stale response for the previous user cannot land on the new user', () => {
  const s = makeStore();
  // A's fetch is in flight when B signs in: the token moves on, so A's
  // result is discarded rather than applied to B's session.
  const r = s.login('user-A', ['A-private'], { staleAfterFetch: true });
  assert.equal(r.applied, false, "A's stale result must be discarded");
  assert.equal(s.visible.includes('A-private'), false);
  assert.equal(s.state.syncedUserId, null);
});

await test('an account switch re-syncs rather than reusing the old list', () => {
  const s = makeStore();
  s.login('user-A', ['A-1']);
  s.signOut();
  s.login('user-B', ['B-1']);
  assert.deepEqual(s.visible, ['B-1']);
  assert.equal(s.state.syncedUserId, 'user-B');
});

await test('the sync effect keys on userId and skips when already synced', () => {
  const c = jsCode(store);
  assert.match(c, /if \(state\.syncedUserId === userId\) return;/);
  assert.match(c, /\}, \[userId, state\.syncedUserId\]\)/, 'effect must depend on the user');
  assert.match(c, /token !== syncTokenRef\.current/, 'stale-response guard required');
});

await test('RLS isolates every statement to auth.uid()', () => {
  const sql = sqlCode(migration);
  const policies = [...sql.matchAll(/create policy "([^"]+)"[\s\S]*?;/g)].map((m) => m[0]);
  assert.equal(policies.length, 3, 'expect exactly select/insert/delete');
  for (const p of policies) {
    assert.match(p, /to authenticated/, 'policies must be authenticated-only');
    assert.match(p, /auth\.uid\(\) = user_id/, 'every policy must scope to the caller');
  }
  assert.match(sql, /for insert[\s\S]*?with check \(auth\.uid\(\) = user_id\)/,
    'INSERT must use with check — using is not evaluated for INSERT');
  assert.doesNotMatch(sql, /to anon/, 'no anonymous access');
  assert.doesNotMatch(sql, /for update/, 'no update policy should exist');
});

// ============================================================
console.log('\n— Logout —');
// ============================================================

await test('logout deletes nothing remotely', () => {
  const c = jsCode(store);
  const effect = c.slice(c.indexOf('if (!userId)'), c.indexOf('if (!userId)') + 400);
  assert.doesNotMatch(effect, /removeWishlistItem|delete/i, 'sign-out must never touch the database');
  assert.match(effect, /WISH_SESSION_CLEARED/);
});

await test('logout restores exactly the guest wishlist', () => {
  const s = makeStore({ wishlist: ['g1'] });
  s.login('user-A', ['a1']);
  assert.deepEqual([...s.visible].sort(), ['a1', 'g1']);
  s.signOut();
  assert.deepEqual(s.visible, ['g1']);
});

await test('cart and saved-for-later are untouched by every wishlist action', () => {
  const cart = [{ key: 'p1', id: 'p1', qty: 2 }];
  const saved = [{ key: 'p2', id: 'p2', qty: 1 }];
  const s = makeStore({ wishlist: ['g1'], cart, saved });
  s.login('user-A', ['a1']);
  s.dispatch({ type: 'WISH_ACCOUNT_ADD', key: 'a2' });
  s.dispatch({ type: 'WISH_ACCOUNT_REMOVE', key: 'a1' });
  s.signOut();
  assert.deepEqual(s.state.cart, cart, 'cart must be unchanged');
  assert.deepEqual(s.state.saved, saved, 'saved-for-later must be unchanged');
});

// ============================================================
console.log('\n— Catalogue compatibility —');
// ============================================================

await test('productById is keyed by string, so normalised keys resolve', () => {
  const products = read('../src/data/products.js');
  assert.match(products, /productById: Object\.fromEntries\(list\.map\(\(p\) => \[p\.id, p\]\)\)/);
  // Object keys are strings in JS, so a '5' lookup hits a product built with id 5.
  const probe = Object.fromEntries([[5, { id: 5 }]]);
  assert.ok(probe['5'], 'string key must resolve a numerically-keyed entry');
});

await test('the Wishlist page and Account tab both resolve keys the same way', () => {
  assert.match(wishlistPage, /wishlist\.map\(\(id\) => productById\[id\]\)\.filter\(Boolean\)/);
  assert.match(account, /wishlist\.map\(\(id\) => productById\[id\]\)\.filter\(Boolean\)/);
});

await test('a saved item absent from the catalogue is not deleted', () => {
  // .filter(Boolean) hides it from the grid, but it stays in state and in
  // the database, so it comes back when the catalogue reloads.
  const s = makeStore({ wishlist: ['not-in-catalogue-yet'] });
  assert.deepEqual(s.state.guestWish, ['not-in-catalogue-yet']);
  assert.deepEqual(s.persisted.guestWish, ['not-in-catalogue-yet']);
});

await test('isWished and wishCount read the visible union', () => {
  const c = jsCode(store);
  assert.match(c, /isWished: \(id\) => wishlist\.includes\(normalizeKey\(id\)\)/);
  assert.match(c, /wishCount: wishlist\.length/);
});

// ============================================================
console.log('\n— Data helper security —');
// ============================================================

await test('no service-role key anywhere in browser wishlist code', () => {
  for (const [name, src] of [['wishlistData', dataHelper], ['store', store]]) {
    assert.doesNotMatch(src, /SERVICE_ROLE|service_role|serviceKey/, `${name} must never see the service role`);
  }
});

await test('the client never supplies user_id', () => {
  const c = jsCode(dataHelper);
  assert.doesNotMatch(c, /user_id:/, 'user_id must come from auth.uid(), not the payload');
  assert.match(c, /product_key/);
});

await test('every helper is failure-tolerant and logs nothing sensitive', () => {
  const c = jsCode(dataHelper);
  assert.doesNotMatch(c, /console\.(log|error|warn)/, 'no logging of row or user data');
  for (const fn of ['listWishlist', 'addWishlistItem', 'removeWishlistItem', 'mergeWishlist']) {
    assert.match(c, new RegExp(`export async function ${fn}`), `missing ${fn}`);
  }
  assert.match(c, /catch \{\s*return \[\];/, 'reads degrade to an empty list');
});

// ============================================================
console.log('\n— Migration 0021 —');
// ============================================================

await test('creates one new table and touches no existing data', () => {
  const sql = sqlCode(migration);
  assert.match(sql, /create table if not exists public\.customer_wishlist/);
  assert.doesNotMatch(sql, /\b(drop table|truncate|delete from|alter column|update )\b/i);
});

await test('user_id defaults to auth.uid() and cascades from auth.users', () => {
  const sql = sqlCode(migration);
  assert.match(sql, /user_id\s+uuid not null default auth\.uid\(\)/);
  assert.match(sql, /references auth\.users\(id\) on delete cascade/);
});

await test('the composite primary key prevents duplicates', () => {
  assert.match(sqlCode(migration), /primary key \(user_id, product_key\)/);
});

await test('product_key is bounded and non-empty, with no FK to products', () => {
  const sql = sqlCode(migration);
  assert.match(sql, /check \(product_key = btrim\(product_key\)\)/);
  assert.match(sql, /check \(length\(product_key\) between 1 and 64\)/);
  assert.doesNotMatch(sql, /references public\.products/, 'an FK would delete saved items on catalogue changes');
});

await test('RLS is enabled and the migration is re-runnable', () => {
  const sql = sqlCode(migration);
  assert.match(sql, /alter table public\.customer_wishlist enable row level security/);
  assert.match(sql, /create table if not exists/);
  assert.match(sql, /create index if not exists/);
  assert.equal((sql.match(/drop policy if exists/g) || []).length, 3, 'each policy must be re-creatable');
});

await test('the key length bound matches the client', () => {
  assert.match(sqlCode(migration), new RegExp(`between 1 and ${MAX_KEY_LENGTH}`));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exitCode = failed === 0 ? 0 : 1;
