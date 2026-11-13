// ============================================================
// Our Brands (2026-11-13: more features) — the partner brands sold on SORA
// Lifestyle, one card each: who they are, what of theirs is here, where to shop it.
// The links are the same listings the homepage sections open (the brand files'
// *_LISTING constants; test-more-features-6 keeps them in step). Pictures are the
// copies already served from this site, or the brand's own product shots.
// Nothing here prices or ranks anything.
// ============================================================
export const BRANDS = Object.freeze([
  Object.freeze({ id: 'biosash', page: '/brands/biosash', story: "Biosash makes Ayurvedic and herbal care built around Himalayan sea buckthorn: juices, oils, supplements, skin and hair care for everyday wellness. Their range is the heart of SORA's wellness store.", name: 'Biosash', store: 'Wellness', href: '/shop', image: null, imageFrom: 'biosash',
    text: 'Ayurvedic and herbal care: oils, powders, juices and supplements for everyday wellness.' }),
  Object.freeze({ id: 'atomy', page: '/brands/atomy', story: "Atomy is a Korean brand known for its skin care, the HemoHIM wellness range, supplements and personal care. On SORA you'll find their range at Atomy's own prices.", name: 'Atomy', store: 'Wellness', href: '/shop?q=atomy', image: 'https://image.atomy.com/IN/goods/D00190/D00190_00.jpg?w=720&h=720',
    text: 'Korean skin care, HemoHIM, supplements, hair and personal care.' }),
  Object.freeze({ id: 'weavers-villa', page: '/brands/weavers-villa', story: 'Weavers Villa brings handwoven shawls, stoles and dupattas, from Kullu weaves to embroidered and Phulkari pieces, plus gift boxes and table covers for the home.', catalogueBrand: 'Weavers Villa', name: 'Weavers Villa', store: 'Fashion · Home', href: '/fashion/c/shawls-stoles', image: '/video/weavers-villa/0e053f13.webp',
    text: 'Handwoven shawls, stoles, dupattas and Kullu weaves, plus table covers for the home.' }),
  Object.freeze({ id: 'leather-factory', page: '/brands/leather-factory', story: 'Leather Factory makes everyday leather goods: handbags and clutches, wallets and card holders, belts, sling bags, pouches and travel bags.', catalogueBrand: 'Leather Factory', name: 'Leather Factory', store: 'Fashion', href: '/fashion/c/leather-goods', image: '/img/partners/leather-factory/handbags.webp',
    text: 'Leather handbags, wallets, belts, sling bags and travel bags.' }),
  Object.freeze({ id: 'taj-leather', luxe: true, page: '/brands/taj-leather', story: "Taj Leather makes genuine leather jackets and coats for men and women, from classic bikers to long coats, sold here at Taj Leather's own prices.", catalogueBrand: 'Taj Leather', name: 'Taj Leather', store: 'Fashion', href: '/fashion/search?q=taj%20leather', image: 'https://cdn.shopify.com/s/files/1/0780/8437/4633/files/kbxt1xR35kfGamD.jpg?width=800',
    text: 'Genuine leather jackets and coats for men and women.' }),
  Object.freeze({ id: 'ansari-fashion', luxe: true, page: '/brands/ansari-fashion', story: "Ansari Fashion is from Banaras: Banarasi silk and cotton suit sets, Jamdani weaves and sarees, sold here at Ansari Fashion's own prices.", catalogueBrand: 'Ansari Fashion', name: 'Ansari Fashion', store: 'Fashion', href: '/fashion/search?q=ansari%20fashion', image: '/img/partners/ansari-fashion/suit-sets.webp',
    text: 'Banarasi silk and cotton suit sets, Jamdani weaves and sarees from Banaras.' }),
]);

/** A brand's picture: its own, or for Biosash the first in-stock Biosash product shot. Pure. */
export function brandImage(brand, products = [], isBrand = () => false) {
  if (!brand) return null;
  if (brand.image) return brand.image;
  const hit = (Array.isArray(products) ? products : []).find((p) => p && p.image && Number(p.stock) > 0 && isBrand(p));
  return hit ? hit.image : null;
}

/**
 * How many products each brand has live (2026-11-13: new features): wellness brands
 * counted from the loaded catalogue (`brandOf` names a product's brand), the rest from
 * the catalogue table (`catalogueCounts`, brand → count). null when not known. Pure.
 */
export function brandCounts(products = [], brandOf = () => '', catalogueCounts = {}) {
  const out = {};
  for (const b of BRANDS) {
    if (b.catalogueBrand) { out[b.id] = Number.isFinite(catalogueCounts[b.catalogueBrand]) ? catalogueCounts[b.catalogueBrand] : null; continue; }
    out[b.id] = (Array.isArray(products) ? products : []).filter((p) => p && p.slug && brandOf(p).toLowerCase() === b.name.toLowerCase()).length || null;
  }
  return out;
}
