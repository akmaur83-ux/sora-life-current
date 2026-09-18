import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { CATEGORY_SECTION, FEATURED, HERO_SLIDES, PROMO, TRUST, categoryHref, useHomeLivingCatalogue } from '../data/homelivingHomepage.js';
import HomeLivingProductCard from './HomeLivingProductCard.jsx';

// ============================================================
// /homeliving — the hero, the trust strip, the category circles, the
// featured row, and the promo strip, in that order. Every word on the page
// is HTML text; the photographs are backgrounds and product shots only.
// The categories and products are the live catalogue (catalogue_* where
// store = 'homeliving', via useHomeLivingCatalogue); the hero, trust, promo
// and copy come from src/data/homelivingHomepage.js — nothing here is
// hardcoded. A section with nothing to show says so rather than inventing
// tiles.
// ============================================================

export const AUTOPLAY_MS = 6000;

/**
 * Full-width carousel. Autoplays only when there is more than one slide,
 * pauses on hover and focus, and never moves under prefers-reduced-motion.
 * The track slides on transform only. The photograph keeps its subject on
 * the right; the copy sits on the left over a cream wash.
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
    <section className="hl-hero" aria-roledescription="carousel" aria-label="Featured"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="hl-hero__track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((s, i) => (
          <article key={s.id} className={`hl-hero__slide${i === index ? ' is-on' : ''}`} aria-hidden={i !== index} aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}`}>
            <img className="hl-hero__img" src={s.image} alt="" width="1600" height="900" decoding="async" fetchpriority={i === 0 ? 'high' : 'auto'} loading={i === 0 ? 'eager' : 'lazy'} />
            <div className="hl-wrap hl-hero__inner">
              <div className="hl-hero__txt">
                {s.eyebrow && <p className="hl-hero__eyebrow">{s.eyebrow}</p>}
                <h1 className="hl-hero__h serif">{s.headline}</h1>
                <p className="hl-hero__sub">{s.sub}</p>
                <Link to={s.href} className="hl-cta" tabIndex={i === index ? 0 : -1}>{s.cta} <Icon name="arrowRight" size={17} /></Link>
              </div>
              {s.note && <p className="hl-hero__note serif" aria-hidden="true">{s.note}</p>}
            </div>
          </article>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="hl-hero__dots" role="tablist" aria-label="Choose slide">
          {slides.map((s, i) => (
            <button key={s.id} type="button" role="tab" aria-selected={i === index} aria-label={`Slide ${i + 1}`} className={`hl-hero__dot${i === index ? ' is-on' : ''}`} onClick={() => setIndex(i)} />
          ))}
        </div>
      )}
    </section>
  );
}

function TrustStrip() {
  return (
    <div className="hl-wrap">
      <ul className="hl-trust" aria-label="Why shop with us">
        {TRUST.map((t) => (
          <li key={t.title}>
            <span className="hl-trust__icon"><Icon name={t.icon} size={22} /></span>
            <span className="hl-trust__txt"><strong>{t.title}</strong><em>{t.sub}</em></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryCircles({ categories }) {
  if (categories.length === 0) return null;
  return (
    <section className="hl-wrap hl-sec hl-cats" aria-labelledby="hl-cats-h">
      <header className="hl-sec__head hl-cats__head">
        <div>
          <p className="hl-eyebrow">{CATEGORY_SECTION.eyebrow}</p>
          <h2 className="hl-sec__h hl-sec__h--rule serif" id="hl-cats-h">{CATEGORY_SECTION.title}</h2>
        </div>
        <Link to={CATEGORY_SECTION.viewAll} className="hl-sec__link">View all <Icon name="arrowRight" size={16} /></Link>
      </header>
      <nav className="hl-circles" aria-label="Shop by category">
        {categories.map((c) => (
          <Link key={c.id} to={categoryHref(c)} className="hl-circle">
            <span className="hl-circle__img">{c.image_url ? <img src={c.image_url} alt="" loading="lazy" decoding="async" width="200" height="200" /> : <b aria-hidden="true">{c.name.slice(0, 1)}</b>}</span>
            <span className="hl-circle__name">{c.name}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}

function FeaturedRow({ products, status }) {
  const { title, sub, seeAll, limit } = FEATURED;
  const row = products.slice(0, limit);
  return (
    <section className="hl-wrap hl-sec" aria-labelledby="hl-featured-h">
      <header className="hl-sec__head">
        <div><h2 className="hl-sec__h serif" id="hl-featured-h">{title}</h2>{sub && <p className="hl-sec__sub">{sub}</p>}</div>
        <Link to={seeAll} className="hl-sec__link">View all <Icon name="arrowRight" size={16} /></Link>
      </header>
      {row.length === 0 ? (
        <p className="hl-empty">{status === 'loading' ? 'Loading the catalogue…' : status === 'error' ? 'The Home & Living catalogue could not be loaded. Please try again shortly.' : 'The Home & Living store is being stocked — products appear here as they go live.'}</p>
      ) : (
        <div className="hl-row">
          {row.map((p, i) => <HomeLivingProductCard key={p.id} product={p} mediaLoading={i < 2 ? 'eager' : 'lazy'} />)}
        </div>
      )}
    </section>
  );
}

function PromoStrip() {
  return (
    <section className="hl-promo" aria-labelledby="hl-promo-h">
      <div className="hl-promo__art" aria-hidden="true"><img src={PROMO.image} alt="" loading="lazy" decoding="async" width="1200" height="400" /></div>
      <div className="hl-wrap hl-promo__inner">
        <div className="hl-promo__txt">
          <p className="hl-eyebrow">{PROMO.eyebrow}</p>
          <h2 className="hl-promo__h serif" id="hl-promo-h">{PROMO.headline}</h2>
          <p className="hl-promo__sub">{PROMO.sub}</p>
          <Link to={PROMO.href} className="hl-cta">{PROMO.cta} <Icon name="arrowRight" size={16} /></Link>
        </div>
        <ul className="hl-promo__badges" aria-label="Why it matters">
          {PROMO.badges.map((b) => <li key={b.title}><span className="hl-trust__icon"><Icon name={b.icon} size={22} /></span><span>{b.title}</span></li>)}
        </ul>
      </div>
    </section>
  );
}

export default function HomeLivingHome() {
  const { status, categories, products } = useHomeLivingCatalogue();
  return (
    <div className="hl-home">
      <HeroCarousel />
      <TrustStrip />
      <CategoryCircles categories={categories} />
      <FeaturedRow products={products} status={status} />
      <PromoStrip />
    </div>
  );
}
