import { BACKGROUND_THEMES, SECTION_THEMES, productBackgroundTheme } from './backgroundThemes.js';
export const supportsScrollBackground = (path) => path === '/' || path === '/shop'
  || /^\/(category|product)\/[^/]+\/?$/.test(path);

// The homepage is the one route where this effect is expensive, and it is
// expensive because of how MANY scenes it mounts rather than because of the
// effect itself: one per section, nine of them carrying 54 shapes, where a
// category page mounts one and a product page three.
//
// Measured on a Moto-G-class profile over Slow 4G with a 4x CPU throttle,
// scrolling the homepage serviced 33.8 frames per second with the scenes
// mounted against 135.7 with them off, and produced six long tasks (worst
// 89 ms). Category and product pages measured flat in the same run — 130.6
// vs 134.0 and 134.6 vs 140.4 — so they keep their scenes at every width.
//
// 1024px is this codebase's own desktop boundary, the widest breakpoint the
// v2 sheets use. The gate is on width rather than pointer type because a
// narrow desktop window pays the same cost a phone does.
export const HOME_SCENES_MIN_WIDTH = 1024;
export const HOME_SCENES_MEDIA = `(min-width: ${HOME_SCENES_MIN_WIDTH}px)`;

/**
 * Whether decorative scenes should mount for this route at this viewport.
 * Only the homepage consults the width; every other route ignores it.
 */
export const scenesAllowedAt = (path, wideViewport) => supportsScrollBackground(path)
  && (path !== '/' || !!wideViewport);

// The listing body excludes its sibling filter dialog. Isolating the entire
// shop would incorrectly trap that dialog below the global sticky header.
const TARGETS = '.v2-home > .hm-section:not([data-home-section="creator"]), .v2-home > .hd-section, .v2-shop__body, .v2-pdp-root > .pdp, .v2-pdp-root > .pdp-flow, .pdp-recommendations';

// Small, bounded CSS scenes: no images, canvas, dependencies or scroll state in
// React. Only visible sections run, with one batched update per scroll frame.
export function mountScrollBackground(root, context = {}) {
  if (!window.matchMedia || !window.IntersectionObserver) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = new Map();
  const visible = new Set();
  let frame = 0;
  let active = false;

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    active = false;
    for (const scene of scenes.values()) scene.classList.remove('sl-bg--moving');
  }

  function paint() {
    frame = 0;
    // Read all layout before writing styles; decorations never affect layout.
    const boxes = [...visible].map((host) => [host, host.getBoundingClientRect()]);
    for (const [host, box] of boxes) {
      const scene = scenes.get(host);
      const offset = Math.max(0, Math.min(-box.top, box.height - window.innerHeight));
      const progress = Math.max(0, Math.min(1, (window.innerHeight - box.top) / (window.innerHeight + box.height)));
      scene.style.setProperty('--sl-bg-y', `${offset.toFixed(1)}px`);
      scene.style.setProperty('--sl-bg-drift', `${((progress - .5) * 100).toFixed(1)}px`);
      scene.style.setProperty('--sl-bg-turn', `${(progress * 80).toFixed(1)}deg`);
      // Long catalogue pages also change scene with scroll depth.
      if (host.matches('.v2-shop__body') && !context.category) {
        const themes = ['botanical', 'hydration', 'nutrient'];
        setTheme(scene, themes[Math.floor(Math.max(0, -box.top) / (window.innerHeight * 1.2)) % themes.length]);
      }
      scene.classList.toggle('sl-bg--moving', active && !document.hidden && !reduced.matches);
    }
  }

  function wake() {
    if (reduced.matches || document.hidden) return;
    active = true;
    if (!frame) frame = requestAnimationFrame(paint);
    // CSS keeps visible scenes alive without a JavaScript animation loop.
    // Intersection, tab visibility and reduced-motion still pause all motion.
  }

  const observer = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) visible.add(target);
      else {
        visible.delete(target);
        scenes.get(target)?.classList.remove('sl-bg--moving');
      }
    }
    wake();
  }, { rootMargin: '0px', threshold: 0 });

  function setTheme(scene, name) {
    if (scene.dataset.theme === name) return;
    const theme = BACKGROUND_THEMES[name] || BACKGROUND_THEMES.mineral;
    scene.dataset.theme = name;
    theme.colors.forEach((color, index) => scene.style.setProperty(`--sl-bg-${['a', 'b', 'c'][index]}`, color));
    const shapes = ['wash', ...theme.shapes].map((kind, index) => {
      const shape = document.createElement('i');
      shape.className = `sl-bg__${kind}`;
      shape.style.setProperty('--sl-shape-index', index);
      return shape;
    });
    scene.replaceChildren(...shapes);
  }

  function discover() {
    for (const [host, scene] of scenes) {
      if (!root.contains(host)) {
        observer.unobserve(host);
        visible.delete(host);
        scene.remove();
        host.classList.remove('sl-bg-host');
        scenes.delete(host);
      }
    }
    for (const host of root.querySelectorAll(TARGETS)) {
      if (scenes.has(host)) continue;
      const scene = document.createElement('div');
      scene.className = 'sl-bg';
      scene.setAttribute('aria-hidden', 'true');
      const isPdp = host.matches('.pdp, .pdp-flow, .pdp-recommendations');
      const section = host.dataset.homeSection;
      const theme = isPdp ? productBackgroundTheme(context.product)
        : SECTION_THEMES[section] || (context.category
          ? productBackgroundTheme({ category: context.category }) : 'botanical');
      scene.dataset.placement = host.matches('.pdp-flow') ? 'story' : isPdp ? 'product' : 'section';
      setTheme(scene, theme);
      scenes.set(host, scene);
      host.classList.add('sl-bg-host');
      host.appendChild(scene);
      observer.observe(host);
    }
  }

  function preference() {
    if (reduced.matches || document.hidden) stop();
    else wake();
  }
  discover();
  const mutation = new MutationObserver(discover);
  mutation.observe(root, { childList: true, subtree: true });
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', wake, { passive: true });
  document.addEventListener('visibilitychange', preference);
  reduced.addEventListener('change', preference);
  return () => {
    stop();
    observer.disconnect();
    mutation.disconnect();
    window.removeEventListener('scroll', wake);
    window.removeEventListener('resize', wake);
    document.removeEventListener('visibilitychange', preference);
    reduced.removeEventListener('change', preference);
    for (const [host, scene] of scenes) {
      host.classList.remove('sl-bg-host');
      scene.remove();
    }
    scenes.clear();
    visible.clear();
  };
}
