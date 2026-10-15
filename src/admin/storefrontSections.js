import { HERO_SECTION, TRUST_SECTION, TILES_SECTION, STORES_SECTION, FESTIVE_SECTION, JEWELLERY_BANNER_SECTION } from '../components/HomeStorefront.jsx';
import { LIFESTYLE_SECTION, STORE_CAROUSEL_SECTION } from '../components/FashionBanner.jsx';
import { DELIVERY_STRIP } from '../fashion/FashionLayout.jsx';
import { BENEFITS_STRIP } from '../fashion/FashionHome.jsx';
import { DEPARTMENT_SECTIONS } from '../fashion/departmentContent.js';
import { JEWELLERY_SECTIONS } from '../fashion/jewelleryContent.js';
import { HOMELIVING_SECTIONS } from '../data/homelivingHomepage.js';
import { GROCERY_SECTIONS } from '../data/groceryHomepage.js';

// ============================================================
// ADMIN — the storefront sections an admin edits, page by page, each with
// its built-in content (the defaults beside the component that renders it).
// The fields, their labels and their rules are the schema's
// (storefrontContent.js → STOREFRONT_SCHEMAS); this only says where each
// section lives and what it shows when a field is left empty.
// ============================================================

const each = (prefix, sections) => Object.entries(sections).map(([key, defaults]) => ({ path: `${prefix}${key}`, defaults }));

export const SECTION_PAGES = Object.freeze({
  wellness: [
    { title: 'Wellness homepage', href: '/', sections: [
      { path: 'hero', defaults: HERO_SECTION },
      { path: 'trust', defaults: TRUST_SECTION },
      { path: 'tiles', defaults: TILES_SECTION },
      { path: 'stores', defaults: STORES_SECTION },
      { path: 'promo', defaults: FESTIVE_SECTION },
      { path: 'lifestyleBanner', defaults: LIFESTYLE_SECTION },
      { path: 'jewelleryBanner', defaults: JEWELLERY_BANNER_SECTION },
      { path: 'storeCarousel', defaults: STORE_CAROUSEL_SECTION },
    ] },
  ],
  fashion: [
    { title: 'Fashion strips', href: '/fashion', sections: [
      { path: 'strips.delivery', defaults: DELIVERY_STRIP },
      { path: 'strips.benefits', defaults: BENEFITS_STRIP },
    ] },
    { title: "Women's page", href: '/fashion/women', sections: each('women.', DEPARTMENT_SECTIONS.women) },
    { title: "Men's page", href: '/fashion/men', sections: each('men.', DEPARTMENT_SECTIONS.men) },
    { title: 'Saree page', href: '/fashion/women/sarees', sections: each('sarees.', DEPARTMENT_SECTIONS.sarees) },
    { title: 'Jewellery page', href: '/fashion/jewellery', sections: each('jewellery.', JEWELLERY_SECTIONS) },
  ],
  homeliving: [{ title: 'Home & Living homepage', href: '/homeliving', sections: each('', HOMELIVING_SECTIONS) }],
  grocery: [{ title: 'Grocery homepage', href: '/grocery', sections: each('', GROCERY_SECTIONS) }],
  lifestyle: [],
});
