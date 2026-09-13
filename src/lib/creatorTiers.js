// ============================================================
// Creator tiers — the pure rules, mirroring migration 0031.
//
// The database is the authority: creator_tier_for_sales() resolves the rate a
// commission row snapshots, and admin_set_creator_tier_levels() validates the
// ladder. This module exists so the portal can explain a standing it was
// handed, the admin editor can refuse a bad ladder before the round trip with
// the same reason the RPC would give, and both can be tested without a
// database. Nothing here computes commission.
// ============================================================

export const RANKS_DEFAULT = Object.freeze(['Rise', 'Premium', 'Elite', 'Royale', 'Prime', 'Supreme', 'Crown']);

// The brief's ladder — used as the editor's "restore defaults" and by tests.
// The live ladder is creator_tier_levels; this is never read at runtime.
export const DEFAULT_LADDER = Object.freeze([
  { level: 1, rank: 'Rise', threshold: 0, rate: 10 },
  { level: 2, rank: 'Rise', threshold: 10000, rate: 11 },
  { level: 3, rank: 'Premium', threshold: 25000, rate: 12 },
  { level: 4, rank: 'Premium', threshold: 50000, rate: 13 },
  { level: 5, rank: 'Elite', threshold: 75000, rate: 14 },
  { level: 6, rank: 'Elite', threshold: 100000, rate: 15 },
  { level: 7, rank: 'Royale', threshold: 125000, rate: 16 },
  { level: 8, rank: 'Royale', threshold: 150000, rate: 17 },
  { level: 9, rank: 'Prime', threshold: 200000, rate: 18 },
  { level: 10, rank: 'Prime', threshold: 250000, rate: 19 },
  { level: 11, rank: 'Supreme', threshold: 300000, rate: 21 },
  { level: 12, rank: 'Supreme', threshold: 350000, rate: 22 },
  { level: 13, rank: 'Crown', threshold: 400000, rate: 23 },
  { level: 14, rank: 'Crown', threshold: 500000, rate: 25 },
]);
export const DEFAULT_BEYOND_STEP = 25000;

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

// Normalise whatever shape a ladder arrives in (RPC jsonb, table rows, editor
// state) into sorted {level, rank, threshold, rate} numbers.
export function normalizeLadder(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r, i) => ({
      level: Number.isInteger(Number(r?.level)) ? Number(r.level) : i + 1,
      rank: String(r?.rank ?? r?.rank_name ?? '').trim(),
      threshold: num(r?.threshold),
      rate: num(r?.rate),
    }))
    .sort((a, b) => a.level - b.level);
}

// The same resolution creator_tier_for_sales() performs (0031 §1):
// highest level whose threshold <= sales; exactly on a threshold counts;
// above the top level, one more level per beyondStep at the top rate.
export function tierForSales(ladder, sales, beyondStep = DEFAULT_BEYOND_STEP) {
  const levels = normalizeLadder(ladder).filter((l) => Number.isFinite(l.threshold) && Number.isFinite(l.rate));
  const s = Math.max(0, Number(sales) || 0);
  if (levels.length === 0) {
    return { level: 1, rank: 'Rise', rate: 10, threshold: 0, next_level: null, next_threshold: null, next_rate: null, configured: false };
  }
  let current = null;
  for (const l of levels) if (l.threshold <= s) current = l;
  if (!current) {
    const first = levels[0];
    return { level: first.level, rank: first.rank, rate: first.rate, threshold: 0, next_level: first.level, next_threshold: first.threshold, next_rate: first.rate, configured: true };
  }
  const top = levels[levels.length - 1];
  if (current.level === top.level) {
    const step = Number(beyondStep) || 0;
    if (step > 0) {
      const n = Math.floor((s - top.threshold) / step);
      return {
        level: top.level + n, rank: top.rank, rate: top.rate, threshold: top.threshold + n * step,
        next_level: top.level + n + 1, next_threshold: top.threshold + (n + 1) * step, next_rate: top.rate, configured: true,
      };
    }
    return { level: top.level, rank: top.rank, rate: top.rate, threshold: top.threshold, next_level: null, next_threshold: null, next_rate: null, configured: true };
  }
  const next = levels.find((l) => l.level > current.level);
  return {
    level: current.level, rank: current.rank, rate: current.rate, threshold: current.threshold,
    next_level: next.level, next_threshold: next.threshold, next_rate: next.rate, configured: true,
  };
}

// Progress toward the next level, from a standing (RPC output or tierForSales).
export function tierProgress(standing) {
  const sales = Math.max(0, Number(standing?.lifetime_confirmed_sales ?? standing?.sales ?? 0) || 0);
  const from = Number(standing?.threshold) || 0;
  const to = standing?.next_threshold == null ? null : Number(standing.next_threshold);
  if (to == null || !Number.isFinite(to) || to <= from) {
    return { fraction: 1, remaining: 0, from, to: null, atTop: true };
  }
  const fraction = Math.min(1, Math.max(0, (sales - from) / (to - from)));
  return { fraction, remaining: Math.max(0, to - sales), from, to, atTop: false };
}

// The reasons admin_set_creator_tier_levels() returns, produced client-side
// from the same rules so the editor can refuse before the round trip.
export function validateLadder(rows, beyondStep) {
  const levels = normalizeLadder(rows);
  if (levels.length === 0) return { ok: false, reason: 'empty' };
  if (beyondStep != null && beyondStep !== '' && (!Number.isFinite(Number(beyondStep)) || Number(beyondStep) < 0)) {
    return { ok: false, reason: 'bad_beyond_step' };
  }
  let prevThreshold = -1; let prevRate = -1;
  for (let i = 0; i < levels.length; i++) {
    const l = levels[i]; const at = i + 1;
    if (l.level !== at) return { ok: false, reason: 'levels_not_contiguous', at };
    if (!l.rank || l.rank.length > 40) return { ok: false, reason: 'bad_rank', at };
    if (!Number.isFinite(l.threshold) || l.threshold < 0) return { ok: false, reason: 'bad_threshold', at };
    if (at === 1 && l.threshold !== 0) return { ok: false, reason: 'first_threshold_not_zero', at };
    if (l.threshold <= prevThreshold) return { ok: false, reason: 'thresholds_not_ascending', at };
    if (!Number.isFinite(l.rate) || l.rate < 0 || l.rate > 100) return { ok: false, reason: 'bad_rate', at };
    if (l.rate < prevRate) return { ok: false, reason: 'rates_not_ascending', at };
    prevThreshold = l.threshold; prevRate = l.rate;
  }
  return { ok: true, levels };
}

export function ladderErrorMessage(res) {
  if (!res || res.ok) return '';
  const at = res.at ? ` (level ${res.at})` : '';
  return ({
    empty: 'The ladder needs at least one level.',
    bad_beyond_step: 'The "beyond" step must be a positive amount.',
    levels_not_contiguous: `Levels must run 1, 2, 3… without gaps${at}.`,
    bad_rank: `Each level needs a rank name of up to 40 characters${at}.`,
    bad_threshold: `Thresholds must be amounts of ₹0 or more${at}.`,
    first_threshold_not_zero: 'Level 1 must start at ₹0.',
    thresholds_not_ascending: `Each threshold must be higher than the one before${at}.`,
    bad_rate: `Rates must be between 0% and 100%${at}.`,
    rates_not_ascending: `A higher level cannot pay a lower rate${at}.`,
  }[res.reason]) || 'The ladder could not be saved.';
}

// ---- Leaderboard --------------------------------------------------------
// creator_leaderboard() returns exactly these four fields. The client
// re-projects them anyway: if the function ever grew a column, nothing
// here would render it.
export const LEADERBOARD_FIELDS = Object.freeze(['rank_position', 'display_name', 'rank_name', 'level']);
export const LEADERBOARD_LIMIT = 100;

export function sanitizeLeaderboard(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => ({
      rank_position: Number(r?.rank_position),
      display_name: String(r?.display_name ?? '').trim(),
      rank_name: String(r?.rank_name ?? '').trim(),
      level: Number(r?.level),
    }))
    .filter((r) => Number.isInteger(r.rank_position) && r.rank_position >= 1 && r.display_name && Number.isInteger(r.level) && r.level >= 1)
    .sort((a, b) => a.rank_position - b.rank_position)
    .slice(0, LEADERBOARD_LIMIT);
}

// Rank → accent slot. The section's CSS maps slots to colours; unknown or
// admin-renamed ranks fall to a neutral slot rather than breaking the look.
const RANK_SLOTS = { rise: 'rise', premium: 'premium', elite: 'elite', royale: 'royale', prime: 'prime', supreme: 'supreme', crown: 'crown' };
export function rankSlot(rankName) {
  const key = String(rankName || '').trim().toLowerCase();
  return RANK_SLOTS[key] || 'neutral';
}

// Rupee amounts on the tier surfaces read in Indian grouping with no paise:
// thresholds are round numbers and progress copy should not look like a bill.
export function rupees(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  return '₹' + v.toLocaleString('en-IN');
}
