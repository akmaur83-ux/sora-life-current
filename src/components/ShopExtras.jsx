import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { money } from '../lib/format.js';
import { supabase } from '../lib/supabase.js';
import { cataloguePrice } from '../lib/newArrivals.js';

// ============================================================
// Shop extras (owner, 2026-11-13: features 28, 29, 30).
//   ShopByColour — colour swatches on the Fashion home, each opening every style in
//                  that colour (the listing's own colour filter, ?colour=).
//   StylingTips  — "How to wear it" on a fashion product page, by its category.
//   LastChance   — pieces with 1–3 left, from catalogue_last_chance (0044), which
//                  leaves out brands whose stock figures are placeholders.
// ============================================================
export const COLOURS = Object.freeze([
  ['Black', '#1B1B1B'], ['Brown', '#6B4226'], ['Beige', '#D8C3A5'], ['White', '#F7F5F0'], ['Red', '#B3261E'], ['Maroon', '#6D1A2A'],
  ['Pink', '#E58FB0'], ['Green', '#2F6B3F'], ['Blue', '#2F5DA8'], ['Grey', '#8A8D91'], ['Mustard', '#D4A12A'], ['Peach', '#F2B79A'],
]);

export function ShopByColour() {
  return (
    <section className="fs-sec sora-colours" aria-labelledby="sora-colours-h">
      <div className="fs-sec__head"><h2 className="fs-sec__h serif" id="sora-colours-h">Shop by colour</h2></div>
      <ul className="sora-colours__row">
        {COLOURS.map(([name, hex]) => (
          <li key={name}>
            <Link to={`/fashion/search?colour=${encodeURIComponent(name)}`} className="sora-colours__sw">
              <span style={{ background: hex }} aria-hidden="true" />
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const STYLING_TIPS = Object.freeze([
  [/suit|dress-material|salwar|kurta/, ['Pair with a contrasting dupatta, or let a woven one carry the colour.', 'Juttis or block heels keep it festive; kolhapuris keep it easy.', 'Jhumkas or chandbalis suit a Banarasi neckline; keep the rest light.']],
  [/saree/, ['A plain blouse lets a woven saree speak; a brocade blouse lifts a plain one.', 'Pleat the pallu for a day function, leave it open in the evening.', 'A potli or a clutch in the border’s colour ties the look together.']],
  [/leather-jacket|leather-coat/, ['Over a plain tee and dark jeans is the classic; add boots for winter.', 'Leave it open over a knit, or belt a coat for a sharper line.', 'Match the belt and shoes to the leather’s tone, brown with brown, black with black.']],
  [/shawl|stole|dupatta|muffler/, ['Drape over one shoulder on a plain outfit to let the weave lead.', 'Wrap it twice for warmth on a cold evening.', 'A woven shawl turns a simple kurta into a function look.']],
  [/handbag|clutch|sling|pouch|potli/, ['Pick a bag a shade apart from the outfit, not an exact match.', 'A clutch for the evening, a sling when you need your hands free.']],
  [/wallet|belt|card-holder|passport/, ['Match the belt to your shoes.', 'Leather mellows and darkens with use: that’s the character, not wear.']],
]);

/** The tips for a category slug; [] when none fit. Pure. */
export const stylingTips = (slug) => (STYLING_TIPS.find(([re]) => re.test(String(slug || ''))) || [null, []])[1];

export function StylingTips({ slug }) {
  const tips = stylingTips(slug);
  if (!tips.length) return null;
  return (
    <section className="sora-tips" aria-labelledby="sora-tips-h">
      <h2 className="pdpk-h" id="sora-tips-h"><Icon name="sparkle" size={17} /> How to wear it</h2>
      <ul>{tips.map((t) => <li key={t}>{t}</li>)}</ul>
    </section>
  );
}

/** Rows → cards: in-stock, priced, pictured; fewest left first. Pure. */
export function lastChanceCards(rows) {
  return (Array.isArray(rows) ? rows : []).flatMap((r) => {
    const p = r?.product; const image = Array.isArray(p?.images) ? p.images.find(Boolean) : null; const price = p ? cataloguePrice(p) : 0;
    if (!p?.slug || !image || !(price > 0)) return [];
    return [{ key: `${p.store}-${p.id}`, name: String(p.name || '').trim(), image, price, left: r.left_in_stock, href: p.store === 'fashion' ? `/fashion/p/${p.slug}` : `/homeliving/p/${p.slug}` }];
  }).sort((a, b) => a.left - b.left || a.name.localeCompare(b.name));
}

export function LastChance({ wrap = 'hx-wrap', max = 10 }) {
  const [cards, setCards] = useState([]);
  useEffect(() => {
    if (!supabase) return undefined;
    let live = true;
    (async () => {
      const { data: left } = await supabase.from('catalogue_last_chance').select('product_id, left_in_stock').limit(40);
      if (!Array.isArray(left) || !left.length) return;
      const { data: rows } = await supabase.from('catalogue_products').select('id, store, name, slug, mrp, sale_price, images').in('id', left.map((r) => r.product_id));
      const byId = new Map((rows || []).map((r) => [r.id, r]));
      if (live) setCards(lastChanceCards(left.map((r) => ({ left_in_stock: r.left_in_stock, product: byId.get(r.product_id) }))).slice(0, max));
    })().catch(() => {});
    return () => { live = false; };
  }, [max]);
  if (cards.length < 3) return null;
  return (
    <section className="hx sora-last" aria-labelledby="sora-last-h">
      <div className={wrap}>
        <div className="hx-stores__head"><h2 className="hx-stores__h" id="sora-last-h">Almost gone</h2></div>
        <ul className="sora-last__row">
          {cards.map((c) => (
            <li key={c.key}>
              <Link to={c.href} className="hx-deals__card">
                <span className="hx-deals__img"><img src={c.image} alt="" width="240" height="240" loading="lazy" decoding="async" /><b className="sora-last__left">Only {c.left} left</b></span>
                <span className="hx-deals__name">{c.name}</span>
                <span className="hx-deals__price"><b>{money(c.price)}</b></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
