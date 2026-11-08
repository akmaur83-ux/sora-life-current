import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useStorefrontSection } from '../lib/storefrontSections.js';

// ============================================================
// "Diwali gift shop" on the wellness homepage (owner, 2026-11-09: more features):
// six gift-ready categories across Fashion and Home & Living, each tile showing
// the first picture of its own live products (never a stock photo), opening the
// category. A category with nothing live is left out. Editable or hidden in
// Storefronts → Wellness → Gift shop.
// ============================================================
export const GIFT_SECTION = Object.freeze({ hidden: false, eyebrow: 'Festive gifting', title: 'The Diwali gift shop' });
export const GIFT_TILES = Object.freeze([
  { store: 'fashion', slug: 'shawl-gift-sets', label: 'Shawl gift boxes', href: '/fashion/c/shawl-gift-sets' },
  { store: 'fashion', slug: 'leather-gift-sets', label: 'Leather gift sets', href: '/fashion/c/leather-gift-sets' },
  { store: 'fashion', slug: 'womens-shawls', label: 'For her: shawls', href: '/fashion/c/womens-shawls' },
  { store: 'fashion', slug: 'mens-wallets', label: 'For him: wallets', href: '/fashion/c/mens-wallets' },
  { store: 'fashion', slug: 'handbags', label: 'Handbags', href: '/fashion/c/handbags' },
  { store: 'homeliving', slug: 'bedsheets', label: 'Bedsheets for the home', href: '/homeliving/category/bedsheets' },
]);

const thumb = (src) => (src ? String(src).replace(/([?&])width=\d+/, '$1width=600') : null);

/** { slug: picture } for the tiles' categories: the first live product's first picture. */
export async function fetchGiftPictures(client = supabase) {
  if (!client) return {};
  const slugs = GIFT_TILES.map((t) => t.slug);
  const { data: cats, error } = await client.from('catalogue_categories').select('id, slug, store').in('slug', slugs).eq('is_active', true);
  if (error || !Array.isArray(cats) || !cats.length) return {};
  const ids = cats.map((c) => c.id);
  const { data: rows } = await client.from('catalogue_products').select('category_id, images, sort_order').in('category_id', ids).eq('is_active', true).order('sort_order', { ascending: true }).limit(300);
  const out = {};
  for (const c of cats) {
    const first = (rows || []).find((r) => r.category_id === c.id && Array.isArray(r.images) && r.images[0]);
    if (first && GIFT_TILES.some((t) => t.slug === c.slug && t.store === c.store)) out[c.slug] = thumb(first.images[0]);
  }
  return out;
}

export default function GiftShop() {
  const s = useStorefrontSection('wellness', 'giftShop', GIFT_SECTION);
  const [pics, setPics] = useState(null);
  useEffect(() => { let live = true; fetchGiftPictures().then((p) => { if (live) setPics(p); }, () => { if (live) setPics({}); }); return () => { live = false; }; }, []);
  const tiles = pics ? GIFT_TILES.filter((t) => pics[t.slug]) : [];
  if (s.hidden || tiles.length < 3) return null;
  return (
    <section className="hx hx-gifts" aria-labelledby="hx-gifts-h">
      <div className="hx-wrap">
        {s.eyebrow && <p className="hx-gifts__eyebrow">{s.eyebrow}</p>}
        <h2 className="hx-gifts__h" id="hx-gifts-h">{s.title}</h2>
        <ul className="hx-gifts__grid">
          {tiles.map((t) => (
            <li key={t.slug}>
              <Link to={t.href} className="hx-gifts__tile">
                <span className="hx-gifts__img"><img src={pics[t.slug]} alt="" width="600" height="600" loading="lazy" decoding="async" /></span>
                <span className="hx-gifts__label">{t.label} <Icon name="arrowRight" size={15} /></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
