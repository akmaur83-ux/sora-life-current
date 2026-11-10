import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import { OFFER_COUNTDOWN, parseIndiaTime } from '../lib/offerCountdown.js';
import { offerShareText } from './PromoCard.jsx';

// ============================================================
// The offer banner on the store homes (owner, 2026-11-09: more features): the same
// offer as the buy box's countdown (Storefronts → Wellness → Offer countdown), with
// a live clock to the second and the code to copy. It shows only while the offer
// runs and disappears by itself when it ends; hidden there, it is hidden here.
// ============================================================
const pad = (n) => String(n).padStart(2, '0');
export function clockParts(ms) {
  if (!(ms > 0)) return null;
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export default function OfferBanner({ wrap = '' }) {
  const o = useStorefrontSection('wellness', 'offerCountdown', OFFER_COUNTDOWN);
  const { pathname } = useLocation();
  const [now, setNow] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = now == null ? null : clockParts(parseIndiaTime(o.endsAt) - now);
  if (o.hidden || !left) return null;
  const copy = async () => { try { await navigator.clipboard.writeText(o.code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard off */ } };
  return (
    <section className={`hx-offer${wrap ? ` ${wrap}` : ''}`} aria-label="Current offer">
      <p className="hx-offer__t"><Icon name="gift" size={18} /> {o.title}{o.code && <button type="button" className="hx-offer__code" onClick={copy} aria-label={`Copy code ${o.code}`}>{copied ? 'Copied ✓' : o.code}</button>}</p>
      <p className="hx-offer__clock" aria-label={`Ends in ${left.d} days ${left.h} hours ${left.m} minutes`}>
        <span>Ends in</span>
        {[['d', left.d], ['h', left.h], ['m', left.m], ['s', left.s]].map(([k, v]) => <b key={k} aria-hidden="true">{k === 'd' ? v : pad(v)}<i>{k}</i></b>)}
      </p>
      {/* Spread the word (2026-11-10): the offer page, carrying the code (PromoCard.jsx promo links). */}
      <p className="hx-offer__acts">
        {pathname !== '/offers' && <Link to="/offers" className="hx-offer__go">Shop all offers <Icon name="arrowRight" size={14} /></Link>}
        <a className="hx-offer__share" target="_blank" rel="noopener noreferrer"
          href={`https://wa.me/?text=${encodeURIComponent(offerShareText(o, `https://www.soralifestyle.in/offers${o.code ? `?promo=${encodeURIComponent(o.code)}` : ''}`))}`}>
          <Icon name="chat" size={14} /> Share on WhatsApp
        </a>
      </p>
    </section>
  );
}
