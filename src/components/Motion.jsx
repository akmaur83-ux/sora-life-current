import { useEffect, useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { installMotion, reducedMotion, REVEAL_CARDS } from '../lib/motion.js';

// ============================================================
// Motion (owner, 2026-11-21: "sab add kro"): mounts the site-wide movements (lib/motion.js)
// and the two that follow the route:
//   9  · a new page fades in (and rises a touch when it is a new page, not "back");
//   10 · on a phone or desktop Chrome, a product card's picture grows into the product
//        page's main picture (the View Transitions API). Elsewhere: a normal page change.
// ============================================================
const PRODUCT_PATH = /^\/(?:product|fashion\/p|homeliving\/p)\/[^/?#]+/;

export default function Motion() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();
  const first = useRef(true);

  useEffect(() => installMotion(), []);

  // 9 · page fade.
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reducedMotion() || document.documentElement.classList.contains('vt-running')) return;
    const main = document.querySelector('main');
    main?.animate?.(navType === 'POP'
      ? [{ opacity: 0.55 }, { opacity: 1 }]
      : [{ opacity: 0.35, transform: 'translate3d(0, 10px, 0)' }, { opacity: 1, transform: 'none' }],
    { duration: 280, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // 10 · card picture → product page picture.
  useEffect(() => {
    if (typeof document.startViewTransition !== 'function') return undefined;
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || reducedMotion()) return;
      const a = e.target.closest?.('a[href]');
      if (!a || a.target === '_blank' || a.origin !== window.location.origin) return;
      const href = a.getAttribute('href');
      if (!PRODUCT_PATH.test(href || '')) return;
      const card = a.closest(REVEAL_CARDS);
      const img = card?.querySelector('img');
      if (!img || !img.complete) return;
      e.preventDefault();
      img.style.viewTransitionName = 'sora-hero';
      document.documentElement.classList.add('vt-running');
      const vt = document.startViewTransition(() => {
        img.style.viewTransitionName = '';
        flushSync(() => navigate(href));
      });
      const done = () => document.documentElement.classList.remove('vt-running');
      vt.finished.then(done, done);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [navigate]);

  return null;
}
