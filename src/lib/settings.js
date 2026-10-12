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

// The saved `homepage` record (discovery rails, offers appearance, the fashion and
// lifestyle storefronts, category spotlights). Empty until it loads.
export let homepage = {};

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
    homepage = { ...homepage, ...v };
    homepageListeners.forEach((listener) => listener());
  }
}
export function applyContact(v) { if (v && typeof v === 'object') contact = { ...contact, ...v }; }
