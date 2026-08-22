import { useState } from 'react';
import Icon from './Icon.jsx';

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr('Please enter a valid email address.'); return; }
    setErr(''); setDone(true);
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
            <p style={{ color: 'rgba(251,248,241,0.8)', maxWidth: '46ch' }}>Join for early access to new drops, seasonal rituals and 10% off your first order. No noise — we promise.</p>

            {done ? (
              <div className="nl__done"><span className="t-ic" style={{ background: 'rgba(232,176,75,0.2)' }}><Icon name="check" size={18} /></span> You're in. Check your inbox for your welcome code.</div>
            ) : (
              <form className="nl__form" onSubmit={submit} noValidate>
                <div className="searchbox nl__input">
                  <Icon name="mail" />
                  <input className="input" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" />
                </div>
                <button className="btn btn-accent btn-lg" type="submit">Subscribe</button>
              </form>
            )}
            {err && <p className="error-text" style={{ marginTop: 8 }}>{err}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
