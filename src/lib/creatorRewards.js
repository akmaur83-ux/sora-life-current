// ============================================================
// Level rewards — pure helpers shared by the portal chooser, the admin
// editor and the tests. The claim itself is claim_level_reward() (0031);
// nothing here writes.
// ============================================================

export const REWARD_TYPES = Object.freeze(['product', 'cash', 'other']);
export const REWARD_TYPE_LABEL = Object.freeze({ product: 'Product', cash: 'Cash', other: 'Other' });
export const REWARD_OPTION_SLOTS = Object.freeze([1, 2, 3]);
export const CLAIM_STATUSES = Object.freeze(['pending', 'fulfilled', 'cancelled']);
export const CLAIM_STATUS_LABEL = Object.freeze({ pending: 'Pending', fulfilled: 'Fulfilled', cancelled: 'Cancelled' });

// Levels the creator can act on, from my_creator_rewards(). Only a level
// with at least one option is offered — a level with none configured shows
// no prompt at all, never an empty card.
export function claimableLevels(rewards) {
  const list = Array.isArray(rewards?.claimable) ? rewards.claimable : [];
  return list
    .map((lv) => ({
      level: Number(lv?.level),
      rank: lv?.rank || null,
      options: (Array.isArray(lv?.options) ? lv.options : [])
        .filter((o) => o && o.id && String(o.label || '').trim())
        .sort((a, b) => Number(a.option_index) - Number(b.option_index))
        .slice(0, 3),
    }))
    .filter((lv) => Number.isInteger(lv.level) && lv.level >= 1 && lv.options.length > 0)
    .sort((a, b) => a.level - b.level);
}

export function claimHistory(rewards) {
  const list = Array.isArray(rewards?.claims) ? rewards.claims : [];
  return list
    .filter((c) => c && Number.isInteger(Number(c.level)))
    .map((c) => ({ ...c, level: Number(c.level), status: CLAIM_STATUSES.includes(c.status) ? c.status : 'pending' }))
    .sort((a, b) => b.level - a.level);
}

// claim_level_reward() reasons → copy. Unknown reasons never leak.
export function friendlyClaimError(reason) {
  return ({
    not_a_creator: 'Only an approved creator account can claim a reward.',
    bad_level: 'That level does not exist.',
    level_locked: 'You have not reached that level yet.',
    bad_reward: 'That option is no longer available. Refresh and choose again.',
    already_claimed: 'You have already chosen a reward for this level.',
  }[reason]) || 'The reward could not be claimed. Please try again.';
}

// ---- Admin editor -------------------------------------------------------
// Validate one option slot before it is written. Mirrors the table's checks
// (label 1–120 chars, type in the set, slot 1–3, level ≥ 1).
export function validateRewardOption(o) {
  const level = Number(o?.level); const slot = Number(o?.option_index);
  const label = String(o?.label ?? '').trim();
  if (!Number.isInteger(level) || level < 1) return { ok: false, reason: 'bad_level' };
  if (!REWARD_OPTION_SLOTS.includes(slot)) return { ok: false, reason: 'bad_slot' };
  if (!label || label.length > 120) return { ok: false, reason: 'bad_label' };
  if (!REWARD_TYPES.includes(o?.reward_type)) return { ok: false, reason: 'bad_type' };
  return { ok: true };
}

export function rewardOptionErrorMessage(res) {
  if (!res || res.ok) return '';
  return ({
    bad_level: 'Choose a level of 1 or more.',
    bad_slot: 'An option must sit in slot 1, 2 or 3.',
    bad_label: 'Give the option a label of up to 120 characters.',
    bad_type: 'Choose a reward type: product, cash or other.',
  }[res.reason]) || 'The option could not be saved.';
}

// The row an upsert sends. ABSENT when the editor has nothing to say —
// the same omit-when-absent rule adminImportBiosashCatalog applies: PostgREST
// assigns only the columns it is given, so an omitted key leaves the live
// value alone. `id` is included only for an existing row.
export function rewardOptionRow(o) {
  const row = {
    level: Number(o.level),
    option_index: Number(o.option_index),
    label: String(o.label).trim(),
    reward_type: o.reward_type,
  };
  if (o.id) row.id = o.id;
  if (o.description !== undefined) row.description = String(o.description ?? '').trim() || null;
  if (o.value !== undefined) row.value = String(o.value ?? '').trim() || null;
  if (typeof o.is_active === 'boolean') row.is_active = o.is_active;
  return row;
}

// Group definitions by level → slot for the editor grid.
export function groupRewardsByLevel(rows) {
  const byLevel = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const level = Number(r?.level); const slot = Number(r?.option_index);
    if (!Number.isInteger(level) || !REWARD_OPTION_SLOTS.includes(slot)) continue;
    if (!byLevel.has(level)) byLevel.set(level, {});
    byLevel.get(level)[slot] = r;
  }
  return [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([level, slots]) => ({ level, slots }));
}
