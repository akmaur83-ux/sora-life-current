// ============================================================
// New in Jewellery — the homepage section for the two jewellery partners
// (owner, 2026-11-25: Kiara Jewels "tie up ho chuka hai", Joiya Jewellery "yeh bhi kro",
// then "apne hisab se kro sab visually acha dikhna chahiye or homepage pe bhi").
//
// One section instead of two stacked poster blocks: the homepage already had Taj Leather's
// and Ansari Fashion's in the same layout, and four in a row read as one long repeat (and the
// two jewellery blocks repeated Mangalsutra and Necklaces). So: a bento of five photographs —
// one large, four small — each naming its category and its brand, on a champagne ground.
//
// The photographs are the brands' own (copies served from this site under /img/partners/,
// cropped and resized only; no text added). Both brands sell at their own prices on SORA
// and ship their own orders. Nothing here repeats their offers or MRPs.
// Editable in Storefronts → Wellness → "New in Jewellery".
// ============================================================
export const KIARA = Object.freeze({ name: 'Kiara Jewels', href: '/fashion/search?q=kiara%20jewels' });
export const JOIYA = Object.freeze({ name: 'Joiya Jewellery', href: '/fashion/search?q=joiya' });

export const NEW_JEWELLERY_SECTION = Object.freeze({
  hidden: false,
  eyebrow: 'New on SORA Lifestyle',
  title: 'New in Jewellery',
  text: 'Bangles, mangalsutras, necklaces and pendants from Kiara Jewels and Joiya Jewellery, at their own prices.',
  cta: 'Shop all jewellery',
  link: '/fashion/jewellery',
});

const K = '/img/partners/kiara-jewels';
const J = '/img/partners/joiya-jewellery';
// The first tile is the large one.
export const NEW_JEWELLERY_TILES = Object.freeze([
  Object.freeze({ id: 'bangles', label: 'Bangles', brand: KIARA.name, href: '/fashion/c/bangles', image: `${K}/bangles.webp`, alt: 'A stack of gold-toned bangles set with small coloured stones, worn on a wrist' }),
  Object.freeze({ id: 'mangalsutra', label: 'Mangalsutra', brand: KIARA.name, href: '/fashion/c/mangalsutra', image: `${K}/mangalsutra.webp`, alt: 'A black-bead hand mangalsutra worn with a pink and gold silk saree, beside a lit diya' }),
  Object.freeze({ id: 'pendants', label: 'Pendants', brand: JOIYA.name, href: '/fashion/c/pendants', image: `${J}/pendants.webp`, alt: 'A fine gold-tone chain with an open-heart pendant, worn' }),
  Object.freeze({ id: 'necklaces', label: 'Necklaces', brand: KIARA.name, href: '/fashion/c/necklaces', image: `${K}/necklaces.webp`, alt: 'A gold-toned necklace with clear stones and matching blue-stone drop earrings, worn' }),
  Object.freeze({ id: 'joiya', label: 'Chains & more', brand: JOIYA.name, href: JOIYA.href, image: `${J}/necklaces.webp`, alt: 'A long gold-tone necklace with small coloured stones, worn with an ivory saree' }),
]);
