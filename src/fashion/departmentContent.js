// Presentation only. Supplied editorial artwork is independent of inventory.
// Product images/prices continue to come from the existing catalogue.
const photo = (fallback, alt, src = '') => ({ src, fallback, alt });
const artwork = (name, alt, extra = {}) => ({
  src: `/img/fashion-editorial/${name}.webp`,
  fallback: `/img/fashion-editorial/${name}.webp`, alt, ...extra,
});

export const DEPARTMENT_CONTENT = {
  men: {
    label: "Men's fashion", categorySlug: 'men', eyebrow: 'The new everyday',
    title: ['Summer', 'Essentials'], intro: 'Easy layers. Strong silhouettes. Your everyday, redefined.',
    hero: artwork('men-hero-desktop', 'Black and cream hoodie styling in a minimal urban setting', {
      width: 1600, height: 900, mobile: '/img/fashion-editorial/men-hero-mobile.webp',
      srcSet: '/img/fashion-editorial/men-hero-desktop-1000.webp 1000w, /img/fashion-editorial/men-hero-desktop.webp 1600w',
    }),
    heroNote: 'The style edit / 01', cta: 'Explore menswear',
    collectionTitle: 'Find your next essential', productsTitle: 'The everyday line-up',
    collections: [
      { title: 'Shirts', slug: 'mens-shirts', image: photo('/img/demo-mens-shirt.webp', 'A sage shirt') },
      { title: 'T-shirts', slug: 'mens-t-shirts', image: photo('/img/fashion-circle-men.webp', 'Relaxed menswear') },
      { title: 'Trousers', slug: 'mens-trousers', image: photo('/img/fashion-card-clothing.webp', 'Everyday clothing') },
    ],
    editorial: [
      { eyebrow: 'Less effort. More style.', title: 'Make it your uniform.', text: 'Build a wardrobe that works together.', image: photo('/img/fashion-circle-men.webp', 'Casual menswear edit') },
      { eyebrow: 'The details matter', title: 'Keep it effortless.', text: 'Fresh combinations for your everyday rotation.', image: photo('/img/demo-mens-shirt.webp', 'Linen shirt detail') },
    ],
    looks: [
      { title: 'The daily layer', image: photo('/img/fashion-circle-men.webp', 'Layered menswear styling') },
      { title: 'Quiet confidence', image: photo('/img/demo-mens-shirt.webp', 'Neutral menswear essential') },
      { title: 'Easy weekends', image: photo('/img/fashion-card-clothing.webp', 'Weekend clothing edit') },
      { title: 'Finishing touches', image: photo('/img/fashion-circle-men.webp', 'Menswear finishing details') },
    ],
  },
  women: {
    label: "Women's fashion", categorySlug: 'women', eyebrow: 'Timeless elegance',
    title: ['Beautiful Sarees', 'for Every Story'], intro: 'From traditional handloom to modern weaves, find the perfect saree for every occasion.',
    hero: artwork('women-hero-desktop', 'Woman in a plum and gold saree seated in a sunlit heritage courtyard', {
      width: 1920, height: 700, mobile: '/img/fashion-editorial/women-hero-mobile.webp',
      srcSet: '/img/fashion-editorial/women-hero-desktop-1200.webp 1200w, /img/fashion-editorial/women-hero-desktop.webp 1920w',
    }),
    alternateHero: artwork('women-hero-alternate', 'Plum silk saree with gold woven motifs in a warm carved-stone interior', {
      width: 1600, height: 900, mobile: '/img/fashion-editorial/women-hero-alternate-mobile.webp',
      srcSet: '/img/fashion-editorial/women-hero-alternate-1000.webp 1000w, /img/fashion-editorial/women-hero-alternate.webp 1600w',
    }),
    cta: 'Shop now', collectionTitle: 'Explore Our Collections', productsTitle: 'From our collection',
    // Slugs are used only when that category exists under Women in the real
    // catalogue. Until then the tile opens the complete Women collection.
    collections: [
      { title: 'Silk Sarees', caption: 'Elegant & rich', slug: 'silk-sarees', image: artwork('women-category-silk', 'Red silk saree with a woven gold border') },
      { title: 'Cotton Sarees', caption: 'Comfort & class', slug: 'cotton-sarees', image: artwork('women-category-cotton', 'Pale aqua cotton saree with a cream and gold border') },
      { title: 'Georgette Sarees', caption: 'Light & graceful', slug: 'georgette-sarees', image: artwork('women-category-georgette', 'Dusty rose georgette saree') },
      { title: 'Kanjivaram Sarees', caption: 'Royal tradition', slug: 'kanjivaram-sarees', image: artwork('women-category-kanjivaram', 'Deep maroon silk saree with a broad gold border') },
      { title: 'Party Wear Sarees', caption: 'For special moments', slug: 'party-wear-sarees', image: artwork('women-category-party', 'Black saree with gold embroidery') },
      { title: 'Handloom Sarees', caption: 'Pure & authentic', slug: 'handloom-sarees', image: artwork('women-category-handloom', 'Emerald green handloom fabric and gold detailing') },
    ],
    editorial: [
      { eyebrow: 'Featured collection', title: 'Traditional Handloom Sarees', text: 'Pure weaves. Timeless beauty.', cta: 'Shop Handloom', slug: 'handloom-sarees', image: artwork('women-editorial-handloom', 'Woman in an ivory and red handloom saree beside a brass planter', { width: 1400, height: 540, srcSet: '/img/fashion-editorial/women-editorial-handloom-800.webp 800w, /img/fashion-editorial/women-editorial-handloom.webp 1400w', sizes: '(max-width: 700px) 100vw, 56vw' }) },
      { eyebrow: 'The Banarasi edit', title: 'Banarasi Sarees', text: 'Rich heritage. Modern elegance.', cta: 'Shop Banarasi', slug: 'banarasi-sarees', image: artwork('women-editorial-banarasi', 'Plum Banarasi silk with ornate gold woven motifs', { width: 1200, height: 649, srcSet: '/img/fashion-editorial/women-editorial-banarasi-700.webp 700w, /img/fashion-editorial/women-editorial-banarasi.webp 1200w', sizes: '(max-width: 700px) 100vw, 40vw' }) },
    ],
    promo: artwork('women-editorial-banarasi', 'Gold brocade across folded plum silk', { width: 1200, height: 649 }),
  },
};
