import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../lib/format.js';
import { supabase } from '../lib/supabase.js';
import { products } from '../data/products.js';
import OfferBanner from '../components/OfferBanner.jsx';
import LoadMore, { useShowMore } from '../components/LoadMore.jsx';
import { useStorefrontSection } from '../lib/storefrontSections.js';
import { OFFER_COUNTDOWN, parseIndiaTime } from '../lib/offerCountdown.js';
import { offerShareText } from '../components/PromoCard.jsx';
import { usePageMeta } from '../lib/pageMeta.js';

// ============================================================
// /offers — every product on a real discount, across the stores, biggest discount
// first (owner, 2026-11-10: features for promotion). One link to put in an
// Instagram bio, a WhatsApp status or an ad: the running offer and its countdown at
// the top, a way to share it, then the deals, filterable by store. Discounts are
// the products' own (MRP against the selling price); nothing here prices anything.
// ============================================================
export const STORES = [
  { id: 'all', label: 'All' },
  { id: 'wellness', label: 'Wellness' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'homeliving', label: 'Home & Living' },
];

/** A Fashion or Home & Living row as a deal, or null when it is not on a real discount or not in stock. Pure. */
export function catalogueDeal(r) {
  if (!r || r.is_demo || !r.slug) return null;
  const mrp = Number(r.mrp) || 0;
  const sale = r.sale_price == null ? 0 : Number(r.sale_price) || 0;
  if (!(sale > 0 && sale < mrp)) return null;
  const vs = (Array.isArray(r.variants) ? r.variants : []).filter((v) => v && v.is_active !== false);
  const inStock = vs.length ? vs.some((v) => Number(v.stock) > 0) : Number(r.stock) > 0;
  const image = Array.isArray(r.images) ? r.images.find(Boolean) : null;
  if (!inStock || !image) return null;
  return {
    key: `${r.store}-${r.id}`, store: r.store, name: r.name, image, price: sale, mrp,
    pct: Math.round(((mrp - sale) / mrp) * 100), href: r.store === 'fashion' ? `/fashion/p/${r.slug}` : `/homeliving/p/${r.slug}`,
  };
}

export const wellnessDeals = (list) => (Array.isArray(list) ? list : [])
  .filter((p) => p && p.slug && p.price > 0 && p.mrp > p.price && Number(p.stock) > 0)
  .map((p) => ({ key: `wellness-${p.id}`, store: 'wellness', name: p.name, image: p.image || null, price: p.price, mrp: p.mrp, pct: Math.round(((p.mrp - p.price) / p.mrp) * 100), href: `/product/${p.slug}` }));

export const sortDeals = (deals) => [...deals].sort((a, b) => b.pct - a.pct || (b.mrp - b.price) - (a.mrp - a.price) || String(a.name).localeCompare(String(b.name)));

/** India's date as YYYY-MM-DD for a moment. Pure. */
export const istDay = (now) => new Date(now + 330 * 60000).toISOString().slice(0, 10);

/**
 * Today's top pick (2026-11-13: more features): one of the 24 biggest discounts,
 * chosen by India's date, so it is the same for everyone all day and changes at
 * midnight. Its price is the product's own; nothing is discounted further. Pure.
 */
export function dailyPick(sortedDeals, now) {
  const top = (Array.isArray(sortedDeals) ? sortedDeals : []).slice(0, 24);
  if (!top.length) return null;
  let h = 0;
  for (const c of istDay(now)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return top[h % top.length];
}

/** Time left in India's day, "5h 12m". Pure. */
export function untilMidnight(now) {
  const ist = new Date(now + 330 * 60000);
  const left = 24 * 60 - (ist.getUTCHours() * 60 + ist.getUTCMinutes());
  return `${Math.floor(left / 60)}h ${left % 60}m`;
}

function TodayPick({ deals }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  const d = dailyPick(deals, now);
  if (!d) return null;
  return (
    <section className="hx-today" aria-labelledby="hx-today-h">
      <Link to={d.href} className="hx-today__card">
        <span className="hx-today__img">{d.image && <img src={d.image} alt="" width="320" height="320" loading="eager" decoding="async" />}</span>
        <span className="hx-today__body">
          <em id="hx-today-h">Today’s top pick</em>
          <b>{d.name}</b>
          <span className="hx-today__price"><strong>{money(d.price)}</strong><s>{money(d.mrp)}</s><i>−{d.pct}%</i></span>
          <span className="hx-today__note">A new pick from our biggest discounts every day · next in {untilMidnight(now)}</span>
          <span className="hx-today__go">See it <Icon name="arrowRight" size={15} /></span>
        </span>
      </Link>
    </section>
  );
}

async function fetchCatalogueDeals(client = supabase) {
  if (!client) return [];
  // A thousand rows per read (the API's cap), until a page comes back short.
  const rows = [];
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await client.from('catalogue_products')
      .select('id, store, name, slug, mrp, sale_price, images, stock, is_demo, variants:catalogue_variants(stock, is_active)')
      .eq('is_active', true).in('store', ['fashion', 'homeliving']).not('sale_price', 'is', null)
      .order('id', { ascending: true }).range(from, from + 999);
    if (error || !Array.isArray(data)) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows.map(catalogueDeal).filter(Boolean);
}

function ShareOffer() {
  const o = useStorefrontSection('wellness', 'offerCountdown', OFFER_COUNTDOWN);
  const [copied, setCopied] = useState(false);
  const live = !o.hidden && parseIndiaTime(o.endsAt) > Date.now();
  const link = `https://www.soralifestyle.in/offers${live && o.code ? `?promo=${encodeURIComponent(o.code)}` : ''}`;
  const text = offerShareText(live ? o : null, link);
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard off */ } };
  return (
    <div className="hx-offers__share">
      <span>Tell a friend:</span>
      <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="hx-offers__btn hx-offers__btn--wa"><Icon name="chat" size={16} /> WhatsApp</a>
      <button type="button" className="hx-offers__btn" onClick={copy}><Icon name="copy" size={16} /> {copied ? 'Link copied ✓' : 'Copy link'}</button>
    </div>
  );
}

export default function Offers() {
  const [params, setParams] = useSearchParams();
  const store = STORES.some((s) => s.id === params.get('store')) ? params.get('store') : 'all';
  const [cat, setCat] = useState(null);
  useEffect(() => { let on = true; fetchCatalogueDeals().then((d) => { if (on) setCat(d); }, () => { if (on) setCat([]); }); return () => { on = false; }; }, []);
  const all = useMemo(() => sortDeals([...wellnessDeals(products), ...(cat || [])]), [cat]);
  const shownDeals = store === 'all' ? all : all.filter((d) => d.store === store);
  const paging = useShowMore(shownDeals.length, store);
  usePageMeta({ title: 'Offers & deals', description: 'Every product on offer at SORA LIFESTYLE: wellness, fashion and home, biggest discounts first.', path: '/offers' });
  const counts = Object.fromEntries(STORES.map((s) => [s.id, s.id === 'all' ? all.length : all.filter((d) => d.store === s.id).length]));
  const pick = (id) => { const next = new URLSearchParams(params); if (id === 'all') next.delete('store'); else next.set('store', id); setParams(next, { replace: true }); };

  return (
    <div className="hx hx-offers">
      <div className="hx-wrap">
        <nav className="hx-offers__crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link> <Icon name="chevronRight" size={12} /> <span>Offers</span></nav>
        <h1 className="hx-offers__h">Offers &amp; deals</h1>
        <p className="hx-offers__lede">Everything on offer right now across wellness, fashion and home, biggest discount first.</p>
      </div>
      <OfferBanner wrap="hx-wrap" />
      <div className="hx-wrap">
        <ShareOffer />
        {store === 'all' && cat !== null && <TodayPick deals={all} />}
        <div className="hx-offers__tabs" role="tablist" aria-label="Store">
          {STORES.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={store === s.id} className={`hx-offers__tab${store === s.id ? ' is-on' : ''}`} onClick={() => pick(s.id)}>
              {s.label}{cat ? <em>{counts[s.id]}</em> : null}
            </button>
          ))}
        </div>
        {cat === null && shownDeals.length === 0 ? (
          <p className="hx-offers__empty" role="status">Loading the offers…</p>
        ) : shownDeals.length === 0 ? (
          <p className="hx-offers__empty">Nothing on offer here right now. New deals appear the moment they go live.</p>
        ) : (
          <>
            <ul className="hx-offers__grid">
              {shownDeals.slice(0, paging.shown).map((d, i) => (
                <li key={d.key}>
                  <Link to={d.href} className="hx-deals__card">
                    <span className="hx-deals__img">
                      {d.image && <img src={d.image} alt="" width="300" height="300" loading={i < 8 ? 'eager' : 'lazy'} decoding="async" />}
                      <b className="hx-deals__pct">−{d.pct}%</b>
                    </span>
                    <span className="hx-deals__name">{d.name}</span>
                    <span className="hx-deals__price"><b>{money(d.price)}</b><s>{money(d.mrp)}</s></span>
                    <span className="hx-offers__save">You save {money(d.mrp - d.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <LoadMore shown={paging.shown} total={shownDeals.length} onMore={paging.more} />
          </>
        )}
      </div>
    </div>
  );
}
