import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useCustomerAuth } from '../lib/customerAuth.jsx';

// ============================================================
// Gift receipt (owner, 2026-11-16: more features, round 9). The same order the invoice
// reads, printed for the person it is a gift for: what is in the parcel and how many,
// the order number and date — no prices, no totals, no payment, no billing address,
// phone or email. A note can be typed above the list; it is printed and never saved.
//
// Security: as the invoice — the "orders customer read" RLS policy returns only the
// signed-in customer's own order; a guest matches nothing.
// ============================================================

const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
};

/** The parcel's lines without any money: name, option, quantity. Pure. */
export function giftLines(items) {
  return (Array.isArray(items) ? items : []).map((l, i) => ({
    key: `${l.product_id || 'item'}-${l.variant_id || i}`,
    name: String(l.name || 'Item'),
    variant: l.variant ? String(l.variant) : '',
    qty: Math.max(1, Number(l.qty) || 1),
  }));
}

export default function GiftReceipt() {
  const { orderNumber } = useParams();
  const { session, loading: authLoading } = useCustomerAuth();
  const [order, setOrder] = useState(undefined);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (authLoading) return undefined;
    if (!session) { setOrder(null); return undefined; }
    let cancelled = false;
    supabase.from('orders').select('order_number, created_at, items').eq('order_number', orderNumber).maybeSingle()
      .then(({ data, error }) => { if (!cancelled) setOrder(error ? null : data || null); }, () => { if (!cancelled) setOrder(null); });
    return () => { cancelled = true; };
  }, [orderNumber, session, authLoading]);

  if (authLoading || order === undefined) return <Shell><p className="muted">Loading your gift receipt…</p></Shell>;
  if (!session || !order) {
    return (
      <Shell>
        <h1 className="serif inv__empty-h">{session ? 'Order not found' : 'Sign in to print a gift receipt'}</h1>
        <p className="muted">Gift receipts are only available to the account that placed the order.</p>
        <Link to={session ? '/account/orders' : '/account'} className="btn" style={{ marginTop: 'var(--sp-5)' }}>{session ? 'Back to my orders' : 'Go to my account'}</Link>
      </Shell>
    );
  }

  const lines = giftLines(order.items);
  return (
    <div className="inv-page">
      <div className="container inv__toolbar no-print">
        <Link to="/account/orders" className="inv__back"><Icon name="chevronLeft" size={16} /> My orders</Link>
        <div className="inv__toolbar-actions">
          <button type="button" className="btn btn-sm" onClick={() => window.print()}><Icon name="download" size={15} /> Download / Print</button>
        </div>
      </div>
      <div className="container sora-gift__compose no-print">
        <label htmlFor="sora-gift-note">Add a note (optional; it prints on the receipt and is not saved)</label>
        <textarea id="sora-gift-note" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Happy birthday! Love, …" />
      </div>
      <article className="container inv sora-gift">
        <header className="sora-gift__head">
          <img src="/assets/sora-lifestyle-bird-header.webp" alt="SORA LIFESTYLE — Health and Wellness" className="inv__logo" width="494" height="156" />
          <h1 className="serif sora-gift__title">A gift for you</h1>
          <p className="muted">Gift receipt · Order {order.order_number}{fmtDate(order.created_at) ? ` · ${fmtDate(order.created_at)}` : ''}</p>
        </header>
        {note.trim() && <p className="sora-gift__note">{note.trim()}</p>}
        <ul className="sora-gift__list">
          {lines.map((l) => (
            <li key={l.key}><span><strong>{l.name}</strong>{l.variant && <em>{l.variant}</em>}</span><span>Qty {l.qty}</span></li>
          ))}
        </ul>
        <footer className="inv__foot">
          <p>Returns are accepted within 7 days of delivery: quote order {order.order_number} (soralifestyle.in/returns).</p>
          <p className="muted">This gift receipt shows no prices.</p>
        </footer>
      </article>
    </div>
  );
}

function Shell({ children }) {
  return <div className="inv-page"><div className="container" style={{ padding: 'var(--sp-10) 0', maxWidth: 620 }}>{children}</div></div>;
}
