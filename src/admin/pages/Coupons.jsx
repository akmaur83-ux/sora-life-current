import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  adminListCoupons, adminSaveCoupon, adminSetCouponActive, adminDeleteCoupon,
  adminListCouponRedemptions,
} from '../../lib/couponAdminApi.js';
import {
  validateCouponDraft, couponWarnings, couponStatus, couponPreview, normalizeCode,
} from '../../lib/couponRules.js';
import CouponTicket from '../../components/pdp/CouponTicket.jsx';

// ============================================================
// ADMIN — COUPONS
//
// Every coupon is created switched OFF. 0028 flipped the column default to
// false for exactly this reason: before it, a half-filled row was live the
// moment it was inserted, so a coupon became real while someone was still
// typing its terms. Here it becomes real only when a human presses Enable on
// a row that is already saved.
//
// The preview renders the REAL storefront ticket component, not a copy of its
// markup — see components/pdp/CouponTicket.jsx. A preview assembled from
// duplicated markup drifts, and then it is not a preview.
// ============================================================

const FILTERS = [
  ['all', 'All'],
  ['live', 'Live'],
  ['scheduled', 'Scheduled'],
  ['expired', 'Expired'],
  ['exhausted', 'Exhausted'],
  ['inactive', 'Off'],
];

const EMPTY = {
  code: '', type: 'flat', value: '', max_discount: '', min_order_value: '',
  starts_at: '', expires_at: '', usage_limit: '', per_user_limit: '',
  title: '', description: '', first_order_only: false, is_stackable: false,
  // Never true for a new coupon. Enabling is a separate, deliberate action.
  is_active: false,
};

// ISO <-> <input type="datetime-local"> ("YYYY-MM-DDTHH:mm", local time)
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** What this coupon takes off, in words. */
function termsLine(c) {
  const off = c.type === 'percent'
    ? `${Math.round(Number(c.value) || 0)}%${Number(c.max_discount) > 0 ? ` up to ${money(c.max_discount)}` : ''}`
    : money(c.value);
  const min = Number(c.min_order_value) > 0 ? ` on orders above ${money(c.min_order_value)}` : '';
  return `${off} off${min}`;
}

/** Draft -> row shape, so a form field feeds the same fields the DB has. */
function draftToPayload(form, editing) {
  return {
    ...form,
    id: editing === 'new' ? undefined : editing?.id,
    starts_at: fromLocalInput(form.starts_at),
    expires_at: fromLocalInput(form.expires_at),
  };
}

/** Row -> draft shape, for edit and duplicate alike. */
function rowToDraft(row) {
  return {
    ...EMPTY, ...row,
    max_discount: row.max_discount ?? '',
    min_order_value: row.min_order_value ?? '',
    usage_limit: row.usage_limit ?? '',
    per_user_limit: row.per_user_limit ?? '',
    title: row.title || '',
    description: row.description || '',
    first_order_only: row.first_order_only === true,
    is_stackable: row.is_stackable === true,
    starts_at: toLocalInput(row.starts_at),
    expires_at: toLocalInput(row.expires_at),
  };
}

export default function Coupons() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // 'new' | row | null
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [notMigrated, setNotMigrated] = useState(false);
  const [ledger, setLedger] = useState({ id: null, rows: [], loading: false });

  async function load() {
    setLoading(true); setErr('');
    try {
      setList(await adminListCoupons());
      setNotMigrated(false);
    } catch (e) {
      const msg = e.message || String(e);
      if (/is not available/i.test(msg)) { setNotMigrated(true); setList([]); }
      else setErr(msg);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Recomputed as the admin types, so an expiry before the start date or a
  // percentage over 100 is visible before Save is reached.
  const errors = useMemo(() => validateCouponDraft(form), [form]);
  const warnings = useMemo(() => couponWarnings(form), [form]);
  const preview = useMemo(() => couponPreview(form), [form]);

  const counts = useMemo(() => {
    const now = new Date();
    const out = { all: list.length };
    for (const c of list) {
      const s = couponStatus(c, now);
      out[s] = (out[s] || 0) + 1;
    }
    return out;
  }, [list]);

  const visible = useMemo(() => {
    if (filter === 'all') return list;
    const now = new Date();
    return list.filter((c) => couponStatus(c, now) === filter);
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
      is_active: false,
    });
    setEditing('new');
    setErr('');
  }

  async function save(e) {
    e.preventDefault();
    if (errors.length) { setErr(errors[0]); return; }
    setSaving(true); setErr('');
    try {
      await adminSaveCoupon(draftToPayload(form, editing));
      setEditing(null); setForm(EMPTY);
      await load();
    } catch (e2) {
      setErr(e2.message || String(e2));
    }
    setSaving(false);
  }

  async function toggle(row) {
    setErr('');
    try { await adminSetCouponActive(row.id, !row.is_active); await load(); }
    catch (e) { setErr(e.message || String(e)); }
  }

  async function remove(row) {
    if (!window.confirm(`Delete ${row.code}? This cannot be undone.`)) return;
    setErr('');
    try { await adminDeleteCoupon(row.id); await load(); }
    catch (e) { setErr(e.message || String(e)); }
  }

  async function openLedger(row) {
    if (ledger.id === row.id) { setLedger({ id: null, rows: [], loading: false }); return; }
    setLedger({ id: row.id, rows: [], loading: true });
    try { setLedger({ id: row.id, rows: await adminListCouponRedemptions(row.id), loading: false }); }
    catch { setLedger({ id: row.id, rows: [], loading: false }); }
  }

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Coupons</h1>
          <p>
            {loading ? 'Loading…' : `${list.length} ${list.length === 1 ? 'coupon' : 'coupons'}`}
            {' · '}every coupon is created switched off and goes live only when you enable it.
          </p>
        </div>
        <button className="btn btn-sm" onClick={() => startEdit(null)}>+ New coupon</button>
      </div>

      {notMigrated && (
        <div className="adm-banner info">
          The coupons table is not available yet. Run
          {' '}<code>supabase/migrations/0028_coupon_system.sql</code>{' '}
          in the Supabase SQL editor, then reload this page.
        </div>
      )}
      {err && <div className="adm-banner err" role="alert">{err}</div>}

      <div className="adm-chipbar">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            className={`adm-chip ${filter === id ? 'active' : ''}`}
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
          >
            {label} ({counts[id] || 0})
          </button>
        ))}
      </div>

      {editing && (
        <form className="surface pad-lg adm-coupon-form" onSubmit={save}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 14 }}>
            {editing === 'new' ? 'New coupon' : `Edit ${editing.code}`}
          </h2>

          <div className="adm-grid2">
            <div className="field">
              <label className="label" htmlFor="cp-code">Code</label>
              <input
                id="cp-code" className="input" required maxLength={40}
                value={form.code}
                onChange={(e) => set('code', normalizeCode(e.target.value))}
                placeholder="WELCOME200"
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="cp-type">Type</label>
              <select id="cp-type" className="select" value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="flat">Flat ₹ off</option>
                <option value="percent">Percentage off</option>
              </select>
            </div>
          </div>

          <div className="adm-grid2">
            <div className="field">
              <label className="label" htmlFor="cp-value">
                {form.type === 'percent' ? 'Percentage off' : 'Amount off (₹)'}
              </label>
              <input id="cp-value" className="input" type="number" min="0" step="1" required
                value={form.value} onChange={(e) => set('value', e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="cp-cap">Maximum discount (₹)</label>
              <input
                id="cp-cap" className="input" type="number" min="0" step="1"
                value={form.max_discount}
                onChange={(e) => set('max_discount', e.target.value)}
                disabled={form.type !== 'percent'}
                placeholder={form.type === 'percent' ? 'No cap — see the warning below' : 'Not used for a flat discount'}
              />
            </div>
          </div>

          <div className="adm-grid2">
            <div className="field">
              <label className="label" htmlFor="cp-min">Minimum order value (₹)</label>
              <input id="cp-min" className="input" type="number" min="0" step="1" placeholder="0"
                value={form.min_order_value} onChange={(e) => set('min_order_value', e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="cp-total">Total usage limit</label>
              <input id="cp-total" className="input" type="number" min="1" step="1" placeholder="Unlimited"
                value={form.usage_limit} onChange={(e) => set('usage_limit', e.target.value)} />
            </div>
          </div>

          <div className="adm-grid2">
            <div className="field">
              <label className="label" htmlFor="cp-peruser">Per-customer limit</label>
              <input id="cp-peruser" className="input" type="number" min="1" step="1" placeholder="Unlimited"
                value={form.per_user_limit} onChange={(e) => set('per_user_limit', e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="cp-starts">Starts</label>
              <input id="cp-starts" className="input" type="datetime-local"
                value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
            </div>
          </div>

          <div className="adm-grid2">
            <div className="field">
              <label className="label" htmlFor="cp-expires">Expires</label>
              <input id="cp-expires" className="input" type="datetime-local"
                value={form.expires_at} onChange={(e) => set('expires_at', e.target.value)} />
            </div>
            <div />
          </div>

          <h3 className="adm-coupon-sub">Card copy</h3>
          <p className="adm-coupon-hint">
            What the ticket says on the product page and in the cart. Left blank, it
            describes itself from the terms above — the placeholder shows exactly what
            a customer would read.
          </p>
          <div className="adm-grid2">
            <div className="field">
              <label className="label" htmlFor="cp-title">Title</label>
              <input id="cp-title" className="input" maxLength={80} placeholder={preview.title}
                value={form.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="cp-desc">Description</label>
              <input id="cp-desc" className="input" maxLength={140} placeholder={preview.description}
                value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
          </div>

          <div className="adm-checkrow">
            <input type="checkbox" id="cp-first" checked={form.first_order_only}
              onChange={(e) => set('first_order_only', e.target.checked)} />
            <label htmlFor="cp-first">First order only — refused for anyone who already has a paid order</label>
          </div>
          <div className="adm-checkrow">
            <input type="checkbox" id="cp-stack" checked={form.is_stackable}
              onChange={(e) => set('is_stackable', e.target.checked)} />
            <label htmlFor="cp-stack">Stackable with other coupons (one coupon per order is still the rule today)</label>
          </div>

          <h3 className="adm-coupon-sub">Preview</h3>
          <p className="adm-coupon-hint">
            The real storefront ticket. It carries no rupee figure by design: what a
            coupon is worth depends on the whole basket, so the amount is shown in the
            cart, where the basket exists.
          </p>
          <ul className="pdp-coupons__list adm-coupon-preview">
            <CouponTicket coupon={preview} />
          </ul>

          {errors.length > 0 && (
            <div className="adm-banner err" role="alert">
              <ul className="adm-coupon-msgs">{errors.map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="adm-banner info">
              <ul className="adm-coupon-msgs">{warnings.map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-sm" type="submit" disabled={saving || errors.length > 0}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setEditing(null); setErr(''); }}>
              Cancel
            </button>
            {editing === 'new' && (
              <span className="adm-coupon-hint" style={{ margin: 0 }}>
                Saves switched off — enable it from the list when you are ready.
              </span>
            )}
          </div>
        </form>
      )}

      {loading ? null : !visible.length ? (
        <div className="adm-empty">
          {list.length ? 'No coupons in this state.' : 'No coupons yet. Nothing is being offered to customers.'}
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Code</th><th>Terms</th><th>Window</th><th>Used</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const status = couponStatus(c);
                const used = Number(c.used_count) || 0;
                return (
                  <Fragment key={c.id}>
                    <tr className={c.is_active ? '' : 'is-muted'}>
                      <td>
                        <strong>{c.code}</strong>
                        {c.title && <div className="adm-coupon-sm">{c.title}</div>}
                        {(c.first_order_only || c.is_stackable) && (
                          <div className="adm-coupon-sm">
                            {c.first_order_only && 'First order only'}
                            {c.first_order_only && c.is_stackable && ' · '}
                            {c.is_stackable && 'Stackable'}
                          </div>
                        )}
                      </td>
                      <td>{termsLine(c)}</td>
                      <td className="adm-coupon-sm">
                        {when(c.starts_at)}
                        <br />→ {c.expires_at ? when(c.expires_at) : 'no expiry'}
                      </td>
                      <td>
                        {/* used_count is maintained by consume_coupon() under
                            its row lock. This opens the redemption rows behind
                            that number. */}
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => openLedger(c)}>
                          {used}{c.usage_limit != null ? ` / ${c.usage_limit}` : ''}
                        </button>
                        {c.per_user_limit != null && (
                          <div className="adm-coupon-sm">max {c.per_user_limit} per customer</div>
                        )}
                      </td>
                      <td><span className={`adm-coupon-badge is-${status}`}>{status}</span></td>
                      <td className="adm-actions">
                        <button className="btn btn-sm btn-light" onClick={() => toggle(c)}>
                          {c.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => startEdit(c)}>Edit</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => duplicate(c)}>Duplicate</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => remove(c)}>Delete</button>
                      </td>
                    </tr>
                    {ledger.id === c.id && (
                      <tr>
                        <td colSpan={6}>
                          {ledger.loading ? <span className="adm-coupon-sm">Loading redemptions…</span>
                            : !ledger.rows.length ? <span className="adm-coupon-sm">No redemptions yet.</span>
                            : (
                              <ul className="adm-coupon-ledger">
                                {ledger.rows.map((r) => (
                                  <li key={r.id}>
                                    <strong>{r.order_number || '—'}</strong>
                                    <span>{when(r.created_at)}</span>
                                    <span>{r.user_id ? `customer ${String(r.user_id).slice(0, 8)}…` : 'guest'}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
