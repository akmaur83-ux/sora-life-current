// ============================================================
// PROMOTIONS — live-bound module (mirrors src/lib/settings.js).
//
// Holds the current promotions list. `applyPromotions()` at bootstrap
// replaces it with whatever the `promotions` table returns — INCLUDING an
// empty list, which correctly hides every promo section.
//
// STARTING VALUE — deliberately asymmetric, so sample copy can never reach
// a real storefront:
//   * on localhost (local design preview)  -> the SAMPLE set, so the promo
//     UI is reviewable before migration 0017 has been applied anywhere;
//   * anywhere else (production/preview URLs) -> EMPTY, so a deploy that
//     lands before the migration shows no promo sections at all rather
//     than sample marketing copy.
// A successful fetch overrides both. adminApi.fetchPublicPromotions()
// returns null (not []) when the table does not exist, so "not provisioned
// yet" never gets mistaken for "the store has zero promotions".
//
// DISPLAY LAYER ONLY. `couponCode` is a string to show / copy. Nothing here
// resolves a coupon, changes a price, or touches cart / checkout.
// ============================================================
import { PROMOTIONS_FALLBACK } from '../data/promotions.js';

const PLACEMENTS = ['home', 'pdp', 'cart'];
const TYPES = ['poster', 'offer'];
const THEME_VARIANTS = ['forest', 'cream', 'orange', 'dark', 'minimal'];

function str(v, max = 400) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// Accepts either a raw Supabase row (snake_case) or an already-shaped object.
export function normalizePromo(row) {
  if (!row || typeof row !== 'object') return null;
  const type = TYPES.includes(row.type) ? row.type : 'poster';
  const themeVariant = THEME_VARIANTS.includes(row.theme_variant ?? row.themeVariant)
    ? (row.theme_variant ?? row.themeVariant)
    : 'forest';
  const rawPlacements = row.placements ?? [];
  const placements = Array.isArray(rawPlacements)
    ? rawPlacements.filter((p) => PLACEMENTS.includes(p))
    : [];
  const ctaUrl = str(row.cta_url ?? row.ctaUrl, 500) || null;
  return {
    id: String(row.id ?? cryptoId()),
    type,
    title: str(row.title, 160),
    subtitle: str(row.subtitle, 320),
    couponCode: normalizeCode(row.coupon_code ?? row.couponCode),
    ctaText: str(row.cta_text ?? row.ctaText, 60),
    ctaUrl: safeCtaUrl(ctaUrl),
    badgeText: str(row.badge_text ?? row.badgeText, 40),
    imageUrl: str(row.image_url ?? row.imageUrl, 1000) || null,
    themeVariant,
    textAlign: (row.text_align ?? row.textAlign) === 'center' ? 'center' : 'left',
    placements,
    isActive: (row.is_active ?? row.isActive) !== false,
    startsAt: row.starts_at ?? row.startsAt ?? null,
    endsAt: row.ends_at ?? row.endsAt ?? null,
    sortOrder: Number(row.sort_order ?? row.sortOrder) || 0,
  };
}

function normalizeCode(v) {
  const s = str(v, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  return s || null;
}

// Only allow an internal path or an absolute https URL as a CTA target.
// Anything else (javascript:, data:, protocol-relative, http:) is dropped.
function safeCtaUrl(v) {
  if (!v) return null;
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  try {
    const u = new URL(v);
    if (u.protocol === 'https:') return u.href;
  } catch { /* not a URL */ }
  return null;
}

function cryptoId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { /* noop */ }
  return `p_${Math.random().toString(36).slice(2)}`;
}

// A promotion the storefront may render: active, has a title, within its
// date window. RLS already enforces this for the public read; this is the
// same guard applied client-side (and to the local fallback).
export function isRenderablePromo(p, now = Date.now()) {
  if (!p || !p.isActive || !p.title) return false;
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return false;
  if (p.endsAt && new Date(p.endsAt).getTime() < now) return false;
  return true;
}

// True only for a browser sitting on localhost — the local design preview.
// Never true on a deployed host, so the sample set below cannot ship.
export function isLocalPreviewHost() {
  try {
    const h = globalThis.location?.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
  } catch { return false; }
}

export let promotions = isLocalPreviewHost()
  ? PROMOTIONS_FALLBACK.map(normalizePromo).filter(Boolean)
  : [];
export let promotionsSource = 'fallback'; // 'fallback' | 'supabase'

/**
 * Replace the live promotions list from a Supabase fetch. Called once at
 * bootstrap. Passing [] is valid and intentionally clears the fallback.
 * Returns true when the list changed.
 */
export function applyPromotions(list) {
  if (!Array.isArray(list)) return false;
  const next = list.map(normalizePromo).filter(Boolean);
  promotions = next;
  promotionsSource = 'supabase';
  return true;
}

/** Active + valid promotions for one surface, in sort order. */
export function promosForPlacement(place, now = Date.now()) {
  if (!PLACEMENTS.includes(place)) return [];
  return promotions
    .filter((p) => p.placements.includes(place))
    .filter((p) => isRenderablePromo(p, now))
    .sort((a, b) => a.sortOrder - b.sortOrder || String(a.id).localeCompare(String(b.id)));
}

/** Split a placement's promos into { poster, offers } for layout. */
export function promoLayoutFor(place, now = Date.now()) {
  const all = promosForPlacement(place, now);
  return {
    poster: all.find((p) => p.type === 'poster') || null,
    offers: all.filter((p) => p.type === 'offer'),
    all,
  };
}

// ------------------------------------------------------------
// OFFER CALLOUT — the big "10% OFF" line on a campaign poster.
//
// PRESENTATION ONLY, and derived ONLY by reading the admin's own words back
// (badge -> title -> subtitle). It never computes, rounds or invents a
// discount, never reads a price, and returns null when the copy states no
// offer — in which case the poster simply renders without a callout.
// Adding a dedicated column later would replace this single function.
// ------------------------------------------------------------
const CALLOUT_RULES = [
  [/\b(?:flat\s*)?(\d{1,2})\s*%\s*(?:off|discount)\b/i, (m) => `${m[1]}% OFF`],
  [/₹\s*(\d[\d,]*)\s*(?:off|discount)\b/i, (m) => `₹${m[1]} OFF`],
  [/\bfree\s+shipping\b/i, () => 'FREE SHIPPING'],
  [/\bfree\s+delivery\b/i, () => 'FREE DELIVERY'],
  [/\bbuy\s*(\d+)\b/i, (m) => `BUY ${m[1]} & SAVE`],
  [/\bcashback\b/i, () => 'CASHBACK'],
];

export function offerCalloutFrom(promo) {
  if (!promo) return null;
  for (const source of [promo.badgeText, promo.title, promo.subtitle]) {
    if (!source) continue;
    for (const [re, fmt] of CALLOUT_RULES) {
      const m = source.match(re);
      if (m) return fmt(m);
    }
  }
  // Keep the approved callout treatment for explicitly labelled preview
  // artwork without inventing savings. Genuine offer wording above wins.
  return /^preview offer$/i.test(promo.badgeText || '') ? 'PREVIEW OFFER' : null;
}
