import { NavLink, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useStore } from '../lib/store.jsx';
import { isWinterSeason } from '../lib/winterDeals.js';

// Mobile-only bottom navigation — thumb-reachable core actions.
// 2026-11-13 redesign: the same bar in the Fashion store too (FashionLayout), its
// Home, Saved and categories pointing at that store; Home & Living has its own (.hl-nav).
const LINKS = {
  wellness: { home: '/', shop: '/shop', shopLabel: 'Shop', saved: '/wishlist' },
  fashion: { home: '/fashion', shop: '/categories?store=fashion', shopLabel: 'Categories', saved: '/fashion/wishlist' },
};

/**
 * Which tab is lit, 0–4, or -1 when none is (round 32): the winter bar's sliding glow sits
 * under it. Pure: the same matching as the links' own active state.
 */
export function activeTab(pathname, L) {
  const p = String(pathname || '');
  const path = (to) => to.split('?')[0];
  if (p === path(L.home) || p === `${path(L.home)}/`) return 0;
  if (p.startsWith(path(L.shop))) return 1;
  if (p.startsWith(L.saved)) return 2;
  if (p.startsWith('/cart')) return 3;
  if (p.startsWith('/account')) return 4;
  return -1;
}

export default function MobileTabBar({ store = 'wellness', savedCount = null }) {
  const { cartCount, wishCount } = useStore();
  const L = LINKS[store] || LINKS.wellness;
  const saved = savedCount ?? wishCount;
  const item = ({ isActive }) => `tabbar__item ${isActive ? 'active' : ''}`;
  // Winter (owner, 2026-11-21: "niche bar ... winter theme pe hi cool animations"): November
  // to February the bar turns night-blue with snow on its edge, a glow sliding to the lit tab,
  // the icon hopping and a snowflake rising when a tab is chosen (sora-ds.css).
  const winter = isWinterSeason();
  const { pathname } = useLocation();
  const on = winter ? activeTab(pathname, L) : -1;
  return (
    <nav className={`tabbar only-mobile tabbar--${store}${winter ? ' tabbar--winter' : ''}`} aria-label="Mobile navigation">
      {winter && <span className="tabbar__glide" aria-hidden="true" style={{ '--i': on, opacity: on < 0 ? 0 : 1 }} />}
      <NavLink to={L.home} className={item} end><Icon name="home" size={22} /><span>Home</span></NavLink>
      <NavLink to={L.shop} className={item}><Icon name="grid" size={22} /><span>{L.shopLabel}</span></NavLink>
      <NavLink to={L.saved} className={item}>
        <span className="tabbar__ic"><Icon name="heart" size={22} />{saved > 0 && <i className="tabbar__dot" key={saved} />}</span>
        <span>Saved</span>
      </NavLink>
      <NavLink to="/cart" className={item}>
        <span className="tabbar__ic"><Icon name="bag" size={22} />{cartCount > 0 && <i className="tabbar__badge" key={cartCount}>{cartCount}</i>}</span>
        <span>Cart</span>
      </NavLink>
      <NavLink to="/account" className={item}><Icon name="user" size={22} /><span>Account</span></NavLink>
    </nav>
  );
}
