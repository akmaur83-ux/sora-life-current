import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import { StatCard } from './CreatorDashboard.jsx';
import { money2 } from '../../lib/format.js';
import { RANGES, bucketLabel, donutGeometry, compactRupees } from '../../lib/creatorSeries.js';
import {
  analyticsStats, previousLabel, periodLabel, funnelFor, productShare, topLinks, insightsFor, analyticsCsv,
  dualAxisGeometry, groupedBarGeometry,
} from '../../lib/creatorAnalytics.js';

// ============================================================
// My analytics — the studio page.
//
// Deeper than the dashboard summary: six stat cards that follow the range
// toggle, a dual-axis performance chart (counts left, rupees right), sales
// by product, the click → order → qualified funnel, per-link performance,
// sales against commission by period, and insights that are sentences the
// figures support. Every zero is designed, every missing ratio is "—".
// Charts are SVG built here; only transforms and opacity ever move.
// ============================================================

const isZero = (v) => !(Number(v) > 0);
const pctFmt = (n) => `${(Math.round(n * 10) / 10).toFixed(1)}%`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------
// Header: title, the range toggle, the resolved period, export
// ---------------------------------------------------------------
export function AnalyticsHead({ series, range, onRange, links }) {
  const period = periodLabel(series);
  const download = () => {
    if (typeof window === 'undefined' || typeof Blob === 'undefined') return;
    const blob = new Blob([analyticsCsv(series, links)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sora-analytics-${series.range}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <header className="ca-head">
      <div className="ca-head__txt">
        <h1 className="crp__h1 serif">My analytics</h1>
        <p className="crp__lede">Attributed activity from your links. Figures update as orders qualify.</p>
      </div>
      <div className="ca-tools">
        <div className="cd-range" role="tablist" aria-label="Range">
          {RANGES.map((r) => (
            <button key={r.id} type="button" role="tab" aria-selected={range === r.id} className={`cd-range__btn${range === r.id ? ' is-on' : ''}`} onClick={() => onRange?.(r.id)}>{r.label}</button>
          ))}
        </div>
        <span className={`ca-period${period ? '' : ' is-muted'}`}>
          <Icon name="clock" size={15} />
          {period || 'All-time figures · period breakdown appears as activity is recorded'}
        </span>
        {series.available && (
          <button type="button" className="ca-export" onClick={download}><Icon name="download" size={15} /> Export CSV</button>
        )}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------
// Performance over time — counts on the left axis, rupees on the right
// ---------------------------------------------------------------
export function DualAxisChart({ series, width = 560, height = 230, loading = false }) {
  const g = dualAxisGeometry({ clicks: series.clicks, orders: series.orders, sales: series.sales }, { width, height });
  const [active, setActive] = useState(g.n > 0 ? g.n - 1 : null);
  const [hover, setHover] = useState(false);
  const idx = active != null && active < g.n ? active : (g.n > 0 ? g.n - 1 : null);
  const move = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0; let bestD = Infinity;
    g.xs.forEach((x, i) => { const d = Math.abs(x - px); if (d < bestD) { bestD = d; best = i; } });
    setActive(best); setHover(true);
  };
  const labelEvery = Math.max(1, Math.ceil(g.n / 7));
  const tipX = idx != null ? g.xs[idx] : 0;
  const tipRight = tipX > width * 0.6;
  return (
    <div className={`cd-chart ca-chart${g.empty ? ' is-empty' : ''}${loading ? ' is-loading' : ''}${hover ? ' is-hover' : ''}`}>
      <div className="cd-legend" aria-hidden="true">
        <span><i className="cd-dot is-ok" /> Link clicks</span>
        <span><i className="cd-dot is-hold" /> Orders</span>
        <span><i className="cd-dot is-brand" /> Attributed sales (₹)</span>
      </div>
      <div className="cd-chart__frame">
        <svg className="cd-chart__svg" viewBox={`0 0 ${width} ${height}`} role="img"
          aria-label={g.empty ? 'No activity in this period yet' : 'Link clicks, orders and attributed sales over the selected period'}
          onPointerMove={move} onPointerLeave={() => { setActive(g.n > 0 ? g.n - 1 : null); setHover(false); }}>
          {g.leftTicks.map((t) => (
            <g key={`l${t.v}`}>
              <line className="cd-chart__grid" x1={g.padL} x2={width - g.padR} y1={t.y} y2={t.y} />
              <text className="cd-chart__ytick" x={g.padL - 8} y={t.y + 3.5} textAnchor="end">{t.v}</text>
            </g>
          ))}
          {g.rightTicks.map((t) => (
            <text key={`r${t.v}`} className="cd-chart__ytick ca-chart__rtick" x={width - g.padR + 8} y={t.y + 3.5} textAnchor="start">{compactRupees(t.v)}</text>
          ))}
          {g.area && <path className="cd-chart__area" d={g.area} />}
          {g.line && <path className="cd-chart__line" d={g.line} />}
          {g.orderLine && <path className="cd-chart__orders" d={g.orderLine} />}
          {g.salesLine && <path className="ca-chart__sales" d={g.salesLine} />}
          {idx != null && <line className="cd-chart__cursor" x1={g.xs[idx]} x2={g.xs[idx]} y1={g.padT} y2={g.baseY} />}
          {g.clicksPts.map(([x, y], i) => <circle key={`c${i}`} className={`cd-chart__pt${i === idx ? ' is-on' : ''}`} cx={x} cy={y} r={i === idx ? 4.5 : 3} />)}
          {!g.empty && g.salesPts.map(([x, y], i) => <circle key={`s${i}`} className={`ca-chart__spt${i === idx ? ' is-on' : ''}`} cx={x} cy={y} r={i === idx ? 4 : 2.5} />)}
          {series.labels.map((l, i) => (i % labelEvery === 0 || i === g.n - 1) && (
            <text key={i} className="cd-chart__xtick" x={g.xs[i]} y={height - 8} textAnchor={i === 0 ? 'start' : i === g.n - 1 ? 'end' : 'middle'}>{bucketLabel(l, series.unit)}</text>
          ))}
        </svg>
        {idx != null && hover && (
          <div className={`cd-tip${tipRight ? ' is-right' : ''}`} style={{ left: `${Math.round((tipX / width) * 1000) / 10}%` }} role="status" aria-live="polite">
            <div className="cd-tip__in" style={{ transform: tipRight ? 'translateX(-100%)' : 'translateX(12px)' }}>
              <strong>{bucketLabel(series.labels[idx], series.unit) || '—'}</strong>
              <span><i className="cd-dot is-ok" />Link clicks <b>{series.clicks[idx] ?? 0}</b></span>
              <span><i className="cd-dot is-hold" />Orders <b>{series.orders[idx] ?? 0}</b></span>
              <span><i className="cd-dot is-neutral" />Products <b>{series.products[idx] ?? 0}</b></span>
              <span><i className="cd-dot is-brand" />Sales <b>{money2(series.sales[idx] ?? 0)}</b></span>
              <span><i className="cd-dot is-ok" />Commission <b>{money2(series.commission[idx] ?? 0)}</b></span>
            </div>
          </div>
        )}
      </div>
      {idx != null && !g.empty && (
        <p className="ca-readout" aria-live="polite">
          <strong>{bucketLabel(series.labels[idx], series.unit) || '—'}</strong>
          <span><i className="cd-dot is-ok" />{plural(series.clicks[idx] ?? 0, 'click')}</span>
          <span><i className="cd-dot is-hold" />{plural(series.orders[idx] ?? 0, 'order')}</span>
          <span><i className="cd-dot is-neutral" />{plural(series.products[idx] ?? 0, 'product')}</span>
          <span><i className="cd-dot is-brand" />{money2(series.sales[idx] ?? 0)} sales</span>
          <span><i className="cd-dot is-ok" />{money2(series.commission[idx] ?? 0)} commission</span>
        </p>
      )}
      {g.empty && <p className="cd-chart__empty">No activity in this period yet — the chart fills in as visits arrive through your links.</p>}
    </div>
  );
}

export function PerformancePanel({ series, loading }) {
  return (
    <section className="cd-panel ca-perf" aria-labelledby="ca-perf-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="ca-perf-h">Performance over time</h2>
          <p className="cd-panel__sub">{series.available ? `Clicks, orders and sales by ${series.unit}.` : 'Fills in as activity is recorded.'}</p>
        </div>
      </header>
      <DualAxisChart series={series} loading={loading} />
    </section>
  );
}

// ---------------------------------------------------------------
// Sales by product — share of attributed sales, all time
// ---------------------------------------------------------------
export function ProductSharePanel({ analytics }) {
  const share = productShare(analytics?.top_products);
  const d = donutGeometry(share.parts, { size: 150, stroke: 16 });
  return (
    <section className={`cd-panel cd-earn ca-share${share.empty ? ' is-zero' : ''}`} aria-labelledby="ca-share-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="ca-share-h">Sales by product</h2>
          <p className="cd-panel__sub">Share of attributed sales, all time.</p>
        </div>
      </header>
      <div className="ca-share__body">
        <div className="cd-donut" role="img" aria-label={share.empty ? 'No attributed sales yet' : `Attributed sales ${money2(share.total)} across ${share.parts.length} products`}>
          <svg viewBox={`0 0 ${d.size} ${d.size}`} width={d.size} height={d.size}>
            <circle className="cd-donut__track" cx={d.cx} cy={d.cy} r={d.r} strokeWidth={d.stroke} />
            {!d.empty && d.segments.filter((s) => s.frac > 0).map((s) => (
              <circle key={s.key} className={`cd-donut__seg ca-seg--${s.tone}`} cx={d.cx} cy={d.cy} r={d.r} strokeWidth={d.stroke}
                strokeDasharray={s.dash} strokeDashoffset={s.offset} transform={`rotate(-90 ${d.cx} ${d.cy})`} />
            ))}
          </svg>
          <div className="cd-donut__centre">
            <div className="cd-donut__fig">{money2(share.total)}</div>
            <span className="cd-donut__l">Total sales</span>
          </div>
        </div>
        {share.empty ? (
          <p className="ca-share__empty">Each product's share appears here once an order through your link qualifies.</p>
        ) : (
          <ul className="ca-share__legend">
            {share.parts.map((p) => (
              <li key={p.key}>
                <span><i className={`cd-dot ca-dot--${p.tone}`} aria-hidden="true" />{p.label}</span>
                <b>{p.pct}%</b>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------
// Conversion funnel — click → attributed order → qualified order
// ---------------------------------------------------------------
export function FunnelPanel({ analytics }) {
  const f = funnelFor(analytics);
  return (
    <section className={`cd-panel ca-funnel${f.empty ? ' is-zero' : ''}`} aria-labelledby="ca-funnel-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="ca-funnel-h">Conversion funnel</h2>
          <p className="cd-panel__sub">From click to qualified sale, all time.</p>
        </div>
      </header>
      <ol className="ca-funnel__list">
        {f.steps.map((s) => (
          <li key={s.key} className={`ca-funnel__step${isZero(s.value) ? ' is-zero' : ''}`} data-tone={s.tone}>
            <span className="ca-funnel__label">{s.label}</span>
            <b className="ca-funnel__val">{s.value}</b>
            <span className="ca-funnel__track" aria-hidden="true"><span className="ca-funnel__fill" style={{ transform: `scaleX(${s.pct == null ? 0 : Number((s.pct / 100).toFixed(3))})` }} /></span>
            <span className="ca-funnel__pct">{s.pct == null ? '—' : `${s.pct}%`}</span>
          </li>
        ))}
      </ol>
      <p className="ca-funnel__foot">{f.empty ? 'The funnel fills in from your first visit onward.' : 'Qualified orders are attributed orders that have been paid.'}</p>
    </section>
  );
}

// ---------------------------------------------------------------
// Top performing links — per link, all time
// ---------------------------------------------------------------
export function TopLinksPanel({ rows, available }) {
  return (
    <section className="cd-panel ca-links" aria-labelledby="ca-links-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="ca-links-h">Top performing links</h2>
          <p className="cd-panel__sub">Your links and campaigns, all time.</p>
        </div>
        <Link to="/creator/links" className="cd-panel__link">View all <Icon name="arrowRight" size={13} /></Link>
      </header>
      <div className="cd-table-wrap">
        <table className="cd-table ca-table">
          <thead><tr><th>Link / campaign</th><th className="ta-r">Clicks</th><th className="ta-r">Orders</th><th className="ta-r"><abbr title="Conversion rate">Conv.</abbr></th><th className="ta-r">Sales</th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="cd-table__empty" colSpan={5}>{available ? 'No link activity yet.' : 'Link figures appear here once activity is recorded.'}</td></tr>
            ) : rows.map((r) => (
              <tr key={r.link_id || 'default'} className={isZero(r.clicks) && isZero(r.sales) ? 'is-zero' : ''}>
                <td>
                  <span className="ca-table__link">
                    <span className="ca-table__ic" aria-hidden="true"><Icon name="externalLink" size={14} /></span>
                    <span><strong>{r.label}</strong>{r.url && <span className="cd-table__sub">{r.url}</span>}</span>
                  </span>
                </td>
                <td className="ta-r">{r.clicks}</td>
                <td className="ta-r">{r.orders}</td>
                <td className="ta-r">{r.conversion == null ? '—' : pctFmt(r.conversion)}</td>
                <td className="ta-r is-earn">{money2(r.sales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------
// Sales against commission by period — grouped bars on one money axis
// ---------------------------------------------------------------
export function SalesCommissionPanel({ series }) {
  const g = groupedBarGeometry(series.sales, series.commission, { width: 360, height: 170 });
  const every = Math.max(1, Math.ceil(g.n / 6));
  const unit = series.unit === 'week' ? 'week' : series.unit === 'month' ? 'month' : 'day';
  return (
    <section className={`cd-panel ca-bars${g.empty ? ' is-zero' : ''}`} aria-labelledby="ca-bars-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="ca-bars-h">Sales and commission</h2>
          <p className="cd-panel__sub">{series.available ? `Attributed sales against your commission, by ${unit}.` : 'Fills in as sales arrive.'}</p>
        </div>
      </header>
      <div className="cd-legend" aria-hidden="true">
        <span><i className="cd-dot is-brand" /> Sales (₹)</span>
        <span><i className="cd-dot is-ok" /> Commission (₹)</span>
      </div>
      <svg className="ct-bars ca-bars__svg" viewBox={`0 0 ${g.width} ${g.height}`} role="img" aria-label={g.empty ? 'No sales in this period yet' : `Attributed sales and commission by ${unit}`}>
        {g.ticks.map((t) => <line key={t.v} className="ct-bars__grid" x1={g.padL} x2={g.width - g.padR} y1={t.y} y2={t.y} />)}
        {g.ticks.map((t) => <text key={`t${t.v}`} className="ct-bars__ytick" x={g.padL - 6} y={t.y + 3.5} textAnchor="end">{compactRupees(t.v)}</text>)}
        {g.pairs.map((p, i) => (
          <g key={i}>
            <rect className={`ca-bars__sales${p.a.h === 0 ? ' is-zero' : ''}`} x={p.a.x} y={p.a.y} width={p.a.w} height={Math.max(p.a.h, 2)} rx="2" />
            <rect className={`ca-bars__comm${p.b.h === 0 ? ' is-zero' : ''}`} x={p.b.x} y={p.b.y} width={p.b.w} height={Math.max(p.b.h, 2)} rx="2" />
            {(i % every === 0 || i === g.n - 1) && <text className="ct-bars__xtick" x={p.cx} y={g.height - 6} textAnchor="middle">{bucketLabel(series.labels[i], series.unit)}</text>}
          </g>
        ))}
      </svg>
      {g.empty && <p className="cd-chart__empty">No attributed sales in this period yet — bars fill in as orders qualify.</p>}
    </section>
  );
}

// ---------------------------------------------------------------
// Insights — sentences the figures support
// ---------------------------------------------------------------
export function InsightsPanel({ items }) {
  return (
    <section className="cd-panel ca-insights" aria-labelledby="ca-ins-h">
      <header className="cd-panel__head">
        <h2 className="cd-panel__h serif" id="ca-ins-h"><Icon name="sparkle" size={18} /> Insights</h2>
      </header>
      {items.length === 0 ? (
        <p className="ca-insights__empty">Insights appear once activity is recorded — each one is drawn from your own figures, never estimated.</p>
      ) : (
        <ul className="ca-insights__list">
          {items.map((it) => (
            <li key={it.key} className="ca-insight" data-tone={it.tone || 'neutral'}>
              <span className="ca-insight__ic" aria-hidden="true"><Icon name={it.icon} size={18} /></span>
              <div>
                <strong>{it.title}</strong>
                <p>{it.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------
// Keep going — the closing banner
// ---------------------------------------------------------------
export function KeepGoingBanner() {
  return (
    <section className="ca-banner" aria-label="Keep going">
      <span className="ca-banner__leaf" aria-hidden="true" />
      <div className="ca-banner__txt">
        <h2 className="serif">Keep going, you’re making an impact.</h2>
        <p>Every click helps more people discover a healthier, brighter tomorrow.</p>
      </div>
      <Link to="/creator/campaigns" className="ca-banner__btn">View campaigns <Icon name="arrowRight" size={15} /></Link>
    </section>
  );
}

// ---------------------------------------------------------------
// The page
// ---------------------------------------------------------------
export default function CreatorAnalyticsPage({
  creator, analytics, series, range, onRange, seriesLoading = false, links = [], campaigns = [], buildUrl = null,
}) {
  const stats = analyticsStats(analytics, series);
  const vs = previousLabel(series);
  const rows = topLinks(series.links, { links, creator, campaigns, buildUrl });
  const insights = insightsFor({ series, stats, links: rows, money: money2 });
  return (
    <div className={`ca${stats.scope === 'all' ? ' is-all-time' : ''}`}>
      <AnalyticsHead series={series} range={range} onRange={onRange} links={series.links} />

      <div className="ca-stats">
        <StatCard icon="externalLink" label="Link clicks" value={stats.clicks} trendOf={stats.trends.clicks} sub={vs} spark={stats.sparks.clicks} tone="ok" />
        <StatCard icon="bag" label="Attributed orders" value={stats.orders} trendOf={stats.trends.orders} sub={vs} spark={stats.sparks.orders} tone="info" />
        <StatCard icon="package" label="Products sold" value={stats.products} trendOf={stats.trends.products} sub={vs} spark={stats.sparks.products} tone="info" />
        <StatCard glyph="₹" label="Attributed sales" value={stats.sales} money trendOf={stats.trends.sales} sub={vs} spark={stats.sparks.sales} tone="ok" />
        <StatCard glyph="%" label="Conversion rate" value={stats.conversion} format={pctFmt} trendOf={stats.trends.conversion} sub={vs} spark={stats.sparks.conversion} tone="info" />
        <StatCard glyph="₹" label="Avg order value" value={stats.aov} money trendOf={stats.trends.aov} sub={vs} spark={stats.sparks.aov} tone="info" />
      </div>

      <div className="ca-row ca-row--charts">
        <PerformancePanel series={series} loading={seriesLoading} />
        <ProductSharePanel analytics={analytics} />
        <FunnelPanel analytics={analytics} />
      </div>

      <div className="ca-row ca-row--depth">
        <TopLinksPanel rows={rows} available={series.available} />
        <SalesCommissionPanel series={series} />
        <InsightsPanel items={insights} />
      </div>

      <KeepGoingBanner />

      <p className="ca-note">
        <strong>These figures are attributed sales, not commission.</strong> Your commission is in{' '}
        <Link to="/creator/earnings">My earnings</Link>, and you can request a payout from{' '}
        <Link to="/creator/payouts">Payouts</Link> once it clears. We never share your shoppers’ personal details with you.
      </p>
    </div>
  );
}
