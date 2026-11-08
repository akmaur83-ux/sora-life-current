// ============================================================
// Store search (owner, 2026-11-08: more features). One rule for the live
// suggestions under the Fashion and Home & Living search boxes and for the Home &
// Living results page: every word typed must appear in the product's name, brand
// or category (any order, any case; "bedsheet" also finds "bedsheets"). A name
// that starts with the query ranks first, then a name starting with its first word,
// then other name matches, then the rest, each
// in the catalogue's own order.
// ============================================================
export const normalise = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const stem = (w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

export function searchItems(items, query, fields = (x) => [x.name, x.brand, x.category]) {
  const q = normalise(query);
  if (q.length < 2) return [];
  const words = q.split(' ').map(stem).filter(Boolean);
  const scored = [];
  (Array.isArray(items) ? items : []).forEach((item, i) => {
    const [name = '', ...rest] = fields(item).map(normalise);
    const hay = `${name} ${rest.join(' ')}`;
    if (!words.every((w) => hay.includes(w))) return;
    const inName = words.every((w) => name.includes(w));
    const rank = name.startsWith(q) ? 0 : inName && name.startsWith(words[0]) ? 1 : inName ? 2 : 3;
    scored.push({ item, rank, i });
  });
  return scored.sort((a, b) => a.rank - b.rank || a.i - b.i).map((s) => s.item);
}
