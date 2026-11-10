import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { money } from '../lib/format.js';
import { useStore } from '../lib/store.jsx';
import { products, productById } from '../data/products.js';
import { useStorefrontSection } from '../lib/storefrontSections.js';

// ============================================================
// Three small homepage sections (owner, 2026-11-10: more features):
//
//   * TopDeals — the wellness products with the biggest verified discount right now,
//     in stock, biggest first (the same % off the product page shows). Editable in
//     Storefronts → Wellness → Top deals (hide, heading).
//   * WishlistRail — "From your wishlist": the visitor's saved wellness products, so
//     they are one tap away from the homepage. Two or more to show.
//   * BagReminder — a slim line when the bag already holds something: how many, and
//     the way to it. Reads the bag's count only; nothing in the bag changes.
// ============================================================
export const TOP_DEALS_SECTION = Object.freeze({ hidden: false, title: 'Top deals right now' });
export const SAVED_SECTION = Object.freeze({ hidden: false, title: 'From your wishlist' });

/** In-stock products with a real discount, biggest first. Pure. */
export function topDeals(list, max = 8) {
  return (Array.isArray(list) ? list : [])
    .filter((p) => p && p.slug && p.price > 0 && Number(p.stock) > 0 && Number(p.discountPct) > 0 && p.mrp > p.price)
    .sort((a, b) => b.discountPct - a.discountPct || (b.mrp - b.price) - (a.mrp - a.price))
    .slice(0, max);
}

function DealRow({ id, title, items, more }) {
  return (
    <section className="hx hx-deals" aria-labelledby={`hx-${id}-h`}>
      <div className="hx-wrap">
        <div className="hx-deals__head">
          <h2 className="hx-deals__h" id={`hx-${id}-h`}>{title}</h2>
          {more && <Link to={more.href} className="hx-more">{more.label} <Icon name="arrowRight" size={15} /></Link>}
        </div>
        <ul className="hx-deals__row">
          {items.map((p) => (
            <li key={p.id}>
              <Link to={`/product/${p.slug}`} className="hx-deals__card">
                <span className="hx-deals__img">
                  {p.image && <img src={p.image} alt="" width="300" height="300" loading="lazy" decoding="async" />}
                  {p.discountPct > 0 && p.mrp > p.price && <b className="hx-deals__pct">−{Math.round(p.discountPct)}%</b>}
                </span>
                <span className="hx-deals__name">{p.name}</span>
                <span className="hx-deals__price"><b>{money(p.price)}</b>{p.mrp > p.price && <s>{money(p.mrp)}</s>}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function TopDeals() {
  const s = useStorefrontSection('wellness', 'topDeals', TOP_DEALS_SECTION);
  const items = topDeals(products);
  if (s.hidden || items.length < 3) return null;
  return <DealRow id="deals" title={s.title} items={items} more={{ href: '/shop?sort=discount', label: 'See all deals' }} />;
}

export function WishlistRail() {
  const s = useStorefrontSection('wellness', 'savedRail', SAVED_SECTION);
  const { wishlist } = useStore();
  const items = (wishlist || []).map((id) => productById[id]).filter((p) => p && p.slug && p.price > 0).slice(0, 8);
  if (s.hidden || items.length < 2) return null;
  return <DealRow id="saved" title={s.title} items={items} more={{ href: '/wishlist', label: 'Your wishlist' }} />;
}

/** phone={false}: desktop only, where the page has its own bag bar on a phone (the wellness home). */
export function BagReminder({ wrap = 'hx-wrap', phone = true }) {
  const { cartCount } = useStore();
  if (!(cartCount > 0)) return null;
  return (
    <div className={wrap}>
      <p className={`hx-bagnote${phone ? '' : ' hx-bagnote--desk'}`} role="status">
        <Icon name="bag" size={18} />
        <span>Your bag has <b>{cartCount} {cartCount === 1 ? 'item' : 'items'}</b>, ready when you are.</span>
        <Link to="/cart" className="hx-bagnote__go">View bag <Icon name="arrowRight" size={15} /></Link>
      </p>
    </div>
  );
}
