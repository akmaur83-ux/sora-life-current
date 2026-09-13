// ============================================================
// Creator analytics — the pure rules behind the analytics page.
//
// Everything here reshapes figures the portal already holds: the all-time
// analytics RPC, the range series (my_creator_activity_series) and the
// creator's tracking links. Nothing is estimated. Where a figure cannot be
// derived (a ratio over zero, a period with no previous period) the value
// is null and the page shows "—".
// ============================================================
import { METRICS, trend, bucketLabel } from './creatorSeries.js';

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

// A ratio, or null when there is nothing to divide by.
export const ratio = (n, d) => (num(d) > 0 ? num(n) / num(d) : null);

// ---- Stat cards -------------------------------------------------------------
// When the range series is available the cards follow the toggle (with the
// trend against the previous period); until then they read all time, and
// the trend is "—" rather than a guess.
export function analyticsStats(analytics, series) {
  const range = !!series?.available;
  const tot = range ? series.totals : {
    clicks: num(analytics?.clicks), orders: num(analytics?.attributed_orders),
    products: num(analytics?.products_sold), sales: num(analytics?.attributed_sales), commission: 0,
  };
  const prev = range && series.previous ? series.previous : null;
  const conv = ratio(tot.orders, tot.clicks);
  const aov = ratio(tot.sales, tot.orders);
  const prevConv = prev ? ratio(prev.orders, prev.clicks) : null;
  const prevAov = prev ? ratio(prev.sales, prev.orders) : null;
  const per = (a, b) => (range ? series[a].map((v, i) => { const r = ratio(v, series[b][i]); return r == null ? 0 : r; }) : []);
  return {
    scope: range ? 'range' : 'all',
    clicks: num(tot.clicks), orders: num(tot.orders), products: num(tot.products), sales: num(tot.sales),
    conversion: conv == null ? null : r1(conv * 100),
    aov: aov == null ? null : r2(aov),
    trends: {
      clicks: trend(tot.clicks, prev?.clicks), orders: trend(tot.orders, prev?.orders),
      products: trend(tot.products, prev?.products), sales: trend(tot.sales, prev?.sales),
      conversion: conv == null || prevConv == null ? trend(0, null) : trend(r1(conv * 100), r1(prevConv * 100)),
      aov: aov == null || prevAov == null ? trend(0, null) : trend(r2(aov), r2(prevAov)),
    },
    sparks: {
      clicks: range ? series.clicks : [], orders: range ? series.orders : [], products: range ? series.products : [], sales: range ? series.sales : [],
      conversion: per('orders', 'clicks').map((v) => r1(v * 100)),
      aov: per('sales', 'orders').map(r2),
    },
  };
}

// "vs previous 7 days" / "vs previous 13 weeks" — only when there is one.
export function previousLabel(series) {
  if (!series?.available || !series.previous) return null;
  const n = series.labels?.length || 0;
  const unit = series.unit === 'week' ? 'week' : series.unit === 'month' ? 'month' : 'day';
  return `vs previous ${n} ${unit}${n === 1 ? '' : 's'}`;
}

// The span the toggle resolved to, from the first and last bucket.
export function periodLabel(series) {
  if (!series?.available || !series.labels?.length) return null;
  const first = series.labels[0]; const last = series.labels[series.labels.length - 1];
  const d = (iso) => new Date(`${iso}T00:00:00`);
  const a = d(first); let b = d(last);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  if (series.unit === 'week') b = new Date(b.getTime() + 6 * 86400000);
  if (series.unit === 'month') b = new Date(b.getFullYear(), b.getMonth() + 1, 0);
  const fmt = (x, withYear) => x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
  if (series.unit === 'month') {
    const m = (x) => x.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    return `${m(a)} – ${m(b)}`;
  }
  return `${fmt(a, a.getFullYear() !== b.getFullYear())} – ${fmt(b, true)}`;
}

// ---- Funnel: click → attributed order → eligible order (all time) -------------
export function funnelFor(analytics) {
  const clicks = num(analytics?.clicks);
  const orders = num(analytics?.attributed_orders);
  const eligible = num(analytics?.eligible_orders);
  const pct = (v) => (clicks > 0 ? r1((v / clicks) * 100) : null);
  return {
    empty: clicks === 0,
    steps: [
      { key: 'clicks', label: 'Link clicks', value: clicks, pct: clicks > 0 ? 100 : null, tone: 'ok' },
      { key: 'orders', label: 'Attributed orders', value: orders, pct: pct(orders), tone: 'ok' },
      { key: 'eligible', label: 'Qualified orders', value: eligible, pct: pct(eligible), tone: 'hold' },
    ],
  };
}

// ---- Product share: top products by attributed sales, the rest as "Others" ----
const SHARE_TONES = ['forest', 'green', 'gold', 'amber', 'neutral'];
export function productShare(topProducts, max = 4) {
  const rows = (Array.isArray(topProducts) ? topProducts : [])
    .map((p) => ({ name: String(p?.name || 'Product'), qty: num(p?.qty), sales: num(p?.sales) }))
    .filter((p) => p.sales > 0)
    .sort((a, b) => b.sales - a.sales);
  const total = rows.reduce((s, p) => s + p.sales, 0);
  const head = rows.slice(0, max);
  const rest = rows.slice(max);
  const parts = head.map((p, i) => ({ key: `p${i}`, label: p.name, value: p.sales, qty: p.qty, tone: SHARE_TONES[i] }));
  if (rest.length > 0) parts.push({ key: 'others', label: `Others (${rest.length})`, value: rest.reduce((s, p) => s + p.sales, 0), qty: rest.reduce((s, p) => s + p.qty, 0), tone: 'neutral' });
  return { total, empty: total === 0, parts: parts.map((p) => ({ ...p, pct: total > 0 ? Math.round((p.value / total) * 100) : 0 })) };
}

// ---- Top links: the per-link rows with a conversion column and a URL ----------
export function topLinks(seriesLinks, { links = [], creator = null, campaigns = [], buildUrl = null, limit = 6 } = {}) {
  const byId = Object.fromEntries((Array.isArray(links) ? links : []).map((l) => [l.id, l]));
  const campaignById = Object.fromEntries((Array.isArray(campaigns) ? campaigns : []).map((c) => [c.id, c]));
  const rows = (Array.isArray(seriesLinks) ? seriesLinks : []).map((r) => {
    const link = r.link_id ? byId[r.link_id] : null;
    const url = buildUrl ? buildUrl(link || { destination_path: '/' }, creator, link ? campaignById[link.campaign_id] : null) : '';
    return {
      link_id: r.link_id ?? null, label: r.label, campaign: r.campaign || null,
      url: String(url || '').replace(/^https?:\/\//, ''),
      clicks: num(r.clicks), orders: num(r.orders), sales: num(r.sales), commission: num(r.commission),
      conversion: ratio(r.orders, r.clicks) == null ? null : r1(ratio(r.orders, r.clicks) * 100),
    };
  });
  rows.sort((a, b) => b.sales - a.sales || b.clicks - a.clicks);
  return rows.slice(0, limit);
}

// ---- Insights: sentences the figures support, never more ------------------------
// Each one names its source figure. None → the page says so instead.
export function insightsFor({ series, stats, links = [], money = (v) => `₹${Math.round(v)}` } = {}) {
  const out = [];
  const unit = series?.unit === 'week' ? 'week' : series?.unit === 'month' ? 'month' : 'day';
  if (series?.available) {
    const iSales = argMax(series.sales); const iClicks = argMax(series.clicks);
    if (iSales >= 0 && series.sales[iSales] > 0) {
      out.push({ key: 'best', icon: 'award', title: `Your best ${unit}`, body: `${bucketLabel(series.labels[iSales], series.unit)} brought in ${money(series.sales[iSales])} of attributed sales.` });
    } else if (iClicks >= 0 && series.clicks[iClicks] > 0) {
      out.push({ key: 'best', icon: 'externalLink', title: `Your busiest ${unit}`, body: `${bucketLabel(series.labels[iClicks], series.unit)} had ${series.clicks[iClicks]} ${series.clicks[iClicks] === 1 ? 'visit' : 'visits'} through your links.` });
    }
    const t = stats?.trends?.sales?.dir && stats.trends.sales.dir !== 'none' && stats.trends.sales.dir !== 'flat' ? ['sales', stats.trends.sales]
      : stats?.trends?.clicks?.dir && stats.trends.clicks.dir !== 'none' && stats.trends.clicks.dir !== 'flat' ? ['clicks', stats.trends.clicks] : null;
    if (t) {
      const [what, tr] = t;
      const noun = what === 'sales' ? 'Attributed sales' : 'Link clicks';
      out.push(tr.dir === 'new'
        ? { key: 'trend', icon: 'sparkle', title: `First ${what} this period`, body: `${noun} went from nothing in the previous period to ${what === 'sales' ? money(stats.sales) : stats.clicks} now.` }
        : { key: 'trend', icon: tr.dir === 'up' ? 'chevronUp' : 'chevronDown', title: `${noun} ${tr.dir === 'up' ? 'up' : 'down'} ${Math.abs(tr.pct)}%`, body: `Compared with the previous period of the same length.`, tone: tr.dir === 'up' ? 'ok' : 'hold' });
    }
  }
  const best = (Array.isArray(links) ? links : []).find((l) => l.sales > 0 || l.clicks > 0);
  if (best) {
    out.push({ key: 'link', icon: 'users', title: `${best.label} performs best`, body: best.sales > 0
      ? `${best.clicks} ${best.clicks === 1 ? 'click' : 'clicks'}, ${best.orders} ${best.orders === 1 ? 'order' : 'orders'} and ${money(best.sales)} of sales, all time.`
      : `${best.clicks} ${best.clicks === 1 ? 'click' : 'clicks'} so far and no orders yet — the first sale through it will show here.` });
  }
  return out.slice(0, 3);
}
function argMax(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return -1;
  let best = 0;
  for (let i = 1; i < arr.length; i += 1) if (num(arr[i]) > num(arr[best])) best = i;
  return best;
}

// ---- CSV export of what is on screen ------------------------------------------
export function analyticsCsv(series, links = []) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [['period', ...METRICS].join(',')];
  const n = series?.labels?.length || 0;
  for (let i = 0; i < n; i += 1) lines.push([series.labels[i], ...METRICS.map((m) => num(series[m]?.[i]))].map(esc).join(','));
  if (Array.isArray(links) && links.length > 0) {
    lines.push('');
    lines.push(['link', 'campaign', 'clicks', 'orders', 'sales', 'commission'].join(','));
    for (const l of links) lines.push([l.label, l.campaign || '', num(l.clicks), num(l.orders), num(l.sales), num(l.commission)].map(esc).join(','));
  }
  return `${lines.join('\n')}\n`;
}

// ---- Dual-axis geometry: counts left, money right -------------------------------
export function dualAxisGeometry({ clicks = [], orders = [], sales = [] }, { width = 720, height = 240, padL = 34, padR = 44, padT = 14, padB = 30 } = {}) {
  const a = (Array.isArray(clicks) ? clicks : []).map(num);
  const b = (Array.isArray(orders) ? orders : []).map(num);
  const c = (Array.isArray(sales) ? sales : []).map(num);
  const n = Math.max(a.length, b.length, c.length);
  const innerW = width - padL - padR; const innerH = height - padT - padB;
  const leftMax = Math.max(4, niceMax(Math.max(0, ...a, ...b)));
  const rightMax = Math.max(1000, niceMax(Math.max(0, ...c)));
  const x = (i) => (n <= 1 ? padL + innerW / 2 : padL + (i * innerW) / (n - 1));
  const yl = (v) => padT + innerH - (v / leftMax) * innerH;
  const yr = (v) => padT + innerH - (v / rightMax) * innerH;
  const baseY = padT + innerH;
  const path = (vals, y) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${r1(x(i))} ${r1(y(v))}`).join(' ');
  const line = path(a, yl); const orderLine = path(b, yl); const salesLine = path(c, yr);
  const area = n > 0 ? `${line} L${r1(x(n - 1))} ${baseY} L${r1(x(0))} ${baseY} Z` : '';
  // Small count axes use whole-number ticks so no label repeats (as the
  // dashboard's chart does); larger ones take quarters.
  const step = leftMax <= 4 ? 1 : leftMax % 2 === 0 ? 2 : 1;
  const leftTicks = leftMax <= 8
    ? Array.from({ length: leftMax / step + 1 }, (_, i) => i * step)
    : [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(leftMax * f));
  const rightTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => rightMax * f);
  return {
    width, height, padL, padR, padT, padB, innerW, innerH, n, leftMax, rightMax, baseY,
    empty: Math.max(0, ...a, ...b, ...c) === 0,
    leftTicks: leftTicks.map((v) => ({ v, y: r1(yl(v)) })),
    rightTicks: rightTicks.map((v) => ({ v, y: r1(yr(v)) })),
    xs: Array.from({ length: n }, (_, i) => r1(x(i))),
    clicksPts: a.map((v, i) => [r1(x(i)), r1(yl(v))]),
    salesPts: c.map((v, i) => [r1(x(i)), r1(yr(v))]),
    line, area, orderLine, salesLine,
  };
}

// ---- Grouped bars: two money series per bucket ---------------------------------
export function groupedBarGeometry(seriesA, seriesB, { width = 360, height = 170, padL = 36, padR = 6, padT = 10, padB = 24, gap = 0.3, minMax = 1000 } = {}) {
  const a = (Array.isArray(seriesA) ? seriesA : []).map(num);
  const b = (Array.isArray(seriesB) ? seriesB : []).map(num);
  const n = Math.max(a.length, b.length);
  const innerW = width - padL - padR; const innerH = height - padT - padB;
  const rawMax = Math.max(0, ...a, ...b);
  const yMax = Math.max(minMax, niceMax(rawMax));
  const baseY = padT + innerH;
  const slot = n > 0 ? innerW / n : innerW;
  const w = Math.max(2, (slot * (1 - gap)) / 2);
  const bar = (v, i, k) => { const hgt = (v / yMax) * innerH; return { v, x: r1(padL + i * slot + (slot - 2 * w) / 2 + k * w), y: r1(baseY - hgt), w: r1(w), h: r1(hgt) }; };
  return {
    width, height, padL, padR, padT, padB, n, yMax, baseY, empty: rawMax === 0,
    pairs: Array.from({ length: n }, (_, i) => ({ a: bar(a[i] || 0, i, 0), b: bar(b[i] || 0, i, 1), cx: r1(padL + i * slot + slot / 2) })),
    ticks: [0, 0.5, 1].map((f) => ({ v: yMax * f, y: r1(baseY - f * innerH) })),
  };
}

function niceMax(v) {
  if (v <= 0) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}
