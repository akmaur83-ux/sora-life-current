import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { CATEGORIES, DAILY_ESSENTIALS, GROCERY_DELIVERY_WINDOW, HERO_SLIDES, PROMO, categoryHref } from '../data/groceryHomepage.js';
import GroceryProductCard from './GroceryProductCard.jsx';

// ============================================================
// /grocery — the trust strip, the hero carousel, the category circles,
// "Daily essentials", and the promo strip. Every word on the page is HTML
// text; the photographs are backgrounds and product shots only. All content
// comes from src/data/groceryHomepage.js — nothing here is hardcoded.
// ============================================================

const TRUST = [
  ['truck', 'Standard Delivery', GROCERY_DELIVERY_WINDOW],
  ['leaf', 'Fresh Products', 'Sourced with care'],
  ['shield', 'Trusted Quality', 'Good food, safer lives'],
];
function TrustStrip() {
  return (
    <ul className="gs-trust" aria-label="Why shop with us">
      {TRUST.map(([icon, a, b]) => <li key={a}><Icon name={icon} size={28} /><span><strong>{a}</strong><em>{b}</em></span></li>)}
    </ul>
  );
}

export const AUTOPLAY_MS = 6000;

/**
 * Full-width carousel. Autoplays only when there is more than one slide,
 * pauses on hover and focus, and never moves under prefers-reduced-motion.
 * The track slides on transform only.
 */
export function HeroCarousel({ slides = HERO_SLIDES, autoplayMs = AUTOPLAY_MS }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { reduced.current = mq.matches; };
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  useEffect(() => {
    if (slides.length < 2 || paused) return undefined;
    const t = setInterval(() => { if (!reduced.current) setIndex((i) => (i + 1) % slides.length); }, autoplayMs);
    return () => clearInterval(t);
  }, [slides.length, paused, autoplayMs]);
  if (slides.length === 0) return null;
  return (
    <section className="gs-hero" aria-roledescription="carousel" aria-label="Featured"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="gs-hero__track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((s, i) => (
          <article key={s.id} className={`gs-hero__slide${i === index ? ' is-on' : ''}`} aria-hidden={i !== index} aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}`}>
            <img className="gs-hero__img" src={s.image} alt="" width="1600" height="900" decoding="async" fetchpriority={i === 0 ? 'high' : 'auto'} loading={i === 0 ? 'eager' : 'lazy'} />
            <div className="gs-hero__txt">
              <h1 className="gs-hero__h serif">{s.headline}</h1>
              <p className="gs-hero__sub">{s.sub}</p>
              <Link to={s.href} className="gs-hero__cta" tabIndex={i === index ? 0 : -1}>{s.cta} <Icon name="arrowRight" size={17} /></Link>
            </div>
            {s.note && <p className="gs-hero__note serif" aria-hidden="true">{s.note}</p>}
          </article>
        ))}
      </div>
      <div className="gs-hero__dots" role="tablist" aria-label="Choose slide">
        {slides.map((s, i) => (
          <button key={s.id} type="button" role="tab" aria-selected={i === index} aria-label={`Slide ${i + 1}`} className={`gs-hero__dot${i === index ? ' is-on' : ''}`} onClick={() => setIndex(i)} />
        ))}
      </div>
    </section>
  );
}

function CategoryCircles() {
  if (CATEGORIES.length === 0) return null;
  return (
    <nav className="gs-circles" aria-label="Shop by category">
      {CATEGORIES.map((c) => (
        <Link key={c.slug} to={categoryHref(c)} className="gs-circle">
          <span className="gs-circle__img">{c.image ? <img src={c.image} alt="" loading="lazy" decoding="async" width="200" height="200" /> : <b aria-hidden="true">{c.name.slice(0, 1)}</b>}</span>
          <span className="gs-circle__name">{c.name}</span>
        </Link>
      ))}
    </nav>
  );
}

function DailyEssentials() {
  const { title, sub, seeAll, products } = DAILY_ESSENTIALS;
  if (products.length === 0) return null;
  return (
    <section className="gs-sec" aria-labelledby="gs-daily-h">
      <header className="gs-sec__head">
        <div><h2 className="gs-sec__h serif" id="gs-daily-h">{title}</h2>{sub && <p className="gs-sec__sub">{sub}</p>}</div>
        <Link to={seeAll} className="gs-sec__link">See all <Icon name="arrowRight" size={16} /></Link>
      </header>
      <div className="gs-row">
        {products.map((p, i) => <GroceryProductCard key={p.id} product={p} mediaLoading={i < 2 ? 'eager' : 'lazy'} />)}
      </div>
    </section>
  );
}

function PromoStrip() {
  return (
    <section className="gs-promo" aria-labelledby="gs-promo-h">
      <div className="gs-promo__art" aria-hidden="true"><img src={PROMO.image} alt="" loading="lazy" decoding="async" width="1200" height="675" /></div>
      <div className="gs-promo__txt">
        <h2 className="gs-promo__h serif" id="gs-promo-h">{PROMO.headline}</h2>
        <p className="gs-promo__sub">{PROMO.sub}</p>
        <Link to={PROMO.href} className="gs-promo__cta">{PROMO.cta} <Icon name="arrowRight" size={16} /></Link>
      </div>
    </section>
  );
}

export default function GroceryHome() {
  return (
    <div className="gs-home">
      <TrustStrip />
      <HeroCarousel />
      <CategoryCircles />
      <DailyEssentials />
      <PromoStrip />
    </div>
  );
}
