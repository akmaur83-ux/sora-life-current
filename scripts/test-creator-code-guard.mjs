// ============================================================
// Creator code alias-guard — regression tests (offline)
//
// Proves the fix in migration 0011 for the retired-code hijack bug, at two
// levels:
//   1. STATIC — the migration actually contains the alias guard, and the
//      sanctioned change_creator_code() RPC is left intact. A future edit that
//      removes the guard fails this suite.
//   2. MODEL  — a JS mirror of the post-0011 invariant reproduces the four
//      required behaviours (old alias cannot be reused, current code cannot be
//      duplicated, a code change preserves the old alias, and a historical
//      link still resolves to the ORIGINAL creator).
//
// The behavioural proof against the LIVE database (real triggers + RPC) is the
// authenticated browser run described in the test plan; it can only run after
// 0011 is applied. This file is the fast, deterministic regression guard.
//
//   node scripts/test-creator-code-guard.mjs
// ============================================================
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (m, k = 'MODEL') => { console.log(`  PASS [${k}]  ${m}`); pass++; };
const bad = (m, k = 'MODEL') => { console.log(`  FAIL [${k}]  ${m}`); fail++; };
const eq = (a, b, m, k) => (a === b ? ok(m, k) : bad(`${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, k));
const truthy = (v, m, k) => (v ? ok(m, k) : bad(m, k));

const SQL11 = readFileSync('supabase/migrations/0011_creator_code_alias_guard.sql', 'utf8');
const SQL10 = readFileSync('supabase/migrations/0010_creator_program.sql', 'utf8');
const norm = (s) => s.replace(/\s+/g, ' ');

// ============================================================
// 1. STATIC — the guard exists and the RPC is untouched
// ============================================================
console.log('\n— Migration 0011 contains the alias guard —');
{
  const n = norm(SQL11);

  truthy(/create or replace function public\.creator_partners_biu\(\)/.test(SQL11),
    'creator_partners_biu is replaced', 'STATIC');

  // INSERT branch checks the alias table.
  truthy(/is a retired alias and cannot be reissued/.test(SQL11),
    'insert/update rejects a code that is a retired alias', 'STATIC');
  truthy(/from public\.creator_code_aliases a where a\.code = new\.creator_code and a\.creator_id is distinct from new\.id/.test(n),
    'the guard compares the new code against aliases of OTHER creators', 'STATIC');

  // Raised as a uniqueness violation so the API returns a clean 409.
  truthy(/using errcode = 'unique_violation'/.test(SQL11),
    'rejection is raised as a unique_violation (clean 409)', 'STATIC');

  // Mirror-direction trigger on the alias table.
  truthy(/create trigger creator_code_aliases_bi\s+before insert on public\.creator_code_aliases/.test(n),
    'a BEFORE INSERT trigger guards creator_code_aliases too', 'STATIC');
  truthy(/collides with another creator''?s active code/.test(SQL11),
    'an alias cannot shadow another creator\'s active code', 'STATIC');

  // The direct-update block from 0010 is preserved.
  truthy(/creator_code cannot be changed directly; use change_creator_code\(\)/.test(SQL11),
    'direct creator_code updates are still blocked', 'STATIC');

  // change_creator_code() itself is NOT redefined here (kept working, unchanged).
  truthy(!/create or replace function public\.change_creator_code/.test(SQL11),
    '0011 does not modify change_creator_code (RPC left intact)', 'STATIC');
  truthy(/create or replace function public\.change_creator_code/.test(SQL10),
    'change_creator_code still defined by 0010', 'STATIC');

  // Non-destructive: no data writes, no drops of data-bearing objects.
  truthy(!/\b(delete from|truncate|drop table)\b/i.test(SQL11),
    '0011 performs no destructive data operation', 'STATIC');
  truthy(!/\b(update|insert into)\s+public\.creator_partners\b/i.test(SQL11),
    '0011 does not modify creator rows', 'STATIC');

  // Its own uniqueness invariants remain (unchanged from 0010).
  truthy(/creator_code\s+text not null unique/.test(SQL10),
    'current creator_code stays UNIQUE (from 0010)', 'STATIC');
  truthy(/code\s+text not null unique/.test(SQL10),
    'alias code stays UNIQUE (from 0010)', 'STATIC');
}

// ============================================================
// 2. MODEL — the post-0011 invariant, exercised for all four cases
//
// Mirrors the triggers + change_creator_code + resolve_tracking_ref exactly:
//   - creator_partners.creator_code is unique
//   - inserting/updating a code that is ANOTHER creator's alias is rejected
//   - change_creator_code retires the old code as an alias of the same creator
//   - resolution prefers a CURRENT code, then falls back to an alias
// ============================================================
class Registry {
  constructor() { this.creators = new Map(); this.aliases = []; this.seq = 0; }
  _newId() { return `creator-${++this.seq}`; }

  // BEFORE INSERT trigger (creator_partners_biu, post-0011)
  createCreator({ code, name }) {
    const id = this._newId();
    const norm = String(code || '').toUpperCase();
    // current-code uniqueness (UNIQUE constraint)
    for (const c of this.creators.values()) {
      if (c.code === norm) { const e = new Error('duplicate_current_code'); e.code = '23505'; throw e; }
    }
    // alias guard (the 0011 fix): reject an alias of a DIFFERENT creator
    if (this.aliases.some((a) => a.code === norm && a.creatorId !== id)) {
      const e = new Error('retired_alias_reissue'); e.code = '23505'; throw e;
    }
    this.creators.set(id, { id, code: norm, name });
    return id;
  }

  // change_creator_code() RPC (unchanged by 0011)
  changeCode(creatorId, newCodeRaw) {
    const creator = this.creators.get(creatorId);
    const newCode = String(newCodeRaw || '').toUpperCase();
    if (newCode.length < 4) throw new Error('code too short');
    // RPC's own pre-check: new code not a current code nor any alias
    for (const c of this.creators.values()) if (c.code === newCode) throw new Error('code already in use');
    if (this.aliases.some((a) => a.code === newCode)) throw new Error('code already in use');
    // retire the OLD code as an alias of THIS creator (aliases_bi allows own code)
    this.aliases.push({ code: creator.code, creatorId });
    creator.code = newCode;
    return newCode;
  }

  // resolve_tracking_ref(): current code wins, then alias
  resolve(refRaw) {
    const ref = String(refRaw || '').toUpperCase();
    for (const c of this.creators.values()) if (c.code === ref) return c.id;
    const a = this.aliases.find((x) => x.code === ref);
    return a ? a.creatorId : null;
  }
}

console.log('\n— Behaviour: the four required proofs —');
{
  const reg = new Registry();
  const anjali = reg.createCreator({ code: 'SORA-ANJALI', name: 'Anjali' });

  // Case 3 (do this first so an alias exists): changing a code preserves the old alias
  reg.changeCode(anjali, 'SORA-ANJALIQA');
  eq(reg.creators.get(anjali).code, 'SORA-ANJALIQA', 'code change updates the current code', 'MODEL');
  truthy(reg.aliases.some((a) => a.code === 'SORA-ANJALI' && a.creatorId === anjali),
    '3) changing a creator code preserves the old code as an alias', 'MODEL');

  // Case 4: historical links using the OLD code still resolve to the ORIGINAL creator
  eq(reg.resolve('SORA-ANJALI'), anjali, '4) a historical link (old code) still resolves to the original creator', 'MODEL');
  eq(reg.resolve('SORA-ANJALIQA'), anjali, '   the new code also resolves to the same creator', 'MODEL');

  // Case 1: the old alias cannot be reused by a NEW creator (the bug)
  let reused = false;
  try { reg.createCreator({ code: 'SORA-ANJALI', name: 'Impostor' }); reused = true; }
  catch (e) { reused = e.code !== '23505' ? 'wrong-error' : false; }
  eq(reused, false, '1) a retired alias cannot be reissued to another creator (23505)', 'MODEL');

  // After the blocked attempt, the old code STILL resolves to the original — no hijack
  eq(reg.resolve('SORA-ANJALI'), anjali, '   after the blocked attempt, the old code still maps to the original creator', 'MODEL');

  // Case 2: a CURRENT creator code cannot be duplicated
  let dup = false;
  try { reg.createCreator({ code: 'SORA-ANJALIQA', name: 'Copycat' }); dup = true; }
  catch (e) { dup = e.code !== '23505' ? 'wrong-error' : false; }
  eq(dup, false, '2) a current creator code cannot be duplicated (23505)', 'MODEL');

  // A genuinely new, unused code is still accepted (no false positives)
  let fresh = null;
  try { fresh = reg.createCreator({ code: 'SORA-BRANDNEW', name: 'Fresh' }); } catch { /* */ }
  truthy(fresh, 'an unused code is still accepted (guard has no false positives)', 'MODEL');

  // Same creator may still be retired-then-referenced repeatedly (RPC intact)
  reg.changeCode(anjali, 'SORA-ANJALIV3');
  eq(reg.resolve('SORA-ANJALI'), anjali, 'the original alias keeps resolving after a second rename', 'MODEL');
  eq(reg.resolve('SORA-ANJALIQA'), anjali, 'the intermediate code is retained as an alias and resolves too', 'MODEL');
}

console.log('\n— Mirror direction: an alias cannot shadow another active code —');
{
  // Model of creator_code_aliases_bi: inserting an alias equal to a DIFFERENT
  // creator's current code must be rejected; retiring your OWN code is allowed.
  const reg = new Registry();
  const a = reg.createCreator({ code: 'SORA-AAA', name: 'A' });
  const b = reg.createCreator({ code: 'SORA-BBB', name: 'B' });

  const aliasInsert = (code, creatorId) => {
    const norm = code.toUpperCase();
    for (const c of reg.creators.values()) if (c.code === norm && c.id !== creatorId) throw Object.assign(new Error('collides_active'), { code: '23505' });
    if (reg.aliases.some((x) => x.code === norm && x.creatorId !== creatorId)) throw Object.assign(new Error('dup_alias'), { code: '23505' });
    reg.aliases.push({ code: norm, creatorId });
  };

  let shadow = false;
  try { aliasInsert('SORA-BBB', a); shadow = true; } catch (e) { shadow = e.code !== '23505' ? 'wrong' : false; }
  eq(shadow, false, 'an alias cannot be created that shadows another creator\'s active code', 'MODEL');

  // change_creator_code retiring your OWN current code is still allowed
  let ownOk = true;
  try { aliasInsert('SORA-AAA', a); } catch { ownOk = false; }
  truthy(ownOk, 'retiring a creator\'s OWN current code as an alias is still allowed (RPC path works)', 'MODEL');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
