// Creator Game v1 (owner, 2026-11-22: "Creator Game v1 bana do … speed pr fark na pde"):
// badges, Bharat Yatra, season & league, Wrapped, custom code, Discoverer, cha-ching,
// mystery hamper — and the creator portal moved out of the shoppers' bundle.
//   node scripts/test-creator-game.mjs
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { loadModule } from './catalogue-admin-harness.mjs';
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`  PASS  ${name}`); } catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const g = loadModule('src/lib/creatorGame.js', {});
const sql = read('supabase/migrations/0050_creator_game.sql');

test('the creator portal and the account Creator tab are lazy chunks, not in the shoppers’ bundle', () => {
  const app = read('src/App.jsx'); const acct = read('src/pages/Account.jsx');
  assert.match(app, /const CreatorPortalChunk = lazy\(\(\) => import\('\.\/pages\/CreatorPortal\.jsx'\)\);/);
  assert.doesNotMatch(app, /^import CreatorPortal from/m);
  assert.match(acct, /const CreatorOnboardingChunk = lazy\(\(\) => import\('\.\/account\/CreatorOnboarding\.jsx'\)\);/);
  assert.doesNotMatch(acct, /^import CreatorOnboarding from/m);
  if (existsSync(new URL('../public/bundle.js', import.meta.url))) {
    const bundle = read('public/bundle.js');
    for (const marker of ['Play to grow', 'Bharat Yatra', 'Cha-ching!', 'Mera SORA']) assert.ok(!bundle.includes(marker), `${marker} leaked into bundle.js`);
  }
});
test('badges: names joined to server numbers, earned first, unknown ids dropped, progress clamped', () => {
  const list = g.badgeList({ badges: [{ id: 'ten_sales', progress: 4, target: 10 }, { id: 'first_sale', progress: 1, target: 1 }, { id: 'hack', progress: 9, target: 1 }, { id: 'states_5', progress: 99, target: 5 }] });
  assert.equal(list.length, g.BADGES.length);
  assert.ok(!list.some((b) => b.id === 'hack'));
  assert.deepEqual(list.slice(0, 2).map((b) => b.id).sort(), ['first_sale', 'states_5']);
  assert.equal(list.find((b) => b.id === 'states_5').progress, 5);
  assert.equal(list.find((b) => b.id === 'ten_sales').fraction, 0.4);
  assert.equal(g.badgeList(null).filter((b) => b.earned).length, 0);
});
test('Bharat Yatra: 36 tiles, unique codes and places, free-text states resolve, unknown ones are ignored', () => {
  assert.equal(g.STATE_TILES.length, 36);
  assert.equal(new Set(g.STATE_TILES.map((t) => t.code)).size, 36);
  assert.equal(new Set(g.STATE_TILES.map((t) => `${t.c},${t.r}`)).size, 36, 'no two tiles overlap');
  assert.equal(g.stateCode('Andaman and Nicobar Islands'), 'AN');
  assert.equal(g.stateCode(' orissa '), 'OD');
  assert.equal(g.stateCode('Jammu & Kashmir'), 'JK');
  assert.equal(g.stateCode('NCT of Delhi'), 'DL');
  assert.equal(g.stateCode('Atlantis'), null);
  const y = g.yatraTiles([{ state: 'Punjab', orders: 4 }, { state: 'punjab', orders: 1 }, { state: 'Kerala', orders: 1 }, { state: 'Mars', orders: 9 }]);
  assert.equal(y.visited, 2);
  assert.equal(y.tiles.find((t) => t.code === 'PB').orders, 5);
  assert.equal(y.tiles.find((t) => t.code === 'PB').heat, 1);
});
test('cha-ching: the first visit celebrates nothing; later only newer sales, newest first', () => {
  const store = {}; const read_ = (k) => (k in store ? store[k] : null); const write = (k, v) => { store[k] = v; };
  const recent = [{ id: 'a', at: '2026-11-20T10:00:00Z' }, { id: 'b', at: '2026-11-21T10:00:00Z' }];
  const first = g.unseenSales(recent, 'cr', read_);
  assert.equal(first.first, true); assert.equal(first.fresh.length, 0);
  g.markSeen('cr', first.newest, write);
  assert.equal(g.unseenSales(recent, 'cr', read_).fresh.length, 0);
  const more = [...recent, { id: 'c', at: '2026-11-22T09:00:00Z' }, { id: 'd', at: '2026-11-22T10:00:00Z' }];
  assert.deepEqual(g.unseenSales(more, 'cr', read_).fresh.map((r) => r.id), ['d', 'c']);
  assert.deepEqual(g.unseenSales([], 'cr', read_).fresh, []);
});
test('cha-ching shows a state and the creator’s own commission — never a customer’s name or city', () => {
  const cc = read('src/components/creator/ChaChing.jsx');
  assert.match(cc, /r\.state/); assert.doesNotMatch(cc, /r\.(city|name|email|phone)\b/);
  const recentBlock = sql.slice(sql.indexOf("'recent'") - 2000, sql.indexOf("'recent'"));
  assert.doesNotMatch(sql, /customer->>'(firstName|lastName|email|phone|address|pin)'/);
  assert.match(sql, /'state', nullif\(btrim\(o\.customer->>'state'\), ''\)/);
  assert.ok(recentBlock.length > 0);
});
test('the game only reads money tables: no insert/update/delete on ledger, conversions, payouts or KYC', () => {
  for (const t of ['creator_commission_ledger', 'creator_conversions', 'creator_payout_requests', 'creator_kyc_profiles', 'creator_reward_claims']) {
    assert.doesNotMatch(sql, new RegExp(`(insert into|update|delete from)\\s+public\\.${t}\\b`, 'i'), t);
  }
  assert.match(sql, /c\.status = 'eligible'/, 'only paid, non-self-referred sales count');
});
test('functions are scoped: my_creator_game / claim_vanity_code for signed-in creators, product_discoverer public name only', () => {
  assert.match(sql, /revoke all on function public\.my_creator_game\(\) from public, anon;\ngrant execute on function public\.my_creator_game\(\) to authenticated;/);
  assert.match(sql, /revoke all on function public\.claim_vanity_code\(text\) from public, anon;/);
  assert.match(sql, /grant execute on function public\.product_discoverer\(text\) to anon, authenticated, service_role;/);
  const disc = sql.slice(sql.indexOf('create or replace function public.product_discoverer'));
  assert.match(disc, /select jsonb_build_object\('name', p\.display_name\)/);
  assert.doesNotMatch(disc, /email|phone|legal_name|creator_code/);
  for (const helper of ['creator_game_month(uuid, date)', 'creator_game_league(integer)']) assert.match(sql, new RegExp(`revoke all on function public\\.${helper.replace(/[()]/g, '\\$&')} from public, anon, authenticated;`));
});
test('custom code: Elite only, 30-day cooldown, reserved/offensive/taken refused, old code kept as an alias', () => {
  const v = sql.slice(sql.indexOf('create or replace function public.claim_vanity_code'), sql.indexOf('create or replace function public.product_discoverer'));
  assert.match(v, /if v_level < 5 then return jsonb_build_object\('ok', false, 'reason', 'level_locked'/);
  assert.match(v, /interval '30 days'/);
  assert.match(v, /creator_code_aliases where code = v_new/);
  assert.match(v, /public\.coupons where upper\(code\) = v_new/);
  assert.match(v, /insert into public\.creator_code_aliases \(creator_id, code\) values \(v_cid, v_old\)/);
  assert.equal(g.vanityProblem('ab'), 'At least 4 characters.');
  assert.equal(g.vanityProblem('GHEE--QUEEN'), 'Letters, numbers and single hyphens only.');
  assert.equal(g.vanityProblem('1234'), 'Needs at least one letter.');
  assert.equal(g.vanityProblem('gheequeen'), null);
});
test('mystery hamper: a reward type in the database and the admin, seeded switched off', () => {
  assert.match(sql, /check \(reward_type in \('product', 'cash', 'other', 'mystery'\)\)/);
  assert.match(sql, /'mystery',[\s\S]*?false\n {2}from public\.creator_tier_levels/);
  const r = loadModule('src/lib/creatorRewards.js', {});
  assert.ok(r.REWARD_TYPES.includes('mystery'));
  assert.equal(r.REWARD_TYPE_LABEL.mystery, 'Mystery hamper');
});
test('Wrapped: the preview and the PNG share one set of lines', () => {
  const l = g.wrappedLines({ month: '2026-11', sales: 1, states: 2, cities: 3, points: 12345, top_product: 'Ghee' }, { name: 'Vikas', rank: 'Elite', league: 'sona', code: 'SORA-VIKAS' });
  assert.equal(l.title, 'Mera SORA November');
  assert.equal(l.bigLabel, 'sale');
  assert.deepEqual(l.rows.find((r) => r[0] === 'League'), ['League', 'Sona League']);
  assert.deepEqual(l.rows.find((r) => r[0] === 'Season points'), ['Season points', '12,345']);
  const page = read('src/components/creator/CreatorGamePage.jsx');
  assert.match(page, /const blob = await drawWrapped\(lines\);/);
  assert.match(page, /lines\.rows\.map/);
});
test('Discoverer on the three product pages: idle, cached, nothing rendered until known', () => {
  const d = read('src/components/Discoverer.jsx');
  assert.match(d, /requestIdleCallback/);
  assert.match(d, /if \(!name\) return null;/);
  assert.match(d, /cache\.set\(key, n\)/);
  for (const f of ['src/pages/Product.jsx', 'src/fashion/FashionProductPage.jsx', 'src/homeliving/HomeLivingProductPage.jsx']) {
    assert.match(read(f), /<Discoverer productId=\{(product|view)\.id\} \/>/, f);
  }
  const m = loadModule('src/components/Discoverer.jsx', { supabase: {}, isSupabaseConfigured: false });
  assert.equal(m.displayName('  vikas   shamra '), 'Vikas Shamra');
});
test('the game CSS is deferred (never render-blocking) and stills for reduced motion', () => {
  const build = read('build/build-css.mjs');
  const deferred = build.slice(build.indexOf('const DEFERRED'), build.indexOf('];', build.indexOf('const DEFERRED')));
  assert.match(deferred, /'src\/styles\/creator-game\.css'/);
  const c = read('src/styles/creator-game.css');
  assert.match(c, /@media \(prefers-reduced-motion: reduce\)/);
  for (const k of c.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\}\s*\n/g)) assert.doesNotMatch(k[1], /\b(width|height|top|left|margin|padding)\s*:/, 'keyframes animate transform/opacity only');
});

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
