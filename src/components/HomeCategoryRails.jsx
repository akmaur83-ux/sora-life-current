import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import DeferredImage from './DeferredImage.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import { useCategoryRail, categoryListing } from '../lib/homeCategoryRail.js';
import { money } from '../lib/format.js';

// ============================================================
// Two category rails on the wellness homepage (Home.jsx: where the offers
// end and the Lifestyle banner begins) — Luxury Beds and then Bedsheets,
// the live products of Home & Living's Beds and Bedsheets categories in
// the catalogue's own order (homeCategoryRail.js). Each card is a picture,
// the name and the price, linking to the product page; no Add button.
//
// They behave and look exactly as New Arrivals does, and share its
// stylesheet (.hx-new in v2-home.css) so the three read as one row type:
// how many cards are in view is the stylesheet's (--per on the track, five
// / three / two down to a phone) and the track moves by whole cards on
// transform only; it advances on its own only when there is somewhere to
// go, pauses on hover and on focus, and never moves under
// prefers-reduced-motion (read when a tick fires). Arrows step a card; a
// sideways swipe of 40px or more steps one and swallows the click that
// would follow. Cards outside the window are hidden from assistive
// technology and untabbable, and the viewport never scrolls.
//
// NewArrivals.jsx is left untouched on purpose: it is pinned by its own
// test, and a category rail answers a different question (one category,
// the catalogue's order) from the one it answers (anything flagged new,
// newest first, across three stores).
//
// An empty category, or the section hidden in Storefronts → Wellness: no
// section at all.
// ============================================================
export const CATEGORY_RAIL_AUTOPLAY_MS = 4500; // the New Arrivals pace

/** The sections' built-in content; an empty link is the category's own listing. */
export const LUXURY_BEDS_SECTION = Object.freeze({ hidden: false, title: 'Luxury Beds', more: 'View All', link: '' });
export const BEDSHEETS_SECTION = Object.freeze({ hidden: false, title: 'Bedsheets', more: 'View All', link: '' });

/** Where "View All" goes: the link set in Storefronts, else the category's listing. */
export const railLink = (link, store, slug) => link || categoryListing(store, slug);

/** The reduced-motion check, read when a tick fires rather than when it is scheduled. */
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
 * One rail. `id` names its heading, `store`/`slug` say which category it shows,
 * `sectionKey`/`defaults` which Storefronts section edits it. `items` is for a test.
 */
export function CategoryRail({ id, store, slug, sectionKey, defaults, label, items: given, autoplayMs = CATEGORY_RAIL_AUTOPLAY_MS }) {
  const section = useStorefrontSection('wellness', sectionKey, defaults);
  const loaded = useCategoryRail(store, slug);
  const items = (given ?? loaded) || [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [per, setPer] = useState(1);
  const track = useRef(null);
  const reduced = useReducedMotion();
  const swipe = useRef({ x: null, y: null, moved: false });
  const n = section.hidden ? 0 : items.length;
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
  const headingId = `hx-${id}-h`;
  return (
    <section className="hx hx-new" aria-labelledby={headingId}>
      <div className="hx-wrap" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
        <div className="hx-stores__head">
          <h2 className="hx-stores__h" id={headingId}>{section.title}</h2>
          <div className="hx-new__tools">
            <Link to={railLink(section.link, store, slug)} className="hx-more" aria-label={section.more === defaults.more ? `View all ${label.toLowerCase()}` : undefined}>{section.more} <Icon name="arrowRight" size={15} /></Link>
            {last > 0 && (
              <div className="hx-new__arrows">
                <button type="button" aria-label={`Previous ${label.toLowerCase()}`} disabled={index === 0} onClick={() => step(-1)}><Icon name="chevronLeft" size={18} /></button>
                <button type="button" aria-label={`Next ${label.toLowerCase()}`} disabled={index >= last} onClick={() => step(1)}><Icon name="chevronRight" size={18} /></button>
              </div>
            )}
          </div>
        </div>
        <div className="hx-new__viewport" aria-roledescription="carousel" aria-label={label}
          onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { swipe.current = { x: null, y: null, moved: false }; }} onClickCapture={onClickCapture}
          onScroll={(e) => { if (e.currentTarget.scrollLeft) e.currentTarget.scrollLeft = 0; }}>
          <ul className="hx-new__track" ref={track} style={{ '--i': index }}>
            {items.map((p, i) => {
              const inView = i >= index && i < index + per;
              return (
                <li key={p.key} className="hx-new__item" aria-hidden={!inView}>
                  <Link to={p.href} className="hx-new__card" tabIndex={inView ? undefined : -1}>
                    <span className="hx-new__art">
                      {p.image && <DeferredImage src={p.image} alt="" width={600} height={600} className="hx-new__image" />}
                    </span>
                    <span className="hx-new__name">{p.name}</span>
                    <span className="hx-new__price">{money(p.price)}</span>
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

export const LuxuryBeds = (props) => (
  <CategoryRail id="beds" store="homeliving" slug="beds" sectionKey="luxuryBeds" defaults={LUXURY_BEDS_SECTION} label="Luxury beds" {...props} />
);

export const Bedsheets = (props) => (
  <CategoryRail id="bedsheets" store="homeliving" slug="bedsheets" sectionKey="bedsheets" defaults={BEDSHEETS_SECTION} label="Bedsheets" {...props} />
);
