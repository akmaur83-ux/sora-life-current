import { useState } from 'react';
import Icon from './Icon.jsx';

// ============================================================
// Newsletter signup.
//
// This used to flip `done` on submit and claim both a welcome code and 10%
// off a first order. Nothing was stored and neither offer existed. Now the
// address is posted to /api/newsletter/subscribe, which writes it with the
// service-role key, and success is shown ONLY after that write commits.
//
// The copy states what actually happens and nothing more. Do not add a
// discount or welcome-email claim here until such a campaign genuinely
// exists and is wired up.
// ============================================================
export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(email.trim())) {
      setErr('Please enter a valid email address.');
      return;
    }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      let data = null;
      try { data = await res.json(); } catch { /* non-JSON error page */ }

      // Success is contingent on the server confirming the write. A failed
      // request must never render the confirmation.
      if (!res.ok || !data?.subscribed) {
        setErr(data?.error || 'We could not sign you up right now. Please try again.');
        return;
      }
      setDone(true);
    } catch {
      setErr('We could not reach us just now. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section nl">
      <div className="container">
        <div className="nl__card">
          <div className="nl__deco" aria-hidden="true">
            <svg viewBox="0 0 200 200"><path d="M100 20c40 34 40 96 0 160-40-64-40-126 0-160Z" fill="var(--honey-500)" opacity="0.16"/><path d="M100 40c26 24 26 72 0 120-26-48-26-96 0-120Z" fill="var(--forest-300)" opacity="0.22"/></svg>
          </div>
          <div className="nl__body">
            <span className="eyebrow" style={{ color: 'var(--honey-300)' }}>The Sora Letter</span>
            <h2 className="serif" style={{ color: '#FBF8F1', fontSize: 'var(--text-3xl)', margin: '10px 0 8px' }}>Wellness notes, quietly good offers.</h2>
            <p style={{ color: 'rgba(251,248,241,0.8)', maxWidth: '46ch' }}>Occasional notes on new products and seasonal rituals. No noise, and you can unsubscribe whenever you like.</p>

            {done ? (
              <div className="nl__done"><span className="t-ic" style={{ background: 'rgba(232,176,75,0.2)' }}><Icon name="check" size={18} /></span> You're subscribed. We'll be in touch when there's something worth sending.</div>
            ) : (
              <form className="nl__form" onSubmit={submit} noValidate>
                <div className="searchbox nl__input">
                  <Icon name="mail" />
                  <input className="input" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" disabled={busy} />
                </div>
                <button className="btn btn-accent btn-lg" type="submit" disabled={busy}>{busy ? 'Subscribing…' : 'Subscribe'}</button>
              </form>
            )}
            {err && <p className="error-text" style={{ marginTop: 8 }}>{err}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
