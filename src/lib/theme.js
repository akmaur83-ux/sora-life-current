// ============================================================
// SORA LIFE — STOREFRONT THEME (centralized token system)
//
// One source of truth for admin-customizable storefront appearance. Stored as
// the `storefront_theme` object in `site_settings` (same infra as branding),
// consumed by the storefront through CSS custom properties.
//
// GUARANTEE: with SORA Classic (all defaults) applyTheme() sets NOTHING — every
// themeable CSS rule already reads `var(--st-x, <existing token>)`, so the
// storefront stays byte-identical until an admin actually changes a value.
//
// Colors are strict #RRGGBB; a few controls are closed enums. There is no path
// to store url(), javascript:, HTML or arbitrary CSS — see sanitizeTheme().
// ============================================================

export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
export const OVERLAY_SCALES = ['none', 'subtle', 'medium', 'strong'];
export const TYPE_SCALES = ['compact', 'normal', 'large'];

// Each token: key, group, label, type ('color'|'overlay'|'scale'), default, and
// the CSS custom properties applyTheme sets when the value differs from default.
// Section-specific tokens get a dedicated --st-* var (independent control);
// brand/surface tokens ALSO override the semantic :root token so un-wired parts
// of the UI re-theme centrally.
export const TOKENS = [
  // ---- Brand / Core ----
  { key: 'brand_primary',    group: 'Brand',    label: 'Primary brand color',   type: 'color', default: '#1E3A2F', css: ['--st-brand-primary', '--color-primary'] },
  { key: 'brand_secondary',  group: 'Brand',    label: 'Secondary brand color', type: 'color', default: '#1A3226', css: ['--st-brand-secondary'] },
  { key: 'brand_accent',     group: 'Brand',    label: 'Accent / honey color',  type: 'color', default: '#E8B04B', css: ['--st-brand-accent', '--color-accent'] },
  { key: 'brand_highlight',  group: 'Brand',    label: 'Highlight / orange',    type: 'color', default: '#D08E2C', css: ['--st-brand-highlight'] },

  // ---- Header ----
  { key: 'header_bg',        group: 'Header',   label: 'Header background',      type: 'color', default: '#FBF8F1', css: ['--st-header-bg'] },
  { key: 'header_text',      group: 'Header',   label: 'Header text',           type: 'color', default: '#2C3A32', css: ['--st-header-text'] },
  { key: 'header_icon',      group: 'Header',   label: 'Header icon color',     type: 'color', default: '#16211B', css: ['--st-header-icon'] },
  { key: 'annbar_bg',        group: 'Header',   label: 'Announcement background', type: 'color', default: '#1A3226', css: ['--st-annbar-bg'] },
  { key: 'annbar_text',      group: 'Header',   label: 'Announcement text',     type: 'color', default: '#F0F6F2', css: ['--st-annbar-text'] },
  { key: 'annbar_accent',    group: 'Header',   label: 'Announcement accent',   type: 'color', default: '#F0C169', css: ['--st-annbar-accent'] },

  // ---- Homepage ----
  { key: 'hero_overlay',     group: 'Homepage', label: 'Hero overlay (extra dark tint)', type: 'overlay', default: 'none', css: ['--st-hero-overlay'] },
  { key: 'category_bg',      group: 'Homepage', label: 'Category section background', type: 'color', default: '#1A3226', css: ['--st-category-bg'] },
  { key: 'category_title',   group: 'Homepage', label: 'Category title color',  type: 'color', default: '#F0F6F2', css: ['--st-category-title'] },
  { key: 'category_subtitle', group: 'Homepage', label: 'Category subtitle color', type: 'color', default: '#BEDACD', css: ['--st-category-subtitle'] },
  { key: 'category_hover',   group: 'Homepage', label: 'Category hover color',  type: 'color', default: '#F6D79A', css: ['--st-category-hover'] },
  { key: 'category_circle',  group: 'Homepage', label: 'Category circle background', type: 'color', default: '#FFFFFF', css: ['--st-category-circle'] },

  // ---- Product cards ----
  { key: 'discount_bg',      group: 'Product cards', label: 'Discount badge background', type: 'color', default: '#E8B04B', css: ['--st-discount-bg'] },
  { key: 'discount_text',    group: 'Product cards', label: 'Discount badge text',      type: 'color', default: '#14261C', css: ['--st-discount-text'] },
  { key: 'new_bg',           group: 'Product cards', label: 'NEW badge background',     type: 'color', default: '#1E3A2F', css: ['--st-new-bg'] },
  { key: 'new_text',         group: 'Product cards', label: 'NEW badge text',          type: 'color', default: '#F0F6F2', css: ['--st-new-text'] },
  { key: 'price_color',      group: 'Product cards', label: 'Product price color',      type: 'color', default: '#4E7452', css: ['--st-price'] },
  { key: 'mrp_color',        group: 'Product cards', label: 'MRP (struck-through) color', type: 'color', default: '#A94F4F', css: ['--st-mrp'] },
  { key: 'card_bg',          group: 'Product cards', label: 'Card background',          type: 'color', default: '#FFFFFF', css: ['--st-card-bg'] },
  { key: 'card_border',      group: 'Product cards', label: 'Card border',             type: 'color', default: '#F0EADD', css: ['--st-card-border'] },

  // ---- Buttons ----
  { key: 'btn_primary_bg',   group: 'Buttons',  label: 'Primary button background', type: 'color', default: '#1E3A2F', css: ['--st-btn-primary-bg'] },
  { key: 'btn_primary_text', group: 'Buttons',  label: 'Primary button text',      type: 'color', default: '#FBF8F1', css: ['--st-btn-primary-text'] },
  { key: 'btn_secondary_bg', group: 'Buttons',  label: 'Secondary button background', type: 'color', default: '#FFFFFF', css: ['--st-btn-secondary-bg'] },
  { key: 'btn_secondary_text', group: 'Buttons', label: 'Secondary button text',   type: 'color', default: '#1E3A2F', css: ['--st-btn-secondary-text'] },
  { key: 'btn_hover',        group: 'Buttons',  label: 'Button hover / accent',    type: 'color', default: '#1A3226', css: ['--st-btn-hover'] },

  // ---- Typography (closed enums only) ----
  { key: 'heading_scale',    group: 'Typography', label: 'Heading scale', type: 'scale', default: 'normal', attr: 'data-heading-scale' },
  { key: 'body_scale',       group: 'Typography', label: 'Body scale',    type: 'scale', default: 'normal', attr: 'data-body-scale' },

  // ---- Sections / Surfaces ----
  { key: 'page_bg',          group: 'Surfaces', label: 'Main page background',      type: 'color', default: '#FBF8F1', css: ['--st-page-bg', '--color-bg'] },
  { key: 'section_bg',       group: 'Surfaces', label: 'Secondary section background', type: 'color', default: '#F4EEE1', css: ['--st-section-bg', '--color-surface-2'] },
  { key: 'card_surface',     group: 'Surfaces', label: 'Card surface',             type: 'color', default: '#FFFFFF', css: ['--st-card-surface', '--color-surface'] },
  { key: 'border_color',     group: 'Surfaces', label: 'Border',                   type: 'color', default: '#E7DFD0', css: ['--st-border', '--color-border'] },
  { key: 'text_primary',     group: 'Surfaces', label: 'Primary text',             type: 'color', default: '#16211B', css: ['--st-text-primary', '--color-text'] },
  { key: 'text_secondary',   group: 'Surfaces', label: 'Secondary text',           type: 'color', default: '#55655B', css: ['--st-text-secondary', '--color-text-muted'] },
  { key: 'text_muted',       group: 'Surfaces', label: 'Muted text',               type: 'color', default: '#7A897F', css: ['--st-text-muted'] },

  // ---- Footer ----
  { key: 'footer_bg',        group: 'Footer',   label: 'Footer background', type: 'color', default: '#1A3226', css: ['--st-footer-bg'] },
  { key: 'footer_text',      group: 'Footer',   label: 'Footer text',       type: 'color', default: '#FBF8F1', css: ['--st-footer-text'] },
  { key: 'footer_accent',    group: 'Footer',   label: 'Footer accent',     type: 'color', default: '#F0C169', css: ['--st-footer-accent'] },
];

export const GROUPS = ['Brand', 'Header', 'Homepage', 'Product cards', 'Buttons', 'Typography', 'Surfaces', 'Footer'];

export const TOKEN_BY_KEY = Object.fromEntries(TOKENS.map((t) => [t.key, t]));

// SORA Classic == the exact current storefront. Every default equals the value
// already in tokens.css / the component CSS, so defaults render identically.
export const DEFAULT_THEME = Object.fromEntries(TOKENS.map((t) => [t.key, t.default]));

// Presets are stored as FULL themes (default + overrides) so the admin UI and
// tests can diff them against the defaults cleanly.
const preset = (overrides) => ({ ...DEFAULT_THEME, ...overrides });

export const PRESETS = {
  sora_classic: { id: 'sora_classic', name: 'SORA Classic', theme: preset({}) },
  forest_gold: {
    id: 'forest_gold', name: 'Forest & Gold',
    theme: preset({
      category_bg: '#1A3226', discount_bg: '#E8B04B', discount_text: '#14261C',
      brand_accent: '#E8B04B', brand_highlight: '#D08E2C', btn_hover: '#E8B04B',
      annbar_accent: '#F0C169', footer_accent: '#F0C169',
    }),
  },
  forest_orange: {
    id: 'forest_orange', name: 'Forest & Orange',
    theme: preset({
      category_bg: '#1A3226', discount_bg: '#D08E2C', discount_text: '#2A1B02',
      brand_accent: '#D08E2C', brand_highlight: '#B4552E', btn_hover: '#D08E2C',
      annbar_accent: '#F0C169', footer_accent: '#E8B04B',
    }),
  },
  warm_luxe: {
    id: 'warm_luxe', name: 'Warm Luxe',
    theme: preset({
      category_bg: '#2C3A32', category_title: '#FBF8F1', category_subtitle: '#D9C7A6',
      category_hover: '#E8B04B', discount_bg: '#B4761F', discount_text: '#FBF8F1',
      annbar_bg: '#2C3A32', footer_bg: '#2C3A32', brand_accent: '#E8B04B', btn_hover: '#B4761F',
      section_bg: '#F7F1E6',
    }),
  },
};
export const PRESET_LIST = [PRESETS.sora_classic, PRESETS.forest_gold, PRESETS.forest_orange, PRESETS.warm_luxe];

// ---- Validation (mirrors the server-side RPC) ----
export function validateThemeValue(key, value) {
  const t = TOKEN_BY_KEY[key];
  if (!t) return false;
  if (t.type === 'overlay') return OVERLAY_SCALES.includes(value);
  if (t.type === 'scale') return TYPE_SCALES.includes(value);
  return typeof value === 'string' && HEX_RE.test(value);
}

// Whitelist + validate. Unknown keys are dropped; invalid values fall back to
// the token default. The result only ever contains known keys with safe values.
export function sanitizeTheme(input) {
  const out = {};
  const src = (input && typeof input === 'object') ? input : {};
  for (const t of TOKENS) {
    const v = src[t.key];
    out[t.key] = validateThemeValue(t.key, v) ? v : t.default;
  }
  return out;
}

const OVERLAY_RGBA = {
  none: 'rgba(20,38,28,0)', subtle: 'rgba(20,38,28,0.18)',
  medium: 'rgba(20,38,28,0.32)', strong: 'rgba(20,38,28,0.5)',
};
export function overlayRgba(scale) { return OVERLAY_RGBA[scale] || OVERLAY_RGBA.medium; }

// The set of CSS custom properties to APPLY for a theme — only entries that
// differ from the default (so SORA Classic yields {}). This is the pure,
// testable core of "storefront receives theme variables".
export function themeToCssVars(theme) {
  const clean = sanitizeTheme(theme);
  const vars = {};
  for (const t of TOKENS) {
    if (!t.css) continue;
    const val = clean[t.key];
    if (val === t.default) continue;
    const applied = t.type === 'overlay' ? overlayRgba(val) : val;
    for (const cssVar of t.css) vars[cssVar] = applied;
  }
  return vars;
}

// Apply (or clear) the theme on a root element (document root for the live
// storefront; a scoped container for the admin preview). Uses setProperty only
// with validated values — never innerHTML or style-string concatenation.
export function applyTheme(theme, root) {
  const el = root || (typeof document !== 'undefined' ? document.documentElement : null);
  if (!el) return;
  const clean = sanitizeTheme(theme);
  const vars = themeToCssVars(clean);
  for (const t of TOKENS) {
    if (!t.css) continue;
    for (const cssVar of t.css) {
      if (cssVar in vars) el.style.setProperty(cssVar, vars[cssVar]);
      else el.style.removeProperty(cssVar);
    }
  }
  // Typography scales via data-attributes (closed enums).
  for (const t of TOKENS) {
    if (t.type !== 'scale' || !t.attr) continue;
    el.setAttribute(t.attr, clean[t.key]);
  }
}
