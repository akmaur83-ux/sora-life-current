import { useEffect, useRef, useState, Fragment } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import ProductImage from './ProductImage.jsx';
import { useStore } from '../lib/store.jsx';
import { categories } from '../data/categories.js';
import { searchProducts } from '../data/products.js';
import { money } from '../lib/format.js';
import { announcement } from '../lib/settings.js';
import { lockScroll, unlockScroll } from '../lib/scrollLock.js';

const NOTICE_ICONS = ['truck', 'card', 'shield'];

export default function Header() {
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
      {/* Announcement bar */}
      <div className="annbar">
        <div className="container annbar__in">
          <span className="annbar__side" aria-hidden="true" />
          <div className="annbar__notices">
            {announcement.notices.map((n, i) => (
              <Fragment key={n}>
                {i > 0 && <span className="annbar__sep" aria-hidden="true" />}
                <span className="annbar__notice">
                  <Icon name={NOTICE_ICONS[i % NOTICE_ICONS.length]} size={14} /> {n}
                </span>
              </Fragment>
            ))}
          </div>
          <div className="annbar__links">
            <Link to="/account/orders">Track Order</Link>
            <span className="annbar__sep" aria-hidden="true" />
            <a href="#">Store Locator</a>
            <span className="annbar__sep" aria-hidden="true" />
            <Link to="/account">Help &amp; Support</Link>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header className={`hdr ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="container hdr__in">
          <div className="hdr__left">
            <button className="iconbtn only-mobile" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer} aria-controls="mobile-drawer"><Icon name="menu" /></button>
            <Logo />
          </div>

          <nav className="hdr__nav hide-mobile" aria-label="Primary">
            <div className="hdr__navitem has-mega">
              <NavLink to="/shop" className="hdr__link">SHOP <Icon name="chevronDown" size={14} /></NavLink>
              <div className="mega">
                <div className="mega__grid">
                  {categories.map((c) => (
                    <Link key={c.slug} to={`/category/${c.slug}`} className="mega__cell">
                      <span className="mega__name">{c.name}</span>
                      <span className="mega__tag">{c.tagline}</span>
                    </Link>
                  ))}
                </div>
                <Link to="/shop" className="mega__all">Shop all products <Icon name="arrowRight" size={16} /></Link>
              </div>
            </div>
            <NavLink to="/category/wellness" className="hdr__link">WELLNESS</NavLink>
            <NavLink to="/category/skin-care" className="hdr__link">SKIN CARE</NavLink>
            <NavLink to="/category/hair-care" className="hdr__link">HAIR CARE</NavLink>
            <NavLink to="/category/bath-body" className="hdr__link">BATH &amp; BODY</NavLink>
            <NavLink to="/category/mens-care" className="hdr__link">MEN'S CARE</NavLink>
            <NavLink to="/shop?sort=bestselling" className="hdr__link">BESTSELLERS</NavLink>
            <NavLink to="/shop?filter=new" className="hdr__link">NEW IN</NavLink>
          </nav>

          <div className="hdr__right">
            <div className="hdr__search hide-mobile" ref={boxRef}>
              <form className="searchbox" onSubmit={submit}>
                <input className="input" placeholder="Search for products..." value={q}
                  onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)} aria-label="Search for products" />
                <button type="submit" className="hdr__search-btn" aria-label="Search"><Icon name="search" size={18} /></button>
              </form>
              {focused && q.trim() && (
                <div className="hdr__suggest">
                  {results.length ? results.map((p) => (
                    <Link key={p.id} to={`/product/${p.slug}`} className="hdr__suggest-item" onClick={() => setFocused(false)}>
                      <span className="hdr__suggest-thumb"><ProductImage product={p} /></span>
                      <span className="hdr__suggest-name">{p.name}</span>
                      <span className="hdr__suggest-price">{money(p.price)}</span>
                    </Link>
                  )) : <p className="muted" style={{ padding: 14 }}>No matches for “{q}”.</p>}
                </div>
              )}
            </div>
            <div className="hdr__actions">
              <button className="iconbtn only-mobile" onClick={() => setMobileSearch(true)} aria-label="Search" aria-expanded={mobileSearch}><Icon name="search" /></button>
              <Link to="/account" className="iconbtn hide-mobile" aria-label="Account"><Icon name="user" /></Link>
              <Link to="/wishlist" className="iconbtn hide-mobile" aria-label="Wishlist">
                <Icon name="heart" />{wishCount > 0 && <span className="count" key={wishCount}>{wishCount}</span>}
              </Link>
              <Link to="/cart" className="iconbtn" aria-label="Cart">
                <Icon name="bag" />{cartCount > 0 && <span className="count" key={cartCount}>{cartCount}</span>}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile search overlay — full-width, focus-managed, closes on
          backdrop tap / Escape / result tap. Reuses the existing
          .search-overlay styles. */}
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

      {/* Mobile drawer */}
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
            <Link to="/shop?sort=bestselling" className="drawer__link">Bestsellers</Link>
            <Link to="/shop?filter=new" className="drawer__link">New in</Link>
            <div className="drawer__sec">Categories</div>
            {categories.map((c) => (
              <Link key={c.slug} to={`/category/${c.slug}`} className="drawer__cat">{c.name}<Icon name="chevronRight" size={17} /></Link>
            ))}
          </nav>
          <div className="drawer__foot">
            <Link to="/account" className="btn btn-outline btn-block"><Icon name="user" size={18} /> Account</Link>
          </div>
        </div>
      </div>
    </>
  );
}
