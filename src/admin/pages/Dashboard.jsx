import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminListProducts, adminListCategories, adminImportBiosashCatalog, adminSeedDefaultCategories } from '../../lib/adminApi.js';
import { supabase } from '../../lib/supabase.js';

// ============================================================
// Today (owner, 2026-11-20: round 21): what needs doing, at the top of the dashboard.
//   * orders to ship — paid online, or cash on delivery not cancelled, and not yet
//     shipped, delivered or cancelled;
//   * new enquiries — sell on SORA, bulk gifting, product requests;
//   * out of stock — live products with none left, every store;
//   * ask for reviews — orders delivered in the last 60 days (the shop has no reviews yet).
// Counts only, each opening the page where it is done.
// ============================================================
const DONE = new Set(['shipped', 'delivered', 'cancelled']);
/** Orders → { toShip, delivered60 }. Pure. */
export function orderTodo(orders, now = Date.now()) {
  let toShip = 0; let delivered60 = 0;
  for (const o of Array.isArray(orders) ? orders : []) {
    const cancelled = o.status === 'cancelled' || o.fulfillment_status === 'cancelled' || o.payment_status === 'failed';
    const committed = o.payment_status === 'paid' || (o.payment_method === 'cod' && !cancelled);
    if (committed && !cancelled && !DONE.has(o.fulfillment_status)) toShip += 1;
    const at = Date.parse(o.delivered_at || '');
    if (o.fulfillment_status === 'delivered' && (!at || now - at <= 60 * 86400e3)) delivered60 += 1;
  }
  return { toShip, delivered60 };
}

function Today() {
  const [t, setT] = useState(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      supabase.from('orders').select('status, payment_status, payment_method, fulfillment_status, delivered_at').order('created_at', { ascending: false }).limit(2000),
      supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('catalogue_products').select('id', { count: 'exact', head: true }).eq('is_active', true).lte('stock', 0),
      supabase.from('products').select('id', { count: 'exact', head: true }).neq('is_active', false).lte('stock', 0),
    ]).then(([o, e, c, w]) => {
      if (!live) return;
      setT({ ...orderTodo(o.data || []), enquiries: e.count || 0, out: (c.count || 0) + (w.count || 0) });
    }, () => { if (live) setT({ toShip: 0, delivered60: 0, enquiries: 0, out: 0 }); });
    return () => { live = false; };
  }, []);
  const items = t ? [
    ['Orders to ship', t.toShip, '/admin/orders', 'Paid or cash on delivery, not shipped yet'],
    ['New enquiries', t.enquiries, '/admin/enquiries', 'Brands, bulk orders and product requests'],
    ['Out of stock', t.out, '/admin/insights', 'Live products with none left'],
    ['Ask for reviews', t.delivered60, '/admin/orders', 'Orders delivered in the last 60 days'],
  ] : [];
  return (
    <section className="surface pad-lg" style={{ marginBottom: 16 }} aria-labelledby="adm-today-h">
      <h2 id="adm-today-h" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', marginBottom: 12 }}>Today</h2>
      {!t ? <p className="muted">Loading…</p> : (
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          {items.map(([label, n, to, hint]) => (
            <Link key={label} to={to} className="adm-todo" style={{ borderLeft: n > 0 ? '3px solid #B4532A' : undefined }}>
              <strong>{n}</strong><span>{label}</span><em style={{ display: 'block', fontStyle: 'normal', fontSize: 12, color: '#5F6D64' }}>{hint}</em>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}


export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  // null = not known. A failed read is not an empty catalogue, so it must
  // never look like one: the import offer below needs a list that loaded.
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null); // { ok, text }
  const [progress, setProgress] = useState(null);

  async function load() {
    setLoading(true);
    const [p, c] = await Promise.allSettled([adminListProducts(), adminListCategories()]);
    setProducts(p.status === 'fulfilled' ? p.value : null);
    setCategories(c.status === 'fulfilled' ? c.value : null);
    setLoadErr([p, c].filter((r) => r.status === 'rejected').map((r) => r.reason?.message || String(r.reason)).join(' · '));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function runImport() {
    if (!window.confirm('Import the 149 bundled Biosash products into the live catalogue?\n\n'
      + 'They are added as active products with no prices set; price them on the Pricing page. '
      + 'Default categories are added where missing. Nothing already in the catalogue is changed.')) return;
    setImporting(true);
    setImportMsg(null);
    try {
      await adminSeedDefaultCategories();
      const { added, total } = await adminImportBiosashCatalog((done, total) => setProgress({ done, total }));
      setImportMsg({ ok: true, text: `Added ${added} of the ${total} bundled Biosash products`
        + (added < total ? `; the other ${total - added} were already in the catalogue and were left as they are` : '')
        + '. Default categories seeded where missing.' });
      await load();
    } catch (e) {
      setImportMsg({ ok: false, text: 'Import failed: ' + (e.message || String(e)) });
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }

  const active = products ? products.filter((p) => p.isActive).length : 0;
  const count = (list, n) => (loading || !list ? '—' : n);

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of your Sora Lifestyle storefront data.</p>
        </div>
      </div>

      {loadErr && (
        <div className="adm-banner err" role="alert">
          The catalogue could not be loaded ({loadErr}). Figures shown as — are unknown until it loads. Reload the page to try again.
        </div>
      )}
      {importMsg && <div className={`adm-banner ${importMsg.ok ? 'ok' : 'err'}`}>{importMsg.text}</div>}

      {!loading && products && products.length === 0 && (
        <div className="adm-banner info">
          <strong>The live product catalog is empty.</strong> The storefront is currently showing the built-in
          149-product Biosash catalog as a fallback. Click below to import it into Supabase — after that, this
          dashboard (and the public site) will manage products from here.
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-sm" onClick={runImport} disabled={importing}>
              {importing ? (progress ? `Importing… ${progress.done}/${progress.total}` : 'Importing…') : 'Import 149 Biosash products'}
            </button>
          </div>
        </div>
      )}

      <Today />

      <div className="adm__stats">
        <div className="adm__stat"><strong>{count(products, products?.length)}</strong><span>Products</span></div>
        <div className="adm__stat"><strong>{count(products, active)}</strong><span>Active products</span></div>
        <div className="adm__stat"><strong>{count(categories, categories?.length)}</strong><span>Categories</span></div>
      </div>

      <div className="surface pad-lg">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', marginBottom: 14 }}>Quick links</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn-outline btn-sm" to="/admin/products/new">+ Add product</Link>
          <Link className="btn btn-outline btn-sm" to="/admin/products">Manage products</Link>
          <Link className="btn btn-outline btn-sm" to="/admin/categories">Manage categories</Link>
          <Link className="btn btn-outline btn-sm" to="/admin/branding">Branding</Link>
        </div>
      </div>
    </div>
  );
}
