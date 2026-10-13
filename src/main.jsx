import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import ScrollManager from './components/ScrollManager.jsx';
import { StoreProvider } from './lib/store.jsx';
import { AdminAuthProvider } from './lib/adminAuth.jsx';
import { CustomerAuthProvider } from './lib/customerAuth.jsx';
import { applyCatalog, applyVariants, applyProductMedia } from './data/products.js';
import { applyCategories } from './data/categories.js';
import { applyBranding, applyAnnouncement, applyHomepage, applyContact, applyStorefrontTheme, applyStorefrontDrafts } from './lib/settings.js';
import { applyPromotions } from './lib/promotions.js';
import { BootstrapReadyContext } from './lib/bootstrapReady.js';
import { scheduleDeferredStyles } from './lib/deferredStyles.js';
import {
  fetchPublicCatalog, fetchPublicCategories, fetchPublicSettings,
  fetchPublicVariants, fetchPublicProductMedia, fetchPublicPromotions, fetchStorefrontDraftsForPreview,
} from './lib/adminApi.js';

// Admin / passport / creator styles are no longer linked from index.html.
// See src/lib/deferredStyles.js for what this loads and when.
scheduleDeferredStyles();

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
 * categories, branding all have complete defaults baked into
 * their modules) — first paint has ZERO network dependency, on every route.
 * The Supabase-backed live data is fetched here in the background, AFTER
 * mount, and — only if something actually changed — triggers exactly one
 * re-render so already-mounted pages pick it up. A slow/unreachable
 * Supabase can never blank or block the initial render.
 */
function Root() {
  const [, bump] = useState(0);
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catalog, categories, settings, variants, media, promotions] = await Promise.all([
          withTimeout(fetchPublicCatalog().catch(() => null), 4000),
          withTimeout(fetchPublicCategories().catch(() => null), 4000),
          withTimeout(fetchPublicSettings().catch(() => null), 4000),
          withTimeout(fetchPublicVariants().catch(() => null), 4000),
          withTimeout(fetchPublicProductMedia().catch(() => null), 4000),
          withTimeout(fetchPublicPromotions().catch(() => null), 4000),
        ]);
        if (cancelled) return;

        let changed = false;
        if (catalog && applyCatalog(catalog, 'supabase')) changed = true;
        // Variants and media must be applied AFTER the catalogue, because
        // applyCatalog rebuilds the product objects they attach to.
        if (variants && applyVariants(variants)) changed = true;
        if (media && applyProductMedia(media)) changed = true;
        if (categories && applyCategories(categories)) changed = true;
        // A successful promotions fetch (even []) replaces the local sample
        // fallback — an empty table then correctly shows no promo sections.
        if (promotions && applyPromotions(promotions)) changed = true;
        if (settings) {
          if (settings.storefront_theme) { applyStorefrontTheme(settings.storefront_theme); changed = true; }
          if (settings.branding) { applyBranding(settings.branding); changed = true; }
          if (settings.announcement) { applyAnnouncement(settings.announcement); changed = true; }
          if (settings.homepage) { applyHomepage(settings.homepage); changed = true; }
          if (settings.contact) { applyContact(settings.contact); changed = true; }
        }
        // ?preview=draft: an admin sees the saved storefront drafts in this tab. The drafts are
        // admin-read, so anyone else gets nothing back and keeps the published version.
        if (new URLSearchParams(window.location.search).get('preview') === 'draft') {
          const drafts = await fetchStorefrontDraftsForPreview().catch(() => []);
          if (!cancelled && applyStorefrontDrafts(drafts)) { setPreviewing(true); changed = true; }
        }
        if (changed && !cancelled) bump((n) => n + 1);
      } catch {
        // Supabase unreachable/slow — the app already rendered with
        // defaults; nothing further to do.
      } finally {
        if (!cancelled) setBootstrapReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    /* CustomerAuthProvider now wraps StoreProvider. The store has to know who
       is signed in so the wishlist can sync to that customer's account and be
       cleared when they leave, and a provider can only read context from
       above it. StoreProvider still contains AdminAuthProvider, so their
       relative order — and every existing useStore/useAdminAuth call site —
       is unchanged. */
    <BootstrapReadyContext.Provider value={bootstrapReady}>
      <BrowserRouter>
        {/* Scroll on navigation for every storefront and the admin: top on a new page,
            back/forward restored, #hash to its anchor, query-only changes left alone. */}
        <ScrollManager />
        <CustomerAuthProvider>
          <StoreProvider>
            <AdminAuthProvider>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </AdminAuthProvider>
          </StoreProvider>
        </CustomerAuthProvider>
      </BrowserRouter>
      {previewing && <div role="status" style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 9999, padding: '8px 14px', borderRadius: 999, background: '#1D1D1B', color: '#fff', font: '600 13px/1.2 Inter, system-ui, sans-serif', boxShadow: '0 4px 14px rgb(0 0 0 / 20%)' }}>Draft preview — not live</div>}
    </BootstrapReadyContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
