// ============================================================
// When a product link no longer finds its product (round 17, 2026-11-20). Partners'
// catalogues change and old links get shared, so instead of a dead end the page
// offers live products named like the old link, and a search for its words. The
// words come from the link itself; nothing is guessed beyond that.
// ============================================================
const STOP = new Set(['and', 'the', 'for', 'with', 'men', 'mens', 'women', 'womens', 'genuine', 'new', 'pure', 'premium', 'style', 'stylish', 'set', 'pack', 'size', 'free', 'sora', 'lifestyle']);

/** A link's slug → its meaningful words, at most 6 ("diamond-leather-rider-leather-biker-jacket-black" → diamond, leather, rider, biker, jacket, black). Pure. */
export function slugWords(slug, max = 6) {
  const seen = new Set();
  return String(slug || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => {
    if (w.length < 3 || /^\d+$/.test(w) || STOP.has(w) || seen.has(w)) return false;
    seen.add(w); return true;
  }).slice(0, max);
}

/** Items named most like the words: at least two words in common (one, when the link has one), most first, at most `max`. Pure. */
export function similarByWords(items, words, textOf, max = 8) {
  const need = Math.min(2, words.length);
  if (!need) return [];
  return (Array.isArray(items) ? items : [])
    .map((it, i) => { const t = ` ${String(textOf(it) || '').toLowerCase()} `; return { it, i, score: words.filter((w) => t.includes(w)).length }; })
    .filter((x) => x.score >= need)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, max)
    .map((x) => x.it);
}

/** The search for an old link's words, in the right store. Pure. */
export function searchFor(store, words) {
  const q = encodeURIComponent(words.join(' '));
  return store === 'fashion' ? `/fashion/search?q=${q}` : store === 'homeliving' ? `/homeliving/search?q=${q}` : `/shop?q=${q}`;
}
