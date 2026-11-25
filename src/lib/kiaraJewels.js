// ============================================================
// Kiara Jewels (partner, 2026-11-25: "tie up ho chuka hai", then "home page pe poster dalo").
// Their fashion jewellery — bangles, mangalsutras, rings, necklaces, pendants, earrings and hand
// bracelets — lives in Fashion › Jewellery at Kiara Jewels' own prices; Kiara ships the orders.
//
//   * the posters — three of their photographs (copies served from this site,
//     /img/partners/kiara-jewels, cropped and resized only), each with our own label,
//     opening its listing. Their offers ("Buy 1 Get 2 Free" and the like) are not used:
//     those are their store's offers, not SORA's.
//
// On the wellness homepage, under the Ansari Fashion posters; editable in Storefronts → Wellness.
// ============================================================
export const KIARA_BRAND = 'Kiara Jewels';
export const KIARA_LISTING = '/fashion/search?q=kiara%20jewels';
export const KIARA_POSTERS_SECTION = Object.freeze({
  hidden: false,
  eyebrow: 'New on SORA Lifestyle',
  title: 'Kiara Jewels',
  text: 'Bangles, mangalsutras and necklaces for every day and every occasion, at Kiara Jewels’ own prices.',
  cta: 'Shop Kiara Jewels',
  link: KIARA_LISTING,
});
const P = '/img/partners/kiara-jewels';
export const KIARA_POSTERS = Object.freeze([
  Object.freeze({ id: 'bangles', label: 'Bangles', href: '/fashion/c/bangles', image: `${P}/bangles.webp`, alt: 'A stack of gold-toned bangles set with small coloured stones, worn on a wrist' }),
  Object.freeze({ id: 'mangalsutra', label: 'Mangalsutra', href: '/fashion/c/mangalsutra', image: `${P}/mangalsutra.webp`, alt: 'A black-bead hand mangalsutra worn with a pink and gold silk saree, beside a lit diya' }),
  Object.freeze({ id: 'necklaces', label: 'Necklaces', href: '/fashion/c/necklaces', image: `${P}/necklaces.webp`, alt: 'A gold-toned necklace with clear stones and matching blue-stone drop earrings, worn' }),
]);
