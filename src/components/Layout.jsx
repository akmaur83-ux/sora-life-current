import { useEffect } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import MobileCartSummary from './MobileCartSummary.jsx';
import Toasts from './Toasts.jsx';
import StorefrontMotion from './StorefrontMotion.jsx';
import { useBootstrapReady } from '../lib/bootstrapReady.js';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); }, [pathname]);
  return null;
}

export default function Layout() {
  const { pathname } = useLocation();
  const bootstrapReady = useBootstrapReady();
  const dataShapedRoute = pathname === '/'
    || pathname === '/shop'
    || /^\/category\/[^/]+\/?$/.test(pathname)
    || /^\/product\/[^/]+\/?$/.test(pathname);
  const settling = dataShapedRoute && !bootstrapReady;
  return (
    <>
      <ScrollToTop />
      <StorefrontMotion />
      <Header />
      <main
        key={pathname}
        className={`page-main${settling ? ' page-main--settling' : ''}`}
        aria-busy={settling || undefined}
      >
        <Outlet />
      </main>
      {settling && (
        <div className="v2-data-settle" role="status" aria-live="polite">
          <span aria-hidden="true" />
          <em>Preparing the catalogue</em>
        </div>
      )}
      <Footer />
      <MobileCartSummary />
      <Toasts />
    </>
  );
}
