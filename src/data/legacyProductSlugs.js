// ============================================================
// LEGACY PRODUCT SLUG COMPATIBILITY
//
// Six products reached production with malformed slugs — two of them carrying
// literal authoring notes ("(or let it auto-generate...)"), four with spaces
// and capitals. Once those rows are renamed to the canonical forms below, any
// link, bookmark or shared URL using the old value would 404.
//
// This is a shim for six known mistakes, not a slug-migration framework. It
// holds one explicit map and one rule, and it is deliberately ORDERED AFTER
// the normal catalogue lookup:
//
//   while production still stores the malformed slug, that slug resolves on
//   its own and nothing here fires;
//   once production stores the canonical slug, the old URL stops resolving,
//   falls through to this map, and redirects.
//
// So the same build is correct before and after the rename, and the rename can
// happen in Admin whenever the owner is ready with no deploy in between.
//
// React-free so the rule can be tested in Node without a DOM.
// ============================================================

export const LEGACY_PRODUCT_SLUGS = Object.freeze({
  'biosash-dhaniya-powder (or let it auto-generate if the system handles it)': 'biosash-dhaniya-powder',
  'biosash-sea-buckthorn-diabo-juice (or let it auto-generate)': 'sea-buckthorn-diabo-juice',
  'Foot-Massager': 'blood-circulative-massager',
  'Tiens 7 in 1 Water Purifier With Hydrogen Generator TQ-D36': 'tiens-7-in-1-water-purifier-with-hydrogen-generator-tq-d36',
  'Beautiful Skin Dense Beauty Device': 'beautiful-skin-dense-beauty-device',
  'TIENS AIRIZ SHREE EXIM Active Oxygen and Negative Ion Soft-Cotton Sanitary Pads for Day and Night Use':
    'tiens-airiz-sanitary-pads-for-day-and-night-use',
});

/**
 * The slug a legacy product URL should be sent to, or '' to stay put.
 *
 * Returns '' — meaning "do not redirect" — in every case except the one this
 * exists for:
 *   * the requested slug still resolves          -> the catalogue wins
 *   * the slug is not one of the six             -> ordinary 404 handling
 *   * the canonical target does not resolve      -> never redirect into a 404
 */
export function canonicalProductSlug(slug, bySlug) {
  if (typeof slug !== 'string' || !slug) return '';
  const catalogue = bySlug || {};
  if (catalogue[slug]) return '';
  const canonical = LEGACY_PRODUCT_SLUGS[slug];
  if (!canonical || !catalogue[canonical]) return '';
  return canonical;
}
