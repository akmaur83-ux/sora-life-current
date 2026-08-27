import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { StoreProvider } from './lib/store.jsx';
import { AdminAuthProvider } from './lib/adminAuth.jsx';
import { CustomerAuthProvider } from './lib/customerAuth.jsx';
import { applyCatalog, applyVariants, applyProductMedia } from './data/products.js';
import { applyCategories } from './data/categories.js';
import { applyBranding, applyAnnouncement, applyHomepage, applyContact, applyHeroSlides, applyStorefrontTheme } from './lib/settings.js';
import {
  fetchPublicCatalog, fetchPublicCategories, fetchPublicHeroSlides, fetchPublicSettings,
  fetchPublicVariants, fetchPublicProductMedia,
} from './lib/adminApi.js';

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('BOUNDARY', err && err.message, info && info.componentStack); }
  render() {
    if (this.state.err) return <pre style={{ padding: 20, color: '#c00', whiteSpace: 'pre-wrap' }}>{String(this.state.err && this.state.err.stack)}</pre>;
    return this.props.children;
  }
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

/**
 * The app mounts synchronously with the built-in default data (catalog,
 * categories, hero slides, branding all have complete defaults baked into
 * their modules) — first paint has ZERO network dependency, on every route.
 * The Supabase-backed live data is fetched here in the background, AFTER
 * mount, and — only if something actually changed — triggers exactly one
 * re-render so already-mounted pages pick it up. A slow/unreachable
 * Supabase can never blank or block the initial render.
 */
function Root() {
  const [, bump] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catalog, categories, heroSlides, settings, variants, media] = await Promise.all([
          withTimeout(fetchPublicCatalog().catch(() => null), 4000),
          withTimeout(fetchPublicCategories().catch(() => null), 4000),
          withTimeout(fetchPublicHeroSlides().catch(() => null), 4000),
          withTimeout(fetchPublicSettings().catch(() => null), 4000),
          withTimeout(fetchPublicVariants().catch(() => null), 4000),
          withTimeout(fetchPublicProductMedia().catch(() => null), 4000),
        ]);
        if (cancelled) return;

        let changed = false;
        if (catalog && applyCatalog(catalog, 'supabase')) changed = true;
        // Variants and media must be applied AFTER the catalogue, because
        // applyCatalog rebuilds the product objects they attach to.
        if (variants && applyVariants(variants)) changed = true;
        if (media && applyProductMedia(media)) changed = true;
        if (categories && applyCategories(categories)) changed = true;
        if (heroSlides && applyHeroSlides(heroSlides)) changed = true;
        if (settings) {
          if (settings.storefront_theme) { applyStorefrontTheme(settings.storefront_theme); changed = true; }
          if (settings.branding) { applyBranding(settings.branding); changed = true; }
          if (settings.announcement) { applyAnnouncement(settings.announcement); changed = true; }
          if (settings.homepage) { applyHomepage(settings.homepage); changed = true; }
          if (settings.contact) { applyContact(settings.contact); changed = true; }
        }
        if (changed && !cancelled) bump((n) => n + 1);
      } catch {
        // Supabase unreachable/slow — the app already rendered with
        // defaults; nothing further to do.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <BrowserRouter>
      <StoreProvider>
        <AdminAuthProvider>
          <CustomerAuthProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </CustomerAuthProvider>
        </AdminAuthProvider>
      </StoreProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
