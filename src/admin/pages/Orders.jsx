import { useEffect, useState } from 'react';
import { adminListOrders } from '../../lib/adminApi.js';
import { money } from '../../lib/format.js';

const STATUS_BADGE = {
  paid: 'badge-best',
  pending: 'badge-soft',
  failed: 'badge-sale',
  cancelled: 'badge-out',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    adminListOrders()
      .then(setOrders)
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  }, []);

  const paidCount = orders.filter((o) => o.payment_status === 'paid').length;

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
                <th>Order</th><th>Placed</th><th>Customer</th><th>Amount</th><th>Method</th><th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.order_number}</strong>
                    {o.razorpay_payment_id && <span className="hint" style={{ display: 'block' }}>{o.razorpay_payment_id}</span>}
                  </td>
                  <td>{new Date(o.created_at).toLocaleString('en-IN')}</td>
                  <td>
                    {[o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || '—'}
                    {o.customer?.email && <span className="hint" style={{ display: 'block' }}>{o.customer.email}</span>}
                  </td>
                  <td><strong>{money((o.amount_paise || 0) / 100)}</strong></td>
                  <td>{o.payment_method === 'cod' ? 'Cash on delivery' : 'Razorpay'}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[o.payment_status] || 'badge-soft'}`}>
                      {o.payment_status}
                    </span>
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
