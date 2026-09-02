import { useEffect, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { adminListOrders, adminUpdateOrderFulfillment } from '../../lib/adminApi.js';
import { money } from '../../lib/format.js';
import { FULFILLMENT_STATUSES, fulfillmentStatusLabel, validateFulfillmentInput } from '../../lib/orderFulfillment.js';

const STATUS_BADGE = {
  paid: 'badge-best',
  pending: 'badge-soft',
  failed: 'badge-sale',
  cancelled: 'badge-out',
};

const FULFILLMENT_BADGE = {
  shipped: 'badge-soft',
  delivered: 'badge-best',
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

const dt = (iso) => (iso ? new Date(iso).toLocaleString('en-IN') : null);

// The audit trail an order can prove from its own columns. Steps with no
// timestamp are not shown — nothing here is inferred or back-dated.
function timeline(o) {
  const steps = [
    ['Order placed', o.created_at],
    ['Payment received', o.paid_at],
    ['Invoice generated', o.invoiced_at],
    ['Shipped', o.shipped_at],
    ['Delivered', o.delivered_at],
    ['Cancelled', o.cancelled_at],
  ];
  return steps.filter(([, at]) => Boolean(at)).map(([label, at]) => [label, dt(at)]);
}

// One row of the money breakdown. Rendered only when the order genuinely
// carries the figure, so a zero is never mistaken for a real charge.
function Money({ label, value, tone, strong }) {
  return (
    <div className={`adm-bill__row${tone ? ` is-${tone}` : ''}${strong ? ' is-strong' : ''}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
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

  function updateOrder(patch) {
    setOrders((current) => current.map((order) => (order.id === patch.id ? { ...order, ...patch } : order)));
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
                <th>Order</th><th>Placed</th><th>Customer</th><th>Amount</th><th>Method</th><th>Payment</th><th>Fulfillment</th><th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const c = o.customer || {};
                const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
                const open = expandedId === o.id;
                const b = o.billing && typeof o.billing === 'object' ? o.billing : null;
                const tax = b?.tax || null;
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
                        <span className={`badge ${FULFILLMENT_BADGE[o.fulfillment_status] || 'badge-soft'}`}>
                          {fulfillmentStatusLabel(o.fulfillment_status) || 'Not set'}
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
                        <td colSpan={8}>
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

                            {/* Order + payment meta */}
                            <section className="adm-order-block">
                              <h3>Order &amp; payment</h3>
                              <dl className="adm-kv">
                                <div><dt>Order ID</dt><dd>{o.order_number}</dd></div>
                                {o.invoice_number && <div><dt>Invoice no.</dt><dd>{o.invoice_number}</dd></div>}
                                <div><dt>Placed</dt><dd>{dt(o.created_at)}</dd></div>
                                <div><dt>Method</dt><dd>{o.payment_method === 'cod' ? 'Cash on delivery' : 'Razorpay'}</dd></div>
                                <div>
                                  <dt>Payment</dt>
                                  <dd><span className={`badge ${STATUS_BADGE[o.payment_status] || 'badge-soft'}`}>{o.payment_status}</span></dd>
                                </div>
                                <div><dt>Delivery</dt><dd>{o.delivery_method || '—'}</dd></div>
                                {/* Transaction ids exist only for a real gateway payment. COD
                                    and unpaid orders show nothing rather than a stand-in. */}
                                {o.razorpay_payment_id && (
                                  <div><dt>Transaction ID</dt><dd className="adm-mono">{o.razorpay_payment_id}</dd></div>
                                )}
                                {o.razorpay_order_id && (
                                  <div><dt>Gateway order</dt><dd className="adm-mono">{o.razorpay_order_id}</dd></div>
                                )}
                                {o.failure_reason && <div><dt>Failure</dt><dd>{o.failure_reason}</dd></div>}
                              </dl>
                              <Link to={`/invoice/${o.order_number}`} className="btn btn-sm" style={{ marginTop: 10 }}>
                                Open invoice
                              </Link>
                            </section>

                            <FulfillmentEditor order={o} onUpdated={updateOrder} />

                            {/* Timeline */}
                            {timeline(o).length > 0 && (
                              <section className="adm-order-block">
                                <h3>Timeline</h3>
                                <ol className="adm-timeline">
                                  {timeline(o).map(([label, when]) => (
                                    <li key={label}>
                                      <span className="adm-timeline__label">{label}</span>
                                      <span className="adm-timeline__at">{when}</span>
                                    </li>
                                  ))}
                                </ol>
                              </section>
                            )}

                            {/* Items */}
                            <section className="adm-order-block adm-order-block--wide">
                              <h3>Items</h3>
                              {Array.isArray(o.items) && o.items.length ? (
                                <table className="adm-items">
                                  <thead>
                                    <tr>
                                      <th>Product</th><th>Variant</th>
                                      <th className="adm-items__amt">MRP</th>
                                      <th className="adm-items__amt">Price</th>
                                      <th className="adm-items__qty">Qty</th>
                                      <th className="adm-items__amt">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {o.items.map((it, i) => {
                                      const unit = Number(it.unit_price) || 0;
                                      const mrp = Number(it.unit_mrp) || 0;
                                      return (
                                        <tr key={i}>
                                          <td>
                                            {it.name || it.product_id}
                                            {it.sku && <span className="hint" style={{ display: 'block' }}>{it.sku}</span>}
                                          </td>
                                          <td>{it.variant || '—'}</td>
                                          <td className="adm-items__amt">{mrp > unit ? <s>{money(mrp)}</s> : '—'}</td>
                                          <td className="adm-items__amt adm-price">{money(unit)}</td>
                                          <td className="adm-items__qty">× {it.qty}</td>
                                          <td className="adm-items__amt">{money(Number(it.line_total ?? unit * it.qty) || 0)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="muted">No item detail stored for this order.</p>
                              )}
                            </section>

                            {/* Money breakdown — straight from the server-computed billing
                                snapshot stored at checkout. Nothing is recalculated here. */}
                            <section className="adm-order-block adm-order-block--wide">
                              <h3>Billing breakdown</h3>
                              <div className="adm-bill">
                                {b ? (
                                  <>
                                    {b.mrpTotal > b.itemTotal && <Money label="MRP total" value={money(b.mrpTotal)} tone="mrp" />}
                                    <Money label="Item total" value={money(b.itemTotal)} />
                                    {b.productDiscount > 0 && (
                                      <Money label="Product discount" value={`-${money(b.productDiscount)}`} tone="save" />
                                    )}
                                    {b.couponDiscount > 0 && (
                                      <Money
                                        label={`Coupon discount${b.coupon?.code ? ` (${b.coupon.code})` : ''}`}
                                        value={`-${money(b.couponDiscount)}`}
                                        tone="save"
                                      />
                                    )}
                                    <Money label="Subtotal" value={money(b.subtotal)} />
                                    <Money label="Shipping" value={b.shipping > 0 ? money(b.shipping) : 'FREE'} />
                                    {b.platformFee > 0 && <Money label="Platform fee" value={money(b.platformFee)} />}
                                    {b.packagingFee > 0 && <Money label="Packaging fee" value={money(b.packagingFee)} />}
                                    {tax && (
                                      <>
                                        <Money label="Taxable amount" value={money(tax.taxableAmount)} />
                                        {tax.kind === 'cgst_sgst' ? (
                                          <>
                                            <Money label="CGST" value={money(tax.cgst)} />
                                            <Money label="SGST" value={money(tax.sgst)} />
                                          </>
                                        ) : tax.kind === 'igst' ? (
                                          <Money label="IGST" value={money(tax.igst)} />
                                        ) : (
                                          <Money label="GST" value={money(tax.totalTax)} />
                                        )}
                                      </>
                                    )}
                                  </>
                                ) : (
                                  <p className="muted">
                                    This order predates the stored billing breakdown. Only the charged total is on record.
                                  </p>
                                )}
                                <Money label="Grand total" value={money((o.amount_paise || 0) / 100)} strong />
                                {tax?.mode === 'inclusive' && <p className="hint">Inclusive of all taxes.</p>}
                              </div>
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

function FulfillmentEditor({ order, onUpdated }) {
  const [form, setForm] = useState(() => ({
    fulfillmentStatus: order.fulfillment_status || '',
    carrierName: order.carrier_name || '',
    trackingNumber: order.tracking_number || '',
    trackingUrl: order.tracking_url || '',
  }));
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({
      fulfillmentStatus: order.fulfillment_status || '',
      carrierName: order.carrier_name || '',
      trackingNumber: order.tracking_number || '',
      trackingUrl: order.tracking_url || '',
    });
  }, [order.id, order.fulfillment_status, order.carrier_name, order.tracking_number, order.tracking_url]);

  const field = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function save(action = 'save') {
    if (busy) return;
    setBusy(action); setMessage(''); setError('');
    try {
      const safe = validateFulfillmentInput(form);
      const updated = await adminUpdateOrderFulfillment(order.id, safe, {
        markShipped: action === 'shipped',
        markDelivered: action === 'delivered',
      });
      onUpdated(updated);
      setMessage(action === 'save' ? 'Fulfillment details saved.' : action === 'shipped' ? 'Order marked shipped.' : 'Order marked delivered.');
    } catch (err) {
      setError(err?.message || 'Fulfillment details could not be saved.');
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="adm-order-block adm-order-block--wide adm-fulfillment">
      <h3>Fulfillment &amp; tracking</h3>
      <p className="hint">Enter only details supplied by the carrier. A customer tracking link appears only for an explicit public HTTPS URL.</p>
      <div className="adm-grid2 adm-fulfillment__fields">
        <div className="field">
          <label className="label" htmlFor={`fulfillment-status-${order.id}`}>Fulfillment status</label>
          <select id={`fulfillment-status-${order.id}`} className="select" value={form.fulfillmentStatus} onChange={field('fulfillmentStatus')}>
            <option value="">Not set</option>
            {FULFILLMENT_STATUSES.map((status) => <option key={status} value={status}>{fulfillmentStatusLabel(status)}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor={`carrier-${order.id}`}>Carrier</label>
          <input id={`carrier-${order.id}`} className="input" maxLength={120} value={form.carrierName} onChange={field('carrierName')} placeholder="Carrier name" />
        </div>
        <div className="field">
          <label className="label" htmlFor={`tracking-number-${order.id}`}>Tracking number</label>
          <input id={`tracking-number-${order.id}`} className="input" maxLength={160} value={form.trackingNumber} onChange={field('trackingNumber')} placeholder="Carrier-issued number" />
        </div>
        <div className="field">
          <label className="label" htmlFor={`tracking-url-${order.id}`}>Tracking URL</label>
          <input id={`tracking-url-${order.id}`} className="input" type="url" inputMode="url" maxLength={2048} value={form.trackingUrl} onChange={field('trackingUrl')} placeholder="https://carrier.example/track/…" />
        </div>
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
      {message && <p className="adm-fulfillment__success" role="status">{message}</p>}
      <div className="adm-fulfillment__actions">
        <button type="button" className="btn btn-sm" disabled={Boolean(busy)} onClick={() => save('save')}>{busy === 'save' ? 'Saving…' : 'Save details'}</button>
        <button type="button" className="btn btn-sm btn-light" disabled={Boolean(busy)} onClick={() => save('shipped')}>{busy === 'shipped' ? 'Saving…' : 'Mark shipped'}</button>
        <button type="button" className="btn btn-sm btn-light" disabled={Boolean(busy)} onClick={() => save('delivered')}>{busy === 'delivered' ? 'Saving…' : 'Mark delivered'}</button>
      </div>
    </section>
  );
}
