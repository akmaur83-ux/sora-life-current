// ============================================================
// Motion (owner, 2026-11-21: "animations add kro … sab add kro"). The site-wide movements,
// installed once by components/Motion.jsx. Rules every piece here keeps:
//   · only transform and opacity animate (the GPU's job: no repaint, no layout);
//   · nothing is hidden unless this code is running to reveal it (no JS, no hiding);
//   · nothing moves for a shopper whose device asks for less motion;
//   · decoration never blocks a tap or changes what a button does.
// ============================================================
import { isWinterSeason } from './winterDeals.js';

export const reducedMotion = () => {
  try { return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// ---- 1, 2, 4 · reveal on scroll --------------------------------------------------
// Sections and product cards below the fold rise in as they reach the screen; cards in one
// row arrive one after another. Things already on screen are never hidden.
export const REVEAL_SECTIONS = 'main section, main .fs-sec, main .hl-sec, main .gs-sec';
export const REVEAL_CARDS = '.v2-pc, .fs-card, .hl-card, .gs-card, .sora-bc__card, .sora-addons__item, .hx-pcard';
const NEVER = '.sora-winter, header, nav, footer, [role="dialog"], .v2-cart-dock, .tabbar';
const STAGGER_MS = 45;
const STAGGER_MAX = 7;

/** Whether an element should get the reveal: below the fold, not inside something that has it. Pure-ish. */
export function wantsReveal(el, viewportH) {
  if (!el || el.dataset.rv || el.closest(NEVER)) return false;
  const parentRv = el.parentElement && el.parentElement.closest('[data-rv="1"].rv');
  if (parentRv && !el.matches(REVEAL_CARDS)) return false;
  const r = el.getBoundingClientRect();
  return r.height > 0 && r.top > viewportH * 0.9;
}

function installReveal() {
  if (typeof IntersectionObserver !== 'function') return () => {};
  let batch = 0;
  const io = new IntersectionObserver((entries) => {
    batch = 0;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      if (el.matches(REVEAL_CARDS)) { el.style.setProperty('--rv-d', `${Math.min(batch, STAGGER_MAX) * STAGGER_MS}ms`); batch += 1; }
      el.classList.add('rv-in');
      io.unobserve(el);
      // Once in, the classes go, so the element is exactly as it was before (hover transforms etc.).
      window.setTimeout(() => { el.classList.remove('rv', 'rv-in'); el.style.removeProperty('--rv-d'); }, 1400);
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
  const scan = () => {
    const h = window.innerHeight;
    for (const el of document.querySelectorAll(`${REVEAL_SECTIONS}, ${REVEAL_CARDS}`)) {
      if (el.dataset.rv) continue;
      if (wantsReveal(el, h)) { el.dataset.rv = '1'; el.classList.add('rv'); io.observe(el); } else el.dataset.rv = '0';
    }
  };
  let queued = 0;
  const later = () => { if (queued) return; queued = window.setTimeout(() => { queued = 0; scan(); }, 120); };
  const mo = new MutationObserver(later);
  mo.observe(document.body, { childList: true, subtree: true });
  scan();
  return () => { mo.disconnect(); io.disconnect(); window.clearTimeout(queued); };
}

// ---- 3 · the header settles as the page scrolls ----------------------------------
function installHeaderShrink() {
  let on = false; let raf = 0;
  const check = () => { raf = 0; const next = window.scrollY > 48; if (next !== on) { on = next; document.documentElement.classList.toggle('is-scrolled', on); } };
  const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(check); };
  window.addEventListener('scroll', onScroll, { passive: true });
  check();
  return () => { window.removeEventListener('scroll', onScroll); document.documentElement.classList.remove('is-scrolled'); };
}

// ---- 7 · ripple from the finger on the main buttons ------------------------------
export const RIPPLE = '.btn, .v2-pc__cta, .fs-btn, .hl-btn, .hx-btn, .sora-addons__add, .v2-mobile-cart__link, .fs-btn--add, .pdp__add, .v2-checkout-root button[type="submit"]';
function installRipple() {
  const onDown = (e) => {
    const btn = e.target.closest?.(RIPPLE);
    if (!btn || btn.disabled || e.button > 0) return;
    const r = btn.getBoundingClientRect();
    if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
    const box = document.createElement('span'); box.className = 'sora-ripple'; box.setAttribute('aria-hidden', 'true');
    const dot = document.createElement('i');
    const size = Math.max(r.width, r.height) * 2.2;
    Object.assign(dot.style, { width: `${size}px`, height: `${size}px`, left: `${e.clientX - r.left - size / 2}px`, top: `${e.clientY - r.top - size / 2}px` });
    box.appendChild(dot); btn.appendChild(box);
    window.setTimeout(() => box.remove(), 650);
  };
  document.addEventListener('pointerdown', onDown, { passive: true });
  return () => document.removeEventListener('pointerdown', onDown);
}

// ---- 6 · the heart: a pop and a little burst when saved, a shrink when unsaved -----
export const HEARTS = '.v2-pc__wish, .fs-heart, .hl-card__heart, .hl-gallery__heart, .pdp__bbwish, .pdp__wish, [aria-label*="wishlist" i][aria-pressed]';
function installHearts() {
  const onClick = (e) => {
    const btn = e.target.closest?.(HEARTS);
    if (!btn) return;
    window.setTimeout(() => {
      const on = btn.getAttribute('aria-pressed') === 'true';
      const svg = btn.querySelector('svg');
      svg?.animate?.(on
        ? [{ transform: 'scale(1)' }, { transform: 'scale(1.45)' }, { transform: 'scale(.9)' }, { transform: 'scale(1)' }]
        : [{ transform: 'scale(1)' }, { transform: 'scale(.7)' }, { transform: 'scale(1)' }], { duration: on ? 520 : 300, easing: 'cubic-bezier(.3, 1.5, .5, 1)' });
      if (!on) return;
      const r = btn.getBoundingClientRect();
      for (let i = 0; i < 6; i += 1) {
        const s = document.createElement('span'); s.className = 'sora-heartbit'; s.textContent = '♥'; s.setAttribute('aria-hidden', 'true');
        Object.assign(s.style, { left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px` });
        document.body.appendChild(s);
        const a = (Math.PI * 2 * i) / 6 - Math.PI / 2; const d = 26 + (i % 2) * 8;
        const run = s.animate([{ transform: 'translate(-50%, -50%) scale(.4)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1)`, opacity: 0 }], { duration: 560, easing: 'cubic-bezier(.2, .8, .3, 1)' });
        run.onfinish = () => s.remove(); run.oncancel = () => s.remove();
      }
    }, 0);
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}

// ---- 11 · sheets close by dragging them down -------------------------------------
// [panel selector, the control that closes it]
export const SHEETS = [['.fs-sheet__panel', '.fs-sheet__x'], ['.v2-fd__panel', '.v2-fd__scrim'], ['.hl-filters__panel, .hl-filters', '.hl-filters__scrim']];
function installSheetDrag() {
  let s = null;
  const onStart = (e) => {
    const t = e.touches?.[0]; if (!t) return;
    for (const [sel, close] of SHEETS) {
      const panel = e.target.closest?.(sel);
      if (!panel) continue;
      const scroller = e.target.closest('[class*="body"], [class*="list"], ul') || panel;
      if (scroller.scrollTop > 0 || panel.scrollTop > 0) return;
      if (window.matchMedia('(min-width: 900px)').matches) return;
      s = { panel, close, y0: t.clientY, dy: 0 }; return;
    }
  };
  const onMove = (e) => {
    if (!s) return; const t = e.touches?.[0]; if (!t) return;
    s.dy = Math.max(0, t.clientY - s.y0);
    if (s.dy > 6) { s.panel.style.transition = 'none'; s.panel.style.transform = `translate3d(0, ${s.dy}px, 0)`; }
  };
  const onEnd = () => {
    if (!s) return; const { panel, close, dy } = s; s = null;
    panel.style.transition = 'transform .28s cubic-bezier(.3, 1.2, .5, 1)';
    if (dy > 110) {
      panel.style.transform = 'translate3d(0, 100%, 0)';
      window.setTimeout(() => { panel.style.transform = ''; panel.style.transition = ''; panel.closest('[role="dialog"]')?.querySelector(close)?.click(); }, 200);
    } else { panel.style.transform = ''; window.setTimeout(() => { panel.style.transition = ''; }, 300); }
  };
  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('touchend', onEnd, { passive: true });
  document.addEventListener('touchcancel', onEnd, { passive: true });
  return () => { for (const [n, f] of [['touchstart', onStart], ['touchmove', onMove], ['touchend', onEnd], ['touchcancel', onEnd]]) document.removeEventListener(n, f); };
}

// ---- 20 · pull down at the very top: a flurry of snow (winter only) ---------------
function installPullSnow() {
  let y0 = null; let fired = false;
  const onStart = (e) => { y0 = window.scrollY <= 0 ? e.touches?.[0]?.clientY ?? null : null; fired = false; };
  const onMove = (e) => {
    if (y0 == null || fired || window.scrollY > 0) return;
    const y = e.touches?.[0]?.clientY; if (y == null || y - y0 < 70) return;
    fired = true; snowFlurry();
  };
  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: true });
  return () => { document.removeEventListener('touchstart', onStart); document.removeEventListener('touchmove', onMove); };
}
/** A short shower of snowflakes from the top of the screen. */
export function snowFlurry(count = 14) {
  if (reducedMotion() || typeof document === 'undefined') return;
  const box = document.createElement('div'); box.className = 'sora-flurry'; box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i += 1) {
    const f = document.createElement('i');
    f.style.left = `${(i * 37 + 11) % 100}%`; f.style.setProperty('--s', `${4 + (i % 4) * 2}px`);
    f.style.setProperty('--d', `${1.4 + (i % 5) * 0.25}s`); f.style.setProperty('--delay', `${(i % 7) * 0.08}s`); f.style.setProperty('--x', `${(i % 2 ? -1 : 1) * (10 + (i % 3) * 12)}px`);
    box.appendChild(f);
  }
  document.body.appendChild(box);
  window.setTimeout(() => box.remove(), 3000);
}

/** Install everything once; returns the undo. Nothing at all under reduced motion. */
export function installMotion() {
  if (typeof window === 'undefined' || reducedMotion()) return () => {};
  const undo = [installReveal(), installHeaderShrink(), installRipple(), installHearts(), installSheetDrag()];
  if (isWinterSeason()) undo.push(installPullSnow());
  return () => undo.forEach((u) => u && u());
}

// ---- 15 · a cart row slides away before it is removed ----------------------------
/** Slide `el` out and fold its height, then call `done` (at once under reduced motion). */
export function leave(el, done) {
  if (!el || reducedMotion() || typeof el.animate !== 'function') { done(); return; }
  const h = el.getBoundingClientRect().height;
  const out = el.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate3d(-40%, 0, 0)', opacity: 0 }], { duration: 220, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' });
  out.onfinish = () => {
    const fold = el.animate([{ height: `${h}px`, marginBottom: getComputedStyle(el).marginBottom }, { height: '0px', marginBottom: '0px' }], { duration: 180, easing: 'ease-out', fill: 'forwards' });
    el.style.overflow = 'hidden';
    fold.onfinish = done; fold.oncancel = done;
  };
  out.oncancel = done;
}

