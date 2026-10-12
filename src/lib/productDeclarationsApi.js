import { supabase } from './supabase.js';

// ============================================================
// A listing's declarations (migration 0036), read on their own for the product
// page's "Product information" — never part of the catalogue read the store
// pages are built from, so a failure here hides one section and nothing else.
//
// Public reads under the existing RLS: the product (active), its companies and
// stones (public read, 0036) and its sizes' weights (active variants).
// ============================================================
const PARTY = 'name, address, country';
export const DECLARATION_SELECT = [
  'id, net_content, country_of_origin, generic_name, material, care, fit, metal, purity',
  `manufacturer:catalogue_parties!manufacturer_id (${PARTY})`,
  `packer:catalogue_parties!packer_id (${PARTY})`,
  `importer:catalogue_parties!importer_id (${PARTY})`,
  'stones:catalogue_product_stones (stone, origin, shape, stone_count, total_carat, total_weight_g, clarity, colour_grade, certificate_lab, certificate_no, sort_order)',
  'weights:catalogue_variants (id, gross_weight_g, net_metal_weight_g, is_active)',
].join(', ');

/** One product's declarations, or null. */
export async function getProductDeclarations(store, productId) {
  if (!store || productId == null || productId === '') return null;
  const { data, error } = await supabase
    .from('catalogue_products')
    .select(DECLARATION_SELECT)
    .eq('store', store)
    .eq('id', String(productId))
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
