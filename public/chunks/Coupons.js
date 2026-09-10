import { be as supabase, r as reactExports, j as jsxRuntimeExports, bf as CouponTicket } from '../bundle.js';

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
function normalizeCode(raw) {
  return typeof raw === 'string' ? raw.trim().toUpperCase().replace(/\s+/g, '').slice(0, 40) : '';
}

/**
 * Everything that must be true before a coupon is worth saving.
 * Returns an array of messages; empty means valid.
 */
function validateCouponDraft(draft = {}) {
  const errors = [];
  const code = normalizeCode(draft.code);
  if (!code) errors.push('A coupon needs a code.');else if (!/^[A-Z0-9_-]+$/.test(code)) {
    errors.push('A code may only contain letters, numbers, hyphens and underscores.');
  }
  const value = Number(draft.value);
  if (!Number.isFinite(value) || value <= 0) errors.push('The discount value must be greater than zero.');else if (draft.type === 'percent' && value > 100) errors.push('A percentage discount cannot exceed 100%.');
  const hasMin = draft.min_order_value !== '' && draft.min_order_value != null;
  const min = Number(draft.min_order_value);
  if (hasMin && (!Number.isFinite(min) || min < 0)) {
    errors.push('The minimum order value cannot be negative.');
  }

  // Not strictly wrong, but almost always a typo: "₹500 off any order" and
  // "₹500 off orders above ₹5,000" differ by one keystroke and a lot of money.
  if (draft.type === 'flat' && Number.isFinite(value) && value > 0 && hasMin && Number.isFinite(min) && min > 0 && value > min) {
    errors.push(`₹${Math.round(value)} off is more than the ₹${Math.round(min)} minimum spend — check the figures.`);
  }
  const starts = draft.starts_at ? new Date(draft.starts_at) : null;
  const expires = draft.expires_at ? new Date(draft.expires_at) : null;
  const usable = d => d && !Number.isNaN(d.getTime());
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
function couponWarnings(draft = {}) {
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
function couponStatus(coupon, now = new Date()) {
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
function couponRow(draft) {
  const num = v => v === '' || v == null ? null : Number(v);
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
    is_stackable: draft.is_stackable === true
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
function couponPreview(draft) {
  const rupees = n => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
  const min = Math.round(Number(draft.min_order_value) || 0);
  const title = typeof draft.title === 'string' && draft.title.trim() || null;
  const description = typeof draft.description === 'string' && draft.description.trim() || null;
  return {
    code: normalizeCode(draft.code) || 'CODE',
    title: title || (draft.type === 'percent' ? `${Math.round(Number(draft.value) || 0)}% off` : `${rupees(draft.value)} off`),
    description: description || (min > 0 ? `On orders above ${rupees(min)}` : 'On any order'),
    discount: 0,
    minOrderValue: min
  };
}

// ============================================================
// COUPONS — ADMIN DATA ACCESS
//
// Admin CRUD only. The storefront never reaches these: it goes through
// /api/coupons/eligible and /api/coupons/quote, because coupons has no public
// read policy and must not get one. A customer who can select the table can
// enumerate every code in it — migration 0006 says so in as many words.
//
// Writes rely on the "coupons admin write" policy added in 0028. Before that
// the table had a read policy and nothing else, so this editor could list
// coupons and then silently fail to save one.
//
// The rules — what makes a draft valid, what its ticket will say, which state
// it is in — live in couponRules.js, with no supabase import, so the tests can
// execute them directly.
// ============================================================
const COUPON_MISSING = 'The coupons table is not available. Run supabase/migrations/0028_coupon_system.sql in the Supabase SQL editor first.';

/** The table itself is absent. */
function isMissingCoupons(error) {
  return Boolean(error) && ['42P01', 'PGRST205', 'PGRST106'].includes(error.code);
}

/** 0028 has not been applied, so the columns it adds are absent. */
function isMissing0028(error) {
  return Boolean(error) && ['42703', 'PGRST204'].includes(error.code);
}

/** Newest first: an admin is usually looking for what they just made. */
async function adminListCoupons() {
  const {
    data,
    error
  } = await supabase.from('coupons').select('*').order('created_at', {
    ascending: false
  });
  if (error) {
    if (isMissingCoupons(error) || isMissing0028(error)) throw new Error(COUPON_MISSING);
    throw error;
  }
  return data || [];
}

/**
 * The redemption ledger for one coupon, newest first.
 *
 * The count shown in the list comes from coupons.used_count, which
 * consume_coupon() maintains under its row lock. These are the rows behind
 * that number — if the two ever disagree, the rows are the truth.
 */
async function adminListCouponRedemptions(couponId, limit = 100) {
  if (!couponId) return [];
  const {
    data,
    error
  } = await supabase.from('coupon_redemptions').select('id, order_number, user_id, created_at').eq('coupon_id', couponId).order('created_at', {
    ascending: false
  }).limit(limit);
  if (error) {
    if (isMissingCoupons(error)) return [];
    throw error;
  }
  return data || [];
}
async function adminSaveCoupon(draft) {
  const errors = validateCouponDraft(draft);
  if (errors.length) throw new Error(errors[0]);
  const row = couponRow(draft);
  const query = draft.id ? supabase.from('coupons').update(row).eq('id', draft.id) : supabase.from('coupons').insert(row);
  const {
    data,
    error
  } = await query.select().single();
  if (error) {
    if (isMissingCoupons(error) || isMissing0028(error)) throw new Error(COUPON_MISSING);
    // The unique index on code, from 0006. Worth naming: the fix is "pick a
    // different code", not "try again".
    if (error.code === '23505') throw new Error(`The code ${row.code} is already in use.`);
    throw error;
  }
  return data;
}

/**
 * Enable/disable only.
 *
 * Deliberately separate from the full save, so the list's toggle cannot
 * rewrite anything else about a coupon — switching one off must never be able
 * to change its terms as a side effect.
 */
async function adminSetCouponActive(id, isActive) {
  const {
    error
  } = await supabase.from('coupons').update({
    is_active: !!isActive
  }).eq('id', id);
  if (error) {
    if (isMissingCoupons(error)) throw new Error(COUPON_MISSING);
    throw error;
  }
}

/**
 * Delete a coupon — refused once it has been redeemed.
 *
 * coupon_redemptions references coupon_id, so deleting a used coupon either
 * fails on the constraint or orphans a ledger that sits behind real orders.
 * Switching it off achieves everything deletion would and keeps the history.
 */
async function adminDeleteCoupon(id) {
  const {
    data: used,
    error: countError
  } = await supabase.from('coupon_redemptions').select('id').eq('coupon_id', id).limit(1);
  if (countError && !isMissingCoupons(countError)) throw countError;
  if (used && used.length) {
    throw new Error('This coupon has been redeemed, so it cannot be deleted. Switch it off instead — the redemption history stays with the orders.');
  }
  const {
    error
  } = await supabase.from('coupons').delete().eq('id', id);
  if (error) {
    if (isMissingCoupons(error)) throw new Error(COUPON_MISSING);
    throw error;
  }
}

const FILTERS = [['all', 'All'], ['live', 'Live'], ['scheduled', 'Scheduled'], ['expired', 'Expired'], ['exhausted', 'Exhausted'], ['inactive', 'Off']];
const EMPTY = {
  code: '',
  type: 'flat',
  value: '',
  max_discount: '',
  min_order_value: '',
  starts_at: '',
  expires_at: '',
  usage_limit: '',
  per_user_limit: '',
  title: '',
  description: '',
  first_order_only: false,
  is_stackable: false,
  // Never true for a new coupon. Enabling is a separate, deliberate action.
  is_active: false
};

// ISO <-> <input type="datetime-local"> ("YYYY-MM-DDTHH:mm", local time)
const toLocalInput = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = v => v ? new Date(v).toISOString() : null;
const money = n => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const when = iso => iso ? new Date(iso).toLocaleString('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short'
}) : '—';

/** What this coupon takes off, in words. */
function termsLine(c) {
  const off = c.type === 'percent' ? `${Math.round(Number(c.value) || 0)}%${Number(c.max_discount) > 0 ? ` up to ${money(c.max_discount)}` : ''}` : money(c.value);
  const min = Number(c.min_order_value) > 0 ? ` on orders above ${money(c.min_order_value)}` : '';
  return `${off} off${min}`;
}

/** Draft -> row shape, so a form field feeds the same fields the DB has. */
function draftToPayload(form, editing) {
  return {
    ...form,
    id: editing === 'new' ? undefined : editing?.id,
    starts_at: fromLocalInput(form.starts_at),
    expires_at: fromLocalInput(form.expires_at)
  };
}

/** Row -> draft shape, for edit and duplicate alike. */
function rowToDraft(row) {
  return {
    ...EMPTY,
    ...row,
    max_discount: row.max_discount ?? '',
    min_order_value: row.min_order_value ?? '',
    usage_limit: row.usage_limit ?? '',
    per_user_limit: row.per_user_limit ?? '',
    title: row.title || '',
    description: row.description || '',
    first_order_only: row.first_order_only === true,
    is_stackable: row.is_stackable === true,
    starts_at: toLocalInput(row.starts_at),
    expires_at: toLocalInput(row.expires_at)
  };
}
function Coupons() {
  const [list, setList] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(true);
  const [filter, setFilter] = reactExports.useState('all');
  const [editing, setEditing] = reactExports.useState(null); // 'new' | row | null
  const [form, setForm] = reactExports.useState(EMPTY);
  const [saving, setSaving] = reactExports.useState(false);
  const [err, setErr] = reactExports.useState('');
  const [notMigrated, setNotMigrated] = reactExports.useState(false);
  const [ledger, setLedger] = reactExports.useState({
    id: null,
    rows: [],
    loading: false
  });
  async function load() {
    setLoading(true);
    setErr('');
    try {
      setList(await adminListCoupons());
      setNotMigrated(false);
    } catch (e) {
      const msg = e.message || String(e);
      if (/is not available/i.test(msg)) {
        setNotMigrated(true);
        setList([]);
      } else setErr(msg);
    }
    setLoading(false);
  }
  reactExports.useEffect(() => {
    load();
  }, []);
  const set = (k, v) => setForm(f => ({
    ...f,
    [k]: v
  }));

  // Recomputed as the admin types, so an expiry before the start date or a
  // percentage over 100 is visible before Save is reached.
  const errors = reactExports.useMemo(() => validateCouponDraft(form), [form]);
  const warnings = reactExports.useMemo(() => couponWarnings(form), [form]);
  const preview = reactExports.useMemo(() => couponPreview(form), [form]);
  const counts = reactExports.useMemo(() => {
    const now = new Date();
    const out = {
      all: list.length
    };
    for (const c of list) {
      const s = couponStatus(c, now);
      out[s] = (out[s] || 0) + 1;
    }
    return out;
  }, [list]);
  const visible = reactExports.useMemo(() => {
    if (filter === 'all') return list;
    const now = new Date();
    return list.filter(c => couponStatus(c, now) === filter);
  }, [list, filter]);
  function startEdit(row) {
    setForm(row ? rowToDraft(row) : EMPTY);
    setEditing(row || 'new');
    setErr('');
  }

  /**
   * Copy a coupon's TERMS into a new draft.
   *
   * Everything except identity and history: the code is cleared (it is unique,
   * and a duplicate code is a duplicate coupon rather than a similar one), the
   * redemption count does not come along, and the copy starts switched off.
   */
  function duplicate(row) {
    setForm({
      ...rowToDraft(row),
      id: undefined,
      code: '',
      used_count: undefined,
      is_active: false
    });
    setEditing('new');
    setErr('');
  }
  async function save(e) {
    e.preventDefault();
    if (errors.length) {
      setErr(errors[0]);
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await adminSaveCoupon(draftToPayload(form, editing));
      setEditing(null);
      setForm(EMPTY);
      await load();
    } catch (e2) {
      setErr(e2.message || String(e2));
    }
    setSaving(false);
  }
  async function toggle(row) {
    setErr('');
    try {
      await adminSetCouponActive(row.id, !row.is_active);
      await load();
    } catch (e) {
      setErr(e.message || String(e));
    }
  }
  async function remove(row) {
    if (!window.confirm(`Delete ${row.code}? This cannot be undone.`)) return;
    setErr('');
    try {
      await adminDeleteCoupon(row.id);
      await load();
    } catch (e) {
      setErr(e.message || String(e));
    }
  }
  async function openLedger(row) {
    if (ledger.id === row.id) {
      setLedger({
        id: null,
        rows: [],
        loading: false
      });
      return;
    }
    setLedger({
      id: row.id,
      rows: [],
      loading: true
    });
    try {
      setLedger({
        id: row.id,
        rows: await adminListCouponRedemptions(row.id),
        loading: false
      });
    } catch {
      setLedger({
        id: row.id,
        rows: [],
        loading: false
      });
    }
  }
  return /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
    children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm__head",
      children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("h1", {
          children: "Coupons"
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("p", {
          children: [loading ? 'Loading…' : `${list.length} ${list.length === 1 ? 'coupon' : 'coupons'}`, ' · ', "every coupon is created switched off and goes live only when you enable it."]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
        className: "btn btn-sm",
        onClick: () => startEdit(null),
        children: "+ New coupon"
      })]
    }), notMigrated && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
      className: "adm-banner info",
      children: ["The coupons table is not available yet. Run", ' ', /*#__PURE__*/jsxRuntimeExports.jsx("code", {
        children: "supabase/migrations/0028_coupon_system.sql"
      }), ' ', "in the Supabase SQL editor, then reload this page."]
    }), err && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-banner err",
      role: "alert",
      children: err
    }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-chipbar",
      children: FILTERS.map(([id, label]) => /*#__PURE__*/jsxRuntimeExports.jsxs("button", {
        className: `adm-chip ${filter === id ? 'active' : ''}`,
        onClick: () => setFilter(id),
        "aria-pressed": filter === id,
        children: [label, " (", counts[id] || 0, ")"]
      }, id))
    }), editing && /*#__PURE__*/jsxRuntimeExports.jsxs("form", {
      className: "surface pad-lg adm-coupon-form",
      onSubmit: save,
      children: [/*#__PURE__*/jsxRuntimeExports.jsx("h2", {
        style: {
          fontFamily: 'var(--font-display)',
          marginBottom: 14
        },
        children: editing === 'new' ? 'New coupon' : `Edit ${editing.code}`
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            htmlFor: "cp-code",
            children: "Code"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            id: "cp-code",
            className: "input",
            required: true,
            maxLength: 40,
            value: form.code,
            onChange: e => set('code', normalizeCode(e.target.value)),
            placeholder: "WELCOME200"
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            htmlFor: "cp-type",
            children: "Type"
          }), /*#__PURE__*/jsxRuntimeExports.jsxs("select", {
            id: "cp-type",
            className: "select",
            value: form.type,
            onChange: e => set('type', e.target.value),
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: "flat",
              children: "Flat \u20B9 off"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("option", {
              value: "percent",
              children: "Percentage off"
            })]
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            htmlFor: "cp-value",
            children: form.type === 'percent' ? 'Percentage off' : 'Amount off (₹)'
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            id: "cp-value",
            className: "input",
            type: "number",
            min: "0",
            step: "1",
            required: true,
            value: form.value,
            onChange: e => set('value', e.target.value)
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            htmlFor: "cp-cap",
            children: "Maximum discount (\u20B9)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            id: "cp-cap",
            className: "input",
            type: "number",
            min: "0",
            step: "1",
            value: form.max_discount,
            onChange: e => set('max_discount', e.target.value),
            disabled: form.type !== 'percent',
            placeholder: form.type === 'percent' ? 'No cap — see the warning below' : 'Not used for a flat discount'
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            htmlFor: "cp-min",
            children: "Minimum order value (\u20B9)"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            id: "cp-min",
            className: "input",
            type: "number",
            min: "0",
            step: "1",
            placeholder: "0",
            value: form.min_order_value,
            onChange: e => set('min_order_value', e.target.value)
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            htmlFor: "cp-total",
            children: "Total usage limit"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            id: "cp-total",
            className: "input",
            type: "number",
            min: "1",
            step: "1",
            placeholder: "Unlimited",
            value: form.usage_limit,
            onChange: e => set('usage_limit', e.target.value)
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            htmlFor: "cp-peruser",
            children: "Per-customer limit"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            id: "cp-peruser",
            className: "input",
            type: "number",
            min: "1",
            step: "1",
            placeholder: "Unlimited",
            value: form.per_user_limit,
            onChange: e => set('per_user_limit', e.target.value)
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            htmlFor: "cp-starts",
            children: "Starts"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            id: "cp-starts",
            className: "input",
            type: "datetime-local",
            value: form.starts_at,
            onChange: e => set('starts_at', e.target.value)
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            htmlFor: "cp-expires",
            children: "Expires"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            id: "cp-expires",
            className: "input",
            type: "datetime-local",
            value: form.expires_at,
            onChange: e => set('expires_at', e.target.value)
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsx("div", {})]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("h3", {
        className: "adm-coupon-sub",
        children: "Card copy"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "adm-coupon-hint",
        children: "What the ticket says on the product page and in the cart. Left blank, it describes itself from the terms above \u2014 the placeholder shows exactly what a customer would read."
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-grid2",
        children: [/*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            htmlFor: "cp-title",
            children: "Title"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            id: "cp-title",
            className: "input",
            maxLength: 80,
            placeholder: preview.title,
            value: form.title,
            onChange: e => set('title', e.target.value)
          })]
        }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
          className: "field",
          children: [/*#__PURE__*/jsxRuntimeExports.jsx("label", {
            className: "label",
            htmlFor: "cp-desc",
            children: "Description"
          }), /*#__PURE__*/jsxRuntimeExports.jsx("input", {
            id: "cp-desc",
            className: "input",
            maxLength: 140,
            placeholder: preview.description,
            value: form.description,
            onChange: e => set('description', e.target.value)
          })]
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-checkrow",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
          type: "checkbox",
          id: "cp-first",
          checked: form.first_order_only,
          onChange: e => set('first_order_only', e.target.checked)
        }), /*#__PURE__*/jsxRuntimeExports.jsx("label", {
          htmlFor: "cp-first",
          children: "First order only \u2014 refused for anyone who already has a paid order"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        className: "adm-checkrow",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("input", {
          type: "checkbox",
          id: "cp-stack",
          checked: form.is_stackable,
          onChange: e => set('is_stackable', e.target.checked)
        }), /*#__PURE__*/jsxRuntimeExports.jsx("label", {
          htmlFor: "cp-stack",
          children: "Stackable with other coupons (one coupon per order is still the rule today)"
        })]
      }), /*#__PURE__*/jsxRuntimeExports.jsx("h3", {
        className: "adm-coupon-sub",
        children: "Preview"
      }), /*#__PURE__*/jsxRuntimeExports.jsx("p", {
        className: "adm-coupon-hint",
        children: "The real storefront ticket. It carries no rupee figure by design: what a coupon is worth depends on the whole basket, so the amount is shown in the cart, where the basket exists."
      }), /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
        className: "pdp-coupons__list adm-coupon-preview",
        children: /*#__PURE__*/jsxRuntimeExports.jsx(CouponTicket, {
          coupon: preview
        })
      }), errors.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-banner err",
        role: "alert",
        children: /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
          className: "adm-coupon-msgs",
          children: errors.map(m => /*#__PURE__*/jsxRuntimeExports.jsx("li", {
            children: m
          }, m))
        })
      }), warnings.length > 0 && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
        className: "adm-banner info",
        children: /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
          className: "adm-coupon-msgs",
          children: warnings.map(m => /*#__PURE__*/jsxRuntimeExports.jsx("li", {
            children: m
          }, m))
        })
      }), /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
        style: {
          display: 'flex',
          gap: 10,
          marginTop: 14,
          alignItems: 'center',
          flexWrap: 'wrap'
        },
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
          className: "btn btn-sm",
          type: "submit",
          disabled: saving || errors.length > 0,
          children: saving ? 'Saving…' : 'Save'
        }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
          type: "button",
          className: "btn btn-outline btn-sm",
          onClick: () => {
            setEditing(null);
            setErr('');
          },
          children: "Cancel"
        }), editing === 'new' && /*#__PURE__*/jsxRuntimeExports.jsx("span", {
          className: "adm-coupon-hint",
          style: {
            margin: 0
          },
          children: "Saves switched off \u2014 enable it from the list when you are ready."
        })]
      })]
    }), loading ? null : !visible.length ? /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-empty",
      children: list.length ? 'No coupons in this state.' : 'No coupons yet. Nothing is being offered to customers.'
    }) : /*#__PURE__*/jsxRuntimeExports.jsx("div", {
      className: "adm-table-wrap",
      children: /*#__PURE__*/jsxRuntimeExports.jsxs("table", {
        className: "adm-table",
        children: [/*#__PURE__*/jsxRuntimeExports.jsx("thead", {
          children: /*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
            children: [/*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Code"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Terms"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Window"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Used"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {
              children: "Status"
            }), /*#__PURE__*/jsxRuntimeExports.jsx("th", {})]
          })
        }), /*#__PURE__*/jsxRuntimeExports.jsx("tbody", {
          children: visible.map(c => {
            const status = couponStatus(c);
            const used = Number(c.used_count) || 0;
            return /*#__PURE__*/jsxRuntimeExports.jsxs(reactExports.Fragment, {
              children: [/*#__PURE__*/jsxRuntimeExports.jsxs("tr", {
                className: c.is_active ? '' : 'is-muted',
                children: [/*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                  children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                    children: c.code
                  }), c.title && /*#__PURE__*/jsxRuntimeExports.jsx("div", {
                    className: "adm-coupon-sm",
                    children: c.title
                  }), (c.first_order_only || c.is_stackable) && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                    className: "adm-coupon-sm",
                    children: [c.first_order_only && 'First order only', c.first_order_only && c.is_stackable && ' · ', c.is_stackable && 'Stackable']
                  })]
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: termsLine(c)
                }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                  className: "adm-coupon-sm",
                  children: [when(c.starts_at), /*#__PURE__*/jsxRuntimeExports.jsx("br", {}), "\u2192 ", c.expires_at ? when(c.expires_at) : 'no expiry']
                }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                  children: [/*#__PURE__*/jsxRuntimeExports.jsxs("button", {
                    type: "button",
                    className: "btn btn-sm btn-ghost",
                    onClick: () => openLedger(c),
                    children: [used, c.usage_limit != null ? ` / ${c.usage_limit}` : '']
                  }), c.per_user_limit != null && /*#__PURE__*/jsxRuntimeExports.jsxs("div", {
                    className: "adm-coupon-sm",
                    children: ["max ", c.per_user_limit, " per customer"]
                  })]
                }), /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  children: /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    className: `adm-coupon-badge is-${status}`,
                    children: status
                  })
                }), /*#__PURE__*/jsxRuntimeExports.jsxs("td", {
                  className: "adm-actions",
                  children: [/*#__PURE__*/jsxRuntimeExports.jsx("button", {
                    className: "btn btn-sm btn-light",
                    onClick: () => toggle(c),
                    children: c.is_active ? 'Disable' : 'Enable'
                  }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                    className: "btn btn-sm btn-ghost",
                    onClick: () => startEdit(c),
                    children: "Edit"
                  }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                    className: "btn btn-sm btn-ghost",
                    onClick: () => duplicate(c),
                    children: "Duplicate"
                  }), /*#__PURE__*/jsxRuntimeExports.jsx("button", {
                    className: "btn btn-sm btn-ghost",
                    onClick: () => remove(c),
                    children: "Delete"
                  })]
                })]
              }), ledger.id === c.id && /*#__PURE__*/jsxRuntimeExports.jsx("tr", {
                children: /*#__PURE__*/jsxRuntimeExports.jsx("td", {
                  colSpan: 6,
                  children: ledger.loading ? /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    className: "adm-coupon-sm",
                    children: "Loading redemptions\u2026"
                  }) : !ledger.rows.length ? /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                    className: "adm-coupon-sm",
                    children: "No redemptions yet."
                  }) : /*#__PURE__*/jsxRuntimeExports.jsx("ul", {
                    className: "adm-coupon-ledger",
                    children: ledger.rows.map(r => /*#__PURE__*/jsxRuntimeExports.jsxs("li", {
                      children: [/*#__PURE__*/jsxRuntimeExports.jsx("strong", {
                        children: r.order_number || '—'
                      }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                        children: when(r.created_at)
                      }), /*#__PURE__*/jsxRuntimeExports.jsx("span", {
                        children: r.user_id ? `customer ${String(r.user_id).slice(0, 8)}…` : 'guest'
                      })]
                    }, r.id))
                  })
                })
              })]
            }, c.id);
          })
        })]
      })
    })]
  });
}

export { Coupons as default };
//# sourceMappingURL=Coupons.js.map
