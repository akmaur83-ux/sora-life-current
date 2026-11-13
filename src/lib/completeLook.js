// ============================================================
// Complete the look (2026-11-13: more features) — on a Fashion product page, pieces
// from the categories that go with this one: a suit set with dupattas, shawls and
// clutches; a leather jacket with belts, wallets and mufflers. Matched on category
// slugs, so a new sub-category joins by its name. Pure; nothing is priced here.
// ============================================================
export const LOOK_RULES = Object.freeze([
  [/suit|kurta|salwar|dress-material|lehenga|saree|ethnic/, [/dupatta|phulkari/, /shawl|stole/, /clutch|potli/, /handbag|sling/]],
  [/leather-jacket|leather-coat|jacket|coat|blazer/, [/belt/, /wallet|card-holder/, /muffler|cap/, /sling|laptop|travel/]],
  [/shawl|stole|dupatta|muffler/, [/suit|dress-material|kurta/, /saree/, /leather-jacket|jacket|coat/]],
  [/handbag|clutch|sling|pouch|potli/, [/saree/, /suit|dress-material|kurta/, /shawl|stole/]],
  [/wallet|belt|card-holder|passport/, [/leather-jacket|jacket/, /belt|wallet/, /laptop|travel|sling/]],
  [/shirt|t-shirt|tee|jean|trouser|top|dress/, [/jacket|coat/, /belt|wallet/, /handbag|sling|clutch/]],
]);

/**
 * pool items: { key, href, name, image, price, slug (category), inStock }.
 * The categories that go with `slug` take turns, best-matched first; never this
 * product's own category, never out of stock. [] when nothing matches. Pure.
 */
export function lookPicks(pool, current, max = 8) {
  const slug = String(current?.slug || '');
  if (!slug) return [];
  const rule = LOOK_RULES.find(([own]) => own.test(slug));
  if (!rule) return [];
  const ok = (Array.isArray(pool) ? pool : []).filter((p) => p && p.key !== current.key && p.slug && p.slug !== slug && p.inStock !== false && Number(p.price) > 0 && p.image);
  const lanes = rule[1].map((re) => ok.filter((p) => re.test(p.slug)));
  const out = []; const seen = new Set();
  for (let i = 0; out.length < max && lanes.some((l) => l.length > i); i += 1) {
    for (const lane of lanes) {
      const p = lane[i];
      if (p && !seen.has(p.key) && out.length < max) { seen.add(p.key); out.push(p); }
    }
  }
  return out;
}
