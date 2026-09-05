import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import { getHomepageSnapshot, subscribeHomepage } from '../../lib/settings.js';
import {
  categoryConfig, resolveSpotlightItems, spotlightVisible, visibleWindow, wrapIndex,
} from '../../lib/categoryExperience.js';

// ============================================================
// CATEGORY SPOTLIGHT
//
// A three-slot stage at the top of a category page: the previous product
// small and set back on the left, the active product large and centred, the
// next product small on the right. Advancing slides them one seat along.
//
// GEOMETRY LIVES IN CSS. Every position, scale, offset, opacity, duration and
// easing value is a custom property in styles/category-spotlight.css under
// .cspot. This file decides WHICH product sits in which seat; the stylesheet
// decides where the seats are. Art direction should not require touching JSX.
//
// ONLY THREE SLIDES EXIST. A hundred-product category mounts three nodes.
// See visibleWindow() — that is the entire virtualization strategy.
//
// Movement is transform + opacity only, so every transition stays on the
// compositor: no layout properties, no filters, no JS animation loop.
// ============================================================

const RESUME_AFTER_INTERACTION_MS = 9000;
// Above this many products the pip strip stops being readable AND stops
// fitting: 43 pips measured 812px inside a 358px row, which shoved both
// arrows off a 390px screen. Deeper pools get a plain position readout
// instead. This governs the INDICATOR only — the pool itself is uncapped.
const MAX_PIPS = 12;
const SWIPE_THRESHOLD_PX = 44;

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  ));
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

/**
 * True only while the stage is meaningfully on screen. Auto-rotation off
 * screen is wasted work and a wasted product impression, so it stops.
 */
function useOnScreen(ref, threshold = 0.45) {
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver !== 'function') { setOnScreen(true); return undefined; }
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting && entry.intersectionRatio >= threshold),
      { threshold: [0, threshold, 1] },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [ref, threshold]);
  return onScreen;
}

/** Document visibility, so a backgrounded tab does not rotate. */
function usePageVisible() {
  const [visible, setVisible] = useState(() => (typeof document === 'undefined' || !document.hidden));
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

/**
 * @param configOverride  Admin preview only. Supplies the configuration being
 *   edited instead of the saved settings, so the owner can look at a category
 *   before publishing it.
 * @param preview  Admin preview only. Renders the stage even when the category
 *   is not enabled. It NEVER changes what the storefront shows — the storefront
 *   passes neither prop, so it always goes through spotlightVisible().
 */
export default function CategorySpotlight({ category, products, configOverride = null, preview = false }) {
  const slug = category?.slug;
  // Read through the settings store so an admin save lands without a reload,
  // exactly as the homepage discovery rails do.
  const savedHomepage = useSyncExternalStore(subscribeHomepage, getHomepageSnapshot, getHomepageSnapshot);

  const config = useMemo(
    () => configOverride || categoryConfig(slug, savedHomepage),
    [slug, savedHomepage, configOverride],
  );
  const items = useMemo(
    () => resolveSpotlightItems(slug, { config, productList: products }),
    [slug, config, products],
  );

  const [index, setIndex] = useState(0);
  // Which way the last change went, so CSS can send the outgoing slide out of
  // the side it actually left towards rather than always the same way.
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const stageRef = useRef(null);
  const resumeTimer = useRef(null);

  const reducedMotion = useReducedMotion();
  const onScreen = useOnScreen(stageRef);
  const pageVisible = usePageVisible();

  const count = items.length;

  // A category whose catalogue shrank under us must not point past the end.
  useEffect(() => { setIndex((i) => wrapIndex(i, Math.max(count, 1))); }, [count]);

  const holdAutoRotate = useCallback(() => {
    setPaused(true);
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), RESUME_AFTER_INTERACTION_MS);
  }, []);

  const go = useCallback((delta, { user = true } = {}) => {
    if (count < 2) return;
    setDir(delta >= 0 ? 1 : -1);
    setIndex((i) => wrapIndex(i + delta, count));
    if (user) holdAutoRotate();
  }, [count, holdAutoRotate]);

  const goTo = useCallback((target) => {
    if (count < 2) return;
    setIndex((current) => {
      if (target === current) return current;
      // Shortest way round, so tapping the left product always moves left.
      const forward = wrapIndex(target - current, count);
      setDir(forward <= count / 2 ? 1 : -1);
      return wrapIndex(target, count);
    });
    holdAutoRotate();
  }, [count, holdAutoRotate]);

  useEffect(() => () => clearTimeout(resumeTimer.current), []);

  // Auto-rotate. Every condition that should stop it is in the guard, so
  // there is one timer and no polling.
  useEffect(() => {
    if (!config.autoRotate || paused || reducedMotion) return undefined;
    if (!onScreen || !pageVisible || count < 2) return undefined;
    const t = setInterval(() => {
      setDir(1);
      setIndex((i) => wrapIndex(i + 1, count));
    }, config.intervalMs);
    return () => clearInterval(t);
  }, [config.autoRotate, config.intervalMs, paused, reducedMotion, onScreen, pageVisible, count]);

  // Pointer swipe. Tracked on the stage so a horizontal drag anywhere across
  // it works, and so a vertical scroll is never hijacked.
  const drag = useRef(null);
  const onPointerDown = (e) => { drag.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e) => {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;
    go(dx < 0 ? 1 : -1);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  };

  const win = visibleWindow(items, index);
  const active = win.active?.slide || null;

  // The storefront gate. A category that the owner has not switched on shows
  // nothing at all, whatever products it happens to contain. Preview bypasses
  // only this check — everything above it is the same code path.
  if (preview ? items.length === 0 : !spotlightVisible(slug, items, config)) return null;

  const seats = [win.prev, win.active, win.next].filter(Boolean);

  return (
    <section
      className={`cspot${reducedMotion ? ' cspot--still' : ''}${active.framed ? ' cspot--framed' : ''}`}
      // The active item's theme drives the whole stage. Both are already
      // validated by categoryExperience.js before reaching this attribute.
      style={{
        '--cspot-bg': active.theme.background,
        '--cspot-grad': active.theme.gradient || 'none',
      }}
      aria-roledescription="carousel"
      aria-label={`${category.name} spotlight`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { clearTimeout(resumeTimer.current); setPaused(false); }}
    >
      <div className="cspot__bg" aria-hidden="true" />

      <div className="cspot__inner">
        <p className="cspot__eyebrow">{category.name}</p>

        {/* One live region for the whole stage: assistive tech hears the
            product change once, not three times as the seats reshuffle. */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {active.name}, item {win.active.index + 1} of {count}
        </div>

        <div
          className="cspot__stage"
          ref={stageRef}
          data-dir={dir > 0 ? 'fwd' : 'back'}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { drag.current = null; }}
          onKeyDown={onKeyDown}
          tabIndex={count > 1 ? 0 : -1}
          role={count > 1 ? 'group' : undefined}
          aria-label={count > 1 ? `${category.name} products — use arrow keys to browse` : undefined}
        >
          {seats.map((seat) => {
            const isActive = seat.role === 'active';
            const s = seat.slide;
            return (
              <div
                key={s.id}
                className={`cspot__seat cspot__seat--${seat.role}`}
                data-role={seat.role}
                // Custom properties, not a transform. The seat's own transform
                // is the reshuffle animation; these are read further down by
                // .cspot__img, so the owner's framing nudge and the animation
                // live on two different elements and cannot fight.
                style={{
                  '--cspot-item-scale': s.visualScale,
                  '--cspot-item-y': `${s.verticalOffset}px`,
                }}
                // A side product is decoration until it is chosen. It stays
                // out of the tab order so the stage is not a keyboard trap;
                // the arrow keys and the prev/next buttons reach it instead.
                aria-hidden={!isActive}
              >
                {isActive ? (
                  <Link to={`/product/${s.productSlug}`} className="cspot__shot cspot__shot--link" draggable="false">
                    <SpotlightImage slide={s} eager />
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="cspot__shot"
                    tabIndex={-1}
                    onClick={() => goTo(seat.index)}
                    aria-label={`Show ${s.name}`}
                  >
                    <SpotlightImage slide={s} />
                  </button>
                )}
                {!isActive && <span className="cspot__sidename">{s.name}</span>}
              </div>
            );
          })}
        </div>

        {/* Keyed on the product so the copy re-enters with the new item
            rather than mutating in place mid-transition. */}
        <div className="cspot__meta" key={active.id}>
          {active.headline && <p className="cspot__headline">{active.headline}</p>}
          <h2 className="cspot__name">{active.name}</h2>
          <p className="cspot__facts">
            {active.form && <span className="cspot__form">{active.form}</span>}
            {active.rating != null && (
              <span className="cspot__rating">
                <Icon name="star" size={13} /> {active.rating.toFixed(1)}
                {active.reviewCount > 0 && (
                  <span className="cspot__reviews"> ({active.reviewCount})</span>
                )}
              </span>
            )}
          </p>
          {active.subline && <p className="cspot__subline">{active.subline}</p>}
          <Link to={`/product/${active.productSlug}`} className="cspot__cta">
            View product <Icon name="arrowRight" size={16} />
          </Link>
        </div>

        {count > 1 && (
          <div className="cspot__nav">
            <button type="button" className="cspot__arrow" onClick={() => go(-1)} aria-label="Previous product">
              <Icon name="chevronLeft" size={18} />
            </button>
            {count <= MAX_PIPS ? (
              <span className="cspot__pips" aria-hidden="true">
                {items.map((s, i) => (
                  <span key={s.id} className={`cspot__pip${i === win.active.index ? ' is-on' : ''}`} />
                ))}
              </span>
            ) : (
              <span className="cspot__position" aria-hidden="true">
                {win.active.index + 1} / {count}
              </span>
            )}
            <button type="button" className="cspot__arrow" onClick={() => go(1)} aria-label="Next product">
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
        )}
      </div>

      {/* No <link rel="preload"> here on purpose. It was tried and removed:
          the NEXT product is already a real <img> in the stage, so its image
          is fetched anyway, and preloading the one after that fires ~10s
          before it is needed — well past the browser's few-second window — so
          every rotation logged "preloaded but not used", 40+ warnings deep.
          Console noise that would mask a real error is a worse trade than one
          speculative fetch. */}
    </section>
  );
}

/**
 * A cutout floats on the stage; anything else sits in a contained panel
 * rather than pretending its white box is transparent.
 */
function SpotlightImage({ slide, eager = false }) {
  if (!slide.image) {
    return <span className="cspot__img cspot__img--empty" aria-hidden="true" />;
  }
  return (
    <img
      className={`cspot__img${slide.framed ? ' cspot__img--framed' : ''}`}
      src={slide.image}
      alt={slide.name}
      draggable="false"
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchpriority={eager ? 'high' : undefined}
    />
  );
}
