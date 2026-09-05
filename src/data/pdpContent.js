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
//   • Store-wide operational facts live ONLY in <ProductTrustList>
//     (TRUST_ITEMS). Unverified sourcing, authenticity and returns claims are
//     deliberately excluded.
//   • Rating/review helpers never fabricate numbers (Part 3 seam).
//   • The offer helper is only the Part 2 entry point — no codes, no math.
// ============================================================
import { categoryBySlug } from './categories.js';

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
 * Honest operational rows for the PDP entry point. They mirror the current
 * checkout: Standard delivery is free and cash on delivery is one of its
 * real payment methods. Configured promotions
 * are supplied separately by the promotions system.
 */
export function offersFor() {
  return [
    {
      icon: 'truck',
      title: 'Free standard shipping',
      note: 'Select Standard delivery at checkout.',
      real: true,
    },
    {
      icon: 'card',
      title: 'Cash on delivery available',
      note: 'Choose it from the payment methods at checkout.',
      real: true,
    },
  ];
}

// ------------------------------------------------------------
// DELIVERY / SERVICE
// ------------------------------------------------------------
/**
 * Delivery display data. Timing is intentionally deferred to checkout because
 * the PDP has no address or carrier response from which to promise a date.
 */
export function deliveryEstimate() {
  return {
    range: 'Confirmed at checkout',
    days: 'Based on your delivery address and chosen method',
  };
}

/**
 * The three delivery methods a customer can actually choose, with the fee
 * each one actually costs.
 *
 * AUTHORITY: api/_lib/pricing.js — `DELIVERY_FEES = { std: 0, exp: 79, sched: 49 }`
 * is the only thing that decides what is charged. This list is display copy for
 * the PDP and must be kept in step with it; Checkout.jsx carries the same three
 * rows for the picker itself.
 *
 * The fee is FLAT AT EVERY BASKET SIZE. There is no free-shipping threshold,
 * and no surface may imply one — a `freeShippingThreshold` setting was removed
 * for exactly this reason. Standard is free because Standard is free, not
 * because the basket reached some amount.
 */
export function deliveryOptions() {
  return [
    { id: 'std', label: 'Standard', eta: '3–5 business days', price: 0 },
    { id: 'exp', label: 'Express', eta: '1–2 business days', price: 79 },
    { id: 'sched', label: 'Scheduled', eta: 'Choose your date', price: 49 },
  ];
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
// OVERVIEW  (accordion) — real description wins; otherwise a neutral catalogue
// identity line. It makes no provenance, fulfilment or packaging claim.
// ------------------------------------------------------------
export function overviewFor(product) {
  if (product && typeof product.description === 'string' && product.description.trim()) {
    return { text: product.description.trim(), real: true };
  }
  const cat = categoryBySlug[product?.category];
  const size = product?.form ? ` (${product.form})` : '';
  return {
    real: false,
    text: `${product?.name}${size} is listed in ${cat?.name || 'the catalogue'}. Refer to the product pack for official product details and directions.`,
  };
}

// ------------------------------------------------------------
// FAQ — real structured catalogue rows only. The current catalogue has no FAQ
// field, so this returns [] and the accordion row stays absent.
// ------------------------------------------------------------
export function faqFor(product) {
  if (!Array.isArray(product?.faqs)) return [];
  return product.faqs
    .filter((item) => item && typeof item.q === 'string' && item.q.trim() && typeof item.a === 'string' && item.a.trim())
    .map((item) => ({ q: item.q.trim(), a: item.a.trim() }));
}

// ------------------------------------------------------------
// TRUST / ASSURANCE — operational storefront facts only
// ------------------------------------------------------------
export const TRUST_ITEMS = [
  ['truck', 'Free standard shipping', 'Select Standard delivery at checkout'],
  ['card', 'Payment options', 'Available methods are shown at checkout'],
  ['package', 'Order details', 'Available in your account after purchase'],
];
