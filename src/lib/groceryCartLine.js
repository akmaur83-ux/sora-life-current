// ============================================================
// Grocery cart lines — the grocery namespace in the shared cart.
//
// A stored grocery line is { key, catalogue: 'grocery', id, variantId: null,
// variant, qty }, keyed `grocery:<id>::` so it can never merge with, be
// priced as, or be pruned against a wellness or fashion line. Mirrors
// fashionCartLine.js: the rows come from catalogue_products (store =
// 'grocery') through the shared catalogue cart cache, filled on demand for
// the ids in the cart — the cart page prices a grocery line without the
// /grocery shell's catalogue being mounted.
//
// Until the rows land a line is PENDING: counted, shown without a price,
// blocking checkout with a reason, never dropped. Once they have landed a
// grocery line is shown with its display price but is still NOT
// purchasable: the server prices only wellness and fashion lines until the
// grocery checkout opens, so Cart and Checkout block on `unavailableReason`
// and no grocery item can reach create-order. Nothing here is charged.
// ============================================================
import { getGroceryProductsByIds, groceryProductView } from '../data/groceryHomepage.js';
import { isCatalogueIdResolved, catalogueRowFor, seedCatalogueRows, resetCatalogueCart, ensureCatalogueRows } from './catalogueCartCache.js';

export const GROCERY_CATALOGUE = 'grocery';
export const groceryLineKey = (productId, variantId) => `grocery:${productId}::${variantId ?? ''}`;
export const isGroceryLine = (line) => line?.catalogue === GROCERY_CATALOGUE;

export const GROCERY_CHECKOUT_NOTE = 'Grocery checkout is opening soon — this item cannot be ordered yet.';

/** A fetch has answered for this id — present or gone. */
export const isGroceryIdResolved = (id) => isCatalogueIdResolved(GROCERY_CATALOGUE, id);
/** The product behind a line, once its row has landed (null while pending or when gone). */
export const groceryProductFor = (id) => catalogueRowFor(GROCERY_CATALOGUE, id);

/** Seed the cache directly (tests, SSR, or a page that already holds the rows). */
export function seedGroceryCart(products) {
  seedCatalogueRows(GROCERY_CATALOGUE, (Array.isArray(products) ? products : []).filter((p) => p?.id).map((p) => ({ id: p.id, entry: groceryProductView(p) })));
}
export function resetGroceryCart() { resetCatalogueCart(GROCERY_CATALOGUE); }

/** Fetch any grocery ids not yet resolved. Safe to call on every render. */
export function ensureGroceryProducts(ids) {
  return ensureCatalogueRows(GROCERY_CATALOGUE, ids, getGroceryProductsByIds, groceryProductView);
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * Shape one grocery line for display. Same fields hydrateCartLine produces
 * so Cart, Checkout and the summary render it unchanged. `product` is what
 * groceryProductFor() returned: null before the row has landed (pending)
 * and null once a fetch confirmed it gone (then the store prunes the line).
 */
export function hydrateGroceryCartLine(line, product) {
  if (!product) {
    if (isGroceryIdResolved(line.id)) return null;
    return {
      ...line, product: { id: line.id, name: 'Grocery item', slug: '', image: null, href: '/grocery', form: null, cardImage: null },
      variantObj: null, variantLabel: line.variant ?? null, variantMissing: false, variantStock: null,
      unitPrice: null, unitMrp: null, lineTotal: 0, pending: true,
      unavailableReason: 'Checking availability…', purchasable: false,
    };
  }
  const unitPrice = num(product.price) > 0 ? num(product.price) : null;
  const unitMrp = unitPrice == null ? null : Math.max(num(product.mrp), unitPrice);
  const image = Array.isArray(product.images) && product.images[0] ? product.images[0] : null;
  let unavailableReason = null;
  if (product.is_active === false) unavailableReason = 'This item is no longer available.';
  else if (unitPrice == null) unavailableReason = 'This item is not available to buy right now.';
  else unavailableReason = GROCERY_CHECKOUT_NOTE;
  return {
    ...line,
    product: {
      id: product.id, name: product.name, slug: product.slug, brand: product.brand || '', image, cardImage: image,
      gallery: Array.isArray(product.images) ? product.images : [], href: '/grocery', form: product.net_content || null,
      price: unitPrice, mrp: unitMrp,
    },
    variantObj: null,
    variantLabel: line.variant ?? product.net_content ?? null,
    variantMissing: false,
    variantStock: null,
    unitPrice,
    unitMrp,
    lineTotal: unitPrice == null ? 0 : unitPrice * line.qty,
    unavailableReason,
    purchasable: unavailableReason == null,
  };
}

/**
 * The store's grocery reconciliation, run from an effect on every cart
 * change: ask for the rows behind any unresolved grocery line (the cache
 * bumps the shared version when they land, and the cart re-prices), and
 * report the lines whose product a fetch has confirmed gone.
 */
export function groceryKeysToPrune(lines) {
  const grocery = (Array.isArray(lines) ? lines : []).filter(isGroceryLine);
  const unresolved = grocery.filter((l) => !isGroceryIdResolved(l.id)).map((l) => l.id);
  if (unresolved.length) ensureGroceryProducts(unresolved);
  return grocery
    .filter((l) => isGroceryIdResolved(l.id) && !groceryProductFor(l.id))
    .map((l) => l.key);
}
