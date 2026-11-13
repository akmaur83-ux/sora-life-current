// ============================================================
// All categories (2026-11-13 redesign): every store's categories on one page, each
// with a picture — the category's own picture when it has one, else the first
// product of that category (or of anything under it). A category with no products
// anywhere under it is left out. Pure; the page (AllCategories.jsx) passes the data.
// ============================================================

/** Fashion: the roots, each with its sub-categories. tree: fashion.js buildTree; views: fashion product views. */
export function fashionGroups(tree, views) {
  if (!tree || !Array.isArray(tree.roots)) return [];
  const firstImage = new Map();
  const count = new Map();
  for (const v of Array.isArray(views) ? views : []) {
    if (!v?.category_id) continue;
    for (const a of tree.ancestors(v.category_id)) {
      count.set(a.id, (count.get(a.id) || 0) + 1);
      if (v.image && !firstImage.has(a.id)) firstImage.set(a.id, v.image);
    }
  }
  const tile = (n) => ({ key: `fashion-${n.id}`, name: n.name, href: `/fashion/c/${n.slug}`, image: n.image_url || firstImage.get(n.id) || null, count: count.get(n.id) || 0 });
  return tree.roots
    .filter((r) => r.is_active !== false && count.get(r.id))
    .map((r) => ({ ...tile(r), children: tree.children(r.id).filter((c) => c.is_active !== false && count.get(c.id)).map(tile) }));
}

/** A flat store (wellness, Home & Living): categories with the first product picture and a count. */
export function flatTiles(categories, products, { catOf, imageOf, href, key }) {
  const firstImage = new Map();
  const count = new Map();
  for (const p of Array.isArray(products) ? products : []) {
    const c = catOf(p);
    if (!c) continue;
    count.set(c, (count.get(c) || 0) + 1);
    const img = imageOf(p);
    if (img && !firstImage.has(c)) firstImage.set(c, img);
  }
  return (Array.isArray(categories) ? categories : [])
    .filter((c) => count.get(key(c)))
    .map((c) => ({ key: `${href(c)}`, name: c.name, href: href(c), image: c.image_url || firstImage.get(key(c)) || null, count: count.get(key(c)) }));
}
