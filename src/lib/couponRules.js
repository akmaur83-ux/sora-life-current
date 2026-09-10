// ============================================================
// COUPON RULES — pure, so the tests can execute them
//
// Deliberately free of React and of supabase.js, exactly like wishlistState.js
// is kept free of wishlistData.js: the rules that decide whether a coupon is
// worth saving have ONE implementation, and scripts/test-coupon-admin.mjs runs
// it directly rather than through a component or a network call.
//
// The DB calls live next door in couponAdminApi.js.
// ============================================================

/** Codes are stored upper case, so a lookup is exact rather than fuzzy. */
export function normalizeCode(raw) {
  return typeof raw === 'string' ? raw.trim().toUpperCase().replace(/\s+/g, '').slice(0, 40) : '';
}

/**
 * Everything that must be true before a coupon is worth saving.
 * Returns an array of messages; empty means valid.
 */
export function validateCouponDraft(draft = {}) {
  const errors = [];
  const code = normalizeCode(draft.code);
  if (!code) errors.push('A coupon needs a code.');
  else if (!/^[A-Z0-9_-]+$/.test(code)) {
    errors.push('A code may only contain letters, numbers, hyphens and underscores.');
  }

  const value = Number(draft.value);
  if (!Number.isFinite(value) || value <= 0) errors.push('The discount value must be greater than zero.');
  else if (draft.type === 'percent' && value > 100) errors.push('A percentage discount cannot exceed 100%.');

  const hasMin = draft.min_order_value !== '' && draft.min_order_value != null;
  const min = Number(draft.min_order_value);
  if (hasMin && (!Number.isFinite(min) || min < 0)) {
    errors.push('The minimum order value cannot be negative.');
  }

  // Not strictly wrong, but almost always a typo: "₹500 off any order" and
  // "₹500 off orders above ₹5,000" differ by one keystroke and a lot of money.
  if (draft.type === 'flat' && Number.isFinite(value) && value > 0
      && hasMin && Number.isFinite(min) && min > 0 && value > min) {
    errors.push(`₹${Math.round(value)} off is more than the ₹${Math.round(min)} minimum spend — check the figures.`);
  }

  const starts = draft.starts_at ? new Date(draft.starts_at) : null;
  const expires = draft.expires_at ? new Date(draft.expires_at) : null;
  const usable = (d) => d && !Number.isNaN(d.getTime());
  if (usable(starts) && usable(expires) && expires <= starts) {
    errors.push('The expiry must come after the start date.');
  }

  for (const [key, label] of [['usage_limit', 'total usage limit'], ['per_user_limit', 'per-customer limit']]) {
    const raw = draft[key];
    if (raw === '' || raw == null) continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) errors.push(`The ${label} must be a whole number of at least 1.`);
  }

  return errors;
}

/**
 * Things an admin should read before saving, but which are not mistakes.
 *
 * The uncapped percentage is the important one: 25% off is ₹250 on a ₹1,000
 * basket and ₹10,125 on the ₹40,500 massager in this catalogue. Sometimes
 * that is exactly what is meant, so it warns rather than blocks.
 */
export function couponWarnings(draft = {}) {
  const warnings = [];
  if (draft.type === 'percent' && !(Number(draft.max_discount) > 0)) {
    warnings.push('This percentage has no maximum discount, so what it costs is unbounded on a large basket. Consider a cap.');
  }
  if (!draft.expires_at) {
    warnings.push('No expiry — this coupon runs until someone switches it off.');
  }
  if (draft.usage_limit === '' || draft.usage_limit == null) {
    warnings.push('No total usage limit — it can be redeemed any number of times.');
  }
  if (draft.first_order_only && Number(draft.per_user_limit) > 1) {
    warnings.push('First-order-only already implies one use per customer, so a per-customer limit above 1 has no effect.');
  }
  return warnings;
}

/**
 * Which bucket a coupon falls into, for the admin list filters.
 *
 * Mirrors the order validateCoupon() checks in (api/_lib/coupons.js), so the
 * label an admin sees and the reason a customer is given agree about the same
 * coupon.
 */
export function couponStatus(coupon, now = new Date()) {
  if (!coupon) return 'inactive';
  if (coupon.is_active !== true) return 'inactive';
  const starts = coupon.starts_at ? new Date(coupon.starts_at) : null;
  if (starts && !Number.isNaN(starts.getTime()) && starts > now) return 'scheduled';
  const expires = coupon.expires_at ? new Date(coupon.expires_at) : null;
  if (expires && !Number.isNaN(expires.getTime()) && expires < now) return 'expired';
  if (coupon.usage_limit != null && Number(coupon.used_count || 0) >= Number(coupon.usage_limit)) {
    return 'exhausted';
  }
  return 'live';
}

/** The DB row for a draft. Empty strings become NULL, never 0 or ''. */
export function couponRow(draft) {
  const num = (v) => (v === '' || v == null ? null : Number(v));
  return {
    code: normalizeCode(draft.code),
    type: draft.type === 'percent' ? 'percent' : 'flat',
    value: Number(draft.value) || 0,
    max_discount: num(draft.max_discount),
    // NOT NULL DEFAULT 0 in 0006 — the one field that is 0 rather than null.
    min_order_value: num(draft.min_order_value) ?? 0,
    starts_at: draft.starts_at || null,
    expires_at: draft.expires_at || null,
    usage_limit: num(draft.usage_limit),
    per_user_limit: num(draft.per_user_limit),
    // Never inferred. A coupon goes live because someone pressed Enable.
    is_active: draft.is_active === true,
    // 0028 columns, sent unconditionally: this editor exists to set them, and
    // a save that silently dropped the card copy would be far worse than an
    // error naming the migration.
    title: (draft.title || '').trim() || null,
    description: (draft.description || '').trim() || null,
    first_order_only: draft.first_order_only === true,
    is_stackable: draft.is_stackable === true,
  };
}

/**
 * What the storefront ticket will say for this draft.
 *
 * This MIRRORS publicCouponView() in api/_lib/coupons.js, and mirroring is a
 * deliberate choice over importing it: api/_lib is server code, and a src/
 * file reaching across that boundary would establish a path by which
 * something that DOES touch secrets could later be pulled into a browser
 * bundle.
 *
 * The cost of mirroring is drift, so drift is made a test failure rather than
 * a silent divergence: scripts/test-coupon-admin.mjs runs both functions over
 * the same matrix of rows and asserts the outputs are identical. If you edit
 * one of these two, edit the other.
 */
export function couponPreview(draft) {
  const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
  const min = Math.round(Number(draft.min_order_value) || 0);
  const title = (typeof draft.title === 'string' && draft.title.trim()) || null;
  const description = (typeof draft.description === 'string' && draft.description.trim()) || null;
  return {
    code: normalizeCode(draft.code) || 'CODE',
    title: title
      || (draft.type === 'percent'
        ? `${Math.round(Number(draft.value) || 0)}% off`
        : `${rupees(draft.value)} off`),
    description: description || (min > 0 ? `On orders above ${rupees(min)}` : 'On any order'),
    discount: 0,
    minOrderValue: min,
  };
}
