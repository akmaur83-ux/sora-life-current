import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import MegaMenu from './MegaMenu.jsx';
import Icon from './Icon.jsx';

// ============================================================
// The store bar (2026-11-13 redesign: "ek jaisa header saari stores mein"). One slim
// forest-green bar across the top of every storefront page — Wellness, Fashion,
// Home & Living, Grocery, Lifestyle — the current store marked, and the site-wide
// pages (offers, new arrivals, brands, help) on the right. Each store keeps its own
// header and search under it; the per-header "other stores" links it replaces are
// hidden (sora-ds.css). Not on the admin, checkout, invoices, sign-in or the
// creator portal. Mounted once (main.jsx).
// ============================================================
export const STORES = Object.freeze([
  { id: 'wellness', label: 'Wellness', to: '/' },
  { id: 'fashion', label: 'Fashion', to: '/fashion' },
  { id: 'homeliving', label: 'Home & Living', to: '/homeliving' },
  { id: 'grocery', label: 'Grocery', to: '/grocery' },
  { id: 'lifestyle', label: 'Lifestyle', to: '/lifestyle' },
]);
export const SITE_LINKS = Object.freeze([
  { label: 'Offers', to: '/offers', icon: 'tag' },
  { label: 'New arrivals', to: '/new', icon: 'sparkle' },
  { label: 'Our brands', to: '/brands', icon: 'award' },
  { label: 'All categories', to: '/categories', icon: 'grid' },
  { label: 'Help', to: '/help', icon: 'chat' },
]);
const HIDDEN = /^\/(admin|checkout|creator|invoice|passport|login)(\/|$)|^\/(grocery)\/checkout(\/|$)/;

/** Which store a path belongs to; '' for the site-wide pages. Pure. */
export function storeOf(pathname) {
  const p = String(pathname || '/');
  if (/^\/fashion(\/|$)/.test(p)) return 'fashion';
  if (/^\/homeliving(\/|$)/.test(p)) return 'homeliving';
  if (/^\/grocery(\/|$)/.test(p)) return 'grocery';
  if (/^\/lifestyle(\/|$)/.test(p)) return 'lifestyle';
  if (/^\/($|shop|category|product|wishlist)(\/|$|\?)/.test(p) || p === '/') return 'wellness';
  return '';
}

const MEGA = new Set(['wellness', 'fashion', 'homeliving']);

export default function StoreBar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState('');
  const timer = useRef(null);
  useEffect(() => { setOpen(''); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(''); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (HIDDEN.test(pathname)) return null;
  const current = storeOf(pathname);
  // The mega menu: desktop pointers only (a tap on a phone just opens the store).
  const desktop = () => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px) and (hover: hover)').matches;
  const enter = (id) => { if (!MEGA.has(id) || !desktop()) return; clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(id), 140); };
  const leave = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(''), 180); };
  return (
    <div className="sora-storebar" onMouseLeave={leave}>
      <div className="sora-storebar__in">
        <nav className="sora-storebar__stores" aria-label="SORA stores">
          {STORES.map((s) => (
            <Link key={s.id} to={s.to} className={`sora-storebar__store${current === s.id ? ' is-on' : ''}${open === s.id ? ' is-open' : ''}`} aria-current={current === s.id ? 'page' : undefined}
              onMouseEnter={() => enter(s.id)} onFocus={() => enter(s.id)}>{s.label}</Link>
          ))}
        </nav>
        <nav className="sora-storebar__site" aria-label="Across the stores">
          {SITE_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => `sora-storebar__link${isActive ? ' is-on' : ''}`}><Icon name={l.icon} size={14} /> {l.label}</NavLink>
          ))}
        </nav>
      </div>
      {open && <div onMouseEnter={() => clearTimeout(timer.current)}><MegaMenu store={open} onClose={() => setOpen('')} /></div>}
    </div>
  );
}
