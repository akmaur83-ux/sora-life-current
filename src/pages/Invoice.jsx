import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useCustomerAuth } from '../lib/customerAuth.jsx';
import { money } from '../lib/format.js';

// ============================================================
// CUSTOMER INVOICE / RECEIPT
//
// Reads ONE real order and renders it as a tax invoice. Every figure comes
// from the row the server wrote at checkout — nothing is recomputed here and
// nothing is invented. Rows the order has no data for are simply omitted
// rather than printed as zero.
//
// Security: the query carries no user filter. The "orders customer read" RLS
// policy restricts it to `user_id = auth.uid()`, so requesting another
// customer's order number returns no row. A guest (no session) matches
// nothing at all.
// ============================================================

const fmtDateTime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d);
};

function Row({ label, value, tone, strong, note }) {
  return (
    <div className={`inv__row ${tone ? `inv__row--${tone}` : ''} ${strong ? 'is-strong' : ''}`}>
      <span className="inv__row-label">{label}{note && <em>{note}</em>}</span>
      <span className="inv__row-value">{value}</span>
    </div>
  );
}

function addressLines(a) {
  if (!a || typeof a !== 'object') return [];
  const name = [a.firstName, a.lastName].filter(Boolean).join(' ');
  const cityLine = [a.city, a.state].filter(Boolean).join(', ');
  const cityPin = [cityLine, a.pin].filter(Boolean).join(' - ');
  return [name, a.address, a.apartment, a.landmark, cityPin].filter(Boolean);
}

export default function Invoice() {
  const { orderNumber } = useParams();
  const { session, loading: authLoading } = useCustomerAuth();
  const [order, setOrder] = useState(undefined); // undefined = loading
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!session) { setOrder(null); return; }
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('orders')
        .select('*')
        .eq('order_number', orderNumber)
        .maybeSingle();
      if (cancelled) return;
      if (err) { setError('We could not load this invoice right now.'); setOrder(null); return; }
      setOrder(data || null);
    })();
    return () => { cancelled = true; };
  }, [orderNumber, session, authLoading]);

  if (authLoading || order === undefined) {
    return <Shell><p className="muted">Loading your invoice…</p></Shell>;
  }

  if (!session) {
    return (
      <Shell>
        <h1 className="serif inv__empty-h">Sign in to view this invoice</h1>
        <p className="muted">Invoices are only available to the account that placed the order.</p>
        <Link to="/account" className="btn" style={{ marginTop: 'var(--sp-5)' }}>Go to my account</Link>
      </Shell>
    );
  }

  if (!order) {
    return (
      <Shell>
        <h1 className="serif inv__empty-h">Invoice not found</h1>
        <p className="muted">{error || "We couldn't find that order on your account."}</p>
        <Link to="/account/orders" className="btn" style={{ marginTop: 'var(--sp-5)' }}>Back to my orders</Link>
      </Shell>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];
  // `billing` is the server-computed breakdown stored at checkout. Older
  // orders predate it, so every section below degrades gracefully.
  const b = order.billing && typeof order.billing === 'object' ? order.billing : null;
  const tax = b?.tax || null;
  const cust = order.customer || {};
  const billTo = order.billing_address || cust;
  const paid = order.payment_status === 'paid';
  const isCod = order.payment_method === 'cod';
  const currency = '₹';

  const grandTotal = b?.grandTotal ?? (Number(order.amount_paise) || 0) / 100;

  const taxRows = [];
  if (tax) {
    if (tax.kind === 'cgst_sgst') taxRows.push(['CGST', tax.cgst], ['SGST', tax.sgst]);
    else if (tax.kind === 'igst') taxRows.push(['IGST', tax.igst]);
    else taxRows.push(['GST', tax.totalTax]);
  }

  return (
    <div className="inv-page">
      <div className="container inv__toolbar no-print">
        <Link to="/account/orders" className="inv__back"><Icon name="chevronLeft" size={16} /> My orders</Link>
        <div className="inv__toolbar-actions">
          <Link to={`/passport/${order.order_number}`} className="btn btn-sm btn-light btn-goldhover">
            <Icon name="package" size={15} /> View Passport
          </Link>
          <button className="btn btn-sm" onClick={() => window.print()}>
            <Icon name="download" size={15} /> Download / Print
          </button>
        </div>
      </div>

      <article className="container inv">
        <header className="inv__head">
          <div className="inv__brand">
            <img src="/assets/sora-life-logo.png" alt="SORA LIFE — Health and Wellness" className="inv__logo" width="1153" height="380" />
            <p className="inv__brand-sub">Health &amp; Wellness</p>
          </div>
          <div className="inv__ident">
            <h1 className="serif inv__title">Tax Invoice</h1>
            <dl className="inv__idlist">
              {order.invoice_number && (
                <div><dt>Invoice No.</dt><dd>{order.invoice_number}</dd></div>
              )}
              <div><dt>Order ID</dt><dd>{order.order_number}</dd></div>
              <div><dt>Order Date</dt><dd>{fmtDateTime(order.created_at)}</dd></div>
              {order.invoiced_at && order.invoiced_at !== order.created_at && (
                <div><dt>Invoice Date</dt><dd>{fmtDateTime(order.invoiced_at)}</dd></div>
              )}
            </dl>
          </div>
        </header>

        <section className="inv__parties">
          <div className="inv__party">
            <h2 className="inv__party-h">Billed To</h2>
            {addressLines(billTo).map((l, i) => <p key={i}>{l}</p>)}
            {cust.phone && <p className="inv__contact">{cust.phone}</p>}
            {cust.email && <p className="inv__contact">{cust.email}</p>}
          </div>
          <div className="inv__party">
            <h2 className="inv__party-h">Shipped To</h2>
            {addressLines(cust).map((l, i) => <p key={i}>{l}</p>)}
            {order.delivery_method && (
              <p className="inv__contact">Delivery: {order.delivery_method}</p>
            )}
          </div>
        </section>

        <section className="inv__items">
          <table className="inv__table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">MRP</th>
                <th className="num">Price</th>
                <th className="num">Qty</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l, i) => {
                const unit = Number(l.unit_price) || 0;
                const unitMrp = Number(l.unit_mrp) || unit;
                const qty = Number(l.qty) || 0;
                const lineTotal = Number(l.line_total) || unit * qty;
                return (
                  <tr key={`${l.product_id}-${l.variant_id || i}`}>
                    <td>
                      <span className="inv__item-name">{l.name}</span>
                      {l.variant && <span className="inv__item-variant">{l.variant}</span>}
                      {l.sku && <span className="inv__item-sku">SKU {l.sku}</span>}
                      {Number.isFinite(Number(l.gst_rate)) && Number(l.gst_rate) > 0 && (
                        <span className="inv__item-sku">GST {l.gst_rate}%</span>
                      )}
                    </td>
                    <td className="num">{unitMrp > unit ? <s>{money(unitMrp, currency)}</s> : '—'}</td>
                    <td className="num inv__price">{money(unit, currency)}</td>
                    <td className="num">{qty}</td>
                    <td className="num inv__amount">{money(lineTotal, currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="inv__totals">
          <div className="inv__totals-inner">
            {b ? (
              <>
                {b.mrpTotal > b.itemTotal && <Row label="MRP Total" value={money(b.mrpTotal, currency)} tone="mrp" />}
                <Row label="Item Total" value={money(b.itemTotal, currency)} />
                {b.productDiscount > 0 && (
                  <Row label="Product Discount" value={`-${money(b.productDiscount, currency)}`} tone="save" />
                )}
                {b.couponDiscount > 0 && (
                  <Row label="Coupon Discount" note={b.coupon?.code ? ` (${b.coupon.code})` : null}
                    value={`-${money(b.couponDiscount, currency)}`} tone="save" />
                )}
                {(b.productDiscount > 0 || b.couponDiscount > 0) && (
                  <Row label="Subtotal" value={money(b.subtotal, currency)} />
                )}
                <Row label="Shipping" value={b.shipping > 0 ? money(b.shipping, currency) : 'FREE'}
                  tone={b.shipping > 0 ? undefined : 'save'} />
                {b.platformFee > 0 && <Row label="Platform Fee" value={money(b.platformFee, currency)} />}
                {b.packagingFee > 0 && <Row label="Packaging Fee" value={money(b.packagingFee, currency)} />}
                {tax && (
                  <>
                    <Row label="Taxable Amount" value={money(tax.taxableAmount, currency)} />
                    {taxRows.map(([label, amt]) => (
                      <Row key={label} label={label} value={money(amt, currency)} />
                    ))}
                  </>
                )}
              </>
            ) : (
              // Pre-breakdown order: show only what the row actually holds.
              <Row label="Order Amount" value={money(grandTotal, currency)} />
            )}
            <div className="inv__rule" />
            <Row label="Grand Total" value={money(grandTotal, currency)} strong />
            {tax?.mode === 'inclusive' && <p className="inv__note">Inclusive of all taxes.</p>}
            {b?.totalSavings > 0 && (
              <p className="inv__save">You saved {money(b.totalSavings, currency)} on this order</p>
            )}
          </div>
        </section>

        <section className="inv__payment">
          <h2 className="inv__party-h">Payment</h2>
          <dl className="inv__idlist inv__idlist--wide">
            <div>
              <dt>Method</dt>
              <dd>{isCod ? 'Cash on Delivery' : 'Online payment (Razorpay)'}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className={paid ? 'inv__paid' : 'inv__due'}>
                {isCod && !paid ? 'Payment pending — pay on delivery'
                  : paid ? 'Paid' : (order.payment_status || 'Pending')}
              </dd>
            </div>
            {/* Never fabricate a transaction id: COD has none, and an unpaid
                online order has none either. */}
            {!isCod && order.razorpay_payment_id && (
              <div><dt>Payment ID</dt><dd className="inv__mono">{order.razorpay_payment_id}</dd></div>
            )}
            {!isCod && order.razorpay_order_id && (
              <div><dt>Gateway Order ID</dt><dd className="inv__mono">{order.razorpay_order_id}</dd></div>
            )}
            {order.paid_at && <div><dt>Paid On</dt><dd>{fmtDateTime(order.paid_at)}</dd></div>}
            {order.failure_reason && <div><dt>Note</dt><dd>{order.failure_reason}</dd></div>}
          </dl>
        </section>

        <footer className="inv__foot">
          <p>Thank you for choosing SORA LIFE.</p>
          <p className="muted">
            This is a computer-generated invoice for order {order.order_number}
            {order.invoice_number ? ` (${order.invoice_number})` : ''}.
          </p>
        </footer>
      </article>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="inv-page">
      <div className="container" style={{ padding: 'var(--sp-10) 0', maxWidth: 620 }}>{children}</div>
    </div>
  );
}
