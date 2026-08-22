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

const NOTICE_ICONS = ['truck', 'card', 'shield'];

export default function Header() {
  const { cartCount, wishCount } = useStore();
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const boxRef = useRef(null);

  useEffect(() => { setDrawer(false); setFocused(false); }, [location.pathname]);
  useEffect(() => { document.body.style.overflow = drawer ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [drawer]);
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setFocused(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const results = q.trim() ? searchProducts(q).slice(0, 6) : [];
  const submit = (e) => { e.preventDefault(); if (q.trim()) { navigate(`/shop?q=${encodeURIComponent(q.trim())}`); setFocused(false); } };

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
      <header className="hdr">
        <div className="container hdr__in">
          <div className="hdr__left">
            <button className="iconbtn only-mobile" onClick={() => setDrawer(true)} aria-label="Open menu"><Icon name="menu" /></button>
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
              <button className="iconbtn only-mobile" onClick={() => navigate('/shop')} aria-label="Search"><Icon name="search" /></button>
              <Link to="/account" className="iconbtn hide-mobile" aria-label="Account"><Icon name="user" /></Link>
              <Link to="/wishlist" className="iconbtn hide-mobile" aria-label="Wishlist">
                <Icon name="heart" />{wishCount > 0 && <span className="count">{wishCount}</span>}
              </Link>
              <Link to="/cart" className="iconbtn" aria-label="Cart">
                <Icon name="bag" />{cartCount > 0 && <span className="count">{cartCount}</span>}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div className={`drawer ${drawer ? 'open' : ''}`} aria-hidden={!drawer}>
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
