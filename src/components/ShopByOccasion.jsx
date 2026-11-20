import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { fetchCategoryCovers } from '../lib/insights.js';

// ============================================================
// Shop by occasion (owner, 2026-11-20: more features, round 14). Six ways in by what
// the shopper is shopping for, each opening a page that already exists: the Wedding,
// Winter and Leather edits, the gift finder, work and travel bags, the home. Each
// tile's picture is the first live product of its category (never a stock photo, no
// words on the picture); an occasion whose category has nothing live is left out.
// ============================================================
export const OCCASIONS = Object.freeze([
  { id: 'wedding', label: 'Wedding & festive', note: 'Suits, sarees, drapes', href: '/fashion/wedding', slug: 'suits-dress-materials' },
  { id: 'winter', label: 'Winter', note: 'Jackets, shawls, mufflers', href: '/fashion/winter', slug: 'mens-leather-jackets' },
  { id: 'gifts', label: 'Gifting', note: 'By who and budget', href: '/gifts', slug: 'shawl-gift-sets' },
  { id: 'work', label: 'Work & travel', note: 'Laptop bags, wallets', href: '/fashion/leather#leather-bags', slug: 'laptop-travel-bags' },
  { id: 'leather', label: 'Everyday leather', note: 'Bags, belts, wallets', href: '/fashion/leather', slug: 'handbags' },
  { id: 'home', label: 'For the home', note: 'Table covers, rugs, beds', href: '/homeliving', slug: 'table-covers' },
]);

/** Occasions with a picture, in order; pictures by category slug. Pure. */
export const occasionTiles = (pics) => OCCASIONS.filter((o) => pics && pics[o.slug]).map((o) => ({ ...o, image: pics[o.slug] }));

/** { slug: picture } for the occasions' categories. */
export async function fetchOccasionPictures(client = supabase) {
  if (!client) return {};
  const [{ data: cats }, covers] = await Promise.all([
    client.from('catalogue_categories').select('id, slug').in('slug', OCCASIONS.map((o) => o.slug)),
    fetchCategoryCovers(client),
  ]);
  return Object.fromEntries((cats || []).filter((c) => covers[c.id]).map((c) => [c.slug, covers[c.id]]));
}

export default function ShopByOccasion({ className = '' }) {
  const [pics, setPics] = useState(null);
  useEffect(() => { let live = true; fetchOccasionPictures().then((p) => { if (live) setPics(p); }, () => { if (live) setPics({}); }); return () => { live = false; }; }, []);
  const tiles = occasionTiles(pics);
  if (tiles.length < 4) return null;
  return (
    <section className={`hx sora-occ ${className}`.trim()} aria-labelledby="sora-occ-h">
      <div className="hx-wrap">
        <h2 className="hx-stores__h" id="sora-occ-h">Shop by occasion</h2>
        <ul className="sora-occ__grid">
          {tiles.map((t) => (
            <li key={t.id}>
              <Link to={t.href} className="sora-occ__tile">
                <span className="sora-occ__img"><img src={t.image} alt="" width="320" height="400" loading="lazy" decoding="async" /></span>
                <span className="sora-occ__body"><b>{t.label}</b><em>{t.note}</em></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
