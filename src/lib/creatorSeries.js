// ============================================================
// Creator portal charts — the pure part.
//
// Turns what the RPCs return into fixed-length number arrays, and turns those
// into SVG path data. No DOM, no React, no library: the sparkline is a
// polyline and a filled area, hand-built so the portal ships nothing extra.
//
// The empty case is designed, not tolerated: a series of zeros is still a
// series, and draws as a level baseline so the chart is present and honest
// ("waiting for data") rather than missing.
// ============================================================

export const SERIES_WEEKS = 12;
export const SERIES_MONTHS = 12;
export const METRICS = Object.freeze(['clicks', 'orders', 'products', 'sales', 'commission']);

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// my_creator_activity_series() → { clicks: number[12], orders: …, … }.
// Absent, failed or short input still yields full-length arrays of zeros, so
// every figure gets a chart whether or not 0032 is applied.
export function weeklySeries(raw, weeks = SERIES_WEEKS) {
  const rows = Array.isArray(raw?.series) ? raw.series : [];
  const out = {};
  for (const m of METRICS) {
    const vals = rows.map((r) => num(r?.[m]));
    const tail = vals.slice(-weeks);
    out[m] = Array.from({ length: weeks }, (_, i) => tail[i - (weeks - tail.length)] ?? 0);
  }
  out.weeks = rows.slice(-weeks).map((r) => String(r?.week || ''));
  out.available = rows.length > 0;
  return out;
}

// my_creator_earnings().monthly_history ([{month:'YYYY-MM', commission}]) →
// the last `months` calendar months, oldest first, zeros where absent.
export function monthlySeries(history, months = SERIES_MONTHS, now = new Date()) {
  const byMonth = new Map();
  for (const h of Array.isArray(history) ? history : []) if (h?.month) byMonth.set(String(h.month), num(h.commission));
  const keys = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return { keys, values: keys.map((k) => byMonth.get(k) ?? 0), available: byMonth.size > 0 };
}

// Running total of a series — the shape of "lifetime so far".
export function cumulative(points) {
  let acc = 0;
  return (Array.isArray(points) ? points : []).map((p) => (acc += num(p)));
}

export const isFlat = (points) => !Array.isArray(points) || points.length === 0 || points.every((p) => num(p) === num(points[0]));
export const isEmpty = (points) => !Array.isArray(points) || points.every((p) => num(p) === 0);

// SVG geometry. `pad` keeps the stroke inside the box; a flat series sits on
// a baseline near the bottom instead of collapsing to the middle.
export function sparkGeometry(points, { width = 96, height = 28, pad = 2 } = {}) {
  const vals = (Array.isArray(points) ? points : []).map(num);
  const n = vals.length;
  if (n === 0) return { line: '', area: '', last: null, flat: true, empty: true, width, height };
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const span = max - min;
  const innerH = height - pad * 2;
  const baseline = height - pad;
  const x = (i) => (n === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (n - 1));
  const y = (v) => (span === 0 ? baseline : baseline - ((v - min) / span) * innerH);
  const pts = vals.map((v, i) => [round(x(i)), round(y(v))]);
  const line = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px} ${py}`).join(' ');
  const area = `${line} L${pts[n - 1][0]} ${baseline} L${pts[0][0]} ${baseline} Z`;
  return { line, area, last: pts[n - 1], flat: span === 0, empty: vals.every((v) => v === 0), width, height, points: pts };
}
const round = (v) => Math.round(v * 10) / 10;

// ---- Range series (0032, range-based) ----------------------------------------
// my_creator_activity_series(range) → fixed-length arrays per metric, bucket
// labels, and the previous-period totals for the trend arrows. Absent RPC →
// zeros of the range's natural length, and `available: false`.
export const RANGES = Object.freeze([
  { id: '7d', label: '7D', buckets: 7 },
  { id: '30d', label: '30D', buckets: 30 },
  { id: '90d', label: '90D', buckets: 13 },
  { id: '1y', label: '1Y', buckets: 12 },
  { id: 'all', label: 'All Time', buckets: 12 },
]);
export const DEFAULT_RANGE = '7d';

export function rangeSeries(raw, rangeId = DEFAULT_RANGE) {
  const def = RANGES.find((r) => r.id === rangeId) || RANGES[0];
  const rows = Array.isArray(raw?.series) ? raw.series : [];
  const n = rows.length > 0 ? rows.length : def.buckets;
  const out = { range: def.id, unit: raw?.unit || (def.id === '7d' || def.id === '30d' ? 'day' : def.id === '90d' ? 'week' : 'month'), available: rows.length > 0 };
  for (const m of METRICS) out[m] = Array.from({ length: n }, (_, i) => num(rows[i]?.[m]));
  out.labels = Array.from({ length: n }, (_, i) => String(rows[i]?.at || ''));
  out.totals = Object.fromEntries(METRICS.map((m) => [m, out[m].reduce((a, b) => a + b, 0)]));
  out.previous = raw?.previous && typeof raw.previous === 'object'
    ? Object.fromEntries(METRICS.map((m) => [m, num(raw.previous[m])]))
    : null;
  out.links = Array.isArray(raw?.links) ? raw.links.map((l) => ({
    link_id: l?.link_id ?? null, label: String(l?.label || 'Link'), campaign: l?.campaign || null,
    clicks: num(l?.clicks), orders: num(l?.orders), sales: num(l?.sales), commission: num(l?.commission),
  })) : [];
  return out;
}

// Trend versus the previous period. No previous period, or a previous of
// zero, is "—" (not "+100%": there is nothing to be 100% of).
export function trend(current, previous) {
  const c = num(current); const p = previous == null ? null : num(previous);
  if (p == null) return { pct: null, dir: 'none', label: '—' };
  if (p === 0) return c > 0 ? { pct: null, dir: 'new', label: 'New' } : { pct: 0, dir: 'flat', label: '—' };
  const pct = Math.round(((c - p) / p) * 100);
  return { pct, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', label: `${pct > 0 ? '+' : ''}${pct}%` };
}

// Bucket labels for the chart axis: day → "5 Sep", month → "Sep 26".
export function bucketLabel(iso, unit) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const mon = d.toLocaleString('en-IN', { month: 'short' });
  if (unit === 'month') return `${mon} ${String(d.getFullYear()).slice(-2)}`;
  return `${d.getDate()} ${mon}`;
}

// ---- Area chart geometry --------------------------------------------------------
// Two count series on one axis (clicks as an area, orders as a line), a
// nice-number y scale, and x positions for the tooltip. All-zero → a level
// baseline with a 0–4 axis so the frame still reads as a chart.
export function areaChartGeometry({ clicks = [], orders = [] }, { width = 720, height = 180, padL = 30, padR = 12, padT = 14, padB = 26 } = {}) {
  const a = (Array.isArray(clicks) ? clicks : []).map(num);
  const b = (Array.isArray(orders) ? orders : []).map(num);
  const n = Math.max(a.length, b.length);
  const innerW = width - padL - padR; const innerH = height - padT - padB;
  const rawMax = Math.max(0, ...a, ...b);
  // Never an axis shorter than 4: a week with two clicks still gets room, and
  // small axes use whole-number ticks so no label repeats.
  const yMax = Math.max(4, niceMax(rawMax));
  const step = yMax <= 4 ? 1 : yMax % 2 === 0 ? 2 : 1;
  const ticks = yMax <= 8
    ? Array.from({ length: yMax / step + 1 }, (_, i) => i * step)
    : [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
  const x = (i) => (n <= 1 ? padL + innerW / 2 : padL + (i * innerW) / (n - 1));
  const y = (v) => padT + innerH - (yMax === 0 ? 0 : (v / yMax) * innerH);
  const baseY = padT + innerH;
  const path = (vals) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${r1(x(i))} ${r1(y(v))}`).join(' ');
  const line = path(a); const orderLine = path(b);
  const area = n > 0 ? `${line} L${r1(x(n - 1))} ${baseY} L${r1(x(0))} ${baseY} Z` : '';
  return {
    width, height, padL, padR, padT, padB, innerW, innerH, n, yMax, empty: rawMax === 0,
    ticks: ticks.map((v) => ({ v, y: r1(y(v)) })),
    xs: Array.from({ length: n }, (_, i) => r1(x(i))),
    clicksPts: a.map((v, i) => [r1(x(i)), r1(y(v))]),
    ordersPts: b.map((v, i) => [r1(x(i)), r1(y(v))]),
    line, area, orderLine, baseY,
  };
}
function niceMax(v) {
  if (v <= 0) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}
const r1 = (v) => Math.round(v * 10) / 10;

// ---- Donut geometry ---------------------------------------------------------------
// Segments as stroke-dasharray offsets on one circle. All-zero → one muted
// full ring, so the donut is present and reads as "nothing yet".
export function donutGeometry(parts, { size = 150, stroke = 16 } = {}) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r;
  const list = (Array.isArray(parts) ? parts : []).map((p) => ({ ...p, value: Math.max(0, num(p?.value)) }));
  const total = list.reduce((s, p) => s + p.value, 0);
  let offset = 0;
  const segments = list.map((p) => {
    const frac = total > 0 ? p.value / total : 0;
    const seg = { ...p, frac, dash: `${r1(frac * c)} ${r1(c - frac * c)}`, offset: r1(-offset) };
    offset += frac * c;
    return seg;
  });
  return { size, stroke, r, c: r1(c), cx: size / 2, cy: size / 2, total, empty: total === 0, segments };
}
