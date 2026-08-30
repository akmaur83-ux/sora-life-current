import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../lib/store.jsx';
import { money } from '../lib/format.js';
import Icon from './Icon.jsx';
import MobileTabBar from './MobileTabBar.jsx';

// Search results use /shop?q=...; purchase and non-storefront routes are
// deliberately excluded. The existing PDP purchase bar retains priority.
export default function MobileCartSummary() {
  const { pathname } = useLocation();
  const { cartCount, subtotal } = useStore();
  const browseRoute = /^\/(?:shop\/?|wishlist\/?|category\/[^/]+\/?)?$/.test(pathname);
  const visible = browseRoute && cartCount > 0;

  return (
    <div className={`v2-cart-dock${visible ? ' v2-cart-dock--active' : ''}`}>
      {visible && (
        <aside className="v2-mobile-cart" aria-label="Cart summary">
          <div className="v2-mobile-cart__totals" aria-live="polite" aria-atomic="true">
            <span className="v2-mobile-cart__count">{cartCount} {cartCount === 1 ? 'item' : 'items'}</span>
            <strong className="v2-mobile-cart__subtotal">
              <span className="sr-only">Item subtotal </span>{money(subtotal)}
            </strong>
          </div>
          <Link to="/cart" className="v2-mobile-cart__link">
            View cart <Icon name="arrowRight" size={17} />
          </Link>
        </aside>
      )}
      <MobileTabBar />
    </div>
  );
}
