import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../lib/store.jsx';
import { money } from '../lib/format.js';
import Icon from './Icon.jsx';
import MobileTabBar from './MobileTabBar.jsx';

// The phone's floating cart bar, sitting on the bottom navigation.
// Round 35 (owner, 2026-11-21: "Blinkit/Zepto jaise" — the pattern, SORA's look): it now
// shows wherever a shopper browses, in all three stores — not only /shop and categories —
// with the last few things added as small pictures, what the bag saves on MRP, and a small
// bump each time something new lands. Purchase and account pages keep it out of the way
// (the product page's own buy bar retains priority).
export const CART_BAR_HIDDEN = /^\/(?:cart|checkout|product\/|fashion\/p\/|homeliving\/p\/|grocery\/p\/|account|invoice|passport|gift-receipt|admin|login|signin|creator|track)/;
export const cartBarRoute = (pathname) => !CART_BAR_HIDDEN.test(String(pathname || '/'));

/** A line's picture, from any store's hydrated line. */
const lineImage = (l) => l?.product?.image || (Array.isArray(l?.product?.images) ? l.product.images.find(Boolean) : null) || null;

export default function MobileCartSummary({ tabbar = null }) {
  const { pathname } = useLocation();
  const { cartCount, subtotal, savings, cartDetailed } = useStore();
  const visible = cartBarRoute(pathname) && cartCount > 0;

  // A bump when the count goes up (not when it goes down).
  const prev = useRef(cartCount);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (cartCount > prev.current) setBump((b) => b + 1);
    prev.current = cartCount;
  }, [cartCount]);

  const thumbs = (cartDetailed || []).map(lineImage).filter(Boolean).slice(-3).reverse();

  return (
    <div className={`v2-cart-dock${visible ? ' v2-cart-dock--active' : ''}`}>
      {visible && (
        <aside key={bump} className={`v2-mobile-cart${bump ? ' v2-mobile-cart--bump' : ''}`} aria-label="Cart summary">
          {thumbs.length > 0 && (
            <span className="v2-mobile-cart__thumbs" aria-hidden="true">
              {thumbs.map((src, i) => <img key={src + i} src={src} alt="" width="34" height="34" loading="lazy" decoding="async" style={{ '--i': i }} />)}
            </span>
          )}
          {/* Count and amount share one line: the stacked block made the bar
              tall enough that, with the tab bar under it, the two together
              covered a meaningful slice of a 390px screen. */}
          <div className="v2-mobile-cart__totals" aria-live="polite" aria-atomic="true">
            <strong className="v2-mobile-cart__subtotal">
              <span className="sr-only">Item subtotal </span>{money(subtotal)}
            </strong>
            <span className="v2-mobile-cart__count">
              {cartCount} {cartCount === 1 ? 'item' : 'items'}
            </span>
            {savings > 0 && <span className="v2-mobile-cart__saved">Saved {money(savings)}</span>}
          </div>
          <Link to="/cart" className="v2-mobile-cart__link">
            View cart <Icon name="arrowRight" size={17} />
          </Link>
        </aside>
      )}
      {tabbar || <MobileTabBar />}
    </div>
  );
}
