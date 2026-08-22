import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminListProducts, adminSetProductActive, adminDeleteProduct, adminReorderProducts } from '../../lib/adminApi.js';
import { categories as staticCategories } from '../../data/categories.js';
import { money } from '../../lib/format.js';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    try { setProducts(await adminListProducts()); } catch (e) { setErr(e.message || String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return products;
    return products.filter((p) => p.name.toLowerCase().includes(t) || p.category.toLowerCase().includes(t) || p.slug.toLowerCase().includes(t));
  }, [products, q]);

  async function toggleActive(p) {
    setBusyId(p.dbId);
    try {
      await adminSetProductActive(p.dbId, !p.isActive);
      setProducts((list) => list.map((x) => x.dbId === p.dbId ? { ...x, isActive: !x.isActive } : x));
    } catch (e) { setErr(e.message || String(e)); }
    setBusyId(null);
  }

  async function remove(p) {
    if (!window.confirm(`Permanently delete "${p.name}"? This cannot be undone. Use Disable instead if you just want to hide it.`)) return;
    setBusyId(p.dbId);
    try {
      await adminDeleteProduct(p.dbId);
      setProducts((list) => list.filter((x) => x.dbId !== p.dbId));
    } catch (e) { setErr(e.message || String(e)); }
    setBusyId(null);
  }

  async function move(p, dir) {
    const idx = products.findIndex((x) => x.dbId === p.dbId);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= products.length) return;
    const next = [...products];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setProducts(next);
    try { await adminReorderProducts(next.map((x) => x.dbId)); } catch (e) { setErr(e.message || String(e)); }
  }

  const catName = (slug) => staticCategories.find((c) => c.slug === slug)?.name || slug;

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Products</h1>
          <p>{loading ? 'Loading…' : `${products.length} products in the live catalog`}</p>
        </div>
        <Link to="/admin/products/new" className="btn">+ Add product</Link>
      </div>

      {err && <div className="adm-banner err">{err}</div>}

      <div className="adm-toolbar">
        <div className="searchbox">
          <input className="input" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading products…</p>
      ) : filtered.length === 0 ? (
        <div className="adm-empty">
          {products.length === 0
            ? <>No products yet. <Link to="/admin" className="inline-link">Import the Biosash catalog</Link> or <Link to="/admin/products/new" className="inline-link">add one manually</Link>.</>
            : 'No products match your search.'}
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Flags</th><th>Active</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.dbId} className={!p.isActive ? 'adm-disabled' : ''}>
                  <td>
                    <div className="adm-row-name">
                      <span className="adm-thumb">{p.image && <img src={p.image} alt="" />}</span>
                      <div><strong>{p.name}</strong><span>{p.slug}</span></div>
                    </div>
                  </td>
                  <td>{catName(p.category)}</td>
                  <td>
                    {money(p.discountPercent > 0 ? Math.round(p.originalPrice * (1 - p.discountPercent / 100)) : p.originalPrice)}
                    {p.discountPercent > 0 && <span className="hint" style={{ display: 'block' }}>MRP {money(p.originalPrice)} · {p.discountPercent}%</span>}
                  </td>
                  <td>{p.stock > 0 ? <span className="badge">In stock</span> : <span className="badge badge-out">Out of stock</span>}</td>
                  <td>
                    {p.isBestseller && <span className="badge badge-best" style={{ marginRight: 4 }}>Best</span>}
                    {p.isNew && <span className="badge badge-new" style={{ marginRight: 4 }}>New</span>}
                    {p.isFeatured && <span className="badge badge-soft">Featured</span>}
                  </td>
                  <td>
                    <button className={`switch ${p.isActive ? 'on' : ''}`} onClick={() => toggleActive(p)} disabled={busyId === p.dbId} aria-label="Toggle active"><i /></button>
                  </td>
                  <td>
                    <div className="adm-actions">
                      <button className="btn btn-sm btn-light" onClick={() => move(p, -1)} title="Move up">↑</button>
                      <button className="btn btn-sm btn-light" onClick={() => move(p, 1)} title="Move down">↓</button>
                      <Link className="btn btn-sm btn-light" to={`/admin/products/${p.dbId}/edit`}>Edit</Link>
                      <button className="btn btn-sm btn-ghost" style={{ color: 'var(--color-sale)' }} onClick={() => remove(p)} disabled={busyId === p.dbId}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
