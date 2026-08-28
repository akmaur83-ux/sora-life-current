// ============================================================
// PDP PRESENTATIONAL CONTENT — Part 1 of the premium PDP upgrade
//
// The live catalogue (Supabase `products`) carries only a free-text
// `description`; there are NO structured benefits / ingredients / usage /
// FAQ / review columns. These helpers fill the redesigned PDP sections.
//
// PRODUCT-CONTENT SAFETY (hard rules — do not relax):
//   • Real structured product data ALWAYS wins:
//       product.benefits[]  product.ingredients[]  product.usage  product.description
//   • A product-specific section shows ONLY when it has real, product-
//     specific data. No generic / store-wide / category filler is used to
//     keep a section on screen:
//       – benefitsFor()      → [] when no product.benefits   → section hidden
//       – ingredientsFor()   → [] when no product.ingredients → section hidden
//       – howToUseFor()      → empty when no product.usage    → section hidden
//       – suitableForList()  → [] (no structured field yet)   → accordion row omitted
//   • NEVER name an ingredient/botanical/active or assert a product-specific
//     benefit, result, dosage or frequency that is not in the real data.
//     Category is not a licence to guess.
//   • overviewFor() keeps a neutral product-specific fallback (name / size /
//     category) — it is the one always-present textual anchor.
//   • Store-wide trust promises live ONLY in <ProductTrustList> (TRUST_ITEMS).
//   • Rating/review helpers never fabricate numbers (Part 3 seam).
//   • The offer helper is only the Part 2 entry point — no codes, no math.
// ============================================================
import { categoryBySlug } from './categories.js';

const FREE_SHIP_THRESHOLD = 699; // mirrors the announcement bar / existing PDP copy

// ------------------------------------------------------------
// RATING / REVIEW SUMMARY  (Part 3 wires these to the real feed)
// ------------------------------------------------------------
/**
 * @returns {{ rating:number|null, count:number, isPreview:boolean }}
 *   isPreview=false → real aggregate from the catalogue row
 *   isPreview=true  → no real reviews yet; the UI shows a "coming soon"
 *                     placeholder and NO numbers (no fabricated ratings).
 */
export function ratingSummaryFor(product) {
  if (product && product.reviewCount > 0) {
    return { rating: product.rating, count: product.reviewCount, isPreview: false };
  }
  return { rating: null, count: 0, isPreview: true };
}

/**
 * Real, persisted reviews when the catalogue has them; otherwise an empty
 * list — Part 1 never fabricates a review. Part 3 replaces the source.
 * @returns {{ items:object[], isPreview:boolean }}
 */
export function previewReviewsFor(product) {
  if (product && Array.isArray(product.reviews) && product.reviews.length) {
    return { items: product.reviews, isPreview: false };
  }
  return { items: [], isPreview: true };
}

// ------------------------------------------------------------
// OFFERS TEASER  (Part 2 coupon system plugs in here)
// ------------------------------------------------------------
/**
 * Honest offer rows for the PDP entry point. The first two are REAL,
 * store-wide policy (announcement bar). The third is an explicit
 * "coming soon" placeholder for the Part 2 coupon engine — no code,
 * no discount math, nothing wired into checkout.
 */
export function offersFor(product) {
  const currency = product?.currency || '₹';
  return [
    {
      icon: 'truck',
      title: `Free shipping over ${currency}${FREE_SHIP_THRESHOLD.toLocaleString('en-IN')}`,
      note: 'Applied automatically at checkout — no code needed.',
      real: true,
    },
    {
      icon: 'card',
      title: 'Cash on delivery available',
      note: 'Pay when your order arrives, on eligible PIN codes.',
      real: true,
    },
    {
      icon: 'tag',
      title: 'Coupons & bank offers',
      note: 'Promo codes and card offers are launching soon.',
      real: false,
    },
  ];
}

// ------------------------------------------------------------
// DELIVERY / SERVICE
// ------------------------------------------------------------
/**
 * Presentation-safe delivery estimate. Computes a friendly date window
 * client-side from "today"; makes no real-time carrier claims.
 */
export function deliveryEstimate(fromDate = new Date()) {
  const fmt = (d) =>
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const lo = new Date(fromDate); lo.setDate(lo.getDate() + 2);
  const hi = new Date(fromDate); hi.setDate(hi.getDate() + 4);
  return {
    range: `${fmt(lo)} – ${fmt(hi)}`,
    days: '2–4 business days',
    freeThreshold: FREE_SHIP_THRESHOLD,
    place: 'India',
  };
}

// ------------------------------------------------------------
// BENEFITS — "Why you'll love it"
// Real product.benefits[] ONLY. No store-wide / category filler — if the
// catalogue has no product-specific benefits the section hides itself.
// ------------------------------------------------------------
/**
 * @returns {{ items: {icon,label,text}[], real:boolean }}
 */
export function benefitsFor(product) {
  const real = product && Array.isArray(product.benefits)
    ? product.benefits.filter((b) => typeof b === 'string' && b.trim())
    : [];
  if (!real.length) return { items: [], real: false };
  return {
    real: true,
    items: real.slice(0, 4).map((b) => ({ icon: 'check', label: b.trim(), text: '' })),
  };
}

// ------------------------------------------------------------
// KEY INGREDIENTS
// Real product.ingredients[] ONLY. No hero card, no derived botanical —
// if the catalogue has no ingredient data the section hides itself.
// ------------------------------------------------------------
/**
 * @returns {{ items: {name,note}[], real:boolean }}
 */
export function ingredientsFor(product) {
  const real = product && Array.isArray(product.ingredients)
    ? product.ingredients.filter((s) => typeof s === 'string' && s.trim())
    : [];
  if (!real.length) return { items: [], real: false };
  return { real: true, items: real.map((name) => ({ name: name.trim(), note: '' })) };
}

// ------------------------------------------------------------
// HOW TO USE
// Real product.usage ONLY. No generic "read the pack / storage / safety"
// filler — if there is no product-specific usage the section hides itself.
// ------------------------------------------------------------
/**
 * @returns {{ text:string, steps:string[], real:boolean }}
 */
export function howToUseFor(product) {
  if (product && typeof product.usage === 'string' && product.usage.trim()) {
    return { text: product.usage.trim(), steps: [], real: true };
  }
  return { text: '', steps: [], real: false };
}

// ------------------------------------------------------------
// SUITABLE FOR  (accordion row)
// The catalogue has no structured "suitable for" field, and category alone
// is not enough to assert an audience. Returns [] so the row is omitted.
// When a real field is added, return its values here.
// ------------------------------------------------------------
export function suitableForList(product) {
  const real = product && Array.isArray(product.suitableFor)
    ? product.suitableFor.filter((s) => typeof s === 'string' && s.trim())
    : [];
  return real;
}

// ------------------------------------------------------------
// OVERVIEW  (accordion) — real description wins; otherwise a neutral
// sentence with NO category marketing blurb (those mention ingredients).
// ------------------------------------------------------------
export function overviewFor(product) {
  if (product && typeof product.description === 'string' && product.description.trim()) {
    return { text: product.description.trim(), real: true };
  }
  const cat = categoryBySlug[product?.category];
  const size = product?.form ? ` (${product.form})` : '';
  return {
    real: false,
    text:
      `${product?.name}${size} is part of the SORA LIFE ${cat?.name || 'wellness'} range, ` +
      'sourced and fulfilled by SORA LIFE in genuine, sealed packaging. ' +
      'See the product pack for the full ingredient list and directions for use.',
  };
}

// ------------------------------------------------------------
// FAQ — every answer mirrors an existing store promise
// (announcement bar / footer / current PDP copy). Nothing new invented.
// ------------------------------------------------------------
export function faqFor(product) {
  const currency = product?.currency || '₹';
  return [
    {
      q: 'Are these genuine products?',
      a: 'Yes. Every order ships as authentic, sealed stock and is fulfilled by SORA LIFE.',
    },
    {
      q: 'How long will delivery take?',
      a: 'Most orders arrive within 2–4 business days. Enter your PIN code at checkout for a precise estimate.',
    },
    {
      q: 'Is free shipping available?',
      a: `Yes — free shipping on orders above ${currency}${FREE_SHIP_THRESHOLD.toLocaleString('en-IN')}. Cash on delivery is available on eligible PIN codes.`,
    },
    {
      q: 'Can I return it?',
      a: 'Unopened items can be returned within 15 days. See Shipping & Returns for full details.',
    },
  ];
}

// ------------------------------------------------------------
// TRUST / ASSURANCE — mirrors existing footer + announcement promises
// ------------------------------------------------------------
export const TRUST_ITEMS = [
  ['truck', 'Free shipping', 'On every order above ₹699'],
  ['card', 'COD available', 'Pay on delivery where eligible'],
  ['lock', 'Secure payments', 'Encrypted checkout via Razorpay'],
  ['shield', 'Genuine products', 'Authentic, sealed stock only'],
  ['return', 'Easy 15-day returns', 'On unopened items'],
];
