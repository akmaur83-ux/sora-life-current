// TEMPORARY. Replace with catalogue_products query when the store column migration lands. Nothing outside this file should need to change.
//
// ============================================================
// The grocery homepage's content: hero slides, the category circles, the
// "Daily essentials" row, and the promo strip. Every string here is
// rendered as HTML text over a photograph — nothing is baked into an image.
// Every image is /img/grocery-*.webp, under 150 KB.
//
// Prices are DISPLAY figures for the homepage card and the cart line. The
// server prices every order; grocery lines cannot be ordered until the
// catalogue migration gives it a table to price them from
// (src/lib/groceryCartLine.js blocks them with a reason until then).
// ============================================================

const id = (n) => `00000000-0000-4000-8000-0000000007${String(n).padStart(2, '0')}`;

export const GROCERY_TAGLINE = 'Good food, brighter days';

/** Delivery promise. One string, used by the header badge and the trust strip. */
export const GROCERY_DELIVERY_WINDOW = '6-7 days';

export const HERO_SLIDES = [
  {
    id: 'freshness',
    image: '/img/grocery-hero.webp',
    headline: 'Freshness for a Brighter Everyday',
    sub: 'Staples, snacks, spices & more for your happy home.',
    cta: 'Shop Groceries',
    href: '/grocery/category/everyday-staples',
    note: 'Good food, happier homes',
  },
];

/** Two rows of five on a wide screen; one scrolling row on a phone. */
export const CATEGORIES = [
  { slug: 'everyday-staples', name: 'Everyday Staples', image: '/img/grocery-circle-everyday-staples.webp' },
  { slug: 'packaged-foods', name: 'Packaged Foods', image: '/img/grocery-circle-packaged-foods.webp' },
  { slug: 'spices-masalas', name: 'Spices & Masalas', image: '/img/grocery-circle-spices-masalas.webp' },
  { slug: 'cooking-oils', name: 'Cooking Oils', image: '/img/grocery-circle-cooking-oils.webp' },
  { slug: 'dry-fruits-nuts', name: 'Dry Fruits & Nuts', image: '/img/grocery-circle-dry-fruits-nuts.webp' },
  { slug: 'atta-rice', name: 'Atta & Rice', image: '/img/grocery-circle-atta-rice.webp' },
  { slug: 'tea-coffee', name: 'Tea & Coffee', image: '/img/grocery-circle-tea-coffee.webp' },
  { slug: 'pulses-dal', name: 'Pulses & Dal', image: '/img/grocery-circle-pulses-dal.webp' },
  { slug: 'snacks-munchies', name: 'Snacks & Munchies', image: '/img/grocery-circle-snacks-munchies.webp' },
  { slug: 'pantry-essentials', name: 'Pantry Essentials', image: '/img/grocery-circle-pantry-essentials.webp' },
];

export const categoryHref = (c) => `/grocery/category/${c.slug}`;

/** The "Daily essentials" row. `pack` is the weight or volume shown under the name. */
export const PRODUCTS = [
  { id: id(1), slug: 'sona-masoori-rice-1kg', brand: 'SORA LIFE', name: 'Sona Masoori Rice', pack: '1 kg', price: 89, mrp: 99, image: '/img/grocery-product-sona-masoori-rice.webp', category: 'atta-rice' },
  { id: id(2), slug: 'whole-wheat-atta-1kg', brand: 'SORA LIFE', name: 'Whole Wheat Atta', pack: '1 kg', price: 52, mrp: 58, image: '/img/grocery-product-whole-wheat-atta.webp', category: 'atta-rice' },
  { id: id(3), slug: 'sunflower-oil-1l', brand: 'SORA LIFE', name: 'Sunflower Oil', pack: '1 L', price: 142, mrp: 165, image: '/img/grocery-product-sunflower-oil.webp', category: 'cooking-oils' },
  { id: id(4), slug: 'masoor-dal-500g', brand: 'SORA LIFE', name: 'Masoor Dal', pack: '500 g', price: 78, mrp: 89, image: '/img/grocery-product-masoor-dal.webp', category: 'pulses-dal' },
];

export const DAILY_ESSENTIALS = {
  title: 'Daily essentials',
  sub: 'Good food for a brighter you',
  seeAll: '/grocery/category/everyday-staples',
  products: PRODUCTS,
};

export const PROMO = {
  image: '/img/grocery-promo.webp',
  headline: 'Fresh ingredients. Happier meals.',
  sub: 'Quality groceries for every home.',
  cta: 'Shop Fresh',
  href: '/grocery/category/everyday-staples',
};

/** Product lookup for the cart line (src/lib/groceryCartLine.js). */
export const productById = (productId) => PRODUCTS.find((p) => p.id === String(productId)) || null;
