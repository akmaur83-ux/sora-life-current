import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminListProducts, adminListCategories, adminListHeroSlides, adminImportBiosashCatalog, adminSeedDefaultCategories, adminSeedDefaultHeroSlides } from '../../lib/adminApi.js';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [slides, setSlides] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [progress, setProgress] = useState(null);

  async function load() {
    setLoading(true);
    const [p, c, h] = await Promise.all([
      adminListProducts().catch(() => []),
      adminListCategories().catch(() => []),
      adminListHeroSlides().catch(() => []),
    ]);
    setProducts(p); setCategories(c); setSlides(h);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function runImport() {
    setImporting(true);
    setImportMsg('');
    try {
      await adminSeedDefaultCategories();
      await adminSeedDefaultHeroSlides();
      const n = await adminImportBiosashCatalog((done, total) => setProgress({ done, total }));
      setImportMsg(`Imported/updated ${n} real Biosash products, seeded default categories and hero slides.`);
      await load();
    } catch (e) {
      setImportMsg('Import failed: ' + (e.message || String(e)));
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }

  const active = products.filter((p) => p.isActive).length;

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of your Sora Life storefront data.</p>
        </div>
      </div>

      {!loading && products.length === 0 && (
        <div className="adm-banner info">
          <strong>The live product catalog is empty.</strong> The storefront is currently showing the built-in
          149-product Biosash catalog as a fallback. Click below to import it into Supabase — after that, this
          dashboard (and the public site) will manage products from here.
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-sm" onClick={runImport} disabled={importing}>
              {importing ? (progress ? `Importing… ${progress.done}/${progress.total}` : 'Importing…') : 'Import 149 Biosash products'}
            </button>
          </div>
          {importMsg && <p style={{ marginTop: 10 }}>{importMsg}</p>}
        </div>
      )}

      <div className="adm__stats">
        <div className="adm__stat"><strong>{loading ? '—' : products.length}</strong><span>Products</span></div>
        <div className="adm__stat"><strong>{loading ? '—' : active}</strong><span>Active products</span></div>
        <div className="adm__stat"><strong>{loading ? '—' : categories.length}</strong><span>Categories</span></div>
        <div className="adm__stat"><strong>{loading ? '—' : slides.length}</strong><span>Hero slides</span></div>
      </div>

      <div className="surface pad-lg">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', marginBottom: 14 }}>Quick links</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn-outline btn-sm" to="/admin/products/new">+ Add product</Link>
          <Link className="btn btn-outline btn-sm" to="/admin/products">Manage products</Link>
          <Link className="btn btn-outline btn-sm" to="/admin/hero-slides">Manage hero slides</Link>
          <Link className="btn btn-outline btn-sm" to="/admin/categories">Manage categories</Link>
          <Link className="btn btn-outline btn-sm" to="/admin/branding">Branding</Link>
        </div>
      </div>
    </div>
  );
}
