// ============================================================
// Home & Living cart lines — the homeliving namespace in the shared cart.
//
// A stored line is { key, catalogue: 'homeliving', id, variantId, variant,
// qty }, keyed `homeliving:<id>::<variantId>` so it can never merge with, be
// priced as, or be pruned against a line of another store. Mirrors
// groceryCartLine.js: the rows come from catalogue_products (store =
// 'homeliving') through the shared catalogue cart cache, filled on demand for
// the ids in the cart. Unlike a grocery line, a Home & Living line is
// PURCHASABLE once its row has landed and nothing is wrong with it: the
// server prices it (api/_lib/pricing.js → trustedHomeLivingPrice), so the
// figure here is for display and nothing here is charged.
//
// A product with size × colour variants is stocked and (optionally) priced
// per variant, and its line must name one; a product without variants is
// stocked on its own row and its line names none.
// ============================================================
import { getHomeLivingProductsByIds, homelivingProductView } from '../data/homelivingHomepage.js';
import { isCatalogueIdResolved, catalogueRowFor, seedCatalogueRows, resetCatalogueCart, ensureCatalogueRows } from './catalogueCartCache.js';

export const HOMELIVING_CATALOGUE = 'homeliving';
export const homelivingLineKey = (productId, variantId) => `homeliving:${productId}::${variantId ?? ''}`;
export const isHomeLivingLine = (line) => line?.catalogue === HOMELIVING_CATALOGUE;

/** A fetch has answered for this id — present or gone. */
export const isHomeLivingIdResolved = (id) => isCatalogueIdResolved(HOMELIVING_CATALOGUE, id);
/**
 * What the cache keeps for a product, once its row has landed (null while
 * pending and when gone): the storefront's view of the row, so the cart and
 * the product page read the same price rule and the same active variants.
 */
export const homelivingEntryFor = (id) => catalogueRowFor(HOMELIVING_CATALOGUE, id);

/** Seed the cache directly (tests, SSR, or a page that already holds the rows). */
export function seedHomeLivingCart(products) {
  seedCatalogueRows(HOMELIVING_CATALOGUE, (Array.isArray(products) ? products : []).filter((p) => p?.id).map((p) => ({ id: p.id, entry: homelivingProductView(p) })));
}
export function resetHomeLivingCart() { resetCatalogueCart(HOMELIVING_CATALOGUE); }

/** Fetch any Home & Living ids not yet resolved. Safe to call on every render. */
export function ensureHomeLivingProducts(ids) {
  return ensureCatalogueRows(HOMELIVING_CATALOGUE, ids, getHomeLivingProductsByIds, homelivingProductView);
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * Shape one Home & Living line for display. Same fields hydrateCartLine
 * produces so Cart, Checkout and the summary render it unchanged. `view` is
 * what homelivingEntryFor() returned. Until the row lands the line is
 * PENDING: counted, shown without a price, blocking checkout with a reason,
 * never dropped. Once a fetch has confirmed the product gone it returns
 * null and the store prunes the line.
 */
export function hydrateHomeLivingCartLine(line, view, { resolved = false } = {}) {
  if (!view) {
    if (resolved) return null;
    return {
      ...line, product: { id: line.id, name: 'Home & Living item', slug: '', image: null, href: '/homeliving', form: null, cardImage: null },
      variantObj: null, variantLabel: line.variant ?? null, variantMissing: false, variantStock: null,
      unitPrice: null, unitMrp: null, lineTotal: 0, pending: true,
      unavailableReason: 'Checking availability…', purchasable: false,
    };
  }
  const variants = Array.isArray(view.variants) ? view.variants : [];
  const hasVariants = variants.length > 0;
  // view.variants holds the ACTIVE variants only, so one that was retired is simply not found.
  const v = line.variantId ? variants.find((x) => String(x.id) === String(line.variantId)) || null : null;
  const variantMissing = Boolean(line.variantId) && !v;
  const label = v ? [v.size, v.colour].filter(Boolean).join(' · ') || null : (line.variant ?? null);
  const override = v && v.price_override != null ? num(v.price_override) : null;
  const unitPrice = variantMissing ? null : (override != null && override > 0 ? override : (num(view.price) > 0 ? num(view.price) : null));
  const unitMrp = unitPrice == null ? null : Math.max(num(view.mrp), unitPrice);
  const stock = hasVariants ? (v ? Math.max(0, Math.floor(num(v.stock))) : null) : Math.max(0, Math.floor(num(view.stock)));

  let unavailableReason = null;
  if (view.is_active === false) unavailableReason = 'This item is no longer available.';
  else if (variantMissing) unavailableReason = hasVariants && label ? `“${label}” is no longer available.` : 'This item is no longer sold in that option.';
  else if (hasVariants && !v) unavailableReason = 'Please choose a size for this item.';
  else if (stock === 0) unavailableReason = hasVariants ? 'This option is out of stock.' : 'This item is out of stock.';
  else if (stock != null && line.qty > stock) unavailableReason = stock === 1 ? 'Only 1 left — please reduce the quantity.' : `Only ${stock} left — please reduce the quantity.`;
  else if (!(unitPrice > 0)) unavailableReason = 'This item is not available to buy right now.';

  const image = Array.isArray(view.images) && view.images[0] ? view.images[0] : null;
  return {
    ...line,
    product: {
      id: view.id, name: view.name, slug: view.slug, brand: view.brand || '', image, cardImage: image,
      gallery: Array.isArray(view.images) ? view.images : [], href: `/homeliving/p/${view.slug}`, form: hasVariants ? null : (view.net_content || null),
      price: unitPrice, mrp: unitMrp,
    },
    variantObj: v ? { id: String(v.id), label, price: unitPrice, mrp: unitMrp, stock, size: v.size, colour: v.colour || null, colour_hex: v.colour_hex || null } : null,
    variantLabel: label ?? (hasVariants ? null : view.net_content ?? null),
    variantMissing,
    variantStock: stock,
    unitPrice,
    unitMrp,
    lineTotal: unitPrice == null ? 0 : unitPrice * line.qty,
    unavailableReason,
    purchasable: unavailableReason == null,
  };
}

/** Which stored Home & Living lines point at a product a fetch has confirmed gone. */
export function homelivingKeysToPrune(lines) {
  return (Array.isArray(lines) ? lines : [])
    .filter((l) => isHomeLivingLine(l) && isHomeLivingIdResolved(l.id) && !homelivingEntryFor(l.id))
    .map((l) => l.key);
}
