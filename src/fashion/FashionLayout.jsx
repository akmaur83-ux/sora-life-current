import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { SparrowMark } from '../components/Logo.jsx';
import Footer from '../components/Footer.jsx';
import MobileTabBar from '../components/MobileTabBar.jsx';
import StickyCats from '../components/StickyCats.jsx';
import Toasts from '../components/Toasts.jsx';
import { useStore } from '../lib/store.jsx';
import { branding, getHomepageSnapshot, subscribeHomepage } from '../lib/settings.js';
import { useFashionWishlist } from '../lib/fashionWishlist.js';
import { FashionCatalogueProvider, useFashionCatalogue } from './FashionCatalogue.jsx';
import { categoryHref, resolveCategory } from '../lib/fashion.js';
import { normalizeFashionStorefront } from '../lib/storefrontCustomization.js';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import SearchSuggest, { SUGGEST_MAX, suggestKeys, RecentSearches, readRecentSearches, rememberSearch, clearRecentSearches } from '../components/SearchSuggest.jsx';
import VoiceSearch from '../components/VoiceSearch.jsx';
import { searchItems, didYouMean } from '../lib/searchMatch.js';

// ============================================================
// The fashion store shell — its own header (logo, search, account,
// wishlist, cart), a static delivery strip, the category chips, then the
// page; the footer is the storefront's own. The cart badge is the shared
// store's count, so a wellness item in the bag shows here too.
// ============================================================

const SEARCH_PLACEHOLDER = 'Search for fashion, lifestyle and more…';

/** The delivery strip under the search bar — the admin's (Storefronts → Fashion → strips); this is its built-in content. */
export const DELIVERY_STRIP = Object.freeze({ hidden: false, location: 'Delivering across India', promise: 'Delivery in 6–7 business days' });

function FashionLogo({ tagline }) {
  return (
    <Link to="/fashion" className="fs-logo" aria-label={`${branding.siteName} fashion home`}>
      <SparrowMark size={34} />
      <span className="fs-logo__txt"><strong>{branding.siteName}</strong><em>{tagline}</em></span>
    </Link>
  );
}

export function FashionHeader({ onMenu }) {
  const { cartCount } = useStore();
  const wish = useFashionWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const homepage = useSyncExternalStore(subscribeHomepage, getHomepageSnapshot, getHomepageSnapshot);
  const config = normalizeFashionStorefront(homepage.fashion_storefront);
  const strip = useStorefrontSection('fashion', 'strips.delivery', DELIVERY_STRIP);
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const submit = (e) => {
    e.preventDefault();
    const term = q.trim();
    setOpen(false);
    rememberSearch('fashion', term);
    navigate(term ? `/fashion/search?q=${encodeURIComponent(term)}` : '/fashion/search');
  };
  // Live suggestions under the box (SearchSuggest.jsx, searchMatch.js), from the catalogue already loaded.
  const { views, tree } = useFashionCatalogue();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const term = q.trim();
  const found = open && term.length >= 2
    ? searchItems(views, term, (v) => [v.name, v.brand, tree.byId.get(v.category_id)?.name]).map((v) => ({ key: v.id, href: `/fashion/p/${v.slug}`, name: v.name, brand: v.brand, image: v.image, price: v.price }))
    : null;
  const fashionFields = (v) => [v.name, v.brand, tree.byId.get(v.category_id)?.name];
  const fix = found && found.length === 0 ? didYouMean(views, term, fashionFields) : '';
  const [recent, setRecent] = useState([]);
  const pick = () => { setOpen(false); setActive(-1); if (term.length >= 2) rememberSearch('fashion', term); };
  const spoken = (t) => { setQ(t); setOpen(false); rememberSearch('fashion', t); navigate(`/fashion/search?q=${encodeURIComponent(t)}`); };
  const keys = (e) => suggestKeys(e, { count: Math.min(SUGGEST_MAX, found?.length || 0), active, setActive, open, setOpen, go: (i) => { pick(); navigate(found[i].href); } });
  // The women's page: the same links over its photograph, and no delivery strip.
  if (/^\/fashion\/women\/?$/.test(location.pathname)) return (
    <header className="wm-header">
      <button type="button" className="wm-header__menu" aria-label="Open menu" onClick={onMenu}><Icon name="menu" size={22} /></button>
      <nav className="wm-header__nav" aria-label="Women's fashion"><a href="#wm-products">Shop</a><a href="#wm-categories">Categories</a><Link to="/fashion/women/sarees">Sarees</Link><Link to="/fashion/jewellery">Jewellery</Link><Link to="/fashion/men">Men</Link></nav>
      <FashionLogo tagline={config.header.tagline} />
      <nav className="wm-header__actions" aria-label="Search, account, wishlist and cart">
        <Link to="/fashion/search" aria-label="Search fashion"><Icon name="search" size={20} /></Link>
        <Link to="/account" aria-label="Account"><Icon name="user" size={20} /></Link>
        <Link to="/fashion/wishlist" aria-label={`Wishlist${wish.count ? `, ${wish.count} items` : ''}`}><Icon name="heart" size={20} />{wish.count > 0 && <span>{wish.count}</span>}</Link>
        <Link to="/cart" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`}><Icon name="bag" size={20} />{cartCount > 0 && <span>{cartCount}</span>}</Link>
      </nav>
    </header>
  );
  // The jewellery page: the logo, its links and the icons, floating transparent over its hero.
  if (/^\/fashion\/jewellery\/?$/.test(location.pathname)) return (
    <header className="jw-header">
      <div className="jw-header__row">
        <button type="button" className="jw-header__menu" aria-label="Open menu" onClick={onMenu}><Icon name="menu" size={22} /></button>
        <FashionLogo tagline="Jewellery" />
        <nav className="jw-header__nav" aria-label="Jewellery"><Link to="/fashion/jewellery">Home</Link><a href="#jw-products">Shop</a><a href="#jw-categories">Collections</a><Link to="/fashion/women">Women</Link><Link to="/about">About</Link><Link to="/contact">Contact</Link></nav>
        <nav className="jw-header__actions" aria-label="Search, account, wishlist and cart">
          <Link to="/fashion/search" aria-label="Search fashion"><Icon name="search" size={19} /></Link>
          <Link to="/account" aria-label="Account"><Icon name="user" size={19} /></Link>
          <Link to="/fashion/wishlist" aria-label={`Wishlist${wish.count ? `, ${wish.count} items` : ''}`}><Icon name="heart" size={19} />{wish.count > 0 && <span>{wish.count}</span>}</Link>
          <Link to="/cart" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`}><Icon name="bag" size={19} />{cartCount > 0 && <span>{cartCount}</span>}</Link>
        </nav>
      </div>
    </header>
  );
  if (/^\/fashion\/women\/sarees\/?$/.test(location.pathname)) return (
    <header className="sw-header">
      <button type="button" className="sw-header__menu" aria-label="Open menu" onClick={onMenu}><Icon name="menu" size={22} /></button>
      <FashionLogo tagline="Tradition in every drape" />
      <nav className="sw-header__nav" aria-label="Saree store"><Link to="/fashion/women/sarees">Home</Link><a href="#fd-products">Shop</a><a href="#sw-collections">Collections <Icon name="chevronDown" size={12} /></a><Link to="/about">About</Link><Link to="/contact">Contact</Link></nav>
      <nav className="sw-header__actions" aria-label="Search, account, wishlist and cart">
        <Link to="/fashion/search" aria-label="Search fashion"><Icon name="search" size={19} /></Link>
        <Link to="/account" aria-label="Account"><Icon name="user" size={19} /></Link>
        <Link to="/fashion/wishlist" aria-label={`Wishlist${wish.count ? `, ${wish.count} items` : ''}`}><Icon name="heart" size={19} /></Link>
        <Link to="/cart" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`}><Icon name="bag" size={19} />{cartCount > 0 && <span>{cartCount}</span>}</Link>
      </nav>
    </header>
  );
  return (
    <header className="fs-hdr">
      <div className="fs-hdr__row">
        <button type="button" className="fs-hdr__menu" aria-label="Open menu" onClick={onMenu}><Icon name="menu" size={24} /></button>
        <FashionLogo tagline={config.header.tagline} />
        <nav className="fs-hdr__acts" aria-label="Account, wishlist and cart">
          <Link to="/account" className="fs-hdr__act" aria-label="Account"><Icon name="user" size={24} /></Link>
          <Link to="/fashion/wishlist" className="fs-hdr__act" aria-label={`Wishlist${wish.count ? `, ${wish.count} items` : ''}`}>
            <Icon name="heart" size={24} />{wish.count > 0 && <span className="fs-hdr__count">{wish.count}</span>}
          </Link>
          <Link to="/cart" className="fs-hdr__act" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`}>
            <Icon name="bag" size={24} />{cartCount > 0 && <span className="fs-hdr__count">{cartCount}</span>}
          </Link>
        </nav>
        {/* The other storefronts: quiet text links at the right of the bar
            (desktop); the drawer carries them on a phone. */}
        <nav className="fs-hdr__stores" aria-label="Other stores">
          <Link to="/" className="fs-hdr__back"><Icon name="chevronLeft" size={15} /> Wellness store</Link>
          <Link to="/grocery" className="fs-hdr__back">Grocery <Icon name="chevronRight" size={15} /></Link>
          <Link to="/homeliving" className="fs-hdr__back">Home &amp; Living <Icon name="chevronRight" size={15} /></Link>
          <Link to="/lifestyle" className="fs-hdr__back">Lifestyle <Icon name="chevronRight" size={15} /></Link>
        </nav>
      </div>
      <form className="fs-search" role="search" onSubmit={submit}>
        <Icon name="search" size={20} />
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }} placeholder={config.header.searchPlaceholder || SEARCH_PLACEHOLDER} aria-label="Search fashion"
          onFocus={() => { setOpen(true); setRecent(readRecentSearches('fashion')); }} onBlur={() => setOpen(false)} onKeyDown={keys} aria-expanded={found ? true : undefined} aria-controls={found ? 'fs-suggest' : undefined} />
        <VoiceSearch onResult={spoken} />
        <button type="submit" className="fs-search__go" aria-label="Search"><Icon name="search" size={22} /></button>
        {found && <SearchSuggest id="fs-suggest" items={found} query={term} active={active} allHref={`/fashion/search?q=${encodeURIComponent(term)}`} onPick={(e) => { if (e?.currentTarget?.closest?.('.hx-dym')) { setQ(fix); setOpen(false); setActive(-1); rememberSearch('fashion', fix); } else pick(); }} fix={fix} fixHref={`/fashion/search?q=${encodeURIComponent(fix)}`} />}
        {open && !term && <RecentSearches id="fs-recent" terms={recent} popular={(tree.roots || []).map((c) => ({ name: c.name, href: `/fashion/c/${c.slug}` }))} hrefFor={(t) => `/fashion/search?q=${encodeURIComponent(t)}`} onPick={(e) => { if (e.currentTarget.classList.contains('hx-suggest__recent')) setQ(e.currentTarget.textContent); setOpen(false); }} onClear={() => { clearRecentSearches('fashion'); setRecent([]); }} />}
      </form>
      {!strip.hidden && <div className="fs-strip" aria-label="Delivery">
        <span className="fs-strip__loc"><Icon name="mapPin" size={18} /> {strip.location}</span>
        <span className="fs-strip__sep" aria-hidden="true" />
        <span className="fs-strip__fast"><Icon name="truck" size={20} /> {strip.promise}</span>
      </div>}
    </header>
  );
}

export function CategoryChips({ onFilters = null, filterCount = 0 }) {
  const { tree } = useFashionCatalogue();
  const { pathname } = useLocation();
  const m = pathname.match(/^\/fashion\/c\/([^/]+)/);
  const current = m ? resolveCategory(tree, m[1]) : null;
  const activeRootId = current ? tree.ancestors(current.id)[0]?.id : null;
  if (tree.roots.length === 0 && !onFilters) return null;
  return (
    <div className="fs-chips" role="navigation" aria-label="Categories">
      {tree.roots.filter((r) => r.is_active).map((r) => (
        <Link key={r.id} to={categoryHref(r)} className={`fs-chip${r.id === activeRootId ? ' is-on' : ''}`} aria-current={r.id === activeRootId ? 'page' : undefined}>{r.name}</Link>
      ))}
      {onFilters && (
        <button type="button" className="fs-chip fs-chip--filters" onClick={onFilters} aria-label={filterCount ? `Filters, ${filterCount} active` : 'Filters'}>
          <Icon name="sliders" size={17} /> Filters{filterCount ? <b>{filterCount}</b> : null}
        </button>
      )}
    </div>
  );
}

function Drawer({ open, onClose }) {
  const { tree } = useFashionCatalogue();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fs-drawer" role="dialog" aria-modal="true" aria-label="Fashion menu">
      <button type="button" className="fs-drawer__scrim" aria-label="Close menu" onClick={onClose} />
      <div className="fs-drawer__panel">
        <div className="fs-drawer__head"><strong>Shop fashion</strong><button type="button" className="fs-drawer__x" aria-label="Close menu" onClick={onClose}><Icon name="x" size={20} /></button></div>
        <nav className="fs-drawer__nav">
          {tree.roots.map((r) => (
            <div key={r.id} className="fs-drawer__group">
              <Link to={categoryHref(r)} onClick={onClose}>{r.name}</Link>
              {tree.children(r.id).length > 0 && (
                <ul>{tree.children(r.id).map((c) => <li key={c.id}><Link to={categoryHref(c)} onClick={onClose}>{c.name}</Link></li>)}</ul>
              )}
            </div>
          ))}
        </nav>
        <Link to="/grocery" className="fs-drawer__back" onClick={onClose}><Icon name="chevronRight" size={16} /> Grocery store</Link>
        <Link to="/homeliving" className="fs-drawer__back" onClick={onClose}><Icon name="chevronRight" size={16} /> Home &amp; Living store</Link>
        <Link to="/lifestyle" className="fs-drawer__back" onClick={onClose}><Icon name="chevronRight" size={16} /> Lifestyle store</Link>
        <Link to="/" className="fs-drawer__back" onClick={onClose}><Icon name="chevronLeft" size={16} /> Back to the wellness store</Link>
      </div>
    </div>
  );
}

function FashionStickyCats() {
  const { tree } = useFashionCatalogue();
  const items = (tree?.roots || []).flatMap((r) => tree.children(r.id)).slice(0, 14).map((n) => ({ name: n.name, href: `/fashion/c/${n.slug}` }));
  return <StickyCats store="fashion" items={items} />;
}

function FashionTabBar() {
  const wish = useFashionWishlist();
  return <MobileTabBar store="fashion" savedCount={wish.count} />;
}

function Shell() {
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setMenu(false); }, [pathname]);
  return (
    <div className={`fs${/^\/fashion\/(men|women|women\/sarees)\/?$/.test(pathname) ? ' fs--department' : ''}${/^\/fashion\/women\/sarees\/?$/.test(pathname) ? ' fs--saree' : ''}${/^\/fashion\/women\/?$/.test(pathname) ? ' fs--women' : ''}${/^\/fashion\/jewellery\/?$/.test(pathname) ? ' fs--jewellery' : ''}`}>
      <FashionHeader onMenu={() => setMenu(true)} />
      <Drawer open={menu} onClose={() => setMenu(false)} />
      <FashionStickyCats />
      <main className="fs-main"><Outlet /></main>
      <Footer />
      {/* The phone's bottom bar, as in the wellness store (2026-11-13 redesign); not over a product page's buy bar. */}
      {!/^\/fashion\/p\//.test(pathname) && <FashionTabBar />}
      <Toasts />
    </div>
  );
}

export default function FashionLayout({ initial = null }) {
  return (
    <FashionCatalogueProvider initial={initial}>
      <Shell />
    </FashionCatalogueProvider>
  );
}
