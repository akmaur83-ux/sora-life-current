import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import DeferredImage from './DeferredImage.jsx';
import FashionEntryLink from './FashionEntryLink.jsx';

// ============================================================
// The homepage doorways to the other stores. No catalogue dependency.
// Two sections, placed independently by Home.jsx.
//
// LifestyleBanner — full-bleed, in the women's page's language (sharp
// edges, uppercase Inter, the photograph edge to edge): one whole-banner
// link, its copy always on the photograph — over the sky on the left of
// the wide shot from 701px, over a fade at the foot of the 3:4 portrait on
// a phone; nothing beneath the image. Directly under it, the
// fashion category strip: women's and men's categories interleaved, each
// tile opening its own listing, on a transform-only track that advances on
// its own, pauses on hover and focus, never moves under
// prefers-reduced-motion, and takes arrows and a swipe.
//
// StoreCarousel — under its own heading, the two store cards, Fashion and
// Home & Living, as one carousel: one slide at a time on a transform-only
// track, autoplaying, paused on hover and focus, still under
// prefers-reduced-motion, with dots and a swipe.
//
// Every word is HTML; images stay deferred until they scroll near.
// ============================================================
const TALL = '(max-width: 1023px)';
const PHONE = '(max-width: 700px)';
export const AUTOPLAY_MS = 6000;
export const STRIP_AUTOPLAY_MS = 4500;

export const LIFESTYLE = {
  key: 'lifestyle',
  to: '/lifestyle',
  eyebrow: 'Live beautifully',
  heading: ['Lifestyle', 'Store'],
  description: 'Fashion, home, living and everyday essentials — all in one place.',
  cta: 'Explore Lifestyle',
  // From the women's page set until a purpose-shot banner arrives: the wide tailoring editorial
  // (sky on the left for the copy) and, on a phone, the women's hero portrait.
  wide: '/img/fashion-editorial/women-edit-tailoring-1898.webp',
  tall: '/img/fashion-editorial/women-main-hero-mobile.webp',
  alt: 'Women in ivory and black tailoring against a clear blue sky',
};

const shopArt = (name) => `/img/fashion-editorial/${name}.webp`;
/**
 * The strip's categories: each opens /fashion/c/<slug>, the category the catalogue holds
 * under Fashion › Women or Fashion › Men. `art: null` keeps a tile out of the strip until
 * its photograph (`planned`, 600×780 like the women-shop set) is in img/fashion-editorial/.
 */
export const FASHION_CATEGORIES = Object.freeze({
  women: [
    { slug: 'dresses', name: 'Dresses', art: shopArt('women-shop-dresses') },
    { slug: 'knitwear', name: 'Knitwear', art: shopArt('women-shop-knitwear') },
    { slug: 'shirts', name: 'Shirts', art: shopArt('women-shop-shirts') },
    { slug: 'denim', name: 'Denim', art: shopArt('women-shop-denim') },
    { slug: 'coats-jackets', name: 'Coats & Jackets', art: shopArt('women-shop-coats') },
    { slug: 'womens-bags', name: 'Bags', art: shopArt('women-shop-bags') },
  ],
  men: [
    { slug: 'mens-shirts', name: 'Shirts', art: null, planned: 'men-shop-shirts' },
    { slug: 'mens-t-shirts', name: 'T-Shirts', art: null, planned: 'men-shop-t-shirts' },
    { slug: 'mens-trousers', name: 'Trousers', art: null, planned: 'men-shop-trousers' },
    { slug: 'mens-jackets', name: 'Jackets', art: null, planned: 'men-shop-jackets' },
    { slug: 'mens-footwear', name: 'Footwear', art: null, planned: 'men-shop-footwear' },
  ],
});

/** Women's and men's in turn — one of each while both last — skipping any tile without its photograph. */
export function stripTiles(categories = FASHION_CATEGORIES) {
  const women = categories.women.filter((t) => t.art).map((t) => ({ ...t, dept: 'Women' }));
  const men = categories.men.filter((t) => t.art).map((t) => ({ ...t, dept: 'Men' }));
  const tiles = [];
  for (let i = 0; i < Math.max(women.length, men.length); i++) tiles.push(...[women[i], men[i]].filter(Boolean));
  return tiles;
}

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
function DoorwayCard({ store, tabIndex }) {
  const hId = `fsb-${store.key}-h`;
  const ctaId = `fsb-${store.key}-cta`;
  const Entry = store.key === 'fashion' ? FashionEntryLink : Link;
  return (
    <Entry to={store.to} className={`fsb__card fsb__card--${store.key}`} aria-labelledby={`${hId} ${ctaId}`} tabIndex={tabIndex}>
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
          <h3 className="fsb__h" id={hId}><span>{store.heading[0]}</span> <span>{store.heading[1]}</span></h3>
          <p className="fsb__description">{store.description}</p>
          <span className="fsb__cta" id={ctaId}>{store.cta} <Icon name="arrowRight" size={18} /></span>
        </div>
        <ul className="fsb__details" aria-label={store.detailsLabel}>
          {store.details.map(([icon, label]) => (
            <li key={icon}><Icon name={icon} size={22} /><span>{label}</span></li>
          ))}
        </ul>
      </div>
    </Entry>
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

/** The strip's reduced-motion check, read when a tick fires rather than when it is scheduled. */
function useReducedMotion() {
  const reduced = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { reduced.current = mq.matches; };
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  return reduced;
}

/**
 * The fashion categories, women's and men's in turn, each tile opening its own listing.
 * How many tiles are in view is the stylesheet's (--per on the track); the track moves by
 * whole tiles on transform only. Autoplays only when there is somewhere to go, pauses on
 * hover and focus, never moves under prefers-reduced-motion. Arrows step a tile; a sideways
 * swipe of 40px or more steps one too and swallows the click that would follow the tile link.
 * Tiles outside the window are hidden from assistive technology and untabbable.
 */
export function FashionCategoryStrip({ tiles = stripTiles(), autoplayMs = STRIP_AUTOPLAY_MS }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [per, setPer] = useState(1);
  const track = useRef(null);
  const reduced = useReducedMotion();
  const swipe = useRef({ x: null, y: null, moved: false });
  const n = tiles.length;
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const measure = () => {
      if (track.current) setPer(Math.max(1, parseInt(window.getComputedStyle(track.current).getPropertyValue('--per'), 10) || 1));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [n]);
  const last = Math.max(0, n - per);
  useEffect(() => { if (index > last) setIndex(last); }, [index, last]);
  useEffect(() => {
    if (last < 1 || paused) return undefined;
    const t = setInterval(() => { if (!reduced.current) setIndex((i) => (i >= last ? 0 : i + 1)); }, autoplayMs);
    return () => clearInterval(t);
  }, [last, paused, autoplayMs, reduced]);
  if (n === 0) return null;
  const step = (d) => setIndex((i) => Math.min(last, Math.max(0, i + d)));
  const onPointerDown = (e) => { swipe.current = { x: e.clientX, y: e.clientY, moved: false }; };
  const onPointerUp = (e) => {
    const s = swipe.current;
    if (s.x == null) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    swipe.current = { x: null, y: null, moved: Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) };
    if (swipe.current.moved) step(dx < 0 ? 1 : -1);
  };
  const onClickCapture = (e) => { if (swipe.current.moved) { e.preventDefault(); e.stopPropagation(); swipe.current.moved = false; } };
  const depts = [...new Set(tiles.map((t) => t.dept))];
  return (
    <section className="fsb-strip" aria-labelledby="fsb-strip-h">
      <div className="fsb-strip__wrap" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
        <header className="fsb-strip__head">
          <div>
            <p className="fsb-strip__eyebrow">{depts.join(' & ')}</p>
            <h2 id="fsb-strip-h">Shop fashion by category</h2>
          </div>
          {last > 0 && (
            <div className="fsb-strip__arrows">
              <button type="button" aria-label="Previous categories" disabled={index === 0} onClick={() => step(-1)}><Icon name="chevronLeft" size={18} /></button>
              <button type="button" aria-label="Next categories" disabled={index >= last} onClick={() => step(1)}><Icon name="chevronRight" size={18} /></button>
            </div>
          )}
        </header>
        <div className="fsb-strip__viewport" aria-roledescription="carousel" aria-label="Women's and men's categories"
          onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { swipe.current = { x: null, y: null, moved: false }; }} onClickCapture={onClickCapture}>
          <ul className="fsb-strip__track" ref={track} style={{ '--i': index }}>
            {tiles.map((t, i) => {
              const inView = i >= index && i < index + per;
              return (
                <li key={`${t.dept}-${t.slug}`} className="fsb-strip__tile" aria-hidden={!inView}>
                  <Link to={`/fashion/c/${t.slug}`} tabIndex={inView ? undefined : -1}>
                    <span className="fsb-strip__art"><DeferredImage src={t.art} alt="" width={600} height={780} className="fsb-strip__image" /></span>
                    <span className="fsb-strip__dept">{t.dept}</span>
                    <span className="fsb-strip__name">{t.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

/**
 * The Lifestyle banner, full-bleed — no heading above it — and the fashion category strip
 * directly beneath. Sits after the offers.
 */
export function LifestyleBanner() {
  const s = LIFESTYLE;
  return (
    <>
      <section className="fsb-lead" aria-labelledby="fsb-lifestyle-h fsb-lifestyle-cta">
        <Link to={s.to} className="fsb-lead__link" aria-labelledby="fsb-lifestyle-h fsb-lifestyle-cta">
          <span className="fsb-lead__art">
            <DeferredImage src={s.wide} sources={[{ media: PHONE, srcSet: s.tall }]} alt={s.alt} width={1898} height={829} className="fsb-lead__image" />
          </span>
          <div className="fsb-lead__copy">
            <p className="fsb-lead__eyebrow">{s.eyebrow}</p>
            <h2 className="fsb-lead__h" id="fsb-lifestyle-h"><span>{s.heading[0]}</span> <span>{s.heading[1]}</span></h2>
            <p className="fsb-lead__description">{s.description}</p>
            <span className="fsb-lead__cta" id="fsb-lifestyle-cta">{s.cta} <Icon name="arrowRight" size={16} /></span>
          </div>
        </Link>
      </section>
      <FashionCategoryStrip />
    </>
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
