import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Footer from '../components/Footer.jsx';
import Toasts from '../components/Toasts.jsx';
import { useStore } from '../lib/store.jsx';
import { branding } from '../lib/settings.js';
import { HOMELIVING_DELIVERY_WINDOW, HOMELIVING_TAGLINE, categoryHref, useHomeLivingCatalogue } from '../data/homelivingHomepage.js';
import SearchSuggest, { SUGGEST_MAX, suggestKeys, RecentSearches, readRecentSearches, rememberSearch, clearRecentSearches } from '../components/SearchSuggest.jsx';
import { searchItems } from '../lib/searchMatch.js';
import { useHomeLivingWishlist } from '../lib/homelivingWishlist.js';

// ============================================================
// The Home & Living store shell — its own header (menu, centred wordmark,
// the other stores, wishlist, cart), the delivery row, a visual-only
// search bar, then the page, the storefront's own footer, and the phone
// bottom nav. The cart badge is the shared store's count, so a wellness,
// fashion or grocery item in the bag shows here too. Built on the
// /grocery shell pattern; namespaced .hl-*.
//
// On the homepage the hero photograph runs to the top of the page and the
// header floats over its bare top strip — transparent until the page
// scrolls, then the solid cream bar it is everywhere else. Nothing sits
// above the photograph: the nav strip, the delivery row and the search bar
// are mounted by the page under the hero (BottomNav, DeliveryRow,
// SearchBar are exported for it). Every other page keeps the bar solid,
// with the delivery row and the search bar under it in one .hl-top block:
// on a wide screen the block sticks as one; up to 1019px (where the
// bottom nav is fixed) only the bar sticks and the delivery row and the
// search bar scroll away with the page, so they do not hold the first
// screen.
//
// Delivery copy is the one factual promise the store makes:
// "Standard Delivery / 6-7 days" (HOMELIVING_DELIVERY_WINDOW). Nothing here
// says otherwise.
// ============================================================

const SEARCH_PLACEHOLDER = 'Search bedsheets, curtains, cushions...';

/** The homepage, with or without the trailing slash: the only route whose header floats over the hero. */
const HOME_PATH = /^\/homeliving\/?$/;

/** How far the page scrolls before the floating header turns solid. */
export const SOLID_AFTER_PX = 8;

/** Home is the only live tab; the rest render, do nothing, and never 404. */
// Every tab goes somewhere since 2026-11-08 (Categories, Offers and Orders were inert):
// Categories to the category circles on the store's homepage, Wishlist (in place of
// Offers, which had no page) to this browser's list, Orders and Account to the account.
export const BOTTOM_NAV = [
  { id: 'home', label: 'Home', icon: 'home', href: '/homeliving' },
  { id: 'categories', label: 'Categories', icon: 'grid', href: '/homeliving#hl-cats-h' },
  { id: 'wishlist', label: 'Wishlist', icon: 'heart', href: '/homeliving/wishlist' },
  { id: 'orders', label: 'Orders', icon: 'package', href: '/account/orders' },
  { id: 'account', label: 'Account', icon: 'user', href: '/account' },
];

function HomeLivingLogo() {
  return (
    <Link to="/homeliving" className="hl-logo" aria-label={`${branding.siteName} Home & Living home`}>
      <strong className="serif">{branding.siteName}</strong>
      <em>{HOMELIVING_TAGLINE}</em>
    </Link>
  );
}

/**
 * True once the window has scrolled past `threshold` pixels. Passive,
 * rAF-throttled, the wellness header's pattern; a null threshold never
 * listens (the solid header on every other page has nothing to switch).
 */
function useScrolledPast(threshold) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (threshold == null || typeof window === 'undefined') return undefined;
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = null; setPast(window.scrollY > threshold); });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [threshold]);
  return past;
}

export function DeliveryRow() {
  return (
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
  );
}

/** Home & Living items as search rows: name, brand and category, with what a suggestion shows. */
export function homelivingSearchRows(products, categories) {
  const cat = new Map((categories || []).map((c) => [String(c.id), c.name]));
  return (products || []).map((p) => ({ key: p.id, href: `/homeliving/p/${p.slug}`, name: p.name, brand: p.brand, category: cat.get(String(p.category_id)) || '', image: p.images?.[0] || null, price: p.price, product: p }));
}

/**
 * The store's search (2026-11-08; it was visual only): live suggestions as you type,
 * Enter opens /homeliving/search?q=… (HomeLivingSearch.jsx).
 */
export function SearchBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { products, categories } = useHomeLivingCatalogue();
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const term = q.trim();
  const found = open && term.length >= 2 ? searchItems(homelivingSearchRows(products, categories), term) : null;
  const all = `/homeliving/search?q=${encodeURIComponent(term)}`;
  const [recent, setRecent] = useState([]);
  const pick = () => { setOpen(false); setActive(-1); if (term.length >= 2) rememberSearch('homeliving', term); };
  const keys = (e) => {
    if (e.key === 'Enter' && active < 0) { e.preventDefault(); pick(); navigate(term ? all : '/homeliving/search'); return; }
    suggestKeys(e, { count: Math.min(SUGGEST_MAX, found?.length || 0), active, setActive, open, setOpen, go: (i) => { pick(); navigate(found[i].href); } });
  };
  return (
    <div className="hl-search" role="search" aria-label="Search Home & Living">
      <Icon name="search" size={22} />
      <input type="search" placeholder={SEARCH_PLACEHOLDER} aria-label="Search Home & Living" value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }} onFocus={() => { setOpen(true); setRecent(readRecentSearches('homeliving')); }} onBlur={() => setOpen(false)} onKeyDown={keys}
        enterKeyHint="search" aria-expanded={found ? true : undefined} aria-controls={found ? 'hl-suggest' : undefined} />
      {found && <SearchSuggest id="hl-suggest" items={found} query={term} active={active} allHref={all} onPick={pick} />}
      {open && !term && <RecentSearches id="hl-recent" terms={recent} popular={(categories || []).filter((c) => !c.parent_id).map((c) => ({ name: c.name, href: `/homeliving/category/${c.slug}` }))} hrefFor={(t) => `/homeliving/search?q=${encodeURIComponent(t)}`} onPick={(e) => { if (e.currentTarget.classList.contains('hx-suggest__recent')) setQ(e.currentTarget.textContent); setOpen(false); }} onClear={() => { clearRecentSearches('homeliving'); setRecent([]); }} />}
    </div>
  );
}

/**
 * @param over  the homepage: the bar floats transparent over the hero and
 *              turns solid (`is-solid`) once the page scrolls; the delivery
 *              row and the search bar are the page's to place. Otherwise the
 *              bar and, under it, the delivery row and the search bar
 *              (.hl-tools--bar) in one .hl-top block.
 */
export function HomeLivingHeader({ onMenu, over = false }) {
  const { cartCount } = useStore();
  const solid = useScrolledPast(over ? SOLID_AFTER_PX : null);
  const bar = (
    <header className={`hl-hdr${over ? ' hl-hdr--over' : ''}${over && solid ? ' is-solid' : ''}`}>
      <div className="hl-hdr__row">
        <button type="button" className="hl-hdr__menu" aria-label="Open menu" onClick={onMenu}><Icon name="menu" size={26} /></button>
        <HomeLivingLogo />
        <nav className="hl-hdr__acts" aria-label="Wishlist and cart">
          {/* The other storefronts: quiet text links (desktop); the drawer carries them on a phone. */}
          <span className="hl-hdr__stores" role="navigation" aria-label="Other stores">
            <Link to="/" className="hl-hdr__store"><Icon name="chevronLeft" size={15} /> Wellness store</Link>
            <Link to="/fashion" className="hl-hdr__store">Fashion <Icon name="chevronRight" size={15} /></Link>
            <Link to="/grocery" className="hl-hdr__store">Grocery <Icon name="chevronRight" size={15} /></Link>
            <Link to="/lifestyle" className="hl-hdr__store">Lifestyle <Icon name="chevronRight" size={15} /></Link>
          </span>
          <WishLink />
          <Link to="/cart" className="hl-hdr__act" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`}>
            <Icon name="bag" size={24} />{cartCount > 0 && <span className="hl-hdr__count">{cartCount}</span>}
          </Link>
        </nav>
      </div>
    </header>
  );
  if (over) return bar;
  return <div className="hl-top">{bar}<div className="hl-tools hl-tools--bar"><DeliveryRow /><SearchBar /></div></div>;
}

/** The header heart: this browser's Home & Living wishlist, with its count. */
function WishLink() {
  const wish = useHomeLivingWishlist();
  return (
    <Link to="/homeliving/wishlist" className="hl-hdr__act" aria-label={`Wishlist${wish.count ? `, ${wish.count} items` : ''}`}>
      <Icon name="heart" size={24} />{wish.count > 0 && <span className="hl-hdr__count">{wish.count}</span>}
    </Link>
  );
}

export function BottomNav() {
  const { pathname, hash } = useLocation();
  const here = (item) => (item.id === 'home' ? pathname.replace(/\/$/, '') === '/homeliving' && hash !== '#hl-cats-h' : item.id === 'categories' ? hash === '#hl-cats-h' : pathname.startsWith(item.href));
  return (
    <nav className="hl-nav" aria-label="Home & Living">
      {BOTTOM_NAV.map((item) => (item.href
        ? <Link key={item.id} to={item.href} className={`hl-nav__item${here(item) ? ' is-on' : ''}`} aria-current={here(item) ? 'page' : undefined}><Icon name={item.icon} size={24} /><span>{item.label}</span></Link>
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
        <Link to="/lifestyle" className="hl-drawer__back" onClick={onClose}><Icon name="chevronRight" size={16} /> Lifestyle store</Link>
        <Link to="/" className="hl-drawer__back" onClick={onClose}><Icon name="chevronLeft" size={16} /> Back to the wellness store</Link>
      </div>
    </div>
  );
}

export default function HomeLivingLayout() {
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  const over = HOME_PATH.test(pathname);
  useEffect(() => { setMenu(false); }, [pathname]);
  return (
    <div className={`hl${over ? ' hl--over' : ''}`}>
      <HomeLivingHeader onMenu={() => setMenu(true)} over={over} />
      {/* Fixed to the bottom of a phone; a static strip under the header on a wide
          screen. The homepage mounts it under the hero instead (nothing sits above
          the photograph), so it is the page's there. */}
      {!over && <BottomNav />}
      <Drawer open={menu} onClose={() => setMenu(false)} />
      <main className="hl-main"><Outlet /></main>
      <Footer />
      <Toasts />
    </div>
  );
}
