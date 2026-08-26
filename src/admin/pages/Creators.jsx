import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminListCreators, adminCreateCreator, adminSetCreatorStatus, CREATOR_STATUSES,
  adminGetProgramSettings, adminSetProgramSettings,
} from '../../lib/creatorApi.js';

// ============================================================
// ADMIN — Creator Program › Creators
//
// The list + "add creator" entry point. The public creator code is NOT an
// input here: the database generates a unique, non-sequential code on insert.
// ============================================================

const STATUS_BADGE = {
  active: 'badge-best',
  pending: 'badge-soft',
  paused: 'badge-soft',
  suspended: 'badge-sale',
  archived: 'badge-out',
};

const blank = {
  display_name: '', legal_name: '', email: '', phone: '',
  status: 'pending', default_commission_rate: 10,
  default_attribution_window_days: 30, payout_eligible: false, notes: '',
};

export default function Creators() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blank);
  const [filter, setFilter] = useState('all');
  const [program, setProgram] = useState(null);
  const [savingProgram, setSavingProgram] = useState(false);

  async function load() {
    try {
      setRows(await adminListCreators());
      setErr('');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); adminGetProgramSettings().then(setProgram).catch(() => {}); }, []);

  async function saveProgram(next) {
    setSavingProgram(true);
    try {
      const saved = await adminSetProgramSettings(next);
      setProgram(saved);
      flash(next.auto_approve ? 'Applications now auto-approve' : 'Applications now start as pending');
    } catch (e) {
      setErr(e.message || String(e));
    } finally { setSavingProgram(false); }
  }

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  function flash(t) { setMsg(t); setTimeout(() => setMsg((m) => (m === t ? '' : m)), 2500); }

  async function create(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const created = await adminCreateCreator(form);
      setAdding(false); setForm(blank);
      await load();
      flash(`Creator created — code ${created.creator_code}`);
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally { setBusy(false); }
  }

  async function setStatus(row, status) {
    setBusy(true);
    try { await adminSetCreatorStatus(row.id, status); await load(); flash(`${row.display_name} → ${status}`); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  const visible = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Creators</h1>
          <p>{loading ? 'Loading…' : `${rows.length} creators · ${rows.filter((r) => r.status === 'active').length} active`}</p>
        </div>
        {!adding && <button className="btn" onClick={() => setAdding(true)}>Add creator</button>}
      </div>

      {err && <div className="adm-banner err">{err}</div>}
      {msg && <div className="adm-banner ok">{msg}</div>}

      {/* Approval policy for self-onboarded (customer) applications. */}
      {program && (
        <div className="surface">
          <h2>Application approval</h2>
          <p className="hint" style={{ marginTop: -4 }}>
            Controls what happens when an existing customer applies from their account.
          </p>
          <div className="adm-checkrow">
            <input
              type="checkbox" id="auto-approve"
              checked={!!program.auto_approve}
              disabled={savingProgram}
              onChange={(e) => saveProgram({ ...program, auto_approve: e.target.checked })}
            />
            <label htmlFor="auto-approve">
              Auto-approve new applications{' '}
              <span className="hint">
                {program.auto_approve
                  ? '(applicants become active immediately)'
                  : '(applicants start as pending for your review)'}
              </span>
            </label>
          </div>
          <div className="adm-grid2" style={{ marginTop: 10 }}>
            <div className="field">
              <label className="label">Default commission rate (%)</label>
              <input
                className="input" type="number" min="0" max="100" step="0.5"
                defaultValue={program.default_commission_rate}
                onBlur={(e) => saveProgram({ ...program, default_commission_rate: e.target.value })}
              />
              <p className="hint">Applied to new applicants. Stored for Part 2 — no commission is calculated yet.</p>
            </div>
            <div className="field">
              <label className="label">Default attribution window (days)</label>
              <input
                className="input" type="number" min="1" max="365"
                defaultValue={program.default_attribution_window_days}
                onBlur={(e) => saveProgram({ ...program, default_attribution_window_days: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {adding && (
        <form className="surface" onSubmit={create}>
          <h2>New creator</h2>
          <p className="hint" style={{ marginTop: -4, marginBottom: 12 }}>
            The public creator code is generated automatically and is unique — you can change it later from the creator’s page.
          </p>

          <div className="adm-grid2">
            <div className="field">
              <label className="label">Display name (public)</label>
              <input className="input" required value={form.display_name} onChange={(e) => set('display_name', e.target.value)} placeholder="Anjali Sharma" />
            </div>
            <div className="field">
              <label className="label">Legal name (internal)</label>
              <input className="input" value={form.legal_name} onChange={(e) => set('legal_name', e.target.value)} />
            </div>
          </div>

          <div className="adm-grid2">
            <div className="field">
              <label className="label">Email</label>
              <input className="input" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
              <p className="hint">The creator signs in with this email to reach their portal.</p>
            </div>
            <div className="field">
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>

          <div className="adm-grid2">
            <div className="field">
              <label className="label">Commission rate (%)</label>
              <input className="input" type="number" min="0" max="100" step="0.5" value={form.default_commission_rate} onChange={(e) => set('default_commission_rate', e.target.value)} />
              <p className="hint">Stored for Part 2. No commission is calculated yet.</p>
            </div>
            <div className="field">
              <label className="label">Attribution window (days)</label>
              <input className="input" type="number" min="1" max="365" value={form.default_attribution_window_days} onChange={(e) => set('default_attribution_window_days', e.target.value)} />
            </div>
          </div>

          <div className="adm-grid2">
            <div className="field">
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {CREATOR_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Internal notes</label>
              <input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create creator'}</button>
            <button className="btn btn-outline" type="button" onClick={() => { setAdding(false); setForm(blank); }}>Cancel</button>
          </div>
        </form>
      )}

      <div className="surface" style={{ paddingBlock: 12 }}>
        <div className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor="cf">Filter by status</label>
          <select id="cf" className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            {CREATOR_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading creators…</p>
      ) : visible.length === 0 ? (
        <div className="adm-empty">
          {rows.length === 0
            ? 'No creators yet. Add your first creator to start the program.'
            : 'No creators with that status.'}
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Creator</th><th>Code</th><th className="adm-items__amt">Commission</th>
                <th className="adm-items__qty">Window</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className={r.status === 'archived' ? 'is-muted' : ''}>
                  <td>
                    <Link to={`/admin/creators/${r.id}`} className="adm-link"><strong>{r.display_name}</strong></Link>
                    <span className="hint" style={{ display: 'block' }}>{r.email}</span>
                  </td>
                  <td className="adm-mono">{r.creator_code}</td>
                  <td className="adm-items__amt">{Number(r.default_commission_rate)}%</td>
                  <td className="adm-items__qty">{r.default_attribution_window_days}d</td>
                  <td><span className={`badge ${STATUS_BADGE[r.status] || 'badge-soft'}`}>{r.status}</span></td>
                  <td>
                    <div className="adm-rowacts">
                      <Link to={`/admin/creators/${r.id}`} className="btn btn-sm btn-light">Open</Link>
                      {r.status !== 'active' && r.status !== 'archived' && (
                        <button className="btn btn-sm btn-light" onClick={() => setStatus(r, 'active')} disabled={busy}>Activate</button>
                      )}
                      {r.status === 'active' && (
                        <button className="btn btn-sm btn-light" onClick={() => setStatus(r, 'paused')} disabled={busy}>Pause</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
