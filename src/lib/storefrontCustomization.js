import { safeVisualUrl } from './homepageAppearance.js';

// Presentation-only settings for the two editorial storefronts. They live
// inside the existing public `homepage` site_settings record, so this feature
// needs no table, RLS or schema change. Defaults match the current hardcoded
// storefronts exactly: nothing changes visually until an admin saves.

export const DEFAULT_FASHION_STOREFRONT = Object.freeze({
  header: {
    tagline: 'Live a brighter you',
    searchPlaceholder: 'Search for fashion, lifestyle and more…',
  },
  hero: {
    eyebrow: 'Fashion for a brighter you',
    title: 'New Season Essentials',
    subtitle: 'Style · Comfort · Everyday Living',
    ctaLabel: 'Shop now',
    ctaLink: '/fashion/c/clothing',
    note: 'Under ₹499',
    image: '/img/fashion-hero.webp',
  },
  sections: {
    categoriesTitle: 'Shop by Category',
    categoriesCta: 'Explore all',
    brandsTitle: 'Top Brands on SORA LIFE',
    brandsCta: 'See all',
    productsTitle: 'Fresh in fashion',
  },
});

export const DEFAULT_LIFESTYLE_STOREFRONT = Object.freeze({
  header: { tagline: 'Live a better you' },
  heroSlides: [
    {
      id: 'home', tall: '/img/doorway-living-tall.webp', wide: '/img/doorway-living-wide.webp',
      alt: 'Cream sofa with green cushions and a throw, a wooden coffee table and a jute rug in soft light',
      eyebrowOne: 'Beautiful spaces', eyebrowTwo: 'Happier days',
      headlineOne: 'Make Home', headlineTwo: 'a Happier Place',
      subtitle: 'Home essentials for a calmer, warmer and more you.',
      ctaLabel: 'Shop Home & Living', ctaLink: '/homeliving', note: 'Good spaces, better days',
    },
    {
      id: 'bedroom', tall: '/img/lifestyle-hero-bedroom-tall.webp', wide: '/img/homeliving-hero.webp',
      alt: 'A cane headboard, botanical bedsheets, green cushions and a quilt in a sunlit bedroom',
      eyebrowOne: 'Bedsheets', eyebrowTwo: 'Quilts & cushions',
      headlineOne: 'Sleep Softer,', headlineTwo: 'Wake Brighter',
      subtitle: 'Cotton bedsheets, quilts and cushion covers for calmer rooms.',
      ctaLabel: 'Shop Bedsheets', ctaLink: '/homeliving/category/bedsheets', note: 'Rest well, every night',
    },
    {
      id: 'fashion', tall: '/img/doorway-fashion-tall.webp', wide: '/img/doorway-fashion-wide.webp',
      alt: 'Camel coat and cream turtleneck, seated against a sunlit plaster wall',
      eyebrowOne: 'Your style', eyebrowTwo: 'Your story',
      headlineOne: 'Fashion', headlineTwo: 'for Everyday',
      subtitle: 'Clothing, footwear, bags and more — all in one place.',
      ctaLabel: 'Explore Fashion', ctaLink: '/fashion', note: 'Wear what feels you',
    },
  ],
  fashionBanner: {
    image: '/img/doorway-fashion-wide.webp',
    alt: 'Camel coat and cream turtleneck, seated against a sunlit plaster wall',
    eyebrowOne: 'Your style', eyebrowTwo: 'Your story',
    headlineOne: 'Fashion', headlineTwo: 'for Everyday',
    subtitle: 'Clothing, footwear, bags and more — all in one place.',
    ctaLabel: 'Explore Fashion', ctaLink: '/fashion', note: 'Wear what feels you',
  },
  sections: {
    fashionCategoriesTitle: 'Shop Fashion Categories',
    fashionCategoriesCta: 'View All',
    trendingTitle: 'Trending Now',
    trendingCta: 'View All',
  },
  promo: {
    image: '/img/homeliving-promo.webp',
    headline: 'Made for everyday living',
    ctaLabel: 'Shop Home & Living',
    ctaLink: '/homeliving',
  },
});

const object = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const text = (value, fallback, max = 140) => {
  if (typeof value !== 'string') return fallback;
  const clean = value.trim().replace(/\s+/g, ' ');
  return clean ? clean.slice(0, max) : fallback;
};
const image = (value, fallback) => safeVisualUrl(value) || fallback;
const link = (value, fallback) => {
  if (typeof value !== 'string') return fallback;
  const clean = value.trim();
  return /^\/(?!\/)[^\s]*$/.test(clean) ? clean.slice(0, 240) : fallback;
};

export function normalizeFashionStorefront(value) {
  const root = object(value);
  const header = object(root.header);
  const hero = object(root.hero);
  const sections = object(root.sections);
  const d = DEFAULT_FASHION_STOREFRONT;
  return {
    header: {
      tagline: text(header.tagline, d.header.tagline, 60),
      searchPlaceholder: text(header.searchPlaceholder, d.header.searchPlaceholder, 90),
    },
    hero: {
      eyebrow: text(hero.eyebrow, d.hero.eyebrow, 70),
      title: text(hero.title, d.hero.title, 90),
      subtitle: text(hero.subtitle, d.hero.subtitle, 140),
      ctaLabel: text(hero.ctaLabel, d.hero.ctaLabel, 40),
      ctaLink: link(hero.ctaLink, d.hero.ctaLink),
      note: text(hero.note, d.hero.note, 60),
      image: image(hero.image, d.hero.image),
    },
    sections: {
      categoriesTitle: text(sections.categoriesTitle, d.sections.categoriesTitle, 70),
      categoriesCta: text(sections.categoriesCta, d.sections.categoriesCta, 30),
      brandsTitle: text(sections.brandsTitle, d.sections.brandsTitle, 80),
      brandsCta: text(sections.brandsCta, d.sections.brandsCta, 30),
      productsTitle: text(sections.productsTitle, d.sections.productsTitle, 70),
    },
  };
}

function normalizeLifestyleSlide(value, fallback) {
  const slide = object(value);
  return {
    id: fallback.id,
    tall: image(slide.tall, fallback.tall),
    wide: image(slide.wide, fallback.wide),
    alt: text(slide.alt, fallback.alt, 180),
    eyebrowOne: text(slide.eyebrowOne, fallback.eyebrowOne, 50),
    eyebrowTwo: text(slide.eyebrowTwo, fallback.eyebrowTwo, 50),
    headlineOne: text(slide.headlineOne, fallback.headlineOne, 60),
    headlineTwo: text(slide.headlineTwo, fallback.headlineTwo, 60),
    subtitle: text(slide.subtitle, fallback.subtitle, 160),
    ctaLabel: text(slide.ctaLabel, fallback.ctaLabel, 45),
    ctaLink: link(slide.ctaLink, fallback.ctaLink),
    note: text(slide.note, fallback.note, 70),
  };
}

function normalizeBanner(value, fallback) {
  const banner = object(value);
  return {
    image: image(banner.image, fallback.image),
    alt: text(banner.alt, fallback.alt, 180),
    eyebrowOne: text(banner.eyebrowOne, fallback.eyebrowOne, 50),
    eyebrowTwo: text(banner.eyebrowTwo, fallback.eyebrowTwo, 50),
    headlineOne: text(banner.headlineOne, fallback.headlineOne, 60),
    headlineTwo: text(banner.headlineTwo, fallback.headlineTwo, 60),
    subtitle: text(banner.subtitle, fallback.subtitle, 160),
    ctaLabel: text(banner.ctaLabel, fallback.ctaLabel, 45),
    ctaLink: link(banner.ctaLink, fallback.ctaLink),
    note: text(banner.note, fallback.note, 70),
  };
}

export function normalizeLifestyleStorefront(value) {
  const root = object(value);
  const header = object(root.header);
  const sections = object(root.sections);
  const promo = object(root.promo);
  const d = DEFAULT_LIFESTYLE_STOREFRONT;
  const incomingSlides = Array.isArray(root.heroSlides) ? root.heroSlides : [];
  return {
    header: { tagline: text(header.tagline, d.header.tagline, 60) },
    heroSlides: d.heroSlides.map((fallback, index) => normalizeLifestyleSlide(incomingSlides[index], fallback)),
    fashionBanner: normalizeBanner(root.fashionBanner, d.fashionBanner),
    sections: {
      fashionCategoriesTitle: text(sections.fashionCategoriesTitle, d.sections.fashionCategoriesTitle, 80),
      fashionCategoriesCta: text(sections.fashionCategoriesCta, d.sections.fashionCategoriesCta, 30),
      trendingTitle: text(sections.trendingTitle, d.sections.trendingTitle, 70),
      trendingCta: text(sections.trendingCta, d.sections.trendingCta, 30),
    },
    promo: {
      image: image(promo.image, d.promo.image),
      headline: text(promo.headline, d.promo.headline, 100),
      ctaLabel: text(promo.ctaLabel, d.promo.ctaLabel, 45),
      ctaLink: link(promo.ctaLink, d.promo.ctaLink),
    },
  };
}

export function mergeStorefrontCustomization(homepage, fashion, lifestyle) {
  return {
    ...object(homepage),
    fashion_storefront: normalizeFashionStorefront(fashion),
    lifestyle_storefront: normalizeLifestyleStorefront(lifestyle),
  };
}
