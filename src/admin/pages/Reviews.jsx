import { useEffect, useState } from 'react';
import { fetchReviewsForAdmin, setReviewStatus } from '../../lib/productReviews.js';
import {
  fetchQuestionsForAdmin, answerQuestion, rejectQuestion,
  fetchStockAlerts, markAlertsNotified, groupAlerts, productHref,
} from '../../lib/productEngage.js';

// ============================================================
// Admin → Reviews: what customers send from the product pages.
//   Reviews        (0041) each starts pending; approving puts it on the page.
//   Questions      (0042) answer one and it is published with the answer.
//   Stock alerts   (0042) "Notify me" emails for out-of-stock products, grouped
//                  by product; mark a group notified once you have told them.
// ============================================================
/** The back-in-stock email (2026-11-13, owner feature 38): ready to send from the admin's own mail. Pure. */
export function backInStockBody(g) {
  const search = `https://www.soralifestyle.in/${g.product_key.startsWith('fashion:') ? 'fashion/search' : g.product_key.startsWith('homeliving:') ? 'homeliving/search' : 'shop'}?q=${encodeURIComponent(g.product_name)}`;
  return `Hello,\n\nGood news: ${g.product_name}${g.choice ? ` (${g.choice})` : ''} is back in stock at SORA LIFESTYLE.\n\nShop it here: ${search}\n\nYou asked us to let you know when it returned.\n\nSORA LIFESTYLE`;
}

const SECTIONS = [['reviews', 'Reviews'], ['questions', 'Questions'], ['alerts', 'Stock alerts']];
const card = { border: '1px solid #E4E8E1', padding: 14, background: '#fff' };
const meta = { margin: 0, fontSize: 12, color: '#5F6D64' };

function Tabs({ items, value, onChange }) {
  return (
    <div className="adm-checkrow" role="tablist" style={{ gap: 8, margin: '12px 0' }}>
      {items.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={value === id} className={`btn btn-sm${value === id ? '' : ' btn-ghost'}`} onClick={() => onChange(id)}>{label}</button>)}
    </div>
  );
}

function ReviewsPane() {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { setRows(null); setError(''); fetchReviewsForAdmin(tab).then(setRows, (e) => { setRows([]); setError(e?.message || 'Could not load reviews.'); }); }, [tab]);
  const act = async (id, status) => {
    try { await setReviewStatus(id, status); setRows((r) => (r || []).filter((x) => x.id !== id)); }
    catch (e) { setError(e?.message || 'Could not update the review.'); }
  };
  return (
    <>
      <p className="adm-hint">Customers' reviews wait here until you approve them. Approved reviews show on the product page with their star rating.</p>
      <Tabs items={[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']]} value={tab} onChange={setTab} />
      {error && <div className="adm-banner error">{error}</div>}
      {rows === null ? <p>Loading…</p> : rows.length === 0 ? <p className="adm-hint">No {tab} reviews.</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((r) => (
            <article key={r.id} style={card}>
              <p style={meta}>{r.product_key} · {new Date(r.created_at).toLocaleString('en-IN')}</p>
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
    </>
  );
}

function QuestionsPane() {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({});
  useEffect(() => { setRows(null); setError(''); fetchQuestionsForAdmin(tab).then(setRows, (e) => { setRows([]); setError(e?.message || 'Could not load questions.'); }); }, [tab]);
  const drop = (id) => setRows((r) => (r || []).filter((x) => x.id !== id));
  const publish = async (q) => {
    try { await answerQuestion(q.id, drafts[q.id] ?? q.answer); if (tab !== 'published') drop(q.id); }
    catch (e) { setError(e?.message || 'Could not publish the answer.'); }
  };
  const reject = async (id) => { try { await rejectQuestion(id); drop(id); } catch (e) { setError(e?.message || 'Could not update the question.'); } };
  return (
    <>
      <p className="adm-hint">Questions customers ask on product pages. Write an answer and publish it: the question and your answer appear on that product's page.</p>
      <Tabs items={[['pending', 'Waiting'], ['published', 'Published'], ['rejected', 'Rejected']]} value={tab} onChange={setTab} />
      {error && <div className="adm-banner error">{error}</div>}
      {rows === null ? <p>Loading…</p> : rows.length === 0 ? <p className="adm-hint">No {tab === 'pending' ? 'waiting' : tab} questions.</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((q) => (
            <article key={q.id} style={card}>
              <p style={meta}>{productHref(q.product_key) ? <a href={productHref(q.product_key)}>{q.product_key}</a> : q.product_key} · {new Date(q.created_at).toLocaleString('en-IN')} · {q.author_name}</p>
              <p style={{ margin: '6px 0 10px', fontWeight: 600, whiteSpace: 'pre-wrap' }}>Q: {q.question}</p>
              <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Answer
                <textarea rows={3} maxLength={2000} value={drafts[q.id] ?? q.answer ?? ''} onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })} style={{ width: '100%', padding: 8, font: 'inherit' }} />
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => publish(q)} disabled={!String(drafts[q.id] ?? q.answer ?? '').trim()}>{tab === 'published' ? 'Save answer' : 'Publish answer'}</button>
                {tab !== 'rejected' && <button type="button" className="btn btn-sm btn-ghost" onClick={() => reject(q.id)}>Reject</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function AlertsPane() {
  const [tab, setTab] = useState('open');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { setRows(null); setError(''); fetchStockAlerts(tab === 'open').then(setRows, (e) => { setRows([]); setError(e?.message || 'Could not load stock alerts.'); }); }, [tab]);
  const groups = groupAlerts(rows || []);
  const done = async (g) => {
    try { await markAlertsNotified(g.rows.map((r) => r.id)); setRows((r) => (r || []).filter((x) => !g.rows.some((y) => y.id === x.id))); }
    catch (e) { setError(e?.message || 'Could not update.'); }
  };
  return (
    <>
      <p className="adm-hint">Customers who asked to be told when an out-of-stock product is back. Restock it, email them (the addresses are listed, ready to copy), then mark the group notified.</p>
      <Tabs items={[['open', 'Waiting'], ['done', 'Notified']]} value={tab} onChange={setTab} />
      {error && <div className="adm-banner error">{error}</div>}
      {rows === null ? <p>Loading…</p> : groups.length === 0 ? <p className="adm-hint">No {tab === 'open' ? 'waiting' : 'notified'} alerts.</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {groups.map((g) => (
            <article key={g.key} style={card}>
              <p style={{ margin: 0, fontWeight: 600 }}>{g.product_name}{g.choice ? ` — ${g.choice}` : ''} <span style={{ fontWeight: 400, color: '#5F6D64' }}>· {g.rows.length} {g.rows.length === 1 ? 'person' : 'people'}</span></p>
              <p style={meta}>{productHref(g.product_key) ? <a href={productHref(g.product_key)}>{g.product_key}</a> : g.product_key} · latest {new Date(g.rows[0].created_at).toLocaleString('en-IN')}</p>
              <textarea readOnly rows={Math.min(4, g.rows.length)} value={g.rows.map((r) => r.email).join(', ')} onFocus={(e) => e.target.select()} aria-label="Emails" style={{ width: '100%', margin: '8px 0', padding: 8, font: '13px/1.4 monospace' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <a className="btn btn-sm btn-ghost" href={`mailto:?bcc=${encodeURIComponent(g.rows.map((r) => r.email).join(','))}&subject=${encodeURIComponent(`${g.product_name} is back in stock`)}&body=${encodeURIComponent(backInStockBody(g))}`}>Email them</a>
                {tab === 'open' && <button type="button" className="btn btn-sm" onClick={() => done(g)}>Mark notified</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export default function Reviews() {
  const [section, setSection] = useState('reviews');
  return (
    <div>
      <div className="adm__head"><h1>Reviews, questions &amp; stock alerts</h1></div>
      <Tabs items={SECTIONS} value={section} onChange={setSection} />
      {section === 'reviews' ? <ReviewsPane /> : section === 'questions' ? <QuestionsPane /> : <AlertsPane />}
    </div>
  );
}
