import { useEffect, useState } from 'react';

// ============================================================
// Feel (owner, 2026-11-21: "Blinkit/Zepto jaise" — the patterns, in SORA's own look).
//   haptic()      a short tick on Android when something lands in the bag (iOS ignores it)
//   flyToCart()   the product's picture flies into the bag icon, the count pops
//   useRotatingHint()  the search box suggests a real thing to look for, turning every 2.6 s
// Everything here stays still for a shopper whose device asks for less motion.
// ============================================================

export const reducedMotion = () => {
  try { return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** A light tap of the phone's motor. Never throws; does nothing where unsupported. */
export function haptic(ms = 12) {
  try { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && !reducedMotion()) navigator.vibrate(ms); } catch { /* not allowed here */ }
}

/** The bag icon the picture should fly to: the bottom bar's on a phone, else the header's. */
export function cartTarget(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return null;
  const seen = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < (doc.defaultView?.innerHeight || 1e4); };
  const picks = [
    ...doc.querySelectorAll('nav.tabbar a[href="/cart"], .hl-nav a[href="/cart"]'),
    ...doc.querySelectorAll('header a[href="/cart"], a[aria-label^="Cart"], a[aria-label*="cart" i]'),
  ];
  return picks.find(seen) || null;
}

/**
 * Fly a copy of `from` (an <img>, or an element holding one) into the bag icon. Pure
 * decoration: it is a detached copy, removed when it lands, and skipped entirely for
 * reduced motion or where the Web Animations API is missing.
 */
export function flyToCart(from) {
  try {
    if (!from || reducedMotion() || typeof document === 'undefined') return;
    const img = from.tagName === 'IMG' ? from : from.querySelector?.('img');
    const target = cartTarget();
    if (!img || !target || typeof img.animate !== 'function') return;
    const a = img.getBoundingClientRect(); const b = target.getBoundingClientRect();
    if (!a.width || !b.width) return;
    const size = Math.min(72, a.width);
    const ghost = img.cloneNode(false);
    ghost.removeAttribute('srcset'); ghost.removeAttribute('sizes'); ghost.removeAttribute('loading');
    ghost.setAttribute('aria-hidden', 'true'); ghost.alt = '';
    Object.assign(ghost.style, {
      position: 'fixed', left: `${a.left + a.width / 2 - size / 2}px`, top: `${a.top + a.height / 2 - size / 2}px`,
      width: `${size}px`, height: `${size}px`, objectFit: 'cover', borderRadius: '50%', zIndex: 9999, pointerEvents: 'none',
      boxShadow: '0 10px 24px rgba(0,0,0,.28)', border: '2px solid #fff', background: '#fff', margin: 0,
    });
    document.body.appendChild(ghost);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const run = ghost.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(.8)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(.18)`, opacity: 0.6 },
    ], { duration: 650, easing: 'cubic-bezier(.45, 0, .2, 1)' });
    const land = () => {
      ghost.remove();
      target.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
    };
    run.onfinish = land; run.oncancel = () => ghost.remove();
  } catch { /* decoration only */ }
}

/** What each store's search box suggests: real things in its catalogue. */
// Checked against the live catalogue (2026-11-21): every word finds products in its store.
export const SEARCH_HINTS = Object.freeze({
  wellness: ['face wash', 'shampoo', 'serum', 'hair oil', 'body lotion', 'vitamin C'],
  fashion: ['leather jacket', 'shawl', 'quilt', 'handbag', 'wallet', 'saree'],
  homeliving: ['bedsheet', 'cushion cover', 'table cover'],
});
export const HINT_EVERY_MS = 2600;
/** `Search "leather jacket"` for the hint at `i`. Pure. */
export const hintText = (list, i) => (Array.isArray(list) && list.length ? `Search "${list[((i % list.length) + list.length) % list.length]}"` : '');

/** The current hint, turning every HINT_EVERY_MS while `run` is true (paused while typing). */
export function useRotatingHint(list, run = true) {
  // -1 until the first turn: the page first shows its own placeholder (and so does the
  // server-rendered page), then the hints begin.
  const [i, setI] = useState(-1);
  useEffect(() => {
    if (!run || !Array.isArray(list) || list.length < 2 || reducedMotion()) return undefined;
    const t = window.setInterval(() => { if (!document.hidden) setI((v) => v + 1); }, HINT_EVERY_MS);
    return () => window.clearInterval(t);
  }, [run, list]);
  return i < 0 ? '' : hintText(list, i);
}

// ---- The press that added something -----------------------------------------------
// Every add path tells the shopper with an "Added to cart" note (lib/store.jsx). Toasts.jsx
// turns that note into the tick and the flying picture, from the last thing pressed — so
// cards, product pages, the cart's add-ons and "Order again" all get it from one place.
let lastPress = null;
export function trackPresses(win = typeof window !== 'undefined' ? window : null) {
  if (!win || win.__soraPresses) return;
  win.__soraPresses = true;
  win.addEventListener('pointerdown', (e) => { lastPress = { el: e.target, at: Date.now() }; }, { capture: true, passive: true });
}
const PRODUCT_SCOPES = '.v2-pc, .fs-card, .hl-card, .gs-card, [data-product], .v2-pdp-root, .hl-pdp, .fs-pdp, .cartrow, .sora-addons__item, article';
/** The picture of the product around the last press (within 2 s), if any. */
export function pressedPicture(now = Date.now()) {
  if (!lastPress || now - lastPress.at > 2000 || !lastPress.el?.closest) return null;
  const scope = lastPress.el.closest(PRODUCT_SCOPES);
  if (!scope) return null;
  const imgs = [...scope.querySelectorAll('img')].filter((i) => { const r = i.getBoundingClientRect(); return r.width > 24 && r.height > 24 && r.bottom > 0 && r.top < window.innerHeight; });
  return imgs.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0] || null;
}
/** The tick and the flight for something just added. */
export function celebrateAdd() {
  haptic(14);
  const img = pressedPicture();
  if (img) flyToCart(img);
}
