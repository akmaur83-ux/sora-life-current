import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import Category from './pages/Category.jsx';
import Product from './pages/Product.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Account from './pages/Account.jsx';
import Wishlist from './pages/Wishlist.jsx';
import About from './pages/About.jsx';
import Contact from './pages/Contact.jsx';
import Legal from './pages/Legal.jsx';
import Passport from './pages/Passport.jsx';
import Invoice from './pages/Invoice.jsx';
import CreatorPortal from './pages/CreatorPortal.jsx';
import CreatorAttribution from './components/CreatorAttribution.jsx';
import NotFound from './pages/NotFound.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import { useAdminAuth } from './lib/adminAuth.jsx';
import { branding } from './lib/settings.js';

import AdminLayout from './admin/AdminLayout.jsx';
import Dashboard from './admin/pages/Dashboard.jsx';
import Products from './admin/pages/Products.jsx';
import Orders from './admin/pages/Orders.jsx';
import ProductForm from './admin/pages/ProductForm.jsx';
import Pricing from './admin/pages/Pricing.jsx';
import Variants from './admin/pages/Variants.jsx';
import Creators from './admin/pages/Creators.jsx';
import CreatorDetail from './admin/pages/CreatorDetail.jsx';
import Attribution from './admin/pages/Attribution.jsx';
import Kyc from './admin/pages/Kyc.jsx';
import Payouts from './admin/pages/Payouts.jsx';
import Appearance from './admin/pages/Appearance.jsx';
import Categories from './admin/pages/Categories.jsx';
import HeroSlides from './admin/pages/HeroSlides.jsx';
import Promotions from './admin/pages/Promotions.jsx';
import HomepageSettings from './admin/pages/Homepage.jsx';
import CategoryExperience from './admin/pages/CategoryExperience.jsx';
import Branding from './admin/pages/Branding.jsx';
import Settings from './admin/pages/Settings.jsx';

function ProtectedAdminRoute({ children }) {
  const { isAdmin, loading, session, verificationFailed, retryVerification } = useAdminAuth();
  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#55655B' }}>Checking session…</div>;
  }
  // The membership check could not be completed. That is NOT a denial: bouncing
  // a signed-in admin to the login page over a dropped request sends them to
  // re-enter credentials for a problem that has nothing to do with them.
  // Access is still withheld — isAdmin stays false — we just say why.
  if (session && verificationFailed) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center', color: '#55655B' }}>
          <h1 style={{ fontSize: 18, margin: '0 0 8px', color: '#16211B' }}>Could not verify your access</h1>
          <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.55 }}>
            We could not reach the server to confirm your admin account. You are still
            signed in — this is a connection problem, not a permissions one.
          </p>
          <button type="button" className="btn" onClick={() => retryVerification()}>Try again</button>
        </div>
      </div>
    );
  }
  if (!session || !isAdmin) return <Navigate to="/admin/login" replace />;
  return children;
}

function useBrandingEffects() {
  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary', branding.primaryColor);
    document.documentElement.style.setProperty('--color-primary-hover', branding.primaryColor);
    document.documentElement.style.setProperty('--color-accent', branding.accentColor);
    if (branding.faviconUrl) {
      let link = document.querySelector('link[rel="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = branding.faviconUrl;
    }
    if (branding.siteName) {
      document.title = document.title.replace(/^Sora Life|^SORA LIFE/, branding.siteName);
    }
  }, []);
}

export default function App() {
  useBrandingEffects();
  return (
    <>
      {/* Records ?ref= / &trk= landings for the Creator Program. Renders nothing. */}
      <CreatorAttribution />
      <Routes>
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:dbId/edit" element={<ProductForm />} />
        <Route path="orders" element={<Orders />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="variants" element={<Variants />} />
        <Route path="creators" element={<Creators />} />
        <Route path="creators/:id" element={<CreatorDetail />} />
        <Route path="attribution" element={<Attribution />} />
        <Route path="kyc" element={<Kyc />} />
        <Route path="payouts" element={<Payouts />} />
        <Route path="categories" element={<Categories />} />
        <Route path="hero-slides" element={<HeroSlides />} />
        <Route path="promotions" element={<Promotions />} />
        <Route path="homepage" element={<HomepageSettings />} />
        <Route path="category-experience" element={<CategoryExperience />} />
        <Route path="branding" element={<Branding />} />
        <Route path="appearance" element={<Appearance />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="/passport/:passportId?" element={<Passport />} />
      {/* Customer invoice. Standalone (outside Layout) so it prints cleanly. */}
      <Route path="/invoice/:orderNumber" element={<Invoice />} />
      {/* Creator Program portal. Standalone shell, own chrome. */}
      <Route path="/creator/:tab?" element={<CreatorPortal />} />

      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/category/:slug" element={<Category />} />
        <Route path="/product/:slug" element={<Product />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/:tab" element={<Account />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Legal doc="privacy" />} />
        <Route path="/terms" element={<Legal doc="terms" />} />
        <Route path="/shipping" element={<Legal doc="shipping" />} />
        <Route path="/returns" element={<Legal doc="returns" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
    </>
  );
}
