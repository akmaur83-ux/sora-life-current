// ============================================================
// Creator tiers, rewards, leaderboard, withdrawals gate — offline suite.
//
// Pure rules, the real JSX rendered with react-dom/server against fixture
// data, and migration 0031 read as text. NO NETWORK, NO DATABASE, NO BROWSER.
//
//   node scripts/test-creator-tiers.mjs
//   SORA_ROOT=<path to a pre-change checkout> node scripts/test-creator-tiers.mjs
//
// The second form proves the suite is not vacuous: every test that depends on
// new code imports it per test, so against the pre-change tree each one fails
// on its own with a reason instead of the whole file crashing at import.
// ============================================================
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';

const ROOT = resolve(process.env.SORA_ROOT || fileURLToPath(new URL('..', import.meta.url)));
const at = (rel) => resolve(ROOT, rel);
const read = (rel) => readFileSync(at(rel), 'utf8').replace(/\r\n/g, '\n');
const mod = async (rel) => { if (!existsSync(at(rel))) throw new Error(`missing ${rel}`); return import(pathToFileURL(at(rel)).href); };

let passed = 0, failed = 0, current = '(startup)';
process.on('unhandledRejection', (e) => { console.error(`\n  FATAL during: ${current}\n  ${e?.stack || e}`); process.exitCode = 1; });
async function test(name, fn) {
  current = name;
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n')[0]}`); failed++; }
}

function component(rel, name, deps = {}) {
  if (!existsSync(at(rel))) throw new Error(`missing ${rel}`);
  const { code } = transformSync(read(rel), {
    configFile: false, babelrc: false,
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    plugins: [() => ({ visitor: {
      ImportDeclaration(path) { path.remove(); },
      ExportDefaultDeclaration(path) { path.replaceWith(path.node.declaration); },
      ExportNamedDeclaration(path) { path.node.declaration ? path.replaceWith(path.node.declaration) : path.remove(); },
    } })],
  });
  const scope = { React, ...React, ...deps };
  return new Function(...Object.keys(scope), `${code}
; return ${name};`)(...Object.values(scope));
}
const h = React.createElement;
const Link = ({ to, children, ...props }) => h('a', { ...props, href: to }, children);
const Icon = () => h('span');
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const money2 = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const M = existsSync(at('supabase/migrations/0031_creator_tiers_rewards_leaderboard.sql')) ? read('supabase/migrations/0031_creator_tiers_rewards_leaderboard.sql') : '';
const fnBody = (name) => {
  const start = M.indexOf(`create or replace function public.${name}(`);
  if (start < 0) throw new Error(`0031: ${name} missing`);
  return M.slice(start, M.indexOf('$$;', start));
};

const LADDER = [
  [1, 'Rise', 0, 10], [2, 'Rise', 10000, 11], [3, 'Premium', 25000, 12], [4, 'Premium', 50000, 13],
  [5, 'Elite', 75000, 14], [6, 'Elite', 100000, 15], [7, 'Royale', 125000, 16], [8, 'Royale', 150000, 17],
  [9, 'Prime', 200000, 18], [10, 'Prime', 250000, 19], [11, 'Supreme', 300000, 21], [12, 'Supreme', 350000, 22],
  [13, 'Crown', 400000, 23], [14, 'Crown', 500000, 25],
].map(([level, rank, threshold, rate]) => ({ level, rank, threshold, rate }));

// ============================================================
console.log('\n— 1. Tier resolution at every boundary —');
// ============================================================

await test('exactly on a threshold is that level; one rupee under is the level below', async () => {
  const { tierForSales } = await mod('src/lib/creatorTiers.js');
  for (const l of LADDER) {
    const on = tierForSales(LADDER, l.threshold);
    assert.equal(on.level, l.level, `on ${l.threshold}`); assert.equal(on.rate, l.rate); assert.equal(on.rank, l.rank);
    if (l.level > 1) {
      const under = tierForSales(LADDER, l.threshold - 1);
      assert.equal(under.level, l.level - 1, `under ${l.threshold}`);
      assert.equal(under.next_threshold, l.threshold); assert.equal(under.next_rate, l.rate); assert.equal(under.next_level, l.level);
    }
    const over = tierForSales(LADDER, l.threshold + 0.01);
    assert.equal(over.level, l.level, `just over ${l.threshold}`);
  }
  assert.equal(tierForSales(LADDER, 0).level, 1);
  assert.equal(tierForSales(LADDER, -5).level, 1, 'negative clamps to 0');
  assert.equal(tierForSales(LADDER, 'nonsense').level, 1);
});

await test('beyond ₹5,00,000: a new level every ₹25,000, rate stays 25%', async () => {
  const { tierForSales } = await mod('src/lib/creatorTiers.js');
  for (const [sales, level] of [[500000, 14], [524999.99, 14], [525000, 15], [549999, 15], [550000, 16], [1000000, 34]]) {
    const t = tierForSales(LADDER, sales, 25000);
    assert.equal(t.level, level, `${sales}`); assert.equal(t.rate, 25); assert.equal(t.rank, 'Crown');
    assert.equal(t.next_level, level + 1); assert.equal(t.next_threshold, 500000 + (level - 14 + 1) * 25000); assert.equal(t.next_rate, 25);
  }
  const stop = tierForSales(LADDER, 900000, 0);
  assert.equal(stop.level, 14); assert.equal(stop.next_threshold, null, 'beyond_step 0 stops the ladder');
});

await test('an empty ladder or one that starts above ₹0 still resolves sanely', async () => {
  const { tierForSales } = await mod('src/lib/creatorTiers.js');
  assert.deepEqual(tierForSales([], 5000), { level: 1, rank: 'Rise', rate: 10, threshold: 0, next_level: null, next_threshold: null, next_rate: null, configured: false });
  const t = tierForSales([{ level: 1, rank: 'Start', threshold: 1000, rate: 8 }], 500);
  assert.equal(t.level, 1); assert.equal(t.rate, 8); assert.equal(t.next_threshold, 1000);
});

await test('the SQL resolver is the same rule: threshold <= sales, highest level wins, beyond formula', () => {
  const b = fnBody('creator_tier_for_sales');
  assert.match(b, /where threshold <= v_sales\s+order by level desc limit 1/);
  assert.match(b, /v_n := floor\(\(v_sales - v_top\.threshold\) \/ v_step\)/);
  assert.match(b, /'level', v_top\.level \+ v_n/);
  assert.match(b, /'next_threshold', v_top\.threshold \+ \(v_n \+ 1\) \* v_step/);
  assert.match(b, /greatest\(coalesce\(p_sales, 0\), 0\)/, 'negative sales clamp');
});

await test('progress copy: remaining rupees and fraction, capped at the top', async () => {
  const { tierProgress } = await mod('src/lib/creatorTiers.js');
  const p = tierProgress({ lifetime_confirmed_sales: 12500, threshold: 10000, next_threshold: 25000 });
  assert.equal(p.remaining, 12500); assert.ok(Math.abs(p.fraction - (2500 / 15000)) < 1e-9); assert.equal(p.atTop, false);
  assert.deepEqual(tierProgress({ lifetime_confirmed_sales: 999999, threshold: 500000, next_threshold: null }), { fraction: 1, remaining: 0, from: 500000, to: null, atTop: true });
  assert.equal(tierProgress({ lifetime_confirmed_sales: 25000, threshold: 25000, next_threshold: 50000 }).fraction, 0, 'exactly on a threshold starts the next bar at 0');
});

// ============================================================
console.log('\n— 2. The rate is snapshotted on the ledger row; a later ladder change cannot touch it —');
// ============================================================

await test('the commission trigger resolves the tier at earn time and writes it onto the row', () => {
  const b = fnBody('creator_conversion_commission_sync');
  assert.match(b, /v_lifetime := public\.creator_confirmed_sales_total\(new\.creator_id\)/);
  assert.match(b, /v_tier := public\.creator_tier_for_sales\(v_lifetime\)/);
  assert.match(b, /greatest\(coalesce\(\(v_tier->>'rate'\)::numeric, 0\),\s*coalesce\(\(select default_commission_rate from public\.creator_partners where id = new\.creator_id\), 0\)\)/);
  assert.match(b, /commission_rate, eligible_sales, available_at, metadata[\s\S]*?v_rate, new\.eligible_sales/);
  assert.match(b, /'tier_level', \(v_tier->>'level'\)::int, 'tier_rank', v_tier->>'rank', 'tier_rate'/);
});

await test('nothing in 0031 rewrites commission_rate on an existing row; the ladder RPC never touches the ledger', () => {
  assert.doesNotMatch(M, /set\s+commission_rate\s*=/i);
  const ladder = fnBody('admin_set_creator_tier_levels');
  assert.doesNotMatch(ladder, /creator_commission_ledger/);
  assert.doesNotMatch(ladder, /creator_conversions/);
  assert.match(ladder, /delete from public\.creator_tier_levels;/);
});

await test('simulation: a row recorded at 10% keeps 10% after the ladder is changed and the creator climbs', async () => {
  const { tierForSales } = await mod('src/lib/creatorTiers.js');
  const ledger = [];
  const record = (ladder, lifetime, sale) => { const t = tierForSales(ladder, lifetime); ledger.push(Object.freeze({ sale, commission_rate: t.rate, amount: +(sale * t.rate / 100).toFixed(2) })); };
  record(LADDER, 0, 5000);                // level 1
  record(LADDER, 30000, 5000);            // level 3
  const generous = LADDER.map((l) => ({ ...l, rate: l.rate + 5 }));
  record(generous, 60000, 5000);          // level 4 on the new ladder
  assert.deepEqual(ledger.map((r) => r.commission_rate), [10, 12, 18]);
  assert.deepEqual(ledger.map((r) => r.amount), [500, 600, 900]);
  assert.throws(() => { ledger[0].commission_rate = 99; }, TypeError, 'rows are immutable once written');
});

// ============================================================
console.log('\n— 3. Pending → confirmed; a return reverses before payment —');
// ============================================================

await test('a new commission row has no available_at until the order is delivered', () => {
  const b = fnBody('creator_conversion_commission_sync');
  assert.match(b, /select delivered_at into v_delivered from public\.orders where id = new\.order_id/);
  assert.match(b, /case when v_delivered is not null then v_delivered \+ make_interval\(days => v_hold\) else null end/);
  assert.doesNotMatch(b, /coalesce\(new\.qualified_at, now\(\)\) \+ make_interval/, 'the old payment-based clock is gone');
});

await test('delivery starts the hold on every held row for that order; fulfilment cancel cancels the conversion', () => {
  const b = fnBody('creator_order_fulfillment_sync');
  assert.match(b, /new\.delivered_at is not null and new\.delivered_at is distinct from old\.delivered_at/);
  assert.match(b, /set available_at = new\.delivered_at \+ make_interval\(days => v_hold\)[\s\S]*?where order_id = new\.id and status = 'held' and payout_id is null[\s\S]*?type in \('commission', 'reversal'\)/);
  assert.match(b, /new\.fulfillment_status = 'cancelled' and old\.fulfillment_status is distinct from 'cancelled'/);
  assert.match(b, /v_conv\.status in \('pending', 'eligible'\)[\s\S]*?set status = 'cancelled', cancelled_at = now\(\)/);
  assert.match(M, /create trigger creator_order_fulfillment_sync\s+after update of delivered_at, fulfillment_status on public\.orders/);
});

await test('a reversal during the hold matures with its commission and is deducted by request_payout', () => {
  const sync = fnBody('creator_conversion_commission_sync');
  assert.match(sync, /'reversal', v_bucket, -v_delta, v_ccl\.currency,[\s\S]*?case when v_bucket = 'held' then v_ccl\.available_at else null end/);
  const rp = fnBody('request_payout');
  assert.match(rp, /where creator_id = v_cid and type in \('commission', 'reversal'\) and status = 'held'\s+and available_at is not null and available_at <= now\(\)/);
  assert.match(M, /update public\.creator_commission_ledger r\s+set available_at = c\.available_at[\s\S]*?r\.type = 'reversal' and r\.status = 'held' and r\.available_at is null/, 'historical held reversals are repaired');
  // The existing full-cancel path is kept verbatim: reversed before any payout.
  assert.match(sync, /new\.status in \('cancelled','reversed'\) and old\.status not in \('cancelled','reversed'\)[\s\S]*?set status = 'reversed'[\s\S]*?status in \('held','available'\)/);
});

// ============================================================
console.log('\n— 4. Only confirmed sales count —');
// ============================================================

await test('confirmed = conversion still eligible AND its commission row has matured; reversed rows excluded', () => {
  const b = fnBody('creator_confirmed_sales_rows');
  assert.match(b, /c\.status = 'eligible'/);
  assert.match(b, /l\.status in \('held', 'available', 'reserved', 'paid'\)/);
  assert.match(b, /l\.available_at is not null and l\.available_at <= now\(\)/);
  assert.match(b, /l\.type = 'commission'/);
  assert.match(b, /select c\.id, c\.eligible_sales, l\.available_at/, 'post-refund eligible_sales, not the original');
});

await test('tier, rewards and leaderboard all read the same confirmed figure', () => {
  assert.match(fnBody('creator_conversion_commission_sync'), /creator_confirmed_sales_total\(new\.creator_id\)/);
  assert.match(fnBody('my_creator_standing'), /v_lifetime := public\.creator_confirmed_sales_total\(v_cid\)/);
  assert.match(fnBody('claim_level_reward'), /creator_tier_for_sales\(public\.creator_confirmed_sales_total\(v_cid\)\)/);
  assert.match(fnBody('my_creator_rewards'), /creator_tier_for_sales\(public\.creator_confirmed_sales_total\(v_cid\)\)/);
  const lb = fnBody('creator_leaderboard_rows');
  assert.match(lb, /c\.status = 'eligible'[\s\S]*?l\.status in \('held', 'available', 'reserved', 'paid'\)[\s\S]*?l\.available_at is not null and l\.available_at <= now\(\)/);
  assert.match(lb, /having sum\(eligible_sales\) > 0/, 'zero confirmed sales never appears');
  assert.match(lb, /order by t\.lifetime desc, re\.reached_at asc nulls last/, 'ties go to whoever reached the level first');
});

// ============================================================
console.log('\n— 5. Rewards: three options, once per level, nothing when none configured —');
// ============================================================

await test('the schema allows three slots per level and one claim per creator per level', () => {
  assert.match(M, /option_index integer not null check \(option_index between 1 and 3\)/);
  assert.match(M, /constraint creator_level_rewards_slot_uk unique \(level, option_index\)/);
  assert.match(M, /constraint creator_reward_claims_level_uk unique \(creator_id, level\)/);
  const claim = fnBody('claim_level_reward');
  assert.match(claim, /'level_locked'/); assert.match(claim, /'bad_reward'/); assert.match(claim, /'already_claimed'/);
  assert.match(claim, /exception when unique_violation then[\s\S]*?'already_claimed'/, 'a race on the unique index is a handled reason');
  assert.match(claim, /v_reward\.level <> p_level or not v_reward\.is_active/);
  const st = fnBody('admin_set_reward_claim_status');
  assert.match(st, /if v\.status <> 'pending' then return jsonb_build_object\('ok', false, 'reason', 'terminal'/);
  assert.match(M, /revoke insert, update, delete, truncate on table public\.creator_reward_claims from anon, authenticated/);
});

await test('claimableLevels offers only levels with at least one option, up to three, in order', async () => {
  const { claimableLevels } = await mod('src/lib/creatorRewards.js');
  const r = claimableLevels({ claimable: [
    { level: 3, rank: 'Premium', options: [{ id: 'c', option_index: 3, label: 'C' }, { id: 'a', option_index: 1, label: 'A' }, { id: 'b', option_index: 2, label: 'B' }, { id: 'd', option_index: 4, label: 'D' }] },
    { level: 1, rank: 'Rise', options: [] },
    { level: 2, rank: 'Rise', options: [{ id: 'x', option_index: 1, label: '   ' }] },
  ] });
  assert.deepEqual(r.map((l) => l.level), [3]);
  assert.deepEqual(r[0].options.map((o) => o.id), ['a', 'b', 'c']);
  assert.deepEqual(claimableLevels(null), []);
});

await test('RewardChooser: three option cards for an unlocked level; nothing at all when none are configured', async () => {
  const rules = await mod('src/lib/creatorRewards.js');
  const tiers = await mod('src/lib/creatorTiers.js');
  const LeaderboardList = () => null;
  const Chooser = component('src/components/creator/CreatorTier.jsx', 'RewardChooser', { Link, Icon, LeaderboardList, money2, ...tiers, ...rules });
  const none = renderToStaticMarkup(h(Chooser, { rewards: { ok: true, level: 4, claims: [], claimable: [] }, onClaim: async () => ({ ok: true }), onChanged: async () => {} }));
  assert.equal(none, '', 'no prompt, no empty card');
  const three = renderToStaticMarkup(h(Chooser, { rewards: { ok: true, level: 2, claims: [], claimable: [
    { level: 2, rank: 'Rise', options: [
      { id: 'o1', option_index: 1, label: 'Gift box', reward_type: 'product', value: 'Sora Life starter set', description: 'Five products.' },
      { id: 'o2', option_index: 2, label: 'Cash', reward_type: 'cash', value: '₹1,000' },
      { id: 'o3', option_index: 3, label: 'Feature', reward_type: 'other', value: 'Homepage feature for a week' },
    ] },
  ] }, onClaim: async () => ({ ok: true }), onChanged: async () => {} }));
  assert.equal((three.match(/class="ctier-option"/g) || []).length, 3);
  assert.match(text(three), /Level 2 reward · Rise/); assert.match(text(three), /Choose one/);
  assert.equal((three.match(/>Choose</g) || []).length, 3);
  assert.match(three, /data-rank="rise"/);
  assert.match(text(three), /the choice is final once made/);
});

await test('RewardHistory lists claims with status; nothing when there are none', async () => {
  const rules = await mod('src/lib/creatorRewards.js');
  const tiers = await mod('src/lib/creatorTiers.js');
  const History = component('src/components/creator/CreatorTier.jsx', 'RewardHistory', { Link, Icon, LeaderboardList: () => null, money2, ...tiers, ...rules });
  assert.equal(renderToStaticMarkup(h(History, { rewards: { claims: [] } })), '');
  const html = renderToStaticMarkup(h(History, { rewards: { claims: [
    { id: 'k1', level: 2, label: 'Gift box', value: 'Starter set', status: 'fulfilled', claimed_at: '2026-09-01T00:00:00Z' },
    { id: 'k2', level: 3, label: 'Cash', value: '₹1,000', status: 'pending', claimed_at: '2026-09-10T00:00:00Z' },
  ] } }));
  assert.match(text(html), /Level 3.*Cash.*Pending/); assert.match(text(html), /Level 2.*Gift box.*Fulfilled/);
  assert.ok(html.indexOf('Level 3') < html.indexOf('Level 2'), 'newest level first');
});

await test('validateRewardOption mirrors the table checks; the upsert row omits untouched keys', async () => {
  const { validateRewardOption, rewardOptionRow } = await mod('src/lib/creatorRewards.js');
  assert.equal(validateRewardOption({ level: 2, option_index: 1, label: 'A', reward_type: 'cash' }).ok, true);
  assert.equal(validateRewardOption({ level: 0, option_index: 1, label: 'A', reward_type: 'cash' }).reason, 'bad_level');
  assert.equal(validateRewardOption({ level: 2, option_index: 4, label: 'A', reward_type: 'cash' }).reason, 'bad_slot');
  assert.equal(validateRewardOption({ level: 2, option_index: 1, label: ' ', reward_type: 'cash' }).reason, 'bad_label');
  assert.equal(validateRewardOption({ level: 2, option_index: 1, label: 'x'.repeat(121), reward_type: 'cash' }).reason, 'bad_label');
  assert.equal(validateRewardOption({ level: 2, option_index: 1, label: 'A', reward_type: 'crypto' }).reason, 'bad_type');
  const row = rewardOptionRow({ level: 2, option_index: 1, label: ' A ', reward_type: 'cash' });
  assert.deepEqual(Object.keys(row).sort(), ['label', 'level', 'option_index', 'reward_type'], 'description/value/is_active ABSENT when untouched');
  assert.equal(row.label, 'A');
  const full = rewardOptionRow({ id: 'r1', level: 2, option_index: 1, label: 'A', reward_type: 'cash', description: '', value: '₹500', is_active: false });
  assert.equal(full.id, 'r1'); assert.equal(full.description, null); assert.equal(full.value, '₹500'); assert.equal(full.is_active, false);
});

// ============================================================
console.log('\n— 6. Leaderboard: exactly 100, name/rank/level only, no figures —');
// ============================================================

await test('creator_leaderboard() returns four columns, caps at 100, and is the only public function; the rows function is closed', () => {
  assert.match(M, /create or replace function public\.creator_leaderboard\(p_limit integer default 100\)\s+returns table \(rank_position integer, display_name text, rank_name text, level integer\)/);
  assert.match(fnBody('creator_leaderboard'), /limit least\(greatest\(coalesce\(p_limit, 100\), 1\), 100\)/);
  assert.match(M, /grant execute on function public\.creator_leaderboard\(integer\) to anon, authenticated, service_role/);
  assert.match(M, /revoke all on function public\.creator_leaderboard_rows\(\) from public, anon, authenticated/);
  assert.match(M, /revoke all on function public\.creator_confirmed_sales_rows\(uuid\) from public, anon, authenticated/);
  assert.match(M, /revoke all on function public\.creator_confirmed_sales_total\(uuid\) from public, anon, authenticated/);
  // No table policy exposes conversions or the ledger to anon.
  assert.doesNotMatch(M, /create policy[^;]*on public\.creator_(conversions|commission_ledger)/);
  const grants = [...M.matchAll(/grant execute on function public\.(\w+)\([^)]*\) to ([^;]+);/g)].filter((m) => m[2].includes('anon'));
  assert.deepEqual(grants.map((m) => m[1]), ['creator_leaderboard'], 'the only function anon can execute');
});

await test('sanitizeLeaderboard keeps four fields, drops everything else, caps at 100, orders by position', async () => {
  const { sanitizeLeaderboard, LEADERBOARD_FIELDS } = await mod('src/lib/creatorTiers.js');
  const rows = Array.from({ length: 120 }, (_, i) => ({ rank_position: 120 - i, display_name: `Creator ${120 - i}`, rank_name: 'Rise', level: 1, lifetime: 99999, earnings: 4200, creator_id: 'x' }));
  const out = sanitizeLeaderboard(rows);
  assert.equal(out.length, 100);
  assert.deepEqual(Object.keys(out[0]).sort(), [...LEADERBOARD_FIELDS].sort());
  assert.equal(out[0].rank_position, 1); assert.equal(out[99].rank_position, 100);
  assert.deepEqual(sanitizeLeaderboard([{ rank_position: 0, display_name: 'x', rank_name: 'Rise', level: 1 }, { rank_position: 1, display_name: '', rank_name: 'Rise', level: 1 }, null]), []);
});

await test('HomeLeaderboard renders 100 rows with names, ranks and levels — and not a single rupee figure', async () => {
  const tiers = await mod('src/lib/creatorTiers.js');
  const LeaderboardList = component('src/components/LeaderboardList.jsx', 'LeaderboardList', { ...tiers });
  const Home = component('src/components/HomeLeaderboard.jsx', 'HomeLeaderboard', { Link, LeaderboardList, getCreatorLeaderboard: async () => [] });
  const ranks = ['Rise', 'Premium', 'Elite', 'Royale', 'Prime', 'Supreme', 'Crown'];
  const rows = Array.from({ length: 100 }, (_, i) => ({ rank_position: i + 1, display_name: `Creator ${i + 1}`, rank_name: ranks[i % 7], level: 14 - (i % 14), lifetime: 123456.78 }));
  const html = renderToStaticMarkup(h(Home, { rows }));
  assert.match(html, /hm-leaderboard sl-dark/);
  assert.equal((html.match(/class="lb__row/g) || []).length, 20, 'top 20 open by default');
  assert.match(html, /data-count="100"/);
  assert.match(text(html), /Show all 100/);
  assert.doesNotMatch(html, /₹|123456|123,456|\.78/, 'no currency, no fixture figure');
  assert.match(html, /data-rank="crown"/); assert.match(html, /class="lb__rank">Crown</);
  assert.match(html, /class="lb__level">L14</);
  assert.equal((html.match(/is-podium/g) || []).length, 3);
  assert.doesNotMatch(html, /is-me/, 'the public board never marks a viewer');
  assert.match(text(html), /Names, ranks and levels only/);
});

await test('HomeLeaderboard renders nothing with no rows; the list component hides a stray field it was handed', async () => {
  const tiers = await mod('src/lib/creatorTiers.js');
  const LeaderboardList = component('src/components/LeaderboardList.jsx', 'LeaderboardList', { ...tiers });
  const Home = component('src/components/HomeLeaderboard.jsx', 'HomeLeaderboard', { Link, LeaderboardList, getCreatorLeaderboard: async () => [] });
  assert.equal(renderToStaticMarkup(h(Home, { rows: [] })), '');
  const html = renderToStaticMarkup(h(LeaderboardList, { rows: [{ rank_position: 1, display_name: 'A', rank_name: 'Rise', level: 1, lifetime: 777777 }] }));
  assert.doesNotMatch(html, /777/);
});

await test('the homepage mounts the board last and the CSS closes the seam into the footer', () => {
  const home = read('src/pages/Home.jsx');
  assert.match(home, /<Newsletter \/>[\s\S]*<HomeLeaderboard \/>\s*<\/div>/);
  const css = read('src/styles/leaderboard.css');
  assert.match(css, /\.v2-home:has\(\.hm-leaderboard\) \{ padding-bottom: 0; \}/);
  assert.match(css, /\.page-main:has\(\.hm-leaderboard\) \+ \.ftr \{ margin-top: 0;/);
  assert.match(read('build/build-css.mjs'), /'src\/styles\/leaderboard\.css'/);
  assert.match(read('build/build-css.mjs'), /'src\/styles\/creator-tier\.css'/);
  // Transform/opacity only: no box-shadow animation, no backdrop-filter, no gradient.
  for (const file of ['src/styles/leaderboard.css', 'src/styles/creator-tier.css']) {
    const c = read(file);
    assert.doesNotMatch(c, /backdrop-filter|linear-gradient|radial-gradient|box-shadow/, `${file}`);
    for (const m of c.matchAll(/transition:([^;]+);/g)) {
      for (const part of m[1].replace(/cubic-bezier\([^)]*\)/g, 'ease').split(',')) assert.match(part.trim(), /^(transform|opacity|border-color|none)\b/, `${file}: ${part.trim()}`);
    }
  }
});

// ============================================================
console.log('\n— 7. Withdrawals stay closed —');
// ============================================================

await test('request_payout refuses with withdrawals_closed before it locks anything; the flag defaults to closed', () => {
  const rp = fnBody('request_payout');
  const gate = rp.indexOf("'withdrawals_closed'");
  assert.ok(gate > 0);
  assert.ok(gate < rp.indexOf('for update'), 'the gate runs before the row locks');
  assert.ok(gate < rp.indexOf("'kyc_required'"), 'and before KYC, so the reason is the real one');
  assert.match(rp, /if not coalesce\(\(public\.creator_payout_config\(\)->>'withdrawals_open'\)::boolean, false\) then/);
  assert.match(M, /jsonb_build_object\('withdrawals_open', false\)\s+where key = 'creator_payouts' and not \(value \? 'withdrawals_open'\)/);
  assert.match(fnBody('admin_set_withdrawals_open'), /if not public\.is_sora_admin\(\) then raise exception/);
});

await test('the portal says it up front: notice on earnings and payouts, no request button while closed', async () => {
  const tiers = await mod('src/lib/creatorTiers.js');
  const rules = await mod('src/lib/creatorRewards.js');
  const Notice = component('src/components/creator/CreatorTier.jsx', 'WithdrawalsNotice', { Link, Icon, LeaderboardList: () => null, money2, ...tiers, ...rules });
  const closed = renderToStaticMarkup(h(Notice, { open: false }));
  assert.match(closed, /data-withdrawals="closed"/); assert.match(text(closed), /Withdrawals aren’t open yet/); assert.match(text(closed), /commission is accruing/);
  assert.equal(renderToStaticMarkup(h(Notice, { open: true })), '');

  const portal = read('src/pages/CreatorPortal.jsx');
  assert.match(portal, /\{tab === 'earnings' && \(\s*<>\s*<WithdrawalsNotice open=\{!!standing\?\.withdrawals_open\} \/>/, 'first thing on the earnings screen');
  assert.match(portal, /withdrawalsOpen=\{!!standing\?\.withdrawals_open\}/);

  const kycRules = await mod('src/lib/kycDocuments.js');
  const Payouts = component('src/components/creator/CreatorPayouts.jsx', 'CreatorPayouts', { Icon, money2, WithdrawalsNotice: Notice, ...kycRules });
  const today = new Date().getDate();
  const props = {
    creator: { id: 'c' }, kyc: { identity_status: 'verified' }, payouts: [],
    earnings: { available: 5000, min_payout: 500, payout_day: today, settlement_hold_days: 7 },
    onSubmitKyc: async () => ({ ok: true }), onUploadKycDocument: async () => ({ ok: true }), onRequestPayout: async () => ({ ok: true }), onChanged: async () => {},
  };
  const shut = renderToStaticMarkup(h(Payouts, { ...props, withdrawalsOpen: false }));
  assert.match(text(shut), /Withdrawals open later/); assert.doesNotMatch(text(shut), /Request payout/);
  const open = renderToStaticMarkup(h(Payouts, { ...props, withdrawalsOpen: true }));
  assert.match(text(open), /Request payout · ₹5,000\.00/, 'same creator, same day: the button is back once open');
  assert.match(read('src/components/creator/CreatorPayouts.jsx'), /withdrawals_closed: 'Withdrawals aren’t open yet/);
});

await test('the admin gate is one clearly labelled control on the Payouts page', () => {
  const src = read('src/admin/pages/Payouts.jsx');
  assert.match(src, /adminSetWithdrawalsOpen\(open\)/);
  assert.match(src, /Creator withdrawals: <strong>/);
  assert.match(src, /'Close withdrawals' : 'Open withdrawals'/);
  assert.match(src, /window\.confirm\(`\$\{verb\} creator withdrawals\?/);
  assert.match(read('src/lib/creatorApi.js'), /rpc\('admin_set_withdrawals_open', \{ p_open: !!open \}\)/);
});

// ============================================================
console.log('\n— 8. Portal: standing, progress, position —');
// ============================================================

const standingFixture = {
  ok: true, level: 3, rank: 'Premium', rate: 12, threshold: 25000, next_level: 4, next_threshold: 50000, next_rate: 13,
  lifetime_confirmed_sales: 31250, pending_sales: 4000, pending_commission: 480, confirmed_commission: 3610.25,
  leaderboard_position: 7, leaderboard_total: 42, withdrawals_open: false, beyond_step: 25000,
  ladder: LADDER.map((l) => ({ level: l.level, rank: l.rank, threshold: l.threshold, rate: l.rate })),
};

await test('TierStanding shows rank, level, rate, the four figures, position and the distance to the next level', async () => {
  const tiers = await mod('src/lib/creatorTiers.js');
  const rules = await mod('src/lib/creatorRewards.js');
  const Standing = component('src/components/creator/CreatorTier.jsx', 'TierStanding', { Link, Icon, LeaderboardList: () => null, money2, CountUp: ({ value, format }) => h('span', { className: 'ck-count' }, format(value)), ...tiers, ...rules });
  const html = renderToStaticMarkup(h(Standing, { standing: standingFixture }));
  const t = text(html);
  assert.match(html, /class="ctier sl-dark" data-rank="premium"/);
  assert.match(t, /Premium/); assert.match(t, /Premium L3 12% commission on new sales/, 'rank badge + rate line');
  assert.match(html, /class="ck-rank is-sm is-current" data-rank="premium"/);
  assert.match(t, /₹18,750 more in confirmed sales to Level 4 · unlocks 13%/);
  assert.match(html, /transform:scaleX\(0\.25\)/, 'progress bar is a transform');
  assert.match(t, /Lifetime confirmed sales ₹31,250\.00/); assert.match(t, /Pending commission ₹480\.00/);
  assert.match(t, /Confirmed commission ₹3,610\.25/); assert.match(t, /Awaiting confirmation ₹4,000\.00/);
  assert.match(t, /#7 of 42/);
  assert.match(html, /aria-valuenow="25"/);
  assert.equal(renderToStaticMarkup(h(Standing, { standing: { ok: false } })), '');
});

await test('at the top of the ladder the bar is full and the copy says so; no position before the first confirmed sale', async () => {
  const tiers = await mod('src/lib/creatorTiers.js');
  const rules = await mod('src/lib/creatorRewards.js');
  const Standing = component('src/components/creator/CreatorTier.jsx', 'TierStanding', { Link, Icon, LeaderboardList: () => null, money2, CountUp: ({ value, format }) => h('span', { className: 'ck-count' }, format(value)), ...tiers, ...rules });
  const top = renderToStaticMarkup(h(Standing, { standing: { ...standingFixture, level: 14, rank: 'Crown', rate: 25, threshold: 500000, next_level: null, next_threshold: null, next_rate: null, lifetime_confirmed_sales: 612000 } }));
  assert.match(text(top), /Top of the ladder — 25% on every new sale/); assert.match(top, /scaleX\(1\)/);
  const fresh = renderToStaticMarkup(h(Standing, { standing: { ...standingFixture, level: 1, rank: 'Rise', rate: 10, threshold: 0, next_level: 2, next_threshold: 10000, next_rate: 11, lifetime_confirmed_sales: 0, leaderboard_position: null, leaderboard_total: 0 } }));
  assert.match(text(fresh), /after your first confirmed sale/); assert.match(text(fresh), /₹10,000 more in confirmed sales to Level 2/);
});

await test('the portal board marks the creator\'s own row by position and never by name', async () => {
  const tiers = await mod('src/lib/creatorTiers.js');
  const rules = await mod('src/lib/creatorRewards.js');
  const LeaderboardList = component('src/components/LeaderboardList.jsx', 'LeaderboardList', { ...tiers });
  const Board = component('src/components/creator/CreatorTier.jsx', 'PortalLeaderboard', { Link, Icon, LeaderboardList, money2, ...tiers, ...rules });
  const rows = Array.from({ length: 12 }, (_, i) => ({ rank_position: i + 1, display_name: i === 6 ? 'Anjali' : 'Anjali', rank_name: 'Rise', level: 2 }));
  const html = renderToStaticMarkup(h(Board, { rows, standing: standingFixture }));
  assert.equal((html.match(/is-me/g) || []).length, 1, 'exactly one row is marked even though every name is identical');
  assert.match(html, /class="lb__row is-me" data-rank="rise" aria-current="true"><span class="lb__pos">07<\/span>/);
  assert.match(text(html), /You’re #7 of 42/);
  const out = renderToStaticMarkup(h(Board, { rows, standing: { ...standingFixture, leaderboard_position: 140, leaderboard_total: 200 } }));
  assert.doesNotMatch(out, /is-me/); assert.match(text(out), /outside the top 100/);
  const empty = renderToStaticMarkup(h(Board, { rows: [], standing: { ...standingFixture, leaderboard_position: null } }));
  assert.match(text(empty), /The board opens with the first confirmed sale/);
});

await test('the portal has a tier tab and loads standing, rewards and the board with everything else', () => {
  const portal = read('src/pages/CreatorPortal.jsx');
  assert.match(portal, /\{ id: 'tier', label: 'My tier', icon: 'star' \}/);
  assert.match(portal, /getMyCreatorStanding\(\), getMyCreatorRewards\(\), getCreatorLeaderboard\(\)/);
  assert.match(portal, /\{tab === 'tier' && \(\s*<CreatorTier/);
  assert.match(portal, /onClaim=\{claimLevelReward\}/);
  // A claim or a payout refreshes the standing too.
  assert.match(portal, /const reloadMoney = useCallback\(async \(\) => \{[\s\S]*?getMyCreatorStanding\(\), getMyCreatorRewards\(\)/);
});

// ============================================================
console.log('\n— 9. Admin: ladder validation, editors, standings —');
// ============================================================

await test('validateLadder produces the RPC\'s reasons for every bad ladder', async () => {
  const { validateLadder, DEFAULT_LADDER } = await mod('src/lib/creatorTiers.js');
  assert.equal(validateLadder(DEFAULT_LADDER, 25000).ok, true);
  assert.equal(validateLadder([], 25000).reason, 'empty');
  assert.equal(validateLadder(DEFAULT_LADDER, -1).reason, 'bad_beyond_step');
  const l = (patch) => DEFAULT_LADDER.map((x) => ({ ...x, ...(patch[x.level] || {}) }));
  assert.equal(validateLadder(l({ 1: { threshold: 100 } })).reason, 'first_threshold_not_zero');
  assert.equal(validateLadder(l({ 3: { threshold: 10000 } })).reason, 'thresholds_not_ascending');
  assert.equal(validateLadder(l({ 3: { threshold: 9999 } })).reason, 'thresholds_not_ascending');
  assert.equal(validateLadder(l({ 5: { rate: 9 } })).reason, 'rates_not_ascending');
  assert.equal(validateLadder(l({ 5: { rate: 101 } })).reason, 'bad_rate');
  assert.equal(validateLadder(l({ 2: { rank: '' } })).reason, 'bad_rank');
  assert.equal(validateLadder(l({ 2: { threshold: -5 } })).reason, 'bad_threshold');
  assert.equal(validateLadder([{ level: 1, rank: 'A', threshold: 0, rate: 10 }, { level: 3, rank: 'B', threshold: 5, rate: 11 }]).reason, 'levels_not_contiguous');
  assert.equal(validateLadder(l({ 5: { rate: 14 }, 6: { rate: 14 } })).ok, true, 'equal rates on consecutive levels are allowed');
  // Every reason above is a reason the RPC can return.
  const rpc = fnBody('admin_set_creator_tier_levels');
  for (const r of ['empty', 'bad_beyond_step', 'levels_not_contiguous', 'bad_rank', 'bad_threshold', 'first_threshold_not_zero', 'thresholds_not_ascending', 'bad_rate', 'rates_not_ascending']) {
    assert.ok(rpc.includes(`'${r}'`), `RPC lacks reason ${r}`);
  }
});

await test('LadderEditor renders the ladder and refuses a non-ascending edit with the save disabled', async () => {
  const tiers = await mod('src/lib/creatorTiers.js');
  const rules = await mod('src/lib/creatorRewards.js');
  const deps = { ...tiers, ...rules, adminGetTierLadder: async () => ({ levels: [], beyond_step: 25000 }), adminSetTierLadder: async () => ({ ok: true }),
    adminListLevelRewards: async () => [], adminUpsertLevelReward: async () => ({ ok: true }), adminDeleteLevelReward: async () => ({ ok: true }),
    adminListRewardClaims: async () => [], adminSetRewardClaimStatus: async () => ({ ok: true }) };
  const Editor = component('src/admin/pages/CreatorTiers.jsx', 'LadderEditor', deps);
  const ok = renderToStaticMarkup(h(Editor, { onError: () => {}, onFlash: () => {}, initial: { levels: LADDER, beyond_step: 25000 } }));
  assert.equal((ok.match(/<tr data-level=/g) || []).length, 14);
  assert.match(ok, /value="Crown"/); assert.match(ok, /value="500000"/); assert.match(ok, /value="25"/);
  assert.doesNotMatch(ok, /adm-banner err/);
  const bad = LADDER.map((l) => (l.level === 4 ? { ...l, threshold: 20000 } : l));
  const html = renderToStaticMarkup(h(Editor, { onError: () => {}, onFlash: () => {}, initial: { levels: bad, beyond_step: 25000 } }));
  assert.match(text(html), /Each threshold must be higher than the one before \(level 4\)/);
  assert.match(html, /Save ladder<\/button>/); assert.match(html, /<button[^>]*disabled=""[^>]*>Save ladder/);
});

await test('RewardsEditor: three slots per level, empty state when nothing is configured', async () => {
  const tiers = await mod('src/lib/creatorTiers.js');
  const rules = await mod('src/lib/creatorRewards.js');
  const deps = { ...tiers, ...rules, adminGetTierLadder: async () => ({}), adminSetTierLadder: async () => ({}), adminListLevelRewards: async () => [],
    adminUpsertLevelReward: async () => ({ ok: true }), adminDeleteLevelReward: async () => ({ ok: true }), adminListRewardClaims: async () => [], adminSetRewardClaimStatus: async () => ({ ok: true }) };
  const Editor = component('src/admin/pages/CreatorTiers.jsx', 'RewardsEditor', deps);
  assert.match(text(renderToStaticMarkup(h(Editor, { onError: () => {}, onFlash: () => {}, initial: [] }))), /No rewards configured yet/);
  const html = renderToStaticMarkup(h(Editor, { onError: () => {}, onFlash: () => {}, initial: [
    { id: 'a', level: 2, option_index: 1, label: 'Gift box', reward_type: 'product', value: 'Set', is_active: true },
    { id: 'b', level: 2, option_index: 3, label: 'Cash', reward_type: 'cash', value: '₹1,000', is_active: false },
  ] }));
  assert.equal((html.match(/class="adm-reward-slot(?: is-empty)?" data-slot=/g) || []).length, 3);
  assert.equal((html.match(/is-empty/g) || []).length, 1, 'slot 2 is the empty one');
  assert.match(html, /value="Gift box"/); assert.match(text(html), /Inactive/);
});

await test('ClaimsList offers fulfil/cancel only on pending claims', async () => {
  const tiers = await mod('src/lib/creatorTiers.js');
  const rules = await mod('src/lib/creatorRewards.js');
  const deps = { ...tiers, ...rules, adminGetTierLadder: async () => ({}), adminSetTierLadder: async () => ({}), adminListLevelRewards: async () => [],
    adminUpsertLevelReward: async () => ({}), adminDeleteLevelReward: async () => ({}), adminListRewardClaims: async () => [], adminSetRewardClaimStatus: async () => ({ ok: true }) };
  const List = component('src/admin/pages/CreatorTiers.jsx', 'ClaimsList', deps);
  const html = renderToStaticMarkup(h(List, { onError: () => {}, onFlash: () => {}, initial: [
    { id: 'c1', level: 2, label: 'Gift box', reward_type: 'product', value: 'Set', status: 'pending', claimed_at: '2026-09-10T00:00:00Z', creator: { display_name: 'Anjali', creator_code: 'ANJ' } },
    { id: 'c2', level: 3, label: 'Cash', reward_type: 'cash', value: '₹1,000', status: 'fulfilled', claimed_at: '2026-09-01T00:00:00Z', creator: { display_name: 'Riya', creator_code: 'RIY' } },
  ] }));
  assert.equal((html.match(/Mark fulfilled/g) || []).length, 1);
  assert.match(text(html), /Anjali.*L2.*Gift box.*Pending/); assert.match(text(html), /Riya.*L3.*Cash.*Fulfilled/);
});

await test('the creators list carries rank, level, lifetime, pending and confirmed from admin_creator_standings', () => {
  const src = read('src/admin/pages/Creators.jsx');
  assert.match(src, /adminCreatorStandings\(\)\.then\(setStandings\)/);
  for (const col of ['Tier', 'Lifetime confirmed', 'Pending', 'Confirmed']) assert.ok(src.includes(`<th`) && src.includes(col), col);
  assert.match(src, /standings\[r\.id\]\.rank_name/); assert.match(src, /standings\[r\.id\]\.lifetime_confirmed_sales/);
  assert.doesNotMatch(src, /no commission is calculated yet/i, 'stale hint removed');
  assert.match(fnBody('admin_creator_standings'), /if not public\.is_sora_admin\(\) then raise exception/);
  assert.match(read('src/App.jsx'), /path="creator-tiers" element=\{<CreatorTiers \/>\}/);
  assert.match(read('src/admin/AdminLayout.jsx'), /'\/admin\/creator-tiers'/);
});

await test('the ladder RPC is the only write path to creator_tier_levels; rewards use the coupon-style admin policy', () => {
  assert.match(M, /revoke insert, update, delete, truncate on table public\.creator_tier_levels from anon, authenticated/);
  assert.match(M, /create policy "level rewards admin write" on public\.creator_level_rewards\s+for all to authenticated\s+using \(public\.is_sora_admin\(\)\) with check \(public\.is_sora_admin\(\)\)/);
  assert.match(M, /create policy "level rewards creator read"[\s\S]*?using \(public\.is_sora_admin\(\) or \(is_active and public\.current_creator_id\(\) is not null\)\)/);
  assert.match(M, /create policy "reward claims self read"[\s\S]*?using \(creator_id = public\.current_creator_id\(\)\)/);
  assert.match(read('src/lib/creatorApi.js'), /\.upsert\(row, \{ onConflict: 'level,option_index' \}\)/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
