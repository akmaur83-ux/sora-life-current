import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { heroSlides } from '../lib/settings.js';

const BENEFITS = [
  { icon: 'award', a: 'Himalayan', b: 'Superfood' },
  { icon: 'leaf', a: 'Rich in 190+', b: 'Nutrients' },
  { icon: 'shield', a: 'Boosts Immunity', b: '& Wellness' },
];

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
      className="bh-hero bh-hero--carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Sora Life featured"
    >
      {SLIDES.map((s, i) => (
        <div
          key={s.id}
          className={`bh-slide ${i === active ? 'is-active' : ''}`}
          aria-hidden={i !== active}
        >
          <div className="bh-hero__parallax" ref={(el) => { parallaxRefs.current[i] = el; }}>
            {s.kind === 'video' && useVideo && !videoFailed[s.id] && s.src ? (
              <video
                className="bh-hero__media"
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
              <img className="bh-hero__media" src={heroSrc(stillFor(s) || FALLBACK_POSTER, 1600)}
                srcSet={heroSrcSet(stillFor(s) || FALLBACK_POSTER)} sizes="100vw"
                alt={s.title} style={{ objectPosition: s.position }}
                loading={i === active ? 'eager' : 'lazy'}
                fetchpriority={i === active ? 'high' : undefined} decoding="async" />
            ) : (
              <img className="bh-hero__media" src={heroSrc(s.src, 1600)}
                srcSet={heroSrcSet(s.src)} sizes="100vw"
                alt={s.title} style={{ objectPosition: s.position }}
                loading={i === active ? 'eager' : 'lazy'}
                fetchpriority={i === active ? 'high' : undefined} decoding="async" />
            )}
          </div>
          <div className="bh-hero__scrim" />
          <div className="container bh-hero__inner">
            <div className="bh-hero__copy">
              <p className="bh-hero__kicker">{s.kicker}</p>
              <h1 className="bh-hero__title">{s.title}</h1>
              <p className="bh-hero__sub">{s.sub}</p>
              <p className="bh-hero__lede">{s.lede}</p>
              <Link to={s.cta.to} className="btn btn-lg bh-hero__cta">{s.cta.label} <Icon name="arrowRight" size={18} /></Link>
              <div className="bh-hero__benefits">
                {BENEFITS.map((b, bi) => (
                  <div key={b.b} className="bh-hero__benefit">
                    <Icon name={b.icon} size={22} />
                    <span>{b.a}<br />{b.b}</span>
                    {bi < BENEFITS.length - 1 && <i className="bh-hero__bdiv" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Arrows */}
      <button className="bh-hero__arrow bh-hero__arrow--prev" onClick={() => go(active - 1)} aria-label="Previous slide"><Icon name="chevronLeft" size={22} /></button>
      <button className="bh-hero__arrow bh-hero__arrow--next" onClick={() => go(active + 1)} aria-label="Next slide"><Icon name="chevronRight" size={22} /></button>

      {/* Dots */}
      <div className="bh-hero__dots">
        {SLIDES.map((s, i) => (
          <button key={s.id} className={i === active ? 'active' : ''} onClick={() => go(i)}
            aria-label={`Go to slide ${i + 1}`} aria-current={i === active} />
        ))}
      </div>
    </section>
  );
}
