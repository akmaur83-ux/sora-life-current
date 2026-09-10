import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import EditableLegal from './pages/EditableLegal.jsx';
import Passport from './pages/Passport.jsx';
import Invoice from './pages/Invoice.jsx';
import CreatorPortal from './pages/CreatorPortal.jsx';
import CreatorAttribution from './components/CreatorAttribution.jsx';
import NotFound from './pages/NotFound.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import { useAdminAuth } from './lib/adminAuth.jsx';
import { branding } from './lib/settings.js';
import { DEFERRED_ROUTES, loadDeferredStyles } from './lib/deferredStyles.js';



// ------------------------------------------------------------
// The admin app is loaded on demand.
//
// These 23 route components and everything only they reach were 17% of the
// bundle — measured at 73.5 KB brotli and 567 KB of parse work — and a
// shopper downloaded and parsed every byte of it to look at a product page.
// Parsing is where the homepage's blocking time goes, so this is the single
// biggest thing the storefront was carrying that it never used.
//
// Split rather than deleted: rollup emits them into public/chunks/ and the
// browser fetches a chunk when someone actually opens /admin. Nothing about
// admin behaviour changes; it just arrives when it is asked for.
//
// Admin is imported from nowhere else in the tree, so this is the whole cut.
// ------------------------------------------------------------
const LegalPagesAdmin = lazy(() => import('./admin/pages/LegalPages.jsx'));
const AdminLayout = lazy(() => import('./admin/AdminLayout.jsx'));
const Dashboard = lazy(() => import('./admin/pages/Dashboard.jsx'));
const Products = lazy(() => import('./admin/pages/Products.jsx'));
const Orders = lazy(() => import('./admin/pages/Orders.jsx'));
const ProductForm = lazy(() => import('./admin/pages/ProductForm.jsx'));
const Pricing = lazy(() => import('./admin/pages/Pricing.jsx'));
const Variants = lazy(() => import('./admin/pages/Variants.jsx'));
const Creators = lazy(() => import('./admin/pages/Creators.jsx'));
const CreatorTerms = lazy(() => import('./admin/pages/CreatorTerms.jsx'));
const ContentCoverage = lazy(() => import('./admin/pages/ContentCoverage.jsx'));
const CreatorDetail = lazy(() => import('./admin/pages/CreatorDetail.jsx'));
const Attribution = lazy(() => import('./admin/pages/Attribution.jsx'));
const Kyc = lazy(() => import('./admin/pages/Kyc.jsx'));
const Payouts = lazy(() => import('./admin/pages/Payouts.jsx'));
const Appearance = lazy(() => import('./admin/pages/Appearance.jsx'));
const Categories = lazy(() => import('./admin/pages/Categories.jsx'));
const HeroSlides = lazy(() => import('./admin/pages/HeroSlides.jsx'));
const Promotions = lazy(() => import('./admin/pages/Promotions.jsx'));
const HomepageSettings = lazy(() => import('./admin/pages/Homepage.jsx'));
const CategoryExperience = lazy(() => import('./admin/pages/CategoryExperience.jsx'));
const Branding = lazy(() => import('./admin/pages/Branding.jsx'));
const Settings = lazy(() => import('./admin/pages/Settings.jsx'));

// Shown while an admin chunk is in flight. Deliberately the same plain
// centred line as the session check above it, so a slow network reads as the
// admin app still opening rather than as a different kind of wait.
function AdminChunkLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#55655B' }}>
      Loading…
    </div>
  );
}

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
  // Admin / passport / creator CSS is not in index.html. Startup already
  // fetches it on idle, so it is normally cached long before anyone navigates;
  // this covers the case where someone gets there first. Idempotent.
  const { pathname } = useLocation();
  useEffect(() => { if (DEFERRED_ROUTES.test(pathname)) loadDeferredStyles(); }, [pathname]);
  return (
    <>
      {/* Records ?ref= / &trk= landings for the Creator Program. Renders nothing. */}
      <CreatorAttribution />
      <Routes>
      <Route path="/admin/login" element={<AdminLogin />} />
      {/* One boundary for the whole admin app: the child routes render into
          AdminLayout's <Outlet/>, which sits inside it, so every lazy admin
          page suspends here. It is inside ProtectedAdminRoute so an
          unauthorised visitor is redirected without fetching a chunk. */}
      <Route path="/admin" element={(
        <ProtectedAdminRoute>
          <Suspense fallback={<AdminChunkLoading />}>
            <AdminLayout />
          </Suspense>
        </ProtectedAdminRoute>
      )}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:dbId/edit" element={<ProductForm />} />
        <Route path="content" element={<ContentCoverage />} />
        <Route path="orders" element={<Orders />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="variants" element={<Variants />} />
        <Route path="creators" element={<Creators />} />
        <Route path="creators/:id" element={<CreatorDetail />} />
        <Route path="creator-terms" element={<CreatorTerms />} />
        <Route path="legal-pages/:pageId?" element={<LegalPagesAdmin />} />
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
        <Route path="/grievance" element={<EditableLegal doc="grievance" />} />
        <Route path="/privacy" element={<EditableLegal doc="privacy" />} />
        <Route path="/terms" element={<EditableLegal doc="terms" />} />
        <Route path="/shipping" element={<Legal doc="shipping" />} />
        <Route path="/returns" element={<EditableLegal doc="returns" />} />
        {/* Razorpay's merchant checklist asks for the refund and shipping
            policies at these exact paths, and both were serving the 404 page.
            Nothing in the app linked to them — the documents themselves have
            existed all along at /shipping and /returns. So these are extra
            routes onto the same two documents rather than a rename: the old
            paths are linked from the footer and may already be indexed, and
            moving them would break live URLs to fix missing ones. Editing the
            returns document in admin updates both of its paths. */}
        <Route path="/refund-policy" element={<EditableLegal doc="returns" />} />
        <Route path="/shipping-policy" element={<Legal doc="shipping" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
    </>
  );
}
