import { useEffect, useState } from 'react';
import { adminListProducts, adminUpdateProductPrice } from '../../lib/adminApi.js';
import { money } from '../../lib/format.js';

const TIERS = [10, 15, 18, 20];

export default function Pricing() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    adminListProducts().then(setProducts).catch((e) => setErr(e.message || String(e))).finally(() => setLoading(false));
  }, []);

  const editFor = (p) => edits[p.dbId] || { originalPrice: p.originalPrice, discountPercent: p.discountPercent };
  const setEdit = (p, patch) => setEdits((e) => ({ ...e, [p.dbId]: { ...editFor(p), ...patch } }));

  async function save(p) {
    const v = editFor(p);
    setSavingId(p.dbId);
    try {
      // The price columns only, refused if the product moved since this page
      // loaded it. Saving the whole row from that load used to write back its
      // stale name, description, image, stock flag and active state.
      const saved = await adminUpdateProductPrice(p.dbId, { originalPrice: v.originalPrice, discountPercent: v.discountPercent }, p.updatedAt);
      setProducts((list) => list.map((x) => (x.dbId === p.dbId ? saved : x)));
      setEdits((e) => { const n = { ...e }; delete n[p.dbId]; return n; });
    } catch (ex) {
      setErr(ex.message || String(ex));
      // Changed elsewhere: reload the list so the next Save is checked
      // against the current version. Unsaved price edits are kept.
      if (ex.isStaleWrite) { try { setProducts(await adminListProducts()); } catch { /* the message already says to reload */ } }
    }
    setSavingId(null);
  }

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Pricing</h1>
          <p>Bulk-edit MRP and promotional discounts. Sale price is calculated automatically.</p>
        </div>
      </div>
      {err && <div className="adm-banner err">{err}</div>}
      {loading ? <p className="muted">Loading…</p> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Product</th><th>MRP (₹)</th><th>Discount</th><th>Sale price</th><th></th></tr></thead>
            <tbody>
              {products.map((p) => {
                const v = editFor(p);
                const dirty = !!edits[p.dbId];
                const sale = Math.round((Number(v.originalPrice) || 0) * (1 - (Number(v.discountPercent) || 0) / 100));
                return (
                  <tr key={p.dbId}>
                    <td>
                      <div className="adm-row-name">
                        <span className="adm-thumb">{p.image && <img src={p.image} alt="" />}</span>
                        <strong>{p.name}</strong>
                      </div>
                    </td>
                    <td><input className="input" style={{ width: 110 }} type="number" min="0" value={v.originalPrice} onChange={(e) => setEdit(p, { originalPrice: e.target.value })} /></td>
                    <td>
                      <select className="select" style={{ width: 130 }} value={v.discountPercent} onChange={(e) => setEdit(p, { discountPercent: Number(e.target.value) })}>
                        <option value={0}>No discount</option>
                        {TIERS.map((t) => <option key={t} value={t}>{t}%</option>)}
                        {!TIERS.includes(Number(v.discountPercent)) && Number(v.discountPercent) !== 0 && <option value={v.discountPercent}>{v.discountPercent}% (custom)</option>}
                      </select>
                    </td>
                    <td><strong>{money(sale)}</strong></td>
                    <td>
                      <button className="btn btn-sm" disabled={!dirty || savingId === p.dbId} onClick={() => save(p)}>
                        {savingId === p.dbId ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
