import { BACKGROUND_THEMES, SECTION_THEMES, productBackgroundTheme } from './backgroundThemes.js';
export const supportsScrollBackground = (path) => path === '/' || path === '/shop'
  || /^\/(category|product)\/[^/]+\/?$/.test(path);

// Every route that supports scenes mounts them at every width. What changes
// below the desktop breakpoint is that they stop MOVING.
//
// Measured at 390px under a 4x CPU throttle, fresh browser per run, the
// decoration cost about 56% of the available scrolling headroom: ~41 frames
// per second against a ~97 ceiling with no decoration at all. Cutting the
// homepage from nine scenes to three did not recover it (82.6 vs 85.5 fps on
// a settled page, inside run-to-run noise) — the IntersectionObserver below
// already limits work to the one or two scenes actually on screen, so the
// total count was never what cost anything.
//
// The fix, measured the same way, took it to ~64 fps with long tasks per
// scroll falling from 4-9 (worst 101 ms) to 1 (worst 55 ms):
//
//   9 animated scenes, original CSS   41.4 fps   4-9 long tasks   <- before
//   9 static scenes, simplified CSS   64.3 fps   1 long task      <- after
//   no decoration at all             131.2 fps   0
//
// Attribution, because it is not what it looks like: the win is in the CSS
// half — storefront-background.css drops `transform` and the drop-shadow
// filters and blurred box-shadows below 1024px, so each scene rasterises once
// into a layer that never changes. Turning the JavaScript back on with that
// CSS in place measured 64.5 fps, i.e. identical. The per-frame property
// writes are NOT what cost the frames.
//
// This static mode is kept anyway, and it is the honest thing to keep: with
// `transform: none` applied below the breakpoint, writing --sl-bg-y every
// scroll frame moves nothing anyone can see. Static mode stops computing a
// parallax that cannot render — and takes the scroll listener, the rAF loop
// and the per-section IntersectionObserver callbacks out with it. The scenes
// are still there, still coloured, still carrying their motifs; they just do
// not drift.
//
// 1024px is this codebase's own desktop boundary, the widest breakpoint the
// v2 sheets use. The split is on width rather than pointer type because a
// narrow desktop window rasterises the same way a phone does.
export const SCENE_MOTION_MIN_WIDTH = 1024;
export const SCENE_MOTION_MEDIA = `(min-width: ${SCENE_MOTION_MIN_WIDTH}px)`;

/** Scenes drift on desktop and hold still below the breakpoint. */
export const scenesAreStaticAt = (wideViewport) => !wideViewport;

// The listing body excludes its sibling filter dialog. Isolating the entire
// shop would incorrectly trap that dialog below the global sticky header.
const TARGETS = '.v2-home > .hm-section:not([data-home-section="creator"]), .v2-home > .hd-section, .v2-shop__body, .v2-pdp-root > .pdp, .v2-pdp-root > .pdp-flow, .pdp-recommendations';

// Small, bounded CSS scenes: no images, canvas, dependencies or scroll state in
// React. Only visible sections run, with one batched update per scroll frame.
export function mountScrollBackground(root, context = {}) {
  if (!window.matchMedia || !window.IntersectionObserver) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Static scenes are built and themed exactly as animated ones, but nothing
  // ever writes to them after that: no scroll listener, no rAF, no
  // IntersectionObserver, and .sl-bg--moving is never applied so the CSS
  // keyframes stay paused. The layer is painted once and then only composited.
  const staticScenes = !!context.staticScenes;
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
    if (staticScenes || reduced.matches || document.hidden) return;
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
      // Nothing observes a static scene: it has no visible/hidden behaviour to
      // drive, and an observer callback per section per scroll is exactly the
      // main-thread work this mode exists to remove.
      if (!staticScenes) observer.observe(host);
    }
  }

  function preference() {
    if (reduced.matches || document.hidden) stop();
    else wake();
  }
  discover();
  // Sections still arrive asynchronously in both modes, so this stays.
  const mutation = new MutationObserver(discover);
  mutation.observe(root, { childList: true, subtree: true });
  if (!staticScenes) {
    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', wake, { passive: true });
    document.addEventListener('visibilitychange', preference);
    reduced.addEventListener('change', preference);
  }
  return () => {
    stop();
    observer.disconnect();
    mutation.disconnect();
    if (!staticScenes) {
      window.removeEventListener('scroll', wake);
      window.removeEventListener('resize', wake);
      document.removeEventListener('visibilitychange', preference);
      reduced.removeEventListener('change', preference);
    }
    for (const [host, scene] of scenes) {
      host.classList.remove('sl-bg-host');
      scene.remove();
    }
    scenes.clear();
    visible.clear();
  };
}
