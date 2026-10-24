import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminListProducts, adminListCategories, adminImportBiosashCatalog, adminSeedDefaultCategories } from '../../lib/adminApi.js';

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
