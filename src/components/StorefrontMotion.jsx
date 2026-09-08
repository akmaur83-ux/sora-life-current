import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useBootstrapReady } from '../lib/bootstrapReady.js';

// Progressive enhancement: nothing is hidden while waiting for JavaScript,
// images, or an observer. Product loading has its own independent observer.
const REVEAL = '.v2-sechead, .hd-title, .hm-category-head, .hd-tile, .hm-brand, .hm-collection, .hm-mom__media, .hm-mom__body, .hm-trust__item, .v2-pc, .v2-hero';
const DEPTH = '.hd-tile__media, .hm-brand__media, .hm-mom__media, .hm-collection__images';

export default function StorefrontMotion() {
  const { pathname } = useLocation();
  const bootstrapReady = useBootstrapReady();

  useEffect(() => {
    if (!bootstrapReady) return undefined;
    if (!(pathname === '/' || pathname === '/shop' || /^\/category\/[^/]+\/?$/.test(pathname))) return undefined;
    const root = document.querySelector('.page-main');
    if (!root || !window.matchMedia || !window.IntersectionObserver) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const seen = new WeakSet();
    const running = new Set();
    let frame = 0;
    let tilted = null;
    let point = null;

    function clearTilt() {
      cancelAnimationFrame(frame);
      frame = 0;
      if (tilted) {
        tilted.classList.remove('sl-tilting');
        tilted.style.removeProperty('--sl-tilt-x');
        tilted.style.removeProperty('--sl-tilt-y');
      }
      tilted = null;
    }

    const observer = new IntersectionObserver((entries) => {
      let stagger = 0;
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        observer.unobserve(target);
        if (reduced.matches || typeof target.animate !== 'function') return;
        // Moving focused controls would interfere with keyboard navigation.
        if (target.contains(document.activeElement)) return;
        const card = target.matches('.v2-pc');
        const hero = target.matches('.v2-hero');
        const art = target.matches('.hd-tile, .hm-brand, .hm-collection, .hm-mom__media');
        // Independent panels lift and turn into the existing grid. Never
        // transform a page/section ancestor containing sticky or fixed UI.
        const direction = stagger % 2 ? 1 : -1;
        const animation = target.animate([
          { opacity: card ? 0.8 : 0.45, transform: hero ? 'scale(.965)' : art ? `perspective(1000px) translate3d(${direction * 18}px, 64px, -90px) rotateX(24deg) rotateY(${direction * 14}deg) scale(.92)` : card ? 'perspective(1000px) translateY(30px) rotateX(7deg) scale(.97)' : 'translateY(44px) scale(.94)' },
          { opacity: 1, transform: 'none' },
        ], {
          duration: card ? 650 : hero ? 1100 : art ? 1250 : 1000,
          delay: Math.min(stagger++ * (card ? 40 : 85), 255),
          easing: 'cubic-bezier(.16,1,.3,1)',
          // No backwards fill: visible/LCP media never waits behind a delay.
        });
        running.add(animation);
        animation.finished.catch(() => {}).finally(() => running.delete(animation));
        target.classList.add('sl-arrived');
      });
    }, { threshold: 0, rootMargin: '0px 0px 24px 0px' });

    function discover(node) {
      if (!(node instanceof Element)) return;
      const targets = [...(node.matches(REVEAL) ? [node] : []), ...node.querySelectorAll(REVEAL)];
      targets.forEach((target) => {
        if (seen.has(target)) return;
        seen.add(target);
        observer.observe(target);
      });
    }

    function pointerMove(event) {
      if (reduced.matches || !fine.matches || event.pointerType === 'touch') return;
      const target = event.target.closest?.(DEPTH);
      if (!target || !root.contains(target)) { clearTilt(); return; }
      if (target !== tilted) { clearTilt(); tilted = target; }
      point = { x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!tilted || !point) return;
        const box = tilted.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (point.x - box.left) / box.width * 2 - 1));
        const y = Math.max(-1, Math.min(1, (point.y - box.top) / box.height * 2 - 1));
        tilted.style.setProperty('--sl-tilt-x', `${(-y * 6).toFixed(2)}deg`);
        tilted.style.setProperty('--sl-tilt-y', `${(x * 8).toFixed(2)}deg`);
        tilted.classList.add('sl-tilting');
      });
    }

    function preferencesChanged() {
      clearTilt();
      root.classList.toggle('sl-motion', !reduced.matches);
      if (reduced.matches) running.forEach((animation) => animation.cancel());
    }
    const mutations = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach(discover)));
    preferencesChanged();
    discover(root);
    mutations.observe(root, { childList: true, subtree: true });
    root.addEventListener('pointermove', pointerMove, { passive: true });
    root.addEventListener('pointerleave', clearTilt);
    root.addEventListener('focusin', clearTilt);
    // Stop decorative motion immediately if a shopper starts interacting.
    const settle = () => running.forEach((animation) => animation.cancel());
    root.addEventListener('pointerdown', settle);
    root.addEventListener('focusin', settle);
    reduced.addEventListener('change', preferencesChanged);
    fine.addEventListener('change', clearTilt);
    return () => {
      mutations.disconnect();
      observer.disconnect();
      settle();
      clearTilt();
      root.classList.remove('sl-motion');
      root.removeEventListener('pointermove', pointerMove);
      root.removeEventListener('pointerleave', clearTilt);
      root.removeEventListener('pointerdown', settle);
      root.removeEventListener('focusin', clearTilt);
      root.removeEventListener('focusin', settle);
      reduced.removeEventListener('change', preferencesChanged);
      fine.removeEventListener('change', clearTilt);
    };
  }, [pathname, bootstrapReady]);

  return null;
}
