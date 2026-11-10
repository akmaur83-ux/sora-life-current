import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import { OFFER_COUNTDOWN, parseIndiaTime } from '../lib/offerCountdown.js';

// ============================================================
// Promotion cards (owner, 2026-11-10: features for promotion), one small card at
// the foot of the screen, mounted once by SiteAssist:
//
//   * Promo links — any page opened with ?promo=CODE (soralifestyle.in/?promo=DIWALI20,
//     /fashion?promo=SHAWL10 …) shows "Your code CODE" with Copy, and keeps it for the
//     visit, cart and checkout included, so a campaign link carries its code to the
//     coupon box. The code must exist in Admin → Coupons; this card never prices
//     anything and never applies a code by itself.
//   * Welcome offer — a first-time visitor (again after 14 days) sees the running
//     offer (Storefronts → Wellness → Offer countdown) twelve seconds in, once.
//     Off in Storefronts → Wellness → Welcome offer card; never while it has ended.
//
// Closing either hides it. Nothing is sent anywhere; this browser only.
// ============================================================
export const WELCOME_SECTION = Object.freeze({ hidden: false });
const PROMO_KEY = 'sora.promo.v1';
const WELCOME_KEY = 'sora.welcome.v1';
const WELCOME_EVERY = 14 * 86400 * 1000;
const WELCOME_AFTER_MS = 12000;
const NEVER = /^\/(admin|creator|invoice|passport|login)(\/|$)/;
const QUIET = /^\/(cart|checkout|fashion\/cart|homeliving\/cart|grocery\/cart|grocery\/checkout)(\/|$)/;

/** A code from a promo link, upper-cased, or '' when it is not one. */
export function promoCode(search) {
  const raw = new URLSearchParams(search || '').get('promo');
  const c = String(raw || '').trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{2,23}$/.test(c) ? c : '';
}

/** The words a shared offer goes out with. */
export function offerShareText(offer, link) {
  return offer && offer.code
    ? `${offer.title} ${offer.code} at SORA LIFESTYLE (wellness, fashion and home). Shop the offers: ${link}`
    : `Offers on wellness, fashion and home at SORA LIFESTYLE: ${link}`;
}

const store = (kind) => { try { return kind === 'session' ? window.sessionStorage : window.localStorage; } catch { return null; } };
const readJson = (s, k) => { try { return JSON.parse(s?.getItem(k) || 'null'); } catch { return null; } };
const writeJson = (s, k, v) => { try { s?.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } };

export default function PromoCard({ foot = 0 }) {
  const { pathname, search } = useLocation();
  const offer = useStorefrontSection('wellness', 'offerCountdown', OFFER_COUNTDOWN);
  const welcome = useStorefrontSection('wellness', 'welcomeOffer', WELCOME_SECTION);
  const [promo, setPromo] = useState(null);       // { code, closed }
  const [greet, setGreet] = useState(false);
  const [copied, setCopied] = useState(false);
  const offerLive = !offer.hidden && !!offer.code && parseIndiaTime(offer.endsAt) > Date.now();

  // A promo link: remember its code for this visit.
  useEffect(() => {
    const code = promoCode(search);
    const ss = store('session');
    if (code) { const v = { code, closed: false }; writeJson(ss, PROMO_KEY, v); setPromo(v); return; }
    setPromo(readJson(ss, PROMO_KEY));
  }, [search]);

  // The welcome card: first visit (or 14 days on), twelve seconds in, once.
  useEffect(() => {
    if (welcome.hidden || !offerLive || NEVER.test(pathname) || QUIET.test(pathname)) return undefined;
    const ls = store('local');
    const seen = Number(readJson(ls, WELCOME_KEY)) || 0;
    if (Date.now() - seen < WELCOME_EVERY) return undefined;
    const t = setTimeout(() => { writeJson(ls, WELCOME_KEY, Date.now()); setGreet(true); }, WELCOME_AFTER_MS);
    return () => clearTimeout(t);
  }, [welcome.hidden, offerLive, pathname]);

  if (NEVER.test(pathname)) return null;
  const showPromo = promo && promo.code && !promo.closed;
  const showWelcome = !showPromo && greet && offerLive && !QUIET.test(pathname);
  if (!showPromo && !showWelcome) return null;
  const code = showPromo ? promo.code : offer.code;
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard off */ } };
  const close = () => {
    if (showPromo) { const v = { ...promo, closed: true }; writeJson(store('session'), PROMO_KEY, v); setPromo(v); } else setGreet(false);
  };
  return (
    <aside className="hx-pcard" style={{ '--pcard-foot': `${foot}px` }} aria-label={showPromo ? 'Your promo code' : 'Current offer'}>
      <span className="hx-pcard__ic" aria-hidden="true"><Icon name="gift" size={20} /></span>
      <div className="hx-pcard__body">
        <p className="hx-pcard__t">{showPromo ? 'Your code is ready' : offer.title}</p>
        <p className="hx-pcard__code">
          <b>{code}</b>
          <button type="button" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
        </p>
        <p className="hx-pcard__s">{showPromo ? 'Enter it in the coupon box at checkout.' : <>Enter it at checkout. <Link to="/offers" onClick={close}>See the offers</Link></>}</p>
      </div>
      <button type="button" className="hx-pcard__x" onClick={close} aria-label="Close"><Icon name="x" size={16} /></button>
    </aside>
  );
}
