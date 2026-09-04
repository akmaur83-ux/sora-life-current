import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import ProductImage from './ProductImage.jsx';
import HeroCta from './HeroCta.jsx';
import { heroSlides, heroSlidesConfigured, homepage } from '../lib/settings.js';
import { products } from '../data/products.js';
import { categories } from '../data/categories.js';
import { selectMarketplaceHeroProducts } from '../lib/homeMerchandising.js';

// ---------------------------------------------------------------------------
// V2 HOMEPAGE HERO
//
// Admin-managed slides are rendered exactly as configured. If none have
// hydrated, the fallback is a real-catalogue marketplace composition rather
// than a hardcoded product or brand takeover.
// ---------------------------------------------------------------------------
const MARKETPLACE_HERO_COPY = {
  kicker: 'SORA LIFE MARKETPLACE',
  title: 'Discover what fits your life.',
  cta: { label: 'Explore marketplace', to: '/shop' },
};

// Only mobile typography responds to length; configured copy stays intact.
const titleClass = (title) => `v2-hero__title${String(title || '').trim().length > 22 ? ' v2-hero__title--long' : ''}`;

function fallbackCategoryCount(productList) {
  const validSlugs = new Set((categories || []).filter((category) => category?.slug).map((category) => category.slug));
  const slugs = new Set();
  for (const product of productList) {
    for (const slug of product.categories || [product.category]) {
      if (validSlugs.has(slug)) slugs.add(slug);
    }
  }
  return slugs.size;
}

// V2 note: the previous hardcoded BENEFITS strip ("Rich in 190+ Nutrients",
// "Boosts Immunity & Wellness") was authored marketing copy baked into this
// component, not data the storefront can substantiate. V2 does not render
// product claims that are not bound to verified data, so it has been removed
// rather than restyled.

const INTERVAL = 6000;

// Brand hero still (Himalayan sea buckthorn). Last-resort visual so a slide
// can never render as an empty colour block — see posterFor() below.
const FALLBACK_POSTER = '/media/hero-poster.jpg';

// Admin-uploaded hero art lives in Supabase Storage and is served at full size
// (the current slides are a 1.8 MB PNG and a 1.6 MB JPEG). Supabase can render
// resized, format-negotiated variants from the same object, so we ask for a
// width-appropriate rendition instead of the original. Non-Supabase paths
// (our local /media stills) are returned untouched.
const SB_OBJECT = '/storage/v1/object/public/';
const SB_RENDER = '/storage/v1/render/image/public/';
const HERO_WIDTHS = [640, 1024, 1600, 1920];

function isSupabaseObject(src) {
  return typeof src === 'string' && src.includes(SB_OBJECT) && /supabase\.co/.test(src);
}
function heroSrc(src, width) {
  if (!isSupabaseObject(src)) return src;
  return `${src.replace(SB_OBJECT, SB_RENDER)}?width=${width}&quality=72`;
}
// Locally-shipped hero stills that have pre-built WebP renditions alongside
// them (see media/hero-poster-<w>.webp). Keyed by the original path.
// 640w is deliberately absent: the hero is full-bleed, so on a DPR-2 phone
// (390 CSS px -> ~780 device px) the browser would pick 640w, then upgrade to
// 1024w and pay for both. Starting at 1024w costs one request, 60 KB, and is
// still smaller than the 82 KB JPEG it replaces.
const LOCAL_HERO_VARIANTS = {
  '/media/hero-poster.jpg': [1024, 1600],
};

function heroSrcSet(src) {
  const local = LOCAL_HERO_VARIANTS[src];
  if (local) {
    const base = src.replace(/\.[a-z]+$/i, '');
    return local.map((w) => `${base}-${w}.webp ${w}w`).join(', ');
  }
  if (!isSupabaseObject(src)) return undefined;
  return HERO_WIDTHS.map((w) => `${heroSrc(src, w)} ${w}w`).join(', ');
}

// The still we can show for a slide, if any. A video slide whose poster is
// missing used to fall through to a bare coloured <div> — that is how the
// duplicate "Mom's Trust" slide (poster_url null, video_url returns 400)
// rendered as a large empty block on every device.
function stillFor(slide) {
  // Image slides carry their URL in `src` (adminApi maps image_url -> src);
  // video slides carry a separate poster. Check the right field for each, or
  // an image slide gets treated as having no still and is wrongly dropped.
  if (slide.kind === 'image') return slide.src || slide.poster || null;
  return slide.poster || slide.image || null;
}

// A slide is only worth rendering if it can actually show something: either a
// video we are going to play, or a still. Anything else would paint an empty
// block, so it is dropped from the carousel rather than shown broken.
function isRenderable(slide, canUseVideo, failed) {
  if (slide.kind === 'video' && canUseVideo && slide.src && !failed[slide.id]) return true;
  return Boolean(stillFor(slide));
}

export default function Hero() {
  if (!heroSlidesConfigured) return <MarketplaceHero />;
  return <ConfiguredHero />;
}

// ----------------------------------------------------------- marketplace fall
function MarketplaceHero() {
  const heroProducts = selectMarketplaceHeroProducts(products, 5);
  if (!heroProducts.length) return null;
  const categoryCount = fallbackCategoryCount(heroProducts);
  const supportingCopy = categoryCount > 1
    ? `Explore products across ${categoryCount} catalogue categories, all in one place.`
    : 'Explore the active catalogue, all in one place.';

  return (
    <section className="v2-hero v2-hero--marketplace" aria-labelledby="marketplace-hero-title">
      <div className="v2-hero__stage hm-hero">
        <div className="hm-hero__copy">
          <p className="hm-hero__kicker">{MARKETPLACE_HERO_COPY.kicker}</p>
          <h1 id="marketplace-hero-title">{MARKETPLACE_HERO_COPY.title}</h1>
          <p>{supportingCopy}</p>
          <Link to={MARKETPLACE_HERO_COPY.cta.to} className="hm-hero__cta">
            {MARKETPLACE_HERO_COPY.cta.label} <Icon name="arrowRight" size={16} stroke={1.8} />
          </Link>
        </div>
        <div className="hm-hero__assortment" aria-label="Products from across the marketplace">
          {heroProducts.map((product, index) => (
            <Link key={product.id} to={`/product/${product.slug}`} className={`hm-hero__product hm-hero__product--${index + 1}`} aria-label={product.name}>
              <ProductImage product={product} frame="v2" sizes="(max-width: 767px) 24vw, 220px" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------- admin-configured slides
function ConfiguredHero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [videoFailed, setVideoFailed] = useState({}); // { [slideId]: true } — fall back to poster on load error
  const timer = useRef(null);
  const sectionRef = useRef(null);
  const parallaxRefs = useRef([]);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // The hero video is a ~6 MB MP4 — fine on desktop broadband, but it was
  // the single largest cost on mobile (it dominated the phone payload for a
  // decorative background). Phones, data-saver users and reduced-motion users
  // get the poster still instead, which is already authored for every video
  // slide and is ~70x smaller. Desktop behaviour is unchanged.
  const [useVideo, setUseVideo] = useState(() => typeof window !== 'undefined'
    && window.matchMedia?.('(min-width: 768px)').matches
    && !reduced
    && navigator.connection?.saveData !== true);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const saveData = navigator.connection?.saveData === true;
    const evaluate = () => setUseVideo(mq.matches && !reduced && !saveData);
    evaluate();
    if (mq.addEventListener) mq.addEventListener('change', evaluate);
    else mq.addListener?.(evaluate);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', evaluate);
      else mq.removeListener?.(evaluate);
    };
  }, [reduced]);

  // Only carry slides that can actually paint something. If a deck were ever
  // configured with nothing renderable at all, keep the original list so the
  // hero still has structure rather than collapsing to nothing.
  const renderable = heroSlides.filter((s) => isRenderable(s, useVideo, videoFailed));
  const SLIDES = renderable.length ? renderable : heroSlides;
  const DISPLAY_SLIDES = SLIDES;
  const [preparedSlides, setPreparedSlides] = useState(() => new Set(SLIDES[0]?.id ? [SLIDES[0].id] : []));
  const loadedSlides = useRef(new Set());

  const prepareSlide = useCallback((index) => {
    if (!SLIDES.length) return;
    const target = (index + SLIDES.length) % SLIDES.length;
    const id = SLIDES[target]?.id;
    if (!id) return;
    setPreparedSlides((current) => {
      if (current.has(id)) return current;
      const nextSet = new Set(current);
      nextSet.add(id);
      return nextSet;
    });
  }, [SLIDES]);

  // A dropped slide shortens the deck; keep the index inside it.
  useEffect(() => {
    if (active >= SLIDES.length) setActive(0);
    else {
      prepareSlide(active);
      // A slide normally loads while hidden as the prepared neighbour. Its
      // load event has already fired by the time it becomes active, so prepare
      // the following slide here rather than leaving the next transition cold.
      const id = SLIDES[active]?.id;
      if (id && loadedSlides.current.has(id)) prepareSlide(active + 1);
    }
  }, [SLIDES.length, active, prepareSlide]);

  const go = useCallback((i) => {
    const target = (i + SLIDES.length) % SLIDES.length;
    prepareSlide(target);
    setActive(target);
  }, [SLIDES.length, prepareSlide]);
  const next = useCallback(() => go(active + 1), [active, go]);
  const mediaReady = useCallback((id, index) => {
    loadedSlides.current.add(id);
    if (index === active) prepareSlide(index + 1);
  }, [active, prepareSlide]);

  useEffect(() => {
    if (paused || reduced || SLIDES.length < 2) return;
    timer.current = setTimeout(next, INTERVAL);
    return () => clearTimeout(timer.current);
  }, [active, paused, reduced, next, SLIDES.length]);

  // Very slow, depth-only scroll parallax on the background media — never on
  // the text. Disabled entirely for reduced-motion and on narrow/mobile
  // viewports (per the "reduce parallax on mobile" requirement). Applied via
  // a rAF-throttled scroll listener to a wrapper element that sits outside
  // the Ken-Burns-scaled media, so the two transforms never fight.
  useEffect(() => {
    if (reduced) return;
    const isMobile = () => window.innerWidth < 768;
    if (isMobile()) return;
    let raf = null;
    const onScroll = () => {
      // Below 768px the media sits in normal flow (see the mobile hero block in
      // home.css), so an inline translate would shift it out of place. Clear it
      // and bail if the viewport was resized down after mount.
      if (isMobile()) { parallaxRefs.current.forEach((n) => { if (n) n.style.transform = ''; }); return; }
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const el = sectionRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return; // out of view, skip
        const offset = Math.max(-40, Math.min(40, rect.top * -0.06));
        parallaxRefs.current.forEach((node) => {
          if (node) node.style.transform = `translate3d(0, ${offset}px, 0)`;
        });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      className="v2-hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Sora Life featured"
    >
      {DISPLAY_SLIDES.map((s, i) => (
        (() => {
          const appearance = homepage.heroCtas?.[s.id];
          const artworkOnly = ![s.kicker, s.title, s.sub, s.lede].some((value) => value && /[A-Za-z0-9]/.test(value));
          const ctaLabel = s.cta?.label;
          const mediaPrepared = i === active || preparedSlides.has(s.id);
          const activeVideo = i === active && s.kind === 'video' && useVideo && !videoFailed[s.id] && s.src;
          return (
        <div
          key={s.id}
          className={`v2-hero__slide ${i === active ? 'is-active' : ''}`}
          aria-hidden={i !== active}
        >
          <div className="v2-hero__media">
            {/* Parallax wrapper is inset inside the frame so its transform can
                never push the artwork past the frame's own edge. */}
            <div className="v2-hero__par" ref={(el) => { parallaxRefs.current[i] = el; }}>
              {mediaPrepared && (activeVideo ? (
                <video
                  className="v2-hero__img"
                  autoPlay muted loop playsInline preload="metadata"
                  poster={s.poster}
                  style={{ objectPosition: s.position }}
                  onError={() => setVideoFailed((v) => ({ ...v, [s.id]: true }))}
                  onLoadedData={() => mediaReady(s.id, i)}
                >
                  <source src={s.src} type="video/mp4" />
                </video>
              ) : s.kind === 'video' ? (
                // Video skipped on mobile, missing, or failed to load — always resolve
                // to a real still (never an empty colour block).
                <img className="v2-hero__img" src={heroSrc(stillFor(s) || FALLBACK_POSTER, 1600)}
                  srcSet={heroSrcSet(stillFor(s) || FALLBACK_POSTER)} sizes="100vw"
                  alt={s.title} style={{ objectPosition: s.position }}
                  loading={i === active ? 'eager' : 'lazy'}
                  fetchPriority={i === active ? 'high' : undefined} decoding="async"
                  onLoad={() => mediaReady(s.id, i)} />
              ) : (
                <img className="v2-hero__img" src={heroSrc(s.src, 1600)}
                  srcSet={heroSrcSet(s.src)} sizes="100vw"
                  alt={s.title} style={{ objectPosition: s.position }}
                  loading={i === active ? 'eager' : 'lazy'}
                  fetchPriority={i === active ? 'high' : undefined} decoding="async"
                  onLoad={() => mediaReady(s.id, i)} />
              ))}
            </div>
          </div>

          {/* Copy is live DOM directly over the artwork, never baked in. */}
          <div className="v2-hero__ui">
            {s.kicker && <p className="v2-hero__kicker">{s.kicker}</p>}
            <h1 className={titleClass(s.title)}>{s.title}</h1>
            {(s.sub || s.lede) && <p className="v2-hero__sub">{s.sub || s.lede}</p>}
            {s.cta?.to && (
              <HeroCta cta={s.cta} appearance={appearance} artworkOnly={artworkOnly} active={i === active}>{ctaLabel}</HeroCta>
            )}
          </div>
          <HeroCta cta={s.cta} appearance={appearance} placement="overlay" artworkOnly={artworkOnly} active={i === active}>{ctaLabel}</HeroCta>
        </div>
          );
        })()
      ))}

      {SLIDES.length > 1 && (
        <>
          <button className="v2-hero__arrow v2-hero__arrow--prev" onClick={() => go(active - 1)} aria-label="Previous slide"><Icon name="chevronLeft" size={18} stroke={1.6} /></button>
          <button className="v2-hero__arrow v2-hero__arrow--next" onClick={() => go(active + 1)} aria-label="Next slide"><Icon name="chevronRight" size={18} stroke={1.6} /></button>

          <div className="v2-hero__dots">
            {DISPLAY_SLIDES.map((s, i) => (
              <button key={s.id} className={i === active ? 'is-on' : ''} onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`} aria-current={i === active} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
