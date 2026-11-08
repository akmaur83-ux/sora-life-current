import { useEffect, useState } from 'react';
import Icon from '../Icon.jsx';
import { useCustomerAuth } from '../../lib/customerAuth.jsx';
import { fetchPublishedQuestions, submitQuestion, requestStockAlert } from '../../lib/productEngage.js';

// ============================================================
// Product questions and "Notify me" on every product page (productEngage.js has
// the rules; owner, 2026-11-08). PdpQuestions follows the reviews; PdpNotifyMe
// replaces the delivery estimate in the buy box while the item is out of stock.
// ============================================================
export function PdpQuestions({ productKey, productName }) {
  const { user } = useCustomerAuth();
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ question: '', authorName: '' });
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState(null);
  const [filter, setFilter] = useState('');
  useEffect(() => {
    let live = true;
    setRows(null);
    fetchPublishedQuestions(productKey).then((r) => { if (live) setRows(r); });
    return () => { live = false; };
  }, [productKey]);
  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    const res = await submitQuestion({ key: productKey, ...form });
    setSending(false); setNote(res);
    if (res.ok) { setOpen(false); setForm({ question: '', authorName: '' }); }
  };
  const f = filter.trim().toLowerCase();
  const shown = (rows || []).filter((q) => !f || `${q.question} ${q.answer}`.toLowerCase().includes(f));
  return (
    <section className="pdpk-qa" aria-labelledby="pdpk-qa-h" id="questions">
      <h2 className="pdpk-h pdpk-h--lg" id="pdpk-qa-h">Customer questions &amp; answers</h2>
      {(rows || []).length > 3 && (
        <label className="pdpk-qa__search"><Icon name="search" size={16} /><input type="search" placeholder="Search the answers" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search questions and answers" /></label>
      )}
      {rows === null ? <p className="pdpk-qa__empty">Loading questions…</p>
        : rows.length === 0 ? <p className="pdpk-qa__empty">No questions yet. Ask the first one and we will answer it here.</p>
        : (
          <dl className="pdpk-qa__list">
            {shown.slice(0, 10).map((q) => (
              <div key={q.id} className="pdpk-qa__item">
                <dt><span>Question:</span> {q.question}</dt>
                <dd><span>Answer:</span> {q.answer}<em>SORA Lifestyle · {new Date(q.answered_at || q.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · asked by {q.author_name}</em></dd>
              </div>
            ))}
            {shown.length === 0 && <p className="pdpk-qa__empty">No answer matches “{filter}”.</p>}
          </dl>
        )}
      <div className="pdpk-qa__ask">
        <p>Don&rsquo;t see your answer?</p>
        {user
          ? <button type="button" className="pdpk-rev__btn" onClick={() => { setOpen((o) => !o); setNote(null); }} aria-expanded={open}>Ask a question</button>
          : <a className="pdpk-rev__btn" href="/account">Sign in to ask a question</a>}
        {note && <p className={`pdpk-rev__note ${note.ok ? 'is-ok' : 'is-bad'}`} role="status">{note.message}</p>}
      </div>
      {open && user && (
        <form className="pdpk-rev__form pdpk-qa__form" onSubmit={send} aria-label={`Ask about ${productName}`}>
          <label>Your question<textarea rows={3} value={form.question} maxLength={500} onChange={(e) => setForm({ ...form, question: e.target.value })} required /></label>
          <label>Your name (shown with the question)<input value={form.authorName} maxLength={60} onChange={(e) => setForm({ ...form, authorName: e.target.value })} required /></label>
          <button type="submit" className="pdpk-rev__submit" disabled={sending}>{sending ? 'Sending…' : 'Submit question'}</button>
        </form>
      )}
    </section>
  );
}

export function PdpNotifyMe({ productKey, productName, choice = '' }) {
  const { user } = useCustomerAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState(null);
  useEffect(() => { if (user?.email) setEmail((e) => e || user.email); }, [user?.email]);
  useEffect(() => { setNote(null); }, [productKey, choice]);
  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    setNote(await requestStockAlert({ key: productKey, name: productName, choice, email }));
    setSending(false);
  };
  if (!productKey) return null;
  return (
    <form className="pdpk-notify" onSubmit={send} aria-label="Notify me when back in stock">
      <p className="pdpk-notify__h"><Icon name="bell" size={16} /> Out of stock{choice ? ` in ${choice}` : ''}</p>
      {note?.ok ? <p className="pdpk-notify__ok" role="status">{note.message}</p> : (
        <>
          <p className="pdpk-notify__t">Leave your email and we will tell you when it is back.</p>
          <div className="pdpk-notify__row">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address" autoComplete="email" />
            <button type="submit" disabled={sending}>{sending ? '…' : 'Notify me'}</button>
          </div>
          {note && <p className="pdpk-notify__bad" role="status">{note.message}</p>}
        </>
      )}
    </form>
  );
}
