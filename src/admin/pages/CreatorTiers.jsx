import { useCallback, useEffect, useState } from 'react';
import {
  adminGetTierLadder, adminSetTierLadder, adminListLevelRewards, adminUpsertLevelReward, adminDeleteLevelReward,
  adminListRewardClaims, adminSetRewardClaimStatus,
} from '../../lib/creatorApi.js';
import { DEFAULT_LADDER, DEFAULT_BEYOND_STEP, ladderErrorMessage, normalizeLadder, rupees, validateLadder } from '../../lib/creatorTiers.js';
import {
  CLAIM_STATUSES, CLAIM_STATUS_LABEL, REWARD_OPTION_SLOTS, REWARD_TYPES, REWARD_TYPE_LABEL,
  groupRewardsByLevel, rewardOptionErrorMessage, validateRewardOption,
} from '../../lib/creatorRewards.js';

// ============================================================
// ADMIN — Creator Program › Tiers & Rewards
//
// Three editors on one page, each writing through its own guarded path:
//   ladder  → admin_set_creator_tier_levels() — replaced atomically, validated
//             server-side again (contiguous, ascending, first at ₹0).
//   rewards → creator_level_rewards, direct upsert on (level, slot) under the
//             admin write policy. Keys the editor did not touch are ABSENT
//             from the row (omit-when-absent), so a slot keeps them.
//   claims  → admin_set_reward_claim_status() — pending → fulfilled/cancelled.
//
// Changing the ladder changes the rate of FUTURE commission rows only; every
// existing row keeps the rate it was recorded at.
// ============================================================

const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN') : '—');
const CLAIM_BADGE = { pending: 'badge-soft', fulfilled: 'badge-best', cancelled: 'badge-out' };

export default function CreatorTiers() {
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  function flash(t) { setMsg(t); setTimeout(() => setMsg((m) => (m === t ? '' : m)), 2800); }
  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Creator tiers &amp; rewards</h1>
          <p>Commission ladder, level rewards and reward claims. Rate changes apply to future sales only.</p>
        </div>
      </div>
      {err && <div className="adm-banner err">{err}</div>}
      {msg && <div className="adm-banner ok">{msg}</div>}

      <LadderEditor onError={setErr} onFlash={flash} />
      <RewardsEditor onError={setErr} onFlash={flash} />
      <ClaimsList onError={setErr} onFlash={flash} />
    </div>
  );
}

// ---------------------------------------------------------------
// Ladder
// ---------------------------------------------------------------
export function LadderEditor({ onError, onFlash, initial = null }) {
  const [rows, setRows] = useState(initial?.levels ? normalizeLadder(initial.levels) : []);
  const [beyond, setBeyond] = useState(initial ? String(initial.beyond_step ?? DEFAULT_BEYOND_STEP) : '');
  const [loading, setLoading] = useState(!initial);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const l = await adminGetTierLadder();
      setRows(normalizeLadder(l.levels));
      setBeyond(String(l.beyond_step ?? DEFAULT_BEYOND_STEP));
      setDirty(false);
    } catch (e) { onError(e.message || String(e)); }
    finally { setLoading(false); }
  }, [onError]);
  useEffect(() => { if (!initial) load(); }, [load, initial]);

  const check = validateLadder(rows, beyond);
  const problem = rows.length ? ladderErrorMessage(check) : '';

  const set = (i, key, v) => { setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: key === 'rank' ? v : (v === '' ? NaN : Number(v)) } : row))); setDirty(true); };
  const add = () => {
    setRows((r) => {
      const last = r[r.length - 1];
      return [...r, { level: r.length + 1, rank: last?.rank || 'Rise', threshold: last ? last.threshold + 25000 : 0, rate: last ? last.rate : 10 }];
    });
    setDirty(true);
  };
  const remove = (i) => { setRows((r) => r.filter((_, j) => j !== i).map((row, j) => ({ ...row, level: j + 1 }))); setDirty(true); };
  const restore = () => { setRows(normalizeLadder(DEFAULT_LADDER)); setBeyond(String(DEFAULT_BEYOND_STEP)); setDirty(true); };

  async function save() {
    if (!check.ok) { onError(ladderErrorMessage(check)); return; }
    if (!window.confirm(`Replace the ladder with ${rows.length} levels?\n\nThe new rates apply to commission recorded from now on. Nothing already recorded changes.`)) return;
    setSaving(true);
    try {
      const res = await adminSetTierLadder(rows, beyond);
      if (res && res.ok === false) { onError(ladderErrorMessage(res)); }
      else { onFlash(`Ladder saved — ${res?.levels ?? rows.length} levels.`); await load(); }
    } catch (e) { onError(e.message || String(e)); }
    finally { setSaving(false); }
  }

  return (
    <section className="surface adm-tiers">
      <h2>Commission ladder</h2>
      <p className="hint" style={{ marginTop: -4 }}>
        Thresholds are confirmed lifetime sales through the creator’s own links. Exactly on a threshold counts. Thresholds must ascend and a higher level cannot pay less.
      </p>
      {loading ? <p className="muted">Loading ladder…</p> : (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table adm-tiers__table">
              <thead>
                <tr><th>Level</th><th>Rank</th><th className="adm-items__amt">Threshold (₹)</th><th className="adm-items__amt">Rate (%)</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} data-level={r.level}>
                    <td className="adm-mono">L{r.level}</td>
                    <td><input className="input" value={r.rank} maxLength={40} onChange={(e) => set(i, 'rank', e.target.value)} aria-label={`Rank for level ${r.level}`} /></td>
                    <td className="adm-items__amt"><input className="input" type="number" min="0" step="1" value={Number.isFinite(r.threshold) ? r.threshold : ''} onChange={(e) => set(i, 'threshold', e.target.value)} disabled={i === 0} aria-label={`Threshold for level ${r.level}`} /></td>
                    <td className="adm-items__amt"><input className="input" type="number" min="0" max="100" step="0.5" value={Number.isFinite(r.rate) ? r.rate : ''} onChange={(e) => set(i, 'rate', e.target.value)} aria-label={`Rate for level ${r.level}`} /></td>
                    <td><button type="button" className="btn btn-sm btn-light" onClick={() => remove(i)} disabled={rows.length <= 1 || saving}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="adm-grid2" style={{ marginTop: 12 }}>
            <div className="field">
              <label className="label" htmlFor="tier-beyond">Beyond the top level: a new level every (₹)</label>
              <input id="tier-beyond" className="input" type="number" min="0" step="1000" value={beyond} onChange={(e) => { setBeyond(e.target.value); setDirty(true); }} />
              <p className="hint">At the top level’s rate. 0 stops the ladder at the last level.</p>
            </div>
            <div className="field">
              <label className="label">Preview</label>
              <p className="hint" style={{ marginTop: 6 }}>
                {rows.length} levels · top {rows.length ? `${rupees(rows[rows.length - 1].threshold)} at ${rows[rows.length - 1].rate}%` : '—'}
              </p>
            </div>
          </div>
          {problem && <div className="adm-banner err" role="alert">{problem}</div>}
          <div className="adm-rowacts" style={{ marginTop: 10 }}>
            <button type="button" className="btn" onClick={save} disabled={saving || !dirty || !check.ok}>{saving ? 'Saving…' : 'Save ladder'}</button>
            <button type="button" className="btn btn-sm btn-light" onClick={add} disabled={saving}>Add level</button>
            <button type="button" className="btn btn-sm btn-light" onClick={restore} disabled={saving}>Restore defaults</button>
            {dirty && <button type="button" className="btn btn-sm btn-light" onClick={load} disabled={saving}>Discard changes</button>}
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------
// Rewards — three slots per level
// ---------------------------------------------------------------
const blankOption = (level, slot) => ({ level, option_index: slot, label: '', description: '', reward_type: 'product', value: '', is_active: true });

export function RewardsEditor({ onError, onFlash, initial = null }) {
  const [rows, setRows] = useState(initial || []);
  const [loading, setLoading] = useState(!initial);
  const [newLevel, setNewLevel] = useState('');
  const [openLevels, setOpenLevels] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await adminListLevelRewards()); }
    catch (e) { onError(e.message || String(e)); }
    finally { setLoading(false); }
  }, [onError]);
  useEffect(() => { if (!initial) load(); }, [load, initial]);

  const groups = groupRewardsByLevel(rows);
  const levels = [...new Set([...groups.map((g) => g.level), ...openLevels])].sort((a, b) => a - b);

  const addLevel = () => {
    const lv = Number(newLevel);
    if (!Number.isInteger(lv) || lv < 1) { onError('Enter a level of 1 or more.'); return; }
    setOpenLevels((o) => (o.includes(lv) ? o : [...o, lv]));
    setNewLevel('');
  };

  return (
    <section className="surface adm-rewards">
      <h2>Level rewards</h2>
      <p className="hint" style={{ marginTop: -4 }}>
        Three options per level; the creator picks one when they reach it. A level with no options shows nothing in the portal. Nothing is configured until you add it here.
      </p>
      {loading ? <p className="muted">Loading rewards…</p> : (
        <>
          {levels.length === 0 && <div className="adm-empty">No rewards configured yet. Add a level below to define its three options.</div>}
          {levels.map((level) => {
            const slots = groups.find((g) => g.level === level)?.slots || {};
            return (
              <div key={level} className="adm-rewards__level" data-level={level}>
                <h3 className="adm-rewards__h">Level {level}</h3>
                <div className="adm-rewards__grid">
                  {REWARD_OPTION_SLOTS.map((slot) => (
                    <RewardSlot key={slot} level={level} slot={slot} row={slots[slot] || null} onError={onError} onFlash={onFlash} onSaved={load} />
                  ))}
                </div>
              </div>
            );
          })}
          <div className="adm-rewards__add">
            <div className="field" style={{ margin: 0 }}>
              <label className="label" htmlFor="reward-level">Add rewards for level</label>
              <div className="adm-rowacts">
                <input id="reward-level" className="input" type="number" min="1" step="1" value={newLevel} onChange={(e) => setNewLevel(e.target.value)} style={{ maxWidth: 120 }} />
                <button type="button" className="btn btn-sm" onClick={addLevel}>Add level</button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function RewardSlot({ level, slot, row, onError, onFlash, onSaved }) {
  const [form, setForm] = useState(row ? { ...row } : blankOption(level, slot));
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setForm(row ? { ...row } : blankOption(level, slot)); setDirty(false); }, [row, level, slot]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setDirty(true); };
  const check = validateRewardOption(form);

  async function save() {
    if (!check.ok) { onError(rewardOptionErrorMessage(check)); return; }
    setBusy(true);
    try {
      const res = await adminUpsertLevelReward(form);
      if (res && res.ok === false) onError(rewardOptionErrorMessage(res));
      else { onFlash(`Level ${level} · option ${slot} saved.`); setDirty(false); await onSaved(); }
    } catch (e) { onError(e.message || String(e)); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!row?.id) { setForm(blankOption(level, slot)); setDirty(false); return; }
    if (!window.confirm(`Delete option ${slot} of level ${level}? Claims already made keep their snapshot.`)) return;
    setBusy(true);
    try { await adminDeleteLevelReward(row.id); onFlash(`Level ${level} · option ${slot} deleted.`); await onSaved(); }
    catch (e) { onError(e.message || String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className={`adm-reward-slot${row ? '' : ' is-empty'}`} data-slot={slot}>
      <div className="adm-reward-slot__head">
        <span className="hint">Option {slot}</span>
        {row && <span className={`badge ${row.is_active ? 'badge-best' : 'badge-out'}`}>{row.is_active ? 'Active' : 'Inactive'}</span>}
      </div>
      <div className="field">
        <label className="label">Label</label>
        <input className="input" value={form.label} maxLength={120} onChange={(e) => set('label', e.target.value)} placeholder="e.g. SORA LIFE gift box" />
      </div>
      <div className="adm-grid2">
        <div className="field">
          <label className="label">Type</label>
          <select className="select" value={form.reward_type} onChange={(e) => set('reward_type', e.target.value)}>
            {REWARD_TYPES.map((t) => <option key={t} value={t}>{REWARD_TYPE_LABEL[t]}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">Value</label>
          <input className="input" value={form.value ?? ''} onChange={(e) => set('value', e.target.value)} placeholder={form.reward_type === 'cash' ? '₹2,000' : 'What they receive'} />
        </div>
      </div>
      <div className="field">
        <label className="label">Description</label>
        <input className="input" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Shown under the label in the portal" />
      </div>
      <div className="adm-checkrow">
        <input type="checkbox" id={`rw-${level}-${slot}-active`} checked={form.is_active !== false} onChange={(e) => set('is_active', e.target.checked)} />
        <label htmlFor={`rw-${level}-${slot}-active`}>Active <span className="hint">(inactive options are hidden from creators)</span></label>
      </div>
      <div className="adm-rowacts">
        <button type="button" className="btn btn-sm" onClick={save} disabled={busy || !dirty || !check.ok}>{busy ? 'Saving…' : row ? 'Save' : 'Create'}</button>
        {(row || dirty) && <button type="button" className="btn btn-sm btn-light" onClick={remove} disabled={busy}>{row ? 'Delete' : 'Clear'}</button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Claims
// ---------------------------------------------------------------
export function ClaimsList({ onError, onFlash, initial = null }) {
  const [rows, setRows] = useState(initial || []);
  const [loading, setLoading] = useState(!initial);
  const [filter, setFilter] = useState('pending');
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await adminListRewardClaims({ status: filter })); }
    catch (e) { onError(e.message || String(e)); }
    finally { setLoading(false); }
  }, [filter, onError]);
  useEffect(() => { if (!initial) load(); }, [load, initial]);

  async function setStatus(row, status) {
    let notes = null;
    if (status === 'cancelled') {
      notes = window.prompt(`Cancel ${row.creator?.display_name || 'this creator'}'s Level ${row.level} reward (${row.label})?\n\nReason (internal):`, '');
      if (notes == null) return;
    } else if (!window.confirm(`Mark ${row.creator?.display_name || 'this creator'}'s Level ${row.level} reward as fulfilled?\n\n${row.label}${row.value ? ` · ${row.value}` : ''}`)) return;
    setBusy(row.id);
    try {
      const res = await adminSetRewardClaimStatus(row.id, status, notes);
      if (res && res.ok === false) onError(res.reason || 'Could not update.');
      else { onFlash(`Claim marked ${CLAIM_STATUS_LABEL[status].toLowerCase()}.`); await load(); }
    } catch (e) { onError(e.message || String(e)); }
    finally { setBusy(null); }
  }

  return (
    <section className="surface adm-claims">
      <h2>Reward claims</h2>
      <div className="adm-chipbar">
        {['all', ...CLAIM_STATUSES].map((s) => (
          <button key={s} type="button" className={`adm-chip ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : CLAIM_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {loading ? <p className="muted">Loading claims…</p> : rows.length === 0 ? (
        <div className="adm-empty">No {filter === 'all' ? '' : CLAIM_STATUS_LABEL[filter].toLowerCase() + ' '}claims.</div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Creator</th><th>Level</th><th>Chosen</th><th>Claimed</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-claim={r.id}>
                  <td><strong>{r.creator?.display_name || 'Creator'}</strong><span className="hint adm-mono" style={{ display: 'block' }}>{r.creator?.creator_code || r.creator_id}</span></td>
                  <td className="adm-mono">L{r.level}</td>
                  <td>{r.label}{r.value ? <span className="hint" style={{ display: 'block' }}>{REWARD_TYPE_LABEL[r.reward_type] || r.reward_type} · {r.value}</span> : <span className="hint" style={{ display: 'block' }}>{REWARD_TYPE_LABEL[r.reward_type] || r.reward_type} · option {r.option_index}</span>}</td>
                  <td>{fmtDateTime(r.claimed_at)}</td>
                  <td><span className={`badge ${CLAIM_BADGE[r.status] || 'badge-soft'}`}>{CLAIM_STATUS_LABEL[r.status] || r.status}</span>{r.admin_notes && <span className="hint" style={{ display: 'block' }}>{r.admin_notes}</span>}</td>
                  <td>
                    {r.status === 'pending' && (
                      <div className="adm-rowacts">
                        <button type="button" className="btn btn-sm" disabled={busy === r.id} onClick={() => setStatus(r, 'fulfilled')}>Mark fulfilled</button>
                        <button type="button" className="btn btn-sm btn-light" disabled={busy === r.id} onClick={() => setStatus(r, 'cancelled')}>Cancel</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
