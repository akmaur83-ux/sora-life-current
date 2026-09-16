// ============================================================
// Fashion homepage art — the supplied photography, keyed by category slug.
//
// The category row (fashion_categories.image_url) holds ONE image per
// category, but the homepage shows two treatments: a circular tile and a
// wide card. The circle and card sets live here; a slug with no art here
// falls back to the row's image_url, and a row with neither gets its
// initial letter. All files are /img/*.webp under 150 KB.
// ============================================================
export const HERO_IMAGE = '/img/fashion-hero.webp';

export const CIRCLE_ART = Object.freeze({
  men: '/img/fashion-circle-men.webp',
  women: '/img/fashion-circle-women.webp',
  kids: '/img/fashion-circle-kids.webp',
  beauty: '/img/fashion-circle-beauty.webp',
  footwear: '/img/fashion-circle-footwear.webp',
  'bags-accessories': '/img/fashion-circle-bags.webp',
});

export const CARD_ART = Object.freeze({
  clothing: '/img/fashion-card-clothing.webp',
  beauty: '/img/fashion-card-beauty.webp',
  footwear: '/img/fashion-card-footwear.webp',
  'bags-accessories': '/img/fashion-card-bags.webp',
});

export const circleArt = (node) => CIRCLE_ART[node?.slug] || node?.image_url || null;
export const cardArt = (node) => CARD_ART[node?.slug] || node?.image_url || null;
