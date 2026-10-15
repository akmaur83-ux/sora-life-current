import { useMemo, useSyncExternalStore } from 'react';
import { getStorefrontsSnapshot, subscribeStorefronts } from './settings.js';
import { readSection, sectionContent, sectionSpec } from './storefrontContent.js';

// ============================================================
// The page side of storefront content: a section reads what is published for
// it — field by field, through its schema — over its built-in content.
//
//   const hero = useStorefrontSection('fashion', 'women.hero', WOMEN_HERO);
//
// A field that is missing or breaks its rule comes back as the built-in value
// (readSection); with nothing published the section is exactly its defaults, so
// a page renders as it always has. In an admin's ?preview=draft tab the drafts
// stand in for the published content (settings.js → applyStorefrontDrafts).
// ============================================================

/** A section's content as the page renders it. `defaults` must be a module-level constant. */
export function useStorefrontSection(store, path, defaults) {
  const stores = useSyncExternalStore(subscribeStorefronts, getStorefrontsSnapshot, getStorefrontsSnapshot);
  const raw = sectionContent(stores?.[store], path);
  return useMemo(() => (raw === undefined ? defaults : readSection(sectionSpec(store, path), raw, defaults)), [store, path, raw, defaults]);
}

/** Lines of a headline with the empty ones left out (an empty extra line is "none"). */
export const filledLines = (lines) => (Array.isArray(lines) ? lines.filter((line) => typeof line === 'string' && line) : []);

/** Copy position as a data attribute: nothing for the section's built-in place, so a default page renders as before. */
export const positionAttr = (position, builtIn = 'left') => (position && position !== builtIn ? { 'data-pos': position } : {});

/** True when white text reads better than near-black on the colour (relative luminance under the 0.179 crossover). */
export function isDarkColour(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const lin = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] < 0.179;
}

/**
 * A photograph's matched colour as attributes: nothing when the admin set none (the built-in look);
 * else the colour (--sf-tone) and, on a dark one, a marker that turns the copy over it light.
 */
export const toneAttrs = (colour) => (colour
  ? { 'data-tone': '', ...(isDarkColour(colour) ? { 'data-tone-dark': '' } : {}), style: { '--sf-tone': colour } }
  : {});

/** A phone photograph as a <picture> source — only when it differs from the desktop one, so a default image renders as before. */
export const phoneSources = (phone, desktop, media = '(max-width: 700px)') => (phone && phone !== desktop ? { sources: [{ media, srcSet: phone }] } : {});

/** A built-in editorial image as the section's photograph pair: its phone variant when it has one. */
export const shot = (image) => ({ phone: image.mobile || image.src || image.fallback, desktop: image.src || image.fallback });

/**
 * The image an item renders. Until both photographs are replaced it is the built-in image object
 * itself (its srcset, sizes and intrinsic size intact) — only its description may change; once
 * replaced, it is the uploaded pair: the desktop file, and the phone file under 700px.
 */
export function imageFor(item) {
  const builtIn = shot(item.image);
  if (item.picture.desktop === builtIn.desktop && item.picture.phone === builtIn.phone) {
    return item.alt === item.image.alt ? item.image : { ...item.image, alt: item.alt };
  }
  const { desktop, phone } = item.picture;
  return { src: desktop, fallback: desktop, alt: item.alt, width: item.image.width, height: item.image.height, sizes: item.image.sizes, ...(phone !== desktop ? { mobile: phone } : {}) };
}

/** A link the admin set, or the page's own when the field is left empty. */
export const linkOr = (link, fallback) => (link ? link : fallback);
