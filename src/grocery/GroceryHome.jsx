import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { DAILY_ESSENTIALS, GROCERY_SECTIONS, categoryHref, useGroceryCatalogue } from '../data/groceryHomepage.js';
import { useStorefrontSection, positionAttr } from '../lib/storefrontSections.js';
import GroceryProductCard from './GroceryProductCard.jsx';

// ============================================================
// /grocery — the trust strip, the hero carousel, the category circles,
// "Daily essentials", and the promo strip. Every word on the page is HTML
// text; the photographs are backgrounds and product shots only. The
// categories and products are the live catalogue (catalogue_* where store
// = 'grocery', via useGroceryCatalogue); the hero, promo and copy come from
// src/data/groceryHomepage.js — nothing here is hardcoded. A section with
// nothing to show says so rather than inventing tiles.
// ============================================================

// Every section is the admin's (Storefronts → Grocery), read over its built-in content
// (GROCERY_SECTIONS); a hidden one is left out.
const visible = (entry) => !entry.hidden;
/** A section's colour matched to its photograph — only when the admin set one with it. */
const tone = (colour) => (colour ? { 'data-tone': '', style: { '--sf-tone': colour } } : {});
/** The phone photograph under 700px when there is a separate one; else the one image, as it always was. */
const PHONE = '(max-width: 700px)';
const photo = (phone, desktop, img) => (phone && phone !== desktop ? <picture><source media={PHONE} srcSet={phone} />{img}</picture> : img);

function TrustStrip() {
  const trust = useStorefrontSection('grocery', 'trust', GROCERY_SECTIONS.trust);
  if (trust.hidden) return null;
  return (
    <ul className="gs-trust" aria-label="Why shop with us">
      {trust.items.filter(visible).map((t) => <li key={t.title}><Icon name={t.icon} size={28} /><span><strong>{t.title}</strong><em>{t.sub}</em></span></li>)}
    </ul>
  );
}

/** The hero as the carousel's one slide. */
export const heroSlideOf = (h) => ({ id: h.id, image: h.picture.desktop, phone: h.picture.phone, headline: h.headline, sub: h.sub, cta: h.cta, href: h.link, note: h.note, colour: h.picture.colour, position: h.position });

export const AUTOPLAY_MS = 6000;

/**
 * Full-width carousel. Autoplays only when there is more than one slide,
 * pauses on hover and focus, and never moves under prefers-reduced-motion.
 * The track slides on transform only.
 */
export function HeroCarousel({ slides: given, autoplayMs = AUTOPLAY_MS }) {
  const hero = useStorefrontSection('grocery', 'hero', GROCERY_SECTIONS.hero);
  const slides = given || (hero.hidden ? [] : [heroSlideOf(hero)]);
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
          <article key={s.id} className={`gs-hero__slide${i === index ? ' is-on' : ''}`} {...positionAttr(s.position)} {...tone(s.colour)} aria-hidden={i !== index} aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}`}>
            {photo(s.phone, s.image, <img className="gs-hero__img" src={s.image} alt="" width="1600" height="900" decoding="async" fetchpriority={i === 0 ? 'high' : 'auto'} loading={i === 0 ? 'eager' : 'lazy'} />)}
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

function CategoryCircles({ categories }) {
  const section = useStorefrontSection('grocery', 'categories', GROCERY_SECTIONS.categories);
  if (categories.length === 0 || section.hidden) return null;
  return (
    <nav className="gs-circles" aria-label="Shop by category">
      {categories.map((c) => (
        <Link key={c.id} to={categoryHref(c)} className="gs-circle">
          <span className="gs-circle__img">{c.image_url ? <img src={c.image_url} alt="" loading="lazy" decoding="async" width="200" height="200" /> : <b aria-hidden="true">{c.name.slice(0, 1)}</b>}</span>
          <span className="gs-circle__name">{c.name}</span>
        </Link>
      ))}
    </nav>
  );
}

function DailyEssentials({ products, status }) {
  const { hidden, title, sub, more, link } = useStorefrontSection('grocery', 'daily', GROCERY_SECTIONS.daily);
  const row = products.slice(0, DAILY_ESSENTIALS.limit);
  if (hidden) return null;
  return (
    <section className="gs-sec" aria-labelledby="gs-daily-h">
      <header className="gs-sec__head">
        <div><h2 className="gs-sec__h serif" id="gs-daily-h">{title}</h2>{sub && <p className="gs-sec__sub">{sub}</p>}</div>
        <Link to={link} className="gs-sec__link">{more} <Icon name="arrowRight" size={16} /></Link>
      </header>
      {row.length === 0 ? (
        <p className="gs-empty">{status === 'loading' ? 'Loading the catalogue…' : status === 'error' ? 'The grocery catalogue could not be loaded. Please try again shortly.' : 'The grocery store is being stocked — products appear here as they go live.'}</p>
      ) : (
        <div className="gs-row">
          {row.map((p, i) => <GroceryProductCard key={p.id} product={p} mediaLoading={i < 2 ? 'eager' : 'lazy'} />)}
        </div>
      )}
    </section>
  );
}

function PromoStrip() {
  const promo = useStorefrontSection('grocery', 'promo', GROCERY_SECTIONS.promo);
  if (promo.hidden) return null;
  const { colour, phone, desktop } = promo.picture;
  return (
    <section className="gs-promo" {...tone(colour)} aria-labelledby="gs-promo-h">
      <div className="gs-promo__art" aria-hidden="true">{photo(phone, desktop, <img src={desktop} alt="" loading="lazy" decoding="async" width="1200" height="675" />)}</div>
      <div className="gs-promo__txt">
        <h2 className="gs-promo__h serif" id="gs-promo-h">{promo.headline}</h2>
        <p className="gs-promo__sub">{promo.sub}</p>
        <Link to={promo.link} className="gs-promo__cta">{promo.cta} <Icon name="arrowRight" size={16} /></Link>
      </div>
    </section>
  );
}

export default function GroceryHome() {
  const { status, categories, products } = useGroceryCatalogue();
  return (
    <div className="gs-home">
      <TrustStrip />
      <HeroCarousel />
      <CategoryCircles categories={categories} />
      <DailyEssentials products={products} status={status} />
      <PromoStrip />
    </div>
  );
}
