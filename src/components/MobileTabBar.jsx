import { NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useStore } from '../lib/store.jsx';

// Mobile-only bottom navigation — thumb-reachable core actions.
// 2026-11-13 redesign: the same bar in the Fashion store too (FashionLayout), its
// Home, Saved and categories pointing at that store; Home & Living has its own (.hl-nav).
const LINKS = {
  wellness: { home: '/', shop: '/shop', shopLabel: 'Shop', saved: '/wishlist' },
  fashion: { home: '/fashion', shop: '/categories?store=fashion', shopLabel: 'Categories', saved: '/fashion/wishlist' },
};

export default function MobileTabBar({ store = 'wellness', savedCount = null }) {
  const { cartCount, wishCount } = useStore();
  const L = LINKS[store] || LINKS.wellness;
  const saved = savedCount ?? wishCount;
  const item = ({ isActive }) => `tabbar__item ${isActive ? 'active' : ''}`;
  return (
    <nav className={`tabbar only-mobile tabbar--${store}`} aria-label="Mobile navigation">
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
