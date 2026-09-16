// ============================================================
// Fashion cart lines — hydration against the FASHION catalogue.
//
// A stored fashion line is { key, catalogue: 'fashion', id, variantId,
// variant, qty }: the product id and the size × colour variant id. It is
// priced for display from fashion_products / fashion_variants, never from
// the wellness catalogue, and it is never pruned by the wellness
// reconciliation. The payable amount is the server's (api/_lib/pricing.js
// → trustedFashionPrice); nothing here is charged.
//
// The rows live in a small module cache the store fills on demand for the
// ids in the cart, so the cart page can price a fashion line without the
// /fashion shell's catalogue being mounted.
// ============================================================
import { getFashionProductsByIds } from './fashionApi.js';

export const FASHION_CATALOGUE = 'fashion';
export const fashionLineKey = (productId, variantId) => `fashion:${productId}::${variantId ?? ''}`;
export const isFashionLine = (line) => line?.catalogue === FASHION_CATALOGUE;

const rows = new Map();      // product id → { row, variants }
const known = new Set();     // ids a fetch has answered for (present or not)
let cacheVersion = 0;
let inflight = null;
const listeners = new Set();
const bump = () => { cacheVersion += 1; for (const l of listeners) l(); };

export const getFashionCartVersion = () => cacheVersion;
export const subscribeFashionCart = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
/** A fetch has answered for this id — present or gone. */
export const isFashionIdResolved = (id) => known.has(String(id));
export const fashionRowFor = (id) => rows.get(String(id)) || null;

/** Seed the cache directly (tests, SSR, or a page that already holds the rows). */
export function seedFashionCart(products) {
  for (const p of Array.isArray(products) ? products : []) {
    if (!p?.id) continue;
    rows.set(String(p.id), { row: p, variants: Array.isArray(p.fashion_variants) ? p.fashion_variants : [] });
    known.add(String(p.id));
  }
  bump();
}
export function resetFashionCart() { rows.clear(); known.clear(); inflight = null; bump(); }

/** Fetch any fashion ids not yet resolved. Safe to call on every render. */
export async function ensureFashionProducts(ids) {
  const want = [...new Set((ids || []).map(String))].filter((id) => !known.has(id));
  if (!want.length) return;
  if (inflight) { await inflight; return ensureFashionProducts(ids); }
  inflight = (async () => {
    try {
      const list = await getFashionProductsByIds(want);
      for (const p of list) rows.set(String(p.id), { row: p, variants: Array.isArray(p.fashion_variants) ? p.fashion_variants : [] });
      // Every id we asked about is now answered: a missing one is gone, and
      // the store may prune it; an absent answer (network) leaves it pending.
      for (const id of want) known.add(id);
    } catch { /* network: the lines stay pending, never pruned */ }
    finally { inflight = null; bump(); }
  })();
  await inflight;
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * Price and judge one fashion line for display. Mirrors the shape
 * hydrateCartLine produces so Cart, Checkout and the summary render it
 * unchanged: product (name, image, slug, href), variantObj, variantLabel,
 * unitPrice, unitMrp, lineTotal, unavailableReason, purchasable.
 *
 * Until the fashion rows have loaded the line is PENDING: it counts toward
 * the badge, shows in the cart with no price, and blocks checkout with a
 * reason — it is never dropped for being unknown.
 */
export function hydrateFashionCartLine(line, entry, { resolved = false } = {}) {
  if (!entry) {
    if (resolved) return null; // the product is gone; the store prunes it
    return {
      ...line, product: { id: line.id, name: 'Fashion item', slug: '', image: null, href: '/fashion', form: null, cardImage: null },
      variantObj: null, variantLabel: line.variant ?? null, variantMissing: false, variantStock: null,
      unitPrice: null, unitMrp: null, lineTotal: 0, pending: true,
      unavailableReason: 'Checking availability…', purchasable: false,
    };
  }
  const { row, variants } = entry;
  const v = variants.find((x) => String(x.id) === String(line.variantId)) || null;
  const variantMissing = !v || v.is_active === false;
  const mrp = num(row.mrp);
  const sale = row.sale_price == null ? null : num(row.sale_price);
  const base = sale != null && sale > 0 && sale < mrp ? sale : mrp;
  const override = v && v.price_override != null ? num(v.price_override) : null;
  const unitPrice = variantMissing ? null : (override != null && override > 0 ? override : base);
  const unitMrp = unitPrice == null ? null : Math.max(mrp, unitPrice);
  const stock = v ? Math.max(0, Math.floor(num(v.stock))) : null;
  const label = v ? [v.size, v.colour].filter(Boolean).join(' · ') : (line.variant ?? null);

  let unavailableReason = null;
  if (variantMissing) unavailableReason = label ? `“${label}” is no longer available.` : 'The size and colour you chose are no longer available.';
  else if (row.is_active === false) unavailableReason = 'This item is no longer available.';
  else if (stock === 0) unavailableReason = 'This size and colour is out of stock.';
  else if (stock != null && line.qty > stock) unavailableReason = stock === 1 ? 'Only 1 left — please reduce the quantity.' : `Only ${stock} left — please reduce the quantity.`;
  else if (!(unitPrice > 0)) unavailableReason = 'This item is not available to buy right now.';

  const image = Array.isArray(row.images) && row.images[0] ? row.images[0] : null;
  return {
    ...line,
    product: {
      id: row.id, name: row.name, slug: row.slug, brand: row.brand || '', image, cardImage: image,
      gallery: Array.isArray(row.images) ? row.images : [], href: `/fashion/p/${row.slug}`, form: null,
      price: unitPrice, mrp: unitMrp,
    },
    variantObj: v ? { id: String(v.id), label, price: unitPrice, mrp: unitMrp, stock, size: v.size, colour: v.colour, colour_hex: v.colour_hex || null } : null,
    variantLabel: label,
    variantMissing,
    variantStock: stock,
    unitPrice,
    unitMrp,
    lineTotal: unitPrice == null ? 0 : unitPrice * line.qty,
    unavailableReason,
    purchasable: unavailableReason == null,
  };
}

/** Which stored fashion lines point at a product a fetch has confirmed gone. */
export function fashionKeysToPrune(lines) {
  return (Array.isArray(lines) ? lines : [])
    .filter((l) => isFashionLine(l) && isFashionIdResolved(l.id) && !fashionRowFor(l.id))
    .map((l) => l.key);
}
