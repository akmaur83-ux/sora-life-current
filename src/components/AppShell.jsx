import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useStore } from '../lib/store.jsx';
import { isStandalone } from '../lib/appMode.js';
import { CompareTray } from './Compare.jsx';
import { logSearch } from '../lib/insights.js';

// ============================================================
// The SORA app's runtime (owner, 2026-11-13: the app, deep), mounted once beside
// SiteAssist (main.jsx). Four quiet jobs:
//
//   * the service worker (/sw.js) is registered once the page has loaded, so the
//     installed app opens fast and offline (sw.js says what it keeps; payment,
//     sign-in and the admin are never kept);
//   * a new deploy is noticed when the visitor comes back to the tab or the app
//     (or every 30 minutes): "A new version of SORA is ready · Refresh". Never on
//     the cart or checkout, never by itself;
//   * as the installed app, the bag count rides on the app icon (where the system
//     supports badges), and <html> gets .is-app for app-only styling;
//   * as the installed app, there is no browser back button, so pages other than a
//     store's home get a Back button above the tab bar.
// ============================================================
const QUIET = /^\/(cart|checkout|fashion\/cart|homeliving\/cart|grocery\/cart|grocery\/checkout|admin|invoice)(\/|$)/;
const HOMES = /^\/(fashion|homeliving|grocery|lifestyle)?\/?$/;
const CHECK_EVERY_MS = 30 * 60 * 1000;
const SEARCH_PAGES = [[/^\/shop\/?$/, 'wellness', 'main .v2-pc, main .pcard'], [/^\/fashion\/search\/?$/, 'fashion', 'main .fs-card'], [/^\/homeliving\/search\/?$/, 'homeliving', 'main .hl-card']];
const REVEAL = '.sora-group, .sora-bc, .hx-wv-range, .hx-taj, .hx-ans, .hx-stores, .fs-sec, .hl .hl-sec, .sora-cats__store, .hx-wed__sec';

/** The deployed app's fingerprint: the entry script's ETag (or Last-Modified); '' if unknown. */
async function buildStamp() {
  try {
    const r = await fetch('/public/bundle.js', { method: 'HEAD', cache: 'no-store' });
    if (!r.ok) return '';
    return r.headers.get('etag') || r.headers.get('last-modified') || '';
  } catch { return ''; }
}

export function registerServiceWorker(win = typeof window !== 'undefined' ? window : null) {
  if (!win || !('serviceWorker' in win.navigator)) return;
  const local = /^(localhost|127\.0\.0\.1)$/.test(win.location.hostname);
  if (win.location.protocol !== 'https:' && !local) return;
  if (/[?&]nosw\b/.test(win.location.search)) return;
  const go = () => { win.navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {}); };
  if (win.document.readyState === 'complete') setTimeout(go, 1500);
  else win.addEventListener('load', () => setTimeout(go, 1500), { once: true });
}

export default function AppShell() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { cartCount } = useStore();
  const [app, setApp] = useState(false);
  const [fresh, setFresh] = useState(false);
  const stamp = useRef('');

  // Once: the worker, and whether this is the installed app.
  useEffect(() => {
    registerServiceWorker();
    const on = isStandalone();
    setApp(on);
    document.documentElement.classList.toggle('is-app', on);
  }, []);

  // A new deploy: compare the entry script's fingerprint when the visitor comes back.
  useEffect(() => {
    let live = true;
    buildStamp().then((s) => { if (live) stamp.current = s; });
    const check = async () => {
      if (document.visibilityState !== 'visible' || !stamp.current) return;
      const now = await buildStamp();
      if (live && now && now !== stamp.current) setFresh(true);
    };
    const onVis = () => { check(); };
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(check, CHECK_EVERY_MS);
    return () => { live = false; document.removeEventListener('visibilitychange', onVis); clearInterval(t); };
  }, []);

  // The bag count on the app icon (installed app, where supported).
  useEffect(() => {
    if (!app || typeof navigator === 'undefined') return;
    try {
      if (cartCount > 0 && navigator.setAppBadge) navigator.setAppBadge(cartCount).catch(() => {});
      else if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
    } catch { /* not supported */ }
  }, [app, cartCount]);

  // The reveal (2026-11-13 redesign): sections below the fold rise in softly once as
  // they scroll into view. Only what starts off-screen is ever hidden, so nothing
  // visible blinks; never under prefers-reduced-motion (sora-ds.css, .sora-reveal).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.IntersectionObserver) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let io = null;
    const t = setTimeout(() => {
      io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }, { rootMargin: '0px 0px -8% 0px' });
      document.querySelectorAll(REVEAL).forEach((el) => {
        if (el.classList.contains('sora-reveal') || el.getBoundingClientRect().top < window.innerHeight) return;
        el.classList.add('sora-reveal');
        io.observe(el);
      });
    }, 700);
    return () => { clearTimeout(t); io?.disconnect(); document.querySelectorAll('.sora-reveal:not(.is-in)').forEach((el) => el.classList.remove('sora-reveal')); };
  }, [pathname]);

  const quiet = QUIET.test(pathname);
  const showBack = app && !quiet && !HOMES.test(pathname);
  const back = () => { if (window.history.length > 1) navigate(-1); else navigate('/'); };

  // The search log (2026-11-13, owner feature 36): what was searched in which store and how many
  // results the page showed, read from the page itself once it has settled. Text only, nothing personal.
  useEffect(() => {
    const m = SEARCH_PAGES.find(([re]) => re.test(pathname));
    if (!m) return undefined;
    const q = new URLSearchParams(search).get('q');
    if (!q) return undefined;
    const t = setTimeout(() => { logSearch(m[1], q, document.querySelectorAll(m[2]).length); }, 3500);
    return () => clearTimeout(t);
  }, [pathname, search]);

  return (
    <>
      <CompareTray />
      {showBack && (
        <button type="button" className="hx-appback" onClick={back} aria-label="Back">
          <Icon name="chevronLeft" size={20} /><span>Back</span>
        </button>
      )}
      {fresh && !quiet && (
        <div className="hx-update" role="status" aria-live="polite">
          <span>A new version of SORA is ready.</span>
          <button type="button" onClick={() => window.location.reload()}>Refresh</button>
          <button type="button" className="hx-update__x" onClick={() => setFresh(false)} aria-label="Later"><Icon name="x" size={16} /></button>
        </div>
      )}
    </>
  );
}
