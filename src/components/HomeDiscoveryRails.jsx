import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import ProductImage from './ProductImage.jsx';
import { selectCategoryCards, selectConcernCards } from '../lib/homeDiscovery.js';

// ============================================================
// DISCOVERY RAILS — "Shop by category" and "Shop by concerns".
//
// Editorial discovery, deliberately NOT a product card:
//
//   tile      a wide landscape image, edge to edge, sharp corners, no border
//   title     set over the artwork for categories; concerns carry no overlay
//   caption   one quiet line under the tile, and nothing else — no price, no
//             count, no badge, no per-card arrow
//   controls  one row under the rail: chevron, centred progress, chevron
//
// Two tiles are in view on a phone and four to five on a desktop, on a
// scroll-snap rail. Every card is a single link over the whole tile.
// ============================================================

/** Chevron / progress / chevron. Reflects real scroll, never fakes it. */
function RailControls({ railRef, label }) {
  const [state, setState] = useState({ ratio: 0, thumb: 1, atStart: true, atEnd: true });

  const measure = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setState({
      ratio: max > 0 ? el.scrollLeft / max : 0,
      thumb: el.scrollWidth > 0 ? Math.max(0.2, el.clientWidth / el.scrollWidth) : 1,
      atStart: el.scrollLeft <= 1,
      atEnd: max <= 1 || el.scrollLeft >= max - 1,
    });
  }, [railRef]);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return undefined;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', measure); ro?.disconnect(); };
  }, [measure, railRef]);

  // Step by whole tiles so the snap points stay aligned with what is in view.
  const nudge = (dir) => {
    const el = railRef.current;
    if (!el) return;
    const card = el.firstElementChild;
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step * 2, behavior: 'smooth' });
  };

  // Nothing to scroll: show no controls rather than dead ones.
  if (state.atStart && state.atEnd) return null;

  return (
    <div className="hd-nav">
      <button type="button" className="hd-nav__btn" onClick={() => nudge(-1)}
        disabled={state.atStart} aria-label={`Scroll ${label} backward`}>
        <Icon name="chevronLeft" size={18} stroke={1.8} />
      </button>
      <span className="hd-nav__track" aria-hidden="true">
        <span
          className="hd-nav__thumb"
          style={{
            width: `${state.thumb * 100}%`,
            transform: `translateX(${(state.ratio * (1 - state.thumb) * 100) / (state.thumb || 1)}%)`,
          }}
        />
      </span>
      <button type="button" className="hd-nav__btn" onClick={() => nudge(1)}
        disabled={state.atEnd} aria-label={`Scroll ${label} forward`}>
        <Icon name="chevronRight" size={18} stroke={1.8} />
      </button>
    </div>
  );
}

function DiscoveryRail({ id, title, label, children }) {
  const railRef = useRef(null);
  return (
    <section className="v2-sec hd-section" data-home-section={id}>
      <div className="v2-wrap">
        <h2 className="hd-title">{title}</h2>
        <ul className="hd-rail" ref={railRef} aria-label={label}>{children}</ul>
        <RailControls railRef={railRef} label={label} />
      </div>
    </section>
  );
}

/**
 * One discovery tile.
 *
 * `image` is an admin-assigned or committed asset URL. `product` is only the
 * last-resort visual, used when neither exists (see homeDiscovery.js).
 * `overlay` sets the title over the artwork, which categories use and
 * concerns do not.
 */
function DiscoveryTile({ to, image, product, caption, overlay = false }) {
  return (
    <li className={`hd-tile${overlay ? ' hd-tile--overlay' : ''}`}>
      <Link to={to} className="hd-tile__link">
        <span className="hd-tile__media">
          {image
            ? <img src={image} alt="" loading="lazy" decoding="async" />
            : <ProductImage product={product} frame="v2" sizes="(max-width: 767px) 46vw, 300px" />}
          {overlay && <span className="hd-tile__overlay">{caption}</span>}
        </span>
        {/* The title is shown once: over the artwork for categories, beneath
            it for concerns. Repeating it in both places read as a bug. */}
        {!overlay && <span className="hd-tile__caption">{caption}</span>}
      </Link>
    </li>
  );
}

export function ShopByCategory({ cards }) {
  const list = Array.isArray(cards) ? cards : selectCategoryCards();
  if (list.length < 3) return null;
  return (
    <DiscoveryRail id="shop-by-category" title="Shop by Category" label="Shop by category">
      {list.map((card) => (
        <DiscoveryTile
          key={card.slug}
          to={card.to}
          image={card.image}
          product={card.fallbackProduct}
          caption={card.name}
          overlay
        />
      ))}
    </DiscoveryRail>
  );
}

export function ShopByConcerns({ cards }) {
  const list = Array.isArray(cards) ? cards : selectConcernCards();
  // selectConcernCards already returns [] when too few are backed.
  if (!list.length) return null;
  return (
    <DiscoveryRail id="shop-by-concerns" title="Shop by Concerns" label="Shop by concerns">
      {list.map((card) => (
        <DiscoveryTile
          key={card.id}
          to={card.to}
          image={card.image}
          product={card.product}
          caption={card.label}
        />
      ))}
    </DiscoveryRail>
  );
}
