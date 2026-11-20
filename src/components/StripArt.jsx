import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { fetchCategoryCovers } from '../lib/insights.js';

// ============================================================
// Pictures on the edit banners (owner, 2026-11-21: "winter edit everything leather jaise
// banner hain na isme pic lgao sab mein accordingly"). Each banner shows the live cover
// of three of its own categories — real products, never stock photos, no words on them —
// fanned on its right. A category with no live cover is skipped; none, and the banner
// stays as it was (text only).
// ============================================================
export const STRIP_ART = Object.freeze({
  winter: ['mens-leather-jackets', 'womens-shawls', 'mufflers-caps'],
  leather: ['handbags', 'mens-leather-coats', 'mens-wallets'],
  wedding: ['suits-dress-materials', 'clutches', 'shawl-gift-sets'],
});

let picsPromise = null;
/** { slug: picture } for every banner's categories, fetched once per visit. */
export function fetchStripPictures(client = supabase) {
  if (!client) return Promise.resolve({});
  if (!picsPromise) {
    const slugs = [...new Set(Object.values(STRIP_ART).flat())];
    picsPromise = Promise.all([
      client.from('catalogue_categories').select('id, slug').in('slug', slugs),
      fetchCategoryCovers(client),
    ]).then(([{ data: cats }, covers]) => Object.fromEntries((cats || []).filter((c) => covers[c.id]).map((c) => [c.slug, covers[c.id]])))
      .catch(() => { picsPromise = null; return {}; });
  }
  return picsPromise;
}

/** A banner's pictures, in its order, at most three. Pure. */
export const stripPictures = (pics, id) => (STRIP_ART[id] || []).map((slug) => pics?.[slug]).filter(Boolean).slice(0, 3);

export default function StripArt({ id }) {
  const [pics, setPics] = useState(null);
  useEffect(() => { let live = true; fetchStripPictures().then((p) => { if (live) setPics(p); }); return () => { live = false; }; }, []);
  const list = stripPictures(pics, id);
  if (!list.length) return null;
  return (
    <span className="hx-wedstrip__art" aria-hidden="true">
      {list.map((src, k) => <img key={src} src={src} alt="" width="120" height="150" loading="lazy" decoding="async" style={{ '--k': k - (list.length - 1) / 2 }} />)}
    </span>
  );
}
