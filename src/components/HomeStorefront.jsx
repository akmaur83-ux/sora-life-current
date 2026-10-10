import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import DeferredImage from './DeferredImage.jsx';
import FashionEntryLink from './FashionEntryLink.jsx';

// ============================================================
// The top of the wellness homepage: white, with an orange accent — a
// palette of its own, scoped to these sections (every rule in v2-home.css
// that styles them starts with .hx; no --slv2-* token changes).
//
// HomeHero      — two slides of the product lineup, the copy over the
//                 photograph's empty white; autoplays, pauses on hover and
//                 focus, still under prefers-reduced-motion, dots and a swipe.
//                 Static: the admin Hero Slides page no longer drives it.
// HomeTrustStrip — four facts: free standard delivery on every order,
//                 genuine products, 7-day returns, support 9am–6pm IST. On a
//                 phone, one row of four, each two short lines beside its icon.
// HomeTiles     — Fashion, large, beside Health & Nutrition and Home & Living.
// ExploreStores — five circles in one row, "View All" beside the heading.
// FestivePromo  — the gift-and-diya banner, its copy in the clear centre.
//
// Every word is HTML; no image carries text beyond product packaging.
// Orange text and fills meet WCAG AA: buttons are the deep orange
// (#C2500A, 4.72:1 with white); the bright orange (#F47B20) carries
// near-black text (6.19:1) or nothing.
// ============================================================
export const HERO_AUTOPLAY_MS = 6000;
const PHONE = '(max-width: 700px)';

export const HERO_SLIDES = [
  {
    key: 'everyday',
    // Two lines on a phone, as in the mockup; one line, dot-separated, from 701px.
    eyebrow: ['Wellness · Fashion · Home', 'Personal care · More'],
    title: ['Everything for', 'everyday wellbeing.'],
    cta: { label: 'Shop now', to: '/shop' },
    // The wider lineup leads (the owner's choice): the juices, Berry Veda and its box.
    image: '/img/home-hero-2.webp', phone: '/img/home-hero-2-800.webp', width: 1600, height: 900,
    alt: 'Biosash sea buckthorn juices, Berry Veda and Mom’s Trust care products with berries and marigolds',
  },
  {
    key: 'biosash',
    eyebrow: ['In the catalogue'],
    title: ['The Biosash', 'range'],
    // No brand page or brand filter exists yet, so this slide has no button.
    cta: null,
    image: '/img/home-hero-1.webp', phone: '/img/home-hero-1-800.webp', width: 1536, height: 864,
    alt: 'Biosash and Mom’s Trust products on a stone slab with sea buckthorn berries and oranges',
  },
];

// A title in two parts is two lines on a phone, where its note gives way so every item is two lines.
export const TRUST = [
  { icon: 'truck', title: ['Free Standard', 'Delivery'], note: 'On every order', to: '/shipping' },
  { icon: 'shield', title: ['Genuine', 'Products'], note: null, to: null },
  { icon: 'return', title: ['Easy Returns'], note: '7 days', to: '/returns' },
  { icon: 'chat', title: ['Support'], note: '9am–6pm IST', to: '/contact' },
];

export const STORES = [
  { key: 'wellness', name: 'Wellness', to: '/category/wellness', image: '/img/home-cat-wellness.webp' },
  { key: 'personal-care', name: 'Personal Care', to: '/category/personal-care', image: '/img/home-cat-personal-care.webp' },
  { key: 'fashion', name: 'Fashion', to: '/fashion', image: '/img/home-cat-fashion.webp' },
  { key: 'groceries', name: 'Groceries', to: '/grocery', image: '/img/home-cat-groceries.webp' },
  { key: 'home-textiles', name: 'Home Textiles', to: '/homeliving', image: '/img/home-cat-home-textiles.webp' },
];

/** The slides, one in view on a transform-only track; the first slide's title is the page's h1. */
export function HomeHero({ slides = HERO_SLIDES, autoplayMs = HERO_AUTOPLAY_MS }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);
  const swipe = useRef({ x: null, y: null, moved: false });
  const n = slides.length;
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
    <section className="hx hx-hero" aria-roledescription="carousel" aria-label="SORA LIFE"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="hx-hero__viewport" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { swipe.current = { x: null, y: null, moved: false }; }} onClickCapture={onClickCapture}>
        <div className="hx-hero__track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((s, i) => {
            const Title = i === 0 ? 'h1' : 'h2';
            const current = i === index;
            return (
              <div key={s.key} className={`hx-hero__slide hx-hero__slide--${s.key}`} aria-hidden={!current} aria-roledescription="slide" aria-label={`${i + 1} of ${n}`}>
                <DeferredImage src={s.image} sources={[{ media: PHONE, srcSet: s.phone }]} alt={s.alt} width={s.width} height={s.height}
                  className="hx-hero__image" loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : undefined} />
                <div className="hx-wrap hx-hero__copy">
                  <p className="hx-eyebrow">{s.eyebrow.map((line, j) => <span key={line}>{j > 0 && <span className="hx-eyebrow__dot" aria-hidden="true"> · </span>}{line}</span>)}</p>
                  <Title className="hx-hero__title"><span>{s.title[0]}</span> <span className="hx-hl">{s.title[1]}</span></Title>
                  {s.cta && <Link to={s.cta.to} className="hx-btn" tabIndex={current ? undefined : -1}>{s.cta.label} <Icon name="arrowRight" size={17} /></Link>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {n > 1 && (
        <div className="hx-hero__dots" role="group" aria-label="Choose a slide">
          {slides.map((s, i) => (
            <button key={s.key} type="button" aria-label={`Show slide ${i + 1} of ${n}`} aria-pressed={i === index} className={`hx-hero__dot${i === index ? ' is-on' : ''}`} onClick={() => setIndex(i)} />
          ))}
        </div>
      )}
    </section>
  );
}

export function HomeTrustStrip() {
  return (
    <section className="hx hx-trust" aria-label="Shopping with SORA LIFE">
      <ul className="hx-wrap hx-trust__list">
        {TRUST.map((t) => {
          const title = t.title.join(' ');
          const body = <><Icon name={t.icon} size={26} /><span><strong>{t.title.map((line, j) => <span key={line}>{j > 0 && ' '}{line}</span>)}</strong>{t.note && <small>{t.note}</small>}</span></>;
          return <li key={title} className={t.title.length > 1 ? 'hx-trust--split' : undefined}>{t.to ? <Link to={t.to}>{body}</Link> : <span className="hx-trust__item">{body}</span>}</li>;
        })}
      </ul>
    </section>
  );
}

export function HomeTiles() {
  return (
    <section className="hx hx-tiles" aria-label="Shop the stores">
      <div className="hx-wrap hx-tiles__grid">
        <FashionEntryLink to="/fashion" className="hx-tile hx-tile--fashion" aria-labelledby="hx-fashion-h hx-fashion-cta">
          <div className="hx-tile__panel">
            <h2 className="hx-tile__h" id="hx-fashion-h"><span>Fashion</span> <span>for every</span> <span>mood.</span></h2>
            <span className="hx-btn hx-btn--light" id="hx-fashion-cta">Shop Fashion <Icon name="arrowRight" size={16} /></span>
          </div>
          <span className="hx-tile__art"><DeferredImage src="/img/home-tile-fashion.webp" alt="Woman in an orange knit sweater against an orange backdrop" width={800} height={1067} className="hx-tile__image" /></span>
        </FashionEntryLink>
        <Link to="/category/supplements" className="hx-tile hx-tile--small hx-tile--nutrition" aria-labelledby="hx-nutrition-h">
          <DeferredImage src="/img/home-tile-nutrition.webp" alt="" width={900} height={563} className="hx-tile__image" />
          <h2 className="hx-tile__h" id="hx-nutrition-h"><span>Health &amp;</span> <span>Nutrition</span></h2>
          <span className="hx-tile__go" aria-hidden="true"><Icon name="arrowRight" size={18} /></span>
        </Link>
        <Link to="/homeliving" className="hx-tile hx-tile--small hx-tile--living" aria-labelledby="hx-living-h">
          <DeferredImage src="/img/home-tile-living.webp" alt="" width={900} height={563} className="hx-tile__image" />
          <h2 className="hx-tile__h" id="hx-living-h"><span>Home &amp;</span> <span>Living</span></h2>
          <span className="hx-tile__go" aria-hidden="true"><Icon name="arrowRight" size={18} /></span>
        </Link>
      </div>
    </section>
  );
}

export function ExploreStores({ stores = STORES }) {
  return (
    <section className="hx hx-stores" aria-labelledby="hx-stores-h">
      <div className="hx-wrap">
        <div className="hx-stores__head">
          <h2 className="hx-stores__h" id="hx-stores-h">Explore the stores</h2>
          <Link to="/shop" className="hx-more" aria-label="View all products">View All <Icon name="arrowRight" size={15} /></Link>
        </div>
        <ul className="hx-stores__row">
          {stores.map((s) => {
            const Entry = s.to === '/fashion' ? FashionEntryLink : Link;
            return (
              <li key={s.key}>
                <Entry to={s.to} className="hx-store">
                  <span className="hx-store__art"><DeferredImage src={s.image} alt="" width={480} height={480} className="hx-store__image" /></span>
                  <span className="hx-store__name">{s.name}</span>
                </Entry>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function FestivePromo() {
  return (
    <section className="hx hx-promo" aria-labelledby="hx-promo-h">
      <div className="hx-wrap">
        <Link to="/shop" className="hx-promo__card" aria-labelledby="hx-promo-h hx-promo-cta">
          <DeferredImage src="/img/home-promo-festive.webp" sources={[{ media: PHONE, srcSet: '/img/home-promo-festive-800.webp' }]}
            alt="A gift box tied with an orange ribbon beside a lit diya and marigolds" width={1600} height={533} className="hx-promo__image" />
          <div className="hx-promo__copy">
            <h2 className="hx-promo__h" id="hx-promo-h">Festive gifting</h2>
            <p className="hx-promo__text">Wellness, beauty and home picks to give this season</p>
            <span className="hx-btn" id="hx-promo-cta">Shop gifts <Icon name="arrowRight" size={16} /></span>
          </div>
        </Link>
      </div>
    </section>
  );
}
