import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { ENQUIRY_KINDS } from '../../lib/enquiries.js';
import { toCsv, downloadCsv } from '../lib/csv.js';

// ============================================================
// Admin → Enquiries (owner, 2026-11-20: round 11). What came in through the site's
// forms (0047): brands applying to sell, bulk / corporate gifting, products people
// asked for. Newest first; filter by kind and status; mark each contacted or done;
// tap to call, WhatsApp or email back; download as CSV.
// ============================================================
export const STATUSES = [['new', 'New'], ['contacted', 'Contacted'], ['done', 'Done']];

/** Rows → those of a kind ('' = all) and status ('' = all), newest first. Pure. */
export function filterEnquiries(rows, kind = '', status = '') {
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => (!kind || r.kind === kind) && (!status || r.status === status))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

/** "Product requests" grouped: the same thing asked for by several people counts once, with how many. Pure. */
export function requestTally(rows) {
  const m = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r.kind !== 'request' || !r.query) continue;
    const k = String(r.query).trim().toLowerCase();
    m.set(k, { query: m.get(k)?.query || r.query, n: (m.get(k)?.n || 0) + 1 });
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.query.localeCompare(b.query));
}

const waHref = (p) => { const d = String(p || '').replace(/\D/g, ''); return d ? `https://wa.me/${d.length === 10 ? `91${d}` : d}` : ''; };
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
const box = { border: '1px solid #E4E8E1', background: '#fff', padding: 14 };

export default function Enquiries() {
  const [rows, setRows] = useState(null);
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('new');
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    supabase.from('enquiries').select('*').order('created_at', { ascending: false }).limit(1000)
      .then(({ data, error: e }) => { if (!live) return; if (e) { setError(e.message); setRows([]); } else setRows(data || []); });
    return () => { live = false; };
  }, []);
  const mark = async (r, next) => {
    const { error: e } = await supabase.from('enquiries').update({ status: next }).eq('id', r.id);
    if (e) { setError(e.message); return; }
    setRows((list) => list.map((x) => (x.id === r.id ? { ...x, status: next } : x)));
  };
  const shown = filterEnquiries(rows, kind, status);
  const tally = requestTally(rows);
  const save = () => downloadCsv('sora-enquiries.csv', toCsv(shown, [
    ['Date', (r) => String(r.created_at || '').slice(0, 10)], ['Kind', (r) => ENQUIRY_KINDS[r.kind] || r.kind], ['Status', (r) => r.status],
    ['Name', (r) => r.name], ['Business', (r) => r.business], ['Phone', (r) => r.phone], ['Email', (r) => r.email], ['City', (r) => r.city],
    ['Website', (r) => r.website], ['Product asked for', (r) => r.query], ['Store', (r) => r.store], ['Message', (r) => r.message],
  ]));
  const count = (k) => (rows || []).filter((r) => r.kind === k && r.status === 'new').length;
  return (
    <div>
      <div className="adm__head">
        <div><h1>Enquiries</h1><p>{rows === null ? 'Loading…' : `${(rows || []).filter((r) => r.status === 'new').length} new`}</p></div>
        {shown.length > 0 && <button type="button" className="btn btn-sm btn-ghost" onClick={save}>Download CSV</button>}
      </div>
      {error && <div className="adm-banner error">{error}</div>}
      <div className="adm-checkrow" style={{ gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
        {[['', 'All'], ...Object.entries(ENQUIRY_KINDS)].map(([k, label]) => (
          <button key={k || 'all'} type="button" className={`btn btn-sm${kind === k ? '' : ' btn-ghost'}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {label}{k && count(k) ? ` (${count(k)})` : ''}
          </button>
        ))}
        <select className="input" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {tally.length > 0 && kind !== 'partner' && kind !== 'bulk' && (
        <section style={{ ...box, marginBottom: 14 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>Most requested products</h2>
          <p className="adm-hint" style={{ margin: '0 0 8px' }}>All time, the same words counted once with how many asked.</p>
          <p style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>{tally.slice(0, 20).map((t) => <span key={t.query} className="badge badge-soft">{t.query} · {t.n}</span>)}</p>
        </section>
      )}
      {rows === null ? <p>Loading…</p> : shown.length === 0 ? <div className="adm-empty">Nothing here yet. Enquiries arrive from /sell and from searches that found nothing.</div> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {shown.map((r) => (
            <article key={r.id} style={box}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <span className="badge badge-soft">{ENQUIRY_KINDS[r.kind] || r.kind}</span>{' '}
                  <b>{r.kind === 'request' ? `“${r.query}”` : (r.business || r.name)}</b>
                  {r.kind !== 'request' && r.business && r.name ? <span style={{ color: '#5F6D64' }}> · {r.name}</span> : null}
                  {r.city ? <span style={{ color: '#5F6D64' }}> · {r.city}</span> : null}
                  {r.store ? <span style={{ color: '#5F6D64' }}> · {r.store}</span> : null}
                </div>
                <span className="adm-hint">{when(r.created_at)}</span>
              </div>
              {r.message && <p style={{ margin: '8px 0', whiteSpace: 'pre-line' }}>{r.message}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                {r.phone && <a className="btn btn-sm btn-ghost" href={`tel:${r.phone}`}>Call {r.phone}</a>}
                {r.phone && <a className="btn btn-sm btn-ghost" href={waHref(r.phone)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                {r.email && <a className="btn btn-sm btn-ghost" href={`mailto:${r.email}`}>{r.email}</a>}
                {r.website && <span className="adm-hint">{r.website}</span>}
                <span style={{ flex: 1 }} />
                {STATUSES.filter(([v]) => v !== r.status).map(([v, l]) => <button key={v} type="button" className="btn btn-sm" onClick={() => mark(r, v)}>Mark {l.toLowerCase()}</button>)}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
