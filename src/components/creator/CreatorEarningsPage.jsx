import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import { StatCard } from './CreatorDashboard.jsx';
import { WithdrawalsBar } from './CreatorTierPage.jsx';
import { CountUp, Sparkline } from './CreatorUI.jsx';
import { money2 } from '../../lib/format.js';
import { barChartGeometry, bucketLabel, cumulative } from '../../lib/creatorSeries.js';

// ============================================================
// My earnings — the studio page.
//
// Everything here is derived from the append-only commission ledger by the
// my_creator_earnings() RPC; there is no stored balance the client can
// move. Available is the hero — the one figure the creator can act on —
// then the held / paid / reversed buckets, this month, the terms the
// commission runs on (rate from the tier system), commission by week,
// product performance and the monthly history. Commission, never gross.
// ============================================================

const isZero = (v) => !(Number(v) > 0);
const num = (v) => (v == null || v === '' ? NaN : Number(v));

export const monthLabel = (ym) => {
  if (!ym) return '—';
  const [y, m] = String(ym).split('-').map(Number);
  if (!y || !m) return String(ym);
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(new Date(y, m - 1, 1));
};
export const ordinal = (n) => {
  const v = num(n);
  if (!Number.isFinite(v)) return '—';
  const s = ['th', 'st', 'nd', 'rd']; const r = v % 100;
  return `${v}${s[(r - 20) % 10] || s[r] || s[0]}`;
};

// The terms the page quotes. The tier rate (0031) is the live one; the
// earnings RPC's commission_rate is the floor, the creator row the fallback.
export function earningsTerms(earnings, standing, creator) {
  const rate = [standing?.rate, earnings?.commission_rate, creator?.default_commission_rate].map(num).find((v) => Number.isFinite(v));
  const hold = num(earnings?.settlement_hold_days);
  const minPayout = num(earnings?.min_payout);
  const payoutDay = num(earnings?.payout_day);
  return {
    rate: Number.isFinite(rate) ? rate : null,
    hold: Number.isFinite(hold) && hold >= 0 ? hold : null,
    minPayout: Number.isFinite(minPayout) ? minPayout : null,
    payoutDay: Number.isFinite(payoutDay) && payoutDay >= 1 && payoutDay <= 31 ? payoutDay : null,
  };
}

// Monthly history, oldest first, each month as a fraction of the largest.
export function historyBars(history, months = 12) {
  const rows = (Array.isArray(history) ? history : [])
    .map((h) => ({ month: String(h?.month || ''), commission: Number(h?.commission) || 0 }))
    .filter((h) => h.month)
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0))
    .slice(-months);
  const max = Math.max(0, ...rows.map((r) => Math.abs(r.commission)));
  return { max, empty: rows.length === 0, rows: rows.map((r) => ({ ...r, label: monthLabel(r.month), fraction: max > 0 ? Math.abs(r.commission) / max : 0 })) };
}

// ---------------------------------------------------------------
// Hero: available to withdraw, on forest
// ---------------------------------------------------------------
export function AvailableHero({ earnings, history, withdrawalsOpen }) {
  const available = Number(earnings?.available ?? 0);
  const zero = isZero(available);
  const spark = history.empty ? null : cumulative(history.rows.map((r) => r.commission));
  const canRequest = withdrawalsOpen && !zero;
  return (
    <section className={`ce-hero${zero ? ' is-zero' : ''}`} aria-labelledby="ce-hero-h">
      <span className="ce-hero__ribbon" aria-hidden="true" />
      <div className="ce-hero__main">
        <span className="ce-hero__label" id="ce-hero-h"><Icon name="checkCircle" size={15} /> Available to withdraw</span>
        <div className="ce-hero__fig"><CountUp value={available} format={money2} /></div>
        <p className="ce-hero__line">
          {zero
            ? 'Nothing has cleared yet. Commission lands here after delivery and the settlement hold.'
            : 'Cleared commission. A payout request withdraws this full amount.'}
        </p>
      </div>
      <div className="ce-hero__side">
        {spark && (
          <div className="ce-hero__spark">
            <Sparkline points={spark} tone="brand" width={150} height={40} label="Commission earned, cumulative over the last months" />
            <span>Commission, cumulative</span>
          </div>
        )}
        <Link to="/creator/payouts" className={`ce-hero__btn${canRequest ? ' is-primary' : ''}`}>
          {canRequest ? 'Request a payout' : 'About payouts'} <Icon name="arrowRight" size={15} />
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------
// This month + terms
// ---------------------------------------------------------------
export function ThisMonthPanel({ earnings }) {
  const tm = earnings?.this_month || {};
  const rows = [
    { label: 'Attributed orders', value: String(Number(tm.orders ?? 0)) },
    { label: 'Products sold', value: String(Number(tm.products_sold ?? 0)) },
    { label: 'Qualifying sales', value: money2(tm.attributed_sales ?? 0) },
    { label: 'Commission earned', value: money2(tm.commission_earned ?? 0), tone: 'ok', zero: isZero(tm.commission_earned) },
  ];
  const quiet = [tm.orders, tm.products_sold, tm.attributed_sales, tm.commission_earned].every(isZero);
  return (
    <section className={`cd-panel ce-month${quiet ? ' is-zero' : ''}`} aria-labelledby="ce-month-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="ce-month-h">This month</h2>
          <p className="cd-panel__sub">{new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date())}, so far.</p>
        </div>
      </header>
      <dl className="ce-kv">
        {rows.map((r) => (
          <div key={r.label} className={r.zero ? 'is-zero' : ''}>
            <dt>{r.label}</dt>
            <dd className={r.tone && !r.zero ? `is-${r.tone}` : undefined}>{r.value}</dd>
          </div>
        ))}
      </dl>
      {quiet && <p className="ce-panel__empty">Nothing attributed this month yet — figures appear as orders through your links are paid.</p>}
    </section>
  );
}

export function TermsPanel({ terms, standing }) {
  return (
    <section className="cd-panel ce-terms" aria-labelledby="ce-terms-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="ce-terms-h">Your terms</h2>
          <p className="cd-panel__sub">Set by SORA LIFE and your tier.</p>
        </div>
        {standing?.rank && <Link to="/creator/tier" className="cd-panel__link">{standing.rank} · L{standing.level} <Icon name="arrowRight" size={13} /></Link>}
      </header>
      <dl className="ce-kv">
        <div><dt>Commission rate</dt><dd className="is-ok">{terms.rate == null ? '—' : `${terms.rate}%`}</dd></div>
        <div><dt>Settlement hold</dt><dd>{terms.hold == null ? '—' : `${terms.hold} days after delivery`}</dd></div>
        <div><dt>Minimum payout</dt><dd>{terms.minPayout == null ? '—' : money2(terms.minPayout)}</dd></div>
        <div><dt>Payout window</dt><dd>{terms.payoutDay == null ? '—' : `${ordinal(terms.payoutDay)} of each month`}</dd></div>
      </dl>
      <p className="ce-panel__note">Your rate is set by your tier — confirmed lifetime sales through your links. A rate change only affects <em>future</em> orders; commission already earned keeps the rate it was earned at.</p>
    </section>
  );
}

// ---------------------------------------------------------------
// Commission by week — bars, the latest in gold
// ---------------------------------------------------------------
export function CommissionByWeek({ series }) {
  const points = Array.isArray(series?.commission) ? series.commission : [];
  const g = barChartGeometry(points, { width: 360, height: 160, minMax: 1000 });
  const labels = Array.isArray(series?.labels) ? series.labels : [];
  const every = Math.max(1, Math.ceil(g.n / 6));
  return (
    <section className={`cd-panel ce-weeks${g.empty ? ' is-zero' : ''}`} aria-labelledby="ce-weeks-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="ce-weeks-h">Commission by week</h2>
          <p className="cd-panel__sub">{series?.available ? 'Recorded to your ledger, by week.' : 'Fills in as commission is recorded.'}</p>
        </div>
      </header>
      <svg className="ct-bars" viewBox={`0 0 ${g.width} ${g.height}`} role="img" aria-label={g.empty ? 'No commission in this period yet' : 'Commission recorded by week, latest week highlighted'}>
        {g.ticks.map((t) => <line key={t.v} className="ct-bars__grid" x1={g.padL} x2={g.width - g.padR} y1={t.y} y2={t.y} />)}
        {g.ticks.map((t) => <text key={`t${t.v}`} className="ct-bars__ytick" x={g.padL - 6} y={t.y + 3.5} textAnchor="end">{t.label}</text>)}
        {g.bars.map((b, i) => (
          <g key={i}>
            <rect className={`ct-bars__bar${i === g.n - 1 ? ' is-now' : ''}${b.h === 0 ? ' is-zero' : ''}`} x={b.x} y={b.y} width={b.w} height={Math.max(b.h, 2)} rx="3" />
            {(i % every === 0 || i === g.n - 1) && <text className="ct-bars__xtick" x={b.x + b.w / 2} y={g.height - 6} textAnchor="middle">{bucketLabel(labels[i], series?.unit)}</text>}
          </g>
        ))}
      </svg>
      {g.empty && <p className="cd-chart__empty">No commission recorded yet — each bar fills in as orders through your links are paid.</p>}
    </section>
  );
}

// ---------------------------------------------------------------
// Product performance + monthly history
// ---------------------------------------------------------------
export function ProductPerformance({ products }) {
  const rows = Array.isArray(products) ? products : [];
  return (
    <section className="cd-panel ce-products" aria-labelledby="ce-prod-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="ce-prod-h">Product performance</h2>
          <p className="cd-panel__sub">Qualifying sales and the commission they earned.</p>
        </div>
      </header>
      <div className="cd-table-wrap">
        <table className="cd-table ce-table">
          <thead><tr><th>Product</th><th className="ta-r">Qty</th><th className="ta-r">Sales</th><th className="ta-r">Commission</th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="cd-table__empty" colSpan={4}>No qualifying products yet — the first paid order through your link starts this table.</td></tr>
            ) : rows.map((p, i) => (
              <tr key={i}>
                <td><strong>{p.name || 'Product'}</strong>{p.variant ? <span className="cd-table__sub">{p.variant}</span> : null}</td>
                <td className="ta-r">{Number(p.qty ?? 0)}</td>
                <td className="ta-r">{money2(p.sales ?? 0)}</td>
                <td className="ta-r is-earn">{money2(p.commission ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function MonthlyHistory({ history }) {
  return (
    <section className={`cd-panel ce-history${history.empty ? ' is-zero' : ''}`} aria-labelledby="ce-hist-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="ce-hist-h">Monthly history</h2>
          <p className="cd-panel__sub">Commission recorded each month.</p>
        </div>
      </header>
      {history.empty ? (
        <p className="ce-panel__empty">No history yet — each month appears here once commission is recorded in it.</p>
      ) : (
        <ol className="ce-hist">
          {history.rows.map((r) => (
            <li key={r.month} className={`ce-hist__row${r.commission < 0 ? ' is-bad' : ''}${r.commission === 0 ? ' is-zero' : ''}`}>
              <span className="ce-hist__month">{r.label}</span>
              <span className="ce-hist__track" aria-hidden="true"><span className="ce-hist__fill" style={{ transform: `scaleX(${Number(r.fraction.toFixed(3))})` }} /></span>
              <b className="ce-hist__amt">{money2(r.commission)}</b>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ---------------------------------------------------------------
// The page
// ---------------------------------------------------------------
export default function CreatorEarningsPage({ creator, earnings, standing = null, weekly = null, noticeDismissed = false }) {
  const e = earnings || {};
  const terms = earningsTerms(e, standing, creator);
  const history = historyBars(e.monthly_history);
  const withdrawalsOpen = !!standing?.withdrawals_open;
  const reversed = Number(e.reversed ?? 0);
  return (
    <div className="ce">
      <header className="ce-head">
        <div>
          <h1 className="crp__h1 serif">My earnings</h1>
          <p className="crp__lede">Commission on the orders your links generated — derived from your settled ledger, nothing here is edited from this page.</p>
        </div>
      </header>

      <WithdrawalsBar open={withdrawalsOpen} initiallyDismissed={noticeDismissed} />

      <AvailableHero earnings={e} history={history} withdrawalsOpen={withdrawalsOpen} />

      {Number(e.reserved ?? 0) > 0 && (
        <p className="ce-reserve"><Icon name="lock" size={14} /> {money2(e.reserved)} is reserved against an open payout request and can’t be requested again until that request is settled.</p>
      )}

      <div className="ce-stats">
        <StatCard icon="clock" label="Held" value={Number(e.held ?? 0)} money tone="hold" spark={weekly?.available ? weekly.commission : null}
          hint={terms.hold == null ? 'In the settlement hold.' : `In the ${terms.hold}-day settlement hold.`} />
        <StatCard icon="checkCircle" label="Paid out" value={Number(e.paid ?? 0)} money tone="ok" hint="All time." />
        <StatCard icon="return" label="Reversed" value={reversed} money tone={reversed > 0 ? 'bad' : 'info'} hint="Refunds and adjustments." />
        <StatCard glyph="₹" label="This month" value={Number(e.this_month?.commission_earned ?? 0)} money tone="ok" hint="Commission earned so far." />
      </div>

      <div className="ce-row ce-row--mid">
        <CommissionByWeek series={weekly} />
        <ThisMonthPanel earnings={e} />
        <TermsPanel terms={terms} standing={standing} />
      </div>

      <div className="ce-row ce-row--low">
        <ProductPerformance products={e.top_products} />
        <MonthlyHistory history={history} />
      </div>

      <p className="ca-note">
        Earnings are commission on <strong>qualifying</strong> sales — not gross order value. We never share your shoppers’ personal details with you.
      </p>
    </div>
  );
}
