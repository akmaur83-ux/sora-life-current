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
/**
 * Per-unit price for a pack, e.g. "₹1.25/ml" for ₹312 of 250 ml.
 *
 * Comparing pack sizes is the one bit of arithmetic a customer should not have
 * to do in their head, and it is the whole reason a two-pack selector exists.
 *
 * Returns null rather than guessing whenever the label is not a plain
 * "<number> <unit>": "Combo of 2", "Family pack" and "60 tablets + 1 free" all
 * produce no line at all. A per-unit figure derived from a misread label is
 * worse than none, because it looks authoritative.
 *
 * The unit is echoed exactly as written, so "ml" stays "ml" and "tablets"
 * becomes "tablet" only through the crude plural trim below — nothing is
 * converted between units.
 */
export function perUnitPrice(price, label) {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const m = String(label || '').trim().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/i);
  if (!m) return null;
  const qty = Number(m[1]);
  if (!Number.isFinite(qty) || qty <= 1) return null;   // "1 kg" tells nobody anything
  const unit = m[2].toLowerCase().replace(/s$/, '');
  const each = amount / qty;
  // Two decimals below ₹10, none above: "₹0.42/ml" is useful, "₹31.00/tablet"
  // is just noise with a decimal point in it.
  const shown = each < 10 ? each.toFixed(2) : String(Math.round(each));
  return `₹${shown}/${unit}`;
}

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
 * BENEFITS — "Why you'll love it"
 *
 * Accepts both shapes the catalogue can carry. Migration 0025 stores
 * [{ title, description?, icon? }]; before it, the field was a bare string
 * array, and a product edited by hand may still be one. Neither is invented:
 * an empty or absent field returns real:false and the section hides.
 *
 * @returns {{ items: {icon,label,text}[], real:boolean }}
 */
export function benefitsFor(product) {
  const raw = Array.isArray(product?.benefits) ? product.benefits : [];
  const items = raw.map((b) => {
    if (typeof b === 'string') {
      return b.trim() ? { icon: 'check', label: b.trim(), text: '' } : null;
    }
    if (b && typeof b === 'object') {
      const label = String(b.title || '').trim();
      const text = String(b.description || '').trim();
      // A body with no heading is still a benefit; it just leads with itself.
      if (!label && !text) return null;
      return { icon: String(b.icon || 'check'), label: label || text, text: label ? text : '' };
    }
    return null;
  }).filter(Boolean);
  if (!items.length) return { items: [], real: false };
  return { real: true, items };
}

// ------------------------------------------------------------
// KEY INGREDIENTS
// Real product.ingredients[] ONLY. No hero card, no derived botanical —
// if the catalogue has no ingredient data the section hides itself.
// ------------------------------------------------------------
/**
 * @returns {{ items: {name,note,image}[], real:boolean }}
 */
export function ingredientsFor(product) {
  const raw = Array.isArray(product?.ingredients) ? product.ingredients : [];
  const items = raw.map((i) => {
    if (typeof i === 'string') {
      return i.trim() ? { name: i.trim(), note: '', image: '' } : null;
    }
    if (i && typeof i === 'object') {
      const name = String(i.name || '').trim();
      if (!name) return null;
      return {
        name,
        note: String(i.description || '').trim(),
        // The ingest nulls any URL that did not serve an image, so anything
        // still here has been checked. Never render an unchecked src.
        image: String(i.image_url || '').trim(),
      };
    }
    return null;
  }).filter(Boolean);
  if (!items.length) return { items: [], real: false };
  return { real: true, items };
}

// ------------------------------------------------------------
// HOW TO USE
// Real product data ONLY. No generic "read the pack / storage / safety"
// filler — if there is no product-specific usage the section hides itself.
// ------------------------------------------------------------
/**
 * @returns {{ text:string, steps:{step,text}[], real:boolean }}
 */
export function howToUseFor(product) {
  const raw = Array.isArray(product?.howToUse) ? product.howToUse : [];
  const steps = raw.map((s, n) => {
    if (typeof s === 'string') return s.trim() ? { step: n + 1, text: s.trim() } : null;
    if (s && typeof s === 'object' && String(s.text || '').trim()) {
      return { step: Number(s.step) || n + 1, text: String(s.text).trim() };
    }
    return null;
  }).filter(Boolean);
  if (steps.length) return { text: '', steps, real: true };
  // Legacy single-string field, still the only source for hand-edited rows.
  if (typeof product?.usage === 'string' && product.usage.trim()) {
    return { text: product.usage.trim(), steps: [], real: true };
  }
  return { text: '', steps: [], real: false };
}

// ------------------------------------------------------------
// SPECIFICATIONS — a plain key/value table.
// Object order is the author's order; keys with no value are dropped so a
// half-filled record cannot render a row reading "Shelf life:".
// ------------------------------------------------------------
/**
 * @returns {{ rows: {key,value}[], real:boolean }}
 */
export function specificationsFor(product) {
  const spec = product?.specifications;
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return { rows: [], real: false };
  const rows = Object.entries(spec)
    .map(([key, value]) => ({ key: String(key).trim(), value: String(value ?? '').trim() }))
    .filter((r) => r.key && r.value);
  return { rows, real: rows.length > 0 };
}

// ------------------------------------------------------------
// KEY CLAIMS — short badge strings ("Paraben Free"), never sentences.
// Anything long enough to be a sentence is dropped rather than truncated: a
// clipped claim is a changed claim.
// ------------------------------------------------------------
/**
 * @returns {string[]}
 */
export function keyClaimsFor(product) {
  const raw = Array.isArray(product?.keyClaims) ? product.keyClaims : [];
  return raw
    .map((c) => String(c ?? '').trim())
    .filter((c) => c && c.length <= 32)
    .slice(0, 6);
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
