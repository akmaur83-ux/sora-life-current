import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { productBySlug } from '../data/products.js';
import { useBootstrapReady } from '../lib/bootstrapReady.js';
import {
  mountScrollBackground, supportsScrollBackground, scenesAreStaticAt, SCENE_MOTION_MEDIA,
} from '../lib/scrollBackground.js';

// Tracks the desktop breakpoint so that crossing it re-mounts the scenes in
// the right mode — drifting above it, static below — instead of leaving
// whatever width the first render happened to see. Rotating a tablet and
// dragging a desktop window narrow both come through here.
function useWideViewport() {
  const [wide, setWide] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia(SCENE_MOTION_MEDIA).matches
  ));
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(SCENE_MOTION_MEDIA);
    const sync = () => setWide(query.matches);
    // The viewport may have changed between first render and this effect.
    sync();
    // Both signals, deliberately. matchMedia's change event is the right one
    // and fires on a real window drag or a rotation, but some environments
    // resize the viewport without dispatching it (Chrome's device-metrics
    // emulation is one — query.matches flips while change never fires), which
    // would strand the scenes in whatever state the last navigation left.
    // resize is dispatched much more widely, and re-reading query.matches
    // makes the extra listener idempotent: React drops the update when the
    // boolean has not actually changed, so a scroll-driven resize storm costs
    // one media-query read per event and no re-render.
    query.addEventListener('change', sync);
    window.addEventListener('resize', sync, { passive: true });
    return () => {
      query.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);
  return wide;
}

// Decoration is independent of content, image loading and entrance animations.
export default function StorefrontBackground() {
  const { pathname } = useLocation();
  const ready = useBootstrapReady();
  const wide = useWideViewport();
  useEffect(() => {
    if (!ready || !supportsScrollBackground(pathname)) return;
    const root = document.querySelector('.page-main');
    if (root) {
      const segment = pathname.split('/')[2] || '';
      let slug;
      try { slug = decodeURIComponent(segment); } catch { slug = segment; }
      return mountScrollBackground(root, {
        product: pathname.startsWith('/product/') ? productBySlug[slug] : undefined,
        category: pathname.startsWith('/category/') ? slug : undefined,
        // Below the desktop breakpoint every scene is built but never written
        // to again, so scrolling composites a cached layer instead of
        // re-rastering one that changes every frame.
        staticScenes: scenesAreStaticAt(wide),
      });
    }
  }, [pathname, ready, wide]);
  return null;
}
