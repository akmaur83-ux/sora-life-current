import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icon.jsx';
import { CountUp, Sparkline } from './CreatorUI.jsx';
import { money2 } from '../../lib/format.js';
import { rankSlot, rupees, tierProgress } from '../../lib/creatorTiers.js';
import { RANGES, areaChartGeometry, bucketLabel, donutGeometry, trend } from '../../lib/creatorSeries.js';
import { greetingFor } from '../../lib/creatorActivity.js';

// ============================================================
// Creator dashboard — the studio home.
//
// Every figure is real and every zero is designed: sparklines draw a level
// baseline, the donut is a muted ring, trends read "—" where there is no
// previous period. Charts are hand-built SVG; the only things that move are
// transforms and opacity.
// ============================================================

const isZero = (v) => !(Number(v) > 0);
const countFmt = (n) => String(Math.round(n));

// ---------------------------------------------------------------
// Greeting + quote + mantra
// ---------------------------------------------------------------
export function Greeting({ creator, hour = new Date().getHours() }) {
  return (
    <div className="cd-hello">
      <p className="cd-hello__hi">{greetingFor(hour)},</p>
      <h1 className="cd-hello__name serif">{creator?.display_name} <span className="cd-hello__spark" aria-hidden="true">✦</span></h1>
      <p className="cd-hello__line"><Icon name="sparkle" size={15} /> Create. Inspire. Earn. Build a Healthier India.</p>
    </div>
  );
}

export function QuotePanel() {
  return (
    <figure className="cd-quote" role="img" aria-label="Small creators make a big difference. — SORA LIFE">
      <blockquote className="cd-quote__q serif">
        <span className="cd-quote__mark" aria-hidden="true">“</span>
        Small creators <br />make a big difference.”
      </blockquote>
      <figcaption className="cd-quote__by">— SORA LIFE</figcaption>
    </figure>
  );
}

export function MantraCard() {
  return (
    <aside className="cd-mantra" aria-label="Create, inspire, earn">
      <p className="cd-mantra__words"><span>Create</span><span>Inspire</span><span>Earn</span></p>
      <p className="cd-mantra__sub">For a healthier India</p>
      <span className="cd-mantra__rule" aria-hidden="true" />
    </aside>
  );
}

// ---------------------------------------------------------------
// Stat card: icon tile, label, figure, trend, sparkline
// ---------------------------------------------------------------
export function StatCard({ icon, glyph, label, value, format = countFmt, trendOf = null, spark = null, tone = 'info', money = false, sub = null, hint = null }) {
  // null is a figure that cannot be derived (a ratio over zero): a dash, never 0.
  const zero = value == null || isZero(value);
  const t = trendOf || { dir: 'none', label: '—' };
  return (
    <article className={`cd-stat${zero ? ' is-zero' : ''}`} data-tone={tone}>
      <span className="cd-stat__tile" aria-hidden="true">{glyph ? <span className="cd-stat__glyph">{glyph}</span> : <Icon name={icon} size={20} />}</span>
      <div className="cd-stat__body">
        <span className="cd-stat__label">{label}</span>
        <div className={`cd-stat__fig${money ? ' is-money' : ''}`}>{value == null ? '—' : <CountUp value={value} format={money ? money2 : format} />}</div>
        {trendOf == null && hint ? <span className="cd-stat__hint">{hint}</span> : (
          <span className={`cd-stat__trend is-${t.dir}`}>
            {t.dir === 'up' && <Icon name="chevronUp" size={12} />}
            {t.dir === 'down' && <Icon name="chevronDown" size={12} />}
            {t.label}
            {sub && (t.dir === 'up' || t.dir === 'down' || t.dir === 'new') ? <em className="cd-stat__vs">{sub}</em> : null}
          </span>
        )}
      </div>
      <div className="cd-stat__spark">{spark && <Sparkline points={spark} tone={zero ? 'neutral' : tone} width={90} height={34} />}</div>
    </article>
  );
}

// ---------------------------------------------------------------
// Share Your Link — the dark green CTA
// ---------------------------------------------------------------
export function ShareCta() {
  return (
    <section className="cd-share" aria-label="Share your link">
      <span className="cd-share__ic" aria-hidden="true"><Icon name="externalLink" size={20} /></span>
      <div className="cd-share__txt">
        <strong>Share Your Link</strong>
        <span>Start earning today</span>
      </div>
      <Link to="/creator/links" className="cd-share__go" aria-label="Open your links"><Icon name="arrowRight" size={18} /></Link>
      <span className="cd-share__ribbon" aria-hidden="true" />
    </section>
  );
}

// ---------------------------------------------------------------
// Performance overview: range toggle, four metrics, the area chart
// ---------------------------------------------------------------
export function PerformanceOverview({ series, range, onRange, loading = false }) {
  const cards = [
    { key: 'clicks', label: 'Link Clicks', tone: 'ok', dot: 'ok' },
    { key: 'orders', label: 'Orders', tone: 'info', dot: 'neutral' },
    { key: 'sales', label: 'Sales (₹)', tone: 'hold', dot: 'hold', money: true },
    { key: 'commission', label: 'Commission (₹)', tone: 'brand', dot: 'brand', money: true },
  ];
  return (
    <section className="cd-panel cd-perf" aria-labelledby="cd-perf-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="cd-perf-h">Performance Overview</h2>
          <p className="cd-panel__sub">Track your growth, engagement and earnings over time.</p>
        </div>
        <div className="cd-range" role="tablist" aria-label="Range">
          {RANGES.map((r) => (
            <button key={r.id} type="button" role="tab" aria-selected={range === r.id} className={`cd-range__btn${range === r.id ? ' is-on' : ''}`} onClick={() => onRange?.(r.id)}>{r.label}</button>
          ))}
        </div>
      </header>

      <div className="cd-metrics">
        {cards.map((c) => {
          const v = series.totals?.[c.key] ?? 0;
          const t = trend(v, series.previous ? series.previous[c.key] : null);
          return (
            <div key={c.key} className={`cd-metric${isZero(v) ? ' is-zero' : ''}`} data-tone={c.tone}>
              <span className="cd-metric__label"><span className={`cd-dot is-${c.dot}`} aria-hidden="true" />{c.label}</span>
              <div className="cd-metric__fig"><CountUp value={v} format={c.money ? money2 : countFmt} /></div>
              <span className={`cd-metric__trend is-${t.dir}`}>
                {t.dir === 'up' && <Icon name="chevronUp" size={11} />}{t.dir === 'down' && <Icon name="chevronDown" size={11} />}
                {t.label}{t.dir === 'flat' && t.label === '—' ? ' 0%' : ''}
              </span>
            </div>
          );
        })}
      </div>

      <AreaChart series={series} loading={loading} />
    </section>
  );
}

export function AreaChart({ series, width = 720, height = 240, loading = false }) {
  const g = areaChartGeometry({ clicks: series.clicks, orders: series.orders }, { width, height, padB: 30 });
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
    <div className={`cd-chart${g.empty ? ' is-empty' : ''}${loading ? ' is-loading' : ''}${hover ? ' is-hover' : ''}`}>
      <div className="cd-legend" aria-hidden="true">
        <span><i className="cd-dot is-ok" /> Link Clicks</span>
        <span><i className="cd-dot is-hold" /> Orders</span>
        <span className="is-muted"><i className="cd-dot is-neutral" /> Sales (₹) <em>on hover</em></span>
      </div>
      <div className="cd-chart__frame">
        <svg className="cd-chart__svg" viewBox={`0 0 ${width} ${height}`} role="img"
          aria-label={g.empty ? 'No activity in this period yet' : 'Link clicks and orders over the selected period'}
          onPointerMove={move} onPointerLeave={() => { setActive(g.n > 0 ? g.n - 1 : null); setHover(false); }}>
          {g.ticks.map((t) => (
            <g key={t.v}>
              <line className="cd-chart__grid" x1={g.padL} x2={width - g.padR} y1={t.y} y2={t.y} />
              <text className="cd-chart__ytick" x={g.padL - 8} y={t.y + 3.5} textAnchor="end">{t.v}</text>
            </g>
          ))}
          {g.area && <path className="cd-chart__area" d={g.area} />}
          {g.line && <path className="cd-chart__line" d={g.line} />}
          {g.orderLine && <path className="cd-chart__orders" d={g.orderLine} />}
          {idx != null && <line className="cd-chart__cursor" x1={g.xs[idx]} x2={g.xs[idx]} y1={g.padT} y2={g.baseY} />}
          {g.clicksPts.map(([x, y], i) => <circle key={i} className={`cd-chart__pt${i === idx ? ' is-on' : ''}`} cx={x} cy={y} r={i === idx ? 4.5 : 3} />)}
          {series.labels.map((l, i) => (i % labelEvery === 0 || i === g.n - 1) && (
            <text key={i} className="cd-chart__xtick" x={g.xs[i]} y={height - 8} textAnchor={i === 0 ? 'start' : i === g.n - 1 ? 'end' : 'middle'}>{bucketLabel(l, series.unit)}</text>
          ))}
        </svg>
        {idx != null && (
          <div className={`cd-tip${tipRight ? ' is-right' : ''}`} style={{ left: `${Math.round((tipX / width) * 1000) / 10}%` }} role="status" aria-live="polite">
            <div className="cd-tip__in" style={{ transform: tipRight ? 'translateX(-100%)' : 'translateX(12px)' }}>
              <strong>{bucketLabel(series.labels[idx], series.unit) || '—'}</strong>
              <span><i className="cd-dot is-ok" />Link Clicks <b>{series.clicks[idx] ?? 0}</b></span>
              <span><i className="cd-dot is-hold" />Orders <b>{series.orders[idx] ?? 0}</b></span>
              <span><i className="cd-dot is-neutral" />Sales <b>{money2(series.sales[idx] ?? 0)}</b></span>
            </div>
          </div>
        )}
      </div>
      {g.empty && <p className="cd-chart__empty">No activity in this period yet — the chart fills in as visits arrive through your links.</p>}
    </div>
  );
}

// ---------------------------------------------------------------
// Earnings breakdown donut
// ---------------------------------------------------------------
const PARTS = [
  { key: 'available', label: 'Available', tone: 'ok' },
  { key: 'held', label: 'On Hold', tone: 'hold' },
  { key: 'reversed', label: 'Reversed', tone: 'bad' },
  { key: 'paid', label: 'Paid Out', tone: 'neutral' },
];
export function EarningsBreakdown({ earnings }) {
  const parts = PARTS.map((p) => ({ ...p, value: Number(earnings?.[p.key] ?? 0) }));
  const d = donutGeometry(parts, { size: 150, stroke: 16 });
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <section className={`cd-panel cd-earn${d.empty ? ' is-zero' : ''}`} aria-labelledby="cd-earn-h">
      <header className="cd-panel__head">
        <div>
          <h2 className="cd-panel__h serif" id="cd-earn-h">Earnings Breakdown</h2>
          <p className="cd-panel__sub">See how your earnings are distributed.</p>
        </div>
      </header>
      <div className="cd-earn__body">
        <div className="cd-donut" role="img" aria-label={d.empty ? 'No earnings yet' : `Total earnings ${money2(total)}`}>
          <svg viewBox={`0 0 ${d.size} ${d.size}`} width={d.size} height={d.size}>
            <circle className="cd-donut__track" cx={d.cx} cy={d.cy} r={d.r} strokeWidth={d.stroke} />
            {!d.empty && d.segments.filter((s) => s.frac > 0).map((s) => (
              <circle key={s.key} className={`cd-donut__seg is-${s.tone}`} cx={d.cx} cy={d.cy} r={d.r} strokeWidth={d.stroke}
                strokeDasharray={s.dash} strokeDashoffset={s.offset} transform={`rotate(-90 ${d.cx} ${d.cy})`} />
            ))}
          </svg>
          <div className="cd-donut__centre">
            <div className="cd-donut__fig"><CountUp value={total} format={money2} /></div>
            <span className="cd-donut__l">Total Earnings</span>
          </div>
        </div>
        <ul className="cd-earn__legend">
          {parts.map((p) => (
            <li key={p.key} className={isZero(p.value) ? 'is-zero' : ''}>
              <span><i className={`cd-dot is-${p.tone}`} aria-hidden="true" />{p.label}</span>
              <b>{money2(p.value)}</b>
            </li>
          ))}
        </ul>
      </div>
      <Link to="/creator/earnings" className="cd-panel__foot-btn">View Earnings Details <Icon name="arrowRight" size={15} /></Link>
    </section>
  );
}

// ---------------------------------------------------------------
// Recent activity
// ---------------------------------------------------------------
export function RecentActivity({ items }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <section className="cd-panel cd-feed" aria-labelledby="cd-feed-h">
      <header className="cd-panel__head">
        <h2 className="cd-panel__h serif" id="cd-feed-h">Recent Activity</h2>
        <Link to="/creator/analytics" className="cd-panel__link">View All <Icon name="arrowRight" size={13} /></Link>
      </header>
      {list.length === 0 ? (
        <p className="cd-feed__empty">Your activity will show here — the first click on your link starts the feed.</p>
      ) : (
        <ol className="cd-feed__list">
          {list.map((it) => (
            <li key={it.id} className="cd-feed__item" data-tone={it.tone}>
              <span className="cd-feed__ic" aria-hidden="true"><Icon name={it.icon} size={16} /></span>
              <div className="cd-feed__txt"><strong>{it.title}</strong>{it.body && <span>{it.body}</span>}</div>
              <time className="cd-feed__when" dateTime={it.at}>{it.when}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ---------------------------------------------------------------
// Tier progress
// ---------------------------------------------------------------
export function RankMedallion({ rank, size = 80 }) {
  return (
    <span className="cd-medal" data-rank={rankSlot(rank)} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 80 80" width={size} height={size}>
        <circle className="cd-medal__halo" cx="40" cy="40" r="38" />
        <path className="cd-medal__rosette" d="M40 10l6.5 5.4 8.3-1.6 3.4 7.8 7.8 3.4-1.6 8.3L70 40l-5.6 6.7 1.6 8.3-7.8 3.4-3.4 7.8-8.3-1.6L40 70l-6.5-5.4-8.3 1.6-3.4-7.8-7.8-3.4 1.6-8.3L10 40l5.6-6.7-1.6-8.3 7.8-3.4 3.4-7.8 8.3 1.6z" />
        <circle className="cd-medal__inner" cx="40" cy="40" r="17" />
        <path className="cd-medal__mark" d="M40 29l3.2 6.6 7.3 1-5.3 5.1 1.3 7.3-6.5-3.5-6.5 3.5 1.3-7.3-5.3-5.1 7.3-1z" />
      </svg>
    </span>
  );
}

export function TierProgress({ standing }) {
  if (!standing || standing.ok === false) return null;
  const p = tierProgress(standing);
  const pct = Math.round(p.fraction * 100);
  return (
    <section className="cd-panel cd-tier" aria-labelledby="cd-tier-h" data-rank={rankSlot(standing.rank)}>
      <header className="cd-panel__head">
        <h2 className="cd-panel__h serif" id="cd-tier-h">Your Tier Progress</h2>
        <Link to="/creator/tier" className="cd-panel__link">View Full Ladder <Icon name="arrowRight" size={13} /></Link>
      </header>
      <div className="cd-tier__now">
        <RankMedallion rank={standing.rank} />
        <div>
          <h3 className="cd-tier__rank serif">{standing.rank} — Level {standing.level}</h3>
          <p className="cd-tier__rate">Commission Rate {Number(standing.rate)}%</p>
        </div>
      </div>
      <div className="cd-tier__prog">
        <div className="cd-tier__prog-l">
          <span>{p.atTop ? `${rupees(standing.lifetime_confirmed_sales)} confirmed` : `${rupees(standing.lifetime_confirmed_sales)} of ${rupees(p.to)}`}</span>
          <b>{pct}%</b>
        </div>
        <div className="cd-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={p.atTop ? 'Top level reached' : `Progress to level ${standing.next_level}`}>
          <span className="cd-bar__fill" style={{ transform: `scaleX(${p.fraction})` }} />
        </div>
      </div>
      {!p.atTop ? (
        <div className="cd-tier__next">
          <span className="cd-tier__lock" aria-hidden="true"><Icon name="lock" size={16} /></span>
          <div>
            <strong>Next Level: {standing.rank} — Level {standing.next_level}</strong>
            <span>Reach {rupees(standing.next_threshold)} in confirmed sales</span>
            <span>{Number(standing.next_rate)}% commission on future sales</span>
          </div>
        </div>
      ) : (
        <div className="cd-tier__next is-top">
          <span className="cd-tier__lock" aria-hidden="true"><Icon name="crown" size={16} /></span>
          <div><strong>Top of the ladder</strong><span>{Number(standing.rate)}% on every new sale</span></div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------
// Top performing campaigns
// ---------------------------------------------------------------
export function TopCampaigns({ links, available }) {
  const rows = (Array.isArray(links) ? links : []).slice(0, 5);
  return (
    <section className="cd-panel cd-camps" aria-labelledby="cd-camps-h">
      <header className="cd-panel__head">
        <h2 className="cd-panel__h serif" id="cd-camps-h">Top Performing Campaigns</h2>
        <Link to="/creator/campaigns" className="cd-panel__link">View All <Icon name="arrowRight" size={13} /></Link>
      </header>
      <div className="cd-table-wrap">
        <table className="cd-table">
          <thead><tr><th>Campaign</th><th className="ta-r">Clicks</th><th className="ta-r">Orders</th><th className="ta-r">Sales</th><th className="ta-r">Earnings</th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="cd-table__empty" colSpan={5}>{available ? 'No link activity yet.' : 'Campaign figures appear here once activity is recorded.'}</td></tr>
            ) : rows.map((r) => (
              <tr key={r.link_id || 'default'} className={isZero(r.clicks) && isZero(r.sales) ? 'is-zero' : ''}>
                <td><strong>{r.label}</strong>{r.campaign && r.campaign !== r.label ? <span className="cd-table__sub">{r.campaign}</span> : null}</td>
                <td className="ta-r">{r.clicks}</td>
                <td className="ta-r">{r.orders}</td>
                <td className="ta-r">{money2(r.sales)}</td>
                <td className="ta-r is-earn">{money2(r.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------
// Gold editorial promo
// ---------------------------------------------------------------
export function PromoCard() {
  return (
    <section className="cd-promo" aria-labelledby="cd-promo-h">
      <div className="cd-promo__txt">
        <h2 className="cd-promo__h serif" id="cd-promo-h">Turn Your Influence <br />Into Impact</h2>
        <p>Share wellness. Earn rewards. Be part of a healthier India.</p>
        <Link to="/creator/campaigns" className="cd-promo__btn">Explore Campaigns <Icon name="arrowRight" size={15} /></Link>
      </div>
      <p className="cd-promo__words" aria-hidden="true"><span>People</span><span>Wellness</span><span>Progress</span><span>Together</span></p>
      <span className="cd-promo__wave" aria-hidden="true" />
    </section>
  );
}

// ---------------------------------------------------------------
// The page
// ---------------------------------------------------------------
export default function CreatorDashboard({
  creator, analytics, earnings, standing, series, range, onRange, seriesLoading = false,
  activity = [], hour,
}) {
  const clicks = Number(analytics?.clicks ?? 0);
  const orders = Number(analytics?.attributed_orders ?? 0);
  const products = Number(analytics?.products_sold ?? 0);
  const sales = Number(analytics?.attributed_sales ?? 0);
  const prev = series.previous;
  return (
    <div className="cd">
      <div className="cd-row cd-row--hero">
        <Greeting creator={creator} hour={hour} />
        <QuotePanel />
        <MantraCard />
      </div>

      <div className="cd-row cd-row--stats">
        <StatCard icon="externalLink" label="Total Link Clicks" value={clicks} trendOf={trend(series.totals?.clicks ?? 0, prev?.clicks)} spark={series.clicks} tone="ok" />
        <StatCard icon="bag" label="Total Orders" value={orders} trendOf={trend(series.totals?.orders ?? 0, prev?.orders)} spark={series.orders} tone="info" />
        <StatCard icon="package" label="Products Sold" value={products} trendOf={trend(series.totals?.products ?? 0, prev?.products)} spark={series.products} tone="info" />
        <StatCard glyph="₹" label="Attributed Sales" value={sales} money trendOf={trend(series.totals?.sales ?? 0, prev?.sales)} spark={series.sales} tone="ok" />
        <ShareCta />
      </div>

      <div className="cd-grid">
        <div className="cd-col cd-col--main">
          <PerformanceOverview series={series} range={range} onRange={onRange} loading={seriesLoading} />
          <div className="cd-row cd-row--split">
            <EarningsBreakdown earnings={earnings} />
            <RecentActivity items={activity} />
          </div>
        </div>
        <div className="cd-col cd-col--rail">
          <TierProgress standing={standing} />
          <TopCampaigns links={series.links} available={series.available} />
          <PromoCard />
        </div>
      </div>
    </div>
  );
}
