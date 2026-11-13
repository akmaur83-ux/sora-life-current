import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

// ============================================================
// The sticky category strip (owner, 2026-11-13: feature 27). On a phone, a slim
// row of the store's categories that stays just under the header while scrolling a
// store's home and its listings, one tap to any category. Hidden on larger screens
// (the header's own menus are there). The header's height is measured, so the strip
// always sits exactly under it.
// ============================================================
const SHOW = { wellness: /^\/($|shop\/?$|category\/)/, fashion: /^\/fashion\/?($|c\/|search)/ };

export default function StickyCats({ store, items }) {
  const { pathname } = useLocation();
  useEffect(() => {
    const hdr = document.querySelector(store === 'fashion' ? '.fs-hdr' : '.v2-hdr');
    if (!hdr || typeof ResizeObserver === 'undefined') return undefined;
    const set = () => document.documentElement.style.setProperty('--sora-hdr-h', `${Math.round(hdr.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(hdr);
    return () => ro.disconnect();
  }, [store]);
  if (!SHOW[store]?.test(pathname) || !items || items.length < 2) return null;
  return (
    <nav className="sora-stickycats" aria-label="Categories">
      <ul>
        {items.map((c) => <li key={c.href}><NavLink to={c.href} className={({ isActive }) => (isActive ? 'is-on' : undefined)}>{c.name}</NavLink></li>)}
      </ul>
    </nav>
  );
}
