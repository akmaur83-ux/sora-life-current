import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useConsumerCare } from '../lib/consumerCare.js';

// ============================================================
// Two small helpers on every storefront page (owner, 2026-11-08: more features),
// mounted once inside the router (main.jsx):
//
//   * Chat with us — opens WhatsApp to the store's consumer-care number, exactly as
//     the Contact page publishes it (nothing shown when no number is set). On a
//     product page the message names the product and its link, nothing else.
//   * Back to top — appears after about two screens of scrolling.
//
// Neither appears in the admin, the checkout, the cart, the creator portal,
// invoices or the passport. Both sit above any fixed bar at the foot of the
// screen (a buy bar, the phone tab bar), measured, not guessed.
// ============================================================
const HIDDEN = /^\/(admin|checkout|cart|creator|invoice|passport|login|fashion\/cart|homeliving\/cart|grocery\/cart|grocery\/checkout)(\/|$)/;
const PRODUCT = /^\/(product|fashion\/p|homeliving\/p|grocery\/p)\/[^/]+/;

/** wa.me digits for an Indian number as published ("+91 78890 96228" → 917889096228). */
export function waNumber(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith('0')) return `91${d.slice(1)}`;
  return d.length >= 11 && d.length <= 13 ? d : '';
}

export function waLink(phone, pathname, title, href) {
  const n = waNumber(phone);
  if (!n) return '';
  const product = PRODUCT.test(pathname || '');
  const name = String(title || '').split(/\s[|–—-]\s/)[0].trim();
  const text = product && name
    ? `Hi SORA Lifestyle, I have a question about ${name}: ${href}`
    : 'Hi SORA Lifestyle, I need some help.';
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

/** The height of whatever is fixed to the foot of the screen, so the buttons clear it. */
function footOffset() {
  if (typeof document === 'undefined') return 0;
  let h = 0;
  const vh = window.innerHeight;
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.hx-sa')) continue;
    const s = getComputedStyle(el);
    if (s.position !== 'fixed' || s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.height < vh * 0.4 && r.width > window.innerWidth * 0.5 && Math.abs(r.bottom - vh) < 4) h = Math.max(h, r.height);
  }
  return Math.round(h);
}

export default function SiteAssist() {
  const { pathname } = useLocation();
  const care = useConsumerCare();
  const [up, setUp] = useState(false);
  const [offset, setOffset] = useState(0);
  const hidden = HIDDEN.test(pathname);

  useEffect(() => {
    if (hidden) return undefined;
    const onScroll = () => setUp(window.scrollY > window.innerHeight * 2);
    const measure = () => setOffset(footOffset());
    onScroll();
    const timers = [100, 600, 1500].map((ms) => setTimeout(measure, ms));
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    return () => { timers.forEach(clearTimeout); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', measure); };
  }, [pathname, hidden]);

  if (hidden) return null;
  // The product's name is read from the page's heading at the moment of the tap (it renders after this).
  const build = () => waLink(care?.phone, pathname, document.querySelector('main h1, h1')?.textContent || '', window.location.href.split('#')[0]);
  const wa = waLink(care?.phone, '/', '', '');
  const top = () => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
  };
  return (
    <div className="hx-sa" style={{ '--sa-foot': `${offset}px` }}>
      {up && (
        <button type="button" className="hx-sa__btn hx-sa__top" onClick={top} aria-label="Back to top">
          <Icon name="chevronUp" size={20} />
        </button>
      )}
      {wa && (
        <a className="hx-sa__btn hx-sa__wa" href={wa} target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp" onClick={(e) => { e.currentTarget.href = build(); }}>
          <Icon name="chat" size={22} /><span className="hx-sa__wa-label">Chat with us</span>
        </a>
      )}
    </div>
  );
}
