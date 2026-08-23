import { useEffect, useState, Fragment } from 'react';
import { adminListOrders } from '../../lib/adminApi.js';
import { money } from '../../lib/format.js';

const STATUS_BADGE = {
  paid: 'badge-best',
  pending: 'badge-soft',
  failed: 'badge-sale',
  cancelled: 'badge-out',
};

// Build a clean, multi-line postal address from whatever fields an order
// actually has. Works for old orders created before some fields existed —
// missing pieces are simply skipped.
function formatAddress(c = {}) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  const cityLine = [c.city, c.state].filter(Boolean).join(', ');
  const cityPin = [cityLine, c.pin].filter(Boolean).join(' - ');
  return [
    name,
    c.address,
    c.apartment,
    c.landmark && `Landmark: ${c.landmark}`,
    cityPin,
    c.phone && `Phone: ${c.phone}`,
  ].filter(Boolean).join('\n');
}

function hasAddress(c = {}) {
  return Boolean(c.address || c.city || c.pin);
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    adminListOrders()
      .then(setOrders)
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  }, []);

  const paidCount = orders.filter((o) => o.payment_status === 'paid').length;

  async function copyAddress(order) {
    const text = formatAddress(order.customer);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can be unavailable (insecure context) — fall back.
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopiedId(order.id);
    setTimeout(() => setCopiedId((c) => (c === order.id ? null : c)), 1600);
  }

  return (
    <div>
      <div className="adm__head">
        <div>
          <h1>Orders</h1>
          <p>{loading ? 'Loading…' : `${orders.length} orders · ${paidCount} paid`}</p>
        </div>
      </div>

      {err && (
        <div className="adm-banner err">
          {err}
          <div style={{ marginTop: 8, fontSize: 12 }}>
            If the orders table does not exist yet, run
            <code> supabase/migrations/0003_orders.sql </code> in the Supabase SQL editor.
          </div>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="adm-empty">No orders yet. Orders appear here once a customer completes checkout.</div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Order</th><th>Placed</th><th>Customer</th><th>Amount</th><th>Method</th><th>Payment</th><th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const c = o.customer || {};
                const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
                const open = expandedId === o.id;
                return (
                  <Fragment key={o.id}>
                    <tr className={open ? 'adm-order-row--open' : ''}>
                      <td>
                        <strong>{o.order_number}</strong>
                        {o.razorpay_payment_id && <span className="hint" style={{ display: 'block' }}>{o.razorpay_payment_id}</span>}
                      </td>
                      <td>{new Date(o.created_at).toLocaleString('en-IN')}</td>
                      <td>
                        {name}
                        {c.email && <span className="hint" style={{ display: 'block' }}>{c.email}</span>}
                      </td>
                      <td><strong>{money((o.amount_paise || 0) / 100)}</strong></td>
                      <td>{o.payment_method === 'cod' ? 'Cash on delivery' : 'Razorpay'}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[o.payment_status] || 'badge-soft'}`}>
                          {o.payment_status}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-light" onClick={() => setExpandedId(open ? null : o.id)}>
                          {open ? 'Hide' : 'View details'}
                        </button>
                      </td>
                    </tr>

                    {open && (
                      <tr className="adm-order-detail">
                        <td colSpan={7}>
                          <div className="adm-order-detail__grid">
                            {/* Delivery / shipping */}
                            <section className="adm-order-block">
                              <div className="adm-order-block__head">
                                <h3>Delivery address</h3>
                                {hasAddress(c) && (
                                  <button className="btn btn-sm btn-light" onClick={() => copyAddress(o)}>
                                    {copiedId === o.id ? 'Copied ✓' : 'Copy address'}
                                  </button>
                                )}
                              </div>
                              {hasAddress(c) ? (
                                <address className="adm-address">{formatAddress(c)}</address>
                              ) : (
                                <p className="muted">No delivery address was recorded for this order.</p>
                              )}
                            </section>

                            {/* Contact */}
                            <section className="adm-order-block">
                              <h3>Contact</h3>
                              <dl className="adm-kv">
                                <div><dt>Name</dt><dd>{name}</dd></div>
                                <div><dt>Phone</dt><dd>{c.phone || '—'}</dd></div>
                                <div><dt>Email</dt><dd>{c.email || '—'}</dd></div>
                              </dl>
                            </section>

                            {/* Order meta */}
                            <section className="adm-order-block">
                              <h3>Order</h3>
                              <dl className="adm-kv">
                                <div><dt>Order ID</dt><dd>{o.order_number}</dd></div>
                                <div><dt>Placed</dt><dd>{new Date(o.created_at).toLocaleString('en-IN')}</dd></div>
                                <div><dt>Method</dt><dd>{o.payment_method === 'cod' ? 'Cash on delivery' : 'Razorpay'}</dd></div>
                                <div><dt>Payment</dt><dd>{o.payment_status}</dd></div>
                                <div><dt>Delivery</dt><dd>{o.delivery_method || '—'}</dd></div>
                                {o.razorpay_payment_id && <div><dt>Razorpay payment</dt><dd>{o.razorpay_payment_id}</dd></div>}
                              </dl>
                            </section>

                            {/* Items */}
                            <section className="adm-order-block adm-order-block--wide">
                              <h3>Items</h3>
                              {Array.isArray(o.items) && o.items.length ? (
                                <table className="adm-items">
                                  <tbody>
                                    {o.items.map((it, i) => (
                                      <tr key={i}>
                                        <td>{it.name || it.product_id}{it.variant ? ` · ${it.variant}` : ''}</td>
                                        <td className="adm-items__qty">× {it.qty}</td>
                                        <td className="adm-items__amt">{money(Number(it.line_total ?? (it.unit_price * it.qty)) || 0)}</td>
                                      </tr>
                                    ))}
                                    <tr className="adm-items__total">
                                      <td>Total</td><td></td>
                                      <td className="adm-items__amt">{money((o.amount_paise || 0) / 100)}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              ) : (
                                <p className="muted">No item detail stored for this order.</p>
                              )}
                            </section>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
