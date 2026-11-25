// ============================================================
// Joiya Jewellery (partner, 2026-11-25: "https://joiya.in/ yeh bhi kro" — the same as Kiara Jewels).
// Sixteen of their nineteen listings live in Fashion › Jewellery at Joiya's own selling prices;
// Joiya ship the orders. Left out: a combo whose only photographs are price banners, and two
// listings that carry another product's name with different prices. Their struck-through MRPs
// (₹549 against ₹1,999 and the like) are not shown: SORA cannot vouch for them.
//
//   * the posters — three of their photographs (copies served from this site,
//     /img/partners/joiya-jewellery, cropped and resized only), each with our own label.
//
// On the wellness homepage, under the Kiara Jewels posters; editable in Storefronts → Wellness.
// ============================================================
export const JOIYA_BRAND = 'Joiya Jewellery';
export const JOIYA_LISTING = '/fashion/search?q=joiya';
export const JOIYA_POSTERS_SECTION = Object.freeze({
  hidden: false,
  eyebrow: 'New on SORA Lifestyle',
  title: 'Joiya Jewellery',
  text: 'Gold-tone chains, mangalsutras and pendants for every day, at Joiya Jewellery’s own prices.',
  cta: 'Shop Joiya Jewellery',
  link: JOIYA_LISTING,
});
const P = '/img/partners/joiya-jewellery';
export const JOIYA_POSTERS = Object.freeze([
  Object.freeze({ id: 'necklaces', label: 'Necklaces', href: '/fashion/c/necklaces', image: `${P}/necklaces.webp`, alt: 'A long gold-tone necklace with small coloured stones, worn with an ivory saree' }),
  Object.freeze({ id: 'mangalsutra', label: 'Mangalsutra', href: '/fashion/c/mangalsutra', image: `${P}/mangalsutra.webp`, alt: 'A black-bead mangalsutra with an antique gold-tone pendant, worn with a black saree' }),
  Object.freeze({ id: 'pendants', label: 'Pendants', href: '/fashion/c/pendants', image: `${P}/pendants.webp`, alt: 'A fine gold-tone chain with an open-heart pendant, worn' }),
]);
