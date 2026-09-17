// ============================================================
// Grocery cart lines — the grocery namespace in the shared cart.
//
// A stored grocery line is { key, catalogue: 'grocery', id, variantId: null,
// variant, qty }, keyed `grocery:<id>::` so it can never merge with, be
// priced as, or be pruned against a wellness or fashion line. Mirrors
// fashionCartLine.js; the only difference is where the rows come from —
// for now the TEMPORARY homepage data file (src/data/groceryHomepage.js),
// synchronously, so there is no pending state and nothing to fetch.
//
// Until the catalogue migration gives the server a grocery table to price
// from, a grocery line is shown with its display price but is NOT
// purchasable: Cart and Checkout block on `unavailableReason`, so no
// grocery item can reach create-order. Nothing here is charged.
// ============================================================
import { productById } from '../data/groceryHomepage.js';

export const GROCERY_CATALOGUE = 'grocery';
export const groceryLineKey = (productId, variantId) => `grocery:${productId}::${variantId ?? ''}`;
export const isGroceryLine = (line) => line?.catalogue === GROCERY_CATALOGUE;

export const GROCERY_CHECKOUT_NOTE = 'Grocery checkout is opening soon — this item cannot be ordered yet.';

export const groceryProductFor = (id) => productById(id);

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * Shape one grocery line for display. Same fields hydrateCartLine produces
 * so Cart, Checkout and the summary render it unchanged. A product no
 * longer in the data file returns null and the store prunes the line.
 */
export function hydrateGroceryCartLine(line, product) {
  if (!product) return null;
  const unitPrice = num(product.price) > 0 ? num(product.price) : null;
  const unitMrp = unitPrice == null ? null : Math.max(num(product.mrp), unitPrice);
  const unavailableReason = unitPrice == null ? 'This item is not available to buy right now.' : GROCERY_CHECKOUT_NOTE;
  return {
    ...line,
    product: {
      id: product.id, name: product.name, slug: product.slug, brand: product.brand || '', image: product.image, cardImage: product.image,
      gallery: product.image ? [product.image] : [], href: '/grocery', form: product.pack || null,
      price: unitPrice, mrp: unitMrp,
    },
    variantObj: null,
    variantLabel: line.variant ?? product.pack ?? null,
    variantMissing: false,
    variantStock: null,
    unitPrice,
    unitMrp,
    lineTotal: unitPrice == null ? 0 : unitPrice * line.qty,
    unavailableReason,
    purchasable: unavailableReason == null,
  };
}

/** Which stored grocery lines point at a product the data file no longer has. */
export function groceryKeysToPrune(lines) {
  return (Array.isArray(lines) ? lines : [])
    .filter((l) => isGroceryLine(l) && !groceryProductFor(l.id))
    .map((l) => l.key);
}
