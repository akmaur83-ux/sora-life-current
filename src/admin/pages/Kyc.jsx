import { useCallback, useEffect, useState } from 'react';
import {
  adminListKyc, adminSetKycStatus, adminListCreators, KYC_STATUSES,
  adminKycDocumentUrl, adminListKycAudit, KYC_SIGNED_URL_SECONDS,
} from '../../lib/creatorApi.js';
import { KYC_DOCUMENT_KINDS, kycDocumentState } from '../../lib/kycDocuments.js';

// ============================================================
// ADMIN — Creator Program › KYC review
//
// Creators submit KYC; only an admin here can move it to "verified". Nothing on
// this page shows raw PAN / bank / UPI — the database only ever stored masks,
// so masks are all there is to show. A creator can never self-verify: that path
// exists solely through admin_set_kyc_status (admin-gated, SECURITY DEFINER).
//
// Documents (0030) live in the private kyc-documents bucket. This page never
// renders a document inline and never holds a public URL: "View" asks storage
// for a signed link that expires in KYC_SIGNED_URL_SECONDS, and the link is
// dropped from the page when it does.
// ============================================================

const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN') : '—');
const STATUS_BADGE = {
  verified: 'badge-best', pending: 'badge-soft', not_started: 'badge-soft',
  rejected: 'badge-out', needs_update: 'badge-sale',
};
const STATUS_LABEL = {
  not_started: 'Not started', pending: 'Under review', verified: 'Verified',
  rejected: 'Rejected', needs_update: 'Needs update',
};

export default function Kyc() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await adminListKyc());
      setErr('');
    } catch (e) { setErr(e.message || String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(t) { setMsg(t); setTimeout(() => setMsg((m) => (m === t ? '' : m)), 2600); }

  async function setStatus(row, status) {
    let notes = null;
    if (status === 'rejected' || status === 'needs_update') {
      notes = window.prompt(`Reason for "${STATUS_LABEL[status]}" (shown to the creator)?`, '');
      if (notes == null) return;
    } else if (status === 'verified') {
      if (!window.confirm(`Mark ${row.creator?.display_name || 'this creator'}'s KYC as VERIFIED?\n\nOnly do this after you have genuinely checked their identity and payout details. Verification unlocks payout requests.`)) return;
    }
    setBusy(row.creator_id + status);
    try {
      const res = await adminSetKycStatus(row.creator_id, status, notes);
      if (res && res.ok === false) { setErr(res.reason || 'Could not update.'); }
      else { await load(); flash(`KYC set to “${STATUS_LABEL[status]}”.`); }
    } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(null); }
  }

  const shown = filter === 'all' ? rows : rows.filter((r) => r.identity_status === filter);
  const counts = KYC_STATUSES.reduce((a, s) => { a[s] = rows.filter((r) => r.identity_status === s).length; return a; }, {});

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Creator KYC</h1>
          <p>{loading ? 'Loading…' : `${rows.length} submitted · ${counts.pending || 0} awaiting review · ${counts.verified || 0} verified`}</p>
        </div>
      </div>

      {err && <div className="adm-banner err">{err}</div>}
      {msg && <div className="adm-banner ok">{msg}</div>}

      <div className="adm-chipbar">
        {['all', ...KYC_STATUSES].map((s) => (
          <button key={s} className={`adm-chip ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : STATUS_LABEL[s]}{s !== 'all' && counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted">Loading KYC submissions…</p>
      ) : shown.length === 0 ? (
        <div className="adm-empty">No KYC submissions{filter !== 'all' ? ` with status “${STATUS_LABEL[filter]}”` : ' yet'}. They appear when a creator submits their details.</div>
      ) : (
        <div className="adm-kyc-grid">
          {shown.map((r) => {
            const pending = r.identity_status === 'pending' || r.identity_status === 'needs_update' || r.identity_status === 'rejected';
            return (
              <article key={r.creator_id} className="surface adm-kyc-card">
                <div className="adm-kyc-card__head">
                  <div>
                    <h3>{r.creator?.display_name || 'Creator'}</h3>
                    <span className="hint adm-mono">{r.creator?.creator_code || r.creator_id}</span>
                  </div>
                  <span className={`badge ${STATUS_BADGE[r.identity_status] || 'badge-soft'}`}>{STATUS_LABEL[r.identity_status] || r.identity_status}</span>
                </div>

                <dl className="adm-kv adm-kyc-card__kv">
                  <div><dt>Legal name</dt><dd>{r.legal_name || '—'}</dd></div>
                  <div><dt>PAN</dt><dd className="adm-mono">{r.pan_masked || '—'}</dd></div>
                  <div><dt>Method</dt><dd>{r.payout_method === 'upi' ? 'UPI' : r.payout_method === 'bank' ? 'Bank transfer' : '—'}</dd></div>
                  {r.payout_method === 'bank' && <>
                    <div><dt>Account holder</dt><dd>{r.payout_account_holder || '—'}</dd></div>
                    <div><dt>Account</dt><dd className="adm-mono">{r.payout_account_masked || '—'}</dd></div>
                    <div><dt>IFSC</dt><dd className="adm-mono">{r.ifsc_masked || '—'}</dd></div>
                  </>}
                  {r.payout_method === 'upi' && (
                    <div><dt>UPI</dt><dd className="adm-mono">{r.upi_masked || '—'}</dd></div>
                  )}
                  <div><dt>Submitted</dt><dd>{fmtDateTime(r.submitted_at)}</dd></div>
                  {r.verified_at && <div><dt>Verified</dt><dd>{fmtDateTime(r.verified_at)}</dd></div>}
                  {r.verification_notes && <div><dt>Notes</dt><dd>{r.verification_notes}</dd></div>}
                </dl>

                <KycDocuments row={r} onError={setErr} />

                <p className="adm-kyc-card__priv hint"><span aria-hidden>🔒</span> Only masked values are stored. Document links are signed and expire in {KYC_SIGNED_URL_SECONDS} seconds.</p>

                <div className="adm-kyc-card__acts">
                  {r.identity_status !== 'verified' && (
                    <button className="btn btn-sm" disabled={busy} onClick={() => setStatus(r, 'verified')}>Verify</button>
                  )}
                  {pending && (
                    <>
                      <button className="btn btn-sm btn-light" disabled={busy} onClick={() => setStatus(r, 'needs_update')}>Needs update</button>
                      <button className="btn btn-sm btn-light" disabled={busy} onClick={() => setStatus(r, 'rejected')}>Reject</button>
                    </>
                  )}
                  {r.identity_status === 'verified' && (
                    <button className="btn btn-sm btn-light" disabled={busy} onClick={() => setStatus(r, 'needs_update')}>Revoke (needs update)</button>
                  )}
                </div>

                <KycHistory creatorId={r.creator_id} onError={setErr} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Documents — one row per kind; a signed link only while it is valid.
// ---------------------------------------------------------------
function KycDocuments({ row, onError }) {
  const [links, setLinks] = useState({}); // kind → { url, expiresAt }
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    // Drop each link the moment it would stop working.
    const live = Object.entries(links).filter(([, l]) => l.expiresAt > Date.now());
    if (live.length === 0) return undefined;
    const next = Math.min(...live.map(([, l]) => l.expiresAt)) - Date.now();
    const t = setTimeout(() => {
      setLinks((cur) => Object.fromEntries(Object.entries(cur).filter(([, l]) => l.expiresAt > Date.now())));
    }, Math.max(0, next));
    return () => clearTimeout(t);
  }, [links]);

  async function sign(doc) {
    setBusy(doc.kind);
    try {
      const url = await adminKycDocumentUrl(doc.path);
      setLinks((cur) => ({ ...cur, [doc.kind]: { url, expiresAt: Date.now() + KYC_SIGNED_URL_SECONDS * 1000 } }));
    } catch (e) { onError(e.message || String(e)); }
    finally { setBusy(null); }
  }

  return (
    <div className="adm-kyc-docs">
      <div className="adm-kyc-docs__h">Documents{row.documents_updated_at ? <span className="hint"> · updated {fmtDateTime(row.documents_updated_at)}</span> : null}</div>
      {KYC_DOCUMENT_KINDS.map((k) => {
        const doc = kycDocumentState(row, k.kind);
        const link = links[k.kind];
        return (
          <div key={k.kind} className="adm-kyc-doc" data-kind={k.kind}>
            <span className="adm-kyc-doc__label">{doc.label}</span>
            {!doc.uploaded ? (
              <span className="hint">Not uploaded</span>
            ) : link ? (
              <a className="btn btn-sm" href={link.url} target="_blank" rel="noopener noreferrer">
                Open {doc.fileType.toUpperCase()} ↗
              </a>
            ) : (
              <button type="button" className="btn btn-sm btn-light" disabled={busy === k.kind} onClick={() => sign(doc)}>
                {busy === k.kind ? 'Signing…' : `View ${doc.label.toLowerCase()}`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------
// History — creator_kyc_audit, written by trigger on every status / notes /
// document change. Loaded on demand; the list is the reviewer's record.
// ---------------------------------------------------------------
const shortId = (id) => (id ? String(id).slice(0, 8) : '—');

function KycHistory({ creatorId, onError }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && rows == null) {
      setLoading(true);
      try { setRows(await adminListKycAudit(creatorId)); }
      catch (e) { onError(e.message || String(e)); setRows([]); }
      finally { setLoading(false); }
    }
  }

  return (
    <div className="adm-kyc-history">
      <button type="button" className="adm-kyc-history__toggle" onClick={toggle} aria-expanded={open}>
        {open ? 'Hide history' : 'History'}
      </button>
      {open && (
        loading ? <p className="hint">Loading…</p>
        : !rows || rows.length === 0 ? <p className="hint">No changes recorded yet.</p>
        : (
          <ol className="adm-kyc-history__list">
            {rows.map((a) => (
              <li key={a.id}>
                <span className="adm-kyc-history__when">{fmtDateTime(a.created_at)}</span>
                <span className="adm-kyc-history__what">
                  {a.from_status && a.from_status !== a.to_status
                    ? `${STATUS_LABEL[a.from_status] || a.from_status} → ${STATUS_LABEL[a.to_status] || a.to_status}`
                    : a.metadata?.documents_changed ? 'Document updated'
                    : a.from_notes !== a.to_notes ? 'Notes changed'
                    : (STATUS_LABEL[a.to_status] || a.to_status)}
                  {a.metadata?.documents_changed && a.from_status && a.from_status !== a.to_status ? ' · document updated' : ''}
                </span>
                {a.to_notes && a.to_notes !== a.from_notes && <span className="adm-kyc-history__note">“{a.to_notes}”</span>}
                <span className="hint adm-mono">by {shortId(a.actor)}</span>
              </li>
            ))}
          </ol>
        )
      )}
    </div>
  );
}
