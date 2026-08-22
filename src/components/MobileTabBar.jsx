import { NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useStore } from '../lib/store.jsx';

// Mobile-only bottom navigation — thumb-reachable core actions.
export default function MobileTabBar() {
  const { cartCount, wishCount } = useStore();
  const item = ({ isActive }) => `tabbar__item ${isActive ? 'active' : ''}`;
  return (
    <nav className="tabbar only-mobile" aria-label="Mobile navigation">
      <NavLink to="/" className={item} end><Icon name="home" size={22} /><span>Home</span></NavLink>
      <NavLink to="/shop" className={item}><Icon name="grid" size={22} /><span>Shop</span></NavLink>
      <NavLink to="/wishlist" className={item}>
        <span className="tabbar__ic"><Icon name="heart" size={22} />{wishCount > 0 && <i className="tabbar__dot" key={wishCount} />}</span>
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
