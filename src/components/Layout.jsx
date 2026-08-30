import { useEffect } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import MobileCartSummary from './MobileCartSummary.jsx';
import Toasts from './Toasts.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); }, [pathname]);
  return null;
}

export default function Layout() {
  const { pathname } = useLocation();
  return (
    <>
      <ScrollToTop />
      <Header />
      <main key={pathname} className="page-main">
        <Outlet />
      </main>
      <Footer />
      <MobileCartSummary />
      <Toasts />
    </>
  );
}
