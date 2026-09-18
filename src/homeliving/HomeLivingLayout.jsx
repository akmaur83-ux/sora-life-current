import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Footer from '../components/Footer.jsx';
import Toasts from '../components/Toasts.jsx';
import { useStore } from '../lib/store.jsx';
import { branding } from '../lib/settings.js';
import { HOMELIVING_DELIVERY_WINDOW, HOMELIVING_TAGLINE, categoryHref, useHomeLivingCatalogue } from '../data/homelivingHomepage.js';

// ============================================================
// The Home & Living store shell — its own header (menu, centred wordmark,
// the other stores, wishlist, cart), the delivery row, a visual-only
// search bar, then the page, the storefront's own footer, and the phone
// bottom nav. The cart badge is the shared store's count, so a wellness,
// fashion or grocery item in the bag shows here too. Built on the
// /grocery shell pattern; namespaced .hl-*.
//
// Delivery copy is the one factual promise the store makes:
// "Standard Delivery / 6-7 days" (HOMELIVING_DELIVERY_WINDOW). Nothing here
// says otherwise.
// ============================================================

const SEARCH_PLACEHOLDER = 'Search for bedsheets, curtains, cushions...';

/** Home is the only live tab; the rest render, do nothing, and never 404. */
export const BOTTOM_NAV = [
  { id: 'home', label: 'Home', icon: 'home', href: '/homeliving' },
  { id: 'categories', label: 'Categories', icon: 'grid' },
  { id: 'offers', label: 'Offers', icon: 'tag' },
  { id: 'orders', label: 'Orders', icon: 'package' },
  { id: 'account', label: 'Account', icon: 'user' },
];

function HomeLivingLogo() {
  return (
    <Link to="/homeliving" className="hl-logo" aria-label={`${branding.siteName} Home & Living home`}>
      <strong className="serif">{branding.siteName}</strong>
      <em>{HOMELIVING_TAGLINE}</em>
    </Link>
  );
}

export function HomeLivingHeader({ onMenu }) {
  const { cartCount } = useStore();
  return (
    <header className="hl-hdr">
      <div className="hl-hdr__row">
        <button type="button" className="hl-hdr__menu" aria-label="Open menu" onClick={onMenu}><Icon name="menu" size={26} /></button>
        <HomeLivingLogo />
        <nav className="hl-hdr__acts" aria-label="Wishlist and cart">
          {/* The other storefronts: quiet text links (desktop); the drawer carries them on a phone. */}
          <span className="hl-hdr__stores" role="navigation" aria-label="Other stores">
            <Link to="/" className="hl-hdr__store"><Icon name="chevronLeft" size={15} /> Wellness store</Link>
            <Link to="/fashion" className="hl-hdr__store">Fashion <Icon name="chevronRight" size={15} /></Link>
            <Link to="/grocery" className="hl-hdr__store">Grocery <Icon name="chevronRight" size={15} /></Link>
          </span>
          <button type="button" className="hl-hdr__act" aria-label="Wishlist" aria-disabled="true"><Icon name="heart" size={24} /></button>
          <Link to="/cart" className="hl-hdr__act" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`}>
            <Icon name="bag" size={24} />{cartCount > 0 && <span className="hl-hdr__count">{cartCount}</span>}
          </Link>
        </nav>
      </div>
      <div className="hl-deliver" aria-label="Delivery">
        <span className="hl-deliver__addr">
          <Icon name="mapPin" size={22} />
          <span className="hl-deliver__txt">
            <b>Deliver to Home <Icon name="chevronDown" size={14} /></b>
            <em>Add your delivery address at checkout</em>
          </span>
        </span>
        <span className="hl-deliver__badge"><Icon name="truck" size={16} /> Standard Delivery · {HOMELIVING_DELIVERY_WINDOW}</span>
      </div>
      {/* Visual only for now: no search route exists in the Home & Living store yet. */}
      <div className="hl-search" role="search" aria-label="Search Home & Living">
        <Icon name="search" size={22} />
        <input type="search" placeholder={SEARCH_PLACEHOLDER} aria-label="Search Home & Living (coming soon)" readOnly />
      </div>
    </header>
  );
}

export function BottomNav() {
  return (
    <nav className="hl-nav" aria-label="Home & Living">
      {BOTTOM_NAV.map((item) => (item.href
        ? <Link key={item.id} to={item.href} className="hl-nav__item is-on" aria-current="page"><Icon name={item.icon} size={24} /><span>{item.label}</span></Link>
        : <span key={item.id} className="hl-nav__item" aria-disabled="true"><Icon name={item.icon} size={24} /><span>{item.label}</span></span>))}
    </nav>
  );
}

function Drawer({ open, onClose }) {
  const { categories } = useHomeLivingCatalogue();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="hl-drawer" role="dialog" aria-modal="true" aria-label="Home & Living menu">
      <button type="button" className="hl-drawer__scrim" aria-label="Close menu" onClick={onClose} />
      <div className="hl-drawer__panel">
        <div className="hl-drawer__head"><strong>Shop Home &amp; Living</strong><button type="button" className="hl-drawer__x" aria-label="Close menu" onClick={onClose}><Icon name="x" size={20} /></button></div>
        <nav className="hl-drawer__nav">
          <ul>{categories.map((c) => <li key={c.id}><Link to={categoryHref(c)} onClick={onClose}>{c.name}</Link></li>)}</ul>
        </nav>
        <Link to="/fashion" className="hl-drawer__back" onClick={onClose}><Icon name="chevronRight" size={16} /> Fashion store</Link>
        <Link to="/grocery" className="hl-drawer__back" onClick={onClose}><Icon name="chevronRight" size={16} /> Grocery store</Link>
        <Link to="/" className="hl-drawer__back" onClick={onClose}><Icon name="chevronLeft" size={16} /> Back to the wellness store</Link>
      </div>
    </div>
  );
}

export default function HomeLivingLayout() {
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setMenu(false); }, [pathname]);
  return (
    <div className="hl">
      <HomeLivingHeader onMenu={() => setMenu(true)} />
      {/* Fixed to the bottom of a phone; a static strip under the header on a wide screen. */}
      <BottomNav />
      <Drawer open={menu} onClose={() => setMenu(false)} />
      <main className="hl-main"><Outlet /></main>
      <Footer />
      <Toasts />
    </div>
  );
}
