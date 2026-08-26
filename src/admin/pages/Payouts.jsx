import { useCallback, useEffect, useState } from 'react';
import { money2 } from '../../lib/format.js';
import {
  adminListPayouts, adminGetPayoutLedger, adminGetPayoutAudit, adminGetKycForCreator,
  adminReviewPayout, adminMarkPayoutPaid, PAYOUT_STATUSES,
} from '../../lib/creatorApi.js';

// ============================================================
// ADMIN — Creator Program › Payouts
//
// The one place money leaves SORA LIFE — and it never leaves automatically. A
// creator can only *request*; an admin reviews the derived ledger, checks KYC,
// pays the creator MANUALLY through the bank/UPI, then records the payment here
// with its transaction reference. "Mark as paid" only asserts that a human made
// that transfer — the app moves no money and validates paid ≤ approved, one
// reference per payout, and never double-pays.
// ============================================================

const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN') : '—');
const STATUS_BADGE = {
  requested: 'badge-soft', under_review: 'badge-soft', approved: 'badge-best',
  paid: 'badge-best', rejected: 'badge-out', cancelled: 'badge-out',
};
const STATUS_LABEL = {
  requested: 'Requested', under_review: 'Under review', approved: 'Approved',
  paid: 'Paid', rejected: 'Rejected', cancelled: 'Cancelled',
};
const KYC_LABEL = {
  verified: 'Verified', pending: 'Under review', not_started: 'Not started',
  rejected: 'Rejected', needs_update: 'Needs update',
};

export default function Payouts() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState({ ledger: [], audit: [], kyc: null });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminListPayouts({ status: filter }));
      setErr('');
    } catch (e) { setErr(e.message || String(e)); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function flash(t) { setMsg(t); setTimeout(() => setMsg((m) => (m === t ? '' : m)), 3000); }

  async function toggle(row) {
    if (expanded === row.id) { setExpanded(null); return; }
    setExpanded(row.id);
    setDetail({ ledger: [], audit: [], kyc: null });
    try {
      const [ledger, audit, kyc] = await Promise.all([
        adminGetPayoutLedger(row.id), adminGetPayoutAudit(row.id), adminGetKycForCreator(row.creator_id),
      ]);
      setDetail({ ledger, audit, kyc });
    } catch (e) { setErr(e.message || String(e)); }
  }

  async function review(row, action) {
    let notes = null;
    if (action === 'reject') {
      notes = window.prompt('Reason for rejecting this payout (shown to the creator)? The reserved balance is released back to Available.', '');
      if (notes == null) return;
    }
    setBusy(true);
    try {
      const res = await adminReviewPayout(row.id, action, notes);
      if (res && res.ok === false) setErr(mapErr(res.reason));
      else { await load(); if (expanded === row.id) toggleRefresh(row); flash(`Payout ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'moved to review'}.`); }
    } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function toggleRefresh(row) {
    try {
      const [ledger, audit, kyc] = await Promise.all([
        adminGetPayoutLedger(row.id), adminGetPayoutAudit(row.id), adminGetKycForCreator(row.creator_id),
      ]);
      setDetail({ ledger, audit, kyc });
    } catch { /* non-fatal */ }
  }

  async function markPaid(row) {
    const reference = window.prompt(`Record the MANUAL payment for ${row.creator?.display_name}.\n\nEnter the bank/UPI transaction reference (required). This does NOT move money — it records that you already paid ${money2(row.requested_amount)} externally.`, '');
    if (reference == null) return;
    if (!reference.trim()) { setErr('A transaction reference is required to mark a payout paid.'); return; }
    const amtStr = window.prompt(`Amount actually paid? (must not exceed approved ${money2(row.requested_amount)})`, String(row.requested_amount));
    if (amtStr == null) return;
    const amt = Number(amtStr);
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Enter a valid paid amount.'); return; }
    if (amt > Number(row.requested_amount) + 0.001) { setErr('Paid amount cannot exceed the approved amount.'); return; }
    if (!window.confirm(`Confirm: you have already transferred ${money2(amt)} to ${row.creator?.display_name} (ref ${reference.trim()}). Mark this payout as PAID?`)) return;
    setBusy(true);
    try {
      const res = await adminMarkPayoutPaid(row.id, amt, reference.trim(), null);
      if (res && res.ok === false) setErr(mapErr(res.reason, row));
      else if (res && res.noop === 'already_paid') { await load(); flash('Already marked paid — no change (idempotent).'); }
      else { await load(); if (expanded === row.id) toggleRefresh(row); flash('Payout marked paid and settled in the ledger.'); }
    } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  const totals = rows.reduce((a, r) => {
    a[r.status] = (a[r.status] || 0) + 1;
    if (['requested', 'under_review', 'approved'].includes(r.status)) a.outstanding += Number(r.requested_amount || 0);
    if (r.status === 'paid') a.paid += Number(r.paid_amount ?? r.requested_amount ?? 0);
    return a;
  }, { outstanding: 0, paid: 0 });

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Creator Payouts</h1>
          <p>{loading ? 'Loading…' : `${rows.length} requests · ${money2(totals.outstanding)} outstanding · ${money2(totals.paid)} paid`}</p>
        </div>
      </div>

      {err && <div className="adm-banner err">{err}</div>}
      {msg && <div className="adm-banner ok">{msg}</div>}

      <div className="adm-chipbar">
        {['all', ...PAYOUT_STATUSES].map((s) => (
          <button key={s} className={`adm-chip ${filter === s ? 'active' : ''}`} onClick={() => { setFilter(s); setExpanded(null); }}>
            {s === 'all' ? 'All' : STATUS_LABEL[s]}{s !== 'all' && totals[s] ? ` (${totals[s]})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted">Loading payout requests…</p>
      ) : rows.length === 0 ? (
        <div className="adm-empty">No payout requests{filter !== 'all' ? ` with status “${STATUS_LABEL[filter]}”` : ' yet'}. They appear when a verified creator requests a payout during the monthly window.</div>
      ) : (
        <div className="adm-payout-grid">
          {rows.map((r) => {
            const snap = r.payout_method_snapshot || {};
            const open = expanded === r.id;
            return (
              <article key={r.id} className={`surface adm-payout-card ${open ? 'is-open' : ''}`}>
                <div className="adm-payout-card__head">
                  <div>
                    <h3>{r.creator?.display_name || 'Creator'} <span className="hint adm-mono">{r.creator?.creator_code}</span></h3>
                    <span className="hint">{r.payout_period} · requested {fmtDateTime(r.requested_at)}</span>
                  </div>
                  <div className="adm-payout-card__amt">
                    <span className="adm-price">{money2(r.status === 'paid' ? (r.paid_amount ?? r.requested_amount) : r.requested_amount)}</span>
                    <span className={`badge ${STATUS_BADGE[r.status] || 'badge-soft'}`}>{STATUS_LABEL[r.status] || r.status}</span>
                  </div>
                </div>

                <div className="adm-payout-card__quick">
                  <span>Method: <strong>{snap.method === 'upi' ? 'UPI' : snap.method === 'bank' ? 'Bank' : '—'}</strong></span>
                  <span>{snap.method === 'upi' ? snap.upi : snap.account}{snap.method === 'bank' && snap.ifsc ? ` · ${snap.ifsc}` : ''}</span>
                  {r.payment_reference && <span>Ref: <strong className="adm-mono">{r.payment_reference}</strong></span>}
                </div>

                <div className="adm-payout-card__acts">
                  <button className="btn btn-sm btn-light" onClick={() => toggle(r)}>{open ? 'Hide detail' : 'Review detail'}</button>
                  {(r.status === 'requested' || r.status === 'under_review') && (
                    <>
                      {r.status === 'requested' && <button className="btn btn-sm btn-light" disabled={busy} onClick={() => review(r, 'review')}>Mark under review</button>}
                      <button className="btn btn-sm" disabled={busy} onClick={() => review(r, 'approve')}>Approve</button>
                      <button className="btn btn-sm btn-light" disabled={busy} onClick={() => review(r, 'reject')}>Reject</button>
                    </>
                  )}
                  {r.status === 'approved' && (
                    <button className="btn btn-sm" disabled={busy} onClick={() => markPaid(r)}>Mark as paid…</button>
                  )}
                </div>

                {open && (
                  <div className="adm-payout-detail">
                    <section className="adm-order-block">
                      <h3>KYC &amp; payout destination</h3>
                      {detail.kyc ? (
                        <>
                          <p className="adm-payout-kyc">
                            <span className={`badge ${detail.kyc.identity_status === 'verified' ? 'badge-best' : 'badge-out'}`}>
                              KYC: {KYC_LABEL[detail.kyc.identity_status] || detail.kyc.identity_status}
                            </span>
                          </p>
                          <dl className="adm-kv">
                            <div><dt>Legal name</dt><dd>{detail.kyc.legal_name || '—'}</dd></div>
                            <div><dt>PAN</dt><dd className="adm-mono">{detail.kyc.pan_masked || '—'}</dd></div>
                            {snap.method === 'bank' ? <>
                              <div><dt>Account holder</dt><dd>{snap.account_holder || detail.kyc.payout_account_holder || '—'}</dd></div>
                              <div><dt>Account</dt><dd className="adm-mono">{snap.account || detail.kyc.payout_account_masked || '—'}</dd></div>
                              <div><dt>IFSC</dt><dd className="adm-mono">{snap.ifsc || detail.kyc.ifsc_masked || '—'}</dd></div>
                            </> : (
                              <div><dt>UPI</dt><dd className="adm-mono">{snap.upi || detail.kyc.upi_masked || '—'}</dd></div>
                            )}
                          </dl>
                          <p className="hint"><span aria-hidden>🔒</span> Masked only. Pay through your secure banking channel using the real details on file there.</p>
                        </>
                      ) : <p className="muted">No KYC on file for this creator.</p>}
                    </section>

                    <section className="adm-order-block">
                      <h3>Reserved ledger entries</h3>
                      {detail.ledger.length === 0 ? <p className="muted">No ledger entries linked to this payout.</p> : (
                        <table className="adm-items">
                          <thead><tr><th>Order</th><th>Type</th><th>Status</th><th className="adm-items__amt">Amount</th></tr></thead>
                          <tbody>
                            {detail.ledger.map((l) => (
                              <tr key={l.id}>
                                <td className="adm-mono">{l.order_id ? String(l.order_id).slice(0, 8) : '—'}</td>
                                <td>{l.type}</td>
                                <td>{l.status}</td>
                                <td className="adm-items__amt adm-price">{money2(l.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <p className="adm-payout-detail__sum">
                        Reserved total: <strong>{money2(detail.ledger.reduce((s, l) => s + Number(l.amount || 0), 0))}</strong>
                        {' '}· Requested: <strong>{money2(r.requested_amount)}</strong>
                      </p>
                    </section>

                    <section className="adm-order-block adm-order-block--wide">
                      <h3>Status history</h3>
                      <ol className="adm-timeline">
                        {detail.audit.length === 0 ? <li><span className="adm-timeline__label muted">No history</span></li> :
                          detail.audit.map((a, i) => (
                            <li key={i}>
                              <span className="adm-timeline__label">{(a.from_status || '∅')} → {a.to_status}{a.note ? ` · ${a.note}` : ''}{a.reference ? ` · ref ${a.reference}` : ''}</span>
                              <span className="adm-timeline__at">{fmtDateTime(a.created_at)}{a.amount != null ? ` · ${money2(a.amount)}` : ''}</span>
                            </li>
                          ))}
                      </ol>
                    </section>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function mapErr(reason, row) {
  return ({
    reference_required: 'A transaction reference is required to mark a payout paid.',
    overpayment: `Paid amount cannot exceed the approved ${row ? money2(row.requested_amount) : 'amount'}.`,
    not_approved: 'A payout must be approved before it can be marked paid.',
    duplicate_reference: 'That transaction reference is already used on another payout.',
    bad_action: 'Unknown action.',
    bad_transition: 'That status change isn’t allowed from the current state.',
    terminal: 'This payout is already finalised.',
    not_found: 'Payout not found.',
  }[reason]) || reason || 'Something went wrong.';
}
