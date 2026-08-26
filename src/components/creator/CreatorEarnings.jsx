import Icon from '../Icon.jsx';
import { money2 } from '../../lib/format.js';

// ============================================================
// Creator earnings dashboard (Part 3)
//
// Everything here is DERIVED from the append-only commission ledger by the
// my_creator_earnings() RPC — there is no stored balance the client can move.
// We show commission (not gross sales), split into the four buckets the ledger
// defines, plus this-month performance and product breakdown. No customer PII.
// ============================================================

const monthLabel = (ym) => {
  if (!ym) return '—';
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(new Date(y, m - 1, 1));
};

export default function CreatorEarnings({ creator, earnings }) {
  if (!earnings) {
    return (
      <>
        <h1 className="serif crp__h1">My earnings</h1>
        <div className="crp__empty" style={{ marginTop: 'var(--sp-5)' }}>
          No commission yet. Once an attributed order is paid and clears its settlement
          hold, your earnings will appear here. Share your links to get started.
        </div>
        <p className="crp__foot-note">
          Earnings are commission on <em>qualifying</em> sales — not gross order value. We never
          share your shoppers’ personal details with you.
        </p>
      </>
    );
  }

  const tm = earnings.this_month || {};
  const rate = Number(earnings.commission_rate ?? creator?.default_commission_rate ?? 0);
  const hold = Number(earnings.settlement_hold_days ?? 7);
  const top = Array.isArray(earnings.top_products) ? earnings.top_products : [];
  const history = Array.isArray(earnings.monthly_history) ? earnings.monthly_history : [];

  return (
    <>
      <h1 className="serif crp__h1">My earnings</h1>
      <p className="crp__lede">
        Commission on the orders your links generated. Figures are derived from your
        settled ledger — nothing here can be edited from this page.
      </p>

      {/* Four balance buckets, derived from the ledger. */}
      <div className="crp__buckets">
        <Bucket
          tone="hold" icon="clock" label="Pending"
          value={earnings.held}
          note={`In ${hold}-day settlement hold`}
        />
        <Bucket
          tone="ok" icon="checkCircle" label="Available"
          value={earnings.available}
          note="Cleared — withdrawable"
        />
        <Bucket
          tone="paid" icon="card" label="Paid out"
          value={earnings.paid}
          note="Transferred to you"
        />
        <Bucket
          tone="rev" icon="refresh" label="Reversed"
          value={earnings.reversed}
          note="Refunds & adjustments"
        />
      </div>

      {earnings.reserved > 0 && (
        <p className="crp__reserve-note">
          <Icon name="lock" size={13} /> {money2(earnings.reserved)} is reserved against an open
          payout request and can’t be requested again until that request is settled.
        </p>
      )}

      {/* This month + programme terms */}
      <div className="crp__earn-grid">
        <section className="crp__panel">
          <h2 className="crp__panel-h">This month</h2>
          <dl className="crp__kv crp__kv--2">
            <div><dt>Attributed orders</dt><dd>{tm.orders ?? 0}</dd></div>
            <div><dt>Products sold</dt><dd>{tm.products_sold ?? 0}</dd></div>
            <div><dt>Qualifying sales</dt><dd>{money2(tm.attributed_sales ?? 0)}</dd></div>
            <div><dt>Commission earned</dt><dd className="is-ok">{money2(tm.commission_earned ?? 0)}</dd></div>
          </dl>
        </section>

        <section className="crp__panel">
          <h2 className="crp__panel-h">Your terms</h2>
          <dl className="crp__kv">
            <div><dt>Commission rate</dt><dd>{rate}%</dd></div>
            <div><dt>Settlement hold</dt><dd>{hold} days after an order is paid</dd></div>
            <div><dt>Minimum payout</dt><dd>{money2(earnings.min_payout ?? 500)}</dd></div>
          </dl>
          <p className="crp__foot-note" style={{ marginTop: 'var(--sp-3)' }}>
            Your rate is set by SORA LIFE. A rate change only affects <em>future</em> orders —
            commission already earned keeps the rate it was earned at.
          </p>
        </section>
      </div>

      {/* Product / variant performance */}
      <section className="crp__panel" style={{ marginTop: 'var(--sp-5)' }}>
        <h2 className="crp__panel-h">Product performance</h2>
        {top.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No qualifying products yet.</p>
        ) : (
          <div className="crp__table-wrap">
            <table className="crp__table">
              <thead>
                <tr><th>Product</th><th>Variant</th><th className="ta-r">Qty</th><th className="ta-r">Qualifying sales</th><th className="ta-r">Commission</th></tr>
              </thead>
              <tbody>
                {top.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name || 'Product'}</td>
                    <td className="muted">{p.variant || '—'}</td>
                    <td className="ta-r">{p.qty}</td>
                    <td className="ta-r">{money2(p.sales)}</td>
                    <td className="ta-r is-ok">{money2(p.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Monthly history */}
      <section className="crp__panel" style={{ marginTop: 'var(--sp-5)' }}>
        <h2 className="crp__panel-h">Monthly history</h2>
        {history.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No history yet.</p>
        ) : (
          <div className="crp__hist">
            {history.map((h, i) => (
              <div key={i} className="crp__hist-row">
                <span className="crp__hist-month">{monthLabel(h.month)}</span>
                <span className={`crp__hist-amt ${Number(h.commission) < 0 ? 'is-bad' : ''}`}>{money2(h.commission)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Bucket({ tone, icon, label, value, note }) {
  return (
    <div className={`crp__bucket is-${tone}`}>
      <span className="crp__bucket-top"><Icon name={icon} size={15} /> {label}</span>
      <span className="crp__bucket-v">{money2(value ?? 0)}</span>
      <span className="crp__bucket-note">{note}</span>
    </div>
  );
}
