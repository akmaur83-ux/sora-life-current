// ============================================================
// SITE SETTINGS — live-bound module, admin-editable via Supabase
// `site_settings`. Every default below is
// EXACTLY the value already hardcoded across the storefront today,
// so nothing visually changes until an admin edits something.
// ============================================================

export let branding = {
  logoUrl: '/assets/sora-life-logo.png',
  siteName: 'SORA LIFE',
  tagline: 'HEALTH & WELLNESS',
  primaryColor: '#1E3A2F',
  accentColor: '#E8B04B',
  faviconUrl: null,
};

// `freeShippingThreshold` used to live here. There is no such threshold:
// Standard is the only delivery method and it is free at every basket size —
// see api/_lib/pricing.js, which is the only authority on what a customer is
// charged. The key was read by nothing, so it was a stale contradiction
// waiting to be re-used.
export let announcement = {
  notices: [
    'FREE STANDARD SHIPPING',
    'COD Available',
    // Marketplace-neutral. The storefront carries many labels, so the built-in
    // default no longer leads with a single brand. Admin-configured notices
    // still replace this list wholesale via applyAnnouncement().
    'EXPLORE WELLNESS, PERSONAL CARE & MORE',
  ],
};

// The fashion and lifestyle storefronts are not read from the homepage record any more:
// they are the content PUBLISHED for those stores (migration 0037), which the site's build
// writes into index.html (build/publish-content.mjs). It is read here, before the first
// render, so a visitor never sees the built-in version first.
import { readInlinedContent } from './storefrontContent.js';
const PUBLISHED_HOMEPAGE_KEYS = { fashion: 'fashion_storefront', lifestyle: 'lifestyle_storefront' };
const inlined = readInlinedContent();
const publishedKeys = (stores) => Object.fromEntries(Object.entries(PUBLISHED_HOMEPAGE_KEYS)
  .filter(([store]) => stores?.[store] && typeof stores[store] === 'object').map(([store, key]) => [key, stores[store]]));

// The saved `homepage` record (discovery rails, offers appearance, category spotlights),
// plus the two published storefronts above. The rest is empty until it loads.
export let homepage = { ...publishedKeys(inlined?.stores) };

export let contact = { phone: '', email: '', address: '' };

// ---- Storefront theme (admin-customizable appearance) ----
// Lives in site_settings.storefront_theme; consumed via CSS custom properties.
// applyStorefrontTheme sanitises then writes the --st-* vars to :root. With the
// default (SORA Classic) theme this sets NOTHING, so the storefront is identical.
import { DEFAULT_THEME, sanitizeTheme, applyTheme as applyThemeVars } from './theme.js';
export let theme = { ...DEFAULT_THEME };
export function applyStorefrontTheme(v) {
  if (!v || typeof v !== 'object') return false;
  theme = sanitizeTheme(v);
  applyThemeVars(theme);
  return true;
}

export function applyBranding(v) { if (v && typeof v === 'object') branding = { ...branding, ...v }; }
export function applyAnnouncement(v) { if (v && typeof v === 'object') announcement = { ...announcement, ...v }; }
const homepageListeners = new Set();
export const getHomepageSnapshot = () => homepage;
export function subscribeHomepage(listener) {
  homepageListeners.add(listener);
  return () => homepageListeners.delete(listener);
}
export function applyHomepage(v) {
  if (v && typeof v === 'object') {
    // The record's own copies of the two storefronts are stale: the published ones win.
    const { fashion_storefront: _fashion, lifestyle_storefront: _lifestyle, ...rest } = v;
    homepage = { ...homepage, ...rest };
    homepageListeners.forEach((listener) => listener());
  }
}
/**
 * Draft preview (?preview=draft, an admin only — the drafts are admin-read): the saved
 * drafts replace the published storefronts in this tab until it is reloaded without it.
 */
export function applyStorefrontDrafts(rows) {
  const stores = Object.fromEntries((Array.isArray(rows) ? rows : []).filter((r) => r && typeof r.store === 'string').map((r) => [r.store, r.content]));
  const next = publishedKeys(stores);
  if (!Object.keys(next).length) return false;
  homepage = { ...homepage, ...next };
  homepageListeners.forEach((listener) => listener());
  return true;
}
export function applyContact(v) { if (v && typeof v === 'object') contact = { ...contact, ...v }; }
