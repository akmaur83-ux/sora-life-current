import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import DeferredImage from './DeferredImage.jsx';

// ============================================================
// The homepage doorways to the other stores. No catalogue dependency.
// Two sections, placed independently by Home.jsx.
//
// LifestyleBanner — one whole-card link over one photograph: a 16:9
// landscape whose subject sits right (the copy takes the left) from
// 1024px, a 4:5 portrait whose subject sits low (the copy takes the empty
// upper-left) below it; the browser chooses through <picture>. Its four
// icon badges sit over the photo beneath the CTA on a wide screen and
// beneath the photo on a phone, where the empty area holds the copy alone.
//
// StoreCarousel — under its own heading, the two store cards, Fashion and
// Home & Living, as one carousel: one slide at a time on a transform-only
// track, autoplaying, paused on hover and focus, still under
// prefers-reduced-motion, with dots and a swipe.
//
// Every word is HTML; images stay deferred until they scroll near.
// ============================================================
const TALL = '(max-width: 1023px)';
export const AUTOPLAY_MS = 6000;

export const LIFESTYLE = {
  key: 'lifestyle',
  to: '/lifestyle',
  eyebrow: 'Live beautifully',
  heading: ['Lifestyle', 'Store'],
  description: 'Fashion, home, living and everyday essentials — all in one place.',
  cta: 'Explore Lifestyle',
  wide: '/img/lifestyle-banner-wide.webp',
  tall: '/img/lifestyle-banner-tall.webp',
  alt: 'Camel coat and cream turtleneck, seated beside a cream sofa with green cushions, a wooden coffee table and an olive tree',
  detailsLabel: 'What the lifestyle store brings together',
  details: [['bag', 'Fashion & Accessories'], ['home', 'Home & Living'], ['sparkle', 'Beauty & Wellness'], ['grid', 'Everyday Essentials']],
};

export const STORES = [
  {
    key: 'fashion',
    to: '/fashion',
    eyebrow: 'Discover your style',
    heading: ['Fashion', 'Store'],
    description: 'Clothing, footwear, bags, beauty and accessories — all in one place.',
    cta: 'Explore Fashion',
    wide: '/img/doorway-fashion-wide.webp',
    tall: '/img/doorway-fashion-tall.webp',
    alt: 'Camel coat and cream turtleneck, seated against a sunlit plaster wall',
    detailsLabel: 'Explore fashion',
    details: [['bag', 'Clothing & more'], ['sparkle', 'Everyday style'], ['search', 'Easy shopping']],
  },
  {
    key: 'living',
    to: '/homeliving',
    eyebrow: 'Make space for a better you',
    heading: ['Home & Living', 'Store'],
    description: 'Home textiles, soft furnishings and everyday essentials for your space.',
    cta: 'Explore Living',
    wide: '/img/doorway-living-wide.webp',
    tall: '/img/doorway-living-tall.webp',
    alt: 'Cream sofa with green cushions and a throw, a wooden coffee table and a jute rug in soft light',
    detailsLabel: 'Explore home and living',
    details: [['leaf', 'Soft textures'], ['home', 'Calm spaces'], ['grid', 'Everyday living']],
  },
];

/** One photograph, every word on it. `tall` (optional) is the portrait the browser takes under 1024px. */
function DoorwayCard({ store, modifier, tabIndex }) {
  const hId = `fsb-${store.key}-h`;
  const ctaId = `fsb-${store.key}-cta`;
  return (
    <Link to={store.to} className={`fsb__card fsb__card--${store.key}${modifier ? ` fsb__card--${modifier}` : ''}`} aria-labelledby={`${hId} ${ctaId}`} tabIndex={tabIndex}>
      <div className="fsb__art">
        <DeferredImage
          src={store.wide}
          sources={store.tall ? [{ media: TALL, srcSet: store.tall }] : undefined}
          alt={store.alt}
          width={1600}
          height={900}
          className="fsb__image"
        />
      </div>
      <div className="fsb__content">
        <div className="fsb__copy">
          <p className="fsb__eyebrow">{store.eyebrow}</p>
          {modifier === 'lead'
            ? <h3 className="fsb__h" id={hId}>{store.heading.join(' ')}</h3>
            : <h3 className="fsb__h" id={hId}><span>{store.heading[0]}</span> <span>{store.heading[1]}</span></h3>}
          <p className="fsb__description">{store.description}</p>
          <span className="fsb__cta" id={ctaId}>{store.cta} <Icon name="arrowRight" size={18} /></span>
        </div>
        <ul className="fsb__details" aria-label={store.detailsLabel}>
          {store.details.map(([icon, label]) => (
            <li key={icon}><Icon name={icon} size={22} /><span>{label}</span></li>
          ))}
        </ul>
      </div>
    </Link>
  );
}

/**
 * The two store cards, one at a time. Autoplays only when there is more
 * than one slide, pauses on hover and focus, never moves under
 * prefers-reduced-motion; the track slides on transform only. A sideways
 * swipe of 40px or more changes the slide — and swallows the click that
 * would otherwise follow the card link.
 */
export function DoorwayCarousel({ stores = STORES, autoplayMs = AUTOPLAY_MS }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);
  const swipe = useRef({ x: null, y: null, moved: false });
  const n = stores.length;
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { reduced.current = mq.matches; };
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  useEffect(() => {
    if (n < 2 || paused) return undefined;
    const t = setInterval(() => { if (!reduced.current) setIndex((i) => (i + 1) % n); }, autoplayMs);
    return () => clearInterval(t);
  }, [n, paused, autoplayMs]);
  if (n === 0) return null;
  const go = (d) => setIndex((i) => (i + d + n) % n);
  const onPointerDown = (e) => { swipe.current = { x: e.clientX, y: e.clientY, moved: false }; };
  const onPointerUp = (e) => {
    const s = swipe.current;
    if (s.x == null) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    swipe.current = { x: null, y: null, moved: Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) };
    if (swipe.current.moved) go(dx < 0 ? 1 : -1);
  };
  const onClickCapture = (e) => { if (swipe.current.moved) { e.preventDefault(); e.stopPropagation(); swipe.current.moved = false; } };
  return (
    <div className="fsb__carousel" aria-roledescription="carousel" aria-label="The stores"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="fsb__viewport" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { swipe.current = { x: null, y: null, moved: false }; }} onClickCapture={onClickCapture}>
        <div className="fsb__track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {stores.map((store, i) => (
            <div key={store.key} className={`fsb__slide${i === index ? ' is-on' : ''}`} aria-hidden={i !== index} aria-roledescription="slide" aria-label={`${i + 1} of ${n}`}>
              <DoorwayCard store={store} tabIndex={i === index ? undefined : -1} />
            </div>
          ))}
        </div>
      </div>
      {n > 1 && (
        <div className="fsb__dots" role="tablist" aria-label="Choose a store">
          {stores.map((store, i) => (
            <button key={store.key} type="button" role="tab" aria-selected={i === index} aria-label={`${store.heading.join(' ')}`} className={`fsb__dot${i === index ? ' is-on' : ''}`} onClick={() => setIndex(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** The Lifestyle banner on its own — no heading. Sits after the offers. */
export function LifestyleBanner() {
  return (
    <section className="v2-sec fsb fsb--lead" aria-labelledby="fsb-lifestyle-h fsb-lifestyle-cta">
      <div className="v2-wrap">
        <DoorwayCard store={LIFESTYLE} modifier="lead" />
      </div>
    </section>
  );
}

/** The two store cards under their heading. Sits just above the popular rail. */
export function StoreCarousel() {
  return (
    <section className="v2-sec fsb" aria-labelledby="fsb-h" id="more-to-explore">
      <div className="v2-wrap">
        <header className="fsb__intro">
          <p className="fsb__eyebrow fsb__overline">More to explore</p>
          <h2 id="fsb-h">Two Worlds. A Better You.</h2>
          <p className="fsb__lede">Fashion for your style. Living for your space. All at SORA LIFE.</p>
        </header>
        <DoorwayCarousel />
      </div>
    </section>
  );
}
