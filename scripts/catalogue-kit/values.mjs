// ============================================================
// Converting a supplier's values into the kit's formats.
//
// Every function returns one of:
//   { value }               — taken as it is
//   { value, note }         — converted; the note says how (it goes in the report)
//   { value: '', flag }     — cannot be converted safely; left blank for a person
//
// The rule the owner set: a price, a stock figure or a category is never
// guessed. A price is only ever read from a price the supplier gave (with its
// ₹ sign, commas or "/-" taken off); "In stock" never becomes a number; a
// category only ever comes from the mapping's own category table.
// ============================================================
import { PURITY, METALS, FITS } from './spec.mjs';

const t = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const EMPTY = /^(?:|-+|–|—|n\/?a|na|nil|null|none|\.)$/i;
export const isEmpty = (v) => EMPTY.test(t(v));
const ok = (value, note) => (note ? { value, note } : { value });
const flag = (message) => ({ value: '', flag: message });

/** Rupees: "₹1,299.00", "Rs. 1299/-", "INR 1,299", "1299" → 1299. A range or two numbers is a decision. */
export function money(raw) {
  const s = t(raw);
  if (isEmpty(s)) return { value: '' };
  const cleaned = s.replace(/^(?:₹|rs\.?|inr|mrp:?|price:?)\s*/i, '').replace(/\/-$/, '').replace(/\s*(?:₹|rs\.?|inr)$/i, '').trim();
  if (/\d\s*(?:-|–|to)\s*[₹\d]/i.test(cleaned)) return flag(`"${s}" is a range. Give one price.`);
  if (!/^\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?$|^\d+(?:\.\d{1,2})?$/.test(cleaned)) return flag(`"${s}" is not a price in rupees.`);
  const n = Number(cleaned.replace(/,/g, ''));
  if (!(n > 0)) return flag(`"${s}" is not a price above zero.`);
  const value = String(Math.round(n * 100) / 100);
  return value === s ? ok(value) : ok(value, `"${s}" → ${value}`);
}

/** Units in stock: "12", "12 pcs" → 12; "Out of stock" → 0; "In stock", "Yes", "Available" → a decision (no count given). */
export function stock(raw) {
  const s = t(raw);
  if (isEmpty(s)) return { value: '' };
  if (/^(?:out of stock|sold out|unavailable|no)$/i.test(s)) return ok('0', `"${s}" → 0`);
  const m = /^(\d+)(?:\.0+)?\s*(?:pcs?|pieces?|nos?|units?|qty)?\.?$/i.exec(s);
  if (m) return m[1] === s ? ok(s) : ok(m[1], `"${s}" → ${m[1]}`);
  if (/^-\d/.test(s)) return flag(`"${s}" is negative.`);
  return flag(`"${s}" is not a number of units. Stock is never guessed: give a count.`);
}

export function hsn(raw) {
  const s = t(raw);
  if (isEmpty(s)) return { value: '' };
  const digits = s.replace(/[\s.]/g, '');
  if (/^\d{4}(?:\d{2}){0,2}$/.test(digits)) return digits === s ? ok(s) : ok(digits, `"${s}" → ${digits}`);
  if (/^\d{3}$|^\d{5}$|^\d{7}$/.test(digits)) return flag(`"${s}" has ${digits.length} digits. A leading 0 may have been lost in a spreadsheet: HSN codes are 4, 6 or 8 digits.`);
  return flag(`"${s}" is not an HSN code (4, 6 or 8 digits).`);
}

export function gst(raw) {
  const s = t(raw);
  if (isEmpty(s)) return { value: '' };
  const m = /^(\d+(?:\.\d+)?)\s*%?$/.exec(s);
  if (!m) return flag(`"${s}" is not a GST rate.`);
  const n = Number(m[1]);
  if (n > 0 && n < 1) return flag(`"${s}" looks like a fraction. Write the rate as a percentage, e.g. 5 or 18.`);
  if (n > 100) return flag(`"${s}" is over 100%.`);
  return m[1] === s ? ok(s) : ok(String(n), `"${s}" → ${n}`);
}

export function yesNo(raw) {
  const s = t(raw).toLowerCase();
  if (isEmpty(s)) return { value: '' };
  if (/^(?:yes|y|true|1|active|enabled)$/.test(s)) return s === 'yes' ? ok('yes') : ok('yes', `"${t(raw)}" → yes`);
  if (/^(?:no|n|false|0|inactive|disabled)$/.test(s)) return s === 'no' ? ok('no') : ok('no', `"${t(raw)}" → no`);
  return flag(`"${t(raw)}" is not yes or no.`);
}

/** A size label: "Free Size", "FS", "OS", "One Size" → "One size"; the rest kept as written. */
export function size(raw) {
  const s = t(raw);
  if (isEmpty(s)) return { value: '' };
  if (/^(?:free\s*size|fs|os|one\s*size|onesize|universal|standard)$/i.test(s)) return s === 'One size' ? ok(s) : ok('One size', `"${s}" → One size`);
  return ok(s);
}
/** A list of sizes in one cell: "S, M, L" / "S/M/L" / "S | M | L". */
export function sizeList(raw) {
  const s = t(raw);
  if (isEmpty(s)) return [];
  return s.split(/\s*[,/|;]\s*/).map((x) => size(x).value).filter(Boolean);
}

export function colourHex(raw) {
  const s = t(raw);
  if (isEmpty(s)) return { value: '' };
  const m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (m) { const v = `#${m[1].toUpperCase()}`; return v === s ? ok(s) : ok(v, `"${s}" → ${v}`); }
  return flag(`"${s}" is not a #RRGGBB colour. (A colour name is never turned into a hex guess.)`);
}

const COUNTRIES = {
  IN: ['india', 'bharat', 'made in india', 'ind'], CN: ['china', 'prc', 'made in china', 'chn'], BD: ['bangladesh'], LK: ['sri lanka'], NP: ['nepal'],
  PK: ['pakistan'], VN: ['vietnam', 'viet nam'], TH: ['thailand'], ID: ['indonesia'], MY: ['malaysia'], KH: ['cambodia'], MM: ['myanmar'],
  TR: ['turkey', 'turkiye', 'türkiye'], IT: ['italy'], FR: ['france'], ES: ['spain'], PT: ['portugal'], DE: ['germany'], GB: ['united kingdom', 'uk', 'england', 'britain'],
  US: ['united states', 'usa', 'us', 'america'], AE: ['uae', 'united arab emirates', 'dubai'], HK: ['hong kong'], TW: ['taiwan'], KR: ['south korea', 'korea'], JP: ['japan'],
  BE: ['belgium'], IL: ['israel'], CH: ['switzerland'], SG: ['singapore'],
};
export function country(raw) {
  const s = t(raw);
  if (isEmpty(s)) return { value: '' };
  if (/^[A-Z]{2}$/.test(s)) return ok(s);
  const k = s.toLowerCase().replace(/\.$/, ''), bare = k.replace(/^made in\s+/, '');
  for (const [code, names] of Object.entries(COUNTRIES)) if (names.includes(k) || names.includes(bare)) return ok(code, `"${s}" → ${code}`);
  return flag(`"${s}" is not a country the kit knows. Write its 2-letter code (e.g. IN).`);
}

/** Grams: "3.25", "3.25 g", "3.25gms", "3.25 grams" → 3.25; mg is converted; carats or a decimal comma are a decision. */
export function grams(raw) {
  const s = t(raw);
  if (isEmpty(s)) return { value: '' };
  if (/\d,\d/.test(s) && !/\./.test(s)) return flag(`"${s}" uses a decimal comma. Write it with a point (3.25).`);
  const m = /^(\d+(?:\.\d+)?)\s*(g|gm|gms|gram|grams|gr|mg)?\.?$/i.exec(s);
  if (!m) return /ct|carat/i.test(s) ? flag(`"${s}" is in carats; this column is grams.`) : flag(`"${s}" is not a weight in grams.`);
  let n = Number(m[1]);
  if (/^mg$/i.test(m[2] || '')) n /= 1000;
  if (!(n > 0)) return flag(`"${s}" is not above zero.`);
  const value = String(Math.round(n * 1000) / 1000);
  return value === s ? ok(value) : ok(value, `"${s}" → ${value} g`);
}
export function carats(raw) {
  const s = t(raw);
  if (isEmpty(s)) return { value: '' };
  const m = /^(\d+(?:\.\d+)?)\s*(?:ct|cts|carat|carats|ctw)?\.?$/i.exec(s);
  if (!m) return flag(`"${s}" is not a carat weight.`);
  if (!(Number(m[1]) > 0)) return flag(`"${s}" is not above zero.`);
  const value = String(Math.round(Number(m[1]) * 1000) / 1000);
  return value === s ? ok(value) : ok(value, `"${s}" → ${value} ct`);
}
export function count(raw) {
  const s = t(raw);
  if (isEmpty(s)) return { value: '' };
  const m = /^(\d+)(?:\s*(?:pcs?|pieces?|nos?|stones?))?$/i.exec(s);
  if (!m || Number(m[1]) < 1) return flag(`"${s}" is not a count of 1 or more.`);
  return m[1] === s ? ok(s) : ok(m[1], `"${s}" → ${m[1]}`);
}

/**
 * Metal, and the metal colour and purity when the same cell carries them:
 * "18K Rose Gold" → { metal: gold, purity: 750, colour: Rose gold }.
 */
export function metal(raw) {
  const s = t(raw);
  if (isEmpty(s)) return { value: '' };
  const k = s.toLowerCase();
  const out = {};
  if (/plated|vermeil|micro\s*gold|one\s*gram/.test(k)) out.metal = /silver/.test(k) && !/gold/.test(k) ? 'silver_plated' : 'gold_plated';
  else if (/sterling|silver/.test(k)) out.metal = 'silver';
  else if (/platinum|\bpt\b/.test(k)) out.metal = 'platinum';
  else if (/gold/.test(k)) out.metal = 'gold';
  else if (/brass/.test(k)) out.metal = 'brass';
  else if (/stainless|steel/.test(k)) out.metal = 'stainless_steel';
  else if (/alloy|imitation|artificial|fashion jewel|oxidi[sz]ed|german silver|copper/.test(k)) out.metal = 'other';
  if (!out.metal) return flag(`"${s}" is not a metal the kit knows (${METALS.join(', ')}).`);
  // The metal colour only where the cell names it ("Rose", "White gold", "Silver"); plain "Gold" is not assumed yellow.
  const colour = /rose/.test(k) ? 'Rose gold' : /white gold/.test(k) ? 'White gold' : /yellow/.test(k) ? 'Yellow gold'
    : ['silver', 'silver_plated'].includes(out.metal) ? 'Silver' : out.metal === 'platinum' ? 'Platinum' : null;
  if (colour) out.colour = colour;
  if (PURITY[out.metal]) { const p = purity(s, out.metal); if (p.value) out.purity = p.value; }   // a plated or base metal has no purity
  const value = out.metal;
  return { value, ...out, note: value === s ? undefined : `"${s}" → ${[value, out.purity, out.colour].filter(Boolean).join(', ')}` };
}

/** Fineness from "22K", "22 KT", "22kt", "916", "18 Karat", "925", "Sterling". 24K is a decision (995 or 999). */
export function purity(raw, metalName = null) {
  const s = t(raw);
  if (isEmpty(s)) return { value: '' };
  const k = s.toLowerCase();
  const karat = /(\d{1,2})\s*(?:k|kt|karat|carat|ct)\b/.exec(k);
  const KARAT = { 9: 375, 14: 585, 18: 750, 20: 833, 22: 916, 23: 958 };
  if (karat) {
    if (karat[1] === '24') return flag(`"${s}": 24K is 995 or 999 fineness. Say which.`);
    const f = KARAT[Number(karat[1])];
    if (!f) return flag(`"${s}" is not a BIS gold grade (9K, 14K, 18K, 20K, 22K, 23K, 24K).`);
    return ok(String(f), `"${s}" → ${f}`);
  }
  if (/sterling/.test(k)) return ok('925', `"${s}" → 925`);
  const fine = /\b(375|585|750|833|916|958|995|999|800|835|900|925|970|990|850|950)\b/.exec(k);
  if (fine) {
    const n = Number(fine[1]);
    if (metalName && PURITY[metalName] && !PURITY[metalName][n]) return flag(`"${s}": ${n} is not a ${metalName} grade.`);
    return fine[1] === s ? ok(s) : ok(String(n), `"${s}" → ${n}`);
  }
  return metalName && !PURITY[metalName] ? { value: '' } : flag(`"${s}" is not a purity the kit can read (22K, 18K, 916, 925…).`);
}

export function fit(raw) {
  const s = t(raw);
  if (isEmpty(s)) return { value: '' };
  const hit = FITS.find((f) => f.toLowerCase() === s.toLowerCase().replace(/\s*fit$/, ''));
  if (hit) return hit === s ? ok(s) : ok(hit, `"${s}" → ${hit}`);
  return flag(`"${s}" is not one of ${FITS.join(', ')}.`);
}

/**
 * Making charges: "450", "₹450/g", "450 per gram", "12%", "12 %". A unit written in the value sets the type
 * (per_gram / percent); otherwise the header's unit, or a decision.
 */
export function making(raw) {
  const s = t(raw);
  if (isEmpty(s)) return { value: '' };
  const unit = /%|percent/i.test(s) ? 'percent' : /\/\s*g(?:m|ram)?\b|per\s*g(?:m|ram)?\b/i.test(s) ? 'per_gram' : null;
  const m = /(\d+(?:,\d{3})*(?:\.\d+)?)/.exec(s.replace(/^(?:₹|rs\.?|inr)\s*/i, ''));
  if (!m) return flag(`"${s}" is not a making charge.`);
  const value = String(Number(m[1].replace(/,/g, '')));
  return { value, ...(unit ? { unit } : {}), ...(value === s ? {} : { note: `"${s}" → ${value}${unit ? ` (${unit})` : ''}` }) };
}

/** Supplier copy often arrives as HTML: tags and entities go; paragraphs become sentences on one line. */
export function plainText(raw) {
  const s = String(raw ?? '');
  if (!/<[a-z!/][^>]*>|&[a-z#0-9]+;/i.test(s)) { const v = t(s); return v === s.trim() ? ok(v) : ok(v, 'whitespace tidied'); }
  const v = t(s.replace(/<\s*(?:br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, ' ').replace(/<li[^>]*>/gi, ' ').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>'));
  return ok(v, 'HTML removed');
}
export const text = (raw) => { const v = t(raw); return isEmpty(v) ? { value: '' } : ok(v); };

/** "60% cotton, 40% polyester" → the percentages and their total. */
export function materialTotal(value) {
  const parts = [...String(value || '').matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
  return parts.length ? { parts, total: Math.round(parts.reduce((a, b) => a + b, 0) * 100) / 100 } : null;
}
