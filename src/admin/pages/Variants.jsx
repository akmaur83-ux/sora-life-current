import { useEffect, useMemo, useState } from 'react';
import {
  adminListProducts, adminListVariants, adminCreateVariant,
  adminUpdateVariant, adminSetVariantActive, adminDeleteVariant,
} from '../../lib/adminApi.js';
import { money } from '../../lib/format.js';

// ============================================================
// ADMIN — PRODUCT VARIANTS (pack sizes)
//
// Variants are ADDITIVE. A product with no variants keeps selling at its base
// price exactly as it always has; this screen never touches products.* .
// The base price is shown read-only at the top purely as a reference point.
// ============================================================

const UNITS = ['ml', 'g', 'kg', 'l', 'capsules', 'tablets', 'sachets', 'pcs'];

const blank = {
  label: '', size: '', unit: 'ml', sku: '',
  mrp: '', sale_price: '', gst_rate: '', stock: '',
  is_active: true, sort_order: '',
};

// A variant row from the database, shaped for the form's text inputs.
function toForm(v) {
  return {
    label: v.label ?? '',
    size: v.size ?? '',
    unit: v.unit ?? 'ml',
    sku: v.sku ?? '',
    mrp: v.mrp ?? '',
    sale_price: v.sale_price ?? '',
    gst_rate: v.gst_rate ?? '',
    stock: v.stock ?? '',
    is_active: v.is_active !== false,
    sort_order: v.sort_order ?? '',
  };
}

export default function Variants() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [editingId, setEditingId] = useState(null); // null = none, 'new' = add form
  const [form, setForm] = useState(blank);

  useEffect(() => {
    adminListProducts()
      .then((list) => {
        const withDbId = list.filter((p) => p.dbId != null);
        setProducts(withDbId);
        if (withDbId.length) setProductId(String(withDbId[0].dbId));
      })
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  }, []);

  const product = useMemo(
    () => products.find((p) => String(p.dbId) === String(productId)) || null,
    [products, productId],
  );

  async function reload(pid = productId) {
    if (!pid) { setVariants([]); return; }
    try {
      setVariants(await adminListVariants(pid));
      setErr('');
    } catch (e) {
      setErr(e.message || String(e));
      setVariants([]);
    }
  }

  useEffect(() => {
    setEditingId(null);
    reload(productId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  function startAdd() {
    // Pre-fill the sort order after the current last variant so a new size
    // lands at the end of the selector rather than jumping to the front.
    const nextSort = variants.reduce((m, v) => Math.max(m, Number(v.sort_order) || 0), 0) + 1;
    setForm({ ...blank, sort_order: nextSort, mrp: product?.originalPrice ?? '' });
    setEditingId('new');
  }

  function startEdit(v) {
    setForm(toForm(v));
    setEditingId(v.id);
  }

  function flash(text) {
    setMsg(text);
    setTimeout(() => setMsg((m) => (m === text ? '' : m)), 2500);
  }

  async function save(e) {
    e.preventDefault();
    if (!productId) return;
    setBusy(true);
    setErr('');
    try {
      if (editingId === 'new') await adminCreateVariant(productId, form);
      else await adminUpdateVariant(editingId, productId, form);
      setEditingId(null);
      await reload();
      flash('Saved.');
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(v) {
    setBusy(true);
    try {
      await adminSetVariantActive(v.id, v.is_active === false);
      await reload();
    } catch (e) { setErr(e.message || String(e)); } finally { setBusy(false); }
  }

  async function remove(v) {
    const label = v.label || v.sku || `variant ${v.id}`;
    if (!window.confirm(`Delete ${label}? Past orders keep their stored price — only the selector changes.`)) return;
    setBusy(true);
    try {
      await adminDeleteVariant(v.id);
      await reload();
      flash('Variant deleted.');
    } catch (e) { setErr(e.message || String(e)); } finally { setBusy(false); }
  }

  // Live preview of the discount this variant's own numbers imply. Derived for
  // display only — the server recomputes the charge from mrp / sale_price.
  const fMrp = Number(form.mrp) || 0;
  const fPrice = Number(form.sale_price) || 0;
  const fOff = fMrp > 0 && fPrice > 0 && fPrice < fMrp ? Math.round((1 - fPrice / fMrp) * 100) : 0;

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Variants</h1>
          <p>Optional pack sizes with their own MRP and selling price.</p>
        </div>
        {productId && !editingId && (
          <button className="btn" onClick={startAdd} disabled={busy}>Add variant</button>
        )}
      </div>

      {err && <div className="adm-banner err">{err}</div>}
      {msg && <div className="adm-banner ok">{msg}</div>}

      {loading ? (
        <p className="muted">Loading products…</p>
      ) : products.length === 0 ? (
        <div className="adm-empty">No products yet.</div>
      ) : (
        <>
          <div className="surface">
            <div className="field">
              <label className="label" htmlFor="v-product">Product</label>
              <select
                id="v-product"
                className="select"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.dbId} value={p.dbId}>{p.name}</option>
                ))}
              </select>
            </div>

            {product && (
              <p className="hint" style={{ marginTop: 10 }}>
                Base pricing (unchanged by this screen):{' '}
                <span className="adm-price">{money(product.salePrice ?? product.originalPrice)}</span>
                {product.originalPrice > (product.salePrice ?? 0) && (
                  <> · MRP <s>{money(product.originalPrice)}</s></>
                )}
                {' '}· {product.discountPercent}% off. A product with no active variants sells at this price.
              </p>
            )}
          </div>

          {editingId && (
            <form className="surface" onSubmit={save}>
              <h2>{editingId === 'new' ? 'New variant' : 'Edit variant'}</h2>

              <div className="adm-grid2">
                <div className="field">
                  <label className="label">Label (shown to customers)</label>
                  <input
                    className="input" required placeholder="750 ml"
                    value={form.label} onChange={(e) => set('label', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">SKU</label>
                  <input
                    className="input" placeholder="SL-B119-750ML"
                    value={form.sku} onChange={(e) => set('sku', e.target.value)}
                  />
                </div>
              </div>

              <div className="adm-grid2">
                <div className="field">
                  <label className="label">Size</label>
                  <input
                    className="input" type="number" min="0" step="any" placeholder="750"
                    value={form.size} onChange={(e) => set('size', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">Unit</label>
                  <select className="select" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="adm-grid2">
                <div className="field">
                  <label className="label">MRP (₹)</label>
                  <input
                    className="input" type="number" min="0" step="1" required
                    value={form.mrp} onChange={(e) => set('mrp', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">Selling price (₹)</label>
                  <input
                    className="input" type="number" min="0" step="1" required
                    value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)}
                  />
                </div>
              </div>

              {fMrp > 0 && fPrice > 0 && (
                <div className="adm-preview-price">
                  <span className="now">{money(fPrice)}</span>
                  {fOff > 0 && <span className="was">{money(fMrp)}</span>}
                  {fOff > 0 && <span className="off">{fOff}% OFF</span>}
                  <span className="hint">— what this variant will show on the product page</span>
                </div>
              )}
              {fPrice > fMrp && fMrp > 0 && (
                <p className="hint" style={{ color: 'var(--price-mrp)' }}>
                  Selling price is above MRP — customers will see no discount.
                </p>
              )}

              <div className="adm-grid2">
                <div className="field">
                  <label className="label">Stock</label>
                  <input
                    className="input" type="number" min="0" step="1"
                    value={form.stock} onChange={(e) => set('stock', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="label">Sort order</label>
                  <input
                    className="input" type="number" step="1"
                    value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">GST rate (%)</label>
                <input
                  className="input" type="number" min="0" max="28" step="0.01" placeholder="Leave blank to use the store default"
                  value={form.gst_rate} onChange={(e) => set('gst_rate', e.target.value)}
                />
                <p className="hint">Blank means this variant follows the configured store GST rate. No rate is assumed.</p>
              </div>

              <div className="adm-checkrow">
                <input
                  type="checkbox" id="v-active"
                  checked={form.is_active}
                  onChange={(e) => set('is_active', e.target.checked)}
                />
                <label htmlFor="v-active">Active (offered on the product page)</label>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : editingId === 'new' ? 'Create variant' : 'Save changes'}
                </button>
                <button className="btn btn-outline" type="button" onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            </form>
          )}

          {variants.length === 0 ? (
            <div className="adm-empty">
              No variants for this product. It sells at its base price. Add a variant to offer pack sizes.
            </div>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Label</th><th>SKU</th>
                    <th className="adm-items__amt">MRP</th>
                    <th className="adm-items__amt">Price</th>
                    <th className="adm-items__amt">Off</th>
                    <th className="adm-items__qty">Stock</th>
                    <th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => {
                    const mrp = Number(v.mrp) || 0;
                    const price = Number(v.sale_price) || 0;
                    const off = mrp > 0 && price > 0 && price < mrp ? Math.round((1 - price / mrp) * 100) : 0;
                    return (
                      <tr key={v.id} className={v.is_active === false ? 'is-muted' : ''}>
                        <td>
                          <strong>{v.label}</strong>
                          {v.size != null && <span className="hint" style={{ display: 'block' }}>{v.size} {v.unit}</span>}
                        </td>
                        <td className="adm-mono">{v.sku || '—'}</td>
                        <td className="adm-items__amt">{mrp ? <s>{money(mrp)}</s> : '—'}</td>
                        <td className="adm-items__amt adm-price">{price ? money(price) : '—'}</td>
                        <td className="adm-items__amt">{off ? `${off}%` : '—'}</td>
                        <td className="adm-items__qty">{v.stock ?? '—'}</td>
                        <td>
                          <span className={`badge ${v.is_active === false ? 'badge-out' : 'badge-best'}`}>
                            {v.is_active === false ? 'Inactive' : 'Active'}
                          </span>
                        </td>
                        <td>
                          <div className="adm-rowacts">
                            <button className="btn btn-sm btn-light" onClick={() => startEdit(v)} disabled={busy}>Edit</button>
                            <button className="btn btn-sm btn-light" onClick={() => toggleActive(v)} disabled={busy}>
                              {v.is_active === false ? 'Activate' : 'Deactivate'}
                            </button>
                            <button className="btn btn-sm btn-light" onClick={() => remove(v)} disabled={busy}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
