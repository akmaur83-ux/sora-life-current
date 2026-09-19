import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { FASHION_BANNER, FASHION_CATEGORIES, FEATURES, HERO_SLIDES, HOME_CATEGORIES, PROMO, TALL_MEDIA, TRENDING, homeCategoryHref, productHref, trendingOf, useLifestyleCatalogue } from '../data/lifestyleHomepage.js';

// ============================================================
// /lifestyle — the hero carousel, the Home & Living circles, the fashion
// doorway card, the fashion circles, the two feature tiles, Trending Now,
// and the promo strip, in the mockup's order. Every word on the page is
// HTML text; the photographs are backgrounds and product shots only. The
// categories and products are the live catalogue of the two stores
// (useLifestyleCatalogue); the hero, banner, tiles, promo and copy come
// from src/data/lifestyleHomepage.js — nothing here is hardcoded. A
// section with nothing to show says so rather than inventing tiles.
// ============================================================

export const AUTOPLAY_MS = 6000;

/** The first slide is the hero image: eager and high priority. The rest wait. */
function SlidePicture({ slide, first }) {
  return (
    <picture className="ls-hero__pic">
      <source media={TALL_MEDIA} srcSet={slide.tall} />
      <img className="ls-hero__img" src={slide.wide} alt={slide.alt} width="1600" height="900" decoding="async" fetchpriority={first ? 'high' : 'auto'} loading={first ? 'eager' : 'lazy'} />
    </picture>
  );
}

/**
 * Full-bleed carousel over 4:5 portraits on a phone and 16:9 landscapes
 * from 1024px — the browser picks the file. The copy sits on the empty
 * upper-left of every photograph over a cream wash. Autoplays only when
 * there is more than one slide, pauses on hover and focus, never moves
 * under prefers-reduced-motion; the track slides on transform only. With
 * one slide there is no counter and no arrows.
 */
export function HeroCarousel({ slides = HERO_SLIDES, autoplayMs = AUTOPLAY_MS }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);
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
  return (
    <section className="ls-hero" aria-roledescription="carousel" aria-label="Featured"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="ls-hero__track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((s, i) => (
          <article key={s.id} className={`ls-hero__slide${i === index ? ' is-on' : ''}`} aria-hidden={i !== index} aria-roledescription="slide" aria-label={`${i + 1} of ${n}`}>
            <div className="ls-hero__art"><SlidePicture slide={s} first={i === 0} /></div>
            <div className="ls-hero__copy">
              <p className="ls-hero__eyebrow"><span>{s.eyebrow[0]}</span> <span>{s.eyebrow[1]}</span></p>
              <h1 className="ls-hero__h serif"><span>{s.headline[0]}</span> <span>{s.headline[1]}</span></h1>
              <p className="ls-hero__sub">{s.sub}</p>
              <Link to={s.href} className="ls-cta" tabIndex={i === index ? 0 : -1}>{s.cta} <Icon name="arrowRight" size={17} /></Link>
            </div>
            {s.note && <p className="ls-hero__note serif" aria-hidden="true">{s.note}</p>}
          </article>
        ))}
      </div>
      {n > 1 && (
        <div className="ls-hero__ctl">
          <p className="ls-hero__count" aria-live="polite"><b>{index + 1}</b> / {n}</p>
          <span className="ls-hero__bar" aria-hidden="true"><i style={{ width: `${((index + 1) / n) * 100}%` }} /></span>
          <button type="button" className="ls-hero__arrow" aria-label="Previous slide" onClick={() => go(-1)}><Icon name="chevronLeft" size={20} /></button>
          <button type="button" className="ls-hero__arrow" aria-label="Next slide" onClick={() => go(1)}><Icon name="chevronRight" size={20} /></button>
        </div>
      )}
    </section>
  );
}

function Circles({ items, label, className = '' }) {
  return (
    <nav className={`ls-circles ${className}`.trim()} aria-label={label}>
      {items.map((c) => (
        <Link key={c.id} to={c.href} className="ls-circle">
          <span className="ls-circle__img">{c.art ? <img src={c.art} alt="" loading="lazy" decoding="async" width="200" height="200" /> : <b aria-hidden="true">{c.name.slice(0, 1)}</b>}</span>
          <span className="ls-circle__name">{c.name}</span>
        </Link>
      ))}
    </nav>
  );
}

function HomeCircles({ categories }) {
  if (categories.length === 0) return null;
  const items = categories.map((c) => ({ id: c.id, name: c.name, href: homeCategoryHref(c), art: c.image_url || null }));
  return <section className="ls-wrap ls-homecats"><Circles items={items} label={HOME_CATEGORIES.label} /></section>;
}

/** The fashion doorway: one photograph, subject right, every word on its left. */
function FashionBannerCard() {
  const b = FASHION_BANNER;
  return (
    <section className="ls-wrap">
      <Link to={b.href} className="ls-banner" aria-labelledby="ls-banner-h ls-banner-cta">
        <div className="ls-banner__art"><img src={b.image} alt={b.alt} width="1600" height="900" loading="lazy" decoding="async" /></div>
        <div className="ls-banner__copy">
          <p className="ls-eyebrow ls-banner__eyebrow"><span>{b.eyebrow[0]}</span> <span>{b.eyebrow[1]}</span></p>
          <h2 className="ls-banner__h serif" id="ls-banner-h"><span>{b.headline[0]}</span> <span>{b.headline[1]}</span></h2>
          <p className="ls-banner__sub">{b.sub}</p>
          <span className="ls-cta ls-cta--sm" id="ls-banner-cta">{b.cta} <Icon name="arrowRight" size={16} /></span>
        </div>
        {b.note && <p className="ls-banner__note serif" aria-hidden="true">{b.note}</p>}
      </Link>
    </section>
  );
}

function FashionCircles({ categories }) {
  if (categories.length === 0) return null;
  return (
    <section className="ls-wrap ls-sec" aria-labelledby="ls-fashion-h">
      <header className="ls-sec__head">
        <h2 className="ls-sec__h serif" id="ls-fashion-h">{FASHION_CATEGORIES.title}</h2>
        <Link to={FASHION_CATEGORIES.viewAll} className="ls-sec__link">View All <Icon name="arrowRight" size={16} /></Link>
      </header>
      <Circles items={categories} label="Shop fashion by category" />
    </section>
  );
}

function FeatureTiles() {
  return (
    <div className="ls-wrap">
      <ul className="ls-features" aria-label="What to expect">
        {FEATURES.map((f) => (
          <li key={f.title}>
            <span className="ls-features__icon"><Icon name={f.icon} size={22} /></span>
            <span className="ls-features__txt"><strong>{f.title}</strong><em>{f.sub}</em></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One product from either store; the whole card links to its product page,
 * where the real Add lives. The action slot beside the price is reserved
 * (data-slot="add-to-cart") for the Add button once this storefront has a
 * cart namespace — there is no cart icon until it does.
 */
export function TrendingCard({ product, mediaLoading = 'lazy' }) {
  return (
    <Link to={productHref(product)} className="ls-card" data-store={product.store}>
      <span className="ls-card__media">
        {product.image ? <img src={product.image} alt="" loading={mediaLoading} decoding="async" width="400" height="400" /> : <span className="ls-card__noimg" aria-hidden="true">{product.name.slice(0, 1)}</span>}
        <span className="ls-card__heart" aria-hidden="true"><Icon name="heart" size={16} /></span>
      </span>
      <span className="ls-card__body">
        <span className="ls-card__name">{product.name}</span>
        <span className="ls-card__row">
          <span className="ls-price"><strong>{money(product.price)}</strong>{product.hasDiscount && <s className="ls-price__mrp">{money(product.mrp)}</s>}</span>
          <span className="ls-card__slot" data-slot="add-to-cart" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

function TrendingRow({ products, status }) {
  const row = trendingOf(products, TRENDING.limit);
  return (
    <section className="ls-wrap ls-sec" aria-labelledby="ls-trending-h">
      <header className="ls-sec__head">
        <h2 className="ls-sec__h ls-sec__h--rule serif" id="ls-trending-h">{TRENDING.title}</h2>
        <Link to={TRENDING.viewAll} className="ls-sec__link">View All <Icon name="arrowRight" size={16} /></Link>
      </header>
      {row.length === 0 ? (
        <p className="ls-empty">{status === 'loading' ? 'Loading the catalogue…' : status === 'error' ? 'The catalogue could not be loaded. Please try again shortly.' : 'Products appear here as the stores are stocked.'}</p>
      ) : (
        <div className="ls-row">
          {row.map((p, i) => <TrendingCard key={p.id} product={p} mediaLoading={i < 2 ? 'eager' : 'lazy'} />)}
        </div>
      )}
    </section>
  );
}

function PromoStrip() {
  return (
    <section className="ls-wrap">
      <div className="ls-promo" aria-labelledby="ls-promo-h">
        <div className="ls-promo__art" aria-hidden="true"><img src={PROMO.image} alt="" loading="lazy" decoding="async" width="1200" height="400" /></div>
        <p className="ls-promo__h" id="ls-promo-h">{PROMO.headline}</p>
        <Link to={PROMO.href} className="ls-cta ls-cta--paper">{PROMO.cta} <Icon name="arrowRight" size={16} /></Link>
      </div>
    </section>
  );
}

export default function LifestyleHome() {
  const { status, homeCategories, fashionCategories, products } = useLifestyleCatalogue();
  return (
    <div className="ls-home">
      <HeroCarousel />
      <HomeCircles categories={homeCategories} />
      <FashionBannerCard />
      <FashionCircles categories={fashionCategories} />
      <FeatureTiles />
      <TrendingRow products={products} status={status} />
      <PromoStrip />
    </div>
  );
}
