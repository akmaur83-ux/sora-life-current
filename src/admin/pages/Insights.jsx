import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { money } from '../../lib/format.js';
import { toCsv, downloadCsv } from '../lib/csv.js';

// ============================================================
// Admin → Insights (owner, 2026-11-13: feature 36, "kya bik raha hai"). Three lists:
//   * Top searches — what shoppers typed, by store (search_log, 0043);
//   * Searched, nothing found — demand the catalogue does not meet yet: stock it,
//     or add the words to a product's name or description;
//   * Best sellers — paid orders' lines, by units, in the period.
//   * Sales by brand (2026-11-20) — what each partner sold in the period, units and
//     takings at the price charged, to settle with them; downloadable as CSV.
//   * Stock watch (2026-11-20) — live products out of stock or down to 1–3, every store.
//   * Most viewed (round 15, 2026-11-20) — product pages opened most in the period
//     (product_views, 0046: one count per product per browser per day, nothing personal).
// Read-only. The search log holds the text only — no shopper, no address.
// ============================================================
export const RANGES = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']];

/** search_log rows → { top, zero }: each { q, store, n }, most searched first. Pure. */
export function summariseSearches(rows) {
  const top = new Map(); const zero = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const k = `${r.store}|${r.q}`;
    const into = Number(r.results) > 0 ? top : zero;
    into.set(k, { q: r.q, store: r.store, n: (into.get(k)?.n || 0) + 1 });
  }
  const sort = (m) => [...m.values()].sort((a, b) => b.n - a.n || a.q.localeCompare(b.q));
  // A query that found results at least once is not "nothing found".
  const found = new Set([...top.keys()]);
  return { top: sort(top), zero: sort(zero).filter((z) => !found.has(`${z.store}|${z.q}`)) };
}

/** Paid orders → best sellers by units: { name, units, revenue }. Pure. */
export function bestSellers(orders) {
  const m = new Map();
  for (const o of Array.isArray(orders) ? orders : []) {
    if (o.payment_status !== 'paid') continue;
    for (const l of Array.isArray(o.items) ? o.items : []) {
      const name = String(l?.name || '').trim();
      if (!name) continue;
      const cur = m.get(name) || { name, units: 0, revenue: 0 };
      cur.units += Number(l.qty) || 0;
      cur.revenue += Number(l.line_total) || (Number(l.unit_price) || 0) * (Number(l.qty) || 0);
      m.set(name, cur);
    }
  }
  return [...m.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue);
}

/**
 * Paid orders → sales by brand: { brand, units, revenue, orders }, biggest takings first.
 * `brandOf(line)` names a line's brand ('' when unknown → "Other"). Pure.
 */
export function salesByBrand(orders, brandOf) {
  const m = new Map();
  for (const o of Array.isArray(orders) ? orders : []) {
    if (o.payment_status !== 'paid') continue;
    const seen = new Set();
    for (const l of Array.isArray(o.items) ? o.items : []) {
      const brand = String(brandOf(l) || '').trim() || 'Other';
      const cur = m.get(brand) || { brand, units: 0, revenue: 0, orders: 0 };
      cur.units += Number(l.qty) || 0;
      cur.revenue += Number(l.line_total) || (Number(l.unit_price) || 0) * (Number(l.qty) || 0);
      if (!seen.has(brand)) { cur.orders += 1; seen.add(brand); }
      m.set(brand, cur);
    }
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue || a.brand.localeCompare(b.brand));
}

/** The brand lookup for order lines: catalogue lines by their product, wellness lines by theirs, Biosash lines by their id. Pure. */
export function lineBrand(catalogueBrands, wellnessBrands) {
  return (l) => {
    const id = String(l?.product_id ?? '');
    if (l?.catalogue) return catalogueBrands[id] || '';
    return wellnessBrands[id] || (l?.biosash_id ? 'Biosash' : '');
  };
}

/** Live products out of stock or at 1–`low` left → { out, low }, each { name, store, brand, stock }. Pure. */
export function stockWatch(rows, low = 3) {
  const live = (Array.isArray(rows) ? rows : []).filter((r) => r && r.is_active !== false);
  const pick = (r) => ({ name: r.name, store: r.store || 'wellness', brand: r.brand || '', stock: Number(r.stock) || 0 });
  return {
    out: live.filter((r) => (Number(r.stock) || 0) <= 0).map(pick).sort((a, b) => a.name.localeCompare(b.name)),
    low: live.filter((r) => Number(r.stock) >= 1 && Number(r.stock) <= low).map(pick).sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name)),
  };
}

/** product_views rows → { store, slug, n }, most viewed first. Pure. */
export function topViewed(rows) {
  const m = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r?.slug || !r?.store) continue;
    const k = `${r.store}/${r.slug}`;
    m.set(k, { store: r.store, slug: r.slug, n: (m.get(k)?.n || 0) + 1 });
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.slug.localeCompare(b.slug));
}
export const productHref = (store, slug) => (store === 'fashion' ? `/fashion/p/${slug}` : store === 'homeliving' ? `/homeliving/p/${slug}` : `/product/${slug}`);

/** Stock watch → CSV: out of stock first, then 1–3 left (round 17, 2026-11-20). Pure. */
export const stockCsv = (w) => toCsv([...(w?.out || []).map((r) => ({ ...r, state: 'Out of stock' })), ...(w?.low || []).map((r) => ({ ...r, state: 'Running low' }))], [
  ['State', (r) => r.state], ['Product', (r) => r.name], ['Store', (r) => r.store], ['Brand', (r) => r.brand], ['Left', (r) => r.stock],
]);

/**
 * Photo check (round 18, 2026-11-20): partners' pictures live on their own servers and
 * can disappear. Loads each live product's main picture the way a shopper's browser
 * would (an <img>, so any site's pictures can be checked) and lists the ones that do
 * not load. `load(url)` resolves true/false; at most `parallel` at a time.
 */
export async function checkPhotos(rows, load, parallel = 12, onProgress = () => {}) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => Array.isArray(r.images) && r.images[0]);
  const bad = []; let done = 0; const q = [...list];
  await Promise.all(Array.from({ length: parallel }, async () => {
    while (q.length) {
      const r = q.shift();
      if (!(await load(r.images[0]))) bad.push({ name: r.name, store: r.store, brand: r.brand || '', slug: r.slug, url: r.images[0] });
      done += 1; onProgress(done, list.length);
    }
  }));
  return bad.sort((a, b) => a.name.localeCompare(b.name));
}
const loadImage = (url) => new Promise((res) => { const i = new Image(); const t = setTimeout(() => res(false), 15000); i.onload = () => { clearTimeout(t); res(i.naturalWidth > 0); }; i.onerror = () => { clearTimeout(t); res(false); }; i.src = url; });

const STORE = { wellness: 'Wellness', fashion: 'Fashion', homeliving: 'Home & Living', grocery: 'Grocery' };
const box = { border: '1px solid #E4E8E1', background: '#fff', padding: 14 };

function List({ title, hint, rows, render, empty }) {
  return (
    <section style={box}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>{title}</h2>
      <p className="adm-hint" style={{ margin: '0 0 10px' }}>{hint}</p>
      {rows === null ? <p>Loading…</p> : rows.length === 0 ? <p className="adm-hint">{empty}</p> : (
        <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>{rows.slice(0, 25).map(render)}</ol>
      )}
    </section>
  );
}

export default function Insights() {
  const [days, setDays] = useState(7);
  const [searches, setSearches] = useState(null);
  const [sellers, setSellers] = useState(null);
  const [brands, setBrands] = useState(null);
  const [stock, setStock] = useState(null);
  const [viewed, setViewed] = useState(null);
  const [photos, setPhotos] = useState({ state: 'idle', done: 0, total: 0, bad: [] });
  const runPhotoCheck = async () => {
    setPhotos({ state: 'running', done: 0, total: 0, bad: [] });
    const { data } = await supabase.from('catalogue_products').select('name, store, brand, slug, images').eq('is_active', true).limit(5000);
    const bad = await checkPhotos(data || [], loadImage, 12, (done, total) => setPhotos((p) => ({ ...p, done, total })));
    setPhotos({ state: 'done', done: (data || []).length, total: (data || []).length, bad });
  };
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setSearches(null); setSellers(null); setBrands(null); setViewed(null); setError('');
    supabase.from('product_views').select('store, slug').gte('created_at', since).limit(20000)
      .then(async ({ data, error: e }) => {
        if (!live) return;
        if (e) { setViewed([]); return; }
        const top = topViewed(data).slice(0, 25);
        const cat = top.filter((t) => t.store !== 'wellness').map((t) => t.slug);
        const well = top.filter((t) => t.store === 'wellness').map((t) => t.slug);
        const [c, w] = await Promise.all([
          cat.length ? supabase.from('catalogue_products').select('slug, store, name').in('slug', cat) : { data: [] },
          well.length ? supabase.from('products').select('slug, name').in('slug', well) : { data: [] },
        ]);
        if (!live) return;
        const names = new Map([...(c.data || []).map((r) => [`${r.store}/${r.slug}`, r.name]), ...(w.data || []).map((r) => [`wellness/${r.slug}`, r.name])]);
        setViewed(top.map((t) => ({ ...t, name: names.get(`${t.store}/${t.slug}`) || t.slug })));
      }, () => { if (live) setViewed([]); });
    const since = new Date(Date.now() - days * 86400e3).toISOString();
    supabase.from('search_log').select('q, store, results').gte('created_at', since).order('created_at', { ascending: false }).limit(5000)
      .then(({ data, error: e }) => { if (!live) return; if (e) { setError(e.message); setSearches({ top: [], zero: [] }); } else setSearches(summariseSearches(data)); });
    supabase.from('orders').select('items, payment_status, created_at').eq('payment_status', 'paid').gte('created_at', since).limit(2000)
      .then(async ({ data, error: e }) => {
        if (!live) return;
        if (e) { setError(e.message); setSellers([]); setBrands([]); return; }
        setSellers(bestSellers(data));
        // Each line's brand, from the product it was (catalogue or wellness).
        const lines = (data || []).flatMap((o) => (Array.isArray(o.items) ? o.items : []));
        const cat = [...new Set(lines.filter((l) => l.catalogue && l.product_id).map((l) => String(l.product_id)))];
        const well = [...new Set(lines.filter((l) => !l.catalogue && l.product_id).map((l) => String(l.product_id)))];
        const [c, w] = await Promise.all([
          cat.length ? supabase.from('catalogue_products').select('id, brand').in('id', cat) : { data: [] },
          well.length ? supabase.from('products').select('id, brand').in('id', well) : { data: [] },
        ]);
        if (!live) return;
        const map = (r) => Object.fromEntries((r?.data || []).map((x) => [String(x.id), x.brand || '']));
        setBrands(salesByBrand(data, lineBrand(map(c), map(w))));
      });
    return () => { live = false; };
  }, [days]);

  // Stock watch: every store, live products only; the same whatever the period.
  useEffect(() => {
    let live = true;
    Promise.all([
      supabase.from('catalogue_products').select('name, store, brand, stock, is_active').eq('is_active', true).lte('stock', 3).limit(1000),
      supabase.from('products').select('name, brand, stock, is_active').lte('stock', 3).limit(1000),
    ]).then(([c, w]) => {
      if (!live) return;
      const rows = [...(c.data || []), ...(w.data || []).map((r) => ({ ...r, store: 'wellness' }))];
      setStock(stockWatch(rows));
    }, () => { if (live) setStock({ out: [], low: [] }); });
    return () => { live = false; };
  }, []);

  const saveBrands = () => downloadCsv(`sora-sales-by-brand-${days}-days.csv`, toCsv(brands || [], [
    ['Brand', (r) => r.brand], ['Orders', (r) => r.orders], ['Units', (r) => r.units], ['Takings (INR)', (r) => Math.round(r.revenue * 100) / 100],
  ]));
  return (
    <div>
      <div className="adm__head"><h1>Insights</h1></div>
      <div className="adm-checkrow" role="tablist" style={{ gap: 8, margin: '12px 0' }}>
        {RANGES.map(([d, label]) => <button key={d} type="button" role="tab" aria-selected={days === d} className={`btn btn-sm${days === d ? '' : ' btn-ghost'}`} onClick={() => setDays(d)}>{label}</button>)}
      </div>
      {error && <div className="adm-banner error">{error}</div>}
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <List title="Top searches" hint="What shoppers typed, and found something." rows={searches?.top ?? null} empty="No searches yet in this period."
          render={(r) => <li key={`${r.store}|${r.q}`}><b>{r.q}</b> <span style={{ color: '#5F6D64' }}>· {STORE[r.store]} · {r.n}×</span></li>} />
        <List title="Searched, nothing found" hint="Demand you are not meeting yet: stock it, or add these words to the right products." rows={searches?.zero ?? null} empty="Nothing went unfound in this period."
          render={(r) => <li key={`${r.store}|${r.q}`}><b>{r.q}</b> <span style={{ color: '#5F6D64' }}>· {STORE[r.store]} · {r.n}×</span></li>} />
        <List title="Best sellers" hint="Units sold in paid orders." rows={sellers} empty="No paid orders in this period."
          render={(r) => <li key={r.name}><b>{r.name}</b> <span style={{ color: '#5F6D64' }}>· {r.units} sold · {money(r.revenue)}</span></li>} />
        <section style={box}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Sales by brand</h2>
            {brands?.length > 0 && <button type="button" className="btn btn-sm btn-ghost" onClick={saveBrands}>Download CSV</button>}
          </div>
          <p className="adm-hint" style={{ margin: '0 0 10px' }}>Paid orders in the period, by the brand of each item: for settling with partners. Takings at the price charged, after discounts.</p>
          {brands === null ? <p>Loading…</p> : brands.length === 0 ? <p className="adm-hint">No paid orders in this period.</p> : (
            <table className="adm-table" style={{ fontSize: 14 }}>
              <thead><tr><th>Brand</th><th>Orders</th><th>Units</th><th>Takings</th></tr></thead>
              <tbody>{brands.map((r) => <tr key={r.brand}><td><b>{r.brand}</b></td><td>{r.orders}</td><td>{r.units}</td><td>{money(r.revenue)}</td></tr>)}</tbody>
            </table>
          )}
        </section>
        <List title="Most viewed" hint="Product pages opened most in the period: once per product, per browser, per day." rows={viewed} empty="No product views recorded in this period yet."
          render={(r) => <li key={`${r.store}/${r.slug}`}><a href={productHref(r.store, r.slug)} target="_blank" rel="noopener noreferrer"><b>{r.name}</b></a> <span style={{ color: '#5F6D64' }}>· {STORE[r.store] || r.store} · {r.n} views</span></li>} />
        {stock && (stock.out.length + stock.low.length) > 0 && (
          <section style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span className="adm-hint">Out of stock and running low, every store, as a spreadsheet (round 17).</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => downloadCsv('sora-stock-watch.csv', stockCsv(stock))}>Download stock CSV</button>
          </section>
        )}
        <section style={box}>
          <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Photo check</h2>
          <p className="adm-hint" style={{ margin: '0 0 10px' }}>Partners’ pictures live on their own servers and can disappear. This loads every live product’s main picture and lists any that do not open.</p>
          {photos.state === 'idle' && <button type="button" className="btn btn-sm" onClick={runPhotoCheck}>Check product photos</button>}
          {photos.state === 'running' && <p>Checking… {photos.done} of {photos.total || '…'}</p>}
          {photos.state === 'done' && (photos.bad.length === 0 ? <p>All {photos.total} main pictures open. <button type="button" className="btn btn-sm btn-ghost" onClick={runPhotoCheck}>Check again</button></p> : (
            <>
              <p><b>{photos.bad.length}</b> of {photos.total} do not open — replace their pictures in the store catalogue:</p>
              <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>{photos.bad.slice(0, 50).map((r) => <li key={`${r.store}/${r.slug}`}><a href={productHref(r.store, r.slug)} target="_blank" rel="noopener noreferrer"><b>{r.name}</b></a> <span style={{ color: '#5F6D64' }}>· {STORE[r.store] || r.store}{r.brand ? ` · ${r.brand}` : ''}</span></li>)}</ol>
            </>
          ))}
        </section>
        <List title={`Out of stock${stock ? ` (${stock.out.length})` : ''}`} hint="Live products with none left: restock them, or hide them from the shop." rows={stock?.out ?? null} empty="Nothing is out of stock."
          render={(r, i) => <li key={`${r.store}|${r.name}|${i}`}><b>{r.name}</b> <span style={{ color: '#5F6D64' }}>· {STORE[r.store] || r.store}{r.brand ? ` · ${r.brand}` : ''}</span></li>} />
        <List title={`Running low${stock ? ` (${stock.low.length})` : ''}`} hint="Live products with 1–3 left, fewest first." rows={stock?.low ?? null} empty="Nothing is running low."
          render={(r, i) => <li key={`${r.store}|${r.name}|${i}`}><b>{r.name}</b> <span style={{ color: '#5F6D64' }}>· {r.stock} left · {STORE[r.store] || r.store}{r.brand ? ` · ${r.brand}` : ''}</span></li>} />
      </div>
    </div>
  );
}
