const PRODUCT_OBJECT_MARKER = '/storage/v1/object/public/product-images/products/';
const CARD_FOLDER = '/storage/v1/object/public/product-images/products-optimized/v1/';

export const PRODUCT_CARD_PROFILE = Object.freeze({ width: 700, quality: 86, version: 1 });

export function productObjectFilename(src) {
  if (typeof src !== 'string' || !src) return null;
  try {
    const url = new URL(src);
    const at = url.pathname.indexOf(PRODUCT_OBJECT_MARKER);
    if (at < 0) return null;
    const filename = decodeURIComponent(url.pathname.slice(at + PRODUCT_OBJECT_MARKER.length));
    if (!filename || filename.includes('/') || !/\.(?:png|jpe?g|webp)$/i.test(filename)) return null;
    return filename;
  } catch {
    return null;
  }
}

export function productCardObjectName(src, profile = PRODUCT_CARD_PROFILE) {
  const filename = productObjectFilename(src);
  if (!filename) return null;
  const key = filename.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/\./g, '-');
  return `${key}-card-${profile.width}-q${profile.quality}.webp`;
}

// Product uploads use random object names with upsert:false, so the source path
// is immutable. The versioned profile makes its derivative immutable too.
export function productCardImageUrl(src, profile = PRODUCT_CARD_PROFILE) {
  const objectName = productCardObjectName(src, profile);
  if (!objectName) return null;
  const url = new URL(src);
  url.pathname = `${CARD_FOLDER}${objectName}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}
