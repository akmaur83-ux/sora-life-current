// ============================================================
// Our Brands (2026-11-13: more features) — the partner brands sold on SORA
// Lifestyle, one card each: who they are, what of theirs is here, where to shop it.
// The links are the same listings the homepage sections open (the brand files'
// *_LISTING constants; test-more-features-6 keeps them in step). Pictures are the
// copies already served from this site, or the brand's own product shots.
// Nothing here prices or ranks anything.
// ============================================================
export const BRANDS = Object.freeze([
  Object.freeze({ id: 'biosash', name: 'Biosash', store: 'Wellness', href: '/shop', image: null, imageFrom: 'biosash',
    text: 'Ayurvedic and herbal care: oils, powders, juices and supplements for everyday wellness.' }),
  Object.freeze({ id: 'atomy', name: 'Atomy', store: 'Wellness', href: '/shop?q=atomy', image: 'https://image.atomy.com/IN/goods/D00190/D00190_00.jpg?w=720&h=720',
    text: 'Korean skin care, HemoHIM, supplements, hair and personal care.' }),
  Object.freeze({ id: 'weavers-villa', name: 'Weavers Villa', store: 'Fashion · Home', href: '/fashion/c/shawls-stoles', image: '/video/weavers-villa/0e053f13.webp',
    text: 'Handwoven shawls, stoles, dupattas and Kullu weaves, plus table covers for the home.' }),
  Object.freeze({ id: 'leather-factory', name: 'Leather Factory', store: 'Fashion', href: '/fashion/c/leather-goods', image: '/img/partners/leather-factory/handbags.webp',
    text: 'Leather handbags, wallets, belts, sling bags and travel bags.' }),
  Object.freeze({ id: 'taj-leather', name: 'Taj Leather', store: 'Fashion', href: '/fashion/search?q=taj%20leather', image: 'https://cdn.shopify.com/s/files/1/0780/8437/4633/files/kbxt1xR35kfGamD.jpg?width=800',
    text: 'Genuine leather jackets and coats for men and women.' }),
  Object.freeze({ id: 'ansari-fashion', name: 'Ansari Fashion', store: 'Fashion', href: '/fashion/search?q=ansari%20fashion', image: '/img/partners/ansari-fashion/suit-sets.webp',
    text: 'Banarasi silk and cotton suit sets, Jamdani weaves and sarees from Banaras.' }),
]);

/** A brand's picture: its own, or for Biosash the first in-stock Biosash product shot. Pure. */
export function brandImage(brand, products = [], isBrand = () => false) {
  if (!brand) return null;
  if (brand.image) return brand.image;
  const hit = (Array.isArray(products) ? products : []).find((p) => p && p.image && Number(p.stock) > 0 && isBrand(p));
  return hit ? hit.image : null;
}
