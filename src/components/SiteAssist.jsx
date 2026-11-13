import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useConsumerCare } from '../lib/consumerCare.js';
import { siteHomeTitle, holdTitle, useSiteLd } from '../lib/pageMeta.js';
import PromoCard from './PromoCard.jsx';
import { careOpen } from '../lib/careHours.js';
import AppNudge from './AppNudge.jsx';

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
const LISTING = /^\/(shop|category\/[^/]+|fashion\/(c\/[^/]+|search|wishlist|men|women|jewellery)|homeliving\/(category\/[^/]+|search|wishlist))\/?$/;

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
  const [net, setNet] = useState(null);   // null, 'off' or 'back'
  useSiteLd(care?.phone || '');   // the business and its search, for search engines (pageMeta.js)

  useEffect(() => {
    const measure = () => setOffset(footOffset());
    // Also later: a product page's buy bar appears once its catalogue has loaded (often after 1.5 s).
    const timers = [100, 600, 1500, 3000, 5000].map((ms) => setTimeout(measure, ms));   // also where only the promo card shows (cart, checkout)
    window.addEventListener('resize', measure);
    let once = false;
    const firstScroll = () => { if (!once) { once = true; measure(); } };
    window.addEventListener('scroll', firstScroll, { passive: true });
    if (hidden) return () => { timers.forEach(clearTimeout); window.removeEventListener('resize', measure); window.removeEventListener('scroll', firstScroll); };
    const onScroll = () => setUp(window.scrollY > window.innerHeight * 2);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { timers.forEach(clearTimeout); window.removeEventListener('scroll', onScroll); window.removeEventListener('scroll', firstScroll); window.removeEventListener('resize', measure); };
  }, [pathname, hidden]);

  // Desktop: once the buy box has scrolled away on a Fashion or Home & Living product
  // page, the page's own buy bar (the phone one) shows at the foot (CSS: html.pdp-bar-on).
  useEffect(() => {
    const root = document.documentElement;
    if (!PRODUCT.test(pathname)) { root.classList.remove('pdp-bar-on'); document.querySelectorAll('.hl.pdp-bar-on').forEach((el) => el.classList.remove('pdp-bar-on')); return undefined; }
    const onScroll = () => {
      const box = document.querySelector('.fs-buybox, .hl-buybox');
      const on = !!box && box.getBoundingClientRect().bottom < 0;
      if (on !== root.classList.contains('pdp-bar-on')) {
        root.classList.toggle('pdp-bar-on', on);
        document.querySelectorAll('.hl').forEach((el) => el.classList.toggle('pdp-bar-on', on));   // its sheet is namespaced under .hl
        [60, 320].forEach((ms) => setTimeout(() => setOffset(footOffset()), ms));   // after the bar's slide-in
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); root.classList.remove('pdp-bar-on'); document.querySelectorAll('.hl.pdp-bar-on').forEach((el) => el.classList.remove('pdp-bar-on')); };
  }, [pathname]);

  // The installed app's Back button sits above the same foot bar (AppShell.jsx).
  useEffect(() => { document.documentElement.style.setProperty('--app-foot', `${offset}px`); }, [offset]);

  // Offline notice (2026-11-10): the connection dropping says so, on every page, the
  // checkout included; coming back says so for a few seconds, then goes.
  useEffect(() => {
    let t = null;
    const off = () => { clearTimeout(t); setNet('off'); };
    const on = () => { clearTimeout(t); setNet((v) => (v === 'off' ? 'back' : v)); t = setTimeout(() => setNet(null), 3500); };
    if (navigator.onLine === false) setNet('off');
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => { clearTimeout(t); window.removeEventListener('offline', off); window.removeEventListener('online', on); };
  }, []);

  // "Skip to main content": the first thing a keyboard reaches on every page (shown only when focused).
  useEffect(() => {
    if (document.querySelector('.hx-skip')) return;
    const a = document.createElement('a');
    a.className = 'hx-skip'; a.href = '#main'; a.textContent = 'Skip to main content';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const m = document.querySelector('main') || document.querySelector('.hl, .fs, #root > *');
      if (m) { if (!m.hasAttribute('tabindex')) m.setAttribute('tabindex', '-1'); m.focus(); }
    });
    document.body.prepend(a);
  }, []);

  // "/" focuses the store's search box, as on most large shops (not while typing in a field).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const box = document.querySelector('.fs-search input, .hl-search input, .v2-hdr__searchbox input');
      if (box && box.offsetParent !== null) { e.preventDefault(); box.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Listing and search pages are named after their heading (product pages name
  // themselves: pageMeta.js). Read once the page has rendered.
  useEffect(() => {
    const siteTitle = siteHomeTitle();
    if (!LISTING.test(pathname)) {
      if (!PRODUCT.test(pathname)) document.title = siteTitle;   // the home pages and the rest: the site's own title
      return undefined;
    }
    // The heading can change as the catalogue arrives ("Loading…" → the category), so it is read again.
    let release = () => {};
    let last = '';
    const read = () => {
      const h = (document.querySelector('main h1, .fs-listing h1, .hl-listing h1, h1')?.textContent || '').replace(/\s+/g, ' ').trim();
      if (h && h !== last) { last = h; release(); release = holdTitle(`${h} | SORA LIFESTYLE`); }
    };
    const timers = [400, 1200, 2500, 5000].map((ms) => setTimeout(read, ms));
    return () => { timers.forEach(clearTimeout); release(); };
  }, [pathname]);

  const netNote = net && (
    <p className={`hx-net${net === 'back' ? ' is-back' : ''}`} role="status" aria-live="polite">
      {net === 'off'
        ? (navigator.serviceWorker?.controller ? 'You’re offline. Pages and products you’ve already seen still open; anything new loads once you’re back.' : 'You’re offline. Check your connection; anything new loads once you’re back.')
        : 'Back online.'}
    </p>
  );
  // A promo link's code, or the welcome offer (PromoCard.jsx); cart and checkout keep the code in view.
  const promo = <PromoCard foot={offset} />;
  if (hidden) return <>{netNote}{promo}</>;
  const nudge = <AppNudge foot={offset} />;
  // The product's name is read from the page's heading at the moment of the tap (it renders after this).
  const build = () => waLink(care?.phone, pathname, document.querySelector('main h1, h1')?.textContent || '', window.location.href.split('#')[0]);
  const wa = waLink(care?.phone, '/', '', '');
  // Online now, or when replies start — from the published support hours (careHours.js); unknown hours, nothing said.
  const status = careOpen(care?.hours);
  const statusText = status ? (status.open ? 'Online now' : `Replies from ${status.opens}`) : '';
  const top = () => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
  };
  return (
    <>{netNote}{promo}{nudge}
    <div className="hx-sa" style={{ '--sa-foot': `${offset}px` }}>
      {up && (
        <button type="button" className="hx-sa__btn hx-sa__top" onClick={top} aria-label="Back to top">
          <Icon name="chevronUp" size={20} />
        </button>
      )}
      {wa && (
        <a className="hx-sa__btn hx-sa__wa" href={wa} target="_blank" rel="noopener noreferrer" aria-label={`Chat with us on WhatsApp${statusText ? ` (${statusText})` : ''}`} title={statusText || undefined} onClick={(e) => { e.currentTarget.href = build(); }}>
          <Icon name="chat" size={22} /><span className="hx-sa__wa-label">Chat with us{statusText && <small>{statusText}</small>}</span>
          {status && <i className={`hx-sa__dot${status.open ? ' is-on' : ''}`} aria-hidden="true" />}
        </a>
      )}
    </div>
    </>
  );
}
