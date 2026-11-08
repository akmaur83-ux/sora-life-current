import { useEffect, useState } from 'react';
import { fetchReviewsForAdmin, setReviewStatus } from '../../lib/productReviews.js';

// ============================================================
// Admin → Reviews: customers' product reviews (migration 0041). Each starts
// pending; approving one puts it on the product page, rejecting keeps it off.
// ============================================================
const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']];

export default function Reviews() {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const load = (status) => { setRows(null); setError(''); fetchReviewsForAdmin(status).then(setRows, (e) => { setRows([]); setError(e?.message || 'Could not load reviews.'); }); };
  useEffect(() => { load(tab); }, [tab]);
  const act = async (id, status) => {
    try { await setReviewStatus(id, status); setRows((r) => (r || []).filter((x) => x.id !== id)); }
    catch (e) { setError(e?.message || 'Could not update the review.'); }
  };
  return (
    <div>
      <div className="adm__head"><h1>Reviews</h1></div>
      <p className="adm-hint">Customers' reviews wait here until you approve them. Approved reviews show on the product page with their star rating.</p>
      <div className="adm-checkrow" role="tablist" style={{ gap: 8, margin: '12px 0' }}>
        {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={`btn btn-sm${tab === id ? '' : ' btn-ghost'}`} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {error && <div className="adm-banner error">{error}</div>}
      {rows === null ? <p>Loading…</p> : rows.length === 0 ? <p className="adm-hint">No {tab} reviews.</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((r) => (
            <article key={r.id} style={{ border: '1px solid #E4E8E1', padding: 14, background: '#fff' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#5F6D64' }}>{r.product_key} · {new Date(r.created_at).toLocaleString('en-IN')}</p>
              <p style={{ margin: '6px 0' }}><b>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</b> {r.title && <b>{r.title}</b>} — {r.author_name}</p>
              <p style={{ margin: '0 0 10px', whiteSpace: 'pre-wrap' }}>{r.body}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {tab !== 'approved' && <button type="button" className="btn btn-sm" onClick={() => act(r.id, 'approved')}>Approve</button>}
                {tab !== 'rejected' && <button type="button" className="btn btn-sm btn-ghost" onClick={() => act(r.id, 'rejected')}>Reject</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
