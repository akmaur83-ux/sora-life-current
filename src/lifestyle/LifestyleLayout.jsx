import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Footer from '../components/Footer.jsx';
import Toasts from '../components/Toasts.jsx';
import { useStore } from '../lib/store.jsx';
import { branding } from '../lib/settings.js';
import { LIFESTYLE_TAGLINE, fashionCategoryHref, homeCategoryHref, useLifestyleCatalogue } from '../data/lifestyleHomepage.js';

// ============================================================
// The lifestyle storefront shell (/lifestyle) — the roof over the fashion
// and Home & Living stores. Its own header (menu, centred wordmark, search,
// wishlist, cart), the page, the storefront's own footer, and the phone
// bottom nav. The cart badge is the shared store's count, so a wellness,
// fashion or grocery item in the bag shows here too. Built on the
// /homeliving shell pattern; namespaced .ls-*.
//
// Nothing is sold from this shell: every link goes into one of the two
// stores. Search and wishlist are visual until those routes exist here.
// ============================================================

/** Home is the only live tab; the rest render, do nothing, and never 404. */
export const BOTTOM_NAV = [
  { id: 'home', label: 'Home', icon: 'home', href: '/lifestyle' },
  { id: 'shop', label: 'Shop', icon: 'bag' },
  { id: 'categories', label: 'Categories', icon: 'grid' },
  { id: 'saved', label: 'Saved', icon: 'heart' },
  { id: 'account', label: 'Account', icon: 'user' },
];

/** The other storefronts, in the header on a wide screen and in the drawer on a phone. */
export const OTHER_STORES = [
  { href: '/', label: 'Wellness store', short: 'Wellness', back: true },
  { href: '/fashion', label: 'Fashion store', short: 'Fashion' },
  { href: '/homeliving', label: 'Home & Living store', short: 'Home & Living' },
  { href: '/grocery', label: 'Grocery store', short: 'Grocery' },
];

function LifestyleLogo() {
  return (
    <Link to="/lifestyle" className="ls-logo" aria-label={`${branding.siteName} lifestyle home`}>
      <strong className="serif">{branding.siteName}</strong>
      <em>{LIFESTYLE_TAGLINE}</em>
    </Link>
  );
}

export function LifestyleHeader({ onMenu }) {
  const { cartCount } = useStore();
  return (
    <header className="ls-hdr">
      <div className="ls-hdr__row">
        <button type="button" className="ls-hdr__menu" aria-label="Open menu" onClick={onMenu}><Icon name="menu" size={26} /></button>
        <LifestyleLogo />
        <nav className="ls-hdr__acts" aria-label="Search, wishlist and cart">
          <span className="ls-hdr__stores" role="navigation" aria-label="Other stores">
            {OTHER_STORES.map((s) => (
              <Link key={s.href} to={s.href} className="ls-hdr__store">
                {s.back && <Icon name="chevronLeft" size={15} />}{s.short}{!s.back && <Icon name="chevronRight" size={15} />}
              </Link>
            ))}
          </span>
          <button type="button" className="ls-hdr__act" aria-label="Search (coming soon)" aria-disabled="true"><Icon name="search" size={24} /></button>
          <button type="button" className="ls-hdr__act" aria-label="Wishlist (coming soon)" aria-disabled="true"><Icon name="heart" size={24} /></button>
          <Link to="/cart" className="ls-hdr__act" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`}>
            <Icon name="bag" size={24} />{cartCount > 0 && <span className="ls-hdr__count">{cartCount}</span>}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function BottomNav() {
  return (
    <nav className="ls-nav" aria-label="Lifestyle">
      {BOTTOM_NAV.map((item) => (item.href
        ? <Link key={item.id} to={item.href} className="ls-nav__item is-on" aria-current="page"><Icon name={item.icon} size={24} /><span>{item.label}</span></Link>
        : <span key={item.id} className="ls-nav__item" aria-disabled="true"><Icon name={item.icon} size={24} /><span>{item.label}</span></span>))}
    </nav>
  );
}

function Drawer({ open, onClose }) {
  const { homeCategories, fashionCategories } = useLifestyleCatalogue();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ls-drawer" role="dialog" aria-modal="true" aria-label="Lifestyle menu">
      <button type="button" className="ls-drawer__scrim" aria-label="Close menu" onClick={onClose} />
      <div className="ls-drawer__panel">
        <div className="ls-drawer__head"><strong>Shop by store</strong><button type="button" className="ls-drawer__x" aria-label="Close menu" onClick={onClose}><Icon name="x" size={20} /></button></div>
        <nav className="ls-drawer__nav" aria-label="Home & Living">
          <h3 className="ls-drawer__h">Home &amp; Living</h3>
          <ul>{homeCategories.map((c) => <li key={c.id}><Link to={homeCategoryHref(c)} onClick={onClose}>{c.name}</Link></li>)}</ul>
        </nav>
        <nav className="ls-drawer__nav" aria-label="Fashion">
          <h3 className="ls-drawer__h">Fashion</h3>
          <ul>{fashionCategories.map((c) => <li key={c.id}><Link to={fashionCategoryHref(c)} onClick={onClose}>{c.name}</Link></li>)}</ul>
        </nav>
        {OTHER_STORES.map((s) => (
          <Link key={s.href} to={s.href} className="ls-drawer__back" onClick={onClose}>
            <Icon name={s.back ? 'chevronLeft' : 'chevronRight'} size={16} /> {s.back ? 'Back to the wellness store' : s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function LifestyleLayout() {
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setMenu(false); }, [pathname]);
  return (
    <div className="ls">
      <LifestyleHeader onMenu={() => setMenu(true)} />
      {/* Fixed to the bottom of a phone; a static strip under the header on a wide screen. */}
      <BottomNav />
      <Drawer open={menu} onClose={() => setMenu(false)} />
      <main className="ls-main"><Outlet /></main>
      <Footer />
      <Toasts />
    </div>
  );
}
