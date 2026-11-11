// ============================================================
// Atomy on the wellness homepage (partner, 2026-11-11: "tie-up"). Their India
// catalogue (skin care, hair and body, oral care, supplements, HemoHIM, teas)
// lives in the wellness store itself, brand "Atomy", in its own categories, at
// Atomy's own retail price. Two pieces, as for Weavers Villa and Leather Factory:
//
//   * the range — a sliding row of their products in stock, bestsellers first,
//     then the categories taking turns so it is not twelve creams in a row;
//   * the showcase — a poster band of tiles, one per kind of product, each a
//     packshot opening that part of the range (search by brand and category:
//     /shop?q=atomy skin care).
//
// Both editable in Storefronts → Wellness (hide, wording, links); nothing to show
// renders nothing.
// ============================================================
export const ATOMY_BRAND = 'Atomy';
export const ATOMY_LISTING = '/shop?q=atomy';
export const ATOMY_RANGE_LIMIT = 12;

export const ATOMY_SECTION = Object.freeze({ hidden: false, title: 'Atomy: Korean beauty & wellness', more: 'View All', link: '' });
export const ATOMY_SHOWCASE = Object.freeze({
  hidden: false,
  eyebrow: 'New on SORA Lifestyle',
  title: 'Atomy',
  text: 'Skin care, hair and body care, oral care, supplements and teas from the South Korean brand, at Atomy’s own prices.',
  cta: 'Shop all Atomy',
  link: ATOMY_LISTING,
});

const pic = (no, file = `${no}_00.jpg`) => `https://image.atomy.com/IN/goods/${no}/${file}?w=720&h=720`;
export const ATOMY_TILES = Object.freeze([
  { id: 'skin', label: 'Skin Care', href: '/shop?q=atomy%20skin%20care', image: pic('D00190') },
  { id: 'hemohim', label: 'HemoHIM', href: '/shop?q=hemohim', image: pic('D00101') },
  { id: 'supplements', label: 'Supplements', href: '/shop?q=atomy%20supplements', image: pic('D00111') },
  { id: 'hair', label: 'Hair Care', href: '/shop?q=atomy%20hair%20care', image: pic('D00601') },
  { id: 'body', label: 'Bath & Body', href: '/shop?q=atomy%20bath%20body', image: pic('D00645') },
  { id: 'oral', label: 'Oral & Personal Care', href: '/shop?q=atomy%20personal%20care', image: pic('D00510') },
  { id: 'drinks', label: 'Teas & Drinks', href: '/shop?q=atomy%20juices%20drinks', image: pic('D00975') },
].map((t) => Object.freeze(t)));

const isAtomy = (p) => String(p?.brand || '').trim().toLowerCase() === 'atomy';
/** A card-sized copy of their picture (their CDN resizes on w and h). */
export const atomyCard = (src) => (src ? String(src).replace(/\?w=\d+&h=\d+$/, '?w=600&h=600') : null);

/**
 * The cards: { key, name, href, price, image, whole }. In stock, priced, with a picture;
 * bestsellers first, then the categories take turns, each in the catalogue's order. Pure.
 */
export function selectAtomyRange(list = [], limit = ATOMY_RANGE_LIMIT) {
  const ok = (Array.isArray(list) ? list : []).filter((p) => isAtomy(p) && p.slug && Number(p.stock) > 0 && Number(p.price) > 0 && p.image);
  const card = (p) => ({ key: `wellness-${p.id}`, name: String(p.name || '').trim(), href: `/product/${p.slug}`, price: Number(p.price), image: atomyCard(p.image), whole: true });
  const out = ok.filter((p) => p.isBestseller).map(card);
  const seen = new Set(out.map((c) => c.key));
  const lanes = new Map();
  for (const p of ok) {
    if (seen.has(`wellness-${p.id}`)) continue;
    if (!lanes.has(p.category)) lanes.set(p.category, []);
    lanes.get(p.category).push(p);
  }
  // The kinds people come for first; household odds and ends last.
  const order = ['skin-care', 'supplements', 'hair-care', 'bath-body', 'juices-drinks', 'mens-care', 'wellness', 'personal-care'];
  const rank = (c) => { const i = order.indexOf(c); return i < 0 ? order.length : i; };
  const qs = [...lanes.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([, q]) => q);
  while (out.length < limit && qs.some((q) => q.length)) {
    for (const q of qs) if (q.length && out.length < limit) out.push(card(q.shift()));
  }
  return out.slice(0, limit);
}
