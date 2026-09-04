import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import ProductImage from './ProductImage.jsx';
import AnnouncementBar from './AnnouncementBar.jsx';
import { useStore } from '../lib/store.jsx';
import { categories, hasConfiguredCategoryCopy, isCategoriesHydrated } from '../data/categories.js';
import { searchProducts } from '../data/products.js';
import { money } from '../lib/format.js';
import { branding } from '../lib/settings.js';
import { lockScroll, unlockScroll } from '../lib/scrollLock.js';

// The desktop nav used to paint the built-in category set and then visibly
// swap it for the Supabase set once hydration landed a few hundred ms later —
// labels changed under the cursor on every page load.
//
// Now the row is laid out from the BUILT-IN names while the real list is still
// unknown, but those names are rendered invisibly: the browser reserves each
// slot's true width, so nothing reflows, and no label is ever shown and then
// replaced. A muted bar is drawn over each reserved slot so the row reads as
// loading rather than as blank space.
const NAV_PLACEHOLDER_COUNT = 5;

// Mirrors the catalogue settle rule in src/pages/Product.jsx: show the real
// links once hydrated, and fall back to the built-in list if Supabase never
// answers, so the nav can never be stuck as a skeleton.
function useCategoriesSettled() {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (isCategoriesHydrated()) return undefined;
    const t = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, []);
  return isCategoriesHydrated() || timedOut;
}

// ============================================================================
// SORA LIFE V2 — HEADER
//
// Chrome only. Every interaction below is carried over unchanged from V1: the
// scroll listener, the drawer, the mobile search overlay, the reference-counted
// scroll lock, Escape layering and the outside-click handler. The drawer and
// the search overlay keep their existing markup and classes deliberately —
// they are outside Phase 1 scope and rewriting working focus/scroll-lock
// behaviour for a restyle would be a poor trade.
//
// Mobile bar: hamburger / centred wordmark / search + bag.
// Wishlist intentionally moves off the mobile header — three right-hand icons
// crowd a 390px bar, and MobileTabBar already carries "Saved".
// ============================================================================
export default function Header() {
  const categoriesSettled = useCategoriesSettled();
  const { cartCount, wishCount } = useStore();
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Mobile search overlay. The desktop search field is hidden on small
  // screens, so mobile previously had no way to search at all — the icon
  // just navigated to /shop with no query.
  const [mobileSearch, setMobileSearch] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const boxRef = useRef(null);
  const mobileInputRef = useRef(null);

  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = null; setScrolled(window.scrollY > 8); });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => { setDrawer(false); setFocused(false); setMobileSearch(false); }, [location.pathname]);

  // Focus the field when the overlay opens (so the keyboard appears), lock
  // body scroll behind it, and allow Escape to close.
  useEffect(() => {
    if (!mobileSearch) return;
    const t = setTimeout(() => mobileInputRef.current?.focus(), 60);
    const onKey = (e) => { if (e.key === 'Escape') setMobileSearch(false); };
    document.addEventListener('keydown', onKey);
    lockScroll();
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      unlockScroll();
    };
  }, [mobileSearch]);
  // Reference-counted so the drawer and the search overlay can't unlock each
  // other (see lib/scrollLock.js).
  useEffect(() => {
    if (!drawer) return undefined;
    lockScroll();
    // Only close the drawer if the search overlay (which sits above it) isn't
    // the topmost layer — Escape should dismiss one layer at a time.
    const onKey = (e) => { if (e.key === 'Escape' && !mobileSearch) setDrawer(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); unlockScroll(); };
  }, [drawer, mobileSearch]);
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setFocused(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const results = q.trim() ? searchProducts(q).slice(0, 6) : [];
  const submit = (e) => { e.preventDefault(); if (q.trim()) { navigate(`/shop?q=${encodeURIComponent(q.trim())}`); setFocused(false); setMobileSearch(false); } };

  return (
    <>
      <AnnouncementBar />

      <header className={`v2-hdr ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="v2-hdr__bar">
          <div className="v2-hdr__left">
            <button
              className="v2-hdr__act"
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
              aria-expanded={drawer}
              aria-controls="mobile-drawer"
            >
              <Icon name="menu" size={19} stroke={1.5} />
            </button>

            <div className="v2-hdr__search" ref={boxRef}>
              <form className="v2-hdr__searchbox" onSubmit={submit} role="search">
                <Icon name="search" size={17} stroke={1.5} />
                <input
                  placeholder="Search wellness essentials"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onFocus={() => setFocused(true)}
                  aria-label="Search for products"
                />
                <button type="submit" aria-label="Search"><Icon name="arrowRight" size={16} stroke={1.6} /></button>
              </form>
              {focused && q.trim() && (
                <div className="v2-hdr__suggest">
                  {results.length ? results.map((p) => (
                    <Link key={p.id} to={`/product/${p.slug}`} className="v2-hdr__suggest-item" onClick={() => setFocused(false)}>
                      <span className="v2-hdr__suggest-thumb"><ProductImage product={p} frame="v2" sizes="40px" /></span>
                      <span className="v2-hdr__suggest-name">{p.name}</span>
                      <span className="v2-hdr__suggest-price">{money(p.price)}</span>
                    </Link>
                  )) : <p className="v2-hdr__suggest-empty">No matches for “{q}”.</p>}
                </div>
              )}
            </div>
          </div>

          <div className="v2-hdr__brand">
            <Logo />
          </div>

          <div className="v2-hdr__right">
            <button className="v2-hdr__act v2-only-mobile" onClick={() => setMobileSearch(true)} aria-label="Search" aria-expanded={mobileSearch}>
              <Icon name="search" size={19} stroke={1.5} />
            </button>
            <Link to="/account" className="v2-hdr__act v2-hide-mobile" aria-label="Account"><Icon name="user" size={19} stroke={1.5} /></Link>
            <Link to="/wishlist" className="v2-hdr__act v2-hide-mobile" aria-label={`Wishlist${wishCount > 0 ? `, ${wishCount} items` : ''}`}>
              <Icon name="heart" size={19} stroke={1.5} />
              {wishCount > 0 && <span className="v2-hdr__count">{wishCount}</span>}
            </Link>
            <Link to="/cart" className="v2-hdr__act" aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
              <Icon name="bag" size={19} stroke={1.5} />
              {cartCount > 0 && <span className="v2-hdr__count">{cartCount}</span>}
            </Link>
          </div>
        </div>

        <nav className="v2-hdr__nav" aria-label="Primary">
          <div className="v2-hdr__navitem">
            <NavLink to="/shop" className={({ isActive }) => `v2-hdr__link ${isActive ? 'active' : ''}`}>
              Shop <Icon name="chevronDown" size={13} stroke={1.6} />
            </NavLink>
            <div className="v2-hdr__mega">
              <div className="v2-hdr__mega-grid">
                {categories.map((c) => (
                  <Link key={c.slug} to={`/category/${c.slug}`} className="v2-hdr__mega-cell">
                    <span className="v2-hdr__mega-name">{c.name}</span>
                    <span className="v2-hdr__mega-tag" aria-hidden={!hasConfiguredCategoryCopy(c) || !c.tagline}>
                      {hasConfiguredCategoryCopy(c) && c.tagline ? c.tagline : '\u00A0'}
                    </span>
                  </Link>
                ))}
              </div>
              <Link to="/shop" className="v2-hdr__mega-all">Shop all products <Icon name="arrowRight" size={14} stroke={1.8} /></Link>
            </div>
          </div>
          {categoriesSettled
            ? categories.slice(0, 5).map((c) => (
              <NavLink key={c.slug} to={`/category/${c.slug}`} className={({ isActive }) => `v2-hdr__link ${isActive ? 'active' : ''}`}>
                {c.name}
              </NavLink>
            ))
            : categories.slice(0, NAV_PLACEHOLDER_COUNT).map((c, i) => (
              <span key={`ph-${i}`} className="v2-hdr__link v2-hdr__link--ph" aria-hidden="true">
                {c.name}
              </span>
            ))}
        </nav>
      </header>

      {/* Mobile search overlay — unchanged from V1 (focus management, backdrop
          tap, Escape, result tap). Restyling it is a later phase. */}
      {mobileSearch && (
        <div className="search-overlay" onClick={() => setMobileSearch(false)} role="dialog" aria-modal="true" aria-label="Search products">
          <div className="search-panel" onClick={(e) => e.stopPropagation()}>
            <form className="searchbox search-panel__box" onSubmit={submit}>
              <Icon name="search" />
              <input
                ref={mobileInputRef}
                className="input"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                placeholder="Search for products..."
                aria-label="Search for products"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button type="button" className="iconbtn" onClick={() => setMobileSearch(false)} aria-label="Close search"><Icon name="x" /></button>
            </form>

            {q.trim() ? (
              results.length ? (
                <div className="search-results">
                  {results.map((p) => (
                    <Link key={p.id} to={`/product/${p.slug}`} className="search-result" onClick={() => setMobileSearch(false)}>
                      <span className="search-thumb"><ProductImage product={p} /></span>
                      <span className="search-meta">
                        <span className="search-name">{p.name}</span>
                        <span className="hint">{money(p.price)}</span>
                      </span>
                    </Link>
                  ))}
                  <button className="btn btn-ghost btn-block" onClick={submit}>See all results for “{q}”</button>
                </div>
              ) : (
                <p className="muted" style={{ padding: '18px 4px' }}>No matches for “{q}”. Try “juice”, “soap” or “hair”.</p>
              )
            ) : (
              <div className="search-suggest">
                <span className="hint">Popular:</span>
                {['Juice', 'Shampoo', 'Soap', 'Face wash'].map((s) => (
                  <button key={s} type="button" className="chip" onClick={() => setQ(s)}>{s}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile drawer — unchanged from V1. Outside Phase 1 scope. */}
      <div id="mobile-drawer" className={`drawer ${drawer ? 'open' : ''}`} aria-hidden={!drawer} role="dialog" aria-modal="true" aria-label="Menu" {...(drawer ? {} : { inert: '' })}>
        <div className="drawer__scrim" onClick={() => setDrawer(false)} />
        <div className="drawer__panel">
          <div className="drawer__top">
            <Logo compact tagline={false} />
            <button className="iconbtn" onClick={() => setDrawer(false)} aria-label="Close menu"><Icon name="x" /></button>
          </div>
          <form className="searchbox" style={{ margin: '0 16px 8px' }} onSubmit={submit}>
            <Icon name="search" />
            <input className="input" placeholder="Search for products..." value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <nav className="drawer__nav">
            <Link to="/shop" className="drawer__link">All products</Link>
            <Link to="/shop?filter=new" className="drawer__link">New in</Link>
            <div className="drawer__sec">Categories</div>
            {categories.map((c) => (
              <Link key={c.slug} to={`/category/${c.slug}`} className="drawer__cat">{c.name}<Icon name="chevronRight" size={17} /></Link>
            ))}
            {/* Last and quiet on purpose — shopping keeps the priority. These
                two lived only in the footer, ~8 screens down, which is a long
                way for the pages a first-time buyer checks before trusting a
                store. */}
            <div className="drawer__sec">Company</div>
            <Link to="/about" className="drawer__minor">About {branding?.siteName || 'SORA LIFE'}</Link>
            <Link to="/contact" className="drawer__minor">Contact &amp; help</Link>
          </nav>
          <div className="drawer__foot">
            <Link to="/account" className="btn btn-outline btn-block"><Icon name="user" size={18} /> Account</Link>
          </div>
        </div>
      </div>
    </>
  );
}
