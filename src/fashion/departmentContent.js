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
  // /fashion/women: the main women's page. The tiles are editorial photography with
  // HTML labels; only the product row shows prices, and those come from the catalogue.
  women: {
    label: "Women's fashion", categorySlug: 'women', eyebrow: "Women's fashion",
    title: ['Style.', 'Confidence.', 'You.'], intro: 'Clothing for women who dress for themselves — easy tailoring, soft knits and everyday denim.',
    cta: 'Explore the collection',
    hero: artwork('women-main-hero-desktop', 'Three women in cream and black tailoring against a clear blue sky', {
      width: 1672, height: 941, mobile: '/img/fashion-editorial/women-main-hero-mobile.webp',
      srcSet: '/img/fashion-editorial/women-main-hero-desktop-1200.webp 1200w, /img/fashion-editorial/women-main-hero-desktop.webp 1672w',
    }),
    // A slug opens that category when it exists under Women; until then, the Women listing.
    // `root` opens a top-level category instead (bags live under Bags & Accessories).
    categories: [
      { title: 'Dresses', slug: 'dresses', image: artwork('women-shop-dresses', 'Black sleeveless midi dress with a side slit', { width: 600, height: 780 }) },
      { title: 'Knitwear', slug: 'knitwear', image: artwork('women-shop-knitwear', 'Cream sweater worn with wide ivory trousers', { width: 600, height: 780 }) },
      { title: 'Shirts', slug: 'shirts', image: artwork('women-shop-shirts', 'Oversized pale blue shirt with black trousers', { width: 600, height: 780 }) },
      { title: 'Denim', slug: 'denim', image: artwork('women-shop-denim', 'Straight-leg light blue jeans with a white tank top', { width: 600, height: 780 }) },
      { title: 'Coats & jackets', slug: 'coats-jackets', image: artwork('women-shop-coats', 'Belted beige trench coat', { width: 600, height: 780 }) },
      { title: 'Bags', root: 'bags-accessories', image: artwork('women-shop-bags', 'Black leather tote bag', { width: 600, height: 780 }) },
    ],
    edits: [
      { title: 'Soft knitwear', text: 'Warm layers in quiet, neutral tones.', cta: 'Shop knitwear', slug: 'knitwear', image: artwork('women-edit-knitwear', 'Woman in an oversized taupe roll-neck sweater', { width: 900, height: 1145, sizes: '(max-width: 700px) 100vw, 480px' }) },
      { title: 'Everyday dresses', text: 'Easy shapes that move with you.', cta: 'Shop dresses', slug: 'dresses', image: artwork('women-edit-dresses', 'Woman in a flowing ivory wrap dress', { width: 900, height: 675, sizes: '(max-width: 700px) 100vw, 340px' }) },
      { title: 'Accessories', text: 'The details that finish a look.', cta: 'Shop bags', root: 'bags-accessories', image: artwork('women-edit-accessories', 'Structured black leather handbag', { width: 900, height: 675, sizes: '(max-width: 700px) 100vw, 340px' }) },
      { title: 'Soft tailoring', text: 'Relaxed suiting in ivory and cream.', cta: 'Explore the collection', image: artwork('women-edit-tailoring', 'Woman in an ivory suit seated against a blue sky', {
        width: 1400, height: 611, srcSet: '/img/fashion-editorial/women-edit-tailoring-800.webp 800w, /img/fashion-editorial/women-edit-tailoring.webp 1400w', sizes: '(max-width: 700px) 100vw, 700px',
      }) },
    ],
    capsule: [
      { title: 'White shirts', caption: 'A classic that always works.', slug: 'shirts', image: artwork('women-capsule-shirts', 'Woman in a crisp white shirt and cream trousers', { width: 1000, height: 750, sizes: '(max-width: 700px) 50vw, 25vw' }) },
      { title: 'Light denim', caption: 'Easy and comfortable, every day.', slug: 'denim', image: artwork('women-capsule-denim', 'Woman in a light denim jacket and jeans', { width: 1000, height: 750, sizes: '(max-width: 700px) 50vw, 25vw' }) },
      { title: 'Jackets', caption: 'Structure for every day.', slug: 'coats-jackets', image: artwork('women-capsule-jackets', 'Woman in a cream blazer and neutral wide-leg trousers', { width: 800, height: 880, sizes: '(max-width: 700px) 50vw, 25vw' }) },
      { title: 'Simple dresses', caption: 'Easy shapes, worn often.', slug: 'dresses', image: artwork('women-capsule-dresses', 'Woman in a black sleeveless midi dress against a plaster wall', { width: 800, height: 1088, sizes: '(max-width: 700px) 50vw, 25vw' }) },
    ],
    sarees: {
      eyebrow: 'The saree store', title: 'Sarees for every story', text: 'Silk, cotton, georgette and handloom sarees, in a store of their own.', cta: 'Visit the saree store',
      image: artwork('women-hero-alternate', 'Woman in a plum silk saree with gold woven motifs in a carved-stone interior', {
        width: 1600, height: 900, mobile: '/img/fashion-editorial/women-hero-alternate-mobile.webp',
        srcSet: '/img/fashion-editorial/women-hero-alternate-1000.webp 1000w, /img/fashion-editorial/women-hero-alternate.webp 1600w', sizes: '(max-width: 700px) 100vw, 1160px',
      }),
    },
  },
  // /fashion/women/sarees: the saree store, moved here unchanged from /fashion/women.
  sarees: {
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
