import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { usePageMeta } from '../lib/pageMeta.js';
import { BRANDS } from '../lib/brands.js';
import { sendEnquiry } from '../lib/enquiries.js';

// ============================================================
// /sell — Sell on SORA, and bulk / corporate gifting (owner, 2026-11-20: more features,
// round 11). Two short forms into Admin → Enquiries (0047). The page says only what is
// true today: who already sells here (lib/brands.js) and how a listing works; it
// promises no numbers, no timelines and no approval.
// ============================================================
const PARTNER_FIELDS = [
  ['name', 'Your name', { autoComplete: 'name', required: true }],
  ['business', 'Brand or business', { autoComplete: 'organization', required: true }],
  ['phone', 'Phone / WhatsApp', { inputMode: 'tel', autoComplete: 'tel' }],
  ['email', 'Email', { type: 'email', autoComplete: 'email' }],
  ['city', 'City', { autoComplete: 'address-level2' }],
  ['website', 'Website or Instagram', { placeholder: 'e.g. instagram.com/yourbrand' }],
];
const BULK_FIELDS = [
  ['name', 'Your name', { autoComplete: 'name', required: true }],
  ['business', 'Company (optional)', { autoComplete: 'organization' }],
  ['phone', 'Phone / WhatsApp', { inputMode: 'tel', autoComplete: 'tel' }],
  ['email', 'Email', { type: 'email', autoComplete: 'email' }],
  ['city', 'Delivery city', { autoComplete: 'address-level2' }],
];

function EnquiryForm({ kind, id, fields, messageLabel, messageHint, cta }) {
  const [f, setF] = useState({});
  const [state, setState] = useState({ busy: false, done: false, error: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, done: false, error: '' });
    const r = await sendEnquiry(kind, f);
    setState({ busy: false, done: Boolean(r.ok), error: r.error || '' });
  };
  if (state.done) {
    return <p className="sora-sell__done" role="status"><Icon name="check" size={18} /> Thank you — we have your details and will get back to you on the phone or email you gave.</p>;
  }
  return (
    <form className="sora-sell__form" onSubmit={submit} noValidate>
      <div className="sora-sell__grid">
        {fields.map(([k, label, attrs]) => (
          <div className="field" key={k}>
            <label className="label" htmlFor={`${id}-${k}`}>{label}</label>
            <input id={`${id}-${k}`} className="input" value={f[k] || ''} onChange={set(k)} maxLength={k === 'website' ? 200 : 120} {...attrs} />
          </div>
        ))}
      </div>
      <div className="field">
        <label className="label" htmlFor={`${id}-message`}>{messageLabel}</label>
        <textarea id={`${id}-message`} className="input" rows={4} maxLength={1000} value={f.message || ''} onChange={set('message')} placeholder={messageHint} />
      </div>
      <input type="text" name="company_url" tabIndex={-1} autoComplete="off" aria-hidden="true" className="sora-hp" value={f.company_url || ''} onChange={set('company_url')} />
      <p className="sora-sell__fine">We need a phone number or an email to reply. We use them only to answer this enquiry.</p>
      {state.error && <p className="sora-req__err" role="alert">{state.error}</p>}
      <button type="submit" className="btn" disabled={state.busy}>{state.busy ? 'Sending…' : cta}</button>
    </form>
  );
}

export default function Sell() {
  usePageMeta({ title: 'Sell on SORA LIFESTYLE · Bulk & corporate gifting', description: 'Makers and brands: apply to sell on SORA LIFESTYLE. Companies: ask us about bulk and corporate gifting.', path: '/sell' });
  const partners = BRANDS.filter((b) => b.page).map((b) => b.name);
  return (
    <div className="sora-sell">
      <div className="container">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> <Icon name="chevronRight" size={12} /> <span>Sell on SORA</span></nav>
        <header className="sora-sell__hero">
          <p className="sora-sell__eyebrow">Partner with SORA LIFESTYLE</p>
          <h1 className="serif">Sell your brand on SORA</h1>
          <p>SORA LIFESTYLE brings Indian makers into one shop across wellness, fashion and home. {partners.length ? `Brands already here include ${partners.slice(0, -1).join(', ')} and ${partners[partners.length - 1]}.` : ''}</p>
          <a href="#bulk" className="sora-sell__jump">Looking for bulk or corporate gifts? <Icon name="arrowRight" size={15} /></a>
        </header>

        <section className="sora-sell__how" aria-labelledby="sell-how">
          <h2 id="sell-how" className="serif">How it works</h2>
          <ol>
            <li><b>Tell us about your brand</b> with the form below.</li>
            <li><b>We talk it through</b> — what you make, prices, stock and photos.</li>
            <li><b>Your products go live</b> with their own brand page, in the right store and categories.</li>
          </ol>
        </section>

        <section className="sora-sell__card" aria-labelledby="sell-partner">
          <h2 id="sell-partner" className="serif">Apply to sell</h2>
          <EnquiryForm kind="partner" id="sell-p" fields={PARTNER_FIELDS} messageLabel="What do you make?" messageHint="Your products, price range, where you make them, how many you can supply…" cta="Send application" />
        </section>

        <section className="sora-sell__card" id="bulk" aria-labelledby="sell-bulk">
          <h2 id="sell-bulk" className="serif">Bulk &amp; corporate gifting</h2>
          <p className="sora-sell__lede">Festive hampers, team gifts, wedding favours: tell us the occasion, how many and your budget, and we will put options together.</p>
          <EnquiryForm kind="bulk" id="sell-b" fields={BULK_FIELDS} messageLabel="What do you need?" messageHint="Occasion, quantity, budget per gift, delivery date…" cta="Send enquiry" />
        </section>
      </div>
    </div>
  );
}
