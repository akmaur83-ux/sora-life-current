// ============================================================
// "Product information" on a product page: what a listing declares (migration
// 0036) turned into the rows the page shows — generic name, net quantity,
// country of origin, fabric, fit and care, metal and purity, weights, stones,
// and who made, packed and imported it.
//
// Only what is recorded is shown. A missing value is a missing row, never a
// placeholder or a guess (the footer's rule, company.js): the admin warns about
// a listing that lacks its declarations, the page does not paper over it.
//
// React-free, so the rules run in Node. The grade and label tables are copied
// from the admin's storeCatalogueAdmin.js rather than imported, so the
// storefront does not carry the admin's rules module;
// test-product-declarations.mjs pins that the copies agree.
// ============================================================

export const PURITY_GRADES = {
  gold: { 375: '9K', 585: '14K', 750: '18K', 833: '20K', 916: '22K', 958: '23K', 995: '24K', 999: '24K' },
  silver: { 800: '800', 835: '835', 900: '900', 925: 'Sterling (925)', 970: '970', 990: '990', 999: 'Fine (999)' },
  platinum: { 850: '850', 900: '900', 950: '950' },
};
export const METAL_NAMES = { gold: 'Gold', silver: 'Silver', platinum: 'Platinum', gold_plated: 'Gold plated', silver_plated: 'Silver plated', brass: 'Brass', stainless_steel: 'Stainless steel', other: 'Other' };
export const STONE_ORIGIN_NAMES = { natural: 'Natural', lab_grown: 'Lab-grown', simulant: 'Simulant' };

const text = (v) => (v == null ? '' : String(v).trim());
const sentence = (v) => { const t = text(v); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
const grams = (v) => `${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 3 })} g`;

/** "IN" → "India". A code the browser cannot name is shown as the code; anything else, not at all. */
export function countryName(code) {
  const c = text(code).toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(c) || c; } catch { return c; }
}

/** "18K gold (750)", "Sterling silver (925)", "Gold plated". "Other" says nothing, so it is not shown. */
export function metalText(metal, purity) {
  const m = text(metal).toLowerCase();
  if (!METAL_NAMES[m] || m === 'other') return '';
  const p = text(purity) === '' ? null : Number(purity);
  const grade = p != null ? PURITY_GRADES[m]?.[p] : null;
  if (!grade) return METAL_NAMES[m];
  if (m === 'gold') return `${grade} gold (${p})`;
  if (m === 'silver') return p === 925 ? 'Sterling silver (925)' : p === 999 ? 'Fine silver (999)' : `Silver (${p})`;
  return `Platinum (${p})`;
}

/** One kind of stone: "Diamond, lab-grown · Round · 1 stone · 0.25 ct · Clarity VS1 · Colour F · IGI certificate LG123". */
export function stoneText(s) {
  const name = sentence(s?.stone);
  if (!name) return '';
  const origin = STONE_ORIGIN_NAMES[text(s.origin)];
  const count = Number(s.stone_count);
  return [
    origin ? `${name}, ${origin.toLowerCase()}` : name,
    sentence(s.shape),
    Number.isInteger(count) && count > 0 ? `${count} ${count === 1 ? 'stone' : 'stones'}` : '',
    s.total_carat != null && text(s.total_carat) !== '' ? `${Number(s.total_carat)} ct` : '',
    s.total_weight_g != null && text(s.total_weight_g) !== '' ? grams(s.total_weight_g) : '',
    text(s.clarity) ? `Clarity ${text(s.clarity)}` : '',
    text(s.colour_grade) ? `Colour ${text(s.colour_grade)}` : '',
    text(s.certificate_lab) && text(s.certificate_no) ? `${text(s.certificate_lab)} certificate ${text(s.certificate_no)}` : '',
  ].filter(Boolean).join(' · ');
}

/** A company as the label prints it: name, address, and its country when it is not India. */
export function partyText(p) {
  if (!p || !text(p.name)) return '';
  const country = text(p.country).toUpperCase();
  return [text(p.name), text(p.address), country && country !== 'IN' ? countryName(country) : ''].filter(Boolean).join(', ');
}

/**
 * The weights of the size the customer chose. Before a choice: the weights
 * every size shares, or a note that they differ. A chosen size with none
 * recorded shows none.
 */
export function weightRows(variants, chosen = null) {
  const live = (variants || []).filter((v) => v && v.is_active !== false);
  const has = (v) => v && (v.gross_weight_g != null || v.net_metal_weight_g != null);
  let pick = null;
  if (chosen) {
    pick = live.find((v) => String(v.id) === String(chosen.id)) || null;
    if (!has(pick)) return [];
  } else {
    const weighed = live.filter(has);
    if (!weighed.length) return [];
    const same = (key) => new Set(live.map((v) => (v[key] == null ? '' : String(Number(v[key]))))).size === 1;
    if (!(same('gross_weight_g') && same('net_metal_weight_g'))) return [{ key: 'weight', label: 'Weight', value: 'Differs by size: choose a size to see it.' }];
    pick = weighed[0];
  }
  return [
    pick.gross_weight_g != null && { key: 'gross_weight', label: 'Gross weight', value: grams(pick.gross_weight_g) },
    pick.net_metal_weight_g != null && { key: 'net_metal_weight', label: 'Net metal weight', value: grams(pick.net_metal_weight_g) },
  ].filter(Boolean);
}

/**
 * The rows of "Product information", in the order a label reads: [{ key, label, value }].
 * `decl`: the row getProductDeclarations() reads. `variant`: the size × colour chosen.
 * `netQuantity: false` where the page already shows net_content (Home & Living's "Size").
 */
export function declarationRows(decl, { variant = null, netQuantity = true } = {}) {
  if (!decl) return [];
  const rows = [];
  const add = (key, label, value) => { if (value) rows.push({ key, label, value }); };
  add('generic_name', 'Generic name', text(decl.generic_name));
  if (netQuantity) add('net_content', 'Net quantity', text(decl.net_content));
  add('country_of_origin', 'Country of origin', countryName(decl.country_of_origin));
  add('material', 'Material', text(decl.material));
  add('fit', 'Fit', text(decl.fit));
  add('care', 'Care', text(decl.care));
  add('metal', 'Metal', metalText(decl.metal, decl.purity));
  rows.push(...weightRows(decl.weights, variant));
  [...(decl.stones || [])].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    .forEach((s, i) => add(`stone-${i}`, 'Stone', stoneText(s)));
  add('manufacturer', 'Manufactured by', partyText(decl.manufacturer));
  add('packer', 'Packed by', partyText(decl.packer));
  add('importer', 'Imported by', partyText(decl.importer));
  return rows;
}
