import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Footer from '../components/Footer.jsx';
import Toasts from '../components/Toasts.jsx';
import { useStore } from '../lib/store.jsx';
import { branding } from '../lib/settings.js';
import { GROCERY_DELIVERY_WINDOW, GROCERY_TAGLINE, categoryHref, useGroceryCatalogue } from '../data/groceryHomepage.js';

// ============================================================
// The grocery store shell — its own header (menu, centred wordmark,
// wishlist, cart), the delivery row, a visual-only search bar, then the
// page, the storefront's own footer, and the phone bottom nav. The cart
// badge is the shared store's count, so a wellness or fashion item in the
// bag shows here too. Built on the /fashion shell pattern; namespaced .gs-*.
//
// Delivery copy is the one factual promise the store makes:
// "Delivery in 6-7 days" (GROCERY_DELIVERY_WINDOW). Nothing here says
// otherwise.
// ============================================================

const SEARCH_PLACEHOLDER = 'Search for groceries, staples, and more...';

/** Home is the only live tab; the rest render, do nothing, and never 404. */
export const BOTTOM_NAV = [
  { id: 'home', label: 'Home', icon: 'home', href: '/grocery' },
  { id: 'categories', label: 'Categories', icon: 'grid' },
  { id: 'offers', label: 'Offers', icon: 'tag' },
  { id: 'orders', label: 'Orders', icon: 'package' },
  { id: 'account', label: 'Account', icon: 'user' },
];

function GroceryLogo() {
  return (
    <Link to="/grocery" className="gs-logo" aria-label={`${branding.siteName} grocery home`}>
      <strong className="serif">{branding.siteName}</strong>
      <em>{GROCERY_TAGLINE}</em>
    </Link>
  );
}

export function GroceryHeader({ onMenu }) {
  const { cartCount } = useStore();
  return (
    <header className="gs-hdr">
      <div className="gs-hdr__row">
        <button type="button" className="gs-hdr__menu" aria-label="Open menu" onClick={onMenu}><Icon name="menu" size={26} /></button>
        <GroceryLogo />
        <nav className="gs-hdr__acts" aria-label="Wishlist and cart">
          {/* The other storefronts: quiet text links (desktop); the drawer carries them on a phone. */}
          <span className="gs-hdr__stores" role="navigation" aria-label="Other stores">
            <Link to="/" className="gs-hdr__store"><Icon name="chevronLeft" size={15} /> Wellness store</Link>
            <Link to="/fashion" className="gs-hdr__store">Fashion <Icon name="chevronRight" size={15} /></Link>
            <Link to="/homeliving" className="gs-hdr__store">Home &amp; Living <Icon name="chevronRight" size={15} /></Link>
            <Link to="/lifestyle" className="gs-hdr__store">Lifestyle <Icon name="chevronRight" size={15} /></Link>
          </span>
          <button type="button" className="gs-hdr__act" aria-label="Wishlist" aria-disabled="true"><Icon name="heart" size={24} /></button>
          <Link to="/cart" className="gs-hdr__act" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`}>
            <Icon name="bag" size={24} />{cartCount > 0 && <span className="gs-hdr__count">{cartCount}</span>}
          </Link>
        </nav>
      </div>
      <div className="gs-deliver" aria-label="Delivery">
        <span className="gs-deliver__addr">
          <Icon name="mapPin" size={22} />
          <span className="gs-deliver__txt">
            <b>Deliver to Home <Icon name="chevronDown" size={14} /></b>
            <em>Add your delivery address at checkout</em>
          </span>
        </span>
        <span className="gs-deliver__badge"><Icon name="leaf" size={16} /> Delivery in {GROCERY_DELIVERY_WINDOW}</span>
      </div>
      {/* Visual only for now: no search route exists in the grocery store yet. */}
      <div className="gs-search" role="search" aria-label="Search groceries">
        <Icon name="search" size={22} />
        <input type="search" placeholder={SEARCH_PLACEHOLDER} aria-label="Search groceries (coming soon)" readOnly />
      </div>
    </header>
  );
}

export function BottomNav() {
  return (
    <nav className="gs-nav" aria-label="Grocery">
      {BOTTOM_NAV.map((item) => (item.href
        ? <Link key={item.id} to={item.href} className="gs-nav__item is-on" aria-current="page"><Icon name={item.icon} size={24} /><span>{item.label}</span></Link>
        : <span key={item.id} className="gs-nav__item" aria-disabled="true"><Icon name={item.icon} size={24} /><span>{item.label}</span></span>))}
    </nav>
  );
}

function Drawer({ open, onClose }) {
  const { categories } = useGroceryCatalogue();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="gs-drawer" role="dialog" aria-modal="true" aria-label="Grocery menu">
      <button type="button" className="gs-drawer__scrim" aria-label="Close menu" onClick={onClose} />
      <div className="gs-drawer__panel">
        <div className="gs-drawer__head"><strong>Shop groceries</strong><button type="button" className="gs-drawer__x" aria-label="Close menu" onClick={onClose}><Icon name="x" size={20} /></button></div>
        <nav className="gs-drawer__nav">
          <ul>{categories.map((c) => <li key={c.id}><Link to={categoryHref(c)} onClick={onClose}>{c.name}</Link></li>)}</ul>
        </nav>
        <Link to="/fashion" className="gs-drawer__back" onClick={onClose}><Icon name="chevronRight" size={16} /> Fashion store</Link>
        <Link to="/homeliving" className="gs-drawer__back" onClick={onClose}><Icon name="chevronRight" size={16} /> Home &amp; Living store</Link>
        <Link to="/lifestyle" className="gs-drawer__back" onClick={onClose}><Icon name="chevronRight" size={16} /> Lifestyle store</Link>
        <Link to="/" className="gs-drawer__back" onClick={onClose}><Icon name="chevronLeft" size={16} /> Back to the wellness store</Link>
      </div>
    </div>
  );
}

export default function GroceryLayout() {
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setMenu(false); }, [pathname]);
  return (
    <div className="gs">
      <GroceryHeader onMenu={() => setMenu(true)} />
      {/* Fixed to the bottom of a phone; a static strip under the header on a wide screen. */}
      <BottomNav />
      <Drawer open={menu} onClose={() => setMenu(false)} />
      <main className="gs-main"><Outlet /></main>
      <Footer />
      <Toasts />
    </div>
  );
}
