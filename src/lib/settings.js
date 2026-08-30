// ============================================================
// SITE SETTINGS — live-bound module, admin-editable via Supabase
// `site_settings` + `hero_slides` tables. Every default below is
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

export let announcement = {
  notices: [
    'FREE STANDARD SHIPPING',
    'COD Available',
    '100% Authentic Biosash Products',
  ],
  freeShippingThreshold: 699,
};

export let homepage = {
  bestsellerTitle: 'Bestsellers',
  bestsellerSubtitle: 'Our most loved products by our customers',
};

export let contact = { phone: '', email: '', address: '' };

const DEFAULT_HERO_SLIDES = [
  {
    id: 'buckthorn',
    kind: 'video',
    src: '/media/hero.mp4',
    poster: '/media/hero-poster.jpg',
    kicker: 'The Power of',
    title: 'Sea Buckthorn',
    sub: 'Harvested from the Himalayas. Made for your wellness.',
    lede: 'Pure nutrition. Natural radiance. Everyday wellness.',
    cta: { label: 'EXPLORE COLLECTION', to: '/category/wellness' },
    position: 'center',
  },
  {
    id: 'harvest',
    kind: 'image',
    src: '/media/hero-slide2.jpg',
    kicker: 'From the Himalayas',
    title: "Nature's Orange Gold",
    sub: 'Sun-ripened sea buckthorn, gently cold-pressed.',
    lede: 'Nutrient-dense wellness, straight from the mountains.',
    cta: { label: 'SHOP JUICES & DRINKS', to: '/category/juices-drinks' },
    position: 'center',
  },
];
export let heroSlides = DEFAULT_HERO_SLIDES;
// True only once applyHeroSlides() has replaced the built-in defaults with
// admin-managed rows. The V2 hero uses this to decide whether slide copy is
// approved configured content (render it) or the hardcoded marketing defaults
// above (do not carry unverified provenance/claims into V2).
export let heroSlidesConfigured = false;

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
export function applyHeroSlides(list) {
  if (!Array.isArray(list) || !list.length) return false;
  heroSlides = list;
  heroSlidesConfigured = true;
  return true;
}
