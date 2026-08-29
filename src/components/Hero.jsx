import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import ProductImage from './ProductImage.jsx';
import { heroSlides, heroSlidesConfigured } from '../lib/settings.js';
import { productBySlug, products } from '../data/products.js';
import { categoryBySlug } from '../data/categories.js';

// ---------------------------------------------------------------------------
// V2 PRODUCT-LED HERO
//
// The approved V2 direction is product-led: a real product, dominant, grounded
// on a stone plinth in a warm ivory environment, with the copy held clear on
// the left. The environment (ground, plinth, botanical depth, contact shadow)
// is drawn in CSS; the product is the REAL catalogue image, unmodified — no
// packaging is redrawn, no label altered, no text baked into artwork.
//
// Copy safety: the built-in DEFAULT_HERO_SLIDES in settings.js carry
// unverified provenance and product claims ("Harvested from the Himalayas",
// "Sun-ripened … gently cold-pressed", "Nutrient-dense wellness"). Those are
// hardcoded marketing defaults, not approved configured content, so V2 does
// not render them. In product-led mode every string comes from the product
// record itself: category name, product name, pack size. Nothing else.
//
// When an admin HAS configured hero_slides (heroSlidesConfigured === true),
// that copy is approved content and the original slide rendering is used.
// ---------------------------------------------------------------------------
const HERO_PRODUCT_SLUG = 'biosash-sea-buckthorn-juice';

function resolveHeroProduct() {
  const exact = productBySlug?.[HERO_PRODUCT_SLUG];
  if (exact?.image) return exact;
  // Defensive: if the catalogue is swapped by applyCatalog() and that slug is
  // gone, fall back to the first in-stock product that has a real image.
  return (products || []).find((p) => p?.image && p.stock !== 0) || null;
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
  // Product-led hero is the V2 default. Admin-configured slides opt back into
  // the original slide rendering because that copy is approved content.
  if (!heroSlidesConfigured) return <ProductHero />;
  return <ConfiguredHero />;
}

// ---------------------------------------------------------------- product-led
function ProductHero() {
  const product = resolveHeroProduct();
  if (!product) return null;

  const cat = categoryBySlug[product.category];

  return (
    <section className="v2-hero v2-hero--product" aria-label="Featured product">
      <div className="v2-hero__stage">
        {/* Editorial environment — CSS only. Warm ivory ground, travertine
            plinth, restrained botanical depth. No fabricated photography. */}
        <span className="v2-hero__ground" aria-hidden="true" />
        <span className="v2-hero__leaf v2-hero__leaf--a" aria-hidden="true" />
        <span className="v2-hero__leaf v2-hero__leaf--b" aria-hidden="true" />
        <span className="v2-hero__plinth" aria-hidden="true" />
        <span className="v2-hero__contact" aria-hidden="true" />

        {/* Real product image, unmodified. mix-blend-mode:multiply drops the
            asset's white studio background into the cream ground without
            editing the file or touching the packaging. */}
        <div className="v2-hero__productwrap">
          <ProductImage
            product={product}
            frame="hero"
            sizes="(max-width: 767px) 62vw, 46vw"
            alt={product.name}
          />
        </div>

        {/* Copy is live DOM, held in the left zone, never baked into artwork. */}
        <div className="v2-hero__ui">
          {cat?.name && <p className="v2-hero__kicker">{cat.name}</p>}
          <h1 className="v2-hero__title">{product.name}</h1>
          {product.form && <p className="v2-hero__meta">{product.form}</p>}
          <div>
            <Link to={`/product/${product.slug}`} className="v2-btn v2-btn--sm">
              View product
            </Link>
          </div>
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
  const [useVideo, setUseVideo] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const saveData = navigator.connection?.saveData === true;
    const evaluate = () => setUseVideo(mq.matches && !reduced && !saveData);
    evaluate();
    mq.addEventListener?.('change', evaluate);
    return () => mq.removeEventListener?.('change', evaluate);
  }, [reduced]);

  // Only carry slides that can actually paint something. If a deck were ever
  // configured with nothing renderable at all, keep the original list so the
  // hero still has structure rather than collapsing to nothing.
  const renderable = heroSlides.filter((s) => isRenderable(s, useVideo, videoFailed));
  const SLIDES = renderable.length ? renderable : heroSlides;

  // A dropped slide shortens the deck; keep the index inside it.
  useEffect(() => {
    if (active >= SLIDES.length) setActive(0);
  }, [SLIDES.length, active]);

  const go = useCallback((i) => setActive((i + SLIDES.length) % SLIDES.length), [SLIDES.length]);
  const next = useCallback(() => setActive((a) => (a + 1) % SLIDES.length), [SLIDES.length]);

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
      {SLIDES.map((s, i) => (
        <div
          key={s.id}
          className={`v2-hero__slide ${i === active ? 'is-active' : ''}`}
          aria-hidden={i !== active}
        >
          <div className="v2-hero__media">
            {/* Parallax wrapper is inset inside the frame so its transform can
                never push the artwork past the frame's own edge. */}
            <div className="v2-hero__par" ref={(el) => { parallaxRefs.current[i] = el; }}>
              {s.kind === 'video' && useVideo && !videoFailed[s.id] && s.src ? (
                <video
                  className="v2-hero__img"
                  autoPlay muted loop playsInline preload="metadata"
                  poster={s.poster}
                  style={{ objectPosition: s.position }}
                  onError={() => setVideoFailed((v) => ({ ...v, [s.id]: true }))}
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
                  fetchpriority={i === active ? 'high' : undefined} decoding="async" />
              ) : (
                <img className="v2-hero__img" src={heroSrc(s.src, 1600)}
                  srcSet={heroSrcSet(s.src)} sizes="100vw"
                  alt={s.title} style={{ objectPosition: s.position }}
                  loading={i === active ? 'eager' : 'lazy'}
                  fetchpriority={i === active ? 'high' : undefined} decoding="async" />
              )}
            </div>
          </div>

          {/* Copy is live DOM over a scrim, never baked into the artwork, so a
              swapped image can never break the headline. */}
          <span className="v2-hero__scrim" aria-hidden="true" />
          <div className="v2-hero__ui">
            {s.kicker && <p className="v2-hero__kicker">{s.kicker}</p>}
            <h1 className="v2-hero__title">{s.title}</h1>
            {(s.sub || s.lede) && <p className="v2-hero__sub">{s.sub || s.lede}</p>}
            {s.cta?.to && (
              <div>
                <Link to={s.cta.to} className="v2-btn v2-btn--sm">{s.cta.label}</Link>
              </div>
            )}
          </div>
        </div>
      ))}

      {SLIDES.length > 1 && (
        <>
          <button className="v2-hero__arrow v2-hero__arrow--prev" onClick={() => go(active - 1)} aria-label="Previous slide"><Icon name="chevronLeft" size={18} stroke={1.6} /></button>
          <button className="v2-hero__arrow v2-hero__arrow--next" onClick={() => go(active + 1)} aria-label="Next slide"><Icon name="chevronRight" size={18} stroke={1.6} /></button>

          <div className="v2-hero__dots">
            {SLIDES.map((s, i) => (
              <button key={s.id} className={i === active ? 'is-on' : ''} onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`} aria-current={i === active} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
