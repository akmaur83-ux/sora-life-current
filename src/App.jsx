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
import Passport from './pages/Passport.jsx';
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
import Categories from './admin/pages/Categories.jsx';
import HeroSlides from './admin/pages/HeroSlides.jsx';
import HomepageSettings from './admin/pages/Homepage.jsx';
import Branding from './admin/pages/Branding.jsx';
import Settings from './admin/pages/Settings.jsx';

function ProtectedAdminRoute({ children }) {
  const { isAdmin, loading, session } = useAdminAuth();
  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#55655B' }}>Checking session…</div>;
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
    <Routes>
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:dbId/edit" element={<ProductForm />} />
        <Route path="orders" element={<Orders />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="categories" element={<Categories />} />
        <Route path="hero-slides" element={<HeroSlides />} />
        <Route path="homepage" element={<HomepageSettings />} />
        <Route path="branding" element={<Branding />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="/passport/:passportId?" element={<Passport />} />

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
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
