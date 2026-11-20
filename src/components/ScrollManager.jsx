import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { anchorId, entryKey, readPositions, rememberPosition, scrollDecision, writePositions } from '../lib/scrollOnNavigate.js';

// ============================================================
// Scroll on navigation, site-wide — mounted once inside the router
// (main.jsx), so it covers the five storefronts and the admin alike.
// The rules are scrollDecision's (src/lib/scrollOnNavigate.js): a new page
// opens at the top; back and forward return to where that page was left; a
// #hash goes to its anchor; a change to the query string alone (filters,
// sort, a variant, an admin tab) leaves the page where it is.
//
// The browser's own restoration is switched to manual — in a single-page app
// it fires before the next page has rendered. Positions are remembered per
// history entry: on scroll, and on the click that starts a navigation (before
// the new page can move anything), and kept in sessionStorage so a reload
// returns to them (a reload or a back/forward into the site, never a fresh
// visit). A restore or anchor waits up to a second for the page to grow tall
// enough or the anchor to render, then holds the target while stylesheets and
// images arrive (up to three seconds), and gives way the moment the visitor
// scrolls, taps or presses a key. Jumps are instant even though
// html has scroll-behavior: smooth (base.css): they ask for behavior
// 'instant' outright. Setting the CSS aside for the call is not enough —
// Chrome takes the behaviour from style it has not recomputed yet, and the
// new page glides down from the old position (measured at 390: 900 → 0 over
// half a second, interrupted by any tap). The CSS route is kept only for a
// browser that rejects 'instant'.
// ============================================================

const WAIT_MS = 1000;                   // for an anchor to render, or the page to grow tall enough
const HOLD_MS = 3000;                   // at most, holding the target while styles and images arrive
const FREEZE_MS = 1000;                 // after a link click, scroll events no longer move that entry's position
const INTENT = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

/** Run move(behavior) instantly: 'instant' where the browser knows it, else with the smooth CSS set aside. */
function instantly(move) {
  try { move('instant'); return; } catch { /* an older engine rejects the value */ }
  const root = document.documentElement, was = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  try { move(undefined); } finally { root.style.scrollBehavior = was; }
}
const jump = (y) => instantly((behavior) => window.scrollTo(behavior ? { top: y, left: 0, behavior } : { top: y, left: 0 }));

// What was on screen (owner, 2026-11-20: "kuch bhi back krte hain to page niche chle jata hai").
// A position alone is not enough coming back: the page re-renders with its loading sections
// empty, they fill in above the shopper, and the browser keeps pushing the page down — 1,200
// px became 2,162 (measured at 412, home → product → back). So on leaving, the link (or
// section) in the middle of the screen is noted with where it sat; coming back, the page
// follows that element until it has stopped moving. Sampled only when leaving, never on scroll.
const ANCHOR_WAIT_MS = 2500;            // for the noted element to render again
const ANCHOR_STILL_MS = 700;            // it must sit still this long before the hold ends
const ANCHOR_HOLD_MS = 5000;            // at most
export function noteAnchor() {
  try {
    const w = window.innerWidth, h = window.innerHeight;
    for (const [fx, fy] of [[0.5, 0.35], [0.25, 0.35], [0.75, 0.35], [0.5, 0.5], [0.5, 0.2], [0.5, 0.65]]) {
      const hit = document.elementFromPoint(w * fx, h * fy);
      const el = hit?.closest?.('a[href], section[id], [id]:not(html):not(body):not(#root)');
      if (!el || el.closest('header, nav, [role="dialog"]')) continue;
      const pos = window.getComputedStyle(el).position;
      if (pos === 'fixed' || pos === 'sticky') continue;
      const sel = el.matches('a[href]') ? `a[href="${CSS.escape(el.getAttribute('href'))}"]` : `#${CSS.escape(el.id)}`;
      const all = [...document.querySelectorAll(sel)];
      const nth = all.indexOf(el);
      if (nth < 0) continue;
      return { sel, nth, of: all.length, off: Math.round(el.getBoundingClientRect().top) };
    }
  } catch { /* an old engine: the position alone */ }
  return null;
}
// The same product can be linked twice (the winter band and New arrivals): until the page
// has as many such links as when it was left, the nth one may be a different card.
const findAnchor = (a) => {
  try { const all = document.querySelectorAll(a.sel); return all.length >= (a.of || 0) ? all[a.nth] || null : null; } catch { return null; }
};
// Kept for the tab (sessionStorage), so a reload or a back into the site follows them too.
const ANCHOR_KEY = 'sora-scroll-anchors';
function readAnchors() {
  try { const raw = JSON.parse(window.sessionStorage.getItem(ANCHOR_KEY) || '[]'); return new Map(Array.isArray(raw) ? raw.filter((e) => Array.isArray(e) && typeof e[0] === 'string' && e[1] && typeof e[1].sel === 'string') : []); } catch { return new Map(); }
}
function writeAnchors(map) {
  try { window.sessionStorage.setItem(ANCHOR_KEY, JSON.stringify([...map].slice(-60))); } catch { /* storage full or blocked */ }
}

/** Follow the noted element until it has sat still; the plain position until it renders. */
function followAnchor(y, anchor) {
  const start = Date.now();
  let still = 0, lastTop = null, live = true, frame = null, timer = null;
  const tick = () => {
    if (!live) return;
    frame = timer = null;
    const now = Date.now();
    const el = findAnchor(anchor);
    if (el) {
      const top = el.getBoundingClientRect().top;
      const want = Math.max(0, Math.min(window.scrollY + top - anchor.off, maxScroll()));
      if (Math.abs(window.scrollY - want) > 1) jump(want);
      const at = Math.round(el.getBoundingClientRect().top);
      if (lastTop === at) { still = still || now; } else { still = 0; lastTop = at; }
      if ((still && now - still >= ANCHOR_STILL_MS) || now - start >= ANCHOR_HOLD_MS) { live = false; return; }
    } else {
      const want = Math.min(y, maxScroll());
      if (Math.abs(window.scrollY - want) > 1) jump(want);
      if (now - start >= ANCHOR_WAIT_MS) { live = false; return; }
    }
    if (document.hidden) timer = window.setTimeout(tick, 50);
    else frame = window.requestAnimationFrame(tick);
  };
  tick();
  return () => { live = false; if (frame != null) window.cancelAnimationFrame(frame); if (timer != null) window.clearTimeout(timer); };
}

// Back/forward: the position has to be taken at the popstate, before React Router renders
// the other entry — a last scroll whose event has not been dispatched yet would otherwise be
// lost. Listeners on window run in the order they were added (the capture flag does not
// put one ahead there), and the router adds its own when it mounts, so this one is added
// when the module loads: main.jsx imports it before anything renders.
let beforePop = null;
if (typeof window !== 'undefined') window.addEventListener('popstate', () => beforePop?.());
const maxScroll = () => Math.max(0, (document.documentElement.scrollHeight || 0) - (window.innerHeight || 0));

/** This document was loaded by a reload or a back/forward (Navigation Timing), not a fresh visit. */
function reEntry() {
  try {
    const type = window.performance?.getEntriesByType?.('navigation')?.[0]?.type;
    return type === 'reload' || type === 'back_forward';
  } catch { return false; }
}

/**
 * The page has its final layout once the document has loaded and every stylesheet has
 * arrived. On a direct load of a store page the store's sheet (app-deferred.css) lands
 * after the first render, so a target measured before then moves — a #section first
 * found 3,000 px down sat 1,700 px down once styled (measured at 390, /fashion/men).
 */
const settled = () => document.readyState === 'complete'
  && ![...document.querySelectorAll('link[rel="stylesheet"]')].some((link) => !link.sheet);

/**
 * Follow a target until the page settles. step() moves to the target if it has drifted and
 * says 'wait' (not there yet: no anchor, page too short) or 'held'. A target never reached
 * within WAIT_MS gives up (onGiveUp); one reached is held until the page has been settled
 * for three ticks, or HOLD_MS. Ticks are animation frames, or a timer in a background tab
 * (no frames there), so a link opened in a new tab still lands. Returns a cancel.
 */
function follow(step, onGiveUp) {
  const start = Date.now();
  let reachedAt = 0, calm = 0, live = true, frame = null, timer = null;
  const tick = () => {
    if (!live) return;
    frame = timer = null;
    const now = Date.now();
    if (step() === 'wait') {
      if (now - start >= WAIT_MS) { live = false; onGiveUp?.(); return; }
    } else {
      reachedAt = reachedAt || now;
      calm = settled() ? calm + 1 : 0;
      if (calm >= 3 || now - reachedAt >= HOLD_MS) { live = false; return; }
    }
    if (document.hidden) timer = window.setTimeout(tick, 50);
    else frame = window.requestAnimationFrame(tick);
  };
  tick();
  return () => { live = false; if (frame != null) window.cancelAnimationFrame(frame); if (timer != null) window.clearTimeout(timer); };
}

function apply(decision, sameDocumentAnchor, anchor = null) {
  if (decision.kind === 'top') { jump(0); return null; }
  if (decision.kind === 'restore' && anchor) return followAnchor(decision.y, anchor);
  if (decision.kind === 'restore') {
    const y = decision.y;
    return follow(() => {
      const want = Math.min(y, maxScroll());
      if (Math.abs(window.scrollY - want) > 1) jump(want);
      return maxScroll() >= y ? 'held' : 'wait';
    }, null);
  }
  if (decision.kind === 'anchor') {
    if (decision.top) jump(0);
    if (sameDocumentAnchor) {
      // On the page already, laid out: one scroll with the page's own behaviour (smooth), never repeated.
      let started = false;
      return follow(() => {
        if (started) return 'held';
        const el = document.getElementById(decision.id);
        if (!el) return 'wait';
        el.scrollIntoView({ block: 'start' });
        started = true;
        return 'held';
      }, null);
    }
    return follow(() => {
      const el = document.getElementById(decision.id);
      if (!el) return 'wait';
      const margin = parseFloat(window.getComputedStyle(el).scrollMarginTop) || 0;
      const off = el.getBoundingClientRect().top - margin;
      const atBottom = off > 0 && window.scrollY >= maxScroll() - 1;
      if (Math.abs(off) > 1 && !atBottom) instantly((behavior) => el.scrollIntoView(behavior ? { block: 'start', behavior } : { block: 'start' }));
      return 'held';
    }, null);
  }
  return null;
}

export default function ScrollManager() {
  const location = useLocation();
  const action = useNavigationType();
  const s = useRef(null);
  if (!s.current) s.current = { positions: null, key: null, prev: null, frozen: null, frozenUntil: 0, cancel: null, anchorClick: null, anchors: null };

  useEffect(() => {
    const st = s.current;
    let was;
    try { was = window.history.scrollRestoration; window.history.scrollRestoration = 'manual'; } catch { /* not supported */ }
    const remember = () => { if (st.key && !(st.frozen === st.key && Date.now() < st.frozenUntil)) rememberPosition(st.positions, st.key, window.scrollY); };
    const onClick = (e) => {
      const link = e.target?.closest?.('a[href]');
      if (!st.key || !link) return;
      rememberPosition(st.positions, st.key, window.scrollY);
      const noted = noteAnchor();
      if (noted) st.anchors.set(st.key, { ...noted, y: window.scrollY }); else st.anchors.delete(st.key);
      st.frozen = st.key; st.frozenUntil = Date.now() + FREEZE_MS;
      // A plain <a href="#x"> arrives as a POP: mark it so the anchor wins over any
      // position remembered for an earlier visit to the same #x.
      const href = link.getAttribute?.('href') || '';
      st.anchorClick = href.startsWith('#') ? { hash: href, until: Date.now() + FREEZE_MS } : null;
    };
    const giveWay = () => { st.cancel?.(); st.cancel = null; };
    const persist = () => {
      writePositions(window.sessionStorage, st.positions);
      if (st.key) { const noted = noteAnchor(); if (noted) st.anchors.set(st.key, { ...noted, y: window.scrollY }); }
      writeAnchors(st.anchors);
    };
    window.addEventListener('scroll', remember, { passive: true });
    // The module-level popstate listener (above) calls this. The click freeze still applies,
    // so a native #anchor jump never overwrites where the page was before the click.
    beforePop = () => {
      remember();
      if (!st.key) return;
      const noted = noteAnchor();
      if (noted) st.anchors.set(st.key, { ...noted, y: window.scrollY }); else st.anchors.delete(st.key);
    };
    document.addEventListener('click', onClick, true);
    for (const type of INTENT) window.addEventListener(type, giveWay, { passive: true, capture: true });
    window.addEventListener('pagehide', persist);
    return () => {
      window.removeEventListener('scroll', remember);
      beforePop = null;
      document.removeEventListener('click', onClick, true);
      for (const type of INTENT) window.removeEventListener(type, giveWay, { capture: true });
      window.removeEventListener('pagehide', persist);
      giveWay();
      try { if (was) window.history.scrollRestoration = was; } catch { /* not supported */ }
    };
  }, []);

  // Before paint, so the new page never shows at the old page's position.
  useLayoutEffect(() => {
    const st = s.current;
    if (!st.positions) st.positions = readPositions(window.sessionStorage);
    if (!st.anchors) st.anchors = readAnchors();
    st.cancel?.(); st.cancel = null;
    const key = entryKey(location);
    const anchorClicked = !!st.anchorClick && st.anchorClick.hash === location.hash && Date.now() < st.anchorClick.until;
    st.anchorClick = null;
    // On the first render a remembered position is used only when the browser says this load is a
    // reload or a back/forward into the site — never for a fresh visit to a URL seen before.
    const saved = st.prev || reEntry() ? st.positions.get(key) : undefined;
    const decision = scrollDecision({ action, prev: st.prev, next: location, saved, anchorClicked });
    const sameDocumentAnchor = !!st.prev && st.prev.pathname === location.pathname && !!anchorId(location.hash);
    st.key = key; st.frozen = null; st.prev = location;
    // The noted element counts only if the page was left from the position being restored.
    const noted = decision.kind === 'restore' ? st.anchors.get(key) : null;
    st.cancel = apply(decision, sameDocumentAnchor, noted && Math.abs(noted.y - decision.y) <= 2 ? noted : null);
    writePositions(window.sessionStorage, st.positions);
    writeAnchors(st.anchors);
  }, [location, action]);

  return null;
}
