import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

// ============================================================
// The fashion product page's extra facts (owner, 2026-11-08: "the same detailed
// page as the other stores"): material, care, net quantity, SKU, generic name and
// country of origin — catalogue columns the store's listing read does not carry.
// One small read for the open product; a failed read is no facts, never an error.
// ============================================================
export const DETAIL_COLUMNS = 'id, material, care, net_content, sku, generic_name, country_of_origin';

export async function fetchFashionDetails(client, id) {
  if (!client || !id) return null;
  const { data, error } = await client.from('catalogue_products').select(DETAIL_COLUMNS).eq('id', id).maybeSingle();
  return error ? null : data || null;
}

/** null until the read answers (or when it fails), then the row. */
export function useFashionDetails(id) {
  const [row, setRow] = useState(null);
  useEffect(() => {
    let live = true;
    setRow(null);
    fetchFashionDetails(supabase, id).then((r) => { if (live) setRow(r); }, () => {});
    return () => { live = false; };
  }, [id]);
  return row;
}

export const countryName = (c) => (String(c || '').trim().toUpperCase() === 'IN' ? 'India' : String(c || '').trim());
