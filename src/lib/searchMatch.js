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

// ---- "Did you mean…?" (owner, 2026-11-10: more features) ----------------------------
// A search that finds nothing is checked word by word against the words the store's
// own names, brands and categories use: a word one letter off (two for longer words)
// is swapped for the closest store word ("kurtha" → "kurta", "bedshet" → "bedsheet").
// The corrected search is offered only when it really finds products.
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let before = null;   // two rows back: swapped neighbours ("shwal" → "shawl") count as one slip
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (before && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], before[j - 2] + 1);
      if (cur[j] < low) low = cur[j];
    }
    if (low > max) return max + 1;
    before = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** The corrected search, or '' when the search already finds something or nothing close does. */
export function didYouMean(items, query, fields = (x) => [x.name, x.brand, x.category], finds = null) {
  const q = normalise(query);
  const rows = Array.isArray(items) ? items : [];
  if (q.length < 3 || rows.length === 0) return '';
  const found = (s) => (finds ? finds(s) : searchItems(rows, s, fields).length > 0);
  if (found(q)) return '';
  const vocab = new Map();
  rows.forEach((it) => fields(it).forEach((f) => normalise(f).split(' ').forEach((w) => {
    if (w.length >= 3 && !/^\d+$/.test(w)) vocab.set(w, (vocab.get(w) || 0) + 1);
  })));
  let changed = false;
  const fixed = q.split(' ').filter(Boolean).map((w) => {
    if (w.length < 3 || /^\d+$/.test(w)) return w;
    const sw = stem(w);
    for (const v of vocab.keys()) if (v.includes(sw)) return w;   // the word is fine; another one is not
    const max = w.length <= 5 ? 1 : 2;
    let best = ''; let bestD = max + 1; let bestN = 0;
    for (const [v, n] of vocab) {
      const d = editDistance(w, v, max);
      if (d <= max && (d < bestD || (d === bestD && n > bestN))) { best = v; bestD = d; bestN = n; }
    }
    if (!best) return w;
    changed = true;
    return best;
  });
  if (!changed) return '';
  const s = fixed.join(' ');
  return found(s) ? s : '';
}
