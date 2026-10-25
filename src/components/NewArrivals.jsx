import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import DeferredImage from './DeferredImage.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import { useNewArrivals, STORE_LISTING } from '../lib/newArrivals.js';
import { money } from '../lib/format.js';

// ============================================================
// New Arrivals — mid-page on the wellness homepage (Home.jsx: after the
// offers, before the Lifestyle banner), a sliding row of the products
// flagged new across wellness, fashion and Home & Living (newArrivals.js).
// Each card is a picture, the name and the price, linking to the product
// page; no Add button.
//
// The fashion category strip's behaviour: how many cards are in view is the
// stylesheet's (--per on the track) and the track moves by whole cards on
// transform only; it advances on its own only when there is somewhere to go,
// pauses on hover and on focus, and never moves under prefers-reduced-motion
// (read when a tick fires). Arrows step a card; a sideways swipe of 40px or
// more steps one and swallows the click that would follow. Cards outside the
// window are hidden from assistive technology and untabbable, and the
// viewport never scrolls (a focused card could otherwise pull it along).
//
// The page's own language: the warm tint, the heading with its orange rule
// and "View All" on the same line (the "Explore the stores" heading), square
// edges. Nothing flagged new, or the section hidden in Storefronts → Wellness:
// no section at all.
// ============================================================
export const NEW_ARRIVALS_AUTOPLAY_MS = 4500; // the fashion strip's pace

/** The section's built-in content; an empty link is the newest arrival's store (viewAllLink). */
export const NEW_ARRIVALS_SECTION = Object.freeze({ hidden: false, title: 'New Arrivals', more: 'View All', link: '' });

/** Where "View All" goes: the link set in Storefronts, else the listing of the store the newest card comes from. */
export const viewAllLink = (link, items) => link || STORE_LISTING[items[0]?.store] || STORE_LISTING.wellness;

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

export function NewArrivals({ items: given, autoplayMs = NEW_ARRIVALS_AUTOPLAY_MS }) {
  const section = useStorefrontSection('wellness', 'newArrivals', NEW_ARRIVALS_SECTION);
  const loaded = useNewArrivals();
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
  return (
    <section className="hx hx-new" aria-labelledby="hx-new-h">
      <div className="hx-wrap" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
        <div className="hx-stores__head">
          <h2 className="hx-stores__h" id="hx-new-h">{section.title}</h2>
          <div className="hx-new__tools">
            <Link to={viewAllLink(section.link, items)} className="hx-more" aria-label={section.more === NEW_ARRIVALS_SECTION.more ? 'View all new arrivals' : undefined}>{section.more} <Icon name="arrowRight" size={15} /></Link>
            {last > 0 && (
              <div className="hx-new__arrows">
                <button type="button" aria-label="Previous products" disabled={index === 0} onClick={() => step(-1)}><Icon name="chevronLeft" size={18} /></button>
                <button type="button" aria-label="Next products" disabled={index >= last} onClick={() => step(1)}><Icon name="chevronRight" size={18} /></button>
              </div>
            )}
          </div>
        </div>
        <div className="hx-new__viewport" aria-roledescription="carousel" aria-label="New arrivals"
          onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { swipe.current = { x: null, y: null, moved: false }; }} onClickCapture={onClickCapture}
          onScroll={(e) => { if (e.currentTarget.scrollLeft) e.currentTarget.scrollLeft = 0; }}>
          <ul className="hx-new__track" ref={track} style={{ '--i': index }}>
            {items.map((p, i) => {
              const inView = i >= index && i < index + per;
              return (
                <li key={p.key} className="hx-new__item" aria-hidden={!inView}>
                  <Link to={p.href} className="hx-new__card" tabIndex={inView ? undefined : -1}>
                    <span className={`hx-new__art${p.store === 'wellness' ? ' hx-new__art--whole' : ''}`}>
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
