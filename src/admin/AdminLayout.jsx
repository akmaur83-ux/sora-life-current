import { NavLink, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../lib/adminAuth.jsx';
import { branding } from '../lib/settings.js';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/pricing', label: 'Pricing' },
  { to: '/admin/variants', label: 'Variants' },
  { to: '/admin/creators', label: 'Creator Program' },
  { to: '/admin/attribution', label: 'Attribution' },
  { to: '/admin/kyc', label: 'Creator KYC' },
  { to: '/admin/payouts', label: 'Creator Payouts' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/hero-slides', label: 'Hero Slides' },
  { to: '/admin/promotions', label: 'Promotions' },
  { to: '/admin/homepage', label: 'Homepage' },
  { to: '/admin/branding', label: 'Branding' },
  { to: '/admin/appearance', label: 'Storefront Appearance' },
  { to: '/admin/settings', label: 'Settings' },
];

export default function AdminLayout() {
  const { signOut, session } = useAdminAuth();
  return (
    <div className="adm">
      <aside className="adm__side">
        <div className="adm__brand">
          <span className="adm__brand-mark">SL</span>
          <div>
            <strong>{branding.siteName}</strong>
            <em>Admin</em>
          </div>
        </div>
        <nav className="adm__nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `adm__navitem ${isActive ? 'active' : ''}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="adm__side-foot">
          <div className="adm__user" title={session?.user?.email}>{session?.user?.email}</div>
          <button className="btn btn-outline btn-sm btn-block" onClick={signOut}>Log out</button>
          <a href="/" className="adm__viewsite">← View storefront</a>
        </div>
      </aside>
      <main className="adm__main">
        <Outlet />
      </main>
    </div>
  );
}
