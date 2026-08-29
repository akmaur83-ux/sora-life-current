// ============================================================
// STOREFRONT CATEGORIES — the 8 circles on the homepage.
// Mapped from the real Biosash catalog (see biosash.js). Order
// matches the homepage category strip.
// ============================================================
const DEFAULT_CATEGORIES = [
  { slug: 'wellness',      name: 'Wellness',        tagline: 'Everyday Himalayan wellness',   tone: 'forest', blurb: 'Sea-buckthorn health essentials for daily balance and vitality.', icon: 'heart' },
  { slug: 'juices-drinks', name: 'Juices & Drinks', tagline: 'Cold-pressed nutrition',        tone: 'lime',   blurb: 'Nutritional juices and drinks powered by Himalayan sea buckthorn.', icon: 'bottle' },
  { slug: 'supplements',   name: 'Supplements',     tagline: 'Herbal & Ayurvedic support',    tone: 'clay',   blurb: 'Ayurvedic and herbal supplements for targeted daily support.', icon: 'capsule' },
  { slug: 'skin-care',     name: 'Skin Care',       tagline: 'Radiance, naturally',           tone: 'rose',   blurb: 'Serums, creams and cleansers rich in sea-buckthorn oil.', icon: 'sparkle' },
  { slug: 'hair-care',     name: 'Hair Care',       tagline: 'Roots to ends',                 tone: 'plum',   blurb: 'Shampoos, oils and treatments for stronger, healthier hair.', icon: 'drop' },
  { slug: 'bath-body',     name: 'Bath & Body',     tagline: 'Soaps & body rituals',          tone: 'teal',   blurb: 'Handmade soaps, body oils and washes for nourished skin.', icon: 'shield' },
  { slug: 'mens-care',     name: "Men's Care",      tagline: 'Grooming essentials',           tone: 'moss',   blurb: 'Beard, shave and grooming essentials made for men.', icon: 'star' },
  { slug: 'personal-care', name: 'Personal Care',   tagline: 'Hygiene & daily care',          tone: 'sky',    blurb: 'Everyday hygiene and personal-care essentials.', icon: 'sparkle' },
];

// Live-bound (let) so applyCategories() from the Supabase `categories`
// table can replace this at bootstrap. Default = exactly today's 8 circles.
export let categories = DEFAULT_CATEGORIES;
export let categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

// Category copy is safe to present as approved only after it has come from the
// public categories table managed by Admin. The built-in list is a navigation
// fallback; its historical taglines/blurbs are not proof of configured copy.
export function hasConfiguredCategoryCopy(category) {
  return category?._copyConfigured === true;
}

function isValidSlug(s) {
  return typeof s === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
}
function slugify(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function applyCategories(list) {
  if (!Array.isArray(list) || list.length === 0) return false;
  categories = list.map((c) => {
    if (isValidSlug(c.slug)) return { ...c, _copyConfigured: true };
    // A malformed stored slug (e.g. stray spaces/slashes from a data-entry
    // accident) would otherwise 404 every link to this category, including
    // the hardcoded nav links. Derive a clean slug from the category's own
    // name so pages still resolve correctly — the underlying Supabase row
    // is left untouched.
    const repaired = slugify(c.name);
    return repaired ? { ...c, slug: repaired, _copyConfigured: true } : { ...c, _copyConfigured: true };
  });
  categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));
  return true;
}

// Tone → gradient/accent used by fallback tiles and category theming.
export const tones = {
  forest: { a: '#2C5341', b: '#1E3A2F', accent: '#E8B04B', tint: '#E1EEE7' },
  lime:   { a: '#5B8C3A', b: '#3E6B2A', accent: '#F0C169', tint: '#EAF3DD' },
  amber:  { a: '#C98A32', b: '#A96C1E', accent: '#FBE9C8', tint: '#FDF4E4' },
  clay:   { a: '#C56A45', b: '#9E4E2F', accent: '#F6D79A', tint: '#F7E7DF' },
  moss:   { a: '#586E3A', b: '#3D4F26', accent: '#E8B04B', tint: '#E9EEDD' },
  plum:   { a: '#7A5476', b: '#573A54', accent: '#F0C169', tint: '#EEE4EC' },
  rose:   { a: '#C57389', b: '#9E5065', accent: '#F6D79A', tint: '#F6E6EA' },
  honey:  { a: '#D9A441', b: '#B47F22', accent: '#FBE9C8', tint: '#FBF1DD' },
  teal:   { a: '#2E7D74', b: '#1E5A53', accent: '#F0C169', tint: '#DDEEEB' },
  sky:    { a: '#4E82A8', b: '#356184', accent: '#F6D79A', tint: '#E1ECF3' },
};
