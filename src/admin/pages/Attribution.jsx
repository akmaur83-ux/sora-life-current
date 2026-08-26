import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { money2 } from '../../lib/format.js';
import {
  adminListConversions, adminListCreators, adminGetConversionItems,
  adminGetConversionAudit, adminRefundConversion, CONVERSION_STATUSES,
} from '../../lib/creatorApi.js';

// ============================================================
// ADMIN — Creator Program › Attribution / Sales
//
// Every attributed order, at product/variant granularity, with the eligible
// (commissionable) sales base. This is Part 2: NO commission, NO earnings —
// only the base and its status. Refund/return adjusts the eligible base and
// is written to an immutable audit trail.
// ============================================================

const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN') : '—');
const STATUS_BADGE = {
  eligible: 'badge-best', pending: 'badge-soft', cancelled: 'badge-out',
  refunded: 'badge-sale', reversed: 'badge-out', self_referral: 'badge-soft',
};

export default function Attribution() {
  const [rows, setRows] = useState([]);
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState({ creatorId: '', status: 'all' });
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState({ items: [], audit: [] });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [convs, crs] = await Promise.all([
        adminListConversions({ creatorId: filter.creatorId || undefined, status: filter.status }),
        creators.length ? Promise.resolve(creators) : adminListCreators(),
      ]);
      setRows(convs);
      if (!creators.length) setCreators(crs);
      setErr('');
    } catch (e) {
      setErr(e.message || String(e));
    } finally { setLoading(false); }
  }, [filter, creators]);

  useEffect(() => { load(); }, [load]);

  function flash(t) { setMsg(t); setTimeout(() => setMsg((m) => (m === t ? '' : m)), 2500); }

  async function toggle(row) {
    if (expanded === row.id) { setExpanded(null); return; }
    setExpanded(row.id);
    try {
      const [items, audit] = await Promise.all([
        adminGetConversionItems(row.id), adminGetConversionAudit(row.id),
      ]);
      setDetail({ items, audit });
    } catch (e) { setErr(e.message || String(e)); }
  }

  async function refund(row) {
    const input = window.prompt(`Refund amount to reverse from eligible sales for ${row.order_number}?\nCurrent eligible: ${money2(row.eligible_sales)}`, '');
    if (input == null) return;
    const amt = Number(input);
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Enter a positive refund amount.'); return; }
    setBusy(true);
    try {
      await adminRefundConversion(row.order_id, amt, 'admin_refund');
      await load();
      flash('Refund recorded; eligible sales adjusted.');
    } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  const totalEligible = rows.filter((r) => r.status === 'eligible').reduce((s, r) => s + Number(r.eligible_sales || 0), 0);

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Attribution &amp; Sales</h1>
          <p>{loading ? 'Loading…' : `${rows.length} conversions · ${money2(totalEligible)} eligible (Part 2 — no commission calculated)`}</p>
        </div>
      </div>

      {err && <div className="adm-banner err">{err}</div>}
      {msg && <div className="adm-banner ok">{msg}</div>}

      <div className="surface" style={{ paddingBlock: 12 }}>
        <div className="adm-grid2">
          <div className="field" style={{ margin: 0 }}>
            <label className="label">Creator</label>
            <select className="select" value={filter.creatorId} onChange={(e) => setFilter((f) => ({ ...f, creatorId: e.target.value }))}>
              <option value="">All creators</option>
              {creators.map((c) => <option key={c.id} value={c.id}>{c.display_name} ({c.creator_code})</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label">Status</label>
            <select className="select" value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
              <option value="all">All statuses</option>
              {CONVERSION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading conversions…</p>
      ) : rows.length === 0 ? (
        <div className="adm-empty">No attributed conversions yet. They appear when an order is placed through a creator's tracking link.</div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Order</th><th>Creator</th><th>Campaign</th><th>Link</th>
                <th className="adm-items__amt">Eligible</th><th>Status</th><th>Attributed</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <>
                  <tr key={r.id} className={expanded === r.id ? 'adm-order-row--open' : ''}>
                    <td>
                      <Link to={`/invoice/${r.order_number}`} className="adm-mono adm-link">{r.order_number}</Link>
                    </td>
                    <td>{r.creator?.display_name}<span className="hint" style={{ display: 'block' }}>{r.creator?.creator_code}</span></td>
                    <td>{r.campaign?.campaign_code || '—'}</td>
                    <td className="adm-mono">{r.link?.public_code || '—'}</td>
                    <td className="adm-items__amt">
                      <span className="adm-price">{money2(r.eligible_sales)}</span>
                      {Number(r.refunded_amount) > 0 && <span className="hint" style={{ display: 'block' }}>−{money2(r.refunded_amount)} refunded</span>}
                    </td>
                    <td><span className={`badge ${STATUS_BADGE[r.status] || 'badge-soft'}`}>{r.status}</span></td>
                    <td>{fmtDateTime(r.attributed_at)}</td>
                    <td>
                      <div className="adm-rowacts">
                        <button className="btn btn-sm btn-light" onClick={() => toggle(r)}>{expanded === r.id ? 'Hide' : 'Items'}</button>
                        {(r.status === 'eligible' || r.status === 'pending') && (
                          <button className="btn btn-sm btn-light" onClick={() => refund(r)} disabled={busy}>Refund</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === r.id && (
                    <tr className="adm-order-detail">
                      <td colSpan={8}>
                        <div className="adm-order-detail__grid">
                          <section className="adm-order-block adm-order-block--wide">
                            <h3>Items (product / variant level)</h3>
                            <table className="adm-items">
                              <thead><tr><th>Product</th><th>Variant</th><th className="adm-items__qty">Qty</th><th className="adm-items__amt">Line</th><th className="adm-items__amt">Eligible</th></tr></thead>
                              <tbody>
                                {detail.items.map((it) => (
                                  <tr key={it.id}>
                                    <td>{it.product_name_snapshot}<span className="hint" style={{ display: 'block' }}>{it.product_id}</span></td>
                                    <td>{it.variant_label_snapshot || '—'}</td>
                                    <td className="adm-items__qty">× {it.quantity}</td>
                                    <td className="adm-items__amt">{money2(it.line_amount)}</td>
                                    <td className="adm-items__amt adm-price">{money2(it.eligible_amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </section>
                          <section className="adm-order-block">
                            <h3>Eligible-sales breakdown</h3>
                            <dl className="adm-kv">
                              <div><dt>Gross item sales</dt><dd>{money2(r.gross_item_sales)}</dd></div>
                              <div><dt>Discounts</dt><dd>−{money2(r.discounts)}</dd></div>
                              <div><dt>Tax (excluded)</dt><dd>{money2(r.tax)}</dd></div>
                              <div><dt>Shipping (excluded)</dt><dd>{money2(r.shipping)}</dd></div>
                              <div><dt>Refunded</dt><dd>−{money2(r.refunded_amount)}</dd></div>
                              <div><dt><strong>Eligible base</strong></dt><dd><strong className="adm-price">{money2(r.eligible_sales)}</strong></dd></div>
                            </dl>
                          </section>
                          <section className="adm-order-block">
                            <h3>Attribution</h3>
                            <dl className="adm-kv">
                              <div><dt>Matched code</dt><dd className="adm-mono">{r.matched_code || '—'}</dd></div>
                              <div><dt>Model</dt><dd>last-click</dd></div>
                              <div><dt>Qualified</dt><dd>{fmtDateTime(r.qualified_at)}</dd></div>
                            </dl>
                          </section>
                          <section className="adm-order-block adm-order-block--wide">
                            <h3>Audit trail</h3>
                            <ol className="adm-timeline">
                              {detail.audit.map((a) => (
                                <li key={a.id}>
                                  <span className="adm-timeline__label">{(a.from_status || '∅')} → {a.to_status} {a.reason ? `· ${a.reason}` : ''}</span>
                                  <span className="adm-timeline__at">{fmtDateTime(a.created_at)}{a.eligible_delta ? ` · Δ ${money2(a.eligible_delta)}` : ''}</span>
                                </li>
                              ))}
                            </ol>
                          </section>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
