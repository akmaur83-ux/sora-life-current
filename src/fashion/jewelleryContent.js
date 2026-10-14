// /fashion/jewellery — the SORA LIFE Jewellery page. Presentation only: the photographs are
// editorial (the owner's, resized only), every word is HTML, and products, prices and ratings
// come only from the real catalogue. Every statement here is true: delivery is free on every
// order (standard), returns are accepted within 7 days of delivery, checkout offers cash on
// delivery, support runs 9am–6pm IST. Nothing else is asserted about the pieces or the shop.
import { shot } from '../lib/storefrontSections.js';

const art = (name, alt, extra = {}) => ({ src: `/img/fashion-editorial/${name}.webp`, alt, ...extra });

export const JEWELLERY = {
  categorySlug: 'jewellery',
  hero: {
    eyebrow: 'SORA LIFE Jewellery',
    title: ['Jewellery that tells', 'your story'],
    intro: 'Timeless designs for your most precious moments',
    cta: 'Shop the collection',
    // The owner's terracotta portrait at its own size (736 × 1472), never upscaled: edge to edge on
    // a phone, on the right of the desktop hero.
    image: art('jewellery-hero-drape', 'A woman in terracotta drapery wearing a diamond necklace, drop earrings and a ring', {
      width: 736, height: 1472, sizes: '(max-width: 700px) 100vw, 46vw',
    }),
  },
  // Desktop: a title and a note; a phone: two short lines beside the icon.
  trust: [
    { icon: 'truck', title: 'Free Standard Delivery', note: 'On every order', phone: ['Free Standard', 'Delivery'], to: '/shipping' },
    { icon: 'return', title: 'Easy Returns', note: '7 days from delivery', phone: ['Easy Returns', '7 days'], to: '/returns' },
    { icon: 'package', title: 'Cash on Delivery', note: 'Available', phone: ['Cash on', 'Delivery'], to: '/shipping' },
    { icon: 'chat', title: 'Support', note: '9am–6pm IST', phone: ['Support', '9am–6pm IST'], to: '/contact' },
  ],
  categories: {
    eyebrow: 'Shop by category', title: 'Find your perfect piece', intro: 'Explore our collections for every occasion.',
    // Each opens its sub-category listing under Jewellery (/fashion/c/<slug>).
    items: [
      { title: 'Rings', slug: 'rings', image: art('jewellery-cat-rings', 'A solitaire ring with a clear centre stone') },
      { title: 'Necklaces', slug: 'necklaces', image: art('jewellery-cat-necklaces', 'A fine gold chain with a small pendant') },
      { title: 'Earrings', slug: 'earrings', image: art('jewellery-cat-earrings', 'A pair of gold and clear-stone drop earrings') },
      { title: 'Bracelets', slug: 'bracelets', image: art('jewellery-cat-bracelets', 'A slim gold bracelet with small stones') },
      { title: 'Wedding', slug: 'wedding-jewellery', image: art('jewellery-cat-wedding', 'Two gold wedding bands') },
      { title: "Men's", slug: 'mens-jewellery', image: art('jewellery-cat-mens', 'A black and gold ring') },
      { title: 'Gifts', slug: 'jewellery-gifts', image: art('jewellery-cat-gifts', 'An ivory gift box tied with a champagne ribbon') },
    ],
  },
  loved: { title: 'Our most loved pieces', viewAll: 'View all' },
  edits: [
    { title: ["For life's", 'special', 'moments'], cta: 'Explore wedding', slug: 'wedding-jewellery',
      image: art('jewellery-edit-wedding', 'A stack of gold rings on a pale stone plinth with soft white flowers', {
        width: 1200, height: 686, srcSet: '/img/fashion-editorial/jewellery-edit-wedding-700.webp 700w, /img/fashion-editorial/jewellery-edit-wedding.webp 1200w', sizes: '(max-width: 700px) 100vw, 54vw',
      }) },
    { title: ['A gift', 'to treasure'], cta: 'Shop gifts', slug: 'jewellery-gifts',
      image: art('jewellery-edit-gifting', 'A diamond pendant on a fine chain, worn with an ivory silk top, beside a ribboned gift box', {
        width: 1200, height: 686, srcSet: '/img/fashion-editorial/jewellery-edit-gifting-700.webp 700w, /img/fashion-editorial/jewellery-edit-gifting.webp 1200w', sizes: '(max-width: 700px) 100vw, 46vw',
      }) },
  ],
  story: {
    eyebrow: 'Our story', title: 'Made to be worn every day',
    text: 'Pieces chosen for how they feel and how long they last, for the moments you want to remember.',
    cta: 'Our story', to: '/about',
    image: art('jewellery-story', 'A jeweller’s hands setting a small stone at a wooden workbench', { width: 800, height: 960 }),
  },
  newsletter: {
    title: 'Be the first to know',
    text: 'Subscribe to hear when new jewellery arrives. You can unsubscribe whenever you like.',
    image: art('jewellery-news', 'Two ivory gift boxes with champagne ribbons among small white flowers', {
      width: 1600, height: 625, mobile: '/img/fashion-editorial/jewellery-news-mobile.webp',
    }),
  },
};

// ---- What the admin edits (Storefronts → Fashion → Jewellery page) -------------------------------
// The page's sections in the schema's shape (storefrontContent.js), built from the content above.
// What is published replaces them field by field; a field that breaks its rule stays as it is here.
// An empty link means the page's own (the listing a tile or button opens today).
const edited = (image) => ({ image, picture: shot(image), alt: image.alt });
const J = JEWELLERY;
export const JEWELLERY_SECTIONS = Object.freeze({
  hero: { hidden: false, eyebrow: J.hero.eyebrow, title: [...J.hero.title], intro: J.hero.intro, cta: J.hero.cta, link: '', ...edited(J.hero.image), position: 'left' },
  trust: { hidden: false, items: J.trust.map((t) => ({ ...t, hidden: false, phone: [...t.phone], link: t.to })) },
  categories: { hidden: false, eyebrow: J.categories.eyebrow, title: J.categories.title, intro: J.categories.intro, items: J.categories.items.map((c) => ({ ...c, hidden: false, link: '', ...edited(c.image) })) },
  loved: { hidden: false, title: J.loved.title, viewAll: J.loved.viewAll },
  edits: { hidden: false, items: J.edits.map((e) => ({ ...e, hidden: false, title: [0, 1, 2].map((i) => e.title[i] || ''), link: '', ...edited(e.image) })) },
  story: { hidden: false, eyebrow: J.story.eyebrow, title: J.story.title, text: J.story.text, cta: J.story.cta, link: J.story.to, ...edited(J.story.image) },
  newsletter: { hidden: false, title: J.newsletter.title, text: J.newsletter.text, ...edited(J.newsletter.image) },
});
