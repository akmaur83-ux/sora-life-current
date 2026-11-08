import { useEffect } from 'react';
import { branding, titleWithSiteName } from './settings.js';

// ============================================================
// Page titles, descriptions and product data for search engines (owner,
// 2026-11-08: more features). Every page used to carry the same title and
// description. A page calls usePageMeta with what it shows; leaving the page puts
// the site's own back. On a product page the Product data (name, picture, brand,
// price in INR, in stock or not) goes in as JSON-LD, which is what Google reads for
// price and availability in results. Nothing here invents a rating or a review.
// ============================================================
export const SITE = 'SORA LIFESTYLE';
export const ORIGIN = 'https://www.soralifestyle.in';

const INDEX_TITLE = 'Sora Lifestyle — Modern Wellness, Beauty & Everyday Care';   // index.html's
/** The site's own title, with the admin's site name (as App.jsx sets it on start). */
export const siteHomeTitle = () => (branding?.siteName ? titleWithSiteName(INDEX_TITLE, branding.siteName) : INDEX_TITLE);
const INDEX_DESCRIPTION = 'Sora Lifestyle — premium health, wellness, beauty and personal-care essentials for modern living.';
let base = null;
const metaEl = (attr, key) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); el.dataset.pm = '1'; document.head.appendChild(el); }
  return el;
};
const absolute = (u) => (!u ? '' : /^https?:\/\//.test(u) ? u : `${ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`);
/**
 * Keep the page's title while it is open: the site name arriving after start-up
 * (App.jsx) rewrites document.title, which would otherwise undo a page's own.
 * Returns the function that stops holding it.
 */
export function holdTitle(full) {
  if (typeof document === 'undefined' || typeof MutationObserver !== 'function') return () => {};
  document.title = full;
  const el = document.querySelector('title');
  if (!el) return () => {};
  const mo = new MutationObserver(() => { if (document.title !== full) document.title = full; });
  mo.observe(el, { childList: true, characterData: true, subtree: true });
  return () => mo.disconnect();
}

/** 'Name — ₹1,199': a page title that names the price. */
export const priceTitle = (name, price) => `${name} — ₹${Math.round(Number(price) || 0).toLocaleString('en-IN')}`;
export const clip = (s, n = 155) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : t; };

/** The JSON-LD Product for a page; pure, so a test can call it. */
export function productLd({ name, description, image, images, brand, sku, price, mrp, inStock, url }) {
  const pics = (images && images.length ? images : [image]).filter(Boolean).slice(0, 6).map(absolute);
  if (!name || !(price > 0)) return null;
  return {
    '@context': 'https://schema.org', '@type': 'Product', name,
    ...(pics.length ? { image: pics } : {}),
    ...(description ? { description: clip(description, 500) } : {}),
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
    ...(sku ? { sku } : {}),
    offers: {
      '@type': 'Offer', url: absolute(url), priceCurrency: 'INR', price: Number(price).toFixed(2),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: SITE },
    },
  };
}

/** Title (without the site name), description, picture, canonical path and, on a product page, its data. */
export function usePageMeta({ title, description, image, path, product } = {}, deps = []) {
  useEffect(() => {
    if (typeof document === 'undefined' || !title) return undefined;
    if (!base) base = { description: INDEX_DESCRIPTION };
    const full = `${title} | ${SITE}`;
    const desc = clip(description || base.description);
    const url = absolute(path || window.location.pathname);
    const release = holdTitle(full);
    metaEl('name', 'description').setAttribute('content', desc);
    metaEl('property', 'og:title').setAttribute('content', full);
    metaEl('property', 'og:description').setAttribute('content', desc);
    metaEl('property', 'og:url').setAttribute('content', url);
    metaEl('property', 'og:type').setAttribute('content', product ? 'product' : 'website');
    if (image) metaEl('property', 'og:image').setAttribute('content', absolute(image));
    let canon = document.head.querySelector('link[rel="canonical"]');
    if (!canon) { canon = document.createElement('link'); canon.rel = 'canonical'; canon.dataset.pm = '1'; document.head.appendChild(canon); }
    canon.href = url;
    document.head.querySelectorAll('script[type="application/ld+json"]').forEach((el) => el.remove());   // the share card's copy (api/share.js)
    let ld = null;
    const data = product ? productLd({ ...product, url: path || window.location.pathname }) : null;
    if (data) {
      ld = document.createElement('script');
      ld.type = 'application/ld+json'; ld.dataset.pm = 'product';
      ld.textContent = JSON.stringify(data);
      document.head.appendChild(ld);
    }
    return () => {
      release();
      document.title = siteHomeTitle();
      metaEl('name', 'description').setAttribute('content', base.description);
      if (ld) ld.remove();
      document.head.querySelectorAll('link[rel="canonical"], script[type="application/ld+json"]').forEach((el) => el.remove());   // the page's own, or the share card's
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, image, path, ...deps]);
}
