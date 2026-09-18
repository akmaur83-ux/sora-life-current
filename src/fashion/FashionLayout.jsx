import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { SparrowMark } from '../components/Logo.jsx';
import Footer from '../components/Footer.jsx';
import Toasts from '../components/Toasts.jsx';
import { useStore } from '../lib/store.jsx';
import { branding } from '../lib/settings.js';
import { useFashionWishlist } from '../lib/fashionWishlist.js';
import { FashionCatalogueProvider, useFashionCatalogue } from './FashionCatalogue.jsx';
import { categoryHref, resolveCategory } from '../lib/fashion.js';

// ============================================================
// The fashion store shell — its own header (logo, search, account,
// wishlist, cart), a static delivery strip, the category chips, then the
// page; the footer is the storefront's own. The cart badge is the shared
// store's count, so a wellness item in the bag shows here too.
// ============================================================

const SEARCH_PLACEHOLDER = 'Search for fashion, lifestyle and more…';

function FashionLogo() {
  return (
    <Link to="/fashion" className="fs-logo" aria-label={`${branding.siteName} fashion home`}>
      <SparrowMark size={34} />
      <span className="fs-logo__txt"><strong>{branding.siteName}</strong><em>Live a brighter you</em></span>
    </Link>
  );
}

export function FashionHeader({ onMenu }) {
  const { cartCount } = useStore();
  const wish = useFashionWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const submit = (e) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/fashion/search?q=${encodeURIComponent(term)}` : '/fashion/search');
  };
  return (
    <header className="fs-hdr">
      <div className="fs-hdr__row">
        <button type="button" className="fs-hdr__menu" aria-label="Open menu" onClick={onMenu}><Icon name="menu" size={24} /></button>
        <FashionLogo />
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
        </nav>
      </div>
      <form className="fs-search" role="search" onSubmit={submit}>
        <Icon name="search" size={20} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={SEARCH_PLACEHOLDER} aria-label="Search fashion" />
        <button type="submit" className="fs-search__go" aria-label="Search"><Icon name="search" size={22} /></button>
      </form>
      <div className="fs-strip" aria-label="Delivery">
        <span className="fs-strip__loc"><Icon name="mapPin" size={18} /> Delivering across India</span>
        <span className="fs-strip__sep" aria-hidden="true" />
        <span className="fs-strip__fast"><Icon name="truck" size={20} /> Fast &amp; reliable delivery</span>
      </div>
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
        <Link to="/" className="fs-drawer__back" onClick={onClose}><Icon name="chevronLeft" size={16} /> Back to the wellness store</Link>
      </div>
    </div>
  );
}

function Shell() {
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setMenu(false); }, [pathname]);
  return (
    <div className="fs">
      <FashionHeader onMenu={() => setMenu(true)} />
      <Drawer open={menu} onClose={() => setMenu(false)} />
      <main className="fs-main"><Outlet /></main>
      <Footer />
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
