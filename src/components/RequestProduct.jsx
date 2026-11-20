import { useState } from 'react';
import { sendEnquiry } from '../lib/enquiries.js';

// ============================================================
// "Request it" (round 11, 2026-11-20): under a search that found nothing, the shopper
// can leave the product they wanted — and, if they like, a number or email to hear
// back. It goes to Admin → Enquiries, beside what Insights shows as "searched, nothing
// found". Nothing is promised: the copy says we will look, not that we will stock it.
// ============================================================
export default function RequestProduct({ q, store }) {
  const [f, setF] = useState({ query: String(q || '').trim(), phone: '', company_url: '' });
  const [state, setState] = useState({ busy: false, done: false, error: '' });
  if (!String(q || '').trim()) return null;
  if (state.done) return <p className="sora-req sora-req--done" role="status">Thanks — we have noted “{f.query}”. If you left a number or email, we will get back to you.</p>;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, done: false, error: '' });
    const r = await sendEnquiry('request', { ...f, store });
    setState({ busy: false, done: Boolean(r.ok), error: r.error || '' });
  };
  return (
    <form className="sora-req" onSubmit={submit} aria-labelledby="sora-req-h">
      <p id="sora-req-h"><b>Request it.</b> Tell us what you wanted and we will look for it with our makers.</p>
      <div className="sora-req__row">
        <label className="sr-only" htmlFor="sora-req-q">What are you looking for?</label>
        <input id="sora-req-q" className="input" value={f.query} onChange={set('query')} maxLength={120} required placeholder="What are you looking for?" />
        <label className="sr-only" htmlFor="sora-req-p">Phone or WhatsApp (optional)</label>
        <input id="sora-req-p" className="input" value={f.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" maxLength={16} placeholder="Phone / WhatsApp (optional)" />
        <input type="text" name="company_url" tabIndex={-1} autoComplete="off" aria-hidden="true" className="sora-hp" value={f.company_url} onChange={set('company_url')} />
        <button type="submit" className="btn btn-sm" disabled={state.busy}>{state.busy ? 'Sending…' : 'Request'}</button>
      </div>
      {state.error && <p className="sora-req__err" role="alert">{state.error}</p>}
    </form>
  );
}
