// ============================================================
// Fashion PDP — the selection rules.
//
// Stock is per size × colour, so availability is always answered for the
// pair: choose Medium and Sage reads "out of stock" while Medium and Navy
// stays available. Nothing here computes a price — the figure shown for a
// variant is the row's own (price_override or the product's sale price),
// and the payable amount is the server's.
// ============================================================
import { stockMatrix } from './fashion.js';

export const LOW_STOCK_AT = 5;

/** ?size=M&colour=Navy → { size, colour } (null when absent or unknown). */
export function readSelection(searchParams, view) {
  const p = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams || '');
  const size = p.get('size'); const colour = p.get('colour');
  return {
    size: size && view.sizes.includes(size) ? size : null,
    colour: colour && view.swatches.some((s) => s.colour === colour) ? colour : null,
  };
}

export function writeSelection(searchParams, { size, colour }) {
  const p = new URLSearchParams(searchParams);
  if (size) p.set('size', size); else p.delete('size');
  if (colour) p.set('colour', colour); else p.delete('colour');
  return p;
}

/**
 * Everything the selectors and the buy buttons need for one (size, colour)
 * choice. A size is available when some in-stock variant has it (for the
 * chosen colour, once one is chosen); a colour likewise for the chosen size.
 */
export function selectionState(view, { size = null, colour = null } = {}) {
  const m = stockMatrix(view);
  const inStock = (s, c) => m.inStock(s, c);
  const sizes = view.sizes.map((s) => ({
    size: s,
    available: colour ? inStock(s, colour) : view.swatches.some((sw) => inStock(s, sw.colour)),
    exists: colour ? m.get(s, colour) != null : true,
  }));
  const colours = view.swatches.map((sw) => ({
    colour: sw.colour, hex: sw.hex,
    available: size ? inStock(size, sw.colour) : view.sizes.some((s) => inStock(s, sw.colour)),
    exists: size ? m.get(size, sw.colour) != null : true,
  }));
  const variant = size && colour ? m.get(size, colour) : null;
  let status = 'choose';
  if (size && colour) status = !variant ? 'missing' : variant.stock === 0 ? 'out' : variant.stock <= LOW_STOCK_AT ? 'low' : 'in';
  const stockNote = status === 'out' ? 'Out of stock in this size and colour'
    : status === 'low' ? `Only ${variant.stock} left`
      : status === 'missing' ? 'Not made in this size and colour'
        : null;
  const missing = !size && !colour ? 'Choose a size and colour' : !size ? 'Choose a size' : !colour ? 'Choose a colour' : null;
  return {
    size, colour, sizes, colours, variant,
    status, stockNote, missing,
    canAdd: Boolean(variant) && variant.stock > 0,
    // The variant's own figure when it carries one, else the product's — a
    // lookup, not arithmetic; the server prices the order regardless.
    price: variant && variant.price_override != null ? variant.price_override : view.price,
    label: size && colour ? `${size} · ${colour}` : null,
  };
}

/** What the listing card's "+" should do. */
export function quickAddPlan(view) {
  const live = view.variants.filter((v) => v.stock > 0);
  if (view.variants.length === 0 || live.length === 0) return { mode: 'none' };
  if (view.variants.length === 1) return { mode: 'direct', variant: live[0] };
  return { mode: 'sheet' };
}

/** Related styles: same category first, then the same brand; never itself. */
export function relatedFor(view, views, limit = 4) {
  const others = (Array.isArray(views) ? views : []).filter((v) => v.id !== view.id);
  const same = others.filter((v) => v.category_id && v.category_id === view.category_id);
  const brand = others.filter((v) => !same.includes(v) && v.brand && v.brand === view.brand);
  const rest = others.filter((v) => !same.includes(v) && !brand.includes(v));
  return [...same, ...brand, ...rest].slice(0, limit);
}
